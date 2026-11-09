import SwiftUI
import SoultiedCore

/*
 * The first time you open your place: a short tour of what to tap to go where. The screen dims, a window
 * opens over one thing at a time (you on the couch, your person, the wall, today's letter, the record
 * player, then the tabs along the bottom), with a line about what it does. Once per phone; Skip ends it,
 * and Us > Show me around again brings it back.
 */

/// where things are on screen, for the tour ("spot.left", "spot.board", "tab.watch"...)
struct TourSpots: PreferenceKey {
    static let defaultValue: [String: Anchor<CGRect>] = [:]
    static func reduce(value: inout [String: Anchor<CGRect>], nextValue: () -> [String: Anchor<CGRect>]) {
        value.merge(nextValue()) { $1 }
    }
}

struct TourStep {
    /// what to point at (a key in TourSpots)
    let spot: String
    let title: String
    let text: String
}

@Observable
final class Tour {
    static let shared = Tour()

    private(set) var active = false
    private(set) var step = 0

    private static let doneKey = "soultied_tour_done"

    private init() {}

    /// the first time this phone opens a place (or the screenshots ask for a step), start the tour
    func offer(place: PlaceModel) {
        if let n = Launch.tour {
            if !active {
                step = max(0, n)
                active = true
            }
            return
        }
        guard !active, place.ready, !place.isDemo, !UserDefaults.standard.bool(forKey: Self.doneKey) else { return }
        step = 0
        active = true
    }

    /// Us > Show me around again
    func start() {
        step = 0
        active = true
    }

    func next(of count: Int) {
        if step + 1 < count { step += 1 } else { finish() }
    }

    func back() { step = max(0, step - 1) }

    func finish() {
        active = false
        UserDefaults.standard.set(true, forKey: Self.doneKey)
    }

    /// the tour, for this place: you, your person (or their empty seat), the room's things, then the tabs
    static func steps(_ place: PlaceModel) -> [TourStep] {
        let them = place.theirName
        let mine = place.mySeat == .a ? "spot.left" : "spot.right"
        let theirs = place.mySeat == .a ? "spot.right" : "spot.left"
        var s = [
            TourStep(spot: mine, title: "This is you", text: "Tap yourself to say how you’re feeling. It shows over your head, for \(them) to see."),
        ]
        if place.partnerHere {
            s.append(TourStep(spot: theirs, title: "And this is \(them)", text: "Tap \(them) to send a hug, a kiss or a high five. Every day you both show up, you scoot a little closer on the couch."))
        } else {
            s.append(TourStep(spot: theirs, title: "\(them)’s seat", text: "It’s saved for \(them). Tap it to send the invite, so they can come and sit next to you."))
        }
        s += [
            TourStep(spot: "spot.board", title: "Your wall", text: "The pictures over the couch are your wall: notes, doodles, photos and memories you leave each other."),
            TourStep(spot: "spot.pet", title: "Your pet", text: "Asleep on its cushion by the couch. Tap it to choose who sleeps there: a cat, a bunny, a pug or a corgi."),
            TourStep(spot: "spot.letter", title: "Today’s letter", text: "Five little questions a day. Answer in secret; the letter opens once you’ve both sealed it."),
            TourStep(spot: "spot.music", title: "The record player", text: "Put a record on, or a song from YouTube, and it plays for both of you, in sync."),
            TourStep(spot: "tab.watch", title: "Watch together", text: "Put on YouTube, Netflix or Prime Video and it plays for both of you, in sync, with a chat and the two of you on the couch."),
            TourStep(spot: "tab.play", title: "Play", text: "Games for two, and the escape rooms behind the dark door."),
            TourStep(spot: "tab.letters", title: "Letters", text: "Today’s letter, your 30-day journey, and the questions you ask each other."),
            TourStep(spot: "tab.us", title: "Us", text: "Your place, the invite, your look and your account. You can take this tour again from here."),
        ]
        return s
    }
}

/// the dimmed screen with a window over one thing, and a card saying what it is
struct TourOverlay: View {
    let tour: Tour
    let place: PlaceModel
    let spots: [String: Anchor<CGRect>]

    var body: some View {
        GeometryReader { proxy in
            let steps = Tour.steps(place)
            let i = min(tour.step, steps.count - 1)
            let st = steps[i]
            // (kept on screen: the record player sits at the room's edge)
            let r = spots[st.spot].map {
                proxy[$0].insetBy(dx: -6, dy: -6).intersection(CGRect(origin: .zero, size: proxy.size).insetBy(dx: 3, dy: 3))
            }.flatMap { $0.isNull || $0.isEmpty ? nil : $0 }
            ZStack(alignment: .topLeading) {
                // the dim, with a window cut out over the thing
                Path { p in
                    p.addRect(CGRect(origin: .zero, size: proxy.size).insetBy(dx: -400, dy: -400))
                    if let r { p.addRect(r) }
                }
                .fill(Color.black.opacity(0.64), style: FillStyle(eoFill: true))
                .contentShape(Rectangle())
                .onTapGesture {}

                if let r {
                    Rectangle()
                        .stroke(Color.butter, lineWidth: 3)
                        .frame(width: r.width, height: r.height)
                        .offset(x: r.minX, y: r.minY)
                        .allowsHitTesting(false)
                }

                card(st, i, steps.count)
                    .frame(width: min(proxy.size.width - 32, 380))
                    .position(x: proxy.size.width / 2, y: cardY(r, proxy.size))
                    .animation(.easeOut(duration: 0.2), value: i)
            }
        }
        .transition(.opacity)
        .accessibilityAddTraits(.isModal)
    }

    /// above the thing when it's low on the screen, below it otherwise
    private func cardY(_ r: CGRect?, _ size: CGSize) -> CGFloat {
        let half: CGFloat = 105
        guard let r else { return size.height / 2 }
        let y = r.midY > size.height * 0.55 ? r.minY - half - 18 : r.maxY + half + 18
        return min(max(y, half + 50), size.height - half - 30)
    }

    private func card(_ st: TourStep, _ i: Int, _ count: Int) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                PixelTag(text: "\(i + 1) of \(count)")
                Spacer()
                Button("Skip") {
                    Haptics.tap()
                    withAnimation { tour.finish() }
                }
                .font(.px(14, 600))
                .foregroundStyle(Color.muted)
            }
            Text(st.title).font(.pxHeading).foregroundStyle(Color.inkSoft)
            Text(st.text).font(.pxBody).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 8) {
                if i > 0 {
                    Button("Back") {
                        Haptics.tap()
                        tour.back()
                    }
                    .buttonStyle(.px(.paper, small: true))
                }
                Spacer()
                Button(i + 1 < count ? "Next →" : "Let’s go") {
                    Haptics.tap()
                    withAnimation { tour.next(of: count) }
                }
                .buttonStyle(.px(.terracotta, small: true))
            }
        }
        .padding(16)
        .pxBox(.paper, shadow: true)
    }
}
