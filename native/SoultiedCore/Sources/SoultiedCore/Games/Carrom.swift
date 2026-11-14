import Foundation

/*
 * Carrom for two (src/games/carrom.ts), a shot at a time: slide your striker along your baseline, pull back,
 * and flick. Sink one of yours (or the red queen) and you go again. Sink the striker and one of yours comes back
 * to the middle. Sink the queen and then one of yours (the same go or your next) to cover her, or she goes back.
 * Nobody can sink their last coin before the queen's been covered: it comes back. First to sink all nine wins.
 *
 * The board is 100 × 100; the first seat shoots from the bottom baseline, the second from the top; whoever starts
 * plays white. Coins are two flat lists of numbers (x, then y, -1 once sunk): 0 the queen, 1–9 white, 10–18 black.
 * The physics is the website's, step for step, in the same order, so a shot plays out the same on both.
 */
public enum Carrom {
    public static let board = 100.0
    public static let rCoin = 2.15
    public static let rStriker = 2.75
    public static let mCoin = 1.0
    public static let mStriker = 2.0
    public static let pocketR = 3.3
    public static let pockets: [(Double, Double)] = [(2.4, 2.4), (97.6, 2.4), (2.4, 97.6), (97.6, 97.6)]
    public static func baseline(_ s: Side) -> Double { s == .a ? 86.2 : 13.8 }
    public static let baseMin = 19.0
    public static let baseMax = 81.0
    public static let friction = 55.0
    public static let dt = 1.0 / 240
    public static let maxSteps = 240 * 14
    public static let wallE = 0.72
    public static let coinE = 0.9
    public static let minSpeed = 60.0
    public static let maxSpeed = 330.0
    public static let coins = 19

    /// "q" the queen, "w" white, "b" black
    public static func kind(_ i: Int) -> Character { i == 0 ? "q" : i <= 9 ? "w" : "b" }

    static func round3(_ v: Double) -> Double { jsRound(v * 1000) / 1000 }
    static let sq3 = 0.8660254037844386

    public struct Shot: Equatable, Sendable {
        public var by: Side
        public var x: Double
        public var dx: Double
        public var dy: Double
        public var power: Double
        public var xs: [Double]
        public var ys: [Double]
        public var doc: Doc { ["by": by.rawValue, "x": x, "dx": dx, "dy": dy, "power": power, "xs": xs, "ys": ys] }
    }

    public struct State: Equatable, Sendable {
        public var xs: [Double]
        public var ys: [Double]
        /// who plays white (and went first)
        public var white: Side
        /// "board", "pending-a" / "pending-b" (sunk, waiting to be covered), or "a" / "b" (covered)
        public var queen: String
        public var shot: Shot?
        /// the coins the last shot sank
        public var sunk: [Int]?
        public var foul: Bool
        public var shots: Int

        public init(white: Side) {
            let c = Carrom.startCoins()
            xs = c.xs
            ys = c.ys
            self.white = white
            queen = "board"
            foul = false
            shots = 0
        }

        public init(_ d: Doc) {
            func nums(_ v: Any?) -> [Double] { (v as? [Any] ?? []).compactMap { Values.num($0) } }
            let x = nums(d["xs"]), y = nums(d["ys"])
            if x.count == coins && y.count == coins {
                xs = x
                ys = y
            } else {
                let c = Carrom.startCoins()
                xs = c.xs
                ys = c.ys
            }
            white = Side(rawValue: d.str("white") ?? "") ?? .a
            queen = d.str("queen") ?? "board"
            let s = d.map("shot")
            if let by = s.str("by").flatMap({ Side(rawValue: $0) }), let sx = s.num("x"), let dx = s.num("dx"), let dy = s.num("dy"), let p = s.num("power") {
                shot = Shot(by: by, x: sx, dx: dx, dy: dy, power: p, xs: nums(s["xs"]), ys: nums(s["ys"]))
            }
            sunk = (d["sunk"] as? [Any]).map { $0.compactMap { Values.num($0).map { Int($0) } } }
            foul = d.bool("foul")
            shots = d.int("shots") ?? 0
        }

        public var doc: Doc {
            ["xs": xs, "ys": ys, "white": white.rawValue, "queen": queen, "shot": shot?.doc as Any? ?? NSNull(), "sunk": sunk as Any? ?? NSNull(),
             "foul": foul, "shots": shots]
        }

        public func kind(of seat: Side) -> Character { white == seat ? "w" : "b" }
        public func on(_ i: Int) -> Bool { xs[i] >= 0 }
        public func sunkCount(_ seat: Side) -> Int {
            let k = kind(of: seat)
            return (1..<coins).filter { Carrom.kind($0) == k && !on($0) }.count
        }
    }

    /// the starting cluster: the queen in the middle, six round her, twelve round them
    public static func startCoins() -> (xs: [Double], ys: [Double]) {
        let g = rCoin * 2 + 0.06
        let inner: [(Double, Double)] = [(1, 0), (0.5, sq3), (-0.5, sq3), (-1, 0), (-0.5, -sq3), (0.5, -sq3)]
        let outer: [(Double, Double)] = [(2, 0), (1.5, sq3), (1, 2 * sq3), (0, 2 * sq3), (-1, 2 * sq3), (-1.5, sq3), (-2, 0), (-1.5, -sq3), (-1, -2 * sq3), (0, -2 * sq3), (1, -2 * sq3), (1.5, -sq3)]
        var white: [(Double, Double)] = [], black: [(Double, Double)] = []
        for (i, p) in inner.enumerated() { if i % 2 == 1 { black.append(p) } else { white.append(p) } }
        for (i, p) in outer.enumerated() { if i % 2 == 1 { black.append(p) } else { white.append(p) } }
        let spots = [(0.0, 0.0)] + white + black
        return (spots.map { round3(50 + $0.0 * g) }, spots.map { round3(50 + $0.1 * g) })
    }

    /// whether the striker can sit at x on this seat's baseline (not on a coin)
    public static func strikerFits(_ xs: [Double], _ ys: [Double], _ seat: Side, _ x: Double) -> Bool {
        if x < baseMin || x > baseMax { return false }
        let y = baseline(seat)
        for i in 0..<coins where xs[i] >= 0 {
            let dx = xs[i] - x, dy = ys[i] - y
            if dx * dx + dy * dy < (rCoin + rStriker) * (rCoin + rStriker) { return false }
        }
        return true
    }

    /// whether a flick goes the right way (away from your own side)
    public static func forward(_ seat: Side, _ dy: Double) -> Bool { seat == .a ? dy < -0.05 : dy > 0.05 }

    public struct Sim {
        public var xs: [Double]
        public var ys: [Double]
        public var sunk: [Int]
        public var striker: Bool
        /// every few steps, where everything was (striker first; x, y pairs, -1 once sunk)
        public var frames: [[Double]]
        public var steps: Int
    }

    /// Play a shot out (the website's simulate, step for step).
    public static func simulate(_ xs0: [Double], _ ys0: [Double], _ seat: Side, _ x: Double, _ dx: Double, _ dy: Double, _ power: Double, every: Int = 0) -> Sim {
        let n = coins + 1
        var px = [x] + xs0
        var py = [baseline(seat)] + ys0
        var vx = [Double](repeating: 0, count: n)
        var vy = [Double](repeating: 0, count: n)
        var on = [true] + xs0.map { $0 >= 0 }
        let r = [rStriker] + xs0.map { _ in rCoin }
        let m = [mStriker] + xs0.map { _ in mCoin }
        let speed = minSpeed + (maxSpeed - minSpeed) * min(1, max(0, power))
        vx[0] = dx * speed
        vy[0] = dy * speed
        var sunk: [Int] = []
        var striker = false
        var frames: [[Double]] = []
        let dec = friction * dt
        var steps = 0
        while steps < maxSteps {
            var moving = false
            for i in 0..<n where on[i] {
                let s2 = vx[i] * vx[i] + vy[i] * vy[i]
                if s2 == 0 { continue }
                let s = s2.squareRoot()
                if s <= dec {
                    vx[i] = 0
                    vy[i] = 0
                    continue
                }
                moving = true
                let f = (s - dec) / s
                vx[i] = vx[i] * f
                vy[i] = vy[i] * f
                px[i] = px[i] + vx[i] * dt
                py[i] = py[i] + vy[i] * dt
                if px[i] < r[i] {
                    px[i] = r[i]
                    vx[i] = -vx[i] * wallE
                } else if px[i] > board - r[i] {
                    px[i] = board - r[i]
                    vx[i] = -vx[i] * wallE
                }
                if py[i] < r[i] {
                    py[i] = r[i]
                    vy[i] = -vy[i] * wallE
                } else if py[i] > board - r[i] {
                    py[i] = board - r[i]
                    vy[i] = -vy[i] * wallE
                }
            }
            if !moving { break }
            for i in 0..<n where on[i] {
                for (qx, qy) in pockets {
                    let ex = px[i] - qx, ey = py[i] - qy
                    if ex * ex + ey * ey < pocketR * pocketR {
                        on[i] = false
                        vx[i] = 0
                        vy[i] = 0
                        if i == 0 { striker = true } else { sunk.append(i - 1) }
                        break
                    }
                }
            }
            for i in 0..<n where on[i] {
                for j in (i + 1)..<n where on[j] {
                    let ex = px[j] - px[i], ey = py[j] - py[i]
                    let d2 = ex * ex + ey * ey
                    let rr = r[i] + r[j]
                    if d2 >= rr * rr || d2 == 0 { continue }
                    let d = d2.squareRoot()
                    let nx = ex / d, ny = ey / d
                    let over = rr - d
                    let mt = m[i] + m[j]
                    px[i] = px[i] - nx * over * (m[j] / mt)
                    py[i] = py[i] - ny * over * (m[j] / mt)
                    px[j] = px[j] + nx * over * (m[i] / mt)
                    py[j] = py[j] + ny * over * (m[i] / mt)
                    let rel = (vx[i] - vx[j]) * nx + (vy[i] - vy[j]) * ny
                    if rel <= 0 { continue }
                    let k = ((1 + coinE) * rel) / (1 / m[i] + 1 / m[j])
                    vx[i] = vx[i] - (k * nx) / m[i]
                    vy[i] = vy[i] - (k * ny) / m[i]
                    vx[j] = vx[j] + (k * nx) / m[j]
                    vy[j] = vy[j] + (k * ny) / m[j]
                }
            }
            if every > 0 && steps % every == 0 {
                var fr: [Double] = []
                fr.reserveCapacity(n * 2)
                for i in 0..<n { fr.append(on[i] ? px[i] : -1); fr.append(on[i] ? py[i] : -1) }
                frames.append(fr)
            }
            steps += 1
        }
        return Sim(xs: (1..<n).map { on[$0] ? round3(px[$0]) : -1 }, ys: (1..<n).map { on[$0] ? round3(py[$0]) : -1 }, sunk: sunk, striker: striker, frames: frames, steps: steps)
    }

    /// the nearest free spot to the middle, for a coin that comes back
    public static func freeSpot(_ xs: [Double], _ ys: [Double]) -> (Double, Double) {
        let h = 0.7071067811865476
        let dirs: [(Double, Double)] = [(0, 0), (1, 0), (0, 1), (-1, 0), (0, -1), (h, h), (-h, h), (-h, -h), (h, -h)]
        for ring in 0..<12 {
            for (ux, uy) in dirs {
                if ring == 0 && (ux != 0 || uy != 0) { continue }
                if ring > 0 && ux == 0 && uy == 0 { continue }
                let x = round3(50 + ux * Double(ring) * (rCoin * 2 + 0.2))
                let y = round3(50 + uy * Double(ring) * (rCoin * 2 + 0.2))
                var free = true
                for i in 0..<xs.count where xs[i] >= 0 {
                    let ex = xs[i] - x, ey = ys[i] - y
                    if ex * ex + ey * ey < rCoin * 2 * (rCoin * 2) {
                        free = false
                        break
                    }
                }
                if free { return (x, y) }
            }
        }
        return (50, 50)
    }

    public struct Step {
        public var state: State
        public var next: Side?
        public var over: Bool
        public var winner: Side?
        public var line: String
    }

    static let words = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]

    /// Take a shot as `seat`, and work out what it means.
    public static func shoot(_ st: State, _ seat: Side, x: Double, dx: Double, dy: Double, power: Double) -> Step? {
        guard strikerFits(st.xs, st.ys, seat, x), forward(seat, dy) else { return nil }
        let len = (dx * dx + dy * dy).squareRoot()
        guard len > 0.99 && len < 1.01, power >= 0 && power <= 1 else { return nil }
        let sim = simulate(st.xs, st.ys, seat, x, dx, dy, power)
        var xs = sim.xs, ys = sim.ys
        let mine = st.kind(of: seat)
        let them = seat.other
        let minesSunk = sim.sunk.filter { kind($0) == mine }
        let theirsSunk = sim.sunk.filter { kind($0) != mine && kind($0) != "q" }
        let queenSunk = sim.sunk.contains(0)
        func back(_ i: Int) {
            let (fx, fy) = freeSpot(xs, ys)
            xs[i] = fx
            ys[i] = fy
        }
        var parts: [String] = []
        var queen = st.queen
        var again = false
        let foul = sim.striker
        let pendingMe = "pending-\(seat.rawValue)"
        func yours(_ n: Int) -> String { "sank \(n > 1 ? "\(words[n]) of yours" : "one of yours")" }
        if foul {
            for i in minesSunk + (queenSunk ? [0] : []) { back(i) }
            var fine = -1
            for i in 1..<coins where kind(i) == mine && xs[i] < 0 && !sim.sunk.contains(i) { fine = i }
            if fine >= 0 { back(fine) }
            if queen == pendingMe {
                queen = "board"
                if xs[0] < 0 { back(0) }
            }
            parts.append(fine >= 0 || !minesSunk.isEmpty ? "sank the striker, so a coin of theirs came back" : "sank the striker")
            if !theirsSunk.isEmpty { parts.append(yours(theirsSunk.count)) }
        } else {
            if !minesSunk.isEmpty { parts.append("sank \(minesSunk.count < words.count ? words[minesSunk.count] : String(minesSunk.count)) of their own") }
            if !theirsSunk.isEmpty { parts.append(yours(theirsSunk.count)) }
            if queenSunk {
                if !minesSunk.isEmpty {
                    queen = seat.rawValue
                    parts.append("sank the queen and covered her")
                } else {
                    queen = pendingMe
                    parts.append("sank the queen")
                }
                again = true
            } else if st.queen == pendingMe {
                if !minesSunk.isEmpty {
                    queen = seat.rawValue
                    parts.append("covered the queen")
                } else {
                    queen = "board"
                    back(0)
                    parts.append("couldn’t cover the queen, so she went back")
                }
            }
            if !minesSunk.isEmpty { again = true }
        }
        if parts.isEmpty { parts.append("took a shot") }
        let covered = queen == "a" || queen == "b"
        func left(_ k: Character) -> Int { (1..<coins).filter { kind($0) == k && xs[$0] >= 0 }.count }
        let theirKind: Character = mine == "w" ? "b" : "w"
        for k in [mine, theirKind] where left(k) == 0 && !covered {
            if let last = sim.sunk.reversed().first(where: { kind($0) == k }) {
                back(last)
                parts.append(k == mine ? "their last coin came back (the queen comes first)" : "your last coin came back (the queen comes first)")
                if k == mine { again = false }
            }
        }
        if queen == pendingMe && !(again && !foul) {
            queen = "board"
            if xs[0] < 0 { back(0) }
        }
        var winner: Side?
        if left(mine) == 0 { winner = seat } else if left(theirKind) == 0 { winner = them }
        var line = parts.count > 1 ? "\(parts.dropLast().joined(separator: ", ")) and \(parts.last!)" : parts[0]
        if let w = winner { line += w == seat ? ", and that’s all of theirs: they win" : ", and that’s all of yours: you win" }
        var s = st
        s.xs = xs
        s.ys = ys
        s.queen = queen
        s.shot = Shot(by: seat, x: x, dx: dx, dy: dy, power: power, xs: st.xs, ys: st.ys)
        s.sunk = sim.sunk.isEmpty ? nil : sim.sunk
        s.foul = foul
        s.shots = st.shots + 1
        return Step(state: s, next: winner != nil ? nil : again && !foul ? seat : them, over: winner != nil, winner: winner, line: line)
    }

    /// a flick that sends the striker at (tx, ty) from x on this seat's baseline
    public static func aimAt(_ seat: Side, _ x: Double, _ tx: Double, _ ty: Double) -> (Double, Double) {
        let ex = tx - x, ey = ty - baseline(seat)
        let d = (ex * ex + ey * ey).squareRoot()
        return d > 0 ? (ex / d, ey / d) : (0, seat == .a ? -1 : 1)
    }

    /// The demo room's partner (the website's botShot).
    public static func botShot(_ st: State, _ bot: Side, _ rng: Random) -> (x: Double, dx: Double, dy: Double, power: Double) {
        let mine = st.kind(of: bot)
        var tries: [(x: Double, dx: Double, dy: Double, power: Double)] = []
        let spots: [Double] = [26, 34, 42, 50, 58, 66, 74]
        let left = (1..<coins).filter { kind($0) == mine && st.xs[$0] >= 0 }.count
        for i in 0..<coins where st.xs[i] >= 0 && (i == 0 || kind(i) == mine) {
            for (qx, qy) in pockets {
                let ex = qx - st.xs[i], ey = qy - st.ys[i]
                let d = (ex * ex + ey * ey).squareRoot()
                let tx = st.xs[i] - (ex / d) * (rCoin + rStriker)
                let ty = st.ys[i] - (ey / d) * (rCoin + rStriker)
                for x in spots where strikerFits(st.xs, st.ys, bot, x) {
                    let (dx, dy) = aimAt(bot, x, tx, ty)
                    guard forward(bot, dy), (dx * ex + dy * ey) / d >= 0.55 else { continue }
                    tries.append((x, dx, dy, min(1, 0.35 + d / 160)))
                }
            }
        }
        if tries.isEmpty {
            let x = spots.first { strikerFits(st.xs, st.ys, bot, $0) } ?? 50
            let (dx, dy) = aimAt(bot, x, 50, 50)
            return (x, dx, dy, 0.7)
        }
        var best = tries[0]
        var bestV = -Double.infinity
        for _ in 0..<min(6, tries.count) {
            let t = tries[Int(floor(rng() * Double(tries.count)))]
            let sim = simulate(st.xs, st.ys, bot, t.x, t.dx, t.dy, t.power)
            var v = 0.0
            for i in sim.sunk { v += kind(i) == mine ? 10 : i == 0 ? (left <= 2 ? 14 : 6) : -6 }
            if sim.striker { v -= 15 }
            v += rng() * 3
            if v > bestV {
                bestV = v
                best = t
            }
        }
        let e = (rng() - 0.5) * 0.05
        var dx = best.dx - best.dy * e
        var dy = best.dy + best.dx * e
        let d = (dx * dx + dy * dy).squareRoot()
        dx = dx / d
        dy = dy / d
        if !forward(bot, dy) { return best }
        return (best.x, dx, dy, best.power)
    }
}
