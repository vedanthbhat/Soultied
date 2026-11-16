import XCTest
@testable import SoultiedCore

/// The couples board: names, weeks, saying yes, bests, your line and the boards themselves, exactly as the website
/// works them out (src/together/ranks.ts), so a phone and a laptop agree on who's where.
final class RanksTests: XCTestCase {
    private var fx: Doc? { LettersTests.fx?["ranks"] as? Doc }

    private func ints(_ v: Any?) -> [Int] { ((v as? [Any]) ?? []).compactMap { Values.num($0).map { Int($0) } } }

    func testWordsAndWeeks() throws {
        guard let r = fx else { throw XCTSkip("no fixtures (set SOULTIED_FIXTURES)") }
        XCTAssertEqual(Ranks.first, r.list("first").compactMap { $0 as? String })
        XCTAssertEqual(Ranks.second, r.list("second").compactMap { $0 as? String })
        let weeks = r.list("weeks").compactMap { $0 as? [Any] }
        XCTAssertGreaterThan(weeks.count, 40)
        for w in weeks {
            let ms = Values.num(w[0])!
            XCTAssertEqual(Ranks.weekOf(ms), Int(Values.num(w[1])!), "\(ms)")
        }
        for c in r.list("names").compactMap({ $0 as? Doc }) {
            let avoid = c.list("avoid").compactMap { RankName($0) }
            let got = Ranks.suggest(seeded(c.int("seed")!), count: c.int("count")!, avoid: avoid)
            XCTAssertEqual(got.map(\.list), c.list("names").map { ints($0) }, "seed \(c.int("seed")!)")
        }
        for t in r.list("nameTexts").compactMap({ $0 as? [Any] }) {
            XCTAssertEqual(RankName(t[0])?.text, t[1] as? String)
        }
    }

    func testSayingYes() throws {
        guard let r = fx else { throw XCTSkip("no fixtures (set SOULTIED_FIXTURES)") }
        let docs = r.list("docs").compactMap { $0 as? Doc }
        XCTAssertEqual(docs.count, 7)
        for c in docs {
            let d = RanksDoc(c["raw"] as? Doc)
            let want = c.map("doc")
            XCTAssertEqual(d.yes, want.map("yes").compactMapValues { Values.num($0) })
            XCTAssertEqual(d.name?.list, (want["name"] as? [Any]).map { ints($0) })
            let stages = c.list("stages").compactMap { $0 as? String }
            XCTAssertEqual([d.stage(me: "u1", them: "u2"), d.stage(me: "u2", them: "u1"), d.stage(me: "u1", them: nil), d.stage(me: "u3", them: "u2")].map(\.rawValue), stages)
        }
    }

    /// a patch as the website writes it (whole numbers), for comparing
    private func same(_ a: Doc?, _ b: Any?, _ what: String) {
        guard let a else {
            XCTAssertTrue(b == nil || b is NSNull, "\(what): the website wrote \(String(describing: b))")
            return
        }
        guard let b = b as? Doc else { return XCTFail("\(what): the website wrote nothing, we wrote \(a)") }
        XCTAssertEqual(NSDictionary(dictionary: a), NSDictionary(dictionary: b), what)
    }

    func testBests() throws {
        guard let r = fx else { throw XCTSkip("no fixtures (set SOULTIED_FIXTURES)") }
        let now = r.num("now")!
        // the same games the fixtures finished (see scripts/native-fixtures.ts)
        func kitchen(_ served: Int, _ status: String, _ at: Double) -> Match {
            Match(["kind": "kitchen", "id": "k\(Int(at))", "status": status, "turn": NSNull(), "winner": "draw", "startedBy": "a", "startedAt": at - 90000,
                   "updatedAt": at, "updatedBy": "a", "seq": 3,
                   "state": ["phase": "done", "joined": ["a": true, "b": true], "seed": 1, "result": ["winner": "draw", "line": "x", "score": ["a": served, "b": served]]],
                   "wins": ["a": 0, "b": 0], "last": ""])!
        }
        func doodle(_ got: Int, _ best: Int, _ status: String, _ at: Double) -> Match {
            let rounds: [Any] = (0..<6).map { i in ["word": "w\(i)", "drawer": i % 2 == 1 ? "b" : "a", "secs": i < got ? 10 + i : NSNull()] as Doc }
            return Match(["kind": "doodle", "id": "d\(Int(at))", "status": status, "turn": NSNull(), "winner": NSNull(), "startedBy": "a", "startedAt": at - 600000,
                          "updatedAt": at, "updatedBy": "b", "seq": 30,
                          "state": ["phase": "reveal", "joined": ["a": true, "b": true], "round": 6, "drawer": "a", "choices": [Any](), "word": NSNull(),
                                    "startedAt": NSNull(), "endsAt": NSNull(), "guesses": [Any](), "rounds": rounds, "best": best],
                          "wins": ["a": 0, "b": 0], "last": ""])!
        }
        let day = 86_400_000.0
        var broken = kitchen(3, "over", now)
        broken.state = ["phase": "done", "result": NSNull()]
        let games: [(Match?, Match?)] = [
            (nil, nil),
            (kitchen(14, "over", now - 3_600_000), nil),
            (kitchen(5, "over", now - 10 * day), nil),
            (kitchen(30, "playing", now), nil),
            (kitchen(200, "over", now), nil),
            (nil, doodle(5, 3, "over", now - 60000)),
            (nil, doodle(1, 6, "playing", now)),
            (nil, doodle(2, 2, "over", now - 9 * day)),
            (kitchen(9, "over", now - 1000), doodle(4, 4, "over", now - 1000)),
            (broken, nil),
        ]
        let cases = r.list("bests").compactMap { $0 as? Doc }
        XCTAssertEqual(cases.count, 5)
        for (i, c) in cases.enumerated() {
            let b = BestsDoc(c["raw"] as? Doc)
            let want = c.map("doc")
            XCTAssertEqual(b.kitchen, want.int("kitchen"), "case \(i)")
            XCTAssertEqual(b.doodle, want.int("doodle"), "case \(i)")
            XCTAssertEqual(b.week.w, want.map("week").int("w"), "case \(i)")
            XCTAssertEqual(b.week.kitchen, want.map("week").int("kitchen"), "case \(i)")
            XCTAssertEqual(b.week.doodle, want.map("week").int("doodle"), "case \(i)")
            XCTAssertEqual(Dictionary(uniqueKeysWithValues: b.escape.map { ($0.key.rawValue, $0.value) }), want.map("escape").compactMapValues { Values.num($0).map { Int($0) } }, "case \(i)")
            let patches = c.list("patches")
            XCTAssertEqual(patches.count, games.count)
            for (j, g) in games.enumerated() { same(b.patch(kitchen: g.0, doodle: g.1, now: now), patches[j], "case \(i), games \(j)") }
            for e in c.list("escapes").compactMap({ $0 as? [Any] }) {
                let room = RoomId(rawValue: e[0] as! String)!
                let ms = Values.num(e[1])!
                same(b.escapePatch(room, ms: ms), e[2], "case \(i), \(room.rawValue) in \(ms)")
            }
        }
    }

    func testYourLine() throws {
        guard let r = fx else { throw XCTSkip("no fixtures (set SOULTIED_FIXTURES)") }
        let now = r.num("now")!, today = r.str("today")!
        let a = Wardrobe.random(seeded(1)), b = Wardrobe.random(seeded(2))
        for c in r.list("entries").compactMap({ $0 as? Doc }) {
            let couch = CouchState(c.map("couch"))
            let e = RankEntry(name: RankName(3, 9), looks: [a, b], couch: couch, today: today, bests: BestsDoc(c["raw"] as? Doc), now: now)
            same(e.doc, c["entry"], "\(couch.together)")
        }
        // characters made up from the same numbers come out the same
        let seeds = [1, 2, 3, 42, 4711, 20_261_116]
        let avatars = r.list("avatars")
        for (i, s) in seeds.enumerated() { same(Wardrobe.dictionary(Wardrobe.random(seeded(s))), avatars[i], "seed \(s)") }
    }

    func testTheBoards() throws {
        guard let r = fx else { throw XCTSkip("no fixtures (set SOULTIED_FIXTURES)") }
        let now = r.num("now")!, today = r.str("today")!
        // the demo room's couples, made up the same
        let demo = Ranks.demoBoards(today: today, now: now)
        let want = r.list("demo").compactMap { $0 as? Doc }
        XCTAssertEqual(demo.count, want.count)
        for (d, w) in zip(demo, want) {
            XCTAssertEqual(d.id, w.str("id"))
            same(d.data, w["data"], d.id)
        }
        // and some lines that aren't right
        let a = Wardrobe.dictionary(Wardrobe.random(seeded(1))), b = Wardrobe.dictionary(Wardrobe.random(seeded(2)))
        let w = Ranks.weekOf(now)
        let odd: [Row] = [
            Row(id: "odd-1", data: [:]),
            Row(id: "odd-2", data: ["name": [1, 50], "looks": [Doc(), Doc()], "fire": 10, "fireDay": today]),
            Row(id: "odd-3", data: ["name": [1.5, 2], "looks": [Doc(), Doc()], "fire": 10, "fireDay": today]),
            Row(id: "odd-4", data: ["name": [3, 4], "looks": [Doc()], "fire": 10, "fireDay": today]),
            Row(id: "odd-5", data: ["name": [3, 4], "looks": [["rendererVersion": 2, "skin": "nope", "hat": "crown"] as Doc, "x"], "fire": 10.8, "fireDay": "2026-11-16",
                                    "kitchen": "7", "doodle": 3, "kw": w * 100 + 4, "dw": Ranks.weekOf(now - 7 * 86_400_000) * 100 + 5,
                                    "esc": ["attic": 9000, "cellar": 600_000, "office": "x"] as Doc]),
            Row(id: "odd-6", data: ["name": [5, 6], "looks": [a, b], "fire": 3, "fireDay": "2026-11-15", "kitchen": 17, "doodle": 6, "kw": w * 100 + 17, "esc": ["library": 1_200_000] as Doc]),
            Row(id: "odd-7", data: ["name": [7, 8], "looks": [b, a], "fire": 0, "fireDay": today, "kitchen": 17, "esc": Doc()]),
        ]
        let boards = r.list("boards").compactMap { $0 as? Doc }
        XCTAssertEqual(boards.map { $0.str("id") ?? "" }, BoardId.allCases.map(\.rawValue))
        for c in boards {
            let id = BoardId(rawValue: c.str("id")!)!
            XCTAssertEqual(id.query.field, c.map("query").str("field"))
            XCTAssertEqual(id.query.descending, c.map("query")["desc"] as? Bool)
            let got = Ranks.rows(id, demo + odd, mine: "odd-6", today: today, now: now)
            let rows = c.list("rows").compactMap { $0 as? Doc }
            XCTAssertEqual(got.count, rows.count, id.rawValue)
            for (g, x) in zip(got, rows) {
                XCTAssertEqual(g.id, x.str("id"), id.rawValue)
                XCTAssertEqual(g.rank, x.int("rank"), "\(id.rawValue) \(g.id)")
                XCTAssertEqual(g.name, x.str("name"), "\(id.rawValue) \(g.id)")
                XCTAssertEqual(g.value, x.int("value"), "\(id.rawValue) \(g.id)")
                XCTAssertEqual(g.text, x.str("text"), "\(id.rawValue) \(g.id)")
                XCTAssertEqual(g.mine, x["mine"] as? Bool, "\(id.rawValue) \(g.id)")
                let looks = x.list("looks")
                same(Wardrobe.dictionary(g.looks.0), looks.first, "\(id.rawValue) \(g.id) looks")
                same(Wardrobe.dictionary(g.looks.1), looks.last, "\(id.rawValue) \(g.id) looks")
            }
            let values = c.list("values").compactMap { $0 as? String }
            XCTAssertEqual([1, 2, 59, 600_000].map { Ranks.valueText(id, $0) }, values, id.rawValue)
        }
    }

    /// saying yes together, your line going up (and coming down), and a finished game noted as a best
    func testOnTheBoardTogether() throws {
        let db = MemoryBackend(synchronous: true)
        let sid = "space-x"
        db.seed("spaces/\(sid)", ["id": sid, "creatorId": "u1", "partnerId": "u2", "members": ["u1", "u2"], "name": "Ours", "createdAt": "2026-10-01T00:00:00.000Z"])
        db.seed("spaces/\(sid)/members/u1", MemberDoc(name: "Aanya", avatar: Wardrobe.defaultA, lastActive: Values.isoNow()).doc)
        db.seed("spaces/\(sid)/members/u2", MemberDoc(name: "Rohan", avatar: Wardrobe.defaultB, lastActive: Values.isoNow()).doc)
        let today = Day.today()
        db.seed("spaces/\(sid)/meta/couch", ["seen": ["u1": today, "u2": today], "together": [Day.add(today, -2), Day.add(today, -1), today]])
        let one = PlaceModel(db: db, sid: sid, me: "u1")
        let two = PlaceModel(db: db, sid: sid, me: "u2")
        one.start()
        two.start()
        defer {
            one.stop()
            two.stop()
        }
        XCTAssertEqual(one.rankStage, .off)
        one.askRanks(RankName(4, 6))
        let ask = expectation(description: "asked")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { ask.fulfill() }
        wait(for: [ask], timeout: 2)
        XCTAssertEqual(one.rankStage, .asked)
        XCTAssertEqual(two.rankStage, .askedMe)
        XCTAssertNil(db.snapshot("leaderboard/\(sid)"))

        two.answerRanks(true)
        let on = expectation(description: "on")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { on.fulfill() }
        wait(for: [on], timeout: 2)
        XCTAssertEqual(one.rankStage, .on)
        let line = try XCTUnwrap(db.snapshot("leaderboard/\(sid)"))
        XCTAssertEqual(line["name"] as? [Int], [4, 6])
        XCTAssertEqual(line["fire"] as? Int, 3)
        XCTAssertEqual((line["looks"] as? [Any])?.count, 2)
        XCTAssertNil(line["kitchen"])

        // a Kitchen Rush shift ends: it's your best, and the line says so
        var m = Match(kind: .kitchen, starter: .a, state: ["phase": "done", "joined": ["a": true, "b": true], "seed": 1, "result": ["winner": "draw", "line": "x", "score": ["a": 11, "b": 11]]], wins: nil)
        m.status = .over
        one.saveGame(m)
        let played = expectation(description: "played")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { played.fulfill() }
        wait(for: [played], timeout: 2)
        XCTAssertEqual(two.bests.kitchen, 11)
        XCTAssertEqual(db.snapshot("leaderboard/\(sid)")?["kitchen"] as? Int, 11)
        XCTAssertEqual(db.snapshot("leaderboard/\(sid)")?["kw"] as? Int, Ranks.weekOf(Values.nowMs()) * 100 + 11)

        // on the board, as the other couples see it
        let shown = expectation(description: "board")
        final class Box: @unchecked Sendable { var rows: [BoardRow]? }
        let box = Box()
        Task { @MainActor in
            box.rows = await one.board(.kitchenAll)
            shown.fulfill()
        }
        wait(for: [shown], timeout: 2)
        let rows = box.rows
        XCTAssertEqual(rows?.count, 1)
        XCTAssertEqual(rows?.first?.name, "The Faraway Comets")
        XCTAssertEqual(rows?.first?.mine, true)
        XCTAssertEqual(rows?.first?.text, "11 served")

        // an escape (only a faster one counts)
        one.noteEscape(.cellar, ms: 900_000)
        one.noteEscape(.cellar, ms: 950_000)
        let esc = expectation(description: "escaped")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { esc.fulfill() }
        wait(for: [esc], timeout: 2)
        XCTAssertEqual((db.snapshot("leaderboard/\(sid)")?["esc"] as? Doc)?["cellar"] as? Int, 900_000)

        // either of you takes it down
        two.leaveRanks()
        let off = expectation(description: "off")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { off.fulfill() }
        wait(for: [off], timeout: 2)
        XCTAssertNil(db.snapshot("leaderboard/\(sid)"))
        XCTAssertEqual(one.rankStage, .off)
    }
}
