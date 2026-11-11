import Foundation

/*
 * Watch together, from behind the couch (src/pixel/watchRoom.ts and src/pixel/characterBack.ts): the two of
 * you seen from behind, looking at a big TV on the wall. The YouTube player is laid exactly over TV_SCREEN,
 * so nothing here is ever drawn on top of the video. Drawn exactly as the website draws it (the tests check
 * every pixel against the website's).
 */

public let WATCH_W = 320
public let WATCH_H = 180
/// where the TV's picture is, in scene pixels (the player sits exactly here)
public let TV_SCREEN = (x: 80.0, y: 14.0, w: 160.0, h: 90.0)

public enum ReactionKind: String, CaseIterable, Sendable {
    case heart, laugh, wow, cry, star
}

public enum TvState: String, Sendable {
    /// nothing on the TV
    case idle, paused, playing
}

public enum WatchSeatSide: String, Sendable {
    case left, right
}

public struct WatchReaction: Sendable, Equatable {
    public var kind: ReactionKind
    public var seat: WatchSeatSide
    /// when it went up (epoch ms)
    public var t0: Double

    public init(kind: ReactionKind, seat: WatchSeatSide, t0: Double) {
        self.kind = kind
        self.seat = seat
        self.t0 = t0
    }
}

public struct WatchState: Sendable {
    public var left: AvatarConfig?
    public var right: AvatarConfig?
    public var tv: TvState = .idle
    public var reactions: [WatchReaction] = []
    /// karaoke: who's holding a mic
    public var singing: (left: Bool, right: Bool)?

    public init(left: AvatarConfig?, right: AvatarConfig?, tv: TvState = .idle, reactions: [WatchReaction] = []) {
        self.left = left
        self.right = right
        self.tv = tv
        self.reactions = reactions
    }
}

private let SEAT_L = 136.0
private let SEAT_R = 184.0
private let COUCH_TOP = 150.0

private enum WC {
    static let wall = RGB("#4f5f53"), stripe = RGB("#4c5b50"), crown = RGB("#3f2e29")
    static let wains = RGB("#6a4a3a"), wainsL = RGB("#7d5a47"), wainsD = RGB("#523829")
    static let floorA = RGB("#7a5337"), floorB = RGB("#6f4b31"), seam = RGB("#4e3322")
    static let wood = RGB("#6b4633"), woodL = RGB("#845a42"), woodD = RGB("#4d3224")
    static let couch = RGB("#b8674f"), couchL = RGB("#cc7c62"), couchD = RGB("#95513e"), couchDD = RGB("#763f31")
    static let bezel = RGB("#1f1b1d"), bezelL = RGB("#3a3437")
    static let brass = RGB("#b48c4a"), brassL = RGB("#d6ad63")
    static let frame = RGB("#e6d6b8"), frameD = RGB("#bba888")
    static let leaf = RGB("#6f8f4e"), leafL = RGB("#8fae62"), leafD = RGB("#4f6e38")
    static let pot = RGB("#b8674f")
}

private let WWd = Double(WATCH_W), WHd = Double(WATCH_H)

private func drawStatic(_ L: Layer) {
    // wall + wallpaper
    L.R(0, 0, WWd, 120, WC.wall)
    var x = 0.0
    while x < WWd {
        L.R(x, 4, 3, 92, WC.stripe)
        x += 8
    }
    L.R(0, 0, WWd, 4, WC.crown)
    L.HL(0, 3, WWd, RGB("#57403a"))
    // wainscot
    L.R(0, 96, WWd, 24, WC.wains)
    L.HL(0, 96, WWd, WC.wainsL)
    L.HL(0, 97, WWd, WC.wainsD)
    x = 4
    while x < WWd {
        L.R(x, 101, 18, 12, WC.wainsD)
        L.R(x + 1, 102, 16, 10, WC.wains)
        x += 24
    }
    L.R(0, 116, WWd, 4, RGB("#432e22"))
    // floor
    var y = 120.0
    var row = 0.0
    for h in [4.0, 5, 6, 7, 8, 9, 10, 12, 14] {
        if y >= WHd { break }
        let col = row.truncatingRemainder(dividingBy: 2) != 0 ? WC.floorA : WC.floorB
        L.R(0, y, WWd, h, col)
        L.HL(0, y, WWd, WC.seam)
        var fx = (row * 29).truncatingRemainder(dividingBy: 48)
        while fx < WWd {
            L.VL(fx, y, h, WC.seam)
            fx += 48 + row * 6
        }
        y += h
        row += 1
    }
    // rug peeking out under the couch
    let rugBorder = RGB("#7d8b69"), rugDot = RGB("#b8674f"), rugBase = RGB("#e3cfa7")
    var yy = 150.0
    while yy < WHd {
        var rx = 40 - (yy - 150)
        while rx < 280 + (yy - 150) {
            let border = yy < 152 || rx < 43 - (yy - 150) || rx > 276 + (yy - 150)
            L.S(rx, yy, border ? rugBorder : (rx + yy).truncatingRemainder(dividingBy: 9) == 0 ? rugDot : rugBase)
            rx += 1
        }
        yy += 1
    }

    // window with snow (left)
    let wx = 8.0, wy = 20.0, ww = 42.0, wh = 56.0
    L.R(wx - 3, wy - 3, ww + 6, wh + 6, WC.frameD)
    L.R(wx - 2, wy - 2, ww + 4, wh + 4, WC.frame)
    let sky = (RGB("#1b2340"), RGB("#232d52"), RGB("#2e3a64"))
    for j in 0..<Int(wh) {
        for i in 0..<Int(ww) {
            let t = (Double(j) / wh) * 3 + BAYER4[j & 3][i & 3] * 0.9
            L.G(wx + Double(i), wy + Double(j), t < 1 ? sky.0 : t < 2 ? sky.1 : sky.2)
        }
    }
    for i in 0..<Int(ww) {
        let hh = Int(jsRound(5 + sin(Double(i) * 0.2 + 1) * 3))
        for j in 0..<max(0, hh) {
            L.G(wx + Double(i), wy + wh - 1 - Double(j), j == hh - 1 ? RGB("#dfe6f0") : RGB("#3b4668"))
        }
    }
    for k in 0..<10 {
        let kd = Double(k)
        L.G(wx + Double(ti(hash(kd * 5.1) * ww)), wy + Double(ti(hash(kd * 2.3) * wh * 0.5)), RGB("#c9d2ea"))
    }
    L.R(wx + ww / 2 - 1, wy, 2, wh, WC.frame)
    L.R(wx, wy + 26, ww, 2, WC.frame)
    for j in Int(wy)..<Int(wy + wh) {
        L.emit[j * WATCH_W + Int(wx + ww / 2) - 1] = 0
        L.emit[j * WATCH_W + Int(wx + ww / 2)] = 0
    }
    for i in Int(wx)..<Int(wx + ww) {
        L.emit[Int(wy + 26) * WATCH_W + i] = 0
        L.emit[Int(wy + 27) * WATCH_W + i] = 0
    }
    // curtains
    let folds = [RGB("#b8a37f"), RGB("#d8c6a3"), RGB("#e7d8ba"), RGB("#cdb994")]
    for (cx, dir) in [(2.0, 1.0), (56.0, -1.0)] {
        for j in 0..<84 {
            let n = 8 + Int(jsRound(max(0, Double(j) - 40) * 0.06))
            for i in 0..<n {
                let f = (i + (j > 44 ? 1 : 0)) % 4
                L.S(cx + Double(i) * dir, 14 + Double(j), folds[f])
            }
        }
    }
    L.R(0, 13, 64, 2, WC.brass)

    // floor lamp between window and TV
    let lx = 67.0
    L.VL(lx, 58, 62, WC.brass)
    L.R(lx - 4, 118, 9, 2, WC.brass)
    for j in 0..<12 {
        let half = 4 + (Double(j) / 2.5).rounded(.down)
        var i = -half
        while i <= half {
            L.G(lx + i, 46 + Double(j), i == -half || i == half || j == 11 ? RGB("#e8c787") : RGB("#f6e0a8"))
            i += 1
        }
    }

    // TV: bezel, stand shadow, LED
    let s = TV_SCREEN
    L.R(s.x - 5, s.y - 5, s.w + 10, s.h + 10, RGB("#141113"))
    L.R(s.x - 4, s.y - 4, s.w + 8, s.h + 8, WC.bezel)
    L.HL(s.x - 4, s.y - 4, s.w + 8, WC.bezelL)
    L.VL(s.x - 4, s.y - 4, s.h + 8, RGB("#2c2729"))
    L.R(s.x + s.w - 6, s.y + s.h + 1, 2, 1, RGB("#d44b3a"))
    // soundbar under the TV
    L.R(s.x + 40, s.y + s.h + 6, 80, 3, RGB("#262124"))
    L.HL(s.x + 40, s.y + s.h + 6, 80, RGB("#3a3437"))
    x = s.x + 42
    while x < s.x + 118 {
        L.S(x, s.y + s.h + 7, RGB("#1a1618"))
        x += 2
    }

    // media console
    L.R(78, 112, 164, 14, WC.wood)
    L.HL(78, 112, 164, WC.woodL)
    L.R(78, 125, 164, 2, WC.woodD)
    for dx in [0.0, 41, 82, 123] {
        L.R(81 + dx, 115, 37, 9, WC.woodD)
        L.R(82 + dx, 116, 35, 7, WC.wood)
        L.R(98 + dx, 118, 3, 1, WC.brassL)
    }
    // console decor: plant, candle, books, a little framed photo
    L.R(84, 104, 8, 8, WC.pot)
    for (px, py) in [(83.0, 101.0), (86, 99), (89, 100), (91, 102), (85, 103), (88, 97), (92, 99)] {
        L.S(px, py, WC.leaf)
        L.S(px + 1, py, WC.leafL)
        L.S(px, py + 1, WC.leafD)
    }
    L.R(226, 106, 3, 6, RGB("#efe3cb"))
    L.R(230, 108, 3, 4, RGB("#efe3cb"))
    L.R(213, 104, 10, 8, WC.woodD)
    L.R(214, 105, 8, 6, RGB("#e6d6b8"))
    L.R(215, 106, 6, 4, RGB("#c6a489"))

    // bookshelf (right)
    let bx = 262.0
    L.R(bx, 28, 40, 92, WC.woodD)
    L.R(bx + 2, 30, 36, 88, WC.wood)
    let cols = ["#7a5068", "#4f6583", "#d09a3e", "#8a9a72", "#b8674f", "#efe3cb", "#4d6b52"].map { RGB($0) }
    for sh in 0..<4 {
        let sy = 30 + Double(sh) * 22
        L.R(bx + 2, sy + 20, 36, 2, WC.woodL)
        var bxx = bx + 3
        var k = sh * 5
        while bxx < bx + 36 {
            let w = 2 + Double(ti(hash(Double(k) + 3) * 3))
            let h = 11 + Double(ti(hash(Double(k) + 11) * 7))
            if hash(Double(k) * 7) > 0.85 {
                bxx += w + 2
                k += 1
                continue
            }
            let c = cols[k % cols.count]
            L.R(bxx, sy + 20 - h, min(w, bx + 37 - bxx), h, c)
            L.HL(bxx, sy + 22 - h, min(w, bx + 37 - bxx), mix(c, RGB("#ffffff"), 0.25))
            bxx += w
            k += 1
        }
    }
    // edge of the chimney (fire is just off-screen right)
    var y2 = 4.0
    while y2 < 120 {
        var x2: Double = 306 + ((y2 / 4).truncatingRemainder(dividingBy: 2) != 0 ? 0 : 4)
        while x2 < WWd {
            L.R(x2, y2, 7, 3, hash(x2 + y2) > 0.6 ? RGB("#ad6a51") : RGB("#9a5a44"))
            x2 += 8
        }
        y2 += 4
    }
    L.VL(305, 4, 116, RGB("#814736"))
}

private func drawCouchBack(_ L: Layer) {
    // the couch from behind: long rounded back, arms lower at each end
    let x0 = 72.0, x1 = 248.0
    var y = COUCH_TOP
    while y < WHd {
        let inset: Double = y == COUCH_TOP ? 4 : y == COUCH_TOP + 1 ? 2 : y == COUCH_TOP + 2 ? 1 : 0
        var x = x0 + inset
        while x < x1 - inset {
            var c = WC.couch
            let r = y - COUCH_TOP
            if r < 2 { c = WC.couchL } else if r < 5 { c = WC.couch } else if r > 16 { c = WC.couchDD } else { c = r.truncatingRemainder(dividingBy: 7) == 0 ? WC.couchD : WC.couch }
            if x == ((x0 + x1) / 2).rounded(.down) { c = WC.couchD } // seam between cushions
            L.S(x, y, c)
            x += 1
        }
        y += 1
    }
    // arms
    for ax in [x0 - 14, x1 - 2] {
        var ay = COUCH_TOP + 7
        while ay < WHd {
            let r = ay - COUCH_TOP - 7
            var ax2 = ax
            while ax2 < ax + 16 {
                let edge = r == 0 && (ax2 == ax || ax2 == ax + 15)
                if !edge { L.S(ax2, ay, r < 2 ? WC.couchL : r > 12 ? WC.couchDD : WC.couchD) }
                ax2 += 1
            }
            ay += 1
        }
    }
    // blanket draped over the back, just to the right
    for j in 0..<16 {
        for i in 0..<(18 - j / 4) {
            let c = ((j >> 1) + (i >> 2)) % 2 != 0 ? RGB("#8a9a72") : RGB("#6a7856")
            L.S(214 + Double(i) + Double(j / 3), COUCH_TOP - 1 + Double(j), j == 0 ? RGB("#a2b187") : c)
        }
    }
}

private func drawScreenStandby(_ L: Layer, _ t: Double, _ state: TvState) {
    let s = TV_SCREEN
    let hi = RGB("#1c2438"), lo = RGB("#141a2a"), black = RGB("#0b0b10")
    // what shows before a video loads / behind the player while it boots
    for j in 0..<Int(s.h) {
        for i in 0..<Int(s.w) {
            let v = 0.5 + 0.5 * sin(Double(i) * 0.05 + t * 0.6) * cos(Double(j) * 0.07 - t * 0.4)
            let c = state == .idle ? (v + BAYER4[j & 3][i & 3] * 0.4 > 0.8 ? hi : lo) : black
            L.G(s.x + Double(i), s.y + Double(j), c)
        }
    }
    if state == .idle {
        // little pixel "play" glyph in the middle
        let cx = s.x + s.w / 2 - 3
        let cy = s.y + s.h / 2 - 12
        for j in 0..<9 {
            for i in 0...min(j, 8 - j) { L.G(cx + Double(i), cy + Double(j), RGB("#e9d7b7")) }
        }
    }
}

/// the little pictures that pop up when one of you reacts
public let WATCH_ICONS: [ReactionKind: Glyph] = [
    .heart: Glyph([".##.##.", "#######", "#h#####", ".#####.", "..###..", "...#..."], ["#": "#d9534f", "h": "#f3a19c"]),
    .laugh: Glyph([".yyyyy.", "yyyyyyy", "yeyyyey", "yyyyyyy", "yeeeeey", "yyeeeyy", ".yyyyy."], ["y": "#f2c14e", "e": "#5a3a2c"]),
    .wow: Glyph([".yyyyy.", "yyyyyyy", "yeyyyey", "yyyyyyy", "yyyeyyy", "yyyeyyy", ".yyyyy."], ["y": "#f2c14e", "e": "#5a3a2c"]),
    .cry: Glyph([".yyyyy.", "yyyyyyy", "yeyyyey", "byyyyyy", "byyeyyy", "yyeyeyy", ".yyyyy."], ["y": "#f2c14e", "e": "#5a3a2c", "b": "#6fa8dc"]),
    // bravo: a little gold star
    .star: Glyph(["...y...", "..yhy..", "yyyyyyy", ".yyyyy.", "..yyy..", ".yy.yy.", "yy...yy"], ["y": "#f2c14e", "h": "#fbe7a6"]),
]

/// a hand-held microphone, held up beside the singer's head
private let MIC = Glyph([".ggg..", "gGGgg.", "gGggg.", "ggggg.", ".ggg..", "..bb..", "..hH..", "..hH..", "..hH..", "..hH..", "..hH.."], ["g": "#8d96a1", "G": "#e6ebf0", "b": "#d0a85c", "h": "#3d3944", "H": "#67616f"])

private func drawMics(_ L: Layer, _ singing: (left: Bool, right: Bool), _ seatTop: [WatchSeatSide: Double], _ t: Double) {
    for side in [WatchSeatSide.left, .right] {
        if !(side == .left ? singing.left : singing.right) { continue }
        // a little sway with the music
        let sway: Double = sin(t * 2.4 + (side == .left ? 0 : 1.3)) > 0.4 ? 1 : 0
        let x = side == .left ? SEAT_L - 17 : SEAT_R + 11
        let y = min(seatTop[side]! + 6, COUCH_TOP - 12) - sway
        for (j, row) in MIC.rows.enumerated() {
            for (i, k) in row.enumerated() {
                if let c = MIC.pal[k], y + Double(j) < COUCH_TOP { L.S(x + Double(i), y + Double(j), c) }
            }
        }
    }
}

private func drawReactions(_ L: Layer, _ state: WatchState, _ now: Double, _ seatTop: [WatchSeatSide: Double]) {
    for r in state.reactions {
        let age = (now - r.t0) / 1000
        if age < 0 || age > 1.8 { continue }
        guard let icon = WATCH_ICONS[r.kind] else { continue }
        // pop up beside the head (outer side), never up into the TV screen
        let x = (r.seat == .left ? SEAT_L - 24 : SEAT_R + 17) + jsRound(sin(age * 5) * 1.5)
        let y = jsRound(seatTop[r.seat]! + 8 - min(age, 1) * 8)
        let alpha = jsRound(255 * min(1, (1.8 - age) / 0.6))
        for (j, row) in icon.rows.enumerated() {
            for (i, k) in row.enumerated() {
                guard let c = icon.pal[k] else { continue }
                L.G(x + Double(i), y + Double(j), c, alpha)
            }
        }
    }
}

/* ---------- lighting ---------- */

private struct WatchLight {
    let x: Double, y: Double, r: Double
    let c: (Double, Double, Double)
}

private let WATCH_LIGHTS = [
    WatchLight(x: 160, y: 60, r: 240, c: (0.62, 0.72, 0.98)), // TV
    WatchLight(x: 345, y: 120, r: 175, c: (1.08, 0.7, 0.42)), // fire, off-screen right
    WatchLight(x: 67, y: 52, r: 62, c: (0.95, 0.78, 0.52)), // lamp
    WatchLight(x: SEAT_L, y: 118, r: 52, c: (1.2, 0.92, 0.72)), // karaoke: a warm light on whoever's singing
    WatchLight(x: SEAT_R, y: 118, r: 52, c: (1.2, 0.92, 0.72)),
]

/// JavaScript's Math.hypot for two numbers (scaled by the larger, Kahan-summed)
@inline(__always) private func jsHypot(_ a: Double, _ b: Double) -> Double {
    let x = abs(a), y = abs(b)
    let m = max(x, y)
    if m == 0 { return 0 }
    let nx = x / m, ny = y / m
    let s1 = nx * nx
    let comp = (s1 - 0) - s1
    let summand = ny * ny - comp
    let sum = s1 + summand
    return sum.squareRoot() * m
}

/// how far each pixel is from each light (32-bit floats, as the website keeps them)
private let WATCH_DIST: [[Float]] = WATCH_LIGHTS.map { l in
    var a = [Float](repeating: 0, count: WATCH_W * WATCH_H)
    for y in 0..<WATCH_H {
        for x in 0..<WATCH_W { a[y * WATCH_W + x] = Float(jsHypot(Double(x) - l.x, (Double(y) - l.y) * 1.2)) }
    }
    return a
}

private func light(_ L: Layer, _ t: Double, _ tv: TvState, _ singing: (left: Bool, right: Bool)?) {
    // the TV's light flickers with "the picture" while it plays
    let tvK = tv == .playing ? 0.62 + 0.18 * hash((t * 3).rounded(.down)) + 0.08 * sin(t * 5) : tv == .paused ? 0.55 : 0.4
    let fireK = 0.85 + sin(t * 7.3) * 0.04 + (hash((t * 12).rounded(.down)) - 0.5) * 0.06
    func spot(_ on: Bool?) -> Double { on == true ? 0.72 + 0.06 * sin(t * 3) : 0 }
    let ks = [tvK, fireK, 0.6, spot(singing?.left), spot(singing?.right)]
    let amb = (0.3, 0.29, 0.42)
    let levels = 5.0
    L.data.withUnsafeMutableBufferPointer { d in
        for y in 0..<WATCH_H {
            for x in 0..<WATCH_W {
                let p = y * WATCH_W + x
                if L.emit[p] != 0 { continue }
                var tot = 0.0, tr = 0.0, tg = 0.0, tb = 0.0
                for i in 0..<WATCH_LIGHTS.count {
                    if ks[i] <= 0 { continue }
                    var v = 1 - Double(WATCH_DIST[i][p]) / WATCH_LIGHTS[i].r
                    if v <= 0 { continue }
                    v = pow(v, 1.4) * ks[i]
                    tot += v
                    tr += WATCH_LIGHTS[i].c.0 * v
                    tg += WATCH_LIGHTS[i].c.1 * v
                    tb += WATCH_LIGHTS[i].c.2 * v
                }
                var r = amb.0, g = amb.1, b = amb.2
                if tot > 0 {
                    let th = (BAYER4[y & 3][x & 3] - 0.5) * 0.24
                    let q = (tot * levels + 0.5 + th).rounded(.down) / levels
                    r += (tr / tot) * q
                    g += (tg / tot) * q
                    b += (tb / tot) * q
                }
                let o = p * 4
                d[o] = clamp8(min(255, Double(d[o]) * r))
                d[o + 1] = clamp8(min(255, Double(d[o + 1]) * g))
                d[o + 2] = clamp8(min(255, Double(d[o + 2]) * b))
            }
        }
    }
}

/// Draws the watch room; keep one per screen (it reuses its buffers between frames).
public final class WatchRenderer {
    private static let stillLayer: Layer = {
        let L = Layer(WATCH_W, WATCH_H)
        drawStatic(L)
        return L
    }()

    private let frame = Layer(WATCH_W, WATCH_H)
    private var rim: [(Int, Int)] = []

    public init() {}

    /// the scene at `t` seconds in; `now` (epoch ms) places the reactions
    public func render(_ state: WatchState, _ t: Double, now: Double) -> PixelBuffer {
        let L = frame
        L.copyFrom(Self.stillLayer)
        drawScreenStandby(L, t, state.tv)

        // snow in the window
        for k in 0..<18 {
            let kd = Double(k)
            let sy = ti((hash(kd * 3.7) * 56 + t * (5 + hash(kd) * 5)).truncatingRemainder(dividingBy: 56))
            let sx = ti(8 + (hash(kd * 1.3) * 42 + sin(t + kd) * 2 + 42).truncatingRemainder(dividingBy: 42))
            if sx == 28 || sx == 29 || (sy >= 26 && sy <= 27) { continue }
            L.G(Double(sx), 20 + Double(sy), RGB("#e8eef6"))
        }
        // candle flicker on the console
        let f: Double = sin(t * 11) > 0.3 ? 1 : 0
        L.G(227, 104 - f, RGB("#ffd36b"))
        L.G(231, 106 - f, RGB("#ffd36b"))

        // the two of you, from behind
        let both = state.left != nil && state.right != nil
        var seatTop: [WatchSeatSide: Double] = [.left: 120, .right: 120]
        rim.removeAll(keepingCapacity: true)
        func draw(_ avatar: AvatarConfig?, _ cx: Double, _ side: WatchSeatSide, _ phase: Double) {
            guard let avatar else {
                // a plumped cushion saving the spot
                for j in 0..<9 {
                    for i in -8...8 {
                        if (j == 0 || j == 8) && abs(i) > 6 { continue }
                        L.S(cx + Double(i), COUCH_TOP - 8 + Double(j), j < 2 ? RGB("#f6ecd8") : j > 6 ? RGB("#c9b894") : RGB("#eadcc0"))
                    }
                }
                seatTop[side] = COUCH_TOP - 8
                return
            }
            let lean: Double = both ? (side == .left ? 1 : -1) : 0
            let bob: Double = sin(t * 1.4 + phase) > 0.7 ? 1 : 0
            let back = renderCharacterBack(avatar, lean: lean, bob: bob)
            let x = cx - back.anchor.x
            let y = COUCH_TOP + 9 - back.anchor.y
            L.blit(back.buf, Int(x), Int(y))
            seatTop[side] = y + back.headTop
            // remember the top edge so the TV can rim-light it after the room is lit
            let buf = back.buf
            for i in 0..<buf.w {
                for j in 0..<buf.h where buf.alphaAt(i, j) > 0 {
                    rim.append((Int(x) + i, Int(y) + j))
                    rim.append((Int(x) + i, Int(y) + j + 1))
                    if buf.alphaAt(i - 1, j + 2) == 0 || buf.alphaAt(i + 1, j + 2) == 0 { rim.append((Int(x) + i, Int(y) + j + 2)) }
                    break
                }
            }
        }
        draw(state.left, SEAT_L, .left, 0)
        draw(state.right, SEAT_R, .right, 1.9)
        drawCouchBack(L)
        if let s = state.singing { drawMics(L, s, seatTop, t) }

        light(L, t, state.tv, state.singing)
        rimLight(L, state.tv, t)
        drawReactions(L, state, now, seatTop)
        return L
    }

    /// cool glow from the screen catching the tops of heads and shoulders
    private func rimLight(_ L: Layer, _ tv: TvState, _ t: Double) {
        let k = tv == .playing ? 0.55 + 0.2 * hash((t * 3).rounded(.down)) : tv == .paused ? 0.5 : 0.35
        for (x, y) in rim {
            if x < 0 || y < 0 || x >= WATCH_W || Double(y) >= COUCH_TOP { continue }
            let o = (y * WATCH_W + x) * 4
            L.data[o] = clamp8(min(255, Double(L.data[o]) + 70 * k))
            L.data[o + 1] = clamp8(min(255, Double(L.data[o + 1]) + 85 * k))
            L.data[o + 2] = clamp8(min(255, Double(L.data[o + 2]) + 115 * k))
        }
        rim.removeAll(keepingCapacity: true)
    }
}

/* ---------- a character seen from behind (src/pixel/characterBack.ts) ---------- */

public let BACK_W = 56
public let BACK_H = 56

/// head and shoulders from behind, a little bigger than the room's sprites (they're close to the camera)
public func renderCharacterBack(_ cfg: AvatarConfig, lean: Double = 0, bob: Double = 0) -> (buf: PixelBuffer, anchor: (x: Double, y: Double), headTop: Double) {
    let b = Layer(BACK_W, BACK_H)
    let BW = Double(BACK_W), BH = Double(BACK_H)
    let skin = Wardrobe.find(Wardrobe.skinTones, cfg.skin)
    let hair: Swatch = cfg.hairStyle == "hijab"
        ? (Wardrobe.clothColors.first { $0.id == cfg.hairColor } ?? Wardrobe.clothColors[1])
        : Wardrobe.find(Wardrobe.hairColors, cfg.hairColor)
    let top = Wardrobe.find(Wardrobe.clothColors, cfg.topColor)
    let cx = BW / 2
    let hOff: Double = cfg.height == "tall" ? -2 : cfg.height == "short" ? 2 : 0

    // --- shoulders / back ---
    let shTop = 35 + hOff + bob
    var y = shTop
    while y < BH {
        let r = y - shTop
        let half = min(21, 11 + r * 2)
        var x = cx - half
        while x < cx + half {
            let edge = x == cx - half || x == cx + half - 1
            var c = top.base
            if r == 0 || (r == 1 && abs(x - cx) > half - 4) { c = top.light } else if edge { c = top.shadow } else if x > cx + 3 { c = mix(top.base, top.shadow, 0.35) }
            b.S(x, y, c)
            x += 1
        }
        y += 1
    }
    // garment details on the back
    if cfg.top == "hoodie" {
        for yy in 0..<8 {
            let half = 8 - Double(yy / 2)
            var x = cx - half
            while x < cx + half {
                b.S(x, shTop + 1 + Double(yy), yy == 0 ? top.light : mix(top.base, top.shadow, 0.5))
                x += 1
            }
        }
    } else if cfg.top == "turtleneck" {
        b.R(cx - 5, shTop - 3, 10, 4, top.base)
        b.HL(cx - 5, shTop - 3, 10, top.light)
    } else if cfg.top == "shirt" || cfg.top == "kurta" {
        b.R(cx - 5, shTop - 1, 10, 2, top.light)
        b.VL(cx, shTop + 2, BH - shTop - 2, top.shadow)
    } else if cfg.top == "cardigan" {
        b.R(cx - 4, shTop - 1, 8, 1, RGB("#efe3cb"))
    }

    // --- neck ---
    let headCy = 22 + hOff + bob
    b.R(cx - 4 + lean, headCy + 9, 8, shTop - (headCy + 9) + 1, skin.shadow)

    // --- head ---
    let hx = cx + lean
    let big = cfg.hairStyle == "afro"
    let rx: Double = big ? 16 : cfg.hairStyle == "curls" ? 14 : 12
    let ry: Double = big ? 15 : cfg.hairStyle == "curls" ? 13.5 : 12.5
    func inHead(_ x: Double, _ y: Double, _ rX: Double = rx, _ rY: Double = ry) -> Bool {
        let a = (x + 0.5 - hx) / rX, c = (y + 0.5 - headCy) / rY
        return a * a + c * c <= 1
    }

    let style = cfg.hairStyle
    let skinHead = style == "bald" || style == "buzz"
    // ears (visible on short styles)
    if ["bald", "buzz", "crop", "tousled", "curls"].contains(style) && cfg.hat != "beanie" {
        b.R(hx - rx - 1, headCy - 1, 3, 5, skin.shadow)
        b.R(hx + rx - 2, headCy - 1, 3, 5, skin.shadow)
        if cfg.extra == "hoops" {
            b.S(hx - rx - 1, headCy + 3, RGB("#e2b555"))
            b.S(hx + rx, headCy + 3, RGB("#e2b555"))
        }
    }
    var hy = (headCy - ry - 1).rounded(.down)
    while hy <= headCy + ry + 1 {
        var hxx = (hx - rx - 1).rounded(.down)
        while hxx <= hx + rx + 1 {
            defer { hxx += 1 }
            if !inHead(hxx, hy) { continue }
            let top1 = !inHead(hxx, hy - 1)
            let rightSide = hxx > hx + rx * 0.35
            if skinHead {
                var c = rightSide ? skin.shadow : skin.base
                if top1 { c = skin.light }
                if style == "buzz" && (hxx + hy).truncatingRemainder(dividingBy: 2) == 0 && hy < headCy + 4 { c = mix(c, hair.base, 0.55) }
                b.S(hxx, hy, c)
            } else {
                var c = hair.base
                if top1 { c = hair.light } else if rightSide { c = hair.shadow } // rim light from the TV
                // strand texture
                if !top1 && (hxx * 3 + hy).truncatingRemainder(dividingBy: 7) == 0 { c = rightSide ? hair.base : hair.shadow }
                if (style == "curls" || big) && (hxx + hy * 2).truncatingRemainder(dividingBy: 4) == 0 { c = hair.light }
                b.S(hxx, hy, c)
            }
        }
        hy += 1
    }
    // nape: short styles show a bit of neck skin at the hairline
    if style == "crop" || style == "tousled" {
        b.R(hx - 4, headCy + ry - 3, 8, 3, skin.shadow)
        b.S(hx - 4, headCy + ry - 3, hair.base)
        b.S(hx + 3, headCy + ry - 3, hair.base)
    }
    // tousled tufts on top
    if style == "tousled" {
        for dx in [-7.0, -3, 1, 5, 8] {
            b.S(hx + dx, headCy - ry - 1, hair.light)
            b.S(hx + dx + 1, headCy - ry - 2 + (dx.truncatingRemainder(dividingBy: 2) != 0 ? 1 : 0), hair.base)
        }
    }
    // bob: straight cut below the jaw
    if style == "bob" {
        b.R(hx - rx, headCy + 2, rx * 2, 9, hair.base)
        b.HL(hx - rx, headCy + 10, rx * 2, hair.shadow)
        b.VL(hx + rx - 1, headCy + 2, 9, hair.shadow)
    }
    // long waves falling over the back
    if style == "long" {
        var ly = headCy + 2
        while ly < min(BH, shTop + 12) {
            let wave = jsRound(sin(ly * 0.6) * 1)
            let half: Double = 10 + (ly > shTop ? 1 : 0)
            var x = hx - half + wave
            while x < hx + half + wave {
                let c = x > hx + 3 ? hair.shadow : (x + ly).truncatingRemainder(dividingBy: 6) == 0 ? hair.light : hair.base
                b.S(x, ly, c)
                x += 1
            }
            ly += 1
        }
        b.HL(hx - 9, min(BH, shTop + 12) - 1, 18, hair.shadow)
    }
    // bun on top
    if style == "bun" {
        for yy in -5...4 {
            for xx in -5...4 {
                let a = Double(xx) + 0.5, c = Double(yy) + 0.5
                if a * a + c * c <= 22 {
                    b.S(hx + Double(xx), headCy - ry - 3 + Double(yy), yy < -2 ? hair.light : xx > 1 ? hair.shadow : hair.base)
                }
            }
        }
        b.HL(hx - 3, headCy - ry + 1, 6, hair.shadow)
    }
    // braid down the back
    if style == "braid" {
        var by = headCy + 6
        var i = 0
        while by < BH - 1 {
            b.R(hx - 3 + Double(i % 2), by, 5, 2, i % 2 != 0 ? hair.base : hair.light)
            b.S(hx + 1 + Double(i % 2), by + 1, hair.shadow)
            by += 2
            i += 1
        }
        b.R(hx - 1, BH - 3, 3, 2, RGB("#c4453f")) // tie
    }
    // pigtails: a bunch either side, tied with red
    if style == "pigtails" {
        for side in [-1.0, 1.0] {
            let bx = hx + side * (rx + 2)
            for yy in -4...5 {
                for xx in -3...3 {
                    let a = Double(xx) / 3.2, c = Double(yy) / 5.5
                    if a * a + c * c <= 1 {
                        b.S(bx + Double(xx), headCy + 4 + Double(yy), Double(xx) * side > 1 ? hair.shadow : yy < -2 ? hair.light : hair.base)
                    }
                }
            }
            b.R(bx - 1 - (side > 0 ? 1 : 0), headCy - 1, 3, 2, RGB("#c4453f"))
        }
    }
    // hijab drapes over the shoulders
    if style == "hijab" {
        var jy = headCy
        while jy < shTop + 7 {
            let t = (jy - headCy) / (shTop + 7 - headCy)
            let half = jsRound(12 + t * 9)
            var x = hx - half
            while x < hx + half {
                var c = hair.base
                if x > hx + half - 4 { c = hair.shadow }
                if (x - hx + 40).truncatingRemainder(dividingBy: 5) == 0 && jy > headCy + 4 { c = hair.shadow }
                b.S(x, jy, c)
                x += 1
            }
            jy += 1
        }
    }

    // --- accessories ---
    if cfg.hat == "beanie" {
        let sw = Wardrobe.clothColors.first { $0.id == (cfg.topColor == "mustard" ? "terracotta" : "mustard") }!
        var by = (headCy - ry - 2).rounded(.down)
        while by < headCy - 1 {
            var bxx = hx - rx - 1
            while bxx <= hx + rx {
                if inHead(bxx, by, rx + 1, ry + 1) {
                    b.S(bxx, by, by > headCy - 4 ? sw.shadow : (bxx + by).truncatingRemainder(dividingBy: 3) == 0 ? sw.light : sw.base)
                }
                bxx += 1
            }
            by += 1
        }
        b.R(hx - 2, headCy - ry - 5, 4, 3, sw.light)
    } else if cfg.hat == "cap" {
        let first = (headCy - ry - 1).rounded(.down)
        var cy = first
        while cy < headCy - 2 {
            var cxx = hx - rx
            while cxx <= hx + rx {
                if inHead(cxx, cy, rx + 0.5, ry + 0.5) { b.S(cxx, cy, cy == first ? top.light : top.base) }
                cxx += 1
            }
            cy += 1
        }
        b.R(hx - 4, headCy - 3, 8, 3, hair.shadow) // strap gap
        b.HL(hx - 4, headCy - 3, 8, top.shadow)
    } else if cfg.hat == "clip" {
        b.R(hx + 5, headCy - 6, 4, 2, RGB("#d9a441"))
    } else if cfg.hat == "party" {
        // a striped cone, and its pompom
        let top0 = (headCy - ry).rounded(.down) - 11
        for r in 0..<12 {
            let half = 1 + Double(r / 2)
            var x = hx - half
            while x < hx + half {
                let k = ((x - hx + Double(r) + 40) / 2).rounded(.down)
                b.S(x, top0 + Double(r), k.truncatingRemainder(dividingBy: 2) == 0 ? RGB("#c4453f") : RGB("#f3e7cf"))
                x += 1
            }
        }
        b.R(hx - 2, top0 - 3, 4, 3, RGB("#e2b359"))
        b.S(hx - 1, top0 - 3, RGB("#f6d77a"))
    } else if cfg.hat == "crown" {
        let y0 = (headCy - ry).rounded(.down) - 1
        b.R(hx - 8, y0, 16, 3, RGB("#e2b359"))
        b.HL(hx - 8, y0 + 2, 16, RGB("#b0842f"))
        for dx in [-8.0, -2, 4] {
            b.R(hx + dx, y0 - 3, 3, 3, RGB("#e2b359"))
            b.S(hx + dx + 1, y0 - 4, RGB("#f6d77a"))
        }
        b.R(hx - 1, y0 + 1, 2, 1, RGB("#c4453f"))
    } else if cfg.hat == "bunny" {
        let y0 = (headCy - ry).rounded(.down)
        for dx in [-7.0, 3] {
            b.R(hx + dx, y0 - 9, 4, 10, RGB("#f3ece0"))
            b.R(hx + dx + 1, y0 - 8, 2, 7, RGB("#e8a9b0"))
        }
        var px = hx - rx
        while px <= hx + rx {
            let q = (px - hx) / rx
            let py = jsRound(headCy - max(0, 1 - q * q).squareRoot() * ry)
            b.S(px, py, RGB("#d98c8c"))
            b.S(px, py + 1, RGB("#d98c8c"))
            px += 1
        }
    } else if cfg.hat == "propeller" {
        var py = (headCy - ry - 1).rounded(.down)
        while py < headCy - 3 {
            var px = hx - rx
            while px <= hx + rx {
                if inHead(px, py, rx + 0.5, ry + 0.5) {
                    b.S(px, py, px < hx - 1 ? RGB("#c4453f") : px < hx + 1 ? RGB("#e2b359") : RGB("#4f6fa8"))
                }
                px += 1
            }
            py += 1
        }
        let y0 = (headCy - ry).rounded(.down) - 4
        b.R(hx - 1, y0, 2, 3, RGB("#e2b359"))
        b.R(hx - 9, y0 - 1, 8, 2, RGB("#c4453f"))
        b.R(hx + 1, y0 - 1, 8, 2, RGB("#4f6fa8"))
    } else if cfg.hat == "flowers" {
        let cols = [RGB("#e8a9b0"), RGB("#f0c860"), RGB("#fbf5e9"), RGB("#e07a5f")]
        var i = 0
        var px = hx - rx + 1
        while px <= hx + rx - 1 {
            let q = (px - hx) / rx
            let py = jsRound(headCy - max(0, 1 - q * q).squareRoot() * ry) + 1
            b.S(px + 1, py + 1, RGB("#6a8f5a"))
            b.R(px, py - 1, 2, 2, cols[i % cols.count])
            px += 3
            i += 1
        }
    } else if cfg.hat == "frog" {
        var py = (headCy - ry - 1).rounded(.down)
        while py < headCy - 2 {
            var px = hx - rx - 1
            while px <= hx + rx + 1 {
                if inHead(px, py, rx + 1.5, ry + 1) {
                    b.S(px, py, py > headCy - 5 ? RGB("#8bbf68") : px > hx + 4 ? RGB("#4a7236") : RGB("#6a9a4f"))
                }
                px += 1
            }
            py += 1
        }
        let y0 = (headCy - ry).rounded(.down) - 4
        for dx in [-8.0, 3] {
            b.R(hx + dx, y0, 5, 4, RGB("#6a9a4f"))
            b.HL(hx + dx, y0, 5, RGB("#8bbf68"))
        }
    }
    if cfg.extra == "headphones" {
        var px = hx - rx
        while px <= hx + rx {
            let q = (px - hx) / rx
            let py = jsRound(headCy - max(0, 1 - q * q).squareRoot() * ry) - 1
            b.S(px, py, RGB("#3b3437"))
            px += 1
        }
        b.R(hx - rx - 2, headCy - 2, 4, 7, RGB("#5a5155"))
        b.R(hx + rx - 2, headCy - 2, 4, 7, RGB("#5a5155"))
    }
    if cfg.extra == "scarf" {
        b.R(cx - 9, shTop - 1, 18, 4, RGB("#a84f4b"))
        b.HL(cx - 9, shTop - 1, 18, RGB("#c4625b"))
        b.R(cx + 4, shTop + 3, 4, 7, RGB("#7f3835"))
    }

    b.outline(darken: 0.35)
    return (b, (cx, BH - 1), (headCy - ry).rounded(.down))
}
