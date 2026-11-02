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
///   -tab letters     start on a tab (home, letters, wall, play, us)
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
