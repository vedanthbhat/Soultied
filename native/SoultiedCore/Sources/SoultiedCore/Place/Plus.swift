import Foundation

/*
 * Soultied Plus (src/plus/rules.ts says the same for the website). One of you having it covers you both.
 *   Free: daily letters, YouTube together, three Netflix / Prime Video nights a month, five quick games,
 *         the first escape room, and decorating with stitches.
 *   Plus: every Netflix / Prime Video night, cameras, voice and karaoke, every game and escape room,
 *         After dark's Hot cards, and bonus stitches every month.
 */
public enum PlusRules {
    /// the games anyone can play; the rest come with Plus
    public static let freeGames: Set<GameKind> = [.rps, .tug, .quickdraw, .doodle, .fireflies]
    /// the escape room anyone can play
    public static let freeRooms: Set<RoomId> = [.attic]
    /// Netflix / Prime Video nights a month without Plus
    public static let freeNights = 3
    /// stitches a place with Plus gets each month
    public static let bonusStitches = 150
    /// what the monthly stitches are kept under in meta/decor's `earned` ("plus-2026-11")
    public static func bonusKey(_ dateKey: String) -> String { "plus-\(month(dateKey))" }
    /// "2026-11" from "2026-11-11"
    public static func month(_ dateKey: String) -> String { String(dateKey.prefix(7)) }

    /// what Plus adds, in a line each (the paywall and the Plus page)
    public static let perks: [PlusPerk] = [
        PlusPerk("Every movie night", "Netflix and Prime Video together as often as you like (three nights a month are free)."),
        PlusPerk("See and hear each other", "Cameras, voice and karaoke night, on the website and the extension."),
        PlusPerk("Every game and escape room", "Coasters, Kitchen Rush, Paper Boats and the rest, and all four rooms behind the dark door."),
        PlusPerk("After dark, hot", "The bolder After dark cards, for when you’ve both picked Hot."),
        PlusPerk("Stitches every month", "\(bonusStitches) bonus stitches to decorate with, on the first visit each month."),
    ]
}

/// one thing Plus adds
public struct PlusPerk: Sendable, Identifiable {
    public let title: String
    public let line: String
    public var id: String { title }
    public init(_ title: String, _ line: String) {
        self.title = title
        self.line = line
    }
}

/// meta/plus: the Netflix and Prime Video nights you've had, by month ({ nights: { "2026-11": { "2026-11-03": true } } })
public struct PlusDoc: Sendable, Equatable {
    public var nights: [String: Set<String>] = [:]

    public init() {}

    public init(_ d: Doc?) {
        for (m, v) in (d?["nights"] as? Doc) ?? [:] {
            guard let days = v as? Doc else { continue }
            nights[m] = Set(days.compactMap { ($0.value as? Bool) == true ? $0.key : nil })
        }
    }

    /// nights had in a month ("2026-11")
    public func used(_ month: String) -> Int { nights[month]?.count ?? 0 }
}

/// Whether tonight can be a Netflix / Prime Video night (the website's nightCheck).
public struct NightCheck: Sendable, Equatable {
    /// you can start (or carry on with) tonight's
    public let ok: Bool
    /// free nights left this month (tonight's already counted if it's had)
    public let left: Int
    /// tonight's already one of them
    public let already: Bool
}

public func nightCheck(_ doc: PlusDoc, today: String, plus: Bool) -> NightCheck {
    let had = doc.nights[PlusRules.month(today)] ?? []
    let already = had.contains(today)
    let left = max(0, PlusRules.freeNights - had.count)
    return NightCheck(ok: plus || already || left > 0, left: left, already: already)
}
