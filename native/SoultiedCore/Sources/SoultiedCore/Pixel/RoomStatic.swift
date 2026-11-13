import Foundation

/* The parts of the room that never move (drawn once per look of the room). From src/pixel/room.ts. */

/** The wallpaper, between the crown moulding and the wainscot. */
func drawWallpaper(_ L: Layer, _ wall: String) {
    let top = 4.0
    let bottom = 94.0
    switch wall {
    case "blush":
        // dusty rose with a small damask lozenge
        L.R(0, 0, RW, FLOOR_Y, hx("#a27a73"))
        var y = 8.0, row = 0.0
        while y < bottom - 4 {
            var x = jm(row, 2) != 0 ? 6.0 : 0.0
            while x < RW {
                let c = hx("#b38b83")
                L.S(x + 2, y, c)
                L.HL(x + 1, y + 1, 3, c)
                L.HL(x, y + 2, 5, c)
                L.HL(x + 1, y + 3, 3, c)
                L.S(x + 2, y + 4, c)
                L.S(x + 2, y + 2, hx("#93685f"))
                x += 12
            }
            y += 12
            row += 1
        }
    case "gingham":
        // cream checks: two bands that cross
        let a = hx("#a98e68"), b = hx("#b9a07a"), c = hx("#c8b18b")
        for y in 0..<Int(FLOOR_Y) {
            for x in 0..<ROOM_W {
                let v = x % 8 < 4
                let h = y % 8 < 4
                L.set(x, y, v && h ? a : v || h ? b : c)
            }
        }
    case "midnight":
        // deep blue, faint dots and little gold stars
        L.R(0, 0, RW, FLOOR_Y, hx("#2e3650"))
        var y = top + 3
        while y < bottom {
            var x = jm(y / 6, 2) != 0 ? 3.0 : 0.0
            while x < RW {
                L.S(x, y, hx("#38415e"))
                x += 6
            }
            y += 6
        }
        y = 10
        var row = 0.0
        while y < bottom - 4 {
            var x = jm(row, 2) != 0 ? 10.0 : 2.0
            while x < RW {
                let sx = x + fl(hash(x * 3 + row * 41) * 4) - 2
                let sy = y + fl(hash(x * 7 + row * 13) * 4) - 2
                if hash(x + row * 97) > 0.55 {
                    // a little four-pointed star
                    L.S(sx, sy - 1, hx("#8f7c4e"))
                    L.HL(sx - 1, sy, 3, hx("#8f7c4e"))
                    L.S(sx, sy + 1, hx("#8f7c4e"))
                    L.S(sx, sy, hx("#d9bd72"))
                } else {
                    L.S(sx, sy, hx("#a99258"))
                }
                x += 16
            }
            y += 15
            row += 1
        }
    case "clay":
        // terracotta with rows of soft arches
        L.R(0, 0, RW, FLOOR_Y, hx("#7e4e40"))
        var row = 0.0, y0 = top + 6
        while y0 < bottom - 10 {
            var x0 = jm(row, 2) != 0 ? 8.0 : 0.0
            while x0 < RW {
                for j in 0..<16 {
                    for i in 0..<10 {
                        let dx = Double(i) - 4.5
                        let jj = Double(j)
                        let inArch = j >= 5 || dx * dx + (jj - 5) * (jj - 5) <= 25
                        if !inArch { continue }
                        let edge = i == 0 || i == 9 || (j < 5 && dx * dx + (jj - 5) * (jj - 5) > 14)
                        L.S(x0 + Double(i), y0 + jj, edge ? hx("#93604f") : hx("#855343"))
                    }
                }
                x0 += 16
            }
            y0 += 24
            row += 1
        }
    case "polka":
        // oat with rows of rust polka dots
        L.R(0, 0, RW, FLOOR_Y, hx("#b8a27e"))
        var row = 0.0, y = top + 4
        while y < bottom - 2 {
            var x = jm(row, 2) != 0 ? 5.0 : 0.0
            while x < RW {
                L.R(x, y, 3, 2, hx("#9c5f4a"))
                L.HL(x, y + 2, 3, hx("#8a5241"))
                L.S(x, y, hx("#b0735c"))
                x += 10
            }
            y += 9
            row += 1
        }
    case "candy":
        // dusty pink candy stripes
        L.R(0, 0, RW, FLOOR_Y, hx("#c49a93"))
        var x = 0.0
        while x < RW {
            L.R(x, 4, 4, 92, hx("#b3857f"))
            L.VL(x + 4, 4, 92, hx("#d2aaa2"))
            x += 10
        }
    case "starlit":
        // violet night, with pale stars and the odd moon (the app's Starlight look)
        L.R(0, 0, RW, FLOOR_Y, hx("#3d3660"))
        var y = top + 2
        while y < bottom {
            var x = jm(y / 5, 2) != 0 ? 2.0 : 0.0
            while x < RW {
                L.S(x, y, hx("#463e6c"))
                x += 5
            }
            y += 5
        }
        y = 10
        var row = 0.0
        while y < bottom - 4 {
            var x = jm(row, 2) != 0 ? 9.0 : 1.0
            while x < RW {
                let sx = x + fl(hash(x * 5 + row * 29) * 4) - 2
                let sy = y + fl(hash(x * 11 + row * 17) * 4) - 2
                let k = hash(x + row * 53)
                if k > 0.86 {
                    // a little crescent moon
                    L.HL(sx, sy - 1, 2, hx("#e9d9a6"))
                    L.S(sx - 1, sy, hx("#e9d9a6"))
                    L.S(sx - 1, sy + 1, hx("#e9d9a6"))
                    L.HL(sx, sy + 2, 2, hx("#e9d9a6"))
                } else if k > 0.5 {
                    L.S(sx, sy - 1, hx("#8d84b0"))
                    L.HL(sx - 1, sy, 3, hx("#8d84b0"))
                    L.S(sx, sy + 1, hx("#8d84b0"))
                    L.S(sx, sy, hx("#efe2b4"))
                } else {
                    L.S(sx, sy, hx("#9a90bd"))
                }
                x += 15
            }
            y += 14
            row += 1
        }
    case "forest":
        // dark green scattered with little leaves
        L.R(0, 0, RW, FLOOR_Y, hx("#3c5140"))
        for gyi in 0..<9 {
            for gxi in 0..<32 {
                let gx = Double(gxi), gy = Double(gyi)
                let x = gx * 10 + fl(hash(gx * 7 + gy * 31) * 6)
                let y = top + 4 + gy * 10 + fl(hash(gx * 13 + gy * 3) * 4)
                let flip = hash(gx + gy * 17) > 0.5
                let d: Double = flip ? 1 : -1
                L.S(x, y, hx("#5a7a5a"))
                L.S(x + d, y + 1, hx("#4c664e"))
                L.S(x, y + 1, hx("#5a7a5a"))
                L.S(x + d, y + 2, hx("#4c664e"))
                L.S(x + d * 2, y + 2, hx("#4c664e"))
                L.S(x + d, y + 3, hx("#456048"))
            }
        }
    default:
        // sage: subtle stripes + tiny sprig motif
        L.R(0, 0, RW, FLOOR_Y, P.wall)
        var x = 0.0
        while x < RW {
            L.R(x, 4, 3, 92, P.wallStripe)
            x += 8
        }
        var y = 10.0
        while y < 92 {
            var x2 = jm(y / 10, 2) != 0 ? 5.0 : 1.0
            while x2 < RW {
                L.S(x2, y, P.wallDot)
                L.S(x2 + 1, y + 1, P.wallDot)
                L.S(x2 - 1, y + 1, P.wallDot)
                x2 += 8
            }
            y += 10
        }
    }
}

func drawWall(_ L: Layer, _ wall: String) {
    drawWallpaper(L, wall)
    // crown moulding
    L.R(0, 0, RW, 4, P.crown)
    L.HL(0, 3, RW, P.crownL)
    L.HL(0, 4, RW, hx("#3a4a40"))
    // wainscot
    L.R(0, 94, RW, FLOOR_Y - 94, P.wains)
    L.HL(0, 94, RW, P.wainsL)
    L.HL(0, 95, RW, P.wainsL)
    L.HL(0, 96, RW, P.wainsD)
    var x = 4.0
    while x < RW {
        L.R(x, 100, 18, 13, P.wainsD)
        L.R(x + 1, 101, 16, 11, P.wains)
        L.HL(x + 1, 112, 17, P.wainsL)
        L.VL(x + 17, 101, 12, P.wainsL)
        x += 24
    }
    L.R(0, 116, RW, 5, P.wainsDD)
    L.HL(0, 116, RW, P.wainsD)
}

func drawFloor(_ L: Layer) {
    var y = FLOOR_Y
    var row = 0.0
    let heights: [Double] = [3, 4, 4, 5, 5, 6, 6, 7, 8, 9, 10]
    let cols = [P.floorA, P.floorB, P.floorC]
    while y < RH {
        let h = heights[min(Int(row), heights.count - 1)]
        let col = cols[Int(row) % 3]
        L.R(0, y, RW, h, col)
        L.HL(0, y, RW, P.floorSeam)
        // plank joints, staggered, spaced wider toward the viewer
        let span = 40 + row * 6
        let joint = mix(col, hx("#ffffff"), 0.06)
        var x = jm(row * 23, span)
        while x < RW {
            L.VL(x, y, h, P.floorSeam)
            L.VL(x + 1, y + 1, h - 1, joint)
            x += span
        }
        // grain
        let grain = mix(col, hx("#3a2418"), 0.18)
        x = 0
        while x < RW {
            if hash(x * 7 + row * 131) > 0.86 { L.HL(x, Double(i32(y + 1 + hash(x + row) * (h - 1))), 3, grain) }
            x += 3
        }
        y += h
        row += 1
    }
}

/** The window, and what you see through it (the moving parts are drawWeather). */
struct WinBox { static let x = 22.0, y = 22.0, w = 46.0, h = 58.0 }
let SKIES: [String: (RGB, RGB, RGB)] = [
    "snow": (P.skyA, P.skyB, P.skyC),
    "rain": (hx("#1d2330"), hx("#242b3a"), hx("#2c3445")),
    "summer": (hx("#141d3a"), hx("#1c2a4f"), hx("#27406a")),
    "blossom": (hx("#3d3561"), hx("#6b4a74"), hx("#a8647a")),
    "city": (hx("#171d35"), hx("#1f2744"), hx("#2a3354")),
    "aurora": (hx("#0e1726"), hx("#132136"), hx("#1a2c45")),
]
/// the glass is split by a cross of frame
func onMullion(_ wx: Double, _ wy: Double) -> Bool { wx == WinBox.w / 2 || wx == WinBox.w / 2 - 1 || (wy >= 26 && wy <= 28) }

/// the little skyline in the city view: [x, top, width] of each building, and where its windows are
let CITY: (blocks: [(Double, Double, Double)], windows: [(Double, Double)]) = {
    let blocks: [(Double, Double, Double)] = [(0, 30, 7), (7, 38, 6), (13, 24, 8), (21, 34, 5), (26, 20, 7), (33, 32, 6), (39, 27, 7)]
    var windows: [(Double, Double)] = []
    for (bx, bt, bw) in blocks {
        var y = bt + 3
        while y < WinBox.h - 2 {
            var x = bx + 1
            while x < bx + bw - 1 {
                windows.append((x, y))
                x += 2
            }
            y += 4
        }
    }
    return (blocks, windows)
}()

func drawWindow(_ L: Layer, _ view: String) {
    let x = WinBox.x, y = WinBox.y, w = WinBox.w, h = WinBox.h
    // curtain rod
    L.R(10, 14, 70, 2, P.brass)
    L.HL(10, 14, 70, P.brassL)
    L.R(8, 13, 3, 4, P.brassL)
    L.R(79, 13, 3, 4, P.brassL)
    // frame
    L.R(x - 3, y - 3, w + 6, h + 6, P.frameD)
    L.R(x - 2, y - 2, w + 4, h + 4, P.frame)
    // sky (emissive, banded gradient)
    let (sa, sb, sc) = SKIES[view] ?? SKIES["snow"]!
    for ji in 0..<Int(h) {
        let j = Double(ji)
        let c = j < h * 0.35 ? sa : j < h * 0.7 ? sb : sc
        for ii in 0..<Int(w) {
            let t = (j / h) * 3 + BAYER4[ji & 3][ii & 3] * 0.9
            let band = t < 1 ? sa : t < 2 ? sb : sc
            L.G(x + Double(ii), y + j, ji % 17 == 0 ? c : band)
        }
    }
    func stars(_ n: Int, _ c: RGB = hx("#c9d2ea")) {
        for k in 0..<n {
            let kd = Double(k)
            L.G(x + Double(i32(hash(kd * 3.1) * w)), y + Double(i32(hash(kd * 7.7) * (h * 0.5))), c)
        }
    }
    func moon(_ mx: Double, _ my: Double, _ crescent: Bool = false) {
        for j in -4...4 {
            for i in -4...4 {
                let d = i * i + j * j
                if d > 17 { continue }
                if crescent && (i + 2) * (i + 2) + (j - 1) * (j - 1) <= 13 { continue }
                L.G(x + mx + Double(i), y + my + Double(j), d > 12 ? hx("#d9d2b8") : P.moon)
            }
        }
    }
    func hills(_ cap: RGB, _ body: RGB, _ k: Double = 0) {
        for ii in 0..<Int(w) {
            let i = Double(ii)
            let hh = jsRound(6 + sin(i * 0.18 + k) * 3 + sin(i * 0.5 + k) * 1)
            var j = 0.0
            while j < hh {
                L.G(x + i, y + h - 1 - j, j == hh - 1 ? cap : body)
                j += 1
            }
        }
    }
    func cottage(_ snowy: Bool) {
        L.R(x + 30, y + h - 14, 7, 5, hx("#2a3150"))
        L.G(x + 32, y + h - 12, hx("#f6c46a"))
        L.G(x + 34, y + h - 12, hx("#f6c46a"))
        for ii in 0..<9 {
            let i = Double(ii)
            L.G(x + 29 + i, y + h - 15 - min(i, 8 - i) / 2, snowy ? hx("#e8eef6") : hx("#3a3346"))
        }
    }

    if view == "rain" {
        // low clouds, wet hills, a lit window far away
        for (cx, cy, r) in [(8.0, 6.0, 9.0), (22, 4, 11), (38, 7, 9), (30, 12, 7)] {
            var j = -r
            while j <= r {
                var i = -r * 1.6
                while i <= r * 1.6 {
                    if (i / 1.6) * (i / 1.6) + j * j <= r * r && cy + j >= 0 && cx + i >= 0 && cx + i < w {
                        L.G(x + cx + i, y + cy + j, j < -r / 3 ? hx("#454e60") : hx("#3a4253"))
                    }
                    i += 1
                }
                j += 1
            }
        }
        hills(hx("#3a4656"), hx("#283240"))
        cottage(false)
    } else if view == "summer" {
        stars(18)
        moon(34, 11, true)
        hills(hx("#3d5c46"), hx("#22392d"))
        cottage(false)
    } else if view == "blossom" {
        // a low pink sun, far hills, and a branch of blossom across the top
        for j in -5...5 { for i in -5...5 where i * i + j * j <= 25 { L.G(x + 30 + Double(i), y + h - 14 + Double(j), hx("#f3c6a5")) } }
        hills(hx("#5c4066"), hx("#45304f"), 2)
        for ti in 0..<34 {
            let t = Double(ti)
            let bx = x + t
            let by = y + 3 + jsRound(t * 0.35 + sin(t * 0.4))
            L.G(bx, by, hx("#4a2e2a"))
            if ti % 5 == 2 { L.G(bx, by + 1, hx("#4a2e2a")) }
        }
        for ki in 0..<16 {
            let k = Double(ki)
            let t = Double(i32(hash(k * 5.3) * 34))
            let bx = x + t + jsRound((hash(k) - 0.5) * 4)
            let by = y + 2 + jsRound(t * 0.35) + jsRound((hash(k * 2.1) - 0.5) * 5)
            L.G(bx, by, hx("#fbe0e6"))
            L.G(bx + 1, by, hx("#f2b8c6"))
            L.G(bx, by + 1, hx("#e895ab"))
            L.G(bx - 1, by, hx("#f2b8c6"))
        }
    } else if view == "city" {
        stars(8)
        moon(8, 9)
        for (bx, bt, bw) in CITY.blocks {
            var j = bt
            while j < h {
                var i = 0.0
                while i < bw {
                    L.G(x + bx + i, y + j, i == 0 ? hx("#2d3352") : hx("#262b45"))
                    i += 1
                }
                j += 1
            }
        }
        for (wx, wy) in CITY.windows { L.G(x + wx, y + wy, hx("#353a57")) }
    } else if view == "aurora" {
        stars(20)
        hills(hx("#dfe6f0"), hx("#3b4668"), 1)
        for ii in 0..<9 {
            let i = Double(ii)
            L.G(x + 6 + i, y + h - 10 - min(i, 8 - i) / 2, hx("#e8eef6"))
        }
    } else {
        // snow: distant hills, snowy rooftops, a moon and stars
        hills(hx("#dfe6f0"), hx("#3b4668"))
        cottage(true)
        moon(34, 12)
        L.G(x + 33, y + 11, hx("#d9d2b8"))
        L.G(x + 35, y + 14, hx("#d9d2b8"))
        stars(14)
    }
    // mullions
    L.R(x + w / 2 - 1, y, 2, h, P.frame)
    L.R(x, y + 26, w, 2, P.frame)
    L.HL(x, y + 28, w, P.frameD)
    L.UG(x + w / 2 - 1, y, 2, h)
    L.UG(x, y + 26, w, 3)
    // sill
    L.R(x - 5, y + h + 2, w + 10, 3, P.frame)
    L.HL(x - 5, y + h + 4, w + 10, P.frameD)
    // curtains (linen, gathered)
    func curtain(_ cx: Double, _ dir: Double) {
        let folds = [hx("#b8a37f"), hx("#d8c6a3"), hx("#e7d8ba"), hx("#cdb994")]
        for ji in 0..<80 {
            let j = Double(ji)
            let width = 10 + jsRound(max(0, j - 30) * 0.08) + (j > 60 ? 2 : 0)
            var i = 0.0
            while i < width {
                let fold = Int(i + (j > 40 ? 1 : 0)) % 4
                L.S(cx + i * dir, 16 + j, folds[fold])
                i += 1
            }
        }
        // tie-back
        L.R(dir == 1 ? cx : cx - 11, 56, 12, 2, P.couch)
    }
    curtain(10, 1)
    curtain(80, -1)
}

func drawBricks(_ L: Layer, _ x0: Double, _ y0: Double, _ w: Double, _ h: Double) {
    L.R(x0, y0, w, h, P.mortar)
    var r = 0.0
    while r * 4 < h {
        let off = jm(r, 2) != 0 ? 4.0 : 0.0
        var bx = -off
        while bx < w {
            let bxx = max(bx, 0)
            let bw = min(bx + 7, w) - bxx
            if bw > 0 {
                let n = hash(r * 31 + bx * 7 + x0)
                let col = n > 0.7 ? P.brickL : n < 0.25 ? P.brickD : P.brick
                L.R(x0 + bxx, y0 + r * 4, bw, 3, col)
                L.HL(x0 + bxx, y0 + r * 4, bw, mix(col, hx("#ffffff"), 0.08))
            }
            bx += 8
        }
        r += 1
    }
}

func drawFireplace(_ L: Layer) {
    // chimney breast, on the back wall behind the couch
    let cx = FireBox.cx
    let x0 = cx - 28
    drawBricks(L, x0, 5, 56, FLOOR_Y - 5)
    L.VL(x0, 5, FLOOR_Y - 5, P.brickD)
    L.VL(x0 + 55, 5, FLOOR_Y - 5, hx("#6d3c2e"))
    // (the picture over the mantel is our wall's: drawGallery and drawWallArt)
    // mantel shelf
    L.R(x0 - 6, 54, 68, 6, P.mantel)
    L.HL(x0 - 6, 54, 68, P.mantelL)
    L.HL(x0 - 6, 59, 68, P.mantelD)
    L.R(x0 - 4, 60, 64, 2, P.mantelD)
    // stone surround
    L.R(x0 + 4, 62, 48, FLOOR_Y - 62, P.stone)
    L.VL(x0 + 4, 62, FLOOR_Y - 62, P.stoneL)
    L.VL(x0 + 51, 62, FLOOR_Y - 62, P.stoneD)
    var y = 66.0
    while y < FLOOR_Y {
        var x = x0 + 6 + jm(y / 7, 2) * 4
        while x < x0 + 50 {
            L.HL(x, y, 6, P.stoneD)
            L.S(x, y - 1, P.stoneL)
            x += 9
        }
        y += 7
    }
    // opening (arched)
    let ox = FireBox.openX, ow = FireBox.openW, oy = FireBox.openY, ob = FireBox.openB
    var j = oy
    while j < ob {
        let t = Int(j - oy)
        let inset: Double = t < 5 ? FIRE_ARCH[t] : 0
        L.R(ox + inset, j, ow - inset * 2, 1, P.soot)
        // keystone edge
        L.S(ox + inset - 1, j, P.stoneDD)
        L.S(ox + ow - inset, j, P.stoneDD)
        j += 1
    }
    L.R(ox + 12, oy - 3, 5, 3, P.stoneL)
    L.HL(ox + 12, oy - 3, 5, hx("#cbc1b4"))
    // back bricks inside, very dark
    y = oy + 8
    while y < ob - 4 {
        var x = ox + 3 + jm(y / 4, 2) * 3
        while x < ox + ow - 4 {
            L.HL(x, y, 4, P.sootL)
            x += 6
        }
        y += 4
    }
    // hearth slab (the couch hides most of it)
    L.R(x0 - 4, 116, 64, 6, P.stone)
    L.HL(x0 - 4, 116, 64, P.stoneL)
    L.HL(x0 - 4, 121, 64, P.stoneDD)
    L.VL(x0 - 4, 116, 6, P.stoneL)
    L.VL(x0 + 59, 116, 6, P.stoneDD)
    // grate
    L.R(ox + 5, ob - 3, ow - 10, 1, hx("#2a2020"))
    var gx = ox + 6
    while gx < ox + ow - 6 {
        L.VL(gx, ob - 6, 3, hx("#3a2c2a"))
        gx += 3
    }

    // on the mantel: a photo of you two at one end, two candles (their flames animate later) at the other
    L.R(x0 - 5, 42, 14, 12, P.woodD)
    L.R(x0 - 4, 43, 12, 10, hx("#e6d6b8"))
    L.R(x0 - 3, 44, 10, 8, hx("#c6a489"))
    L.R(x0 + 46, 49, 3, 5, hx("#efe3cb"))
    L.VL(x0 + 48, 49, 5, hx("#cdbf9f"))
    L.R(x0 + 51, 46, 3, 8, hx("#efe3cb"))
    L.VL(x0 + 53, 46, 8, hx("#cdbf9f"))
}

/// Where the fireplace used to be: a sideboard under the painting, with books, a sprig in a jar and a lamp.
func drawSideboard(_ L: Layer) {
    // centred under the painting, with a little room before the door
    let x = 103.0
    let w = 50.0
    let top = 98.0
    // legs
    L.R(x + 3, FLOOR_Y - 3, 3, 3, P.woodD)
    L.R(x + w - 6, FLOOR_Y - 3, 3, 3, P.woodD)
    // body, and two doors with brass knobs
    L.R(x, top + 3, w, FLOOR_Y - 3 - (top + 3), P.wood)
    L.VL(x, top + 3, FLOOR_Y - 3 - (top + 3), P.woodL)
    L.VL(x + w - 1, top + 3, FLOOR_Y - 3 - (top + 3), P.woodD)
    for dx in [3, w / 2 + 1] {
        L.R(x + dx, top + 6, w / 2 - 4, FLOOR_Y - 3 - (top + 9), P.woodD)
        L.R(x + dx + 1, top + 7, w / 2 - 6, FLOOR_Y - 3 - (top + 11), P.wood)
    }
    L.S(x + w / 2 - 3, top + 12, P.brassL)
    L.S(x + w / 2 + 3, top + 12, P.brassL)
    // top
    L.R(x - 2, top, w + 4, 3, P.woodL)
    L.HL(x - 2, top, w + 4, mix(P.woodL, hx("#ffffff"), 0.15))
    L.HL(x - 2, top + 2, w + 4, P.woodD)
    // books lying flat
    L.R(x + 3, top - 3, 14, 3, hx("#7a5068"))
    L.HL(x + 3, top - 3, 14, hx("#936580"))
    L.R(x + 5, top - 6, 11, 3, hx("#4f6583"))
    L.HL(x + 5, top - 6, 11, hx("#6a80a0"))
    L.R(x + 4, top - 8, 12, 2, P.mustard)
    // a sprig in a little jar
    L.R(x + 21, top - 5, 4, 5, hx("#c4dcef"))
    L.HL(x + 21, top - 5, 4, hx("#e6f0f8"))
    for (lx, ly) in [(22.0, -7.0), (23, -9), (24, -11), (21, -10), (25, -8), (23, -12)] { L.S(x + lx, top + ly, P.leaf) }
    // the lamp: brass stand, glowing shade
    let lx = x + w - 9
    L.R(lx - 3, top - 2, 7, 2, P.brass)
    L.VL(lx, top - 10, 8, P.brass)
    for ji in 0..<9 {
        let j = Double(ji)
        let half = 3 + fl(j / 2.5)
        var i = -half
        while i <= half {
            let edge = i == -half || i == half || ji == 8
            L.G(lx + i, top - 19 + j, edge ? hx("#e8c787") : ji < 2 ? hx("#fbeec8") : hx("#f6e0a8"))
            i += 1
        }
    }
    L.R(lx - 4, top - 20, 9, 1, hx("#d6b577"))
    L.UG(lx - 4, top - 20, 9, 1)
}

func drawGallery(_ L: Layer) {
    func frame(_ x: Double, _ y: Double, _ w: Double, _ h: Double, _ paint: (Int, Int) -> RGB) {
        L.R(x - 1, y - 1, w + 2, h + 2, P.woodD)
        L.R(x, y, w, h, P.frame)
        for j in 2..<(Int(h) - 2) { for i in 2..<(Int(w) - 2) { L.S(x + Double(i), y + Double(j), paint(i - 2, j - 2)) } }
    }
    // botanical print
    frame(266, 22, 18, 24) { i, j in
        let stem = i == 6 && j > 3
        let leaf = (abs(i - 6) == 2 && j % 5 == 2) || (abs(i - 6) == 3 && j % 5 == 3)
        return stem || leaf ? P.sageD : hx("#efe3cb")
    }
    // "us": a little heart stitched in thread red
    let heart = [
        "..##...##..",
        ".####.####.",
        "###########",
        "###########",
        ".#########.",
        "..#######..",
        "...#####...",
        "....###....",
        ".....#.....",
    ].map { Array($0) }
    frame(216, 26, 30, 22) { i, j in
        let hi = i - 7
        let hj = j - 4
        if hj >= 0 && hj < heart.count && hi >= 0 && hi < 11 && heart[hj][hi] == "#" { return hx("#a84f4b") }
        return (i + j) % 2 != 0 ? hx("#e8d9bc") : hx("#eadcc0")
    }
    // abstract sun
    frame(289, 30, 20, 16) { i, j in
        let d = (i - 8) * (i - 8) + (j - 12) * (j - 12)
        if d < 30 { return P.mustard }
        return j > 9 ? P.couch : hx("#e9d7b7")
    }
}

/** A small, very dark door between the chimney and the pictures. */
func drawDarkDoor(_ L: Layer) {
    let x = DoorBox.x, y = DoorBox.y, w = DoorBox.w
    let h = FLOOR_Y - y
    // frame with a rounded top
    for ji in 0..<Int(h) {
        let j = Double(ji)
        var i = -2.0
        while i < w + 2 {
            let top = j < 6 && pow(i + 0.5 - w / 2, 2) + pow((j - 6) * 2, 2) > pow(w / 2 + 2, 2)
            if !top {
                let frame = i < 0 || i >= w || j < 2
                L.S(x + i, y + j, frame ? hx("#2a1f1a") : hx("#1d1519"))
            }
            i += 1
        }
    }
    // panels
    for (px, py) in [(3.0, 8.0), (13, 8), (3, 30), (13, 30)] { L.R(x + px, y + py, 8, 18, hx("#241b22")) }
    L.VL(x + w - 1, y + 3, h - 3, hx("#140f12"))
    // iron hinges and handle
    for hy in [12, h - 14] { L.R(x, y + hy, 4, 2, hx("#3a3437")) }
    L.R(x + w - 5, y + 30, 2, 3, hx("#4a4046"))
}

func drawLamp(_ L: Layer) {
    // floor lamp at the couch's right
    let x = 290.0
    L.R(x - 5, 147, 11, 3, P.brass)
    L.HL(x - 5, 147, 11, P.brassL)
    L.VL(x, 70, 77, P.brass)
    L.VL(x + 1, 70, 77, hx("#8a6a36"))
    // shade (glowing)
    for ji in 0..<16 {
        let j = Double(ji)
        let half = 6 + fl(j / 2.2)
        var i = -half
        while i <= half {
            let edge = i == -half || i == half || ji == 15
            L.G(x + i, 54 + j, edge ? hx("#e8c787") : ji < 3 ? hx("#fbeec8") : hx("#f6e0a8"))
            i += 1
        }
    }
    L.R(x - 6, 53, 13, 1, hx("#d6b577"))
    L.UG(x - 6, 53, 13, 1)
}

/// the website mixes the book spines toward '#fff', which it reads as rgb(255, 15, nothing): this is that
private func mixShortWhite(_ c: RGB, _ t: Double) -> RGB {
    func ch(_ a: UInt8, _ b: Double) -> UInt8 { UInt8(clamping: Int(jsRound(Double(a) + (b - Double(a)) * t))) }
    return RGB(ch(c.r, 255), ch(c.g, 15), 0)
}

func drawBookshelf(_ L: Layer) {
    let x = 308.0
    L.R(x, 60, 14, 90, P.woodD)
    L.R(x + 1, 61, 13, 88, P.wood)
    let bookColors = [hx("#7a5068"), hx("#4f6583"), P.mustard, P.sage, P.couch, hx("#efe3cb"), hx("#4d6b52")]
    for si in 0..<4 {
        let sy = 62 + Double(si) * 22
        L.R(x + 1, sy + 19, 13, 2, P.woodL)
        var bx = x + 2
        var k = si * 3
        while bx < x + 13 {
            let kd = Double(k)
            let bw = 2 + Double(i32(hash(kd) * 2))
            let bh = 12 + Double(i32(hash(kd + 9) * 6))
            let c = bookColors[k % bookColors.count]
            L.R(bx, sy + 19 - bh, bw, bh, c)
            L.HL(bx, sy + 19 - bh + 2, bw, mixShortWhite(c, 0.25))
            bx += bw
            k += 1
        }
    }
}

func drawRug(_ L: Layer, _ rug: String) {
    let x0 = 92.0, x1 = 306.0, y0 = 140.0, y1 = 176.0
    if rug == "braided" {
        // a braided oval: rings of colour, with a little twist in each
        let cx = 199.0, cy = 158.0, rx = 104.0, ry = 18.0
        let rings = [P.rugB, P.rugA, P.rugC, P.mustard, P.rugD, P.rugB, P.rugA, P.rugC]
        var y = y0 - 2
        while y <= y1 + 1 {
            var x = x0
            while x <= x1 {
                let d = pow((x - cx) / rx, 2) + pow((y - cy) / ry, 2)
                if d <= 1 {
                    let ring = min(rings.count - 1, Int(fl((1 - sqrt(d)) * Double(rings.count))))
                    let c = rings[ring]
                    L.S(x, y, Int(jm(x + Double(ring) * 2, 4)) == 0 ? mix(c, hx("#3a2418"), 0.15) : c)
                }
                x += 1
            }
            y += 1
        }
        return
    }
    let bands = [P.rugB, P.rugA, P.sage, P.mustard]
    var y = y0
    while y <= y1 {
        let inset = jsRound((y1 - y) * 0.22) // slight perspective: narrower at the back
        var x = x0 + inset
        while x <= x1 - inset {
            let bx = x - (x0 + inset)
            let bxR = x1 - inset - x
            let by = y - y0
            let byB = y1 - y
            let border = bx < 3 || bxR < 3 || by < 2 || byB < 2
            let inner = bx == 4 || bxR == 4 || by == 3 || byB == 3
            var c = P.rugA
            if rug == "moss" {
                c = border ? P.rugA : inner ? P.sageD : hash(x * 3 + y * 7) > 0.8 ? hx("#7f8f68") : P.sage
            } else if rug == "kilim" {
                let band = fl((by - 3) / 4)
                let zig = jm(by - 3, 4) == 0 && jm(Double(i32(x) >> 1) + band, 2) == 0
                let bi = Int(jm(jm(zig ? band - 1 : band, 4) + 4, 4))
                c = border ? P.rugB : inner ? P.rugA : bands[bi]
            } else if rug == "checker" {
                let sq = jm(fl((x - 99) / 9) + fl((y - 140) / 5), 2)
                c = border ? P.sageD : inner ? P.rugA : sq != 0 ? P.rugA : P.sage
            } else {
                if border { c = P.rugC }
                else if inner { c = P.rugB }
                else {
                    // diamonds
                    let u = jm(x - 199, 16)
                    let v = jm(y - 158, 10)
                    let du = abs(jm(u + 16, 16) - 8)
                    let dv = abs(jm(v + 10, 10) - 5)
                    if du * 0.62 + dv < 3.2 { c = jm(du + dv, 3) < 1 ? P.rugB : P.rugD }
                }
            }
            L.S(x, y, c)
            x += 1
        }
        y += 1
    }
    // fringe
    var x = x0 + 1
    while x <= x1 {
        L.S(x, y1 + 1, P.rugD)
        L.S(x, y1 + 2, P.cream)
        x += 2
    }
}

/** Darken whatever is already there (so shadows work on any rug). */
func shade(_ L: Layer, _ xd: Double, _ yd: Double, _ k: Double) {
    let x = ti(xd), y = ti(yd)
    if x < 0 || y < 0 || x >= L.w || y >= L.h { return }
    let i = (y * L.w + x) * 4
    L.data[i] = clamp8(Double(L.data[i]) * (1 - k) + 58 * k)
    L.data[i + 1] = clamp8(Double(L.data[i + 1]) * (1 - k) + 36 * k)
    L.data[i + 2] = clamp8(Double(L.data[i + 2]) * (1 - k) + 24 * k)
}

struct CouchLook {
    let c: RGB, l: RGB, d: RGB, dd: RGB
    let pillowA: (RGB, RGB)
    let pillowB: (RGB, RGB)
    let dots: RGB
    let blanket: (RGB, RGB, RGB)
}
let RUST = (hx("#b8674f"), hx("#95513e"), hx("#cc7c62"))
let SAGE_THROW = (P.sage, P.sageD, hx("#a2b187"))
let COUCHES: [String: CouchLook] = [
    "terracotta": CouchLook(c: P.couch, l: P.couchL, d: P.couchD, dd: P.couchDD, pillowA: (P.mustard, P.mustardD), pillowB: (P.cream, P.creamD), dots: P.couch, blanket: SAGE_THROW),
    "sage": CouchLook(c: hx("#7f9068"), l: hx("#94a57c"), d: hx("#66754f"), dd: hx("#4f5b3d"), pillowA: (P.mustard, P.mustardD), pillowB: (P.cream, P.creamD), dots: hx("#b8674f"), blanket: RUST),
    "mustard": CouchLook(c: hx("#c48f3a"), l: hx("#d8a64e"), d: hx("#a1742a"), dd: hx("#7e5a20"), pillowA: (P.sage, P.sageD), pillowB: (P.cream, P.creamD), dots: P.sageD, blanket: RUST),
    "linen": CouchLook(c: hx("#d6c3a0"), l: hx("#e6d6b6"), d: hx("#b9a483"), dd: hx("#978265"), pillowA: (hx("#b8674f"), hx("#95513e")), pillowB: (P.sage, P.sageD), dots: P.cream, blanket: RUST),
    "navy": CouchLook(c: hx("#3e5277"), l: hx("#51678f"), d: hx("#2f405f"), dd: hx("#233049"), pillowA: (P.mustard, P.mustardD), pillowB: (P.cream, P.creamD), dots: hx("#3e5277"), blanket: RUST),
    "plum": CouchLook(c: hx("#7a4a62"), l: hx("#8f5d77"), d: hx("#613a4e"), dd: hx("#4a2c3c"), pillowA: (P.mustard, P.mustardD), pillowB: (P.cream, P.creamD), dots: hx("#7a4a62"), blanket: SAGE_THROW),
    "rose": CouchLook(c: hx("#c08681"), l: hx("#d39d97"), d: hx("#a26b66"), dd: hx("#82504c"), pillowA: (P.cream, P.creamD), pillowB: (P.sage, P.sageD), dots: hx("#c08681"), blanket: SAGE_THROW),
    "teal": CouchLook(c: hx("#4f8a83"), l: hx("#65a199"), d: hx("#3d6e68"), dd: hx("#2d524d"), pillowA: (P.mustard, P.mustardD), pillowB: (P.cream, P.creamD), dots: hx("#4f8a83"), blanket: RUST),
    "lavender": CouchLook(c: hx("#8b78ad"), l: hx("#a090c1"), d: hx("#705e8e"), dd: hx("#55476f"), pillowA: (P.cream, P.creamD), pillowB: (P.mustard, P.mustardD), dots: hx("#8b78ad"), blanket: SAGE_THROW),
]

func drawCouch(_ L: Layer, _ look: String) {
    let k = COUCHES[look] ?? COUCHES["terracotta"]!
    let x = CouchBox.x, y = CouchBox.y, w = CouchBox.w, seatY = CouchBox.seatY, baseY = CouchBox.baseY
    let armW = 12.0
    let armTop = seatY - 7
    // shadow on rug
    var i = -1.0
    while i < w + 2 {
        shade(L, x + i, baseY + 1, 0.4)
        i += 1
    }
    i = 2
    while i < w - 1 {
        shade(L, x + i, baseY + 2, 0.2)
        i += 1
    }
    // back rest
    var j = 0.0
    while j <= seatY - y {
        let inset: Double = j == 0 ? 3 : j == 1 ? 1 : 0
        var ii = 4 + inset
        while ii < w - 4 - inset {
            var c = k.c
            if j < 2 { c = k.l } else if j > seatY - y - 3 { c = k.d }
            L.S(x + ii, y + j, c)
            ii += 1
        }
        j += 1
    }
    // two back cushions
    let mid = fl(w / 2)
    L.VL(x + mid, y + 2, seatY - y - 2, k.d)
    L.VL(x + mid + 1, y + 2, seatY - y - 2, k.l)
    // seat cushions (front face)
    for jj in 0..<6 {
        var ii = armW - 1
        while ii < w - armW + 1 {
            var c = jj < 2 ? k.l : jj < 4 ? k.c : k.d
            if ii == mid || ii == mid + 1 { c = jj < 4 ? k.d : k.dd }
            L.S(x + ii, seatY + Double(jj), c)
            ii += 1
        }
    }
    // base
    L.R(x + 2, seatY + 6, w - 4, baseY - seatY - 8, k.dd)
    L.HL(x + 2, seatY + 6, w - 4, k.d)
    // legs
    for lx in [x + 4, x + w - 7] {
        L.R(lx, baseY - 2, 3, 3, P.woodD)
        L.S(lx, baseY - 2, P.woodL)
    }
    // rolled arms
    func arm(_ ax: Double, _ flip: Bool) {
        var j = 0.0
        while j < baseY - 2 - armTop {
            let inset: Double = j == 0 ? 2 : j == 1 ? 1 : 0
            var i = inset
            while i < armW - inset {
                let ii = flip ? armW - 1 - i : i
                var c = k.c
                if j < 2 { c = k.l } else if ii > armW - 3 { c = k.d } else if ii < 2 { c = k.l }
                if j > baseY - armTop - 7 { c = k.dd }
                L.S(ax + i, armTop + j, c)
                i += 1
            }
            j += 1
        }
        L.HL(ax + 3, armTop + 3, armW - 6, k.d)
    }
    arm(x, false)
    arm(x + w - armW, true)
    // throw pillows tucked against the arms
    func pillow(_ px: Double, _ c: RGB, _ cd: RGB, _ pattern: Bool) {
        for j in 0..<10 {
            for i in 0..<11 {
                if (j == 0 || j == 9) && (i == 0 || i == 10) { continue }
                var cc = j > 6 || i > 8 ? cd : c
                if pattern && (i + j * 2) % 5 == 0 && j > 1 && j < 8 { cc = k.dots }
                L.S(px + Double(i), seatY - 9 + Double(j), cc)
            }
        }
    }
    pillow(x + armW - 2, k.pillowA.0, k.pillowA.1, false)
    pillow(x + w - armW - 9, k.pillowB.0, k.pillowB.1, true)
    // knitted blanket draped over the right arm
    let bx = x + w - armW - 1
    for jj in 0..<14 {
        let from = jj < 3 ? 2 : 0
        let to = jj < 3 ? Int(armW) + 1 : Int(armW) - 3 + min(jj, 3)
        if from < to {
            for ii in from..<to {
                let c = ((jj >> 1) + (ii >> 2)) % 2 != 0 ? k.blanket.0 : k.blanket.1
                L.S(bx + Double(ii), armTop - 1 + Double(jj), jj == 0 ? k.blanket.2 : c)
            }
        }
    }
    var ii = 0.0
    while ii < armW {
        L.S(bx + ii, armTop + 13, P.cream)
        ii += 2
    }
}

func drawTable(_ L: Layer) {
    let x = TableBox.x, y = TableBox.y, w = TableBox.w
    L.R(x, y, w, 3, P.woodL)
    L.HL(x, y, w, hx("#9a6d50"))
    L.R(x + 1, y + 3, w - 2, 2, P.woodD)
    for lx in [x + 3, x + w - 6] { L.R(lx, y + 5, 3, 10, P.wood) }
    L.R(x + 6, y + 11, w - 12, 2, P.woodD)
    // rug shadow
    var i = 2.0
    while i < w - 2 {
        shade(L, x + i, y + 15, 0.3)
        i += 1
    }
    // mugs
    L.R(x + 6, y - 5, 5, 5, P.cream)
    L.VL(x + 10, y - 5, 5, P.creamD)
    L.R(x + 4, y - 4, 2, 2, P.creamD)
    L.HL(x + 6, y - 5, 5, hx("#6b4633"))
    // TV remote: tap it to watch something together
    L.R(x + 38, y - 2, 7, 2, hx("#2c2527"))
    L.S(x + 39, y - 2, hx("#c4453f"))
    L.S(x + 41, y - 2, hx("#8a9a72"))
    L.S(x + 43, y - 2, hx("#e6d6b8"))
    L.R(x + w - 14, y - 5, 5, 5, P.sage)
    L.VL(x + w - 10, y - 5, 5, P.sageD)
    L.R(x + w - 16, y - 4, 2, 2, P.sageD)
    L.HL(x + w - 14, y - 5, 5, hx("#6b4633"))
}

func drawPlant(_ L: Layer, _ plant: String) {
    func pot(_ c: RGB, _ cl: RGB, _ cd: RGB) {
        L.R(4, 150, 20, 18, c)
        L.R(3, 149, 22, 3, cl)
        L.VL(22, 152, 16, cd)
        L.VL(23, 152, 16, cd)
    }
    if plant == "snake" {
        pot(hx("#e6d6b8"), hx("#f0e3c8"), hx("#bba888"))
        // back blades first; each is lit on one edge, banded across the middle, a thin yellow margin
        let blades: [(Double, Double, Double)] = [(12, 30, -0.22), (17, 33, 0.14), (8, 37, -0.1), (11, 46, -0.03), (15, 41, 0.06)]
        for (bx, len, lean) in blades {
            var j = 0.0
            while j < len {
                let cx = jsRound(bx + lean * j)
                let y = 149 - j
                if j > len - 4 {
                    L.S(cx, y, hx("#4f6e3a"))
                    j += 1
                    continue
                }
                let band = jm(j + bx, 7) < 2
                L.S(cx - 1, y, hx("#b9bf6e"))
                L.S(cx, y, band ? hx("#6f8f4e") : hx("#3f5e30"))
                L.S(cx + 1, y, band ? hx("#56763e") : hx("#2f4a25"))
                L.S(cx + 2, y, hx("#a4a95c"))
                j += 1
            }
        }
        return
    }
    if plant == "fern" {
        pot(P.sage, hx("#a2b187"), P.sageD)
        // arching fronds, each lined with little leaflets that shrink toward the tip
        for f in 0..<9 {
            let fd = Double(f)
            let dir = (fd - 4) / 4
            let len = 28 - abs(fd - 4) * 1.5
            var x = 14 + dir * 2, y = 149.0
            let vx = dir * 0.85
            var vy = -(1 - abs(dir) * 0.45)
            var s = 0.0
            while s < len {
                x += vx
                y += vy
                vy += 0.012 + abs(dir) * 0.03
                let n = hypot(vx, vy)
                let nx = -vy / n, ny = vx / n
                if s > 2 {
                    let leaflet = 1 + jsRound(3 * (1 - s / len))
                    var k = 1.0
                    while k <= leaflet {
                        let c = k == leaflet ? P.leafL : P.leaf
                        L.S(x + nx * k - (vx / n) * k * 0.4, y + ny * k - (vy / n) * k * 0.4, c)
                        L.S(x - nx * k - (vx / n) * k * 0.4, y - ny * k - (vy / n) * k * 0.4, c)
                        k += 1
                    }
                }
                L.S(x, y, P.leafD)
                s += 1
            }
        }
        return
    }
    if plant == "cactus" {
        pot(P.pot, hx("#cf7f64"), P.potD)
        let green = hx("#5f8a4e"), light = hx("#7aa462"), dark = hx("#466b39")
        func column(_ x: Double, _ top: Int, _ bottom: Int, _ wdt: Int) {
            for j in top..<bottom {
                for i in 0..<wdt {
                    let round = j == top && (i == 0 || i == wdt - 1)
                    if round { continue }
                    L.S(x + Double(i), Double(j), i == 0 ? light : i == wdt - 1 ? dark : (i + j) % 4 == 0 ? hx("#c9d8a0") : green)
                }
            }
        }
        column(10, 112, 149, 7)
        // arms
        column(4, 124, 132, 4)
        L.R(6, 131, 5, 3, green)
        column(18, 118, 128, 4)
        L.R(16, 127, 4, 3, green)
        // a pink flower on top
        L.S(13, 110, hx("#e895ab"))
        L.S(12, 111, hx("#e895ab"))
        L.S(14, 111, hx("#e895ab"))
        L.S(13, 111, hx("#f6d36b"))
        return
    }
    if plant == "lemon" {
        pot(hx("#e6d6b8"), hx("#f0e3c8"), hx("#bba888"))
        L.R(13, 118, 2, 32, P.woodD)
        L.VL(13, 118, 32, P.wood)
        for j in -14...14 {
            for i in -15...15 {
                let di = Double(i), dj = Double(j)
                let d = pow(di / 15, 2) + pow(dj / 13, 2)
                if d > 1 || (d > 0.55 && hash(di * 7 + dj * 13) > 0.9) { continue }
                L.S(14 + di, 106 + dj, d > 0.7 ? P.leafD : hash(di * 3 + dj) > 0.6 ? P.leafL : P.leaf)
            }
        }
        for (lx, ly) in [(6.0, 104.0), (18, 98), (22, 110), (11, 113), (15, 104), (3, 110)] {
            L.R(lx, ly, 2, 2, hx("#f1e35a"))
            L.S(lx, ly, hx("#fff6a8"))
            L.S(lx + 1, ly + 1, hx("#cfbf3e"))
        }
        return
    }
    // the big leafy plant (front-left, partly out of frame)
    pot(P.pot, hx("#cf7f64"), P.potD)
    func leaf(_ cx: Double, _ cy: Double, _ len: Double, _ ang: Double) {
        var t = 0.0
        while t < len {
            let px = cx + cos(ang) * t
            let py = cy + sin(ang) * t
            let wdt = sin((t / len) * Double.pi) * 3.2
            var k = -wdt
            while k <= wdt {
                let nx = px + cos(ang + Double.pi / 2) * k
                let ny = py + sin(ang + Double.pi / 2) * k
                L.S(nx, ny, k > 1.5 ? P.leafL : k < -1.5 ? P.leafD : P.leaf)
                k += 0.5
            }
            L.S(px, py, P.leafD)
            t += 1
        }
    }
    let leaves: [(Double, Double, Double, Double)] = [
        (14, 150, 26, -1.9), (14, 150, 28, -1.35), (14, 150, 24, -0.9), (14, 150, 22, -2.4), (14, 150, 20, -0.5),
        (13, 150, 30, -1.6), (15, 150, 18, -0.2), (13, 150, 16, -2.9),
    ]
    for l in leaves { leaf(l.0, l.1, l.2, l.3) }
}

/** A little side table by the couch's right arm, with records on its shelf. */
func drawSideTable(_ L: Layer) {
    let x = SideTableBox.x, y = SideTableBox.y, w = SideTableBox.w
    // shadow on the rug
    var i = 0.0
    while i < w {
        shade(L, x + i, 150, 0.35)
        i += 1
    }
    // legs
    for lx in [x + 1, x + w - 3] {
        L.R(lx, y + 3, 2, 17, P.woodD)
        L.VL(lx, y + 3, 17, P.wood)
    }
    // a shelf of records: sleeves standing on end
    let spines = [P.cream, P.rugB, P.sage, P.mustard, hx("#5a79a3"), P.creamD, hx("#3a2a26"), P.rugB, P.cream]
    for (idx, c) in spines.enumerated() {
        let h: Double = 7 - (idx % 3 == 1 ? 1 : 0)
        L.R(x + 3 + Double(idx) * 1.6, y + 11 - h + 7, 2, h, c)
    }
    L.R(x + 3, y + 18, w - 6, 2, P.wood)
    L.HL(x + 3, y + 18, w - 6, P.woodL)
    // table top
    L.R(x, y, w, 3, P.wood)
    L.HL(x, y, w, P.woodL)
    L.HL(x + 1, y + 2, w - 2, P.woodD)
}
