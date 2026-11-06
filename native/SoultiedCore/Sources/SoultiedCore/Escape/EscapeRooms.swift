import Foundation

/*
 * The four rooms' painters (the draw functions in src/escape/rooms), line for line, so each half of each
 * room looks the same on the phone as on the website. EscapeTests checks every room, half and step against the
 * website's painters, pixel for pixel.
 */

/// JavaScript's % on numbers: the remainder takes the sign of the left side
fileprivate func % (l: Double, r: Double) -> Double { l.truncatingRemainder(dividingBy: r) }
fileprivate func upto(_ a: Double, _ b: Double, _ by: Double = 1) -> StrideTo<Double> { stride(from: a, to: b, by: by) }
fileprivate func thru(_ a: Double, _ b: Double) -> StrideThrough<Double> { stride(from: a, through: b, by: 1) }
fileprivate let W = Double(SW)

fileprivate func L(_ x: Double, _ y: Double, _ r: Double, _ c: (Double, Double, Double), _ k: Double = 1) -> EscapeKit.Light { EscapeKit.Light(x: x, y: y, r: r, c: c, k: k) }
fileprivate let warm = EscapeKit.warm, candleLight = EscapeKit.candleLight, moonlight = EscapeKit.moonlight, ghostLight = EscapeKit.ghost, magic = EscapeKit.magic
fileprivate func light(_ s: EscapeCanvas, _ l: [EscapeKit.Light], _ ambient: (Double, Double, Double)) { EscapeKit.lightScene(s, l, ambient) }
fileprivate func candle(_ s: EscapeCanvas, _ x: Double, _ y: Double, _ wax: String, _ lit: Bool, _ t: Double, _ h: Double = 6) { EscapeKit.candle(s, x, y, wax, lit, t, h) }

public enum EscapeRooms {
    /// paints one half of a room as it is after `step` puzzles, `t` seconds in
    public static func draw(_ room: RoomId, _ s: EscapeCanvas, _ side: Side, _ step: Int, _ t: Double) {
        switch (room, side) {
        case (.attic, .a): Attic.eaves(s, step, t)
        case (.attic, .b): Attic.backRoom(s, step, t)
        case (.cellar, .a): Cellar.wine(s, step, t)
        case (.cellar, .b): Cellar.boiler(s, step, t)
        case (.office, .a): Office.desk(s, step, t)
        case (.office, .b): Office.evidence(s, step, t)
        case (.library, .a): Library.hall(s, step, t)
        case (.library, .b): Library.stacks(s, step, t)
        }
    }

    /// a fresh painting of one half
    public static func paint(_ room: RoomId, _ side: Side, _ step: Int, _ t: Double, into canvas: EscapeCanvas? = nil) -> EscapeCanvas {
        let s = canvas ?? EscapeCanvas()
        s.reset()
        draw(room, s, side, step, t)
        return s
    }
}

/* ---------- the old attic ---------- */

private enum Attic {
    static let board = "#5c4a3d", boardD = "#524235", beam = "#3b2d25", beamL = "#4d3a2f", floorA = "#6b4a33", floorB = "#61432e", seam = "#40291c"
    static let wood = "#7a4a2e", woodL = "#96603d", brass = "#c49a4e", paper = "#efe3cb"

    static func roofAndWall(_ s: EscapeCanvas, _ leftSlope: Bool, _ rightSlope: Bool) {
        for y in upto(0, 92) { for x in upto(0, W) { s.set(x, y, floor(x / 9) % 2 != 0 ? board : boardD) } }
        let edge = mix(board, "#000000", 0.3)
        for x in upto(0, W, 9) { s.vline(x, 0, 92, edge) }
        func slope(_ x: Double) -> Double {
            var top = -1.0
            if leftSlope { top = max(top, jsRound(46 - x * 0.62)) }
            if rightSlope { top = max(top, jsRound(46 - (W - x) * 0.62)) }
            return top
        }
        for x in upto(0, W) {
            let top = slope(x)
            var y = 0.0
            while y <= top {
                s.set(x, y, (x + y * 2) % 14 < 2 ? beamL : beam)
                y += 1
            }
            if top >= 0 {
                s.set(x, top + 1, "#2a1f1a")
                s.set(x, top + 2, "#2a1f1a")
            }
        }
        s.rect(0, 88, W, 4, "#3f3026")
        EscapeKit.planks(s, 92, floorA, floorB, seam)
    }

    static func eaves(_ s: EscapeCanvas, _ step: Int, _ t: Double) {
        roofAndWall(s, true, true)

        // round window with the moon
        let wx = 100.0, wy = 28.0
        s.disc(wx, wy, 14, "#3b2d25")
        for y in thru(wy - 12, wy + 12) {
            for x in thru(wx - 12, wx + 12) {
                let dx = x + 0.5 - wx, dy = y + 0.5 - wy
                if dx * dx + dy * dy > 144 { continue }
                s.glow(x, y, y < wy - 4 ? "#1d2544" : y < wy + 4 ? "#243058" : "#2d3a66")
            }
        }
        s.disc(wx + 4, wy - 4, 4, "#f4ecd0", true)
        s.disc(wx + 6, wy - 5, 3, "#243058", true)
        for (sx, sy) in [(wx - 7, wy - 6), (wx - 3, wy + 5), (wx + 7, wy + 6)] { s.glow(sx, sy, "#dfe6f0") }
        s.rect(wx - 12, wy, 25, 1, "#3b2d25")
        s.rect(wx, wy - 12, 1, 25, "#3b2d25")
        for y in thru(wy - 12, wy + 12) { s.emit[Int(y) * SW + Int(wx)] = 0 }
        for x in thru(wx - 12, wx + 12) { s.emit[Int(wy) * SW + Int(x)] = 0 }

        // sea trunk
        let tx = 16.0, ty = 70.0
        if step >= 1 {
            // lid thrown back against the wall
            s.box(tx + 2, ty - 16, 40, 14, wood)
            s.rect(tx + 2, ty - 16, 40, 2, brass)
            s.rect(tx, ty, 44, 22, wood)
            s.rect(tx + 3, ty + 2, 38, 6, "#2b1d16")
            s.rect(tx + 8, ty + 1, 10, 4, paper)
            s.rect(tx + 12, ty + 1, 6, 4, "#b8a488")
            s.rect(tx + 24, ty + 2, 12, 3, "#8a9a72")
        } else {
            s.box(tx, ty - 6, 44, 8, woodL)
            s.box(tx, ty, 44, 22, wood)
            s.rect(tx + 19, ty - 1, 6, 6, brass)
            s.set(tx + 21, ty + 2, "#3b2d25")
        }
        for bx in [tx + 6, tx + 36] { s.rect(bx, ty, 2, 22, brass) }
        s.hline(tx, ty + 21, 44, "#3b2419")

        // dress form
        let dx = 77.0
        s.vline(dx, 72, 20, "#3b2d25")
        s.hline(dx - 5, 91, 11, "#3b2d25")
        for j in upto(0, 30) {
            let half = j < 4 ? 3 + j : j < 14 ? 7 - floor((j - 4) / 3) : 5 + floor((j - 14) / 4)
            for i in thru(-half, half) { s.set(dx + i, 44 + j, i > half - 2 ? "#bfae8e" : "#d9c7a4") }
        }
        for j in upto(6, 20) {
            for i in thru(-8, 8) where abs(i) > 5 - (j - 6) / 4 && (i + j) % 3 != 0 { s.set(dx + i, 44 + j, "#a84f4b") }
        }
        if step >= 2 {
            s.rect(dx - 2, 62, 5, 6, paper)
            s.set(dx, 62, "#a84f4b")
        }

        // side table + music box
        s.box(108, 80, 28, 3, woodL)
        s.vline(110, 83, 9, wood)
        s.vline(133, 83, 9, wood)
        if step >= 4 {
            s.box(112, 66, 20, 4, "#8a5a3a")
            s.box(112, 72, 20, 8, "#8a5a3a")
            let f = floor(t * 3) % 3
            s.glow(116 + f * 4, 62 - f, "#ffe7a3")
            s.glow(124 - f * 2, 60 - ((f + 1) % 3), "#fff4c2")
        } else {
            s.box(112, 70, 20, 10, "#8a5a3a")
            s.hline(112, 73, 20, brass)
        }
        for (i, k) in ["#c4453f", "#e2b359", "#4f78b8", "#5f9a5a", "#efe6d2"].enumerated() { s.rect(113 + Double(i) * 4, 76, 3, 2, k) }

        // photo wall
        let frames: [(Double, Double)] = [(146, 40), (160, 38), (174, 41), (186, 39)]
        for (i, (fx, fy)) in frames.enumerated() {
            s.box(fx, fy, 11, 13, "#3b2d25")
            s.rect(fx + 1, fy + 1, 9, 11, i % 2 != 0 ? "#c8b089" : "#d8c19a")
            s.rect(fx + 3, fy + 4, 2, 4, "#7a5a48")
            s.rect(fx + 6, fy + 5, 2, 4, "#7a5a48")
            if i == 0 || i == 2 { s.set(fx + 9, fy + 2, "#fff4d8") }
        }
        for (i, (fx, fy)) in frames.enumerated() { s.set(fx + 1, fy + 11, i == 0 || i == 2 ? "#a84f4b" : "#3b2d25") }

        // hidden letterbox
        if step >= 4 {
            s.box(156, 74, 26, 15, "#6b4a2e")
            s.rect(158, 76, 22, 11, step >= 5 ? "#2b1d16" : brass)
            if step < 5 {
                for i in 0..<4 { s.rect(160 + Double(i) * 5, 79, 3, 5, "#7a5a30") }
            } else {
                s.rect(162, 80, 12, 5, paper)
            }
            if step < 5 {
                let g = sin(t * 3) > 0 ? "#fff1c2" : "#ffe7a3"
                s.glow(155, 73, g)
                s.glow(183, 73, g)
            }
        }

        // lantern on the floor
        s.box(92, 86, 8, 7, "#3b3437")
        s.glowRect(94, 87, 4, 4, "#ffd98a")
        s.hline(93, 85, 6, "#3b3437")

        light(s, [L(100, 30, 100, moonlight, 0.6), L(96, 86, 120, candleLight, 1.1)], (0.36, 0.32, 0.4))
    }

    static func backRoom(_ s: EscapeCanvas, _ step: Int, _ t: Double) {
        roofAndWall(s, false, true)

        // writing desk
        s.box(12, 66, 54, 4, woodL)
        s.box(14, 70, 16, 22, wood)
        s.hline(16, 76, 12, "#5a3a2c")
        s.hline(16, 83, 12, "#5a3a2c")
        s.vline(62, 70, 22, wood)
        // tag, inkpot, candle
        s.rect(36, 61, 9, 5, paper)
        s.set(36, 61, "#8a6a45")
        s.line(36, 61, 32, 57, "#8a6a45")
        s.rect(48, 62, 4, 4, "#2a2a3a")
        s.line(51, 62, 54, 55, "#efe3cb")
        candle(s, 20, 66, "#efe3cb", true, t, 7)

        // wall clock with pendulum
        let cx = 100.0, cy = 30.0
        s.box(90, 18, 20, 42, "#5a3a2c")
        s.box(92, 42, 16, 16, "#6b4633")
        let swing = step >= 3 ? jsRound(sin(t * 3) * 3) : 0
        s.line(100, 44, 100 + swing, 53, "#c49a4e")
        s.disc(100 + swing, 54, 2, "#c49a4e")
        let (h, m): (Double, Double) = step >= 3 ? (9, 15) : (3, 40)
        EscapeKit.clockFace(s, cx, cy, 9, h, m)
        if step >= 3 {
            s.rect(93, 58, 14, 3, paper)
            s.hline(95, 59, 10, "#3a2a26")
        }

        // hat box
        let hx = 72.0
        s.box(hx + 2, 76, 28, 16, "#d8c7a6")
        for x in upto(hx + 4, hx + 30, 4) { s.vline(x, 77, 14, "#b8674f") }
        if step >= 2 {
            s.box(hx + 18, 86, 16, 6, "#d8c7a6")
            s.rect(hx + 6, 74, 18, 3, "#a84f4b")
            s.disc(hx + 14, 74, 2, brass)
        } else {
            s.box(hx, 72, 32, 5, "#e6d6b8")
            for i in 0..<4 { s.rect(hx + 8 + Double(i) * 5, 73, 3, 3, brass) }
        }

        // bookshelf
        let bx = 138.0
        s.box(bx, 28, 54, 64, "#4d3224")
        let cols = ["#7a5068", "#4f6583", "#d09a3e", "#8a9a72", "#b8674f", "#efe3cb"]
        for sh in 0..<3 {
            let sy = 31 + Double(sh) * 20
            s.rect(bx + 2, sy + 17, 50, 2, "#6b4633")
            var x = bx + 3
            var k = sh * 4
            while x < bx + 50 {
                let w = Double(3 + k % 3)
                let hh = Double(12 + (k * 5) % 5)
                let c = cols[k % cols.count]
                s.rect(x, sy + 17 - hh, min(w, bx + 51 - x), hh, c)
                s.hline(x, sy + 19 - hh, min(w, bx + 51 - x), mix(c, "#ffffff", 0.25))
                x += w + (k % 4 == 0 ? 1 : 0)
                k += 1
            }
        }
        // the gold-lettered spines (2 and 4) catch the candle light
        s.glow(bx + 16, 40, "#f1d27a")
        s.glow(bx + 34, 60, "#f1d27a")

        light(s, [L(21, 57, 150, candleLight, 1.1), L(180, 10, 80, moonlight, 0.4)], (0.34, 0.3, 0.36))
    }
}

/* ---------- the haunted cellar ---------- */

private enum Cellar {
    static func floor_(_ s: EscapeCanvas) {
        for y in upto(92, 120) {
            for x in upto(0, W) {
                let row: Double = y < 97 ? 0 : y < 104 ? 1 : y < 112 ? 2 : 3
                let seam = (x + row * 9) % 22 == 0 || y == 92 || y == 97 || y == 104 || y == 112
                s.set(x, y, seam ? "#2c2a2c" : row % 2 != 0 ? "#4a4648" : "#524d4f")
            }
        }
    }

    static func ghost(_ s: EscapeCanvas, _ cx: Double, _ cy: Double, _ t: Double) {
        let bob = jsRound(sin(t * 2) * 2)
        for j in upto(0, 34) {
            let half = j < 10 ? jsRound((100 - (10 - j) * (10 - j)).squareRoot()) : 10 + floor((j - 10) / 8)
            for i in thru(-half, half) {
                if j > 28 && (i + floor(t * 6)) % 4 == 0 { continue }
                s.glow(cx + i, cy + j + bob, j < 2 ? "#e9fff7" : "#bff2e2", 170)
            }
        }
        s.glow(cx - 4, cy + 8 + bob, "#1f3b36")
        s.glow(cx + 3, cy + 8 + bob, "#1f3b36")
        s.hline(cx - 3, cy + 14 + bob, 6, "#6a9e90")
        // hat
        s.rect(cx - 7, cy - 4 + bob, 14, 3, "#2f3a3a")
        s.rect(cx - 5, cy - 10 + bob, 10, 7, "#2f3a3a")
    }

    static func bulb(_ s: EscapeCanvas, _ x: Double, _ on: Bool) {
        s.vline(x, 0, 6, "#2a2020")
        s.rect(x - 1, 6, 3, 2, "#5a5048")
        if on {
            s.glow(x - 1, 8, "#fff2b8")
            s.glow(x, 8, "#fffbe0")
            s.glow(x + 1, 8, "#fff2b8")
            s.glow(x, 9, "#ffe7a3")
        } else {
            s.rect(x - 1, 8, 3, 2, "#6a6058")
        }
    }

    static func wine(_ s: EscapeCanvas, _ step: Int, _ t: Double) {
        EscapeKit.stoneWall(s, 0, 0, W, 92, "#5a524c", "#4e4742", "#35302d")
        floor_(s)
        bulb(s, 100, step >= 1)

        // barrel rack
        s.rect(12, 84, 84, 4, "#4d3224")
        let marks: [EscapeGlyph] = [.moon, .key, .bat, .crown]
        for i in 0..<4 {
            let cx = 22 + Double(i) * 21, cy = 74.0
            s.disc(cx, cy, 10, "#5a3a2c")
            s.disc(cx, cy, 8, "#7a5236")
            s.disc(cx, cy, 3, "#6b4630")
            for a in 0..<12 { s.set(jsRound(cx + cos(Double(a)) * 9), jsRound(cy + sin(Double(a)) * 9), "#b48c4a") }
            if step >= 1 { s.glyph(marks[i], cx - 3, cy - 3, "#e8dcc0") }
        }
        // candle stub on a barrel
        candle(s, 28, 63, "#e6d6b8", true, t, 3)

        // wooden post with scratched arrows
        s.box(102, 18, 10, 75, "#5a3a2c")
        for i in 0..<4 {
            let y = 34 + Double(i) * 9
            let up = i == 0 || i == 3
            s.vline(107, y, 6, "#c9b08a")
            s.set(106, up ? y + 1 : y + 4, "#c9b08a")
            s.set(108, up ? y + 1 : y + 4, "#c9b08a")
        }

        // crate + radio
        s.box(118, 78, 32, 14, "#6b4a2e")
        s.hline(118, 84, 32, "#4d3224")
        s.box(121, 62, 26, 16, "#7a5a3a")
        s.rect(124, 65, 12, 10, step >= 1 ? "#e8c787" : "#5a4632")
        if step >= 1 { for y in upto(66, 75, 2) { s.glow(125, y, "#fff1c2") } }
        for i in 0..<3 { s.disc(140, 66 + Double(i) * 4, 1.5, "#c49a4e") }
        if step >= 2 {
            let f = floor(t * 4) % 3
            s.glow(150 + f, 58 - f * 2, "#bff2e2")
            s.glow(153 + f, 55 - f, "#bff2e2")
        }

        // portrait of Edgar
        s.box(150, 8, 30, 30, "#6b4a2e")
        s.rect(152, 10, 26, 26, "#3a4a45")
        s.disc(165, 21, 6, "#d9b89a")
        s.rect(159, 28, 12, 8, "#2f3a3a")
        s.hline(162, 23, 6, "#5a3a2c")
        s.rect(159, 13, 12, 3, "#2f3a3a")
        s.set(163, 20, "#2a2020")
        s.set(167, 20, "#2a2020")
        if step >= 4 {
            s.glow(163, 20, "#bff2e2")
            s.glow(167, 20, "#bff2e2")
        }

        // candle shelf
        s.box(150, 52, 46, 3, "#5a3a2c")
        let order: [EscapeColor] = [.red, .green, .gold, .white, .blue]
        for (i, c) in order.enumerated() { candle(s, 153 + Double(i) * 9, 52, c.hex, step >= 4, t, 7) }

        if step >= 4 && step < 5 { ghost(s, 78, 26, t) }

        var lights = [L(29, 58, step >= 1 ? 50 : 110, candleLight, 1.0)]
        if step >= 1 { lights.append(L(100, 10, 150, warm, 0.9)) }
        if step >= 4 { lights.append(L(172, 44, 70, candleLight, 0.9)) }
        if step >= 4 && step < 5 { lights.append(L(78, 40, 70, ghostLight, 0.9)) }
        light(s, lights, step >= 1 ? (0.32, 0.3, 0.32) : (0.18, 0.17, 0.22))
    }

    static func boiler(_ s: EscapeCanvas, _ step: Int, _ t: Double) {
        // bricks
        s.rect(0, 0, W, 92, "#3a2a26")
        var y = 0.0, r = 0
        while y < 92 {
            var x: Double = r % 2 != 0 ? -6 : 0
            while x < W {
                let c = (x * 3 + y) % 7 > 3 ? "#7a4a3a" : "#6b4032"
                s.rect(max(0, x), y, min(11, W - max(0, x)), 4, c)
                x += 12
            }
            y += 5
            r += 1
        }
        floor_(s)
        bulb(s, 70, step >= 1)

        // pipes along the top and down the side
        s.rect(0, 12, W, 4, "#6b6e70")
        s.hline(0, 12, W, "#8d9194")
        s.rect(112, 12, 4, 60, "#6b6e70")
        s.vline(112, 12, 60, "#8d9194")
        for x in [30.0, 90, 150] { s.rect(x, 11, 3, 6, "#4a4c4e") }

        // fuse box
        s.box(12, 28, 24, 30, "#5c6a6e")
        s.rect(15, 31, 18, 24, "#3d474a")
        let sw = Array(step >= 1 ? "UDDU" : "DDDD")
        for i in 0..<4 {
            let x = 16 + Double(i) * 4
            s.rect(x, 36, 3, 12, "#2a3033")
            let up = sw[i] == "U"
            s.rect(x, up ? 37 : 43, 3, 4, "#d8d0c0")
        }
        s.glow(33, 30, step >= 1 ? "#8fe08a" : "#c4453f")

        // chalk writing (legible once the lights are on)
        let chalk = step >= 1 ? "#e9e4d8" : "#5a4a44"
        s.rect(50, 22, 22, 1, chalk)
        s.rect(50, 26, 16, 1, chalk)
        for i in 0..<4 { s.rect(56 + Double(i) * 6, 34, 4, 7, chalk) }
        s.rect(58, 36, 1, 3, "#3a2a26")
        s.rect(74, 36, 1, 3, "#3a2a26")

        // the boiler
        s.box(122, 28, 68, 64, "#4a4c4e")
        s.disc(156, 50, 18, "#3a3c3e")
        s.disc(156, 50, 15, step >= 3 ? "#1a1616" : "#565a5c")
        if step >= 3 {
            s.rect(170, 36, 8, 30, "#565a5c")
        } else {
            for i in 0..<4 {
                let vx = 132 + Double(i) * 15
                s.disc(vx, 80, 5, "#a84f4b")
                s.disc(vx, 80, 2, "#3a2a26")
            }
        }
        // fire grate glow
        for x in upto(140, 172) { s.glow(x, 88, (x + floor(t * 8)) % 3 != 0 ? "#c4453f" : "#e2b359") }

        // scarf on the pipe
        if step >= 3 {
            let cols: [EscapeColor] = [.green, .white, .red, .gold, .blue]
            for j in upto(0, 40) {
                let c = cols[Int(min(4, floor(j / 8)))].hex
                let sway = jsRound(sin(t * 1.5 + j * 0.1) * (j / 20))
                s.rect(102 + sway, 24 + j, 8, 1, j % 8 == 7 ? mix(c, "#000000", 0.3) : c)
            }
        }

        if step >= 4 && step < 5 { ghost(s, 78, 48, t) }

        var lights = [L(156, 88, 70, (1.1, 0.6, 0.35), 0.8)]
        if step >= 1 { lights.append(L(70, 10, 160, warm, 0.95)) }
        if step >= 4 && step < 5 { lights.append(L(78, 62, 70, ghostLight, 0.9)) }
        light(s, lights, step >= 1 ? (0.32, 0.29, 0.3) : (0.17, 0.16, 0.2))
    }
}

/* ---------- the detective's office ---------- */

private enum Office {
    static func wallpaper(_ s: EscapeCanvas, _ a: String, _ b: String) {
        for y in 0..<92 { for x in 0..<SW { s.set(Double(x), Double(y), (x + (y >> 2)) % 10 < 5 ? a : b) } }
        s.rect(0, 84, W, 8, "#2a2230")
        s.hline(0, 84, W, "#3d3346")
    }

    static func desk(_ s: EscapeCanvas, _ step: Int, _ t: Double) {
        wallpaper(s, "#3b3f55", "#373a4f")
        EscapeKit.planks(s, 92, "#4a3526", "#43301f", "#2a1c14")

        // rainy window with a neon glow
        s.box(6, 8, 44, 44, "#2a2230")
        for y in upto(10, 50) {
            for x in upto(8, 48) {
                let neon = x > 30 && y > 28 && y < 34
                s.glow(x, y, neon ? (sin(t * 7) > -0.6 ? "#c4453f" : "#5a2a2a") : y < 30 ? "#1b2238" : "#222a44")
            }
        }
        for k in upto(0, 14) {
            let x = 9 + ((k * 7) % 38)
            let y = 10 + ((k * 13 + floor(t * 40)) % 38)
            s.glow(x, y, "#6f86b0")
            s.glow(x, y + 1, "#4f6690")
        }
        s.rect(27, 10, 1, 40, "#2a2230")
        s.rect(8, 29, 40, 1, "#2a2230")
        for y in 10..<50 { s.emit[y * SW + 27] = 0 }
        for x in 8..<48 { s.emit[29 * SW + x] = 0 }

        // filing cabinet
        s.box(10, 56, 30, 36, "#5c6a6e")
        for i in 0..<3 {
            let o = Double(i) * 11
            s.rect(12, 58 + o, 26, 10, "#6c7a7e")
            s.hline(12, 58 + o, 26, "#83929a")
            s.rect(22, 62 + o, 6, 2, "#c49a4e")
        }
        if step >= 1 {
            s.rect(12, 58, 26, 3, "#2a3033")
            s.rect(15, 55, 18, 4, "#e6d6b8")
        }

        // wall safe
        s.box(62, 16, 26, 26, "#4a4c4e")
        if step >= 3 {
            s.rect(64, 18, 22, 22, "#1e1c1e")
            s.rect(66, 32, 10, 6, "#e6d6b8")
            s.box(84, 16, 6, 26, "#5a5c5e")
        } else {
            s.disc(75, 29, 7, "#6a6c6e")
            s.disc(75, 29, 2, "#2a2a2a")
            for a in 0..<8 { s.set(jsRound(75 + cos(Double(a) * 0.785) * 5), jsRound(29 + sin(Double(a) * 0.785) * 5), "#c49a4e") }
        }

        // desk, typewriter, green lamp, mug
        s.box(58, 70, 96, 5, "#5a3a2c")
        s.box(60, 75, 20, 17, "#4d3224")
        s.box(132, 75, 20, 17, "#4d3224")
        s.box(68, 62, 30, 8, "#2f2f33")
        s.rect(72, 56, 22, 7, "#efe3cb")
        s.hline(74, 58, 16, "#8a8070")
        s.hline(74, 60, 12, "#8a8070")
        for i in 0..<6 { s.set(71 + Double(i) * 4, 66, "#9a9aa0") }
        // banker's lamp
        s.vline(118, 60, 10, "#c49a4e")
        s.rect(112, 56, 14, 4, "#2f6a4a")
        s.glowRect(113, 60, 12, 1, "#fff1c2")
        s.rect(137, 64, 5, 6, "#e6d6b8")

        // city map on the wall
        s.box(150, 12, 44, 46, "#3a2a26")
        s.rect(152, 14, 40, 42, "#d9ccb0")
        for i in 0...5 {
            s.vline(152 + Double(i) * 8, 14, 42, "#b8a888")
            s.hline(152, 14 + jsRound(Double(i) * 8.4), 40, "#b8a888")
        }
        s.rect(152, 14, 8, 42, "#8fb0c8") // the sea on the left edge
        s.frame(159, 47, 9, 9, "#a84f4b")
        if step >= 5 { s.frame(175, 30, 9, 9, "#c4453f") }

        light(s, [L(119, 62, 95, (0.85, 1.0, 0.75), 1.0), L(28, 30, 60, (0.6, 0.7, 1.05), 0.6), L(42, 32, 40, (1.1, 0.5, 0.5), 0.5)], (0.22, 0.22, 0.3))
    }

    static func evidence(_ s: EscapeCanvas, _ step: Int, _ t: Double) {
        for y in 0..<92 { for x in 0..<SW { s.set(Double(x), Double(y), (x * 3 + y * 5) % 23 == 0 ? "#5d5a58" : "#686462") } }
        s.rect(0, 84, W, 8, "#3a3634")
        EscapeKit.planks(s, 92, "#4a4644", "#434040", "#2a2828")

        // lamp hanging from the ceiling
        s.vline(100, 0, 4, "#2a2828")
        s.rect(94, 4, 13, 3, "#2f3a3a")
        s.glowRect(96, 7, 9, 1, "#fff1c2")

        // coat rack
        s.vline(22, 14, 78, "#4d3224")
        s.hline(15, 91, 15, "#4d3224")
        s.hline(16, 16, 13, "#4d3224")
        for j in 0..<44 {
            let half = Double(6 + j / 7)
            s.hline(22 - half, 22 + Double(j), half * 2, j % 11 == 0 ? "#8a7454" : "#9a8460")
        }
        s.rect(15, 12, 14, 3, "#3a3634")
        s.rect(17, 8, 10, 5, "#3a3634")
        s.rect(24, 38, 3, 4, "#c4453f")

        // corkboard with suspects and red string
        s.box(46, 10, 74, 46, "#5a3a2c")
        s.rect(48, 12, 70, 42, "#b8895a")
        let spots: [(Double, Double)] = [(52, 16), (70, 18), (88, 16), (106, 18)]
        let faces = ["#6b5a4a", "#8a6a5a", "#5a4a3a", "#7a5a4a"]
        for (i, (x, y)) in spots.enumerated() {
            if i == 3 && step >= 2 {
                s.rect(x, y, 10, 13, "#efe3cb")
                s.hline(x + 2, y + 5, 6, "#8a8070")
                continue
            }
            s.rect(x, y, 10, 13, "#e6d6b8")
            s.rect(x + 2, y + 2, 6, 6, faces[i])
            s.rect(x + 1, y + 1, 8, 2, i == 2 ? "#e6d6b8" : "#2f2f33")
            s.set(x + 5, y, "#c4453f")
        }
        s.line(57, 17, 111, 19, "#c4453f")
        s.line(75, 19, 93, 40, "#c4453f")
        s.rect(58, 38, 16, 10, "#efe3cb")
        s.rect(80, 40, 22, 9, "#efe3cb")

        // evidence table
        s.box(124, 76, 72, 4, "#5a3a2c")
        s.vline(128, 80, 12, "#4d3224")
        s.vline(191, 80, 12, "#4d3224")
        // handbag
        s.rect(132, 66, 22, 10, "#6a2f4a")
        for x in upto(132, 154, 2) { s.set(x, 67, "#c49a4e") }
        s.line(135, 66, 143, 60, "#3a2a26")
        s.line(143, 60, 151, 66, "#3a2a26")
        if step >= 4 {
            s.rect(139, 64, 8, 3, "#efe3cb")
        } else {
            for i in 0..<4 { s.rect(135 + Double(i) * 4, 70, 3, 4, "#c49a4e") }
        }
        // evidence box
        s.box(164, 66, 26, 10, "#c8b089")
        s.rect(166, 64, 8, 3, "#e8c787")

        _ = t
        light(s, [L(100, 8, 170, warm, 1.0)], (0.24, 0.24, 0.3))
    }
}

/* ---------- the lost library ---------- */

private enum Library {
    static let pattern = [".##.", "####", "#..#", "####"]

    static func checkerFloor(_ s: EscapeCanvas, _ y0: Double) {
        for y in upto(y0, 120) { for x in upto(0, W) { s.set(x, y, (floor(x / 10) + floor((y - y0) / 6)) % 2 != 0 ? "#3d3350" : "#4a3f60") } }
    }

    static func hall(_ s: EscapeCanvas, _ step: Int, _ t: Double) {
        for y in 0..<92 { for x in 0..<SW { s.set(Double(x), Double(y), x % 16 < 2 ? "#2e2640" : "#3a3150") } }
        s.rect(0, 86, W, 6, "#241d33")
        checkerFloor(s, 92)

        // stained-glass window (arched)
        let bands: [EscapeColor] = [.blue, .gold, .red, .violet]
        for y in upto(6, 60) {
            for x in upto(80, 120) {
                let ax = x + 0.5 - 100, ay = (y - 22) * 1.3
                if y < 22 && ax * ax + ay * ay > 400 { continue }
                let band = Int(min(3, floor((y - 6) / 13.5)))
                let c = bands[band].hex
                let lead = (x - 80) % 10 == 0 || (y - 6) % 13 == 0
                s.glow(x, y, lead ? "#1a1424" : (x + y) % 5 != 0 ? c : mix(c, "#ffffff", 0.25))
            }
        }

        // globe on a stand
        s.vline(42, 70, 22, "#8a6a3a")
        s.hline(34, 91, 17, "#8a6a3a")
        let spin = step >= 2 ? floor(t * 4) : 0
        s.disc(42, 58, 12, "#3f6a8a")
        for y in upto(47, 70) {
            for x in upto(31, 54) {
                let dx = x + 0.5 - 42, dy = y + 0.5 - 58
                if dx * dx + dy * dy < 140 && (x * 3 + y * 5 + spin * 2) % 13 < 4 { s.set(x, y, "#6f8f4e") }
            }
        }
        for a in upto(0, 40) { s.set(jsRound(42 + cos(a / 6.4) * 13), jsRound(58 + sin(a / 6.4) * 13), "#c49a4e") }
        s.box(30, 76, 24, 6, "#6b4633")
        if step < 2 { for i in 0..<4 { s.rect(32 + Double(i) * 5, 78, 3, 3, "#c49a4e") } }

        // hourglass
        s.box(62, 84, 16, 3, "#6b4633")
        s.hline(64, 66, 12, "#6b4633")
        s.hline(64, 83, 12, "#6b4633")
        for j in upto(0, 16) {
            let half = max(1, abs(8 - j) * 0.7)
            var i = -half
            while i <= half {
                s.set(jsRound(70 + i), 67 + j, j > 9 ? "#e2c38a" : "#8fa0b8")
                i += 1
            }
        }
        if step < 2 { s.rect(62, 86, 16, 1, "#8a7f70") }

        // glowing floor pattern
        if step >= 3 {
            for (j, row) in pattern.enumerated() {
                for (i, c) in row.enumerated() where c == "#" {
                    let pulse = sin(t * 2 + Double(i) + Double(j)) > -0.2
                    s.glowRect(80 + Double(i) * 10 + 1, 96 + Double(j) * 6, 8, 4, pulse ? "#cdb3ff" : "#a987d6")
                }
            }
        }

        // lectern + spellbook
        s.vline(149, 64, 28, "#4d3224")
        s.hline(140, 91, 18, "#4d3224")
        s.box(136, 58, 26, 6, "#5a3a2c")
        if step >= 5 {
            s.box(139, 52, 20, 6, "#6a2f4a")
        } else {
            let flap = floor(t * 6) % 3
            s.rect(137, 50, 11, 8, "#efe3cb")
            s.rect(150, 50, 11, 8, "#efe3cb")
            s.rect(148, 50 - flap, 2, 8, "#d8c9ad")
            for k in upto(0, 3) { s.glow(142 + k * 6, 46 - ((flap + k) % 3), "#cdb3ff") }
        }

        candle(s, 180, 86, "#efe3cb", step < 5, t, 10)
        candle(s, 20, 86, "#efe3cb", step < 5, t, 8)

        var lights = [L(100, 30, 100, magic, 0.8), L(181, 74, 70, candleLight, 0.9), L(21, 76, 60, candleLight, 0.8)]
        if step >= 3 { lights.append(L(100, 106, 50, magic, 0.9)) }
        light(s, lights, (0.2, 0.18, 0.28))
    }

    static func shelves(_ s: EscapeCanvas) {
        s.rect(0, 0, W, 92, "#2b2030")
        let cols = ["#7a5068", "#4f6583", "#d09a3e", "#8a9a72", "#b8674f", "#efe3cb", "#5e3f7a"]
        for sh in 0..<5 {
            let y = 4 + Double(sh) * 18
            s.rect(0, y + 15, W, 3, "#5a3a2c")
            s.hline(0, y + 15, W, "#7a5540")
            var x = 0.0
            var k = sh * 7
            while x < W {
                let w = Double(3 + k % 3)
                let h = Double(10 + (k * 7) % 5)
                let c = cols[k % cols.count]
                s.rect(x, y + 15 - h, w, h, mix(c, "#000000", 0.25))
                x += w + ((k * 13) % 7 == 0 ? 2 : 0)
                k += 1
            }
        }
        for y in 92..<120 { for x in 0..<SW { s.set(Double(x), Double(y), (x + (y >> 1)) % 12 < 6 ? "#3a2a26" : "#342522") } }
    }

    static func stacks(_ s: EscapeCanvas, _ step: Int, _ t: Double) {
        shelves(s)

        // five coloured lever-books
        s.rect(14, 38, 78, 20, "#241a2a")
        let levers: [EscapeColor] = [.red, .blue, .green, .gold, .violet]
        for (i, c) in levers.enumerated() {
            let x = 18 + Double(i) * 15
            s.box(x, 40, 11, 16, c.hex)
            s.hline(x + 2, 44, 7, mix(c.hex, "#ffffff", 0.35))
        }

        // star chart behind the shelf
        if step >= 1 {
            s.box(98, 8, 44, 42, "#1a1830")
            for k in upto(0, 16) { s.glow(100 + ((k * 17) % 40), 10 + ((k * 11) % 38), "#8fa0c8") }
            for (i, g) in [EscapeGlyph.star, .moon, .comet, .sun].enumerated() { s.glyph(g, 102 + Double(i % 2) * 20, 12 + Double(i / 2) * 18, "#e8e0ff", true) }
        }

        // grandfather clock, ticking backwards until it's set right
        s.box(150, 14, 24, 78, "#4d3224")
        s.box(153, 44, 18, 40, "#5a3a2c")
        let (h, m): (Double, Double) = step >= 3 ? (3, 30) : (11, (60 - (floor(t) % 12) * 5) % 60)
        EscapeKit.clockFace(s, 162, 28, 9, h, m)
        let swing = jsRound(sin(t * (step >= 3 ? 3 : -3)) * 3)
        s.line(162, 46, 162 + swing, 74, "#c49a4e")
        s.disc(162 + swing, 76, 3, "#c49a4e")

        // tile panel
        s.box(100, 60, 36, 30, "#4a4250")
        for (j, row) in pattern.enumerated() {
            for (i, c) in row.enumerated() {
                let lit = step >= 4 && c == "#"
                let x = 103 + Double(i) * 8, y = 62 + Double(j) * 7
                if lit { s.glowRect(x, y, 6, 5, "#cdb3ff") } else { s.box(x, y, 6, 5, "#6a6272") }
            }
        }

        // the last candle
        if step >= 4 {
            s.box(180, 86, 12, 6, "#5a3a2c")
            candle(s, 185, 86, "#efe3cb", step < 5, t, 14)
        }

        // ladder
        s.line(140, 92, 146, 4, "#6b4633")
        s.line(146, 92, 152, 4, "#6b4633")

        light(s, [L(100, 50, 120, magic, 0.55), L(186, 70, step >= 4 && step < 5 ? 90 : 1, candleLight, 1.0), L(60, 30, 90, candleLight, 0.5)], (0.22, 0.2, 0.3))
    }
}
