import Foundation

/*
 * The couples board (src/together/ranks.ts): how your fire and your best games together stack up against other
 * couples. Nobody's on it unless both of you say yes, and all it shows is your two characters, a couple name made
 * of two words Soultied picks (so there's nothing anyone typed to read), and the numbers.
 *
 *   spaces/{sid}/meta/ranks   who's said yes, and your name on the board
 *   spaces/{sid}/meta/bests   your best Kitchen Rush shift and Doodle Guess game (ever, and this week), and your
 *                             fastest way out of each escape room
 *   leaderboard/{sid}         your line on the board, while you're both on it (anyone signed in can read it)
 *
 * Weeks are ISO weeks by UTC (Monday to Sunday), written as one number: 2026, week 47 is 202647. A week's best is
 * kept on the board as week × 100 + the score, so one field sorts this week's best first. Every number written
 * to the board is a whole number (the security rules check).
 */

public enum Ranks {
    public static let first = [
        "Sleepy", "Cosy", "Midnight", "Starlit", "Faraway", "Velvet", "Honey", "Moonlit", "Gentle", "Golden",
        "Rainy", "Sunday", "Quiet", "Lucky", "Little", "Wandering", "Warm", "Dreamy", "Snug", "Ember",
        "Pixel", "Cinnamon", "Maple", "Misty", "Mellow", "Twilight", "Brave", "Silly", "Sunny", "Kindred",
        "Cloudy", "Hazy", "Rosy", "Toasty", "Woolly", "Northern", "Faithful", "Whistling", "Glowing", "Tiny",
    ]

    public static let second = [
        "Owls", "Foxes", "Lanterns", "Fireflies", "Otters", "Sparrows", "Comets", "Teacups", "Penguins", "Pebbles",
        "Moons", "Embers", "Postcards", "Pandas", "Robins", "Hedgehogs", "Kites", "Paper Boats", "Snails", "Bears",
        "Wrens", "Stars", "Clouds", "Pine Cones", "Marshmallows", "Socks", "Puffins", "Koalas", "Doves", "Swallows",
        "Seals", "Dumplings", "Biscuits", "Mittens", "Acorns", "Turtles", "Raccoons", "Bunnies", "Ducklings", "Daisies",
    ]

    public static let escapeRooms: [RoomId] = [.attic, .cellar, .office, .library]
    public static let doodleMax = 6
    public static let kitchenMax = 99
    /// escapes faster than this, or slower, aren't real
    static let escapeMinMs: Double = 10_000
    static let escapeMaxMs: Double = 36_000_000
    /// how many couples each board shows
    public static let limit = 50

    /// "The Sleepy Lanterns"
    public static func name(_ n: RankName) -> String { "The \(first[n.a]) \(second[n.b])" }

    /// a few names to pick from: no two share a word, and none is one of `avoid`
    public static func suggest(_ rng: Random, count: Int = 3, avoid: [RankName] = []) -> [RankName] {
        var out: [RankName] = []
        var used = Set(avoid.map { $0.a * 1000 + $0.b })
        let n = min(count, first.count, second.count)
        while out.count < n {
            let c = RankName(Int((rng() * Double(first.count)).rounded(.down)), Int((rng() * Double(second.count)).rounded(.down)))
            if used.contains(c.a * 1000 + c.b) || out.contains(where: { $0.a == c.a || $0.b == c.b }) { continue }
            used.insert(c.a * 1000 + c.b)
            out.append(c)
        }
        return out
    }

    /// the ISO week (by UTC) a moment falls in, as one number: 202647
    public static func weekOf(_ ms: Double) -> Int {
        let day = Int((ms / 86_400_000).rounded(.down))
        // 1970-01-01 was a Thursday; Monday is 0
        let weekday = ((day + 3) % 7 + 7) % 7
        let thursday = day - weekday + 3
        let year = Day.civilFromDays(thursday).0
        let ordinal = thursday - Day.daysFromCivil(year, 1, 1) + 1
        return year * 100 + (ordinal - 1) / 7 + 1
    }

    /// a board's score, in words: "12 days", "9 served", "4 of 6", "14:32"
    public static func valueText(_ id: BoardId, _ v: Int) -> String {
        switch id {
        case .fire: return "\(v) \(v == 1 ? "day" : "days")"
        case .kitchenWeek, .kitchenAll: return "\(v) served"
        case .doodleWeek, .doodleAll: return "\(v) of \(doodleMax)"
        default: return escapeTime(Double(v))
        }
    }

    /// a whole number from the database (0 for anything else)
    static func whole(_ v: Any?) -> Int {
        guard !(v is String), let d = Values.num(v), d.isFinite else { return 0 }
        return Int(d.rounded(.down))
    }

    static func clamp(_ v: Any?, _ max: Int) -> Int {
        guard !(v is String), let d = Values.num(v), d.isFinite else { return 0 }
        return Swift.max(0, Swift.min(max, Int(d.rounded(.down))))
    }

    /// a line's score on a board (nil when it isn't on that board, or it's out of date)
    public static func value(_ id: BoardId, _ data: Doc, today: String, now: Double) -> Int? {
        switch id {
        case .fire:
            let day = data["fireDay"] as? String ?? ""
            // a fire that hasn't been fed since the day before yesterday has gone out (a day's slack for time zones)
            let v = whole(data["fire"])
            return v > 0 && day >= Day.add(today, -2) ? v : nil
        case .kitchenWeek, .doodleWeek:
            let v = whole(data[id == .kitchenWeek ? "kw" : "dw"])
            let s = v % 100
            return Int((Double(v) / 100).rounded(.down)) == weekOf(now) && s > 0 ? s : nil
        case .kitchenAll, .doodleAll:
            let v = whole(data[id == .kitchenAll ? "kitchen" : "doodle"])
            return v > 0 ? v : nil
        default:
            let v = whole(data.map("esc")[id.room?.rawValue ?? ""])
            return Double(v) >= escapeMinMs && Double(v) <= escapeMaxMs ? v : nil
        }
    }

    /// the board as it shows: lines sorted best first, with their places (`mine` is your place's id)
    public static func rows(_ id: BoardId, _ rows: [Row], mine: String, today: String, now: Double) -> [BoardRow] {
        let asc = id.room != nil
        var out: [BoardRow] = []
        for r in rows {
            guard let n = RankName(r.data["name"]), let looks = r.data["looks"] as? [Any], looks.count == 2,
                  let v = value(id, r.data, today: today, now: now) else { continue }
            out.append(BoardRow(id: r.id, rank: 0, name: name(n), looks: (Wardrobe.normalize(looks[0]), Wardrobe.normalize(looks[1])),
                                value: v, text: valueText(id, v), mine: r.id == mine))
        }
        out.sort { a, b in
            if a.value != b.value { return asc ? a.value < b.value : a.value > b.value }
            return a.id < b.id
        }
        out = Array(out.prefix(limit))
        for i in out.indices {
            var rank = i + 1
            while rank > 1 && out[rank - 2].value == out[i].value { rank -= 1 }
            out[i].rank = rank
        }
        return out
    }

    /* ---------- the demo room ---------- */

    /// the demo room's own name, the one Rohan asks to go on the board with
    public static let demoName = RankName(0, 2)

    /// the other couples on the demo room's boards (made up, and the same every time)
    public static func demoBoards(today: String, now: Double) -> [Row] {
        let r = seeded(4711)
        let w = weekOf(now)
        let names = suggest(r, count: 11, avoid: [demoName])
        func pick(_ n: Int) -> Int { Int((r() * Double(n)).rounded(.down)) }
        return names.enumerated().map { i, n in
            let looks = [Wardrobe.dictionary(Wardrobe.random(r)), Wardrobe.dictionary(Wardrobe.random(r))]
            let fire = 1 + pick(60)
            let kitchen = 4 + pick(14)
            let kw = max(1, kitchen - pick(5))
            let doodle = 2 + pick(5)
            let dw = max(1, doodle - pick(3))
            var esc: Doc = [:]
            for room in escapeRooms where r() < 0.7 { esc[room.rawValue] = Int(((6 + r() * 30) * 60).rounded()) * 1000 }
            let d: Doc = ["name": n.list, "looks": looks, "fire": fire, "fireDay": today, "kitchen": kitchen, "doodle": doodle,
                          "kw": w * 100 + kw, "dw": w * 100 + dw, "esc": esc, "at": Int(now)]
            return Row(id: "demo-couple-\(i)", data: d)
        }
    }

    /// the demo room: Rohan has asked to go on the board
    public static func demoRanks(them: String) -> Doc { ["yes": [them: 1], "name": demoName.list] }

    /// the demo room's bests (this week's are this week, whenever you look)
    public static func demoBests(now: Double) -> Doc {
        ["kitchen": 12, "doodle": 4, "week": ["w": weekOf(now), "kitchen": 9, "doodle": 4], "escape": ["attic": 872_000]]
    }
}

/// a name on the board: a word from each list
public struct RankName: Equatable, Hashable, Sendable {
    public var a: Int
    public var b: Int
    public init(_ a: Int, _ b: Int) {
        self.a = a
        self.b = b
    }
    public init?(_ raw: Any?) {
        guard let l = raw as? [Any], l.count == 2 else { return nil }
        func index(_ v: Any) -> Int? {
            guard !(v is String), let d = Values.num(v), d.isFinite, d == d.rounded() else { return nil }
            return Int(d)
        }
        guard let a = index(l[0]), let b = index(l[1]), a >= 0, a < Ranks.first.count, b >= 0, b < Ranks.second.count else { return nil }
        self.a = a
        self.b = b
    }
    public var list: [Int] { [a, b] }
    public var text: String { Ranks.name(self) }
}

/// off · you asked (waiting on them) · they asked (waiting on you) · on the board
public enum RankStage: String, Sendable { case off, asked, askedMe, on }

/// who's said yes to the board, and your name on it (meta/ranks)
public struct RanksDoc: Equatable, Sendable {
    /// when each of you said yes (ms)
    public var yes: [String: Double] = [:]
    public var name: RankName?

    public init(yes: [String: Double] = [:], name: RankName? = nil) {
        self.yes = yes
        self.name = name
    }

    public init(_ raw: Doc?) {
        let r = raw ?? [:]
        for (uid, v) in r.map("yes") {
            guard !(v is String), let d = Values.num(v), d.isFinite, d > 0 else { continue }
            yes[uid] = d
        }
        name = RankName(r["name"])
    }

    public func stage(me: String, them: String?) -> RankStage {
        guard name != nil else { return .off }
        let mine = yes[me] != nil
        let theirs = them.map { yes[$0] != nil } ?? false
        return mine && theirs ? .on : mine ? .asked : theirs ? .askedMe : .off
    }
}

/// your best Kitchen Rush shift and Doodle Guess game, ever and this week, and your fastest escapes (meta/bests)
public struct BestsDoc: Equatable, Sendable {
    public struct Week: Equatable, Sendable {
        public var w = 0
        public var kitchen = 0
        public var doodle = 0
        public init(w: Int = 0, kitchen: Int = 0, doodle: Int = 0) {
            self.w = w
            self.kitchen = kitchen
            self.doodle = doodle
        }
        public var doc: Doc { ["w": w, "kitchen": kitchen, "doodle": doodle] }
    }

    /// most orders served in one Kitchen Rush shift, ever
    public var kitchen = 0
    /// most drawings guessed in one Doodle Guess game, ever
    public var doodle = 0
    /// the same, this week
    public var week = Week()
    /// fastest way out of each escape room (ms)
    public var escape: [RoomId: Int] = [:]

    public init(kitchen: Int = 0, doodle: Int = 0, week: Week = Week(), escape: [RoomId: Int] = [:]) {
        self.kitchen = kitchen
        self.doodle = doodle
        self.week = week
        self.escape = escape
    }

    public init(_ raw: Doc?) {
        let r = raw ?? [:]
        let wk = r.map("week")
        let esc = r.map("escape")
        for room in Ranks.escapeRooms {
            guard let v = esc[room.rawValue], !(v is String), let d = Values.num(v), d.isFinite,
                  d >= Ranks.escapeMinMs, d <= Ranks.escapeMaxMs else { continue }
            escape[room] = Int(d.rounded())
        }
        kitchen = Ranks.clamp(r["kitchen"], Ranks.kitchenMax)
        doodle = Ranks.clamp(r["doodle"], Ranks.doodleMax)
        week = Week(w: Ranks.clamp(wk["w"], 999_999), kitchen: Ranks.clamp(wk["kitchen"], Ranks.kitchenMax), doodle: Ranks.clamp(wk["doodle"], Ranks.doodleMax))
    }

    /// What a finished Kitchen Rush shift or Doodle Guess game changes (nil when nothing does). Safe to call as
    /// often as you like: it only ever keeps the better score.
    public func patch(kitchen k: Match?, doodle d: Match?, now: Double) -> Doc? {
        let thisWeek = Ranks.weekOf(now)
        var wk = week.w == thisWeek ? week : Week(w: thisWeek)
        var kitchenBest = kitchen
        var doodleBest = doodle
        if let k, k.status == .over {
            let served = Swift.max(0, Swift.min(Ranks.kitchenMax, Play.liveResult(k)?.score?[.a] ?? 0))
            kitchenBest = Swift.max(kitchenBest, served)
            if Ranks.weekOf(k.updatedAt) == thisWeek { wk.kitchen = Swift.max(wk.kitchen, served) }
        }
        if let d {
            let st = DoodleGuess.State(d.state)
            doodleBest = Swift.max(doodleBest, Swift.max(0, Swift.min(Ranks.doodleMax, st.best)))
            if d.status == .over {
                let got = Swift.min(Ranks.doodleMax, st.score)
                doodleBest = Swift.max(doodleBest, got)
                if Ranks.weekOf(d.updatedAt) == thisWeek { wk.doodle = Swift.max(wk.doodle, got) }
            }
        }
        let sameWeek = week.w == thisWeek
        let weekNews = wk.kitchen != (sameWeek ? week.kitchen : 0) || wk.doodle != (sameWeek ? week.doodle : 0)
        if kitchenBest == kitchen && doodleBest == doodle && !weekNews { return nil }
        return ["kitchen": kitchenBest, "doodle": doodleBest, "week": wk.doc]
    }

    /// a faster way out of an escape room (nil when it isn't one)
    public func escapePatch(_ room: RoomId, ms: Double) -> Doc? {
        guard ms.isFinite, ms >= Ranks.escapeMinMs, ms <= Ranks.escapeMaxMs else { return nil }
        let t = Int(ms.rounded())
        if let was = escape[room], was <= t { return nil }
        return ["escape": [room.rawValue: t]]
    }
}

/// the boards: the fire, Kitchen Rush and Doodle Guess (this week, and ever), and each escape room
public enum BoardId: String, CaseIterable, Identifiable, Sendable {
    case fire
    case kitchenWeek = "kitchen-week", kitchenAll = "kitchen-all"
    case doodleWeek = "doodle-week", doodleAll = "doodle-all"
    case escAttic = "esc-attic", escCellar = "esc-cellar", escOffice = "esc-office", escLibrary = "esc-library"

    public var id: String { rawValue }

    /// the escape room this board is for
    public var room: RoomId? { rawValue.hasPrefix("esc-") ? RoomId(rawValue: String(rawValue.dropFirst(4))) : nil }

    /// what to ask the database for: the field to sort by, and which way
    public var query: (field: String, descending: Bool) {
        switch self {
        case .fire: return ("fire", true)
        case .kitchenWeek: return ("kw", true)
        case .kitchenAll: return ("kitchen", true)
        case .doodleWeek: return ("dw", true)
        case .doodleAll: return ("doodle", true)
        default: return ("esc.\(room?.rawValue ?? "")", false)
        }
    }
}

public struct BoardRow: Identifiable, Equatable, Sendable {
    public var id: String
    /// 1 for the best (couples with the same score share a place)
    public var rank: Int
    public var name: String
    public var looks: (AvatarConfig, AvatarConfig)
    public var value: Int
    public var text: String
    public var mine: Bool

    public static func == (l: BoardRow, r: BoardRow) -> Bool {
        l.id == r.id && l.rank == r.rank && l.name == r.name && l.looks.0 == r.looks.0 && l.looks.1 == r.looks.1 && l.value == r.value && l.text == r.text && l.mine == r.mine
    }
}

/// your line on the board (leaderboard/{sid})
public struct RankEntry: Equatable, Sendable {
    public var name: RankName
    /// the two of you, whoever made the place first
    public var looks: [AvatarConfig]
    /// the fire: days in a row you've both shown up, up to `fireDay`
    public var fire: Int
    public var fireDay: String
    public var kitchen: Int?
    public var doodle: Int?
    /// this week's bests: week × 100 + the score
    public var kw: Int?
    public var dw: Int?
    public var esc: [RoomId: Int]
    public var at: Int

    public init(name: RankName, looks: [AvatarConfig], couch: CouchState, today: String, bests: BestsDoc, now: Double) {
        self.name = name
        self.looks = looks
        fire = couch.fire(today: today).streak
        fireDay = couch.together.contains(today) ? today : Day.add(today, -1)
        esc = bests.escape
        at = Int(now.rounded())
        if bests.kitchen > 0 { kitchen = bests.kitchen }
        if bests.doodle > 0 { doodle = bests.doodle }
        let w = Ranks.weekOf(now)
        if bests.week.w == w && bests.week.kitchen > 0 { kw = w * 100 + bests.week.kitchen }
        if bests.week.w == w && bests.week.doodle > 0 { dw = w * 100 + bests.week.doodle }
    }

    /// what's written (the whole document; only whole numbers)
    public var doc: Doc {
        var e: Doc = [:]
        for (room, v) in esc { e[room.rawValue] = v }
        var d: Doc = ["name": name.list, "looks": looks.map { Wardrobe.dictionary($0) }, "fire": fire, "fireDay": fireDay, "esc": e, "at": at]
        if let kitchen { d["kitchen"] = kitchen }
        if let doodle { d["doodle"] = doodle }
        if let kw { d["kw"] = kw }
        if let dw { d["dw"] = dw }
        return d
    }

    /// what's on the line apart from when it was written (to tell whether it needs writing again)
    public var key: String {
        let looksKey = looks.map { a in
            [a.height, a.skin, a.hairStyle, a.hairColor, a.facialHair, a.top, a.topColor, a.bottom, a.bottomColor, a.shoes, a.shoesColor, a.glasses, a.hat, a.extra].joined(separator: "|")
        }
        let escKey = Ranks.escapeRooms.compactMap { r in esc[r].map { "\(r.rawValue):\($0)" } }
        return "\(name.list)|\(looksKey)|\(fire)|\(fireDay)|\(kitchen ?? 0)|\(doodle ?? 0)|\(kw ?? 0)|\(dw ?? 0)|\(escKey)"
    }
}
