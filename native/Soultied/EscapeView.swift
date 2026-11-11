import SwiftUI
import SoultiedCore

/*
 * The dark door (the website's EscapeGame.tsx): a corridor of four escape rooms. Each room has two halves; each
 * of you plays one half and holds half of the clues. Played on one phone by both of you (switch halves, or one
 * thumb each for the things you do together), or from two devices, a phone and a laptop as well.
 */

struct EscapeScreen: View {
    let place: PlaceModel
    @State private var session: EscapeSession
    /// a room that's in Plus, tapped without it
    @State private var plusReason: PlusReason?
    @Environment(\.dismiss) private var dismiss

    init(place: PlaceModel) {
        self.place = place
        _session = State(initialValue: EscapeSession(place: place))
    }

    var body: some View {
        ZStack {
            RadialGradient(colors: [Color(hex: "#2a1f2a"), Color(hex: "#140e11")], center: .top, startRadius: 10, endRadius: 760)
                .ignoresSafeArea()
            if session.rooms.isEmpty {
                VStack(spacing: 14) {
                    Text("The rooms didn’t come with this version of the app.").font(.pxBody).foregroundStyle(Color.paper)
                    Button("← Back") { dismiss() }.buttonStyle(.px(.paper, small: true))
                }
                .padding(24)
            } else {
                switch session.screen {
                case .corridor:
                    EscapeCorridor(session: session, onExit: { dismiss() }, locked: { !place.canEscape($0.id) }, plus: !place.hasPlus) { r in
                        plusReason = .room(r.title)
                    }
                case .door: EscapeDoor(session: session, place: place)
                case .play: EscapeRoomView(session: session, place: place, onExit: { dismiss() })
                }
            }
        }
        .onAppear {
            UIApplication.shared.isIdleTimerDisabled = true
            session.onSound = { s in
                Chiptune.shared.play(s)
                if s == .open { Haptics.success() }
            }
            session.start()
            Launch.escapeScene(session)
        }
        .onDisappear {
            UIApplication.shared.isIdleTimerDisabled = false
            session.stop()
        }
        .onChange(of: place.partnerHere) { _, _ in session.start() }
        .sheet(item: $plusReason) { r in
            PlusSheet(place: place, reason: r)
                .presentationDragIndicator(.visible)
                .presentationBackground(Color.paper)
        }
        // keeps the clock, the holding and the pings going
        .task {
            while !Task.isCancelled {
                session.pulse()
                try? await Task.sleep(nanoseconds: 100_000_000)
            }
        }
    }
}

/* ---------- the corridor of doors ---------- */

private struct PresenceChip: View {
    let here: Bool
    let name: String
    var body: some View {
        HStack(spacing: 8) {
            Rectangle().fill(here ? Color.sage : Color(hex: "#b9a98f")).frame(width: 10, height: 10)
            Text(here ? "\(name) is here too" : "\(name) isn’t here yet").font(.pxSmall).foregroundStyle(Color.inkSoft)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .pxBox()
    }
}

struct EscapeCorridor: View {
    let session: EscapeSession
    let onExit: () -> Void
    /// a room that needs Soultied Plus (and the place doesn't have it)
    var locked: (EscapeRoom) -> Bool = { _ in false }
    /// show which rooms are in Plus
    var plus = false
    var onLocked: (EscapeRoom) -> Void = { _ in }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                HStack {
                    Button("← Back to the living room", action: onExit).buttonStyle(.px(.paper, small: true))
                    Spacer()
                }
                if session.canPlayOnline { PresenceChip(here: session.partnerHere, name: session.partnerName) }
                VStack(alignment: .leading, spacing: 8) {
                    Text("The dark door").font(.px(34, 700)).foregroundStyle(Color.paper)
                    Text("Four rooms, two of you. Inside, each of you gets half of the room and half of the clues, so you’ll need to tell each other what you see. No timers chasing you, and hints whenever you’re stuck.")
                        .font(.pxBody).foregroundStyle(Color.paper.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
                }
                if let r = session.partnerReady, session.partnerHere, let room = EscapeRoom.byId(r) {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("\(session.partnerName) is waiting at the door of \(room.title).").font(.pxBody).foregroundStyle(Color.inkSoft)
                        Button("Step in with them") { session.joinPartner() }.buttonStyle(.px(.sage))
                    }
                    .pxCard()
                }
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 14), GridItem(.flexible(), spacing: 14)], spacing: 14) {
                    ForEach(session.rooms) { r in
                        Button {
                            Haptics.tap()
                            if locked(r) { onLocked(r) } else { session.goToDoor(r.id) }
                        } label: {
                            DoorCard(room: r, session: session, plus: plus && !PlusRules.freeRooms.contains(r.id))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(16)
            .padding(.bottom, 40)
        }
    }
}

private struct DoorCard: View {
    let room: EscapeRoom
    let session: EscapeSession
    /// in Soultied Plus
    var plus = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Spacer()
                DoorSprite(accent: room.accent, open: session.save.best[room.id] != nil, scale: 3)
                Spacer()
            }
            .padding(.vertical, 8)
            .background(Color(hex: "#1d1518"))
            Text(room.mood.uppercased()).font(.px(12, 700)).tracking(1.4).foregroundStyle(Color.terracottaD)
            Text(room.title).font(.px(19, 700)).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
            Text(room.tagline).font(.pxSmall).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
            Text(session.status(room)).font(.px(13, 700)).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
            if session.partnerReady == room.id && session.partnerHere {
                Text("\(session.partnerName) is waiting here").font(.px(12, 700)).foregroundStyle(Color.cream)
                    .padding(.horizontal, 6).padding(.vertical, 3).background(Color.sageD)
            }
            if plus {
                Text("PLUS").font(.px(11, 700)).kerning(0.6).foregroundStyle(Color.butter)
                    .padding(.horizontal, 6).padding(.vertical, 2).background(Color.ink)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .pxBox()
        .accessibilityElement(children: .combine)
    }
}

/* ---------- standing at one door ---------- */

struct EscapeDoor: View {
    let session: EscapeSession
    let place: PlaceModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Button("← Back to the corridor") { session.backToCorridor() }.buttonStyle(.px(.paper, small: true))
                if let room = session.room { card(room) }
            }
            .padding(16)
            .padding(.bottom, 40)
        }
    }

    private func card(_ room: EscapeRoom) -> some View {
        let waiting = session.meReady == room.id
        let resume = session.inProgress(room.id)
        return VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 14) {
                DoorSprite(accent: room.accent, open: waiting, scale: 3)
                    .padding(8)
                    .background(Color(hex: "#1d1518"))
                VStack(alignment: .leading, spacing: 4) {
                    Text(room.mood.uppercased()).font(.px(12, 700)).tracking(1.4).foregroundStyle(Color.terracottaD)
                    Text(room.title).font(.px(26, 700)).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
                    Text(room.tagline).font(.pxBody).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
                }
            }
            Text(room.intro).font(.pxBody).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
            ForEach(Side.allCases, id: \.self) { s in
                HStack(spacing: 12) {
                    if let look = s == session.mySide ? Optional(place.myLook) : place.theirLook { HeadView(look: look, size: 34) }
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(session.name(s)): \(room.sides[s]?.name ?? "")").font(.pxBodyBold).foregroundStyle(Color.inkSoft)
                        Text(room.sides[s]?.blurb ?? "").font(.pxSmall).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .pxInset()
            }
            Rectangle().fill(Color.paperShade).frame(height: 3)
            if let p = resume {
                Text("You’re \(p.step) of \(room.puzzles.count) puzzles in. Carry on where you left off, or start over.").font(.pxSmall).foregroundStyle(Color.inkSoft)
            }
            VStack(spacing: 10) {
                Button(resume != nil ? "Continue on this screen" : "Play on this screen") {
                    Haptics.tap()
                    session.playHere(room.id)
                }
                .buttonStyle(.px(.terracotta, wide: true))
                if session.canPlayOnline {
                    if waiting {
                        Button("Stop waiting") { session.setReady(nil) }.buttonStyle(.px(.paper, wide: true))
                    } else {
                        Button("Play from two devices") {
                            Haptics.tap()
                            session.setReady(room.id)
                        }
                        .buttonStyle(.px(.sage, wide: true))
                    }
                }
                if resume != nil {
                    Button("Start over") { session.playHere(room.id, fromScratch: true) }.buttonStyle(.px(.paper, wide: true))
                }
            }
            if waiting {
                Text(session.partnerReady == room.id ? "Opening the door…" : "Waiting for \(session.partnerName) to step in on their phone or laptop: they’ll see you at this door when they open the dark door.")
                    .font(.pxSmall).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
            }
            if !session.canPlayOnline {
                Text(place.isDemo ? "In the demo room, play both halves on this screen: tap a name to swap halves." : "Once \(session.partnerName) moves in, you can play from two devices. For now, try both halves on this screen.")
                    .font(.pxSmall).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
            }
        }
        .pxCard()
    }
}

/* ---------- inside the room ---------- */

struct EscapeRoomView: View {
    let session: EscapeSession
    let place: PlaceModel
    let onExit: () -> Void
    @State private var muted = Chiptune.shared.muted
    @State private var draft = ""

    var body: some View {
        if let room = session.room {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    topBar(room)
                    news(room)
                    if session.mode == .here { halfTabs(room) }
                    half(room, session.mode == .online ? session.mySide : session.viewSide)
                    if session.mode == .online { chat }
                }
                .padding(12)
                .padding(.bottom, 40)
            }
            .scrollDismissesKeyboard(.interactively)
            .overlay {
                if session.endingOpen, let p = session.progress, let f = p.finishedAt { ending(room, time: f - p.startedAt, hints: p.hintsUsed) }
            }
        }
    }

    private func topBar(_ room: EscapeRoom) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Button("← Leave") { session.leave() }.buttonStyle(.px(.paper, small: true))
                VStack(alignment: .leading, spacing: 1) {
                    Text(room.title).font(.px(19, 700)).foregroundStyle(Color.paper).lineLimit(1).minimumScaleFactor(0.7)
                    Text(session.mode == .here ? "Both halves on this screen" : "You’re in \((room.sides[session.mySide]?.name ?? "").lowercased())")
                        .font(.pxTiny).foregroundStyle(Color.paper.opacity(0.75)).lineLimit(1)
                }
                Spacer(minLength: 0)
                Button(muted ? "Sound off" : "Sound on") {
                    muted.toggle()
                    Chiptune.shared.muted = muted
                }
                .buttonStyle(.px(.paper, small: true))
                .accessibilityLabel(muted ? "Turn sound on" : "Mute sound")
            }
            HStack(spacing: 10) {
                HStack(spacing: 5) {
                    ForEach(Array(room.puzzles.enumerated()), id: \.offset) { i, _ in
                        Rectangle().fill(i < session.step ? Color(hex: room.accent) : Color(hex: "#3a2c33"))
                            .overlay(alignment: .bottom) { Rectangle().fill(Color.black.opacity(0.3)).frame(height: 3) }
                            .frame(width: 14, height: 14)
                    }
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(session.step) of \(room.puzzles.count) solved")
                Spacer(minLength: 0)
                Text(escapeTime(session.elapsed)).font(.px(15, 600)).monospacedDigit().foregroundStyle(Color.inkSoft)
                    .padding(.horizontal, 8).padding(.vertical, 3).pxBox()
                if session.mode == .online {
                    HStack(spacing: 6) {
                        Rectangle().fill(session.partnerHere ? Color.sage : Color(hex: "#b9a98f")).frame(width: 8, height: 8)
                        Text(session.partnerName).font(.pxSmall).foregroundStyle(Color.inkSoft).lineLimit(1)
                    }
                    .padding(.horizontal, 8).padding(.vertical, 3).pxBox()
                }
            }
        }
    }

    /// what just happened, and the hints
    private func news(_ room: EscapeRoom) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            if let log = session.log ?? (session.step == 0 ? "Look around and tap on things. Tell each other what you find." : nil) {
                Text(log).font(.pxBody).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
                    .padding(12).frame(maxWidth: .infinity, alignment: .leading).pxBox()
                    .id(log)
                    .transition(.opacity)
            }
            if let pz = session.puzzle {
                let shown = min(session.hintsShown, pz.hints.count)
                VStack(alignment: .leading, spacing: 6) {
                    if shown > 0 {
                        ForEach(0..<shown, id: \.self) { i in
                            Text("Hint \(i + 1): \(pz.hints[i])").font(.pxSmall).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
                        }
                    } else {
                        Text("Stuck? Hints unlock after a little while.").font(.pxSmall).foregroundStyle(Color.muted)
                    }
                    if shown < 3 {
                        Button(shown == 0 ? "Get a hint" : shown == 2 ? "Show the answer" : "Another hint") { session.hint() }
                            .buttonStyle(.px(.paper, small: true))
                            .disabled(!session.hintReady)
                    }
                }
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .pxBox()
            }
        }
    }

    /// one screen: swap halves
    private func halfTabs(_ room: EscapeRoom) -> some View {
        HStack(spacing: 6) {
            ForEach(Side.allCases, id: \.self) { s in
                let unseen = !(session.fresh[s] ?? []).isEmpty && session.viewSide != s
                Button {
                    Haptics.tap()
                    session.viewSide = s
                } label: {
                    Text("\(session.name(s)) · \(room.sides[s]?.name ?? "")\(unseen ? " •" : "")").frame(maxWidth: .infinity)
                }
                .buttonStyle(.px(session.viewSide == s ? .terracotta : .night, small: true))
                .accessibilityAddTraits(session.viewSide == s ? .isSelected : [])
            }
        }
    }

    private func half(_ room: EscapeRoom, _ s: Side) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                if let look = s == session.mySide ? Optional(place.myLook) : place.theirLook { HeadView(look: look, size: 26) }
                Text("\(session.name(s)) · \(room.sides[s]?.name ?? "")").font(.pxBodyBold).foregroundStyle(Color.paper)
            }
            EscapeSceneView(room: room, side: s, step: session.step, selected: session.open[s], fresh: session.fresh[s] ?? []) { id in
                session.tap(s, id)
            }
            .padding(3)
            .background(Color(hex: "#0b0809"))
            .background(Color.black.opacity(0.35).offset(x: 6, y: 6))
            panel(room, s)
        }
    }

    @ViewBuilder private func panel(_ room: EscapeRoom, _ s: Side) -> some View {
        if let o = room.object(session.open[s]), let v = o.view(at: session.step) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(o.label.uppercased()).font(.px(12, 700)).tracking(1.2).foregroundStyle(Color.terracottaD)
                    Spacer()
                    Button("✕") { session.close(s) }.buttonStyle(.px(.paper, small: true)).accessibilityLabel("Close")
                }
                look(room, v, s)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .pxBox(shadow: true)
            .id("\(o.id)-\(s.rawValue)")
        }
    }

    @ViewBuilder private func look(_ room: EscapeRoom, _ v: ObjectView, _ s: Side) -> some View {
        if let pid = v.puzzle, let i = room.puzzleIndex(pid) {
            if i == session.step {
                LockPanel(puzzle: room.puzzles[i], session: session, side: s).id("\(pid)-\(s.rawValue)")
            } else {
                Text(v.text ?? (i < session.step ? "It’s open now." : "Not yet. Something else comes first.")).font(.pxBody).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
            }
        } else if let c = v.clue {
            ClueCard(clue: c)
        } else {
            Text(v.text ?? "").font(.pxBody).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
        }
    }

    /// whispering, when you're on different devices
    private var chat: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Talk to \(session.partnerName) (or call them, it’s more fun)").font(.pxBodyBold).foregroundStyle(Color.inkSoft)
            if session.chat.isEmpty {
                Text("Tell each other what you can see.").font(.pxSmall).foregroundStyle(Color.muted)
            } else {
                VStack(alignment: .leading, spacing: 3) {
                    ForEach(session.chat.suffix(12)) { m in
                        Text("\(m.by == session.me ? "You" : m.name): \(m.text)").font(.pxSmall).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            HStack(spacing: 8) {
                TextField("There’s a clock in here…", text: $draft)
                    .font(.pxBody)
                    .foregroundStyle(Color.inkSoft)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 8)
                    .background(Color.paperInput)
                    .pxInset()
                    .submitLabel(.send)
                    .onSubmit(send)
                Button("Send", action: send).buttonStyle(.px(.terracotta, small: true))
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pxBox()
    }

    private func send() {
        session.say(draft)
        draft = ""
    }

    private func ending(_ room: EscapeRoom, time: Double, hints: Int) -> some View {
        ZStack {
            Color(hex: "#0a0608").opacity(0.72).ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(spacing: 14) {
                        DoorSprite(accent: room.accent, open: true, scale: 3).padding(8).background(Color(hex: "#1d1518"))
                        VStack(alignment: .leading, spacing: 4) {
                            Text("YOU ESCAPED \(room.title.uppercased())")
                                .font(.px(12, 700)).tracking(1.2).foregroundStyle(Color.terracottaD).fixedSize(horizontal: false, vertical: true)
                            Text(room.ending.title).font(.px(26, 700)).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    Text(room.ending.text).font(.pxBody).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
                    HStack(spacing: 10) {
                        Text("Time: \(escapeTime(time))").font(.pxSmall).foregroundStyle(Color.inkSoft).padding(.horizontal, 10).padding(.vertical, 5).pxInset()
                        Text(hints == 0 ? "No hints used" : "\(hints) \(hints == 1 ? "hint" : "hints") used").font(.pxSmall).foregroundStyle(Color.inkSoft)
                            .padding(.horizontal, 10).padding(.vertical, 5).pxInset()
                    }
                    Button("Try another room") { session.done() }.buttonStyle(.px(.terracotta, wide: true))
                    Button("Back to the living room", action: onExit).buttonStyle(.px(.paper, wide: true))
                }
                .padding(20)
                .pxBox(shadow: true)
                .padding(16)
                .padding(.top, 60)
            }
        }
        .transition(.opacity)
    }
}

/* ---------- one half of a room: the pixel scene with things to tap in it ---------- */

final class EscapeCanvasBox {
    let canvas = EscapeCanvas()
    let start = Date()
}

struct EscapeSceneView: View {
    let room: EscapeRoom
    let side: Side
    let step: Int
    let selected: String?
    /// things this half hasn't looked at yet since they appeared
    let fresh: Set<String>
    let onObject: (String) -> Void
    @State private var box = EscapeCanvasBox()
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let w = CGFloat(EscapeCanvas.width), h = CGFloat(EscapeCanvas.height)
        GeometryReader { geo in
            let k = geo.size.width / w
            TimelineView(.periodic(from: .now, by: reduceMotion ? 0.5 : 0.1)) { ctx in
                let t = ctx.date.timeIntervalSince(box.start)
                let blink = Int(t * 3.3) % 4 < 2
                ZStack(alignment: .topLeading) {
                    if let img = Pixels.image(EscapeRooms.paint(room.id, side, step, t, into: box.canvas)) {
                        Image(decorative: img, scale: 1)
                            .resizable()
                            .interpolation(.none)
                            .frame(width: geo.size.width, height: geo.size.width * h / w)
                    }
                    ForEach(room.objects.filter { $0.side == side && $0.from <= step }) { o in
                        let on = selected == o.id
                        let isNew = fresh.contains(o.id)
                        Button {
                            Haptics.tap()
                            onObject(o.id)
                        } label: {
                            Rectangle().fill(Color.white.opacity(0.001))
                        }
                        .buttonStyle(.plain)
                        .frame(width: CGFloat(o.rect.w) * k, height: CGFloat(o.rect.h) * k)
                        .overlay {
                            if on || isNew {
                                Rectangle()
                                    .strokeBorder(style: StrokeStyle(lineWidth: 3, dash: [6, 4]))
                                    .foregroundStyle(Color(hex: "#f1d27a").opacity(on || reduceMotion || blink ? 0.95 : 0.25))
                                    .padding(-3)
                            }
                        }
                        .offset(x: CGFloat(o.rect.x) * k, y: CGFloat(o.rect.y) * k)
                        .accessibilityLabel(o.label)
                        .accessibilityHint(isNew ? "Something new" : "")
                    }
                    if let o = room.object(selected), o.side == side {
                        label(o, k, geo.size.width)
                    }
                }
            }
        }
        .aspectRatio(w / h, contentMode: .fit)
        .background(Color(hex: "#0d0a0b"))
    }

    /// the name of what's open, by it
    private func label(_ o: SceneObject, _ k: CGFloat, _ width: CGFloat) -> some View {
        let above = o.rect.y > 16
        let cx = CGFloat(o.rect.x + o.rect.w / 2) * k
        let top = CGFloat(o.rect.y) * k, bottom = CGFloat(o.rect.y + o.rect.h) * k
        return Text(o.label)
            .font(.px(13, 700))
            .foregroundStyle(Color.inkSoft)
            .lineLimit(1)
            .fixedSize()
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .pxBox()
            .alignmentGuide(.leading) { d in -(min(max(cx - d.width / 2, 2), width - d.width - 2)) }
            .alignmentGuide(.top) { d in above ? -(top - d.height - 8) : -(bottom + 8) }
            .allowsHitTesting(false)
    }
}
