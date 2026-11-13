import SwiftUI
import WebKit
import SoultiedCore

/*
 * Watch together: the camera swings round behind the couch, and the two of you watch the big TV (the same
 * room as the website, drawn pixel for pixel by SoultiedCore). Paste a YouTube link and it plays on both
 * your TVs, in sync, whether your person is on their phone or on soultied.app. Plus reactions that pop up
 * over your heads, and a couch chat.
 *
 * Or Netflix and Prime Video: each opens in the app's own browser, in step with your person (StreamView.swift).
 */

/// what's on: YouTube in the room's TV, or Netflix / Prime Video in the app's browser
enum WatchService: String, CaseIterable, Identifiable {
    case youtube, netflix, prime
    var id: String { rawValue }
    var name: String {
        switch self {
        case .youtube: return "YouTube"
        case .netflix: return "Netflix"
        case .prime: return "Prime Video"
        }
    }
    var site: StreamSite? { StreamSite(rawValue: rawValue) }
}

/// a show you've been watching together on Netflix or Prime Video
struct StreamShow: Identifiable {
    let show: String
    let episode: String
    let url: URL
    let at: Double
    var id: String { url.absoluteString }
}

/// a site to open, and where
struct StreamOpen: Identifiable {
    let site: StreamSite
    let url: URL?
    var id: String { site.rawValue + (url?.absoluteString ?? "") }
}

struct WatchView: View {
    let place: PlaceModel
    @State private var session: WatchSession?
    @State private var link = ""
    @State private var draft = ""
    @AppStorage("soultied_watch_service") private var serviceRaw = WatchService.youtube.rawValue
    @State private var streaming: StreamOpen?
    @State private var streamLog: Doc = [:]
    @State private var logListener: Listener?
    /// the line your person's Netflix / Prime player talks on (what they're watching, for "Join")
    @State private var deck = StreamDeck.shared
    @Environment(\.verticalSizeClass) private var vertical

    private var service: WatchService { WatchService(rawValue: serviceRaw) ?? .youtube }
    /// YouTube, turned sideways: just the TV (and the two of you), as big as it goes. (The room stays the same
    /// view, so the video carries on rather than starting again.)
    private var theater: Bool { vertical == .compact && service == .youtube && session != nil }

    var body: some View {
        GeometryReader { geo in
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if !theater {
                        DarkHeading(title: "Watch together", sub: service == .youtube ? "YouTube on both your TVs, in sync" : "\(service.name) on both your screens, in sync")
                        picker
                        joinCard
                    }
                    if let s = session {
                        if let site = service.site {
                            // (the way in sits on the TV, so it's on the first screen)
                            WatchRoomView(place: place, session: s, width: max(100, geo.size.width - 32), tv: .idle, showsPlayer: false, onTV: AnyView(openOnTV(site)))
                            streamPane(site)
                        } else {
                            if !theater { presence(s) }
                            WatchRoomView(place: place, session: s, width: theater ? geo.size.width : max(100, geo.size.width - 32), height: theater ? geo.size.height : nil)
                            if !theater {
                                controls(s)
                                reactions(s)
                                chat(s)
                            }
                        }
                    }
                }
                .padding(.horizontal, theater ? 0 : 16)
                .padding(.top, theater ? 0 : 8)
                .padding(.bottom, theater ? 0 : 120)
            }
            .scrollDisabled(theater)
            .scrollDismissesKeyboard(.interactively)
        }
        .ignoresSafeArea(edges: theater ? .all : [])
        .background(theater ? AnyView(Color.black.ignoresSafeArea()) : AnyView(RoomBackground()))
        .statusBarHidden(theater)
        .onAppear {
            guard session == nil else { return }
            let s = WatchSession(place: place)
            session = s
            s.start()
            if place.isDemo, let v = Launch.watch { s.putOn(v) }
            // the record player goes quiet while you watch
            RecordDeck.shared.hush(true)
            logListener = place.watchStreamLog { d in streamLog = d ?? [:] }
            deck.use(place)
            demoPartnerWatching()
            if let v = Launch.service { serviceRaw = v }
            // (the screenshots: YouTube's TV, turned sideways)
            if place.isDemo, Launch.stream == nil, Launch.args.contains("-sideways") {
                DispatchQueue.main.asyncAfter(deadline: .now() + 2) { Orientation.request(.landscapeRight) }
            }
            if place.isDemo, let site = Launch.stream.flatMap(StreamSite.init) { streaming = StreamOpen(site: site, url: nil) }
        }
        .onDisappear {
            session?.stop()
            session = nil
            RecordDeck.shared.hush(false)
            logListener?.stop()
            logListener = nil
            deck.done()
        }
        // (the place came round, or your person moved in: the line to their Netflix / Prime player opens)
        .onChange(of: place.partnerHere) { _, _ in
            deck.hub?.refresh()
            demoPartnerWatching()
        }
        .fullScreenCover(item: $streaming) { o in
            StreamView(place: place, site: o.site, start: o.url)
                .coversTabs()
        }
        .task {
            // keep the two TVs in step
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 700_000_000)
                session?.tick()
            }
        }
    }

    private func presence(_ s: WatchSession) -> some View {
        HStack(spacing: 8) {
            Rectangle().fill(s.partnerHere ? Color.sage : Color(hex: "#b9a98f")).frame(width: 9, height: 9)
            Text(!place.partnerHere ? "\(place.theirName) hasn’t moved in yet" : s.partnerHere ? "\(place.theirName) is on the couch" : "\(place.theirName) isn’t here yet")
                .font(.px(14, 600))
                .foregroundStyle(Color.inkSoft)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .pxBox()
    }

    @ViewBuilder
    private func controls(_ s: WatchSession) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            if let n = s.notice {
                Text(n).font(.pxSmall).foregroundStyle(Color.thread).fixedSize(horizontal: false, vertical: true)
            }
            if s.needsTap {
                HStack(spacing: 8) {
                    Text("Tap to start the video here.").font(.pxSmall).foregroundStyle(Color.inkSoft)
                    Button("Play") { s.listen() }.buttonStyle(.px(.sage, small: true))
                }
            }
            PixelLabel(text: s.videoId == nil ? "Put something on" : "Something else")
            PixelField(placeholder: "Paste a YouTube link", text: $link, limit: 300)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .keyboardType(.URL)
                .submitLabel(.go)
                .onSubmit { putOn(s) }
            HStack(spacing: 8) {
                Button("Paste") {
                    if let p = UIPasteboard.general.string { link = p }
                }
                .buttonStyle(.px(.paper, small: true))
                Button("Put it on") { putOn(s) }
                    .buttonStyle(.px(.terracotta, small: true))
                    .disabled(link.trimmingCharacters(in: .whitespaces).isEmpty)
                Spacer(minLength: 0)
                if s.videoId != nil {
                    Button("Take it off") {
                        Haptics.tap()
                        s.takeOff()
                    }
                    .buttonStyle(.px(.paper, small: true))
                }
            }
        }
        .pxCard()
    }

    private func putOn(_ s: WatchSession) {
        guard !link.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        if s.putOn(link) == nil {
            Haptics.tap()
            link = ""
        }
    }

    private func reactions(_ s: WatchSession) -> some View {
        HStack(spacing: 8) {
            ForEach(ReactionKind.allCases, id: \.self) { k in
                Button {
                    Haptics.soft()
                    s.react(k)
                } label: {
                    GlyphView(glyph: WATCH_ICONS[k]!, scale: 4)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .pxBox()
                }
                .buttonStyle(.press)
                .accessibilityLabel(reactionName(k))
            }
        }
    }

    private func reactionName(_ k: ReactionKind) -> String {
        switch k {
        case .heart: return "Love it"
        case .laugh: return "Ha"
        case .wow: return "Wow"
        case .cry: return "Sob"
        case .star: return "Bravo"
        }
    }

    private func chat(_ s: WatchSession) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Couch chat").font(.pxHeading).foregroundStyle(Color.inkSoft)
            if s.chat.isEmpty {
                Text("Whisper something. Only the two of you can see this.").font(.pxSmall).foregroundStyle(Color.muted)
            }
            ForEach(s.chat.suffix(40)) { m in
                let mine = m.by == place.me
                HStack {
                    if mine { Spacer(minLength: 40) }
                    VStack(alignment: mine ? .trailing : .leading, spacing: 2) {
                        Text(mine ? "You" : m.name).font(.px(12, 700)).foregroundStyle(Color.muted)
                        Text(m.text).font(.pxBody).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(mine ? Palette.now.bubbleMine : Color.paper2)
                    if !mine { Spacer(minLength: 40) }
                }
            }
            HStack(spacing: 8) {
                PixelField(placeholder: "Say something…", text: $draft, limit: 300)
                    .submitLabel(.send)
                    .onSubmit { send(s) }
                Button("Send") { send(s) }
                    .buttonStyle(.px(.terracotta, small: true))
                    .disabled(draft.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .pxCard()
    }

    private func send(_ s: WatchSession) {
        s.say(draft)
        draft = ""
    }

    /// YouTube, Netflix or Prime Video
    private var picker: some View {
        HStack(spacing: 8) {
            ForEach(WatchService.allCases) { w in
                Button(w.name) {
                    Haptics.tap()
                    serviceRaw = w.rawValue
                }
                .buttonStyle(.px(w == service ? .terracotta : .paper, small: true))
                .accessibilityAddTraits(w == service ? .isSelected : [])
            }
        }
    }

    /// (the screenshots: the demo's Rohan is on Netflix, for the Join card)
    private func demoPartnerWatching() {
        guard place.isDemo, Launch.args.contains("-partnerWatching"), let them = place.them else { return }
        let dark: Doc = ["platform": "netflix", "key": "netflix:80100172", "showKey": "netflix-show:dark", "show": "Dark", "episode": "S1:E2 · Lies", "url": "https://www.netflix.com/watch/80100172"]
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            place.liveChannel("stream").send(["type": "hello", "title": dark, "pos": 640, "playing": true, "by": them, "at": Values.nowMs()])
        }
    }

    /// your person's on Netflix or Prime Video right now: one tap to sit down next to them
    @ViewBuilder
    private var joinCard: some View {
        if let h = deck.hub, h.partnerWatching, let t = h.partnerTitle, let site = StreamSite(platform: t.str("platform")),
           let u = StreamHub.watchURL(t) {
            HStack(spacing: 12) {
                Rectangle().fill(Color.sage).frame(width: 9, height: 9)
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(place.theirName) is watching").font(.px(12, 600)).foregroundStyle(Color.muted)
                    Text("\(StreamHub.label(t)) on \(site.name)").font(.pxBodyBold).foregroundStyle(Color.inkSoft).lineLimit(2)
                }
                Spacer(minLength: 4)
                Button("Join") {
                    Haptics.tap()
                    serviceRaw = site.rawValue
                    watch(site, u)
                }
                .buttonStyle(.px(.sage, small: true))
            }
            .pxCard()
        }
    }

    /// Netflix or Prime Video: a movie night (three a month are free; Plus has every night)
    private func watch(_ site: StreamSite, _ url: URL?) {
        if place.takeNight() { streaming = StreamOpen(site: site, url: url) } else { PlusGate.shared.show(.nights) }
    }

    /// a play triangle, for the button on the TV
    private static let playMark = Glyph(["c...", "cc..", "ccc.", "cccc", "ccc.", "cc..", "c..."], ["c": "#fff4e2"])

    /// on the TV: the way into Netflix or Prime Video
    private func openOnTV(_ site: StreamSite) -> some View {
        VStack(spacing: 8) {
            Text("\(site.name.uppercased()) · TOGETHER").font(.px(11, 700)).kerning(1.2).foregroundStyle(Color.butter)
            Button {
                Haptics.tap()
                watch(site, nil)
            } label: {
                HStack(spacing: 8) {
                    GlyphView(glyph: Self.playMark, scale: 3)
                    Text("Open \(site.name)")
                }
            }
            .buttonStyle(.px(.terracotta))
            .accessibilityHint("Pick a show and it plays for \(place.theirName) too")
        }
    }

    /// Netflix or Prime Video: how it works, and the shows you were watching together, to pick up again
    private func streamPane(_ site: StreamSite) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 8) {
                Text("Pick a show and press play: it plays for \(place.theirName) too, in step, with your chat and reactions over it. It turns sideways by itself when the show starts.")
                    .font(.pxBody)
                    .foregroundStyle(Color.muted)
                    .fixedSize(horizontal: false, vertical: true)
                Text("You each sign in to your own \(site.name), once, in here. \(place.theirName) can watch on their phone, or on a laptop at soultied.app with the Soultied extension.")
                    .font(.pxSmall)
                    .foregroundStyle(Color.muted)
                    .fixedSize(horizontal: false, vertical: true)
                if !place.plusOpen {
                    let n = place.night
                    Button {
                        PlusGate.shared.show(.plain)
                    } label: {
                        Text(n.already ? "Tonight’s one of your free movie nights: watch as much as you like."
                            : n.left > 0 ? "\(n.left) of \(PlusRules.freeNights) free movie nights left this month. Plus has every night →"
                            : "That’s your \(PlusRules.freeNights) free movie nights this month. Plus has every night →")
                            .font(.px(13, 600))
                            .foregroundStyle(Color.terracottaD)
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            .pxCard()

            let shows = recent(site)
            if !shows.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Pick up where you left off").font(.pxHeading).foregroundStyle(Color.inkSoft)
                    ForEach(shows) { s in
                        Button {
                            Haptics.tap()
                            watch(site, s.url)
                        } label: {
                            HStack(spacing: 10) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(s.show).font(.pxBodyBold).foregroundStyle(Color.inkSoft).lineLimit(1)
                                    if !s.episode.isEmpty { Text(s.episode).font(.pxSmall).foregroundStyle(Color.muted).lineLimit(1) }
                                }
                                Spacer(minLength: 0)
                                Text("→").font(.pxBodyBold).foregroundStyle(Color.terracottaD)
                            }
                            .padding(10)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .pxBox()
                        }
                        .buttonStyle(.press)
                    }
                }
                .pxCard()
            }
        }
    }

    /// the shows you've been watching together on this site, newest first (meta/stream, shared with the website)
    private func recent(_ site: StreamSite) -> [StreamShow] {
        let shows = (streamLog["shows"] as? Doc) ?? [:]
        let all: [StreamShow] = shows.values.compactMap { v in
            guard let d = v as? Doc, let u = d.str("url").flatMap({ URL(string: $0) }), site.owns(u) else { return nil }
            return StreamShow(show: d.str("show") ?? "", episode: d.str("episode") ?? "", url: u, at: Values.num(d["at"]) ?? 0)
        }
        return Array(all.sorted { $0.at > $1.at }.prefix(4))
    }
}

/* ---------- the room, with the YouTube player in the TV ---------- */

struct WatchRoomView: View {
    let place: PlaceModel
    let session: WatchSession
    /// how wide it's shown, in points
    let width: CGFloat
    /// what the TV shows instead of the YouTube video (Netflix and Prime play in their own browser)
    var tv: TvState? = nil
    var showsPlayer = true
    /// something to show on the TV's screen instead (the way into Netflix and Prime)
    var onTV: AnyView? = nil
    /// sideways, the whole screen's height: just the TV and the tops of your heads, as big as they go
    var height: CGFloat? = nil
    @Environment(\.displayScale) private var displayScale
    @State private var renderer = WatchRenderer()
    @State private var start = Date()

    /// the part of the room shown: the TV, the two of you, the couch
    private static let top = 6.0
    private static let shown = (x: 72.0, w: 176.0)

    private var state: WatchState {
        let mine: AvatarConfig? = place.myLook, theirs: AvatarConfig? = place.theirLook
        var st = WatchState(left: session.mySeat == .left ? mine : theirs, right: session.mySeat == .left ? theirs : mine, tv: tv ?? session.tv)
        st.reactions = session.reactions
        return st
    }

    /// sideways (room pixels): the TV with a little wall round it, down to the tops of your heads
    private static let big = (w: 200.0, top: 8.0, h: 128.0)

    /// screen points per room pixel: whole screen pixels each, as big as the TV and the couch fit across
    /// (sideways, as big as the TV and your heads fit)
    private var u: CGFloat {
        if let height {
            let k = min(width / CGFloat(Self.big.w), height / CGFloat(Self.big.h))
            return max(1, (k * displayScale).rounded(.down)) / displayScale
        }
        return max(1, (width * displayScale / CGFloat(Self.shown.w)).rounded(.down)) / displayScale
    }

    var body: some View {
        let W = width
        let u = self.u
        let ox = W / 2 - CGFloat(TV_SCREEN.x + TV_SCREEN.w / 2) * u
        let oy = height.map { ($0 - CGFloat(Self.big.h) * u) / 2 - CGFloat(Self.big.top) * u } ?? -CGFloat(Self.top) * u
        ZStack(alignment: .topLeading) {
            Color.roomBrown
            TimelineView(.animation(minimumInterval: 1.0 / 12)) { ctx in
                let t = ctx.date.timeIntervalSince(start)
                if let img = Pixels.image(renderer.render(state, t, now: ctx.date.timeIntervalSince1970 * 1000)) {
                    Image(decorative: img, scale: 1)
                        .resizable()
                        .interpolation(.none)
                        .frame(width: CGFloat(WATCH_W) * u, height: CGFloat(WATCH_H) * u)
                        .offset(x: ox, y: oy)
                }
            }
            if showsPlayer, session.videoId != nil {
                YouTubeTVView(session: session)
                    .frame(width: CGFloat(TV_SCREEN.w) * u, height: CGFloat(TV_SCREEN.h) * u)
                    .offset(x: ox + CGFloat(TV_SCREEN.x) * u, y: oy + CGFloat(TV_SCREEN.y) * u)
            }
            if let onTV {
                onTV
                    .frame(width: CGFloat(TV_SCREEN.w) * u, height: CGFloat(TV_SCREEN.h) * u)
                    .offset(x: ox + CGFloat(TV_SCREEN.x) * u, y: oy + CGFloat(TV_SCREEN.y) * u)
            }
        }
        .frame(width: W, height: height ?? (CGFloat(WATCH_H) - CGFloat(Self.top)) * u, alignment: .topLeading)
        .clipped()
        .overlay(Rectangle().stroke(Color.ink, lineWidth: height == nil ? 3 : 0))
        .accessibilityElement(children: .contain)
        .accessibilityLabel(!showsPlayer || session.videoId != nil ? "The TV" : "The TV is off. Paste a YouTube link below to put something on.")
    }
}

/* ---------- YouTube's own player, in a web view ---------- */

/// The YouTube player on this phone, as WatchSession sees it: commands go to the page, and the page reports
/// where it is a few times a second (in between, a playing video's time runs on by the clock).
final class YouTubeTV: WatchPlayer {
    weak var web: WKWebView?
    weak var session: WatchSession?
    private var snapTime = 0.0
    private var snapAt = 0.0
    private var snapState: YTState = .unstarted
    private var dur = 0.0

    var time: Double { snapState == .playing ? snapTime + max(0, Values.nowMs() - snapAt) / 1000 : snapTime }
    var state: YTState { snapState }
    var duration: Double { dur }

    private func js(_ s: String) { web?.evaluateJavaScript(s, completionHandler: nil) }
    private func mark(_ t: Double, _ st: YTState? = nil) {
        snapTime = t
        snapAt = Values.nowMs()
        if let st { snapState = st }
    }
    private func num(_ v: Double) -> String { v.isFinite ? String(format: "%.3f", v) : "0" }

    func load(_ id: String, at t: Double) {
        guard YouTubeLink.id(id) == id else { return }
        mark(t, .buffering)
        js("cmd('load','\(id)',\(num(t)))")
    }

    func cue(_ id: String, at t: Double) {
        guard YouTubeLink.id(id) == id else { return }
        mark(t, .cued)
        js("cmd('cue','\(id)',\(num(t)))")
    }

    func seek(_ t: Double) {
        mark(t)
        js("cmd('seek',\(num(t)))")
    }

    func play() {
        mark(time, .playing)
        js("cmd('play')")
    }

    func pause() {
        mark(time, .paused)
        js("cmd('pause')")
    }

    func stop() {
        mark(0, .unstarted)
        js("cmd('stop')")
    }

    /// what the page said
    func heard(_ m: [String: Any]) {
        guard let kind = m["kind"] as? String else { return }
        if kind == "error" {
            session?.playerError((m["code"] as? Int) ?? -1)
            return
        }
        let st = YTState(rawValue: (m["state"] as? Int) ?? -1) ?? .unstarted
        mark((m["time"] as? Double) ?? Double((m["time"] as? Int) ?? 0), st)
        if let d = m["duration"] as? Double { dur = d }
        switch kind {
        case "ready": session?.playerReady(self)
        case "state": session?.playerChanged(st, at: snapTime)
        default: break
        }
    }

    /// the page: one YouTube player filling it, reporting back
    static func page(id: String, start: Double, autoplay: Bool) -> String {
        """
        <!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
        <style>html,body{margin:0;height:100%;background:#000;overflow:hidden}#p{width:100%;height:100%}</style></head>
        <body><div id="p"></div><script>
        var player=null, ready=false;
        function say(m){try{window.webkit.messageHandlers.tv.postMessage(m)}catch(e){}}
        function snap(kind){if(!player||!ready)return;try{say({kind:kind,state:player.getPlayerState(),time:player.getCurrentTime()||0,duration:player.getDuration()||0})}catch(e){}}
        function cmd(op,a,b){if(!player||!ready)return;try{
          if(op==='load')player.loadVideoById({videoId:a,startSeconds:b});
          else if(op==='cue')player.cueVideoById({videoId:a,startSeconds:b});
          else if(op==='seek')player.seekTo(a,true);
          else if(op==='play')player.playVideo();
          else if(op==='pause')player.pauseVideo();
          else if(op==='stop')player.stopVideo();
        }catch(e){}}
        function onYouTubeIframeAPIReady(){
          player=new YT.Player('p',{videoId:'\(id)',width:'100%',height:'100%',
            playerVars:{start:\(Int(max(0, start))),playsinline:1,rel:0,fs:0,autoplay:\(autoplay ? 1 : 0),origin:'https://soultied.app'},
            events:{
              onReady:function(){ready=true;snap('ready')},
              onStateChange:function(){snap('state')},
              onError:function(e){say({kind:'error',code:e.data})}
            }});
          setInterval(function(){snap('tick')},250);
        }
        </script><script src="https://www.youtube.com/iframe_api"></script></body></html>
        """
    }
}

/// carries the page's messages to the player (kept apart from YouTubeTV, which WatchSession talks to)
private final class TVMessages: NSObject, WKScriptMessageHandler {
    let tv: YouTubeTV
    init(_ tv: YouTubeTV) { self.tv = tv }
    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        if let m = message.body as? [String: Any] { tv.heard(m) }
    }
}

struct YouTubeTVView: UIViewRepresentable {
    let session: WatchSession

    final class Coordinator {
        let tv = YouTubeTV()
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let c = WKWebViewConfiguration()
        c.allowsInlineMediaPlayback = true
        c.mediaTypesRequiringUserActionForPlayback = []
        c.userContentController.add(TVMessages(context.coordinator.tv), name: "tv")
        let w = WKWebView(frame: .zero, configuration: c)
        w.isOpaque = false
        w.backgroundColor = .black
        w.scrollView.isScrollEnabled = false
        w.scrollView.bounces = false
        let tv = context.coordinator.tv
        tv.web = w
        tv.session = session
        if let first = session.playerWillLoad() {
            // from soultied.app's address, which YouTube's player expects to be told where it's playing
            w.loadHTMLString(YouTubeTV.page(id: first.videoId, start: first.start, autoplay: first.autoplay), baseURL: URL(string: "https://soultied.app/"))
        }
        return w
    }

    func updateUIView(_ w: WKWebView, context: Context) {}

    static func dismantleUIView(_ w: WKWebView, coordinator: Coordinator) {
        w.evaluateJavaScript("cmd('stop')", completionHandler: nil)
        w.configuration.userContentController.removeScriptMessageHandler(forName: "tv")
        coordinator.tv.session?.playerGone()
    }
}
