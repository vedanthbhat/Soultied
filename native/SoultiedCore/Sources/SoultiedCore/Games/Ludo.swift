import Foundation

/*
 * Ludo for two (src/games/ludo.ts): roll the die and race your tokens round the board and home. A six brings
 * a token out of your yard (and rolls again); land on one of theirs, anywhere but a star or a start square,
 * and it goes back to their yard (and you roll again); getting a token home rolls again too; three sixes in a
 * row and the turn passes. Every roll is kept in the match, so whoever's next sees exactly what you rolled.
 *
 * Each token is a number: -1 in its yard, 0–50 round the track from its own start square, 51–55 up its own
 * path to the middle, and 56 home. You start on opposite sides of the board.
 */
public enum Ludo {
    public static let track = 52
    /// the last square round the track before your own path to the middle
    public static let last = 50
    public static let home = 56
    /// where each of you comes onto the track
    public static func start(_ s: Side) -> Int { s == .a ? 39 : 13 }
    /// the start squares and the stars: nobody can be sent back from these
    public static let safe: Set<Int> = [0, 8, 13, 21, 26, 34, 39, 47]
    /// a quick game is two tokens each; a full one, four
    public static let counts = [2, 4]

    public struct Moved: Equatable, Sendable {
        public var seat: Side
        public var token: Int
        public var from: Int
        public var to: Int
        public var doc: Doc { ["seat": seat.rawValue, "token": token, "from": from, "to": to] }
    }

    public struct State: Equatable, Sendable {
        public var tokens: [Side: [Int]]
        /// "roll" the die, or "move" a token with what you rolled
        public var phase: String
        /// the last roll (still shown after the move)
        public var dice: Int?
        /// sixes in a row, this turn
        public var sixes: Int
        /// the token that moved last, and from where to where
        public var moved: Moved?
        /// which of the other side's tokens that move sent back to the yard
        public var sent: [Int]?

        public init(count: Int = 4) {
            let n = counts.contains(count) ? count : 4
            tokens = [.a: Array(repeating: -1, count: n), .b: Array(repeating: -1, count: n)]
            phase = "roll"
            sixes = 0
        }

        public init(_ d: Doc) {
            let t = d.map("tokens")
            func side(_ k: String) -> [Int] {
                let v = (t[k] as? [Any] ?? []).compactMap { Values.num($0).map { Int($0) } }.map { max(-1, min(home, $0)) }
                return counts.contains(v.count) ? v : Array(repeating: -1, count: 4)
            }
            var a = side("a"), b = side("b")
            if a.count != b.count {
                a = Array(repeating: -1, count: 4)
                b = a
            }
            tokens = [.a: a, .b: b]
            phase = d.str("phase") == "move" ? "move" : "roll"
            dice = d.int("dice").flatMap { (1...6).contains($0) ? $0 : nil }
            sixes = d.int("sixes") ?? 0
            let mv = d.map("moved")
            if let s = mv.str("seat").flatMap({ Side(rawValue: $0) }), let tk = mv.int("token"), let f = mv.int("from"), let to = mv.int("to") {
                moved = Moved(seat: s, token: tk, from: f, to: to)
            }
            sent = (d["sent"] as? [Any]).map { $0.compactMap { Values.num($0).map { Int($0) } } }
        }

        public var doc: Doc {
            ["tokens": ["a": tokens[.a] ?? [], "b": tokens[.b] ?? []], "phase": phase, "dice": dice as Any? ?? NSNull(), "sixes": sixes,
             "moved": moved?.doc as Any? ?? NSNull(), "sent": sent as Any? ?? NSNull()]
        }

        public var count: Int { tokens[.a]?.count ?? 4 }
        public func of(_ s: Side) -> [Int] { tokens[s] ?? [] }
    }

    /// where a token is round the track (0–51, the same for both of you), or nil in the yard, on its path or home
    public static func trackSquare(_ seat: Side, _ pos: Int) -> Int? {
        pos >= 0 && pos <= last ? (pos + start(seat)) % track : nil
    }

    public static func canMove(_ pos: Int, _ dice: Int) -> Bool {
        if pos == home { return false }
        if pos == -1 { return dice == 6 }
        return pos + dice <= home
    }

    /// the tokens you could move with this roll
    public static func movable(_ st: State, _ seat: Side, _ dice: Int) -> [Int] {
        st.of(seat).indices.filter { canMove(st.of(seat)[$0], dice) }
    }

    /// where a token ends up with this roll
    public static func landing(_ pos: Int, _ dice: Int) -> Int { pos == -1 ? 0 : pos + dice }

    public struct Step {
        public var state: State
        /// whose go it is next (nil once someone's won)
        public var next: Side?
        public var over: Bool
        public var winner: String?
        public var line: String
    }

    /// Roll the die (what came up is passed in). With nothing to move, the turn passes.
    public static func roll(_ st: State, _ seat: Side, _ dice: Int) -> Step? {
        guard st.phase == "roll", (1...6).contains(dice) else { return nil }
        let sixes = dice == 6 ? st.sixes + 1 : 0
        func pass(_ line: String) -> Step {
            var s = st
            s.phase = "roll"
            s.dice = dice
            s.sixes = 0
            s.moved = nil
            s.sent = nil
            return Step(state: s, next: seat.other, over: false, winner: nil, line: line)
        }
        if sixes >= 3 { return pass("rolled three sixes in a row, so the turn passed") }
        if movable(st, seat, dice).isEmpty { return pass("rolled a \(dice) but couldn’t move") }
        var s = st
        s.phase = "move"
        s.dice = dice
        s.sixes = sixes
        s.moved = nil
        s.sent = nil
        return Step(state: s, next: seat, over: false, winner: nil, line: "rolled a \(dice)")
    }

    /// Move one of your tokens by what you rolled. A six, sending one of theirs back, or getting one home rolls again.
    public static func move(_ st: State, _ seat: Side, _ token: Int) -> Step? {
        guard st.phase == "move", let dice = st.dice, st.of(seat).indices.contains(token) else { return nil }
        let from = st.of(seat)[token]
        guard canMove(from, dice) else { return nil }
        let to = landing(from, dice)
        let them = seat.other
        var mine = st.of(seat)
        var theirs = st.of(them)
        mine[token] = to
        var sent: [Int] = []
        if let sq = trackSquare(seat, to), !safe.contains(sq) {
            for (i, p) in theirs.enumerated() where trackSquare(them, p) == sq {
                theirs[i] = -1
                sent.append(i)
            }
        }
        let isHome = to == home
        let won = mine.allSatisfy { $0 == home }
        let again = !won && (dice == 6 || !sent.isEmpty || isHome)
        let line: String
        if won { line = "got their last token home" }
        else if !sent.isEmpty { line = sent.count > 1 ? "sent \(sent.count) of yours back to the start" : "sent one of yours back to the start" }
        else if isHome { line = "got a token home" }
        else if from == -1 { line = "brought a token out" }
        else { line = "moved a token \(dice) \(dice == 1 ? "square" : "squares")" }
        var s = st
        s.tokens = [seat: mine, them: theirs]
        s.phase = "roll"
        s.sixes = again && dice == 6 ? st.sixes : 0
        s.moved = Moved(seat: seat, token: token, from: from, to: to)
        s.sent = sent.isEmpty ? nil : sent
        return Step(state: s, next: won ? nil : again ? seat : them, over: won, winner: won ? seat.rawValue : nil, line: line)
    }

    /// how many of a side's tokens are home
    public static func homeCount(_ st: State, _ seat: Side) -> Int { st.of(seat).filter { $0 == home }.count }

    /// a fair roll
    public static func rollD6(_ rng: Random) -> Int { 1 + Int(floor(rng() * 6)) }

    /// The demo room's partner: send one of yours back if it can, then get home, come out, keep out of reach, and push on.
    public static func botToken(_ st: State, _ bot: Side, _ rng: Random) -> Int {
        let dice = st.dice ?? 1
        let can = movable(st, bot, dice)
        let you = bot.other
        let theirs = st.of(you)
        func inReach(_ square: Int) -> Bool {
            theirs.contains { q in
                guard let t = trackSquare(you, q) else { return false }
                let d = (square - t + track) % track
                return d >= 1 && d <= 6 && q + d <= last
            }
        }
        func exposed(_ square: Int?) -> Bool {
            guard let square else { return false }
            return !safe.contains(square) && inReach(square)
        }
        var best = can.first ?? 0
        var bestV = -Double.infinity
        for i in can {
            let from = st.of(bot)[i]
            let to = landing(from, dice)
            let square = trackSquare(bot, to)
            var v = 0.0
            if let sq = square, !safe.contains(sq), theirs.contains(where: { trackSquare(you, $0) == sq }) { v += 100 }
            if to == home { v += 80 }
            if from == -1 { v += 60 }
            if exposed(trackSquare(bot, from)) && !exposed(square) { v += 40 }
            if exposed(square) { v -= 50 }
            v += Double(to) / 10 + rng() * 5
            if v > bestV {
                bestV = v
                best = i
            }
        }
        return best
    }

    /* ---------- the board: 15 × 15 squares, the first seat's yard in the bottom-left corner ---------- */

    /// the track, square by square from the left arm's start, as (row, column) on the board
    public static let path: [(Int, Int)] = {
        var p: [(Int, Int)] = []
        for c in 1...5 { p.append((6, c)) }
        for r in stride(from: 5, through: 0, by: -1) { p.append((r, 6)) }
        p.append((0, 7))
        for r in 0...5 { p.append((r, 8)) }
        for c in 9...14 { p.append((6, c)) }
        p.append((7, 14))
        for c in stride(from: 14, through: 9, by: -1) { p.append((8, c)) }
        for r in 9...14 { p.append((r, 8)) }
        p.append((14, 7))
        for r in stride(from: 14, through: 9, by: -1) { p.append((r, 6)) }
        for c in stride(from: 5, through: 0, by: -1) { p.append((8, c)) }
        p.append((7, 0))
        p.append((6, 0))
        return p
    }()

    /// each side's path up to the middle
    public static func homePath(_ s: Side) -> [(Int, Int)] { s == .a ? [13, 12, 11, 10, 9].map { ($0, 7) } : [1, 2, 3, 4, 5].map { ($0, 7) } }

    /// the top-left square of each side's yard
    public static func yard(_ s: Side) -> (Int, Int) { s == .a ? (9, 0) : (0, 9) }

    /// Where a token sits, as the middle of it in squares from the board's top-left (7.5, 7.5 is the very middle).
    public static func spot(_ seat: Side, _ token: Int, _ pos: Int) -> (r: Double, c: Double) {
        if pos == -1 {
            let (r0, c0) = yard(seat)
            return (Double(r0 + 2 + 2 * ((token % 4) / 2)), Double(c0 + 2 + 2 * (token % 2)))
        }
        if pos == home {
            let d = [(-0.45, -0.45), (-0.45, 0.45), (0.45, -0.45), (0.45, 0.45)][token % 4]
            let lean = seat == .a ? 0.25 : -0.25
            return (7.5 + d.0 * 0.8 + lean, 7.5 + d.1 * 0.8)
        }
        if pos > last {
            let (r, c) = homePath(seat)[pos - last - 1]
            return (Double(r) + 0.5, Double(c) + 0.5)
        }
        let (r, c) = path[(pos + start(seat)) % track]
        return (Double(r) + 0.5, Double(c) + 0.5)
    }

    /// every square a token passes through on a move, for walking it there one square at a time
    public static func walk(_ from: Int, _ to: Int) -> [Int] {
        if from == -1 { return [0] }
        return from < to ? Array((from + 1)...to) : []
    }

    public enum Square: Equatable, Sendable {
        case yard(Side), garden, track, start(Side?), star, path(Side), middle
    }

    /// what kind of square (row, column) is, for drawing the board
    public static func square(_ r: Int, _ c: Int) -> Square {
        if (6...8).contains(r) && (6...8).contains(c) { return .middle }
        for s in Side.allCases {
            let (r0, c0) = yard(s)
            if r >= r0 && r < r0 + 6 && c >= c0 && c < c0 + 6 { return .yard(s) }
        }
        if (r < 6 || r > 8) && (c < 6 || c > 8) { return .garden }
        for s in Side.allCases where homePath(s).contains(where: { $0 == (r, c) }) { return .path(s) }
        guard let i = path.firstIndex(where: { $0 == (r, c) }) else { return .track }
        if i == start(.a) { return .start(.a) }
        if i == start(.b) { return .start(.b) }
        if safe.contains(i) { return i % 13 == 0 ? .start(nil) : .star }
        return .track
    }
}
