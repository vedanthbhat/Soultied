import Foundation
import Observation

/*
 * Netflix and Prime Video together, on the iPhone. The app opens the site in a browser of its own and runs
 * the Soultied extension's player code in it (extension/src/player, with extension/src/ios standing in for
 * the extension API): that code drives Netflix's or Prime's player, keeps the two of you in step, and draws
 * the chat and the couch over the show, exactly as on a laptop.
 *
 * On a laptop the extension's player talks to the extension's background page, which talks to your Soultied
 * tab (src/stream/StreamHub.tsx), which is signed in and carries everything to your person over the place's
 * "stream" line. Here the app is both of those: this class. It hands the player who you both are (the
 * session), passes what the player says onto the line and what your person says back to the player, and
 * keeps the list of what you've watched together (meta/stream, shared with the website).
 *
 * So a phone and a laptop with the extension watch together, or two phones.
 *
 * The browser (in the app) passes on what the player's stand-in API sends, as small documents:
 *   { op: "connect" | "msg" | "bye", port: Int, name: "player" | "cams", msg: {...} }
 * and delivers what this sends back through `toPlayer(port, msg)`.
 */

@Observable
public final class StreamHub {
    public let me: String
    @ObservationIgnored private let place: PlaceModel?
    @ObservationIgnored private let clock: () -> Double
    @ObservationIgnored private let sessionOverride: (() -> Doc?)?
    @ObservationIgnored private let lineOverride: (() -> LiveChannel?)?

    /// to the player in the browser: (port, message)
    @ObservationIgnored public var toPlayer: (Int, Doc) -> Void = { _, _ in }
    /// the player asked to go back to Soultied (its "Open Soultied" button)
    @ObservationIgnored public var onOpenHub: () -> Void = {}

    /// the player's on a show page and said hello
    public private(set) var playerHere = false
    /// when your person last said anything on the line (ms; 0: they said goodbye, or nothing yet)
    public private(set) var partnerSeen: Double = 0
    /// what the player last said it's showing (its status: the title, whether there's a video)
    public private(set) var title: Doc?
    public private(set) var hasVideo = false
    /// what you've watched together (seen, shows)
    public private(set) var log: Doc = ["seen": Doc(), "shows": Doc()]

    @ObservationIgnored private var line: LiveChannel?
    @ObservationIgnored private var ports: Set<Int> = []
    @ObservationIgnored private var waiting: [Doc] = []
    @ObservationIgnored private var logListener: Listener?
    @ObservationIgnored private var byeAt: Double = 0
    @ObservationIgnored private var noted: Set<String> = []
    @ObservationIgnored private var started = false

    /// the app: your place
    public convenience init(place: PlaceModel, clock: @escaping () -> Double = { Values.nowMs() }) {
        self.init(me: place.me, place: place, clock: clock, session: nil, line: nil)
    }

    /// (the tests can hand in the session and the line themselves)
    public init(me: String, place: PlaceModel? = nil, clock: @escaping () -> Double = { Values.nowMs() }, session: (() -> Doc?)? = nil, line: (() -> LiveChannel?)? = nil) {
        self.me = me
        self.place = place
        self.clock = clock
        sessionOverride = session
        lineOverride = line
    }

    private func sessionOf() -> Doc? { sessionOverride.map { $0() } ?? placeSession() }
    private func openLine() -> LiveChannel? {
        if let lineOverride { return lineOverride() }
        guard let place, place.partnerHere else { return nil }
        return place.liveChannel("stream")
    }

    /// your person's here watching (said something on the line in the last 45 seconds)
    public var partnerWatching: Bool { partnerSeen > 0 && clock() - partnerSeen < 45_000 }

    public func start() {
        guard !started else { return }
        started = true
        logListener = place?.watchStreamLog { [weak self] d in
            guard let self else { return }
            self.log = ["seen": d?["seen"] as? Doc ?? Doc(), "shows": d?["shows"] as? Doc ?? Doc()]
            self.tellSession()
        }
        openTheLine()
    }

    public func stop() {
        guard started else { return }
        started = false
        // (the player's goodbye, in case the page was closed before it could say it)
        if playerHere { send(["type": "bye", "by": me, "at": clock()]) }
        for p in ports { toPlayerGone(p) }
        ports = []
        playerHere = false
        logListener?.stop()
        logListener = nil
        line?.close()
        line = nil
    }

    /// the place came round (your person moved in): open the line if it wasn't
    public func refresh() {
        if started, line == nil { openTheLine() }
        tellSession()
    }

    /// what the player's stand-in sent
    public func fromPlayer(_ d: Doc) {
        guard let port = (d["port"] as? NSNumber)?.intValue ?? d["port"] as? Int else { return }
        let name = d.str("name") ?? ""
        switch d.str("op") {
        case "connect":
            // (the cameras window's line: no calls on the phone yet, so it's never answered)
            if name == "player" { ports.insert(port) }
        case "bye":
            ports.remove(port)
            if ports.isEmpty { playerHere = false }
        case "msg":
            guard name == "player", let m = d["msg"] as? Doc else { return }
            heard(m, port)
        default:
            break
        }
    }

    /// the browser went to another page (the player there connects afresh)
    public func pageChanged() {
        ports = []
    }

    // MARK: - the player

    private func heard(_ m: Doc, _ port: Int) {
        switch m.str("kind") {
        case "hello":
            ports.insert(port)
            playerHere = true
            byeAt = 0
            if let s = sessionOf() { toPlayer(port, ["kind": "session", "session": s]) }
            else { toPlayer(port, ["kind": "nohub"]) }
        case "send":
            if let e = m["e"] as? Doc { send(e) }
        case "watched":
            if let t = m["title"] as? Doc { watched(t, pos: m.num("pos") ?? 0) }
        case "bye":
            byeAt = clock()
            playerHere = false
        case "status":
            let s = m["status"] as? Doc
            title = s?["title"] as? Doc
            hasVideo = s?.bool("video") ?? false
        case "openHub":
            onOpenHub()
        case "startParty", "joinParty":
            // (watch parties from a link are the laptop's; here you're always in your place)
            toPlayer(port, ["kind": "partyError", "error": "failed"])
        case "redeem":
            toPlayer(port, ["kind": "plusResult", "res": ["ok": false, "error": "failed"]])
        default:
            // ptt, call, leaveParty: cameras and voice aren't on the phone yet
            break
        }
    }

    private func tellSession() {
        guard !ports.isEmpty else { return }
        let s = sessionOf()
        for p in ports { toPlayer(p, s.map { ["kind": "session", "session": $0] } ?? ["kind": "nohub"]) }
    }

    private func toPlayerGone(_ port: Int) {
        toPlayer(port, ["kind": "nohub"])
    }

    // MARK: - the line to your person

    private func openTheLine() {
        guard line == nil, let ch = openLine() else { return }
        line = ch
        ch.subscribe { [weak self] e in self?.onLine(e) }
        let q = waiting
        waiting = []
        q.forEach { ch.send($0) }
    }

    private func send(_ e: Doc) {
        if let line { line.send(e) } else { waiting = Array((waiting + [e]).suffix(20)) }
    }

    private func onLine(_ e: Doc) {
        guard e.str("by") != me else { return }
        let type = e.str("type") ?? ""
        // (the cameras' own signalling: not on the phone yet)
        if type == "rtc" || type == "media" { return }
        partnerSeen = type == "bye" ? 0 : clock()
        for p in ports { toPlayer(p, ["kind": "event", "e": e]) }
    }

    // MARK: - what you've watched together

    private func watched(_ t: Doc, pos: Double) {
        guard let key = t.str("key"), !key.isEmpty else { return }
        let show = t.str("show") ?? ""
        let episode = t.str("episode") ?? ""
        place?.saveWatched(key: key, showKey: t.str("showKey") ?? key, show: show, episode: episode, url: t.str("url") ?? "", pos: pos)
        // one line in your shared history per episode a day (only one of you writes it, as on the website)
        let day = Day.today(Date(timeIntervalSince1970: clock() / 1000))
        let k = "\(key)|\(day)"
        guard !noted.contains(k), let them = place?.them, me < them else { return }
        noted.insert(k)
        place?.noteWatchedTogether("\(Self.label(t)) on \(Self.serviceName(t.str("platform"))).")
    }

    /// "Dark S1:E2" or "The Holdovers" (src/stream/protocol.ts titleLabel)
    public static func label(_ t: Doc?) -> String {
        guard let t else { return "something" }
        let show = t.str("show") ?? ""
        let ep = t.str("episode") ?? ""
        return ep.isEmpty ? show : "\(show) \(ep.components(separatedBy: " · ")[0])"
    }

    public static func serviceName(_ p: String?) -> String {
        switch p {
        case "netflix": return "Netflix"
        case "prime": return "Prime Video"
        default: return "the show"
        }
    }

    // MARK: - who you both are (src/stream/StreamHub.tsx's session)

    private func placeSession() -> Doc? {
        guard let place, place.ready, let space = place.space else { return nil }
        func person(_ uid: String?) -> Doc? {
            guard let uid, let m = place.member(uid) else { return nil }
            return ["id": uid, "name": m.name, "avatar": Wardrobe.dictionary(m.avatar)]
        }
        let mine: Doc = person(me) ?? ["id": me, "name": place.myName, "avatar": Wardrobe.dictionary(place.myLook)]
        return [
            "me": mine,
            "partner": person(place.them) ?? NSNull(),
            "leftId": space.creatorId,
            "place": space.name,
            "closeness": min(1, Double(place.couchLevel) / Double(COUCH_STEPS)),
            "log": log,
            "hubUrl": "https://soultied.app/",
            "plus": false,
        ]
    }
}
