import Foundation

/*
 * Continue watching: the shows and videos the two of you were part way through, on YouTube, Netflix and
 * Prime Video, as a shelf of pixel video tapes (the title written on the label, the tape wound on as far as
 * you got). Kept in meta/stream's `shows`, with YouTube's videos under `youtube:<id>`.
 *
 * Worked out exactly as the website does (src/watch/tapes.ts, checked against scripts/native-fixtures.ts),
 * so a phone and a laptop show the same tapes.
 */

/// one tape on the shelf
public struct Tape: Identifiable, Equatable, Sendable {
    /// the show (or the YouTube video), as kept under `shows`
    public let key: String
    /// youtube, netflix, prime, …: what's before the colon in the episode's key
    public let platform: String
    /// the show's name, or the video's title
    public let show: String
    /// "S2:E4 · The Pollywog" (empty for a film or a video)
    public let episode: String
    public let url: String
    /// seconds in
    public let pos: Double
    /// how long it is, in seconds (0: not known)
    public let dur: Double
    /// when it was last watched (ms)
    public let at: Double
    /// who watched it last: a person's id, "both" (together), or "" (not known)
    public let by: String

    public var id: String { key }

    public init(key: String, platform: String, show: String, episode: String, url: String, pos: Double, dur: Double, at: Double, by: String) {
        self.key = key
        self.platform = platform
        self.show = show
        self.episode = episode
        self.url = url
        self.pos = pos
        self.dur = dur
        self.at = at
        self.by = by
    }

    /// the YouTube video's id, for a YouTube tape
    public var videoId: String? { platform == "youtube" ? String(key.dropFirst("youtube:".count)) : nil }
    /// what's written on the label: "Dark S1:E3", or the video's title
    public var title: String { episode.isEmpty ? show : "\(show) \(episode.components(separatedBy: " · ")[0])" }
    /// how far through, 0 to 1 (0 when it's not known how long it is)
    public var share: Double { dur > 0 ? min(1, max(0, pos / dur)) : 0 }
    /// where to carry on from, a few seconds back so you catch the line again
    public var resumeAt: Double { Tapes.resumeAt(pos) }
    public var resumeURL: String { Tapes.resumeURL(self) }
    /// "23 min left", "1 hr 5 min left", "stopped at 42:10"
    public var left: String { Tapes.left(self) }
    public var service: String { Tapes.service(platform) }
}

public enum Tapes {
    /// a tape older than this has gone back on the shelf for good (ms)
    public static let staleMs: Double = 60 * 24 * 3600 * 1000
    /// the sites the app can carry on with (the website also has JioHotstar and the rest)
    public static let appPlatforms = ["youtube", "netflix", "prime"]

    private static func num(_ v: Any?) -> Double {
        if v is String || v is Bool { return 0 }
        guard let n = Values.num(v), n.isFinite else { return 0 }
        return n
    }

    public static func youTubeKey(_ id: String) -> String { "youtube:\(id)" }

    /// the start of an episode's key ("netflix:80100172"), or a show's ("netflix-show:dark")
    public static func platform(_ key: String) -> String {
        guard let i = key.firstIndex(of: ":"), i > key.startIndex else { return "" }
        let p = String(key[..<i])
        return p.hasSuffix("-show") ? String(p.dropLast(5)) : p
    }

    /// finished (or as good as): no tape for it
    public static func done(_ pos: Double, _ dur: Double) -> Bool { dur > 0 && dur - pos < max(20, dur * 0.03) }

    /// the tapes, newest first, leaving out what's finished, what you'd only just started, what's not been
    /// touched in two months, and (with `platforms`) the other sites
    public static func from(_ raw: Doc?, now: Double, max: Int = 6, platforms: [String]? = nil) -> [Tape] {
        guard let shows = raw?["shows"] as? Doc else { return [] }
        var out: [Tape] = []
        for (k, any) in shows {
            guard let v = any as? Doc else { continue }
            let ep = (v["key"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? k
            let p = platform(ep)
            let url = (v["url"] as? String) ?? ""
            if p.isEmpty || url.isEmpty { continue }
            if let platforms, !platforms.contains(p) { continue }
            let pos = num(v["pos"]), dur = num(v["dur"]), at = num(v["at"])
            if pos < 10 || done(pos, dur) || now - at > staleMs { continue }
            // (Netflix and Prime only ever note what you watched together)
            let by = (v["by"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? (p == "youtube" ? "" : "both")
            let show = (v["show"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? "Something"
            out.append(Tape(key: k, platform: p, show: show, episode: (v["episode"] as? String) ?? "", url: url, pos: pos, dur: dur, at: at, by: by))
        }
        out.sort { $0.at != $1.at ? $0.at > $1.at : $0.key < $1.key }
        return Array(out.prefix(Swift.max(0, max)))
    }

    public static func resumeAt(_ pos: Double) -> Double { Swift.max(0, pos.rounded(.down) - 5) }

    /// where to go to carry on: YouTube and Netflix from the moment you stopped; Prime remembers for itself
    public static func resumeURL(_ t: Tape) -> String {
        let at = Int(resumeAt(t.pos))
        if let id = t.videoId { return "https://www.youtube.com/watch?v=\(id)&t=\(at)" }
        let join = t.url.contains("?") ? "&" : "?"
        if t.platform == "netflix" { return "\(t.url)\(join)t=\(at)" }
        if t.platform == "prime" { return "\(t.url)\(join)autoplay=1" }
        return t.url
    }

    /// 1:02:05 / 42:10
    public static func clock(_ sec: Double) -> String {
        let s = Swift.max(0, Int(sec.isFinite ? sec.rounded(.down) : 0))
        let h = s / 3600, m = (s % 3600) / 60
        let ss = String(format: "%02d", s % 60)
        return h > 0 ? "\(h):\(String(format: "%02d", m)):\(ss)" : "\(m):\(ss)"
    }

    public static func left(_ t: Tape) -> String {
        if t.dur <= 0 { return "stopped at \(clock(t.pos))" }
        let m = Swift.max(1, Int(((t.dur - t.pos) / 60).rounded()))
        if m < 60 { return "\(m) min left" }
        let h = m / 60, r = m % 60
        return r > 0 ? "\(h) hr \(r) min left" : "\(h) hr left"
    }

    /// Math.round, as the website rounds (halves go up, also below zero)
    private static func round(_ x: Double) -> Int { Int((x + 0.5).rounded(.down)) }

    /// "just now", "12 min ago", "3 hours ago", "yesterday", "4 days ago", "2 weeks ago"
    public static func ago(_ at: Double, now: Double) -> String {
        let m = round((now - at) / 60000)
        if m < 2 { return "just now" }
        if m < 60 { return "\(m) min ago" }
        let h = round(Double(m) / 60)
        if h < 24 { return "\(h) \(h == 1 ? "hour" : "hours") ago" }
        let d = round(Double(h) / 24)
        if d < 7 { return d == 1 ? "yesterday" : "\(d) days ago" }
        let w = round(Double(d) / 7)
        return "\(w) \(w == 1 ? "week" : "weeks") ago"
    }

    /// who had it on last: "Together, yesterday", "You, 3 hours ago", "Rohan, just now"
    public static func who(_ t: Tape, me: String, theirName: String, now: Double) -> String {
        let who = t.by == "both" ? "Together" : t.by == me ? "You" : !t.by.isEmpty ? (theirName.isEmpty ? "Your person" : theirName) : ""
        let a = ago(t.at, now: now)
        return who.isEmpty ? a.prefix(1).uppercased() + a.dropFirst() : "\(who), \(a)"
    }

    public static func service(_ platform: String) -> String {
        switch platform {
        case "youtube": return "YouTube"
        case "netflix": return "Netflix"
        case "prime": return "Prime Video"
        case "hotstar": return "JioHotstar"
        case "sonyliv": return "Sony LIV"
        case "zee5": return "ZEE5"
        case "disney": return "Disney+"
        case "hulu": return "Hulu"
        case "hbomax": return "Max"
        case "crunchyroll": return "Crunchyroll"
        default: return "A show"
        }
    }

    /// what YouTube's room writes as you watch (merged into meta/stream)
    public static func youTubePatch(id: String, title: String, pos: Double, dur: Double, by: String, at: Double) -> Doc {
        let key = youTubeKey(id)
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let cut = String(decoding: Array(trimmed.utf16.prefix(120)), as: UTF16.self)
        let entry: Doc = [
            "show": cut.isEmpty ? "A YouTube video" : cut,
            "episode": "",
            "key": key,
            "url": "https://www.youtube.com/watch?v=\(id)",
            "pos": pos.isFinite ? Int(pos.rounded(.down)) : 0,
            "dur": dur > 0 && dur.isFinite ? Int(dur.rounded(.down)) : 0,
            "by": by,
            "at": at,
        ]
        return ["shows": [key: entry]]
    }

    /// the demo's shelf: a YouTube video Rohan carried on with, an episode of Dark and one of Good Omens
    public static func demo(now: Double, them: String) -> Doc {
        let h = 3600.0 * 1000
        var shows = (youTubePatch(id: "M7lc1UVf-VE", title: "A whole Sunday roast in a tiny kitchen", pos: 754, dur: 1820, by: them, at: now - 3 * h)["shows"] as? Doc) ?? [:]
        shows["netflix-show:dark"] = ["show": "Dark", "episode": "S1:E3 · Past and Present", "key": "netflix:80100173", "url": "https://www.netflix.com/watch/80100173", "pos": 1312, "dur": 3060, "by": "both", "at": now - 26 * h] as Doc
        shows["prime-show:good-omens"] = ["show": "Good Omens", "episode": "S1:E2 · The Book", "key": "prime:B07FMHTRFH", "url": "https://www.primevideo.com/detail/B07FMHTRFH", "pos": 1903, "dur": 3240, "by": "both", "at": now - 98 * h] as Doc
        return ["shows": shows]
    }

    /* ---------- the tape itself, in pixels ---------- */

    public static let width = 52
    public static let height = 30
    /// where the label is, so its words can sit on it (in the tape's own pixels)
    public static let label = (x: 4, y: 3, w: 44, h: 12)

    /// the stripe across the top of the label: one colour per site (no logos)
    public static func stripe(_ platform: String) -> String {
        switch platform {
        case "youtube": return "#c4473d"
        case "netflix": return "#8e2f28"
        case "prime": return "#3c6a9a"
        case "hotstar": return "#4b4fa0"
        case "disney": return "#355e9a"
        case "hbomax": return "#5b3f8f"
        case "crunchyroll": return "#c9772f"
        default: return "#6f7f5a"
        }
    }

    /// tape wound on the right as far as you've got, still to come on the left (squared radii)
    private static let reel = [0, 2, 5, 8, 10]

    /// a video tape, 52 x 30: a dark shell, a cream label with a coloured stripe, and a window onto the two
    /// reels, wound as far as you've got (one character a pixel, "." clear)
    public static func sprite(share: Double, platform: String) -> (rows: [String], pal: [String: String]) {
        let W = width, H = height
        var g = Array(repeating: Array(repeating: Character("b"), count: W), count: H)
        func set(_ x: Int, _ y: Int, _ k: Character) {
            if x >= 0, y >= 0, x < W, y < H { g[y][x] = k }
        }
        for x in 0..<W {
            set(x, 0, "o")
            set(x, H - 1, "o")
            set(x, 1, "h")
        }
        for y in 0..<H {
            set(0, y, "o")
            set(W - 1, y, "o")
        }
        for (x, y) in [(0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1)] { set(x, y, ".") }
        set(1, 1, "o")
        set(W - 2, 1, "o")
        set(3, H - 3, "h")
        set(W - 4, H - 3, "h")
        let L = label
        for y in L.y..<(L.y + L.h) {
            for x in L.x..<(L.x + L.w) { set(x, y, y < L.y + 2 ? "s" : "l") }
        }
        for x in (L.x + 1)...(L.x + L.w) { set(x, L.y + L.h, "d") }
        let wx = 11, wy = 17, ww = 30, wh = 9
        for y in wy..<(wy + wh) {
            for x in wx..<(wx + ww) { set(x, y, x == wx || y == wy || x == wx + ww - 1 || y == wy + wh - 1 ? "g" : "w") }
        }
        let step = Swift.max(0, Swift.min(4, Int((share * 4).rounded())))
        func drawReel(_ cx: Int, _ r2: Int) {
            for dy in -3...3 {
                for dx in -3...3 {
                    let d2 = dx * dx + dy * dy
                    if d2 == 0 { set(cx + dx, 21 + dy, "w") }
                    else if d2 <= 1 { set(cx + dx, 21 + dy, "c") }
                    else if d2 <= r2 { set(cx + dx, 21 + dy, "r") }
                }
            }
        }
        drawReel(18, reel[4 - step])
        drawReel(33, reel[step])
        for x in 18...33 where g[24][x] == "w" { set(x, 24, "t") }
        let pal = ["o": "#1a1416", "b": "#3a3034", "h": "#54474c", "l": "#f3e6cc", "s": stripe(platform), "d": "#241c1f", "g": "#2a2124", "w": "#120e10", "r": "#6b4430", "c": "#e3d6bd", "t": "#4a2f22"]
        return (g.map { String($0) }, pal)
    }

    public static func glyph(_ t: Tape) -> Glyph {
        let s = sprite(share: t.share, platform: t.platform)
        return Glyph(s.rows, Dictionary(uniqueKeysWithValues: s.pal.map { (Character($0.key), $0.value) }))
    }
}
