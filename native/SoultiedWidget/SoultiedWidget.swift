import WidgetKit
import SwiftUI
import AppIntents
import UIKit
import SoultiedCore

/*
 * Soultied's home-screen widgets:
 *   Their doodle   your person's last doodle, in a frame (tap: draw one back)
 *   Our board      your newest wall photos as Polaroids on cork (tap: your photos)
 *   The fire       the fireplace behind the couch, burning as well as you've been showing up (and on the
 *                  lock screen: the flame and the days in a row)
 *   Countdown      the days till you're next together (or the days you've been together)
 *   Their mood     how your person's feeling
 *   Us             all three, side by side
 * The app leaves a way in (WidgetShare, a keychain group they share); the widgets look for new things
 * themselves (Firestore's REST API, signed in with Firebase's refresh token), every 20 minutes or so as iOS
 * allows, and straight away when the app sees something new.
 */

@main
struct SoultiedWidgets: WidgetBundle {
    var body: some Widget {
        DoodleWidget()
        BoardWidget()
        FireWidget()
        CountdownWidget()
        MoodWidget()
        UsWidget()
        ApartWidget()
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

/* ---------- the fire, the countdown, their mood ---------- */

struct UsEntry: TimelineEntry {
    let date: Date
    let u: UsNow
}

struct UsProvider: TimelineProvider {
    func placeholder(in context: Context) -> UsEntry { UsEntry(date: Date(), u: .demo) }

    func getSnapshot(in context: Context, completion: @escaping (UsEntry) -> Void) {
        let s = WidgetShare.load()
        completion(UsEntry(date: Date(), u: context.isPreview && s.us == nil ? .demo : UsNow(s, at: Date())))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<UsEntry>) -> Void) {
        Task {
            let s = await Fetch.freshUs()
            let now = Date()
            // (now, and each of the next two midnights, so the countdown and the fire move on by themselves)
            var dates = [now]
            var day = Calendar.current.startOfDay(for: now)
            for _ in 0..<2 {
                day = Calendar.current.date(byAdding: .day, value: 1, to: day) ?? day.addingTimeInterval(86400)
                dates.append(day.addingTimeInterval(5))
            }
            completion(Timeline(entries: dates.map { UsEntry(date: $0, u: UsNow(s, at: $0)) }, policy: .after(now.addingTimeInterval(30 * 60))))
        }
    }
}

private let homeURL = URL(string: "soultied://home")

/// behind a widget: its colour on the home screen, the usual soft disc on a round lock-screen one, nothing on the rest
struct Backdrop: View {
    let family: WidgetFamily
    let color: Color
    var body: some View {
        switch family {
        case .systemSmall, .systemMedium, .systemLarge: color
        case .accessoryCircular: AccessoryWidgetBackground()
        default: Color.clear
        }
    }
}

struct FireWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: UsEntry
    var body: some View {
        let u = entry.u
        Group {
            switch family {
            case .accessoryCircular: FireRound(u: u).widgetAccentable()
            case .accessoryRectangular: LockRow(glyph: u.level > 0 ? UsGlyphs.flame : UsGlyphs.flameOut, title: u.fireName, sub: u.fireLine)
            case .accessoryInline: Text(u.level > 0 ? "\(u.streak) \(u.streak == 1 ? "day" : "days") by the fire" : "Embers: show up together today")
            default: FireFace(u: u)
            }
        }
        .containerBackground(for: .widget) { Backdrop(family: family, color: Color(red: 0.1, green: 0.07, blue: 0.08)) }
        .widgetURL(homeURL)
    }
}

struct FireWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: WidgetShare.fireKind, provider: UsProvider()) { FireWidgetView(entry: $0) }
            .configurationDisplayName("The fire")
            .description("The fire behind your couch. It burns brighter every day you both show up.")
            .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular, .accessoryInline])
            .contentMarginsDisabled()
    }
}

struct CountdownWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: UsEntry
    var body: some View {
        let u = entry.u
        Group {
            switch family {
            case .accessoryCircular: CountdownRound(u: u)
            case .accessoryRectangular: LockRow(glyph: UsGlyphs.calendar, title: u.count.map { $0.n == "Today" ? "Today" : "\($0.n) \($0.label.split(separator: " ").first ?? "")" } ?? "Next time together", sub: u.count.map { $0.n == "Today" ? $0.label : $0.label.split(separator: " ").dropFirst().joined(separator: " ") } ?? "Set the day in Soultied")
            case .accessoryInline: Text(u.countLine)
            default: CountdownFace(u: u)
            }
        }
        .containerBackground(for: .widget) { Backdrop(family: family, color: Color(red: 0.98, green: 0.95, blue: 0.89)) }
        .widgetURL(homeURL)
    }
}

struct CountdownWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: WidgetShare.countdownKind, provider: UsProvider()) { CountdownWidgetView(entry: $0) }
            .configurationDisplayName("Countdown")
            .description("The days till you’re next together (or how long you’ve been together).")
            .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular, .accessoryInline])
            .contentMarginsDisabled()
    }
}

struct MoodWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: UsEntry
    var body: some View {
        let u = entry.u
        Group {
            switch family {
            case .accessoryCircular: MoodRound(u: u)
            case .accessoryRectangular: LockRow(glyph: u.mood?.glyph ?? WORDS_GLYPH, title: u.themName, sub: u.mood?.line ?? "No mood today yet")
            case .accessoryInline: Text(u.mood.map { "\(u.themName): \($0.line)" } ?? "\(u.themName): no mood yet")
            default: MoodFace(u: u)
            }
        }
        .containerBackground(for: .widget) { Backdrop(family: family, color: Color(red: 0.98, green: 0.95, blue: 0.89)) }
        .widgetURL(homeURL)
    }
}

struct MoodWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: WidgetShare.moodKind, provider: UsProvider()) { MoodWidgetView(entry: $0) }
            .configurationDisplayName("Their mood")
            .description("How your person’s feeling today.")
            .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular, .accessoryInline])
            .contentMarginsDisabled()
    }
}

struct UsWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: WidgetShare.usKind, provider: UsProvider()) { entry in
            UsFace(u: entry.u)
                .containerBackground(for: .widget) { Color(red: 0.98, green: 0.95, blue: 0.89) }
                .widgetURL(homeURL)
        }
        .configurationDisplayName("Us")
        .description("The fire, the countdown and how your person’s feeling, together.")
        .supportedFamilies([.systemMedium])
        .contentMarginsDisabled()
    }
}

/* ---------- your person's time, and how far apart ---------- */

/// a new picture each minute for the next hour, so their clock keeps time
struct ApartProvider: TimelineProvider {
    func placeholder(in context: Context) -> UsEntry { UsEntry(date: Date(), u: .demo) }

    func getSnapshot(in context: Context, completion: @escaping (UsEntry) -> Void) {
        let s = WidgetShare.load()
        completion(UsEntry(date: Date(), u: context.isPreview && s.us == nil ? .demo : UsNow(s, at: Date())))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<UsEntry>) -> Void) {
        Task {
            let s = await Fetch.freshUs()
            let now = Date()
            let minute = Date(timeIntervalSince1970: (now.timeIntervalSince1970 / 60).rounded(.down) * 60)
            let dates = [now] + (1..<60).map { minute.addingTimeInterval(Double($0) * 60) }
            completion(Timeline(entries: dates.map { UsEntry(date: $0, u: UsNow(s, at: $0)) }, policy: .atEnd))
        }
    }
}

struct ApartWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: UsEntry
    var body: some View {
        let u = entry.u
        let c = TheirClock(zone: u.themTz, mine: u.myTz, at: entry.date)
        Group {
            switch family {
            case .accessoryRectangular: LockRow(glyph: UsGlyphs.pin, title: c.map { "\($0.text) for \(u.themName)" } ?? u.themName, sub: u.apartLine ?? c?.ahead ?? "Their time shows once they’ve opened Soultied")
            case .accessoryInline: Text(c.map { "\(u.themName): \($0.text)\(u.apartLine.map { " · \($0)" } ?? "")" } ?? "\(u.themName)’s time")
            default: ApartFace(u: u, date: entry.date)
            }
        }
        .containerBackground(for: .widget) { Backdrop(family: family, color: Color(red: 0.98, green: 0.95, blue: 0.89)) }
        .widgetURL(homeURL)
    }
}

struct ApartWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: WidgetShare.apartKind, provider: ApartProvider()) { ApartWidgetView(entry: $0) }
            .configurationDisplayName("Their time")
            .description("What time it is for your person, and how far apart you are.")
            .supportedFamilies([.systemSmall, .accessoryRectangular, .accessoryInline])
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
        if let a = v["arrayValue"] as? [String: Any] { return ((a["values"] as? [Any]) ?? []).compactMap(plain) }
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

    /* the fire, the countdown, their mood */

    /// what's saved, after looking at the couch, the countdown, their mood and the place itself
    static func freshUs() async -> WidgetShare.Saved {
        var s = WidgetShare.load()
        guard let c = s.config else { return s }
        do {
            let t = try await token(c)
            var u = s.us ?? WidgetShare.Us()
            let couch = try await get(root(c) + "/meta/couch?" + mask(["together", "seen"]), t) ?? [:]
            u.together = Array(((couch["together"] as? [Any]) ?? []).compactMap { $0 as? String }.suffix(400))
            let seen = couch["seen"] as? [String: Any] ?? [:]
            u.meSeen = seen[c.me] as? String ?? ""
            u.themSeen = seen[c.them] as? String ?? ""
            let moods = try await get(root(c) + "/meta/moods?" + mask(["by"]), t) ?? [:]
            let m = (moods["by"] as? [String: Any])?[c.them] as? [String: Any]
            u.mood = m?["mood"] as? String
            u.moodText = m?["text"] as? String ?? ""
            u.moodAt = m?["at"] as? Double ?? 0
            let wh = WhereDoc(try await get(root(c) + "/meta/where", t))
            u.themTz = wh.by[c.them]?.tz
            u.apartKm = wh.apartKm(me: c.me, them: c.them)
            let visitRaw = try await get(root(c) + "/meta/visit", t)
            let visit = VisitDoc(visitRaw)
            u.visitDate = visit.date
            u.visitWhat = visit.what
            if let space = try await get(root(c) + "?" + mask(["togetherSince", "creatorId"]), t) {
                u.since = space["togetherSince"] as? String ?? ""
                if let host = space["creatorId"] as? String { u.meLeft = host == c.me }
            }
            s.us = u
            WidgetShare.store(s)
        } catch {
            // offline: keep what's there
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
