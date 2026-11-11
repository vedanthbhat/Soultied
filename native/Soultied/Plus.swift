import CryptoKit
import FirebaseAuth
import StoreKit
import SwiftUI
import SoultiedCore

/*
 * Soultied Plus in the iPhone app: an App Store subscription (a month or a year, a week free the first time),
 * and the sheet that sells it. Whoever subscribes, the place gets Plus, so it covers you both: the app sends
 * Apple's signed transaction to Soultied's server (functions/index.js, plusApple), which checks Apple's
 * signature and writes the place's Plus and when it runs to. Renewals arrive the same way (and from Apple to
 * the server directly), so either phone keeps it going. Plus bought on soultied.app works here too.
 */

/// The App Store side: the two plans, buying, restoring, and telling the server. (Its work all happens on the
/// main thread; the methods that touch it say so.)
@Observable
final class PlusStore {
    static let shared = PlusStore()

    /// the yearly plan first
    static let ids = ["app.soultied.plus.year", "app.soultied.plus.month"]
    /// what the plans cost on the website, shown until the App Store's own prices arrive
    static let usual = (year: "$29.99", month: "$3.99")

    private(set) var products: [Product] = []
    private(set) var loading = false
    /// buying or restoring
    private(set) var busy = false
    /// a week free, for an Apple ID that hasn't had it
    private(set) var trial = false
    var problem: String?
    /// just bought: say thanks
    var thanks = false

    @ObservationIgnored private var updates: Task<Void, Never>?
    @ObservationIgnored private weak var place: PlaceModel?

    var year: Product? { products.first { $0.id == Self.ids[0] } }
    var month: Product? { products.first { $0.id == Self.ids[1] } }

    /// the app's open on a place: listen for purchases (renewals, Ask to Buy, other devices) and catch up
    @MainActor
    func start(_ p: PlaceModel) {
        place = p
        p.plusForSale = !products.isEmpty
        if updates == nil {
            updates = Task { [weak self] in
                for await r in StoreKit.Transaction.updates { await self?.handle(r) }
            }
        }
        Task {
            await load()
            await refresh()
        }
    }

    @MainActor
    func load() async {
        guard products.isEmpty, !loading else { return }
        loading = true
        defer { loading = false }
        do {
            let ps = try await Product.products(for: Self.ids)
            products = Self.ids.compactMap { id in ps.first { $0.id == id } }
            // (nothing's locked until Plus can actually be bought)
            place?.plusForSale = !products.isEmpty
            if let s = year?.subscription ?? month?.subscription {
                trial = await s.isEligibleForIntroOffer && s.introductoryOffer?.paymentMode == .freeTrial
            }
        } catch {
            problem = "The App Store didn’t answer. Check your connection and try again."
        }
    }

    @MainActor
    func buy(_ p: Product) async {
        guard let place, !place.isDemo else { return }
        busy = true
        problem = nil
        defer { busy = false }
        do {
            switch try await p.purchase(options: [.appAccountToken(Self.token(place.me))]) {
            case .success(let r):
                if await handle(r, force: true) { thanks = true }
            case .pending:
                problem = "Waiting for approval. Plus turns on as soon as it’s approved."
            case .userCancelled:
                break
            @unknown default:
                break
            }
        } catch {
            problem = "That didn’t go through, and nothing was charged. Try again in a moment."
        }
    }

    /// Restore purchases: what this Apple ID already has
    @MainActor
    func restore() async {
        busy = true
        problem = nil
        defer { busy = false }
        try? await AppStore.sync()
        var found = false
        for await r in StoreKit.Transaction.currentEntitlements {
            if await handle(r, force: true) { found = true }
        }
        if !found && !(place?.hasPlus ?? false) { problem = "There’s no Soultied Plus on this Apple ID to restore." }
    }

    /// what this Apple ID has now, sent on if the place doesn't know about it yet
    @MainActor
    func refresh() async {
        for await r in StoreKit.Transaction.currentEntitlements { await handle(r) }
    }

    /// a transaction from the App Store: checked, sent to the server, then finished
    @MainActor
    @discardableResult
    private func handle(_ r: VerificationResult<StoreKit.Transaction>, force: Bool = false) async -> Bool {
        guard case .verified(let t) = r, Self.ids.contains(t.productID) else { return false }
        guard t.revocationDate == nil, let ends = t.expirationDate, ends > Date() else {
            await t.finish()
            return false
        }
        // the place already has Plus at least that long: nothing new to say
        if !force, let until = place?.plusUntil, until >= ends.timeIntervalSince1970 * 1000 - 1000 {
            await t.finish()
            return true
        }
        guard await send(r.jwsRepresentation) else { return false }
        await t.finish()
        return true
    }

    private static let endpoint = URL(string: "https://asia-south1-soultied-c1543.cloudfunctions.net/plusApple")!

    /// Soultied's server checks Apple's signature and gives the place Plus
    @MainActor
    private func send(_ jws: String) async -> Bool {
        guard let place, !place.isDemo, let user = Auth.auth().currentUser else { return false }
        do {
            let token = try await user.getIDToken()
            var req = URLRequest(url: Self.endpoint)
            req.httpMethod = "POST"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            req.httpBody = try JSONSerialization.data(withJSONObject: ["sid": place.sid, "jws": jws])
            let (data, resp) = try await URLSession.shared.data(for: req)
            if (resp as? HTTPURLResponse)?.statusCode == 200 { return true }
            let code = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String
            switch code {
            case "taken": problem = "That subscription is already on another Soultied account."
            case "place": problem = "That didn’t reach your place. Try Restore purchases."
            default: problem = "Plus is paid for, but it didn’t switch on yet. It will next time you open Soultied."
            }
        } catch {
            problem = "Plus is paid for, but Soultied couldn’t be reached. It switches on next time you open the app."
        }
        return false
    }

    /// The UUID each purchase is tagged with (StoreKit's appAccountToken), from your Soultied account: the first
    /// 16 bytes of its SHA-256, marked as a version 5 UUID (functions/apple.js makes the same one to check it).
    static func token(_ uid: String) -> UUID {
        var b = Array(SHA256.hash(data: Data(uid.utf8)).prefix(16))
        b[6] = (b[6] & 0x0f) | 0x50
        b[8] = (b[8] & 0x3f) | 0x80
        return UUID(uuid: (b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], b[8], b[9], b[10], b[11], b[12], b[13], b[14], b[15]))
    }
}

// (only ever used from the main thread)
extension PlusStore: @unchecked Sendable {}

/* ---------- asking for Plus, from anywhere ---------- */

struct PlusReason: Identifiable {
    let id = UUID()
    let title: String
    let line: String

    static let plain = PlusReason(title: "Soultied Plus", line: "Everything in Soultied, for both of you. One of you having it covers you both.")
    static func game(_ name: String) -> PlusReason {
        PlusReason(title: "\(name) is in Soultied Plus", line: "Five games are free. Plus opens every game and all four escape rooms, for both of you.")
    }
    static func room(_ name: String) -> PlusReason {
        PlusReason(title: "\(name) is in Soultied Plus", line: "The attic is free. Plus opens all four rooms behind the dark door, and every game.")
    }
    static let nights = PlusReason(
        title: "Your free movie nights are used up",
        line: "Netflix and Prime Video together are free \(PlusRules.freeNights) nights a month. Plus has every night, for both of you."
    )
    static let hot = PlusReason(title: "Hot is in Soultied Plus", line: "Flirty After dark cards are free. Plus adds the bolder Hot ones, once you’ve both picked Hot.")
}

/// "That's in Plus": any screen under the tabs can ask for the Plus sheet
@Observable
final class PlusGate {
    static let shared = PlusGate()
    var reason: PlusReason?
    func show(_ r: PlusReason) {
        Haptics.tap()
        reason = r
    }
}

// (only ever used from the main thread)
extension PlusGate: @unchecked Sendable {}

private struct PlusSheetHost: ViewModifier {
    let place: PlaceModel
    @State private var gate = PlusGate.shared

    func body(content: Content) -> some View {
        content.sheet(item: Binding(get: { gate.reason }, set: { gate.reason = $0 })) { r in
            PlusSheet(place: place, reason: r)
                .presentationDragIndicator(.visible)
                .presentationBackground(Color.paper)
        }
    }
}

extension View {
    /// shows the Plus sheet whenever something asks for it (PlusGate)
    func plusSheet(_ place: PlaceModel) -> some View { modifier(PlusSheetHost(place: place)) }
}

/* ---------- the sheet ---------- */

struct PlusSheet: View {
    let place: PlaceModel
    var reason: PlusReason = .plain
    @State private var store = PlusStore.shared
    @State private var managing = false
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                PixelTag(text: "Soultied Plus")
                Text(store.thanks ? "Thank you! Plus is on" : reason.title).font(.pxTitle).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
                Text(store.thanks ? "Everything below is open now, for both of you." : reason.line).font(.pxBody).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)

                VStack(alignment: .leading, spacing: 10) {
                    ForEach(PlusRules.perks) { p in
                        HStack(alignment: .top, spacing: 10) {
                            GlyphView(glyph: Icons.heart, scale: 2).padding(.top, 3)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(p.title).font(.pxBodyBold).foregroundStyle(Color.inkSoft)
                                Text(p.line).font(.pxSmall).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                }
                .padding(14)
                .pxInset()

                if place.hasPlus {
                    on
                } else if place.isDemo {
                    Text("This is the demo room, so everything’s open to try. In your own place, either of you can get Plus, and it covers you both.")
                        .font(.pxSmall).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
                } else {
                    plans
                }

                if let p = store.problem {
                    Text(p).font(.pxSmall).foregroundStyle(Color.terracottaD).fixedSize(horizontal: false, vertical: true)
                }

                HStack(spacing: 16) {
                    Button("Terms") { openURL(URL(string: "https://soultied.app/terms/")!) }
                    Button("Privacy") { openURL(URL(string: "https://soultied.app/privacy/")!) }
                    Spacer()
                    if !place.isDemo {
                        Button("Restore purchases") { Task { await store.restore() } }.disabled(store.busy)
                    }
                }
                .font(.px(13, 600))
                .foregroundStyle(Color.terracottaD)

                Button(store.thanks || place.hasPlus ? "Lovely" : "Not now") { dismiss() }
                    .buttonStyle(.px(.paper, small: true, wide: true))
            }
            .padding(20)
        }
        .task { await store.load() }
        .onDisappear { store.thanks = false }
        .manageSubscriptionsSheet(isPresented: $managing)
    }

    /// Plus is on: until when, and a way to manage an App Store subscription
    private var on: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let until = place.plusUntil {
                Text("On for you both until \(Date(timeIntervalSince1970: until / 1000).formatted(date: .long, time: .omitted)).")
                    .font(.pxBodyBold).foregroundStyle(Color.sageD)
            }
            Button("Manage my subscription") { managing = true }
                .buttonStyle(.px(.paper, small: true, wide: true))
        }
    }

    private var plans: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button {
                if let y = store.year { Task { await store.buy(y) } }
            } label: {
                VStack(spacing: 2) {
                    Text(store.trial ? "Start 7 days free" : "A year: \(store.year?.displayPrice ?? PlusStore.usual.year)")
                    Text(store.trial ? "then \(store.year?.displayPrice ?? PlusStore.usual.year) a year · save 37%" : "save 37% on paying monthly")
                        .font(.px(12, 500)).opacity(0.85)
                }
            }
            .buttonStyle(.px(.terracotta, wide: true))
            .disabled(store.year == nil || store.busy)

            Button("A month: \(store.month?.displayPrice ?? PlusStore.usual.month)") {
                if let m = store.month { Task { await store.buy(m) } }
            }
            .buttonStyle(.px(.paper, wide: true))
            .disabled(store.month == nil || store.busy)

            Text(fineprint)
                .font(.pxTiny).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
            if store.loading { Text("Asking the App Store for prices…").font(.pxTiny).foregroundStyle(Color.muted) }
        }
    }

    private var fineprint: String {
        let year = store.year?.displayPrice ?? PlusStore.usual.year
        let trial = store.trial ? "The first 7 days are free, then it’s \(year) a year unless you cancel before they end. " : ""
        return "One of you subscribing covers you both. \(trial)Payment is charged to your Apple ID. It renews automatically for the same price and length unless you turn it off at least 24 hours before the period ends; manage or cancel any time in Settings › your name › Subscriptions."
    }
}

/* ---------- in Us ---------- */

/// Us: whether you have Plus, and a way to it
struct PlusCardView: View {
    let place: PlaceModel

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Soultied Plus").font(.pxHeading).foregroundStyle(Color.inkSoft)
                Spacer()
                if place.hasPlus { PixelTag(text: "On") }
            }
            if place.hasPlus, let until = place.plusUntil {
                Text("Every movie night, cameras and voice, every game and room, After dark’s Hot cards and monthly stitches: on for you both until \(Date(timeIntervalSince1970: until / 1000).formatted(date: .abbreviated, time: .omitted)).")
                    .font(.pxSmall).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
            } else {
                Text("Every movie night, every game and escape room, After dark’s Hot cards and \(PlusRules.bonusStitches) stitches a month. One of you having it covers you both.")
                    .font(.pxSmall).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
                if !place.isDemo {
                    let n = place.night
                    Text("\(n.left) of \(PlusRules.freeNights) free movie nights left this month.").font(.pxTiny).foregroundStyle(Color.muted)
                }
            }
            Button(place.hasPlus ? "See Plus" : "Get Soultied Plus") { PlusGate.shared.show(.plain) }
                .buttonStyle(.px(place.hasPlus ? .paper : .terracotta, small: true, wide: true))
        }
        .pxCard()
    }
}
