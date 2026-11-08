import XCTest
@testable import SoultiedCore

/// The escape rooms: the words come from the website's rooms, the paintings are checked against the website's
/// painters pixel for pixel (scripts/native-fixtures.ts hashes every room, half and step), and the progress and
/// messages are the website's shape.
final class EscapeTests: XCTestCase {
    func fnv(_ a: [UInt8], _ seed: UInt32) -> UInt32 {
        var h = seed
        for b in a { h = (h ^ UInt32(b)) &* 0x0100_0193 }
        return h
    }

    func testRoomsLoad() throws {
        let rooms = EscapeRoom.all
        guard !rooms.isEmpty else { throw XCTSkip("no escape.json (run scripts/native-escape.ts)") }
        XCTAssertEqual(rooms.map(\.id), [.attic, .cellar, .office, .library])
        for r in rooms {
            XCTAssertEqual(r.puzzles.count, 5, r.title)
            XCTAssertFalse(r.intro.isEmpty)
            XCTAssertFalse(r.sides[.a]!.name.isEmpty)
            XCTAssertFalse(r.ending.text.isEmpty)
            for p in r.puzzles {
                XCTAssertEqual(p.hints.count, 3, p.id)
                XCTAssertTrue(p.isRight(p.answer), p.id)
                // every puzzle can be reached by tapping something, on the side it belongs to
                let at = r.puzzleIndex(p.id)!
                let opener = r.objects.first { o in o.view(at: at)?.puzzle == p.id }
                XCTAssertNotNil(opener, "\(r.id) \(p.id)")
                if let side = p.side, let o = opener { XCTAssertEqual(o.side, side, "\(r.id) \(p.id)") }
            }
            for o in r.objects { XCTAssertTrue(o.views.allSatisfy { $0.clue != nil || $0.puzzle != nil || $0.text != nil }, o.id) }
        }
        let kinds = Set(rooms.flatMap { $0.puzzles.map(\.lock.kind) })
        XCTAssertEqual(kinds, ["digits", "letters", "glyphs", "sequence", "switches", "clock", "grid", "choice", "map", "together"])
        let attic = rooms[0]
        XCTAssertEqual(attic.object("trunk")?.view(at: 0)?.puzzle, "trunk")
        if case .glyphs(_, _, let g)? = attic.object("trunk")?.view(at: 1)?.clue { XCTAssertEqual(g, [.anchor, .rose, .moon, .heart]) } else { XCTFail("the photo") }
        XCTAssertNil(attic.object("letterbox")?.view(at: 3), "not there yet")
        if case .letters(_, _, let l)? = attic.object("photos")?.view(at: 0)?.clue {
            XCTAssertEqual(l.map(\.0), [1, 2, 3, 4])
            XCTAssertEqual(l.map(\.1), ["H", nil, "M", nil])
        } else { XCTFail("the photos") }
    }

    func testPaintingsMatchTheWebsite() throws {
        guard let shots = LettersTests.fx?["escape"] as? [Doc] else { throw XCTSkip("no fixtures (set SOULTIED_FIXTURES)") }
        XCTAssertEqual(shots.count, 192)
        let canvas = EscapeCanvas()
        var bad: [String] = []
        for s in shots {
            let room = RoomId(rawValue: s.str("room")!)!, side = Side(rawValue: s.str("side")!)!
            let step = s.int("step")!, t = s.num("t")!
            _ = EscapeRooms.paint(room, side, step, t, into: canvas)
            let h = fnv(canvas.data, fnv(canvas.emit, 0x811C_9DC5))
            if Double(h) != s.num("hash")! { bad.append("\(room) \(side) step \(step) t \(t)") }
        }
        XCTAssertEqual(bad, [])
    }

    func testAnswers() {
        let p = Puzzle(["id": "x", "lock": ["kind": "letters", "length": 4], "answer": "HOME"])!
        XCTAssertTrue(p.isRight(" home "))
        XCTAssertFalse(p.isRight("HOMY"))
        let g = Puzzle(["id": "g", "lock": ["kind": "glyphs", "slots": 2, "set": ["moon", "star"]], "answer": "moon,star"])!
        XCTAssertTrue(g.isRight("Moon,Star"))
        XCTAssertEqual(escapeTime(65_400), "1:05")
        XCTAssertEqual(escapeTime(-5), "0:00")
    }

    func testProgressMerges() {
        let a = EscapeProgress(room: .attic, step: 2, hints: ["trunk": 1], startedAt: 1000)
        let b = EscapeProgress(room: .attic, step: 3, hints: ["trunk": 2, "clock": 1], startedAt: 900, finishedAt: nil)
        let m = EscapeProgress.merge(a, b)!
        XCTAssertEqual(m.step, 3)
        XCTAssertEqual(m.hints, ["trunk": 2, "clock": 1])
        XCTAssertEqual(m.startedAt, 900)
        XCTAssertNil(m.finishedAt)
        var c = b
        c.finishedAt = 5000
        var d = b
        d.finishedAt = 4000
        XCTAssertEqual(EscapeProgress.merge(c, d)?.finishedAt, 4000)
        XCTAssertEqual(EscapeProgress.merge(a, nil), a)
        XCTAssertEqual(EscapeProgress.merge(a, EscapeProgress(room: .cellar, step: 4, startedAt: 0)), a, "another room's news")
        XCTAssertTrue(m.same(EscapeProgress(room: .attic, step: 3, hints: ["clock": 1, "trunk": 2], startedAt: 1)))
    }

    func testEventsRoundTrip() {
        let p = EscapeProgress(room: .library, step: 4, hints: ["grid": 3], startedAt: 77, finishedAt: 99)
        let all: [EscapeEvent] = [.hello, .ping, .bye, .ready(.office), .ready(nil), .progress(p), .hold(.b, true), .chat(id: "u1-5", name: "Aanya", text: "a clock!")]
        for e in all {
            let d = e.doc(by: "u1", at: 5)
            XCTAssertEqual(d.str("by"), "u1")
            XCTAssertEqual(EscapeEvent(d), e, "\(e)")
        }
        // as the website sends it, with no finishedAt
        let web: Doc = ["type": "progress", "by": "u2", "at": 1, "progress": ["room": "attic", "step": 1, "hints": [:] as Doc, "startedAt": 10]]
        XCTAssertEqual(EscapeEvent(web), .progress(EscapeProgress(room: .attic, step: 1, startedAt: 10)))
        XCTAssertNil(EscapeEvent(["type": "dance"]))
    }

    func testSaveRoundTrip() {
        let d = UserDefaults(suiteName: "escape-tests")!
        defer { d.removePersistentDomain(forName: "escape-tests") }
        var s = EscapeSave()
        s.progress[.attic] = EscapeProgress(room: .attic, step: 2, hints: ["trunk": 1], startedAt: 10, pausedAt: 50)
        s.best[.cellar] = 123_456
        s.store("space-x", d)
        let back = EscapeSave.load("space-x", d)
        XCTAssertEqual(back, s)
        XCTAssertEqual(EscapeSave.load("space-y", d), EscapeSave())
    }
}

/// Two devices playing a room together over the escape line, and both halves on one screen.
final class EscapeSessionTests: XCTestCase {
    final class Clock { var t: Double = 1_790_000_000_000 }

    func settle() async {
        for _ in 0..<4 { try? await Task.sleep(nanoseconds: 20_000_000) }
    }

    func defaults(_ name: String) -> UserDefaults {
        let d = UserDefaults(suiteName: name)!
        d.removePersistentDomain(forName: name)
        return d
    }

    // (on the main actor, like the app and the other two-device tests: the in-memory database writes there, so
    // a test running anywhere else races it)
    @MainActor
    func testTwoDevicesEscapeTheAttic() async throws {
        guard !EscapeRoom.all.isEmpty else { throw XCTSkip("no escape.json") }
        let db = Demo.backend()
        db.synchronous = true
        let pa = PlaceModel(db: db, sid: Demo.sid, me: Demo.me)
        let pb = PlaceModel(db: db, sid: Demo.sid, me: Demo.them)
        pa.start()
        pb.start()
        await settle()
        let c = Clock()
        let a = EscapeSession(place: pa, clock: { c.t }, defaults: defaults("esc-a"))
        let b = EscapeSession(place: pb, clock: { c.t }, defaults: defaults("esc-b"))
        var sounds: [EscapeSound] = []
        a.onSound = { sounds.append($0) }
        XCTAssertTrue(a.canPlayOnline)
        a.start()
        b.start()
        await settle()
        XCTAssertTrue(a.partnerHere, "they said hello back")
        XCTAssertTrue(b.partnerHere)

        // Aanya waits at the attic door; Rohan steps in with her
        a.goToDoor(.attic)
        a.setReady(.attic)
        await settle()
        XCTAssertEqual(b.partnerReady, .attic)
        XCTAssertEqual(a.screen, .door)
        b.joinPartner()
        await settle()
        XCTAssertEqual(a.screen, .play)
        XCTAssertEqual(b.screen, .play)
        XCTAssertEqual(a.mode, .online)
        XCTAssertEqual(a.mySide, .a)
        XCTAssertEqual(b.mySide, .b)
        XCTAssertNil(a.log)

        // she opens the trunk with the code on his desk
        let trunk = try XCTUnwrap(a.puzzle)
        XCTAssertFalse(a.guess(trunk, "317"))
        XCTAssertTrue(a.guess(trunk, "318"))
        XCTAssertEqual(a.step, 0, "it opens a moment later")
        c.t += 400
        a.pulse()
        await settle()
        XCTAssertEqual(a.step, 1)
        XCTAssertEqual(b.step, 1, "the news reaches the other device")
        XCTAssertEqual(b.log, trunk.solved)
        XCTAssertEqual(sounds, [.open])
        XCTAssertTrue(a.fresh[.a]!.contains("trunk"), "the trunk has something new in it")
        a.tap(.a, "trunk")
        XCTAssertEqual(a.open[.a], "trunk")
        XCTAssertFalse(a.fresh[.a]!.contains("trunk"))

        // hints wait a little, then both see them
        XCTAssertFalse(b.hintReady)
        c.t += 31_000
        b.pulse()
        XCTAssertTrue(b.hintReady)
        b.hint()
        await settle()
        XCTAssertEqual(a.progress?.hints["hatbox"], 1)

        b.say("  anchor, rose, moon, heart?  ")
        await settle()
        XCTAssertEqual(a.chat.last?.text, "anchor, rose, moon, heart?")
        XCTAssertEqual(a.chat.last?.by, Demo.them)

        // the rest, by whoever has each lock
        XCTAssertFalse(a.guess(trunk, "318"), "that one's open already")
        while let p = a.puzzle {
            (p.side == .b ? b : a).solve(p.id)
            await settle()
        }
        XCTAssertEqual(a.step, 5)
        XCTAssertEqual(b.step, 5)
        XCTAssertTrue(sounds.contains(.melody([.red, .gold, .gold, .blue, .green])), "the music box plays their song")
        XCTAssertNotNil(a.progress?.finishedAt)
        XCTAssertFalse(a.endingOpen)
        c.t += 1000
        a.pulse()
        b.pulse()
        XCTAssertTrue(a.endingOpen && b.endingOpen)
        XCTAssertEqual(sounds.last, .win)
        XCTAssertEqual(a.save.best[.attic], 31_400)
        a.done()
        XCTAssertEqual(a.screen, .corridor)
        XCTAssertEqual(a.status(a.rooms[0]), "Escaped in 0:31")
        a.stop()
        await settle()
        XCTAssertFalse(b.partnerHere, "she said goodbye")
    }

    func testBothHalvesOnOneScreen() throws {
        guard !EscapeRoom.all.isEmpty else { throw XCTSkip("no escape.json") }
        let place = PlaceModel(db: Demo.backend(), sid: "space-solo", me: Demo.me)
        let c = Clock()
        let d = defaults("esc-here")
        let s = EscapeSession(place: place, clock: { c.t }, defaults: d)
        XCTAssertFalse(s.canPlayOnline, "nobody's moved in")
        s.playHere(.cellar)
        XCTAssertEqual(s.mode, .here)
        for _ in 0..<2 { s.solve(s.puzzle!.id) }
        XCTAssertEqual(s.step, 2)
        c.t += 10_000
        s.leave()
        XCTAssertEqual(s.status(EscapeRoom.byId(.cellar)!), "In progress: 2 of 5 solved")
        c.t += 60_000
        s.playHere(.cellar)
        XCTAssertEqual(s.step, 2, "carries on where you left off")
        XCTAssertEqual(s.elapsed, 10_000, "the time away doesn't count")
        s.solve(s.puzzle!.id)
        s.solve(s.puzzle!.id)
        // saying goodbye to the ghost: hold together
        guard case .together(_, let holdMs)? = s.puzzle?.lock else { return XCTFail("a together lock") }
        s.setHold(.a, true)
        c.t += holdMs
        s.pulse()
        XCTAssertEqual(s.holdProgress, 0, "one of you isn't enough")
        s.setHold(.b, true)
        c.t += holdMs / 2
        s.pulse()
        XCTAssertEqual(s.holdProgress, 0.5, accuracy: 0.01)
        s.setHold(.b, false)
        XCTAssertEqual(s.holdProgress, 0, "let go too soon")
        s.setHold(.b, true)
        c.t += holdMs
        s.pulse()
        XCTAssertEqual(s.step, 5)
        XCTAssertFalse(s.holds[.a]!, "let go once it opens")
        s.playHere(.cellar, fromScratch: true)
        XCTAssertEqual(s.step, 0)
    }
}
