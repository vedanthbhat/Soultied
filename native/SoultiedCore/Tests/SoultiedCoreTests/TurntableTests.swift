import XCTest
@testable import SoultiedCore

/// The record player against the website's (scripts/native-fixtures.ts): where the record is at any moment,
/// where each track starts, and reading YouTube links. Then what each button writes, which has to be exactly
/// what the website writes, so a phone and a laptop hear the same thing.
final class TurntableTests: XCTestCase {
    func fixtures() throws -> Doc {
        guard let d = LettersTests.fx?["record"] as? Doc else { throw XCTSkip("no fixtures (set SOULTIED_FIXTURES)") }
        return d
    }

    func testWhereTheRecordIs() throws {
        let fx = try fixtures()
        let rows = fx["where"] as! [[Any]]
        XCTAssertEqual(rows.count, 400)
        for r in rows {
            // (the moments with fractions come as text, read back exactly)
            let startedAt = Values.num(r[0])!, now = Double(r[1] as! String)!
            let w = Records.whereAt(startedAt, now)
            XCTAssertEqual(w.index, Int(Values.num(r[2])!), "\(startedAt) \(now)")
            XCTAssertEqual(w.offset, Double(r[3] as! String)!, "\(startedAt) \(now)")
        }
        for s in fx["starts"] as! [[Any]] {
            XCTAssertEqual(Records.startFor(Int(Values.num(s[0])!), Values.num(s[1])!), Values.num(s[2])!, "track \(s[0])")
        }
    }

    func testYouTubeLinks() throws {
        let links = try fixtures()["links"] as! [[Any]]
        XCTAssertGreaterThan(links.count, 20)
        for l in links {
            let input = l[0] as! String
            XCTAssertEqual(YouTubeLink.id(input), l[1] as? String, "id of “\(input)”")
            XCTAssertEqual(YouTubeLink.start(input), Values.num(l[2])!, "start of “\(input)”")
        }
    }

    func testTheRecord() {
        XCTAssertEqual(Records.tracks.count, 5)
        XCTAssertEqual(Records.recordMs, 1_202_940, accuracy: 0.001)
        let now = 1_790_000_000_000.0
        // each track starts where the one before ends, and the record goes round
        XCTAssertEqual(Records.whereAt(Records.startFor(2, now), now).index, 2)
        XCTAssertEqual(Records.whereAt(Records.startFor(2, now), now).offset, 0)
        XCTAssertEqual(Records.whereAt(now, now + Records.recordMs + 1000).index, 0)
        XCTAssertEqual(Records.whereAt(now, now + Records.recordMs + 1000).offset, 1, accuracy: 1e-9)
        XCTAssertEqual(Records.whereAt(now, now - 1000).index, 4)
        XCTAssertEqual(Records.startFor(5, now), Records.startFor(0, now))
        XCTAssertEqual(Records.startFor(-1, now), Records.startFor(4, now))
    }

    func testWhatEachButtonWrites() {
        let now = 1_790_000_000_000.0
        // the record goes on from where it was left
        let on = TurntableState.jazz(TurntableState(on: false, startedAt: 5, by: "b", at: 1, next: 3), by: "a", now: now)
        XCTAssertEqual(on, TurntableState(on: true, startedAt: Records.startFor(3, now), by: "a", at: now, next: 3, yt: nil))
        XCTAssertEqual(on.track(now)?.slug, "bossa-antigua")
        XCTAssertEqual(TurntableState.jazz(nil, by: "a", now: now).track(now)?.slug, "study-and-relax")

        // next track, then lifting the needle remembers the one after it
        let skipped = on.skipped(by: "b", now: now + 10_000)!
        XCTAssertEqual(skipped.track(now + 10_000)?.slug, "cool-vibes")
        XCTAssertEqual(skipped.by, "b")
        let off = skipped.lifted(by: "a", now: now + 20_000)!
        XCTAssertFalse(off.on)
        XCTAssertEqual(off.next, 0)
        XCTAssertNil(off.track(now + 20_000))
        XCTAssertNil(off.lifted(by: "a", now: now + 30_000))
        XCTAssertNil(off.skipped(by: "a", now: now + 30_000))

        // left on, it goes quiet after two hours
        XCTAssertTrue(on.isOn(now + Records.autoOffMs - 1))
        XCTAssertFalse(on.isOn(now + Records.autoOffMs))

        // a song from YouTube, from where the link says
        XCTAssertNil(TurntableState.song("https://vimeo.com/1", on, by: "a", now: now))
        let song = TurntableState.song("https://youtu.be/dQw4w9WgXcQ?t=1m30s", on, by: "a", now: now)!
        XCTAssertEqual(song, TurntableState(on: true, startedAt: now - 90_000, by: "a", at: now, next: 3, yt: .init(id: "dQw4w9WgXcQ")))
        XCTAssertNil(song.track(now))
        XCTAssertNil(song.skipped(by: "a", now: now))
        // only whoever put it on writes its title, once
        XCTAssertNil(song.titled("dQw4w9WgXcQ", "A song", me: "b", now: now))
        let titled = song.titled("dQw4w9WgXcQ", String(repeating: "x", count: 200), me: "a", now: now)!
        XCTAssertEqual(titled.yt?.title?.count, 120)
        XCTAssertNil(titled.titled("dQw4w9WgXcQ", "Again", me: "a", now: now))
        // it ends for both of you; lifting it keeps the record's place
        XCTAssertNil(song.songEnded("other-video", by: "b", now: now))
        XCTAssertEqual(song.songEnded("dQw4w9WgXcQ", by: "b", now: now + 5)!, TurntableState(on: false, startedAt: now - 90_000, by: "b", at: now + 5, next: 3, yt: nil))
        XCTAssertEqual(song.lifted(by: "b", now: now + 5)?.next, 3)
    }

    func testTheDocument() {
        let s = TurntableState(on: true, startedAt: 12.5, by: "a", at: 99, next: 2, yt: .init(id: "dQw4w9WgXcQ", title: "Hi"))
        XCTAssertEqual(TurntableState(s.doc), s)
        let plain = TurntableState(on: false, startedAt: 1, by: "b", at: 2, next: 4)
        XCTAssertTrue(plain.doc["yt"] is NSNull)
        XCTAssertEqual(TurntableState(plain.doc), plain)
        XCTAssertEqual(TurntableState(Values.resolve(plain.doc)), plain)
        XCTAssertNil(TurntableState(nil))
        // a song with a broken id is just the record
        XCTAssertNil(TurntableState(["on": true, "yt": ["id": "nope"]])?.yt)
        // what the website writes, as Firestore hands it back
        let web: Doc = ["on": true, "startedAt": 1_790_000_000_000 as Int64, "by": "u1", "at": 1_790_000_000_500 as Int64, "next": 1, "yt": NSNull()]
        XCTAssertEqual(TurntableState(web), TurntableState(on: true, startedAt: 1_790_000_000_000, by: "u1", at: 1_790_000_000_500, next: 1))
    }

    /// two phones in one place: one puts the record on, the other hears it, skips, and lifts the needle
    @MainActor
    func testTwoPhones() async throws {
        let db = MemoryBackend()
        let a = PlaceModel(db: db, sid: "s1", me: "ua"), b = PlaceModel(db: db, sid: "s1", me: "ub")
        a.start()
        b.start()
        defer {
            a.stop()
            b.stop()
        }
        func settle() async { for _ in 0..<6 { try? await Task.sleep(nanoseconds: 30_000_000) } }
        await settle()
        XCTAssertNil(b.turntable)
        XCTAssertFalse(b.recordOn)

        a.playRecord()
        await settle()
        XCTAssertTrue(b.recordOn)
        XCTAssertEqual(b.turntable?.by, "ua")
        XCTAssertEqual(b.turntable?.track(Values.nowMs())?.slug, "study-and-relax")

        b.nextTrack()
        await settle()
        XCTAssertEqual(a.turntable?.track(Values.nowMs())?.slug, "smooth-lovin")
        XCTAssertEqual(a.turntable?.by, "ub")

        XCTAssertNotNil(b.playSong("https://vimeo.com/1"))
        XCTAssertNil(b.playSong("https://youtu.be/dQw4w9WgXcQ"))
        await settle()
        XCTAssertEqual(a.turntable?.yt?.id, "dQw4w9WgXcQ")
        // the title is written by whoever put it on
        a.songTitle("dQw4w9WgXcQ", "Not mine to name")
        b.songTitle("dQw4w9WgXcQ", "Our song")
        await settle()
        XCTAssertEqual(a.turntable?.yt?.title, "Our song")

        a.songEnded("dQw4w9WgXcQ")
        await settle()
        XCTAssertFalse(b.recordOn)
        XCTAssertNil(b.turntable?.yt)
        // a song doesn't move the record on (as on the website): it starts where it last started
        b.playRecord()
        await settle()
        XCTAssertEqual(a.turntable?.track(Values.nowMs())?.slug, "study-and-relax")
        // lifting the needle remembers the track after this one
        a.liftNeedle()
        await settle()
        XCTAssertFalse(b.recordOn)
        XCTAssertEqual(b.turntable?.next, 1)
        b.playRecord()
        await settle()
        XCTAssertEqual(a.turntable?.track(Values.nowMs())?.slug, "smooth-lovin")
    }
}
