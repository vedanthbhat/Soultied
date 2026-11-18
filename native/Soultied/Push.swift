import SwiftUI
import UIKit
import UserNotifications
import FirebaseAuth
import FirebaseMessaging
import SoultiedCore

/*
 * Notifications. This phone's part:
 *   - asks once whether it may (a card on Home, and a switch in Us), then registers with Apple and Firebase and
 *     keeps its token and time zone in meta/push (PlaceModel.savePushDevice), so the server can reach it
 *   - when you do something your person would want to know about, PlaceModel calls its nudger: this sends it to
 *     Soultied's server (functions/index.js pushNote), which decides whether to tell their phone (their
 *     switches, the time where they are, not too often) and what it says (functions/push.js)
 *   - a tap on one opens the right place (letters, games, the TV, the wall, the pet)
 * Nothing shows while the app's open: the room already shows it.
 */

@Observable
final class Push: NSObject {
    static let shared = Push()

    /// whether this phone may show notifications (notDetermined until it's been asked)
    private(set) var status: UNAuthorizationStatus = .notDetermined
    /// where a tapped notification wants to go (MainView takes it): letters, play, watch, wall, pet, home
    var open: String?

    @ObservationIgnored private weak var place: PlaceModel?
    @ObservationIgnored private var token: String?

    private static let endpoint = URL(string: "https://asia-south1-soultied-c1543.cloudfunctions.net/pushNote")!

    /// (the app's delegate, as it starts)
    func start() {
        UNUserNotificationCenter.current().delegate = self
        Messaging.messaging().delegate = self
        refresh()
    }

    /// the place this phone's in: its token goes there, and what you do there gets sent
    @MainActor
    func use(_ place: PlaceModel) {
        self.place = place
        place.nudger = { [weak self] kind, args in self?.send(kind, args) }
        keepToken()
    }

    /// what the phone says now (it can change in Settings while the app's away)
    func refresh() {
        UNUserNotificationCenter.current().getNotificationSettings { s in
            DispatchQueue.main.async {
                self.status = s.authorizationStatus
                if s.authorizationStatus == .authorized || s.authorizationStatus == .provisional {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
        }
    }

    /// ask (once: after that it's the Settings app's to change)
    @MainActor
    func ask() async {
        let ok = (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        if ok { UIApplication.shared.registerForRemoteNotifications() }
        refresh()
    }

    /// (from the app's delegate) Apple's address for this phone, which Firebase needs to reach it
    func apnsToken(_ data: Data) {
        Messaging.messaging().apnsToken = data
    }

    @MainActor
    private func keepToken() {
        guard let place, let token, !Launch.demo else { return }
        place.savePushDevice(token: token, tz: TimeZone.current.identifier)
    }

    /// to Soultied's server, which tells your person's phone if it should
    private func send(_ kind: String, _ args: Doc) {
        guard let place, !place.isDemo, let user = Auth.auth().currentUser else { return }
        let sid = place.sid
        // (only what JSON can carry)
        let body: [String: Any] = ["sid": sid, "kind": kind, "args": args.filter { $0.value is String || $0.value is Bool || $0.value is Double || $0.value is Int }]
        Task {
            guard let idToken = try? await user.getIDToken(), let data = try? JSONSerialization.data(withJSONObject: body) else { return }
            var req = URLRequest(url: Self.endpoint)
            req.httpMethod = "POST"
            req.timeoutInterval = 20
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.setValue("Bearer \(idToken)", forHTTPHeaderField: "Authorization")
            req.httpBody = data
            _ = try? await URLSession.shared.data(for: req)
        }
    }
}

extension Push: MessagingDelegate {
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        DispatchQueue.main.async {
            self.token = fcmToken
            MainActor.assumeIsolated { self.keepToken() }
        }
    }
}

extension Push: UNUserNotificationCenterDelegate {
    /// while the app's open the room already shows it: no banner
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        []
    }

    /// a tap: open where it's about
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        let where_ = response.notification.request.content.userInfo["open"] as? String
        await MainActor.run { self.open = where_ ?? "home" }
    }
}

// (only ever changed on the main thread)
extension Push: @unchecked Sendable {}

/* ---------- the switches, in Us ---------- */

/// each kind of notification, with its own switch (the groups in functions/push.js)
private let PUSH_GROUPS: [(id: String, name: String, about: String)] = [
    ("letters", "Letters", "They sealed today’s letter, asked you something, or answered"),
    ("touches", "Touches", "A hug, a kiss, a high five"),
    ("games", "Games", "Your move, or they want to play now"),
    ("watch", "Watching", "They put something on the TV"),
    ("wall", "The wall", "A note, doodle or photo pinned up, a voice note, today’s photo"),
    ("pet", "The pet", "They looked after it, and it’s your turn"),
]

struct NotificationsCard: View {
    let place: PlaceModel
    @State private var push = Push.shared
    @Environment(\.openURL) private var openURL

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Notifications").font(.pxHeading).foregroundStyle(Color.inkSoft)
            switch push.status {
            case .notDetermined:
                Text("Get a little nudge when \(place.theirName) writes, sends a hug or makes their move. Never between 11pm and 8am.")
                    .font(.pxSmall).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
                Button("Turn them on") {
                    Haptics.tap()
                    Task { await push.ask() }
                }
                .buttonStyle(.px(.terracotta, small: true))
            case .denied:
                Text("They’re off for Soultied in your iPhone’s Settings.").font(.pxSmall).foregroundStyle(Color.muted)
                Button("Open Settings") {
                    if let u = URL(string: UIApplication.openNotificationSettingsURLString) { openURL(u) }
                }
                .buttonStyle(.px(.paper, small: true))
            default:
                Text("Never between 11pm and 8am where you are. Just for you: \(place.theirName) has their own.")
                    .font(.pxSmall).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
                ForEach(PUSH_GROUPS, id: \.id) { g in
                    Toggle(isOn: Binding(get: { place.pushOn(g.id) }, set: { on in
                        Haptics.select()
                        place.setPush(g.id, on)
                    })) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(g.name).font(.pxBodyBold).foregroundStyle(Color.inkSoft)
                            Text(g.about).font(.pxTiny).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .tint(Color.sage)
                }
            }
        }
        .pxCard()
        .onAppear { push.refresh() }
    }
}

/* ---------- asking, on Home ---------- */

/// once your person's moved in, and until you answer: would you like a nudge when they do something?
struct PushAskCard: View {
    let place: PlaceModel
    @State private var push = Push.shared
    @AppStorage("soultied_push_later") private var later = 0.0

    var body: some View {
        // (asked again a week after "Not now")
        if place.partnerHere, push.status == .notDetermined, Date().timeIntervalSince1970 - later > 7 * 86400 {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top, spacing: 12) {
                    GlyphView(glyph: Icons.stitch, scale: 3)
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Know when \(place.theirName)’s been by").font(.pxBodyBold).foregroundStyle(Color.inkSoft)
                        Text("A nudge when they seal today’s letter, send a hug or make their move. Never at night.")
                            .font(.pxSmall).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
                    }
                }
                HStack(spacing: 8) {
                    Button("Turn on") {
                        Haptics.tap()
                        Task { await push.ask() }
                    }
                    .buttonStyle(.px(.terracotta, small: true))
                    Button("Not now") {
                        Haptics.tap()
                        later = Date().timeIntervalSince1970
                    }
                    .buttonStyle(.px(.paper, small: true))
                }
            }
            .pxCard()
        }
    }
}
