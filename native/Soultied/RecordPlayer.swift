import AVFoundation
import SwiftUI
import WebKit
import SoultiedCore

/*
 * The record player in the living room, as on the website (src/music/TurntableContext.tsx and
 * src/components/NowPlaying.tsx). Whatever one of you puts on plays for both of you: the jazz record from the
 * same MP3s the website plays, or a song from YouTube in its own little player. Each phone works out the same
 * spot from the shared start time. Volume and "mute for me" stay on this phone.
 */

/// The jazz record, coming out of this phone in step with the shared start time.
@Observable
final class RecordDeck {
    static let shared = RecordDeck()

    /// sound is coming out of this phone
    private(set) var hearing = false
    /// fetching the track before it can play
    private(set) var loading = false
    private(set) var problem: String?
    private(set) var volume: Double
    private(set) var mutedForMe: Bool
    /// a song from YouTube is playing here (its player says so)
    var songHearing = false

    @ObservationIgnored private weak var place: PlaceModel?
    @ObservationIgnored private var player: AVAudioPlayer?
    @ObservationIgnored private var slug: String?
    @ObservationIgnored private var timer: Timer?
    @ObservationIgnored private var fetching: Set<String> = []
    @ObservationIgnored private var awake = true
    private let ender = Ender()
    /// on its way down to silence (and a pause)
    @ObservationIgnored private var fadingOut = false
    @ObservationIgnored private var observers: [NSObjectProtocol] = []

    private static let volumeKey = "soultied_turntable_volume"
    private static let mutedKey = "soultied_turntable_muted"

    /// tells the deck a track finished, so the next one goes on
    private final class Ender: NSObject, AVAudioPlayerDelegate {
        var done: () -> Void = {}
        func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) { done() }
    }

    private init() {
        let d = UserDefaults.standard
        volume = (d.object(forKey: Self.volumeKey) as? Double).map { min(1, max(0, $0)) } ?? 0.6
        mutedForMe = d.bool(forKey: Self.mutedKey)
        ender.done = { [weak self] in self?.sync() }
        let c = NotificationCenter.default
        observers = [
            c.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
                self?.awake = false
                self?.sync()
            },
            c.addObserver(forName: UIApplication.willEnterForegroundNotification, object: nil, queue: .main) { [weak self] _ in
                self?.awake = true
                self?.sync()
            },
        ]
    }

    /// follow this place's record player
    func bind(_ p: PlaceModel) {
        if place !== p {
            place = p
            stopNow()
        }
        if timer == nil {
            let t = Timer(timeInterval: 5, repeats: true) { [weak self] _ in self?.sync() }
            RunLoop.main.add(t, forMode: .common)
            timer = t
        }
        sync()
    }

    func unbind() {
        timer?.invalidate()
        timer = nil
        place = nil
        stopNow()
    }

    func setVolume(_ v: Double) {
        volume = min(1, max(0, v))
        UserDefaults.standard.set(volume, forKey: Self.volumeKey)
        player?.volume = Float(volume)
    }

    func setMuted(_ m: Bool) {
        mutedForMe = m
        UserDefaults.standard.set(m, forKey: Self.mutedKey)
        sync()
    }

    /// whether the jazz record should be coming out of this phone right now
    private var wantsRecord: Bool {
        guard awake, !mutedForMe, let t = place?.turntable else { return false }
        return t.isOn(Values.nowMs()) && t.yt == nil
    }

    /// line the player up with the record: the right track, at the right spot, playing or not
    func sync() {
        guard wantsRecord, let t = place?.turntable else {
            fadeOut()
            return
        }
        problem = nil
        let n = Records.tracks.count
        var (index, offset) = Records.whereAt(t.startedAt, Values.nowMs())
        // right at the end of a track: on to the next one rather than replaying the last moment
        if offset > Records.tracks[index].secs - 0.4 {
            index = (index + 1) % n
            offset = 0
        }
        let track = Records.tracks[index]
        guard let file = cached(track) else {
            loading = true
            fetch(track)
            return
        }
        loading = false
        if slug != track.slug || player == nil {
            player?.stop()
            guard let p = try? AVAudioPlayer(contentsOf: file) else {
                // a broken copy: fetch it again
                try? FileManager.default.removeItem(at: file)
                return
            }
            p.delegate = ender
            p.volume = 0
            p.prepareToPlay()
            player = p
            slug = track.slug
        }
        guard let p = player else { return }
        let spot = min(offset, max(0, p.duration - 0.2))
        if !p.isPlaying {
            fadingOut = false
            p.currentTime = spot
            session(true)
            p.volume = 0
            p.play()
            p.setVolume(Float(volume), fadeDuration: 1.4)
        } else {
            if fadingOut {
                // wanted again before it went quiet
                fadingOut = false
                p.setVolume(Float(volume), fadeDuration: 0.3)
            }
            if abs(p.currentTime - spot) > 4 { p.currentTime = spot }
        }
        hearing = true
        // the next track, ready for when this one ends
        fetch(Records.tracks[(index + 1) % n])
    }

    private func fadeOut() {
        loading = false
        hearing = false
        guard let p = player, p.isPlaying else {
            if !songHearing { session(false) }
            return
        }
        if fadingOut { return }
        fadingOut = true
        p.setVolume(0, fadeDuration: 0.5)
        let deck = self
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.55) {
            guard deck.fadingOut, deck.player === p else { return }
            deck.fadingOut = false
            p.pause()
            if !deck.songHearing { deck.session(false) }
        }
    }

    private func stopNow() {
        fadingOut = false
        player?.stop()
        player = nil
        slug = nil
        hearing = false
        loading = false
    }

    /// Music plays with the ring switch on silent, like any music app, and mixes with whatever else is playing.
    /// Otherwise the room's little sounds follow the switch (see Chiptune).
    func session(_ music: Bool) {
        let s = AVAudioSession.sharedInstance()
        if music {
            try? s.setCategory(.playback, options: [.mixWithOthers])
        } else {
            try? s.setCategory(.ambient, options: [.mixWithOthers])
        }
        try? s.setActive(true)
    }

    /* ---------- the record's tracks, fetched once and kept ---------- */

    private var folder: URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("records", isDirectory: true)
    }

    private func cached(_ t: RecordTrack) -> URL? {
        let u = folder.appendingPathComponent("\(t.slug).mp3")
        return FileManager.default.fileExists(atPath: u.path) ? u : nil
    }

    private func fetch(_ t: RecordTrack) {
        guard cached(t) == nil, !fetching.contains(t.slug) else { return }
        fetching.insert(t.slug)
        let dest = folder.appendingPathComponent("\(t.slug).mp3")
        // (the deck lives as long as the app, so holding on to it here is fine)
        let deck = self
        Task {
            let ok = await Self.download(t.url, to: dest)
            DispatchQueue.main.async { deck.fetched(t.slug, ok) }
        }
    }

    private static func download(_ url: URL, to dest: URL) async -> Bool {
        do {
            let (tmp, resp) = try await URLSession.shared.download(from: url)
            guard (resp as? HTTPURLResponse)?.statusCode == 200 else { return false }
            try FileManager.default.createDirectory(at: dest.deletingLastPathComponent(), withIntermediateDirectories: true)
            try? FileManager.default.removeItem(at: dest)
            try FileManager.default.moveItem(at: tmp, to: dest)
            return true
        } catch {
            return false
        }
    }

    private func fetched(_ slug: String, _ ok: Bool) {
        fetching.remove(slug)
        if ok {
            sync()
        } else if loading && self.slug != slug {
            loading = false
            problem = "The record didn’t load. Check your connection, then tap Listen."
        }
    }
}

/* ---------- on Home: what's on, and its buttons ---------- */

/// The record player's card: what's playing (with the credit the music asks for), or a way to put something on.
struct RecordCard: View {
    let place: PlaceModel
    /// Home is on screen, so a song from YouTube can play in its player here
    var listening = true
    var open: () -> Void
    @State private var deck = RecordDeck.shared

    var body: some View {
        let t = place.turntable
        let on = place.recordOn
        VStack(alignment: .leading, spacing: 12) {
            if on, let t, let song = t.yt {
                SongCard(place: place, state: t, song: song, listening: listening, open: open)
            } else if on, let t, let track = t.track(Values.nowMs()) {
                jazz(t, track)
            } else {
                off
            }
        }
        .padding(14)
        .pxBox(.paper)
    }

    private var off: some View {
        Button(action: open) {
            HStack(spacing: 12) {
                GlyphView(glyph: Icons.record, scale: 4)
                VStack(alignment: .leading, spacing: 2) {
                    Text("The record player").font(.pxHeading).foregroundStyle(Color.inkSoft)
                    Text("Put a record on. It plays for both of you, in sync.").font(.pxSmall).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
                Text("→").font(.px(18, 700)).foregroundStyle(Color.terracottaD)
            }
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func jazz(_ t: TurntableState, _ track: RecordTrack) -> some View {
        HStack(alignment: .top, spacing: 12) {
            SpinningRecord(on: deck.hearing)
            VStack(alignment: .leading, spacing: 3) {
                Text(track.title).font(.pxBodyBold).foregroundStyle(Color.inkSoft)
                RecordCredit()
                if let who = byLine(t) { Text(who).font(.pxSmall).foregroundStyle(Color.muted) }
            }
            Spacer(minLength: 0)
        }
        if deck.loading {
            Text("Getting the record out of its sleeve…").font(.pxSmall).foregroundStyle(Color.muted)
        } else if let p = deck.problem {
            HStack(spacing: 8) {
                Text(p).font(.pxSmall).foregroundStyle(Color.thread).fixedSize(horizontal: false, vertical: true)
                Button("Listen") { deck.sync() }.buttonStyle(.px(.sage, small: true))
            }
        }
        VolumeRow()
        HStack(spacing: 8) {
            Button("Next") {
                Haptics.tap()
                place.nextTrack()
            }
            .buttonStyle(.px(.paper, small: true))
            Button("A song instead", action: open).buttonStyle(.px(.paper, small: true))
            Button("Lift the needle") {
                Haptics.tap()
                place.liftNeedle()
            }
            .buttonStyle(.px(.paper, small: true))
        }
    }

    private func byLine(_ t: TurntableState) -> String? {
        guard let them = place.them, t.by == them else { return nil }
        return "\(place.theirName) put this on"
    }
}

/// a song from YouTube: its player (which stays in view, as YouTube asks), and its buttons
private struct SongCard: View {
    let place: PlaceModel
    let state: TurntableState
    let song: TurntableState.Song
    let listening: Bool
    var open: () -> Void
    @State private var deck = RecordDeck.shared
    @State private var title: String?
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if listening {
                SongPlayer(
                    id: song.id,
                    startedAt: state.startedAt,
                    play: !deck.mutedForMe,
                    volume: deck.volume,
                    onTitle: { t in
                        title = t
                        place.songTitle(song.id, t)
                    },
                    onHearing: { on in
                        deck.songHearing = on
                        deck.session(on || deck.hearing)
                    },
                    onEnded: { place.songEnded(song.id) },
                    onError: { code in error = SongPlayer.describe(code) }
                )
                .id("\(song.id)-\(state.startedAt)")
                .frame(height: 200)
                .frame(maxWidth: .infinity)
                .background(Color.black)
                .overlay(Rectangle().stroke(Color.ink, lineWidth: 3))
            }
            HStack(alignment: .top, spacing: 12) {
                SpinningRecord(on: deck.songHearing && listening)
                VStack(alignment: .leading, spacing: 3) {
                    Text(title ?? song.title ?? "A song from YouTube").font(.pxBodyBold).foregroundStyle(Color.inkSoft).lineLimit(2)
                    Text(fromLine).font(.pxSmall).foregroundStyle(Color.muted)
                }
                Spacer(minLength: 0)
            }
            if let e = error {
                VStack(alignment: .leading, spacing: 6) {
                    Text(e).font(.pxSmall).foregroundStyle(Color.thread).fixedSize(horizontal: false, vertical: true)
                    Button("Pick another", action: open).buttonStyle(.px(.paper, small: true))
                }
            }
            VolumeRow()
            HStack(spacing: 8) {
                Button("Another song", action: open).buttonStyle(.px(.paper, small: true))
                Button("Lift the needle") {
                    Haptics.tap()
                    place.liftNeedle()
                }
                .buttonStyle(.px(.paper, small: true))
            }
        }
        .onAppear {
            // music plays with the ring switch on silent (set before the player starts)
            if listening && !deck.mutedForMe { deck.session(true) }
        }
        .onDisappear {
            // (only the card whose player was playing)
            guard listening else { return }
            deck.songHearing = false
            deck.sync()
        }
    }

    private var fromLine: String {
        guard let them = place.them, state.by == them else { return "From YouTube" }
        return "From YouTube · \(place.theirName) put this on"
    }
}

/// mute for me, and how loud (both just on this phone)
private struct VolumeRow: View {
    @State private var deck = RecordDeck.shared

    var body: some View {
        HStack(spacing: 10) {
            Button(deck.mutedForMe ? "Unmute" : "Mute for me") { deck.setMuted(!deck.mutedForMe) }
                .buttonStyle(.px(.paper, small: true))
            Slider(value: Binding(get: { deck.volume }, set: { deck.setVolume($0) }), in: 0...1)
                .tint(Color.terracotta)
                .accessibilityLabel("Volume")
        }
    }
}

/// the record's credit, as its licence asks
struct RecordCredit: View {
    @Environment(\.openURL) private var openURL

    var body: some View {
        HStack(spacing: 4) {
            Text(Records.artist).font(.pxSmall).foregroundStyle(Color.muted)
            Button("(incompetech.com)") { openURL(Records.sourceURL) }.font(.pxSmall).foregroundStyle(Color.muted).underline()
            Text("·").font(.pxSmall).foregroundStyle(Color.muted)
            Button(Records.license) { openURL(Records.licenseURL) }.font(.pxSmall).foregroundStyle(Color.muted).underline()
        }
        .buttonStyle(.plain)
    }
}

/// the little record, going round while it plays
struct SpinningRecord: View {
    var on: Bool
    var scale: CGFloat = 3

    var body: some View {
        TimelineView(.periodic(from: .now, by: 0.225)) { ctx in
            let step = on ? Int(ctx.date.timeIntervalSinceReferenceDate / 0.225) % 8 : 0
            GlyphView(glyph: Icons.record, scale: scale)
                .rotationEffect(.degrees(Double(step) * 45))
        }
        .frame(width: 9 * scale, height: 9 * scale)
    }
}

/* ---------- choosing what goes on ---------- */

/// The record player: the jazz record, or a song from YouTube.
struct RecordSheet: View {
    let place: PlaceModel
    /// sideways there's no Home behind this, so a song plays here
    var hostsSong = false
    @Environment(\.dismiss) private var dismiss
    @State private var link = ""
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("The record player").font(.pxTitle).foregroundStyle(Color.inkSoft)
                    Text("Whatever you put on plays for both of you, in sync.").font(.pxBody).foregroundStyle(Color.muted)
                }
                if place.recordOn {
                    RecordCard(place: place, listening: hostsSong, open: {})
                }
                HStack(spacing: 12) {
                    GlyphView(glyph: Icons.record, scale: 4)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Our jazz record").font(.pxBodyBold).foregroundStyle(Color.inkSoft)
                        Text("Five soft jazz tracks, round and round.").font(.pxSmall).foregroundStyle(Color.muted)
                    }
                    Spacer(minLength: 0)
                    Button("Put it on") {
                        Haptics.tap()
                        place.playRecord()
                        RecordDeck.shared.bind(place)
                        if RecordDeck.shared.mutedForMe { RecordDeck.shared.setMuted(false) }
                        dismiss()
                    }
                    .buttonStyle(.px(.terracotta, small: true))
                }
                .padding(12)
                .pxInset()

                VStack(alignment: .leading, spacing: 8) {
                    PixelLabel(text: "A song from YouTube")
                    Text("Paste a link from YouTube or YouTube Music (Share > Copy link).").font(.pxSmall).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
                    PixelField(placeholder: "https://music.youtube.com/watch?v=…", text: $link, limit: 300)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                        .onChange(of: link) { _, _ in error = nil }
                    if let e = error { Text(e).font(.pxSmall).foregroundStyle(Color.thread).fixedSize(horizontal: false, vertical: true) }
                    HStack(spacing: 8) {
                        Button("Paste") {
                            if let s = UIPasteboard.general.string { link = s }
                        }
                        .buttonStyle(.px(.paper, small: true))
                        Button("Play") {
                            error = place.playSong(link)
                            if error == nil {
                                Haptics.tap()
                                if RecordDeck.shared.mutedForMe { RecordDeck.shared.setMuted(false) }
                                link = ""
                                dismiss()
                            }
                        }
                        .buttonStyle(.px(.terracotta, small: true))
                        .disabled(link.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }
            }
            .padding(20)
        }
        .scrollDismissesKeyboard(.interactively)
    }
}

/* ---------- a song from YouTube, in YouTube's own player ---------- */

/// One YouTube player, kept at the shared spot in the song (the website's SongPlayer, in a web view).
struct SongPlayer: UIViewRepresentable {
    let id: String
    let startedAt: Double
    let play: Bool
    let volume: Double
    var onTitle: (String) -> Void
    var onHearing: (Bool) -> Void
    var onEnded: () -> Void
    var onError: (Int) -> Void

    static func describe(_ code: Int) -> String {
        switch code {
        case 101, 150: return "This song’s owner doesn’t allow it to be played outside YouTube. Try another one."
        case 100: return "That song couldn’t be found. It may be private or removed."
        case 2: return "That doesn’t look like a song on YouTube."
        default: return "YouTube had trouble playing that song. Try again or pick another."
        }
    }

    final class Coordinator: NSObject, WKScriptMessageHandler {
        var parent: SongPlayer
        init(_ p: SongPlayer) { parent = p }

        func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let m = message.body as? [String: Any], let kind = m["kind"] as? String else { return }
            switch kind {
            case "title": if let t = m["title"] as? String, !t.isEmpty { parent.onTitle(t) }
            case "hearing": parent.onHearing((m["on"] as? Bool) ?? false)
            case "ended": parent.onEnded()
            case "error": parent.onError((m["code"] as? Int) ?? -1)
            default: break
            }
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> WKWebView {
        let c = WKWebViewConfiguration()
        c.allowsInlineMediaPlayback = true
        c.mediaTypesRequiringUserActionForPlayback = []
        c.userContentController.add(context.coordinator, name: "song")
        let w = WKWebView(frame: .zero, configuration: c)
        w.isOpaque = false
        w.backgroundColor = .black
        w.scrollView.isScrollEnabled = false
        w.scrollView.bounces = false
        // from soultied.app's address, which YouTube's player expects to be told where it's playing
        w.loadHTMLString(Self.page(id: id, startedAt: startedAt, volume: volume, play: play), baseURL: URL(string: "https://soultied.app/"))
        return w
    }

    func updateUIView(_ w: WKWebView, context: Context) {
        context.coordinator.parent = self
        w.evaluateJavaScript("window.want && want(\(play ? "true" : "false"), \(Int((volume * 100).rounded())))", completionHandler: nil)
    }

    static func dismantleUIView(_ w: WKWebView, coordinator: Coordinator) {
        w.evaluateJavaScript("window.stop && stop()", completionHandler: nil)
        w.configuration.userContentController.removeScriptMessageHandler(forName: "song")
        coordinator.parent.onHearing(false)
    }

    /// the player page: lines the song up with the shared start every second and a half, as the website does
    static func page(id: String, startedAt: Double, volume: Double, play: Bool) -> String {
        let startMs = String(format: "%.0f", startedAt)
        return """
        <!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
        <style>html,body{margin:0;height:100%;background:#000;overflow:hidden}#p{width:100%;height:100%}</style></head>
        <body><div id="p"></div><script>
        var startedAt=\(startMs), wantPlay=\(play ? "true" : "false"), vol=\(Int((volume * 100).rounded())), player=null, ready=false, ended=false, tries=0, DRIFT=2.5;
        function say(m){try{window.webkit.messageHandlers.song.postMessage(m)}catch(e){}}
        function at(){return Math.max(0,(Date.now()-startedAt)/1000)}
        function title(){try{var d=player.getVideoData();if(d&&d.title)say({kind:'title',title:d.title})}catch(e){}}
        function line(){
          if(!player||!ready||ended)return;
          var dur=player.getDuration?player.getDuration():0;
          if(dur>0&&at()>dur-0.4){ended=true;say({kind:'hearing',on:false});say({kind:'ended'});return}
          var st=player.getPlayerState();
          if(!wantPlay){if(st===1||st===3)player.pauseVideo();say({kind:'hearing',on:false});return}
          if(st===1){tries=0;if(Math.abs(player.getCurrentTime()-at())>DRIFT)player.seekTo(at(),true);return}
          if(st===3)return;
          player.seekTo(at(),true);player.playVideo();tries++;
        }
        function want(p,v){wantPlay=p;vol=v;if(ready){try{player.setVolume(v)}catch(e){}}line()}
        function stop(){ended=true;try{player.stopVideo()}catch(e){}}
        function onYouTubeIframeAPIReady(){
          player=new YT.Player('p',{videoId:'\(id)',width:'100%',height:'100%',
            playerVars:{start:Math.floor(at()),playsinline:1,rel:0,iv_load_policy:3,fs:0,autoplay:1,origin:'https://soultied.app'},
            events:{
              onReady:function(e){ready=true;try{e.target.setVolume(vol)}catch(x){}title();line()},
              onStateChange:function(e){
                if(e.data===1){say({kind:'hearing',on:true});title()}
                else if(e.data===2)say({kind:'hearing',on:false});
                else if(e.data===0&&!ended){ended=true;say({kind:'hearing',on:false});say({kind:'ended'})}
              },
              onError:function(e){say({kind:'hearing',on:false});say({kind:'error',code:e.data})}
            }});
          setInterval(line,1500);
        }
        </script><script src="https://www.youtube.com/iframe_api"></script></body></html>
        """
    }
}
