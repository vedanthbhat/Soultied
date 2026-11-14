import Foundation

/*
 * Our wall (src/together/board.ts, wall.ts): notes and doodles you pin up for each other, your photos,
 * and the memories you keep.
 *
 *   meta/board         who pinned something last, what each of you has seen, the picture over the couch
 *   meta/note-…        one note or doodle each
 *   meta/photo-…       one photo each: a small copy for the wall, and its caption
 *   meta/photobig-…    the same photo, big, read only when you open it
 *   meta/memories      the memories you write down
 *
 * Nothing is deleted outright (the database doesn't allow it): taking something down marks it gone.
 */

public let ART_W = 24
public let ART_H = 18

public enum ArtKind: String, Sendable { case doodle, photo }

/// a tiny picture for the frame over the couch: each character of `px` indexes `pal`
public struct WallArt: Sendable, Equatable {
    public var pal: [String]
    public var px: String
    public var kind: ArtKind
    /// the note or photo it came from
    public var ref: String
    public var by: String
    public var at: Double

    public init(pal: [String], px: String, kind: ArtKind, ref: String, by: String, at: Double) {
        self.pal = pal
        self.px = px
        self.kind = kind
        self.ref = ref
        self.by = by
        self.at = at
    }

    public init?(_ raw: Any?) {
        guard let a = raw as? Doc, a.int("w") == ART_W, a.int("h") == ART_H, let px = a.str("px"), px.count == ART_W * ART_H else { return nil }
        let pal = a.list("pal").compactMap { $0 as? String }.filter(isHex).prefix(16)
        if pal.isEmpty { return nil }
        self.pal = Array(pal)
        self.px = px
        kind = a.str("kind") == "photo" ? .photo : .doodle
        ref = a.str("ref") ?? ""
        by = a.str("by") ?? ""
        at = a.num("at") ?? 0
    }

    public var doc: Doc { ["w": ART_W, "h": ART_H, "pal": pal, "px": px, "kind": kind.rawValue, "ref": ref, "by": by, "at": at] }

    /// for the room's renderer
    public var pixels: WallArtPixels { WallArtPixels(w: ART_W, h: ART_H, pal: pal.map { RGB($0) }, px: px) }
}

func isHex(_ s: String) -> Bool {
    s.count == 7 && s.hasPrefix("#") && s.dropFirst().allSatisfy { $0.isHexDigit }
}

public enum PinKind: String, Sendable { case text, doodle, photo, voice }

public struct BoardDoc: Sendable, Equatable {
    /// when each of you last pinned something up
    public var last: [String: (at: Double, kind: PinKind)] = [:]
    /// when each of you last looked at the wall (their clock)
    public var seen: [String: Double] = [:]
    public var art: WallArt?
    /// the last doodle each of you pinned up (note id; for your person's home-screen widget)
    public var drew: [String: (id: String, at: Double)] = [:]

    public init() {}

    public init(_ raw: Doc?) {
        let r = raw ?? [:]
        for (uid, v) in r.map("last") {
            guard let x = v as? Doc, let at = x.num("at") else { continue }
            last[uid] = (at, PinKind(rawValue: x.str("kind") ?? "") ?? .text)
        }
        seen = numbers(r.map("seen"))
        art = WallArt(r["art"])
        for (uid, v) in r.map("drew") {
            guard let x = v as? Doc, let id = x.str("id"), let at = x.num("at") else { continue }
            drew[uid] = (id, at)
        }
    }

    public static func == (a: BoardDoc, b: BoardDoc) -> Bool {
        a.seen == b.seen && a.art == b.art && a.last.mapValues { "\($0.at)\($0.kind)" } == b.last.mapValues { "\($0.at)\($0.kind)" }
            && a.drew.mapValues { "\($0.id)\($0.at)" } == b.drew.mapValues { "\($0.id)\($0.at)" }
    }

    /// something your person pinned up since you last looked
    public func news(me: String, them: String?) -> (at: Double, kind: PinKind)? {
        guard let them, let l = last[them], l.at > (seen[me] ?? 0) else { return nil }
        return l
    }
}

/* ---------- doodles ---------- */

/// a doodle is 96 × 72, one hex digit a pixel. (The first ones were 48 × 36: they're still read, each pixel drawn 2 × 2.)
public let DOODLE_W = 96
public let DOODLE_H = 72
public let OLD_DOODLE_W = 48
public let OLD_DOODLE_H = 36
/// index 0 is the paper; the rest are the pens
public let DOODLE_PAL = [
    "#fbf3e2", "#3a2a26", "#fffaf0", "#c4453f", "#ef8f88", "#e07b39", "#d99a2b", "#f2d66b",
    "#7a9a5a", "#4f7a45", "#7fb2d9", "#4f6fb0", "#9a86c8", "#8a5a3c", "#f0c8a0", "#8d8a99",
]

public enum Doodle {
    public static func blank() -> [UInt8] { Array(repeating: 0, count: DOODLE_W * DOODLE_H) }

    private static func hexOnly(_ s: String) -> Bool { s.utf8.allSatisfy { (48...57).contains($0) || (97...102).contains($0) } }

    /// today's size, or the first, smaller one
    public static func isDoodle(_ s: String?) -> Bool {
        guard let s else { return false }
        let n = s.utf8.count
        return (n == DOODLE_W * DOODLE_H || n == OLD_DOODLE_W * OLD_DOODLE_H) && hexOnly(s)
    }

    /// today's size only
    public static func isFull(_ s: String?) -> Bool {
        guard let s else { return false }
        return s.utf8.count == DOODLE_W * DOODLE_H && hexOnly(s)
    }

    public static func encode(_ px: [UInt8]) -> String { String(px.map { Character(String($0 & 15, radix: 16)) }) }
    public static func decode(_ s: String) -> [UInt8] { full(s).map { UInt8(String($0), radix: 16) ?? 0 } }

    /// any doodle at today's size (each pixel of an old, small one made 2 × 2)
    public static func full(_ s: String) -> String {
        let px = Array(s.utf8)
        if px.count == DOODLE_W * DOODLE_H { return s }
        var out = [UInt8]()
        out.reserveCapacity(DOODLE_W * DOODLE_H)
        for y in 0..<DOODLE_H {
            for x in 0..<DOODLE_W {
                let i = (y >> 1) * OLD_DOODLE_W + (x >> 1)
                out.append(i < px.count ? px[i] : 48)
            }
        }
        return String(decoding: out, as: UTF8.self)
    }

    /// shrunk by a whole number: each f × f block takes its most-used ink (the paper only if it's all paper), so a fine line survives
    static func shrink(_ s: String, w: Int, f: Int) -> String {
        let px = Array(s.utf8)
        let h = px.count / w
        var out = [UInt8]()
        for y in 0..<(h / f) {
            for x in 0..<(w / f) {
                var order: [UInt8] = []
                var n: [UInt8: Int] = [:]
                for dy in 0..<f {
                    for dx in 0..<f {
                        let c = px[(y * f + dy) * w + x * f + dx]
                        if c != 48 {
                            if n[c] == nil { order.append(c) }
                            n[c, default: 0] += 1
                        }
                    }
                }
                var best: UInt8 = 48
                var most = 0
                for c in order where n[c]! > most {
                    best = c
                    most = n[c]!
                }
                out.append(best)
            }
        }
        return String(decoding: out, as: UTF8.self)
    }

    /// at the first, smaller size (what's kept in `doodle`, for an app from before; today's apps read `hd`)
    public static func small(_ s: String) -> String { shrink(full(s), w: DOODLE_W, f: DOODLE_W / OLD_DOODLE_W) }

    /// shrunk for the frame over the couch
    public static func art(_ s: String, ref: String, by: String, at: Double = Values.nowMs()) -> WallArt {
        WallArt(pal: DOODLE_PAL, px: shrink(full(s), w: DOODLE_W, f: DOODLE_W / ART_W), kind: .doodle, ref: ref, by: by, at: at)
    }

    /// a little doodle drawn from rows of characters (for the demo room's wall)
    static func sketch(_ rows: [String], _ key: [Character: UInt8], _ ox: Int, _ oy: Int) -> String {
        // (drawn on the first, smaller paper, then made today's size)
        var a = [UInt8](repeating: 0, count: OLD_DOODLE_W * OLD_DOODLE_H)
        for (j, row) in rows.enumerated() {
            for (i, ch) in row.enumerated() {
                if let k = key[ch], oy + j < OLD_DOODLE_H, ox + i < OLD_DOODLE_W { a[(oy + j) * OLD_DOODLE_W + ox + i] = k }
            }
        }
        return full(encode(a))
    }

    /// Rohan's doodle in the demo: a cup of tea and a heart, with steam.
    public static let demo = sketch(
        [
            ".......s....s..........................",
            "........s....s.........................",
            ".......s....s..........rr...rr.........",
            "........s....s........rrrr.rrrr........",
            ".....................rrrrrrrrrrr.......",
            "...bbbbbbbbbbbbbb....rrrrrrrrrrr.......",
            "...bccccccccccccbbb...rrrrrrrrr........",
            "...bccccccccccccb..b...rrrrrrr.........",
            "...bccccccccccccb..b....rrrrr..........",
            "...bccccccccccccb..b.....rrr...........",
            "...bccccccccccccbbb.......r............",
            "...bccccccccccccb......................",
            "....bccccccccccb.......................",
            ".....bbbbbbbbbb........................",
            "..pppppppppppppppp.....................",
        ],
        ["s": 15, "b": 13, "c": 14, "r": 3, "p": 1],
        4,
        9
    )
}

/* ---------- notes ---------- */

public let NOTE_PAPERS = ["#f6e39a", "#f4c2bd", "#cfe3b8", "#c4dcef", "#ddd0ef"]
public let NOTE_MAX = 280

public struct Note: Sendable, Identifiable, Equatable {
    public let id: String
    public var by: String
    public var kind: PinKind
    public var text: String
    /// 96 × 72, one hex digit a pixel (see DOODLE_PAL). Saved as `hd`, with a 48 × 36 copy in `doodle` for apps from before.
    public var doodle: String
    public var paper: Int
    public var at: Double
    /// who's put a heart on it
    public var loved: [String: Double]
    /// kept with your memories
    public var kept: Bool
    public var gone: Bool

    public init?(id: String, _ raw: Doc?) {
        guard let n = raw, let by = n.str("by") else { return nil }
        let kind: PinKind = n.str("kind") == "doodle" ? .doodle : .text
        let text = String((n.str("text") ?? "").prefix(NOTE_MAX))
        let doodle = Doodle.isFull(n.str("hd")) ? n.str("hd")! : Doodle.isDoodle(n.str("doodle")) ? Doodle.full(n.str("doodle")!) : ""
        if kind == .text ? text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty : doodle.isEmpty { return nil }
        self.id = id
        self.by = by
        self.kind = kind
        self.text = text
        self.doodle = doodle
        paper = max(0, min(NOTE_PAPERS.count - 1, n.int("paper") ?? 0))
        at = n.num("at") ?? 0
        loved = numbers(n.map("loved"))
        kept = n.bool("kept")
        gone = n.bool("gone")
    }

    public static func new(by: String, text: String, paper: Int) -> (id: String, doc: Doc) {
        (Values.newKey("note-"), ["by": by, "kind": "text", "text": String(text.prefix(NOTE_MAX)), "paper": paper, "at": Values.nowMs(), "loved": Doc(), "kept": false])
    }

    public static func new(by: String, doodle: String) -> (id: String, doc: Doc) {
        (Values.newKey("note-"), ["by": by, "kind": "doodle", "doodle": Doodle.small(doodle), "hd": Doodle.full(doodle), "paper": 0, "at": Values.nowMs(), "loved": Doc(), "kept": false])
    }
}

/* ---------- photos ---------- */

public let CAPTION_MAX = 120

public struct Photo: Sendable, Identifiable, Equatable {
    public let id: String
    public var by: String
    public var caption: String
    /// a small JPEG (a data: URL) for the wall
    public var thumb: String
    public var w: Double
    public var h: Double
    public var at: Double
    /// the day it was taken, if you said (YYYY-MM-DD)
    public var day: String
    public var kept: Bool
    public var gone: Bool

    public init?(id: String, _ raw: Doc?) {
        guard let p = raw, let by = p.str("by"), let thumb = p.str("thumb"), thumb.hasPrefix("data:image/") else { return nil }
        self.id = id
        self.by = by
        caption = String((p.str("caption") ?? "").prefix(CAPTION_MAX))
        self.thumb = thumb
        w = p.num("w") ?? 4
        h = p.num("h") ?? 3
        at = p.num("at") ?? 0
        day = isDayKey(p.str("day")) ? p.str("day")! : ""
        kept = (p["kept"] as? Bool) != false
        gone = p.bool("gone")
    }

    /// the big copy's document
    public var bigName: String { id.hasPrefix("photo-") ? "photobig-" + id.dropFirst(6) : id }
}

public func isDayKey(_ s: String?) -> Bool {
    guard let s, s.count == 10 else { return false }
    let c = Array(s)
    return c[4] == "-" && c[7] == "-" && [0, 1, 2, 3, 5, 6, 8, 9].allSatisfy { c[$0].isASCII && c[$0].isNumber }
}

/// data: URL bytes (photos are kept as data: URLs, as the website does)
public func dataURLBytes(_ s: String) -> Data? {
    guard let comma = s.firstIndex(of: ",") else { return nil }
    return Data(base64Encoded: String(s[s.index(after: comma)...]))
}

/* ---------- memories ---------- */

public let MEMORY_TITLE_MAX = 80
public let MEMORY_TEXT_MAX = 500

public struct Memory: Sendable, Identifiable, Equatable {
    public let id: String
    public var by: String
    public var title: String
    /// the day it happened, YYYY-MM-DD
    public var day: String
    public var text: String
    /// a photo from your wall to go with it
    public var photo: String
    public var at: Double

    public init(id: String, by: String, title: String, day: String, text: String, photo: String = "", at: Double) {
        self.id = id
        self.by = by
        self.title = title
        self.day = day
        self.text = text
        self.photo = photo
        self.at = at
    }

    public var doc: Doc { ["id": id, "by": by, "title": title, "day": day, "text": text, "photo": photo, "at": at] }
}

public func memories(_ raw: Doc?) -> [String: Memory] {
    var items: [String: Memory] = [:]
    for (id, v) in (raw ?? [:]).map("items") {
        guard let m = v as? Doc, let by = m.str("by"), isDayKey(m.str("day")) else { continue }
        let title = String((m.str("title") ?? "").prefix(MEMORY_TITLE_MAX)).trimmingCharacters(in: .whitespaces)
        if title.isEmpty { continue }
        items[id] = Memory(id: id, by: by, title: title, day: m.str("day")!, text: String((m.str("text") ?? "").prefix(MEMORY_TEXT_MAX)), photo: m.str("photo") ?? "", at: m.num("at") ?? 0)
    }
    return items
}

/* ---------- the timeline of memories ---------- */

public enum MomentKind: Sendable { case memory, note, photo, together, movedIn }

public struct Moment: Sendable, Identifiable {
    public let id: String
    public let kind: MomentKind
    public let day: String
    public let title: String
    public let text: String
    public let by: String?
    public let photo: String?
}

/// Everything you've kept, oldest first: written memories, kept notes and photos, your anniversary and the day you moved in.
public func timeline(memories: [Memory], notes: [Note], photos: [Photo], togetherSince: String?, movedIn: String?) -> [Moment] {
    var out: [Moment] = []
    for m in memories { out.append(Moment(id: m.id, kind: .memory, day: m.day, title: m.title, text: m.text, by: m.by, photo: m.photo.isEmpty ? nil : m.photo)) }
    for n in notes where n.kept && !n.gone {
        out.append(Moment(id: n.id, kind: .note, day: Day.today(Date(timeIntervalSince1970: n.at / 1000)), title: n.kind == .doodle ? "A doodle" : "A note", text: n.text, by: n.by, photo: nil))
    }
    for p in photos where p.kept && !p.gone {
        out.append(Moment(id: p.id, kind: .photo, day: p.day.isEmpty ? Day.today(Date(timeIntervalSince1970: p.at / 1000)) : p.day, title: p.caption.isEmpty ? "A photo" : p.caption, text: "", by: p.by, photo: p.id))
    }
    if let t = togetherSince, isDayKey(t) { out.append(Moment(id: "together", kind: .together, day: t, title: "Together since", text: "", by: nil, photo: nil)) }
    if let m = movedIn, isDayKey(m) { out.append(Moment(id: "moved-in", kind: .movedIn, day: m, title: "You moved into your little place", text: "", by: nil, photo: nil)) }
    return out.sorted { $0.day != $1.day ? $0.day < $1.day : $0.id < $1.id }
}

/// memories from this day in other years
public func onThisDay(_ moments: [Moment], today: String) -> [Moment] {
    let md = today.suffix(5)
    return moments.filter { $0.day.suffix(5) == md && $0.day != today }
}

/* ---------- a photo as a little pixel picture for the frame ---------- */

/// The middle 4:3 of a photo, already shrunk to 24 × 18 (RGB, 3 bytes a pixel), in 12 colours (k-means, as the website does).
public func photoArt(rgb: [UInt8], ref: String, by: String, at: Double = Values.nowMs()) -> WallArt? {
    let n = ART_W * ART_H
    guard rgb.count >= n * 3 else { return nil }
    let pts: [(Double, Double, Double)] = (0..<n).map { (Double(rgb[$0 * 3]), Double(rgb[$0 * 3 + 1]), Double(rgb[$0 * 3 + 2])) }
    let K = 12
    func lum(_ p: (Double, Double, Double)) -> Double { p.0 * 0.3 + p.1 * 0.59 + p.2 * 0.11 }
    let sorted = pts.sorted { lum($0) < lum($1) }
    var cents = (0..<K).map { k in sorted[Int(((Double(k) + 0.5) / Double(K) * Double(sorted.count)).rounded(.down))] }
    func near(_ p: (Double, Double, Double)) -> Int {
        var best = 0
        var bd = Double.infinity
        for (k, c) in cents.enumerated() {
            let d = (p.0 - c.0) * (p.0 - c.0) + (p.1 - c.1) * (p.1 - c.1) + (p.2 - c.2) * (p.2 - c.2)
            if d < bd {
                best = k
                bd = d
            }
        }
        return best
    }
    for _ in 0..<8 {
        var sum = [(Double, Double, Double, Double)](repeating: (0, 0, 0, 0), count: K)
        for p in pts {
            let k = near(p)
            sum[k].0 += p.0
            sum[k].1 += p.1
            sum[k].2 += p.2
            sum[k].3 += 1
        }
        cents = cents.enumerated().map { k, c in sum[k].3 > 0 ? (sum[k].0 / sum[k].3, sum[k].1 / sum[k].3, sum[k].2 / sum[k].3) : c }
    }
    let px = String(pts.map { Character(String(near($0), radix: 16)) })
    func hex(_ v: Double) -> String {
        let s = String(Int(max(0, min(255, v.rounded()))), radix: 16)
        return s.count < 2 ? "0" + s : s
    }
    let pal = cents.map { "#" + hex($0.0) + hex($0.1) + hex($0.2) }
    return WallArt(pal: pal, px: px, kind: .photo, ref: ref, by: by, at: at)
}
