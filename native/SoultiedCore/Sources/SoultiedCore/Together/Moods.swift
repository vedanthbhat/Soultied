import Foundation

/*
 * How each of you is feeling, and the touches you send each other (src/together/moods.ts), kept in the
 * place's meta/moods and meta/touch documents.
 */

public enum MoodId: String, CaseIterable, Sendable {
    case cozy, happy, loved, missing, sleepy, busy, stressed, low, excited, hungry, unwell, playful
}

public struct MoodDef: Sendable, Identifiable {
    public let id: MoodId
    public let label: String
    /// after a name: "Rohan is …"
    public let phrase: String
    public let glyph: Glyph
}

public let MOODS: [MoodDef] = [
    MoodDef(id: .cozy, label: "Cozy", phrase: "feeling cozy", glyph: Glyph([".s..s..", "..s..s.", "#####..", "#ccc###", "#ccc#.#", "#ccc###", ".###..."], ["s": "#c9b9a0", "#": "#8a5a3c", "c": "#e8c9a0"])),
    MoodDef(id: .happy, label: "Happy", phrase: "happy", glyph: Glyph(["y..y..y", ".yyyyy.", ".yoooy.", "yyoooyy", ".yoooy.", ".yyyyy.", "y..y..y"], ["y": "#d99a2b", "o": "#f6dc7a"])),
    MoodDef(id: .loved, label: "Loved up", phrase: "loved up", glyph: Glyph([".##.##.", "#h#####", "#######", ".#####.", "..###..", "...#..."], ["#": "#d9534f", "h": "#f3a19c"])),
    MoodDef(id: .missing, label: "Missing you", phrase: "missing you", glyph: Glyph([".##.##.", "#..#..#", "#.....#", ".#...#.", "..#.#..", "...#..."], ["#": "#d9534f"])),
    MoodDef(id: .sleepy, label: "Sleepy", phrase: "sleepy", glyph: Glyph(["..mmmm.", ".mmm...", "mmm....", "mmm..s.", "mmm....", ".mmm...", "..mmmm."], ["m": "#8f86b8", "s": "#d99a2b"])),
    MoodDef(id: .busy, label: "Busy", phrase: "busy", glyph: Glyph([".#####.", "#ooooo#", "#oohoo#", "#oohho#", "#ooooo#", "#ooooo#", ".#####."], ["#": "#5c6f8a", "o": "#e6edf5", "h": "#3a2a26"])),
    MoodDef(id: .stressed, label: "Stressed", phrase: "stressed", glyph: Glyph(["..ggg..", ".ggggg.", "ggggggg", ".ggggg.", "...y...", "..yy...", "..y...."], ["g": "#7d7a8c", "y": "#d99a2b"])),
    MoodDef(id: .low, label: "A bit low", phrase: "a bit low", glyph: Glyph(["..ggg..", ".ggggg.", "ggggggg", ".......", ".b..b..", "..b..b.", ".b..b.."], ["g": "#8d96a8", "b": "#4f86c6"])),
    MoodDef(id: .excited, label: "Excited", phrase: "excited", glyph: Glyph(["...y...", "...y...", "yyyyyyy", ".yyyyy.", "..yyy..", ".yy.yy.", ".y...y."], ["y": "#d99a2b"])),
    MoodDef(id: .hungry, label: "Hungry", phrase: "hungry", glyph: Glyph(["ccccccc", ".yyryy.", ".yyyyy.", "..ryy..", "..yyy..", "...y..."], ["c": "#a8693a", "y": "#e9b949", "r": "#c4453f"])),
    MoodDef(id: .unwell, label: "Under the weather", phrase: "under the weather", glyph: Glyph(["..ooo..", "..oro..", "..oro..", "..oro..", ".orrro.", ".orrro.", "..ooo.."], ["o": "#6a5a52", "r": "#c4453f"])),
    MoodDef(id: .playful, label: "Playful", phrase: "feeling playful", glyph: Glyph(["ooooooo", "opfffpo", "offfffo", "offpffo", "offfffo", "opfffpo", "ooooooo"], ["o": "#7a5a8a", "f": "#f4e8d0", "p": "#3a2a26"])),
]

private let MOOD_BY = Dictionary(uniqueKeysWithValues: MOODS.map { ($0.id, $0) })
public func moodDef(_ id: MoodId?) -> MoodDef? { id.flatMap { MOOD_BY[$0] } }

/// a few words of your own and no picture: a little "…"
public let WORDS_GLYPH = Glyph([".....", "o.o.o", "....."], ["o": "#3a2a26"])
public let MOOD_TEXT_MAX = 40
/// a mood shows for a day, then quietly goes
public let MOOD_TTL: Double = 24 * 3600e3

public struct MoodEntry: Sendable, Equatable {
    public var mood: MoodId?
    public var text: String
    public var at: Double

    public var line: String {
        [moodDef(mood)?.phrase, text.isEmpty ? nil : "“\(text)”"].compactMap { $0 }.joined(separator: " · ")
    }

    public var glyph: Glyph { moodDef(mood)?.glyph ?? WORDS_GLYPH }
}

public struct MoodsDoc: Sendable, Equatable {
    public var by: [String: MoodEntry] = [:]
    /// the time of your person's mood when you last saw it (their clock)
    public var seen: [String: Double] = [:]

    public init() {}

    public init(_ raw: Doc?) {
        let r = raw ?? [:]
        for (uid, v) in r.map("by") {
            guard let e = v as? Doc else { continue }
            let mood = e.str("mood").flatMap { MoodId(rawValue: $0) }
            let text = String((e.str("text") ?? "").prefix(MOOD_TEXT_MAX)).trimmingCharacters(in: .whitespaces)
            if mood == nil && text.isEmpty { continue }
            by[uid] = MoodEntry(mood: mood, text: text, at: e.num("at") ?? 0)
        }
        seen = numbers(r.map("seen"))
    }

    /// someone's mood right now (nothing once it's a day old)
    public func current(_ uid: String?, now: Double = Values.nowMs()) -> MoodEntry? {
        guard let uid, let e = by[uid], now - e.at < MOOD_TTL else { return nil }
        return e
    }
}

func numbers(_ d: Doc) -> [String: Double] {
    var out: [String: Double] = [:]
    for (k, v) in d { if let n = Values.num(v), !(v is Bool) { out[k] = n } }
    return out
}

/* ---------- touches ---------- */

public enum TouchKind: String, CaseIterable, Sendable {
    case hug, kiss, forehead, highfive, hands, boop
}

public struct TouchDef: Sendable, Identifiable {
    public let id: TouchKind
    /// the button
    public let label: String
    /// "Rohan hugged you"
    public let did: String
    /// "a hug", for "While you were away, Rohan sent a hug and two kisses"
    public let one: String
    public let many: String
    /// they slide together on the couch for it
    public let together: Bool
    public let glyph: Glyph
}

public let TOUCHES: [TouchDef] = [
    TouchDef(id: .hug, label: "Hug", did: "hugged you", one: "a hug", many: "hugs", together: true, glyph: Glyph([".##.##.", "#h#####", "#######", ".#####.", "..###..", "...#..."], ["#": "#d9534f", "h": "#f3a19c"])),
    TouchDef(id: .kiss, label: "Kiss", did: "kissed you", one: "a kiss", many: "kisses", together: true, glyph: Glyph([".rr.rr.", "rpprppr", "rrrrrrr", ".rpppr.", "..rrr.."], ["r": "#c4453f", "p": "#ef8f88"])),
    TouchDef(id: .forehead, label: "Forehead kiss", did: "kissed your forehead", one: "a forehead kiss", many: "forehead kisses", together: true, glyph: Glyph(["..#.#..", ".#####.", "..###..", "...#..."], ["#": "#e0858a"])),
    TouchDef(id: .highfive, label: "High five", did: "high-fived you", one: "a high five", many: "high fives", together: true, glyph: Glyph(["y..y..y", ".y.y.y.", "..yyy..", "yyywyyy", "..yyy..", ".y.y.y.", "y..y..y"], ["y": "#d99a2b", "w": "#fff1c9"])),
    TouchDef(id: .hands, label: "Hold hands", did: "is holding your hand", one: "a hand to hold", many: "hand-holds", together: true, glyph: Glyph([".rr.RR.", "r..R..R", "r..r..R", ".rr.RR."], ["r": "#c4453f", "R": "#e0685f"])),
    TouchDef(id: .boop, label: "Boop", did: "booped your nose", one: "a boop", many: "boops", together: false, glyph: Glyph(["..y..", "..y..", "..y..", ".....", "..y.."], ["y": "#d99a2b"])),
]

private let TOUCH_BY = Dictionary(uniqueKeysWithValues: TOUCHES.map { ($0.id, $0) })
public func touchDef(_ k: TouchKind) -> TouchDef { TOUCH_BY[k]! }

/// the button that sends the same touch straight back
public let TOUCH_BACK_LABEL: [TouchKind: String] = [.hug: "Hug back", .kiss: "Kiss back", .forehead: "Kiss back", .highfive: "High five back", .hands: "Hold on tight", .boop: "Boop back"]

public struct Touch: Sendable, Equatable, Identifiable {
    public let id: String
    public let by: String
    public let kind: TouchKind
    public let at: Double
    public init(id: String, by: String, kind: TouchKind, at: Double) {
        self.id = id
        self.by = by
        self.kind = kind
        self.at = at
    }
    public var doc: Doc { ["id": id, "by": by, "kind": kind.rawValue, "at": at] }
}

/// only the most recent ones are kept
public let TOUCH_KEEP = 40

public struct TouchDoc: Sendable, Equatable {
    public var items: [String: Touch] = [:]
    /// the time of the newest touch from your person you've seen (their clock)
    public var seen: [String: Double] = [:]

    public init() {}

    public init(_ raw: Doc?) {
        let r = raw ?? [:]
        for (id, v) in r.map("items") {
            guard let x = v as? Doc, let by = x.str("by"), let kind = x.str("kind").flatMap({ TouchKind(rawValue: $0) }) else { continue }
            items[id] = Touch(id: id, by: by, kind: kind, at: x.num("at") ?? 0)
        }
        seen = numbers(r.map("seen"))
    }

    /// touches from your person you haven't seen yet, newest first
    public func unseen(me: String, them: String?) -> [Touch] {
        guard let them else { return [] }
        let since = seen[me] ?? 0
        return items.values.filter { $0.by == them && $0.at > since }.sorted { $0.at > $1.at }
    }

    /// the ids to drop so that, with one more, there are at most TOUCH_KEEP
    public func toDrop() -> [String] {
        let all = items.values.sorted { $0.at < $1.at }
        return all.prefix(max(0, all.count - (TOUCH_KEEP - 1))).map(\.id)
    }

    public func lastSent(by me: String) -> Touch? {
        items.values.filter { $0.by == me }.max { $0.at < $1.at }
    }
}

private let NUMBERS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"]

/// "a hug", or "two hugs and a kiss"
public func touchSummary(_ list: [Touch]) -> String {
    var order: [TouchKind] = []
    var n: [TouchKind: Int] = [:]
    for t in list {
        if n[t.kind] == nil { order.append(t.kind) }
        n[t.kind, default: 0] += 1
    }
    // most first; ties keep the order they came in, as the website's stable sort does
    let parts = order.enumerated().sorted { a, b in
        n[a.element]! != n[b.element]! ? n[a.element]! > n[b.element]! : a.offset < b.offset
    }.map { _, k -> String in
        let c = n[k]!
        return c == 1 ? touchDef(k).one : "\(c < NUMBERS.count ? NUMBERS[c] : String(c)) \(touchDef(k).many)"
    }
    if parts.count <= 1 { return parts.first ?? "" }
    return parts.dropLast().joined(separator: ", ") + " and " + parts.last!
}
