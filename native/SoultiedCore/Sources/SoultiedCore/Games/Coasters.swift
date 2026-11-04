import Foundation

/*
 * Coasters (src/games/coasters.ts): air hockey on the coffee table, with two drink coasters for mallets and a
 * bottle cap for a puck. First to 7.
 *
 * The table is w × h (portrait). Whoever made the place ("a") defends the bottom goal and the other ("b") the
 * top one; each screen turns the table round so your own goal is always at the bottom. Each of you only says
 * where you want your coaster to be; the host moves both coasters there (at most malletSpeed), runs the puck
 * and keeps score, with the same arithmetic as the website's so either can host.
 */

public struct Coasters: LiveRules {
    public static let w: Double = 100
    public static let h: Double = 160
    public static let mid: Double = h / 2
    public static let puckR: Double = 4
    public static let malletR: Double = 8
    /// the goal mouths, at both ends
    public static let goalX0: Double = 33
    public static let goalX1: Double = 67
    public static let toWin = 7
    /// units a second
    public static let malletSpeed: Double = 330
    static let maxPuck: Double = 240
    /// how lively the puck is off the coasters and the rails
    static let hitE: Double = 0.92
    static let railE: Double = 0.9
    /// the table's drag: the puck keeps this much of its speed after a second
    static let glideKeep: Double = 0.72
    /// after a goal, the puck waits this long in the half of whoever let it in
    public static let serveMs: Double = 1100
    static let stepS: Double = 0.004

    public struct Body: Equatable, Sendable {
        public var x: Double
        public var y: Double
        public var vx: Double
        public var vy: Double
        public init(x: Double, y: Double, vx: Double = 0, vy: Double = 0) {
            self.x = x
            self.y = y
            self.vx = vx
            self.vy = vy
        }
        init(_ raw: Any?) {
            let d = (raw as? Doc) ?? [:]
            x = d.num("x") ?? 0
            y = d.num("y") ?? 0
            vx = d.num("vx") ?? 0
            vy = d.num("vy") ?? 0
        }
        var doc: Doc { ["x": x, "y": y, "vx": vx, "vy": vy] }
    }

    public struct Coaster: Equatable, Sendable {
        public var x: Double
        public var y: Double
        public var vx: Double
        public var vy: Double
        /// where its owner wants it
        public var tx: Double
        public var ty: Double
        init(_ raw: Any?) {
            let d = (raw as? Doc) ?? [:]
            x = d.num("x") ?? 0
            y = d.num("y") ?? 0
            vx = d.num("vx") ?? 0
            vy = d.num("vy") ?? 0
            tx = d.num("tx") ?? x
            ty = d.num("ty") ?? y
        }
        init(x: Double, y: Double) {
            self.x = x
            self.y = y
            vx = 0
            vy = 0
            tx = x
            ty = y
        }
        var doc: Doc { ["x": x, "y": y, "vx": vx, "vy": vy, "tx": tx, "ty": ty] }
    }

    public struct State: LiveValue {
        public var puck: Body
        public var mal: [Side: Coaster]
        public var score: [Side: Int]
        /// the puck stays put until then (the start, and after each goal)
        public var serveAt: Double
        /// the host's time when this state was worked out (the other screen moves the puck on from here)
        public var t: Double
        /// goes up with every touch of a coaster (for the sound)
        public var hits: Int
        public var lastGoal: Side?
        public var winner: Side?

        public init?(_ d: Doc) {
            guard let t = d.num("t") else { return nil }
            puck = Body(d["puck"])
            let m = d.map("mal")
            mal = [.a: Coaster(m["a"]), .b: Coaster(m["b"])]
            let s = d.map("score")
            score = [.a: s.int("a") ?? 0, .b: s.int("b") ?? 0]
            serveAt = d.num("serveAt") ?? 0
            self.t = t
            hits = d.int("hits") ?? 0
            lastGoal = d.str("lastGoal").flatMap { Side(rawValue: $0) }
            winner = d.str("winner").flatMap { Side(rawValue: $0) }
        }

        init(puck: Body, now: Double) {
            self.puck = puck
            mal = [.a: Coasters.home(.a), .b: Coasters.home(.b)]
            score = [.a: 0, .b: 0]
            serveAt = now + Play.countdownMs
            t = now
            hits = 0
        }

        public var doc: Doc {
            ["puck": puck.doc, "mal": ["a": mal[.a]!.doc, "b": mal[.b]!.doc], "score": ["a": score[.a] ?? 0, "b": score[.b] ?? 0], "serveAt": serveAt, "t": t, "hits": hits,
             "lastGoal": lastGoal?.rawValue as Any? ?? NSNull(), "winner": winner?.rawValue as Any? ?? NSNull()]
        }
    }

    public struct Act: LiveValue {
        /// where I want my coaster, on the table (not my screen's turned-round view of it)
        public var x: Double
        public var y: Double
        public init(x: Double, y: Double) {
            self.x = x
            self.y = y
        }
        public init?(_ d: Doc) {
            guard let x = d.num("x"), let y = d.num("y"), x.isFinite, y.isFinite else { return nil }
            self.x = x
            self.y = y
        }
        public var doc: Doc { ["x": x, "y": y] }
    }

    public init() {}

    static func clamp(_ v: Double, _ lo: Double, _ hi: Double) -> Double { v < lo ? lo : v > hi ? hi : v }
    static func r2(_ v: Double) -> Double { jsRound(v * 100) / 100 }

    /// the part of the table each of you can reach: your own half
    public static func reach(_ seat: Side, _ x: Double, _ y: Double) -> (x: Double, y: Double) {
        let top = seat == .a ? mid + malletR : malletR
        let bottom = seat == .a ? h - malletR : mid - malletR
        return (clamp(x, malletR, w - malletR), clamp(y, top, bottom))
    }

    static func home(_ seat: Side) -> Coaster { Coaster(x: w / 2, y: seat == .a ? h - 22 : 22) }
    /// the puck, waiting in the half of whoever's to serve
    static func served(_ to: Side) -> Body { Body(x: w / 2, y: to == .a ? mid + 24 : mid - 24) }

    static func hit(_ p: inout Body, _ m: Coaster) -> Bool {
        let dx = p.x - m.x, dy = p.y - m.y
        let d = (dx * dx + dy * dy).squareRoot()
        let min = puckR + malletR
        if d >= min { return false }
        let nx = d > 1e-4 ? dx / d : 0
        let ny = d > 1e-4 ? dy / d : m.y > mid ? -1 : 1
        p.x = m.x + nx * min
        p.y = m.y + ny * min
        let rv = (p.vx - m.vx) * nx + (p.vy - m.vy) * ny
        if rv < 0 {
            p.vx -= (1 + hitE) * rv * nx
            p.vy -= (1 + hitE) * rv * ny
        }
        return true
    }

    /// moves everything on by `dt` seconds; who scored, if anyone did
    static func step(_ puck: inout Body, _ mal: inout [Side: Coaster], _ dt: Double, _ puckLive: Bool) -> (touches: Int, goal: Side?) {
        var touches = 0
        var goal: Side?
        let n = max(1, Int((dt / stepS).rounded(.up)))
        let hh = dt / Double(n)
        var i = 0
        while i < n && goal == nil {
            i += 1
            for seat in [Side.a, .b] {
                var m = mal[seat]!
                let dx = m.tx - m.x, dy = m.ty - m.y
                let d = (dx * dx + dy * dy).squareRoot()
                let most = malletSpeed * hh
                let k = d > most ? most / d : 1
                m.vx = (dx * k) / hh
                m.vy = (dy * k) / hh
                m.x += dx * k
                m.y += dy * k
                mal[seat] = m
            }
            if !puckLive { continue }
            puck.x += puck.vx * hh
            puck.y += puck.vy * hh
            let drag = pow(glideKeep, hh)
            puck.vx *= drag
            puck.vy *= drag
            if hit(&puck, mal[.a]!) { touches += 1 }
            if hit(&puck, mal[.b]!) { touches += 1 }
            let sp = (puck.vx * puck.vx + puck.vy * puck.vy).squareRoot()
            if sp > maxPuck {
                puck.vx *= maxPuck / sp
                puck.vy *= maxPuck / sp
            }
            // the side rails
            if puck.x < puckR {
                puck.x = puckR
                puck.vx = abs(puck.vx) * railE
            } else if puck.x > w - puckR {
                puck.x = w - puckR
                puck.vx = -abs(puck.vx) * railE
            }
            // the ends: a rail, except for the goal mouth
            let mouth = puck.x > goalX0 + 1 && puck.x < goalX1 - 1
            if puck.y < puckR && !mouth {
                puck.y = puckR
                puck.vy = abs(puck.vy) * railE
            } else if puck.y > h - puckR && !mouth {
                puck.y = h - puckR
                puck.vy = -abs(puck.vy) * railE
            }
            if puck.y < -puckR { goal = .a } else if puck.y > h + puckR { goal = .b }
        }
        return (touches, goal)
    }

    /// where the puck will look to be `dt` seconds after a state (for drawing between updates): it slides on,
    /// bouncing off the rails, but never into a goal
    public static func glide(_ p: Body, _ dt: Double) -> Body {
        var q = p
        var far = Coaster(x: -99, y: -99)
        far.tx = -99
        far.ty = -99
        var mal: [Side: Coaster] = [.a: far, .b: far]
        _ = step(&q, &mal, max(0, min(0.15, dt)), true)
        q.y = clamp(q.y, -puckR, h + puckR)
        return q
    }

    /// a coaster moved from where it was towards where it's going, as far as it could have got in `dt`
    public static func towards(_ x: Double, _ y: Double, _ tx: Double, _ ty: Double, _ dt: Double) -> (x: Double, y: Double) {
        let dx = tx - x, dy = ty - y
        let d = (dx * dx + dy * dy).squareRoot()
        let most = malletSpeed * max(0, min(0.2, dt))
        let k = d > most ? most / d : 1
        return (x + dx * k, y + dy * k)
    }

    public func initial(_ rng: @escaping Random, now: Double) -> State { State(puck: Self.served(rng() < 0.5 ? .a : .b), now: now) }

    public func act(_ s: State, _ seat: Side, _ a: Act, now: Double) -> State? {
        if s.winner != nil { return nil }
        let r = Self.reach(seat, a.x, a.y)
        var m = s.mal[seat]!
        if m.tx == r.x && m.ty == r.y { return nil }
        m.tx = r.x
        m.ty = r.y
        var n = s
        n.mal[seat] = m
        return n
    }

    public func tick(_ s: State, now: Double) -> State? {
        if s.winner != nil { return nil }
        let dt = max(0, min(0.05, (now - s.t) / 1000))
        var puck = s.puck
        var mal = s.mal
        let (touches, goal) = Self.step(&puck, &mal, dt, now >= s.serveAt)
        func round(_ c: Coaster) -> Coaster {
            var r = c
            r.x = Self.r2(c.x)
            r.y = Self.r2(c.y)
            r.vx = Self.r2(c.vx)
            r.vy = Self.r2(c.vy)
            return r
        }
        var n = s
        n.t = now
        n.hits = s.hits + touches
        n.mal = [.a: round(mal[.a]!), .b: round(mal[.b]!)]
        n.puck = Body(x: Self.r2(puck.x), y: Self.r2(puck.y), vx: Self.r2(puck.vx), vy: Self.r2(puck.vy))
        guard let goal else { return n }
        n.score[goal, default: 0] += 1
        n.lastGoal = goal
        n.puck = Self.served(goal.other)
        n.serveAt = now + Self.serveMs
        n.winner = (n.score[goal] ?? 0) >= Self.toWin ? goal : nil
        return n
    }

    public func result(_ s: State) -> LiveResult? {
        guard let w = s.winner else { return nil }
        return LiveResult(winner: w.rawValue, line: "won \(s.score[w] ?? 0)–\(s.score[w.other] ?? 0)", score: s.score)
    }

    /// the demo room's partner: guards its goal, and goes for the puck when it's on their side
    public func bot(_ s: State, _ seat: Side, now: Double) -> Act? {
        if s.winner != nil || now < s.serveAt - 300 { return nil }
        let p = Self.glide(s.puck, 0.08)
        let mine = seat == .a ? p.y > Self.mid : p.y < Self.mid
        let back: Double = seat == .a ? 1 : -1
        let jitter = (sin(now / 370) + sin(now / 910)) * 3
        if mine { return Act(x: p.x + jitter * 0.6, y: p.y + back * (Self.puckR + 2)) }
        let homeY = seat == .a ? Self.h - 20 : 20
        return Act(x: Self.w / 2 + (p.x - Self.w / 2) * 0.55 + jitter, y: homeY)
    }

    public var botMs: Double { 90 }
    public var tickMs: Double { 16 }
    public var continuous: Bool { true }
    public func phase(_ s: State) -> String { "\(s.score[.a] ?? 0)-\(s.score[.b] ?? 0)\(s.winner != nil ? "!" : "")" }
}
