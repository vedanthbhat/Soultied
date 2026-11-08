import SwiftUI
import WebKit
import SoultiedCore

/*
 * Watch together: the camera swings round behind the couch, and the two of you watch the big TV (the same
 * room as the website, drawn pixel for pixel by SoultiedCore). Paste a YouTube link and it plays on both
 * your TVs, in sync, whether your person is on their phone or on soultied.app. Plus reactions that pop up
 * over your heads, and a couch chat.
 */

struct WatchView: View {
    let place: PlaceModel
    @State private var session: WatchSession?
    @State private var link = ""
    @State private var draft = ""

    var body: some View {
        GeometryReader { geo in
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    DarkHeading(title: "Watch together", sub: "YouTube on both your TVs, in sync")
                    if let s = session {
                        presence(s)
                        WatchRoomView(place: place, session: s, width: max(100, geo.size.width - 32))
                        controls(s)
                        reactions(s)
                        chat(s)
                    }
                    laptops
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 120)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .background(RoomBackground())
        .onAppear {
            guard session == nil else { return }
            let s = WatchSession(place: place)
            session = s
            s.start()
            if place.isDemo, let v = Launch.watch { s.putOn(v) }
            // the record player goes quiet while you watch
            RecordDeck.shared.hush(true)
        }
        .onDisappear {
            session?.stop()
            session = nil
            RecordDeck.shared.hush(false)
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
                .buttonStyle(.plain)
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
                    .background(mine ? Color(hex: "#f1e0c4") : Color.paper2)
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

    private var laptops: some View {
        HStack(alignment: .top, spacing: 12) {
            GlyphView(glyph: Icons.tv, scale: 3)
            Text("Netflix and Prime Video: for now, watch them together on a laptop with the Soultied extension.")
                .font(.pxSmall)
                .foregroundStyle(Color.paper.opacity(0.75))
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.top, 4)
    }
}

/* ---------- the room, with the YouTube player in the TV ---------- */

struct WatchRoomView: View {
    let place: PlaceModel
    let session: WatchSession
    /// how wide it's shown, in points
    let width: CGFloat
    @Environment(\.displayScale) private var displayScale
    @State private var renderer = WatchRenderer()
    @State private var start = Date()

    /// the part of the room shown: the TV, the two of you, the couch
    private static let top = 6.0
    private static let shown = (x: 72.0, w: 176.0)

    private var state: WatchState {
        let mine: AvatarConfig? = place.myLook, theirs: AvatarConfig? = place.theirLook
        var st = WatchState(left: session.mySeat == .left ? mine : theirs, right: session.mySeat == .left ? theirs : mine, tv: session.tv)
        st.reactions = session.reactions
        return st
    }

    /// screen points per room pixel: whole screen pixels each, as big as the TV and the couch fit across
    private var u: CGFloat { max(1, (width * displayScale / CGFloat(Self.shown.w)).rounded(.down)) / displayScale }

    var body: some View {
        let W = width
        let u = self.u
        let ox = W / 2 - CGFloat(TV_SCREEN.x + TV_SCREEN.w / 2) * u
        let oy = -CGFloat(Self.top) * u
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
            if session.videoId != nil {
                YouTubeTVView(session: session)
                    .frame(width: CGFloat(TV_SCREEN.w) * u, height: CGFloat(TV_SCREEN.h) * u)
                    .offset(x: ox + CGFloat(TV_SCREEN.x) * u, y: oy + CGFloat(TV_SCREEN.y) * u)
            }
        }
        .frame(width: W, height: (CGFloat(WATCH_H) - CGFloat(Self.top)) * u, alignment: .topLeading)
        .clipped()
        .overlay(Rectangle().stroke(Color.ink, lineWidth: 3))
        .accessibilityElement(children: .contain)
        .accessibilityLabel(session.videoId == nil ? "The TV is off. Paste a YouTube link below to put something on." : "The TV")
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
            playerVars:{start:\(Int(max(0, start))),playsinline:1,rel:0,autoplay:\(autoplay ? 1 : 0),origin:'https://soultied.app'},
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
