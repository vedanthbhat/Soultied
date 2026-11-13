import WidgetKit
import SwiftUI
import AppIntents
import UIKit
import SoultiedCore

/*
 * Soultied's home-screen widgets:
 *   Their doodle   your person's last doodle, in a frame (tap: draw one back)
 *   Our board      your newest wall photos as Polaroids on cork (tap: your photos)
 * The app leaves a way in (WidgetShare, a keychain group they share); the widgets look for new things
 * themselves (Firestore's REST API, signed in with Firebase's refresh token), every 20 minutes or so as iOS
 * allows, and straight away when the app sees something new.
 */

@main
struct SoultiedWidgets: WidgetBundle {
    var body: some Widget {
        DoodleWidget()
        BoardWidget()
    }
}

extension WidgetFamily {
    var faceSize: WidgetSize {
        switch self {
        case .systemSmall: return .small
        case .systemMedium: return .medium
        default: return .large
        }
    }
}

/* ---------- their doodle ---------- */

enum FrameChoice: String, AppEnum {
    case wood, gold, rose, night

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Frame"
    static var caseDisplayRepresentations: [FrameChoice: DisplayRepresentation] = [
        .wood: "Wood",
        .gold: "Gold",
        .rose: "Rose",
        .night: "Night",
    ]
}

struct FrameIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource { "Frame" }
    static var description: IntentDescription { "Pick the frame your person’s doodles hang in." }

    @Parameter(title: "Frame", default: .wood)
    var frame: FrameChoice

    init() {}
}

struct DoodleEntry: TimelineEntry {
    let date: Date
    let look: FrameLook
    let setUp: Bool
    let name: String
    let drawing: WidgetShare.Drawing?
}

struct DoodleProvider: AppIntentTimelineProvider {
    private func entry(_ s: WidgetShare.Saved, _ c: FrameIntent, _ at: Date) -> DoodleEntry {
        DoodleEntry(date: at, look: FrameLook(rawValue: c.frame.rawValue) ?? .wood, setUp: s.config != nil, name: s.config?.themName ?? "", drawing: s.drawing)
    }

    func placeholder(in context: Context) -> DoodleEntry {
        DoodleEntry(date: Date(), look: .wood, setUp: true, name: "Your person", drawing: WidgetShare.Drawing(id: "demo", px: Doodle.demo, at: Date().timeIntervalSince1970 * 1000 - 3 * 3600e3))
    }

    func snapshot(for configuration: FrameIntent, in context: Context) async -> DoodleEntry {
        let s = WidgetShare.load()
        if context.isPreview && s.drawing == nil {
            let p = placeholder(in: context)
            return DoodleEntry(date: p.date, look: FrameLook(rawValue: configuration.frame.rawValue) ?? .wood, setUp: true, name: p.name, drawing: p.drawing)
        }
        return entry(s, configuration, Date())
    }

    func timeline(for configuration: FrameIntent, in context: Context) async -> Timeline<DoodleEntry> {
        let s = await Fetch.freshDoodle()
        let now = Date()
        // (the same doodle, its "3 hours ago" kept true for a few hours, while iOS lets it look again)
        let entries = (0..<8).map { entry(s, configuration, now.addingTimeInterval(Double($0) * 30 * 60)) }
        return Timeline(entries: entries, policy: .after(now.addingTimeInterval(20 * 60)))
    }
}

struct DoodleWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: DoodleEntry
    var body: some View {
        DoodleCard(px: entry.drawing?.px, name: entry.name, at: entry.drawing?.at, look: entry.look, size: family.faceSize, setUp: entry.setUp, now: entry.date)
            .containerBackground(for: .widget) { FrameWall(look: entry.look) }
            .widgetURL(URL(string: "soultied://doodle"))
    }
}

struct DoodleWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: WidgetShare.kind, intent: FrameIntent.self, provider: DoodleProvider()) { entry in
            DoodleWidgetView(entry: entry)
        }
        .configurationDisplayName("Their doodle")
        .description("The last doodle your person drew you, in a frame. Tap it to draw one back.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}

/* ---------- our board ---------- */

struct BoardEntry: TimelineEntry {
    let date: Date
    let setUp: Bool
    let items: [BoardItem]
}

struct BoardProvider: TimelineProvider {
    func placeholder(in context: Context) -> BoardEntry {
        BoardEntry(date: Date(), setUp: true, items: [])
    }

    func getSnapshot(in context: Context, completion: @escaping (BoardEntry) -> Void) {
        completion(BoardEntry(date: Date(), setUp: WidgetShare.load().config != nil, items: Fetch.cachedBoard(withDoodle: context.family == .systemLarge)))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<BoardEntry>) -> Void) {
        let large = context.family == .systemLarge
        Task {
            await Fetch.freshBoard()
            let s = WidgetShare.load()
            let now = Date()
            completion(Timeline(entries: [BoardEntry(date: now, setUp: s.config != nil, items: Fetch.cachedBoard(withDoodle: large))], policy: .after(now.addingTimeInterval(30 * 60))))
        }
    }
}

struct BoardWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: BoardEntry
    var body: some View {
        BoardCard(items: entry.items, size: family.faceSize, setUp: entry.setUp)
            .containerBackground(for: .widget) { CorkBoard() }
            .widgetURL(URL(string: "soultied://photos"))
    }
}

struct BoardWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: WidgetShare.boardKind, provider: BoardProvider()) { entry in
            BoardWidgetView(entry: entry)
        }
        .configurationDisplayName("Our board")
        .description("Your newest wall photos, pinned up as Polaroids.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}

/* ---------- looking for new things (Firestore's REST API) ---------- */

enum Fetch {
    struct Bad: Error {}

    private static var cacheDir: URL {
        let d = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("soultied-widget", isDirectory: true)
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }

    private static func root(_ c: WidgetShare.Config) -> String {
        "https://firestore.googleapis.com/v1/projects/\(c.project)/databases/(default)/documents/spaces/\(c.sid)"
    }

    private static func name(_ c: WidgetShare.Config, _ id: String) -> String {
        "projects/\(c.project)/databases/(default)/documents/spaces/\(c.sid)/meta/\(id)"
    }

    /// a short-lived sign-in (kept until it's nearly out of date)
    private struct Token: Codable { var id: String; var until: Double; var uid: String }

    private static func token(_ c: WidgetShare.Config) async throws -> String {
        let file = cacheDir.appendingPathComponent("token.json")
        if let d = try? Data(contentsOf: file), let t = try? JSONDecoder().decode(Token.self, from: d), t.uid == c.me, t.until > Date().timeIntervalSince1970 + 120 {
            return t.id
        }
        guard !c.refresh.isEmpty, let url = URL(string: "https://securetoken.googleapis.com/v1/token?key=\(c.apiKey)") else { throw Bad() }
        var r = URLRequest(url: url)
        r.httpMethod = "POST"
        r.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        r.setValue(c.bundle, forHTTPHeaderField: "X-Ios-Bundle-Identifier")
        var form = URLComponents()
        form.queryItems = [URLQueryItem(name: "grant_type", value: "refresh_token"), URLQueryItem(name: "refresh_token", value: c.refresh)]
        r.httpBody = form.percentEncodedQuery?.data(using: .utf8)
        let (d, resp) = try await URLSession.shared.data(for: r)
        guard (resp as? HTTPURLResponse)?.statusCode == 200, let j = try JSONSerialization.jsonObject(with: d) as? [String: Any],
              let id = j["id_token"] as? String else { throw Bad() }
        let life = Double(j["expires_in"] as? String ?? "") ?? 3600
        if let t = try? JSONEncoder().encode(Token(id: id, until: Date().timeIntervalSince1970 + life, uid: c.me)) { try? t.write(to: file) }
        // (Firebase may hand back a new refresh token)
        if let fresh = j["refresh_token"] as? String, !fresh.isEmpty, fresh != c.refresh {
            var s = WidgetShare.load()
            s.config?.refresh = fresh
            WidgetShare.store(s)
        }
        return id
    }

    private static func request(_ url: String, _ token: String) throws -> URLRequest {
        guard let u = URL(string: url) else { throw Bad() }
        var r = URLRequest(url: u)
        r.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        r.timeoutInterval = 15
        return r
    }

    /// one document's fields, as plain values (nil if it isn't there)
    private static func get(_ url: String, _ token: String) async throws -> [String: Any]? {
        let (d, resp) = try await URLSession.shared.data(for: try request(url, token))
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        if code == 404 { return nil }
        guard code == 200, let j = try JSONSerialization.jsonObject(with: d) as? [String: Any] else { throw Bad() }
        return fields(j["fields"])
    }

    /// documents from a query: (id, fields)
    private static func query(_ c: WidgetShare.Config, _ token: String, _ q: [String: Any]) async throws -> [(String, [String: Any])] {
        var r = try request(root(c) + ":runQuery", token)
        r.httpMethod = "POST"
        r.setValue("application/json", forHTTPHeaderField: "Content-Type")
        r.httpBody = try JSONSerialization.data(withJSONObject: ["structuredQuery": q])
        let (d, resp) = try await URLSession.shared.data(for: r)
        guard (resp as? HTTPURLResponse)?.statusCode == 200, let rows = try JSONSerialization.jsonObject(with: d) as? [[String: Any]] else { throw Bad() }
        return rows.compactMap { row in
            guard let doc = row["document"] as? [String: Any], let n = doc["name"] as? String else { return nil }
            return (String(n.split(separator: "/").last ?? ""), fields(doc["fields"]))
        }
    }

    private static func fields(_ f: Any?) -> [String: Any] {
        var out: [String: Any] = [:]
        for (k, v) in (f as? [String: Any]) ?? [:] { if let x = plain(v) { out[k] = x } }
        return out
    }

    private static func plain(_ v: Any) -> Any? {
        guard let v = v as? [String: Any] else { return nil }
        if let s = v["stringValue"] as? String { return s }
        if let s = v["integerValue"] as? String { return Double(s) }
        if let n = v["doubleValue"] as? NSNumber { return n.doubleValue }
        if let b = v["booleanValue"] as? Bool { return b }
        if let m = v["mapValue"] as? [String: Any] { return fields(m["fields"]) }
        return nil
    }

    private static func mask(_ paths: [String]) -> String { paths.map { "mask.fieldPaths=\($0)" }.joined(separator: "&") }

    /* (a query's parts, written out with their types: Swift won't guess at mixed dictionaries) */
    private typealias JSON = [String: Any]

    private static func picking(_ names: [String]) -> JSON { ["fields": names.map { ["fieldPath": $0] }] }

    private static func newestFirst(_ field: String) -> [JSON] {
        let o: JSON = ["field": ["fieldPath": field], "direction": "DESCENDING"]
        return [o]
    }

    /// documents whose id starts with `prefix` (ids start with the time, so they come newest first, backwards)
    private static func idsStarting(_ c: WidgetShare.Config, _ prefix: String) -> JSON {
        func bound(_ op: String, _ id: String) -> JSON {
            let ref: JSON = ["referenceValue": name(c, id)]
            let f: JSON = ["field": ["fieldPath": "__name__"], "op": op, "value": ref]
            return ["fieldFilter": f]
        }
        let both: JSON = ["op": "AND", "filters": [bound("GREATER_THAN_OR_EQUAL", prefix), bound("LESS_THAN", String(prefix.dropLast()) + ".")]]
        return ["compositeFilter": both]
    }

    /* their doodle */

    /// what's saved, after looking for a newer doodle (what was saved, if it couldn't look)
    static func freshDoodle() async -> WidgetShare.Saved {
        var s = WidgetShare.load()
        guard let c = s.config else { return s }
        do {
            let t = try await token(c)
            let board = try await get(root(c) + "/meta/board", t) ?? [:]
            var id = ((board["drew"] as? [String: Any])?[c.them] as? [String: Any])?["id"] as? String
            var idAt = ((board["drew"] as? [String: Any])?[c.them] as? [String: Any])?["at"] as? Double ?? 0
            let last = (board["last"] as? [String: Any])?[c.them] as? [String: Any]
            // (pinned up from an app from before, which doesn't say which doodle: look through the newest notes)
            if let last, last["kind"] as? String == "doodle", (last["at"] as? Double ?? 0) > idAt + 1000 {
                let q: JSON = [
                    "from": [["collectionId": "meta"]],
                    "select": picking(["by", "kind", "gone", "at"]),
                    "orderBy": newestFirst("at"),
                    "limit": 12,
                ]
                let rows = try await query(c, t, q)
                if let row = rows.first(where: { $0.0.hasPrefix("note-") && $0.1["by"] as? String == c.them && $0.1["kind"] as? String == "doodle" && $0.1["gone"] as? Bool != true }) {
                    id = row.0
                    idAt = row.1["at"] as? Double ?? idAt
                }
            }
            // (the app may have seen a newer one than the board says)
            if let had = s.drawing, had.at > idAt { id = had.id }
            guard let id else { return s }
            if s.drawing?.id == id {
                // the same one: just check it's still up
                let n = try await get(root(c) + "/meta/\(id)?" + mask(["gone"]), t)
                if n == nil || n?["gone"] as? Bool == true { s.drawing = nil }
            } else if let n = try await get(root(c) + "/meta/\(id)?" + mask(["hd", "doodle", "gone", "at", "by"]), t), n["gone"] as? Bool != true, n["by"] as? String == c.them {
                let px = (n["hd"] as? String).flatMap { Doodle.isFull($0) ? $0 : nil } ?? (n["doodle"] as? String).flatMap { Doodle.isDoodle($0) ? Doodle.full($0) : nil }
                if let px { s.drawing = WidgetShare.Drawing(id: id, px: px, at: n["at"] as? Double ?? 0) }
            }
            s.checked = Date().timeIntervalSince1970 * 1000
            WidgetShare.store(s)
        } catch {
            // offline, or signed out somewhere else: keep what's there
        }
        return WidgetShare.load()
    }

    /* our board */

    private struct Pinned: Codable { var id: String; var caption: String; var at: Double }

    private static var boardFile: URL { cacheDir.appendingPathComponent("board.json") }
    private static func photoFile(_ id: String) -> URL { cacheDir.appendingPathComponent("\(id).jpg") }

    /// looks for newer photos, and fetches the small copies of any it hasn't got
    static func freshBoard() async {
        let s = WidgetShare.load()
        guard let c = s.config else {
            try? FileManager.default.removeItem(at: boardFile)
            return
        }
        do {
            let t = try await token(c)
            let q: JSON = [
                "from": [["collectionId": "meta"]],
                "select": picking(["caption", "gone", "at"]),
                "where": idsStarting(c, "photo-"),
                "orderBy": newestFirst("__name__"),
                "limit": 6,
            ]
            let rows = try await query(c, t, q)
            var pinned: [Pinned] = []
            for (id, f) in rows where f["gone"] as? Bool != true && pinned.count < 4 {
                if !FileManager.default.fileExists(atPath: photoFile(id).path) {
                    guard let p = try await get(root(c) + "/meta/\(id)?" + mask(["thumb"]), t), let thumb = p["thumb"] as? String,
                          let jpeg = small(thumb) else { continue }
                    try? jpeg.write(to: photoFile(id))
                }
                pinned.append(Pinned(id: id, caption: String((f["caption"] as? String ?? "").prefix(40)), at: f["at"] as? Double ?? 0))
            }
            if let d = try? JSONEncoder().encode(pinned) { try? d.write(to: boardFile) }
            // (photos that came down)
            let keep = Set(pinned.map { "\($0.id).jpg" })
            for f in (try? FileManager.default.contentsOfDirectory(atPath: cacheDir.path)) ?? [] where f.hasSuffix(".jpg") && !keep.contains(f) {
                try? FileManager.default.removeItem(at: cacheDir.appendingPathComponent(f))
            }
        } catch {
            // offline: keep what's there
        }
    }

    /// a data: URL's JPEG, made small enough for a widget (300 points across at most)
    private static func small(_ dataURL: String) -> Data? {
        guard let comma = dataURL.firstIndex(of: ","), let data = Data(base64Encoded: String(dataURL[dataURL.index(after: comma)...])),
              let img = UIImage(data: data) else { return nil }
        let k = min(1, 300 / max(img.size.width, img.size.height))
        let size = CGSize(width: max(1, (img.size.width * k).rounded()), height: max(1, (img.size.height * k).rounded()))
        let f = UIGraphicsImageRendererFormat()
        f.scale = 1
        return UIGraphicsImageRenderer(size: size, format: f).image { _ in img.draw(in: CGRect(origin: .zero, size: size)) }.jpegData(compressionQuality: 0.8)
    }

    /// what's pinned up, from what was last fetched (with your person's doodle on a sticky note, on the big one)
    static func cachedBoard(withDoodle: Bool) -> [BoardItem] {
        guard WidgetShare.load().config != nil, let d = try? Data(contentsOf: boardFile), let pinned = try? JSONDecoder().decode([Pinned].self, from: d) else { return [] }
        var items = pinned.compactMap { p -> BoardItem? in
            guard let img = UIImage(contentsOfFile: photoFile(p.id).path) else { return nil }
            return BoardItem(id: p.id, image: img, caption: p.caption)
        }
        if withDoodle, let dr = WidgetShare.load().drawing {
            let name = WidgetShare.load().config?.themName ?? ""
            items = Array(items.prefix(3)) + [BoardItem(id: "doodle-" + dr.id, caption: name.isEmpty ? "a doodle" : "from \(name)", doodle: dr.px)]
        }
        return items
    }
}
