import SwiftUI
import StoreKit
import SoultiedCore

/*
 * About the two of you: five quick questions the first time you're in your place (after the tour), each a tap
 * (and one a date: the next time you'll see each other, which starts the countdown). Then what in Soultied fits
 * what you said, and Soultied Plus to try. Kept in meta/about.
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
        ("city", "Same city, different places"), ("hours", "A few hours away"), ("country", "Different countries"), ("zones", "Different time zones"),
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

struct AboutSheet: View {
    let place: PlaceModel
    var done: () -> Void
    @State private var step = 0
    @State private var answers: [String: String] = [:]
    @State private var visit = Calendar.current.date(byAdding: .day, value: 21, to: Date()) ?? Date()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Dots(n: min(step + 1, ABOUT.count + 1), of: ABOUT.count + 1)
                if step < 2 {
                    question(ABOUT[step])
                } else if step == 2 {
                    nextTime
                } else if step < ABOUT.count + 1 {
                    question(ABOUT[step - 1])
                } else {
                    summary
                }
            }
            .pxCard()
            .padding(16)
            .padding(.top, 24)
        }
        .background(RoomBackground())
        .animation(.easeOut(duration: 0.2), value: step)
        // a day already set (by your person) starts the picker there
        .onAppear { if place.visitDays != nil, let d = localDate(place.visit.date) { visit = d } }
    }

    private func question(_ q: AboutQuestion) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("ABOUT THE TWO OF YOU").font(.px(12, 600)).kerning(1.6).foregroundStyle(Color.terracottaD)
            Text(q.ask(place.theirName)).font(.pxTitle).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
            ForEach(q.answers) { a in
                Button {
                    answers[q.id] = a.id
                    Haptics.select()
                    step += 1
                } label: {
                    Text(a.label).frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.px(answers[q.id] == a.id ? .sage : .paper, wide: true))
            }
            if step > 0 { Button("Back") { step -= 1 }.buttonStyle(.px(.paper, small: true)) }
        }
    }

    /// the third question: the next time you'll see each other (it starts the countdown)
    private var nextTime: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("ABOUT THE TWO OF YOU").font(.px(12, 600)).kerning(1.6).foregroundStyle(Color.terracottaD)
            Text("When will you see \(place.theirName) next?").font(.pxTitle).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
            Text(place.visitDays != nil
                 ? "There’s already a day set. Keep it, or pick another."
                 : "You’ll both count down to it, in Soultied and on your widgets.")
                .font(.pxBody).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
            DatePicker("The day", selection: $visit, in: Calendar.current.startOfDay(for: Date())..., displayedComponents: .date)
                .datePickerStyle(.graphical)
                .tint(Color.terracotta)
                .padding(8)
                .background(Color.paperInput)
            Button("That’s the day →") {
                answers["next"] = "set"
                // (the same day they set keeps what it's for)
                let day = Day.today(visit)
                place.setVisit(date: day, what: day == place.visit.date ? place.visit.what : "")
                Haptics.select()
                step += 1
            }
            .buttonStyle(.px(.terracotta, wide: true))
            Button("We don’t know yet") {
                answers["next"] = "unknown"
                step += 1
            }
            .buttonStyle(.px(.paper, wide: true))
            Button("Back") { step -= 1 }.buttonStyle(.px(.paper, small: true))
        }
    }

    /// what fits what you said, and Plus to try
    private var summary: some View {
        let fit = fits(answers["miss"], place.theirName)
        return VStack(alignment: .leading, spacing: 14) {
            Text("THANK YOU").font(.px(12, 600)).kerning(1.6).foregroundStyle(Color.terracottaD)
            Text("Your place is ready for the two of you.").font(.pxTitle).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
            VStack(alignment: .leading, spacing: 6) {
                Text("Start with: \(fit.title)").font(.pxBodyBold).foregroundStyle(Color.inkSoft)
                Text(fit.line).font(.pxBody).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .pxInset()
            if let d = place.visitDays {
                Text(d > 1 ? "And \(d) days till you’re together. The countdown’s on your Home." : "And you’re together very soon. The countdown’s on your Home.")
                    .font(.pxBody).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
            }
            if !place.hasPlus {
                Button("Try Soultied Plus free →") {
                    finish()
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { PlusGate.shared.show(.plain) }
                }
                .buttonStyle(.px(.terracotta, wide: true))
                Text("Every movie night, game and escape room, for both of you. One of you having it covers you both.")
                    .font(.pxSmall).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
            }
            Button(place.hasPlus ? "Into the room →" : "Maybe later") { finish() }.buttonStyle(.px(.paper, wide: true))
        }
    }

    private func finish() {
        place.saveAbout(answers)
        done()
    }
}

/// asks the five questions once (after the tour), and asks for a rating at a good moment
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
            .onAppear { offer(delay: 1.2) }
            .onChange(of: place.ready) { _, _ in offer(delay: 1.2) }
            .onChange(of: place.loaded.contains("about")) { _, _ in offer(delay: 1.2) }
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
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
            guard !tourActive, place.aboutMine == nil, !UserDefaults.standard.bool(forKey: key) else { return }
            asking = true
        }
    }
}
