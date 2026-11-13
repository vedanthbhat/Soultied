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

/// what Plus adds, as tiles: a picture, a name, a line
private struct PlusFeature: Identifiable {
    let id: String
    let glyph: Glyph
    let title: String
    let line: String
    /// the tile's picture sits on this
    let tint: String

    static var all: [PlusFeature] {
        [
            PlusFeature(id: "nights", glyph: Icons.tv, title: "Every movie night", line: "Netflix and Prime Video together, as often as you like.", tint: "#c4dcef"),
            PlusFeature(id: "cams", glyph: Icons.camera, title: "See and hear each other", line: "Cameras, voice and karaoke night, on the website and the extension.", tint: "#ddd0ef"),
            PlusFeature(id: "games", glyph: Icons.play, title: "All \(GameKind.allCases.count) games", line: "Coasters, Kitchen Rush, Paper Boats and the rest.", tint: "#cfe3b8"),
            PlusFeature(id: "rooms", glyph: Icons.door, title: "All \(RoomId.allCases.count) escape rooms", line: "Every room behind the dark door, to solve together.", tint: "#f6e39a"),
            PlusFeature(id: "hot", glyph: Icons.flame, title: "After dark, hot", line: "The bolder cards, once you’ve both picked Hot.", tint: "#f4c2bd"),
            PlusFeature(id: "stitches", glyph: Icons.spool, title: "\(PlusRules.bonusStitches) stitches a month", line: "Extra to decorate your place with, every month.", tint: "#eadbbd"),
        ]
    }
}

/// the top of the sheet: the two of you on the couch, a show on, hearts going up
private struct PlusHero: View {
    let place: PlaceModel
    @Environment(\.displayScale) private var displayScale
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var renderer = WatchRenderer()
    @State private var start = Date()

    /// the part of the room shown (room pixels): the TV, the lamp and the couch
    private static let crop = (x: 48.0, y: 8.0, w: 224.0, h: 156.0)
    private static let goingUp: [ReactionKind] = [.heart, .laugh, .heart, .star, .heart, .wow]

    private func scene(_ reactions: [WatchReaction]) -> WatchState {
        let mine = place.myLook
        let theirs = place.theirLook ?? (place.me == place.hostId ? Wardrobe.defaultB : Wardrobe.defaultA)
        return WatchState(left: mine, right: theirs, tv: .playing, reactions: reactions)
    }

    var body: some View {
        GeometryReader { geo in
            // whole screen pixels to a room pixel, as big as the crop fits across
            let u = max(1, (geo.size.width * displayScale / CGFloat(Self.crop.w)).rounded(.down)) / displayScale
            TimelineView(.animation(minimumInterval: 1.0 / 12, paused: reduceMotion)) { ctx in
                let t = ctx.date.timeIntervalSince(start)
                let now = ctx.date.timeIntervalSince1970 * 1000
                // a reaction every couple of seconds, from one of you then the other
                let k = Int(t / 1.6)
                let ups = (max(0, k - 2)...k).map { i in
                    WatchReaction(kind: Self.goingUp[i % Self.goingUp.count], seat: i % 2 == 0 ? .left : .right, t0: start.timeIntervalSince1970 * 1000 + Double(i) * 1600)
                }
                if let img = Pixels.image(renderer.render(scene(reduceMotion ? [] : ups), t, now: now)) {
                    Image(decorative: img, scale: 1)
                        .resizable()
                        .interpolation(.none)
                        .frame(width: CGFloat(WATCH_W) * u, height: CGFloat(WATCH_H) * u)
                        .offset(x: (geo.size.width - CGFloat(Self.crop.w) * u) / 2 - CGFloat(Self.crop.x) * u, y: -CGFloat(Self.crop.y) * u)
                }
            }
            .frame(width: geo.size.width, height: geo.size.height, alignment: .topLeading)
            .clipped()
        }
        .aspectRatio(CGFloat(Self.crop.w / Self.crop.h), contentMode: .fit)
        .background(Color.roomBrown)
        .overlay(alignment: .topLeading) {
            PixelTag(text: "Soultied Plus").padding(10)
        }
        .overlay(alignment: .bottomLeading) {
            Text("Movie night, every night")
                .font(.px(13, 700))
                .foregroundStyle(Color.cream)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.ink.opacity(0.85))
                .padding(10)
        }
        .padding(PX)
        .background(NotchedFrame(notch: PX).fill(Color.ink))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("The two of you on the couch, watching a show, sending hearts")
    }
}

struct PlusSheet: View {
    let place: PlaceModel
    var reason: PlusReason = .plain
    @State private var store = PlusStore.shared
    @State private var managing = false
    /// the plan picked (the year, to start with)
    @State private var yearly = true
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    var body: some View {
        ScrollViewReader { proxy in
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                PlusHero(place: place)

                VStack(alignment: .leading, spacing: 6) {
                    Text(store.thanks ? "Thank you! Plus is on" : reason.title == PlusReason.plain.title ? "Everything, for both of you" : reason.title)
                        .font(.pxTitle).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
                    Text(store.thanks ? "Everything below is open now, for both of you." : reason.line)
                        .font(.pxBody).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
                }

                features
                both

                Group {
                    if place.hasPlus {
                        on
                    } else {
                        plans
                    }
                }
                .id("plans")

                if let p = store.problem {
                    Text(p).font(.pxSmall).foregroundStyle(Color.terracottaD).fixedSize(horizontal: false, vertical: true)
                }

                compare

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
        .onAppear {
            // (the screenshots: down at the plans)
            if Launch.args.contains("-plusPlans") {
                DispatchQueue.main.asyncAfter(deadline: .now() + 1) { proxy.scrollTo("plans", anchor: .top) }
            }
        }
        }
        .task { await store.load() }
        .onDisappear { store.thanks = false }
        .manageSubscriptionsSheet(isPresented: $managing)
    }

    /* what's in it */

    private var features: some View {
        let all = PlusFeature.all
        return Grid(horizontalSpacing: 12, verticalSpacing: 12) {
            ForEach(0..<(all.count + 1) / 2, id: \.self) { r in
                GridRow {
                    tile(all[r * 2])
                    if r * 2 + 1 < all.count { tile(all[r * 2 + 1]) } else { Color.clear }
                }
            }
        }
    }

    private func tile(_ f: PlusFeature) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            GlyphView(glyph: f.glyph, scale: 3)
                .frame(width: 46, height: 46)
                .background(Color(hex: f.tint))
                .overlay(Rectangle().strokeBorder(Color.ink, lineWidth: 2))
            Text(f.title).font(.px(15, 700)).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
            Text(f.line).font(.px(12, 500)).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
        }
        .padding(12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .pxBox(.paperHi)
        .accessibilityElement(children: .combine)
    }

    /// one of you having it covers you both
    private var both: some View {
        HStack(spacing: 12) {
            GlyphView(glyph: Icons.couch, scale: 3)
            VStack(alignment: .leading, spacing: 2) {
                Text("One Plus, two of you").font(.px(15, 700)).foregroundStyle(Color.inkSoft)
                Text("Whoever gets it, it covers you both, on the iPhone, the website and the extension.")
                    .font(.px(12, 500)).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pxBox(Color(hex: "#e3ebd5"))
    }

    /// free next to Plus
    private var compare: some View {
        VStack(spacing: 0) {
            compareRow("", "Free", "Plus", header: true)
            compareRow("Letters, YouTube, decor", "✓", "✓")
            compareRow("Netflix and Prime nights", "\(PlusRules.freeNights) a month", "Every night")
            compareRow("Games", "\(PlusRules.freeGames.count)", "All \(GameKind.allCases.count)")
            compareRow("Escape rooms", "\(PlusRules.freeRooms.count)", "All \(RoomId.allCases.count)")
            compareRow("Cameras and voice", "–", "✓")
            compareRow("Hot cards", "–", "✓")
            compareRow("Bonus stitches", "–", "\(PlusRules.bonusStitches) a month", last: true)
        }
        .pxInset()
        .accessibilityElement(children: .contain)
    }

    private func compareRow(_ what: String, _ free: String, _ plus: String, header: Bool = false, last: Bool = false) -> some View {
        HStack(spacing: 0) {
            Text(what)
                .font(.px(13, header ? 700 : 500))
                .foregroundStyle(Color.inkSoft)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.leading, 10)
            Text(free)
                .font(.px(13, header ? 700 : 500))
                .foregroundStyle(header ? Color.inkSoft : Color.muted)
                .frame(width: 78)
            Text(plus)
                .font(.px(13, 700))
                .foregroundStyle(header ? Color.cream : Color.terracottaD)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .frame(width: 96)
                .frame(maxHeight: .infinity)
                .background(header ? Color.terracotta : Color.terracotta.opacity(0.12))
        }
        .frame(minHeight: 34)
        .overlay(alignment: .bottom) {
            if !last { Rectangle().fill(Color.paperShade).frame(height: 1) }
        }
        .accessibilityElement(children: .combine)
    }

    /* the plans */

    private var yearPrice: String { store.year?.displayPrice ?? PlusStore.usual.year }
    private var monthPrice: String { store.month?.displayPrice ?? PlusStore.usual.month }
    /// the year's price, a month at a time
    private var yearMonthly: String { store.year.map { ($0.price / 12).formatted($0.priceFormatStyle) } ?? "$2.50" }
    /// how much less the year costs than twelve months
    private var saving: Int {
        guard let y = store.year, let m = store.month, m.price > 0 else { return 37 }
        let r = 1 - NSDecimalNumber(decimal: y.price).doubleValue / (NSDecimalNumber(decimal: m.price).doubleValue * 12)
        return max(0, Int((r * 100).rounded(.down)))
    }

    private var plans: some View {
        VStack(alignment: .leading, spacing: 10) {
            planCard(year: true)
            planCard(year: false)
            Button {
                Haptics.tap()
                guard !place.isDemo, let p = yearly ? store.year : store.month else { return }
                Task { await store.buy(p) }
            } label: {
                VStack(spacing: 2) {
                    Text(yearly && store.trial ? "Start 7 days free" : "Get Soultied Plus")
                    Text(yearly ? (store.trial ? "then \(yearPrice) a year · cancel any time" : "\(yearPrice) a year · cancel any time") : "\(monthPrice) a month · cancel any time")
                        .font(.px(12, 500)).opacity(0.85)
                }
            }
            .buttonStyle(.px(.terracotta, wide: true))
            .disabled(store.busy || (!place.isDemo && (yearly ? store.year : store.month) == nil))
            if place.isDemo {
                Text("This is the demo room, so everything’s open to try. In your own place, either of you can get Plus, and it covers you both.")
                    .font(.pxSmall).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
            }
            if store.loading { Text("Asking the App Store for prices…").font(.pxTiny).foregroundStyle(Color.muted) }
            Text(fineprint)
                .font(.pxTiny).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
        }
    }

    private func planCard(year: Bool) -> some View {
        let picked = yearly == year
        return Button {
            Haptics.tap()
            yearly = year
        } label: {
            HStack(spacing: 12) {
                // (a pixel radio button)
                ZStack {
                    Rectangle().fill(picked ? Color.terracotta : Color.paperHi)
                    if picked { Rectangle().fill(Color.cream).frame(width: 6, height: 6) }
                }
                .frame(width: 18, height: 18)
                .overlay(Rectangle().strokeBorder(Color.ink, lineWidth: 2))
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(year ? "A year" : "A month").font(.px(16, 700)).foregroundStyle(Color.inkSoft)
                        if year { PixelTag(text: "Save \(saving)%") }
                    }
                    Text(year ? (store.trial ? "7 days free, then \(yearPrice) a year" : "\(yearPrice) a year") : "\(monthPrice) a month")
                        .font(.px(12, 500)).foregroundStyle(Color.muted)
                }
                Spacer(minLength: 4)
                VStack(alignment: .trailing, spacing: 0) {
                    Text(year ? yearMonthly : monthPrice).font(.px(17, 700)).foregroundStyle(Color.inkSoft)
                    Text("a month").font(.px(11, 500)).foregroundStyle(Color.muted)
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(picked ? Color(hex: "#fbe6d6") : Color.paperHi)
            .overlay(Rectangle().strokeBorder(picked ? Color.terracottaD : Color.paperShade, lineWidth: picked ? 3 : 2))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(picked ? .isSelected : [])
    }

    /// Plus is on: until when, and a way to manage an App Store subscription
    private var on: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                GlyphView(glyph: Icons.check, scale: 3)
                Text("Plus is on for you both").font(.px(16, 700)).foregroundStyle(Color.sageD)
            }
            if let until = place.plusUntil {
                Text("Until \(Date(timeIntervalSince1970: until / 1000).formatted(date: .long, time: .omitted)).")
                    .font(.pxSmall).foregroundStyle(Color.muted)
            }
            Button("Manage my subscription") { managing = true }
                .buttonStyle(.px(.paper, small: true, wide: true))
        }
    }

    private var fineprint: String {
        let trial = store.trial ? "The first 7 days are free, then it’s \(yearPrice) a year unless you cancel before they end. " : ""
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
