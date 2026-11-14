import SwiftUI
import SoultiedCore

/*
 * Chess on the iPhone (the website's src/components/games/ChessGame.tsx; the rules are in SoultiedCore's
 * Chess.swift): your colour at the bottom, tap a piece and then where it goes, a little chooser when a pawn
 * reaches the far side, and a draw to offer or answer, or resigning, under the board.
 */

extension GameArt {
    /// the pieces, 9 × 10: o outline, x body, h a little light
    static let chessRows: [Character: [String]] = [
        "p": [".........", ".........", "...ooo...", "..oxxxo..", "..oxhxo..", "...oxo...", "..oxxxo..", ".oxxxxxo.", ".ooooooo.", "........."],
        "n": [".........", "....oo...", "...oxxo..", "..oxxxxo.", ".oxoxxxo.", "oxxxxxxo.", ".oooxxxo.", "..oxxxxo.", ".oxxxxxxo", ".oooooooo"],
        "b": ["....o....", "...oxo...", "..oxxxo..", "..oxoxo..", "..oxxxo..", "...oxo...", "...oxo...", "..oxxxo..", ".oxxxxxo.", ".ooooooo."],
        "r": [".........", ".oo.o.oo.", ".oxoxoxo.", ".oxxxxxo.", "..oxxxo..", "..oxhxo..", "..oxxxo..", ".oxxxxxo.", ".ooooooo.", "........."],
        "q": ["o...o...o", ".o.oxo.o.", ".oxxxxxo.", "..oxxxo..", "..oxhxo..", "...oxo...", "..oxxxo..", ".oxxxxxo.", ".ooooooo.", "........."],
        "k": ["....o....", "...oxo...", "....o....", ".ooooooo.", ".oxxxxxo.", "..oxhxo..", "..oxxxo..", "..oxxxo..", ".oxxxxxo.", ".ooooooo."],
    ]
    /// a piece as its letter: "K" a white king, "n" a black knight
    static func piece(_ p: Character) -> Glyph {
        let white = p.isUppercase
        let rows = chessRows[Character(p.lowercased())] ?? chessRows["p"]!
        return Glyph(rows, white ? ["o": "#3a2a26", "x": "#fbf3e2", "h": "#e3d2b2"] : ["o": "#140d0a", "x": "#5a3e30", "h": "#8a6650"])
    }
    static func piece(_ p: UInt8) -> Glyph { piece(Character(UnicodeScalar(p))) }
}

struct ChessGameView: View {
    let place: PlaceModel
    @State private var sel: Int?
    @State private var promo: Chess.Move?
    @State private var resigning = false

    private static let light = Color(hex: "#efe0c2"), dark = Color(hex: "#a8784f")

    var body: some View {
        let m = place.games[.chess]
        let me = place.mySeat
        let st = m.map { Chess.State($0.state) } ?? Chess.State(white: me)
        let mine = st.color(of: me)
        let myTurn = m?.status == .playing && m?.turn == me
        let legal = myTurn ? Chess.legalMoves(st) : []
        GameFrame(place: place, kind: .chess, match: m, marker: { GameArt.piece(st.color(of: $0) == .w ? "K" : "k") }, status: status(m, st)) {
            VStack(spacing: 10) {
                takenRow("\(place.theirName) has taken:", Chess.captured(st.board, from: mine))
                GeometryReader { g in board(m, st, legal: legal, side: g.size.width) }
                    .aspectRatio(1, contentMode: .fit)
                    .frame(maxWidth: 440)
                    .frame(maxWidth: .infinity)
                takenRow("You’ve taken:", Chess.captured(st.board, from: mine.other))
            }
            .onChange(of: m.map { "\($0.id):\($0.seq)" }) { _, _ in
                sel = nil
                promo = nil
                sound(place.games[.chess])
            }
        } actions: {
            actions(m, st)
        }
    }

    /* ---------- what's said ---------- */

    private func status(_ m: Match?, _ st: Chess.State) -> Text {
        let me = place.mySeat, partner = place.theirName
        guard let m else { return say(("Proper chess, a move whenever you’re here. Start a game and you play white; \(partner) answers whenever they’re next in.", false)) }
        if m.status == .over {
            if m.winner == "draw" { return st.end == "agreed" ? say(("You agreed a draw.", false)) : say(("\(m.updatedBy == me ? "You" : partner) \(m.last).", false)) }
            if m.winner == me.rawValue {
                return say((st.end == "resigned" ? "\(partner) resigned. You win! " : "Checkmate. You win! ", true), ("\(partner) will see it next time they look.", false))
            }
            return st.end == "resigned" ? say(("You resigned", true), (", so \(partner) wins this one.", false)) : say(("\(partner) checkmated you", true), (" and wins this one.", false))
        }
        if st.offer == me.other { return say(("\(partner) offered a draw.", true), (" Take it, or play on.", false)) }
        if m.turn == me {
            let before = m.seq > 0 && m.updatedBy == me.other ? "\(partner) \(m.last). " : ""
            return say((before, false), (st.check ? "You’re in check." : "Your move.", true), (sel == nil ? " Tap one of your pieces." : " Tap where it goes.", false),
                       (st.offer == me ? " (Your draw offer is waiting.)" : "", false))
        }
        if m.updatedBy == me && m.seq > 0 { return say(("You \(m.last). Now it’s ", false), ("\(partner)’s move", true), (".", false)) }
        return say(("Waiting for ", false), (partner, true), (" to move.", false))
    }

    private func sound(_ m: Match?) {
        guard let m, m.status == .playing else { return }
        let st = Chess.State(m.state)
        if st.check {
            Chiptune.shared.tone(880, 0.1, 0, .square, 0.04)
            Chiptune.shared.tone(660, 0.1, 0.1, .square, 0.04)
            if m.updatedBy != place.mySeat { Haptics.soft() }
        } else if m.last.hasPrefix("took") {
            Chiptune.shared.tone(330, 0.1, 0, .square, 0.05)
        }
    }

    /* ---------- the board ---------- */

    private func board(_ m: Match?, _ st: Chess.State, legal: [Chess.Move], side: CGFloat) -> some View {
        let mine = st.color(of: place.mySeat)
        let cell = (side - 12) / 8
        let checked = st.check ? Chess.kingSquare(st.board, st.side) : -1
        let targets = sel.map { s in legal.filter { $0.from == s } } ?? []
        return ZStack {
            VStack(spacing: 0) {
                ForEach(0..<8, id: \.self) { vr in
                    HStack(spacing: 0) {
                        ForEach(0..<8, id: \.self) { vc in
                            let sq = mine == .w ? vr * 8 + vc : 63 - (vr * 8 + vc)
                            square(sq, st, legal: legal, targets: targets, checked: checked, cell: cell, labelRank: vc == 0, labelFile: vr == 7)
                        }
                    }
                }
            }
            .padding(6)
            .background(Color(hex: "#6b4a2f"))
            .overlay(Rectangle().strokeBorder(Color(hex: "#3b2a1e"), lineWidth: 4).padding(-4))
            if let p = promo { promoChooser(p, mine) }
        }
        .frame(width: side, height: side)
    }

    private func square(_ sq: Int, _ st: Chess.State, legal: [Chess.Move], targets: [Chess.Move], checked: Int, cell: CGFloat, labelRank: Bool, labelFile: Bool) -> some View {
        let r = sq / 8, c = sq % 8
        let light = (r + c) % 2 == 0
        let p = st.board[sq]
        let empty = p == UInt8(ascii: ".")
        let isTarget = targets.contains { $0.to == sq }
        let wasLast = st.last.map { $0.from == sq || $0.to == sq } ?? false
        let mine = st.color(of: place.mySeat)
        let pickable = !empty && Chess.colorOf(p) == mine && legal.contains { $0.from == sq }
        let bg: Color = sq == checked ? Color(hex: "#d9644f") : wasLast ? Color(hex: light ? "#ecd38a" : "#c9a35a") : light ? Self.light : Self.dark
        return Button {
            tap(sq, legal: legal, targets: targets)
        } label: {
            ZStack {
                bg
                if !empty {
                    GlyphView(glyph: GameArt.piece(p), scale: cell * 0.8 / 10)
                        .modifier(Land(key: st.last?.to == sq ? "\(st.full)\(st.side.rawValue)" : ""))
                }
                if isTarget {
                    if empty { Rectangle().fill(Color.ink.opacity(0.4)).frame(width: cell * 0.26, height: cell * 0.26) }
                    else { Rectangle().strokeBorder(Color.ink.opacity(0.45), lineWidth: 4).padding(3) }
                }
                if sel == sq { Rectangle().strokeBorder(Color(hex: "#f1d27a"), lineWidth: 4) }
                if labelRank {
                    Text("\(8 - r)").font(.px(9, 700)).foregroundStyle(light ? Self.dark : Self.light)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading).padding(2)
                }
                if labelFile {
                    Text(String(Array("abcdefgh")[c])).font(.px(9, 700)).foregroundStyle(light ? Self.dark : Self.light)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing).padding(2)
                }
            }
            .frame(width: cell, height: cell)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!(isTarget || pickable || sel != nil))
        .accessibilityLabel("\(Chess.squareName(sq))\(empty ? "" : ", \(Chess.colorOf(p) == .w ? "white" : "black") \(Chess.pieceName(p))")\(isTarget ? ": move here" : "")")
    }

    private func tap(_ sq: Int, legal: [Chess.Move], targets: [Chess.Move]) {
        guard let m = place.games[.chess], m.status == .playing, m.turn == place.mySeat else { return }
        let st = Chess.State(m.state)
        let to = targets.filter { $0.to == sq }
        if !to.isEmpty {
            if to.count > 1 { promo = Chess.Move(to[0].from, sq) } else { play(to[0]) }
            return
        }
        let p = st.board[sq]
        if p != UInt8(ascii: "."), Chess.colorOf(p) == st.color(of: place.mySeat), legal.contains(where: { $0.from == sq }) {
            Haptics.select()
            sel = sel == sq ? nil : sq
        } else {
            sel = nil
        }
    }

    private func play(_ mv: Chess.Move) {
        guard let m = place.games[.chess], let next = Play.chess(m, place.mySeat, move: mv) else { return }
        Haptics.tap()
        sel = nil
        promo = nil
        place.saveGame(next)
    }

    private func promoChooser(_ p: Chess.Move, _ mine: Chess.Color) -> some View {
        ZStack {
            Color(hex: "#1b1411").opacity(0.6)
            VStack(spacing: 10) {
                Text("Make your pawn a…").font(.pxBodyBold).foregroundStyle(Color.inkSoft)
                HStack(spacing: 8) {
                    ForEach(["q", "r", "b", "n"] as [Character], id: \.self) { k in
                        Button {
                            play(Chess.Move(p.from, p.to, promo: k))
                        } label: {
                            GlyphView(glyph: GameArt.piece(mine == .w ? Character(k.uppercased()) : k), scale: 3.2).frame(width: 48, height: 48)
                        }
                        .buttonStyle(.px(.paper, small: true))
                        .accessibilityLabel(Chess.pieceName(k.asciiValue!))
                    }
                }
                Button("Not this move") { promo = nil }.font(.pxSmall).foregroundStyle(Color.terracottaD)
            }
            .padding(16)
            .pxBox()
        }
    }

    private func takenRow(_ label: String, _ ps: [UInt8]) -> some View {
        HStack(spacing: 4) {
            Text(label).font(.pxSmall).foregroundStyle(Color.paper.opacity(0.85))
            if ps.isEmpty {
                Text("nothing yet").font(.pxSmall).foregroundStyle(Color.paper.opacity(0.5))
            } else {
                ForEach(Array(ps.enumerated()), id: \.offset) { _, p in GlyphView(glyph: GameArt.piece(p), scale: 2) }
            }
            Spacer(minLength: 0)
        }
        .frame(minHeight: 22)
    }

    /* ---------- under the board ---------- */

    @ViewBuilder
    private func actions(_ m: Match?, _ st: Chess.State) -> some View {
        let me = place.mySeat
        if m == nil || m?.status == .over {
            Button(m == nil ? "Start a game" : "Play again") {
                Haptics.tap()
                resigning = false
                place.saveGame(Play.newChess(m.map { $0.status == .over ? $0.startedBy.other : me } ?? me, wins: m?.wins))
            }
            .buttonStyle(.px(.sage))
        } else if let m, st.offer == me.other {
            Button("Take the draw") { if let n = Play.chessAnswer(m, me, yes: true) { place.saveGame(n) } }.buttonStyle(.px(.sage))
            Button("Play on") { if let n = Play.chessAnswer(m, me, yes: false) { place.saveGame(n) } }.buttonStyle(.px(.paper))
        } else if let m {
            if st.offer == nil {
                Button("Offer a draw") {
                    Haptics.tap()
                    if let n = Play.chessOffer(m, me) { place.saveGame(n) }
                }
                .buttonStyle(.px(.paper, small: true))
            }
            if resigning {
                Button("Yes, resign") {
                    resigning = false
                    if let n = Play.chessResign(m, me) { place.saveGame(n) }
                }
                .buttonStyle(.px(.terracotta, small: true))
                Button("Keep playing") { resigning = false }.buttonStyle(.px(.paper, small: true))
            } else {
                Button("Resign") { resigning = true }.buttonStyle(.px(.paper, small: true))
            }
        }
    }
}

/// a piece settling onto its square when it's just moved there
private struct Land: ViewModifier {
    let key: String
    @State private var lift: CGFloat = 0
    func body(content: Content) -> some View {
        content
            .offset(y: lift)
            .onAppear { drop() }
            .onChange(of: key) { _, _ in drop() }
    }
    private func drop() {
        guard !key.isEmpty else { return }
        lift = -6
        withAnimation(.easeOut(duration: 0.18)) { lift = 0 }
    }
}
