import XCTest
@testable import SoultiedCore

/// Netflix / Prime together: the app standing in for the extension's background page and the Soultied tab.
final class StreamHubTests: XCTestCase {
    final class Clock { var t: Double = 1_790_000_000_000 }

    /// what the browser's player was sent, by port
    final class Player {
        var heard: [(Int, Doc)] = []
        func kinds(_ port: Int) -> [String] { heard.filter { $0.0 == port }.compactMap { $0.1.str("kind") } }
        func events(_ port: Int) -> [Doc] { heard.filter { $0.0 == port && $0.1.str("kind") == "event" }.compactMap { $0.1["e"] as? Doc } }
    }

    private func msg(_ port: Int, _ m: Doc) -> Doc { ["op": "msg", "port": port, "name": "player", "msg": m] }

    func testTwoPhonesOnTheStreamLine() {
        let db = MemoryBackend(synchronous: true)
        let c = Clock()
        let session: Doc = ["me": ["id": "a", "name": "Aanya"], "partner": ["id": "b", "name": "Rohan"]]
        let a = StreamHub(me: "a", clock: { c.t }, session: { session }, line: { db.live("spaces/s/live/stream/events") })
        let b = StreamHub(me: "b", clock: { c.t }, session: { nil }, line: { db.live("spaces/s/live/stream/events") })
        let pa = Player(), pb = Player()
        a.toPlayer = { pa.heard.append(($0, $1)) }
        b.toPlayer = { pb.heard.append(($0, $1)) }
        a.start()
        b.start()

        // Aanya's Netflix page: the player connects and says hello, and is told who you both are
        a.fromPlayer(["op": "connect", "port": 1, "name": "player", "url": "https://www.netflix.com/watch/1"])
        a.fromPlayer(msg(1, ["kind": "hello"]))
        XCTAssertTrue(a.playerHere)
        XCTAssertEqual(pa.kinds(1), ["session"])
        XCTAssertEqual((pa.heard[0].1["session"] as? Doc)?["me"] as? [String: String], ["id": "a", "name": "Aanya"])
        // (no session on Rohan's side: the player hears there's no hub)
        b.fromPlayer(["op": "connect", "port": 7, "name": "player"])
        b.fromPlayer(msg(7, ["kind": "hello"]))
        XCTAssertEqual(pb.kinds(7), ["nohub"])

        // she presses play: it goes down the line to his player, not back to hers
        let play: Doc = ["type": "play", "pos": 12.5, "key": "nf:1", "by": "a", "at": c.t]
        a.fromPlayer(msg(1, ["kind": "send", "e": play]))
        XCTAssertEqual(pb.events(7).map { $0.str("type") }, ["play"])
        XCTAssertEqual(pb.events(7).first?.num("pos"), 12.5)
        XCTAssertTrue(pa.events(1).isEmpty)
        XCTAssertTrue(b.partnerWatching)
        XCTAssertFalse(a.partnerWatching)

        // his chat reaches her; the cameras' signalling doesn't go to the player
        b.fromPlayer(msg(7, ["kind": "send", "e": ["type": "chat", "id": "c1", "text": "this part!", "by": "b", "at": c.t]]))
        b.fromPlayer(msg(7, ["kind": "send", "e": ["type": "media", "cam": false, "talking": false, "by": "b", "at": c.t]]))
        XCTAssertEqual(pa.events(1).map { $0.str("type") }, ["chat"])
        XCTAssertTrue(a.partnerWatching)
        c.t += 46_000
        XCTAssertFalse(a.partnerWatching, "quiet for a while: not watching any more")

        // the player's status: what's on
        a.fromPlayer(msg(1, ["kind": "status", "status": ["platform": "netflix", "video": true, "title": ["show": "Dark", "episode": "S1:E2 · Lies"]]]))
        XCTAssertTrue(a.hasVideo)
        XCTAssertEqual(StreamHub.label(a.title), "Dark S1:E2")

        // a watch-party button pressed by mistake gets an answer rather than silence
        a.fromPlayer(msg(1, ["kind": "startParty", "name": "Aanya"]))
        XCTAssertEqual(pa.kinds(1).last, "partyError")

        // she closes the browser: her player's goodbye still reaches him
        a.stop()
        XCTAssertEqual(pb.events(7).last?.str("type"), "bye")
        XCTAssertFalse(b.partnerWatching)
        XCTAssertFalse(a.playerHere)
    }

    func testSaidBeforeTheLineOpens() {
        let db = MemoryBackend(synchronous: true)
        var lineOpen = false
        let a = StreamHub(me: "a", session: { ["me": ["id": "a"]] }, line: { lineOpen ? db.live("l") : nil })
        let b = StreamHub(me: "b", session: { ["me": ["id": "b"]] }, line: { db.live("l") })
        let pb = Player()
        b.toPlayer = { pb.heard.append(($0, $1)) }
        b.start()
        b.fromPlayer(["op": "connect", "port": 1, "name": "player"])
        a.start()
        a.fromPlayer(["op": "msg", "port": 3, "name": "player", "msg": ["kind": "send", "e": ["type": "pause", "pos": 3, "by": "a", "at": 1]]])
        XCTAssertTrue(pb.events(1).isEmpty, "no line yet: it waits")
        lineOpen = true
        a.refresh()
        XCTAssertEqual(pb.events(1).map { $0.str("type") }, ["pause"])
    }

    @MainActor
    func testYourPlaceAndWhatYouWatched() async throws {
        let db = Demo.backend()
        db.synchronous = true
        let place = PlaceModel(db: db, sid: Demo.sid, me: Demo.me)
        place.start()
        for _ in 0..<4 { try? await Task.sleep(nanoseconds: 20_000_000) }
        XCTAssertTrue(place.ready)
        let hub = StreamHub(place: place)
        let p = Player()
        hub.toPlayer = { p.heard.append(($0, $1)) }
        hub.start()
        hub.fromPlayer(["op": "connect", "port": 1, "name": "player"])
        hub.fromPlayer(msg(1, ["kind": "hello"]))
        let s = try XCTUnwrap(p.heard.last?.1["session"] as? Doc)
        XCTAssertEqual((s["me"] as? Doc)?.str("id"), Demo.me)
        XCTAssertEqual((s["me"] as? Doc)?.str("name"), place.myName)
        XCTAssertEqual((s["partner"] as? Doc)?.str("id"), Demo.them)
        XCTAssertNotNil((s["partner"] as? Doc)?["avatar"] as? Doc, "the couch draws their character")
        XCTAssertEqual(s.str("leftId"), place.hostId)
        XCTAssertEqual(s.str("hubUrl"), "https://soultied.app/")
        let closeness = try XCTUnwrap(s.num("closeness"))
        XCTAssertTrue((0...1).contains(closeness))

        // an episode watched together: kept in meta/stream (the website reads the same), and the player's
        // told again with the new list (for "no watching ahead")
        let before = p.heard.count
        hub.fromPlayer(msg(1, ["kind": "watched", "pos": 1500, "title": [
            "platform": "netflix", "key": "nf:80100172", "showKey": "nf:show:80100172", "show": "Dark", "episode": "S1:E2 · Lies",
            "url": "https://www.netflix.com/watch/80100172",
        ]]))
        for _ in 0..<3 { try? await Task.sleep(nanoseconds: 20_000_000) }
        let stream = try XCTUnwrap(db.snapshot("spaces/\(Demo.sid)/meta/stream"))
        XCTAssertEqual(((stream["seen"] as? Doc)?["nf:80100172"] as? Doc)?.str("show"), "Dark")
        XCTAssertEqual(((stream["shows"] as? Doc)?["nf:show:80100172"] as? Doc)?.num("pos"), 1500)
        XCTAssertNotNil(((hub.log["seen"] as? Doc)?["nf:80100172"]))
        XCTAssertGreaterThan(p.heard.count, before)
        XCTAssertNotNil(((p.heard.last?.1["session"] as? Doc)?["log"] as? Doc).flatMap { ($0["seen"] as? Doc)?["nf:80100172"] })
        hub.stop()
        place.stop()
    }
}
