import XCTest
@testable import SoultiedCore

/// The watch room and the characters seen from behind, pixel for pixel against the website's
/// (scripts/native-fixtures.ts hashes what src/pixel/watchRoom.ts and characterBack.ts draw).
final class WatchSceneTests: XCTestCase {
    func fnv(_ a: [UInt8], _ seed: UInt32) -> UInt32 {
        var h = seed
        for b in a { h = (h ^ UInt32(b)) &* 0x0100_0193 }
        return h
    }

    func fixtures() throws -> Doc {
        guard let d = LettersTests.fx?["watch"] as? Doc else { throw XCTSkip("no fixtures (set SOULTIED_FIXTURES)") }
        return d
    }

    /// the looks exactly as written (no tidying up of unknown colours, as the website draws them raw)
    func looks(_ fx: Doc) -> [AvatarConfig] {
        (fx["looks"] as! [Doc]).map { d in
            AvatarConfig(height: d.str("height")!, skin: d.str("skin")!, hairStyle: d.str("hairStyle")!, hairColor: d.str("hairColor")!, facialHair: d.str("facialHair")!, top: d.str("top")!, topColor: d.str("topColor")!, bottom: d.str("bottom")!, bottomColor: d.str("bottomColor")!, shoes: d.str("shoes")!, shoesColor: d.str("shoesColor")!, glasses: d.str("glasses")!, hat: d.str("hat")!, extra: d.str("extra")!)
        }
    }

    func testFromBehind() throws {
        let fx = try fixtures()
        let ls = looks(fx)
        let backs = fx["backs"] as! [Doc]
        XCTAssertEqual(backs.count, 51)
        var bad: [String] = []
        for b in backs {
            let i = b.int("look")!
            let r = renderCharacterBack(ls[i], lean: b.num("lean")!, bob: b.num("bob")!)
            if Double(fnv(r.buf.data, 0x811C_9DC5)) != b.num("hash")! || r.headTop != b.num("headTop")! {
                bad.append("\(ls[i].hairStyle)/\(ls[i].hat)/\(ls[i].extra)/\(ls[i].top) lean \(b.num("lean")!) bob \(b.num("bob")!)")
            }
        }
        XCTAssertEqual(bad, [])
    }

    func testTheRoom() throws {
        let fx = try fixtures()
        let ls = looks(fx)
        let scenes = fx["scenes"] as! [Doc]
        XCTAssertEqual(scenes.count, 54)
        let renderer = WatchRenderer()
        let now = 1_790_000_000_000.0
        var bad: [String] = []
        for s in scenes {
            let l = s.int("left")!, r = s.int("right")!
            var st = WatchState(left: l >= 0 ? ls[l] : nil, right: r >= 0 ? ls[r] : nil, tv: TvState(rawValue: s.str("tv")!)!)
            st.reactions = (s["reactions"] as! [[Any]]).map {
                WatchReaction(kind: ReactionKind(rawValue: $0[0] as! String)!, seat: WatchSeatSide(rawValue: $0[1] as! String)!, t0: Values.num($0[2])!)
            }
            if let sing = s["singing"] as? [Bool] { st.singing = (sing[0], sing[1]) }
            let buf = renderer.render(st, s.num("t")!, now: now)
            if Double(fnv(buf.data, 0x811C_9DC5)) != s.num("hash")! { bad.append("\(l)+\(r) \(s.str("tv")!) t \(s.num("t")!)") }
        }
        XCTAssertEqual(bad, [])
    }
}
