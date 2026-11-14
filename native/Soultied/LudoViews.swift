import SwiftUI
import SoultiedCore

/*
 * Ludo on the iPhone (the website's src/components/games/LudoGame.tsx; the rules are in SoultiedCore's
 * Ludo.swift): the board with your yard in the bottom-left, a die to roll, and your tokens to tap. A move
 * walks round the board a square at a time, on whichever of your phones is looking.
 */

extension GameArt {
    static let pawnRows = ["..ddd..", ".dLBBd.", ".dBBBd.", "..dBd..", ".dBBBd.", "dBBBBBd", "ddddddd"]
    static func pawn(_ s: Side) -> Glyph {
        s == .a ? Glyph(pawnRows, ["B": "#e07a5f", "L": "#f6c3a8", "d": "#7a3022"]) : Glyph(pawnRows, ["B": "#4fb896", "L": "#c9f2e4", "d": "#1f5a4a"])
    }
    static let die = Glyph(["kkkkkkk", "kwwwwwk", "kwkwkwk", "kwwwwwk", "kwkwkwk", "kwwwwwk", "kkkkkkk"], ["k": "#3a2a26", "w": "#fbf3e2"])
}

enum LudoLook {
    static func yard(_ s: Side) -> Color { Color(hex: s == .a ? "#e9a58d" : "#8fd3bd") }
    static func path(_ s: Side) -> Color { Color(hex: s == .a ? "#f2c4b2" : "#bfe8da") }
    static func body(_ s: Side) -> Color { Color(hex: s == .a ? "#e07a5f" : "#4fb896") }
    static func dark(_ s: Side) -> Color { Color(hex: s == .a ? "#7a3022" : "#1f5a4a") }
    static let star = Glyph(["...y...", "..yyy..", "yyyyyyy", ".yyyyy.", ".yy.yy."], ["y": "#d9a441"])
    static let heart = Glyph([".hh.hh.", "hHHhHHh", "hHHHHHh", ".hHHHh.", "..hHh..", "...h..."], ["h": "#8f3b2a", "H": "#e07a5f"])
    static let tree = Glyph(["..ggg..", ".gGGGg.", "gGGgGGg", ".gGGGg.", "..gtg..", "...t..."], ["g": "#4e6a3c", "G": "#9ab46e", "t": "#6b4a2f"])
}

/// paint a glyph straight onto a canvas, `px` points a pixel, its top-left at (x, y)
private func paint(_ ctx: GraphicsContext, _ g: Glyph, _ x: CGFloat, _ y: CGFloat, _ px: CGFloat, opacity: Double = 1) {
    for (j, row) in g.rows.enumerated() {
        for (i, ch) in row.enumerated() {
            guard let c = g.pal[ch] else { continue }
            ctx.fill(Path(CGRect(x: x + CGFloat(i) * px, y: y + CGFloat(j) * px, width: px + 0.3, height: px + 0.3)),
                     with: .color(Color(.sRGB, red: Double(c.r) / 255, green: Double(c.g) / 255, blue: Double(c.b) / 255, opacity: opacity)))
        }
    }
}

/// a die showing `n`, in pixels
struct LudoDie: View {
    let n: Int?
    var size: CGFloat = 64
    var glow = false
    private static let pips: [Int: [Int]] = [1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8]]
    var body: some View {
        let on = n.flatMap { Self.pips[$0] } ?? []
        let pad = size * 0.16, dot = (size - pad * 2) / 3
        ZStack(alignment: .topLeading) {
            Rectangle().fill(Color(hex: "#fbf3e2"))
            Rectangle().fill(Color(hex: "#d9c6a1")).frame(height: size / 12).frame(maxHeight: .infinity, alignment: .bottom)
            ForEach(on, id: \.self) { i in
                Rectangle().fill(Color.ink).frame(width: dot * 0.62, height: dot * 0.62)
                    .offset(x: pad + CGFloat(i % 3) * dot + dot * 0.19, y: pad + CGFloat(i / 3) * dot + dot * 0.19)
            }
        }
        .frame(width: size, height: size)
        .overlay(Rectangle().strokeBorder(Color.ink, lineWidth: 3))
        .shadow(color: glow ? Color.butter.opacity(0.85) : .clear, radius: glow ? 12 : 0)
        .accessibilityHidden(true)
    }
}

struct LudoGameView: View {
    let place: PlaceModel
    /// where each token is drawn: the match's, except while one walks round the board
    @State private var shown: [Side: [Int]] = [:]
    @State private var face: Int?
    /// your roll, on its way
    @State private var rolling = false
    /// their roll, landing
    @State private var shaking = false
    @State private var heard = ""
    @State private var walker: Task<Void, Never>?

    var body: some View {
        let m = place.games[.ludo]
        let me = place.mySeat
        let st = m.map { Ludo.State($0.state) } ?? Ludo.State()
        let myTurn = m?.status == .playing && m?.turn == me
        let choices = myTurn && st.phase == "move" ? Ludo.movable(st, me, st.dice ?? 1) : []
        GameFrame(place: place, kind: .ludo, match: m, marker: { GameArt.pawn($0) }, status: status(m, st)) {
            VStack(spacing: 16) {
                GeometryReader { g in board(st, choices: choices, side: g.size.width) }
                    .aspectRatio(1, contentMode: .fit)
                    .frame(maxWidth: 440)
                    .frame(maxWidth: .infinity)
                HStack(spacing: 18) {
                    dieButton(m, canRoll: myTurn && st.phase == "roll")
                    if m != nil {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(st.count == 2 ? "Quick game" : "Full game").font(.px(14, 700)).foregroundStyle(Color.paper)
                            Text("Home: you \(Ludo.homeCount(st, me)) of \(st.count), \(place.theirName) \(Ludo.homeCount(st, me.other)) of \(st.count)")
                                .font(.pxSmall).foregroundStyle(Color.paper.opacity(0.8)).fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }
        } actions: {
            if m == nil || m?.status == .over {
                VStack(spacing: 10) {
                    Button(m == nil ? "Quick game · two each" : "Quick game again") { start(m, 2) }.buttonStyle(.px(.sage, wide: true))
                    Button(m == nil ? "Full game · four each" : "Full game again") { start(m, 4) }.buttonStyle(.px(.paper, wide: true))
                }
            }
        }
        .onAppear { sync(m, force: true) }
        .onChange(of: m.map { "\($0.id):\($0.seq)" }) { _, _ in sync(place.games[.ludo]) }
        .onDisappear { walker?.cancel() }
    }

    private func start(_ m: Match?, _ count: Int) {
        Haptics.tap()
        place.saveGame(Play.newLudo(m.map { $0.status == .over ? $0.startedBy.other : place.mySeat } ?? place.mySeat, wins: m?.wins, count: count))
    }

    private func status(_ m: Match?, _ st: Ludo.State) -> Text {
        let me = place.mySeat, partner = place.theirName
        guard let m else { return say(("Race your tokens round the board and home. A six brings one out; land on one of \(partner)’s to send it back. Quick is two tokens each, full is four.", false)) }
        if m.status == .over {
            if m.winner == me.rawValue { return say(("All your tokens are home. You win! ", true), ("\(partner) will see it next time they look.", false)) }
            return say(("\(partner) got all their tokens home", true), (" and wins this one.", false))
        }
        if m.turn == me {
            if st.phase == "move" { return say(("You rolled a \(st.dice ?? 0). ", false), ("Tap a token to move it.", true), (st.dice == 6 ? " A six means you roll again after." : "", false)) }
            let before = m.updatedBy == me.other && m.seq > 0 ? "\(partner) \(m.last). " : m.updatedBy == me && m.seq > 0 && st.moved != nil ? "Roll again! " : ""
            return say((before, false), ("Your turn.", true), (" Roll the die.", false))
        }
        if m.updatedBy == me && m.seq > 0 { return say(("You \(m.last). Now it’s ", false), ("\(partner)’s turn", true), (".", false)) }
        if m.seq > 0 && st.phase == "move" { return say((partner, true), (" rolled a \(st.dice ?? 0) and is choosing a token.", false)) }
        return say((partner, true), (" is taking their turn.", false))
    }

    /* ---------- following the match ---------- */

    private func sync(_ m: Match?, force: Bool = false) {
        guard let m else {
            shown = Ludo.State().tokens
            face = nil
            return
        }
        let key = "\(m.id):\(m.seq)"
        guard force || key != heard else { return }
        let first = force || heard.split(separator: ":").first.map(String.init) != m.id
        heard = key
        walker?.cancel()
        shaking = false
        let st = Ludo.State(m.state)
        guard !first, let mv = st.moved else {
            shown = st.tokens
            if !first, let d = st.dice, m.updatedBy != place.mySeat { shake(to: d) } else { face = st.dice }
            return
        }
        // a move: walk the token there a square at a time, then send anyone it landed on home
        face = st.dice
        var start = st.tokens
        start[mv.seat]?[mv.token] = mv.from
        shown = start
        let steps = Ludo.walk(mv.from, mv.to)
        let mine = mv.seat == place.mySeat
        walker = Task { @MainActor in
            for (i, p) in steps.enumerated() {
                try? await Task.sleep(nanoseconds: 130_000_000)
                if Task.isCancelled { return }
                withAnimation(.easeOut(duration: 0.1)) { shown[mv.seat]?[mv.token] = p }
                Chiptune.shared.tone((mine ? 620 : 520) + Double(i) * 18, 0.05, 0, .triangle, 0.04)
            }
            try? await Task.sleep(nanoseconds: 130_000_000)
            if Task.isCancelled { return }
            withAnimation(.easeOut(duration: 0.18)) { shown = st.tokens }
            if st.sent != nil {
                for (i, f) in [392.0, 330, 262].enumerated() { Chiptune.shared.tone(f, 0.12, Double(i) * 0.08, .square, 0.04) }
                if !mine { Haptics.soft() }
            } else if mv.to == Ludo.home {
                for (i, f) in [659.0, 784, 988].enumerated() { Chiptune.shared.tone(f, 0.14, Double(i) * 0.09, .triangle, 0.05) }
            }
        }
    }

    /// their roll: a little shake of the die first
    private func shake(to n: Int) {
        shaking = true
        walker = Task { @MainActor in
            for i in 0..<6 {
                face = 1 + (i * 7 + n) % 6
                try? await Task.sleep(nanoseconds: 70_000_000)
                if Task.isCancelled { return }
            }
            shaking = false
            face = n
            Chiptune.shared.tone(880, 0.05, 0, .square, 0.03)
        }
    }

    private func roll(_ m: Match) {
        guard !rolling else { return }
        let n = Ludo.rollD6 { Double.random(in: 0..<1) }
        rolling = true
        Haptics.tap()
        Task { @MainActor in
            for i in 0..<7 {
                face = 1 + (i * 5 + n) % 6
                try? await Task.sleep(nanoseconds: 75_000_000)
            }
            rolling = false
            face = n
            Chiptune.shared.tone(880, 0.05, 0, .square, 0.03)
            Haptics.select()
            guard let now = place.games[.ludo], let next = Play.ludoRoll(now, place.mySeat, dice: n) else { return }
            place.saveGame(next)
        }
    }

    private func dieButton(_ m: Match?, canRoll: Bool) -> some View {
        Button {
            if let m, canRoll { roll(m) }
        } label: {
            VStack(spacing: 6) {
                LudoDie(n: face, size: 64, glow: canRoll && !rolling)
                    .rotationEffect(.degrees(rolling || shaking ? Double((face ?? 1) * 9 - 30) : 0))
                Text(canRoll ? (rolling ? "Rolling…" : "Roll") : " ").font(.px(14, 700)).foregroundStyle(Color.paper)
            }
        }
        .buttonStyle(.plain)
        .disabled(!canRoll || rolling)
        .accessibilityLabel(canRoll ? "Roll the die" : face.map { "The die shows \($0)" } ?? "The die")
    }

    /* ---------- the board ---------- */

    /// the board turned round for the second seat, so your yard is always bottom-left
    private func turned(_ r: Int, _ c: Int) -> (Int, Int) { place.mySeat == .a ? (r, c) : (14 - r, 14 - c) }

    private func board(_ st: Ludo.State, choices: [Int], side: CGFloat) -> some View {
        let me = place.mySeat
        let pad: CGFloat = 5
        let cell = (side - pad * 2) / 15
        return ZStack(alignment: .topLeading) {
            Canvas { ctx, _ in
                ctx.fill(Path(CGRect(x: 0, y: 0, width: side, height: side)), with: .color(Color(hex: "#6b4a2f")))
                func rect(_ r: CGFloat, _ c: CGFloat, _ h: CGFloat, _ w: CGFloat, inset: CGFloat = 0) -> CGRect {
                    CGRect(x: pad + c * cell + inset, y: pad + r * cell + inset, width: w * cell - inset * 2, height: h * cell - inset * 2)
                }
                for r in 0..<15 {
                    for c in 0..<15 {
                        let (R, C) = turned(r, c)
                        let kind = Ludo.square(R, C)
                        let color: Color
                        switch kind {
                        case .yard(let s): color = LudoLook.yard(s)
                        case .path(let s): color = LudoLook.path(s)
                        case .start(let s?): color = LudoLook.body(s)
                        case .garden: color = Color(hex: "#7d8f62")
                        default: color = Color(hex: "#f4ead6")
                        }
                        ctx.fill(Path(rect(CGFloat(r), CGFloat(c), 1, 1, inset: 0.5)), with: .color(color))
                        if kind == .star || kind == .start(nil) {
                            paint(ctx, LudoLook.star, pad + CGFloat(c) * cell + cell * 0.16, pad + CGFloat(r) * cell + cell * 0.22, cell * 0.68 / 7)
                        }
                    }
                }
                // the yards, the gardens and the heart in the middle, as solid blocks
                for s in [me, me.other] {
                    let (r0, c0): (CGFloat, CGFloat) = s == me ? (9, 0) : (0, 9)
                    ctx.fill(Path(rect(r0, c0, 6, 6)), with: .color(LudoLook.yard(s)))
                    ctx.stroke(Path(rect(r0, c0, 6, 6, inset: 1.5)), with: .color(LudoLook.dark(s)), lineWidth: 3)
                    ctx.fill(Path(rect(r0 + 1, c0 + 1, 4, 4)), with: .color(Color(hex: "#fbf3e2")))
                    ctx.stroke(Path(rect(r0 + 1, c0 + 1, 4, 4, inset: 1.5)), with: .color(LudoLook.dark(s)), lineWidth: 3)
                }
                for (r0, c0) in [(CGFloat(0), CGFloat(0)), (9, 9)] {
                    ctx.fill(Path(rect(r0, c0, 6, 6)), with: .color(Color(hex: "#7d8f62")))
                    ctx.stroke(Path(rect(r0, c0, 6, 6, inset: 1.5)), with: .color(Color(hex: "#4e6a3c")), lineWidth: 3)
                    let px = cell * 2.8 / 7
                    paint(ctx, LudoLook.tree, pad + (c0 + 3) * cell - px * 3.5, pad + (r0 + 3) * cell - px * 3, px)
                }
                ctx.fill(Path(rect(6, 6, 3, 3)), with: .color(Color(hex: "#efe3cb")))
                ctx.stroke(Path(rect(6, 6, 3, 3, inset: 1.5)), with: .color(Color(hex: "#6b4a2f")), lineWidth: 3)
                let hp = cell * 1.9 / 7
                paint(ctx, LudoLook.heart, pad + 7.5 * cell - hp * 3.5, pad + 7.5 * cell - hp * 3, hp, opacity: 0.8)
            }
            .frame(width: side, height: side)
            ForEach(placed(st), id: \.id) { t in
                let pick = t.seat == me && choices.contains(t.token)
                let size = cell * (t.pos == Ludo.home ? 0.62 : 0.88 * t.k)
                Button {
                    guard pick, let m = place.games[.ludo], let next = Play.ludoMove(m, me, token: t.token) else { return }
                    Haptics.tap()
                    place.saveGame(next)
                } label: {
                    GlyphView(glyph: GameArt.pawn(t.seat), scale: size / 7)
                        .shadow(color: pick ? Color(hex: "#ffecaa") : Color.black.opacity(0.25), radius: pick ? 5 : 0, y: pick ? 0 : 1.5)
                        .modifier(Blink(on: pick))
                        .frame(width: max(size, cell * 1.3), height: max(size, cell * 1.3))
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(!pick)
                .position(x: pad + t.c * cell, y: pad + t.r * cell - size * 0.08)
                .zIndex(pick ? 3 : 2)
                .accessibilityLabel("\(t.seat == me ? "Your" : "\(place.theirName)’s") token \(t.token + 1)\(t.pos == -1 ? ", in the yard" : t.pos == Ludo.home ? ", home" : "")\(pick ? ": move it" : "")")
            }
        }
        .frame(width: side, height: side)
        .overlay(Rectangle().strokeBorder(Color(hex: "#3b2a1e"), lineWidth: 4).padding(-4))
    }

    private struct Placed {
        var id: String
        var seat: Side
        var token: Int
        var pos: Int
        var r: CGFloat
        var c: CGFloat
        var k: CGFloat
    }

    /// every token where it's drawn; tokens sharing a square sit side by side, a little smaller
    private func placed(_ st: Ludo.State) -> [Placed] {
        let tokens = shown.isEmpty ? st.tokens : shown
        var all: [Placed] = []
        for s in [Side.a, .b] {
            for (i, pos) in (tokens[s] ?? []).enumerated() {
                let sp = Ludo.spot(s, i, pos)
                let (r, c) = place.mySeat == .a ? (sp.r, sp.c) : (15 - sp.r, 15 - sp.c)
                all.append(Placed(id: "\(s.rawValue)\(i)", seat: s, token: i, pos: pos, r: r, c: c, k: 1))
            }
        }
        var groups: [String: [Int]] = [:]
        for (i, t) in all.enumerated() where t.pos != -1 && t.pos != Ludo.home { groups["\(t.r),\(t.c)", default: []].append(i) }
        for ids in groups.values where ids.count > 1 {
            for (j, id) in ids.enumerated() {
                let dx: CGFloat = ids.count == 2 ? (j == 0 ? -0.2 : 0.2) : (j % 2 == 1 ? 0.2 : -0.2)
                let dy: CGFloat = ids.count == 2 ? 0 : (j < 2 ? -0.2 : 0.2)
                all[id].c += dx
                all[id].r += dy
                all[id].k = 0.72
            }
        }
        return all
    }
}
