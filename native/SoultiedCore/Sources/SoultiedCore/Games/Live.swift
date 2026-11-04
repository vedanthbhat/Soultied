import Foundation
import Observation

/*
 * Live games for two (src/games/live/lobby.ts, link.ts and useLiveGame.ts): you play at the same moment.
 *
 * The match document is only the invitation and the result: who's in, and who won. Everything in between
 * goes over a live channel (the same little Firestore messages the website uses), with whoever sent the
 * invitation keeping the game (the "host"): their screen holds the real state, applies both people's moves
 * and tells the other screen what happened. So a phone and a laptop can play each other, either one hosting.
 *
 * The website also tries a direct line between two browsers (WebRTC); the iPhone doesn't, and the website
 * settles for the channel after a few seconds when the other end doesn't answer, as it does on networks that
 * block direct links.
 */

/* ---------- the invitation and the result ---------- */

public struct LiveResult: Equatable, Sendable {
    /// "a", "b", "draw", or nil (for games played on the same side)
    public var winner: String?
    /// e.g. "won 3–1"
    public var line: String
    public var score: [Side: Int]?

    public init(winner: String?, line: String, score: [Side: Int]? = nil) {
        self.winner = winner
        self.line = line
        self.score = score
    }

    public init?(_ raw: Any?) {
        guard let d = raw as? Doc, let line = d.str("line") else { return nil }
        self.line = line
        winner = d.str("winner")
        if let s = d["score"] as? Doc { score = [.a: s.int("a") ?? 0, .b: s.int("b") ?? 0] }
    }

    public var doc: Doc {
        var d: Doc = ["winner": winner as Any? ?? NSNull(), "line": line]
        if let s = score { d["score"] = ["a": s[.a] ?? 0, "b": s[.b] ?? 0] }
        return d
    }

    public var winnerSeat: Side? { winner.flatMap { Side(rawValue: $0) } }
}

public extension Play {
    /// the three seconds before a live game starts
    static let countdownMs: Double = 3000

    static func newLive(_ kind: GameKind, starter: Side, wins: [Side: Int]? = nil, now: Double = Values.nowMs()) -> Match {
        let state: Doc = ["phase": "lobby", "joined": [starter.rawValue: true], "seed": Int.random(in: 0..<(1 << 31)), "result": NSNull()]
        var m = Match(kind: kind, starter: starter, state: state, wins: wins, now: now)
        m.status = .setup
        m.turn = nil
        m.last = "wants to play"
        return m
    }

    static func liveJoin(_ m: Match, _ seat: Side) -> Match? {
        guard m.status == .setup, m.state.str("phase") == "lobby", !m.state.map("joined").bool(seat.rawValue) else { return nil }
        var joined = m.state.map("joined")
        joined[seat.rawValue] = true
        let both = joined.bool("a") && joined.bool("b")
        var n = m
        n.status = both ? .playing : .setup
        n.state["joined"] = joined
        n.state["phase"] = both ? "live" : "lobby"
        n.last = both ? "joined" : "is here"
        return n
    }

    static func liveFinish(_ m: Match, _ r: LiveResult) -> Match? {
        guard m.status != .over else { return nil }
        var n = m
        n.status = .over
        n.turn = nil
        n.winner = r.winner
        n.state["phase"] = "done"
        n.state["result"] = r.doc
        n.last = r.line
        return n
    }

    static func liveCancel(_ m: Match) -> Match? {
        guard m.status != .over else { return nil }
        var n = m
        n.status = .over
        n.turn = nil
        n.winner = nil
        n.state["phase"] = "done"
        n.state["result"] = NSNull()
        n.last = "stopped the game"
        return n
    }

    /// how a finished live game came out (nil when it was stopped)
    static func liveResult(_ m: Match?) -> LiveResult? { m.flatMap { LiveResult($0.state["result"]) } }
}

/* ---------- the rules of one live game ---------- */

/// a game's state, or one thing someone did, as it goes over the channel (the website's JSON)
public protocol LiveValue {
    init?(_ d: Doc)
    var doc: Doc { get }
}

public protocol LiveRules {
    associatedtype S: LiveValue
    associatedtype A: LiveValue
    /// a fresh game; `rng` is seeded from the match so anything random comes out the same on both screens
    func initial(_ rng: @escaping Random, now: Double) -> S
    /// someone did something (runs on the host); nil when it changes nothing
    func act(_ s: S, _ seat: Side, _ a: A, now: Double) -> S?
    /// time passing (runs on the host every tickMs once the countdown is over); nil when nothing changed
    func tick(_ s: S, now: Double) -> S?
    var hasTick: Bool { get }
    /// the game is over: who won
    func result(_ s: S) -> LiveResult?
    /// the demo room's partner, asked every botMs
    func bot(_ s: S, _ seat: Side, now: Double) -> A?
    var botMs: Double { get }
    var tickMs: Double { get }
    /// changes many times a second: only the latest matters
    var continuous: Bool { get }
    /// for continuous games: whenever this changes, the state is also sent the careful way
    func phase(_ s: S) -> String
}

public extension LiveRules {
    func tick(_ s: S, now: Double) -> S? { nil }
    var hasTick: Bool { true }
    func bot(_ s: S, _ seat: Side, now: Double) -> A? { nil }
    var botMs: Double { 400 }
    var tickMs: Double { 100 }
    var continuous: Bool { false }
    func phase(_ s: S) -> String { "" }
}

/// Math.random, unless a test wants the same numbers every time
public let systemRandom: Random = { Double.random(in: 0..<1) }

/// a repeatable source of numbers from a seed (the website's `seeded`, mulberry32)
public func seeded(_ seed: Int) -> Random {
    final class Box { var r: Shuffle.Rng; init(_ s: UInt32) { r = Shuffle.Rng(s) } }
    let b = Box(UInt32(truncatingIfNeeded: seed))
    return { b.r.next() }
}

/* ---------- the channel ---------- */

/// Short messages between the two of you (spaces/{id}/live/{topic}/events): what one sends, the other hears
/// a moment later. Your own messages come back to you too; the link ignores them.
public protocol LiveChannel: AnyObject {
    /// between two screens of the same device (the tests): no waiting for a server
    var isLocal: Bool { get }
    func send(_ e: Doc)
    func subscribe(_ fn: @escaping (Doc) -> Void)
    func close()
}

/* ---------- the line between the two of you ---------- */

public enum LinkMode: String, Sendable {
    case waiting, connecting, direct, relay, local

    public var words: String {
        switch self {
        case .connecting: return "Connecting the two of you…"
        case .direct: return "Connected directly"
        case .relay: return "Connected through the cloud: a touch slower than direct"
        case .local: return "Connected"
        case .waiting: return ""
        }
    }
}

/**
 * The website's GameLink, over the channel only. Messages are numbered, so one that arrives twice is only
 * handled once; fast-changing things (a tap count, a position) are sent at most a few times a second, and
 * only the newest counts.
 */
public final class GameLink {
    public private(set) var mode: LinkMode = .waiting
    public private(set) var partnerHere = false
    public let mid: String

    /// how long without a word before we think they've gone
    static let goneMs: Double = 12000
    /// the slowest we'll send fast-changing things
    static let fastMs: Double = 220

    private let chan: LiveChannel
    private let me: String
    private let seat: Side
    private let onMessage: (Any) -> Void
    private let onChange: () -> Void
    private let sid: String = String((0..<8).map { _ in Array("abcdefghijklmnopqrstuvwxyz0123456789").randomElement()! })
    private var partnerSid: String?
    private var lastHeard: Double = 0
    private var lastBeat: Double = 0
    private var outN = 0
    private var seenRel = Set<Int>()
    private var seenOrder: [Int] = []
    private var inFast = 0
    private var fastQueued: Any?
    private var lastFastSent: Double = 0
    private var closed = false
    private let clock: () -> Double

    public init(chan: LiveChannel, me: String, seat: Side, mid: String, clock: @escaping () -> Double = Values.nowMs, onMessage: @escaping (Any) -> Void, onChange: @escaping () -> Void) {
        self.chan = chan
        self.me = me
        self.seat = seat
        self.mid = mid
        self.clock = clock
        self.onMessage = onMessage
        self.onChange = onChange
    }

    public func start() {
        chan.subscribe { [weak self] e in self?.onWire(e) }
        if chan.isLocal { mode = .local }
        hello()
        onChange()
    }

    /// once a second or so: say hello again if it's gone quiet, and notice when they've gone
    public func beat() {
        guard !closed else { return }
        let now = clock()
        flush(now)
        if now - lastBeat < 1000 { return }
        lastBeat = now
        let quiet = now - lastHeard
        if quiet > (chan.isLocal ? 1500 : 3500) { hello() }
        if partnerHere && quiet > Self.goneMs {
            partnerHere = false
            onChange()
        }
    }

    private func hello() { wire(["t": "hi", "seat": seat.rawValue]) }

    private func wire(_ e: Doc) {
        guard !closed else { return }
        var out = e
        out["by"] = me
        out["at"] = clock()
        out["mid"] = mid
        out["sid"] = sid
        chan.send(out)
    }

    private func heard() {
        lastHeard = clock()
        if !partnerHere {
            partnerHere = true
            onChange()
        }
    }

    private func onWire(_ e: Doc) {
        guard !closed, e.str("mid") == mid, let by = e.str("by"), by != me, let t = e.str("t"), let from = e.str("sid") else { return }
        if t == "hi" {
            heard()
            if from != partnerSid {
                // someone new (or them after opening the game again): tell them we're here
                partnerSid = from
                seenRel.removeAll()
                seenOrder.removeAll()
                inFast = 0
                hello()
                if !chan.isLocal { setMode(.relay) }
            }
            return
        }
        guard from == partnerSid else { return }
        if t == "bye" {
            partnerHere = false
            partnerSid = nil
            if !chan.isLocal { setMode(.waiting) }
            onChange()
            return
        }
        heard()
        // (the website's offers of a direct line go unanswered: it settles for the channel)
        if t == "m", let n = e.int("n") { take(n, e.bool("fast"), e["d"] ?? NSNull()) }
    }

    private func take(_ n: Int, _ fast: Bool, _ d: Any) {
        if fast {
            if n <= inFast { return }
            inFast = n
        } else {
            if seenRel.contains(n) { return }
            seenRel.insert(n)
            seenOrder.append(n)
            if seenOrder.count > 400 {
                for k in seenOrder.prefix(200) { seenRel.remove(k) }
                seenOrder.removeFirst(200)
            }
        }
        onMessage(d)
    }

    private func setMode(_ m: LinkMode) {
        if mode == m { return }
        mode = m
        onChange()
    }

    /// Sends something to the other person. `fast` is for things that change all the time: only the latest matters.
    public func send(_ d: Any, fast: Bool = false) {
        guard !closed else { return }
        outN += 1
        if !fast || chan.isLocal {
            wire(["t": "m", "n": outN, "fast": fast, "d": d])
            return
        }
        fastQueued = d
        flush(clock())
    }

    private func flush(_ now: Double) {
        guard let q = fastQueued, now - lastFastSent >= Self.fastMs else { return }
        fastQueued = nil
        lastFastSent = now
        outN += 1
        wire(["t": "m", "n": outN, "fast": true, "d": q])
    }

    public func close() {
        guard !closed else { return }
        wire(["t": "bye"])
        closed = true
        chan.close()
    }
}

/* ---------- running a live game ---------- */

public enum LiveStage: String, Sendable {
    case idle, inviting, invited, waiting, count, play, over
}

/**
 * One live game on this screen: the invitation, the link, a three-second countdown, the game, and writing
 * down who won. Call `pulse()` often (every 30–50 ms while the game's open) and `sync()` whenever the match
 * changes; everything else follows.
 *
 * In the demo room there's no one on the other end: the host is you, and the game's own little bot plays for
 * your pretend partner.
 */
@Observable
public final class LiveSession<R: LiveRules> {
    public let kind: GameKind
    @ObservationIgnored public let rules: R
    @ObservationIgnored private weak var place: PlaceModel?
    @ObservationIgnored private let clock: () -> Double
    @ObservationIgnored private let channel: (() -> LiveChannel?)

    /// the game as this screen last heard it
    public private(set) var state: R.S?
    /// when the countdown ends, by this screen's clock
    public private(set) var startAt: Double = 0
    public private(set) var end: LiveResult?
    public private(set) var mode: LinkMode = .waiting
    private var linkPartnerHere = false

    private struct Engine {
        var mid: String
        var g: String
        var v: Int
        var s: R.S
        var startAt: Double
        var end: LiveResult?
        var phase: String
    }

    @ObservationIgnored private var eng: Engine?
    @ObservationIgnored private var guest: (g: String, v: Int, offset: Double)?
    @ObservationIgnored private var link: GameLink?
    @ObservationIgnored private var mid = ""
    @ObservationIgnored private var lastTick: Double = 0
    @ObservationIgnored private var lastBot: Double = 0
    @ObservationIgnored private var lastAsk: Double = 0
    @ObservationIgnored private var goneSince: Double = 0
    @ObservationIgnored private var closed = false

    /// if the other person's screen goes quiet for this long mid-game, the game stops
    static var abandonMs: Double { 25000 }

    public init(kind: GameKind, rules: R, place: PlaceModel, clock: @escaping () -> Double = Values.nowMs, channel: (() -> LiveChannel?)? = nil) {
        self.kind = kind
        self.rules = rules
        self.place = place
        self.clock = clock
        self.channel = channel ?? { [weak place] in place?.liveChannel("play") }
    }

    /* ---------- who's who ---------- */

    public var mySeat: Side { place?.mySeat ?? .a }
    public var them: Side { mySeat.other }
    public var demo: Bool { place?.isDemo ?? false }
    /// there's someone to play with
    public var ready: Bool { (place?.partnerHere ?? false) || demo }
    public var partnerHere: Bool { demo ? true : linkPartnerHere }
    /// the match as it is in the place (the last one, even if it's long finished or forgotten)
    public var raw: Match? { place?.games[kind] }
    /// the match that's on (an old invitation nobody answered doesn't count)
    public var match: Match? {
        guard let m = raw else { return nil }
        return Play.stale(m, now: clock()) ? nil : m
    }
    public var host: Bool { match.map { demo || $0.startedBy == mySeat } ?? false }
    private var playing: Bool { match?.status == .playing }

    public var result: LiveResult? { end ?? (match?.status == .over ? Play.liveResult(match) : nil) }

    public func stage(now: Double? = nil) -> LiveStage {
        guard let m = match else { return .idle }
        let t = now ?? clock()
        if m.status == .setup { return m.state.map("joined").bool(mySeat.rawValue) ? .inviting : .invited }
        if m.status == .over || end != nil { return .over }
        if state != nil { return t < startAt ? .count : .play }
        return .waiting
    }

    /// a time from the host's clock, on this screen's clock
    public func local(_ t: Double) -> Double { host ? t : t + (guest?.offset ?? 0) }
    /// a time on this screen's clock, on the host's
    public func hostTime(_ t: Double) -> Double { host ? t : t - (guest?.offset ?? 0) }

    /* ---------- what you can do ---------- */

    public func invite() { place?.saveGame(Play.newLive(kind, starter: mySeat, wins: raw?.wins)) }

    public func join() {
        if let m = match, let j = Play.liveJoin(m, mySeat) { place?.saveGame(j) }
    }

    public func cancel() {
        if let m = match, let c = Play.liveCancel(m) { place?.saveGame(c) }
    }

    public func act(_ a: R.A, fast: Bool = false) {
        if host { apply(mySeat, a) } else { link?.send(["k": "a", "a": a.doc], fast: fast) }
    }

    /* ---------- keeping up ---------- */

    /// the match changed (or a moment passed): forget an old game, open or close the link, start the game
    public func sync() {
        guard !closed else { return }
        let now = clock()
        let m = match
        let newMid = m?.id ?? ""
        if newMid != mid {
            mid = newMid
            eng = nil
            guest = nil
            state = nil
            startAt = 0
            end = nil
        }

        // the link, while there's a game on with someone real
        let want = !mid.isEmpty && playing && !demo && ready
        if want, link?.mid != mid {
            link?.close()
            openLink()
        } else if !want, let l = link {
            l.close()
            link = nil
            linkPartnerHere = false
            mode = .waiting
        }

        // start the game once you're both here
        if let m, playing, host, ready, demo || linkPartnerHere, eng?.mid != m.id {
            let s = rules.initial(seeded(m.state.int("seed") ?? 0), now: now)
            eng = Engine(mid: m.id, g: "\(m.id):\(String(Int.random(in: 0..<60_000_000), radix: 36))", v: 1, s: s, startAt: now + Play.countdownMs, end: nil, phase: rules.phase(s))
            share(careful: true)
        }

        // the other screen asks for the game until it has it
        if !host, linkPartnerHere, playing, now - lastAsk >= 2000, !(guest?.g.hasPrefix(mid) ?? false) {
            lastAsk = now
            link?.send(["k": "need"])
        }

        // the host stops a game the other person walked away from
        if host, !demo, playing {
            if linkPartnerHere {
                goneSince = 0
            } else {
                if goneSince == 0 { goneSince = now }
                if now - goneSince >= Self.abandonMs, let e = eng, e.end == nil, let m, let c = Play.liveCancel(m) {
                    goneSince = 0
                    place?.saveGame(c)
                }
            }
        }
    }

    /// call often while the game is open
    public func pulse() {
        guard !closed else { return }
        link?.beat()
        sync()
        guard playing, host, let e = eng, e.end == nil else { return }
        let now = clock()
        if now < e.startAt { return }
        if now - lastTick >= rules.tickMs {
            lastTick = now
            if rules.hasTick {
                if let n = rules.tick(e.s, now: now) { changed(n) }
            } else if rules.continuous {
                share(careful: false)
            }
        }
        if demo, now - lastBot >= rules.botMs, let e2 = eng, e2.end == nil {
            lastBot = now
            if let a = rules.bot(e2.s, them, now: now) { apply(them, a) }
        }
    }

    /// leaving the game's screen
    public func close() {
        link?.close()
        link = nil
        closed = true
    }

    /* ---------- the host's side ---------- */

    private func share(careful: Bool) {
        guard let e = eng else { return }
        state = e.s
        startAt = e.startAt
        end = e.end
        let snap: Doc = ["k": "s", "g": e.g, "v": e.v, "s": e.s.doc, "hn": clock(), "startAt": e.startAt, "end": e.end?.doc ?? NSNull()]
        link?.send(snap, fast: !careful)
    }

    private func changed(_ next: R.S) {
        guard var e = eng else { return }
        e.s = next
        e.v += 1
        let r = rules.result(next)
        let ph = rules.phase(next)
        let phaseMoved = ph != e.phase
        e.phase = ph
        if let r {
            e.end = r
            eng = e
            share(careful: true)
            if let cur = match, cur.id == e.mid, let fin = Play.liveFinish(cur, r) { place?.saveGame(fin) }
            return
        }
        eng = e
        share(careful: !rules.continuous || phaseMoved)
    }

    private func apply(_ seat: Side, _ a: R.A) {
        guard let e = eng, e.end == nil else { return }
        let now = clock()
        if now < e.startAt { return }
        if let n = rules.act(e.s, seat, a, now: now) { changed(n) }
    }

    /* ---------- the link ---------- */

    private func openLink() {
        guard let chan = channel(), let place else { return }
        let l = GameLink(chan: chan, me: place.me, seat: mySeat, mid: mid, clock: clock, onMessage: { [weak self] d in self?.onMessage(d) }, onChange: { [weak self] in
            guard let self, let l = self.link else { return }
            self.mode = l.mode
            self.linkPartnerHere = l.partnerHere
        })
        link = l
        l.start()
        mode = l.mode
        linkPartnerHere = l.partnerHere
    }

    private func onMessage(_ raw: Any) {
        guard let msg = raw as? Doc, let k = msg.str("k") else { return }
        if k == "a" {
            if host, let ad = msg["a"] as? Doc, let a = R.A(ad) { apply(them, a) }
            return
        }
        if k == "need" {
            if host, eng != nil { share(careful: true) }
            return
        }
        if k == "s", !host, let g = msg.str("g"), let v = msg.int("v"), let sd = msg["s"] as? Doc, let s = R.S(sd) {
            if let cur = guest, cur.g == g, v < cur.v { return }
            let offset = clock() - (msg.num("hn") ?? clock())
            guest = (g, v, offset)
            state = s
            startAt = (msg.num("startAt") ?? 0) + offset
            end = LiveResult(msg["end"])
        }
    }
}
