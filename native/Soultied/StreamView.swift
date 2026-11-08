import SwiftUI
import WebKit
import FirebaseFirestore
import SoultiedCore

/*
 * Netflix and Prime Video together, on the iPhone: the site in a browser of the app's own, with the Soultied
 * extension's player code running in it (made by scripts/native-stream.mjs from extension/src), so the show
 * stays in step with your person (on their phone, or on a laptop with the extension) and the chat and the
 * couch sit over it, as on a laptop. SoultiedCore's StreamHub is the app's half: it hands the player who you
 * both are and carries everything along the place's "stream" line.
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

/// the browser's moving parts, for the bar over it
@Observable
final class StreamBrowser {
    var canGoBack = false
    var loading = false
    var page = StreamPageNews()
    @ObservationIgnored weak var web: WKWebView?
    @ObservationIgnored private var watchers: [NSKeyValueObservation] = []

    func attach(_ w: WKWebView) {
        web = w
        watchers = [
            w.observe(\.canGoBack, options: [.initial, .new]) { [weak self] v, _ in DispatchQueue.main.async { self?.canGoBack = v.canGoBack } },
            w.observe(\.isLoading, options: [.initial, .new]) { [weak self] v, _ in DispatchQueue.main.async { self?.loading = v.isLoading } },
        ]
    }

    func back() { web?.goBack() }
    func reload() { web?.reload() }
    func go(_ url: URL) { web?.load(URLRequest(url: url)) }
}

/// Mac Safari, so the sites send their computer pages and players
let DESKTOP_SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"

struct StreamView: View {
    let place: PlaceModel
    let site: StreamSite
    /// somewhere to start other than the site's home (a show you were watching together)
    var start: URL?
    @Environment(\.dismiss) private var dismiss
    @Environment(\.verticalSizeClass) private var vertical
    @State private var hub: StreamHub?
    @State private var browser = StreamBrowser()

    var body: some View {
        VStack(spacing: 0) {
            bar
            ZStack(alignment: .top) {
                Color.black
                if let hub {
                    StreamWebView(site: site, start: start ?? site.home, hub: hub, browser: browser)
                        .ignoresSafeArea(edges: .bottom)
                }
                if let note = problem {
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
            }
        }
        .background(Color.ink.ignoresSafeArea())
        .statusBarHidden(vertical == .compact)
        .onAppear {
            guard hub == nil else { return }
            let h = StreamHub(place: place)
            h.onOpenHub = { dismiss() }
            hub = h
            h.start()
            RecordDeck.shared.hush(true)
        }
        .onDisappear {
            hub?.stop()
            RecordDeck.shared.hush(false)
        }
        .onChange(of: place.partnerHere) { _, _ in hub?.refresh() }
        .onChange(of: place.ready) { _, _ in hub?.refresh() }
    }

    /// said over the page when this phone can't play the show
    private var problem: String? {
        let p = browser.page
        if p.cantPlay {
            return "\(site.name) can’t play in the app on this iPhone (it needs iOS 17.1 or later). You can still watch together on a laptop with the Soultied extension."
        }
        if p.error > 0 {
            return "\(site.name) wouldn’t play here (error \(p.error)). Try again, or watch together on a laptop with the Soultied extension."
        }
        return nil
    }

    private var bar: some View {
        HStack(spacing: 10) {
            Button("Done") { dismiss() }
                .buttonStyle(.px(.paper, small: true))
            Button {
                browser.back()
            } label: {
                Text("‹").font(.px(20, 700)).frame(width: 28)
            }
            .buttonStyle(.px(.paper, small: true))
            .disabled(!browser.canGoBack)
            .accessibilityLabel("Back")
            VStack(alignment: .leading, spacing: 1) {
                Text(site.name).font(.px(14, 700)).foregroundStyle(Color.paper)
                Text(status).font(.px(11, 500)).foregroundStyle(Color.paper.opacity(0.7)).lineLimit(1)
            }
            Spacer(minLength: 4)
            Button {
                browser.reload()
            } label: {
                Text(browser.loading ? "…" : "↻").font(.px(16, 700)).frame(width: 24)
            }
            .buttonStyle(.px(.paper, small: true))
            .accessibilityLabel("Reload")
        }
        .padding(.horizontal, 12)
        .padding(.vertical, vertical == .compact ? 4 : 8)
        .background(Color.ink)
    }

    private var status: String {
        guard let hub else { return "" }
        let them = place.theirName
        if !place.partnerHere { return "Your person hasn’t moved in yet" }
        if hub.partnerWatching { return "\(them) is watching with you" }
        if hub.hasVideo, hub.title != nil { return "\(StreamHub.label(hub.title)) · waiting for \(them)" }
        return "Pick something; \(them) can join you"
    }
}

/* ---------- the browser ---------- */

struct StreamWebView: UIViewRepresentable {
    let site: StreamSite
    let start: URL
    let hub: StreamHub
    let browser: StreamBrowser

    /// the extension's scripts (bundled before the build), by name
    private static func script(_ name: String) -> String? {
        Bundle.main.url(forResource: name, withExtension: "js").flatMap { try? String(contentsOf: $0, encoding: .utf8) }
    }

    func makeCoordinator() -> Coordinator { Coordinator(hub: hub, browser: browser) }

    func makeUIView(context: Context) -> WKWebView {
        let cfg = WKWebViewConfiguration()
        cfg.websiteDataStore = .default()
        cfg.allowsInlineMediaPlayback = true
        cfg.mediaTypesRequiringUserActionForPlayback = []
        cfg.allowsPictureInPictureMediaPlayback = true
        cfg.defaultWebpagePreferences.preferredContentMode = .desktop
        cfg.preferences.isElementFullscreenEnabled = true
        cfg.preferences.javaScriptCanOpenWindowsAutomatically = true

        let world = Coordinator.world
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
            ucc.addUserScript(WKUserScript(source: s, injectionTime: .atDocumentStart, forMainFrameOnly: true, in: world))
        }
        ucc.add(context.coordinator, contentWorld: world, name: "soultied")
        ucc.add(context.coordinator, contentWorld: .page, name: "soultiedPage")

        let web = WKWebView(frame: .zero, configuration: cfg)
        web.customUserAgent = DESKTOP_SAFARI
        web.navigationDelegate = context.coordinator
        web.uiDelegate = context.coordinator
        web.allowsBackForwardNavigationGestures = true
        web.isOpaque = false
        web.backgroundColor = .black
        web.scrollView.contentInsetAdjustmentBehavior = .never
        #if DEBUG
        if #available(iOS 16.4, *) { web.isInspectable = true }
        #endif
        context.coordinator.web = web
        browser.attach(web)
        hub.toPlayer = { [weak coordinator = context.coordinator] port, msg in coordinator?.toPlayer(port, msg) }
        web.load(URLRequest(url: start))
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {}

    static func dismantleUIView(_ web: WKWebView, coordinator: Coordinator) {
        let ucc = web.configuration.userContentController
        ucc.removeAllScriptMessageHandlers()
        ucc.removeAllUserScripts()
        web.stopLoading()
        // (the show stops with the browser)
        web.pauseAllMediaPlayback(completionHandler: nil)
    }

    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
        static let world = WKContentWorld.world(name: "soultied")
        let hub: StreamHub
        let browser: StreamBrowser
        weak var web: WKWebView?

        init(hub: StreamHub, browser: StreamBrowser) {
            self.hub = hub
            self.browser = browser
        }

        /// to the extension's player, through its stand-in API (extension/src/ios/shim.ts)
        func toPlayer(_ port: Int, _ msg: Doc) {
            guard let web, let data = try? JSONSerialization.data(withJSONObject: StreamJSON.safe(msg)),
                  let json = String(data: data, encoding: .utf8)
            else { return }
            web.evaluateJavaScript("window.__soultiedApp && window.__soultiedApp(\(port), \(json))", in: nil, in: Self.world) { _ in }
        }

        func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let d = message.body as? [String: Any] else { return }
            if message.name == "soultied" {
                hub.fromPlayer(d)
                return
            }
            // the page's news (extension/src/ios/page.ts)
            var p = browser.page
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
            if p != browser.page { browser.page = p }
        }

        // a new page: its player connects afresh
        func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
            hub.pageChanged()
            browser.page = StreamPageNews()
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
