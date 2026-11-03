import Foundation

/*
 * Doodle Guess (src/games/doodle.ts and the Doodle parts of registry.ts): one of you draws on a little pixel
 * canvas, the other guesses, then you swap. It's played together, live, and scored together: how many of the
 * six drawings you got between you.
 *
 * The match document holds whose turn it is to draw, the word, the guesses and the finished rounds. The ink
 * itself goes over the live channel ("doodle") a few times a second while someone draws, and the whole page is
 * saved every few seconds (meta/doodle-canvas) so someone arriving late sees it all.
 */

public enum DoodleGuess {
    public static let w = 40
    public static let h = 30
    public static let rounds = 6
    public static let drawSeconds = 80
    /// the first letter shows up as a hint with this many seconds left
    public static let hintAt = 40

    /// '.' is blank paper; the rest are ink colours
    public static let inks: [Character: String] = ["k": "#2b1e1c", "r": "#b8674f", "y": "#e2b359", "g": "#6f8f4e", "b": "#5a79a3", "p": "#e8a39a", "n": "#8a5a3c", "w": "#fbf6ea"]
    public static let inkOrder: [Character] = ["k", "r", "y", "g", "b", "p", "n", "w"]
    public static let inkNames: [Character: String] = ["k": "black", "r": "red", "y": "yellow", "g": "green", "b": "blue", "p": "pink", "n": "brown", "w": "white"]
    public static let paper = "#f4e8d0"
    public static var blank: String { String(repeating: ".", count: w * h) }

    public static let words = [
        "airport", "suitcase", "train", "postcard", "envelope", "phone", "coffee", "pizza", "popcorn", "couch", "fireplace", "moon",
        "sunset", "beach", "mountain", "rain", "umbrella", "bicycle", "guitar", "cake", "cat", "dog", "fish", "tree", "flower", "house",
        "car", "boat", "plane", "star", "rainbow", "snowman", "balloon", "book", "glasses", "hat", "shoe", "key", "clock", "lamp",
        "candle", "ice cream", "banana", "apple", "cherry", "mushroom", "cactus", "penguin", "rabbit", "owl", "snail", "turtle", "whale",
        "bee", "butterfly", "spider", "crown", "ring", "kite", "rocket", "robot", "ghost", "dragon", "castle", "bridge", "tent",
        "campfire", "volcano", "island", "lighthouse", "window", "bed", "pillow", "toothbrush", "scissors", "pencil", "gift", "camera",
        "headphones", "television", "teapot", "sandwich", "noodles", "burger", "donut", "cookie", "watermelon", "strawberry", "carrot",
        "egg", "cheese", "bread", "sun", "cloud", "snowflake", "lightning", "leaf", "moustache", "crab", "octopus", "frog", "duck",
        "elephant", "giraffe", "snake", "mouse", "pig", "cow", "horse", "bat", "hammer", "ladder", "bucket", "basket", "broom", "sock",
        "dress", "backpack", "map", "compass", "anchor", "sailboat", "bus", "tractor", "wheel", "drum", "piano", "trophy", "medal",
        "pyramid", "tower", "fence", "swing", "slide", "bone", "tooth", "eye", "hand", "nose", "ear", "crayon", "paint", "magnet",
    ]

    /// three words to choose from, none of them ones you've had this game
    public static func pickChoices(_ rng: Random = systemRandom, avoid: [String] = []) -> [String] {
        var pool = words.filter { !avoid.contains($0) }
        var out: [String] = []
        while out.count < 3 && !pool.isEmpty { out.append(pool.remove(at: floorInt(rng() * Double(pool.count)))) }
        return out
    }

    /* ---------- guessing ---------- */

    static func norm(_ s: String) -> [UInt8] {
        let kept = s.lowercased().unicodeScalars.filter { ($0.value >= 97 && $0.value <= 122) || $0 == " " }
        let tokens = String(String.UnicodeScalarView(kept)).split(separator: " ", omittingEmptySubsequences: true)
        return Array(tokens.filter { $0 != "a" && $0 != "an" && $0 != "the" }.joined().utf8)
    }

    static func distance(_ a: [UInt8], _ b: [UInt8]) -> Int {
        var d = Array(0...b.count)
        for i in stride(from: 1, through: a.count, by: 1) {
            var prev = d[0]
            d[0] = i
            for j in stride(from: 1, through: b.count, by: 1) {
                let tmp = d[j]
                d[j] = min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] == b[j - 1] ? 0 : 1))
                prev = tmp
            }
        }
        return d[b.count]
    }

    public enum Verdict: String, Sendable { case right, close, wrong }

    /// right for the word (plurals and a typo in longer words count), close when nearly there
    public static func judge(_ guess: String, _ word: String) -> Verdict {
        let g = norm(guess), w = norm(word)
        if g.isEmpty { return .wrong }
        let s = Array("s".utf8), es = Array("es".utf8)
        if g == w || g == w + s || g == w + es || g + s == w { return .right }
        let d = distance(g, w)
        if w.count >= 5 && d <= 1 { return .right }
        func has(_ x: [UInt8], _ y: [UInt8]) -> Bool {
            if y.isEmpty { return true }
            if y.count > x.count { return false }
            for i in 0...(x.count - y.count) where Array(x[i..<(i + y.count)]) == y { return true }
            return false
        }
        if d <= 2 || (g.count >= 3 && (has(w, g) || has(g, w))) { return .close }
        return .wrong
    }

    /// "c _ _ _" — the word's shape, with the first letter once the hint is in
    public static func shape(_ word: String, hint: Bool) -> String {
        var first = true
        return word.map { ch -> String in
            if ch == " " { return " " }
            let out = hint && first ? ch.uppercased() : "_"
            first = false
            return out
        }.joined(separator: " ")
    }

    /* ---------- ink ---------- */

    /// paint these cells (a '.' colour rubs out)
    public static func paint(_ pixels: String, _ cells: [Int], _ color: Character) -> String {
        if cells.isEmpty { return pixels }
        var a = Array(pixels.utf8)
        let c = color.asciiValue ?? UInt8(ascii: ".")
        for i in cells where i >= 0 && i < a.count { a[i] = c }
        return String(decoding: a, as: UTF8.self)
    }

    /// every cell on the line between two cells, with a round brush of this size
    public static func brushLine(_ x0: Int, _ y0: Int, _ x1: Int, _ y1: Int, size: Int) -> [Int] {
        var seen = Set<Int>()
        var out: [Int] = []
        let steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        let r = size - 1
        for s in 0...steps {
            let x = Int(jsRound(Double(x0) + Double((x1 - x0) * s) / Double(steps)))
            let y = Int(jsRound(Double(y0) + Double((y1 - y0) * s) / Double(steps)))
            if r < 0 { continue }
            for dy in -r...r {
                for dx in -r...r {
                    if Double(dx * dx + dy * dy) > Double(r * r) + (r != 0 ? 0.5 : 0) { continue }
                    let cx = x + dx, cy = y + dy
                    if cx >= 0 && cy >= 0 && cx < w && cy < h {
                        let c = cy * w + cx
                        if seen.insert(c).inserted { out.append(c) }
                    }
                }
            }
        }
        return out
    }

    /// cells packed small for sending: base-36, joined with commas
    public static func pack(_ cells: [Int]) -> String { cells.map { String($0, radix: 36) }.joined(separator: ",") }
    public static func unpack(_ s: String) -> [Int] { s.isEmpty ? [] : s.split(separator: ",", omittingEmptySubsequences: false).map { Int($0, radix: 36) ?? -1 } }

    /// the cells a paint bucket fills from `start`: every touching cell of the same colour
    public static func fillCells(_ pixels: String, _ start: Int) -> [Int] {
        let p = Array(pixels.utf8)
        guard start >= 0, start < p.count else { return [] }
        let want = p[start]
        var seen = [Bool](repeating: false, count: w * h)
        var out: [Int] = []
        var stack = [start]
        while let c = stack.popLast() {
            if c < 0 || c >= p.count || seen[c] || p[c] != want { continue }
            seen[c] = true
            out.append(c)
            let x = c % w
            if x > 0 { stack.append(c - 1) }
            if x < w - 1 { stack.append(c + 1) }
            if c >= w { stack.append(c - w) }
            if c < w * (h - 1) { stack.append(c + w) }
        }
        return out
    }

    /// one batch of ink: a colour ('.' rubs out) and the cells it went on ('*' for the whole page)
    public struct InkOp: Equatable, Sendable {
        public var c: Character
        public var s: String
        public init(c: Character, s: String) {
            self.c = c
            self.s = s
        }
        public init?(_ raw: Any?) {
            guard let d = raw as? Doc, let c = d.str("c")?.first, let s = d.str("s") else { return nil }
            self.c = c
            self.s = s
        }
        public var doc: Doc { ["c": String(c), "s": s] }
    }

    public static func apply(_ pixels: String, _ ops: [InkOp]) -> String {
        var p = pixels
        for op in ops { p = op.s == "*" ? String(repeating: op.c, count: w * h) : paint(p, unpack(op.s), op.c) }
        return p
    }

    /* ---------- the demo room's partner ---------- */

    /// a few little drawings the pretend partner knows how to make (colour keys as above)
    public static let botDoodles: [String: [String]] = [
        "sun": ["....y....y....", ".....y..y.....", "y....yyyy....y", ".y..yyyyyy..y.", "...yyyyyyyy...", "yyyyyyyyyyyyyy", "...yyyyyyyy...", ".y..yyyyyy..y.", "y....yyyy....y", ".....y..y.....", "....y....y...."],
        "house": ["......rr......", ".....rrrr.....", "....rrrrrr....", "...rrrrrrrr...", "..rrrrrrrrrr..", ".rrrrrrrrrrrr.", "..nnnnnnnnnn..", "..nbbnnnnbbn..", "..nbbnnnnbbn..", "..nnnnkknnnn..", "..nnnnkknnnn..", "..nnnnkknnnn.."],
        "tree": [".....ggg......", "...ggggggg....", "..ggggggggg...", ".ggggggggggg..", "..ggggggggg...", "...ggggggg....", ".....nnn......", ".....nnn......", ".....nnn......", "....nnnnn....."],
        "fish": ["..............", "....bbbbb.....", "..bbbbbbbbb..b", ".bbkbbbbbbbbbb", ".bbbbbbbbbbbbb", "..bbbbbbbbb..b", "....bbbbb....."],
        "moon": ["....yyyy......", "..yyyy........", ".yyyy.........", ".yyy..........", "yyyy..........", "yyyy..........", ".yyy..........", ".yyyy.........", "..yyyy........", "....yyyy......"],
        "cup": ["...k..k..k....", "....k..k..k...", "..............", ".rrrrrrrrrr...", ".rrrrrrrrrrrr.", ".rrrrrrrrrr.r.", ".rrrrrrrrrr.r.", ".rrrrrrrrrrr..", "..rrrrrrrr....", "kkkkkkkkkkkk.."],
    ]
    /// in the website's order (the pretend partner picks from what's left)
    public static let botKeys = ["sun", "house", "tree", "fish", "moon", "cup"]
    public static let botWords: [String: String] = ["sun": "sun", "house": "house", "tree": "tree", "fish": "fish", "moon": "moon", "cup": "coffee"]

    /// the pretend partner's drawing of `key`, centred, as (cell, colour)
    public static func botStrokes(_ key: String) -> [(Int, Character)] {
        let art = botDoodles[key] ?? botDoodles["sun"]!
        let scale = 2
        let aw = art[0].count * scale, ah = art.count * scale
        let ox = (w - aw) / 2, oy = (h - ah) / 2
        var out: [(Int, Character)] = []
        for (y, row) in art.enumerated() {
            for (x, ch) in row.enumerated() where ch != "." {
                for sy in 0..<scale { for sx in 0..<scale { out.append(((oy + y * scale + sy) * w + ox + x * scale + sx, ch)) } }
            }
        }
        return out
    }

    /* ---------- the game ---------- */

    public struct Guess: Equatable, Sendable {
        public var by: Side
        public var text: String
        public var right: Bool
        /// nearly: a letter or two off
        public var close: Bool
        public var doc: Doc {
            var d: Doc = ["by": by.rawValue, "text": text, "right": right]
            if close { d["close"] = true }
            return d
        }
        init?(_ raw: Any?) {
            guard let d = raw as? Doc, let by = d.str("by").flatMap({ Side(rawValue: $0) }) else { return nil }
            self.by = by
            text = d.str("text") ?? ""
            right = d.bool("right")
            close = d.bool("close")
        }
        init(by: Side, text: String, right: Bool, close: Bool) {
            self.by = by
            self.text = text
            self.right = right
            self.close = close
        }
    }

    public struct Round: Equatable, Sendable {
        public var word: String
        public var drawer: Side
        /// seconds it took to guess, or nil if time ran out
        public var secs: Int?
        /// the finished drawing, for the look back at the end
        public var pixels: String?
        public var doc: Doc {
            var d: Doc = ["word": word, "drawer": drawer.rawValue, "secs": secs as Any? ?? NSNull()]
            if let pixels { d["pixels"] = pixels }
            return d
        }
        init?(_ raw: Any?) {
            guard let d = raw as? Doc, let word = d.str("word"), let drawer = d.str("drawer").flatMap({ Side(rawValue: $0) }) else { return nil }
            self.word = word
            self.drawer = drawer
            secs = d.int("secs")
            pixels = d.str("pixels")
        }
        init(word: String, drawer: Side, secs: Int?, pixels: String?) {
            self.word = word
            self.drawer = drawer
            self.secs = secs
            self.pixels = pixels
        }
    }

    public struct State: Equatable, Sendable {
        /// "lobby", "choosing", "drawing" or "reveal"
        public var phase: String
        public var joined: [Side: Bool]
        public var round: Int
        public var drawer: Side
        public var choices: [String]
        public var word: String?
        public var startedAt: Double?
        public var endsAt: Double?
        public var guesses: [Guess]
        public var rounds: [Round]
        /// most drawings you've ever guessed in one game
        public var best: Int

        public init(_ d: Doc) {
            phase = d.str("phase") ?? "lobby"
            let j = d.map("joined")
            joined = [:]
            for s in [Side.a, .b] where j.bool(s.rawValue) { joined[s] = true }
            round = d.int("round") ?? 0
            drawer = d.str("drawer").flatMap { Side(rawValue: $0) } ?? .a
            choices = d.list("choices").compactMap { $0 as? String }
            word = d.str("word")
            startedAt = d.num("startedAt")
            endsAt = d.num("endsAt")
            guesses = d.list("guesses").compactMap { Guess($0) }
            rounds = d.list("rounds").compactMap { Round($0) }
            best = d.int("best") ?? 0
        }

        public var doc: Doc {
            var j: Doc = [:]
            for (s, v) in joined where v { j[s.rawValue] = true }
            return ["phase": phase, "joined": j, "round": round, "drawer": drawer.rawValue, "choices": choices, "word": word as Any? ?? NSNull(),
                    "startedAt": startedAt as Any? ?? NSNull(), "endsAt": endsAt as Any? ?? NSNull(), "guesses": guesses.map(\.doc), "rounds": rounds.map(\.doc), "best": best]
        }

        /// how many drawings you've got between you
        public var score: Int { rounds.filter { $0.secs != nil }.count }
    }
}

/* ---------- the moves ---------- */

public extension Play {
    /// a Doodle Guess nobody's touched for a while
    static func doodleStale(_ m: Match, now: Double = Values.nowMs()) -> Bool { m.kind == .doodle && m.status != .over && now - m.updatedAt > doodleStaleMs }

    /// starting Doodle Guess opens a little lobby; it begins once you're both in
    static func newDoodle(_ starter: Side, best: Int = 0, now: Double = Values.nowMs()) -> Match {
        let st: Doc = ["phase": "lobby", "joined": [starter.rawValue: true], "round": 0, "drawer": starter.rawValue, "choices": [String](), "word": NSNull(),
                       "startedAt": NSNull(), "endsAt": NSNull(), "guesses": [Any](), "rounds": [Any](), "best": best]
        var m = Match(kind: .doodle, starter: starter, state: st, wins: nil, now: now)
        m.status = .setup
        m.turn = nil
        m.last = "wants to play Doodle Guess"
        return m
    }

    static func doodleJoin(_ m: Match, _ seat: Side, rng: Random = systemRandom) -> Match? {
        var st = DoodleGuess.State(m.state)
        guard m.status != .over, st.phase == "lobby", st.joined[seat] != true else { return nil }
        st.joined[seat] = true
        var n = m
        if !(st.joined[.a] == true && st.joined[.b] == true) {
            n.state = st.doc
            n.last = "is here"
            return n
        }
        st.phase = "choosing"
        st.round = 1
        st.drawer = m.startedBy
        st.choices = DoodleGuess.pickChoices(rng)
        n.status = .playing
        n.turn = m.startedBy
        n.state = st.doc
        n.last = "joined"
        return n
    }

    static func doodleChoose(_ m: Match, _ seat: Side, _ word: String, now: Double = Values.nowMs()) -> Match? {
        var st = DoodleGuess.State(m.state)
        guard m.status == .playing, st.phase == "choosing", st.drawer == seat else { return nil }
        st.phase = "drawing"
        st.word = word
        st.choices = []
        st.startedAt = now
        st.endsAt = now + Double(DoodleGuess.drawSeconds) * 1000
        st.guesses = []
        var n = m
        n.turn = seat.other
        n.state = st.doc
        n.last = "started drawing"
        return n
    }

    /// a guess from whoever isn't drawing; `pixels` is the drawing as they see it, kept if they get it
    static func doodleGuess(_ m: Match, _ seat: Side, _ text: String, pixels: String? = nil, now: Double = Values.nowMs()) -> (match: Match, verdict: DoodleGuess.Verdict)? {
        var st = DoodleGuess.State(m.state)
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let said = String(trimmed.utf16.prefix(40)) ?? String(trimmed.prefix(40))
        guard m.status == .playing, st.phase == "drawing", st.drawer != seat, let word = st.word, !said.isEmpty else { return nil }
        let verdict = DoodleGuess.judge(said, word)
        let right = verdict == .right
        st.guesses = Array((st.guesses + [DoodleGuess.Guess(by: seat, text: said, right: right, close: verdict == .close)]).suffix(12))
        var n = m
        if !right {
            n.state = st.doc
            n.last = "guessed “\(said)”"
            return (n, verdict)
        }
        let secs = max(1, Int(jsRound((now - (st.startedAt ?? now)) / 1000)))
        st.phase = "reveal"
        st.rounds.append(DoodleGuess.Round(word: word, drawer: st.drawer, secs: secs, pixels: pixels?.isEmpty == false ? pixels : nil))
        n.turn = nil
        n.state = st.doc
        n.last = "guessed it: \(word)"
        return (n, verdict)
    }

    /// time's up (or someone gave up): show the word and move on
    static func doodleTimeUp(_ m: Match, pixels: String? = nil, gaveUp: Bool = false) -> Match? {
        var st = DoodleGuess.State(m.state)
        guard m.status == .playing, st.phase == "drawing", let word = st.word else { return nil }
        st.phase = "reveal"
        st.rounds.append(DoodleGuess.Round(word: word, drawer: st.drawer, secs: nil, pixels: pixels?.isEmpty == false ? pixels : nil))
        var n = m
        n.turn = nil
        n.state = st.doc
        n.last = gaveUp ? "skipped that one" : "ran out of time"
        return n
    }

    /// keep the finished drawing with the round, when whoever ended it didn't have it
    static func doodleKeepDrawing(_ m: Match, _ pixels: String) -> Match? {
        var st = DoodleGuess.State(m.state)
        guard st.phase == "reveal", let i = st.rounds.indices.last, st.rounds[i].pixels != pixels else { return nil }
        st.rounds[i].pixels = pixels
        var n = m
        n.state = st.doc
        return n
    }

    static func doodleNext(_ m: Match, rng: Random = systemRandom) -> Match? {
        var st = DoodleGuess.State(m.state)
        guard m.status == .playing, st.phase == "reveal" else { return nil }
        var n = m
        if st.round >= DoodleGuess.rounds {
            let score = st.score
            st.best = max(st.best, score)
            n.status = .over
            n.turn = nil
            n.winner = nil
            n.state = st.doc
            n.last = "finished with \(score) of \(DoodleGuess.rounds)"
            return n
        }
        let drawer = st.drawer.other
        st.phase = "choosing"
        st.round += 1
        st.drawer = drawer
        st.choices = DoodleGuess.pickChoices(rng, avoid: st.rounds.map(\.word))
        st.word = nil
        st.startedAt = nil
        st.endsAt = nil
        st.guesses = []
        n.turn = drawer
        n.state = st.doc
        n.last = "moved on to the next drawing"
        return n
    }

    /// whether the demo room's partner has something to do (in Doodle Guess it also moves things on after a reveal)
    static func botTurn(_ m: Match?, _ bot: Side, now: Double = Values.nowMs()) -> Bool {
        guard let m else { return false }
        if m.kind == .doodle && m.status == .playing {
            let st = DoodleGuess.State(m.state)
            if st.phase == "reveal" { return st.drawer.other == bot }
        }
        return needsMe(m, bot, now: now)
    }

    /// the pretend partner's move in Doodle Guess
    static func doodleBot(_ m: Match, _ bot: Side, _ rng: Random, now: Double = Values.nowMs()) -> Match? {
        let st = DoodleGuess.State(m.state)
        if st.phase == "lobby" { return doodleJoin(m, bot, rng: rng) }
        if st.phase == "choosing" && st.drawer == bot {
            let keys = DoodleGuess.botKeys.filter { k in !st.rounds.contains { $0.word == DoodleGuess.botWords[k] } }
            let key = keys.isEmpty ? "sun" : keys[floorInt(rng() * Double(keys.count))]
            return doodleChoose(m, bot, DoodleGuess.botWords[key] ?? "sun", now: now)
        }
        if st.phase == "drawing" && st.drawer != bot, let word = st.word {
            // a couple of wrong guesses, then usually the right one
            let wrongs = st.guesses.filter { $0.by == bot && !$0.right }.count
            let text: String
            if wrongs >= 2 || rng() < 0.3 { text = rng() < 0.85 ? word : "no idea" } else { text = DoodleGuess.pickChoices(rng, avoid: [word])[0] }
            return doodleGuess(m, bot, text, now: now)?.match
        }
        if st.phase == "reveal" && st.drawer.other == bot { return doodleNext(m, rng: rng) }
        return nil
    }
}
