import Foundation

/*
 * Chess for two (src/games/chess.ts), the whole game: castling, taking in passing, a pawn made into anything at
 * the far side, check, checkmate, stalemate, the same position three times, fifty moves without a capture or a
 * pawn moving, and nobody able to checkmate any more. Either of you can offer a draw or resign. Whoever starts
 * plays white.
 *
 * The board is 64 characters, a8 first and h1 last: "." empty, "KQRBNP" white, "kqrbnp" black.
 */
public enum Chess {
    public enum Color: String, Sendable {
        case w, b
        public var other: Color { self == .w ? .b : .w }
    }

    public struct Move: Equatable, Hashable, Sendable {
        public var from: Int
        public var to: Int
        /// "q", "r", "b" or "n"
        public var promo: Character?
        public init(_ from: Int, _ to: Int, promo: Character? = nil) {
            self.from = from
            self.to = to
            self.promo = promo
        }
        public var doc: Doc {
            var d: Doc = ["from": from, "to": to]
            if let promo { d["promo"] = String(promo) }
            return d
        }
    }

    public static let startBoard = "rnbqkbnr" + "pppppppp" + String(repeating: ".", count: 32) + "PPPPPPPP" + "RNBQKBNR"

    public struct State: Equatable, Sendable {
        public var board: [UInt8]
        /// who plays white (and went first)
        public var white: Side
        /// whose move it is, by colour
        public var side: Color
        /// which ways each side can still castle: some of "KQkq"
        public var castling: String
        /// the square a pawn just skipped over, which the other side can take in passing
        public var ep: Int?
        /// moves since a capture or a pawn moved
        public var half: Int
        public var full: Int
        public var last: (from: Int, to: Int)?
        /// the positions since a capture or a pawn moved
        public var seen: [String]
        public var check: Bool
        /// checkmate, stalemate, repetition, fifty, material, resigned or agreed
        public var end: String?
        /// a draw offered by this seat, waiting for an answer
        public var offer: Side?

        public init(white: Side) {
            board = Array(startBoard.utf8)
            self.white = white
            side = .w
            castling = "KQkq"
            half = 0
            full = 1
            seen = [Chess.key(board, .w, "KQkq", nil)]
            check = false
        }

        public init(_ d: Doc) {
            let b = Array((d.str("board") ?? "").utf8)
            board = b.count == 64 ? b : Array(startBoard.utf8)
            white = Side(rawValue: d.str("white") ?? "") ?? .a
            side = Color(rawValue: d.str("side") ?? "") ?? .w
            castling = d.str("castling") ?? ""
            ep = d.int("ep")
            half = d.int("half") ?? 0
            full = d.int("full") ?? 1
            let l = d.map("last")
            if let f = l.int("from"), let t = l.int("to") { last = (f, t) }
            seen = d.list("seen").compactMap { $0 as? String }
            check = d.bool("check")
            end = d.str("end")
            offer = d.str("offer").flatMap { Side(rawValue: $0) }
        }

        public var doc: Doc {
            ["board": String(decoding: board, as: UTF8.self), "white": white.rawValue, "side": side.rawValue, "castling": castling,
             "ep": ep as Any? ?? NSNull(), "half": half, "full": full,
             "last": last.map { ["from": $0.from, "to": $0.to] as Doc } as Any? ?? NSNull(),
             "seen": seen, "check": check, "end": end as Any? ?? NSNull(), "offer": offer?.rawValue as Any? ?? NSNull()]
        }

        public static func == (l: State, r: State) -> Bool {
            l.board == r.board && l.white == r.white && l.side == r.side && l.castling == r.castling && l.ep == r.ep && l.half == r.half && l.full == r.full
                && l.last?.from == r.last?.from && l.last?.to == r.last?.to && l.seen == r.seen && l.check == r.check && l.end == r.end && l.offer == r.offer
        }

        public func color(of seat: Side) -> Color { white == seat ? .w : .b }
        public func seat(of c: Color) -> Side { c == .w ? white : white.other }
        public func piece(_ sq: Int) -> Character { Character(UnicodeScalar(board[sq])) }
    }

    static let dot = UInt8(ascii: ".")

    public static func colorOf(_ p: UInt8) -> Color? {
        if p == dot { return nil }
        return p >= 65 && p <= 90 ? .w : .b
    }
    static func lower(_ p: UInt8) -> UInt8 { p >= 65 && p <= 90 ? p + 32 : p }
    static func upper(_ p: UInt8) -> UInt8 { p >= 97 && p <= 122 ? p - 32 : p }

    public static func squareName(_ i: Int) -> String {
        let files = Array("abcdefgh")
        return "\(files[i % 8])\(8 - i / 8)"
    }

    public static func pieceName(_ p: UInt8) -> String {
        switch lower(p) {
        case UInt8(ascii: "p"): return "pawn"
        case UInt8(ascii: "n"): return "knight"
        case UInt8(ascii: "b"): return "bishop"
        case UInt8(ascii: "r"): return "rook"
        case UInt8(ascii: "q"): return "queen"
        case UInt8(ascii: "k"): return "king"
        default: return "piece"
        }
    }

    public static func value(_ p: UInt8) -> Int {
        switch lower(p) {
        case UInt8(ascii: "p"): return 100
        case UInt8(ascii: "n"): return 320
        case UInt8(ascii: "b"): return 330
        case UInt8(ascii: "r"): return 500
        case UInt8(ascii: "q"): return 900
        default: return 0
        }
    }

    static let knight = [(-2, -1), (-2, 1), (-1, -2), (-1, 2), (1, -2), (1, 2), (2, -1), (2, 1)]
    static let diag = [(-1, -1), (-1, 1), (1, -1), (1, 1)]
    static let straight = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    static let all = diag + straight

    static func on(_ r: Int, _ c: Int) -> Bool { r >= 0 && r < 8 && c >= 0 && c < 8 }

    public static func key(_ board: [UInt8], _ side: Color, _ castling: String, _ ep: Int?) -> String {
        "\(String(decoding: board, as: UTF8.self)) \(side.rawValue) \(castling.isEmpty ? "-" : castling) \(ep.map { String($0) } ?? "-")"
    }

    /// whether `by` attacks square `sq`
    public static func attacked(_ board: [UInt8], _ sq: Int, by: Color) -> Bool {
        let r = sq / 8, c = sq % 8
        func isKind(_ p: UInt8, _ k: UInt8) -> Bool { p != dot && colorOf(p) == by && lower(p) == k }
        let pr = by == .w ? r + 1 : r - 1
        for dc in [-1, 1] where on(pr, c + dc) && isKind(board[pr * 8 + c + dc], UInt8(ascii: "p")) { return true }
        for (dr, dc) in knight where on(r + dr, c + dc) && isKind(board[(r + dr) * 8 + c + dc], UInt8(ascii: "n")) { return true }
        for (dr, dc) in all where on(r + dr, c + dc) && isKind(board[(r + dr) * 8 + c + dc], UInt8(ascii: "k")) { return true }
        for (dr, dc) in diag {
            var rr = r + dr, cc = c + dc
            while on(rr, cc) {
                let p = board[rr * 8 + cc]
                if p != dot {
                    if isKind(p, UInt8(ascii: "b")) || isKind(p, UInt8(ascii: "q")) { return true }
                    break
                }
                rr += dr
                cc += dc
            }
        }
        for (dr, dc) in straight {
            var rr = r + dr, cc = c + dc
            while on(rr, cc) {
                let p = board[rr * 8 + cc]
                if p != dot {
                    if isKind(p, UInt8(ascii: "r")) || isKind(p, UInt8(ascii: "q")) { return true }
                    break
                }
                rr += dr
                cc += dc
            }
        }
        return false
    }

    public static func kingSquare(_ board: [UInt8], _ c: Color) -> Int {
        board.firstIndex(of: UInt8(ascii: c == .w ? "K" : "k")) ?? -1
    }

    public static func inCheck(_ board: [UInt8], _ c: Color) -> Bool {
        let k = kingSquare(board, c)
        return k >= 0 && attacked(board, k, by: c.other)
    }

    /// every move by `side`, before checking it doesn't leave its own king in check (castling is checked fully)
    public static func pseudoMoves(_ board: [UInt8], _ side: Color, _ castling: String, _ ep: Int?) -> [Move] {
        var out: [Move] = []
        for sq in 0..<64 {
            let p = board[sq]
            guard p != dot, colorOf(p) == side else { continue }
            let r = sq / 8, c = sq % 8
            let kind = Character(UnicodeScalar(lower(p)))
            func target(_ t: Int) -> Int { // 0 empty, 1 own, 2 theirs
                let q = board[t]
                return q == dot ? 0 : colorOf(q) == side ? 1 : 2
            }
            if kind == "p" {
                let dir = side == .w ? -1 : 1
                let home = side == .w ? 6 : 1
                let lastRow = side == .w ? 0 : 7
                func push(_ to: Int) {
                    if to / 8 == lastRow { for pr in ["q", "r", "b", "n"] as [Character] { out.append(Move(sq, to, promo: pr)) } } else { out.append(Move(sq, to)) }
                }
                let one = (r + dir) * 8 + c
                if on(r + dir, c) && board[one] == dot {
                    push(one)
                    let two = (r + 2 * dir) * 8 + c
                    if r == home && board[two] == dot { out.append(Move(sq, two)) }
                }
                for dc in [-1, 1] {
                    guard on(r + dir, c + dc) else { continue }
                    let t = (r + dir) * 8 + c + dc
                    if target(t) == 2 || t == ep { push(t) }
                }
                continue
            }
            if kind == "n" || kind == "k" {
                for (dr, dc) in kind == "n" ? knight : all {
                    guard on(r + dr, c + dc) else { continue }
                    let t = (r + dr) * 8 + c + dc
                    if target(t) != 1 { out.append(Move(sq, t)) }
                }
                if kind == "k" {
                    let them = side.other
                    let row = side == .w ? 7 : 0
                    let (kc, qc): (Character, Character) = side == .w ? ("K", "Q") : ("k", "q")
                    let rook = UInt8(ascii: side == .w ? "R" : "r")
                    if sq == row * 8 + 4 && !attacked(board, sq, by: them) {
                        if castling.contains(kc) && board[row * 8 + 5] == dot && board[row * 8 + 6] == dot && board[row * 8 + 7] == rook
                            && !attacked(board, row * 8 + 5, by: them) && !attacked(board, row * 8 + 6, by: them) { out.append(Move(sq, row * 8 + 6)) }
                        if castling.contains(qc) && board[row * 8 + 3] == dot && board[row * 8 + 2] == dot && board[row * 8 + 1] == dot && board[row * 8] == rook
                            && !attacked(board, row * 8 + 3, by: them) && !attacked(board, row * 8 + 2, by: them) { out.append(Move(sq, row * 8 + 2)) }
                    }
                }
                continue
            }
            let dirs = kind == "b" ? diag : kind == "r" ? straight : all
            for (dr, dc) in dirs {
                var rr = r + dr, cc = c + dc
                while on(rr, cc) {
                    let t = rr * 8 + cc
                    let k = target(t)
                    if k == 1 { break }
                    out.append(Move(sq, t))
                    if k == 2 { break }
                    rr += dr
                    cc += dc
                }
            }
        }
        return out
    }

    /// the board after a move (castling moves the rook, taking in passing removes the pawn behind)
    public static func boardAfter(_ board: [UInt8], _ mv: Move, _ ep: Int?) -> [UInt8] {
        var b = board
        let p = b[mv.from]
        let kind = lower(p)
        let side = colorOf(p) ?? .w
        if let pr = mv.promo?.asciiValue { b[mv.to] = side == .w ? upper(pr) : pr } else { b[mv.to] = p }
        b[mv.from] = dot
        if kind == UInt8(ascii: "p") && mv.to == ep && board[mv.to] == dot { b[mv.to + (side == .w ? 8 : -8)] = dot }
        if kind == UInt8(ascii: "k") && abs(mv.to - mv.from) == 2 {
            let row = (mv.from / 8) * 8
            if mv.to % 8 == 6 {
                b[row + 5] = b[row + 7]
                b[row + 7] = dot
            } else {
                b[row + 3] = b[row]
                b[row] = dot
            }
        }
        return b
    }

    /// the moves the side to move can really make
    public static func legalMoves(_ board: [UInt8], _ side: Color, _ castling: String, _ ep: Int?) -> [Move] {
        pseudoMoves(board, side, castling, ep).filter { !inCheck(boardAfter(board, $0, ep), side) }
    }
    public static func legalMoves(_ st: State) -> [Move] { legalMoves(st.board, st.side, st.castling, st.ep) }

    /// nobody can checkmate with what's left
    public static func deadPosition(_ board: [UInt8]) -> Bool {
        var pieces: [(p: UInt8, sq: Int)] = []
        for i in 0..<64 where board[i] != dot && lower(board[i]) != UInt8(ascii: "k") { pieces.append((board[i], i)) }
        if pieces.contains(where: { "pqrPQR".utf8.contains($0.p) }) { return false }
        if pieces.count <= 1 { return true }
        if pieces.allSatisfy({ lower($0.p) == UInt8(ascii: "b") }) {
            func shade(_ sq: Int) -> Int { (sq / 8 + sq % 8) % 2 }
            return pieces.allSatisfy { shade($0.sq) == shade(pieces[0].sq) }
        }
        return false
    }

    public struct Step {
        public var state: State
        public var next: Side?
        public var over: Bool
        public var winner: String?
        public var line: String
    }

    /// Make a move as `seat`. Nil if it isn't theirs to make.
    public static func play(_ st: State, _ seat: Side, _ mv: Move) -> Step? {
        guard st.end == nil, st.color(of: seat) == st.side else { return nil }
        guard let m = legalMoves(st).first(where: { $0 == mv }) else { return nil }
        let p = st.board[m.from]
        let kind = lower(p)
        let isPawn = kind == UInt8(ascii: "p")
        let passing = isPawn && m.to == st.ep && st.board[m.to] == dot
        let took: UInt8? = st.board[m.to] != dot ? st.board[m.to] : passing ? UInt8(ascii: st.side == .w ? "p" : "P") : nil
        let board = boardAfter(st.board, m, st.ep)
        let them = st.side.other
        var castling = st.castling
        func drop(_ chars: String) { for ch in chars { castling = castling.replacingOccurrences(of: String(ch), with: "") } }
        if p == UInt8(ascii: "K") { drop("KQ") }
        if p == UInt8(ascii: "k") { drop("kq") }
        for sq in [m.from, m.to] {
            if sq == 63 { drop("K") }
            if sq == 56 { drop("Q") }
            if sq == 7 { drop("k") }
            if sq == 0 { drop("q") }
        }
        let ep: Int? = isPawn && abs(m.to - m.from) == 16 ? (m.from + m.to) / 2 : nil
        let half = isPawn || took != nil ? 0 : st.half + 1
        let full = st.side == .b ? st.full + 1 : st.full
        let k = key(board, them, castling, ep)
        let seen = isPawn || took != nil || castling != st.castling ? [k] : st.seen + [k]
        let check = inCheck(board, them)
        let replies = legalMoves(board, them, castling, ep)

        var line: String
        if kind == UInt8(ascii: "k") && abs(m.to - m.from) == 2 {
            line = "castled on the \(m.to % 8 == 6 ? "king’s" : "queen’s") side"
        } else if let pr = m.promo {
            line = "\(took.map { "took your \(pieceName($0)) and " } ?? "")made a pawn a \(pieceName(pr.asciiValue!)) on \(squareName(m.to))"
        } else if let t = took {
            line = "took your \(pieceName(t)) on \(squareName(passing ? m.to + (st.side == .w ? 8 : -8) : m.to))\(passing ? " in passing" : "")"
        } else {
            line = "moved a \(pieceName(p)) to \(squareName(m.to))"
        }

        var end: String?
        var winner: String?
        if replies.isEmpty {
            end = check ? "checkmate" : "stalemate"
            winner = check ? seat.rawValue : "draw"
        } else if seen.filter({ $0 == k }).count >= 3 {
            end = "repetition"
            winner = "draw"
        } else if half >= 100 {
            end = "fifty"
            winner = "draw"
        } else if deadPosition(board) {
            end = "material"
            winner = "draw"
        }
        if end == "checkmate" { line += ": checkmate" } else if check { line += " and put you in check" }
        switch end {
        case "stalemate": line += ". It’s stalemate, so a draw"
        case "repetition": line += ". The same position three times: a draw"
        case "fifty": line += ". Fifty moves without a capture: a draw"
        case "material": line += ". Nobody can checkmate now: a draw"
        default: break
        }
        var s = st
        s.board = board
        s.side = them
        s.castling = castling
        s.ep = ep
        s.half = half
        s.full = full
        s.last = (m.from, m.to)
        s.seen = seen
        s.check = check
        s.end = end
        s.offer = nil
        return Step(state: s, next: end != nil ? nil : seat.other, over: end != nil, winner: winner, line: line)
    }

    /// what's been taken from colour `c`, by what's missing from the starting set (queens first)
    public static func captured(_ board: [UInt8], from c: Color) -> [UInt8] {
        let start = Array(startBoard.utf8)
        var out: [UInt8] = []
        for kind in "qrbnp".utf8 {
            let p = c == .w ? upper(kind) : kind
            let have = board.filter { $0 == p }.count
            let was = start.filter { $0 == p }.count
            if have < was { out += Array(repeating: p, count: was - have) }
        }
        return out
    }

    /// a simple sense of who's ahead, for `c`
    public static func evaluate(_ board: [UInt8], _ c: Color) -> Int {
        var v = 0
        for sq in 0..<64 {
            let p = board[sq]
            if p == dot { continue }
            let kind = lower(p)
            let r = sq / 8, col = sq % 8
            var s = value(p)
            if kind == UInt8(ascii: "n") || kind == UInt8(ascii: "b") { s += (7 - max(abs(2 * r - 7), abs(2 * col - 7))) * 4 }
            if kind == UInt8(ascii: "p") { s += (colorOf(p) == .w ? 6 - r : r - 1) * 6 }
            v += colorOf(p) == c ? s : -s
        }
        return v
    }

    /// The demo room's partner (the same thinking as the website's).
    public static func botMove(_ st: State, _ rng: Random) -> Move {
        let moves = legalMoves(st)
        if rng() < 0.08 { return moves[Int(floor(rng() * Double(moves.count)))] }
        let me = st.side, them = me.other
        var best = moves[0]
        var bestV = -Double.infinity
        for mv in moves {
            let board = boardAfter(st.board, mv, st.ep)
            let castling = st.castling
            let ep: Int? = lower(st.board[mv.from]) == UInt8(ascii: "p") && abs(mv.to - mv.from) == 16 ? (mv.from + mv.to) / 2 : nil
            var v = Double(evaluate(board, me))
            let replies = pseudoMoves(board, them, castling, ep)
            var loss = 0
            for r in replies {
                let q = board[r.to]
                if q == dot { continue }
                let after = boardAfter(board, r, ep)
                let gain = value(q) - (attacked(after, r.to, by: me) ? value(board[r.from]) : 0)
                if gain > loss { loss = gain }
            }
            v -= Double(loss)
            if inCheck(board, them) {
                if legalMoves(board, them, castling, ep).isEmpty { v = 100000 } else { v += 15 }
            } else if replies.count <= 6 && legalMoves(board, them, castling, ep).isEmpty {
                v = -500
            }
            v += rng() * 15
            if v > bestV {
                bestV = v
                best = mv
            }
        }
        return best
    }
}
