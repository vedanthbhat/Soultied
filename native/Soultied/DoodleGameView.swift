import SwiftUI
import SoultiedCore

/*
 * Doodle Guess on the iPhone: one of you draws on a little pixel page, the other guesses, then you swap. Six
 * drawings, played on the same side. A phone and a laptop can play it together (the drawing goes over the same
 * live line as the website's).
 */

/// the page, big and crisp
struct DoodlePage: View {
    let pixels: String
    var body: some View {
        let w = DoodleGuess.w, h = DoodleGuess.h
        var data = [UInt8](repeating: 255, count: w * h * 4)
        let paper = RGB(DoodleGuess.paper)
        let inks = DoodleGuess.inks.mapValues { RGB($0) }
        for (i, b) in pixels.utf8.enumerated() where i < w * h {
            let c = inks[Character(UnicodeScalar(b))] ?? paper
            data[i * 4] = c.r
            data[i * 4 + 1] = c.g
            data[i * 4 + 2] = c.b
        }
        return Group {
            if let img = Pixels.image(data, w, h) {
                Image(decorative: img, scale: 1).resizable().interpolation(.none)
            } else {
                Color(hex: DoodleGuess.paper)
            }
        }
        .aspectRatio(CGFloat(w) / CGFloat(h), contentMode: .fit)
    }
}

struct DoodleGameView: View {
    let place: PlaceModel
    @State private var session: DoodleSession
    @State private var now = Values.nowMs()
    @State private var text = ""
    @FocusState private var typing: Bool
    @Environment(\.dismiss) private var dismiss

    init(place: PlaceModel) {
        self.place = place
        _session = State(initialValue: DoodleSession(place: place))
    }

    var body: some View {
        let st = session.state
        let partner = place.theirName
        ScrollView {
            VStack(spacing: 16) {
                HStack {
                    Button("← All games") { dismiss() }.buttonStyle(.px(.paper, small: true))
                    Spacer()
                    Text("Doodle Guess").font(.px(24, 700)).foregroundStyle(Color.paper)
                }
                HStack(spacing: 14) {
                    chip(place.mySeat, st)
                    chip(place.mySeat.other, st)
                }
                .padding(4)
                status(st, partner)
                    .foregroundStyle(Color.inkSoft)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .pxBox()

                if let st, st.phase != "lobby" {
                    roundBar(st)
                    page(st, partner)
                    if session.drawing && !session.iDraw, let word = st.word { guessBox(word) }
                    if session.drawing && session.iDraw { tools }
                    side(st, partner)
                } else if session.match == nil, let over = session.over, !DoodleGuess.State(over.state).rounds.isEmpty {
                    lookBack(DoodleGuess.State(over.state))
                } else if st?.phase == "lobby" {
                    DoodlePage(pixels: DoodleGuess.blank).frame(maxWidth: 280).overlay(Rectangle().strokeBorder(Color(hex: "#d8c7a4"), lineWidth: 2))
                }

                if session.ready && session.match == nil {
                    Button(session.over == nil ? "Start a game" : "Play again") {
                        Haptics.tap()
                        session.start()
                    }
                    .buttonStyle(.px(.sage, wide: true))
                }
            }
            .padding(16)
            .padding(.bottom, 40)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(GameBackdrop())
        .onAppear {
            UIApplication.shared.isIdleTimerDisabled = true
            session.sync()
            if Launch.invite, session.demo, session.match == nil { session.start() }
        }
        .onDisappear {
            UIApplication.shared.isIdleTimerDisabled = false
            session.close()
        }
        .task {
            while !Task.isCancelled {
                session.pulse()
                now = Values.nowMs()
                try? await Task.sleep(nanoseconds: 50_000_000)
            }
        }
        .onChange(of: place.games[.doodle]?.seq) { _, _ in session.sync() }
        .onChange(of: place.games[.doodle]?.id) { _, _ in session.sync() }
        .onChange(of: st?.phase) { was, phase in
            // (for the screenshots: straight on to drawing the first word)
            if Launch.invite, session.demo, phase == "choosing", session.iDraw, let w = session.state?.choices.first { session.choose(w) }
            if phase == "reveal" && was == "drawing" {
                if st?.rounds.last?.secs != nil { Haptics.success() } else { Haptics.soft() }
            }
        }
        .onChange(of: st?.guesses.count) { _, _ in
            if session.iDraw, let g = st?.guesses.last, g.by != place.mySeat { Haptics.soft() }
        }
    }

    /* ---------- the pieces ---------- */

    private func chip(_ side: Side, _ st: DoodleGuess.State?) -> some View {
        let note: String
        if let st {
            if st.phase == "lobby" { note = st.joined[side] == true ? "here" : "not here yet" }
            else if st.phase == "reveal" { note = "" }
            else { note = st.drawer == side ? "drawing" : "guessing" }
        } else {
            note = ""
        }
        let active = st.map { ($0.phase == "choosing" || $0.phase == "drawing") && $0.drawer == side } ?? false
        return HStack(spacing: 8) {
            if let l = place.seatLook(side) { HeadView(look: l, size: 32) } else { Color.paper2.frame(width: 32, height: 32) }
            VStack(alignment: .leading, spacing: 0) {
                Text(side == place.mySeat ? "You" : place.seatName(side)).font(.px(14, 700)).foregroundStyle(Color.inkSoft).lineLimit(1).minimumScaleFactor(0.8)
                Text(note.isEmpty ? " " : note).font(.pxTiny).foregroundStyle(Color.muted).lineLimit(1)
            }
            Spacer(minLength: 0)
            if active { GlyphView(glyph: Icons.pencil, scale: 2.5) }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .frame(maxWidth: .infinity)
        .pxBox()
        .overlay { if active { Rectangle().strokeBorder(Color(hex: "#f1d27a"), style: StrokeStyle(lineWidth: 3, dash: [6, 4])).padding(-6) } }
    }

    private func status(_ st: DoodleGuess.State?, _ partner: String) -> Text {
        if !session.ready { return say(("Doodle Guess needs two. Once \(partner) has joined your place, you can play it here.", false)) }
        guard let st, let m = session.match else {
            if let over = session.over {
                let o = DoodleGuess.State(over.state)
                let got = o.score
                return say(("You guessed \(got) of \(DoodleGuess.rounds) together. ", true), (got > 0 && got >= o.best ? "Your best yet!" : "Your best is \(o.best) of \(DoodleGuess.rounds).", false))
            }
            return say(("One of you draws, the other guesses, then you swap. \(DoodleGuess.rounds) drawings, \(DoodleGuess.drawSeconds) seconds each. You’re on the same team, so see how many you can get.", false))
        }
        switch st.phase {
        case "lobby":
            return say(("Waiting for ", false), (partner, true), (" to join. They’ll see a note in the room, or you can tell them to open Play.", false))
        case "choosing":
            return session.iDraw ? say(("Your turn to draw.", true), (" Pick one. \(partner) won’t see which.", false)) : say((partner, true), (" is picking something to draw…", false))
        case "drawing":
            return session.iDraw
                ? say(("Draw ", false), (st.word ?? "", true), (" for \(partner). No letters or numbers! They get the first letter with \(DoodleGuess.hintAt) seconds left.", false))
                : say(("What is ", false), (partner, true), (" drawing? Type your guesses below.", false))
        default:
            let r = st.rounds.last
            if let secs = r?.secs {
                let guesser = st.drawer.other == place.mySeat ? "You" : place.seatName(st.drawer.other)
                return say(("\(guesser) got it", true), (" in \(secs) seconds. It was ", false), (r?.word ?? "", true), (".", false))
            }
            return say(("It was ", false), (r?.word ?? "", true), (". \(m.last == "skipped that one" ? "Skipped." : "Out of time.")", false))
        }
    }

    private func roundBar(_ st: DoodleGuess.State) -> some View {
        let left = session.left(now: now)
        return VStack(spacing: 6) {
            HStack {
                Text("Drawing \(st.round) of \(DoodleGuess.rounds)").font(.px(15, 700)) + Text(" · \(st.score) guessed").font(.px(15)).foregroundColor(Color.paper.opacity(0.75))
                Spacer()
                if session.drawing { Text("\(left)s left").font(.px(15, left <= 10 ? 700 : 400)) }
            }
            .foregroundStyle(Color.paper)
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Color.paper.opacity(0.15)
                    (left <= 10 ? Color(hex: "#c4453f") : Color(hex: "#8fb06a"))
                        .frame(width: g.size.width * (session.drawing ? CGFloat(left) / CGFloat(DoodleGuess.drawSeconds) : st.phase == "choosing" ? 1 : 0))
                }
            }
            .frame(height: 8)
        }
    }

    private func page(_ st: DoodleGuess.State, _ partner: String) -> some View {
        GeometryReader { g in
            let cell = g.size.width / CGFloat(DoodleGuess.w)
            ZStack {
                DoodlePage(pixels: session.pixels)
                if st.phase == "choosing" {
                    Color.paper.opacity(0.9)
                    if session.iDraw {
                        VStack(spacing: 10) {
                            ForEach(st.choices, id: \.self) { w in
                                Button {
                                    Haptics.tap()
                                    session.choose(w)
                                } label: {
                                    Text(w).font(.px(21, 700)).foregroundStyle(Color.inkSoft).frame(maxWidth: 260).padding(.vertical, 10).pxBox()
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    } else {
                        Text("\(partner) is choosing…").font(.px(21, 700)).foregroundStyle(Color.inkSoft).modifier(Blink(on: true))
                    }
                }
                if st.phase == "reveal", let r = st.rounds.last {
                    VStack {
                        Spacer()
                        Text(r.word).font(.px(24, 700)).foregroundStyle(Color.inkSoft).padding(.horizontal, 16).padding(.vertical, 6).pxBox().padding(10)
                    }
                    .allowsHitTesting(false)
                }
            }
            .contentShape(Rectangle())
            // (ahead of the page scrolling: a finger on the page draws)
            .highPriorityGesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { v in
                        let x = Int(v.location.x / cell), y = Int(v.location.y / cell)
                        if v.translation == .zero { session.penDown(x, y) } else { session.penMove(x, y) }
                    }
                    .onEnded { _ in session.penUp() },
                including: session.drawing && session.iDraw ? .all : .subviews
            )
        }
        .aspectRatio(CGFloat(DoodleGuess.w) / CGFloat(DoodleGuess.h), contentMode: .fit)
        .padding(4)
        .background(Color(hex: "#b48c4a"))
        .padding(4)
        .background(Color(hex: "#6b4633"))
        .accessibilityElement(children: .contain)
        .accessibilityLabel(session.drawing ? (session.iDraw ? "Your drawing of \(st.word ?? "")" : "\(partner)’s drawing") : "The drawing")
    }

    private func guessBox(_ word: String) -> some View {
        let hint = session.left(now: now) <= DoodleGuess.hintAt
        let letters = word.replacingOccurrences(of: " ", with: "").count
        return VStack(spacing: 10) {
            VStack(spacing: 2) {
                Text(DoodleGuess.shape(word, hint: hint)).font(.px(26, 700)).foregroundStyle(Color.inkSoft).lineLimit(1).minimumScaleFactor(0.5)
                Text("\(letters) letters\(word.contains(" ") ? ", \(word.split(separator: " ").count) words" : "")\(hint ? "" : " · first letter at \(DoodleGuess.hintAt)s")")
                    .font(.pxTiny).foregroundStyle(Color.muted)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .pxBox()
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(letters) letters\(hint ? ", starts with \(word.prefix(1))" : "")")
            HStack(spacing: 10) {
                TextField("Your guess", text: $text)
                    .font(.pxBody)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .submitLabel(.send)
                    .focused($typing)
                    .onSubmit(send)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(Color.paperInput)
                    .overlay(Rectangle().strokeBorder(Color.paperShade, lineWidth: 2))
                Button("Guess", action: send).buttonStyle(.px(.sage)).disabled(text.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            if let s = session.said, s.verdict != .right {
                Text(s.verdict == .close ? "“\(s.text)” is so close!" : "Not “\(s.text)”.").font(.px(15, 700)).foregroundStyle(Color.paper).frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private func send() {
        guard let v = session.guess(text) else { return }
        text = ""
        typing = v != .right
        if v == .right { Haptics.success() } else { Haptics.soft() }
    }

    private var tools: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                ForEach(DoodleGuess.inkOrder, id: \.self) { k in
                    Button {
                        session.color = k
                        if session.tool == .erase { session.tool = .pen }
                    } label: {
                        Rectangle().fill(Color(hex: DoodleGuess.inks[k] ?? "#000000")).frame(width: 30, height: 30)
                            .overlay(Rectangle().strokeBorder(Color.inkSoft.opacity(0.5), lineWidth: 2))
                            .overlay { if session.tool != .erase && session.color == k { Rectangle().strokeBorder(Color.butter, lineWidth: 3).padding(-5) } }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(DoodleGuess.inkNames[k] ?? "")
                    .accessibilityAddTraits(session.tool != .erase && session.color == k ? .isSelected : [])
                }
            }
            HStack(spacing: 6) {
                ForEach([DoodleSession.Tool.pen, .fill, .erase], id: \.self) { t in
                    Button(t == .pen ? "Pen" : t == .fill ? "Fill" : "Rubber") { session.tool = t }
                        .buttonStyle(.px(session.tool == t ? .ink : .paper, small: true))
                        .fixedSize()
                }
            }
            HStack(spacing: 6) {
                Text("Brush").font(.pxSmall).foregroundStyle(Color.muted)
                ForEach(1...3, id: \.self) { s in
                    Button {
                        session.size = s
                    } label: {
                        Rectangle().fill(session.size == s ? Color.paperHi : Color.inkSoft).frame(width: CGFloat(4 + s * 3), height: CGFloat(4 + s * 3)).frame(width: 22, height: 22)
                    }
                    .buttonStyle(.px(session.size == s ? .ink : .paper, small: true))
                    .accessibilityLabel(["Thin", "Medium", "Thick"][s - 1])
                }
            }
            HStack {
                Button("Clear the page") { session.clearPage() }.buttonStyle(.px(.paper, small: true))
                Spacer()
                Button("Too hard? Skip it") { session.skip() }.buttonStyle(.px(.paper, small: true))
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pxBox()
    }

    @ViewBuilder
    private func side(_ st: DoodleGuess.State, _ partner: String) -> some View {
        if st.phase == "choosing" {
            Text((session.iDraw ? "\(partner) will have \(DoodleGuess.drawSeconds) seconds to guess it." : "You’ll have \(DoodleGuess.drawSeconds) seconds to guess.") + " Then you swap.")
                .font(.pxSmall).foregroundStyle(Color.inkSoft).frame(maxWidth: .infinity, alignment: .leading).padding(12).pxBox()
        }
        if !st.guesses.isEmpty && (st.phase == "drawing" || st.phase == "reveal") {
            VStack(alignment: .leading, spacing: 4) {
                ForEach(Array(st.guesses.suffix(6).reversed().enumerated()), id: \.offset) { _, g in
                    HStack {
                        (Text("\(place.seatName(g.by)): ").foregroundColor(Color.muted) + Text(g.text)).lineLimit(1)
                        Spacer()
                        if g.right { Text("✓").font(.px(15, 700)) } else if g.close { Text("close").foregroundStyle(Color.muted) }
                    }
                    .font(.pxSmall)
                }
            }
            .foregroundStyle(Color.inkSoft)
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .pxBox()
        }
        if session.drawing && !session.iDraw {
            Button("Give up on this one") { session.skip() }
                .buttonStyle(.px(.paper, small: true))
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        if st.phase == "reveal" {
            let nextDrawer = st.drawer.other
            Button(st.round >= DoodleGuess.rounds ? "See how you did" : "Next drawing (\(nextDrawer == place.mySeat ? "you draw" : "\(place.seatName(nextDrawer)) draws"))") {
                Haptics.tap()
                session.next()
            }
            .buttonStyle(.px(.sage, wide: true))
        }
    }

    private func lookBack(_ st: DoodleGuess.State) -> some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
            ForEach(Array(st.rounds.enumerated()), id: \.offset) { _, r in
                VStack(spacing: 6) {
                    DoodlePage(pixels: r.pixels ?? DoodleGuess.blank).overlay(Rectangle().strokeBorder(Color(hex: "#d8c7a4"), lineWidth: 2))
                    Text(r.word).font(.px(16, 700)).foregroundStyle(Color.inkSoft)
                    Text("by \(place.seatName(r.drawer)) · \(r.secs.map { "got it in \($0)s" } ?? "not this time")").font(.pxTiny).foregroundStyle(Color.muted).multilineTextAlignment(.center)
                }
                .padding(8)
                .pxBox()
                .accessibilityElement(children: .combine)
            }
        }
    }
}
