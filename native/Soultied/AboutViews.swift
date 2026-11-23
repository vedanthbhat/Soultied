import SwiftUI
import StoreKit
import SoultiedCore

/*
 * About the two of you, kept in meta/about. The first time you're in your place: how far apart you are, and the
 * next time you'll see each other (it starts the countdown), then Soultied Plus to try. The other questions (how
 * often, what you miss, when you have time) come one a day on Home, each a tap.
 */

private struct AboutAnswer: Identifiable {
    let id: String
    let label: String
}

private struct AboutQuestion {
    let id: String
    let ask: (String) -> String
    let answers: [AboutAnswer]
}

private func ans(_ pairs: [(String, String)]) -> [AboutAnswer] { pairs.map { AboutAnswer(id: $0.0, label: $0.1) } }

private let ABOUT: [AboutQuestion] = [
    AboutQuestion(id: "far", ask: { _ in "How far apart are you?" }, answers: ans([
        ("together", "We live together"), ("city", "Same city, different places"), ("hours", "A few hours away"), ("country", "Different countries"), ("zones", "Different time zones"),
    ])),
    AboutQuestion(id: "often", ask: { _ in "How often do you get to see each other?" }, answers: ans([
        ("weeks", "Most weeks"), ("month", "Every month or so"), ("months", "Every few months"), ("unsure", "We’re not sure yet"),
    ])),
    AboutQuestion(id: "miss", ask: { n in "What do you miss most about being with \(n)?" }, answers: ans([
        ("talk", "Talking for hours"), ("touch", "The little touches"), ("watch", "Watching things together"), ("nothing", "Doing nothing together"),
    ])),
    AboutQuestion(id: "when", ask: { _ in "When do you usually have time for each other?" }, answers: ans([
        ("morning", "Mornings"), ("day", "Breaks in the day"), ("evening", "Evenings"), ("late", "Late at night"),
    ])),
]

/// what in Soultied fits what they miss most
private func fits(_ miss: String?, _ name: String) -> (title: String, line: String) {
    switch miss {
    case "touch": return ("Send a touch, or hold the couch", "A hug, a kiss or a boop buzzes in \(name)’s pocket. Hold the couch together and you’ll feel each other’s heartbeat.")
    case "watch": return ("Watch together", "The TV in your room plays YouTube, Netflix and Prime Video in sync, with your chat and reactions over it.")
    case "nothing": return ("Just be in the room", "Your little place is always there: the fire, the record player, the two of you on the couch. Open it and they’ll see you’re here.")
    default: return ("Today’s letter", "Five little questions a day, answered in secret and opened together. They’re what you’ll end up talking about for hours.")
    }
}

/// onboarding's third step: how far apart you are (it sets what your place counts down to), with the next time
/// you'll see each other right under your answer; then Soultied Plus to try. The other questions come later, one a
/// day, on Home (QuickAskCard).
struct AboutSheet: View {
    let place: PlaceModel
    var done: () -> Void
    @State private var far: String? = Launch.args.contains("-aboutPlus") ? "country" : nil
    @State private var visit = Calendar.current.date(byAdding: .day, value: 21, to: Date()) ?? Date()
    /// a day was picked (rather than left as it started)
    @State private var picked = false
    /// (-aboutPlus: the screenshots, straight to Plus)
    @State private var atPlus = Launch.args.contains("-aboutPlus")

    private static let hints: [String: String] = [
        "together": "Plan your next date night",
        "city": "Count down to your next date",
        "hours": "Count down to your next visit",
        "country": "A countdown, and both your times",
        "zones": "Always know what time it is for them",
    ]

    private static let glyphs: [String: Glyph] = [
        "together": Icons.home,
        "city": Glyph(["......bbb", "bbb...byb", "byb...bbb", "bbb...byb", "byb.b.bbb", "bbbbbbbyb", "bbbbbbbbb"], ["b": "#5a79a3", "y": "#f2d48a"]),
        "hours": Glyph(["..rrrr....", ".rwwrr....", "rrrrrrrrr.", "rrrrrrrrrr", ".kk....kk."], ["r": "#b8674f", "w": "#cfe3f2", "k": "#2b1e1c"]),
        "country": Glyph(["..bbbb..", ".bgbbgb.", "bggbbggb", "bbbbbbbb", "bggbbggb", ".bgbbgb.", "..bbbb.."], ["b": "#5a79a3", "g": "#8a9a72"]),
        "zones": Glyph(["..kkkk..", ".k....k.", "k...k..k", "k...k..k", "k...kk.k", "k......k", ".k....k.", "..kkkk.."], ["k": "#3a2a26"]),
    ]

    var body: some View {
        if atPlus && (!place.hasPlus || Launch.args.contains("-aboutPlus")) {
            PlusSheet(place: place, onboardingLine: plusLine, continueOnboarding: done)
        } else {
            howFar
        }
    }

    private var nearby: Bool { far == "city" || far == "together" }

    private var howFar: some View {
        VStack(alignment: .leading, spacing: 14) {
            Dots(n: 3, of: 4)
            VStack(alignment: .leading, spacing: 4) {
                Text("How far apart are you two?").font(.pxTitle).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
                Text("It sets what your place counts down to.").font(.pxBody).foregroundStyle(Color.muted)
            }
            // (the answers share the screen between them, so there's no empty half)
            VStack(spacing: 10) {
                ForEach(ABOUT[0].answers) { a in
                    tile(a)
                    if far == a.id { nextTime }
                }
            }
            .frame(maxHeight: .infinity, alignment: .top)
            Button("Next") { next() }
                .buttonStyle(.px(.terracotta, wide: true))
                .disabled(far == nil)
        }
        .padding(20)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color.paper.ignoresSafeArea())
        .animation(.easeOut(duration: 0.2), value: far)
        // a day already set (by your person) starts the picker there
        .onAppear { if place.visitDays != nil, let d = localDate(place.visit.date) { visit = d } }
    }

    private func tile(_ a: AboutAnswer) -> some View {
        let on = far == a.id
        return Button {
            Haptics.select()
            far = a.id
        } label: {
            HStack(spacing: 12) {
                GlyphView(glyph: Self.glyphs[a.id] ?? Icons.heart, scale: 2)
                    .frame(width: 44, height: 44)
                    .background(Color.paperHi)
                    .overlay(Rectangle().strokeBorder(Color.ink, lineWidth: 3))
                VStack(alignment: .leading, spacing: 2) {
                    Text(a.label).font(.px(17, 700)).foregroundStyle(Color.inkSoft).lineLimit(1).minimumScaleFactor(0.8)
                    Text(Self.hints[a.id] ?? "").font(.px(12, 500)).foregroundStyle(on ? Color.sageD : Color.muted)
                }
                Spacer(minLength: 0)
                if on { GlyphView(glyph: Icons.check, scale: 2) }
            }
            .padding(.horizontal, 14)
            .frame(maxWidth: .infinity, minHeight: 56, maxHeight: .infinity, alignment: .leading)
            .background(on ? Color(hex: "#e6edd9") : Color.paperHi)
            .overlay(Rectangle().strokeBorder(on ? Color.sageD : Color.ink, lineWidth: 3))
        }
        .buttonStyle(.press)
        .accessibilityAddTraits(on ? .isSelected : [])
    }

    /// the next time you'll see each other (it starts the countdown), under the answer
    private var nextTime: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(nearby ? "When’s your next date?" : "When do you see \(place.theirName) next?").font(.pxBodyBold).foregroundStyle(Color.inkSoft)
            HStack(spacing: 10) {
                DatePicker("The day", selection: Binding(get: { visit }, set: { visit = $0; picked = true }),
                           in: Calendar.current.startOfDay(for: Date())..., displayedComponents: .date)
                    .labelsHidden()
                    .tint(Color.terracotta)
                Text(picked ? "You’ll both count down to it."
                     : place.visitDays != nil ? "There’s a day set already. Keep it, or pick another."
                     : "Not sure yet? Skip it, and set it later in Us.")
                    .font(.pxTiny).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pxInset()
    }

    private func next() {
        guard let far else { return }
        if picked {
            // (the same day they set keeps what it's for)
            let day = Day.today(visit)
            place.setVisit(date: day, what: day == place.visit.date ? place.visit.what : "")
        }
        place.saveAbout(["far": far, "next": picked || place.visitDays != nil ? "set" : "unknown"])
        // (the rest of the questions start on Home tomorrow)
        UserDefaults.standard.set(Day.today(Date()), forKey: QuickAskCard.dayKey)
        Haptics.select()
        if place.hasPlus { done() } else { withAnimation(.easeOut(duration: 0.25)) { atPlus = true } }
    }

    private var plusLine: String {
        switch far {
        case "together": return "You said you live together. Plus is made for your nights in."
        case "city": return "You said you’re in the same city. Plus makes the nights apart feel shorter."
        case "hours": return "You said you’re a few hours apart. Plus is made for the nights in between."
        case "zones": return "You said you’re in different time zones. Plus is made for nights like yours."
        default: return "You said you’re in different countries. Plus is made for nights like yours."
        }
    }
}

/// on Home, over your first days: one more quick question about the two of you each day, each a tap (the ones
/// onboarding leaves out: how often you see each other, what you miss most, when you have time)
struct QuickAskCard: View {
    let place: PlaceModel
    static let dayKey = "soultied_quick_day"
    @AppStorage(QuickAskCard.dayKey) private var lastDay = ""

    private var next: AboutQuestion? {
        guard !place.isDemo, let mine = place.aboutMine, lastDay != Day.today(Date()) else { return nil }
        return ABOUT.dropFirst().first { mine[$0.id] == nil }
    }

    private var nearby: Bool { ["city", "together"].contains(place.aboutMine?["far"] ?? "") }

    private func prompt(_ q: AboutQuestion) -> String {
        if nearby && q.id == "often" { return "How often do you make time for a date?" }
        if nearby && q.id == "miss" { return "What do you love doing together?" }
        return q.ask(place.theirName)
    }

    var body: some View {
        if let q = next {
            VStack(alignment: .leading, spacing: 10) {
                Text("A QUICK ONE").font(.px(11, 700)).kerning(1.5).foregroundStyle(Color.terracottaD)
                Text(prompt(q)).font(.pxHeading).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
                    ForEach(q.answers) { a in
                        Button {
                            Haptics.select()
                            place.saveAbout([q.id: a.id])
                            lastDay = Day.today(Date())
                        } label: {
                            Text(a.label).font(.px(14, 700)).foregroundStyle(Color.inkSoft)
                                .multilineTextAlignment(.leading)
                                .padding(.horizontal, 10)
                                .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
                                .background(Color.paperHi)
                                .overlay(Rectangle().strokeBorder(Color.ink, lineWidth: 2))
                        }
                        .buttonStyle(.press)
                    }
                }
                Text("It helps Soultied suggest what suits the two of you.").font(.pxTiny).foregroundStyle(Color.muted)
            }
            .pxCard()
        }
    }
}

/// before your person's here: their seat comes first on Home
struct SeatCard: View {
    let place: PlaceModel
    var invite: () -> Void

    var body: some View {
        let them = place.theirName == "my person" ? "your person" : place.theirName
        VStack(alignment: .leading, spacing: 10) {
            Text("YOUR PLACE IS READY").font(.px(11, 700)).kerning(1.5).foregroundStyle(Color.terracottaD)
            Text("Save \(them)’s seat").font(.pxTitle).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
            Text("Send \(them) the invite. The room comes alive when you’re both on the couch.")
                .font(.pxBody).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
            Button("Invite \(them)") { invite() }.buttonStyle(.px(.terracotta, wide: true))
            Text("Things that glow in the room are worth a tap.").font(.pxTiny).foregroundStyle(Color.muted)
        }
        .pxCard()
    }
}

/// the room's first days: a soft glow on the letter, the record player and the pet, until each has been opened
/// (instead of a long tour at the start; Us › Show me around still has the tour)
struct RoomHints: View {
    let spots: [String: Anchor<CGRect>]
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var glow = false

    private static let spotsShown = ["spot.letter", "spot.music", "spot.pet"]
    private static func key(_ spot: String) -> String { "soultied_hint_\(spot)" }

    /// not for people who took the old tour
    static var wanted: Bool { !UserDefaults.standard.bool(forKey: "soultied_tour_done") }

    /// a tap on something in the room: its glow goes out
    static func visited(_ id: HotspotId) {
        switch id {
        case .letter: UserDefaults.standard.set(true, forKey: key("spot.letter"))
        case .music: UserDefaults.standard.set(true, forKey: key("spot.music"))
        case .pet: UserDefaults.standard.set(true, forKey: key("spot.pet"))
        default: break
        }
    }

    var body: some View {
        GeometryReader { proxy in
            ForEach(Self.spotsShown.filter { !UserDefaults.standard.bool(forKey: Self.key($0)) }, id: \.self) { spot in
                if let anchor = spots[spot] {
                    let r = proxy[anchor]
                    Rectangle()
                        .strokeBorder(Color.butter, lineWidth: 3)
                        .frame(width: r.width + 8, height: r.height + 8)
                        .shadow(color: Color.butter.opacity(0.9), radius: glow ? 8 : 2)
                        .opacity(glow ? 1 : 0.45)
                        .position(x: r.midX, y: r.midY)
                }
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .onAppear {
            if reduceMotion { glow = true } else {
                withAnimation(.easeInOut(duration: 1.1).repeatForever(autoreverses: true)) { glow = true }
            }
        }
    }
}

/// asks how far apart you are (then Plus) once, as soon as you're in your place, and asks for a rating at a good moment
struct AboutRule: ViewModifier {
    let place: PlaceModel
    let tourActive: Bool
    @State private var asking = false
    @AppStorage("soultied_review_asked") private var reviewAsked = false
    @Environment(\.requestReview) private var requestReview

    private var key: String { "soultied_about_\(place.sid)" }

    func body(content: Content) -> some View {
        content
            .fullScreenCover(isPresented: $asking) {
                AboutSheet(place: place) {
                    UserDefaults.standard.set(true, forKey: key)
                    asking = false
                }
            }
            .onAppear { offer(delay: 0.5) }
            .onChange(of: place.ready) { _, _ in offer(delay: 0.5) }
            .onChange(of: place.loaded.contains("about")) { _, _ in offer(delay: 0.5) }
            .onChange(of: tourActive) { _, on in if !on { offer(delay: 0.8) } }
            // a good moment for a rating: you've both shown up today, and the fire's burning steady
            .onChange(of: place.togetherToday) { _, on in
                guard on, !reviewAsked, !place.isDemo, place.fire.level >= 2 else { return }
                DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                    reviewAsked = true
                    requestReview()
                }
            }
    }

    private func offer(delay: Double) {
        if Launch.args.contains("-about") {
            if !asking { asking = true }
            return
        }
        guard place.ready, !place.isDemo, !tourActive, place.loaded.contains("about"), place.aboutMine == nil,
              !UserDefaults.standard.bool(forKey: key), !asking else { return }
        // joining your person: they've answered already, so you go straight to the couch (with their answer)
        if let them = place.them, let far = place.aboutDoc[them]?["far"], !far.isEmpty {
            place.saveAbout(["far": far])
            UserDefaults.standard.set(true, forKey: key)
            UserDefaults.standard.set(Day.today(Date()), forKey: QuickAskCard.dayKey)
            return
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
            guard !tourActive, place.aboutMine == nil, !UserDefaults.standard.bool(forKey: key) else { return }
            asking = true
        }
    }
}
