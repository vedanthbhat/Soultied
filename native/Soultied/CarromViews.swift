import SwiftUI
import SoultiedCore

/*
 * Carrom on the iPhone (the website's src/components/games/CarromGame.tsx; the rules and the physics are in
 * SoultiedCore's Carrom.swift, the same as the website's step for step): slide your striker along your line,
 * press on the board and pull back to aim, and let go. Every shot plays out on both phones.
 */

extension GameArt {
    static let carromCoin = Glyph(["..www..", ".wWWWw.", "wWWwWWw", "wWwwwWw", "wWWwWWw", ".wWWWw.", "..www.."], ["w": "#d4473c", "W": "#f08a7a"])
}

private enum CarromLook {
    /// body, rim, light
    static func pal(_ k: Character) -> [Color] {
        switch k {
        case "w": return [Color(hex: "#fbf3e2"), Color(hex: "#d9c6a1"), Color(hex: "#ffffff")]
        case "b": return [Color(hex: "#4a3428"), Color(hex: "#2a1c14"), Color(hex: "#8a6650")]
        case "q": return [Color(hex: "#d4473c"), Color(hex: "#9a2a22"), Color(hex: "#f08a7a")]
        default: return [Color(hex: "#cfe3ea"), Color(hex: "#8fb3c2"), Color(hex: "#ffffff")]
        }
    }
    static let wood = Color(hex: "#e9cf9c")
    static let line = Color(hex: "#5a3a24")
}

/// the board drawn in pixels: 2.4 to a board unit, as on the website
private struct CarromPainter {
    let ctx: GraphicsContext
    /// points per board pixel
    let p: CGFloat
    let flip: Bool
    static let px = 2.4

    func f(_ v: Double) -> Double { flip ? 100 - v : v }

    func rect(_ x: Double, _ y: Double, _ w: Double, _ h: Double, _ c: Color) {
        ctx.fill(Path(CGRect(x: CGFloat(x) * p, y: CGFloat(y) * p, width: CGFloat(w) * p + 0.3, height: CGFloat(h) * p + 0.3)), with: .color(c))
    }

    /// a filled pixel disc, row by row
    func round(_ cx: Double, _ cy: Double, _ rp: Double, _ c: Color) {
        let x0 = (cx * Self.px).rounded(), y0 = (cy * Self.px).rounded()
        let R = Int(rp.rounded(.up))
        for y in -R...R {
            let w = (rp * rp - Double(y * y))
            if w < 0 { continue }
            let hw = w.squareRoot().rounded(.down)
            rect(x0 - hw, y0 + Double(y), hw * 2 + 1, 1, c)
        }
    }

    func disc(_ cx: Double, _ cy: Double, _ r: Double, _ pal: [Color]) {
        let rp = r * Self.px
        round(cx, cy, rp, pal[1])
        round(cx, cy, rp - 1.2, pal[0])
        round(cx - r * 0.35, cy - r * 0.35, rp * 0.28, pal[2])
    }

    func board() {
        let size = 100 * Self.px
        rect(0, 0, size, size, CarromLook.wood)
        for y in stride(from: 3.0, to: size, by: 7) { rect(0, y, size, 1, Color(red: 0.63, green: 0.43, blue: 0.24).opacity(0.1)) }
        for s in [Side.a, .b] {
            for off in [-Carrom.rStriker, Carrom.rStriker] {
                rect((Carrom.baseMin * Self.px).rounded(), (f(Carrom.baseline(s) + off) * Self.px).rounded(), ((Carrom.baseMax - Carrom.baseMin) * Self.px).rounded(), 1, CarromLook.line)
            }
            for x in [Carrom.baseMin, Carrom.baseMax] { disc(x, f(Carrom.baseline(s)), Carrom.rStriker, [Color(hex: "#c4453f"), CarromLook.line, Color(hex: "#e07a5f")]) }
        }
        for (r, c) in [(15.0, CarromLook.line), (14.3, CarromLook.wood), (6.0, Color(hex: "#c4453f")), (5.3, CarromLook.wood)] { round(50, 50, r * Self.px, c) }
        for k in 0..<Int(18 * Self.px) {
            let t = 12 * Self.px + Double(k)
            for (sx, sy) in [(1.0, 1.0), (-1, 1), (1, -1), (-1, -1)] {
                rect((sx > 0 ? t : size - t).rounded(), (sy > 0 ? t : size - t).rounded(), 1, 1, CarromLook.line)
            }
        }
        for (qx, qy) in Carrom.pockets { disc(qx, qy, Carrom.pocketR + 0.4, [Color(hex: "#1b1411"), Color(hex: "#3b2a1e"), Color(hex: "#1b1411")]) }
    }
}

struct CarromGameView: View {
    let place: PlaceModel
    @State private var x = 50.0
    @State private var aim: (dx: Double, dy: Double, power: Double)?
    /// the shot being played out
    @State private var playing: (frames: [[Double]], start: Date)?
    @State private var heard = ""

    var body: some View {
        let m = place.games[.carrom]
        let me = place.mySeat
        let st = m.map { Carrom.State($0.state) } ?? Carrom.State(white: me)
        let myTurn = m?.status == .playing && m?.turn == me
        let fits = Carrom.strikerFits(st.xs, st.ys, me, x)
        GameFrame(place: place, kind: .carrom, match: m, marker: { GameArt.icon(.carrom).recolor(st.kind(of: $0)) }, status: status(m, st)) {
            VStack(spacing: 12) {
                GeometryReader { g in board(st, side: g.size.width, myTurn: myTurn, fits: fits) }
                    .aspectRatio(1, contentMode: .fit)
                    .padding(10)
                    .background(Color(hex: "#6b4a2f"))
                    .overlay(Rectangle().strokeBorder(Color(hex: "#3b2a1e"), lineWidth: 4).padding(-4))
                    .frame(maxWidth: 460)
                    .frame(maxWidth: .infinity)
                if myTurn && playing == nil {
                    HStack(spacing: 10) {
                        Text("Striker").font(.pxSmall).foregroundStyle(Color.paper)
                        Slider(value: Binding(get: { me == .b ? 100 - x : x }, set: { x = me == .b ? 100 - $0 : $0 }), in: Carrom.baseMin...Carrom.baseMax)
                            .tint(Color.butter)
                            .accessibilityLabel("Slide the striker along your line")
                        if let a = aim { Text("Power \(Int((a.power * 100).rounded()))%").font(.pxSmall).foregroundStyle(Color.paper).monospacedDigit() }
                    }
                    .frame(maxWidth: 460)
                }
                Text("You’re \(st.kind(of: me) == "w" ? "white" : "black"): \(st.sunkCount(me)) of 9 in · \(place.theirName): \(st.sunkCount(me.other)) of 9 · the queen: \(queenLine(st))")
                    .font(.pxSmall).foregroundStyle(Color.paper.opacity(0.85)).multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
            }
            .onAppear {
                heard = m.map { "\($0.id):\($0.seq)" } ?? ""
                settle(st)
            }
            .onChange(of: m.map { "\($0.id):\($0.seq)" }) { _, _ in shotArrived(place.games[.carrom]) }
        } actions: {
            if m == nil || m?.status == .over {
                Button(m == nil ? "Start a game" : "Play again") {
                    Haptics.tap()
                    place.saveGame(Play.newCarrom(m.map { $0.status == .over ? $0.startedBy.other : me } ?? me, wins: m?.wins))
                }
                .buttonStyle(.px(.sage))
            }
        }
    }

    private func queenLine(_ st: Carrom.State) -> String {
        let me = place.mySeat, partner = place.theirName
        switch st.queen {
        case "board": return "on the board"
        case me.rawValue: return "yours"
        case me.other.rawValue: return "\(partner)’s"
        case "pending-\(me.rawValue)": return "sunk: cover her!"
        default: return "sunk by \(partner)"
        }
    }

    private func status(_ m: Match?, _ st: Carrom.State) -> Text {
        let me = place.mySeat, partner = place.theirName
        guard let m else { return say(("Flick the striker and sink your nine before \(partner) sinks theirs. Start, and you play white and break.", false)) }
        if m.status == .over {
            return m.winner == me.rawValue ? say(("All nine of yours are in. You win!", true)) : say(("\(partner) sank all of theirs", true), (" and wins this one.", false))
        }
        if playing != nil { return say((m.updatedBy == me ? "Your shot…" : "\(partner)’s shot…", false)) }
        if m.turn == me {
            let before = m.seq > 0 && m.updatedBy == me.other ? "\(partner) \(m.last). " : m.seq > 0 && m.updatedBy == me ? "You \(m.last). Again! " : ""
            let how = aim.map { Carrom.forward(me, $0.dy) ? " Let go to shoot." : " Pull back towards your side." } ?? " Slide the striker, then press on the board and pull back to aim."
            return say((before, false), ("Your shot.", true), (how, false))
        }
        if m.updatedBy == me && m.seq > 0 { return say(("You \(m.last). Now it’s ", false), ("\(partner)’s shot", true), (".", false)) }
        return say(("Waiting for ", false), (partner, true), (" to shoot.", false))
    }

    /* ---------- shots ---------- */

    /// the striker somewhere it fits
    private func settle(_ st: Carrom.State) {
        guard !Carrom.strikerFits(st.xs, st.ys, place.mySeat, x) else { return }
        for d in stride(from: 0.0, through: 62, by: 1) {
            for s in [x + d, x - d] where Carrom.strikerFits(st.xs, st.ys, place.mySeat, s) {
                x = (s * 10).rounded() / 10
                return
            }
        }
    }

    private func shotArrived(_ m: Match?) {
        guard let m else { return }
        let key = "\(m.id):\(m.seq)"
        let first = heard.split(separator: ":").first.map(String.init) != m.id
        guard key != heard else { return }
        heard = key
        let st = Carrom.State(m.state)
        guard !first, let shot = st.shot else {
            playing = nil
            settle(st)
            return
        }
        let sim = Carrom.simulate(shot.xs, shot.ys, shot.by, shot.x, shot.dx, shot.dy, shot.power, every: 4)
        Chiptune.shared.tone(220, 0.08, 0, .square, 0.06)
        if shot.by != place.mySeat { Haptics.soft() }
        let started = Date()
        playing = (sim.frames, started)
        let secs = Double(sim.frames.count) / 60
        if !sim.sunk.isEmpty {
            // the plop when they go in (roughly when the first does)
            Chiptune.shared.tone(330, 0.08, max(0.2, secs * 0.6), .triangle, 0.06)
            Chiptune.shared.tone(262, 0.08, max(0.26, secs * 0.6 + 0.06), .triangle, 0.06)
        }
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: UInt64((secs + 0.05) * 1e9))
            if playing?.start == started {
                playing = nil
                settle(Carrom.State(place.games[.carrom]?.state ?? [:]))
            }
        }
    }

    private func board(_ st: Carrom.State, side: CGFloat, myTurn: Bool, fits: Bool) -> some View {
        let me = place.mySeat
        let flip = me == .b
        let p = side / (100 * CarromPainter.px)
        return TimelineView(.animation(minimumInterval: 1.0 / 60, paused: playing == nil)) { ctx in
            Canvas { g, _ in
                let paint = CarromPainter(ctx: g, p: p, flip: flip)
                paint.board()
                var fr: [Double]?
                if let pl = playing, !pl.frames.isEmpty {
                    fr = pl.frames[min(pl.frames.count - 1, Int(ctx.date.timeIntervalSince(pl.start) * 60))]
                }
                for i in 0..<Carrom.coins {
                    let cx = fr.map { $0[2 + i * 2] } ?? st.xs[i]
                    let cy = fr.map { $0[3 + i * 2] } ?? st.ys[i]
                    if cx < 0 { continue }
                    paint.disc(paint.f(cx), paint.f(cy), Carrom.rCoin, CarromLook.pal(Carrom.kind(i)))
                }
                if let fr {
                    if fr[0] >= 0 { paint.disc(paint.f(fr[0]), paint.f(fr[1]), Carrom.rStriker, CarromLook.pal("s")) }
                } else if myTurn {
                    if let a = aim {
                        let len = 8 + a.power * 30
                        for k in stride(from: 4.0, to: len, by: 1.6) {
                            paint.rect((paint.f(x + a.dx * k) * CarromPainter.px).rounded(), (paint.f(Carrom.baseline(me) + a.dy * k) * CarromPainter.px).rounded(), 2, 2, Color(hex: "#3a2a26").opacity(0.55))
                        }
                    }
                    paint.disc(paint.f(x), paint.f(Carrom.baseline(me)), Carrom.rStriker, fits ? CarromLook.pal("s") : [Color(hex: "#e9a58d"), Color(hex: "#c4453f"), .white])
                }
            }
        }
        .frame(width: side, height: side)
        .contentShape(Rectangle())
        .gesture(
            DragGesture(minimumDistance: 0)
                .onChanged { v in
                    guard myTurn, playing == nil, fits else { return }
                    var bx = Double(v.location.x / side) * 100, by = Double(v.location.y / side) * 100
                    if flip {
                        bx = 100 - bx
                        by = 100 - by
                    }
                    let ex = x - bx, ey = Carrom.baseline(me) - by
                    let d = (ex * ex + ey * ey).squareRoot()
                    if d < 2 {
                        aim = nil
                        return
                    }
                    let power = min(1, max(0.05, (d - 2) / 34))
                    if aim == nil || abs((aim?.power ?? 0) - power) > 0.08 { Haptics.select() }
                    aim = (ex / d, ey / d, power)
                }
                .onEnded { _ in
                    defer { aim = nil }
                    guard let a = aim, Carrom.forward(me, a.dy), let m = place.games[.carrom], let next = Play.carrom(m, me, x: x, dx: a.dx, dy: a.dy, power: a.power) else { return }
                    Haptics.tap()
                    place.saveGame(next)
                }
        )
        .accessibilityLabel("The carrom board: \(st.xs.filter { $0 >= 0 }.count) coins left")
    }
}

extension Glyph {
    /// the coin picture in a side's colour
    func recolor(_ k: Character) -> Glyph {
        k == "w" ? Glyph(rows, ["w": "#d9c6a1", "W": "#fbf3e2"]) : Glyph(rows, ["w": "#2a1c14", "W": "#5a3e30"])
    }
}
