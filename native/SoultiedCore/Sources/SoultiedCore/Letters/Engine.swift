import Foundation

/*
 * Daily letters (src/letters/engine.ts): five cards a day, plus an opt-in After dark set of three, and the
 * 30 days of knowing each other. Which cards a couple gets on a date is worked out from the couple's id and
 * the date, exactly as the website does, so a phone and a laptop always agree.
 */

public enum CardKind: String, CaseIterable, Sendable {
    case tot, know, connect, spicy, journey, open, likely, distance, hot
}

public enum LetterKind: String, CaseIterable, Sendable {
    case daily, afterDark, journey
}

public enum CardStyle: String, Sendable {
    /// pick one of the options
    case choice
    /// answer in your own words
    case open
    /// "Who's more likely to…": option 0 is whoever's answering, 1 is their person
    case likely
}

public let KIND_LABEL: [CardKind: String] = [
    .tot: "This or that",
    .know: "Know me",
    .connect: "Daily connect",
    .spicy: "After dark",
    .journey: "30 days",
    .open: "In your words",
    .likely: "Who’s more likely",
    .distance: "Far apart",
    .hot: "After dark · hot",
]

/// how long an answer in your own words can be
public let OPEN_MAX = 400

/* ---------- dates (YYYY-MM-DD, each person's local calendar) ---------- */

public enum Day {
    public static func pad(_ n: Int) -> String { n < 10 ? "0\(n)" : "\(n)" }

    /// today on this phone's calendar
    public static func today(_ d: Date = Date()) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: d)
        return "\(c.year!)-\(pad(c.month!))-\(pad(c.day!))"
    }

    static func parts(_ key: String) -> (Int, Int, Int) {
        let p = key.split(separator: "-").map { Int($0) ?? 0 }
        return (p.count > 0 ? p[0] : 1970, p.count > 1 ? p[1] : 1, p.count > 2 ? p[2] : 1)
    }

    /// days since 1970-01-01 (the civil calendar, as Date.UTC counts)
    public static func number(_ key: String) -> Int {
        let (y, m, d) = parts(key)
        return daysFromCivil(y, m, d)
    }

    public static func key(fromNumber n: Int) -> String {
        let (y, m, d) = civilFromDays(n)
        let ys = y < 0 ? "-" + String(-y) : String(y)
        let yy = ys.count < 4 ? String(repeating: "0", count: 4 - ys.count) + ys : ys
        return "\(yy)-\(pad(m))-\(pad(d))"
    }

    public static func add(_ key: String, _ n: Int) -> String { Self.key(fromNumber: number(key) + n) }

    /// Monday = 0 … Sunday = 6
    public static func weekday(_ key: String) -> Int {
        // 1970-01-01 was a Thursday (3, counting from Monday)
        ((number(key) + 3) % 7 + 7) % 7
    }

    public static func weekStart(_ key: String) -> String { add(key, -weekday(key)) }

    /// "Thursday 29 October" or "Thu 29 Oct", in this phone's language
    public static func pretty(_ key: String, long: Bool = false) -> String {
        let (y, m, d) = parts(key)
        var c = DateComponents()
        c.year = y
        c.month = m
        c.day = d
        c.hour = 12
        let date = Calendar.current.date(from: c) ?? Date()
        let f = DateFormatter()
        f.setLocalizedDateFormatFromTemplate(long ? "EEEEdMMMM" : "EEEdMMM")
        return f.string(from: date)
    }

    // Howard Hinnant's days_from_civil / civil_from_days
    static func daysFromCivil(_ y0: Int, _ m: Int, _ d: Int) -> Int {
        // let a month past December roll into the next year, as Date.UTC does
        var y = y0 + (m - 1).floorDiv(12)
        let mm = ((m - 1) % 12 + 12) % 12 + 1
        y -= mm <= 2 ? 1 : 0
        let era = (y >= 0 ? y : y - 399) / 400
        let yoe = y - era * 400
        let mp = (mm + 9) % 12
        let doy = (153 * mp + 2) / 5 + d - 1
        let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
        return era * 146097 + doe - 719468
    }

    static func civilFromDays(_ z0: Int) -> (Int, Int, Int) {
        let z = z0 + 719468
        let era = (z >= 0 ? z : z - 146096) / 146097
        let doe = z - era * 146097
        let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365
        let y = yoe + era * 400
        let doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
        let mp = (5 * doy + 2) / 153
        let d = doy - (153 * mp + 2) / 5 + 1
        let m = mp < 10 ? mp + 3 : mp - 9
        return (m <= 2 ? y + 1 : y, m, d)
    }
}

extension Int {
    func floorDiv(_ b: Int) -> Int {
        let q = self / b
        return (self % b != 0 && (self < 0) != (b < 0)) ? q - 1 : q
    }
}

/* ---------- which cards on which day ---------- */

/// how many cards each deck has (the website's DECK_SIZES; Cards checks the decks agree)
public let DECK_SIZES: [CardKind: Int] = [
    .tot: 220, .know: 220, .connect: 120, .spicy: 160, .hot: 100, .distance: 120, .open: 200, .likely: 149,
]

/// card ids are the deck's prefix and the card's place in it ("tot-12")
public let ID_PREFIX: [CardKind: String] = [
    .tot: "tot", .know: "know", .connect: "con", .spicy: "ad", .hot: "hot", .distance: "far", .open: "open", .likely: "lk", .journey: "jr",
]

public enum Shuffle {
    /// FNV-1a over UTF-16 code units, as the website's hashStr
    public static func hashStr(_ s: String) -> UInt32 {
        var h: UInt32 = 2166136261
        for u in s.utf16 {
            h ^= UInt32(u)
            h = h &* 16777619
        }
        return h
    }

    /// the website's rng(): the same numbers, in the same order
    public struct Rng {
        var a: UInt32
        public init(_ seed: UInt32) { a = seed }
        public mutating func next() -> Double {
            a = a &+ 0x6d2b79f5
            var t = a
            t = (t ^ (t >> 15)) &* (t | 1)
            t ^= t &+ ((t ^ (t >> 7)) &* (t | 61))
            return Double(t ^ (t >> 14)) / 4294967296
        }
    }

    private static var perms: [String: [Int]] = [:]
    private static let lock = NSLock()

    static func permutation(_ n: Int, _ seed: String) -> [Int] {
        let key = "\(n):\(seed)"
        lock.lock()
        if let p = perms[key] {
            lock.unlock()
            return p
        }
        lock.unlock()
        var r = Rng(hashStr(seed))
        var p = Array(0..<n)
        var i = n - 1
        while i > 0 {
            let j = Int((r.next() * Double(i + 1)).rounded(.down))
            p.swapAt(i, j)
            i -= 1
        }
        lock.lock()
        if perms.count > 400 { perms.removeAll() }
        perms[key] = p
        lock.unlock()
        return p
    }

    /// Walks a fresh shuffle of the deck each cycle, so nothing repeats until the deck runs out.
    static func pick(_ kind: CardKind, _ perDay: Int, _ seed: String, _ day: Int) -> [String] {
        let n = DECK_SIZES[kind]!
        let prefix = ID_PREFIX[kind]!
        var out: [String] = []
        for k in 0..<perDay {
            let slot = day * perDay + k
            let cycle = slot.floorDiv(n)
            let idx = ((slot % n) + n) % n
            out.append("\(prefix)-\(permutation(n, "\(seed):\(cycle)")[idx])")
        }
        return out
    }

    /// A couple's cards for a day. `startKey` is the couple's first day; `heat` is After dark's (1 flirty, 2 hot).
    public static func cardsFor(_ kind: LetterKind, coupleId: String, dateKey: String, startKey: String, heat: Int = 1) -> [String] {
        if kind == .journey {
            let n = Journey.dayOf(dateKey)
            return n > 0 ? ["jr-\(n - 1)"] : []
        }
        let day = Day.number(dateKey) - Day.number(startKey)
        if kind == .afterDark {
            if heat >= 2 { return pick(.hot, 2, "\(coupleId):hot", day) + pick(.spicy, 1, "\(coupleId):ad", day) }
            return pick(.spicy, 3, "\(coupleId):ad", day)
        }
        // the fourth card takes turns: Daily connect one day, Far apart the next
        let half = day.floorDiv(2)
        let fourth = ((day % 2) + 2) % 2 == 0 ? pick(.connect, 1, "\(coupleId):con", half) : pick(.distance, 1, "\(coupleId):far", half)
        return pick(.tot, 1, "\(coupleId):tot", day) + pick(.know, 1, "\(coupleId):know", day) + pick(.likely, 1, "\(coupleId):lk", day) + fourth + pick(.open, 1, "\(coupleId):open", day)
    }
}

/* ---------- 30 days of knowing each other ---------- */

public enum Journey {
    public static var days: Int { Cards.journeyDays }

    /// j01 … j30
    public static func key(_ n: Int) -> String { "j\(Day.pad(n))" }

    public static func dayOf(_ key: String) -> Int {
        guard key.count == 3, key.hasPrefix("j"), key.dropFirst().allSatisfy({ ("0"..."9").contains($0) }), let n = Int(key.dropFirst()) else { return 0 }
        return n >= 1 && n <= days ? n : 0
    }

    /// How many days are open: one a day from the day you started (by your own calendar).
    public static func unlocked(_ start: String?, _ today: String) -> Int {
        guard let s = start else { return 0 }
        return max(1, min(days, Day.number(today) - Day.number(s) + 1))
    }

    /// Which chapter a day is in (0-based), and its place in the chapter (1-based).
    public static func chapter(_ n: Int) -> (index: Int, chapter: Cards.Chapter, dayInChapter: Int, last: Bool) {
        var left = n
        let chs = Cards.chapters
        for (i, ch) in chs.enumerated() {
            if left <= ch.days { return (i, ch, left, left == ch.days) }
            left -= ch.days
        }
        let i = chs.count - 1
        return (i, chs[i], chs[i].days, true)
    }
}

public struct JourneyInfo: Sendable {
    public let started: Bool
    public let start: String?
    /// days open so far
    public let unlocked: Int
    /// the first open day you haven't answered yet
    public let next: Int?
    /// a day that's opened since you last looked
    public let unseen: Int?
    /// days you've both answered
    public let done: Int
    public var finished: Bool { done >= Journey.days }
}

/* ---------- streaks ---------- */

public enum DayState: String, Sendable { case done, mended, missed, today, upcoming, before }

public struct StreakInfo: Sendable {
    public let current: Int
    public let best: Int
    /// letters opened together, ever
    public let together: Int
    public let week: [(key: String, label: String, state: DayState)]
    /// a missed yesterday that can still be mended (once a week)
    public let mendable: String?
}
