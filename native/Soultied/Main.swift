import SwiftUI
import SoultiedCore

/// the tabs along the bottom (the wall opens from the pictures over the couch, and its card on Home)
enum AppTab: String, CaseIterable, Identifiable {
    case home, letters, watch, play, us
    var id: String { rawValue }
    var label: String {
        switch self {
        case .home: return "Home"
        case .letters: return "Letters"
        case .watch: return "Watch"
        case .play: return "Play"
        case .us: return "Us"
        }
    }
    var glyph: Glyph {
        switch self {
        case .home: return Icons.home
        case .letters: return Icons.envelope
        case .watch: return Icons.tv
        case .play: return Icons.play
        case .us: return Icons.us
        }
    }
}

/// what the room can open as a sheet (sideways, or from a tap on the couch)
enum RoomSheet: String, Identifiable {
    case me, them, letters, wall, decor, play, us, music, watch, pet
    var id: String { rawValue }
}

struct MainView: View {
    let app: AppModel
    let place: PlaceModel
    @State private var tab: AppTab = MainView.takeResume() ?? AppTab(rawValue: Launch.tab ?? "") ?? .home
    /// the tab to come back to when the app's drawn again (after picking a new look in Us), and to show the
    /// picker there
    static var resume: AppTab?
    static var showLooks = false
    private static func takeResume() -> AppTab? {
        defer { resume = nil }
        return resume
    }
    @State private var sheet: RoomSheet? = Launch.sheet.flatMap { RoomSheet(rawValue: $0) }
    @State private var lettersStart: LettersTab = .today
    @State private var game: GameKind? = Launch.game.flatMap { GameKind(rawValue: $0) }
    @State private var escape = Launch.escape
    @State private var tour = Tour.shared
    @State private var covers = Covers.shared
    @Environment(\.verticalSizeClass) private var vertical

    private var sideways: Bool { vertical == .compact }
    /// the phone's sideways with nothing full-screen up: the whole room. (A show playing sideways, or a game,
    /// keeps the screen; the room only takes over once it's closed.)
    private var roomSideways: Bool { sideways && covers.up == 0 && game == nil && !escape }

    var body: some View {
        ZStack(alignment: .bottom) {
            // the tabs stay put while the room shows sideways, so whatever they have open stays open when the
            // phone turns (Netflix going sideways used to close it)
            VStack(spacing: 0) {
                ZStack {
                    HomeView(place: place, paused: tab != .home || sheet != nil || game != nil || roomSideways, listening: tab == .home && game == nil && !escape && !roomSideways, go: go, onRoom: { open($0, sheet: false) }, openGame: { game = $0 })
                        .opacity(tab == .home ? 1 : 0)
                        .allowsHitTesting(tab == .home)
                    if tab == .letters { LettersView(place: place, start: lettersStart) }
                    if tab == .watch { WatchView(place: place) }
                    if tab == .play { PlayView(place: place) }
                    if tab == .us { UsView(app: app, place: place) }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                TabBar(tab: $tab, place: place)
            }
            .opacity(roomSideways ? 0 : 1)
            .allowsHitTesting(!roomSideways)
            .accessibilityHidden(roomSideways)
            if roomSideways {
                RoomScene(place: place, couchOnly: false) { open($0, sheet: true) }
                    .ignoresSafeArea()
            }
            Toasts(place: place, onHome: roomSideways || (tab == .home && sheet == nil), onLetter: { go(.letters) })
                .padding(.bottom, roomSideways ? 12 : 84)
        }
        .fullScreenCover(isPresented: $escape) { EscapeScreen(place: place) }
        .sheet(item: $sheet) { s in
            sheetView(s)
                .presentationDragIndicator(.visible)
                .presentationBackground(Color.paper)
        }
        .fullScreenCover(item: $game) { k in GameScreen(place: place, kind: k) }
        // the record player: its sound follows the place's record, whichever tab you're on
        .onAppear {
            RecordDeck.shared.attach(place)
            if Launch.demo && Launch.record { place.playRecord() }
            if Launch.demo, let s = Launch.song { _ = place.playSong(s) }
        }
        .onChange(of: place.turntable) { _, _ in RecordDeck.shared.sync() }
        .onDisappear { RecordDeck.shared.detach() }
        // the first-run tour: what to tap to go where (Tour.swift)
        .overlayPreferenceValue(TourSpots.self) { spots in
            Group {
                if tour.active && !sideways && sheet == nil && game == nil && !escape {
                    TourOverlay(tour: tour, place: place, spots: spots)
                }
            }
        }
        .onAppear { tour.offer(place: place) }
        .onChange(of: place.ready) { _, _ in tour.offer(place: place) }
        .onChange(of: tour.active) { _, on in
            if on { tab = .home }
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
        Chiptune.shared.room(id)
        Haptics.tap()
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
        // the pictures over the couch: your wall
        case .board:
            Haptics.tap()
            sheet = .wall
        case .decor: sheet = .decor
        // the pet on its cushion: choose who sleeps there
        case .pet:
            Haptics.soft()
            sheet = .pet
        case .photo: show(.us, .us)
        case .games: show(.play, .play)
        // the TV remote on the coffee table: watch together
        case .remote: show(.watch, .watch)
        // the dark door: the escape rooms
        case .door:
            Haptics.tap()
            escape = true
        case .music:
            Haptics.tap()
            sheet = .music
        case .fire: break
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
        case .music: RecordSheet(place: place, hostsSong: roomSideways).presentationDetents([.medium, .large])
        case .watch: WatchView(place: place)
        case .pet: DecorView(place: place, start: .pet)
        }
    }
}

/// how many full-screen things the tabs have up (a show, a game, the escape rooms): while one is, turning the
/// phone sideways leaves it be, rather than swapping the tabs for the whole room
@Observable
final class Covers {
    static let shared = Covers()
    private(set) var up = 0
    func add() { up += 1 }
    func remove() { up = max(0, up - 1) }
}

extension View {
    /// on what a tab puts up full-screen
    func coversTabs() -> some View {
        onAppear { Covers.shared.add() }
            .onDisappear { Covers.shared.remove() }
    }
}

/* ---------- the tab bar ---------- */

struct TabBar: View {
    @Binding var tab: AppTab
    let place: PlaceModel

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private func dot(_ t: AppTab) -> Bool {
        switch t {
        case .letters: return place.partnerHere && (place.letterWaiting || !place.asksView.forMe.isEmpty)
        default: return false
        }
    }

    var body: some View {
        HStack(spacing: 0) {
            ForEach(AppTab.allCases) { t in
                Button {
                    if tab != t {
                        Haptics.select()
                        Chiptune.shared.tab(AppTab.allCases.firstIndex(of: t) ?? 0)
                    }
                    tab = t
                } label: {
                    VStack(spacing: 4) {
                        GlyphView(glyph: t.glyph, scale: 3)
                            .frame(height: 33)
                            // watching together is the heart of it: the TV glows a little
                            .background { if t == .watch { TabGlow(still: reduceMotion) } }
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
                .accessibilityLabel(t == .watch ? "Watch together" : t.label)
                .accessibilityAddTraits(tab == t ? .isSelected : [])
                .anchorPreference(key: TourSpots.self, value: .bounds) { ["tab.\(t.rawValue)": $0] }
            }
        }
        .padding(.horizontal, 6)
        .padding(.top, 2)
        .background(Color.paper.ignoresSafeArea(edges: .bottom))
        .overlay(alignment: .top) { Rectangle().fill(Color.ink).frame(height: PX) }
    }
}

/// a soft, slow glow behind the Watch tab's TV
struct TabGlow: View {
    var still = false

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 20, paused: still)) { ctx in
            let p = still ? 0.6 : 0.5 + 0.5 * sin(ctx.date.timeIntervalSinceReferenceDate * 2.1)
            ZStack {
                Ellipse().fill(Color.butter.opacity(0.28 + 0.22 * p)).frame(width: 46, height: 36).blur(radius: 9)
                Ellipse().fill(Color(hex: "#ffe7a3").opacity(0.18 + 0.2 * p)).frame(width: 30, height: 24).blur(radius: 5)
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

/* ---------- notes along the bottom ---------- */

struct Toasts: View {
    let place: PlaceModel
    /// your person's mood only comes up on the couch (it's over their head there too); touches come up anywhere
    var onHome = true
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
            } else if onHome, let m = place.moodNews {
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
                        .buttonStyle(.px(.paper, small: true, wide: true))
                    }
                    Spacer()
                    Button("Change my look") { onLook() }.buttonStyle(.px(.paper, small: true, wide: true))
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
