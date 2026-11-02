import Foundation

/* ---------- a letter day, as it's kept (spaces/{id}/letters/{kind}_{date}) ---------- */

public struct UserLetter: Sendable, Equatable {
    public var cards: [String: CardAnswer] = [:]
    public var sealedAt: String?
    /// when this person first saw the opened letter
    public var seenAt: String?

    public init(cards: [String: CardAnswer] = [:], sealedAt: String? = nil, seenAt: String? = nil) {
        self.cards = cards
        self.sealedAt = sealedAt
        self.seenAt = seenAt
    }

    public init(_ d: Doc) {
        for (k, v) in d.map("cards") {
            if let m = v as? Doc, let a = CardAnswer(m) { cards[k] = a }
        }
        sealedAt = d.str("sealedAt")
        seenAt = d.str("seenAt")
    }
}

public struct LetterDay: Sendable, Equatable {
    public var dateKey: String
    public var cardIds: [String]
    public var by: [String: UserLetter] = [:]
    public var revealedAt: String?

    public init(dateKey: String, cardIds: [String], by: [String: UserLetter] = [:], revealedAt: String? = nil) {
        self.dateKey = dateKey
        self.cardIds = cardIds
        self.by = by
        self.revealedAt = revealedAt
    }

    /// a row from spaces/{id}/letters, and which of the three it belongs to
    public static func parse(_ d: Doc) -> (LetterKind, LetterDay)? {
        guard let key = d.str("dateKey") else { return nil }
        let kind = LetterKind(rawValue: d.str("kind") ?? "daily") ?? .daily
        var by: [String: UserLetter] = [:]
        for (uid, v) in d.map("by") {
            if let m = v as? Doc { by[uid] = UserLetter(m) }
        }
        return (kind, LetterDay(dateKey: key, cardIds: d.list("cardIds").compactMap { $0 as? String }, by: by, revealedAt: d.str("revealedAt")))
    }

    /// the document's id
    public static func docId(_ kind: LetterKind, _ key: String) -> String { "\(kind.rawValue)_\(key)" }

    public func sealed(_ uid: String) -> Bool { by[uid]?.sealedAt != nil }
    public var opened: Bool { revealedAt != nil }
}

/// everything about the letters of one place
public struct LettersState: Sendable, Equatable {
    public var daily: [String: LetterDay] = [:]
    public var afterDark: [String: LetterDay] = [:]
    /// the 30 days, keyed j01 … j30
    public var journey: [String: LetterDay] = [:]
    /// the date the two of you started the 30 days
    public var journeyStart: String?
    /// each person's own switch; After dark opens only when both are on
    public var afterDarkOn: [String: Bool] = [:]
    /// how hot each of you wants it: 1 flirty, 2 hot (the cards follow whichever of you is lower)
    public var afterDarkHeat: [String: Int] = [:]
    /// dates saved by the once-a-week streak mend
    public var repairs: [String] = []

    public init() {}

    public subscript(kind: LetterKind) -> [String: LetterDay] {
        get {
            switch kind {
            case .daily: return daily
            case .afterDark: return afterDark
            case .journey: return journey
            }
        }
        set {
            switch kind {
            case .daily: daily = newValue
            case .afterDark: afterDark = newValue
            case .journey: journey = newValue
            }
        }
    }

    /// meta/letters
    public mutating func applyMeta(_ d: Doc) {
        afterDarkOn = d.map("afterDarkOn").compactMapValues { $0 as? Bool }
        afterDarkHeat = d.map("afterDarkHeat").compactMapValues { Values.num($0).map { Int($0) } }
        repairs = d.list("repairs").compactMap { $0 as? String }
        journeyStart = d.str("journeyStart")
    }

    /// spaces/{id}/letters
    public mutating func applyRows(_ rows: [Row]) {
        daily = [:]
        afterDark = [:]
        journey = [:]
        for r in rows {
            guard let (kind, day) = LetterDay.parse(r.data) else { continue }
            self[kind][day.dateKey] = day
        }
    }

    /// After dark's heat for the two of you: whichever of you wants it milder
    public func heat(_ ids: [String]) -> Int {
        ids.count < 2 ? 1 : max(1, ids.map { afterDarkHeat[$0] ?? 1 }.min() ?? 1)
    }

    /// After dark is open when you've both switched it on
    public func afterDarkOpen(_ me: String, _ them: String?) -> Bool {
        guard let them else { return false }
        return afterDarkOn[me] == true && afterDarkOn[them] == true
    }
}

/// The couple's first day, a fixed calendar date both phones agree on (the place's createdAt).
public func startKeyOf(createdAt: String) -> String { String(createdAt.prefix(10)) }

/* ---------- 30 days ---------- */

public func journeyInfo(_ state: LettersState, me: String, today: String) -> JourneyInfo {
    let start = state.journeyStart
    let unlocked = Journey.unlocked(start, today)
    var next: Int?
    var unseen: Int?
    var done = 0
    if Journey.days > 0 {
        for n in 1...Journey.days {
            let d = state.journey[Journey.key(n)]
            if let d, d.revealedAt != nil {
                done += 1
                if unseen == nil && d.by[me]?.seenAt == nil { unseen = n }
            }
            if next == nil && n <= unlocked && d?.by[me]?.sealedAt == nil { next = n }
        }
    }
    return JourneyInfo(started: start != nil, start: start, unlocked: unlocked, next: next, unseen: unseen, done: done)
}

/// a line in your shared history when you finish a chapter of the 30 days (and all of them)
public func journeyMilestone(_ key: String) -> (title: String, description: String)? {
    let n = Journey.dayOf(key)
    if n == 0 { return nil }
    if n == Journey.days { return ("30 days, together", "You finished 30 days of knowing each other.") }
    let ch = Journey.chapter(n)
    if !ch.last { return nil }
    return ("Chapter \(ch.index + 1) of \(Cards.chapters.count)", "You finished “\(ch.chapter.title)” in your 30 days.")
}

/* ---------- streaks ---------- */

public func streakInfo(_ state: LettersState, today: String, sinceKey: String? = nil) -> StreakInfo {
    let done = Set(state.daily.values.filter { $0.revealedAt != nil }.map(\.dateKey))
    let mended = Set(state.repairs)
    func ok(_ k: String) -> Bool { done.contains(k) || mended.contains(k) }

    var current = 0
    var k = ok(today) ? today : Day.add(today, -1)
    while ok(k) {
        current += 1
        k = Day.add(k, -1)
    }

    var best = current
    let keys = Array(done.union(mended)).sorted()
    var run = 0
    for (i, key) in keys.enumerated() {
        run = i > 0 && Day.add(keys[i - 1], 1) == key ? run + 1 : 1
        best = max(best, run)
    }

    let mon = Day.weekStart(today)
    let week: [(key: String, label: String, state: DayState)] = ["M", "T", "W", "T", "F", "S", "S"].enumerated().map { i, label in
        let key = Day.add(mon, i)
        let st: DayState
        if key > today { st = .upcoming }
        else if done.contains(key) { st = .done }
        else if mended.contains(key) { st = .mended }
        else if key == today { st = .today }
        else if let s = sinceKey, key < s { st = .before }
        else { st = .missed }
        return (key, label, st)
    }

    let y = Day.add(today, -1)
    let usedThisWeek = state.repairs.contains { Day.weekStart($0) == Day.weekStart(y) }
    let mendable = !ok(y) && ok(Day.add(y, -1)) && !usedThisWeek && (sinceKey == nil || y >= sinceKey!) ? y : nil

    return StreakInfo(current: current, best: best, together: done.count, week: week, mendable: mendable)
}
