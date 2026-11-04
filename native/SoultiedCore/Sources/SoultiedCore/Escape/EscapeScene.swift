import Foundation

/*
 * The escape rooms' painting kit (src/escape/scene.ts and glyphs.ts): a 200 × 120 pixel scene with a note of
 * which pixels make their own light, the bits of scenery the rooms share, and the banded lighting. Written to
 * follow the website's arithmetic step for step, so each room comes out the same, pixel for pixel.
 */

/// Little 7 × 7 symbols for the locks and clues. '#' is the symbol, '.' is see-through.
public enum EscapeGlyph: String, CaseIterable, Sendable {
    case moon, star, heart, anchor, rose, bird, bat, key, feather, crown, sun, comet, up, down

    public var rows: [String] {
        switch self {
        case .moon: return ["..###..", ".##....", "##.....", "##.....", "##.....", ".##....", "..###.."]
        case .star: return ["...#...", "...#...", "#######", ".#####.", "..###..", ".##.##.", ".#...#."]
        case .heart: return [".......", ".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."]
        case .anchor: return ["...#...", "..#.#..", "...#...", ".#####.", "...#...", "#..#..#", ".#####."]
        case .rose: return [".#.#.#.", "..###..", ".#####.", "..###..", "...#...", ".#.#...", "..###.."]
        case .bird: return [".......", ".......", "##...##", "..#.#..", "...#...", ".......", "......."]
        case .bat: return [".......", "#.....#", "##.#.##", "#######", ".#.#.#.", ".......", "......."]
        case .key: return [".......", ".##....", "#..####", "#..#.#.", ".##..#.", ".......", "......."]
        case .feather: return [".....##", "....###", "...###.", "..###..", ".###...", ".#.....", "#......"]
        case .crown: return [".......", "#..#..#", "##.#.##", "#######", "#######", ".......", "......."]
        case .sun: return ["...#...", ".#...#.", "..###..", "#.###.#", "..###..", ".#...#.", "...#..."]
        case .comet: return ["......#", ".....#.", "..###..", ".####..", "#####..", ".###...", "......."]
        case .up: return ["...#...", "..###..", ".#####.", "...#...", "...#...", "...#...", "...#..."]
        case .down: return ["...#...", "...#...", "...#...", "...#...", ".#####.", "..###..", "...#..."]
        }
    }

    public var name: String { rawValue }
}

public enum EscapeColor: String, CaseIterable, Sendable {
    case red, gold, blue, green, white, violet

    public var hex: String {
        switch self {
        case .red: return "#c4453f"
        case .gold: return "#e2b359"
        case .blue: return "#4f78b8"
        case .green: return "#5f9a5a"
        case .white: return "#efe6d2"
        case .violet: return "#8a5fb0"
        }
    }

    public var dark: String {
        switch self {
        case .red: return "#8f2f2b"
        case .gold: return "#a7772b"
        case .blue: return "#344f7c"
        case .green: return "#3f6a3b"
        case .white: return "#b9ad95"
        case .violet: return "#5e3f7a"
        }
    }

    public var label: String { rawValue.capitalized }

    /// the note it plays (the music box, the candles)
    public var hz: Double {
        switch self {
        case .red: return 523
        case .gold: return 659
        case .blue: return 784
        case .green: return 880
        case .white: return 1047
        case .violet: return 1175
        }
    }
}

/// The website's mix() of two colours written like "#3a2a26", as one.
public func mix(_ a: String, _ b: String, _ t: Double) -> String { mix(RGB(a), RGB(b), t).hex }

let SW = 200
let SH = 120

/// A room's half is painted at 200 × 120 and scaled up (the website's Scene).
public final class EscapeCanvas: PixelBuffer {
    public static let width = SW
    public static let height = SH

    /// pixels that make their own light (the room's darkness doesn't touch them)
    public var emit: [UInt8]
    private var colors: [String: RGB] = [:]

    public init() {
        emit = [UInt8](repeating: 0, count: SW * SH)
        super.init(SW, SH)
    }

    public func reset() {
        clear()
        for i in emit.indices { emit[i] = 0 }
    }

    @inline(__always) func rgb(_ c: String) -> RGB {
        if let v = colors[c] { return v }
        let v = RGB(c)
        colors[c] = v
        return v
    }

    public func set(_ x: Double, _ y: Double, _ c: String, _ alpha: Double = 255) { set(ti(x), ti(y), rgb(c), alpha) }

    /// a pixel that makes its own light
    public func glow(_ x: Double, _ y: Double, _ c: String, _ alpha: Double = 255) {
        set(x, y, c, alpha)
        let xi = ti(x), yi = ti(y)
        if xi >= 0 && yi >= 0 && xi < w && yi < h { emit[yi * w + xi] = 1 }
    }

    public func glowRect(_ x: Double, _ y: Double, _ rw: Double, _ rh: Double, _ c: String) {
        var j = y
        while j < y + rh {
            var i = x
            while i < x + rw {
                glow(i, j, c)
                i += 1
            }
            j += 1
        }
    }

    public func rect(_ x: Double, _ y: Double, _ rw: Double, _ rh: Double, _ c: String, _ alpha: Double = 255) {
        let col = rgb(c)
        var j = 0.0
        while j < rh {
            var i = 0.0
            while i < rw {
                set(ti(x + i), ti(y + j), col, alpha)
                i += 1
            }
            j += 1
        }
    }

    public func hline(_ x: Double, _ y: Double, _ lw: Double, _ c: String) { rect(x, y, lw, 1, c) }
    public func vline(_ x: Double, _ y: Double, _ lh: Double, _ c: String) { rect(x, y, 1, lh, c) }

    /// a solid block with a lit top edge and shaded bottom and right edges
    public func box(_ x: Double, _ y: Double, _ bw: Double, _ bh: Double, _ c: String) {
        rect(x, y, bw, bh, c)
        hline(x, y, bw, mix(c, "#ffffff", 0.18))
        hline(x, y + bh - 1, bw, mix(c, "#000000", 0.35))
        vline(x + bw - 1, y + 1, bh - 1, mix(c, "#000000", 0.25))
    }

    public func frame(_ x: Double, _ y: Double, _ fw: Double, _ fh: Double, _ c: String) {
        hline(x, y, fw, c)
        hline(x, y + fh - 1, fw, c)
        vline(x, y, fh, c)
        vline(x + fw - 1, y, fh, c)
    }

    public func disc(_ cx: Double, _ cy: Double, _ r: Double, _ c: String, _ glows: Bool = false) {
        var y = (cy - r).rounded(.down)
        while y <= cy + r {
            var x = (cx - r).rounded(.down)
            while x <= cx + r {
                let dx = x + 0.5 - cx, dy = y + 0.5 - cy
                if dx * dx + dy * dy <= r * r {
                    if glows { glow(x, y, c) } else { set(x, y, c) }
                }
                x += 1
            }
            y += 1
        }
    }

    public func line(_ x0: Double, _ y0: Double, _ x1: Double, _ y1: Double, _ c: String) {
        let n = max(abs(x1 - x0), abs(y1 - y0), 1)
        var i = 0.0
        while i <= n {
            set(jsRound(x0 + ((x1 - x0) * i) / n), jsRound(y0 + ((y1 - y0) * i) / n), c)
            i += 1
        }
    }

    public func glyph(_ g: EscapeGlyph, _ x: Double, _ y: Double, _ c: String, _ glows: Bool = false) {
        for (j, row) in g.rows.enumerated() {
            for (i, k) in row.enumerated() where k == "#" {
                if glows { glow(x + Double(i), y + Double(j), c) } else { set(x + Double(i), y + Double(j), c) }
            }
        }
    }
}

/* ---------- scenery the rooms share ---------- */

public enum EscapeKit {
    public static func planks(_ s: EscapeCanvas, _ y0: Double, _ a: String, _ b: String, _ seam: String) {
        var y = y0
        var row = 0.0
        let hs: [Double] = [3, 4, 4, 5, 6, 7, 8, 9]
        while y < Double(SH) {
            let h = hs[min(Int(row), hs.count - 1)]
            s.rect(0, y, Double(SW), h, row.truncatingRemainder(dividingBy: 2) != 0 ? a : b)
            s.hline(0, y, Double(SW), seam)
            let span = 34 + row * 7
            var x = (row * 19).truncatingRemainder(dividingBy: span)
            while x < Double(SW) {
                s.vline(x, y, h, seam)
                x += span
            }
            y += h
            row += 1
        }
    }

    public static func stoneWall(_ s: EscapeCanvas, _ x0: Double, _ y0: Double, _ w: Double, _ h: Double, _ a: String, _ b: String, _ mortar: String) {
        s.rect(x0, y0, w, h, mortar)
        var y = y0
        var r = 0.0
        while y < y0 + h {
            var x = x0 - (r.truncatingRemainder(dividingBy: 2) != 0 ? 5 : 0)
            while x < x0 + w {
                let cx = max(x0, x)
                let cw = min(x + 9, x0 + w) - cx
                if cw > 0 {
                    let c = (x * 7 + y * 3).truncatingRemainder(dividingBy: 11) > 6 ? a : b
                    s.rect(cx, y, cw, min(5, y0 + h - y), c)
                    s.hline(cx, y, cw, mix(c, "#ffffff", 0.12))
                }
                x += 10
            }
            y += 6
            r += 1
        }
    }

    public static func candle(_ s: EscapeCanvas, _ x: Double, _ y: Double, _ wax: String, _ lit: Bool, _ t: Double, _ h: Double = 6) {
        s.rect(x, y - h, 3, h, wax)
        s.vline(x + 2, y - h, h, mix(wax, "#000000", 0.25))
        if !lit {
            s.set(x + 1, y - h - 1, "#2a2020")
            return
        }
        let f: Double = sin(t * 9 + x) > 0.2 ? 0 : 1
        s.glow(x + 1, y - h - 1, "#ffd36b")
        s.glow(x + 1, y - h - 2 - f, "#fff2b8")
        s.glow(x + (f != 0 ? 0 : 2), y - h - 2, "#ffb44a")
    }

    public static func clockFace(_ s: EscapeCanvas, _ cx: Double, _ cy: Double, _ r: Double, _ h: Double, _ m: Double, face: String = "#efe3cb", ink: String = "#3a2a26") {
        s.disc(cx, cy, r + 1, "#5a3a2c")
        s.disc(cx, cy, r, face)
        for k in 0..<12 {
            let a = (Double(k) / 12) * Double.pi * 2
            s.set(jsRound(cx + sin(a) * (r - 1)), jsRound(cy - cos(a) * (r - 1)), mix(face, ink, 0.6))
        }
        let ma = (m / 60) * Double.pi * 2
        let ha = ((h.truncatingRemainder(dividingBy: 12) + m / 60) / 12) * Double.pi * 2
        s.line(cx, cy, cx + sin(ma) * (r - 1.5), cy - cos(ma) * (r - 1.5), ink)
        s.line(cx, cy, cx + sin(ha) * (r - 3), cy - cos(ha) * (r - 3), ink)
        s.set(cx, cy, "#a84f4b")
    }

    /* ---------- lighting ---------- */

    public struct Light {
        public var x: Double, y: Double, r: Double
        public var c: (Double, Double, Double)
        public var k: Double = 1
    }

    public static let warm = (1.1, 0.82, 0.55)
    public static let candleLight = (1.15, 0.78, 0.45)
    public static let moonlight = (0.6, 0.72, 1.0)
    public static let ghost = (0.55, 1.0, 0.85)
    public static let magic = (0.85, 0.65, 1.15)

    /// JavaScript's Math.hypot for two numbers (scaled by the larger, Kahan-summed), so the light's edges land
    /// on the same pixels
    @inline(__always) static func jsHypot(_ a: Double, _ b: Double) -> Double {
        let x = abs(a), y = abs(b)
        let m = max(x, y)
        if m == 0 { return 0 }
        // (the two rounds of the summation, written out)
        let nx = x / m, ny = y / m
        let s1 = nx * nx
        let comp = (s1 - 0) - s1
        let summand = ny * ny - comp
        let sum = s1 + summand
        return sum.squareRoot() * m
    }

    /// Darkens everything that doesn't glow, then adds banded light from each source (a few flat steps with a
    /// little dither, like the living room).
    public static func lightScene(_ s: EscapeCanvas, _ lights: [Light], _ ambient: (Double, Double, Double), levels: Double = 5) {
        for y in 0..<SH {
            for x in 0..<SW {
                let p = y * SW + x
                if s.emit[p] != 0 { continue }
                var tot = 0.0, tr = 0.0, tg = 0.0, tb = 0.0
                for l in lights {
                    var v = 1 - jsHypot(Double(x) - l.x, (Double(y) - l.y) * 1.15) / l.r
                    if v <= 0 { continue }
                    v = v * v * l.k
                    tot += v
                    tr += l.c.0 * v
                    tg += l.c.1 * v
                    tb += l.c.2 * v
                }
                var r = ambient.0, g = ambient.1, b = ambient.2
                if tot > 0 {
                    let q = (tot * levels + 0.5 + (BAYER4[y & 3][x & 3] - 0.5) * 0.3).rounded(.down) / levels
                    r += (tr / tot) * q
                    g += (tg / tot) * q
                    b += (tb / tot) * q
                }
                let o = p * 4
                s.data[o] = clamp8(min(255, Double(s.data[o]) * r))
                s.data[o + 1] = clamp8(min(255, Double(s.data[o + 1]) * g))
                s.data[o + 2] = clamp8(min(255, Double(s.data[o + 2]) * b))
            }
        }
    }
}
