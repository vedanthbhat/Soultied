import SwiftUI
import SoultiedCore

/*
 * The pet you both raise (the website's PetCard.tsx): a sheet that opens from the pet's cushion in the room (feed
 * it, play with it, give it a cuddle, once each a day each, how close it's grown to you two, and the last week),
 * and a card on Home with the same three things to tap.
 */

private extension PetAct {
    var glyph: Glyph {
        switch self {
        case .feed: return Icons.bowl
        case .play: return Icons.ball
        case .cuddle: return Icons.blanket
        }
    }
}

private func clock(_ ms: Double) -> String {
    let f = DateFormatter()
    f.timeStyle = .short
    f.dateStyle = .none
    return f.string(from: Date(timeIntervalSince1970: ms / 1000))
}

/// the pet on its cushion, close up and moving (the room's own pixels, so it's exactly what's in the room)
struct PetPortrait: View {
    let place: PlaceModel
    var scale: CGFloat = 3
    @Environment(\.accessibilityReduceMotion) private var reduce
    @State private var start = Date()

    var body: some View {
        let seats = place.seats
        let decor = place.decor
        let care = place.petView?.careState
        TimelineView(.animation(minimumInterval: 0.1, paused: reduce)) { ctx in
            let t = reduce ? 1.3 : ctx.date.timeIntervalSince(start) + 1.3
            PixelImage(image: Pixels.image(renderPetPortrait(seats.left, seats.right, decor, care, t)), scale: scale)
        }
        .frame(width: CGFloat(PET_PORTRAIT.w) * scale, height: CGFloat(PET_PORTRAIT.h) * scale)
        .padding(PX)
        .background(Color.ink)
        .accessibilityHidden(true)
    }
}

/// what it just did, after you looked after it (and a level up, if today made one)
private struct PetSaid: Equatable {
    var text: String
    var up: String?
    var n: Int
}

/// the three ways to look after it, side by side; each once a day
private struct CareButtons: View {
    let place: PlaceModel
    var compact = false
    var did: (PetAct) -> Void

    var body: some View {
        let v = place.petView ?? PetView()
        HStack(alignment: .top, spacing: 8) {
            ForEach(Array(PetAct.allCases.enumerated()), id: \.element) { i, a in
                let done = v.mine[a] != nil
                VStack(spacing: 4) {
                    Button {
                        did(a)
                    } label: {
                        VStack(spacing: 5) {
                            GlyphView(glyph: a.glyph, scale: compact ? 2.5 : 3)
                                .sway(lift: 2, tilt: 2, period: 2.4, phase: Double(i) * 0.33, active: !done && v.mood != .both)
                            Text(done ? "\(a.done) ✓" : a.label).font(.px(compact ? 14 : 16, 700)).lineLimit(1).minimumScaleFactor(0.7)
                        }
                    }
                    .buttonStyle(OptionStyle(selected: done))
                    .disabled(done)
                    .accessibilityLabel(done ? "\(a.done) today" : a.label)
                    if !compact {
                        VStack(spacing: 1) {
                            if let ms = v.mine[a] { Text("You · \(clock(ms))") }
                            if let ms = v.theirs[a] { Text("\(place.theirName) · \(clock(ms))") }
                            if v.mine[a] == nil && v.theirs[a] == nil { Text("not yet today") }
                        }
                        .font(.pxTiny).foregroundStyle(Color.muted).multilineTextAlignment(.center)
                    }
                }
                .frame(maxWidth: .infinity)
            }
        }
    }
}

/// how close it's grown: the level, the days, and a bar to the next
private struct PetBond: View {
    let v: PetView

    var body: some View {
        let lvl = Pet.levels[v.level]
        let next = v.level + 1 < Pet.levels.count ? Pet.levels[v.level + 1] : nil
        let into = next.map { Double(v.bond - lvl.at) / Double($0.at - lvl.at) } ?? 1
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 0) {
                Text(lvl.name).font(.pxBodyBold).foregroundStyle(Color.inkSoft)
                Text(" · \(v.bond) \(v.bond == 1 ? "day" : "days") together").font(.pxSmall).foregroundStyle(Color.muted)
            }
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Rectangle().fill(Color.paper2)
                    Rectangle().fill(Color.terracotta).frame(width: max(4, g.size.width * into))
                }
            }
            .frame(height: 8)
            .padding(PX)
            .background(Color.ink)
            .animation(.spring(response: 0.6, dampingFraction: 0.8), value: v.bond)
            Text(next.map { "\(v.toNext) more \(v.toNext == 1 ? "day" : "days") of you both coming by to \($0.name)" } ?? "As close as can be.")
                .font(.pxTiny).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// the last seven days: a heart when you both came by, a paw print when one of you did
private struct PetWeek: View {
    let v: PetView
    private static let letters = ["M", "T", "W", "T", "F", "S", "S"]

    var body: some View {
        HStack(spacing: 4) {
            ForEach(Array(v.week.enumerated()), id: \.offset) { i, d in
                VStack(spacing: 4) {
                    Group {
                        if d.both { GlyphView(glyph: Icons.heart, scale: 2.4).beat(i == 6, every: 2.2, amount: 0.1) }
                        else if d.me || d.them { GlyphView(glyph: Icons.paw, scale: 2.4) }
                        else { Rectangle().fill(Color.paper2).frame(width: 7, height: 7) }
                    }
                    .frame(height: 18)
                    Text(i == 6 ? "Today" : Self.letters[Day.weekday(d.day)]).font(i == 6 ? Font.px(11, 700) : Font.pxTiny).foregroundStyle(Color.muted)
                }
                .frame(maxWidth: .infinity)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(Day.pretty(d.day)): \(d.both ? "you both came by" : d.me || d.them ? "one of you came by" : "nobody came by")")
            }
        }
    }
}

struct PetSheet: View {
    let place: PlaceModel
    /// choose a different pet, or give it a name (the decor catalogue, open at the pet)
    var choose: () -> Void
    @State private var said: PetSaid?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let v = place.petView, let item = Catalogue.item(.pet, place.decor.pet) {
                    let name = place.petCallName
                    HStack(alignment: .top, spacing: 14) {
                        PetPortrait(place: place, scale: 3)
                            .overlay(alignment: .top) {
                                if let s = said { FloatingHeart().id(s.n) }
                            }
                        VStack(alignment: .leading, spacing: 3) {
                            Text(place.petName ?? "Your \(item.name.lowercased())").font(.pxTitle).foregroundStyle(Color.inkSoft).lineLimit(2).minimumScaleFactor(0.7)
                            Text(place.petName != nil ? "the \(item.name.lowercased())" : "still waiting for a name").font(.pxSmall).foregroundStyle(Color.muted)
                            PetBond(v: v).padding(.top, 6)
                        }
                    }
                    Group {
                        if let s = said {
                            (s.up.map { Text("\($0) ").bold() } ?? Text("")) + Text(s.text)
                        } else {
                            Text(Pet.line(v, name: name, theirName: place.partnerHere ? place.theirName : nil))
                        }
                    }
                    .font(.pxBody).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
                    .id(said?.n ?? 0)
                    .transition(.scale(scale: 0.94).combined(with: .opacity))
                    CareButtons(place: place) { a in care(a) }
                    PetWeek(v: v).padding(.top, 2)
                    HStack(spacing: 18) {
                        Button(place.petName.map { "Rename \($0)" } ?? "Give it a name", action: choose)
                        Button("Choose a different pet", action: choose)
                    }
                    .buttonStyle(.plain)
                    .font(.px(15, 700)).foregroundStyle(Color.terracottaD)
                } else {
                    Text("Nobody sleeps on the cushion yet").font(.pxTitle).foregroundStyle(Color.inkSoft)
                    Text("Choose a pet to curl up by the couch, and you can both look after it: feed it, play with it, give it a cuddle. The more days you both come by, the closer it grows to you.")
                        .font(.pxBody).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
                    Button("Choose a pet", action: choose).buttonStyle(.px(.terracotta, wide: true))
                }
            }
            .padding(18)
            .padding(.bottom, 24)
        }
    }

    private func care(_ a: PetAct) {
        guard let r = place.carePet(a) else { return }
        if r.levelUp != nil { Haptics.success() } else { Haptics.soft() }
        Chiptune.shared.room(.pet)
        withAnimation(.spring(response: 0.35, dampingFraction: 0.7)) {
            said = PetSaid(text: r.reaction, up: r.levelUp, n: (said?.n ?? 0) + 1)
        }
    }
}

/// a heart floating up out of the picture, once
private struct FloatingHeart: View {
    @State private var up = false
    @Environment(\.accessibilityReduceMotion) private var reduce

    var body: some View {
        GlyphView(glyph: Icons.heart, scale: 2.5)
            .offset(y: up ? -38 : 18)
            .scaleEffect(up ? 1.15 : 0.6)
            .opacity(up ? 0 : 1)
            .opacity(reduce ? 0 : 1)
            .onAppear { withAnimation(.easeOut(duration: 1.1)) { up = true } }
            .allowsHitTesting(false)
    }
}

/// the pet on Home: how it's doing, and the three things to do for it right there
struct PetHomeCard: View {
    let place: PlaceModel
    var open: () -> Void
    @State private var said: PetSaid?

    var body: some View {
        if let v = place.petView {
            let name = place.petCallName
            VStack(alignment: .leading, spacing: 12) {
                Button(action: open) {
                    HStack(alignment: .center, spacing: 12) {
                        PetPortrait(place: place, scale: 2)
                            .overlay(alignment: .top) {
                                if let s = said { FloatingHeart().id(s.n) }
                            }
                        VStack(alignment: .leading, spacing: 3) {
                            HStack(spacing: 6) {
                                Text(place.petName ?? "Your pet").font(.pxHeading).foregroundStyle(Color.inkSoft).lineLimit(1)
                                Text(Pet.levels[v.level].name.uppercased()).font(.px(10, 700)).kerning(1).foregroundStyle(Color.cream)
                                    .padding(.horizontal, 5).padding(.vertical, 2).background(Color.sageD)
                            }
                            Group {
                                if let s = said { Text(s.up ?? s.text) } else { Text(Pet.line(v, name: name, theirName: place.partnerHere ? place.theirName : nil)) }
                            }
                            .font(.pxSmall).foregroundStyle(v.mood == .waiting && said == nil ? Color.terracottaD : Color.muted)
                            .lineLimit(3).multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                        }
                        Spacer(minLength: 0)
                    }
                }
                .buttonStyle(.press)
                CareButtons(place: place, compact: true) { a in
                    guard let r = place.carePet(a) else { return }
                    if r.levelUp != nil { Haptics.success() } else { Haptics.soft() }
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.7)) {
                        said = PetSaid(text: r.reaction, up: r.levelUp, n: (said?.n ?? 0) + 1)
                    }
                }
            }
            .pxCard()
            .nudge(v.mood == .waiting, every: 5.5, angle: 1.2)
        }
    }
}
