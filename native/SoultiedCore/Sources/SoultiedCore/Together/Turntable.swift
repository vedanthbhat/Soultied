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
    public var url: URL { URL(string: "https://soultied.app/audio/\(slug).mp3")! }
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

    public static let artist = "Kevin MacLeod"
    public static let sourceURL = URL(string: "https://incompetech.com")!
    public static let license = "CC BY 4.0"
    public static let licenseURL = URL(string: "https://creativecommons.org/licenses/by/4.0/")!

    /// a record left on switches itself off after a while, so nobody walks back in to music hours later
    public static let autoOffMs: Double = 2 * 60 * 60 * 1000

    /// the whole record, once through, in milliseconds (added up in the website's order, so it's the same number)
    public static let recordMs: Double = tracks.reduce(0) { $0 + $1.secs * 1000 }

    /// where each track starts on the record, in milliseconds
    static let starts: [Double] = {
        var acc: [Double] = []
        for i in tracks.indices { acc.append(i == 0 ? 0 : acc[i - 1] + tracks[i - 1].secs * 1000) }
        return acc
    }()

    /// what's playing at `now` on a record that started at `startedAt` (it goes round and round)
    public static func whereAt(_ startedAt: Double, _ now: Double) -> (index: Int, offset: Double) {
        var into = (now - startedAt).truncatingRemainder(dividingBy: recordMs)
        if into < 0 { into += recordMs }
        for i in stride(from: tracks.count - 1, through: 0, by: -1) where into >= starts[i] {
            return (i, (into - starts[i]) / 1000)
        }
        return (0, 0)
    }

    /// the startedAt that puts track `index` right at its beginning at `now`
    public static func startFor(_ index: Int, _ now: Double) -> Double {
        let n = tracks.count
        return now - starts[((index % n) + n) % n]
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
        return ["on": on, "startedAt": startedAt, "by": by, "at": at, "next": next, "yt": song]
    }

    /// playing, for both of you (a record left on goes quiet after two hours)
    public func isOn(_ now: Double) -> Bool { on && now - at < Records.autoOffMs }

    /// the jazz record's track right now (nil while it's off or a song from YouTube is on)
    public func track(_ now: Double) -> RecordTrack? {
        guard isOn(now), yt == nil else { return nil }
        return Records.tracks[Records.whereAt(startedAt, now).index]
    }

    /* ---------- what each button writes (src/music/TurntableContext.tsx) ---------- */

    /// put the jazz record on, from the track after the last one heard
    public static func jazz(_ prev: TurntableState?, by me: String, now: Double) -> TurntableState {
        let next = prev.map { $0.next % Records.tracks.count } ?? 0
        return TurntableState(on: true, startedAt: Records.startFor(next, now), by: me, at: now, next: next, yt: nil)
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
        let n = Records.tracks.count
        let next = yt != nil ? next % n : (Records.whereAt(startedAt, now).index + 1) % n
        return TurntableState(on: false, startedAt: startedAt, by: me, at: now, next: next, yt: nil)
    }

    /// on to the next track of the record (nil for a song, or when it's off)
    public func skipped(by me: String, now: Double) -> TurntableState? {
        guard isOn(now), yt == nil else { return nil }
        var t = self
        t.startedAt = Records.startFor(Records.whereAt(startedAt, now).index + 1, now)
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
