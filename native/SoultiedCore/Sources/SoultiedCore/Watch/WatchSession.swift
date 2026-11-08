import Foundation
import Observation

/*
 * Watching YouTube together (src/components/WatchParty.tsx and src/watch/sync.ts). Each of you plays the
 * video in your own YouTube player; what one of you does (put a video on, play, pause, skip ahead) goes to
 * the other as a small message on the place's "watch" line, the same one the website uses, so a phone and a
 * laptop watch together. Whoever acted last leads: while their video plays they send where they are every
 * so often, and the other player only moves when it has really drifted. Plus a couch chat and reactions.
 *
 * The player itself lives in the app (a YouTube player in a web view, behind WatchPlayer). The app calls
 * tick() a few times a second; everything else is driven by the player's news and the other person's
 * messages, so it can all be checked here without a screen.
 */

/// YouTube's player states (YT.PlayerState)
public enum YTState: Int, Sendable {
    case unstarted = -1, ended = 0, playing = 1, paused = 2, buffering = 3, cued = 5
}

/// the YouTube player on this phone
public protocol WatchPlayer: AnyObject {
    /// where it is, in seconds
    var time: Double { get }
    var state: YTState { get }
    /// how long the video is (0 until it knows)
    var duration: Double { get }
    /// load a video and play it from `at`
    func load(_ id: String, at: Double)
    /// load a video and wait at `at`
    func cue(_ id: String, at: Double)
    func seek(_ t: Double)
    func play()
    func pause()
    func stop()
}

public struct WatchChat: Identifiable, Equatable, Sendable {
    public let id: String
    public let by: String
    public let name: String
    public let text: String
    public let at: Double
}

/// what goes along the line between you (src/watch/sync.ts's WatchEvent, minus karaoke and calls)
public enum WatchEvent: Equatable, Sendable {
    case load(videoId: String, pos: Double)
    case clear
    case play(pos: Double)
    case pause(pos: Double)
    case seek(pos: Double, playing: Bool)
    case state(videoId: String?, pos: Double, playing: Bool, reply: Bool)
    case hello, ping, bye
    case react(ReactionKind)
    case chat(id: String, text: String, name: String)

    public init?(_ d: Doc) {
        let pos = d.num("pos") ?? 0
        switch d.str("type") {
        case "load":
            guard let v = d.str("videoId") else { return nil }
            self = .load(videoId: v, pos: pos)
        case "clear": self = .clear
        case "play": self = .play(pos: pos)
        case "pause": self = .pause(pos: pos)
        case "seek": self = .seek(pos: pos, playing: d.bool("playing"))
        case "state": self = .state(videoId: d.str("videoId"), pos: pos, playing: d.bool("playing"), reply: d.bool("reply"))
        case "hello": self = .hello
        case "ping": self = .ping
        case "bye": self = .bye
        case "react":
            guard let k = d.str("kind").flatMap(ReactionKind.init) else { return nil }
            self = .react(k)
        case "chat":
            guard let id = d.str("id"), let text = d.str("text") else { return nil }
            self = .chat(id: id, text: text, name: d.str("name") ?? "")
        default: return nil
        }
    }

    public func doc(by: String, at: Double) -> Doc {
        var d: Doc = ["by": by, "at": at]
        switch self {
        case .load(let v, let pos): d["type"] = "load"; d["videoId"] = v; d["pos"] = pos
        case .clear: d["type"] = "clear"
        case .play(let pos): d["type"] = "play"; d["pos"] = pos
        case .pause(let pos): d["type"] = "pause"; d["pos"] = pos
        case .seek(let pos, let playing): d["type"] = "seek"; d["pos"] = pos; d["playing"] = playing
        case .state(let v, let pos, let playing, let reply):
            d["type"] = "state"
            d["videoId"] = v ?? NSNull()
            d["pos"] = pos
            d["playing"] = playing
            if reply { d["reply"] = true }
        case .hello: d["type"] = "hello"
        case .ping: d["type"] = "ping"
        case .bye: d["type"] = "bye"
        case .react(let k): d["type"] = "react"; d["kind"] = k.rawValue
        case .chat(let id, let text, let name): d["type"] = "chat"; d["id"] = id; d["text"] = text; d["name"] = name
        }
        return d
    }
}

/// where the other person's player should be right now (src/watch/sync.ts)
public func projectedPosition(_ pos: Double, _ at: Double, _ playing: Bool, _ now: Double) -> Double {
    playing ? pos + max(0, now - at) / 1000 : pos
}

/// what YouTube's error codes mean, in words
public func describeYouTubeError(_ code: Int) -> String {
    if code == 101 || code == 150 { return "This video’s owner doesn’t allow it to be played outside YouTube. Try another one." }
    if code == 100 { return "That video couldn’t be found. It may be private or removed." }
    if code == 2 { return "That doesn’t look like a valid YouTube link." }
    return "YouTube had trouble playing that video. Try again or pick another."
}

@Observable
public final class WatchSession {
    public let me: String
    public let myName: String
    /// the place's creator sits on the left
    public let mySeat: WatchSeatSide
    public var theirSeat: WatchSeatSide { mySeat == .left ? .right : .left }

    /// what's on the TV (nil: nothing)
    public private(set) var videoId: String?
    /// what the TV's doing, for the room (idle while there's nothing on)
    public var tv: TvState { videoId == nil ? .idle : tvState }
    public private(set) var partnerHere = false
    public private(set) var chat: [WatchChat] = []
    public private(set) var reactions: [WatchReaction] = []
    /// something to say about the video (it can't play, the link isn't one)
    public var notice: String?
    /// the player wants a tap before it'll play
    public private(set) var needsTap = false
    /// the player has started up
    public private(set) var ready = false

    @ObservationIgnored private var tvState: TvState = .idle
    @ObservationIgnored private weak var player: WatchPlayer?
    @ObservationIgnored private var chan: LiveChannel?
    @ObservationIgnored private let channel: () -> LiveChannel?
    @ObservationIgnored private let clock: () -> Double
    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private let saveKey: String
    @ObservationIgnored private var suppressUntil = 0.0
    @ObservationIgnored private var expected: (pos: Double, at: Double, playing: Bool)
    @ObservationIgnored private var leader: String
    @ObservationIgnored private var pending: (videoId: String, pos: Double, at: Double, playing: Bool)?
    @ObservationIgnored private var firstStart: Double?
    @ObservationIgnored private var lastSeen = 0.0
    @ObservationIgnored private var joinedAt = 0.0
    @ObservationIgnored private var lastPing = 0.0
    @ObservationIgnored private var lastBeat = 0.0
    @ObservationIgnored private var lastSave = 0.0
    @ObservationIgnored private var askedToPlayAt: Double?

    /// online, every message is a small write, so check in less often (as the website does)
    static let pingEvery = 20_000.0
    static let goneAfter = 50_000.0
    static let beatEvery = 15_000.0

    public init(me: String, myName: String, mySeat: WatchSeatSide, sid: String, channel: @escaping () -> LiveChannel?, clock: @escaping () -> Double = Values.nowMs, defaults: UserDefaults = .standard) {
        self.me = me
        self.myName = myName
        self.mySeat = mySeat
        self.channel = channel
        self.clock = clock
        self.defaults = defaults
        saveKey = "soultied_watch_\(sid)"
        leader = me
        let now = clock()
        expected = (0, now, false)
        // back where you left off (paused), until your person says otherwise
        if let saved = defaults.dictionary(forKey: saveKey), let v = saved["videoId"] as? String, YouTubeLink.isId(v) {
            let pos = (saved["pos"] as? Double) ?? 0
            videoId = v
            expected = (pos, now, false)
            pending = (v, pos, now, false)
        }
    }

    public convenience init(place: PlaceModel) {
        self.init(me: place.me, myName: place.myName, mySeat: place.mySeat == .a ? .left : .right, sid: place.sid, channel: { [weak place] in place?.liveChannel("watch") })
    }

    /* ---------- the line to the other person ---------- */

    public func start() {
        guard chan == nil, let c = channel() else { return }
        chan = c
        let now = clock()
        joinedAt = now
        c.subscribe { [weak self] d in self?.receive(d) }
        send(.hello)
        lastPing = now
    }

    public func stop() {
        guard let c = chan else { return }
        send(.bye)
        c.close()
        chan = nil
    }

    private func send(_ e: WatchEvent) { chan?.send(e.doc(by: me, at: clock())) }

    private func suppress(_ ms: Double) { suppressUntil = clock() + ms }

    func receive(_ d: Doc) {
        guard let by = d.str("by"), by != me, let e = WatchEvent(d) else { return }
        let at = d.num("at") ?? clock()
        lastSeen = clock()
        partnerHere = e != .bye
        switch e {
        case .bye, .ping: break
        case .hello:
            // they just walked in: tell them what's on
            let p = player
            send(.state(videoId: videoId, pos: p?.time ?? expected.pos, playing: p?.state == .playing, reply: true))
        case .react(let k): addReaction(k, theirSeat)
        case .chat(let id, let text, let name):
            chat = Array((chat + [WatchChat(id: id, by: by, name: name, text: text, at: at)]).suffix(81))
        case .load(let v, let pos):
            leader = by
            notice = nil
            applyRemote(v, pos, at, true, tolerance: 0)
        case .clear:
            leader = by
            clearTv()
        case .play(let pos):
            leader = by
            applyRemote(nil, pos, at, true, tolerance: 0.6)
        case .pause(let pos):
            leader = by
            applyRemote(nil, pos, at, false, tolerance: 0.4)
        case .seek(let pos, let playing):
            leader = by
            applyRemote(nil, pos, at, playing, tolerance: 0.3)
        case .state(let v, let pos, let playing, let reply):
            if reply {
                // catching up when one of you walks in
                let justArrived = clock() - joinedAt < 6000
                if let v, justArrived || playing || videoId == nil || v != videoId {
                    leader = by
                    applyRemote(v, pos, at, playing, tolerance: 1)
                }
            } else if v == videoId && playing && leader == by {
                // the leader's heartbeat: only correct real drift
                applyRemote(nil, pos, at, true, tolerance: 1.5)
            }
        }
    }

    /// line this player up with what the other person's doing
    private func applyRemote(_ target: String?, _ pos0: Double, _ at: Double, _ playing: Bool, tolerance: Double) {
        guard let vid = target ?? videoId else { return }
        let now = clock()
        let pos = projectedPosition(pos0, at, playing, now)
        expected = (pos, now, playing)
        guard vid == videoId, let p = player else {
            pending = (vid, pos0, at, playing)
            if vid != videoId { videoId = vid }
            if let p = player {
                suppress(2500)
                if playing { p.load(vid, at: pos) } else { p.cue(vid, at: pos) }
                pending = nil
            }
            return
        }
        suppress(1500)
        if abs(p.time - pos) > tolerance { p.seek(pos) }
        let st = p.state
        if playing && st != .playing {
            p.play()
            askedToPlayAt = now
        }
        if !playing && st == .playing { p.pause() }
    }

    /// take the video off the TV (stop it, empty the screen, forget it here)
    private func clearTv() {
        suppress(2500)
        expected = (0, clock(), false)
        pending = nil
        player?.stop()
        videoId = nil
        tvState = .idle
        needsTap = false
        notice = nil
        defaults.removeObject(forKey: saveKey)
    }

    private func addReaction(_ k: ReactionKind, _ seat: WatchSeatSide) {
        let now = clock()
        reactions = reactions.filter { now - $0.t0 < 2000 } + [WatchReaction(kind: k, seat: seat, t0: now)]
    }

    /* ---------- the player's news ---------- */

    /// the player's about to be made: which video, from where, and whether it should start playing
    public func playerWillLoad() -> (videoId: String, start: Double, autoplay: Bool)? {
        guard let v = pending?.videoId ?? videoId else { return nil }
        let first = pending
        pending = nil
        let start = first.map { projectedPosition($0.pos, $0.at, $0.playing, clock()) } ?? 0
        firstStart = first == nil ? nil : start
        return (v, start, !(first.map { !$0.playing } ?? false))
    }

    public func playerReady(_ p: WatchPlayer) {
        player = p
        ready = true
        // taken off the TV while it was still loading
        guard videoId != nil else {
            p.stop()
            return
        }
        suppress(1500)
        if let s = firstStart, abs(p.time - s) > 1 { p.seek(s) }
        firstStart = nil
        if let pend = pending {
            pending = nil
            applyRemote(pend.videoId, pend.pos, pend.at, pend.playing, tolerance: 0.5)
        }
    }

    /// the player's gone (you left the room)
    public func playerGone() {
        player = nil
        ready = false
    }

    public func playerChanged(_ st: YTState, at time: Double) {
        if st == .playing {
            tvState = .playing
            needsTap = false
        } else if st == .paused || st == .ended || st == .cued {
            tvState = .paused
        }
        // buffering and cued aren't anyone deciding anything
        guard st == .playing || st == .paused else { return }
        let isPlaying = st == .playing
        let now = clock()
        // an echo of what the other person just did: swallow it. Anything else is a real tap.
        if now < suppressUntil && isPlaying == expected.playing { return }
        leader = me
        expected = (time, now, isPlaying)
        send(isPlaying ? .play(pos: time) : .pause(pos: time))
    }

    public func playerError(_ code: Int) { notice = describeYouTubeError(code) }

    /// a few times a second: notice skipping ahead, keep the other player in step, say you're still here
    public func tick() {
        let now = clock()
        if let p = player, videoId != nil, now >= suppressUntil {
            let cur = p.time
            let playing = p.state == .playing
            let guess = projectedPosition(expected.pos, expected.at, expected.playing, now)
            if abs(cur - guess) > 1.5 {
                leader = me
                send(.seek(pos: cur, playing: playing))
            }
            expected = (cur, now, playing)
        }
        if now - lastBeat >= Self.beatEvery {
            lastBeat = now
            if let p = player, leader == me, now >= suppressUntil, p.state == .playing {
                send(.state(videoId: videoId, pos: p.time, playing: true, reply: false))
            }
        }
        if now - lastSave >= 5000 {
            lastSave = now
            if let p = player, let v = videoId { defaults.set(["videoId": v, "pos": p.time], forKey: saveKey) }
        }
        if now - lastPing >= Self.pingEvery {
            lastPing = now
            send(.ping)
            if now - lastSeen > Self.goneAfter { partnerHere = false }
        }
        if let asked = askedToPlayAt, now - asked >= 1800 {
            askedToPlayAt = nil
            if let p = player, p.state != .playing, expected.playing { needsTap = true }
        }
        if reactions.contains(where: { now - $0.t0 >= 2000 }) { reactions = reactions.filter { now - $0.t0 < 2000 } }
    }

    /* ---------- what you do ---------- */

    /// put a video from a YouTube link on the TV, for both of you; what's wrong with the link, if it isn't one
    @discardableResult
    public func putOn(_ link: String) -> String? {
        guard let id = YouTubeLink.id(link) else {
            let msg = "That doesn’t look like a YouTube link. Paste the address of a video (youtube.com/watch?v=… or youtu.be/…)."
            notice = msg
            return msg
        }
        loadVideo(id, YouTubeLink.start(link))
        return nil
    }

    private func loadVideo(_ id: String, _ start: Double) {
        notice = nil
        leader = me
        let now = clock()
        expected = (start, now, true)
        if let p = player {
            suppress(2000)
            p.load(id, at: start)
        } else {
            pending = (id, start, now, true)
        }
        videoId = id
        send(.load(videoId: id, pos: start))
    }

    /// take the video off, for both of you
    public func takeOff() {
        leader = me
        clearTv()
        send(.clear)
    }

    public func react(_ k: ReactionKind) {
        addReaction(k, mySeat)
        send(.react(k))
    }

    public func say(_ text: String) {
        let t = String(text.trimmingCharacters(in: .whitespacesAndNewlines).prefix(300))
        guard !t.isEmpty else { return }
        let now = clock()
        let msg = WatchChat(id: "\(me)-\(Int(now))", by: me, name: myName, text: t, at: now)
        chat = Array((chat + [msg]).suffix(81))
        send(.chat(id: msg.id, text: t, name: myName))
    }

    /// the player wanted a tap before it would play
    public func listen() {
        needsTap = false
        player?.play()
    }
}
