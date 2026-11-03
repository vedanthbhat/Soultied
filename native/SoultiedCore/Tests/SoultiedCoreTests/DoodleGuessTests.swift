import XCTest
@testable import SoultiedCore

/// Doodle Guess against the website's (scripts/native-fixtures.ts): judging guesses, the brush, the paint bucket,
/// the words offered, and whole games between two of the demo room's partners, move by move.
final class DoodleGuessTests: XCTestCase {
    func json(_ v: Any) -> String {
        let d = try! JSONSerialization.data(withJSONObject: ["v": v], options: [.sortedKeys, .fragmentsAllowed])
        return String(decoding: d, as: UTF8.self)
    }

    func fixtures() throws -> Doc {
        guard let d = LettersTests.fx?["doodle"] as? Doc else { throw XCTSkip("no fixtures (set SOULTIED_FIXTURES)") }
        return d
    }

    func testJudgingGuesses() throws {
        let judges = try fixtures()["judges"] as! [[Any]]
        XCTAssertGreaterThan(judges.count, 1000)
        var bad = 0
        for j in judges {
            let g = j[0] as! String, w = j[1] as! String, want = j[2] as! String
            let got = DoodleGuess.judge(g, w).rawValue
            if got != want {
                bad += 1
                if bad < 8 { XCTFail("“\(g)” for “\(w)”: \(got), want \(want)") }
            }
        }
        XCTAssertEqual(bad, 0)
    }

    func testBrushBucketAndWords() throws {
        let fx = try fixtures()
        for b in fx["brushes"] as! [[Any]] {
            let n = b.prefix(5).map { Int(Values.num($0)!) }
            let want = (b[5] as! [Any]).map { Int(Values.num($0)!) }
            XCTAssertEqual(DoodleGuess.brushLine(n[0], n[1], n[2], n[3], size: n[4]), want, "brush \(n)")
        }
        for f in fx["fills"] as! [[Any]] {
            let want = (f[2] as! [Any]).map { Int(Values.num($0)!) }
            XCTAssertEqual(DoodleGuess.fillCells(f[0] as! String, Int(Values.num(f[1])!)), want)
        }
        for c in fx["choices"] as! [[Any]] {
            let seed = Int(Values.num(c[0])!)
            XCTAssertEqual(DoodleGuess.pickChoices(seeded(seed), avoid: c[1] as! [String]), c[2] as! [String])
        }
        // ink packed small, and laid back down
        let cells = DoodleGuess.brushLine(3, 4, 30, 20, size: 2)
        XCTAssertEqual(DoodleGuess.unpack(DoodleGuess.pack(cells)), cells)
        let p = DoodleGuess.apply(DoodleGuess.blank, [DoodleGuess.InkOp(c: "r", s: DoodleGuess.pack(cells)), DoodleGuess.InkOp(c: ".", s: DoodleGuess.pack([cells[0]]))])
        XCTAssertEqual(p.filter { $0 == "r" }.count, cells.count - 1)
        XCTAssertEqual(DoodleGuess.apply(p, [DoodleGuess.InkOp(c: "y", s: "*")]), String(repeating: "y", count: 1200))
        XCTAssertEqual(DoodleGuess.shape("ice cream", hint: true), "I _ _   _ _ _ _ _")
        XCTAssertEqual(DoodleGuess.botStrokes("fish").count, 56 * 4)
    }

    func testGamesMatchTheWebsite() throws {
        let steps = try fixtures()["games"] as! [Doc]
        XCTAssertGreaterThan(steps.count, 200)
        var bad = 0
        var ends = 0
        for s in steps {
            let seat = Side(rawValue: s["seat"] as! String)!
            let now = Values.num(s["now"])!
            let before = try XCTUnwrap(Match(s["before"] as? Doc))
            let want = try XCTUnwrap(Match(s["after"] as? Doc))
            XCTAssertTrue(Play.botTurn(before, seat, now: before.updatedAt), "\(seat) has something to do")
            let got = Play.doodleBot(before, seat, seeded(Int(Values.num(s["seed"])!)), now: now)
            let same = got.map { g in g.status == want.status && g.turn == want.turn && g.winner == want.winner && g.last == want.last && json(g.state) == json(want.state) } ?? false
            if !same {
                bad += 1
                if bad < 5 { XCTFail("\(DoodleGuess.State(before.state).phase): got \(got.map { "\($0.status) \($0.last) \(json($0.state))" } ?? "nothing") want \(want.status) \(want.last) \(json(want.state))") }
            }
            if want.status == .over { ends += 1 }
        }
        XCTAssertEqual(bad, 0)
        XCTAssertEqual(ends, 12)
    }

    func testRoundByHand() throws {
        var m = Play.newDoodle(.b, best: 2, now: 1000)
        XCTAssertEqual(m.status, .setup)
        XCTAssertTrue(Play.needsMe(m, .a, now: 1000))
        m = try XCTUnwrap(Play.doodleJoin(m, .a, rng: { 0 }))
        XCTAssertEqual(m.status, .playing)
        var st = DoodleGuess.State(m.state)
        XCTAssertEqual(st.phase, "choosing")
        XCTAssertEqual(st.drawer, .b, "whoever started draws first")
        XCTAssertEqual(st.choices.count, 3)
        XCTAssertNil(Play.doodleChoose(m, .a, "cat", now: 2000), "not your turn to draw")
        m = try XCTUnwrap(Play.doodleChoose(m, .b, "ice cream", now: 2000))
        XCTAssertNil(Play.doodleGuess(m, .b, "ice cream"), "the drawer can't guess")
        let close = try XCTUnwrap(Play.doodleGuess(m, .a, "ice crea", now: 5000))
        XCTAssertEqual(close.verdict, .right, "a typo in a longer word counts")
        let wrong = try XCTUnwrap(Play.doodleGuess(m, .a, "  cone ", now: 5000))
        XCTAssertEqual(wrong.verdict, .wrong)
        XCTAssertEqual(wrong.match.last, "guessed “cone”")
        let right = try XCTUnwrap(Play.doodleGuess(wrong.match, .a, "Ice Creams!", pixels: DoodleGuess.blank, now: 14_400))
        m = right.match
        st = DoodleGuess.State(m.state)
        XCTAssertEqual(st.phase, "reveal")
        XCTAssertEqual(st.rounds.first?.secs, 12)
        XCTAssertEqual(st.rounds.first?.pixels, DoodleGuess.blank)
        XCTAssertNil(Play.doodleKeepDrawing(m, DoodleGuess.blank), "already kept")
        XCTAssertTrue(Play.botTurn(m, .a), "whoever guessed moves things on")
        m = try XCTUnwrap(Play.doodleNext(m, rng: { 0.5 }))
        st = DoodleGuess.State(m.state)
        XCTAssertEqual(st.drawer, .a)
        XCTAssertEqual(st.round, 2)
        XCTAssertFalse(st.choices.contains("ice cream"))
        m = try XCTUnwrap(Play.doodleChoose(m, .a, "owl", now: 20_000))
        m = try XCTUnwrap(Play.doodleTimeUp(m, gaveUp: true))
        XCTAssertEqual(m.last, "skipped that one")
        XCTAssertEqual(DoodleGuess.State(m.state).score, 1)
        XCTAssertEqual(Play.note(Play.newDoodle(.b), who: "Rohan"), "Rohan wants to play Doodle Guess. Join them?")
    }
}

/// Two phones playing Doodle Guess: the ink and the saved page going from one to the other.
@MainActor
final class DoodleSessionTests: XCTestCase {
    func settle() async {
        for _ in 0..<4 { try? await Task.sleep(nanoseconds: 20_000_000) }
    }

    func testTwoPhonesDrawAndGuess() async throws {
        let db = Demo.backend()
        db.synchronous = true
        let pa = PlaceModel(db: db, sid: Demo.sid, me: Demo.me)
        let pb = PlaceModel(db: db, sid: Demo.sid, me: Demo.them)
        pa.start()
        pb.start()
        await settle()
        final class Clock { var t: Double = 1_790_000_000_000 }
        let c = Clock()
        let now = { c.t }
        let sa = DoodleSession(place: pa, clock: now)
        let sb = DoodleSession(place: pb, clock: now)
        func both() async {
            await settle()
            sa.sync()
            sb.sync()
            await settle()
            sa.sync()
            sb.sync()
        }
        sa.sync()
        sb.sync()
        sa.start()
        // Rohan's screen says he's here as soon as it sees the game
        await both()
        var st = try XCTUnwrap(sa.state)
        XCTAssertEqual(st.phase, "choosing")
        XCTAssertTrue(sa.iDraw, "whoever started draws first")
        XCTAssertFalse(sb.iDraw)
        let word = st.choices[0]
        sb.choose(word)
        await both()
        XCTAssertEqual(sa.state?.phase, "choosing", "only the drawer chooses")
        sa.choose(word)
        await both()
        XCTAssertTrue(sa.drawing && sb.drawing)

        // a line, then a bucket of red over the paper
        sa.penDown(5, 5)
        sa.penMove(20, 9)
        sa.penUp()
        sb.penDown(1, 1)
        XCTAssertEqual(sb.pixels, DoodleGuess.blank, "the guesser can't draw")
        c.t += 400
        sa.pulse()
        XCTAssertNotEqual(sa.pixels, DoodleGuess.blank)
        XCTAssertEqual(sb.pixels, sa.pixels)
        sa.color = "r"
        sa.tool = .fill
        sa.penDown(0, 25)
        sa.tool = .erase
        sa.penDown(39, 29)
        c.t += 400
        sa.pulse()
        XCTAssertEqual(sb.pixels, sa.pixels)
        XCTAssertTrue(sa.pixels.contains("r"))

        // the page is saved now and then, for someone opening the game halfway through
        c.t += 2600
        sa.pulse()
        await settle()
        let late = DoodleSession(place: pb, clock: now)
        late.sync()
        XCTAssertEqual(late.pixels, sa.pixels)
        late.close()

        // a guess or two
        XCTAssertEqual(sb.guess("zzzzzzzz"), .wrong)
        await both()
        XCTAssertEqual(sa.state?.guesses.last?.text, "zzzzzzzz")
        c.t += 9000
        XCTAssertEqual(sb.guess(word.uppercased()), .right)
        await both()
        st = try XCTUnwrap(sa.state)
        XCTAssertEqual(st.phase, "reveal")
        XCTAssertEqual(st.rounds.first?.pixels, sa.pixels, "the drawing stays with the round")
        XCTAssertEqual(st.score, 1)

        // the guesser moves things on; now Rohan draws, and runs out of time
        sb.next()
        await both()
        st = try XCTUnwrap(sb.state)
        XCTAssertEqual(st.round, 2)
        XCTAssertTrue(sb.iDraw)
        XCTAssertEqual(sb.pixels, DoodleGuess.blank, "a new page")
        sb.choose(st.choices[1])
        await both()
        sb.penDown(10, 10)
        c.t += 81_000
        sa.pulse()
        await both()
        XCTAssertEqual(sa.state?.phase, "drawing", "the guesser gives the drawer a moment")
        sb.pulse()
        await both()
        st = try XCTUnwrap(sa.state)
        XCTAssertEqual(st.phase, "reveal")
        XCTAssertEqual(pa.games[.doodle]?.last, "ran out of time")
        XCTAssertNil(st.rounds.last?.secs)
        XCTAssertEqual(st.rounds.last?.pixels, sb.pixels)
        sa.close()
        sb.close()
    }
}
