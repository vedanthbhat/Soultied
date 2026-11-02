import Foundation

/*
 * Tiny software pixel buffer, the same as the website's (src/pixel/buffer.ts). Everything in Soultied's
 * world is drawn into one of these at native pixel resolution, then shown scaled up with no smoothing.
 *
 * It follows the website's arithmetic exactly (JavaScript's rounding, and the way a Uint8ClampedArray
 * rounds and clamps), so a room drawn here matches the website's pixel for pixel.
 */

public struct RGB: Hashable, Sendable {
    public var r: UInt8
    public var g: UInt8
    public var b: UInt8

    public init(_ r: UInt8, _ g: UInt8, _ b: UInt8) {
        self.r = r
        self.g = g
        self.b = b
    }

    /// "#3a2a26"
    public init(_ hex: String) {
        var s = Substring(hex)
        if s.first == "#" { s = s.dropFirst() }
        let v = UInt32(s.prefix(6), radix: 16) ?? 0
        r = UInt8((v >> 16) & 0xFF)
        g = UInt8((v >> 8) & 0xFF)
        b = UInt8(v & 0xFF)
    }

    public var hex: String { String(format: "#%02x%02x%02x", r, g, b) }
}

/// JavaScript's Math.round: halves go up (towards +infinity).
@inline(__always) public func jsRound(_ v: Double) -> Double { (v + 0.5).rounded(.down) }

/// Storing a number into a Uint8ClampedArray: clamped to 0…255, halves to even, NaN to 0.
@inline(__always) func clamp8(_ v: Double) -> UInt8 {
    if !(v > 0) { return 0 }
    if v >= 255 { return 255 }
    return UInt8(v.rounded(.toNearestOrEven))
}

/// `x | 0` in JavaScript, for coordinates that may arrive as fractions.
@inline(__always) public func ti(_ v: Double) -> Int {
    if !v.isFinite { return 0 }
    return Int(v.rounded(.towardZero))
}

/// The website's mix(): a blend of two colours, each channel rounded the JavaScript way.
public func mix(_ a: RGB, _ b: RGB, _ t: Double) -> RGB {
    func ch(_ x: UInt8, _ y: UInt8) -> UInt8 {
        UInt8(clamping: Int(jsRound(Double(x) + (Double(y) - Double(x)) * t)))
    }
    return RGB(ch(a.r, b.r), ch(a.g, b.g), ch(a.b, b.b))
}

/// Map of single-character keys to colours, for ASCII sprites.
public typealias Palette = [Character: RGB]

public class PixelBuffer {
    public let w: Int
    public let h: Int
    /// RGBA, row-major
    public var data: [UInt8]

    public init(_ w: Int, _ h: Int) {
        self.w = w
        self.h = h
        data = [UInt8](repeating: 0, count: w * h * 4)
    }

    public func clear() {
        for i in data.indices { data[i] = 0 }
    }

    @inline(__always)
    public func set(_ x: Int, _ y: Int, _ c: RGB, _ alpha: Double = 255) {
        if x < 0 || y < 0 || x >= w || y >= h { return }
        let i = (y * w + x) * 4
        if alpha >= 255 {
            data[i] = c.r
            data[i + 1] = c.g
            data[i + 2] = c.b
            data[i + 3] = 255
        } else {
            let a = alpha / 255
            data[i] = clamp8(Double(data[i]) * (1 - a) + Double(c.r) * a)
            data[i + 1] = clamp8(Double(data[i + 1]) * (1 - a) + Double(c.g) * a)
            data[i + 2] = clamp8(Double(data[i + 2]) * (1 - a) + Double(c.b) * a)
            data[i + 3] = clamp8(max(Double(data[i + 3]), alpha))
        }
    }

    /// set() with fractional coordinates, truncated the way the website does
    @inline(__always)
    public func set(_ x: Double, _ y: Double, _ c: RGB, _ alpha: Double = 255) {
        set(ti(x), ti(y), c, alpha)
    }

    public func alphaAt(_ x: Int, _ y: Int) -> UInt8 {
        if x < 0 || y < 0 || x >= w || y >= h { return 0 }
        return data[(y * w + x) * 4 + 3]
    }

    public func rect(_ x: Int, _ y: Int, _ rw: Int, _ rh: Int, _ c: RGB, _ alpha: Double = 255) {
        if rw <= 0 || rh <= 0 { return }
        for j in 0..<rh { for i in 0..<rw { set(x + i, y + j, c, alpha) } }
    }

    public func hline(_ x: Int, _ y: Int, _ lw: Int, _ c: RGB) { rect(x, y, lw, 1, c) }
    public func vline(_ x: Int, _ y: Int, _ lh: Int, _ c: RGB) { rect(x, y, 1, lh, c) }

    /// Draw an ASCII sprite. Each character is looked up in the palette; '.', ' ' and unknown keys are see-through.
    public func sprite(_ rows: [String], _ pal: Palette, _ x: Int, _ y: Int, flip: Bool = false) {
        for (j, row) in rows.enumerated() {
            let chars = Array(row)
            for (i, k) in chars.enumerated() {
                if k == "." || k == " " { continue }
                guard let c = pal[k] else { continue }
                let px = flip ? x + chars.count - 1 - i : x + i
                set(px, y + j, c)
            }
        }
    }

    /// Copy another buffer onto this one (alpha-tested).
    public func blit(_ src: PixelBuffer, _ x: Int, _ y: Int, flip: Bool = false) {
        for j in 0..<src.h {
            for i in 0..<src.w {
                let si = (j * src.w + i) * 4
                let a = src.data[si + 3]
                if a == 0 { continue }
                let dx = flip ? x + src.w - 1 - i : x + i
                set(dx, y + j, RGB(src.data[si], src.data[si + 1], src.data[si + 2]), Double(a))
            }
        }
    }

    /// Selective outline: every see-through pixel touching an opaque one becomes a darkened version of that neighbour.
    public func outline(darken: Double = 0.42, tint: (Double, Double, Double) = (40, 22, 30)) {
        var out: [(Int, Int, RGB)] = []
        for y in 0..<h {
            for x in 0..<w {
                if data[(y * w + x) * 4 + 3] != 0 { continue }
                var n = -1
                for (nx, ny) in [(x, y - 1), (x - 1, y), (x + 1, y), (x, y + 1)] {
                    if nx < 0 || ny < 0 || nx >= w || ny >= h { continue }
                    let ni = (ny * w + nx) * 4
                    if data[ni + 3] == 255 {
                        n = ni
                        break
                    }
                }
                if n < 0 { continue }
                func ch(_ v: UInt8, _ t: Double) -> UInt8 {
                    UInt8(clamping: Int(jsRound(Double(v) * darken + t * (1 - darken) * 0.6)))
                }
                out.append((x, y, RGB(ch(data[n], tint.0), ch(data[n + 1], tint.1), ch(data[n + 2], tint.2))))
            }
        }
        for (x, y, c) in out { set(x, y, c) }
    }
}

/// 4x4 Bayer matrix, values 0..1, for ordered dithering.
public let BAYER4: [[Double]] = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
].map { $0.map { ($0 + 0.5) / 16 } }

/// Deterministic hash noise.
@inline(__always) public func hash(_ n: Double) -> Double {
    let s = sin(n * 127.1 + 311.7) * 43758.5453
    return s - s.rounded(.down)
}
