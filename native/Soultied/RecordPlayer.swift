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
    /// a song's player is open here (so the sound stays on music while it stops to fetch)
    @ObservationIgnored var songOpen = false

    @ObservationIgnored private weak var place: PlaceModel?
    @ObservationIgnored private var player: AVAudioPlayer?
    @ObservationIgnored private var slug: String?
    @ObservationIgnored private var timer: Timer?
    @ObservationIgnored private var fetching: Set<String> = []
    @ObservationIgnored private var awake = true
    /// quiet while you're watching something together
    private(set) var hushed = false
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

    /// how many screens are following it (a new look draws the app again, and the new screen can arrive
    /// before the old one goes: the record keeps playing till the last one's gone)
    private var following = 0

    /// a screen starts following this place's record player
    func attach(_ p: PlaceModel) {
        following += 1
        bind(p)
    }

    /// and stops; the last one to go lifts the needle here
    func detach() {
        following = max(0, following - 1)
        if following == 0 { unbind() }
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

    /// Watch together is open (the record goes quiet, and comes back after)
    func hush(_ on: Bool) {
        hushed = on
        sync()
    }

    func setMuted(_ m: Bool) {
        mutedForMe = m
        UserDefaults.standard.set(m, forKey: Self.mutedKey)
        sync()
    }

    /// whether the jazz record should be coming out of this phone right now
    private var wantsRecord: Bool {
        guard awake, !mutedForMe, !hushed, let t = place?.turntable else { return false }
        return t.isOn(Values.nowMs()) && t.yt == nil
    }

    /// line the player up with the record: the right track, at the right spot, playing or not
    func sync() {
        guard wantsRecord, let t = place?.turntable else {
            fadeOut()
            return
        }
        problem = nil
        let tracks = Records.selection(t.album)
        let n = tracks.count
        var (index, offset) = Records.whereAt(t.startedAt, Values.nowMs(), album: t.album)
        // right at the end of a track: on to the next one rather than replaying the last moment
        if offset > tracks[index].secs - 0.4 {
            index = (index + 1) % n
            offset = 0
        }
        let track = tracks[index]
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
        fetch(tracks[(index + 1) % n])
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
    ///
    /// Only changed when it needs to be: changing it while a song's coming out of YouTube's player makes the
    /// sound drop for a moment, and it was being set again on every hiccup. While a song's player is open
    /// (and not muted here) it stays on music, even while the song stops to fetch.
    func session(_ music: Bool) {
        let s = AVAudioSession.sharedInstance()
        let want: AVAudioSession.Category = music || songHearing || (songOpen && !mutedForMe) ? .playback : .ambient
        if s.category != want || s.mode != .default || !s.categoryOptions.contains(.mixWithOthers) {
            try? s.setCategory(want, mode: .default, options: [.mixWithOthers])
        }
        try? s.setActive(true)
    }

    /* ---------- the record's tracks, fetched once and kept ---------- */

    private var folder: URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("records", isDirectory: true)
    }

    private func cached(_ t: RecordTrack) -> URL? {
        if let local = Bundle.main.url(forResource: t.slug, withExtension: "wav", subdirectory: "shelf") { return local }
        let u = folder.appendingPathComponent(t.url.lastPathComponent)
        return FileManager.default.fileExists(atPath: u.path) ? u : nil
    }

    private func fetch(_ t: RecordTrack) {
        guard cached(t) == nil, !fetching.contains(t.slug) else { return }
        fetching.insert(t.slug)
        let dest = folder.appendingPathComponent(t.url.lastPathComponent)
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

// (only ever used from the main thread: its timer, its player's callbacks and the app's notifications all arrive there)
extension RecordDeck: @unchecked Sendable {}

/* ---------- on Home: what's on, and its buttons ---------- */

/// The record player's card: what's playing (with the credit the music asks for), or a way to put something on.
struct RecordCard: View {
    let place: PlaceModel
    /// Home is on screen, so a song from YouTube can play in its player here
    var listening = true
    /// the record player's sheet (none when this card is in it)
    var open: (() -> Void)? = nil
    @State private var deck = RecordDeck.shared

    var body: some View {
        let t = place.turntable
        let on = place.recordOn
        VStack(alignment: .leading, spacing: 12) {
            if let t, let apple = t.apple {
                RoomSongControls(place: place, state: t, song: apple)
                if let open { Button("Record shelf", action: open).buttonStyle(.px(.paper, small: true)) }
            } else if on, let t, let song = t.yt {
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
        Button {
            open?()
        } label: {
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
        .buttonStyle(.press)
    }

    @ViewBuilder
    private func jazz(_ t: TurntableState, _ track: RecordTrack) -> some View {
        HStack(alignment: .top, spacing: 12) {
            SpinningRecord(on: deck.hearing)
            VStack(alignment: .leading, spacing: 3) {
                Text("NOW PLAYING · " + (Records.shelf.first { $0.id == t.album }?.title ?? "Jazz café").uppercased())
                    .font(.px(11, 700)).foregroundStyle(Color(hex: "#a84f4b"))
                Text(track.title).font(.pxBodyBold).foregroundStyle(Color.inkSoft)
                if t.album == "jazz" { RecordCredit() } else { Text("Soultied originals").font(.pxTiny) }
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
            Button("Next song") {
                Haptics.tap()
                place.nextTrack()
            }
            .buttonStyle(.px(.paper, small: true, wide: true))
            if let open { Button("Records", action: open).buttonStyle(.px(.paper, small: true, wide: true)) }
            Button("Lift the needle") {
                Haptics.tap()
                place.liftNeedle()
            }
            .buttonStyle(.px(.paper, small: true, wide: true))
        }.evenRow()
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
    var open: (() -> Void)?
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
                        if deck.songHearing != on { deck.songHearing = on }
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
                    if let open { Button("Pick another", action: open).buttonStyle(.px(.paper, small: true)) }
                }
            }
            VolumeRow()
            HStack(spacing: 8) {
                if let open { Button("Another song", action: open).buttonStyle(.px(.paper, small: true, wide: true)) }
                Button("Lift the needle") {
                    Haptics.tap()
                    place.liftNeedle()
                }
                .buttonStyle(.px(.paper, small: true, wide: true))
            }.evenRow()
        }
        .onAppear {
            // music plays with the ring switch on silent (set before the player starts)
            if listening {
                deck.songOpen = true
                if !deck.mutedForMe { deck.session(true) }
            }
        }
        .onDisappear {
            // (only the card whose player was playing)
            guard listening else { return }
            deck.songOpen = false
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
    /// (made as a plain string first: links written straight into a LocalizedStringKey with \(…) wouldn't be links;
    /// the licence's name keeps together, with no-break spaces)
    private static let line: String = Records.artist + " ([incompetech.com](" + Records.sourceURL.absoluteString + ")) · ["
        + Records.license.replacingOccurrences(of: " ", with: "\u{00A0}") + "](" + Records.licenseURL.absoluteString + ")"

    var body: some View {
        // one line of text with its two links, so it wraps between words
        Text(LocalizedStringKey(Self.line))
            .font(.pxSmall)
            .foregroundStyle(Color.muted)
            .tint(Color.terracottaD)
            .fixedSize(horizontal: false, vertical: true)
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
    @State private var choosing = false

    private static let songs = Records.shelf.reduce(0) { $0 + $1.tracks.count }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("The record player").font(.pxTitle).foregroundStyle(Color.inkSoft)
                    Text("Whatever you put on plays for both of you, in sync.").font(.pxBody).foregroundStyle(Color.muted)
                }
                if place.recordOn || place.turntable?.apple != nil {
                    RecordCard(place: place, listening: hostsSong)
                }
                HStack(alignment: .firstTextBaseline) {
                    Text("Records").font(.px(17, 700)).foregroundStyle(Color.inkSoft)
                    Spacer(minLength: 8)
                    Text("\(Records.shelf.count) records · \(Self.songs) songs, free to use").font(.px(12)).foregroundStyle(Color.muted)
                }
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10, alignment: .top), count: 3), spacing: 12) {
                    ForEach(Records.shelf, id: \.id) { record in
                        let playing = place.recordOn && place.turntable?.apple == nil && place.turntable?.album == record.id
                        Button {
                            Haptics.tap()
                            place.playRecord(record.id)
                            RecordDeck.shared.bind(place)
                            RecordDeck.shared.setMuted(false)
                            dismiss()
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                RecordSleeve(id: record.id, playing: playing)
                                Text(record.title).font(.px(13, 700)).foregroundStyle(Color.inkSoft)
                                    .lineLimit(2).fixedSize(horizontal: false, vertical: true)
                                Text("\(record.tracks.count) songs").font(.px(11)).foregroundStyle(Color.muted)
                            }
                            .frame(maxWidth: .infinity, alignment: .topLeading)
                        }
                        .buttonStyle(.press)
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("\(record.title), \(record.tracks.count) songs" + (playing ? ", playing" : ""))
                        .accessibilityAddTraits(.isButton)
                    }
                }
                ourSong
            }
            .padding(20)
        }
        .sheet(isPresented: $choosing) { RoomSongPicker(place: place) }
        .scrollDismissesKeyboard(.interactively)
    }

    /// Our song (Plus): any song from Apple Music, for both of you
    private var ourSong: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text("Our song").font(.px(15, 700)).foregroundStyle(Color(hex: "#fff4e2"))
                    Text("PLUS").font(.px(10, 700)).foregroundStyle(Color(hex: "#2b1e1c"))
                        .padding(.horizontal, 4).padding(.vertical, 1).background(Color(hex: "#e2b359"))
                }
                Text(place.ourSong.map { $0.artist.isEmpty ? $0.title : $0.title + " · " + $0.artist }
                     ?? "Any song from Apple Music, for both of you. You both need Apple Music.")
                    .font(.px(11)).foregroundStyle(Color(hex: "#e8d6bd")).fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
            Button { choosing = true } label: {
                Text("Choose").font(.px(13, 700)).foregroundStyle(Color(hex: "#2b1e1c"))
                    .padding(.horizontal, 10)
                    .frame(height: 34)
                    .background(Color(hex: "#e2b359"))
                    .overlay(alignment: .bottom) { Rectangle().fill(Color(hex: "#b88a32")).frame(height: 4) }
                    .padding(3)
                    .background(Color(hex: "#2b1e1c"))
            }
            .buttonStyle(.press)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Color(hex: "#3a2a2c"))
        .overlay(Rectangle().strokeBorder(Color(hex: "#e2b359"), lineWidth: 3))
        .background(Rectangle().fill(Color.black.opacity(0.3)).offset(x: 3, y: 3))
    }
}

/// a record's sleeve on the shelf, each with its own little picture (the record shelf design); the one playing has
/// a gold edge and its record peeking out
struct RecordSleeve: View {
    let id: String
    var playing = false

    var body: some View {
        Canvas { context, size in
            let g = context
            func box(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ hex: String) {
                g.fill(Path(CGRect(x: x, y: y, width: w, height: h)), with: .color(Color(hex: hex)))
            }
            func dot(_ x: CGFloat, _ y: CGFloat, _ d: CGFloat, _ hex: String) {
                g.fill(Path(ellipseIn: CGRect(x: x, y: y, width: d, height: d)), with: .color(Color(hex: hex)))
            }
            let w = size.width, h = size.height
            switch id {
            case "lofi":
                // a night sky: two stars and the moon
                box(0, 0, w, h, "#4a3a5a")
                box(10, 12, 6, 6, "#f2d48a")
                box(30, 30, 4, 4, "#fff4e2")
                dot(w - 32, 16, 18, "#f4ecd0")
            case "piano":
                // piano keys along the bottom
                box(0, 0, w, h, "#fff8ea")
                var x: CGFloat = 12
                while x < w { box(x, h - 30, 3, 30, "#2b1e1c"); x += 15 }
                for k: CGFloat in [9, 33, 60] { box(k, h - 30, 6, 18, "#2b1e1c") }
            case "acoustic":
                // the sun coming up over a hill
                box(0, 0, w, h, "#8a9a72")
                dot(w / 2 - 13, 14, 26, "#f2d66b")
                box(0, h - 22, w, 22, "#6a7856")
            case "rain":
                // rain on blue
                box(0, 0, w, h, "#5a79a3")
                let slant = h * 0.268
                var x: CGFloat = 9
                while x < w + slant {
                    var line = Path()
                    line.move(to: CGPoint(x: x, y: 0))
                    line.addLine(to: CGPoint(x: x - slant, y: h))
                    g.stroke(line, with: .color(Color.white.opacity(0.35)), lineWidth: 2)
                    x += 11.4
                }
            case "arcade":
                // three blocks falling
                box(0, 0, w, h, "#2b1e1c")
                box(12, 14, 12, 12, "#e2b359")
                box(36, 30, 12, 12, "#c4453f")
                box(60, 46, 12, 12, "#7fb2d9")
            default:
                // the jazz café: a note on terracotta
                box(0, 0, w, h, "#8f4b3a")
                box(18, 14, 3, 22, "#f2d48a")
                box(21, 14, 8, 3, "#f2d48a")
                box(26, 17, 3, 5, "#f2d48a")
                box(11, 31, 10, 7, "#f2d48a")
            }
            if playing {
                dot(w - 39, 11, 60, "#3a3035")
                dot(w - 36, 14, 54, "#1f1718")
            }
        }
        .frame(height: 78)
        .frame(maxWidth: .infinity)
        .overlay(alignment: .bottomLeading) {
            if playing { Text("PLAYING").font(.px(10, 700)).foregroundStyle(Color(hex: "#f2d48a")).padding(.leading, 7).padding(.bottom, 4) }
        }
        .padding(3)
        .overlay(Rectangle().strokeBorder(Color(hex: "#2b1e1c"), lineWidth: 3))
        .background(Rectangle().fill(Color.black.opacity(0.3)).offset(x: 3, y: 3))
        .overlay { if playing { Rectangle().strokeBorder(Color(hex: "#e2b359"), lineWidth: 3).padding(-4) } }
        .accessibilityHidden(true)
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
        /// what the page was last told (play, volume): it's only told again when that changes, not every time
        /// the screen around it is drawn again
        var told: (play: Bool, volume: Int)?
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
        context.coordinator.told = (play, Self.loud(volume))
        return w
    }

    func updateUIView(_ w: WKWebView, context: Context) {
        let c = context.coordinator
        c.parent = self
        let v = Self.loud(volume)
        if let t = c.told, t.play == play, t.volume == v { return }
        c.told = (play, v)
        w.evaluateJavaScript("window.want && want(\(play ? "true" : "false"), \(v))", completionHandler: nil)
    }

    private static func loud(_ volume: Double) -> Int { Int((min(1, max(0, volume)) * 100).rounded()) }

    static func dismantleUIView(_ w: WKWebView, coordinator: Coordinator) {
        w.evaluateJavaScript("window.stop && stop()", completionHandler: nil)
        w.configuration.userContentController.removeScriptMessageHandler(forName: "song")
        coordinator.parent.onHearing(false)
    }

    /// the player page: keeps the song at the shared spot without making it stutter (the website's
    /// music/songSync.ts: a few seconds out is fine, a nudge only once it's stayed out, and none for a while
    /// after a nudge or after YouTube had to stop and fetch)
    static func page(id: String, startedAt: Double, volume: Double, play: Bool) -> String {
        let startMs = String(format: "%.0f", startedAt)
        return """
        <!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
        <style>html,body{margin:0;height:100%;background:#000;overflow:hidden}#p{width:100%;height:100%}</style></head>
        <body><div id="p"></div><script>
        var startedAt=\(startMs), wantPlay=\(play ? "true" : "false"), vol=\(loud(volume)), player=null, ready=false, ended=false;
        var DRIFT=5, CHECKS=2, SETTLE=12000, off=0, calm=0, heard=null;
        function say(m){try{window.webkit.messageHandlers.song.postMessage(m)}catch(e){}}
        function hear(on){if(heard===on)return;heard=on;say({kind:'hearing',on:on})}
        function at(){return Math.max(0,(Date.now()-startedAt)/1000)}
        function title(){try{var d=player.getVideoData();if(d&&d.title)say({kind:'title',title:d.title})}catch(e){}}
        function cur(){try{return player.getCurrentTime()||0}catch(e){return 0}}
        function stalled(){off=0;calm=Date.now()+SETTLE}
        function line(){
          if(!player||!ready||ended)return;
          var dur=player.getDuration?player.getDuration():0;
          if(dur>0&&at()>dur-0.4){ended=true;hear(false);say({kind:'ended'});return}
          var st=player.getPlayerState(), now=Date.now();
          if(!wantPlay){off=0;if(st===1||st===3)player.pauseVideo();hear(false);return}
          if(st===1){
            if(now<calm||Math.abs(cur()-at())<=DRIFT){off=0;return}
            if(++off<CHECKS)return;
            off=0;calm=now+SETTLE;player.seekTo(at(),true);return;
          }
          if(st===3){stalled();return}
          off=0;calm=now+SETTLE;
          if(Math.abs(cur()-at())>DRIFT)player.seekTo(at(),true);
          player.playVideo();
        }
        function want(p,v){
          if(v!==vol){vol=v;if(ready){try{player.setVolume(v)}catch(e){}}}
          if(p!==wantPlay){wantPlay=p;line()}
        }
        function stop(){ended=true;try{player.stopVideo()}catch(e){}}
        function onYouTubeIframeAPIReady(){
          player=new YT.Player('p',{videoId:'\(id)',width:'100%',height:'100%',
            playerVars:{start:Math.floor(at()),playsinline:1,rel:0,iv_load_policy:3,fs:0,autoplay:1,origin:'https://soultied.app'},
            events:{
              onReady:function(e){ready=true;try{e.target.setVolume(vol)}catch(x){}title();line()},
              onStateChange:function(e){
                if(e.data===1){hear(true);title()}
                else if(e.data===2)hear(false);
                else if(e.data===3)stalled();
                else if(e.data===0&&!ended){ended=true;hear(false);say({kind:'ended'})}
              },
              onError:function(e){hear(false);say({kind:'error',code:e.data})}
            }});
          setInterval(line,1500);
        }
        </script><script src="https://www.youtube.com/iframe_api"></script></body></html>
        """
    }
}
