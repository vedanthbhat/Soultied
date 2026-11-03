import Foundation

/*
 * The rules of the games you take turns at, the same as the website's (src/games/fireflies.ts, noughts.ts,
 * fence.ts, lanterns.ts, boats.ts), so a move made on a phone and one made on a laptop agree. Each game's
 * board is kept as a short string, exactly as the website keeps it.
 *
 * The demo room's pretend partner (the bots) uses the same random numbers in the same order as the
 * website's, so the tests can check it chooses exactly the same moves.
 */

public typealias Random = () -> Double

@inline(__always) func floorInt(_ v: Double) -> Int { Int(v.rounded(.down)) }

extension String {
    /// the character at `i`, as a string ("" past the end)
    @inline(__always) func at(_ i: Int) -> String {
        let u = utf8
        guard i >= 0, i < u.count else { return "" }
        return String(UnicodeScalar(u[u.index(u.startIndex, offsetBy: i)]))
    }

    /// this string with the character at `i` replaced (boards are plain ASCII)
    func setting(_ i: Int, _ c: String) -> String {
        var u = Array(utf8)
        u[i] = c.utf8.first!
        return String(decoding: u, as: UTF8.self)
    }
}

/* ---------- Fireflies: four in a row in a jar ---------- */

public enum Fireflies {
    public static let cols = 7
    public static let rows = 6

    public struct State: Equatable, Sendable {
        /// 42 characters, top row first: '.' empty, 'a' / 'b' each person's fireflies
        public var board: String
        /// where the last firefly landed
        public var lastCell: Int?
        /// the four that won
        public var line: [Int]?

        public init(board: String = String(repeating: ".", count: 42), lastCell: Int? = nil, line: [Int]? = nil) {
            self.board = board
            self.lastCell = lastCell
            self.line = line
        }

        public init(_ d: Doc) {
            let b = d.str("board") ?? ""
            board = b.utf8.count == 42 ? b : String(repeating: ".", count: 42)
            lastCell = d.int("lastCell")
            line = (d["line"] as? [Any]).map { $0.compactMap { Values.num($0).map { Int($0) } } }
        }

        public var doc: Doc { ["board": board, "lastCell": lastCell as Any? ?? NSNull(), "line": line as Any? ?? NSNull()] }
    }

    public static func cell(_ r: Int, _ c: Int) -> Int { r * cols + c }

    /// the row a firefly dropped in this column would land in, or -1 if it's full
    public static func landingRow(_ board: String, _ col: Int) -> Int {
        let b = Array(board.utf8)
        var r = rows - 1
        while r >= 0 {
            if b[cell(r, col)] == UInt8(ascii: ".") { return r }
            r -= 1
        }
        return -1
    }

    public static func drop(_ board: String, _ col: Int, _ seat: Side) -> (board: String, cell: Int)? {
        let r = landingRow(board, col)
        if r < 0 { return nil }
        let i = cell(r, col)
        return (board.setting(i, seat.rawValue), i)
    }

    static let dirs = [(0, 1), (1, 0), (1, 1), (1, -1)]

    public static func findLine(_ board: String) -> (seat: Side, cells: [Int])? {
        let b = Array(board.utf8)
        for r in 0..<rows {
            for c in 0..<cols {
                let s = b[cell(r, c)]
                if s == UInt8(ascii: ".") { continue }
                for (dr, dc) in dirs {
                    var cells = [cell(r, c)]
                    for k in 1..<4 {
                        let rr = r + dr * k, cc = c + dc * k
                        if rr < 0 || rr >= rows || cc < 0 || cc >= cols || b[cell(rr, cc)] != s { break }
                        cells.append(cell(rr, cc))
                    }
                    if cells.count == 4 { return (Side(rawValue: String(UnicodeScalar(s)))!, cells) }
                }
            }
        }
        return nil
    }

    public static func isFull(_ board: String) -> Bool { !board.contains(".") }

    static let places = ["on the far left", "on the left", "just left of the middle", "in the middle", "just right of the middle", "on the right", "on the far right"]
    public static func columnPlace(_ col: Int) -> String { col >= 0 && col < places.count ? places[col] : "in column \(col + 1)" }

    /// takes a win when it sees one, blocks yours, never hands you a win if it can help it, and otherwise likes the middle
    public static func botColumn(_ board: String, _ bot: Side, _ rng: Random) -> Int {
        let you = bot.other
        let open = (0..<cols).filter { landingRow(board, $0) >= 0 }
        func wins(_ b: String, _ s: Side, _ c: Int) -> Bool {
            guard let d = drop(b, c, s) else { return false }
            return findLine(d.board)?.seat == s
        }
        for c in open where wins(board, bot, c) { return c }
        for c in open where wins(board, you, c) { return c }
        let safe = open.filter { c in
            let d = drop(board, c, bot)!
            return !open.contains { wins(d.board, you, $0) }
        }
        let pool = safe.isEmpty ? open : safe
        let scored = pool.map { c in (c: c, w: Double(4 - abs(3 - c)) + rng() * 2.5) }
        var best = scored[0]
        for s in scored where s.w > best.w { best = s }
        return best.c
    }
}

/* ---------- Noughts & Hearts: three in a row, best of five ---------- */

public enum Noughts {
    public static let roundsToWin = 3
    public static let maxRounds = 5

    public struct State: Equatable, Sendable {
        public var board: String
        public var round: Int
        /// who went first this round
        public var opener: Side
        public var score: [Side: Int]
        /// each finished round: "a", "b" or "draw"
        public var history: [String]
        public var lastCell: Int?
        /// the three that won the round just finished (shown until the next move)
        public var line: [Int]?
        /// how the last round's board ended, shown until the next round's first move
        public var lastBoard: String?

        public init(opener: Side) {
            board = "........."
            round = 1
            self.opener = opener
            score = [.a: 0, .b: 0]
            history = []
        }

        public init(_ d: Doc) {
            let b = d.str("board") ?? ""
            board = b.utf8.count == 9 ? b : "........."
            round = d.int("round") ?? 1
            opener = Side(rawValue: d.str("opener") ?? "") ?? .a
            let s = d.map("score")
            score = [.a: s.int("a") ?? 0, .b: s.int("b") ?? 0]
            history = d.list("history").compactMap { $0 as? String }
            lastCell = d.int("lastCell")
            line = (d["line"] as? [Any]).map { $0.compactMap { Values.num($0).map { Int($0) } } }
            lastBoard = d.str("lastBoard")
        }

        public var doc: Doc {
            ["board": board, "round": round, "opener": opener.rawValue, "score": ["a": score[.a] ?? 0, "b": score[.b] ?? 0], "history": history,
             "lastCell": lastCell as Any? ?? NSNull(), "line": line as Any? ?? NSNull(), "lastBoard": lastBoard as Any? ?? NSNull()]
        }
    }

    public static let lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]

    public static func threeInRow(_ board: String) -> (seat: Side, cells: [Int])? {
        let b = Array(board.utf8)
        for l in lines {
            let s = b[l[0]]
            if s != UInt8(ascii: "."), s == b[l[1]], s == b[l[2]] { return (Side(rawValue: String(UnicodeScalar(s)))!, l) }
        }
        return nil
    }

    static let places = ["the top left", "the top", "the top right", "the left", "the middle", "the right", "the bottom left", "the bottom", "the bottom right"]
    public static func placeName(_ i: Int) -> String { i >= 0 && i < places.count ? places[i] : "a square" }

    public struct Move {
        public var state: State
        public var next: Side?
        public var over: Bool
        public var winner: String?
        public var line: String
    }

    public static func placeMark(_ st: State, _ seat: Side, _ cell: Int) -> Move? {
        if cell < 0 || cell > 8 || st.board.at(cell) != "." { return nil }
        let board = st.board.setting(cell, seat.rawValue)
        let three = threeInRow(board)
        let full = !board.contains(".")
        if three == nil && !full {
            var s = st
            s.board = board
            s.lastCell = cell
            s.line = nil
            s.lastBoard = nil
            return Move(state: s, next: seat.other, over: false, winner: nil, line: "put a mark in \(placeName(cell))")
        }
        let roundWinner = three?.seat.rawValue ?? "draw"
        var score = st.score
        if let w = three?.seat { score[w, default: 0] += 1 }
        let history = st.history + [roundWinner]
        let a = score[.a] ?? 0, b = score[.b] ?? 0
        let decided = a >= roundsToWin || b >= roundsToWin || history.count >= maxRounds
        if decided {
            let winner = a == b ? "draw" : a > b ? "a" : "b"
            var s = st
            s.board = board
            s.score = score
            s.history = history
            s.lastCell = cell
            s.line = three?.cells
            s.lastBoard = nil
            return Move(state: s, next: nil, over: true, winner: winner,
                        line: winner == "draw" ? "finished level at \(a)–\(b)" : "won the series \(max(a, b))–\(min(a, b))")
        }
        // next round: the other person opens
        var s = State(opener: st.opener.other)
        s.round = st.round + 1
        s.score = score
        s.history = history
        s.line = three?.cells
        s.lastBoard = board
        return Move(state: s, next: s.opener, over: false, winner: nil,
                    line: roundWinner == "draw" ? "filled the board, so round \(st.round) is a draw" : "got three in a row and took round \(st.round)")
    }

    /// perfect play, with a little forgetfulness so it can be beaten
    public static func botCell(_ board: String, _ bot: Side, _ rng: Random) -> Int {
        var b = Array(board.utf8)
        let me = bot.rawValue.utf8.first!, you = bot.other.rawValue.utf8.first!
        let open = (0..<9).filter { b[$0] == dot }
        if rng() < 0.18 { return open[floorInt(rng() * Double(open.count))] }
        var best = open[0]
        var bestV = -Double.infinity
        var memo: [Int: Int] = [:]
        for i in open {
            b[i] = me
            let v = Double(search(&b, you, me, you, 1, &memo)) + rng() * 0.5
            b[i] = dot
            if v > bestV {
                bestV = v
                best = i
            }
        }
        return best
    }

    private static let dot = UInt8(ascii: ".")

    /// the website's search (how good this board is for `me`, with `turn` to move), on bytes and remembering
    /// boards it has already worked out, so it's quick (the same board is always the same depth down)
    private static func search(_ b: inout [UInt8], _ turn: UInt8, _ me: UInt8, _ you: UInt8, _ depth: Int, _ memo: inout [Int: Int]) -> Int {
        var key = turn == me ? 1 : 2
        for c in b { key = key * 3 + (c == dot ? 0 : c == me ? 1 : 2) }
        if let v = memo[key] { return v }
        let v = searchUncached(&b, turn, me, you, depth, &memo)
        memo[key] = v
        return v
    }

    private static func searchUncached(_ b: inout [UInt8], _ turn: UInt8, _ me: UInt8, _ you: UInt8, _ depth: Int, _ memo: inout [Int: Int]) -> Int {
        for l in lines {
            let c = b[l[0]]
            if c != dot && c == b[l[1]] && c == b[l[2]] { return c == me ? 10 - depth : depth - 10 }
        }
        var best = turn == me ? Int.min : Int.max
        var any = false
        for i in 0..<9 where b[i] == dot {
            any = true
            b[i] = turn
            let v = search(&b, turn == me ? you : me, me, you, depth + 1, &memo)
            b[i] = dot
            best = turn == me ? max(best, v) : min(best, v)
        }
        return any ? best : 0
    }
}

/* ---------- Fence the Garden: dots and boxes ---------- */

public enum Fence {
    public static let n = 5
    public static let hCount = (n + 1) * n
    public static let edges = hCount * 2

    public struct State: Equatable, Sendable {
        /// 60 characters: the 30 across (6 rows of 5), then the 30 down (5 rows of 6). '.', 'a' or 'b'
        public var fences: String
        /// 25 characters: '.' or whose bed it is
        public var beds: String
        public var lastEdge: Int?
        public var lastBeds: [Int]

        public init() {
            fences = String(repeating: ".", count: Fence.edges)
            beds = String(repeating: ".", count: Fence.n * Fence.n)
            lastBeds = []
        }

        public init(_ d: Doc) {
            self.init()
            if let f = d.str("fences"), f.utf8.count == Fence.edges { fences = f }
            if let b = d.str("beds"), b.utf8.count == Fence.n * Fence.n { beds = b }
            lastEdge = d.int("lastEdge")
            lastBeds = d.list("lastBeds").compactMap { Values.num($0).map { Int($0) } }
        }

        public var doc: Doc { ["fences": fences, "beds": beds, "lastEdge": lastEdge as Any? ?? NSNull(), "lastBeds": lastBeds] }

        public func count(_ s: Side) -> Int { beds.filter { String($0) == s.rawValue }.count }
    }

    /// the fence along the top of row r (0...n), between posts c and c+1
    public static func hEdge(_ r: Int, _ c: Int) -> Int { r * n + c }
    /// the fence down the left of column c (0...n), between posts r and r+1
    public static func vEdge(_ r: Int, _ c: Int) -> Int { hCount + r * (n + 1) + c }
    public static func bedEdges(_ r: Int, _ c: Int) -> [Int] { [hEdge(r, c), hEdge(r + 1, c), vEdge(r, c), vEdge(r, c + 1)] }

    /// the one or two beds a piece of fence borders
    public static func bedsBeside(_ e: Int) -> [Int] {
        var out: [Int] = []
        if e < hCount {
            let r = e / n, c = e % n
            if r > 0 { out.append((r - 1) * n + c) }
            if r < n { out.append(r * n + c) }
        } else {
            let k = e - hCount
            let r = k / (n + 1), c = k % (n + 1)
            if c > 0 { out.append(r * n + c - 1) }
            if c < n { out.append(r * n + c) }
        }
        return out
    }

    static func sidesBuilt(_ fences: String, _ bed: Int) -> Int {
        let f = Array(fences.utf8)
        return bedEdges(bed / n, bed % n).filter { f[$0] != UInt8(ascii: ".") }.count
    }

    public struct Move {
        public var state: State
        /// closed at least one bed: the same person goes again
        public var again: Bool
        public var over: Bool
        public var winner: String?
        public var line: String
    }

    public static func build(_ st: State, _ seat: Side, _ e: Int) -> Move? {
        if e < 0 || e >= edges || st.fences.at(e) != "." { return nil }
        let fences = st.fences.setting(e, seat.rawValue)
        var beds = st.beds
        var closed: [Int] = []
        for b in bedsBeside(e) where beds.at(b) == "." && sidesBuilt(fences, b) == 4 {
            beds = beds.setting(b, seat.rawValue)
            closed.append(b)
        }
        var state = State()
        state.fences = fences
        state.beds = beds
        state.lastEdge = e
        state.lastBeds = closed
        let over = !fences.contains(".")
        let a = state.count(.a), b = state.count(.b)
        let winner: String? = over ? (a == b ? "draw" : a > b ? "a" : "b") : nil
        let line: String
        if over { line = "closed the last bed (\(max(a, b))–\(min(a, b)))" }
        else if closed.count > 1 { line = "closed \(closed.count) beds at once" }
        else if !closed.isEmpty { line = "closed a bed and went again" }
        else { line = "added a bit of fence" }
        return Move(state: state, again: !closed.isEmpty && !over, over: over, winner: winner, line: line)
    }

    public static func next(_ seat: Side, _ mv: Move) -> Side? { mv.over ? nil : mv.again ? seat : seat.other }

    /// takes any bed it can close, otherwise builds where it won't hand you one, and when it has to, gives away as few as it can
    public static func botEdge(_ st: State, _ bot: Side, _ rng: Random) -> Int {
        // (the website's search, on bytes rather than strings so it's quick)
        let dot = UInt8(ascii: "."), x = UInt8(ascii: "x")
        let f0 = Array(st.fences.utf8), b0 = Array(st.beds.utf8)
        func sides(_ f: [UInt8], _ bed: Int) -> Int { bedEdges(bed / n, bed % n).filter { f[$0] != dot }.count }
        let open = (0..<edges).filter { f0[$0] == dot }
        let closes = open.filter { e in bedsBeside(e).contains { b0[$0] == dot && sides(f0, $0) == 3 } }
        if !closes.isEmpty { return closes[floorInt(rng() * Double(closes.count))] }
        func givesAway(_ e: Int) -> Int {
            var f = f0
            f[e] = x
            return bedsBeside(e).filter { b0[$0] == dot && sides(f, $0) == 3 }.count
        }
        let safe = open.filter { givesAway($0) == 0 }
        if !safe.isEmpty { return safe[floorInt(rng() * Double(safe.count))] }
        // how long a run of beds each choice would hand over: pick the shortest
        func chain(_ e: Int) -> Double {
            var f = f0
            f[e] = x
            var beds = b0
            var count = 0
            for _ in 0..<30 {
                guard let take = (0..<edges).first(where: { ed in f[ed] == dot && bedsBeside(ed).contains { beds[$0] == dot && sides(f, $0) == 3 } }) else { break }
                f[take] = x
                for b in bedsBeside(take) where beds[b] == dot && sides(f, b) == 4 {
                    beds[b] = x
                    count += 1
                }
            }
            return Double(count) + rng() * 0.3
        }
        let scored = open.map { (e: $0, n: chain($0)) }
        var best = scored[0]
        for s in scored where s.n < best.n { best = s }
        return best.e
    }
}

/* ---------- Lanterns: Reversi on a pond at night ---------- */

public enum Lanterns {
    public static let size = 8

    public struct State: Equatable, Sendable {
        /// 64 characters, top row first
        public var board: String
        public var lastCell: Int?
        /// turned by the last move
        public var flipped: [Int]
        /// the person before had nothing to trap and had to pass
        public var passed: Side?

        public init(starter: Side) {
            var b = String(repeating: ".", count: 64)
            b = b.setting(Lanterns.at(3, 3), starter.other.rawValue)
            b = b.setting(Lanterns.at(4, 4), starter.other.rawValue)
            b = b.setting(Lanterns.at(4, 3), starter.rawValue)
            b = b.setting(Lanterns.at(3, 4), starter.rawValue)
            board = b
            flipped = []
        }

        public init(_ d: Doc) {
            self.init(starter: .a)
            if let b = d.str("board"), b.utf8.count == 64 { board = b }
            lastCell = d.int("lastCell")
            flipped = d.list("flipped").compactMap { Values.num($0).map { Int($0) } }
            passed = d.str("passed").flatMap { Side(rawValue: $0) }
        }

        public var doc: Doc { ["board": board, "lastCell": lastCell as Any? ?? NSNull(), "flipped": flipped, "passed": passed?.rawValue as Any? ?? NSNull()] }
    }

    public static func at(_ x: Int, _ y: Int) -> Int { y * size + x }

    static let dirs = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]

    /// the lanterns lighting this cell would turn
    public static func flips(_ board: String, _ seat: Side, _ cell: Int) -> [Int] {
        let b = Array(board.utf8)
        if b[cell] != UInt8(ascii: ".") { return [] }
        let x0 = cell % size, y0 = cell / size
        let them = seat.other.rawValue.utf8.first!, me = seat.rawValue.utf8.first!
        var out: [Int] = []
        for (dx, dy) in dirs {
            var run: [Int] = []
            var x = x0 + dx, y = y0 + dy
            while x >= 0, y >= 0, x < size, y < size, b[at(x, y)] == them {
                run.append(at(x, y))
                x += dx
                y += dy
            }
            if !run.isEmpty, x >= 0, y >= 0, x < size, y < size, b[at(x, y)] == me { out += run }
        }
        return out
    }

    public static func legal(_ board: String, _ seat: Side) -> [Int] { (0..<64).filter { !flips(board, seat, $0).isEmpty } }
    public static func count(_ board: String, _ s: Side) -> Int { board.filter { String($0) == s.rawValue }.count }

    public struct Move {
        public var state: State
        public var next: Side?
        public var over: Bool
        public var winner: String?
        public var line: String
    }

    public static func light(_ st: State, _ seat: Side, _ cell: Int) -> Move? {
        let f = flips(st.board, seat, cell)
        if f.isEmpty { return nil }
        var board = st.board.setting(cell, seat.rawValue)
        for i in f { board = board.setting(i, seat.rawValue) }
        let them = seat.other
        let theyCan = !legal(board, them).isEmpty
        let iCan = !legal(board, seat).isEmpty
        let over = !theyCan && !iCan
        let a = count(board, .a), b = count(board, .b)
        let winner: String? = over ? (a == b ? "draw" : a > b ? "a" : "b") : nil
        var s = State(starter: .a)
        s.board = board
        s.lastCell = cell
        s.flipped = f
        s.passed = !over && !theyCan ? them : nil
        let turned = f.count == 1 ? "turned one lantern" : "turned \(f.count) lanterns"
        return Move(state: s, next: over ? nil : theyCan ? them : seat, over: over, winner: winner,
                    line: over ? "lit the last lantern (\(max(a, b))–\(min(a, b)))" : turned)
    }

    /// corners are gold, the squares next to them are traps; edges are good
    static let weight: [Double] = [
        120, -20, 20, 5, 5, 20, -20, 120, -20, -40, -5, -5, -5, -5, -40, -20, 20, -5, 15, 3, 3, 15, -5, 20, 5, -5, 3, 3, 3, 3, -5, 5, 5, -5, 3, 3, 3, 3, -5, 5, 20,
        -5, 15, 3, 3, 15, -5, 20, -20, -40, -5, -5, -5, -5, -40, -20, 120, -20, 20, 5, 5, 20, -20, 120,
    ]

    public static func botLantern(_ board: String, _ bot: Side, _ rng: Random) -> Int {
        let moves = legal(board, bot)
        let them = bot.other
        func score(_ cell: Int) -> Double {
            let f = flips(board, bot, cell)
            var b = board.setting(cell, bot.rawValue)
            for i in f { b = b.setting(i, bot.rawValue) }
            // fewer replies for them is better
            return weight[cell] + Double(f.count) * 1.5 - Double(legal(b, them).count) * 2 + rng() * 6
        }
        let scored = moves.map { (c: $0, v: score($0)) }
        var best = scored[0]
        for s in scored where s.v > best.v { best = s }
        return best.c
    }
}

/* ---------- Paper Boats: battleship on a pond ---------- */

public enum Boats {
    public static let size = 8
    public static let fleetLengths = [4, 3, 3, 2]
    public static let cells = size * size

    public struct Boat: Equatable, Hashable, Sendable {
        public var x: Int
        public var y: Int
        public var len: Int
        /// runs downwards (otherwise across)
        public var down: Bool

        public init(x: Int, y: Int, len: Int, down: Bool) {
            self.x = x
            self.y = y
            self.len = len
            self.down = down
        }

        init?(_ raw: Any?) {
            guard let d = raw as? Doc, let x = d.int("x"), let y = d.int("y"), let len = d.int("len") else { return nil }
            self.init(x: x, y: y, len: len, down: d.bool("down"))
        }

        public var doc: Doc { ["x": x, "y": y, "len": len, "down": down] }

        public var cells: [Int] { (0..<len).map { k in Boats.idx(x + (down ? 0 : k), y + (down ? k : 0)) } }
    }

    public struct State: Equatable, Sendable {
        /// each person's boats, once hidden
        public var fleets: [Side: [Boat]]
        /// the guesses each person has made at the other's pond: '.' not tried, 'o' splash, 'x' hit
        public var shots: [Side: String]
        public var lastShot: (by: Side, cell: Int)?

        public init() {
            fleets = [:]
            shots = [.a: String(repeating: ".", count: Boats.cells), .b: String(repeating: ".", count: Boats.cells)]
        }

        public init(_ d: Doc) {
            self.init()
            for s in [Side.a, .b] {
                if let f = d.map("fleets")[s.rawValue] as? [Any] { fleets[s] = f.compactMap { Boat($0) } }
                if let row = d.map("shots").str(s.rawValue), row.utf8.count == Boats.cells { shots[s] = row }
            }
            if let l = d["lastShot"] as? Doc, let by = l.str("by").flatMap({ Side(rawValue: $0) }), let c = l.int("cell") { lastShot = (by, c) }
        }

        public var doc: Doc {
            var f: Doc = [:]
            for (s, boats) in fleets { f[s.rawValue] = boats.map(\.doc) }
            return ["fleets": f, "shots": ["a": shots[.a] ?? "", "b": shots[.b] ?? ""],
                    "lastShot": lastShot.map { ["by": $0.by.rawValue, "cell": $0.cell] as Doc } as Any? ?? NSNull()]
        }

        public static func == (l: State, r: State) -> Bool {
            l.fleets == r.fleets && l.shots == r.shots && l.lastShot?.by == r.lastShot?.by && l.lastShot?.cell == r.lastShot?.cell
        }
    }

    public static func idx(_ x: Int, _ y: Int) -> Int { y * size + x }
    public static func coordName(_ i: Int) -> String { "\(Array("ABCDEFGH")[i % size])\(i / size + 1)" }

    /// the cells a boat takes up, and the ring around it (where no other boat may go)
    static func footprint(_ b: Boat) -> Set<Int> {
        var out = Set<Int>()
        let w = b.down ? 1 : b.len, h = b.down ? b.len : 1
        for y in (b.y - 1)...(b.y + h) {
            for x in (b.x - 1)...(b.x + w) where x >= 0 && y >= 0 && x < size && y < size { out.insert(idx(x, y)) }
        }
        return out
    }

    static func fits(_ b: Boat) -> Bool {
        b.x >= 0 && b.y >= 0 && (b.down ? b.y + b.len : b.x + b.len) <= size && (b.down ? b.x : b.y) < size
    }

    public static func canPlace(_ fleet: [Boat], _ b: Boat) -> Bool {
        if !fits(b) { return false }
        let cs = b.cells
        return fleet.allSatisfy { o in
            let f = footprint(o)
            return cs.allSatisfy { !f.contains($0) }
        }
    }

    public static func randomFleet(_ rng: Random) -> [Boat] {
        for _ in 0..<200 {
            var fleet: [Boat] = []
            var ok = true
            for len in fleetLengths {
                var placed = false
                var tries = 0
                while tries < 100 && !placed {
                    let down = rng() < 0.5
                    let x = floorInt(rng() * Double(down ? size : size - len + 1))
                    let y = floorInt(rng() * Double(down ? size - len + 1 : size))
                    let b = Boat(x: x, y: y, len: len, down: down)
                    if canPlace(fleet, b) {
                        fleet.append(b)
                        placed = true
                    }
                    tries += 1
                }
                if !placed {
                    ok = false
                    break
                }
            }
            if ok { return fleet }
        }
        return [Boat(x: 0, y: 0, len: 4, down: false), Boat(x: 0, y: 2, len: 3, down: false), Boat(x: 0, y: 4, len: 3, down: false), Boat(x: 0, y: 6, len: 2, down: false)]
    }

    public static func sunk(_ fleet: [Boat]?, _ shotsAgainst: String) -> [Boat] {
        let s = Array(shotsAgainst.utf8)
        return (fleet ?? []).filter { $0.cells.allSatisfy { s[$0] == UInt8(ascii: "x") } }
    }

    public static func boatAt(_ fleet: [Boat]?, _ cell: Int) -> Boat? { (fleet ?? []).first { $0.cells.contains(cell) } }

    public struct Shot {
        public var state: State
        public var hit: Bool
        public var sunk: Boat?
        public var allSunk: Bool
    }

    /// `by` guesses a cell on the other person's pond
    public static func shoot(_ st: State, _ by: Side, _ cell: Int) -> Shot? {
        let them = by.other
        guard let fleet = st.fleets[them], let row = st.shots[by], cell >= 0, cell < cells, row.at(cell) == "." else { return nil }
        let hit = boatAt(fleet, cell) != nil
        var next = st
        next.shots[by] = row.setting(cell, hit ? "x" : "o")
        next.lastShot = (by, cell)
        let mine = Array(next.shots[by]!.utf8)
        let b = hit ? boatAt(fleet, cell) : nil
        let sunkBoat = b.flatMap { boat in boat.cells.allSatisfy { mine[$0] == UInt8(ascii: "x") } ? boat : nil }
        let allSunk = sunk(fleet, next.shots[by]!).count == fleet.count
        return Shot(state: next, hit: hit, sunk: sunkBoat, allSunk: allSunk)
    }

    public static func boatName(_ b: Boat) -> String {
        switch b.len {
        case 2: return "the little boat"
        case 3: return "a three-boat"
        case 4: return "the big boat"
        default: return "a boat"
        }
    }

    /// follows up a hit along its line, otherwise guesses on a checkerboard, and skips the water around sunk boats
    public static func botShot(_ st: State, _ bot: Side, _ rng: Random) -> Int {
        let them = bot.other
        let mine = Array((st.shots[bot] ?? String(repeating: ".", count: cells)).utf8)
        let sunkBoats = sunk(st.fleets[them], String(decoding: mine, as: UTF8.self))
        var blocked = Set<Int>()
        for b in sunkBoats { blocked.formUnion(footprint(b)) }
        func open(_ i: Int) -> Bool { mine[i] == UInt8(ascii: ".") && !blocked.contains(i) }
        let hits = (0..<cells).filter { mine[$0] == UInt8(ascii: "x") && !blocked.contains($0) }
        func xy(_ i: Int) -> (Int, Int) { (i % size, i / size) }
        if !hits.isEmpty {
            var tries: [Int] = []
            let (x0, y0) = xy(hits[0])
            let inLine: String? = hits.count > 1 && hits.allSatisfy({ xy($0).1 == y0 }) ? "across" : hits.count > 1 && hits.allSatisfy({ xy($0).0 == x0 }) ? "down" : nil
            for h in hits {
                let (x, y) = xy(h)
                let n: [(Int, Int)] = inLine == "across" ? [(x - 1, y), (x + 1, y)] : inLine == "down" ? [(x, y - 1), (x, y + 1)] : [(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)]
                for (nx, ny) in n where nx >= 0 && ny >= 0 && nx < size && ny < size && open(idx(nx, ny)) { tries.append(idx(nx, ny)) }
            }
            if !tries.isEmpty { return tries[floorInt(rng() * Double(tries.count))] }
        }
        let all = (0..<cells).filter(open)
        let checker = all.filter { ($0 % size + $0 / size) % 2 == 0 }
        let pool = !checker.isEmpty ? checker : !all.isEmpty ? all : (0..<cells).filter { mine[$0] == UInt8(ascii: ".") }
        return pool[floorInt(rng() * Double(pool.count))]
    }
}
