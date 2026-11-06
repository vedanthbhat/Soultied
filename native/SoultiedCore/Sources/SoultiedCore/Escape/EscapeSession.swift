import Foundation
import Observation

/// The little sounds the rooms make (the screen plays them).
public enum EscapeSound: Equatable, Sendable {
    case tick, wrong, open, win
    case note(EscapeColor)
    case melody([EscapeColor])
}

/**
 * The dark door on this screen (the website's EscapeGame.tsx, without the drawing of it): the corridor, the
 * door you're standing at, and the room you're in, played on one screen by both of you or from two devices.
 *
 * From two devices, each of you plays your own half. The devices talk over the place's "escape" line, the same
 * messages as the website, so a phone and a laptop can play a room together: who's waiting at which door, how
 * far you've got (only ever forward, so two copies just merge), holding things down together, and a little chat.
 *
 * Call `start()` when the screen opens, `pulse()` a few times a second while it's open, and `stop()` when it closes.
 */
@Observable
public final class EscapeSession {
    public enum Screen: Sendable { case corridor, door, play }
    public enum Mode: Sendable { case here, online }

    public struct ChatMsg: Identifiable, Equatable, Sendable {
        public var id: String
        public var by: String
        public var name: String
        public var text: String
    }

    /// hints wait this long after something opens (unless you've already had one)
    public static let hintAfterMs: Double = 30_000

    @ObservationIgnored private weak var place: PlaceModel?
    @ObservationIgnored private let clock: () -> Double
    @ObservationIgnored private let channel: () -> LiveChannel?
    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private var chan: LiveChannel?
    @ObservationIgnored private var lastSent = ""
    @ObservationIgnored private var lastPing: Double = 0
    @ObservationIgnored private var prevStep: Int?
    @ObservationIgnored private var holdStart: Double?
    @ObservationIgnored private var endingAt: Double?
    @ObservationIgnored private var solving: (id: String, at: Double)?
    /// plays a sound (set by the screen)
    @ObservationIgnored public var onSound: ((EscapeSound) -> Void)?

    public let rooms: [EscapeRoom]
    public private(set) var save: EscapeSave
    public private(set) var screen: Screen = .corridor
    public private(set) var roomId: RoomId = .attic
    public private(set) var mode: Mode = .here
    public private(set) var progress: EscapeProgress?
    public private(set) var partnerSeen: Double = 0
    public private(set) var partnerReady: RoomId?
    public private(set) var meReady: RoomId?
    /// what each half has open (the thing tapped)
    public private(set) var open: [Side: String] = [:]
    /// things that turned up and haven't been looked at yet
    public private(set) var fresh: [Side: Set<String>] = [.a: [], .b: []]
    /// what just happened
    public private(set) var log: String?
    public private(set) var holds: [Side: Bool] = [.a: false, .b: false]
    public private(set) var holdProgress: Double = 0
    /// which half this screen shows, when you're both on it
    public var viewSide: Side
    public private(set) var activeSince: Double
    public private(set) var chat: [ChatMsg] = []
    public private(set) var endingOpen = false
    /// the clock, for the timer and the hints (moved on by pulse())
    public private(set) var now: Double

    public init(place: PlaceModel, rooms: [EscapeRoom] = EscapeRoom.all, clock: @escaping () -> Double = Values.nowMs, channel: (() -> LiveChannel?)? = nil, defaults: UserDefaults = .standard) {
        self.place = place
        self.rooms = rooms
        self.clock = clock
        self.defaults = defaults
        self.channel = channel ?? { [weak place] in place?.liveChannel("escape") }
        let t = clock()
        now = t
        activeSince = t
        viewSide = place.mySeat
        save = EscapeSave.load(place.sid, defaults)
    }

    /* ---------- who's who ---------- */

    public var me: String { place?.me ?? "" }
    public var mySide: Side { place?.mySeat ?? .a }
    /// you can play from two devices once there are two of you (not in the demo room)
    public var canPlayOnline: Bool { (place?.partnerHere ?? false) && !(place?.isDemo ?? true) }
    public var partnerName: String { place?.theirName ?? "your person" }
    public var partnerHere: Bool { canPlayOnline && now - partnerSeen < 50_000 }

    public func name(_ side: Side) -> String { side == mySide ? (place?.myName ?? "You") : partnerName }

    public var room: EscapeRoom? { rooms.first { $0.id == roomId } ?? rooms.first }
    public var step: Int { progress?.step ?? 0 }
    /// the puzzle you're on (nil once you're out)
    public var puzzle: Puzzle? {
        guard progress != nil, let r = room, step < r.puzzles.count else { return nil }
        return r.puzzles[step]
    }
    public var elapsed: Double { progress.map { ($0.finishedAt ?? now) - $0.startedAt } ?? 0 }
    public var hintsShown: Int { puzzle.flatMap { progress?.hints[$0.id] } ?? 0 }
    public var hintReady: Bool { now - activeSince > Self.hintAfterMs || hintsShown > 0 }

    /// how things stand with a room, for its door in the corridor
    public func status(_ r: EscapeRoom) -> String {
        if let b = save.best[r.id] { return "Escaped in \(escapeTime(b))" }
        if let p = save.progress[r.id], p.finishedAt == nil, p.step > 0 { return "In progress: \(p.step) of \(r.puzzles.count) solved" }
        return "\(r.puzzles.count) puzzles · about \(r.minutes) min"
    }

    public func inProgress(_ id: RoomId) -> EscapeProgress? {
        guard let p = save.progress[id], p.finishedAt == nil, p.step > 0 else { return nil }
        return p
    }

    /* ---------- the line to the other device ---------- */

    public func start() {
        now = clock()
        guard chan == nil, canPlayOnline, let c = channel() else { return }
        chan = c
        c.subscribe { [weak self] d in
            guard let self, d.str("by") != self.me, let e = EscapeEvent(d) else { return }
            self.heard(e, from: d)
        }
        send(.hello)
        lastPing = clock()
    }

    public func stop() {
        guard let c = chan else { return }
        send(.bye)
        c.close()
        chan = nil
    }

    private func send(_ e: EscapeEvent) { chan?.send(e.doc(by: me, at: clock())) }

    private func heard(_ e: EscapeEvent, from d: Doc) {
        now = clock()
        partnerSeen = now
        switch e {
        case .hello:
            send(.ready(meReady))
            if screen == .play, mode == .online, let p = progress { send(.progress(p)) }
        case .bye:
            partnerSeen = 0
            partnerReady = nil
        case .ping:
            break
        case .ready(let r):
            partnerReady = r
            if let r, meReady == r, screen != .play { begin(r, .online) }
        case .progress(let theirs):
            guard screen == .play, mode == .online else { return }
            let m = EscapeProgress.merge(progress, theirs)
            if let p = progress, let m, p.same(m) { return }
            setProgress(m)
        case .hold(let side, let down):
            holds[side] = down
        case .chat(let id, let name, let text):
            chat = Array((chat + [ChatMsg(id: id, by: d.str("by") ?? "", name: name, text: text)]).suffix(41))
        }
    }

    /// keeps things moving: the clock, holding together, the pings, and the ending
    public func pulse() {
        now = clock()
        if chan != nil, now - lastPing >= 20_000 {
            lastPing = now
            send(.ping)
        }
        if let s = solving, now >= s.at {
            solving = nil
            solve(s.id)
        }
        if case .together(_, let holdMs)? = puzzle?.lock, holds[.a] == true, holds[.b] == true {
            if holdStart == nil { holdStart = now }
            holdProgress = min(1, (now - holdStart!) / holdMs)
            if holdProgress >= 1, let p = puzzle {
                holdStart = nil
                solve(p.id)
            }
        } else {
            holdStart = nil
            holdProgress = 0
        }
        if let e = endingAt, now >= e {
            endingAt = nil
            onSound?(.win)
            endingOpen = true
        }
    }

    /* ---------- the corridor and the doors ---------- */

    public func goToDoor(_ id: RoomId) {
        roomId = id
        screen = .door
    }

    public func backToCorridor() {
        setReady(nil)
        screen = .corridor
    }

    /// stand at a door, waiting for the other device (or stop waiting)
    public func setReady(_ r: RoomId?) {
        guard meReady != r else { return }
        meReady = r
        send(.ready(r))
        if let r, partnerReady == r, screen != .play { begin(r, .online) }
    }

    /// go to the door they're waiting at, and wait there too
    public func joinPartner() {
        guard let r = partnerReady else { return }
        roomId = r
        screen = .door
        setReady(r)
    }

    /// play a room on this screen (both halves here)
    public func playHere(_ id: RoomId, fromScratch: Bool = false) { begin(id, .here, fromScratch: fromScratch) }

    private func begin(_ id: RoomId, _ m: Mode, fromScratch: Bool = false) {
        let t = clock()
        now = t
        let saved = EscapeSave.load(place?.sid ?? "solo", defaults).progress[id]
        var p = EscapeProgress(room: id, startedAt: t)
        if !fromScratch, let s = saved, s.finishedAt == nil {
            p = s
            p.startedAt = s.startedAt + (t - (s.pausedAt ?? t))
            p.pausedAt = nil
        }
        roomId = id
        mode = m
        prevStep = nil
        progress = nil
        open = [:]
        fresh = [.a: [], .b: []]
        log = nil
        endingOpen = false
        endingAt = nil
        solving = nil
        holds = [.a: false, .b: false]
        activeSince = t
        viewSide = mySide
        screen = .play
        // (setProgress tells the other device)
        lastSent = ""
        setProgress(p)
    }

    /// out of the room: half done is kept for next time, with the clock stopped
    public func leave() {
        if var p = progress, p.finishedAt == nil {
            p.pausedAt = clock()
            save.progress[p.room] = p
            save.store(place?.sid ?? "solo", defaults)
        }
        progress = nil
        prevStep = nil
        endingOpen = false
        endingAt = nil
        setReady(nil)
        screen = .corridor
    }

    /* ---------- inside ---------- */

    /// tap something in a half
    public func tap(_ side: Side, _ id: String) {
        onSound?(.tick)
        open[side] = open[side] == id ? nil : id
        fresh[side]?.remove(id)
    }

    public func close(_ side: Side) { open[side] = nil }

    /// a lock's guess; when it's right, it opens a moment later
    @discardableResult
    public func guess(_ p: Puzzle, _ g: String) -> Bool {
        guard solving == nil, p.id == puzzle?.id, p.isRight(g) else { return false }
        solving = (p.id, clock() + 350)
        return true
    }

    public func sound(_ s: EscapeSound) { onSound?(s) }

    public func solve(_ id: String) {
        guard let p = progress, let r = room, let i = r.puzzleIndex(id), i == p.step else { return }
        var n = p
        n.step = p.step + 1
        if n.step >= r.puzzles.count { n.finishedAt = clock() }
        setProgress(n)
    }

    public func hint() {
        guard let p = progress, let pz = puzzle, (p.hints[pz.id] ?? 0) < 3 else { return }
        var n = p
        n.hints[pz.id] = (p.hints[pz.id] ?? 0) + 1
        setProgress(n)
    }

    public func setHold(_ side: Side, _ down: Bool) {
        if holds[side] != down { holds[side] = down }
        if mode == .online { send(.hold(side, down)) }
        pulse()
    }

    public func say(_ raw: String) {
        let text = String(raw.trimmingCharacters(in: .whitespacesAndNewlines).prefix(200))
        guard !text.isEmpty else { return }
        let msg = ChatMsg(id: "\(me)-\(Int(clock()))", by: me, name: place?.myName ?? "", text: text)
        chat = Array((chat + [msg]).suffix(41))
        send(.chat(id: msg.id, name: msg.name, text: text))
    }

    /// after the ending: back to the corridor
    public func done() {
        endingOpen = false
        progress = nil
        prevStep = nil
        setReady(nil)
        screen = .corridor
    }

    /// everything that follows from progress changing: keeping it, sharing it, and what just opened
    private func setProgress(_ next: EscapeProgress?) {
        progress = next
        guard let p = next, let r = room else {
            prevStep = nil
            return
        }
        save.progress[p.room] = p
        if let f = p.finishedAt {
            let t = f - p.startedAt
            save.best[p.room] = save.best[p.room].map { min($0, t) } ?? t
        }
        save.store(place?.sid ?? "solo", defaults)
        let sig = "\(p.room.rawValue)|\(p.step)|\(p.hints.sorted { $0.key < $1.key })|\(p.finishedAt ?? -1)"
        if mode == .online, sig != lastSent {
            lastSent = sig
            send(.progress(p))
        }

        let before = prevStep
        prevStep = p.step
        guard let b = before, p.step > b else { return }
        // something just opened
        let solved = r.puzzles[p.step - 1]
        log = solved.solved
        activeSince = clock()
        holds = [.a: false, .b: false]
        holdStart = nil
        holdProgress = 0
        if case .sequence = solved.lock {
            onSound?(.melody(solved.answer.split(separator: ",").compactMap { EscapeColor(rawValue: String($0)) }))
        } else {
            onSound?(.open)
        }
        for s in Side.allCases {
            if let o = r.object(open[s]), o.view(at: b)?.puzzle == solved.id { open[s] = nil }
        }
        for o in r.objects where o.views.contains(where: { $0.from == p.step }) { fresh[o.side, default: []].insert(o.id) }
        if p.step >= r.puzzles.count { endingAt = clock() + 900 }
    }
}
