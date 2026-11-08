import SwiftUI
import FirebaseCore
import GoogleSignIn
import SoultiedCore

@main
struct SoultiedApp: App {
    @State private var app: AppModel

    init() {
        FirebaseApp.configure()
        _app = State(initialValue: AppModel(auth: FirebaseAuthService(), cloud: { FirestoreBackend() }))
    }

    var body: some Scene {
        WindowGroup {
            RootView(app: app)
                .onOpenURL { url in
                    if !GIDSignIn.sharedInstance.handle(url) { app.handle(url: url) }
                }
        }
    }
}

/// Launch options for looking around without signing in (the screenshots GitHub takes of each build):
///   -demo            open the demo room
///   -tab letters     start on a tab (home, letters, watch, play, us)
///   -open me         open a sheet from the room (me, them, letters, wall, decor, play, us, music)
///   -game fireflies  open a game
///   -escape          open the dark door (the escape rooms)
enum Launch {
    static let args = ProcessInfo.processInfo.arguments
    static var demo: Bool { args.contains("-demo") }
    static var tab: String? {
        guard let i = args.firstIndex(of: "-tab"), i + 1 < args.count else { return nil }
        return args[i + 1]
    }
    static var sheet: String? {
        guard let i = args.firstIndex(of: "-open"), i + 1 < args.count else { return nil }
        return args[i + 1]
    }
    /// -game fireflies   open one of the games
    static var game: String? {
        guard let i = args.firstIndex(of: "-game"), i + 1 < args.count else { return nil }
        return args[i + 1]
    }
    /// -invite   in the demo room, invite the pretend partner to the live game that's open (for screenshots)
    static var invite: Bool { args.contains("-invite") }
    private static func value(_ flag: String) -> String? {
        guard let i = args.firstIndex(of: flag), i + 1 < args.count else { return nil }
        return args[i + 1]
    }
    /// -watch <link>   in the demo room, put a YouTube video on the TV in Watch together (the screenshots)
    static var watch: String? { value("-watch") }
    /// -service netflix   Watch together starts on Netflix (or prime, youtube); -stream netflix also opens its browser
    static var service: String? { value("-service") }
    static var stream: String? { value("-stream") }
    /// -tour 0   show the first-run tour, at that step (the screenshots; the demo room never shows it otherwise)
    static var tour: Int? { value("-tour").flatMap { Int($0) } }
    /// -record   in the demo room, put the jazz record on; -song <link>, a song from YouTube instead
    static var record: Bool { args.contains("-record") }
    static var song: String? { value("-song") }
    /// -escape   open the dark door; -escape attic, plus -escapeStep 2 and -escapeOpen clock, a room part way in
    static var escape: Bool { args.contains("-escape") }
    static func escapeScene(_ s: EscapeSession) {
        guard let id = value("-escape").flatMap(RoomId.init), let room = s.rooms.first(where: { $0.id == id }) else { return }
        s.playHere(id, fromScratch: true)
        for _ in 0..<(value("-escapeStep").flatMap { Int($0) } ?? 0) {
            if let p = s.puzzle { s.solve(p.id) }
        }
        if let o = room.object(value("-escapeOpen")) {
            s.viewSide = o.side
            s.tap(o.side, o.id)
        }
    }
}

struct RootView: View {
    let app: AppModel
    @Environment(\.scenePhase) private var phase

    var body: some View {
        ZStack {
            RoomBackground()
            switch app.phase {
            case .starting, .finding:
                Splash()
            case .signedOut:
                WelcomeView(app: app)
            case .needsPlace:
                SetupView(app: app)
            case .ready:
                if let p = app.place {
                    MainView(app: app, place: p)
                        .id(p.sid + p.me)
                } else {
                    Splash()
                }
            }
        }
        .animation(.easeOut(duration: 0.25), value: app.phase)
        .task {
            if Launch.demo { app.openDemo() } else { app.start() }
        }
        .onChange(of: phase) { _, now in
            if now == .active { app.place?.heartbeat() }
        }
    }
}

struct Splash: View {
    var body: some View {
        VStack(spacing: 18) {
            GlyphView(glyph: Icons.heart, scale: 8)
            Text("Soultied").font(.px(30, 700)).foregroundStyle(Color.paper)
        }
    }
}
