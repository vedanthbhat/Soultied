import SwiftUI
import SoultiedCore

/*
 * The games you take turns at, on the iPhone: Fireflies, Paper Boats, Noughts & Hearts, Fence the Garden and
 * Lanterns. The same games as the website's (the rules are in SoultiedCore), so a game started on a laptop
 * can be finished on a phone. Each sits on the same dark, warm backdrop as the website's game screens.
 */

/* ---------- the pieces ---------- */

enum GameArt {
    private static let fireflyRows = ["..hhh..", ".hbbbh.", "hbbwbbh", "hbwwwbh", "hbbwbbh", ".hbbbh.", "..hhh.."]
    static func firefly(_ s: Side) -> Glyph {
        s == .a ? Glyph(fireflyRows, ["b": "#ffc94a", "w": "#fff4c2", "h": "#b8741f"]) : Glyph(fireflyRows, ["b": "#7fe0c0", "w": "#eafff6", "h": "#2f8f78"])
    }

    static let heart = Glyph([".hh...hh.", "hHHh.hHHh", "hHwHhHHHh", "hHHHHHHHh", ".hHHHHHh.", "..hHHHh..", "...hHh...", "....h...."], ["h": "#8f3b2a", "H": "#e07a5f", "w": "#f6c3a8"])
    static let ring = Glyph(["...ooo...", ".oOOOOOo.", ".oOo.oOo.", "oOo...oOo", "oO.....Oo", "oOo...oOo", ".oOo.oOo.", ".oOOOOOo.", "...ooo..."], ["o": "#2f8f78", "O": "#7fe0c0"])
    /// "a" draws hearts, "b" draws rings
    static func mark(_ s: Side) -> Glyph { s == .a ? heart : ring }

    private static let lanternRows = ["..ttt..", ".tLLLt.", "tLwLLLt", "tLLLLLt", "tLLLLLt", ".tLLLt.", "..ttt.."]
    static func lantern(_ s: Side) -> Glyph {
        s == .a ? Glyph(lanternRows, ["L": "#ffc94a", "w": "#fff4c2", "t": "#b8741f"]) : Glyph(lanternRows, ["L": "#7fe0c0", "w": "#eafff6", "t": "#2f8f78"])
    }

    static func flower(_ s: Side) -> Glyph {
        var g = Array(repeating: Array(repeating: Character("."), count: 8), count: 8)
        func put(_ x: Int, _ y: Int, _ c: Character) { for j in 0..<2 { for i in 0..<2 { g[y + j][x + i] = c } } }
        for (x, y) in [(3, 0), (0, 3), (6, 3), (3, 6)] { put(x, y, "p") }
        for (x, y) in [(1, 1), (5, 1), (1, 5), (5, 5)] { put(x, y, "d") }
        put(3, 3, "c")
        let pal: [Character: String] = s == .a ? ["p": "#ffc94a", "d": "#b8741f", "c": "#fff4c2"] : ["p": "#7fe0c0", "d": "#2f8f78", "c": "#fff4c2"]
        return Glyph(g.map { String($0) }, pal)
    }

    static let hit = Glyph(["...r...", ".r.o.r.", "..ror..", "roowoor", "..ror..", ".r.o.r.", "...r..."], ["r": "#c4453f", "o": "#f39a5a", "w": "#fff1c2"])
    static let miss = Glyph(["..www..", ".w...w.", "w.....w", "w..w..w", "w.....w", ".w...w.", "..www.."], ["w": "#dcecf2"])

    /// the glow around a firefly or a lantern
    static func glow(_ s: Side) -> Color { s == .a ? Color(red: 1, green: 0.75, blue: 0.31).opacity(0.75) : Color(red: 0.47, green: 0.9, blue: 0.76).opacity(0.7) }

    /// the little picture on each game's box
    static func icon(_ k: GameKind) -> Glyph {
        switch k {
        case .fireflies: return firefly(.a)
        case .boats: return Glyph(["....k....", "...kk....", "..kKk....", ".kKKk....", "....m....", "hhhhhhhhh", ".hHHHHHh.", "..sssss.."], ["k": "#6b5a40", "K": "#fbf3e2", "m": "#6b5a40", "h": "#6b5a40", "H": "#d6c29c", "s": "#5f8fb0"])
        case .noughts: return heart
        case .fence: return flower(.a)
        case .lanterns: return lantern(.b)
        case .tug: return Glyph(["rr.....rr", "rrrrrrrrr", "rr.....rr"], ["r": "#c4453f"])
        case .quickdraw: return Icons.flame
        case .rps: return Icons.star
        case .doodle: return Icons.pencil
        case .coasters: return Glyph(["..ccc..", ".ckkkc.", "ckkkkkc", "ckkkkkc", "ckkkkkc", ".ckkkc.", "..ccc.."], ["c": "#b48c4a", "k": "#d6ad63"])
        case .kitchen: return Glyph([".www.", "wwwww", "wwwww", ".kkk.", ".kkk."], ["w": "#fbf3e2", "k": "#d6c29c"])
        }
    }
}

/// the dark, warm backdrop every game screen sits on
struct GameBackdrop: View {
    var body: some View {
        RadialGradient(colors: [Color(hex: "#3a2b25"), Color(hex: "#1b1411")], center: .top, startRadius: 10, endRadius: 700).ignoresSafeArea()
    }
}

/// on and off, for the pieces that just won
struct Blink: ViewModifier {
    var on: Bool
    @ViewBuilder
    func body(content: Content) -> some View {
        if on {
            TimelineView(.periodic(from: .now, by: 0.45)) { ctx in
                content.opacity(Int(ctx.date.timeIntervalSinceReferenceDate / 0.45) % 2 == 0 ? 1 : 0.35)
            }
        } else {
            content
        }
    }
}

/// a sprite, glowing
struct GlowGlyph: View {
    let glyph: Glyph
    var scale: CGFloat
    var glow: Color?
    var body: some View {
        GlyphView(glyph: glyph, scale: scale).shadow(color: glow ?? .clear, radius: glow == nil ? 0 : scale * 1.4)
    }
}

/// "Rohan dropped a firefly in the middle. **Your move.**"
func say(_ parts: (String, Bool)...) -> Text {
    parts.reduce(Text("")) { t, p in t + Text(p.0).font(p.1 ? .pxBodyBold : .pxBody) }
}

/* ---------- the frame around every game ---------- */

struct PlayerChip: View {
    let place: PlaceModel
    let side: Side
    let match: Match?
    var marker: Glyph?

    var body: some View {
        let turn = match?.status == .playing && match?.turn == side
        let won = match?.status == .over && match?.winner == side.rawValue
        let wins = match?.wins[side] ?? 0
        let mine = side == place.mySeat
        let note = turn ? (mine ? " · your move" : " · their move") : won ? " · won this one" : ""
        HStack(spacing: 8) {
            if let l = place.seatLook(side) { HeadView(look: l, size: 32) } else { Color.paper2.frame(width: 32, height: 32) }
            VStack(alignment: .leading, spacing: 0) {
                Text(mine ? "You" : place.seatName(side)).font(.px(14, 700)).foregroundStyle(Color.inkSoft).lineLimit(1).minimumScaleFactor(0.8)
                Text("\(wins) \(wins == 1 ? "win" : "wins")\(note)").font(.pxTiny).foregroundStyle(Color.muted).lineLimit(1).minimumScaleFactor(0.7)
            }
            Spacer(minLength: 0)
            if let marker { GlyphView(glyph: marker, scale: 3) }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .frame(maxWidth: .infinity)
        .pxBox()
        .overlay {
            if turn {
                Rectangle().strokeBorder(Color(hex: "#f1d27a"), style: StrokeStyle(lineWidth: 3, dash: [6, 4])).padding(-6)
            } else if won {
                Rectangle().strokeBorder(Color.butter, lineWidth: 3).padding(-6)
            }
        }
    }
}

struct GameFrame<Board: View, Actions: View>: View {
    let place: PlaceModel
    let kind: GameKind
    let match: Match?
    var marker: ((Side) -> Glyph)?
    let status: Text
    @ViewBuilder var board: () -> Board
    @ViewBuilder var actions: () -> Actions
    @Environment(\.dismiss) private var dismiss

    /// when you won, while you were watching (a little confetti)
    @State private var cheer: Date? = nil

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                HStack(spacing: 8) {
                    Button("← All games") { dismiss() }.buttonStyle(.px(.paper, small: true))
                    MusicToggle()
                    Spacer()
                    Text(kind.info.name).font(.px(24, 700)).foregroundStyle(Color.paper).lineLimit(1).minimumScaleFactor(0.7)
                }
                HStack(spacing: 14) {
                    PlayerChip(place: place, side: place.mySeat, match: match, marker: marker?(place.mySeat))
                    PlayerChip(place: place, side: place.mySeat.other, match: match, marker: marker?(place.mySeat.other))
                }
                .padding(.horizontal, 4)
                .padding(.vertical, 4)
                status
                    .foregroundStyle(Color.inkSoft)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .pxBox()
                    .animation(nil, value: match?.seq)
                board()
                    .overlay { if let c = cheer { Confetti().id(c).allowsHitTesting(false) } }
                HStack(spacing: 12) { actions() }
            }
            .padding(16)
            .padding(.bottom, 40)
        }
        .background(GameBackdrop())
        .onChange(of: match?.seq) { _, _ in
            guard let m = match else { return }
            if m.status == .over {
                if m.winner == place.mySeat.rawValue {
                    Haptics.success()
                    Chiptune.shared.game(.win)
                    celebrate()
                } else {
                    Haptics.soft()
                    Chiptune.shared.game(m.winner == "draw" ? .draw : .lose)
                }
            } else if m.updatedBy != place.mySeat {
                Haptics.soft()
                Chiptune.shared.game(.theirMove)
            } else {
                Chiptune.shared.game(.move)
            }
        }
    }

    private func celebrate() {
        let c = Date()
        cheer = c
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.6) { if cheer == c { cheer = nil } }
    }
}

/// a game on its own screen
struct GameScreen: View {
    let place: PlaceModel
    let kind: GameKind
    var body: some View {
        screen
            // a little tune of its own, while it's open
            .onAppear { GameMusic.shared.start(kind) }
            .onDisappear { GameMusic.shared.stop() }
    }

    @ViewBuilder
    private var screen: some View {
        switch kind {
        case .fireflies: FirefliesGameView(place: place)
        case .noughts: NoughtsGameView(place: place)
        case .fence: FenceGameView(place: place)
        case .lanterns: LanternsGameView(place: place)
        case .boats: BoatsGameView(place: place)
        case .tug: TugGameView(place: place)
        case .rps: RpsGameView(place: place)
        case .quickdraw: QuickDrawGameView(place: place)
        case .doodle: DoodleGameView(place: place)
        case .coasters: CoastersGameView(place: place)
        case .kitchen: KitchenGameView(place: place)
        }
    }
}

/// what's said while it's someone else's move (the same for most games)
private func waiting(_ m: Match, me: Side, partner: String, verb: String = "make their move") -> Text {
    if m.updatedBy == me && m.seq > 0 { return say(("You \(m.last). Now it’s ", false), ("\(partner)’s move", true), (".", false)) }
    return say(("Waiting for ", false), (partner, true), (" to \(verb).", false))
}

private func startButton(_ m: Match?, _ start: @escaping () -> Void) -> some View {
    Group {
        if m == nil || m?.status == .over {
            Button(m == nil ? "Start a game" : "Play again") {
                Haptics.tap()
                start()
            }
            .buttonStyle(.px(.sage))
        }
    }
}

/* ---------- Fireflies ---------- */

struct FirefliesGameView: View {
    let place: PlaceModel
    private let cell: CGFloat = 44

    var body: some View {
        let m = place.games[.fireflies]
        let me = place.mySeat
        let partner = place.theirName
        let st = m.map { Fireflies.State($0.state) } ?? Fireflies.State()
        let myTurn = m?.status == .playing && m?.turn == me
        GameFrame(place: place, kind: .fireflies, match: m, marker: { GameArt.firefly($0) }, status: status(m, me, partner)) {
            jar(m, st, myTurn: myTurn)
        } actions: {
            startButton(m) { place.saveGame(Play.newFireflies(me, wins: m?.wins)) }
        }
    }

    private func status(_ m: Match?, _ me: Side, _ partner: String) -> Text {
        guard let m else { return say(("Start a game and drop the first firefly. \(partner) can take their turn whenever they’re next here.", false)) }
        if m.status == .over {
            if m.winner == "draw" { return say(("The jar is full and nobody got four. It’s a draw.", false)) }
            if m.winner == me.rawValue { return say(("You lined up four. You win! ", true), ("\(partner) will see it next time they look.", false)) }
            return say(("\(partner) lined up four", true), (" and wins this one.", false))
        }
        if m.turn == me {
            if m.seq == 0 { return say(("Your move.", true), (" Tap a column to drop a firefly.", false)) }
            return say(("\(partner) \(m.last). ", false), ("Your move.", true))
        }
        return waiting(m, me: me, partner: partner, verb: "drop a firefly")
    }

    private func jar(_ m: Match?, _ st: Fireflies.State, myTurn: Bool) -> some View {
        let board = Array(st.board.utf8)
        let line = Set(st.line ?? [])
        return VStack(spacing: 0) {
            Rectangle().fill(Color(hex: "#b48c4a")).frame(width: cell * 7 + 16, height: 8)
                .overlay(alignment: .top) { Rectangle().fill(Color(hex: "#d6ad63")).frame(height: 3) }
            HStack(spacing: 0) {
                ForEach(0..<Fireflies.cols, id: \.self) { c in
                    JarColumn(col: c, board: board, line: line, lastCell: st.lastCell, key: "\(m?.id ?? ""):\(m?.seq ?? 0)", cell: cell,
                              enabled: myTurn && Fireflies.landingRow(st.board, c) >= 0) {
                        guard let m, myTurn, let next = Play.fireflies(m, place.mySeat, col: c) else { return }
                        Haptics.tap()
                        place.saveGame(next)
                    }
                }
            }
            .padding(4)
            .background(Color(hex: "#1f2748"))
            .overlay { Rectangle().strokeBorder(Color(hex: "#9fc3d6"), lineWidth: 4).padding(-4) }
            .padding(4)
        }
        .frame(maxWidth: .infinity)
    }
}

/// one column of the jar: tap it to drop a firefly in
struct JarColumn: View {
    let col: Int
    let board: [UInt8]
    let line: Set<Int>
    let lastCell: Int?
    let key: String
    let cell: CGFloat
    let enabled: Bool
    var drop: () -> Void

    var body: some View {
        Button(action: drop) {
            VStack(spacing: 0) {
                ForEach(0..<Fireflies.rows, id: \.self) { r in slot(r) }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .accessibilityLabel("Drop a firefly in column \(col + 1)")
    }

    private func slot(_ r: Int) -> some View {
        let i = Fireflies.cell(r, col)
        let side = Side(rawValue: String(UnicodeScalar(board[i])))
        let won = line.contains(i)
        return ZStack {
            Rectangle().fill(Color(hex: "#141a31")).frame(width: cell * 0.74, height: cell * 0.74)
                .overlay { if won { Rectangle().strokeBorder(Color(hex: "#fff4c2"), lineWidth: 3) } }
            if let side {
                Falling(from: lastCell == i ? CGFloat(r + 1) * cell : 0, key: "\(key):\(i)") {
                    GlowGlyph(glyph: GameArt.firefly(side), scale: 4.4, glow: GameArt.glow(side))
                }
                .modifier(Blink(on: won))
            }
        }
        .frame(width: cell, height: cell)
    }
}

/// drops in from above when it first appears (a firefly falling into the jar)
struct Falling<Content: View>: View {
    var from: CGFloat
    var key: String
    @ViewBuilder var content: () -> Content
    @State private var y: CGFloat = 0
    @State private var shown = ""

    var body: some View {
        content()
            .offset(y: y)
            .onAppear(perform: fall)
            .onChange(of: key) { _, _ in fall() }
    }

    private func fall() {
        guard from > 0, shown != key else { return }
        shown = key
        y = -from
        withAnimation(.easeIn(duration: 0.04 * Double(from / 44) + 0.1)) { y = 0 }
    }
}

/* ---------- Noughts & Hearts ---------- */

struct NoughtsGameView: View {
    let place: PlaceModel

    var body: some View {
        let m = place.games[.noughts]
        let me = place.mySeat
        let st = m.map { Noughts.State($0.state) } ?? Noughts.State(opener: me)
        GameFrame(place: place, kind: .noughts, match: m, marker: { GameArt.mark($0) }, status: status(m, st)) {
            VStack(spacing: 14) {
                rounds(m, st)
                Text("First to \(Noughts.roundsToWin) rounds").font(.pxSmall).foregroundStyle(Color.paper.opacity(0.8))
                grid(m, st)
                if let lb = st.lastBoard, st.board == "........." { lastRound(lb, st) }
                if let m, m.status != .over {
                    Text("Round \(st.round) · \(place.seatName(st.opener)) went first · \(place.seatName(me)) \(st.score[me] ?? 0) – \(st.score[me.other] ?? 0) \(place.theirName)")
                        .font(.pxSmall).foregroundStyle(Color.paper.opacity(0.85)).multilineTextAlignment(.center)
                }
            }
        } actions: {
            startButton(m) { place.saveGame(Play.newNoughts(m.map { $0.status == .over ? $0.startedBy.other : me } ?? me, wins: m?.wins)) }
        }
    }

    private func status(_ m: Match?, _ st: Noughts.State) -> Text {
        let me = place.mySeat, partner = place.theirName
        guard let m else { return say(("Best of five rounds of three in a row. You’re \(me == .a ? "hearts" : "rings"), \(partner) is \(me == .a ? "rings" : "hearts"). Start, and they can answer whenever they’re next here.", false)) }
        if m.status == .over {
            let mine = st.score[me] ?? 0, theirs = st.score[me.other] ?? 0
            if m.winner == "draw" { return say(("All square after five rounds: a draw.", false)) }
            if m.winner == me.rawValue { return say(("You won the series \(mine)–\(theirs)!", true)) }
            return say(("\(partner) won the series", true), (" \(theirs)–\(mine).", false))
        }
        if m.turn == me {
            let before = m.seq > 0 && m.updatedBy == me.other ? "\(partner) \(m.last). " : ""
            let after = st.lastBoard != nil && st.board == "........." ? " Round \(st.round) starts with you." : " Tap a square."
            return say((before, false), ("Your move.", true), (after, false))
        }
        return waiting(m, me: me, partner: partner)
    }

    private func rounds(_ m: Match?, _ st: Noughts.State) -> some View {
        HStack(spacing: 10) {
            ForEach(0..<Noughts.maxRounds, id: \.self) { i in
                let h: String? = i < st.history.count ? st.history[i] : nil
                let current = m != nil && m?.status != .over && i == st.history.count
                ZStack {
                    if let h, let s = Side(rawValue: h) {
                        GlyphView(glyph: GameArt.mark(s), scale: 2.4)
                    } else if h == "draw" {
                        Text("=").font(.px(18, 700)).foregroundStyle(Color.inkSoft)
                    } else {
                        Text("\(i + 1)").font(.px(15, 600)).foregroundStyle(Color.muted.opacity(0.6))
                    }
                }
                .frame(width: 38, height: 38)
                .pxBox()
                .overlay { if current { Rectangle().strokeBorder(Color(hex: "#f1d27a"), style: StrokeStyle(lineWidth: 3, dash: [5, 3])).padding(-6) } }
            }
        }
    }

    private func grid(_ m: Match?, _ st: Noughts.State) -> some View {
        let me = place.mySeat
        let myTurn = m?.status == .playing && m?.turn == me
        let showingLast = st.lastBoard != nil && st.board == "........."
        let board = Array(st.board.utf8)
        let line = Set(showingLast ? [] : (st.line ?? (m?.status == .over ? Noughts.threeInRow(st.board)?.cells : nil) ?? []))
        let side: CGFloat = 94
        return VStack(spacing: 8) {
            ForEach(0..<3, id: \.self) { r in
                HStack(spacing: 8) {
                    ForEach(0..<3, id: \.self) { c in
                        let i = r * 3 + c
                        NoughtsSquare(index: i, side: Side(rawValue: String(UnicodeScalar(board[i]))), can: myTurn && board[i] == UInt8(ascii: "."), won: line.contains(i), size: side,
                                      name: { place.seatName($0) }) {
                            guard let m, let next = Play.noughts(m, me, cell: i) else { return }
                            Haptics.tap()
                            place.saveGame(next)
                        }
                    }
                }
            }
        }
        .padding(10)
        .background(Color(hex: "#6b4a2f"))
        .overlay { Rectangle().strokeBorder(Color(hex: "#3b2a1e"), lineWidth: 4).padding(-4) }
        .padding(4)
    }

    private func lastRound(_ lb: String, _ st: Noughts.State) -> some View {
        let b = Array(lb.utf8)
        let line = Set(st.line ?? [])
        return VStack(spacing: 6) {
            Text("How round \(st.round - 1) ended").font(.pxSmall).foregroundStyle(Color.paper.opacity(0.85))
            VStack(spacing: 3) {
                ForEach(0..<3, id: \.self) { r in
                    HStack(spacing: 3) {
                        ForEach(0..<3, id: \.self) { c in
                            let i = r * 3 + c
                            ZStack {
                                Rectangle().fill(Color(hex: "#d9c6a1"))
                                if line.contains(i) { Rectangle().strokeBorder(Color.butter, lineWidth: 3) }
                                if let s = Side(rawValue: String(UnicodeScalar(b[i]))) { GlyphView(glyph: GameArt.mark(s), scale: 2.4) }
                            }
                            .frame(width: 34, height: 34)
                        }
                    }
                }
            }
            .padding(4)
            .background(Color(hex: "#6b4a2f").opacity(0.9))
        }
    }
}

struct NoughtsSquare: View {
    let index: Int
    let side: Side?
    let can: Bool
    let won: Bool
    let size: CGFloat
    var name: (Side) -> String
    var tap: () -> Void

    var body: some View {
        Button(action: tap) {
            ZStack {
                Rectangle().fill(can ? Color(hex: "#f4ead6") : Color(hex: "#efe3cb"))
                VStack {
                    Spacer()
                    Rectangle().fill(Color.black.opacity(0.12)).frame(height: 4)
                }
                if won { Rectangle().strokeBorder(Color.butter, lineWidth: 4) }
                if let side { GlyphView(glyph: GameArt.mark(side), scale: 7.5).modifier(Blink(on: won)) }
            }
            .frame(width: size, height: size)
        }
        .buttonStyle(.plain)
        .disabled(!can)
        .accessibilityLabel(side.map { "Square \(index + 1), \(name($0))’s" } ?? "Square \(index + 1), empty")
    }
}

/* ---------- Fence the Garden ---------- */

struct FenceGameView: View {
    let place: PlaceModel

    private let CELL: CGFloat = 60
    private let PAD: CGFloat = 18
    private var SIZE: CGFloat { PAD * 2 + CELL * CGFloat(Fence.n) }

    var body: some View {
        let m = place.games[.fence]
        let me = place.mySeat
        let st = m.map { Fence.State($0.state) } ?? Fence.State()
        GameFrame(place: place, kind: .fence, match: m, marker: { GameArt.flower($0) }, status: status(m, st)) {
            VStack(spacing: 12) {
                HStack(spacing: 10) {
                    GlyphView(glyph: GameArt.flower(me), scale: 3)
                    Text("You \(st.count(me))").font(.px(16, 700)).foregroundStyle(Color.paper)
                    Text("·").foregroundStyle(Color.paper.opacity(0.5))
                    GlyphView(glyph: GameArt.flower(me.other), scale: 3)
                    Text("\(place.theirName) \(st.count(me.other))").font(.px(16, 700)).foregroundStyle(Color.paper)
                }
                garden(m, st)
            }
        } actions: {
            startButton(m) { place.saveGame(Play.newFence(m.map { $0.status == .over ? $0.startedBy.other : me } ?? me, wins: m?.wins)) }
        }
    }

    private func status(_ m: Match?, _ st: Fence.State) -> Text {
        let me = place.mySeat, partner = place.theirName
        guard let m else { return say(("Take turns adding one bit of fence. Close a bed’s fourth side and it’s yours, and you go again. Most beds wins.", false)) }
        let mine = st.count(me), theirs = st.count(me.other)
        if m.status == .over {
            if m.winner == me.rawValue { return say(("You won, \(mine) beds to \(theirs)!", true)) }
            if m.winner == "draw" { return say(("A draw!", false)) }
            return say(("\(partner) won", true), (", \(theirs) beds to \(mine).", false))
        }
        if m.turn == me {
            let before = m.seq > 0 && m.updatedBy == me.other ? "\(partner) \(m.last). " : m.seq > 0 && m.updatedBy == me ? "You closed a bed: go again! " : ""
            return say((before, false), ("Your move.", true), (" Tap a gap between two posts.", false))
        }
        return waiting(m, me: me, partner: partner, verb: "add a bit of fence")
    }

    /// where a piece of fence runs, in the garden's units
    private func geom(_ e: Int) -> (CGPoint, CGPoint, Bool) {
        if e < Fence.hCount {
            let r = e / Fence.n, c = e % Fence.n
            return (CGPoint(x: PAD + CGFloat(c) * CELL, y: PAD + CGFloat(r) * CELL), CGPoint(x: PAD + CGFloat(c + 1) * CELL, y: PAD + CGFloat(r) * CELL), true)
        }
        let k = e - Fence.hCount
        let r = k / (Fence.n + 1), c = k % (Fence.n + 1)
        return (CGPoint(x: PAD + CGFloat(c) * CELL, y: PAD + CGFloat(r) * CELL), CGPoint(x: PAD + CGFloat(c) * CELL, y: PAD + CGFloat(r + 1) * CELL), false)
    }

    private func garden(_ m: Match?, _ st: Fence.State) -> some View {
        let me = place.mySeat
        let myTurn = m?.status == .playing && m?.turn == me
        let fences = Array(st.fences.utf8)
        let beds = Array(st.beds.utf8)
        let side: CGFloat = 336
        let k = side / SIZE
        return Canvas { ctx, _ in
            ctx.scaleBy(x: k, y: k)
            ctx.fill(Path(CGRect(x: 0, y: 0, width: SIZE, height: SIZE)), with: .color(Color(hex: "#3f6337")))
            // the beds
            for i in 0..<(Fence.n * Fence.n) {
                let x = PAD + CGFloat(i % Fence.n) * CELL, y = PAD + CGFloat(i / Fence.n) * CELL
                let owner = Side(rawValue: String(UnicodeScalar(beds[i])))
                ctx.fill(Path(CGRect(x: x + 4, y: y + 4, width: CELL - 8, height: CELL - 8)), with: .color(Color(hex: owner == nil ? "#4f7a43" : "#5b3d2a")))
                if let o = owner {
                    let petal = Color(hex: o == .a ? "#ffc94a" : "#7fe0c0"), dark = Color(hex: o == .a ? "#b8741f" : "#2f8f78")
                    for (px, py) in [(3, 0), (0, 3), (6, 3), (3, 6)] { ctx.fill(Path(CGRect(x: x + 14 + CGFloat(px) * 4, y: y + 14 + CGFloat(py) * 4, width: 8, height: 8)), with: .color(petal)) }
                    for (px, py) in [(1, 1), (5, 1), (1, 5), (5, 5)] { ctx.fill(Path(CGRect(x: x + 14 + CGFloat(px) * 4, y: y + 14 + CGFloat(py) * 4, width: 8, height: 8)), with: .color(dark)) }
                    ctx.fill(Path(CGRect(x: x + 26, y: y + 26, width: 8, height: 8)), with: .color(Color(hex: "#fff4c2")))
                } else {
                    ctx.fill(Path(CGRect(x: x + 14 + CGFloat((i * 7) % 20), y: y + 16 + CGFloat((i * 11) % 18), width: 4, height: 4)), with: .color(Color(hex: "#5f8c50")))
                }
            }
            // the fences, built and not
            for e in 0..<Fence.edges {
                let (a, b, across) = geom(e)
                let built = fences[e] != UInt8(ascii: ".")
                let last = st.lastEdge == e
                if built {
                    let r = across ? CGRect(x: a.x, y: a.y - 4, width: CELL, height: 8) : CGRect(x: a.x - 4, y: a.y, width: 8, height: CELL)
                    ctx.fill(Path(r), with: .color(Color(hex: last ? "#f1d27a" : "#c89a5c")))
                    let hi = across ? CGRect(x: a.x, y: a.y - 4, width: CELL, height: 2) : CGRect(x: a.x - 4, y: a.y, width: 2, height: CELL)
                    ctx.fill(Path(hi), with: .color(Color(hex: last ? "#fff4c2" : "#e2bf84")))
                } else {
                    var p = Path()
                    p.move(to: a)
                    p.addLine(to: b)
                    ctx.stroke(p, with: .color(Color(hex: "#efe3cb").opacity(myTurn ? 0.3 : 0.18)), style: StrokeStyle(lineWidth: 2, dash: [4, 6]))
                }
            }
            // the posts
            for i in 0..<((Fence.n + 1) * (Fence.n + 1)) {
                let r = CGRect(x: PAD + CGFloat(i % (Fence.n + 1)) * CELL - 6, y: PAD + CGFloat(i / (Fence.n + 1)) * CELL - 6, width: 12, height: 12)
                ctx.fill(Path(r), with: .color(Color(hex: "#3b2a1e")))
                ctx.fill(Path(r.insetBy(dx: 2, dy: 2)), with: .color(Color(hex: "#7a5232")))
            }
        }
        .frame(width: side, height: side)
        .overlay { Rectangle().strokeBorder(Color(hex: "#2b4426"), lineWidth: 4).padding(-4) }
        .contentShape(Rectangle())
        .gesture(SpatialTapGesture().onEnded { tap in
            guard let m, myTurn else { return }
            let p = CGPoint(x: tap.location.x / k, y: tap.location.y / k)
            // the nearest gap to the tap, if it's close enough
            var best: (Int, CGFloat)?
            for e in 0..<Fence.edges where fences[e] == UInt8(ascii: ".") {
                let (a, b, across) = geom(e)
                let d: CGFloat = across
                    ? (p.x < a.x ? hypot(p.x - a.x, p.y - a.y) : p.x > b.x ? hypot(p.x - b.x, p.y - b.y) : abs(p.y - a.y))
                    : (p.y < a.y ? hypot(p.x - a.x, p.y - a.y) : p.y > b.y ? hypot(p.x - b.x, p.y - b.y) : abs(p.x - a.x))
                if d < 22, d < (best?.1 ?? .infinity) { best = (e, d) }
            }
            guard let e = best?.0, let next = Play.fence(m, me, edge: e) else { return }
            Haptics.tap()
            place.saveGame(next)
        })
        .accessibilityLabel("The garden: tap a gap between two posts to add a bit of fence")
    }
}

/* ---------- Lanterns ---------- */

struct LanternsGameView: View {
    let place: PlaceModel
    private let cell: CGFloat = 40

    var body: some View {
        let m = place.games[.lanterns]
        let me = place.mySeat
        let st = m.map { Lanterns.State($0.state) } ?? Lanterns.State(starter: me)
        GameFrame(place: place, kind: .lanterns, match: m, marker: { GameArt.lantern($0) }, status: status(m, st)) {
            VStack(spacing: 12) {
                HStack(spacing: 10) {
                    GlyphView(glyph: GameArt.lantern(me), scale: 3)
                    Text("You \(Lanterns.count(st.board, me))").font(.px(16, 700)).foregroundStyle(Color.paper)
                    Text("·").foregroundStyle(Color.paper.opacity(0.5))
                    GlyphView(glyph: GameArt.lantern(me.other), scale: 3)
                    Text("\(place.theirName) \(Lanterns.count(st.board, me.other))").font(.px(16, 700)).foregroundStyle(Color.paper)
                }
                pond(m, st)
            }
        } actions: {
            startButton(m) { place.saveGame(Play.newLanterns(m.map { $0.status == .over ? $0.startedBy.other : me } ?? me, wins: m?.wins)) }
        }
    }

    private func status(_ m: Match?, _ st: Lanterns.State) -> Text {
        let me = place.mySeat, partner = place.theirName
        guard let m else { return say(("Light a lantern so a line of theirs is caught between two of yours, and the whole line turns your colour. You can only light where you’d catch something.", false)) }
        let mine = Lanterns.count(st.board, me), theirs = Lanterns.count(st.board, me.other)
        if m.status == .over {
            if m.winner == me.rawValue { return say(("You won, \(mine) lanterns to \(theirs)!", true)) }
            if m.winner == "draw" { return say(("An even pond: a draw.", false)) }
            return say(("\(partner) won", true), (", \(theirs) lanterns to \(mine).", false))
        }
        if m.turn == me {
            let before = st.passed == me.other ? "\(partner) had nowhere to light, so you go again. " : m.seq > 0 && m.updatedBy == me.other ? "\(partner) \(m.last). " : ""
            return say((before, false), ("Your move.", true), (" The little dots show where you can light one.", false))
        }
        if st.passed == me { return say(("You had nowhere to light, so it’s ", false), ("\(partner)’s move", true), (" again.", false)) }
        return waiting(m, me: me, partner: partner, verb: "light a lantern")
    }

    private func pond(_ m: Match?, _ st: Lanterns.State) -> some View {
        let me = place.mySeat
        let myTurn = m?.status == .playing && m?.turn == me
        let legal = Set(myTurn ? Lanterns.legal(st.board, me) : [])
        let board = Array(st.board.utf8)
        let flipped = Set(st.flipped)
        return VStack(spacing: 0) {
            ForEach(0..<Lanterns.size, id: \.self) { y in
                HStack(spacing: 0) {
                    ForEach(0..<Lanterns.size, id: \.self) { x in
                        let i = Lanterns.at(x, y)
                        LanternSquare(side: Side(rawValue: String(UnicodeScalar(board[i]))), dark: (y + i) % 2 == 1, last: st.lastCell == i, legal: legal.contains(i),
                                      blink: flipped.contains(i) && m?.status == .over, size: cell) {
                            guard let m, legal.contains(i), let next = Play.lanterns(m, me, cell: i) else { return }
                            Haptics.tap()
                            place.saveGame(next)
                        }
                    }
                }
            }
        }
        .padding(2)
        .background(Color(hex: "#24485a"))
        .overlay { Rectangle().strokeBorder(Color(hex: "#0c1c25"), lineWidth: 4).padding(-4) }
        .padding(4)
    }
}

struct LanternSquare: View {
    let side: Side?
    let dark: Bool
    let last: Bool
    let legal: Bool
    let blink: Bool
    let size: CGFloat
    var tap: () -> Void

    var body: some View {
        Button(action: tap) {
            ZStack {
                Rectangle().fill(Color(hex: dark ? "#1d3b4a" : "#1a3542"))
                if last { Rectangle().strokeBorder(Color(hex: "#f1d27a"), lineWidth: 2) }
                if let side {
                    GlowGlyph(glyph: GameArt.lantern(side), scale: 4, glow: GameArt.glow(side))
                        .id(side)
                        .transition(.scale.combined(with: .opacity))
                        .modifier(Blink(on: blink))
                } else if legal {
                    Rectangle().fill(Color(hex: "#f1d27a").opacity(0.75)).frame(width: 6, height: 6)
                }
            }
            .frame(width: size, height: size)
            .animation(.easeOut(duration: 0.25), value: side)
        }
        .buttonStyle(.plain)
        .disabled(!legal)
    }
}

/* ---------- Paper Boats ---------- */

enum BoatArt {
    /// a folded paper boat, `len` cells long (9 pixels each), turned to run down when `down`
    static func image(_ b: Boats.Boat, soggy: Bool) -> CGImage? {
        let w = b.len * 9
        let buf = PixelBuffer(w, 9)
        let c = soggy
            ? (hull: RGB("#8f8676"), shade: RGB("#7a7263"), dark: RGB("#645d51"), sail: RGB("#9c9383"), edge: RGB("#4d473e"))
            : (hull: RGB("#efe3cb"), shade: RGB("#d8c7a4"), dark: RGB("#bfae8c"), sail: RGB("#f7eedb"), edge: RGB("#8f7f64"))
        buf.rect(1, 4, w - 2, 1, c.edge)
        buf.rect(1, 5, w - 2, 1, c.hull)
        buf.rect(2, 6, w - 4, 1, c.shade)
        buf.rect(3, 7, w - 6, 1, c.dark)
        buf.rect(3, 8, w - 6, 1, c.edge)
        let sails = max(1, Int((Double(b.len) / 2).rounded()))
        for s in 0..<sails {
            let cx = Int(((Double(s) + 0.5) * Double(w) / Double(sails)).rounded())
            for k in 0..<4 { buf.rect(cx - k, 1 + k, k + 1, 1, k % 2 == 1 ? c.sail : c.shade) }
            buf.rect(cx, 0, 1, 5, c.edge)
        }
        if !b.down { return Pixels.image(buf.data, w, 9) }
        // turned a quarter clockwise
        var out = [UInt8](repeating: 0, count: w * 9 * 4)
        for y in 0..<9 {
            for x in 0..<w {
                let from = (y * w + x) * 4
                let to = (x * 9 + (8 - y)) * 4
                for k in 0..<4 { out[to + k] = buf.data[from + k] }
            }
        }
        return Pixels.image(out, 9, w)
    }
}

struct PondView: View {
    let label: String
    var boats: [Boats.Boat] = []
    var soggy: [Boats.Boat] = []
    let shots: String
    var last: Int?
    var canAim: (Int) -> Bool = { _ in false }
    var onCell: ((Int) -> Void)?
    private let p: CGFloat = 36

    var body: some View {
        let marks = Array(shots.utf8)
        VStack(spacing: 6) {
            Text(label).font(.px(17, 700)).foregroundStyle(Color.paper)
            HStack(alignment: .top, spacing: 4) {
                VStack(spacing: 0) {
                    Color.clear.frame(width: 16, height: p * 0.6)
                    ForEach(0..<Boats.size, id: \.self) { y in
                        Text("\(y + 1)").font(.pxTiny).foregroundStyle(Color.paper.opacity(0.7)).frame(width: 16, height: p)
                    }
                }
                VStack(spacing: 0) {
                    HStack(spacing: 0) {
                        ForEach(Array("ABCDEFGH"), id: \.self) { l in
                            Text(String(l)).font(.pxTiny).foregroundStyle(Color.paper.opacity(0.7)).frame(width: p, height: p * 0.6)
                        }
                    }
                    ZStack(alignment: .topLeading) {
                        Rectangle().fill(Color(hex: "#3d6d84"))
                        // the grid
                        Path { path in
                            for k in 1..<Boats.size {
                                path.addRect(CGRect(x: CGFloat(k) * p, y: 0, width: 1, height: p * 8))
                                path.addRect(CGRect(x: 0, y: CGFloat(k) * p, width: p * 8, height: 1))
                            }
                        }
                        .fill(Color(hex: "#356073").opacity(0.6))
                        ForEach(Array((soggy + boats).enumerated()), id: \.offset) { i, b in
                            PixelImage(image: BoatArt.image(b, soggy: i < soggy.count), scale: p / 9)
                                .offset(x: CGFloat(b.x) * p, y: CGFloat(b.y) * p)
                        }
                        VStack(spacing: 0) {
                            ForEach(0..<Boats.size, id: \.self) { y in
                                HStack(spacing: 0) {
                                    ForEach(0..<Boats.size, id: \.self) { x in
                                        let i = Boats.idx(x, y)
                                        PondSquare(index: i, mark: i < marks.count ? marks[i] : UInt8(ascii: "."), last: last == i, size: p, enabled: onCell != nil && canAim(i)) { onCell?(i) }
                                    }
                                }
                            }
                        }
                    }
                    .frame(width: p * 8, height: p * 8)
                    .overlay { Rectangle().strokeBorder(Color(hex: "#2b4e60"), lineWidth: 4).padding(-4) }
                }
            }
        }
    }
}

struct PondSquare: View {
    let index: Int
    let mark: UInt8
    let last: Bool
    let size: CGFloat
    let enabled: Bool
    var tap: () -> Void

    var body: some View {
        let hit = mark == UInt8(ascii: "x"), water = mark == UInt8(ascii: "o")
        Button(action: tap) {
            ZStack {
                Color.clear
                if hit { GlyphView(glyph: GameArt.hit, scale: size * 0.62 / 7) }
                if water { GlyphView(glyph: GameArt.miss, scale: size * 0.56 / 7).opacity(0.85) }
                if last { Rectangle().strokeBorder(Color(hex: "#f1d27a"), lineWidth: 2) }
            }
            .frame(width: size, height: size)
            .contentShape(Rectangle())
            .modifier(Blink(on: last))
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .accessibilityLabel("\(Boats.coordName(index))\(hit ? ", hit" : water ? ", water" : "")")
    }
}

struct BoatsGameView: View {
    let place: PlaceModel
    @State private var draft: [Boats.Boat] = Boats.randomFleet { Double.random(in: 0..<1) }
    @State private var note: String?

    var body: some View {
        let m = place.games[.boats]
        let me = place.mySeat
        let st = m.map { Boats.State($0.state) } ?? Boats.State()
        let settingUp = m?.status == .setup && st.fleets[me] == nil
        GameFrame(place: place, kind: .boats, match: m, status: status(m, st, settingUp)) {
            VStack(spacing: 18) {
                if let note {
                    Text(note).font(.pxSmall).foregroundStyle(Color.inkSoft).padding(.horizontal, 12).padding(.vertical, 6).pxBox()
                        .task { try? await Task.sleep(nanoseconds: 2_600_000_000); self.note = nil }
                }
                if let m, m.status != .setup {
                    ponds(m, st)
                } else {
                    setupPond(st, settingUp)
                }
                Text("Boats: one of 4, two of 3, one of 2. They never touch, not even at the corners.").font(.pxSmall).foregroundStyle(Color.paper.opacity(0.75)).multilineTextAlignment(.center)
            }
        } actions: {
            if m == nil || m?.status == .over {
                Button(m == nil ? "Start a game" : "Play again") {
                    Haptics.tap()
                    place.saveGame(Play.newBoats(me, wins: m?.wins))
                }
                .buttonStyle(.px(.sage))
            } else if settingUp, let m {
                Button("Shuffle") { draft = Boats.randomFleet { Double.random(in: 0..<1) } }.buttonStyle(.px(.paper))
                Button("Hide my boats") {
                    guard let next = Play.boatsReady(m, me, draft) else { return }
                    Haptics.success()
                    place.saveGame(next)
                }
                .buttonStyle(.px(.sage))
            }
        }
    }

    private func setupPond(_ st: Boats.State, _ settingUp: Bool) -> some View {
        let mine = st.fleets[place.mySeat]
        let shown: [Boats.Boat] = settingUp || mine == nil ? draft : mine!
        let aim: (Int) -> Bool = { settingUp && Boats.boatAt(draft, $0) != nil }
        let tap: ((Int) -> Void)? = settingUp ? { turn($0) } : nil
        return PondView(label: "Your pond", boats: shown, shots: String(repeating: ".", count: Boats.cells), canAim: aim, onCell: tap)
    }

    private func ponds(_ m: Match, _ st: Boats.State) -> some View {
        let me = place.mySeat, them = me.other
        let myShots = st.shots[me] ?? "", theirShots = st.shots[them] ?? ""
        let theirSunk = Boats.sunk(st.fleets[them], myShots)
        let mySunk = Boats.sunk(st.fleets[me], theirShots)
        let myTurn = m.status == .playing && m.turn == me
        let open = Array(myShots.utf8)
        let theirAfloat: [Boats.Boat] = m.status == .over ? (st.fleets[them] ?? []).filter { !theirSunk.contains($0) } : []
        let myAfloat: [Boats.Boat] = (st.fleets[me] ?? []).filter { !mySunk.contains($0) }
        let lastMine: Int? = st.lastShot?.by == me ? st.lastShot?.cell : nil
        let lastTheirs: Int? = st.lastShot?.by == them ? st.lastShot?.cell : nil
        let aim: (Int) -> Bool = { i in myTurn && i < open.count && open[i] == UInt8(ascii: ".") }
        let shoot: (Int) -> Void = { i in
            guard let next = Play.boatsShot(m, me, cell: i) else { return }
            Haptics.tap()
            place.saveGame(next)
        }
        return VStack(spacing: 18) {
            VStack(spacing: 4) {
                PondView(label: "\(place.theirName)’s pond", boats: theirAfloat, soggy: theirSunk, shots: myShots, last: lastMine, canAim: aim, onCell: shoot)
                Text(afloat(theirSunk.count)).font(.pxSmall).foregroundStyle(Color.paper.opacity(0.8))
            }
            VStack(spacing: 4) {
                PondView(label: "Your pond", boats: myAfloat, soggy: mySunk, shots: theirShots, last: lastTheirs)
                Text(afloat(mySunk.count)).font(.pxSmall).foregroundStyle(Color.paper.opacity(0.8))
            }
        }
    }

    private func afloat(_ sunk: Int) -> String { "\(Boats.fleetLengths.count - sunk) of \(Boats.fleetLengths.count) boats afloat" }

    private func turn(_ cell: Int) {
        guard let b = Boats.boatAt(draft, cell) else { return }
        let rest = draft.filter { $0 != b }
        var turned = b
        turned.down.toggle()
        if Boats.canPlace(rest, turned) {
            Haptics.tap()
            draft = rest + [turned]
        } else {
            note = "No room to turn that one here. Try Shuffle."
        }
    }

    private func status(_ m: Match?, _ st: Boats.State, _ settingUp: Bool) -> Text {
        let me = place.mySeat, partner = place.theirName
        guard let m else { return say(("Hide four paper boats on your pond. \(partner) hides theirs, then you take turns guessing where the other’s are. Say your guesses out loud if you’re on a call.", false)) }
        if m.status == .over {
            if m.winner == me.rawValue { return say(("You sank all of \(partner)’s boats. You win!", true)) }
            return say(("\(partner) sank all your boats", true), (" and wins this one.", false))
        }
        if settingUp { return say(("Hide your boats.", true), (" Shuffle until you like it, tap a boat to turn it, then hide them.\(st.fleets[me.other] != nil ? " \(partner) has already hidden theirs." : "")", false)) }
        if m.status == .setup { return say(("Your boats are hidden. Waiting for \(partner) to hide theirs.", false)) }
        if m.turn == me {
            if m.updatedBy == me.other && m.last != "hid their boats" { return say(("\(partner) \(m.last). ", false), ("Your turn:", true), (" pick a spot on their pond.", false)) }
            return say(("Both ponds are ready. ", false), ("You go first:", true), (" pick a spot on \(partner)’s pond.", false))
        }
        if m.updatedBy == me && m.last != "hid their boats" { return say(("You \(m.last). Now it’s ", false), ("\(partner)’s turn", true), (".", false)) }
        return say(("Both ponds are ready. ", false), ("\(partner) goes first.", true))
    }
}

/* ---------- on Home ---------- */

/// on Home: a game that's waiting on you
struct GameCard: View {
    let place: PlaceModel
    var open: (GameKind) -> Void
    var body: some View {
        if let k = place.gamesWaiting.first, let m = place.games[k] {
            Button {
                open(k)
            } label: {
                HStack(alignment: .top, spacing: 14) {
                    GlyphView(glyph: GameArt.icon(k), scale: 4).frame(width: 40)
                    VStack(alignment: .leading, spacing: 6) {
                        Text(k.info.name).font(.px(14, 600)).foregroundStyle(Color.muted)
                        Text(Play.note(m, who: place.theirName)).font(.pxBodyBold).foregroundStyle(Color.inkSoft).multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                        Text(Play.onIPhone.contains(k) ? (Play.isLiveInvite(k) ? "Join →" : "Play →") : "Open soultied.app →").font(.px(16, 700)).foregroundStyle(Color.terracottaD)
                    }
                    Spacer(minLength: 0)
                }
                .pxCard()
            }
            .buttonStyle(.press)
        }
    }
}
