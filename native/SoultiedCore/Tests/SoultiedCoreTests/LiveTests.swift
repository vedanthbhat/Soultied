import XCTest
@testable import SoultiedCore

/// The live games: their rules against the website's (scripts/native-fixtures.ts runs whole games the way the
/// host does and writes down every step), and two phones playing each other over the channel.
final class LiveRulesTests: XCTestCase {
    func json(_ v: Any) -> String {
        let d = try! JSONSerialization.data(withJSONObject: ["v": v], options: [.sortedKeys, .fragmentsAllowed])
        return String(decoding: d, as: UTF8.self)
    }

    /// plays a game the way the fixtures did, step for step, and says where it first went differently
    func replay<R: LiveRules>(_ make: (@escaping Random) -> R, _ g: Doc) -> String? {
        let seed = g.int("seed")!, start = g.num("start")!
        let steps = g["steps"] as! [Doc]
        let rules = make(seeded(seed ^ 0x5bd1e995))
        var i = 0
        func check(_ t: Double, _ op: String, _ seat: Side?, _ a: Doc?, _ changed: Bool?, _ s: R.S) -> String? {
            guard i < steps.count else { return "an extra \(op) at \(t)" }
            let w = steps[i]
            i += 1
            if w.num("t") != t || w.str("op") != op || w.str("seat") != seat?.rawValue { return "step \(i - 1): \(op) \(seat?.rawValue ?? "") at \(t), want \(w.str("op") ?? "") \(w.str("seat") ?? "") at \(w.num("t") ?? 0)" }
            if let a, json(a) != json(w["a"]!) { return "step \(i - 1): move \(json(a)) want \(json(w["a"]!))" }
            if let changed, (w["changed"] as? Bool) != changed { return "step \(i - 1): changed \(changed)" }
            if json(s.doc) != json(w["s"]!) { return "step \(i - 1) (\(op) at \(t)): \(json(s.doc)) want \(json(w["s"]!))" }
            return nil
        }
        var s = rules.initial(seeded(seed), now: start)
        if let p = check(start, "init", nil, nil, nil, s) { return p }
        let begin = start + Play.countdownMs
        var res: LiveResult?
        var t = begin
        outer: while t < begin + 180_000 && res == nil {
            let el = t - begin
            if rules.hasTick && el.truncatingRemainder(dividingBy: rules.tickMs) == 0 {
                if let n = rules.tick(s, now: t) {
                    s = n
                    if let p = check(t, "tick", nil, nil, nil, s) { return p }
                }
                res = rules.result(s)
                if res != nil { break }
            }
            if el.truncatingRemainder(dividingBy: rules.botMs) == 0 {
                for seat in [Side.a, .b] {
                    guard let a = rules.bot(s, seat, now: t) else { continue }
                    let n = rules.act(s, seat, a, now: t)
                    if let p = check(t, "act", seat, a.doc, n != nil, n ?? s) { return p }
                    if let n { s = n }
                    res = rules.result(s)
                    if res != nil { break outer }
                }
            }
            t += 5
        }
        if i != steps.count { return "stopped after \(i) of \(steps.count) steps" }
        let want = g["result"].flatMap { $0 is NSNull ? nil : $0 }
        if json(res?.doc ?? NSNull()) != json(want ?? NSNull()) { return "result \(json(res?.doc ?? NSNull())) want \(json(want ?? NSNull()))" }
        return nil
    }

    func testRulesMatchTheWebsite() throws {
        guard let games = LettersTests.fx?["live"] as? [Doc] else { throw XCTSkip("no fixtures (set SOULTIED_FIXTURES)") }
        XCTAssertGreaterThanOrEqual(games.count, 18)
        var kinds = Set<String>()
        for g in games {
            let kind = g.str("kind")!
            kinds.insert(kind)
            let problem: String?
            switch kind {
            case "tug": problem = replay({ Tug(rng: $0) }, g)
            case "rps": problem = replay({ Rps(rng: $0) }, g)
            case "quickdraw": problem = replay({ QuickDraw(rng: $0) }, g)
            default: problem = "unknown game \(kind)"
            }
            if let problem { XCTFail("\(kind) (seed \(g.int("seed") ?? 0)): \(problem)") }
        }
        XCTAssertEqual(kinds, ["tug", "rps", "quickdraw"])
    }

    func testRulesBits() {
        // tug: a lead of 28 pulls the ribbon all the way over
        let tug = Tug()
        var s = tug.initial(seeded(1), now: 0)
        s = tug.act(s, .b, Tug.Act(taps: 28), now: 4000)!
        XCTAssertEqual(s.winner, "b")
        XCTAssertEqual(tug.result(s)?.line, "pulled the ribbon all the way over")
        XCTAssertNil(tug.act(s, .a, Tug.Act(taps: 5), now: 4100), "it's over")
        // never more than 40 taps at once
        var t = tug.initial(seeded(1), now: 0)
        t = tug.act(t, .a, Tug.Act(taps: 500), now: 3500)!
        XCTAssertEqual(t.taps[.a], 40)

        // paper, scissors, stone: no pick loses the round
        let rps = Rps()
        var r = rps.initial(seeded(1), now: 0)
        r = rps.act(r, .a, Rps.Act(round: 1, hand: .paper), now: 3500)!
        XCTAssertNil(rps.act(r, .a, Rps.Act(round: 1, hand: .stone), now: 3600), "one pick a round")
        r = rps.tick(r, now: 8000)!
        XCTAssertEqual(r.phase, "show")
        XCTAssertEqual(r.score[.a], 1)
        XCTAssertEqual(r.last?.winner, .a)

        // quick draw: a tap in the dark loses the round straight away
        let q = QuickDraw(rng: { 0.5 })
        var d = q.initial(seeded(1), now: 0)
        XCTAssertEqual(d.litAt, 3000 + 1400 + 1400)
        d = q.act(d, .b, QuickDraw.Act(.early, round: 1), now: 4000)!
        XCTAssertEqual(d.phase, "show")
        XCTAssertEqual(d.score[.a], 1)
        XCTAssertEqual(QuickDraw.Act(["ms": 33.6, "round": 2])?.tap, .ms(34))
    }

    func testInvitationAndResult() throws {
        var m = Play.newLive(.rps, starter: .b, wins: [.a: 4])
        XCTAssertEqual(m.status, .setup)
        XCTAssertTrue(Play.needsMe(m, .a))
        XCTAssertFalse(Play.needsMe(m, .b))
        XCTAssertNil(Play.liveJoin(m, .b), "already in")
        m = try XCTUnwrap(Play.liveJoin(m, .a))
        XCTAssertEqual(m.status, .playing)
        XCTAssertEqual(m.state.str("phase"), "live")
        XCTAssertEqual(m.last, "joined")
        let r = LiveResult(winner: "a", line: "won Paper, Scissors, Stone 3–1", score: [.a: 3, .b: 1])
        let done = try XCTUnwrap(Play.liveFinish(m, r))
        XCTAssertEqual(Play.liveResult(Match(done.doc)), r)
        XCTAssertNil(Play.liveFinish(done, r))
        XCTAssertEqual(Play.endLine(done, name: { $0 == .a ? "Aanya" : "Rohan" }), "Aanya won at Paper, Scissors, Stone.")
        let stopped = try XCTUnwrap(Play.liveCancel(m))
        XCTAssertNil(Play.liveResult(stopped))
        XCTAssertEqual(Play.endLine(stopped, name: { _ in "" }), "")
        // the demo partner says yes
        XCTAssertEqual(Play.botAct(Play.newLive(.tug, starter: .a), .b)?.status, .playing)
    }

}

/// Two phones playing each other over the channel (and the demo room's partner).
@MainActor
final class LiveSessionTests: XCTestCase {
    func settle() async {
        for _ in 0..<4 { try? await Task.sleep(nanoseconds: 20_000_000) }
    }

    /// two phones on one place, with a clock the test moves along
    func twoPhones() async -> (PlaceModel, PlaceModel, () -> Double, (Double) -> Void) {
        let db = Demo.backend()
        db.synchronous = true
        let pa = PlaceModel(db: db, sid: Demo.sid, me: Demo.me)
        let pb = PlaceModel(db: db, sid: Demo.sid, me: Demo.them)
        pa.start()
        pb.start()
        await settle()
        final class Clock { var t: Double = 1_790_000_000_000 }
        let c = Clock()
        return (pa, pb, { c.t }, { c.t += $0 })
    }

    func testTwoPhonesPlayTugOfWar() async throws {
        let (pa, pb, now, wait) = await twoPhones()
        XCTAssertEqual(pa.mySeat, .a)
        XCTAssertEqual(pb.mySeat, .b)
        let sa = LiveSession(kind: .tug, rules: Tug(), place: pa, clock: now)
        let sb = LiveSession(kind: .tug, rules: Tug(), place: pb, clock: now)

        // Rohan invites, so his phone keeps the game this time
        sb.invite()
        await settle()
        sa.sync()
        sb.sync()
        XCTAssertEqual(sb.stage(), .inviting)
        XCTAssertEqual(sa.stage(), .invited)
        XCTAssertTrue(sb.host)
        XCTAssertFalse(sa.host)
        sa.join()
        await settle()
        sa.sync()
        sb.sync()
        XCTAssertEqual(pa.games[.tug]?.status, .playing)
        for _ in 0..<2 {
            sb.pulse()
            sa.pulse()
        }
        XCTAssertTrue(sa.partnerHere)
        XCTAssertTrue(sb.partnerHere)
        XCTAssertEqual(sa.mode, .local)
        XCTAssertEqual(sb.stage(), .count)
        XCTAssertEqual(sa.stage(), .count, "the guest has the game too")

        // tapping before the countdown's over does nothing
        sa.act(Tug.Act(taps: 1), fast: true)
        XCTAssertEqual(sb.state?.taps[.a], 0)
        wait(3000)
        sa.pulse()
        sb.pulse()
        XCTAssertEqual(sa.stage(), .play)

        // Aanya taps faster
        var na = 0, nb = 0
        for i in 0..<400 where sb.end == nil {
            wait(50)
            if i % 2 == 0 {
                na += 1
                sa.act(Tug.Act(taps: na), fast: true)
            }
            if i % 3 == 0 {
                nb += 1
                sb.act(Tug.Act(taps: nb))
            }
            sa.pulse()
            sb.pulse()
        }
        let end = try XCTUnwrap(sb.end)
        XCTAssertEqual(end.winner, "a")
        sa.pulse()
        sb.pulse()
        await settle()
        sa.sync()
        XCTAssertEqual(sa.result?.winner, "a")
        XCTAssertEqual(sa.stage(), .over)
        XCTAssertEqual(pa.games[.tug]?.status, .over)
        XCTAssertEqual(pa.games[.tug]?.wins[.a], 1)
        XCTAssertTrue(pa.activities.contains { $0.description == "Aanya won at Tug of War." })
        sa.close()
        sb.close()
    }

    func testTwoPhonesPlayQuickDrawAndOneWalksAway() async throws {
        let (pa, pb, now, wait) = await twoPhones()
        let sa = LiveSession(kind: .quickdraw, rules: QuickDraw(), place: pa, clock: now)
        let sb = LiveSession(kind: .quickdraw, rules: QuickDraw(), place: pb, clock: now)
        sa.invite()
        await settle()
        sb.sync()
        sb.join()
        await settle()
        for _ in 0..<3 {
            sa.pulse()
            sb.pulse()
        }
        XCTAssertEqual(sb.stage(), .count)
        // a round: the lantern lights; Rohan is quicker
        let lit = try XCTUnwrap(sb.state?.litAt)
        wait(sb.local(lit) - now() + 10)
        sb.act(QuickDraw.Act(.ms(210), round: 1))
        sa.act(QuickDraw.Act(.ms(340), round: 1))
        sa.pulse()
        sb.pulse()
        XCTAssertEqual(sb.state?.phase, "show")
        XCTAssertEqual(sb.state?.score[.b], 1)
        XCTAssertEqual(sa.state?.last?.taps[.a], .ms(340))

        // Rohan's phone goes quiet: the game stops after a while
        sb.close()
        await settle()
        for _ in 0..<40 {
            wait(1000)
            sa.pulse()
        }
        await settle()
        sa.sync()
        XCTAssertEqual(pa.games[.quickdraw]?.status, .over)
        XCTAssertEqual(pa.games[.quickdraw]?.last, "stopped the game")
        XCTAssertNil(sa.result)
        XCTAssertEqual(sa.stage(), .over)
        sa.close()
    }

    func testDemoPartnerPlaysPaperScissorsStone() async throws {
        let db = Demo.backend()
        db.synchronous = true
        let p = PlaceModel(db: db, sid: Demo.sid, me: Demo.me, demo: true)
        p.start()
        await settle()
        final class Clock { var t: Double = 1_790_000_000_000 }
        let c = Clock()
        let s = LiveSession(kind: .rps, rules: Rps(), place: p, clock: { c.t })
        s.invite()
        await settle()
        // (the demo partner joins after a moment; here, straight away)
        p.saveGame(try XCTUnwrap(Play.liveJoin(try XCTUnwrap(p.games[.rps]), .b)))
        await settle()
        s.pulse()
        XCTAssertTrue(s.host)
        XCTAssertEqual(s.stage(), .count)
        for _ in 0..<2000 where s.end == nil {
            c.t += 50
            if let st = s.state, st.phase == "pick", st.picks[.a] == nil { s.act(Rps.Act(round: st.round, hand: .stone)) }
            s.pulse()
        }
        XCTAssertNotNil(s.end)
        await settle()
        XCTAssertEqual(p.games[.rps]?.status, .over)
        s.close()
    }
}
