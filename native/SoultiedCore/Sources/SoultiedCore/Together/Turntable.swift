import Foundation

/*
 * The record player in the living room (src/music/records.ts and src/music/TurntableContext.tsx), kept in the
 * place's meta/turntable document, the same one the website uses.
 *
 * When one of you puts the record on, it plays for both of you. The shared state is only "on, and when the
 * first track would have started", so each phone works out the same track and the same spot in it from the
 * clock. A song from YouTube can go on instead; then startedAt is when its first second would have played.
 * Either of you can skip or lift the needle, and each of you can turn it down or mute it just for yourself
 * (that part stays on the phone).
 */

public struct RecordTrack: Sendable, Equatable, Identifiable {
    public let slug: String
    public let title: String
    /// its length in seconds
    public let secs: Double

    public var id: String { slug }
    /// the same 96 kbps MP3 the website plays
    public var url: URL { Records.tracks.contains(self)
        ? URL(string: "https://soultied.app/audio/\(slug).mp3")!
        : URL(string: "https://soultied.app/audio/shelf/\(slug).wav")! }
}

/// The record: five soft jazz tracks by Kevin MacLeod (incompetech.com), CC BY 4.0. The credit shows whenever
/// one is playing.
public enum Records {
    public static let tracks: [RecordTrack] = [
        RecordTrack(slug: "study-and-relax", title: "Study And Relax", secs: 223.452),
        RecordTrack(slug: "smooth-lovin", title: "Smooth Lovin", secs: 259.452),
        RecordTrack(slug: "night-in-venice", title: "Night in Venice", secs: 218.196),
        RecordTrack(slug: "bossa-antigua", title: "Bossa Antigua", secs: 283.392),
        RecordTrack(slug: "cool-vibes", title: "Cool Vibes", secs: 218.448),
    ]

    public static let shelf: [(id: String, title: String, tracks: [RecordTrack])] = [
        ("jazz", "Jazz café", tracks),
        ("lofi", "Lo-fi evening", [
            RecordTrack(slug: "lofi-1", title: "Window Seat", secs: 48),
            RecordTrack(slug: "lofi-2", title: "Last Train", secs: 48),
            RecordTrack(slug: "lofi-3", title: "Lamp Light", secs: 48),
        ]),
        ("piano", "Soft piano", [
            RecordTrack(slug: "piano-1", title: "Little Hours", secs: 48),
            RecordTrack(slug: "piano-2", title: "Two Teacups", secs: 48),
            RecordTrack(slug: "piano-3", title: "First Light", secs: 48),
        ]),
        ("acoustic", "Acoustic morning", [
            RecordTrack(slug: "acoustic-1", title: "Open Window", secs: 48),
            RecordTrack(slug: "acoustic-2", title: "Sunday Walk", secs: 48),
            RecordTrack(slug: "acoustic-3", title: "Golden Hour", secs: 48),
        ]),
        ("rain", "Rainy day", [
            RecordTrack(slug: "rain-1", title: "Rain on Glass", secs: 48),
            RecordTrack(slug: "rain-2", title: "Under One Roof", secs: 48),
            RecordTrack(slug: "rain-3", title: "After the Shower", secs: 48),
        ]),
        ("arcade", "Retro arcade", [
            RecordTrack(slug: "arcade-1", title: "Extra Heart", secs: 48),
            RecordTrack(slug: "arcade-2", title: "Player Two", secs: 48),
            RecordTrack(slug: "arcade-3", title: "Save Point", secs: 48),
        ]),
    ]
    public static func selection(_ id: String) -> [RecordTrack] { shelf.first { $0.id == id }?.tracks ?? tracks }

    public static let artist = "Kevin MacLeod"
    public static let sourceURL = URL(string: "https://incompetech.com")!
    public static let license = "CC BY 4.0"
    public static let licenseURL = URL(string: "https://creativecommons.org/licenses/by/4.0/")!

    /// a record left on switches itself off after a while, so nobody walks back in to music hours later
    public static let autoOffMs: Double = 2 * 60 * 60 * 1000

    /// the whole record, once through, in milliseconds (added up in the website's order, so it's the same number)
    public static let recordMs: Double = tracks.reduce(0) { $0 + $1.secs * 1000 }

    /// where each track starts on the record, in milliseconds
    public static func whereAt(_ startedAt: Double, _ now: Double, album: String = "jazz") -> (index: Int, offset: Double) {
        let songs = selection(album)
        let duration = songs.reduce(0.0) { $0 + $1.secs * 1000 }
        var ms = (now - startedAt).truncatingRemainder(dividingBy: duration)
        if ms < 0 { ms += duration }
        for (index, track) in songs.enumerated() {
            if ms < track.secs * 1000 { return (index, ms / 1000) }
            ms -= track.secs * 1000
        }
        return (0, 0)
    }

    /// the startedAt that puts track `index` right at its beginning at `now`
    public static func startFor(_ index: Int, _ now: Double, album: String = "jazz") -> Double {
        let tracks = selection(album)
        let n = tracks.count
        return now - tracks.prefix(((index % n) + n) % n).reduce(0.0) { $0 + $1.secs * 1000 }
    }
}

/// What's on the turntable, shared between the two of you.
public struct TurntableState: Sendable, Equatable {
    /// a song from YouTube on the turntable instead of the record
    public struct Song: Sendable, Equatable {
        public var id: String
        /// once its player knows it
        public var title: String?

        public init(id: String, title: String? = nil) {
            self.id = id
            self.title = title
        }
    }

    public var album = "jazz"
    public var on = false
    /// when the first track (or the song's first second) would have played (epoch ms)
    public var startedAt: Double = 0
    /// who last put the needle down or lifted it
    public var by = ""
    public var at: Double = 0
    /// the track to start from next time
    public var next = 0
    public var yt: Song?

    public init(on: Bool = false, startedAt: Double = 0, by: String = "", at: Double = 0, next: Int = 0, yt: Song? = nil) {
        self.on = on
        self.startedAt = startedAt
        self.by = by
        self.at = at
        self.next = next
        self.yt = yt
    }

    public init?(_ raw: Doc?) {
        guard let r = raw else { return nil }
        album = r.str("album") ?? "jazz"
        on = r.bool("on")
        startedAt = r.num("startedAt") ?? 0
        by = r.str("by") ?? ""
        at = r.num("at") ?? 0
        next = r.int("next") ?? 0
        if let s = r["yt"] as? Doc, let id = s.str("id"), YouTubeLink.isId(id) {
            yt = Song(id: id, title: s.str("title"))
        }
    }

    /// as the website writes it (the whole document each time)
    public var doc: Doc {
        var song: Any = NSNull()
        if let yt {
            var s: Doc = ["id": yt.id]
            if let t = yt.title { s["title"] = t }
            song = s
        }
        return ["album": album, "on": on, "startedAt": startedAt, "by": by, "at": at, "next": next, "yt": song]
    }

    /// playing, for both of you (a record left on goes quiet after two hours)
    public func isOn(_ now: Double) -> Bool { on && now - at < Records.autoOffMs }

    /// the jazz record's track right now (nil while it's off or a song from YouTube is on)
    public func track(_ now: Double) -> RecordTrack? {
        guard isOn(now), yt == nil else { return nil }
        return Records.selection(album)[Records.whereAt(startedAt, now, album: album).index]
    }

    /* ---------- what each button writes (src/music/TurntableContext.tsx) ---------- */

    /// put the jazz record on, from the track after the last one heard
    public static func jazz(_ prev: TurntableState?, by me: String, now: Double, album: String = "jazz") -> TurntableState {
        let next = prev?.album == album ? (prev?.next ?? 0) % Records.selection(album).count : 0
        var t = TurntableState(on: true, startedAt: Records.startFor(next, now, album: album), by: me, at: now, next: next, yt: nil)
        t.album = album
        return t
    }

    /// put a song from YouTube on (nil if the link isn't one)
    public static func song(_ link: String, _ prev: TurntableState?, by me: String, now: Double) -> TurntableState? {
        guard let id = YouTubeLink.id(link) else { return nil }
        let next = prev.map { $0.next % Records.tracks.count } ?? 0
        return TurntableState(on: true, startedAt: now - YouTubeLink.start(link) * 1000, by: me, at: now, next: next, yt: Song(id: id))
    }

    /// lift the needle (nil if nothing's playing); the record starts from the next track next time
    public func lifted(by me: String, now: Double) -> TurntableState? {
        guard isOn(now) else { return nil }
        let n = Records.selection(album).count
        let next = yt != nil ? next % n : (Records.whereAt(startedAt, now, album: album).index + 1) % n
        var t = TurntableState(on: false, startedAt: startedAt, by: me, at: now, next: next, yt: nil)
        t.album = album
        return t
    }

    /// on to the next track of the record (nil for a song, or when it's off)
    public func skipped(by me: String, now: Double) -> TurntableState? {
        guard isOn(now), yt == nil else { return nil }
        var t = self
        t.startedAt = Records.startFor(Records.whereAt(startedAt, now, album: album).index + 1, now, album: album)
        t.by = me
        t.at = now
        return t
    }

    /// the song's title, written down once by whoever put it on
    public func titled(_ id: String, _ title: String, me: String, now: Double) -> TurntableState? {
        guard isOn(now), let s = yt, s.id == id, s.title == nil, by == me, !title.isEmpty else { return nil }
        var t = self
        t.yt = Song(id: id, title: String(title.prefix(120)))
        return t
    }

    /// the song finished (or can't play): the needle lifts for both of you
    public func songEnded(_ id: String, by me: String, now: Double) -> TurntableState? {
        guard isOn(now), yt?.id == id else { return nil }
        return TurntableState(on: false, startedAt: startedAt, by: me, at: now, next: next % Records.tracks.count, yt: nil)
    }
}

/// Reading a YouTube link the way the website does (src/watch/youtube.ts).
public enum YouTubeLink {
    static func isId(_ s: String) -> Bool {
        s.count == 11 && s.unicodeScalars.allSatisfy { CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-").contains($0) }
    }

    private static func url(_ input: String) -> URLComponents? {
        let s = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !s.isEmpty, !s.contains(" ") else { return nil }
        guard let c = URLComponents(string: s.hasPrefix("http") ? s : "https://\(s)"), let host = c.host, !host.isEmpty else { return nil }
        return c
    }

    /// the video's id, from a link (youtu.be/…, youtube.com/watch?v=…, /shorts/…, /embed/…, music.youtube.com) or a bare id
    public static func id(_ input: String) -> String? {
        let s = input.trimmingCharacters(in: .whitespacesAndNewlines)
        if isId(s) { return s }
        guard let u = url(s), var host = u.host?.lowercased() else { return nil }
        for p in ["www.", "m.", "music."] where host.hasPrefix(p) {
            host.removeFirst(p.count)
            break
        }
        if host == "youtu.be" {
            let id = String(u.path.dropFirst().prefix(11))
            return isId(id) ? id : nil
        }
        if host.hasSuffix("youtube.com") || host.hasSuffix("youtube-nocookie.com") {
            if let v = u.queryItems?.first(where: { $0.name == "v" })?.value, !v.isEmpty { return isId(v) ? v : nil }
            for p in ["/shorts/", "/embed/", "/live/", "/v/"] where u.path.hasPrefix(p) {
                let id = String(u.path.dropFirst(p.count).prefix(11))
                if isId(id) { return id }
            }
        }
        return nil
    }

    /// where to start, from ?t=90, ?t=1m30s or ?start=90, in seconds (0 if none)
    public static func start(_ input: String) -> Double {
        guard let u = url(input) else { return 0 }
        let items = u.queryItems ?? []
        let value = { (name: String) in items.first(where: { $0.name == name })?.value ?? "" }
        let t = value("t").isEmpty ? value("start") : value("t")
        guard !t.isEmpty else { return 0 }
        if t.allSatisfy(\.isASCIIDigit) { return Double(t) ?? 0 }
        // 1h2m3s, any part left out
        var total = 0.0
        var num = ""
        var seen: [Character] = []
        for ch in t {
            if ch.isASCIIDigit {
                num.append(ch)
                continue
            }
            guard let unit = ["h": 3600.0, "m": 60.0, "s": 1.0][ch], !num.isEmpty, !seen.contains(ch),
                  seen.allSatisfy({ "hms".firstIndex(of: $0)! < "hms".firstIndex(of: ch)! }) else { return 0 }
            seen.append(ch)
            total += (Double(num) ?? 0) * unit
            num = ""
        }
        return num.isEmpty ? total : 0
    }
}

private extension Character {
    var isASCIIDigit: Bool { ("0"..."9").contains(self) }
}
