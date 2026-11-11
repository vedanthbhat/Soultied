import Foundation

/* The parts of the room that move, and the light. From src/pixel/room.ts. */

/** The middle picture over the couch: whatever you've hung there, and a note tucked in when there's news. */
func drawWallArt(_ L: Layer, _ state: RoomState, _ t: Double) {
    if let a = state.wallArt, a.px.count == a.w * a.h {
        // the frame's opening is 26 x 18, from (218, 28); the picture is 24 wide, with a strip of mat each side
        L.R(218, 28, 26, 18, hx("#e8d9bc"))
        let ox = 218 + (26 - min(26, a.w)) / 2
        for j in 0..<min(18, a.h) {
            for i in 0..<min(26, a.w) {
                guard let k = Int(String(a.px[j * a.w + i]), radix: 16), k < a.pal.count else { continue }
                L.set(ox + i, 28 + j, a.pal[k])
            }
        }
    }
    if state.hover == .board {
        for i in 215..<247 {
            L.G(Double(i), 25, hx("#fff1c9"), 170)
            L.G(Double(i), 48, hx("#fff1c9"), 170)
        }
        for j in 25..<49 {
            L.G(215, Double(j), hx("#fff1c9"), 170)
            L.G(246, Double(j), hx("#fff1c9"), 170)
        }
    }
    if state.wallNews {
        // a little yellow note pinned over the corner, twinkling now and then
        let bob: Double = sin(t * 2.2) > 0.75 ? -1 : 0
        let x = 240.0
        let y = 41 + bob
        L.R(x, y, 7, 6, hx("#f2d66b"))
        L.R(x, y + 5, 7, 1, hx("#d9b84a"))
        let ink = hx("#a58a3a")
        L.S(x + 1, y + 2, ink)
        L.S(x + 2, y + 2, ink)
        L.S(x + 4, y + 2, ink)
        L.S(x + 1, y + 3, ink)
        L.S(x + 3, y + 3, ink)
        L.G(x + 3, y - 1, hx("#e0605a"))
        L.G(x + 3, y, hx("#c4453f"))
        if Int(fl(t * 1.6)) % 3 == 0 { L.G(x + 6, y - 1, hx("#fff1c9")) }
    }
}

func drawDoorGlow(_ L: Layer, _ t: Double, _ hover: Bool) {
    let x = DoorBox.x, y = DoorBox.y, w = DoorBox.w
    let pulse = 0.5 + 0.5 * sin(t * 1.6)
    let leak = hover ? hx("#d9c2ff") : pulse > 0.5 ? hx("#9d7ad6") : hx("#7e5fb3")
    var i = 1.0
    while i < w - 1 {
        L.G(x + i, FLOOR_Y - 1, leak)
        i += 1
    }
    // a faint puddle of light on the floor boards
    let puddle = mix(leak, hx("#6f4b31"), 0.55)
    i = 2
    while i < w - 2 {
        if jm(i + fl(t * 2), 3) != 0 { L.G(x + i, FLOOR_Y, puddle) }
        i += 1
    }
    // keyhole
    L.G(x + w - 5, y + 35, hover ? hx("#fff4ff") : hx("#c9a8ff"))
    L.G(x + w - 5, y + 36, hover ? hx("#e8d8ff") : hx("#9d7ad6"))
    if hover {
        var j = 2.0
        while j < FLOOR_Y - y {
            L.G(x - 3, y + j, hx("#e8d8ff"))
            L.G(x + w + 2, y + j, hx("#e8d8ff"))
            j += 2
        }
    }
}

let FIRE_COLS = [hx("#fff4c2"), hx("#ffd36b"), hx("#f7a23e"), hx("#e66a2c"), hx("#b8402a")]

func drawFire(_ L: Layer, _ t: Double, _ intensity: Double) {
    let ox = FireBox.openX, ow = FireBox.openW, ob = FireBox.openB
    let base = ob - 6
    // logs
    L.R(ox + 6, base, ow - 12, 3, hx("#4a2e20"))
    L.HL(ox + 6, base, ow - 12, hx("#6a4430"))
    L.R(ox + 9, base - 2, 11, 3, hx("#3a2418"))
    L.S(ox + 6, base + 1, hx("#c9a27a"))
    L.S(ox + ow - 7, base + 1, hx("#c9a27a"))
    // embers
    var i = ox + 7
    while i < ox + ow - 7 {
        if hash(i * 3 + fl(t * 6)) > 0.55 { L.G(i, base + 2, hash(i + t) > 0.5 ? hx("#ff8a3d") : hx("#e0582a")) }
        i += 1
    }
    // flames: a column height field that wobbles
    let cx = ox + ow / 2
    let maxH = 18 + intensity * 8
    i = ox + 6
    while i < ox + ow - 6 {
        let d = abs(i - cx) / (ow / 2 - 6)
        let wob = sin(t * 9 + i * 0.9) * 2.2 + sin(t * 13.7 + i * 1.7) * 1.4 + (hash(i * 13 + fl(t * 10)) - 0.5) * 3
        let hgt = max(0, maxH * (1 - d * d) + wob)
        var j = 0.0
        while j < hgt {
            let r = j / hgt // 0 bottom -> 1 tip
            let k = r < 0.25 ? 0 : r < 0.45 ? 1 : r < 0.7 ? 2 : r < 0.9 ? 3 : 4
            let inner = d < 0.35 ? max(0, k - 1) : k
            L.G(i, base - 1 - j, FIRE_COLS[min(4, inner)])
            j += 1
        }
        i += 1
    }
    // sparks
    for si in 0..<5 {
        let s = Double(si)
        let life = jm(t * 0.9 + s * 0.21, 1)
        let sx = cx + sin(s * 12.3 + t * 2) * 8
        let sy = base - 10 - life * 26
        if life < 0.85 && sy > FireBox.openY + 2 { L.G(sx, sy, life < 0.5 ? hx("#ffd36b") : hx("#f7a23e")) }
    }
}

func drawCandles(_ L: Layer, _ t: Double) {
    for (cx, cy) in [(99.0, 45.0), (104, 48)] {
        let f: Double = sin(t * 11 + cx) > 0.3 ? 1 : 0
        L.G(cx, cy - 1 - f, hx("#fff4c2"))
        L.G(cx, cy, hx("#ffd36b"))
        L.G(cx + (f != 0 ? 0 : 1), cy - 2 - f, hx("#f7a23e"))
    }
}

/** What moves outside the window. */
func drawWeather(_ L: Layer, _ t: Double, _ view: String) {
    let x = WinBox.x, y = WinBox.y, w = WinBox.w, h = WinBox.h
    func put(_ wxd: Double, _ wyd: Double, _ c: RGB, _ a: Double = 255) {
        let wx = Double(i32(wxd)), wy = Double(i32(wyd))
        if wx < 0 || wy < 0 || wx >= w || wy >= h || onMullion(wx, wy) { return }
        if a >= 255 { L.G(x + wx, y + wy, c) } else { L.S(x + wx, y + wy, c, a) }
    }
    if view == "rain" {
        // streaks falling at a slant, and a few drops running down the glass
        for ki in 0..<30 {
            let k = Double(ki)
            let speed = 70 + hash(k) * 30
            let sy = jm(hash(k * 3.7) * h + t * speed, h + 6)
            let sx = jm(hash(k * 1.3) * w + sy * 0.3, w)
            for di in 0..<3 {
                let d = Double(di)
                put(sx - d * 0.3, sy - d, di == 0 ? hx("#a9bad3") : hx("#7f91ad"), di == 0 ? 255 : 170)
            }
        }
        for ki in 0..<4 {
            let k = Double(ki)
            let life = jm(t * 0.08 + hash(k * 9), 1)
            put(4 + hash(k * 2.3) * (w - 8), life * h, hx("#b7c6dd"))
            put(4 + hash(k * 2.3) * (w - 8), life * h - 1, hx("#8fa0bb"), 160)
        }
    } else if view == "summer" {
        // fireflies drifting low over the hills, blinking
        for ki in 0..<8 {
            let k = Double(ki)
            if sin(t * 2.1 + k * 2.7) < 0.1 { continue }
            let fx = hash(k * 4.1) * w + sin(t * 0.5 + k) * 4
            let fy = h * 0.55 + hash(k * 6.3) * h * 0.38 + cos(t * 0.7 + k * 1.3) * 3
            put(fx, fy, hx("#f3fbb0"))
            put(fx - 1, fy, hx("#b9d65a"), 200)
            put(fx + 1, fy, hx("#b9d65a"), 200)
            put(fx, fy - 1, hx("#b9d65a"), 160)
        }
    } else if view == "blossom" {
        // petals on the breeze
        for ki in 0..<12 {
            let k = Double(ki)
            let life = jm(t * (0.05 + hash(k) * 0.04) + hash(k * 2.9), 1)
            let px = jm(hash(k * 1.7) * w + life * 30 + sin(t * 1.5 + k) * 2, w)
            let py = life * h
            put(px, py, ki % 3 != 0 ? hx("#f2b8c6") : hx("#fbe0e6"))
            if ki % 2 != 0 { put(px + 1, py, hx("#e895ab"), 200) }
        }
    } else if view == "city" {
        // windows going on and off
        for (ki, (wx, wy)) in CITY.windows.enumerated() {
            let k = Double(ki)
            if hash(k * 1.9 + fl(t / 4 + hash(k) * 4)) > 0.42 { put(wx, wy, ki % 7 != 0 ? hx("#f6c46a") : hx("#f3e2b0")) }
        }
    } else if view == "aurora" {
        // rippling curtains of light: brightest along the bottom edge, rays fading upward
        for ii in 0..<Int(w) {
            let i = Double(ii)
            let top = 4 + sin(i * 0.16 + t * 0.6) * 4 + sin(i * 0.05 - t * 0.35) * 3
            let len = 10 + sin(i * 0.3 + t) * 3 + hash(i) * 2
            let ray = 0.6 + 0.4 * sin(i * 0.9 + t * 1.7) * sin(i * 0.37 - t * 0.8)
            var j = 0.0
            while j < len {
                let f = j / len
                let c = f < 0.45 ? hx("#2c8f78") : f < 0.85 ? hx("#4fdc9c") : hx("#b4ffdc")
                put(i, top + j, c, jsRound(ray * (50 + 190 * f)))
                j += 1
            }
        }
    } else {
        // snow
        for ki in 0..<26 {
            let k = Double(ki)
            let speed = 5 + hash(k) * 6
            let sy = Double(i32(jm(hash(k * 3.7) * h + t * speed, h)))
            let sx = Double(i32(jm(hash(k * 1.3) * w + sin(t * 1.3 + k) * 2 + w, w)))
            put(sx, sy, hash(k * 9) > 0.5 ? hx("#e8eef6") : hx("#b7c3db"))
        }
    }
}

/** The picture over the mantel. */
func drawPainting(_ L: Layer, _ painting: String, _ state: RoomState) {
    let px = 111.0, py = 16.0, pw = 34.0, ph = 24.0
    L.R(px - 2, py - 2, pw + 4, ph + 4, P.mantelD)
    L.R(px - 1, py - 1, pw + 2, ph + 2, P.brass)
    func paint(_ fn: (Double, Double) -> RGB) {
        for j in 0..<Int(ph) { for i in 0..<Int(pw) { L.S(px + Double(i), py + Double(j), fn(Double(i), Double(j))) } }
    }
    func disc(_ cx: Double, _ cy: Double, _ r: Int, _ c: RGB) {
        for j in -r...r { for i in -r...r where i * i + j * j <= r * r { L.S(px + cx + Double(i), py + cy + Double(j), c) } }
    }
    switch painting {
    case "sea":
        paint { i, j in
            if j < 13 { return j < 5 ? hx("#cfe0e6") : j < 10 ? hx("#e2dcc4") : hx("#efd5ad") }
            return jm(i * 2 + j * 5, 11) == 0 ? hx("#8fb0c4") : j > 19 ? hx("#4f7592") : hx("#5f86a3")
        }
        for j in -3...0 { for i in -3...3 where i * i + j * j <= 9 { L.S(px + 24 + Double(i), py + 12 + Double(j), hx("#f6dc9c")) } }
        // a little boat
        L.HL(px + 7, py + 15, 8, hx("#6b4633"))
        L.HL(px + 8, py + 16, 6, hx("#4d3224"))
        for j in 0..<6 { L.HL(px + 11 - Double(j / 2), py + 9 + Double(j), Double(j / 2) + 1, hx("#efe3cb")) }
        L.VL(px + 11, py + 8, 7, hx("#4d3224"))
    case "peaks":
        paint { _, j in j < 8 ? hx("#1f2a48") : j < 15 ? hx("#26325a") : hx("#2f3b52") }
        disc(26, 5, 3, hx("#f4ecd0"))
        for (sx, sy) in [(4.0, 3.0), (12, 2), (19, 6), (31, 11), (8, 9)] { L.S(px + sx, py + sy, hx("#c9d2ea")) }
        func peak(_ cx: Double, _ top: Double, _ half: Double) {
            var j = top
            while j < ph {
                let span = jsRound(((j - top) / (ph - top)) * half * 1.8)
                var i = cx - span
                while i <= cx + span {
                    if i >= 0 && i < pw { L.S(px + i, py + j, j - top < 4 ? hx("#e6ecf2") : jm(i + j, 5) == 0 ? hx("#5d6e8a") : hx("#4f5f7a")) }
                    i += 1
                }
                j += 1
            }
        }
        peak(11, 7, 9)
        peak(24, 10, 8)
        for i in 0..<Int(pw) { for j in 21..<Int(ph) { L.S(px + Double(i), py + Double(j), hx("#2a3448")) } }
    case "flowers":
        // a still life: a terracotta jug of flowers on a table, against a cream wall
        paint { i, j in
            j < 17 ? (jm(i * 3 + j * 7, 13) == 0 ? hx("#dcc7a2") : hx("#e7d6b4")) : j == 17 ? hx("#7a4f38") : jm(i + j, 7) == 0 ? hx("#9a6748") : hx("#8c5b3f")
        }
        // jug
        for j in 0..<8 {
            let half = j < 1 ? 2 : j < 2 ? 3 : j < 6 ? 4 : 3
            for i in -half...half { L.S(px + 17 + Double(i), py + 11 + Double(j), i == -half ? hx("#d98f70") : i >= half - 1 ? hx("#95513e") : hx("#b8674f")) }
        }
        L.HL(px + 15, py + 13, 5, hx("#efe3cb"))
        // stems and leaves
        for (sx, sy) in [(12.0, 5.0), (17, 2), (22, 5), (14, 8), (20, 8)] { L.VL(px + sx, py + sy + 1, 11 - sy, hx("#5f7550")) }
        for (lx, ly, d) in [(13.0, 9.0, -1.0), (21, 9, 1), (16, 6, -1), (18, 6, 1)] {
            L.S(px + lx, py + ly, hx("#7d9468"))
            L.S(px + lx + d, py + ly - 1, hx("#7d9468"))
        }
        func bloom(_ cx: Double, _ cy: Double, _ c: RGB, _ mid: RGB) {
            L.S(px + cx, py + cy - 1, c)
            L.S(px + cx - 1, py + cy, c)
            L.S(px + cx + 1, py + cy, c)
            L.S(px + cx, py + cy + 1, c)
            L.S(px + cx, py + cy, mid)
        }
        bloom(12, 5, hx("#e8b04a"), hx("#a7772b"))
        bloom(17, 2, hx("#d9566a"), hx("#8e2f3e"))
        bloom(22, 5, hx("#f6efe0"), hx("#e8b04a"))
        bloom(14, 8, hx("#e98a9c"), hx("#b8674f"))
        bloom(20, 8, hx("#e8b04a"), hx("#a7772b"))
        // a lemon beside it
        L.R(px + 25, py + 16, 3, 2, hx("#e8c64a"))
        L.S(px + 28, py + 17, hx("#c9a83a"))
    case "shapes":
        paint { _, _ in hx("#efe3cb") }
        for j in 8..<Int(ph) {
            for i in 0..<15 {
                let dx = i - 7
                if j < 15 && dx * dx + (j - 15) * (j - 15) > 49 { continue }
                L.S(px + Double(i), py + Double(j), hx("#b8674f"))
            }
        }
        disc(25, 7, 5, P.mustard)
        for i in 15..<Int(pw) {
            let top = jsRound(17 + sin(Double(i - 15) * 0.25) * 2)
            var j = top
            while j < ph {
                L.S(px + Double(i), py + j, P.sage)
                j += 1
            }
        }
        L.R(px + 2, py + 2, 5, 3, hx("#3e5277"))
    case "us":
        // a portrait of the two of you, under a soft arch
        paint { i, j in
            let dx = i - pw / 2 + 0.5
            let inArch = j > 6 ? abs(dx) < 13 : dx * dx + (j - 7) * (j - 7) * 2.6 < 169
            return inArch ? hx("#d9b98e") : hx("#ead6b5")
        }
        func head(_ seat: Seat, _ ox: Double) {
            guard let av = seat.avatar, seat.status != .empty else { return }
            let r = renderCharacter(av, .stand)
            let buf = r.buf
            let top = max(0, r.headTop - 3)
            for j in 0..<(Int(ph) - 1) {
                for i in 2..<22 {
                    if top + j >= buf.h { continue }
                    let k = ((top + j) * buf.w + i) * 4
                    if buf.data[k + 3] == 0 { continue }
                    L.S(px + ox + Double(i) - 2, py + 1 + Double(j), RGB(buf.data[k], buf.data[k + 1], buf.data[k + 2]))
                }
            }
        }
        head(state.left, -1)
        head(state.right, 14)
    default:
        // dusk hills
        for ji in 0..<Int(ph) {
            let j = Double(ji)
            for ii in 0..<Int(pw) {
                let i = Double(ii)
                let t = j / ph
                var c = t < 0.3 ? hx("#e9b97a") : t < 0.5 ? hx("#e39a6a") : hx("#d8866a")
                let hill1 = ph * 0.55 + sin(i * 0.25) * 3
                let hill2 = ph * 0.72 + sin(i * 0.17 + 2) * 2
                if j > hill1 { c = hx("#8a9a72") }
                if j > hill2 { c = hx("#6a7856") }
                if j > hill1 && j < hill1 + 1 { c = hx("#a2b187") }
                L.S(px + i, py + j, c)
            }
        }
        for j in -3...3 { for i in -3...3 where i * i + j * j <= 9 { L.S(px + 22 + Double(i), py + 10 + Double(j), hx("#f6dc9c")) } }
        for ii in 0..<Int(pw) {
            let i = Double(ii)
            let hill1 = (ph * 0.55 + sin(i * 0.25) * 3).rounded(.up)
            var j = hill1
            while j < ph {
                let hill2 = ph * 0.72 + sin(i * 0.17 + 2) * 2
                L.S(px + i, py + j, j > hill2 ? hx("#6a7856") : j == hill1 ? hx("#a2b187") : hx("#8a9a72"))
                j += 1
            }
        }
    }
}

func drawSteam(_ L: Layer, _ t: Double) {
    for mx in [TableBox.x + 8, TableBox.x + TableBox.w - 12] {
        for ki in 0..<3 {
            let life = jm(t * 0.6 + Double(ki) / 3 + mx * 0.01, 1)
            let sy = TableBox.y - 7 - life * 12
            let sx = mx + sin(life * 6 + mx) * 1.5
            if life < 0.8 { L.S(sx, sy, hx("#e9e0d0"), jsRound(200 * (1 - life))) }
        }
    }
}

func drawLetter(_ L: Layer, _ t: Double, _ unread: Bool, _ hover: Bool) {
    let x = TableBox.x + 21
    let y = TableBox.y - 6
    let lift: Double = unread ? (sin(t * 3) > 0.6 ? 1 : 0) : 0
    func paper(_ px: Double, _ py: Double, _ c: RGB) { if unread { L.G(px, py, c) } else { L.S(px, py, c) } }
    for j in 0..<6 { for i in 0..<14 { paper(x + Double(i), y - lift + Double(j), j == 5 ? hx("#d8c9ad") : hx("#f4ead6")) } }
    // flap
    for i in 0..<7 {
        paper(x + Double(i), y - lift + Double(i / 2), hx("#d6c5a6"))
        paper(x + 13 - Double(i), y - lift + Double(i / 2), hx("#d6c5a6"))
    }
    // wax seal in thread red
    L.R(x + 6, y - lift + 3, 2, 2, hx("#a84f4b"))
    L.UG(x + 6, y - lift + 3, 2, 2)
    if unread {
        let s = Double(Int(fl(t * 2)) % 2)
        L.G(x + 15, y - 3 - s, hx("#ffe7a3"))
        L.G(x + 16, y - 4 - s, hx("#fff4c2"))
        L.G(x + 14, y - 4 - s, hx("#ffe7a3"))
        L.G(x + 15, y - 5 - s, hx("#ffe7a3"))
    }
    if hover {
        for i in -1...14 {
            L.G(x + Double(i), y - lift - 1, hx("#fff4c2"))
            L.G(x + Double(i), y - lift + 6, hx("#fff4c2"))
        }
        L.G(x - 1, y - lift + 2, hx("#fff4c2"))
        L.G(x + 14, y - lift + 2, hx("#fff4c2"))
    }
}

/** Board games stacked on the floor beside the couch, with a die on top. */
func drawGameStack(_ L: Layer, _ t: Double, _ waiting: Bool, _ hover: Bool) {
    func box(_ x: Double, _ y: Double, _ w: Double, _ h: Double, _ c: RGB, _ stripe: RGB? = nil) {
        L.R(x - 1, y - 1, w + 2, h + 2, hx("#2b1e1c"))
        L.R(x, y, w, h, c)
        L.HL(x, y, w, mix(c, hx("#fff8ea"), 0.35))
        L.VL(x + w - 1, y + 1, h - 1, mix(c, hx("#2b1e1c"), 0.3))
        if let s = stripe { L.HL(x + 1, y + fl(h / 2), w - 3, s) }
    }
    let x = GamesBox.x, y = GamesBox.y
    box(x + 1, y + 13, 12, 3, hx("#d4775b"), hx("#f4e3c0"))
    box(x + 2, y + 9, 10, 3, hx("#9fb087"))
    L.S(x + 4, y + 10, hx("#f0b84d"))
    L.S(x + 6, y + 10, hx("#f0b84d"))
    box(x + 1, y + 5, 12, 3, hx("#6a86ad"), hx("#f0b84d"))
    // a die on top
    L.R(x + 5, y + 1, 4, 3, hx("#2b1e1c"))
    L.R(x + 5, y + 1, 3, 3, hx("#f7eedb"))
    L.S(x + 6, y + 2, hx("#3a2a26"))
    if waiting {
        // a firefly hovering over the stack: something's waiting for you
        let bob = Double(Int(fl(t * 2)) % 2)
        let fx = x + 11
        let fy = y - 3 - bob
        L.G(fx, fy, hx("#fff4c2"))
        L.G(fx - 1, fy, hx("#ffcf5a"))
        L.G(fx + 1, fy, hx("#ffcf5a"))
        L.G(fx, fy - 1, hx("#ffcf5a"))
        L.G(fx, fy + 1, hx("#e2a33a"))
    }
    if hover {
        var i = -1.0
        while i <= GamesBox.w {
            L.G(x + i, y - 2, hx("#fff4c2"))
            L.G(x + i, y + GamesBox.h, hx("#fff4c2"))
            i += 1
        }
        var j = -1.0
        while j < GamesBox.h {
            L.G(x - 2, y + j, hx("#fff4c2"))
            L.G(x + GamesBox.w + 1, y + j, hx("#fff4c2"))
            j += 2
        }
    }
}

/** The record player on the side table; the record turns and notes drift up while it plays. */
func drawTurntable(_ L: Layer, _ t: Double, _ playing: Bool, _ hover: Bool) {
    let x = DeckBox.x, y = DeckBox.y, w = DeckBox.w
    let lid = hx("#e6d6b8")
    // the lid, propped open behind (clear plastic catching the lamp light)
    var i = 1.0
    while i < w - 1 {
        L.S(x + i, y - 9, lid, 150)
        L.S(x + i, y - 8, lid, 40)
        i += 1
    }
    var j = y - 8
    while j < y - 2 {
        L.S(x + 1, j, lid, 120)
        L.S(x + w - 2, j, lid, 120)
        var ii = 2.0
        while ii < w - 2 {
            L.S(x + ii, j, lid, 22)
            ii += 1
        }
        j += 1
    }
    // plinth: a pale top plate on a wooden box
    L.R(x, y, w, 2, hx("#b9a98f"))
    L.HL(x, y, w, hx("#d8c7a4"))
    L.R(x, y + 2, w, 3, hx("#7a5540"))
    L.HL(x, y + 2, w, hx("#8f6649"))
    L.HL(x, y + 4, w, hx("#4d3224"))
    // a brass knob, and a little light that's on while it plays
    L.S(x + w - 3, y + 3, P.brassL)
    if playing { L.G(x + 2, y + 3, hx("#ffb347")) } else { L.S(x + 2, y + 3, hx("#3a2a26")) }
    // the record (seen from a little above)
    let cx = x + 7
    for (ry, half) in [(y - 2, 3.0), (y - 1, 5), (y, 6), (y + 1, 5)] {
        L.HL(cx - half, ry, half * 2 + 1, hx("#1f1718"))
        L.S(cx - half, ry, hx("#3a3035"))
        L.S(cx + half, ry, hx("#3a3035"))
    }
    // grooves catch the lamp light
    L.HL(cx - 4, y - 1, 2, hx("#3a3035"))
    L.HL(cx + 3, y + 1, 2, hx("#3a3035"))
    // the label
    L.S(cx, y - 1, P.rugB)
    L.S(cx + 1, y - 1, P.cream)
    L.S(cx, y, P.cream)
    if playing {
        // a glint going round
        let a = t * 3.5
        let gx = jsRound(cx + cos(a) * 5)
        let gy = jsRound(y - 0.5 + sin(a) * 1.4)
        L.S(gx, gy, hx("#8a7f86"))
    }
    // tonearm: resting at the side, or across the record
    let px = x + w - 4
    let py = y - 1
    L.S(px, py, P.brassL)
    L.S(px + 1, py, P.brass)
    if playing {
        L.S(px - 1, py, hx("#cfc3b0"))
        L.S(px - 2, py, hx("#cfc3b0"))
        L.S(px - 3, py + 1, hx("#cfc3b0"))
        L.S(px - 4, py + 1, hx("#e6d6b8"))
    } else {
        L.S(px, py + 1, hx("#cfc3b0"))
        L.S(px + 1, py + 2, hx("#cfc3b0"))
        L.S(px + 1, py + 3, hx("#e6d6b8"))
    }
    if playing {
        // notes drifting up and fading
        for ki in 0..<3 {
            let k = Double(ki)
            let life = jm(t * 0.45 + k / 3, 1)
            let nx = jsRound(cx - 2 + k * 4 + sin((t + k) * 2) * 1.5 + life * 3)
            let ny = jsRound(y - 5 - life * 16)
            let alpha = jsRound(255 * (life < 0.2 ? life / 0.2 : 1 - (life - 0.2) / 0.8))
            let c = ki == 1 ? hx("#fff4c2") : hx("#f4d9a8")
            L.S(nx, ny, c, alpha)
            L.S(nx + 1, ny, c, alpha)
            L.S(nx + 1, ny - 1, c, alpha)
            L.S(nx + 1, ny - 2, c, alpha)
            L.S(nx + 2, ny - 2, c, alpha)
        }
    }
    if hover {
        let hxx = SideTableBox.x - 2
        let hw = SideTableBox.w + 3
        var i2 = 0.0
        while i2 <= hw {
            L.G(hxx + i2, y - 11, hx("#fff4c2"))
            L.G(hxx + i2, 151, hx("#fff4c2"))
            i2 += 1
        }
        var j2 = y - 11
        while j2 <= 151 {
            L.G(hxx, j2, hx("#fff4c2"))
            L.G(hxx + hw, j2, hx("#fff4c2"))
            j2 += 2
        }
    }
}

/** the pet's cushion, on the rug in front of the couch's left arm, between the games and the coffee table */
struct PetBox { static let x = 186.0, y = 153.0 }

let PET_SPRITES: [String: (rows: [String], pal: [Character: RGB], dx: Double, dy: Double)] = [
    "hamster": ([
        "....pp................",
        "...pPpoooooooo........",
        "..oOOOOOOOOOOOoo......",
        ".oOkOOOOOOOOOOOOo.....",
        "onOOOWWWWWOOOOOOo.....",
        ".oWWWWWWWWWWWOOOo.....",
        "..ooooooooooooooo.....",
    ], ["o": hx("#b9803f"), "O": hx("#e0a95c"), "W": hx("#fbf1df"), "k": hx("#2b2224"), "n": hx("#e3a9a9"), "p": hx("#e3a9a9"), "P": hx("#f3c5c5")], 1, -2),
    "duck": ([
        "..........yyyyy.......",
        "..yyy...yyYYYYYyy.....",
        ".yYYYy.yYYYYYYYYYy....",
        "byYkYYyYYYYYYYYYYYy...",
        "bbYYYYYYYYYYYYYYYYYy..",
        "..yYYYYYYYYYYYYYYYy...",
        "...yyyyyyyyyyyyyyy....",
    ], ["y": hx("#d4a12e"), "Y": hx("#f6d55c"), "b": hx("#e07a3a"), "k": hx("#2b2224")], -1, -2),
    "frog": ([
        ".gg..gg...............",
        "gLkggkLg..............",
        "gGGGGGGGgggggggg......",
        "gGGGGGGGGGGGGGGGgg....",
        "gmmmmmGGGGGGGGGGGGg...",
        ".gGGGGGGGGGGGGGGGGg...",
        "..gLLggggggggggLLg....",
    ], ["g": hx("#3f6630"), "G": hx("#79ab58"), "L": hx("#a3d27e"), "k": hx("#24381c"), "m": hx("#24381c")], 0, -2),
    "sausage": ([
        ".oo...................",
        "oOOo.oooooooooooooo...",
        "OkOOOOOOOOOOOOOOOOOOo.",
        "OOOOOOOOOOOOOOOOOOOOOt",
        "nOOOOOOOOOOOOOOOOOOOo.",
        ".oOOOooooooooooooOOo..",
        "..ll.............ll...",
    ], ["o": hx("#6b3f25"), "O": hx("#a1653a"), "k": hx("#2b2224"), "n": hx("#2b2224"), "t": hx("#6b3f25"), "l": hx("#6b3f25")], -2, -2),
    "fox": ([
        ".o.o..................",
        "oOOOo..ooooooooo......",
        "OkOOOOoOOOOOOOOOOo.WW.",
        "WWOOOOOOOOOOOOOOOOOWWW",
        ".WWWOOOOOOOOOOOOOOoWW.",
        "..WWWWOOOOOOOOOOOOOo..",
        "...oooooooooooooooo...",
    ], ["o": hx("#b5562a"), "O": hx("#e07a3a"), "W": hx("#fbf1df"), "k": hx("#2b2224")], -2, -2),
    "piglet": ([
        "..pp..................",
        ".pPPp.pppppppppp......",
        "pPkPPPPPPPPPPPPPPp....",
        "nnPPPPPPPPPPPPPPPPp..c",
        "nNnPPPPPPPPPPPPPPPPpc.",
        ".pPPPPPPPPPPPPPPPPp...",
        "..pppppppppppppppp....",
    ], ["p": hx("#c47a82"), "P": hx("#f0b0b5"), "k": hx("#2b2224"), "n": hx("#e38e96"), "N": hx("#7a3a40"), "c": hx("#c47a82")], -2, -2),
    "pug": ([
        ".kk.....oooooooo......",
        "kOOk..ooOOOOOOOOoo....",
        "OOOOooOOOOOOOOOOOOo...",
        "OkOOOOOOOOOOOOOOOOOo.t",
        "mmmOOOOOOOOOOOOOOOOOot",
        "kmnmOOOOOOOOOOOOOOOo..",
        ".kk.oooooooooooooooo..",
    ], ["o": hx("#a87c4c"), "O": hx("#d1a56c"), "k": hx("#2b2224"), "m": hx("#463739"), "n": hx("#141012"), "t": hx("#a87c4c")], -2, -2),
    "bunny": ([
        "...eeeeeee............",
        "..eppppppee..wwwww....",
        ".wweeeeeeewwwWWWWWw...",
        "wWWWWWWWWWWWWWWWWWWw..",
        "wkWWWWWWWWWWWWWWWWWWw.",
        "nWWWWWWWWWWWWWWWWWWWcc",
        ".wwwwwwwwwwwwwwwwwwwcc",
    ], ["w": hx("#bfb5a8"), "W": hx("#eee7db"), "e": hx("#d3c8b9"), "p": hx("#e3a9a9"), "n": hx("#d98c8c"), "k": hx("#4e4240"), "c": hx("#fbf8f2")], -2, -2),
    "corgi": ([
        ".o...o................",
        "oOo.oOo..ooooooooo....",
        "oOOOOOOoOOOOOOOOOOOo..",
        "OOkOkOOOOOOOOOOOOOOOo.",
        "WWWWWWOOOOOOOOOOOOOOOo",
        ".nWWWWWWWWWOOOOOOOOOo.",
        "..WWWWWWWWWWWWWoooo...",
    ], ["o": hx("#b86e33"), "O": hx("#d98c4a"), "W": hx("#f3ebdf"), "k": hx("#3a2a26"), "n": hx("#2b2224")], -2, -2),
]

/** The cat's curl: shared by the ginger and the tuxedo. */
func drawCatCurl(_ L: Layer, _ t: Double, _ dark: RGB, _ light: RGB, _ face: RGB, _ tuxedo: Bool) {
    let x = PetBox.x, y = PetBox.y
    let breath: Double = sin(t * 2.2) > 0 ? 1 : 0
    let body = [
        ".....oooooooo.......",
        "...ooOOOOOOOOoo.....",
        "..oOOOoooOOOOOOo..o.",
        ".oOOOooOOOoOOOOOooOo",
        "oOOOOOOOOOOOOOOOOOo.",
        "oOOOOOOOOOOOOOOOOOo.",
        ".ooooooooooooooooo..",
    ]
    let pal: [Character: RGB] = ["o": dark, "O": light]
    for (j, row) in body.enumerated() {
        for (i, k) in row.enumerated() where k != "." {
            let c = pal[k]!
            L.S(x + Double(i), y - 2 + Double(j) + (j < 2 ? -breath : 0), c)
            if breath != 0 && j == 1 { L.S(x + Double(i), y - 1, c) }
        }
    }
    // head tucked in on the left
    L.R(x - 1, y + 1, 6, 4, face)
    L.S(x - 1, y, dark)
    L.S(x + 3, y, dark)
    if tuxedo {
        // white muzzle and bib, and white front paws
        L.R(x, y + 3, 4, 2, hx("#efe8dc"))
        L.R(x + 4, y + 3, 3, 2, hx("#efe8dc"))
        L.S(x + 6, y + 4, hx("#efe8dc"))
        L.S(x + 1, y + 2, hx("#5a4c4e"))
        L.S(x + 3, y + 2, hx("#5a4c4e"))
    } else {
        L.S(x, y + 3, hx("#5a3a2c"))
        L.S(x + 2, y + 3, hx("#5a3a2c"))
    }
    L.S(x + 1, y + 4, hx("#e9a0a0"))
    // tail tip swish
    let sw: Double = sin(t * 1.3) > 0.7 ? 1 : 0
    L.S(x + 20, y + 4 - sw, dark)
}

func drawPet(_ L: Layer, _ t: Double, _ pet: String) {
    let x = PetBox.x, y = PetBox.y
    // cushion
    for j in 0..<6 {
        for i in 0..<26 {
            let corner = (j == 0 || j == 5) && (i < 2 || i > 23)
            if corner { continue }
            L.S(x - 3 + Double(i), y + 4 + Double(j), j < 2 ? hx("#a2b187") : j > 3 ? P.sageD : P.sage)
        }
    }
    if pet == "none" { return }
    if pet == "tuxedo" {
        drawCatCurl(L, t, hx("#26201f"), hx("#3b3334"), hx("#3b3334"), true)
    } else if pet == "smoky" {
        drawCatCurl(L, t, hx("#5d595e"), hx("#8b878c"), hx("#8b878c"), false)
    } else if let sp = PET_SPRITES[pet] {
        let breath: Double = sin(t * 2.2) > 0 ? 1 : 0
        // the back rises and falls; the head stays put
        for (j, row) in sp.rows.enumerated() {
            for (i, k) in row.enumerated() where k != "." {
                guard let c = sp.pal[k] else { continue }
                let lift = j < 2 && i >= 10 ? breath : 0
                L.S(x + sp.dx + Double(i), y + sp.dy + Double(j) - lift, c)
                // breathing in: the back gets a pixel taller rather than floating off
                if lift != 0 && j == 1 { L.S(x + sp.dx + Double(i), y + sp.dy + Double(j), c) }
            }
        }
        if pet == "pug" && sin(t * 1.3) > 0.7 { L.S(x + sp.dx + 21, y + sp.dy + 3, sp.pal["t"]!) }
    } else {
        drawCatCurl(L, t, hx("#b86e33"), hx("#d98c4a"), hx("#d98c4a"), false)
    }
    // zzz
    let zl = jm(t * 0.5, 1)
    if zl < 0.7 {
        let zx = x - 2 - zl * 3
        let zy = y - 4 - zl * 10
        let a = jsRound(220 * (1 - zl))
        let c = hx("#e9e0d0")
        L.S(zx, zy, c, a)
        L.S(zx + 1, zy, c, a)
        L.S(zx + 1, zy + 1, c, a)
        L.S(zx, zy + 2, c, a)
        L.S(zx + 1, zy + 2, c, a)
    }
}

/// a person's colours for the little portrait on the mantel never change, so they're worked out once
private var portraitCache: [AvatarConfig: (RGB, RGB, RGB)] = [:]
private let portraitLock = NSLock()

func drawPhotoPortrait(_ L: Layer, _ state: RoomState) {
    // tiny portrait of the couple in the mantel frame
    func put(_ seat: Seat, _ x: Double) {
        guard let av = seat.avatar else {
            L.R(x, 47, 3, 3, hx("#b39278"))
            return
        }
        portraitLock.lock()
        var cols = portraitCache[av]
        portraitLock.unlock()
        if cols == nil {
            let r = renderCharacter(av, .stand)
            func pick(_ px: Int, _ py: Int) -> RGB? {
                let i = (py * r.buf.w + px) * 4
                if r.buf.data[i + 3] == 0 { return nil }
                return RGB(r.buf.data[i], r.buf.data[i + 1], r.buf.data[i + 2])
            }
            cols = (pick(12, r.headTop - 1) ?? hx("#4a3129"), pick(9, r.headTop + 7) ?? hx("#dca77c"), pick(12, r.headTop + 14) ?? hx("#8a9a72"))
            portraitLock.lock()
            portraitCache[av] = cols
            portraitLock.unlock()
        }
        let (hairPx, skinPx, topPx) = cols!
        L.R(x, 45, 4, 2, hairPx)
        L.R(x, 47, 4, 2, skinPx)
        L.R(x - 1, 49, 6, 3, topPx)
    }
    put(state.left, 140)
    put(state.right, 145)
}

/// a seated person's frames are the same every time for the same look, so they're kept
private var sitCache: [String: RenderedCharacter] = [:]
private let sitLock = NSLock()

private func sitting(_ av: AvatarConfig, _ f: CharacterFrame) -> RenderedCharacter {
    let key = "\(av.hashValue)|\(f.blink)|\(f.bob)|\(f.sleepy)"
    sitLock.lock()
    if let hit = sitCache[key] {
        sitLock.unlock()
        return hit
    }
    sitLock.unlock()
    let r = renderCharacter(av, .sit, f)
    sitLock.lock()
    if sitCache.count > 64 { sitCache.removeAll() }
    sitCache[key] = r
    sitLock.unlock()
    return r
}

/**
 * One person on the couch. `lift` hops them up a pixel while they scoot along;
 * `lean` tips their head toward the other person once they're side by side.
 * Gives back where the top of their head is.
 */
func seatCharacter(_ L: Layer, _ seat: Seat, _ cx: Double, _ t: Double, _ phase: Double, _ hover: Bool, _ lift: Double = 0, _ lean: Double = 0, _ bubble: Bool = false) -> Double {
    guard let av = seat.avatar, seat.status != .empty else { return 0 }
    let blink = jm(t + phase, 4.2) < 0.12
    let bob = lift != 0 ? 0 : sin((t + phase) * 1.6) > 0.55 ? 1 : 0
    let asleep = seat.status == .offline || seat.status == .away
    let r = sitting(av, CharacterFrame(blink: blink, bob: bob, sleepy: asleep))
    let buf = r.buf
    let x = cx - Double(r.anchor.x)
    let y = CouchBox.seatY - Double(r.anchor.y) - lift
    if lean != 0 {
        // the head (everything above the shoulders) shifts; the body stays put
        let neck = r.headTop + 9
        let head = PixelBuffer(buf.w, buf.h)
        let body = PixelBuffer(buf.w, buf.h)
        for j in 0..<buf.h {
            for i in 0..<buf.w {
                let k = (j * buf.w + i) * 4
                if buf.data[k + 3] == 0 { continue }
                let dst = j < neck ? head : body
                for c in 0..<4 { dst.data[k + c] = buf.data[k + c] }
            }
        }
        L.blit(body, ti(x), ti(y))
        L.blit(head, ti(x + lean), ti(y))
    } else {
        L.blit(buf, ti(x), ti(y))
    }
    if hover {
        // soft rim highlight
        for j in 0..<buf.h {
            for i in 0..<buf.w {
                if buf.alphaAt(i, j) == 0 { continue }
                let edge = buf.alphaAt(i - 1, j) == 0 || buf.alphaAt(i + 1, j) == 0 || buf.alphaAt(i, j - 1) == 0
                if edge { L.G(x + Double(i), y + Double(j), hx("#fff1c9"), 150) }
            }
        }
    }
    if asleep && !bubble {
        let zl = jm(t * 0.45 + phase, 1)
        let zx = cx + 7 + zl * 4
        let zy = y + 6 - zl * 12
        let a = jsRound(230 * (1 - zl))
        for (dx, dy) in [(0.0, 0.0), (1, 0), (2, 0), (1, 1), (0, 2), (1, 2), (2, 2)] { L.S(zx + dx, zy + dy, hx("#f1e6cf"), a) }
    }
    return y + Double(r.headTop)
}

/** A little thought bubble over someone's head, with how they're feeling in it. */
func drawMoodBubble(_ L: Layer, _ g: Glyph, _ cx: Double, _ headY: Double, _ side: HotspotId, _ t: Double, _ phase: Double) {
    let gw = g.width
    let gh = Double(g.rows.count)
    let bw = gw + 4
    let bh = gh + 4
    let bob: Double = sin((t + phase) * 1.8) > 0.6 ? -1 : 0
    let bottom = headY - 4 + bob
    let x0 = side == .left ? cx - 3 - bw : cx + 4
    let y0 = bottom - bh
    let ink = hx("#3a2a26")
    let paper = hx("#fbf1dc")
    for j in 0..<Int(bh) {
        for i in 0..<Int(bw) {
            let corner = (i == 0 || i == Int(bw) - 1) && (j == 0 || j == Int(bh) - 1)
            if corner { continue }
            let edge = i == 0 || j == 0 || i == Int(bw) - 1 || j == Int(bh) - 1
            L.G(x0 + Double(i), y0 + Double(j), edge ? ink : paper)
        }
    }
    // two little dots trailing down to the head
    let tx = side == .left ? x0 + bw - 2 : x0 + 1
    let dir: Double = side == .left ? 1 : -1
    L.G(tx + dir, bottom + 1, paper)
    L.G(tx + dir * 2, bottom + 2, paper)
    L.G(tx + dir * 2, bottom + 3, ink)
    let ox = x0 + 2
    let oy = y0 + 2
    for (j, row) in g.rows.enumerated() {
        for (i, k) in row.enumerated() {
            if let c = g.pal[k] { L.G(ox + Double(i), oy + Double(j), c) }
        }
    }
}

/** A touch's picture, floating up from between them (or popping over the one who got booped). */
func drawTouchFx(_ L: Layer, _ tc: RoomTouch, _ age: Double, _ lx: Double, _ rx: Double, _ headL: Double, _ headR: Double) {
    let g = tc.glyph
    let gw = g.width
    func put(_ x: Double, _ y: Double, _ a: Double) {
        for (j, row) in g.rows.enumerated() {
            for (i, k) in row.enumerated() {
                if let c = g.pal[k] { L.G(jsRound(x) + Double(i), jsRound(y) + Double(j), c, a) }
            }
        }
    }
    if tc.kind == "boop" {
        // a "!" over the one who got booped
        if age < 0.35 || age > 1.6 { return }
        let tx = tc.from == .left ? rx : lx
        let h0 = tc.from == .left ? headR : headL
        let hy = h0 != 0 ? h0 : CouchBox.seatY - 30
        put(tx - fl(gw / 2), hy - 9 - min(2, (age - 0.35) * 6), 255)
        return
    }
    if tc.kind == "highfive" {
        // a flash where their hands meet, then it floats off
        if age < 0.55 { return }
        let a = age < 1.1 ? (Int(fl(age * 12)) % 2 != 0 ? 255 : 170) : jsRound(255 * max(0, (TOUCH_LEN - age) / (TOUCH_LEN - 1.1)))
        put((lx + rx) / 2 - fl(gw / 2), CouchBox.seatY - 34 - max(0, age - 1.1) * 5, a)
        return
    }
    // a hug, a kiss, a forehead kiss, holding hands: rises from between them once they're close
    let start = 0.55
    if age < start { return }
    let k = age - start
    let a = jsRound(255 * min(1, max(0, (TOUCH_LEN - age) / 0.7)))
    let top = min(headL != 0 ? headL : 999, headR != 0 ? headR : 999)
    let y = (top < 999 ? top - 8 : CouchBox.seatY - 38) - k * 5
    put((lx + rx) / 2 - fl(gw / 2) + sin(k * 4) * 1.2, y, a)
}

func drawEmptySeat(_ L: Layer, _ cx: Double, _ t: Double, _ hover: Bool) {
    // a dotted silhouette + blinking "+" that says: this spot is waiting
    let y = CouchBox.seatY - 28
    let pulse: Double = sin(t * 2.5) > 0 ? 1 : 0
    let col = hover ? hx("#fff1c9") : hx("#f1e3c4")
    for ji in 0..<27 {
        let j = Double(ji)
        for ii in -8...8 {
            let i = Double(ii)
            let inHead = ji < 11 && (i + 0.5) * (i + 0.5) / 36 + (j - 5.5) * (j - 5.5) / 30 <= 1
            let inBody = ji >= 12 && abs(i) <= 7 - (ji < 14 ? 1 : 0)
            if !inHead && !inBody { continue }
            let e1 = (i + 1.5) * (i + 1.5) / 36 + (j - 5.5) * (j - 5.5) / 30 > 1
            let e2 = (i - 0.5) * (i - 0.5) / 36 + (j - 5.5) * (j - 5.5) / 30 > 1
            let e3 = (i + 0.5) * (i + 0.5) / 36 + (j - 6.5) * (j - 6.5) / 30 > 1
            let e4 = (i + 0.5) * (i + 0.5) / 36 + (j - 4.5) * (j - 4.5) / 30 > 1
            let edgeHead = inHead && (e1 || e2 || e3 || e4)
            let edgeBody = inBody && (abs(i) == 7 - (ji < 14 ? 1 : 0) || ji == 12)
            if (edgeHead || edgeBody) && Int(jm(i + j + fl(t * 4), 2)) == 0 { L.G(cx + i, y + j, col, hover ? 255 : 170) }
        }
    }
    // plus badge
    let bx = cx
    let by = y + 17 - pulse
    L.R(bx - 3, by - 3, 7, 7, hx("#a84f4b"))
    L.UG(bx - 3, by - 3, 7, 7)
    let w = hx("#fff1c9")
    L.G(bx, by - 2, w)
    L.G(bx, by - 1, w)
    L.G(bx, by, w)
    L.G(bx, by + 1, w)
    L.G(bx, by + 2, w)
    L.G(bx - 2, by, w)
    L.G(bx - 1, by, w)
    L.G(bx + 1, by, w)
    L.G(bx + 2, by, w)
}

func drawThread(_ L: Layer, _ state: RoomState, _ t: Double, _ lx: Double, _ rx: Double) {
    if state.left.avatar == nil || state.right.avatar == nil || state.right.status == .empty || state.left.status == .empty { return }
    // the red thread: from one lap to the other, gently sagging (less as they sit closer)
    let x0 = lx + 5
    let x1 = rx - 5
    let y0 = CouchBox.seatY - 1
    let red = hx("#c4453f")
    if x1 - x0 < 6 {
        // side by side: the thread is just a little knot between their hands
        let kx = jsRound((x0 + x1) / 2)
        L.S(kx - 1, y0, red)
        L.S(kx, y0 + 1, red)
        L.S(kx + 1, y0, red)
        L.S(kx, y0, hx("#e0685f"))
        return
    }
    let sag = min(3, (x1 - x0) / 6) + sin(t * 1.2) * 0.6
    var prev = -1.0
    var x = x0
    while x <= x1 {
        let u = (x - x0) / (x1 - x0)
        let y = jsRound(y0 + sin(u * Double.pi) * sag)
        L.S(x, y, red)
        if prev >= 0 && abs(y - prev) > 1 { L.S(x, Double(i32(y + prev) >> 1), red) }
        prev = y
        x += 1
    }
}

/** A small heart floating up from between them. */
func drawHeart(_ L: Layer, _ cx: Double, _ t: Double, _ since: Double) {
    let age = t - since
    if age < 0 || age > 2.6 { return }
    let y = jsRound(CouchBox.seatY - 36 - age * 7)
    let x = jsRound(cx + sin(age * 4) * 1.5)
    let a = jsRound(255 * min(1, (2.6 - age) / 0.8))
    let rows = [".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."]
    for (j, row) in rows.enumerated() {
        for (i, k) in row.enumerated() where k == "#" {
            L.G(x - 3 + Double(i), y + Double(j), i == 1 && j == 1 ? hx("#ffd0cb") : hx("#e0605a"), a)
        }
    }
}

/* ------------------------------------------------------------------------------------------------ */
/*  Lighting                                                                                         */
/* ------------------------------------------------------------------------------------------------ */

struct Light {
    let x: Double, y: Double, r: Double
    let c: (Double, Double, Double)
    let k: Double
}

let AMBIENT = (0.38, 0.36, 0.5)
let LIGHTS: [Light] = [
    Light(x: FireBox.cx, y: 100, r: 190, c: (1.08, 0.72, 0.44), k: 1),
    Light(x: 290, y: 66, r: 115, c: (0.95, 0.78, 0.52), k: 0.85),
    Light(x: 45, y: 50, r: 70, c: (0.42, 0.5, 0.72), k: 0.55),
    Light(x: 101, y: 44, r: 30, c: (0.9, 0.6, 0.35), k: 0.5),
]

/// how far each pixel is from each light (kept as 32-bit floats, as the website does)
let DIST: [[Float]] = LIGHTS.map { l in
    var a = [Float](repeating: 0, count: ROOM_W * ROOM_H)
    for y in 0..<ROOM_H {
        for x in 0..<ROOM_W {
            let dx = Double(x) - l.x
            let dy = (Double(y) - l.y) * 1.25 // light pools a bit wider than tall
            a[y * ROOM_W + x] = Float((dx * dx + dy * dy).squareRoot())
        }
    }
    return a
}

func applyLighting(_ L: Layer, _ t: Double, _ fire: Double) {
    let flick = 1 + sin(t * 7.3) * 0.025 + sin(t * 17.1) * 0.02 + (hash(fl(t * 12)) - 0.5) * 0.03
    let radii = LIGHTS.enumerated().map { i, l in l.r * (i == 0 ? flick * (0.85 + fire * 0.25) : i == 3 ? flick : 1) }
    let levels = 5.0
    L.data.withUnsafeMutableBufferPointer { d in
        L.emit.withUnsafeBufferPointer { emit in
            for y in 0..<ROOM_H {
                for x in 0..<ROOM_W {
                    let p = y * ROOM_W + x
                    if emit[p] != 0 { continue }
                    // accumulate continuous light, then quantise the total once so there is
                    // a single set of soft bands (with a thin dithered seam between them)
                    var tot = 0.0, tr = 0.0, tg = 0.0, tb = 0.0
                    for i in 0..<LIGHTS.count {
                        let l = LIGHTS[i]
                        var v = 1 - Double(DIST[i][p]) / radii[i]
                        if v <= 0 { continue }
                        v = pow(v, 1.35) * l.k
                        tot += v
                        tr += l.c.0 * v
                        tg += l.c.1 * v
                        tb += l.c.2 * v
                    }
                    var r = AMBIENT.0, g = AMBIENT.1, b = AMBIENT.2
                    if tot > 0 {
                        let th = (BAYER4[y & 3][x & 3] - 0.5) * 0.24
                        let qv = fl(tot * levels + 0.5 + th) / levels
                        r += (tr / tot) * qv
                        g += (tg / tot) * qv
                        b += (tb / tot) * qv
                    }
                    let q = p * 4
                    d[q] = clamp8(min(255, Double(d[q]) * r))
                    d[q + 1] = clamp8(min(255, Double(d[q + 1]) * g))
                    d[q + 2] = clamp8(min(255, Double(d[q + 2]) * b))
                }
            }
        }
        // bloom halo around fire mouth + lamp shade (additive, dithered)
        func halo(_ hxx: Double, _ hy: Double, _ rad: Double, _ col: (Double, Double, Double), _ str: Double) {
            var y = max(0, hy - rad)
            while y < min(RH, hy + rad) {
                var x = max(0, hxx - rad)
                while x < min(RW, hxx + rad) {
                    let dd = hypot(x - hxx, (y - hy) * 1.3) / rad
                    if dd < 1 {
                        let v = (1 - dd) * (1 - dd) * str
                        if !(v < BAYER4[i32(y) & 3][i32(x) & 3] * 0.5) {
                            let q = (Int(y) * ROOM_W + Int(x)) * 4
                            d[q] = clamp8(min(255, Double(d[q]) + col.0 * v))
                            d[q + 1] = clamp8(min(255, Double(d[q + 1]) + col.1 * v))
                            d[q + 2] = clamp8(min(255, Double(d[q + 2]) + col.2 * v))
                        }
                    }
                    x += 1
                }
                y += 1
            }
        }
        halo(FireBox.cx, 104, 26, (255, 150, 60), 0.35 * flick * (0.7 + fire * 0.4))
        halo(290, 66, 16, (255, 214, 140), 0.28)
    }
}
