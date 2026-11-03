import Foundation

/*
 * The rules of the quick live games, the same as the website's (src/games/tug.ts, rps.ts, quickdraw.ts),
 * so either screen can keep the game. States go over the channel as the website's JSON.
 */

private func seats(_ raw: Any?) -> [Side: Int] {
    let d = (raw as? Doc) ?? [:]
    return [.a: d.int("a") ?? 0, .b: d.int("b") ?? 0]
}

private func seatsDoc(_ s: [Side: Int]) -> Doc { ["a": s[.a] ?? 0, "b": s[.b] ?? 0] }

/* ---------- Tug of War ---------- */

/// Tap as fast as you can. Every tap pulls the ribbon a little towards you; get it all the way over (a lead of
/// `pull` taps) and you win, or whoever's ahead when the twenty seconds are up does.
public struct Tug: LiveRules {
    public static let durationMs: Double = 20000
    public static let pull = 28

    public struct State: LiveValue, Equatable {
        public var taps: [Side: Int]
        /// -1 (all the way to b) … 1 (all the way to a)
        public var pos: Double
        public var endsAt: Double
        public var winner: String?

        public init?(_ d: Doc) {
            guard let e = d.num("endsAt") else { return nil }
            taps = seats(d["taps"])
            pos = d.num("pos") ?? 0
            endsAt = e
            winner = d.str("winner")
        }

        init(endsAt: Double) {
            taps = [.a: 0, .b: 0]
            pos = 0
            self.endsAt = endsAt
        }

        public var doc: Doc { ["taps": seatsDoc(taps), "pos": pos, "endsAt": endsAt, "winner": winner as Any? ?? NSNull()] }
    }

    public struct Act: LiveValue {
        /// how many times you've tapped this game, so a lost message doesn't lose taps
        public var taps: Int
        public init(taps: Int) { self.taps = taps }
        public init?(_ d: Doc) {
            guard let t = d.num("taps") else { return nil }
            taps = Int(t.rounded(.down))
        }
        public var doc: Doc { ["taps": taps] }
    }

    public var rng: Random
    public init(rng: @escaping Random = systemRandom) { self.rng = rng }

    /// nil when nothing changed
    private func settle(_ s: State, _ now: Double) -> State? {
        if s.winner != nil { return nil }
        let a = s.taps[.a] ?? 0, b = s.taps[.b] ?? 0
        let pos = max(-1, min(1, Double(a - b) / Double(Self.pull)))
        var n = s
        n.pos = pos
        if pos >= 1 { n.winner = "a"; return n }
        if pos <= -1 { n.winner = "b"; return n }
        if now >= s.endsAt { n.winner = a == b ? "draw" : a > b ? "a" : "b"; return n }
        return pos == s.pos ? nil : n
    }

    public func initial(_ rng: @escaping Random, now: Double) -> State { State(endsAt: now + Play.countdownMs + Self.durationMs) }

    public func act(_ s: State, _ seat: Side, _ a: Act, now: Double) -> State? {
        if s.winner != nil { return nil }
        let mine = s.taps[seat] ?? 0
        // never more than ~16 taps a second, whatever arrives
        let n = min(a.taps, mine + 40)
        if n <= mine { return nil }
        var next = s
        next.taps[seat] = n
        return settle(next, now) ?? next
    }

    public func tick(_ s: State, now: Double) -> State? { settle(s, now) }

    public func result(_ s: State) -> LiveResult? {
        guard let w = s.winner else { return nil }
        let a = s.taps[.a] ?? 0, b = s.taps[.b] ?? 0
        if w == "draw" { return LiveResult(winner: "draw", line: "tied at \(a) taps each", score: s.taps) }
        let all = abs(s.pos) >= 1
        return LiveResult(winner: w, line: all ? "pulled the ribbon all the way over" : "won Tug of War by \(abs(a - b)) taps", score: s.taps)
    }

    public func bot(_ s: State, _ seat: Side, now: Double) -> Act? { rng() < 0.82 ? Act(taps: (s.taps[seat] ?? 0) + 1) : nil }
    public var botMs: Double { 135 }
    public var tickMs: Double { 80 }
    public var continuous: Bool { true }
    public func phase(_ s: State) -> String { s.winner != nil ? "end" : "play" }
}

/* ---------- Paper, Scissors, Stone ---------- */

/// Each round you've a few seconds to pick, and neither of you sees the other's pick until you've both chosen
/// (or time's up; no pick loses the round). First to three.
public struct Rps: LiveRules {
    public enum Hand: String, CaseIterable, Sendable {
        case stone, paper, scissors
        public var name: String { rawValue.capitalized }
        public var beats: Hand {
            switch self {
            case .paper: return .stone
            case .scissors: return .paper
            case .stone: return .scissors
            }
        }
    }

    public static let hands: [Hand] = [.stone, .paper, .scissors]
    public static let toWin = 3
    public static let pickMs: Double = 5000
    static let showMs: Double = 2600

    public struct State: LiveValue {
        public var round: Int
        public var score: [Side: Int]
        /// "pick" or "show"
        public var phase: String
        /// picks this round; the other person's stays hidden on screen until the reveal
        public var picks: [Side: Hand]
        public var pickUntil: Double
        public var showUntil: Double
        public var last: (hands: [Side: Hand], winner: Side?)?
        public var winner: Side?

        public init?(_ d: Doc) {
            guard let r = d.int("round") else { return nil }
            round = r
            score = seats(d["score"])
            phase = d.str("phase") ?? "pick"
            picks = Self.hands(d["picks"])
            pickUntil = d.num("pickUntil") ?? 0
            showUntil = d.num("showUntil") ?? 0
            if let l = d["last"] as? Doc { last = (Self.hands(l["hands"]), l.str("winner").flatMap { Side(rawValue: $0) }) }
            winner = d.str("winner").flatMap { Side(rawValue: $0) }
        }

        init(now: Double) {
            round = 1
            score = [.a: 0, .b: 0]
            phase = "pick"
            picks = [:]
            pickUntil = now + Play.countdownMs + Rps.pickMs
            showUntil = 0
        }

        static func hands(_ raw: Any?) -> [Side: Hand] {
            var out: [Side: Hand] = [:]
            let d = (raw as? Doc) ?? [:]
            for s in [Side.a, .b] { if let h = d.str(s.rawValue).flatMap({ Hand(rawValue: $0) }) { out[s] = h } }
            return out
        }

        static func handsDoc(_ h: [Side: Hand]) -> Doc {
            var d: Doc = [:]
            for (s, x) in h { d[s.rawValue] = x.rawValue }
            return d
        }

        public var doc: Doc {
            ["round": round, "score": seatsDoc(score), "phase": phase, "picks": Self.handsDoc(picks), "pickUntil": pickUntil, "showUntil": showUntil,
             "last": last.map { ["hands": Self.handsDoc($0.hands), "winner": $0.winner?.rawValue as Any? ?? NSNull()] as Doc } as Any? ?? NSNull(),
             "winner": winner?.rawValue as Any? ?? NSNull()]
        }
    }

    public struct Act: LiveValue {
        public var round: Int
        public var hand: Hand
        public init(round: Int, hand: Hand) {
            self.round = round
            self.hand = hand
        }
        public init?(_ d: Doc) {
            guard let r = d.int("round"), let h = d.str("hand").flatMap({ Hand(rawValue: $0) }) else { return nil }
            round = r
            hand = h
        }
        public var doc: Doc { ["round": round, "hand": hand.rawValue] }
    }

    public var rng: Random
    public init(rng: @escaping Random = systemRandom) { self.rng = rng }

    private func reveal(_ s: State, _ now: Double) -> State {
        let a = s.picks[.a], b = s.picks[.b]
        var w: Side?
        if a != nil && b == nil { w = .a }
        else if b != nil && a == nil { w = .b }
        else if let a, let b, a != b { w = a.beats == b ? .a : .b }
        var n = s
        if let w { n.score[w, default: 0] += 1 }
        n.phase = "show"
        n.showUntil = now + Self.showMs
        n.last = (s.picks, w)
        return n
    }

    public func initial(_ rng: @escaping Random, now: Double) -> State { State(now: now) }

    public func act(_ s: State, _ seat: Side, _ a: Act, now: Double) -> State? {
        if s.winner != nil || s.phase != "pick" || a.round != s.round || s.picks[seat] != nil { return nil }
        var next = s
        next.picks[seat] = a.hand
        return next.picks[seat.other] != nil ? reveal(next, now) : next
    }

    public func tick(_ s: State, now: Double) -> State? {
        if s.winner != nil { return nil }
        if s.phase == "pick" && now >= s.pickUntil { return reveal(s, now) }
        if s.phase == "show" && now >= s.showUntil {
            var n = s
            let a = s.score[.a] ?? 0, b = s.score[.b] ?? 0
            if a >= Self.toWin || b >= Self.toWin {
                n.winner = a > b ? .a : .b
                return n
            }
            n.phase = "pick"
            n.round += 1
            n.picks = [:]
            n.pickUntil = now + Self.pickMs
            return n
        }
        return nil
    }

    public func result(_ s: State) -> LiveResult? {
        guard let w = s.winner else { return nil }
        return LiveResult(winner: w.rawValue, line: "won Paper, Scissors, Stone \(s.score[w] ?? 0)–\(s.score[w.other] ?? 0)", score: s.score)
    }

    public func bot(_ s: State, _ seat: Side, now: Double) -> Act? {
        if s.phase != "pick" || s.picks[seat] != nil { return nil }
        let left = s.pickUntil - now
        guard left < Self.pickMs - 900, rng() < 0.08 else { return nil }
        return Act(round: s.round, hand: Self.hands[floorInt(rng() * 3)])
    }

    public var botMs: Double { 120 }
    public var tickMs: Double { 100 }
}

/* ---------- Quick Draw ---------- */

/// A lantern lights at a random moment; whoever taps first after it lights wins the round. Tap while it's still
/// dark and you lose the round. First to three. Each screen times its own person's reaction from when the
/// lantern lit on that screen, so the line between you doesn't slow anyone down.
public struct QuickDraw: LiveRules {
    public static let toWin = 3
    /// after the lantern lights, how long before the round's called
    static let windowMs: Double = 2600
    static let showMs: Double = 2400

    public enum Tap: Equatable, Sendable {
        case ms(Int)
        case early

        init?(_ raw: Any?) {
            guard let d = raw as? Doc else { return nil }
            if d["early"] != nil { self = .early } else if let m = d.num("ms") { self = .ms(Int(m)) } else { return nil }
        }

        var doc: Doc {
            switch self {
            case .early: return ["early": true]
            case .ms(let m): return ["ms": m]
            }
        }

        public var words: String {
            switch self {
            case .early: return "too soon!"
            case .ms(let m): return "\(m) ms"
            }
        }
    }

    public struct State: LiveValue {
        public var round: Int
        public var score: [Side: Int]
        /// "play" or "show"
        public var phase: String
        /// when the lantern lights (the host's clock)
        public var litAt: Double
        public var taps: [Side: Tap]
        public var showUntil: Double
        /// what happened last round
        public var last: (winner: Side?, taps: [Side: Tap])?
        public var winner: Side?

        public init?(_ d: Doc) {
            guard let r = d.int("round") else { return nil }
            round = r
            score = seats(d["score"])
            phase = d.str("phase") ?? "play"
            litAt = d.num("litAt") ?? 0
            taps = Self.taps(d["taps"])
            showUntil = d.num("showUntil") ?? 0
            if let l = d["last"] as? Doc { last = (l.str("winner").flatMap { Side(rawValue: $0) }, Self.taps(l["taps"])) }
            winner = d.str("winner").flatMap { Side(rawValue: $0) }
        }

        init(litAt: Double) {
            round = 1
            score = [.a: 0, .b: 0]
            phase = "play"
            self.litAt = litAt
            taps = [:]
            showUntil = 0
        }

        static func taps(_ raw: Any?) -> [Side: Tap] {
            var out: [Side: Tap] = [:]
            let d = (raw as? Doc) ?? [:]
            for s in [Side.a, .b] { if let t = Tap(d[s.rawValue]) { out[s] = t } }
            return out
        }

        static func tapsDoc(_ t: [Side: Tap]) -> Doc {
            var d: Doc = [:]
            for (s, x) in t { d[s.rawValue] = x.doc }
            return d
        }

        public var doc: Doc {
            ["round": round, "score": seatsDoc(score), "phase": phase, "litAt": litAt, "taps": Self.tapsDoc(taps), "showUntil": showUntil,
             "last": last.map { ["winner": $0.winner?.rawValue as Any? ?? NSNull(), "taps": Self.tapsDoc($0.taps)] as Doc } as Any? ?? NSNull(),
             "winner": winner?.rawValue as Any? ?? NSNull()]
        }
    }

    public struct Act: LiveValue {
        public var tap: Tap
        public var round: Int
        public init(_ tap: Tap, round: Int) {
            self.tap = tap
            self.round = round
        }
        public init?(_ d: Doc) {
            guard let r = d.int("round") else { return nil }
            round = r
            if d["early"] != nil { tap = .early } else if let m = d.num("ms") { tap = .ms(Int(jsRound(m))) } else { return nil }
        }
        public var doc: Doc {
            var d = tap.doc
            d["round"] = round
            return d
        }
    }

    public var rng: Random
    public init(rng: @escaping Random = systemRandom) { self.rng = rng }

    private func nextLit(_ now: Double) -> Double { now + 1400 + rng() * 2800 }

    private func resolve(_ s: State, _ now: Double) -> State {
        let t = s.taps
        func early(_ x: Tap?) -> Bool { x == .early }
        func ms(_ x: Tap?) -> Double { if case .ms(let m)? = x { return Double(m) } else { return .infinity } }
        var w: Side?
        if early(t[.a]) && !early(t[.b]) { w = .b }
        else if early(t[.b]) && !early(t[.a]) { w = .a }
        else if !early(t[.a]) && !early(t[.b]) {
            let ma = ms(t[.a]), mb = ms(t[.b])
            if ma < mb { w = .a } else if mb < ma { w = .b }
        }
        var n = s
        if let w { n.score[w, default: 0] += 1 }
        n.phase = "show"
        n.showUntil = now + Self.showMs
        n.last = (w, t)
        return n
    }

    public func initial(_ rng: @escaping Random, now: Double) -> State { State(litAt: nextLit(now + Play.countdownMs)) }

    public func act(_ s: State, _ seat: Side, _ a: Act, now: Double) -> State? {
        if s.winner != nil || s.phase != "play" || a.round != s.round || s.taps[seat] != nil { return nil }
        let tap: Tap
        switch a.tap {
        case .early: tap = .early
        case .ms(let m): tap = .ms(max(80, min(5000, m)))
        }
        var next = s
        next.taps[seat] = tap
        // a tap in the dark ends the round straight away; otherwise wait for both (or the window)
        if tap == .early || (next.taps[.a] != nil && next.taps[.b] != nil) { return resolve(next, now) }
        return next
    }

    public func tick(_ s: State, now: Double) -> State? {
        if s.winner != nil { return nil }
        if s.phase == "play" && now > s.litAt + Self.windowMs { return resolve(s, now) }
        if s.phase == "show" && now >= s.showUntil {
            var n = s
            let a = s.score[.a] ?? 0, b = s.score[.b] ?? 0
            if a >= Self.toWin || b >= Self.toWin {
                n.winner = a > b ? .a : .b
                return n
            }
            n.phase = "play"
            n.round += 1
            n.taps = [:]
            n.litAt = nextLit(now)
            return n
        }
        return nil
    }

    public func result(_ s: State) -> LiveResult? {
        guard let w = s.winner else { return nil }
        return LiveResult(winner: w.rawValue, line: "won Quick Draw \(s.score[w] ?? 0)–\(s.score[w.other] ?? 0)", score: s.score)
    }

    public func bot(_ s: State, _ seat: Side, now: Double) -> Act? {
        if s.phase != "play" || s.taps[seat] != nil { return nil }
        // now and then it jumps the gun; otherwise it's quick but beatable
        if now < s.litAt { return now > s.litAt - 300 && rng() < 0.012 ? Act(.early, round: s.round) : nil }
        let react = 255 + ((s.round * 131) % 170)
        return now >= s.litAt + Double(react) ? Act(.ms(react), round: s.round) : nil
    }

    public var botMs: Double { 40 }
    public var tickMs: Double { 60 }
}
