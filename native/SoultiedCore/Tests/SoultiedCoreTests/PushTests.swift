import XCTest
@testable import SoultiedCore

/// Notifications: what each phone asks Soultied's server to tell the other (functions/push.js decides whether and
/// what it says), and the phone and switches it keeps in meta/push.
@MainActor
final class PushTests: XCTestCase {
    func settle() async {
        for _ in 0..<6 { try? await Task.sleep(nanoseconds: 30_000_000) }
    }

    /// Aanya's place, with Rohan moved in
    func twoPhones() async throws -> (PlaceModel, PlaceModel) {
        let db = MemoryBackend()
        let authA = FakeAuth(), authB = FakeAuth()
        let a = AppModel(auth: authA, cloud: { db })
        let b = AppModel(auth: authB, cloud: { db })
        a.start()
        b.start()
        authA.be(AuthUser(uid: "ua", name: "Aanya", email: nil))
        await settle()
        await a.createPlace(myName: "Aanya", look: Wardrobe.defaultA, placeName: "Our nook", partnerName: "Rohan", togetherSince: "2024-02-14")
        await settle()
        let pa = try XCTUnwrap(a.place)
        authB.be(AuthUser(uid: "ub", name: "Rohan", email: nil))
        await settle()
        let code = try XCTUnwrap(pa.space?.inviteCode)
        let joined = await b.join(code: code, myName: "Rohan", look: Wardrobe.defaultB)
        XCTAssertEqual(joined, .ok)
        await settle()
        return (pa, try XCTUnwrap(b.place))
    }

    func testWhatEachPhoneSays() async throws {
        let (pa, pb) = try await twoPhones()
        var said: [(String, Doc)] = []
        pa.nudger = { k, a in said.append((k, a)) }
        pb.nudger = { _, _ in }

        pa.sendTouch(.hug)
        XCTAssertEqual(said.last?.0, "touch")
        XCTAssertEqual(said.last?.1.str("touch"), "hug")
        XCTAssertEqual(said.last?.1["reply"] as? Bool, false)

        pa.ask("Beach or hills?", options: ["Beach", "Hills"], mine: AskAnswer(pick: 0))
        XCTAssertEqual(said.last?.0, "ask")
        XCTAssertEqual(said.last?.1.str("prompt"), "Beach or hills?")

        pa.pinNote("missing you", paper: 0)
        XCTAssertEqual(said.last?.0, "wall")
        XCTAssertEqual(said.last?.1.str("what"), "text")

        pa.postSnap(photo: "data:image/jpeg;base64,/9j/", w: 4, h: 3, caption: "hi")
        XCTAssertEqual(said.last?.0, "snap")

        // Fireflies: her first drop makes it Rohan's move (once, not again for a stale tap)
        said.removeAll()
        pa.saveGame(Play.newFireflies(.a))
        XCTAssertTrue(said.isEmpty, "a new game where it's still her turn says nothing")
        await settle()
        let m = try XCTUnwrap(Play.fireflies(try XCTUnwrap(pa.games[.fireflies]), .a, col: 3))
        pa.saveGame(m)
        XCTAssertEqual(said.map(\.0), ["turn"])
        XCTAssertEqual(said.last?.1.str("game"), "Fireflies")
        pa.saveGame(m)
        XCTAssertEqual(said.count, 1)
        await settle()
        // his move back is his to tell, not hers
        let back = try XCTUnwrap(Play.fireflies(try XCTUnwrap(pb.games[.fireflies]), .b, col: 1))
        pb.saveGame(back)
        await settle()
        XCTAssertEqual(said.count, 1)
    }

    func testPhoneAndSwitches() async throws {
        let (pa, pb) = try await twoPhones()
        XCTAssertTrue(pa.pushOn("games"))
        pa.setPush("games", false)
        pa.savePushDevice(token: "tok-1", tz: "Asia/Kolkata")
        await settle()
        XCTAssertFalse(pa.pushOn("games"))
        XCTAssertTrue(pa.pushOn("letters"))
        // what the server reads: Aanya's phone and her switch, under her id
        let dev = try XCTUnwrap(((pb.pushDoc["devices"] as? Doc)?["ua"] as? Doc)?.values.first as? Doc)
        XCTAssertEqual(dev.str("token"), "tok-1")
        XCTAssertEqual(dev.str("tz"), "Asia/Kolkata")
        XCTAssertEqual(dev.str("platform"), "ios")
        XCTAssertEqual(((pb.pushDoc["prefs"] as? Doc)?["ua"] as? Doc)?["games"] as? Bool, false)
        // his switches are his own
        XCTAssertTrue(pb.pushOn("games"))
    }
}
