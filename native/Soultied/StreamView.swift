import SwiftUI
import WebKit
import AVFoundation
import FirebaseFirestore
import SoultiedCore

/*
 * Netflix and Prime Video together, on the iPhone: the site in a browser of the app's own, with the Soultied
 * extension's player code running in it (made by scripts/native-stream.mjs from extension/src), so the show
 * stays in step with your person (on their phone, or on a laptop with the extension) and the couch and the
 * chat sit over it, as on a laptop. SoultiedCore's StreamHub is the app's half: it hands the player who you
 * both are and carries everything along the place's "stream" line.
 *
 * It's meant to feel like part of the app, not a trip out to a website:
 * - the TV switches on (a Soultied curtain) while the site loads, and the browser stays warm between visits,
 *   so going back in is instant and you're where you left off;
 * - once the show plays it turns sideways and goes edge to edge, and the bar over it gets out of the way
 *   (tap the top of the screen to bring it back);
 * - the chat starts tucked away (the heart by the couch opens it), your person's actions buzz, and the sound
 *   plays with the ring switch on silent, like any video app;
 * - "Join Rohan" (in Watch together) opens straight onto what they're watching.
 *
 * You sign in to your own Netflix or Prime Video account in here, once; the app keeps the sign-in like
 * Safari would, and never sees it. The sites are asked for their computer pages (their phone pages only
 * point you to their apps), and the page is told what this iPhone can play (see extension/src/ios/page.ts).
 */

enum StreamSite: String, CaseIterable, Identifiable {
    case netflix, prime
    var id: String { rawValue }
    var name: String { self == .netflix ? "Netflix" : "Prime Video" }
    var home: URL { URL(string: self == .netflix ? "https://www.netflix.com/browse" : "https://www.primevideo.com/")! }

    /// a link from what you've watched together, on this site
    func owns(_ url: URL) -> Bool {
        let h = url.host ?? ""
        switch self {
        case .netflix: return h == "netflix.com" || h.hasSuffix(".netflix.com")
        case .prime: return h.hasSuffix("primevideo.com") || (h.contains("amazon.") && url.path.hasPrefix("/gp/video"))
        }
    }

    /// which site a title's platform is
    init?(platform: String?) {
        switch platform {
        case "netflix": self = .netflix
        case "prime": self = .prime
        default: return nil
        }
    }

    /// a page that's the show itself (not the site's shelves)
    func isWatching(_ url: URL?) -> Bool {
        guard let url else { return false }
        switch self {
        case .netflix: return url.path.contains("/watch/")
        case .prime: return url.path.contains("/detail/") || url.path.contains("/dp/") || (url.query ?? "").contains("autoplay=1")
        }
    }

    /// the site's sign-in pages
    func isSignIn(_ url: URL?) -> Bool {
        guard let url else { return false }
        let p = url.path.lowercased()
        return p.contains("/login") || p.contains("/signin") || p.contains("/ap/") || p.contains("/signup")
    }
}

/// what the site's page says this phone offers, and how its video's doing (extension/src/ios/page.ts)
struct StreamPageNews: Equatable {
    var mse = false
    var managed = false
    var fairPlay = ""
    var known = false
    /// a video's on the page, and where it is
    var video = false
    var at = 0
    var playing = false
    var ready = 0
    var error = 0

    /// this phone's browser can't feed the sites' players at all
    var cantPlay: Bool { known && !mse && !managed }
}

/* ---------- the deck: the line to your person and the browser, kept while you're in Watch together ---------- */

/// One StreamHub for your place and one warm browser, shared by Watch together and the browser itself, so
/// opening the show is instant and "Join Rohan" knows what they're on. Let go a few seconds after the last
/// one's done with it (the browser stays, paused, until you open the other site).
@Observable
final class StreamDeck {
    static let shared = StreamDeck()

    private(set) var hub: StreamHub?
    @ObservationIgnored private weak var place: PlaceModel?
    @ObservationIgnored private var users = 0
    @ObservationIgnored private var letGo: DispatchWorkItem?
    @ObservationIgnored private(set) var web: StreamWebSession?

    private init() {}

    /// Watch together's Netflix / Prime pane, or the browser, is open
    @discardableResult
    func use(_ place: PlaceModel) -> StreamHub {
        letGo?.cancel()
        letGo = nil
        users += 1
        if let hub, self.place === place { return hub }
        stopHub()
        self.place = place
        let h = StreamHub(place: place)
        h.onPartner = { e in
            // your person's doing: a small buzz (not for the every-so-often "still here")
            switch e.str("type") {
            case "play", "pause", "seek", "countdown": Haptics.tap()
            case "react", "chat": Haptics.soft()
            default: break
            }
        }
        h.dropPlayer = { [weak self] in self?.web?.reset() }
        hub = h
        h.start()
        // (a page left open from before reconnects, and says hello to this hub)
        web?.attach(h)
        return h
    }

    func done() {
        users = max(0, users - 1)
        guard users == 0 else { return }
        let w = DispatchWorkItem { [weak self] in
            guard let self, self.users == 0 else { return }
            self.stopHub()
        }
        letGo = w
        // (a moment's grace: opening the browser closes the pane under it and opens it again after)
        DispatchQueue.main.asyncAfter(deadline: .now() + 4, execute: w)
    }

    /// the browser for a site: the warm one if it's that site, or a fresh one
    func session(for site: StreamSite, hub: StreamHub) -> StreamWebSession {
        if let w = web, w.site == site {
            w.attach(hub)
            return w
        }
        web?.close()
        let w = StreamWebSession(site: site, hub: hub)
        web = w
        return w
    }

    private func stopHub() {
        hub?.stop()
        hub = nil
        place = nil
    }
}

/* ---------- one site's browser ---------- */

/// Mac Safari, so the sites send their computer pages and players
let DESKTOP_SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"

/// The site in a web view with the extension's player in it, and what the bar over it needs to know.
@Observable
final class StreamWebSession: NSObject, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
    static let world = WKContentWorld.world(name: "soultied")

    let site: StreamSite
    var canGoBack = false
    var loading = false
    var url: URL?
    /// the first page has finished loading (the curtain can go up)
    var shown = false
    var page = StreamPageNews()
    let web: WKWebView
    @ObservationIgnored private weak var hub: StreamHub?
    @ObservationIgnored private var watchers: [NSKeyValueObservation] = []

    /// the extension's scripts (bundled before the build), by name
    private static func script(_ name: String) -> String? {
        Bundle.main.url(forResource: name, withExtension: "js").flatMap { try? String(contentsOf: $0, encoding: .utf8) }
    }

    init(site: StreamSite, hub: StreamHub) {
        self.site = site
        let cfg = WKWebViewConfiguration()
        cfg.websiteDataStore = .default()
        cfg.allowsInlineMediaPlayback = true
        cfg.mediaTypesRequiringUserActionForPlayback = []
        cfg.allowsPictureInPictureMediaPlayback = true
        cfg.defaultWebpagePreferences.preferredContentMode = .desktop
        cfg.preferences.isElementFullscreenEnabled = true
        cfg.preferences.javaScriptCanOpenWindowsAutomatically = true
        let ucc = cfg.userContentController
        // in the page itself, before the site's code: the iPhone's managed media source under the usual name
        if let s = Self.script("stream-page") {
            ucc.addUserScript(WKUserScript(source: s, injectionTime: .atDocumentStart, forMainFrameOnly: true, in: .page))
        }
        // the sites' own players, driven from inside the page (as the extension's "MAIN world" scripts)
        if let s = Self.script("stream-netflix") {
            let only = "if (/(^|\\.)netflix\\.com$/.test(location.hostname)) {\n\(s)\n}"
            ucc.addUserScript(WKUserScript(source: only, injectionTime: .atDocumentEnd, forMainFrameOnly: true, in: .page))
        }
        if let s = Self.script("stream-prime") {
            let only = "if (/primevideo\\.com$/.test(location.hostname) || (/(^|\\.)amazon\\./.test(location.hostname) && location.pathname.indexOf('/gp/video') === 0)) {\n\(s)\n}"
            ucc.addUserScript(WKUserScript(source: only, injectionTime: .atDocumentEnd, forMainFrameOnly: true, in: .page))
        }
        // the extension's player, in a script world of its own (like a content script)
        if let s = Self.script("stream-player") {
            ucc.addUserScript(WKUserScript(source: s, injectionTime: .atDocumentStart, forMainFrameOnly: true, in: Self.world))
        }
        web = WKWebView(frame: .zero, configuration: cfg)
        web.customUserAgent = DESKTOP_SAFARI
        web.allowsBackForwardNavigationGestures = true
        web.isOpaque = false
        web.backgroundColor = .black
        web.scrollView.backgroundColor = .black
        web.scrollView.contentInsetAdjustmentBehavior = .never
        #if DEBUG
        if #available(iOS 16.4, *) { web.isInspectable = true }
        #endif
        super.init()
        // (the handlers hold this weakly through a go-between, so the session can go)
        ucc.add(WeakHandler(self), contentWorld: Self.world, name: "soultied")
        ucc.add(WeakHandler(self), contentWorld: .page, name: "soultiedPage")
        web.navigationDelegate = self
        web.uiDelegate = self
        watchers = [
            web.observe(\.canGoBack, options: [.initial, .new]) { [weak self] v, _ in DispatchQueue.main.async { self?.canGoBack = v.canGoBack } },
            web.observe(\.isLoading, options: [.initial, .new]) { [weak self] v, _ in DispatchQueue.main.async { self?.loading = v.isLoading } },
            web.observe(\.url, options: [.initial, .new]) { [weak self] v, _ in DispatchQueue.main.async { self?.url = v.url } },
        ]
        attach(hub)
    }

    /// talk to this hub from now on (the page's player reconnects and says hello to it)
    func attach(_ hub: StreamHub) {
        guard self.hub !== hub else { return }
        let had = self.hub != nil
        self.hub = hub
        hub.toPlayer = { [weak self] port, msg in self?.toPlayer(port, msg) }
        if had { reset() }
    }

    func go(_ url: URL) { web.load(URLRequest(url: url)) }
    func back() { web.goBack() }
    func reload() { web.reload() }

    /// the show stops when you close the browser (your person's player says you've stepped away)
    func pause() { web.pauseAllMediaPlayback(completionHandler: nil) }

    /// every line from the page's player is cut, so it connects afresh
    func reset() {
        web.evaluateJavaScript("window.__soultiedAppReset && window.__soultiedAppReset()", in: nil, in: Self.world) { _ in }
    }

    func close() {
        pause()
        web.stopLoading()
        let ucc = web.configuration.userContentController
        ucc.removeAllScriptMessageHandlers()
        ucc.removeAllUserScripts()
        web.removeFromSuperview()
        watchers = []
    }

    /// to the extension's player, through its stand-in API (extension/src/ios/shim.ts)
    private func toPlayer(_ port: Int, _ msg: Doc) {
        guard let data = try? JSONSerialization.data(withJSONObject: StreamJSON.safe(msg)),
              let json = String(data: data, encoding: .utf8)
        else { return }
        web.evaluateJavaScript("window.__soultiedApp && window.__soultiedApp(\(port), \(json))", in: nil, in: Self.world) { _ in }
    }

    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let d = message.body as? [String: Any] else { return }
        if message.name == "soultied" {
            hub?.fromPlayer(d)
            return
        }
        // the page's news (extension/src/ios/page.ts)
        var p = page
        switch d["kind"] as? String {
        case "offers":
            p.known = true
            p.mse = d["mse"] as? Bool ?? false
            p.managed = d["managed"] as? Bool ?? false
            p.fairPlay = d["fps"] as? String ?? ""
        case "video":
            p.video = !(d["none"] as? Bool ?? false)
            p.at = (d["at"] as? NSNumber)?.intValue ?? 0
            p.playing = !(d["paused"] as? Bool ?? true)
            p.ready = (d["ready"] as? NSNumber)?.intValue ?? 0
            p.error = (d["error"] as? NSNumber)?.intValue ?? 0
        case "videoError":
            p.error = (d["code"] as? NSNumber)?.intValue ?? 1
        default:
            return
        }
        if p != page { page = p }
    }

    // a new page: its player connects afresh
    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        hub?.pageChanged()
        page = StreamPageNews()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        if !shown { shown = true }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        if !shown { shown = true }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if !shown { shown = true }
    }

    // the sites' links to their apps (nflx://, the App Store) stay in here; web links open here too
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let scheme = action.request.url?.scheme?.lowercased() ?? ""
        if ["http", "https", "about", "blob", "data"].contains(scheme) {
            if action.targetFrame == nil, let url = action.request.url {
                webView.load(URLRequest(url: url))
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        } else {
            decisionHandler(.cancel)
        }
    }

    // sign-in windows (Amazon's, say) open in place of the page
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url { webView.load(URLRequest(url: url)) }
        return nil
    }
}

/// passes the page's messages on without the page's controller holding on to the session
private final class WeakHandler: NSObject, WKScriptMessageHandler {
    weak var to: WKScriptMessageHandler?
    init(_ to: WKScriptMessageHandler) { self.to = to }
    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        to?.userContentController(ucc, didReceive: message)
    }
}

/* ---------- the screen ---------- */

struct StreamView: View {
    let place: PlaceModel
    let site: StreamSite
    /// somewhere to go other than where you were (a show you were watching together, or your person's)
    var start: URL?
    @Environment(\.dismiss) private var dismiss
    @Environment(\.verticalSizeClass) private var vertical
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var deck = StreamDeck.shared
    @State private var session: StreamWebSession?
    @State private var curtain = true
    /// the bar's showing (it gets out of the way while the show plays sideways)
    @State private var barShown = true
    @State private var barTimer: DispatchWorkItem?
    @State private var turned = false

    private var sideways: Bool { vertical == .compact }
    private var hub: StreamHub? { deck.hub }

    var body: some View {
        ZStack(alignment: .top) {
            Color.black.ignoresSafeArea()
            VStack(spacing: 0) {
                if !sideways || barShown { bar.transition(.move(edge: .top).combined(with: .opacity)) }
                if let s = session, !sideways, s.site.isSignIn(s.url) { signInNote }
                ZStack(alignment: .top) {
                    Color.black
                    if let s = session { StreamWebView(session: s) }
                    if let note = problem { problemNote(note) }
                }
                .ignoresSafeArea(edges: sideways ? .all : .bottom)
            }
            // sideways, while it plays: a tap along the top brings the bar back for a moment
            if sideways && !barShown {
                Color.clear
                    .frame(height: 28)
                    .contentShape(Rectangle())
                    .onTapGesture { showBar() }
                    .accessibilityLabel("Show the controls")
                    .accessibilityAddTraits(.isButton)
            }
            if curtain { StreamCurtain(site: site).transition(.opacity) }
        }
        .statusBarHidden(sideways)
        .persistentSystemOverlays(sideways && !barShown ? .hidden : .automatic)
        .onAppear(perform: open)
        .onDisappear(perform: close)
        .onChange(of: session?.shown) { _, on in
            if on == true { liftCurtain() }
        }
        .onChange(of: session?.page.playing) { _, playing in
            guard playing == true else {
                showBar(stay: true)
                return
            }
            // the show's on: sideways, edge to edge, and the bar steps aside
            if !turned, !sideways, session?.site.isWatching(session?.url) == true || session?.page.video == true {
                turned = true
                Orientation.request(.landscapeRight)
            }
            hideBarSoon()
        }
        .onChange(of: sideways) { _, s in
            if s, session?.page.playing == true { hideBarSoon() } else { showBar(stay: true) }
        }
        .onChange(of: place.partnerHere) { _, _ in hub?.refresh() }
        .onChange(of: place.ready) { _, _ in hub?.refresh() }
    }

    private func open() {
        let h = deck.use(place)
        h.onOpenHub = { dismiss() }
        let s = deck.session(for: site, hub: h)
        session = s
        if let start { s.go(start) } else if s.web.url == nil { s.go(site.home) }
        // already warm and nowhere new to go: no curtain
        if s.shown && start == nil { curtain = false }
        RecordDeck.shared.hush(true)
        // the show's sound plays with the ring switch on silent, like any video app
        let a = AVAudioSession.sharedInstance()
        try? a.setCategory(.playback, mode: .moviePlayback)
        try? a.setActive(true)
        // (never longer than a few seconds behind the curtain, even if the site's slow to say it's done)
        DispatchQueue.main.asyncAfter(deadline: .now() + 6) { liftCurtain() }
    }

    private func close() {
        session?.pause()
        deck.done()
        barTimer?.cancel()
        try? AVAudioSession.sharedInstance().setCategory(.ambient, options: [.mixWithOthers])
        RecordDeck.shared.hush(false)
        if turned { Orientation.request(.portrait) }
    }

    private func liftCurtain() {
        guard curtain else { return }
        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.45)) { curtain = false }
    }

    private func hideBarSoon() {
        barTimer?.cancel()
        let w = DispatchWorkItem {
            guard sideways, session?.page.playing == true else { return }
            withAnimation(.easeOut(duration: 0.25)) { barShown = false }
        }
        barTimer = w
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5, execute: w)
    }

    private func showBar(stay: Bool = false) {
        barTimer?.cancel()
        if !barShown { withAnimation(.easeOut(duration: 0.2)) { barShown = true } }
        if !stay, sideways, session?.page.playing == true {
            let w = DispatchWorkItem {
                guard sideways, session?.page.playing == true else { return }
                withAnimation(.easeOut(duration: 0.25)) { barShown = false }
            }
            barTimer = w
            DispatchQueue.main.asyncAfter(deadline: .now() + 4, execute: w)
        }
    }

    /// said over the page when this phone can't play the show
    private var problem: String? {
        guard let p = session?.page else { return nil }
        if p.cantPlay {
            return "\(site.name) can’t play in the app on this iPhone (it needs iOS 17.1 or later). You can still watch together on a laptop with the Soultied extension."
        }
        if p.error > 0 {
            return "\(site.name) wouldn’t play here (error \(p.error)). Try again, or watch together on a laptop with the Soultied extension."
        }
        return nil
    }

    private func problemNote(_ note: String) -> some View {
        Text(note)
            .font(.pxSmall)
            .foregroundStyle(Color.inkSoft)
            .fixedSize(horizontal: false, vertical: true)
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .pxBox(.paper)
            .padding(10)
            .allowsHitTesting(false)
    }

    private var signInNote: some View {
        HStack(spacing: 8) {
            GlyphView(glyph: Icons.heart, scale: 2)
            Text("Sign in to your own \(site.name), just once. It stays on this phone; Soultied never sees it.")
                .font(.px(12, 500))
                .foregroundStyle(Color.paper.opacity(0.85))
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 7)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(hex: "#2a1f1a"))
    }

    private var bar: some View {
        HStack(spacing: 10) {
            Button("Done") { dismiss() }
                .buttonStyle(.px(.paper, small: true))
            Button {
                session?.back()
            } label: {
                Text("‹").font(.px(20, 700)).frame(width: 28)
            }
            .buttonStyle(.px(.paper, small: true))
            .disabled(session?.canGoBack != true)
            .accessibilityLabel("Back")
            VStack(alignment: .leading, spacing: 1) {
                Text(site.name).font(.px(14, 700)).foregroundStyle(Color.paper)
                Text(status).font(.px(11, 500)).foregroundStyle(Color.paper.opacity(0.7)).lineLimit(1)
            }
            Spacer(minLength: 4)
            if let h = hub, h.partnerWatching, let u = StreamHub.watchURL(h.partnerTitle), StreamSite(platform: h.partnerTitle?.str("platform")) == site,
               session?.url.map({ !Self.same($0, u) }) ?? true {
                Button("Join \(place.theirName)") { session?.go(u) }
                    .buttonStyle(.px(.sage, small: true))
                    .lineLimit(1)
            }
            Button {
                session?.reload()
            } label: {
                Text(session?.loading == true ? "…" : "↻").font(.px(16, 700)).frame(width: 24)
            }
            .buttonStyle(.px(.paper, small: true))
            .accessibilityLabel("Reload")
        }
        .padding(.horizontal, 12)
        .padding(.vertical, sideways ? 4 : 8)
        .background(Color.ink)
    }

    /// the same show (whatever the query says)
    private static func same(_ a: URL, _ b: URL) -> Bool { a.host == b.host && a.path == b.path }

    private var status: String {
        guard let hub else { return "" }
        let them = place.theirName
        if !place.partnerHere { return "Your person hasn’t moved in yet" }
        if hub.partnerWatching, hub.partnerTitle != nil { return "\(them) is on \(StreamHub.label(hub.partnerTitle))" }
        if hub.partnerWatching { return "\(them) is here with you" }
        if hub.hasVideo, hub.title != nil { return "\(StreamHub.label(hub.title)) · waiting for \(them)" }
        return "Pick something; \(them) can join you"
    }
}

/// the TV switching on while the site loads
struct StreamCurtain: View {
    let site: StreamSite
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            Color.ink.ignoresSafeArea()
            VStack(spacing: 18) {
                TimelineView(.animation(minimumInterval: 1.0 / 12, paused: reduceMotion)) { ctx in
                    let p = reduceMotion ? 0.6 : 0.5 + 0.5 * sin(ctx.date.timeIntervalSinceReferenceDate * 3)
                    GlyphView(glyph: Icons.tv, scale: 8)
                        .background {
                            Ellipse().fill(Color.butter.opacity(0.18 + 0.22 * p)).frame(width: 150, height: 110).blur(radius: 22)
                        }
                }
                Text("Switching on \(site.name)…").font(.pxHeading).foregroundStyle(Color.paper)
                Text("You’re still in Soultied: the two of you, the couch and the chat come along.")
                    .font(.pxSmall)
                    .foregroundStyle(Color.paper.opacity(0.65))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// asks the phone to turn the screen (the show goes sideways when it starts)
enum Orientation {
    static func request(_ o: UIInterfaceOrientationMask) {
        guard let scene = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first else { return }
        scene.requestGeometryUpdate(.iOS(interfaceOrientations: o)) { _ in }
        scene.keyWindow?.rootViewController?.setNeedsUpdateOfSupportedInterfaceOrientations()
    }
}

/* ---------- the browser, in the screen ---------- */

/// The session's web view, put into the screen (and taken out again without being thrown away).
struct StreamWebView: UIViewRepresentable {
    let session: StreamWebSession

    func makeUIView(context: Context) -> UIView {
        let box = UIView()
        box.backgroundColor = .black
        place(session.web, in: box)
        return box
    }

    func updateUIView(_ box: UIView, context: Context) {
        if session.web.superview !== box { place(session.web, in: box) }
    }

    static func dismantleUIView(_ box: UIView, coordinator: ()) {
        // (the web view lives on in StreamDeck, warm for next time)
        box.subviews.forEach { $0.removeFromSuperview() }
    }

    private func place(_ web: WKWebView, in box: UIView) {
        web.removeFromSuperview()
        web.translatesAutoresizingMaskIntoConstraints = false
        box.addSubview(web)
        NSLayoutConstraint.activate([
            web.leadingAnchor.constraint(equalTo: box.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: box.trailingAnchor),
            web.topAnchor.constraint(equalTo: box.topAnchor),
            web.bottomAnchor.constraint(equalTo: box.bottomAnchor),
        ])
    }
}

/// documents as JSON for the page (Firestore's timestamps as milliseconds; anything odd as text)
enum StreamJSON {
    static func safe(_ v: Any) -> Any {
        switch v {
        case let d as [String: Any]: return d.mapValues(safe)
        case let a as [Any]: return a.map(safe)
        case is String, is NSNull: return v
        case let n as NSNumber: return n
        case let b as Bool: return b
        case let i as Int: return i
        case let x as Double: return x.isFinite ? x : 0
        case let t as Date: return t.timeIntervalSince1970 * 1000
        case let t as Timestamp: return Double(t.seconds) * 1000 + Double(t.nanoseconds) / 1_000_000
        default: return String(describing: v)
        }
    }
}
