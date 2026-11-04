import Foundation

/*
 * Escape rooms behind the dark door (src/escape): four rooms, each split in two. Each of you plays one half and
 * holds half of the clues, so you have to tell each other what you see. Puzzles open in order; `step` is how
 * many are solved so far.
 *
 * The rooms' words, things to look at and puzzles come from the website's own rooms (scripts/native-escape.ts
 * writes them to escape.json before a build); the pictures are painted by EscapeRooms.swift.
 */

public enum RoomId: String, CaseIterable, Sendable, Identifiable {
    case attic, cellar, office, library
    public var id: String { rawValue }
}

public struct EscapeRect: Sendable, Equatable {
    public var x: Double, y: Double, w: Double, h: Double
}

/// What you see when you look closely at something.
public enum Clue: Sendable, Equatable {
    case note(title: String, text: String, sign: String?)
    case glyphs(title: String, text: String?, glyphs: [EscapeGlyph])
    case colors(title: String, text: String?, colors: [EscapeColor], style: String)
    case pattern(title: String, text: String?, rows: [String])
    case letters(title: String, text: String?, letters: [(Int, String?)])
    case cards(title: String, text: String?, cards: [(name: String, lines: [String])])

    public var title: String {
        switch self {
        case .note(let t, _, _), .glyphs(let t, _, _), .colors(let t, _, _, _), .pattern(let t, _, _), .letters(let t, _, _), .cards(let t, _, _): return t
        }
    }

    /// the words under the title (a note's words are the note itself)
    public var text: String? {
        switch self {
        case .note: return nil
        case .glyphs(_, let t, _), .colors(_, let t, _, _), .pattern(_, let t, _), .letters(_, let t, _), .cards(_, let t, _): return t
        }
    }

    public static func == (l: Clue, r: Clue) -> Bool { String(describing: l) == String(describing: r) }

    init?(_ raw: Any?) {
        guard let d = raw as? Doc, let kind = d.str("kind") else { return nil }
        let title = d.str("title") ?? ""
        let text = d.str("text")
        switch kind {
        case "note": self = .note(title: title, text: text ?? "", sign: d.str("sign"))
        case "glyphs": self = .glyphs(title: title, text: text, glyphs: d.list("glyphs").compactMap { ($0 as? String).flatMap(EscapeGlyph.init) })
        case "colors": self = .colors(title: title, text: text, colors: d.list("colors").compactMap { ($0 as? String).flatMap(EscapeColor.init) }, style: d.str("style") ?? "stripes")
        case "pattern": self = .pattern(title: title, text: text, rows: d.list("rows").compactMap { $0 as? String })
        case "letters":
            self = .letters(title: title, text: text, letters: d.list("letters").compactMap { x in
                guard let a = x as? [Any], let n = Values.num(a.first) else { return nil }
                return (Int(n), a.count > 1 ? a[1] as? String : nil)
            })
        case "cards":
            self = .cards(title: title, text: text, cards: d.list("cards").compactMap { x in
                guard let c = x as? Doc else { return nil }
                return (c.str("name") ?? "", c.list("lines").compactMap { $0 as? String })
            })
        default: return nil
        }
    }
}

/// The different kinds of lock a puzzle can have.
public enum Lock: Sendable, Equatable {
    case digits(length: Int)
    case letters(length: Int)
    case glyphs(slots: Int, set: [EscapeGlyph])
    case sequence(length: Int, colors: [EscapeColor], noun: String)
    case switches(count: Int)
    case clock(minuteStep: Int)
    case grid(size: Int)
    case choice(options: [ChoiceOption])
    case map(cols: Int, cells: [String], start: Int)
    case together(label: String, holdMs: Double)

    public struct ChoiceOption: Sendable, Equatable, Identifiable {
        public var id: String
        public var label: String
        public var lines: [String]
    }

    public var kind: String {
        switch self {
        case .digits: return "digits"
        case .letters: return "letters"
        case .glyphs: return "glyphs"
        case .sequence: return "sequence"
        case .switches: return "switches"
        case .clock: return "clock"
        case .grid: return "grid"
        case .choice: return "choice"
        case .map: return "map"
        case .together: return "together"
        }
    }

    init?(_ raw: Any?) {
        guard let d = raw as? Doc else { return nil }
        let n = { (k: String) in d.int(k) ?? 0 }
        switch d.str("kind") {
        case "digits": self = .digits(length: n("length"))
        case "letters": self = .letters(length: n("length"))
        case "glyphs": self = .glyphs(slots: n("slots"), set: d.list("set").compactMap { ($0 as? String).flatMap(EscapeGlyph.init) })
        case "sequence": self = .sequence(length: n("length"), colors: d.list("colors").compactMap { ($0 as? String).flatMap(EscapeColor.init) }, noun: d.str("noun") ?? "key")
        case "switches": self = .switches(count: n("count"))
        case "clock": self = .clock(minuteStep: max(1, n("minuteStep")))
        case "grid": self = .grid(size: n("size"))
        case "choice":
            self = .choice(options: d.list("options").compactMap { x in
                guard let o = x as? Doc, let id = o.str("id") else { return nil }
                return ChoiceOption(id: id, label: o.str("label") ?? id, lines: o.list("lines").compactMap { $0 as? String })
            })
        case "map": self = .map(cols: n("cols"), cells: d.list("cells").compactMap { $0 as? String }, start: n("start"))
        case "together": self = .together(label: d.str("label") ?? "", holdMs: d.num("holdMs") ?? 1500)
        default: return nil
        }
    }
}

public struct Puzzle: Sendable, Equatable, Identifiable {
    public var id: String
    /// whose half the lock is in (nil: something you do together)
    public var side: Side?
    public var title: String
    public var prompt: String
    public var lock: Lock
    /// the solution, written the way a guess is: digits "318", letters "HOME", lists "anchor,rose,moon,heart",
    /// switches "UDDU", clock "9:15", grid rows ".##./####", a choice's id, a map cell's number
    public var answer: String
    /// gentle, then specific, then the answer itself
    public var hints: [String]
    /// told to both of you when it opens
    public var solved: String

    init?(_ raw: Any?) {
        guard let d = raw as? Doc, let id = d.str("id"), let lock = Lock(d["lock"]) else { return nil }
        self.id = id
        side = d.str("side").flatMap(Side.init)
        title = d.str("title") ?? ""
        prompt = d.str("prompt") ?? ""
        self.lock = lock
        answer = d.str("answer") ?? ""
        hints = d.list("hints").compactMap { $0 as? String }
        solved = d.str("solved") ?? ""
    }

    public static func normalise(_ lock: Lock, _ raw: String) -> String {
        let s = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        switch lock {
        case .letters, .switches: return s.uppercased()
        default: return s.lowercased()
        }
    }

    public func isRight(_ guess: String) -> Bool { Self.normalise(lock, guess) == Self.normalise(lock, answer) }
}

public struct ObjectView: Sendable, Equatable {
    /// shown once this many puzzles are solved
    public var from: Int
    public var clue: Clue?
    /// tapping opens this puzzle when it's the one you're on
    public var puzzle: String?
    /// a plain line, like "The lid won't budge yet."
    public var text: String?
}

public struct SceneObject: Sendable, Equatable, Identifiable {
    public var id: String
    public var side: Side
    public var label: String
    public var rect: EscapeRect
    /// not there until this many puzzles are solved
    public var from: Int
    public var views: [ObjectView]

    /// what it looks like at this step, or nil if it isn't there yet
    public func view(at step: Int) -> ObjectView? {
        if from > step { return nil }
        var v: ObjectView?
        for x in views where x.from <= step { v = x }
        return v
    }
}

public struct EscapeRoom: Sendable, Equatable, Identifiable {
    public var id: RoomId
    public var title: String
    public var tagline: String
    public var mood: String
    /// the door's colour in the corridor
    public var accent: String
    public var minutes: Int
    public var intro: String
    public var sides: [Side: (name: String, blurb: String)]
    public var objects: [SceneObject]
    public var puzzles: [Puzzle]
    public var ending: (title: String, text: String)

    public static func == (l: EscapeRoom, r: EscapeRoom) -> Bool { l.id == r.id && l.puzzles == r.puzzles && l.objects == r.objects }

    init?(_ raw: Any?) {
        guard let d = raw as? Doc, let id = d.str("id").flatMap(RoomId.init) else { return nil }
        self.id = id
        title = d.str("title") ?? ""
        tagline = d.str("tagline") ?? ""
        mood = d.str("mood") ?? ""
        accent = d.str("accent") ?? "#c49a4e"
        minutes = d.int("minutes") ?? 15
        intro = d.str("intro") ?? ""
        let s = d.map("sides")
        sides = [.a: (s.map("a").str("name") ?? "", s.map("a").str("blurb") ?? ""), .b: (s.map("b").str("name") ?? "", s.map("b").str("blurb") ?? "")]
        objects = d.list("objects").compactMap { x in
            guard let o = x as? Doc, let id = o.str("id"), let side = o.str("side").flatMap(Side.init) else { return nil }
            let r = o.map("rect")
            return SceneObject(id: id, side: side, label: o.str("label") ?? "", rect: EscapeRect(x: r.num("x") ?? 0, y: r.num("y") ?? 0, w: r.num("w") ?? 0, h: r.num("h") ?? 0),
                               from: o.int("from") ?? 0,
                               views: o.list("views").compactMap { v in
                                   guard let v = v as? Doc else { return nil }
                                   return ObjectView(from: v.int("from") ?? 0, clue: Clue(v["clue"]), puzzle: v.str("puzzle"), text: v.str("text"))
                               })
        }
        puzzles = d.list("puzzles").compactMap { Puzzle($0) }
        let e = d.map("ending")
        ending = (e.str("title") ?? "", e.str("text") ?? "")
    }

    public func object(_ id: String?) -> SceneObject? { id.flatMap { i in objects.first { $0.id == i } } }
    public func puzzleIndex(_ id: String) -> Int? { puzzles.firstIndex { $0.id == id } }

    /// the rooms, from escape.json (empty if it's missing, which only happens in a build made without it)
    public static let all: [EscapeRoom] = {
        guard let url = Bundle.module.url(forResource: "escape", withExtension: "json"),
              let data = try? Data(contentsOf: url) else { return [] }
        return load(data)
    }()

    public static func load(_ data: Data) -> [EscapeRoom] {
        guard let d = (try? JSONSerialization.jsonObject(with: data)) as? Doc else { return [] }
        return d.list("rooms").compactMap { EscapeRoom($0) }
    }

    public static func byId(_ id: RoomId) -> EscapeRoom? { all.first { $0.id == id } }
}

/* ---------- progress, shared between the two of you ---------- */

/// How far you've got in a room. It only ever moves forward, so putting two copies together is just "take the
/// furthest along", whichever arrives first.
public struct EscapeProgress: Sendable, Equatable {
    public var room: RoomId
    public var step: Int
    /// hints shown, per puzzle
    public var hints: [String: Int]
    public var startedAt: Double
    public var finishedAt: Double?
    /// when you left it half done (so the clock doesn't count the time away)
    public var pausedAt: Double?

    public init(room: RoomId, step: Int = 0, hints: [String: Int] = [:], startedAt: Double, finishedAt: Double? = nil, pausedAt: Double? = nil) {
        self.room = room
        self.step = step
        self.hints = hints
        self.startedAt = startedAt
        self.finishedAt = finishedAt
        self.pausedAt = pausedAt
    }

    public init?(_ raw: Any?) {
        guard let d = raw as? Doc, let room = d.str("room").flatMap(RoomId.init) else { return nil }
        self.room = room
        step = max(0, d.int("step") ?? 0)
        var h: [String: Int] = [:]
        for (k, v) in d.map("hints") { if let n = Values.num(v) { h[k] = Int(n) } }
        hints = h
        startedAt = d.num("startedAt") ?? 0
        finishedAt = d.num("finishedAt")
        pausedAt = d.num("pausedAt")
    }

    /// as the website sends it (it keeps pausedAt only on the device)
    public var doc: Doc {
        var d: Doc = ["room": room.rawValue, "step": step, "hints": hints, "startedAt": startedAt]
        if let finishedAt { d["finishedAt"] = finishedAt }
        return d
    }

    var saved: Doc {
        var d = doc
        if let pausedAt { d["pausedAt"] = pausedAt }
        return d
    }

    public static func merge(_ a: EscapeProgress?, _ b: EscapeProgress?) -> EscapeProgress? {
        guard let a else { return b }
        guard let b, a.room == b.room else { return a }
        var hints = a.hints
        for (k, v) in b.hints { hints[k] = max(hints[k] ?? 0, v) }
        let finished: Double? = {
            if let x = a.finishedAt, let y = b.finishedAt { return min(x, y) }
            return a.finishedAt ?? b.finishedAt
        }()
        return EscapeProgress(room: a.room, step: max(a.step, b.step), hints: hints, startedAt: min(a.startedAt, b.startedAt), finishedAt: finished, pausedAt: a.pausedAt)
    }

    /// the same as far as the other device is concerned
    public func same(_ o: EscapeProgress) -> Bool { room == o.room && step == o.step && finishedAt == o.finishedAt && hints == o.hints }

    public var hintsUsed: Int { hints.values.reduce(0, +) }
}

/// What the two devices say to each other on the "escape" line.
public enum EscapeEvent: Equatable {
    case hello, ping, bye
    /// which door I'm waiting at (nil: none)
    case ready(RoomId?)
    case progress(EscapeProgress)
    case hold(Side, Bool)
    case chat(id: String, name: String, text: String)

    public func doc(by: String, at: Double) -> Doc {
        var d: Doc = ["by": by, "at": at]
        switch self {
        case .hello: d["type"] = "hello"
        case .ping: d["type"] = "ping"
        case .bye: d["type"] = "bye"
        case .ready(let r):
            d["type"] = "ready"
            d["room"] = r?.rawValue ?? NSNull()
        case .progress(let p):
            d["type"] = "progress"
            d["progress"] = p.doc
        case .hold(let s, let down):
            d["type"] = "hold"
            d["side"] = s.rawValue
            d["down"] = down
        case .chat(let id, let name, let text):
            d["type"] = "chat"
            d["id"] = id
            d["name"] = name
            d["text"] = text
        }
        return d
    }

    public init?(_ d: Doc) {
        switch d.str("type") {
        case "hello": self = .hello
        case "ping": self = .ping
        case "bye": self = .bye
        case "ready": self = .ready(d.str("room").flatMap(RoomId.init))
        case "progress":
            guard let p = EscapeProgress(d["progress"]) else { return nil }
            self = .progress(p)
        case "hold":
            guard let s = d.str("side").flatMap(Side.init) else { return nil }
            self = .hold(s, d.bool("down"))
        case "chat":
            guard let text = d.str("text") else { return nil }
            self = .chat(id: d.str("id") ?? UUID().uuidString, name: d.str("name") ?? "", text: String(text.prefix(200)))
        default: return nil
        }
    }
}

/// minutes:seconds
public func escapeTime(_ ms: Double) -> String {
    let s = max(0, Int((ms / 1000).rounded(.down)))
    return "\(s / 60):\(String(format: "%02d", s % 60))"
}

/* ---------- kept on this phone ---------- */

/// Where you'd got to in each room, and your fastest escapes (on this phone, like the website keeps them in the
/// browser).
public struct EscapeSave: Sendable, Equatable {
    public var progress: [RoomId: EscapeProgress] = [:]
    /// fastest escape, in ms
    public var best: [RoomId: Double] = [:]

    public init() {}

    static func key(_ space: String) -> String { "soultied_escape_\(space)" }

    public static func load(_ space: String, _ defaults: UserDefaults = .standard) -> EscapeSave {
        var s = EscapeSave()
        guard let data = defaults.data(forKey: key(space)), let d = (try? JSONSerialization.jsonObject(with: data)) as? Doc else { return s }
        for (k, v) in d.map("progress") { if let r = RoomId(rawValue: k), let p = EscapeProgress(v) { s.progress[r] = p } }
        for (k, v) in d.map("best") { if let r = RoomId(rawValue: k), let n = Values.num(v) { s.best[r] = n } }
        return s
    }

    public func store(_ space: String, _ defaults: UserDefaults = .standard) {
        var p: Doc = [:]
        for (k, v) in progress { p[k.rawValue] = v.saved }
        var b: Doc = [:]
        for (k, v) in best { b[k.rawValue] = v }
        if let data = try? JSONSerialization.data(withJSONObject: ["progress": p, "best": b]) { defaults.set(data, forKey: Self.key(space)) }
    }
}
