import XCTest
@testable import SoultiedCore

/// The living room, pixel for pixel against the website's (scripts/native-fixtures.ts hashes what
/// src/pixel/room.ts draws), and the fire's streak against src/couch.ts.
final class RoomSceneTests: XCTestCase {
    func fnv(_ a: [UInt8], _ seed: UInt32) -> UInt32 {
        var h = seed
        for b in a { h = (h ^ UInt32(b)) &* 0x0100_0193 }
        return h
    }

    func fixtures() throws -> (room: Doc, looks: [Doc]) {
        guard let r = LettersTests.fx?["room"] as? Doc, let w = LettersTests.fx?["watch"] as? Doc else { throw XCTSkip("no fixtures (set SOULTIED_FIXTURES)") }
        return (r, w["looks"] as! [Doc])
    }

    func glyph(_ v: Any?) -> Glyph? {
        guard let g = v as? Doc, let rows = g["rows"] as? [String], let pal = g["pal"] as? [String: String] else { return nil }
        return Glyph(rows: rows, pal: Dictionary(uniqueKeysWithValues: pal.map { (Character($0.key), RGB($0.value)) }))
    }

    func testTheRoom() throws {
        let (fx, looks) = try fixtures()
        let ls = looks.map { d in
            AvatarConfig(height: d.str("height")!, skin: d.str("skin")!, hairStyle: d.str("hairStyle")!, hairColor: d.str("hairColor")!, facialHair: d.str("facialHair")!, top: d.str("top")!, topColor: d.str("topColor")!, bottom: d.str("bottom")!, bottomColor: d.str("bottomColor")!, shoes: d.str("shoes")!, shoesColor: d.str("shoesColor")!, glasses: d.str("glasses")!, hat: d.str("hat")!, extra: d.str("extra")!)
        }
        func seat(_ i: Int, _ status: String?) -> Seat {
            i >= 0 ? Seat(avatar: ls[i], name: "x", status: SeatStatus(rawValue: status ?? "online")!) : .empty
        }
        let scenes = fx["scenes"] as! [Doc]
        XCTAssertEqual(scenes.count, 15)
        let renderer = RoomRenderer()
        var bad: [String] = []
        for (n, s) in scenes.enumerated() {
            var st = RoomState(left: seat(s.int("left")!, s.str("leftStatus")), right: seat(s.int("right")!, s.str("rightStatus")))
            st.letterUnread = s["letterUnread"] as? Bool ?? false
            st.fire = s.num("fire") ?? 0.6
            st.flame = s.int("flame") ?? 2
            if let lg = s["logs"] as? [String: Bool] {
                st.logLeft = lg["left"] ?? false
                st.logRight = lg["right"] ?? false
            }
            st.hover = s.str("hover").flatMap { HotspotId(rawValue: $0) }
            st.closeness = s.num("closeness") ?? 0
            st.scooting = s["scooting"] as? Bool ?? false
            st.heartAt = s.num("heartAt") ?? -1
            st.gamesWaiting = s["gamesWaiting"] as? Bool ?? false
            st.music = s["music"] as? Bool ?? false
            let d = s["decor"] as? [String: String] ?? [:]
            st.decor = Decor(wall: d["wall"] ?? "sage", couch: d["couch"] ?? "terracotta", rug: d["rug"] ?? "diamond", pet: d["pet"] ?? "ginger", view: d["view"] ?? "snow", painting: d["painting"] ?? "dusk", plant: d["plant"] ?? "monstera")
            st.bare = s["bare"] as? Bool ?? false
            st.moodLeft = glyph(s["moodLeft"])
            st.moodRight = glyph(s["moodRight"])
            if let tc = s["touch"] as? Doc {
                st.touch = RoomTouch(kind: tc.str("kind")!, together: tc["together"] as! Bool, from: HotspotId(rawValue: tc.str("from")!)!, at: tc.num("at")!, glyph: glyph(tc["glyph"])!)
            }
            if let a = s["wallArt"] as? Doc {
                st.wallArt = WallArtPixels(w: a.int("w")!, h: a.int("h")!, pal: (a["pal"] as! [String]).map { RGB($0) }, px: a.str("px")!)
            }
            st.wallNews = s["wallNews"] as? Bool ?? false
            let buf = renderer.render(st, s.num("t")!)
            if Double(fnv(buf.data, 0x811C_9DC5)) != s.num("hash")! { bad.append("scene \(n) (flame \(st.flame), t \(s.num("t")!))") }
        }
        XCTAssertEqual(bad, [])
    }

    func testTheFire() throws {
        let (fx, _) = try fixtures()
        let fires = fx["fires"] as! [Doc]
        XCTAssertEqual(fires.count, 56)
        for f in fires {
            let c = CouchState(together: f["together"] as! [String])
            let got = c.fire(today: f.str("today")!)
            XCTAssertEqual(got.streak, f.int("streak")!, "\(f.str("today")!) \(c.together)")
            XCTAssertEqual(got.level, f.int("level")!, "\(f.str("today")!) \(c.together)")
        }
    }

    /// the levels the fire burns at, by days in a row
    func testFireLevels() {
        let today = "2026-03-10"
        func run(_ n: Int, from start: Int = 0) -> CouchState { CouchState(together: (0..<n).map { Day.add(today, start - n + 1 + $0) }) }
        XCTAssertEqual(CouchState().fire(today: today).level, 0)
        XCTAssertEqual(run(1).fire(today: today).level, 1)
        XCTAssertEqual(run(2, from: -1).fire(today: today).level, 1)
        XCTAssertEqual(run(3).fire(today: today).level, 2)
        XCTAssertEqual(run(6, from: -1).fire(today: today).level, 2)
        XCTAssertEqual(run(7).fire(today: today).level, 3)
        // missed yesterday: embers, but it never goes out
        let missed = run(9, from: -2).fire(today: today)
        XCTAssertEqual(missed.streak, 0)
        XCTAssertEqual(missed.level, 0)
    }
}
