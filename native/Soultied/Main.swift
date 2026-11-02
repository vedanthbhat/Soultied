import SwiftUI
import SoultiedCore

enum AppTab: String, CaseIterable, Identifiable {
    case home, letters, wall, play, us
    var id: String { rawValue }
    var label: String {
        switch self {
        case .home: return "Home"
        case .letters: return "Letters"
        case .wall: return "Wall"
        case .play: return "Play"
        case .us: return "Us"
        }
    }
    var glyph: Glyph {
        switch self {
        case .home: return Icons.home
        case .letters: return Icons.envelope
        case .wall: return Icons.pin
        case .play: return Icons.play
        case .us: return Icons.us
        }
    }
}

/// what the room can open as a sheet (sideways, or from a tap on the couch)
enum RoomSheet: String, Identifiable {
    case me, them, letters, wall, decor, play, us
    var id: String { rawValue }
}

struct MainView: View {
    let app: AppModel
    let place: PlaceModel
    @State private var tab: AppTab = AppTab(rawValue: Launch.tab ?? "") ?? .home
    @State private var sheet: RoomSheet? = Launch.sheet.flatMap { RoomSheet(rawValue: $0) }
    @State private var lettersStart: LettersTab = .today
    @Environment(\.verticalSizeClass) private var vertical

    private var sideways: Bool { vertical == .compact }

    var body: some View {
        ZStack(alignment: .bottom) {
            if sideways {
                RoomScene(place: place, couchOnly: false) { open($0, sheet: true) }
                    .ignoresSafeArea()
            } else {
                VStack(spacing: 0) {
                    ZStack {
                        HomeView(place: place, paused: tab != .home || sheet != nil, go: go, onRoom: { open($0, sheet: false) })
                            .opacity(tab == .home ? 1 : 0)
                            .allowsHitTesting(tab == .home)
                        if tab == .letters { LettersView(place: place, start: lettersStart) }
                        if tab == .wall { WallView(place: place) }
                        if tab == .play { PlayView(place: place) }
                        if tab == .us { UsView(app: app, place: place) }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    TabBar(tab: $tab, place: place)
                }
            }
            Toasts(place: place, onLetter: { go(.letters) })
                .padding(.bottom, sideways ? 12 : 84)
        }
        .sheet(item: $sheet) { s in
            sheetView(s)
                .presentationDragIndicator(.visible)
                .presentationBackground(Color.paper)
        }
    }

    func go(_ t: AppTab) {
        Haptics.tap()
        withAnimation(.easeOut(duration: 0.15)) { tab = t }
    }

    /// a tap in the room
    func open(_ id: HotspotId, sheet asSheet: Bool) {
        func show(_ s: RoomSheet, _ t: AppTab) {
            if asSheet { sheet = s } else { go(t) }
        }
        switch id {
        case .left, .right:
            let who: String? = id == .left ? place.hostId : place.guestId
            guard let uid = who else {
                show(.us, .us)
                return
            }
            Haptics.tap()
            sheet = uid == place.me ? .me : .them
        case .letter: show(.letters, .letters)
        case .board: show(.wall, .wall)
        case .decor: sheet = .decor
        case .photo: show(.us, .us)
        case .games, .remote, .door: show(.play, .play)
        case .fire, .music: break
        }
    }

    @ViewBuilder
    func sheetView(_ s: RoomSheet) -> some View {
        switch s {
        case .me: MeSheet(place: place, onLook: { sheet = nil; go(.us) }).presentationDetents([.medium, .large])
        case .them: ThemSheet(place: place).presentationDetents([.height(360), .medium])
        case .letters: LettersView(place: place, start: .today)
        case .wall: WallView(place: place)
        case .decor: DecorView(place: place)
        case .play: PlayView(place: place)
        case .us: UsView(app: app, place: place)
        }
    }
}

/* ---------- the tab bar ---------- */

struct TabBar: View {
    @Binding var tab: AppTab
    let place: PlaceModel

    private func dot(_ t: AppTab) -> Bool {
        switch t {
        case .letters: return place.partnerHere && (place.letterWaiting || !place.asksView.forMe.isEmpty)
        case .wall: return place.wallNews != nil
        default: return false
        }
    }

    var body: some View {
        HStack(spacing: 0) {
            ForEach(AppTab.allCases) { t in
                Button {
                    if tab != t { Haptics.tap() }
                    tab = t
                } label: {
                    VStack(spacing: 4) {
                        GlyphView(glyph: t.glyph, scale: 3)
                            .frame(height: 33)
                            .overlay(alignment: .topTrailing) {
                                if dot(t) { Rectangle().fill(Color.thread).frame(width: 9, height: 9).offset(x: 6, y: -2) }
                            }
                        Text(t.label).font(.px(12, tab == t ? 700 : 500)).foregroundStyle(tab == t ? Color.inkSoft : Color.muted)
                    }
                    .padding(.vertical, 6)
                    .frame(maxWidth: .infinity)
                    .background(tab == t ? Color.paperHi : Color.clear)
                    .overlay(alignment: .top) { Rectangle().fill(tab == t ? Color.terracotta : Color.clear).frame(height: 3) }
                }
                .accessibilityLabel(t.label)
                .accessibilityAddTraits(tab == t ? .isSelected : [])
            }
        }
        .padding(.horizontal, 6)
        .padding(.top, 2)
        .background(Color.paper.ignoresSafeArea(edges: .bottom))
        .overlay(alignment: .top) { Rectangle().fill(Color.ink).frame(height: PX) }
    }
}

/* ---------- notes along the bottom ---------- */

struct Toasts: View {
    let place: PlaceModel
    var onLetter: () -> Void

    var body: some View {
        VStack(spacing: 10) {
            if let p = place.problem {
                Toast(glyph: Icons.cross, text: p) {
                    Button("OK") { place.problem = nil }.buttonStyle(.px(.paper, small: true))
                }
                .task { try? await Task.sleep(nanoseconds: 4_000_000_000); place.problem = nil }
            } else if let line = place.touchLine, let t = place.touchNews.first {
                Toast(glyph: touchDef(t.kind).glyph, text: line) {
                    VStack(spacing: 6) {
                        Button(TOUCH_BACK_LABEL[t.kind] ?? "Back") {
                            place.markTouchesSeen()
                            place.sendTouch(t.kind, reply: true)
                            Haptics.touch(t.kind)
                        }
                        .buttonStyle(.px(.sage, small: true))
                        Button("Later") { place.markTouchesSeen() }.font(.pxSmall).foregroundStyle(Color.muted)
                    }
                }
            } else if let m = place.moodNews {
                Toast(glyph: m.glyph, text: m.mood != nil ? "\(place.theirName) is \(m.line.replacingOccurrences(of: " · ", with: ": "))" : "\(place.theirName): “\(m.text)”") {
                    VStack(spacing: 6) {
                        Button("Send a hug") {
                            place.markMoodSeen()
                            place.sendTouch(.hug)
                            Haptics.touch(.hug)
                        }
                        .buttonStyle(.px(.sage, small: true))
                        Button("OK") { place.markMoodSeen() }.font(.pxSmall).foregroundStyle(Color.muted)
                    }
                }
            } else if let s = place.stitchNote {
                Toast(glyph: Icons.stitch, text: s) {
                    Button("Nice") { place.stitchNote = nil }.buttonStyle(.px(.paper, small: true))
                }
                .task { try? await Task.sleep(nanoseconds: 6_000_000_000); place.stitchNote = nil }
            }
        }
        .animation(.spring(duration: 0.3), value: place.touchNews.first?.id)
        .animation(.spring(duration: 0.3), value: place.moodNews?.at)
    }
}

/* ---------- tapping the two of you ---------- */

struct MeSheet: View {
    let place: PlaceModel
    var onLook: () -> Void
    @State private var words = ""
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 12) {
                    HeadView(look: place.myLook, size: 44)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(place.myName).font(.pxHeading).foregroundStyle(Color.inkSoft)
                        Text(place.myMood.map { "You’re \($0.line)" } ?? "How are you feeling?").font(.pxSmall).foregroundStyle(Color.muted)
                    }
                }
                Text("It shows over your head on the couch for a day, for \(place.theirName) to see.").font(.pxSmall).foregroundStyle(Color.muted)
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 98), spacing: 8)], spacing: 8) {
                    ForEach(MOODS) { m in
                        Button {
                            Haptics.tap()
                            place.setMood(place.myMood?.mood == m.id ? nil : m.id, place.myMood?.text ?? "")
                        } label: {
                            VStack(spacing: 4) {
                                GlyphView(glyph: m.glyph, scale: 3)
                                Text(m.label).lineLimit(1).minimumScaleFactor(0.8)
                            }
                        }
                        .buttonStyle(ChipStyle(on: place.myMood?.mood == m.id))
                    }
                }
                VStack(alignment: .leading, spacing: 6) {
                    PixelLabel(text: "A few words, if you like")
                    HStack(spacing: 8) {
                        PixelField(placeholder: "counting the days", text: $words, limit: MOOD_TEXT_MAX)
                        Button("Share") {
                            place.setMood(place.myMood?.mood, words)
                            Haptics.success()
                        }
                        .buttonStyle(.px(.terracotta, small: true))
                        .disabled(words.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }
                HStack {
                    if place.myMood != nil {
                        Button("Take it down") {
                            place.setMood(nil, "")
                            words = ""
                        }
                        .buttonStyle(.px(.paper, small: true))
                    }
                    Spacer()
                    Button("Change my look") { onLook() }.buttonStyle(.px(.paper, small: true))
                }
            }
            .padding(20)
        }
        .onAppear { words = place.myMood?.text ?? "" }
    }
}

struct ThemSheet: View {
    let place: PlaceModel
    @State private var sent: TouchKind?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 12) {
                if let l = place.theirLook { HeadView(look: l, size: 44) }
                VStack(alignment: .leading, spacing: 2) {
                    Text(place.theirName).font(.pxHeading).foregroundStyle(Color.inkSoft)
                    Text(statusLine).font(.pxSmall).foregroundStyle(Color.muted)
                }
            }
            if let m = place.theirMood {
                HStack(spacing: 10) {
                    GlyphView(glyph: m.glyph, scale: 3)
                    Text(m.line).font(.pxBodyBold).foregroundStyle(Color.inkSoft)
                }
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .pxInset()
            }
            TouchButtons(place: place, compact: false) { k in
                sent = k
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { dismiss() }
            }
        }
        .padding(20)
    }

    var statusLine: String {
        guard let t = place.them else { return "" }
        if place.status(t) == .online { return "Here now" }
        if let a = place.member(t)?.lastActive, let d = Values.date(a) {
            return "Last here " + Activity(id: "", type: "", title: "", description: "", at: Values.iso(d)).ago().lowercased()
        }
        return "Away"
    }
}

/// hug, kiss, forehead kiss, high five, hold hands, boop
struct TouchButtons: View {
    let place: PlaceModel
    var compact = true
    var onSent: (TouchKind) -> Void = { _ in }
    @State private var busy: TouchKind?

    var body: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: compact ? 6 : 10), count: compact ? 6 : 3), spacing: 10) {
            ForEach(TOUCHES) { t in
                Button {
                    guard busy == nil else { return }
                    busy = t.id
                    Haptics.touch(t.id)
                    place.sendTouch(t.id)
                    onSent(t.id)
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.9) { busy = nil }
                } label: {
                    VStack(spacing: 5) {
                        GlyphView(glyph: t.glyph, scale: compact ? 3 : 4).frame(height: compact ? 24 : 30)
                        if !compact { Text(t.label).lineLimit(1).minimumScaleFactor(0.8) }
                    }
                    .opacity(busy == t.id ? 0.5 : 1)
                }
                .buttonStyle(ChipStyle(on: busy == t.id))
                .accessibilityLabel("Send \(t.one)")
            }
        }
        .disabled(!place.partnerHere)
    }
}
