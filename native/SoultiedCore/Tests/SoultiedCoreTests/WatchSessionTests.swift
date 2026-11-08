import XCTest
@testable import SoultiedCore

/// a YouTube player that does what it's told, instantly, on a pretend clock
final class FakePlayer: WatchPlayer {
    let clock: () -> Double
    var video: String?
    var pos = 0.0
    var since = 0.0
    var st: YTState = .unstarted
    var log: [String] = []
    init(clock: @escaping () -> Double) { self.clock = clock }

    var time: Double { st == .playing ? pos + (clock() - since) / 1000 : pos }
    var state: YTState { st }
    var duration: Double { 600 }
    private func at(_ t: Double) {
        pos = t
        since = clock()
    }
    func load(_ id: String, at t: Double) {
        video = id
        at(t)
        st = .playing
        log.append("load \(id) \(t)")
    }
    func cue(_ id: String, at t: Double) {
        video = id
        at(t)
        st = .cued
        log.append("cue \(id) \(t)")
    }
    func seek(_ t: Double) {
        at(t)
        log.append("seek \(t)")
    }
    func play() {
        at(time)
        st = .playing
        log.append("play")
    }
    func pause() {
        at(time)
        st = .paused
        log.append("pause")
    }
    func stop() {
        st = .unstarted
        video = nil
        log.append("stop")
    }
}

/// Watching together: two phones (or a phone and the website) on one watch line, each with its own player.
final class WatchSessionTests: XCTestCase {
    var now = 1_790_000_000_000.0
    let db = MemoryBackend(synchronous: true)
    var sent: [Doc] = []

    func session(_ me: String, _ seat: WatchSeatSide) -> WatchSession {
        let defaults = UserDefaults(suiteName: "watch-test-\(me)-\(UUID().uuidString)")!
        return WatchSession(me: me, myName: me == "ua" ? "Aanya" : "Rohan", mySeat: seat, sid: "s1", channel: { [db] in db.live("spaces/s1/live/watch/events") }, clock: { [unowned self] in self.now }, defaults: defaults)
    }

    /// what's said on the line, as the website would read it
    func listen() {
        let spy = db.live("spaces/s1/live/watch/events")
        spy.subscribe { [unowned self] d in self.sent.append(d) }
    }

    func later(_ ms: Double, _ sessions: WatchSession...) {
        var left = ms
        while left > 0 {
            let step = min(700, left)
            now += step
            left -= step
            sessions.forEach { $0.tick() }
        }
    }

    func testWatchingTogether() {
        listen()
        let a = session("ua", .left), b = session("ub", .right)
        a.start()
        b.start()
        XCTAssertTrue(a.partnerHere)
        XCTAssertTrue(b.partnerHere)
        XCTAssertEqual(a.tv, .idle)

        // Aanya puts a video on, from a minute in
        XCTAssertNotNil(a.putOn("https://vimeo.com/1"))
        XCTAssertNil(a.putOn("https://youtu.be/dQw4w9WgXcQ?t=60"))
        XCTAssertEqual(b.videoId, "dQw4w9WgXcQ")
        let load = sent.last { $0.str("type") == "load" }!
        XCTAssertEqual(load.str("videoId"), "dQw4w9WgXcQ")
        XCTAssertEqual(load.num("pos"), 60)
        XCTAssertEqual(load.str("by"), "ua")

        // both players start up: each starts where it should be
        let pa = FakePlayer(clock: { [unowned self] in self.now }), pb = FakePlayer(clock: { [unowned self] in self.now })
        now += 2000
        let fa = a.playerWillLoad()!, fb = b.playerWillLoad()!
        XCTAssertEqual(fa.videoId, "dQw4w9WgXcQ")
        // (two seconds after it went on, both start two seconds in)
        XCTAssertEqual(fa.start, 62, accuracy: 0.001)
        XCTAssertEqual(fb.start, 62, accuracy: 0.001)
        XCTAssertTrue(fb.autoplay)
        pa.load(fa.videoId, at: fa.start)
        pb.load(fb.videoId, at: fb.start)
        a.playerReady(pa)
        b.playerReady(pb)
        a.playerChanged(.playing, at: pa.time)
        b.playerChanged(.playing, at: pb.time)
        XCTAssertEqual(a.tv, .playing)
        later(3000, a, b)

        // Rohan pauses: Aanya's player pauses at the same spot
        sent.removeAll()
        pb.pause()
        b.playerChanged(.paused, at: pb.time)
        XCTAssertEqual(pa.state, .paused)
        XCTAssertEqual(pa.time, pb.time, accuracy: 0.01)
        // her player saying it paused is an echo, not news
        a.playerChanged(.paused, at: pa.time)
        XCTAssertEqual(sent.filter { $0.str("by") == "ua" && $0.str("type") == "pause" }.count, 0)
        later(2000, a, b)

        // Aanya skips ahead while paused: Rohan follows
        pa.seek(200)
        later(700, a, b)
        XCTAssertEqual(pb.time, 200, accuracy: 0.01)
        XCTAssertEqual(pb.state, .paused)
        later(2000, a, b)

        // and plays: both play from there
        pa.play()
        a.playerChanged(.playing, at: pa.time)
        XCTAssertEqual(pb.state, .playing)
        XCTAssertEqual(pb.time, 200, accuracy: 0.01)
        later(20_000, a, b)
        XCTAssertEqual(pb.time, pa.time, accuracy: 0.1)

        // reactions and the couch chat
        a.react(.heart)
        XCTAssertEqual(b.reactions.map(\.kind), [.heart])
        XCTAssertEqual(b.reactions.first?.seat, .left)
        later(2100, a, b)
        XCTAssertEqual(b.reactions, [])
        b.say("  this part!  ")
        b.say("   ")
        XCTAssertEqual(a.chat.map(\.text), ["this part!"])
        XCTAssertEqual(a.chat.first?.name, "Rohan")

        // taking it off empties both TVs
        b.takeOff()
        XCTAssertNil(a.videoId)
        XCTAssertEqual(a.tv, .idle)
        XCTAssertEqual(pa.log.last, "stop")
    }

    func testWalkingInLate() {
        let a = session("ua", .left)
        a.start()
        XCTAssertFalse(a.partnerHere)
        a.putOn("dQw4w9WgXcQ")
        let pa = FakePlayer(clock: { [unowned self] in self.now })
        let f = a.playerWillLoad()!
        pa.load(f.videoId, at: f.start)
        a.playerReady(pa)
        a.playerChanged(.playing, at: pa.time)
        later(30_000, a)

        // Rohan opens Watch: Aanya's phone tells his where it's at, and his player starts there
        let b = session("ub", .right)
        b.start()
        XCTAssertTrue(a.partnerHere)
        XCTAssertEqual(b.videoId, "dQw4w9WgXcQ")
        let pb = FakePlayer(clock: { [unowned self] in self.now })
        now += 1500
        let fb = b.playerWillLoad()!
        XCTAssertTrue(fb.autoplay)
        XCTAssertEqual(fb.start, pa.time, accuracy: 0.01)
        pb.load(fb.videoId, at: fb.start)
        b.playerReady(pb)
        later(5000, a, b)
        XCTAssertEqual(pb.time, pa.time, accuracy: 0.1)

        // he leaves: after a while she sees he's gone
        b.stop()
        XCTAssertFalse(a.partnerHere)
    }

    func testWhatGoesOnTheLine() {
        // what the website sends, exactly as it writes it
        XCTAssertEqual(WatchEvent(["type": "load", "videoId": "dQw4w9WgXcQ", "pos": 12.5, "by": "x", "at": 1]), .load(videoId: "dQw4w9WgXcQ", pos: 12.5))
        XCTAssertEqual(WatchEvent(["type": "state", "videoId": NSNull(), "pos": 0, "playing": false, "by": "x", "at": 1, "reply": true]), .state(videoId: nil, pos: 0, playing: false, reply: true))
        XCTAssertEqual(WatchEvent(["type": "react", "kind": "laugh", "by": "x", "at": 1]), .react(.laugh))
        XCTAssertNil(WatchEvent(["type": "react", "kind": "nope", "by": "x", "at": 1]))
        // calls and karaoke aren't on the phone yet: ignored
        XCTAssertNil(WatchEvent(["type": "media", "cam": true, "by": "x", "at": 1]))
        XCTAssertNil(WatchEvent(["type": "queue", "by": "x", "at": 1]))
        let d = WatchEvent.state(videoId: nil, pos: 3, playing: true, reply: true).doc(by: "me", at: 5)
        XCTAssertTrue(d["videoId"] is NSNull)
        XCTAssertEqual(d.str("type"), "state")
        XCTAssertEqual(d["reply"] as? Bool, true)
        XCTAssertNil(WatchEvent.state(videoId: "v", pos: 3, playing: true, reply: false).doc(by: "me", at: 5)["reply"])
        XCTAssertEqual(describeYouTubeError(150), "This video’s owner doesn’t allow it to be played outside YouTube. Try another one.")
        XCTAssertEqual(projectedPosition(10, 1000, true, 3000), 12)
        XCTAssertEqual(projectedPosition(10, 1000, false, 3000), 10)
    }

    func testBackWhereYouLeftOff() {
        let defaults = UserDefaults(suiteName: "watch-test-saved-\(UUID().uuidString)")!
        let a = WatchSession(me: "ua", myName: "Aanya", mySeat: .left, sid: "s1", channel: { nil }, clock: { [unowned self] in self.now }, defaults: defaults)
        a.putOn("dQw4w9WgXcQ")
        let pa = FakePlayer(clock: { [unowned self] in self.now })
        let f = a.playerWillLoad()!
        pa.load(f.videoId, at: f.start)
        a.playerReady(pa)
        later(12_000, a)
        // next time, the same video waits (paused) where it was
        let again = WatchSession(me: "ua", myName: "Aanya", mySeat: .left, sid: "s1", channel: { nil }, clock: { [unowned self] in self.now }, defaults: defaults)
        XCTAssertEqual(again.videoId, "dQw4w9WgXcQ")
        let g = again.playerWillLoad()!
        XCTAssertFalse(g.autoplay)
        XCTAssertGreaterThan(g.start, 5)
        a.takeOff()
        XCTAssertNil(WatchSession(me: "ua", myName: "Aanya", mySeat: .left, sid: "s1", channel: { nil }, clock: { [unowned self] in self.now }, defaults: defaults).videoId)
    }
}
