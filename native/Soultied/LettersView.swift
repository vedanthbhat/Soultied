import SwiftUI
import SoultiedCore

/*
 * Letters: today's five cards (answer in secret, seal, open together), the 30 days of knowing each other,
 * questions you ask each other, After dark, and every letter you've opened.
 */

enum LettersTab: String, CaseIterable, Identifiable {
    case today = "Today", journey = "30 days", ask = "Ask", afterDark = "After dark", past = "Past"
    var id: String { rawValue }
}

struct LettersView: View {
    let place: PlaceModel
    @State private var tab: LettersTab

    init(place: PlaceModel, start: LettersTab = .today) {
        self.place = place
        _tab = State(initialValue: start)
    }

    var body: some View {
        ScrollViewReader { reader in
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    DarkHeading(title: "Letters", sub: Day.pretty(place.today, long: true)).id("top")
                    tabs
                    Group {
                        if !place.partnerHere {
                            NoPartner(place: place)
                        } else {
                            switch tab {
                            case .today:
                                LetterPanel(place: place, kind: .daily, key: place.today)
                                JourneyNudge(place: place) { tab = .journey }
                                StreakCard(place: place)
                            case .journey: JourneyPanel(place: place)
                            case .ask: AskPanel(place: place)
                            case .afterDark: AfterDarkPanel(place: place)
                            case .past:
                                PastPanel(place: place)
                                StreakCard(place: place)
                            }
                        }
                    }
                }
                .padding(16)
                .padding(.bottom, 100)
            }
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: tab) { _, _ in withAnimation { reader.scrollTo("top", anchor: .top) } }
        }
        .background(RoomBackground())
    }

    private var tabs: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(LettersTab.allCases) { t in
                    Button {
                        Haptics.tap()
                        tab = t
                    } label: {
                        HStack(spacing: 4) {
                            Text(t.rawValue)
                            if badge(t) { Rectangle().fill(Color.thread).frame(width: 7, height: 7) }
                        }
                    }
                    .buttonStyle(.px(tab == t ? .terracotta : .paper, small: true))
                }
            }
            .padding(.vertical, 4)
            .padding(.horizontal, 2)
        }
    }

    private func badge(_ t: LettersTab) -> Bool {
        switch t {
        case .today: return place.letterWaiting
        case .journey: let j = place.journey; return j.started && (j.next != nil || j.unseen != nil)
        case .ask: let v = place.asksView; return !v.forMe.isEmpty || !v.fresh.isEmpty
        case .afterDark: return place.afterDarkOpen && !place.letter(.afterDark).sealed(place.me)
        case .past: return false
        }
    }
}

struct NoPartner: View {
    let place: PlaceModel
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            GlyphView(glyph: Icons.envelope, scale: 5)
            Text("Letters start once \(place.theirName) moves in. Every day you’ll both get five quick cards, answer them in secret, and open them together.")
                .font(.px(19, 500)).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
            Text("Send the invite from the Us tab.").font(.pxSmall).foregroundStyle(Color.muted)
        }
        .pxCard()
    }
}

/* ---------- one letter: answer, wait, or read ---------- */

struct LetterPanel: View {
    let place: PlaceModel
    let kind: LetterKind
    let key: String
    var tag: String?
    var title: String?
    var sealLabel: String?

    var body: some View {
        let d = place.letter(kind, key)
        let night = kind == .afterDark
        Group {
            if d.opened {
                RevealView(place: place, day: d, night: night, tag: tag)
                    .onAppear { place.markSeen(kind, key) }
            } else if d.sealed(place.me) {
                VStack(spacing: 12) {
                    GlyphView(glyph: Icons.envelope, scale: 7)
                    Text(kind == .journey ? "Your answer is sealed" : "Sealed and waiting on the table").font(.pxHeading).foregroundStyle(Color.inkSoft).multilineTextAlignment(.center)
                    Text(kind == .journey ? "It opens for both of you as soon as \(place.theirName) answers too." : "\(place.theirName) hasn’t sealed \(night ? "tonight’s After dark cards" : "today’s letter") yet. It opens for both of you the moment they do.")
                        .font(.pxBody).foregroundStyle(Color.muted).multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity)
                .pxCard()
            } else {
                LetterFlowView(place: place, kind: kind, key: key, night: night, tag: tag, title: title, sealLabel: sealLabel)
                    .id("\(kind.rawValue)-\(key)")
            }
        }
    }
}

/// One card at a time, then a quick look back and a wax seal. Taps move you on by themselves.
struct LetterFlowView: View {
    let place: PlaceModel
    let kind: LetterKind
    let key: String
    var night = false
    var tag: String?
    var title: String?
    var sealLabel: String?

    @State private var step = -1
    /// on a guess card: your own answer, or your guess for your person
    @State private var guessMode: (id: String, guess: Bool)?
    @State private var note = ""
    @State private var text = ""
    /// the optional line before sealing (kept as the last card's note)
    @State private var extra: String?

    private var day: LetterDay { place.letter(kind, key) }
    private var cards: [Card] { Cards.of(day.cardIds) }
    private var answers: [String: CardAnswer] { day.by[place.me]?.cards ?? [:] }
    private var partnerSealed: Bool { place.them.map { day.sealed($0) } ?? false }

    var body: some View {
        let cards = self.cards
        let at = step < 0 ? (cards.firstIndex { !Cards.isAnswered($0, answers[$0.id]) } ?? cards.count) : step
        VStack(alignment: .leading, spacing: 16) {
            if at >= cards.count {
                lookBack(cards)
            } else {
                one(cards[at], at, cards.count)
            }
        }
        .pxCard()
        .onAppear {
            if step < 0 { go(at) }
        }
    }

    private func go(_ to: Int) {
        saveText()
        let n = max(0, min(cards.count, to))
        step = n
        guessMode = nil
        let c = n < cards.count ? cards[n] : nil
        note = c.flatMap { answers[$0.id]?.note } ?? ""
        text = c.flatMap { answers[$0.id]?.text } ?? ""
    }

    private func saveText() {
        guard step >= 0, step < cards.count else { return }
        let c = cards[step]
        guard c.style == .open else { return }
        let v = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if !v.isEmpty && v != (answers[c.id]?.text ?? "") { place.answer(kind, key, card: c.id, CardAnswer(pick: 0, text: v)) }
    }

    private func guessing(_ c: Card) -> Bool {
        guard c.guess, let a = answers[c.id] else { return false }
        _ = a
        if let m = guessMode, m.id == c.id { return m.guess }
        return answers[c.id]?.guess == nil && !c.note
    }

    private func later(_ fn: @escaping () -> Void) { DispatchQueue.main.asyncAfter(deadline: .now() + 0.17, execute: fn) }

    private func choose(_ c: Card, _ i: Int) {
        Haptics.tap()
        let a = answers[c.id]
        if c.guess && guessing(c), var a {
            a.guess = i
            place.answer(kind, key, card: c.id, a)
            later { go(step + 1) }
            return
        }
        var next = a ?? CardAnswer(pick: i)
        next.pick = i
        if c.note { next.note = note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : note.trimmingCharacters(in: .whitespacesAndNewlines) }
        place.answer(kind, key, card: c.id, next)
        if c.note { return }
        if c.guess { later { guessMode = (c.id, true) } } else { later { go(step + 1) } }
    }

    /// daily letters: an optional line for your person before you seal
    private var extraLine: Bool { kind == .daily }

    private func saveExtra() {
        guard extraLine, let last = cards.last, var a = answers[last.id], let e = extra else { return }
        let v = e.trimmingCharacters(in: .whitespacesAndNewlines)
        guard v != (a.note ?? "") else { return }
        a.note = v.isEmpty ? nil : v
        place.answer(kind, key, card: last.id, a)
    }

    /// an open card: answer it out loud on your next call instead
    private func aloud(_ c: Card) {
        Haptics.tap()
        text = ""
        place.answer(kind, key, card: c.id, CardAnswer(pick: 0, aloud: true))
        later { go(step + 1) }
    }

    private func saveNote(_ c: Card) {
        guard var a = answers[c.id] else { return }
        let n = note.trimmingCharacters(in: .whitespacesAndNewlines)
        a.note = n.isEmpty ? nil : n
        place.answer(kind, key, card: c.id, a)
        if c.guess { guessMode = (c.id, true) } else { go(step + 1) }
    }

    private func pips(_ cards: [Card]) -> some View {
        HStack(spacing: 6) {
            ForEach(Array(cards.enumerated()), id: \.offset) { i, c in
                Button { go(i) } label: {
                    Rectangle()
                        .fill(Cards.isAnswered(c, answers[c.id]) ? Color.terracotta : Color.paper2)
                        .frame(width: 14, height: 14)
                        .overlay { if i == step { Rectangle().strokeBorder(Color.ink, lineWidth: 3).padding(-3) } }
                }
                .accessibilityLabel("Card \(i + 1)")
            }
        }
    }

    private func said(_ c: Card, _ a: CardAnswer?) -> String {
        guard let a else { return "—" }
        if c.style == .open { return a.text ?? (a.aloud == true ? "Saved for your call" : "—") }
        if c.style == .likely { return a.pick == 0 ? place.myName : place.theirName }
        return a.pick < c.options.count ? c.options[a.pick] : "—"
    }

    /* ---------- the look-back before sealing ---------- */

    private func lookBack(_ cards: [Card]) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text(title ?? "Your letter").font(.pxHeading).foregroundStyle(Color.inkSoft)
                Spacer()
                if cards.count > 1 { pips(cards) }
            }
            ForEach(Array(cards.enumerated()), id: \.offset) { i, c in
                let a = answers[c.id]
                Button { go(i) } label: {
                    HStack(alignment: .top, spacing: 10) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(c.title).font(.pxSmall).foregroundStyle(Color.muted).multilineTextAlignment(.leading)
                            Text(said(c, a)).font(.pxBodyBold).foregroundStyle(Color.inkSoft).multilineTextAlignment(.leading)
                            if c.guess, let g = a?.guess, g < c.options.count {
                                Text("guess for \(place.theirName): \(c.options[g])").font(.pxSmall).foregroundStyle(Color.muted)
                            }
                            if let n = a?.note, !(extraLine && c.id == cards.last?.id) { Text("“\(n)”").font(.px(14)).italic().foregroundStyle(Color.inkSoft) }
                        }
                        Spacer(minLength: 0)
                        Text("Change").font(.px(13, 600)).foregroundStyle(Color.terracottaD).underline()
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .pxInset()
                }
                .buttonStyle(.press)
            }
            if extraLine, let last = cards.last, answers[last.id] != nil {
                VStack(alignment: .leading, spacing: 6) {
                    PixelLabel(text: "Add a line for \(place.theirName) (optional)")
                    PixelField(placeholder: "Something only they’ll read", text: Binding(get: { extra ?? answers[last.id]?.note ?? "" }, set: { extra = $0 }), limit: 140)
                        .submitLabel(.done)
                        .onSubmit { saveExtra() }
                }
            }
            Text(partnerSealed
                ? "\(place.theirName) has already sealed theirs, so this opens the moment you seal yours."
                : "Once it’s sealed you can’t change it. It waits on the table until \(place.theirName) seals theirs, then you both see everything.")
                .font(.pxSmall).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
            Button {
                saveText()
                saveExtra()
                place.seal(kind, key)
                Haptics.success()
            } label: {
                HStack(spacing: 8) {
                    GlyphView(glyph: Icons.seal, scale: 2)
                    Text(partnerSealed ? "Seal it and open together" : sealLabel ?? "Seal the letter")
                }
            }
            .buttonStyle(.px(night ? .night : .terracotta, wide: true))
            .disabled(!place.ready(toSeal: kind, key))
        }
    }

    /* ---------- one card ---------- */

    @ViewBuilder
    private func one(_ c: Card, _ at: Int, _ count: Int) -> some View {
        let a = answers[c.id]
        let g = guessing(c)
        HStack {
            PixelTag(text: tag ?? KIND_LABEL[c.kind] ?? "", night: night)
            if count > 1 { Text("Card \(at + 1) of \(count)").font(.pxSmall).foregroundStyle(Color.muted) }
            Spacer()
            if count > 1 { pips(cards) }
        }
        if c.guess {
            HStack(spacing: 8) {
                HeadView(look: g ? (place.theirLook ?? Wardrobe.defaultB) : place.myLook, size: 28)
                Group {
                    if g, let a, a.pick < c.options.count {
                        Text("You said **\(c.options[a.pick])**. Now guess \(place.theirName)’s answer.")
                    } else {
                        Text("Your answer first. Then you’ll guess \(place.theirName)’s.")
                    }
                }
                .font(.pxSmall).foregroundStyle(Color.muted)
            }
        }
        Text(g ? "What will \(place.theirName) pick?" : c.prompt).font(.px(24, 700)).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)

        if c.style == .likely {
            HStack(spacing: 12) {
                ForEach(0..<2, id: \.self) { i in
                    Button { choose(c, i) } label: {
                        VStack(spacing: 6) {
                            HeadView(look: i == 0 ? place.myLook : (place.theirLook ?? Wardrobe.defaultB), size: 44)
                            Text(i == 0 ? "Me (\(place.myName))" : place.theirName)
                        }
                    }
                    .buttonStyle(OptionStyle(selected: a?.pick == i, big: true))
                }
            }
        } else if c.style == .open {
            VStack(alignment: .leading, spacing: 6) {
                PixelField(placeholder: "In your own words", text: $text, limit: OPEN_MAX, lines: 4)
                Text("\(place.theirName) reads this once you’ve both sealed · \(OPEN_MAX - text.count) left").font(.pxTiny).foregroundStyle(Color.muted)
                Button("Rather say it out loud? Save it for our call") { aloud(c) }
                    .buttonStyle(.px(.paper, small: true, wide: true))
            }
        } else if c.options.count == 2 {
            HStack(spacing: 10) {
                Button(c.options[0]) { choose(c, 0) }.buttonStyle(OptionStyle(selected: (g ? a?.guess : a?.pick) == 0, big: true))
                Text("or").font(.px(16, 700)).foregroundStyle(Color.muted)
                Button(c.options[1]) { choose(c, 1) }.buttonStyle(OptionStyle(selected: (g ? a?.guess : a?.pick) == 1, big: true))
            }
        } else {
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                ForEach(Array(c.options.enumerated()), id: \.offset) { i, o in
                    Button { choose(c, i) } label: {
                        VStack(spacing: 4) {
                            Text(o)
                            if g && a?.pick == i { PixelTag(text: "you") }
                        }
                    }
                    .buttonStyle(OptionStyle(selected: (g ? a?.guess : a?.pick) == i))
                }
            }
        }

        if c.note && !g {
            VStack(alignment: .leading, spacing: 6) {
                PixelLabel(text: (c.noteLabel.map { $0.replacingOccurrences(of: "them", with: place.theirName) } ?? "Add a line for \(place.theirName)") + " (optional)")
                PixelField(placeholder: c.guess ? "Say more, if you like" : "Something only they’ll read", text: $note, limit: c.noteMax ?? 140, lines: (c.noteMax ?? 140) > 140 ? 5 : 1)
            }
        }

        HStack {
            if at > 0 || g {
                Button(g ? "← Change my answer" : "← Back") {
                    if g { guessMode = (c.id, false) } else { go(at - 1) }
                }
                .buttonStyle(.px(.paper, small: true))
            } else {
                Text(count > 1 ? "\(count) cards · \(cards.contains { $0.style == .open } ? "about two minutes" : "about a minute, all taps")" : c.guess ? "Your answer, then a guess at \(place.theirName)’s" : "One card")
                    .font(.pxSmall).foregroundStyle(Color.muted)
            }
            Spacer()
            if c.style == .open {
                Button("Next →") {
                    place.answer(kind, key, card: c.id, CardAnswer(pick: 0, text: text.trimmingCharacters(in: .whitespacesAndNewlines)))
                    go(at + 1)
                }
                .buttonStyle(.px(.terracotta))
                .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            } else if c.note && !g {
                Button("Next →") { saveNote(c) }.buttonStyle(.px(.terracotta)).disabled(a == nil)
            } else if Cards.isAnswered(c, a) {
                Button("Next →") { go(at + 1) }.buttonStyle(.px(.paper, small: true))
            }
        }
    }
}

/* ---------- both answers, side by side ---------- */

struct RevealView: View {
    let place: PlaceModel
    let day: LetterDay
    var night = false
    var tag: String?
    var compact = false

    var body: some View {
        let them = place.them ?? ""
        let cards = Cards.of(day.cardIds)
        let score = scoreDay(day, me: place.me, them: them)
        let mine = day.by[place.me]?.cards ?? [:]
        let theirs = day.by[them]?.cards ?? [:]
        let talk = cards.first { $0.id == score.talkAbout }
        VStack(alignment: .leading, spacing: compact ? 12 : 18) {
            if tag != nil {
                if !compact, let c = cards.first, mine[c.id] != nil, theirs[c.id] != nil {
                    HStack(spacing: 12) {
                        GlyphView(glyph: score.same > 0 ? Icons.heart : Icons.heartEmpty, scale: 3)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(score.same > 0 ? "Same answer. You two are in sync." : "Different answers. Ask \(place.theirName) why tonight.").font(.pxBodyBold).foregroundStyle(Color.inkSoft)
                            if score.myGuesses.total > 0 {
                                Text("\(score.myGuesses.right > 0 ? "You read their mind" : "Your guess was off") · \(score.theirGuesses.right > 0 ? "\(place.theirName) read yours" : "\(place.theirName)’s guess was off")")
                                    .font(.pxSmall).foregroundStyle(Color.muted)
                            }
                        }
                    }
                    .padding(12).frame(maxWidth: .infinity, alignment: .leading).pxInset()
                }
            } else if !compact {
                HStack(spacing: 14) {
                    HStack(spacing: 3) {
                        ForEach(0..<max(score.total, 0), id: \.self) { i in GlyphView(glyph: i < score.same ? Icons.heart : Icons.heartEmpty, scale: 3) }
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text("In sync on \(score.same) of \(score.total)").font(.pxHeading).foregroundStyle(Color.inkSoft)
                        if score.myGuesses.total > 0 {
                            Text("Mind reading: you \(score.myGuesses.right)/\(score.myGuesses.total) · \(place.theirName) \(score.theirGuesses.right)/\(score.theirGuesses.total)").font(.pxSmall).foregroundStyle(Color.muted)
                        }
                    }
                }
                if let talk, let a = mine[talk.id], let b = theirs[talk.id] {
                    VStack(alignment: .leading, spacing: 4) {
                        PixelTag(text: "Talk about it tonight", night: night)
                        Text(talk.title).font(.pxBodyBold).foregroundStyle(Color.inkSoft)
                        let point = talkPoint(talk, a, b, them: place.theirName)
                        // (the talking point names both answers itself, except on Flirty and Who's more likely cards)
                        let both = talk.kind == .flirt || talk.style == .likely || point == nil
                        Group {
                            if both {
                                Text("You said **\(said(talk, a, mine: true))**, \(place.theirName) said **\(said(talk, b, mine: false))**. \(point ?? "Ask each other why.")")
                            } else {
                                Text(point ?? "Ask each other why.")
                            }
                        }
                        .font(.pxSmall).foregroundStyle(Color.inkSoft)
                    }
                    .padding(12).frame(maxWidth: .infinity, alignment: .leading).pxInset()
                } else {
                    Text("Same answer on every card. Very in sync today.").font(.pxBodyBold).foregroundStyle(Color.inkSoft)
                        .padding(12).frame(maxWidth: .infinity, alignment: .leading).pxInset()
                }
            } else if score.myGuesses.total > 0 {
                Text("Mind reading: you \(score.myGuesses.right)/\(score.myGuesses.total) · \(place.theirName) \(score.theirGuesses.right)/\(score.theirGuesses.total)").font(.pxSmall).foregroundStyle(Color.muted)
            }

            ForEach(cards) { c in
                if let a = mine[c.id], let b = theirs[c.id] {
                    cardView(c, a, b, talking: !compact && tag == nil && c.id != talk?.id)
                }
            }
        }
        .modifier(CardIf(on: !compact))
    }

    private func said(_ c: Card, _ x: CardAnswer, mine: Bool) -> String {
        if c.style == .likely { return (x.pick == 0) == mine ? place.myName : place.theirName }
        if c.style == .open { return x.text ?? (x.aloud == true ? "Saving this one for your call" : "—") }
        return x.pick < c.options.count ? c.options[x.pick] : "—"
    }

    @ViewBuilder
    private func cardView(_ c: Card, _ a: CardAnswer, _ b: CardAnswer, talking: Bool = false) -> some View {
        let myLook = place.myLook, theirLook = place.theirLook ?? Wardrobe.defaultB
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                PixelTag(text: tag ?? KIND_LABEL[c.kind] ?? "", night: night)
                Text(c.title).font(.pxBodyBold).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
            }
            if c.style == .open {
                ForEach(Array([(myLook, a), (theirLook, b)].enumerated()), id: \.offset) { i, x in
                    HStack(alignment: .top, spacing: 8) {
                        HeadView(look: x.0, size: 26)
                        Text(said(c, x.1, mine: i == 0)).font(.pxBody).italic(x.1.text == nil).foregroundStyle(x.1.text == nil ? Color.muted : Color.inkSoft).fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: 0)
                    }
                    .padding(10).pxInset()
                }
            } else if Cards.sameAnswer(c, a, b) {
                HStack(spacing: 6) {
                    HeadView(look: myLook, size: 26)
                    HeadView(look: theirLook, size: 26)
                    Text("Both: \(said(c, a, mine: true))").font(.pxBodyBold).foregroundStyle(Color.inkSoft)
                    GlyphView(glyph: Icons.check, scale: 2)
                }
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 8) { HeadView(look: myLook, size: 26); Text(said(c, a, mine: true)).font(.pxBody).foregroundStyle(Color.inkSoft) }
                    HStack(spacing: 8) { HeadView(look: theirLook, size: 26); Text(said(c, b, mine: false)).font(.pxBody).foregroundStyle(Color.inkSoft) }
                }
            }
            if c.guess && !compact {
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        GlyphView(glyph: a.guess == b.pick ? Icons.check : Icons.cross, scale: 2)
                        Text("You guessed \(place.theirName) would say “\(opt(c, a.guess))”").font(.pxSmall).foregroundStyle(Color.muted)
                    }
                    HStack(spacing: 6) {
                        GlyphView(glyph: b.guess == a.pick ? Icons.check : Icons.cross, scale: 2)
                        Text("\(place.theirName) guessed you’d say “\(opt(c, b.guess))”").font(.pxSmall).foregroundStyle(Color.muted)
                    }
                }
            }
            if a.note != nil || b.note != nil {
                ForEach(Array([(myLook, a.note), (theirLook, b.note)].compactMap { x in x.1.map { (x.0, $0) } }.enumerated()), id: \.offset) { _, x in
                    let (look, n) = x
                    HStack(alignment: .top, spacing: 8) {
                        HeadView(look: look, size: 24)
                        Text("“\(n)”").font(.px(15)).italic().foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: 0)
                    }
                    .padding(10).pxInset()
                }
            }
            if talking, let t = talkPoint(c, a, b, them: place.theirName) {
                Text("Talk: \(t)").font(.pxSmall).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func opt(_ c: Card, _ i: Int?) -> String {
        let k = i ?? 0
        return k < c.options.count ? c.options[k] : "—"
    }
}

/// wraps the content in a card, or not
struct CardIf: ViewModifier {
    var on: Bool
    func body(content: Content) -> some View {
        if on { content.pxCard() } else { content }
    }
}

/* ---------- 30 days of knowing each other ---------- */

struct JourneyNudge: View {
    let place: PlaceModel
    var open: () -> Void
    var body: some View {
        let j = place.journey
        if !(j.started && j.next == nil && j.unseen == nil) {
            HStack(spacing: 12) {
                GlyphView(glyph: Icons.book, scale: 3)
                Text(!j.started ? "New: 30 days of knowing each other. One question a day, a little deeper each week."
                    : j.unseen != nil ? "Day \(j.unseen!) of your 30 days just opened." : "Day \(j.next ?? 1) of your 30 days is waiting for you.")
                    .font(.pxSmall).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
                Button(j.started ? "Open" : "Take a look", action: open).buttonStyle(.px(.sage, small: true))
            }
            .pxCard()
        }
    }
}

struct JourneyPanel: View {
    let place: PlaceModel
    @State private var picked: Int?
    @State private var book = false

    private func tag(_ n: Int) -> String { "Day \(n) · \(Journey.chapter(n).chapter.title)" }

    enum Cell { case open, mine, theirs, new, done, locked }

    var body: some View {
        let j = place.journey
        if !j.started {
            intro
        } else if book {
            bookView
        } else {
            let n = picked ?? j.unseen ?? j.next ?? j.unlocked
            let ch = Journey.chapter(n)
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Chapter \(ch.index + 1) of \(Cards.chapters.count) · \(ch.chapter.title)").font(.pxSmall).foregroundStyle(Color.muted)
                            Text("Day \(n) of \(Journey.days)").font(.pxTitle).foregroundStyle(Color.inkSoft)
                            Text(ch.chapter.blurb).font(.pxSmall).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
                        }
                        Spacer()
                        Button {
                            book = true
                        } label: {
                            HStack(spacing: 5) {
                                GlyphView(glyph: Icons.book, scale: 2)
                                Text("Our book (\(j.done))")
                            }
                        }
                        .buttonStyle(.px(.paper, small: true))
                    }
                    if j.finished {
                        HStack(spacing: 10) {
                            GlyphView(glyph: Icons.heart, scale: 3)
                            Text("**30 days, together.** You know each other a little better than a month ago. Your answers are in “Our book”.").font(.pxSmall).foregroundStyle(Color.inkSoft)
                        }
                        .padding(10).pxInset()
                    }
                    strip(selected: n, unlocked: j.unlocked)
                }
                .pxCard()
                if n > j.unlocked {
                    Text("Day \(n) isn’t open yet.").font(.pxBody).foregroundStyle(Color.paper.opacity(0.7))
                } else {
                    LetterPanel(place: place, kind: .journey, key: Journey.key(n), tag: tag(n), title: "Day \(n)", sealLabel: "Seal my answer")
                        .id(n)
                }
                if j.next == nil && j.unlocked < Journey.days, let s = j.start {
                    let opens = Day.add(s, j.unlocked)
                    Text("You’re all caught up. Day \(j.unlocked + 1) opens \(opens == Day.add(place.today, 1) ? "tomorrow" : "on \(Day.pretty(opens))").")
                        .font(.pxSmall).foregroundStyle(Color.paper.opacity(0.7))
                }
            }
        }
    }

    private func state(_ n: Int, _ unlocked: Int) -> Cell {
        let d = place.letters.journey[Journey.key(n)]
        if let d, d.opened { return d.by[place.me]?.seenAt != nil ? .done : .new }
        if n > unlocked { return .locked }
        if d?.sealed(place.me) == true { return .mine }
        if let t = place.them, d?.sealed(t) == true { return .theirs }
        return .open
    }

    private func strip(selected: Int, unlocked: Int) -> some View {
        var start = 0
        let chapters = Cards.chapters.map { ch -> (String, ClosedRange<Int>) in
            defer { start += ch.days }
            return (ch.title, (start + 1)...(start + max(1, ch.days)))
        }
        return VStack(alignment: .leading, spacing: 8) {
            ForEach(chapters, id: \.0) { title, days in
                HStack(spacing: 8) {
                    Text(title).font(.pxTiny).foregroundStyle(Color.muted).frame(width: 110, alignment: .leading).lineLimit(1)
                    HStack(spacing: 4) {
                        ForEach(Array(days), id: \.self) { n in
                            let st = state(n, unlocked)
                            Button {
                                Haptics.tap()
                                picked = n
                            } label: {
                                cell(st)
                                    .frame(width: 18, height: 22)
                                    .overlay { if n == selected { Rectangle().strokeBorder(Color.ink, lineWidth: 3).padding(-3) } }
                            }
                            .disabled(st == .locked)
                            .accessibilityLabel("Day \(n)")
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func cell(_ st: Cell) -> some View {
        switch st {
        case .done: Rectangle().fill(Color.terracotta)
        case .new: Rectangle().fill(Color.terracotta).overlay { Rectangle().strokeBorder(Color.butter, lineWidth: 3) }
        case .mine: Rectangle().fill(Color.butter)
        case .theirs: Rectangle().fill(Color.paperHi).overlay { Rectangle().strokeBorder(Color.terracotta, lineWidth: 3) }
        case .open: Rectangle().fill(Color.paperHi).overlay { Rectangle().strokeBorder(Color.inkSoft, lineWidth: 2) }
        case .locked: Rectangle().fill(Color.paper2).opacity(0.55)
        }
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                GlyphView(glyph: Icons.book, scale: 5)
                VStack(alignment: .leading, spacing: 2) {
                    Text("30 days of knowing each other").font(.pxHeading).foregroundStyle(Color.inkSoft)
                    Text("One question a day, from the little things to the big ones").font(.pxSmall).foregroundStyle(Color.muted)
                }
            }
            Text("Each day there’s one question with four answers. Pick yours, guess \(place.theirName)’s, and add a line if you want to say more. It opens when you’ve both answered, so you see each other’s answers together.")
                .font(.pxBody).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
            ForEach(Array(Cards.chapters.enumerated()), id: \.offset) { i, c in
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text("Days \(i * 6 + 1)–\(i * 6 + 6)").font(.pxTiny).foregroundStyle(Color.muted).frame(width: 74, alignment: .leading)
                    Text("**\(c.title)** \(c.blurb)").font(.pxSmall).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
                }
                .padding(10).frame(maxWidth: .infinity, alignment: .leading).pxInset()
            }
            Button("Start our 30 days") {
                place.startJourney()
                Haptics.success()
            }
            .buttonStyle(.px(.sage, wide: true))
            Text("It starts for both of you. Missed a day? You can always catch up.").font(.pxSmall).foregroundStyle(Color.muted)
        }
        .pxCard()
    }

    private var bookView: some View {
        let days = (1...max(1, Journey.days)).compactMap { n -> (Int, LetterDay)? in
            guard let d = place.letters.journey[Journey.key(n)], d.opened else { return nil }
            return (n, d)
        }
        return VStack(alignment: .leading, spacing: 14) {
            HStack {
                GlyphView(glyph: Icons.book, scale: 4)
                VStack(alignment: .leading) {
                    Text("Our book").font(.pxHeading).foregroundStyle(Color.inkSoft)
                    Text("\(days.count) of \(Journey.days) days so far").font(.pxSmall).foregroundStyle(Color.muted)
                }
                Spacer()
                Button("← Back") { book = false }.buttonStyle(.px(.paper, small: true))
            }
            if days.isEmpty {
                Text("The days you open together collect here, like pages in a book.").font(.pxBody).foregroundStyle(Color.muted)
            }
            ForEach(days, id: \.0) { n, d in
                RevealView(place: place, day: d, tag: tag(n), compact: true)
                Divider().overlay(Color.paperShade)
            }
        }
        .pxCard()
    }
}

/* ---------- After dark ---------- */

struct AfterDarkPanel: View {
    let place: PlaceModel
    @State private var adult = false

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 12) {
                    GlyphView(glyph: place.afterDarkOpen ? Icons.moon : Icons.lock, scale: 4)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("After dark").font(.pxHeading).foregroundStyle(Color(hex: "#efe3cb"))
                        Text("Flirty and intimate cards, just for you two · 18+").font(.pxSmall).foregroundStyle(Color(hex: "#efe3cb").opacity(0.8))
                    }
                }
                if !place.afterDarkMine {
                    Text("Three extra cards a night that are a little more daring. It stays hidden until **both** of you switch it on, and we never tell \(place.theirName) you did unless they switch it on too.")
                        .font(.pxBody).foregroundStyle(Color(hex: "#efe3cb")).fixedSize(horizontal: false, vertical: true)
                    Toggle(isOn: $adult) { Text("I’m 18 or older").font(.pxBody).foregroundStyle(Color(hex: "#efe3cb")) }.tint(Color.terracotta)
                    Button("Switch it on for me") { place.setAfterDark(true) }.buttonStyle(.px(.terracotta, wide: true)).disabled(!adult)
                } else if !place.afterDarkOpen {
                    Text("You’re in. It opens as soon as \(place.theirName) switches it on from their side too. They won’t see that you did.")
                        .font(.pxBody).foregroundStyle(Color(hex: "#efe3cb")).fixedSize(horizontal: false, vertical: true)
                    Button("Switch it off for me") { place.setAfterDark(false) }.font(.pxSmall).foregroundStyle(Color(hex: "#e9d7b7")).underline()
                } else {
                    Text("Tonight’s three. Same rules: answer in secret, it opens when you’ve both sealed.").font(.pxBody).foregroundStyle(Color(hex: "#efe3cb"))
                    heat
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(hex: "#2e2940"))
            .padding(PX)
            .background(NotchedFrame(notch: PX).fill(Color.ink))

            if place.afterDarkOpen {
                LetterPanel(place: place, kind: .afterDark, key: place.today)
                Button("Switch After dark off for me") { place.setAfterDark(false) }.font(.pxSmall).foregroundStyle(Color.paper.opacity(0.7)).underline()
            }
        }
    }

    private var heat: some View {
        let mine = place.letters.afterDarkHeat[place.me] ?? 1
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text("How daring?").font(.pxSmall).foregroundStyle(Color(hex: "#efe3cb"))
                Button("Flirty") { place.setHeat(1) }.buttonStyle(.px(mine == 1 ? .terracotta : .paper, small: true, wide: true))
                // (Hot comes with Soultied Plus)
                Button(place.hasPlus || place.isDemo ? "Hot" : "Hot · Plus") {
                    if place.plusOpen { place.setHeat(2) } else { PlusGate.shared.show(.hot) }
                }
                .buttonStyle(.px(mine == 2 ? .terracotta : .paper, small: true, wide: true))
            }.evenRow()
            Text(mine >= 2 && place.heat < 2 ? (place.plusOpen ? "Hot cards start once \(place.theirName) picks Hot too. Until then, it stays flirty." : "Hot cards come with Soultied Plus. Until then, it stays flirty.")
                : mine >= 2 ? "You both picked Hot: two bold cards and a flirty one each night, from the next letter you start."
                : "Flirty: suggestive, never explicit. Pick Hot for bolder cards (only if you both do).")
                .font(.pxTiny).foregroundStyle(Color(hex: "#efe3cb").opacity(0.8)).fixedSize(horizontal: false, vertical: true)
        }
    }
}

/* ---------- every letter so far ---------- */

struct PastPanel: View {
    let place: PlaceModel
    @State private var open: String?
    @State private var older: [LetterDay] = []
    @State private var loading = false
    @State private var done = false

    var body: some View {
        let all = Dictionary((older + Array(place.letters.daily.values)).map { ($0.dateKey, $0) }, uniquingKeysWith: { _, b in b })
        let days = all.values.filter { $0.dateKey < place.today && $0.by.values.contains { $0.sealedAt != nil } }.sorted { $0.dateKey > $1.dateKey }
        VStack(alignment: .leading, spacing: 10) {
            if days.isEmpty {
                Text("Letters you open together will collect here, day by day, for as long as you’re here.").font(.pxBody).foregroundStyle(Color.muted).pxCard()
            }
            ForEach(days, id: \.dateKey) { d in
                let sc = d.opened ? scoreDay(d, me: place.me, them: place.them ?? "") : nil
                VStack(alignment: .leading, spacing: 10) {
                    Button {
                        if d.opened { withAnimation { open = open == d.dateKey ? nil : d.dateKey } }
                    } label: {
                        HStack {
                            Text(Day.pretty(d.dateKey)).font(.pxBodyBold).foregroundStyle(Color.inkSoft)
                            Spacer()
                            if let sc {
                                HStack(spacing: 2) {
                                    ForEach(0..<sc.total, id: \.self) { i in GlyphView(glyph: i < sc.same ? Icons.heart : Icons.heartEmpty, scale: 2) }
                                }
                                Text("\(sc.same) of \(sc.total)").font(.pxSmall).foregroundStyle(Color.muted)
                            } else {
                                Text(d.sealed(place.me) ? "Only you sealed this one" : "\(place.theirName) sealed this one").font(.pxSmall).foregroundStyle(Color.muted)
                            }
                        }
                    }
                    .buttonStyle(.press)
                    if open == d.dateKey { RevealView(place: place, day: d, compact: true) }
                }
                .pxCard(shadow: false)
            }
            if !done {
                Button(loading ? "Finding them…" : "Show older letters") {
                    Task {
                        loading = true
                        let oldest = older.last?.dateKey ?? Day.add(place.today, -60)
                        let more = await place.olderLetters(before: oldest)
                        older = (older + more).sorted { $0.dateKey > $1.dateKey }
                        done = more.count < 30
                        loading = false
                    }
                }
                .buttonStyle(.px(.paper, small: true, wide: true))
                .disabled(loading)
            }
        }
    }
}

/* ---------- questions you ask each other ---------- */

struct AskPanel: View {
    let place: PlaceModel
    @State private var writing = false
    @State private var fresh: Set<String> = []

    var body: some View {
        let v = place.asksView
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top, spacing: 12) {
                    GlyphView(glyph: Icons.envelope, scale: 4)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Ask each other anything").font(.pxHeading).foregroundStyle(Color.inkSoft)
                        Text("Write a question for \(place.theirName) and answer it yourself. Your answer stays hidden until \(place.theirName) answers too.")
                            .font(.pxSmall).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
                    }
                }
                if writing {
                    AskComposer(place: place) { writing = false }
                } else {
                    Button("Ask \(place.theirName) something") { writing = true }.buttonStyle(.px(.sage, wide: true))
                }
            }
            .pxCard()

            if !v.forMe.isEmpty {
                Text("\(place.theirName) asked you").font(.pxHeading).foregroundStyle(Color.paper)
                ForEach(v.forMe) { a in AskForMe(place: place, a: a) }
            }
            if !v.waiting.isEmpty {
                Text("Waiting for \(place.theirName)").font(.pxHeading).foregroundStyle(Color.paper)
                ForEach(v.waiting) { a in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(a.prompt).font(.pxBodyBold).foregroundStyle(Color.inkSoft)
                            Text("Asked \(ago(a.at)) · your answer is sealed").font(.pxSmall).foregroundStyle(Color.muted)
                        }
                        Spacer()
                        Button("Take it back") { place.withdrawAsk(a) }.font(.px(13, 600)).foregroundStyle(Color.terracottaD).underline()
                    }
                    .pxCard(shadow: false)
                }
            }
            if !v.opened.isEmpty {
                Text("Answered").font(.pxHeading).foregroundStyle(Color.paper)
                ForEach(v.opened.prefix(20)) { a in opened(a, isNew: fresh.contains(a.id)) }
            }
            if v.forMe.isEmpty && v.waiting.isEmpty && v.opened.isEmpty && !writing {
                Text("Nothing asked yet. The best ones are small and specific: “What did you have for lunch on our first visit?”").font(.pxBody).foregroundStyle(Color.paper.opacity(0.75))
            }
        }
        .onAppear {
            fresh = Set(v.fresh.map(\.id))
            v.fresh.forEach { place.markAskSeen($0) }
        }
    }

    private func ago(_ ms: Double) -> String {
        Activity(id: "", type: "", title: "", description: "", at: Values.iso(Date(timeIntervalSince1970: ms / 1000))).ago(now: place.now).lowercased()
    }

    private func opened(_ a: Ask, isNew: Bool) -> some View {
        let them = place.them ?? ""
        let same = !a.options.isEmpty && a.answers[place.me]?.pick == a.answers[them]?.pick
        let asker = a.by == place.me
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                HeadView(look: asker ? place.myLook : (place.theirLook ?? Wardrobe.defaultB), size: 22)
                Text("\(asker ? "You asked" : "\(place.theirName) asked") · \(ago(a.at))").font(.pxSmall).foregroundStyle(Color.muted)
                if isNew { PixelTag(text: "New") }
            }
            Text(a.prompt).font(.px(18, 700)).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
            if same {
                HStack(spacing: 6) {
                    HeadView(look: place.myLook, size: 24)
                    HeadView(look: place.theirLook ?? Wardrobe.defaultB, size: 24)
                    Text("Both: \(a.said(a.answers[place.me]))").font(.pxBodyBold).foregroundStyle(Color.inkSoft)
                    GlyphView(glyph: Icons.check, scale: 2)
                }
            } else {
                HStack(alignment: .top, spacing: 8) { HeadView(look: place.myLook, size: 24); Text(a.said(a.answers[place.me])).font(.pxBody).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true) }
                HStack(alignment: .top, spacing: 8) { HeadView(look: place.theirLook ?? Wardrobe.defaultB, size: 24); Text(a.said(a.answers[them])).font(.pxBody).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true) }
            }
        }
        .pxCard(shadow: false)
    }
}

/// pick one, or write it
struct AskAnswerInput: View {
    var options: [String]
    @Binding var pick: Int?
    @Binding var text: String
    var placeholder = "In your own words"

    var body: some View {
        if options.isEmpty {
            PixelField(placeholder: placeholder, text: $text, limit: ASK_ANSWER_MAX, lines: 3)
        } else {
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                ForEach(Array(options.enumerated()), id: \.offset) { i, o in
                    Button(o) {
                        Haptics.tap()
                        pick = i
                    }
                    .buttonStyle(OptionStyle(selected: pick == i))
                }
            }
        }
    }
}

struct AskForMe: View {
    let place: PlaceModel
    let a: Ask
    @State private var pick: Int?
    @State private var text = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(a.prompt).font(.px(20, 700)).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
            AskAnswerInput(options: a.options, pick: $pick, text: $text)
            Button("Answer and open it") {
                place.answerAsk(a, a.options.isEmpty ? AskAnswer(text: text.trimmingCharacters(in: .whitespacesAndNewlines)) : AskAnswer(pick: pick))
                Haptics.success()
            }
            .buttonStyle(.px(.terracotta, small: true, wide: true))
            .disabled(a.options.isEmpty ? text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty : pick == nil)
            Text("\(place.theirName) has answered already, so you’ll both see it straight away.").font(.pxTiny).foregroundStyle(Color.muted)
        }
        .pxCard()
    }
}

struct AskComposer: View {
    let place: PlaceModel
    var done: () -> Void
    @State private var prompt = ""
    @State private var withOptions = false
    @State private var options = ["", ""]
    @State private var pick: Int?
    @State private var text = ""

    private var filled: [String] { options.map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty } }
    private var ready: Bool {
        !prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && (!withOptions || filled.count >= 2)
            && (withOptions ? (pick ?? 99) < filled.count : !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                PixelLabel(text: "Your question for \(place.theirName)")
                Spacer()
                Button("Need an idea?") {
                    let pool = askIdeas().filter { $0 != prompt }
                    if let p = pool.randomElement() { prompt = p }
                    withOptions = false
                    pick = nil
                }
                .font(.px(13, 600)).foregroundStyle(Color.terracottaD).underline()
            }
            PixelField(placeholder: "Anything at all. What do you want to know?", text: $prompt, limit: ASK_PROMPT_MAX, lines: 2)
            PixelLabel(text: "How they answer")
            HStack(spacing: 8) {
                Button("In their own words") { withOptions = false; pick = nil }.buttonStyle(.px(withOptions ? .paper : .terracotta, small: true, wide: true))
                Button("Pick from answers") { withOptions = true; pick = nil }.buttonStyle(.px(withOptions ? .terracotta : .paper, small: true, wide: true))
            }.evenRow()
            if withOptions {
                ForEach(options.indices, id: \.self) { i in
                    HStack(spacing: 8) {
                        PixelField(placeholder: "Answer \(i + 1)", text: Binding(get: { i < options.count ? options[i] : "" }, set: { v in
                            if i < options.count { options[i] = v }
                            pick = nil
                        }), limit: ASK_OPTION_MAX)
                        if options.count > 2 {
                            Button("Remove") {
                                options.remove(at: i)
                                pick = nil
                            }
                            .font(.px(13, 600)).foregroundStyle(Color.terracottaD)
                        }
                    }
                }
                if options.count < 4 {
                    Button("+ Add an answer") { options.append("") }.font(.px(14, 600)).foregroundStyle(Color.terracottaD)
                }
            }
            if !withOptions || filled.count >= 2 {
                PixelLabel(text: "Your answer (hidden until \(place.theirName) answers)")
                AskAnswerInput(options: withOptions ? filled : [], pick: $pick, text: $text, placeholder: "Answer it yourself too")
            }
            HStack {
                Button {
                    place.ask(prompt, options: withOptions ? filled : [], mine: withOptions ? AskAnswer(pick: pick) : AskAnswer(text: text.trimmingCharacters(in: .whitespacesAndNewlines)))
                    Haptics.success()
                    done()
                } label: {
                    HStack(spacing: 6) {
                        GlyphView(glyph: Icons.envelope, scale: 2)
                        Text("Send it to \(place.theirName)")
                    }
                }
                .buttonStyle(.px(.terracotta, small: true, wide: true))
                .disabled(!ready)
                Button("Cancel", action: done).buttonStyle(.px(.paper, small: true))
            }
        }
        .padding(12)
        .pxInset()
    }
}
