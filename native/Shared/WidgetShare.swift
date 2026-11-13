import Foundation
import Security

/*
 * What the app and its home-screen widget share: which place you're in, who your person is, a way for the
 * widget to sign in as you (Firebase's refresh token), and the last doodle your person sent. It's kept in a
 * keychain group the two of them share (keychain-access-groups in both entitlements), so the widget can look
 * for a new doodle by itself, even when the app hasn't been opened in a while.
 */
enum WidgetShare {
    /// the widgets' kinds (WidgetCenter reloads them by these): their doodle, and our board of photos
    static let kind = "SoultiedDoodle"
    static let boardKind = "SoultiedBoard"
    /// and the fire, the countdown, your person's mood, and all three together
    static let fireKind = "SoultiedFire"
    static let countdownKind = "SoultiedCountdown"
    static let moodKind = "SoultiedMood"
    static let usKind = "SoultiedUs"
    static var usKinds: [String] { [fireKind, countdownKind, moodKind, usKind] }

    struct Config: Codable, Equatable {
        var sid: String
        var me: String
        var them: String
        var themName: String
        /// Firebase's web API key and project, and the app's bundle id (the key is only good for this app)
        var apiKey: String
        var project: String
        var bundle: String
        /// lets the widget get a short-lived sign-in of its own (Firebase's securetoken service)
        var refresh: String
    }

    struct Drawing: Codable, Equatable {
        /// the note it's on
        var id: String
        /// 96 × 72, one hex digit a pixel (an old 48 × 36 one is drawn twice as big)
        var px: String
        /// when it was pinned up (ms)
        var at: Double
    }

    /// what the fire, countdown and mood widgets are worked out from (the app leaves it; the widgets refresh it)
    struct Us: Codable, Equatable {
        /// the days you were both here (the newest few hundred), and the last day each of you came in
        var together: [String] = []
        var meSeen = ""
        var themSeen = ""
        /// whose seat's on the left (whoever started the place), for whose log goes where
        var meLeft = true
        /// together since (YYYY-MM-DD, or "")
        var since = ""
        /// the next time you're together
        var visitDate = ""
        var visitWhat = ""
        /// your person's mood (a MoodId), their words, and when (ms)
        var mood: String?
        var moodText = ""
        var moodAt = 0.0
        /// the wallpaper, for the picture of the fire
        var wall = "sage"
    }

    struct Saved: Codable, Equatable {
        var config: Config?
        var drawing: Drawing?
        var us: Us?
        /// when the widget last asked (ms), so it can say "checked a moment ago"
        var checked: Double?
    }

    /// TEAMID.app.soultied.shared, from each one's Info.plist (nothing in a build made without a team)
    static var group: String? {
        guard let g = Bundle.main.object(forInfoDictionaryKey: "SoultiedKeychainGroup") as? String, !g.isEmpty, !g.hasPrefix("$("), !g.hasPrefix(".") else { return nil }
        return g
    }

    private static let service = "app.soultied.widget"
    private static let account = "share"

    private static func query() -> [String: Any] {
        var q: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        if let g = group { q[kSecAttrAccessGroup as String] = g }
        return q
    }

    static func load() -> Saved {
        var q = query()
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let data = out as? Data,
              let saved = try? JSONDecoder().decode(Saved.self, from: data) else { return Saved() }
        return saved
    }

    /// keeps it, if it's changed; says whether it had
    @discardableResult
    static func store(_ s: Saved) -> Bool {
        if load() == s { return false }
        guard let data = try? JSONEncoder().encode(s) else { return false }
        let q = query()
        // (readable once the phone's been unlocked after starting up, so the widget can look while it's locked)
        let attrs: [String: Any] = [kSecValueData as String: data, kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock]
        var status = SecItemUpdate(q as CFDictionary, attrs as CFDictionary)
        if status == errSecItemNotFound {
            var add = q
            add.merge(attrs) { _, b in b }
            status = SecItemAdd(add as CFDictionary, nil)
        }
        return status == errSecSuccess
    }

    static func clear() { SecItemDelete(query() as CFDictionary) }

    /// "3 hours ago"
    static func ago(_ at: Double, now: Date = Date()) -> String {
        let s = max(0, now.timeIntervalSince1970 - at / 1000)
        if s < 90 { return "just now" }
        if s < 3600 { return "\(Int(s / 60)) min ago" }
        if s < 2 * 3600 { return "an hour ago" }
        if s < 86400 { return "\(Int(s / 3600)) hours ago" }
        if s < 2 * 86400 { return "yesterday" }
        if s < 14 * 86400 { return "\(Int(s / 86400)) days ago" }
        return "a while ago"
    }
}
