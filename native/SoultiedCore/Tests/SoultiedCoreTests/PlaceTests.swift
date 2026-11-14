import XCTest
@testable import SoultiedCore

/// A fake sign-in: whoever the test says is signed in.
final class FakeAuth: AuthService {
    var fn: ((AuthUser?) -> Void)?
    var user: AuthUser?
    final class H: Listener { func stop() {} }
    func observe(_ fn: @escaping (AuthUser?) -> Void) -> Listener {
        self.fn = fn
        fn(user)
        return H()
    }
    func signIn(_ way: SignInWay) async throws {}
    func signOut() throws {
        user = nil
        fn?(nil)
    }
    func deleteAccount() async throws {}
    func be(_ u: AuthUser?) {
        user = u
        fn?(u)
    }
}

/// Two phones, one place: Aanya starts it, Rohan joins with the invite, and they use it together.
@MainActor
final class PlaceTests: XCTestCase {
    func settle() async {
        for _ in 0..<6 { try? await Task.sleep(nanoseconds: 30_000_000) }
    }

    func testTwoPhonesOnePlace() async throws {
        let db = MemoryBackend()
        let authA = FakeAuth(), authB = FakeAuth()
        let a = AppModel(auth: authA, cloud: { db })
        let b = AppModel(auth: authB, cloud: { db })
        a.start()
        b.start()
        XCTAssertEqual(a.phase, .signedOut)

        authA.be(AuthUser(uid: "ua", name: "Aanya", email: nil))
        await settle()
        XCTAssertEqual(a.phase, .needsPlace)
        await a.createPlace(myName: "Aanya", look: Wardrobe.defaultA, placeName: "Our nook", partnerName: "Rohan", togetherSince: "2024-02-14")
        await settle()
        XCTAssertEqual(a.phase, .ready)
        let pa = try XCTUnwrap(a.place)
        XCTAssertTrue(pa.ready)
        XCTAssertEqual(pa.space?.name, "Our nook")
        XCTAssertEqual(pa.myName, "Aanya")
        XCTAssertEqual(pa.theirName, "Rohan")
        XCTAssertFalse(pa.partnerHere)
        XCTAssertEqual(pa.activities.first?.title, "Moved in")
        // a housewarming gift
        XCTAssertEqual(pa.stitches, Catalogue.welcomeGift(0))
        XCTAssertNotNil(pa.stitchNote)
        let code = try XCTUnwrap(pa.space?.inviteCode)
        XCTAssertEqual(pa.inviteLink, "https://soultied.app/?join=\(code)")

        // Rohan, with the invite
        authB.be(AuthUser(uid: "ub", name: "Rohan", email: nil))
        await settle()
        XCTAssertEqual(b.phase, .needsPlace)
        let inv = await b.lookupInvite(code.lowercased().replacingOccurrences(of: "-", with: " "))
        XCTAssertEqual(inv?.hostName, "Aanya")
        let res = await b.join(code: code, myName: "Rohan", look: Wardrobe.defaultB)
        XCTAssertEqual(res, .ok)
        await settle()
        let pb = try XCTUnwrap(b.place)
        XCTAssertTrue(pb.ready)
        XCTAssertEqual(pb.them, "ua")
        XCTAssertEqual(pa.them, "ub")
        XCTAssertEqual(pa.theirName, "Rohan")
        XCTAssertEqual(pa.seats.left.name, "Aanya")
        XCTAssertEqual(pa.seats.right.name, "Rohan")
        // both showed up today: a day together, and stitches for it
        await settle()
        pa.heartbeat()
        await settle()
        XCTAssertTrue(pa.togetherToday || pb.togetherToday)
        XCTAssertEqual(pa.couchLevel, 1)

        // today's letter: both answer every card and seal
        let day = pa.letter(.daily)
        XCTAssertEqual(day.cardIds.count, 5)
        XCTAssertEqual(pb.letter(.daily).cardIds, day.cardIds)
        for (p, pick) in [(pa, 0), (pb, 1)] {
            for card in Cards.of(day.cardIds) {
                var ans = CardAnswer(pick: card.style == .open ? 0 : pick % card.options.count)
                if card.style == .open { ans.text = "words" }
                if card.guess { ans.guess = 0 }
                p.answer(.daily, pa.today, card: card.id, ans)
            }
            await settle()
            XCTAssertTrue(p.ready(toSeal: .daily, pa.today))
        }
        pa.seal(.daily, pa.today)
        await settle()
        XCTAssertFalse(pa.letter(.daily).opened)
        XCTAssertTrue(pb.letter(.daily).sealed("ua"))
        pb.seal(.daily, pa.today)
        await settle()
        XCTAssertTrue(pa.letter(.daily).opened)
        XCTAssertNotNil(pa.letter(.daily).by["ub"]?.cards[day.cardIds[0]])
        XCTAssertTrue(pa.activities.contains { $0.title == "Letter opened together" })
        XCTAssertEqual(pa.streak.current, 1)
        pa.markSeen(.daily, pa.today)
        await settle()
        XCTAssertFalse(pa.letterWaiting)

        // a hug, and one back
        pa.sendTouch(.hug)
        await settle()
        XCTAssertEqual(pb.touchNews.count, 1)
        XCTAssertEqual(pb.playing?.kind, .hug)
        XCTAssertEqual(pb.touchLine, "Aanya hugged you.")
        pb.markTouchesSeen()
        pb.sendTouch(.hug, reply: true)
        await settle()
        XCTAssertEqual(pb.touchNews.count, 0)
        XCTAssertEqual(pa.touchLine, "Rohan hugged you back.")

        // moods
        pb.setMood(.missing, "  counting the days  ")
        await settle()
        XCTAssertEqual(pa.theirMood?.line, "missing you · “counting the days”")
        XCTAssertNotNil(pa.moodNews)
        pa.markMoodSeen()
        await settle()
        XCTAssertNil(pa.moodNews)
        pb.setMood(nil, "")
        await settle()
        XCTAssertNil(pa.theirMood)

        // the wall
        pa.pinNote("Proud of you", paper: 2)
        await settle()
        XCTAssertEqual(pb.notes.first?.text, "Proud of you")
        XCTAssertNotNil(pb.wallNews)
        pb.markWallSeen()
        var px = Doodle.blank()
        for i in 0..<200 { px[i] = 3 }
        pb.pinDoodle(px, hang: true)
        await settle()
        XCTAssertEqual(pa.notes.count, 2)
        XCTAssertEqual(pa.board.art?.kind, .doodle)
        XCTAssertEqual(pa.board.art?.px.count, ART_W * ART_H)
        let n = try XCTUnwrap(pa.notes.first { $0.kind == .doodle })
        pa.love(n)
        pa.keep(n)
        await settle()
        XCTAssertNotNil(pb.notes.first { $0.id == n.id }?.loved["ua"])
        pb.takeDown(n)
        await settle()
        XCTAssertTrue(pa.notes.first { $0.id == n.id }?.gone ?? false)
        XCTAssertNil(pa.board.art, "taking it down takes it out of the frame")
        pa.addMemory(title: "First date", day: "2023-02-11", text: "Hot chocolate")
        await settle()
        XCTAssertTrue(pb.moments.contains { $0.title == "First date" })
        XCTAssertTrue(pb.moments.contains { $0.kind == .together && $0.day == "2024-02-14" })

        // decorating with what you've earned
        let before = pa.stitches
        let rug = try XCTUnwrap(Catalogue.item(.rug, "moss"))
        XCTAssertTrue(pa.buy(rug))
        await settle()
        XCTAssertEqual(pb.decor.rug, "moss")
        XCTAssertEqual(pb.stitches, before - rug.price)
        let corgi = try XCTUnwrap(Catalogue.item(.pet, "corgi"))
        if pa.stitches < corgi.price { XCTAssertFalse(pa.buy(corgi)) }

        // a question for each other
        pa.ask("Where should we go first?", options: ["The sea", "The hills"], mine: AskAnswer(pick: 1))
        await settle()
        XCTAssertEqual(pb.asksView.forMe.count, 1)
        XCTAssertEqual(pa.asksView.waiting.count, 1)
        let q = try XCTUnwrap(pb.asksView.forMe.first)
        pb.answerAsk(q, AskAnswer(pick: 1))
        await settle()
        XCTAssertEqual(pa.asksView.opened.count, 1)
        XCTAssertEqual(pa.asksView.fresh.count, 1)
        XCTAssertEqual(pa.asksView.opened.first?.said(pa.asksView.opened.first?.answers["ub"]), "The hills")
        pa.markAskSeen(q)
        await settle()
        XCTAssertEqual(pa.asksView.fresh.count, 0)

        // a game of Fireflies, across both phones
        XCTAssertEqual(pa.mySeat, .a)
        XCTAssertEqual(pb.mySeat, .b)
        pa.saveGame(Play.newFireflies(.a))
        await settle()
        XCTAssertEqual(pb.games[.fireflies]?.turn, .a)
        for (i, col) in [3, 1, 3, 1, 3, 1, 3].enumerated() {
            let p = i % 2 == 0 ? pa : pb
            let m = try XCTUnwrap(Play.fireflies(try XCTUnwrap(p.games[.fireflies]), p.mySeat, col: col))
            p.saveGame(m)
            await settle()
            if i == 0 {
                XCTAssertEqual(pb.gamesWaiting, [.fireflies])
                XCTAssertEqual(pb.games[.fireflies]?.seq, 1)
                // a stale tap from an older board is ignored
                pa.saveGame(m)
                XCTAssertEqual(pa.games[.fireflies]?.seq, 1)
            }
        }
        XCTAssertEqual(pb.games[.fireflies]?.status, .over)
        XCTAssertEqual(pb.games[.fireflies]?.winner, "a")
        XCTAssertEqual(pb.games[.fireflies]?.wins[.a], 1)
        XCTAssertTrue(pb.activities.contains { $0.description == "Aanya won at Fireflies." })
        let again = try XCTUnwrap(Play.rematch(.fireflies, me: .b, last: pb.games[.fireflies]))
        XCTAssertEqual(again.wins[.a], 1, "the tally carries on")

        // the 30 days
        pa.startJourney()
        await settle()
        XCTAssertEqual(pb.journey.unlocked, 1)
        XCTAssertEqual(pb.letter(.journey, "j01").cardIds, ["jr-0"])
    }

    func testDemoRoom() async throws {
        let db = Demo.backend()
        let p = PlaceModel(db: db, sid: Demo.sid, me: Demo.me, demo: true)
        p.start()
        await settle()
        XCTAssertTrue(p.ready)
        XCTAssertEqual(p.theirName, "Rohan")
        XCTAssertEqual(p.theirMood?.mood, .missing)
        XCTAssertTrue(p.letter(.daily).sealed(Demo.them))
        XCTAssertFalse(p.letter(.daily).sealed(Demo.me))
        XCTAssertTrue(p.letterWaiting)
        XCTAssertGreaterThan(p.streak.best, 3)
        XCTAssertEqual(p.journey.done, 3)
        XCTAssertEqual(p.notes.count, 3)
        XCTAssertEqual(p.board.art?.kind, .doodle)
        XCTAssertNotNil(p.wallNews)
        XCTAssertEqual(p.stitches, 240 + Catalogue.visit, "the demo gift, and a visit today")
        XCTAssertEqual(p.memoryItems.count, 2)
        XCTAssertEqual(p.activities.count, 3)
        XCTAssertEqual(p.seats.left.name, "Aanya")
        XCTAssertEqual(p.seats.right.avatar?.facialHair, "stubble")

        // Rohan started Fireflies; your move, and then he takes his (and you're halfway through a game of Ludo)
        XCTAssertEqual(p.gamesWaiting, [.fireflies, .ludo, .chess, .carrom])
        XCTAssertEqual(p.games[.chess]?.last, "moved a bishop to c4")
        let m = try XCTUnwrap(Play.fireflies(try XCTUnwrap(p.games[.fireflies]), .a, col: 2))
        p.saveGame(m)
        for _ in 0..<40 where p.games[.fireflies]?.turn != .a { try? await Task.sleep(nanoseconds: 100_000_000) }
        XCTAssertEqual(p.games[.fireflies]?.turn, .a)
        XCTAssertEqual(p.games[.fireflies]?.seq, 3)
        XCTAssertEqual(p.games[.fireflies]?.updatedBy, .b)

        // the 5 you rolled at Ludo lands on one of Rohan's: back to his yard, and you roll again
        let l = try XCTUnwrap(Play.ludoMove(try XCTUnwrap(p.games[.ludo]), .a, token: 0))
        XCTAssertEqual(Ludo.State(l.state).sent, [0])
        XCTAssertEqual(l.turn, .a)
        XCTAssertEqual(l.last, "sent one of yours back to the start")
    }

}

/// the small things, without a place
final class ModelTests: XCTestCase {
    func testPhotoArt() throws {
        var rgb = [UInt8](repeating: 0, count: ART_W * ART_H * 3)
        for i in 0..<(ART_W * ART_H) {
            rgb[i * 3] = UInt8(i % 256)
            rgb[i * 3 + 1] = UInt8((i * 7) % 256)
            rgb[i * 3 + 2] = 200
        }
        let a = try XCTUnwrap(photoArt(rgb: rgb, ref: "photo-x", by: "u"))
        XCTAssertEqual(a.px.count, ART_W * ART_H)
        XCTAssertEqual(a.pal.count, 12)
        XCTAssertNotNil(WallArt(a.doc), "it reads back as the website would")
        let d = Doodle.art(Doodle.demo, ref: "n", by: "u")
        XCTAssertEqual(d.px.count, ART_W * ART_H)
        XCTAssertTrue(d.px.contains("3"), "the heart's red survives shrinking")
        XCTAssertEqual(Doodle.demo.count, DOODLE_W * DOODLE_H)
        XCTAssertEqual(Doodle.small(Doodle.demo).count, OLD_DOODLE_W * OLD_DOODLE_H)
        XCTAssertEqual(Doodle.full(Doodle.small(Doodle.demo)), Doodle.demo, "the demo was drawn small, so it goes there and back")
        XCTAssertEqual(Icons.envelope.rgba().count, 15 * 11 * 4)
    }

    func testDoodleSizes() throws {
        // a note from an app from before: 48 × 36, read at today's size
        let old = String(repeating: "0", count: 47) + "3" + String(repeating: "0", count: OLD_DOODLE_W * OLD_DOODLE_H - 48)
        let n = try XCTUnwrap(Note(id: "note-a", ["by": "u", "kind": "doodle", "doodle": old, "at": 1.0]))
        XCTAssertEqual(n.doodle.count, DOODLE_W * DOODLE_H)
        let px = Array(n.doodle)
        XCTAssertEqual(px[93], "0")
        XCTAssertEqual(px[94], "3")
        XCTAssertEqual(px[95], "3")
        XCTAssertEqual(px[DOODLE_W + 95], "3")
        // today's: `hd` wins, and `doodle` keeps a small copy for apps from before
        var fine = Doodle.blank()
        for x in 10..<80 { fine[40 * DOODLE_W + x] = 9 }
        let made = Note.new(by: "u", doodle: Doodle.encode(fine))
        XCTAssertEqual((made.doc["hd"] as? String)?.count, DOODLE_W * DOODLE_H)
        XCTAssertEqual((made.doc["doodle"] as? String)?.count, OLD_DOODLE_W * OLD_DOODLE_H)
        XCTAssertTrue((made.doc["doodle"] as? String)?.contains("9") ?? false, "a one-pixel line survives the small copy")
        let back = try XCTUnwrap(Note(id: made.id, made.doc))
        XCTAssertEqual(back.doodle, Doodle.encode(fine))
        XCTAssertNil(Note(id: "note-b", ["by": "u", "kind": "doodle", "doodle": "123", "at": 1.0]))
        // the same as the website, pixel for pixel
        guard let wall = LettersTests.fx?["wall"] as? Doc, let all = wall["doodles"] as? [Doc] else { throw XCTSkip("no fixtures (set SOULTIED_FIXTURES)") }
        XCTAssertEqual(all.count, 25)
        for d in all {
            let px = d["px"] as! String
            XCTAssertTrue(Doodle.isDoodle(px))
            XCTAssertEqual(Doodle.full(px), d["full"] as? String)
            XCTAssertEqual(Doodle.small(px), d["small"] as? String)
            XCTAssertEqual(Doodle.art(px, ref: "n", by: "u").px, d["art"] as? String)
        }
        XCTAssertEqual(all.last?["px"] as? String, Doodle.demo)
    }

    func testTouchSummaryAndDecor() {
        let t = { (k: TouchKind, at: Double) in Touch(id: "\(at)", by: "x", kind: k, at: at) }
        XCTAssertEqual(touchSummary([t(.hug, 3)]), "a hug")
        XCTAssertEqual(touchSummary([t(.kiss, 3), t(.hug, 2), t(.hug, 1)]), "two hugs and a kiss")
        XCTAssertEqual(touchSummary([t(.kiss, 3), t(.boop, 2), t(.hug, 1)]), "a kiss, a boop and a hug")
        var d = DecorDoc()
        d.placed = ["rug": "nope", "pet": "corgi"]
        XCTAssertEqual(d.decor.rug, "diamond")
        XCTAssertEqual(d.decor.pet, "corgi")
        XCTAssertEqual(Places.cleanCode("st abcd-efgh jkmn"), "ST-ABCD-EFGH-JKMN")
        XCTAssertTrue(Places.makeCode().hasPrefix("ST-"))
        XCTAssertEqual(Places.makeCode().count, 17)
    }
}
