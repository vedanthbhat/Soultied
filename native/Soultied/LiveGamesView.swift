import SwiftUI
import SoultiedCore

/*
 * The live games on the iPhone: Tug of War, Paper Scissors Stone and Quick Draw. You play at the same moment,
 * over the same live line as the website, so a phone can play a laptop (either one keeping the game). Around
 * each game: inviting your person, waiting for them, a three-second countdown, and who won.
 */

/* ---------- keeping a live game going while its screen is open ---------- */

struct LiveFrame<R: LiveRules, Content: View, Poster: View>: View {
    let place: PlaceModel
    let session: LiveSession<R>
    let title: String
    /// a line on how to play, shown before the game starts
    let howTo: String
    /// the status while playing
    let playing: Text
    let now: Double
    /// how the end reads, instead of who won (for the games you play on the same side)
    var outcome: ((LiveResult) -> Text)? = nil
    /// what each of you is up to, instead of wins (for the games you play on the same side)
    var coop: ((Side) -> String)? = nil
    @ViewBuilder var poster: () -> Poster
    @ViewBuilder var content: () -> Content
    @Environment(\.dismiss) private var dismiss

    /// the number in the countdown
    private var count: Int { max(1, Int(((session.startAt - now) / 1000).rounded(.up))) }
    /// when you won (or, playing on the same side, finished), while you were watching: a little confetti
    @State private var cheer: Date? = nil

    var body: some View {
        let stage = session.stage(now: now)
        let partner = place.theirName
        ScrollView {
            VStack(spacing: 16) {
                HStack(spacing: 8) {
                    Button("← All games") { dismiss() }.buttonStyle(.px(.paper, small: true))
                    MusicToggle()
                    Spacer()
                    Text(title).font(.px(24, 700)).foregroundStyle(Color.paper).lineLimit(1).minimumScaleFactor(0.6)
                }
                HStack(spacing: 14) {
                    if let coop {
                        CoopChip(place: place, side: place.mySeat, note: coop(place.mySeat))
                        CoopChip(place: place, side: place.mySeat.other, note: coop(place.mySeat.other))
                    } else {
                        PlayerChip(place: place, side: place.mySeat, match: session.raw)
                        PlayerChip(place: place, side: place.mySeat.other, match: session.raw)
                    }
                }
                .padding(4)
                status(stage, partner)
                    .foregroundStyle(Color.inkSoft)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .pxBox()
                if !session.demo, session.match?.status == .playing, !session.mode.words.isEmpty {
                    Text(session.mode.words).font(.pxTiny).foregroundStyle(Color.paper.opacity(0.7)).frame(maxWidth: .infinity).padding(.top, -8)
                }
                ZStack {
                    if session.state != nil && (stage == .count || stage == .play || stage == .over) { content() } else { poster() }
                    // (a small card over the middle of the board, not a full-width one)
                    if stage == .count {
                        VStack(spacing: 2) {
                            Text("STARTING IN").font(.px(13, 700)).tracking(2).foregroundStyle(Color.muted)
                            Text("\(count)").font(.px(64, 700)).foregroundStyle(Color.inkSoft)
                                .contentTransition(.numericText(countsDown: true))
                                .animation(.snappy(duration: 0.25), value: count)
                        }
                        .padding(.horizontal, 28)
                        .padding(.vertical, 12)
                        .pxBox(.paper, shadow: true)
                        .allowsHitTesting(false)
                        .transition(.scale(scale: 0.8).combined(with: .opacity))
                    }
                    if let c = cheer { Confetti().id(c).allowsHitTesting(false) }
                }
                // (the board, what's before it and the countdown all share the middle of the screen)
                .frame(maxWidth: .infinity)
                .animation(.easeOut(duration: 0.2), value: stage == .count)
                actions(stage, partner)
            }
            .padding(16)
            .padding(.bottom, 40)
        }
        .scrollBounceBehavior(.basedOnSize)
        .background(GameBackdrop())
        .onChange(of: session.end?.line) { _, _ in
            guard let r = session.end else { return }
            if r.winner == place.mySeat.rawValue || coop != nil {
                Haptics.success()
                Chiptune.shared.game(.win)
                let c = Date()
                cheer = c
                DispatchQueue.main.asyncAfter(deadline: .now() + 2.6) { if cheer == c { cheer = nil } }
            } else {
                Haptics.soft()
                Chiptune.shared.game(r.winner == "draw" ? .draw : .lose)
            }
        }
        // three, two, one... go
        .onChange(of: stage == .count ? count : 0) { _, n in
            if n > 0 { Chiptune.shared.game(.count) }
        }
        .onChange(of: stage == .play) { _, playing in
            if playing { Chiptune.shared.game(.go) }
        }
    }

    private func status(_ stage: LiveStage, _ partner: String) -> Text {
        if !session.ready { return say(("Live games need two. Once \(partner) has joined your place, you can play here together.", false)) }
        switch stage {
        case .idle: return say((howTo, false))
        case .inviting: return say(("Waiting for ", false), (partner, true), (" to join. They’ll see your invitation in the room (or here, if they’re already looking).", false))
        case .invited: return say(("\(partner) wants to play \(title) with you, right now. ", true), (howTo, false))
        case .waiting: return session.partnerHere ? say(("Getting the game ready…", false)) : say(("Waiting for ", false), (partner, true), (" to open \(title)…", false))
        case .count: return say(("Get ready… \(howTo)", false))
        case .play: return session.partnerHere ? playing : say(("\(partner)’s screen has gone quiet. Waiting for them to come back…", false))
        case .over:
            guard let r = session.result else { return say(("That game was stopped. \(howTo)", false)) }
            if let outcome { return outcome(r) }
            if r.winner == "draw" { return say(("A draw!", true)) }
            if r.winner == place.mySeat.rawValue { return say(("You win!", true), (" You \(r.line).", false)) }
            return say(("\(partner) wins.", true), (" They \(r.line).", false))
        }
    }

    @ViewBuilder
    private func actions(_ stage: LiveStage, _ partner: String) -> some View {
        if session.ready {
            switch stage {
            case .idle, .over:
                Button(stage == .over && session.result != nil ? "Play again" : "Invite \(partner) to play") {
                    Haptics.tap()
                    session.invite()
                }
                .buttonStyle(.px(.sage, wide: true))
            case .inviting:
                Button("Cancel") { session.cancel() }.buttonStyle(.px(.paper))
            case .invited:
                Button("Join \(partner)") {
                    Haptics.tap()
                    session.join()
                }
                .buttonStyle(.px(.sage, wide: true))
            case .waiting:
                Button("Stop") { session.cancel() }.buttonStyle(.px(.paper))
            case .count, .play:
                EmptyView()
            }
        }
    }
}

/// you and your person, and what each of you is up to (for the games you play on the same side)
struct CoopChip: View {
    let place: PlaceModel
    let side: Side
    let note: String
    var body: some View {
        HStack(spacing: 8) {
            if let l = place.seatLook(side) { HeadView(look: l, size: 32) } else { Color.paper2.frame(width: 32, height: 32) }
            VStack(alignment: .leading, spacing: 0) {
                Text(side == place.mySeat ? "You" : place.seatName(side)).font(.px(14, 700)).foregroundStyle(Color.inkSoft).lineLimit(1).minimumScaleFactor(0.8)
                Text(note.isEmpty ? " " : note).font(.pxTiny).foregroundStyle(Color.muted).lineLimit(1).minimumScaleFactor(0.7)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .frame(maxWidth: .infinity)
        .pxBox()
    }
}

/// holds a game's session for as long as its screen is open, and keeps it moving
struct LiveHost<R: LiveRules, Screen: View>: View {
    let place: PlaceModel
    @State private var session: LiveSession<R>
    @State private var now = Values.nowMs()
    let content: (LiveSession<R>, Double) -> Screen

    init(place: PlaceModel, kind: GameKind, rules: R, @ViewBuilder content: @escaping (LiveSession<R>, Double) -> Screen) {
        self.place = place
        _session = State(initialValue: LiveSession(kind: kind, rules: rules, place: place))
        self.content = content
    }

    var body: some View {
        content(session, now)
            .onAppear {
                UIApplication.shared.isIdleTimerDisabled = true
                session.sync()
                if Launch.invite, session.demo, session.stage() == .idle { session.invite() }
            }
            .onDisappear {
                UIApplication.shared.isIdleTimerDisabled = false
                session.close()
            }
            // re-draws the screen and keeps the game moving, fifty times a second
            .task {
                while !Task.isCancelled {
                    session.pulse()
                    now = Values.nowMs()
                    try? await Task.sleep(nanoseconds: 20_000_000)
                }
            }
            .onChange(of: place.games[session.kind]?.seq) { _, _ in session.sync() }
            .onChange(of: place.games[session.kind]?.id) { _, _ in session.sync() }
    }
}

/// three little squares for the rounds you've won
struct Pips: View {
    let won: Int
    let of: Int
    var body: some View {
        HStack(spacing: 6) {
            ForEach(0..<of, id: \.self) { i in
                Rectangle().fill(won > i ? Color(hex: "#ffd76a") : Color.paper.opacity(0.18)).frame(width: 14, height: 14).overlay(Rectangle().strokeBorder(Color(hex: "#1b1411"), lineWidth: 2))
            }
        }
    }
}

/// a big pad you press (it counts the moment your finger lands, not when it lifts)
struct PressPad<Label: View>: View {
    var enabled = true
    let onPress: () -> Void
    @ViewBuilder var label: () -> Label
    @State private var down = false

    var body: some View {
        label()
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in
                        if !down {
                            down = true
                            if enabled { onPress() }
                        }
                    }
                    .onEnded { _ in down = false }
            )
            .opacity(enabled ? 1 : 0.7)
            .accessibilityAddTraits(.isButton)
            .accessibilityAction { if enabled { onPress() } }
    }
}

/* ---------- Tug of War ---------- */

struct TugGameView: View {
    let place: PlaceModel
    var body: some View {
        LiveHost(place: place, kind: .tug, rules: Tug()) { session, now in TugBoard(place: place, session: session, now: now) }
    }
}

private struct TugBoard: View {
    let place: PlaceModel
    let session: LiveSession<Tug>
    let now: Double
    @State private var mine = (g: "", n: 0)

    var body: some View {
        let s = session.state
        let me = place.mySeat
        let live = session.stage(now: now) == .play && s != nil && s?.winner == nil
        let myCount = max(mine.g == session.match?.id ? mine.n : 0, s?.taps[me] ?? 0)
        let secs = s.map { min(Int(Tug.durationMs / 1000), max(0, Int(((session.local($0.endsAt) - now) / 1000).rounded(.up)))) } ?? Int(Tug.durationMs / 1000)
        // + towards me: on my screen I'm always on the left
        let pos = s.map { me == .a ? $0.pos : -$0.pos } ?? 0
        LiveFrame(place: place, session: session, title: "Tug of War",
                  howTo: "Tap the big pad as fast as you can. Pull the ribbon all the way to your side, or be ahead when 20 seconds are up.",
                  playing: say(("Tap, tap, tap!", true), (" \(secs)s left.", false)), now: now) {
            TugField(pos: 0, me: place.seatLook(me), you: place.seatLook(me.other))
        } content: {
            VStack(spacing: 14) {
                TugField(pos: pos, me: place.seatLook(me), you: place.seatLook(me.other))
                HStack {
                    Text("You · \(myCount)")
                    Spacer()
                    Text("\(secs)s").opacity(0.8)
                    Spacer()
                    Text("\(s?.taps[me.other] ?? 0) · \(place.theirName)")
                }
                .font(.px(18, 700))
                .foregroundStyle(Color.paper)
                PressPad(enabled: live, onPress: tap) {
                    Text(live ? "TAP!" : s?.winner != nil ? "Done" : "Get ready…")
                        .font(.px(34, 700))
                        .foregroundStyle(Color.paperHi)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 30)
                        .background(Color.sage)
                        .overlay(Rectangle().strokeBorder(Color.sageD, lineWidth: 4))
                }
                .accessibilityLabel("Tap to pull")
            }
        }
    }

    private func tap() {
        guard let s = session.state, let id = session.match?.id else { return }
        if mine.g != id { mine = (id, 0) }
        mine.n = max(mine.n, s.taps[place.mySeat] ?? 0) + 1
        session.act(Tug.Act(taps: mine.n), fast: true)
        UIImpactFeedbackGenerator(style: .light).impactOccurred(intensity: 0.6)
        Chiptune.shared.game(.tap)
    }
}

/// the meadow, the rope, and the ribbon in the middle of it
private struct TugField: View {
    let pos: Double
    let me: AvatarConfig?
    let you: AvatarConfig?

    var body: some View {
        GeometryReader { g in
            let w = g.size.width, h = g.size.height
            ZStack(alignment: .topLeading) {
                Color(hex: "#4f7a43")
                Color(hex: "#8fb8c9").frame(height: h * 0.34)
                Color(hex: "#3f6337").frame(height: 6).offset(y: h * 0.34)
                // the two lines to pull the ribbon over
                Color(hex: "#efe3cb").opacity(0.8).frame(width: 4, height: h * 0.52).offset(x: w * 0.12, y: h * 0.40)
                Color(hex: "#efe3cb").opacity(0.8).frame(width: 4, height: h * 0.52).offset(x: w * 0.88 - 4, y: h * 0.40)
                // the rope
                VStack(spacing: 0) {
                    Color(hex: "#e2bf84").frame(height: 2)
                    Color(hex: "#c89a5c").frame(height: 4)
                    Color(hex: "#8a6a36").frame(height: 2)
                }
                .frame(width: w * 0.84)
                .offset(x: w * 0.08, y: h * 0.62)
                // the ribbon
                HStack(spacing: 0) {
                    Color(hex: "#e07a5f").frame(width: 3)
                    Color(hex: "#c4453f").frame(width: 11)
                }
                .frame(height: 34)
                .offset(x: w * (0.5 - pos * 0.38) - 7, y: h * 0.50)
                .animation(.linear(duration: 0.12), value: pos)
                if let me { HeadView(look: me, size: min(64, h * 0.38)).offset(x: w * 0.01, y: h * 0.38) }
                if let you { HeadView(look: you, size: min(64, h * 0.38)).scaleEffect(x: -1).offset(x: w * 0.99 - min(64, h * 0.38), y: h * 0.38) }
            }
        }
        .aspectRatio(640.0 / 170.0, contentMode: .fit)
        .clipped()
        .overlay(Rectangle().strokeBorder(Color(hex: "#2b4426"), lineWidth: 4))
        .accessibilityElement()
        .accessibilityLabel(pos > 0.05 ? "The ribbon's on your side" : pos < -0.05 ? "The ribbon's on their side" : "The ribbon's in the middle")
    }
}

/* ---------- Paper, Scissors, Stone ---------- */

enum HandArt {
    static func glyph(_ h: Rps.Hand) -> Glyph {
        switch h {
        case .stone:
            return Glyph(["...gggg...", "..gGGGGg..", ".gGGwGGGg.", "gGGGGGGGGg", "gGGGGGGdGg", "gGGdGGGGGg", "gGGGGGGGGg", ".gGGGGGGg.", "..gggggg..", ".........."],
                         ["g": "#5c5560", "G": "#9a929e", "w": "#d6cfd8", "d": "#6e6672"])
        case .paper:
            return Glyph([".pppppp...", ".pPPPPpp..", ".pPllPPpp.", ".pPPPPPPp.", ".pPllllPp.", ".pPPPPPPp.", ".pPllllPp.", ".pPPPPPPp.", ".pppppppp.", ".........."],
                         ["p": "#a8987a", "P": "#f4ead6", "l": "#c9b896"])
        case .scissors:
            return Glyph([".s......s.", ".ss....ss.", "..ss..ss..", "...ssss...", "....hh....", "...hhhh...", "..hH..Hh..", ".hH....Hh.", ".hH....Hh.", "..hh..hh.."],
                         ["s": "#c8d3d8", "h": "#8f3b2a", "H": "#e07a5f"])
        }
    }
}

struct RpsGameView: View {
    let place: PlaceModel
    var body: some View {
        LiveHost(place: place, kind: .rps, rules: Rps()) { session, now in RpsBoard(place: place, session: session, now: now) }
    }
}

private struct RpsBoard: View {
    let place: PlaceModel
    let session: LiveSession<Rps>
    let now: Double

    var body: some View {
        let s = session.state
        let me = place.mySeat, them = me.other
        let partner = place.theirName
        let picking = session.stage(now: now) == .play && s?.phase == "pick" && s?.winner == nil
        let myPick = s?.picks[me]
        let theyPicked = s?.picks[them] != nil
        let shown = s?.phase == "show" ? s?.last : nil
        let left = s.map { max(0, session.local($0.pickUntil) - now) } ?? 0
        LiveFrame(place: place, session: session, title: "Paper, Scissors, Stone",
                  howTo: "Each round you’ve \(Int(Rps.pickMs / 1000)) seconds to pick. You’ll see theirs once you’ve both chosen. First to \(Rps.toWin).",
                  playing: playing(s, shown, myPick, theyPicked, partner), now: now) {
            HStack(spacing: 22) { ForEach(Rps.hands, id: \.self) { GlyphView(glyph: HandArt.glyph($0), scale: 8) } }.padding(.vertical, 20)
        } content: {
            VStack(spacing: 14) {
                HStack {
                    HStack(spacing: 8) { Text("You"); Pips(won: s?.score[me] ?? 0, of: Rps.toWin) }
                    Spacer()
                    HStack(spacing: 8) { Pips(won: s?.score[them] ?? 0, of: Rps.toWin); Text(partner).lineLimit(1) }
                }
                .font(.px(17, 700))
                .foregroundStyle(Color.paper)
                // the table: your hand on the left, theirs on the right
                HStack {
                    VStack(spacing: 6) {
                        if let h = shown?.hands[me] ?? myPick { GlyphView(glyph: HandArt.glyph(h), scale: 10) } else { Text("?").font(.px(54, 700)).opacity(0.4) }
                        Text("You").font(.pxSmall).opacity(0.8)
                    }
                    .frame(maxWidth: .infinity)
                    Text("vs").font(.px(26, 700)).opacity(0.7)
                    VStack(spacing: 6) {
                        if let h = shown?.hands[them] {
                            GlyphView(glyph: HandArt.glyph(h), scale: 10).scaleEffect(x: -1)
                        } else {
                            Text(theyPicked ? "✓" : "?").font(.px(54, 700)).opacity(theyPicked ? 0.9 : 0.35)
                        }
                        Text(partner).font(.pxSmall).opacity(0.8).lineLimit(1)
                    }
                    .frame(maxWidth: .infinity)
                }
                .foregroundStyle(Color.paper)
                .frame(minHeight: 150)
                .padding(.vertical, 12)
                .background(Color(hex: "#3a2b25"))
                .overlay(Rectangle().strokeBorder(Color(hex: "#1b1411"), lineWidth: 4))
                if s?.phase == "pick" {
                    GeometryReader { g in
                        ZStack(alignment: .leading) {
                            Color.paper.opacity(0.15)
                            (left < 1500 ? Color(hex: "#e07a5f") : Color(hex: "#ffd76a")).frame(width: g.size.width * min(1, left / Rps.pickMs))
                        }
                    }
                    .frame(height: 12)
                }
                HStack(spacing: 10) {
                    ForEach(Rps.hands, id: \.self) { h in
                        Button {
                            guard picking, myPick == nil, let s else { return }
                            Haptics.tap()
                            session.act(Rps.Act(round: s.round, hand: h))
                        } label: {
                            VStack(spacing: 6) {
                                GlyphView(glyph: HandArt.glyph(h), scale: 5.6)
                                Text(h.name).font(.px(16, 700)).foregroundStyle(Color.inkSoft)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .pxBox()
                            .overlay { if myPick == h { Rectangle().strokeBorder(Color.butter, lineWidth: 3).padding(-6) } }
                            .opacity(!picking || (myPick != nil && myPick != h) ? 0.55 : 1)
                        }
                        .buttonStyle(.plain)
                        .disabled(!picking || myPick != nil)
                    }
                }
            }
            .onChange(of: s?.phase == "show" ? s?.round : nil) { _, r in
                guard r != nil, let w = s?.last?.winner else { return }
                if w == me { Haptics.success() } else { Haptics.soft() }
                Chiptune.shared.game(w == me ? .point : .miss)
            }
        }
    }

    private func playing(_ s: Rps.State?, _ shown: (hands: [Side: Rps.Hand], winner: Side?)?, _ myPick: Rps.Hand?, _ theyPicked: Bool, _ partner: String) -> Text {
        let me = place.mySeat, them = me.other
        if let shown {
            let mine = shown.hands[me], theirs = shown.hands[them]
            switch (mine, theirs) {
            case (nil, nil): return say(("Neither of you picked in time. Again!", false))
            case (nil, _): return say(("You didn’t pick in time, so \(partner) takes it.", false))
            case (_, nil): return say(("\(partner) didn’t pick in time, so you take it.", false))
            case let (m?, t?):
                if m == t { return say(("Both \(m.name.lowercased()): nobody scores.", false)) }
                if shown.winner == me { return say(("Your \(m.name.lowercased()) beats their \(t.name.lowercased())!", true)) }
                return say(("Their \(t.name.lowercased()) beats your \(m.name.lowercased()).", false))
            }
        }
        let round = s?.round ?? 1
        if myPick != nil { return say(("Round \(round). ", false), (theyPicked ? "Both picked!" : "Waiting for \(partner) to pick…", false)) }
        return say(("Round \(round). ", false), ("Pick one!", true), (theyPicked ? " \(partner) has picked." : "", false))
    }
}

/* ---------- Quick Draw ---------- */

enum LanternArt {
    static let rows = ["...hh...", "..hhhh..", ".gGGGGg.", "gGGwGGGg", "gGGGGGGg", "gGGGGGGg", "gGGGGGGg", ".gGGGGg.", "..hhhh..", "...hh..."]
    static let lit = Glyph(rows, ["h": "#8a6a36", "g": "#e2a33a", "G": "#ffd76a", "w": "#fffbe6"])
    static let dark = Glyph(rows, ["h": "#5a4632", "g": "#3a3340", "G": "#4a4252", "w": "#5c5468"])
}

struct QuickDrawGameView: View {
    let place: PlaceModel
    var body: some View {
        LiveHost(place: place, kind: .quickdraw, rules: QuickDraw()) { session, now in QuickDrawBoard(place: place, session: session, now: now) }
    }
}

private struct QuickDrawBoard: View {
    let place: PlaceModel
    let session: LiveSession<QuickDraw>
    let now: Double
    /// when the lantern lit on this screen, this round (the reaction is timed from then)
    @State private var litLocal: (round: Int, t: CFTimeInterval)?
    @State private var tapped = 0

    var body: some View {
        let s = session.state
        let me = place.mySeat, them = me.other
        let partner = place.theirName
        let playingRound = s?.phase == "play" && s?.winner == nil
        let lit = playingRound && litLocal?.round == s?.round
        let myTap = s?.phase == "play" ? s?.taps[me] : nil
        LiveFrame(place: place, session: session, title: "Quick Draw",
                  howTo: "When the lantern lights, tap. Quickest wins the round; tap while it’s dark and you lose it. First to \(QuickDraw.toWin).",
                  playing: playing(s, partner), now: now) {
            GlyphView(glyph: LanternArt.dark, scale: 14).padding(.vertical, 20)
        } content: {
            VStack(spacing: 14) {
                HStack {
                    HStack(spacing: 8) { Text("You"); Pips(won: s?.score[me] ?? 0, of: QuickDraw.toWin) }
                    Spacer()
                    HStack(spacing: 8) { Pips(won: s?.score[them] ?? 0, of: QuickDraw.toWin); Text(partner).lineLimit(1) }
                }
                .font(.px(17, 700))
                .foregroundStyle(Color.paper)
                PressPad(onPress: tap) {
                    VStack(spacing: 14) {
                        GlyphView(glyph: lit ? LanternArt.lit : LanternArt.dark, scale: 14)
                            .shadow(color: lit ? Color(hex: "#ffd76a").opacity(0.85) : .clear, radius: 26)
                        Text(big(s, myTap, lit, partner)).font(.px(34, 700)).foregroundStyle(Color.paper)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
                    .background(lit ? Color(hex: "#3a2f22") : Color(hex: "#1b1518"))
                    .overlay(Rectangle().strokeBorder(Color(hex: "#0f0b0c"), lineWidth: 4))
                }
                .accessibilityLabel("Tap when the lantern lights")
            }
            .onChange(of: now) { _, t in light(t) }
            .onChange(of: s?.phase == "show" ? s?.round : nil) { _, r in
                guard r != nil, let w = s?.last?.winner else { return }
                if w == me { Haptics.success() } else { Haptics.soft() }
                Chiptune.shared.game(w == me ? .point : .miss)
            }
        }
    }

    /// light the lantern on this screen at its moment, and remember exactly when
    private func light(_ t: Double) {
        guard let s = session.state, s.phase == "play", s.winner == nil, litLocal?.round != s.round else { return }
        if t >= session.local(s.litAt) {
            litLocal = (s.round, CACurrentMediaTime())
            UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
            Chiptune.shared.game(.bell)
        }
    }

    private func tap() {
        guard let s = session.state, s.phase == "play", s.winner == nil, session.stage(now: Values.nowMs()) == .play, tapped != s.round else { return }
        tapped = s.round
        if let l = litLocal, l.round == s.round {
            session.act(QuickDraw.Act(.ms(Int(((CACurrentMediaTime() - l.t) * 1000).rounded())), round: s.round))
        } else {
            session.act(QuickDraw.Act(.early, round: s.round))
        }
    }

    private func big(_ s: QuickDraw.State?, _ myTap: QuickDraw.Tap?, _ lit: Bool, _ partner: String) -> String {
        guard let s else { return "Wait for it…" }
        if s.phase == "play" {
            if let myTap { return myTap == .early ? "Too soon!" : myTap.words }
            return lit ? "NOW!" : "Wait for it…"
        }
        guard let l = s.last else { return "Wait for it…" }
        return l.winner == place.mySeat ? "You got it!" : l.winner != nil ? "\(partner) got it" : "Nobody this time"
    }

    private func playing(_ s: QuickDraw.State?, _ partner: String) -> Text {
        let me = place.mySeat
        if let s, s.phase == "show", let l = s.last {
            return say(("You: ", false), (l.taps[me]?.words ?? "no tap", true), (" · \(partner): ", false), (l.taps[me.other]?.words ?? "no tap", true))
        }
        return say(("Round \(s?.round ?? 1). Keep your finger ready, and ", false), ("wait for the light", true), (".", false))
    }
}
