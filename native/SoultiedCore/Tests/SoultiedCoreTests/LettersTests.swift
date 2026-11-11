import XCTest
@testable import SoultiedCore

/// The letters engine against the website's (scripts/native-fixtures.ts writes what the website works out;
/// SOULTIED_FIXTURES says where). Partners on a phone and a laptop must get exactly the same letters.
final class LettersTests: XCTestCase {
    static let fx: [String: Any]? = {
        guard let p = ProcessInfo.processInfo.environment["SOULTIED_FIXTURES"], let data = FileManager.default.contents(atPath: p) else { return nil }
        return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    }()

    func fixtures(_ k: String) throws -> [[String: Any]] {
        guard let fx = Self.fx else { throw XCTSkip("no fixtures (set SOULTIED_FIXTURES)") }
        return fx[k] as? [[String: Any]] ?? []
    }

    func testDecks() {
        XCTAssertEqual(Cards.mismatches(), [])
        XCTAssertEqual(Cards.count, 1637)
        XCTAssertEqual(Journey.days, 30)
        XCTAssertEqual(Cards.chapters.reduce(0) { $0 + $1.days }, 30)
        XCTAssertEqual(Cards.card("tot-0")?.title, "Tea or Coffee?")
        XCTAssertEqual(Cards.card("lk-0")?.style, .likely)
        XCTAssertEqual(Cards.card("fl-0")?.kind, .flirt)
        XCTAssertNotNil(Cards.card("fl-0")?.talk)
        XCTAssertEqual(Cards.card("tk-0")?.options, ["Agree", "Disagree"])
        XCTAssertEqual(Cards.card("tk-0")?.guess, true)
    }

    /// every daily letter is five cards answered with a tap; nothing has to be typed
    func testDailyIsAllTaps() {
        for n in 0..<60 {
            let ids = Shuffle.cardsFor(.daily, coupleId: "c\(n % 7)", dateKey: Day.add("2026-11-11", n), startKey: "2026-10-01")
            let cards = Cards.of(ids)
            XCTAssertEqual(cards.count, 5)
            XCTAssertEqual(cards.map(\.kind), [.tot, .know, .likely, .flirt, .take])
            XCTAssertFalse(cards.contains { $0.style == .open })
        }
    }

    /// an open card can be saved for your call instead of typed, and both apps say what to talk about
    func testAloudAndTalk() {
        let open = Card(id: "hot-0", kind: .hot, style: .open, prompt: "Tell me", options: [])
        XCTAssertFalse(Cards.isAnswered(open, CardAnswer(pick: 0)))
        XCTAssertTrue(Cards.isAnswered(open, CardAnswer(pick: 0, aloud: true)))
        XCTAssertEqual(CardAnswer(pick: 0, aloud: true).doc["aloud"] as? Bool, true)
        XCTAssertEqual(CardAnswer(["pick": 0, "aloud": true] as Doc)?.aloud, true)
        XCTAssertEqual(talkPoint(open, CardAnswer(pick: 0, aloud: true), CardAnswer(pick: 0, text: "x"), them: "Rohan"), "Saved for your call: answer it out loud, Rohan first.")
        let take = Cards.card("tk-0")!
        XCTAssertEqual(talkPoint(take, CardAnswer(pick: 0, guess: 1), CardAnswer(pick: 1, guess: 0), them: "Rohan"), "You agree, Rohan doesn’t. One minute each to win the other over.")
        let lk = Cards.card("lk-0")!
        XCTAssertEqual(talkPoint(lk, CardAnswer(pick: 0), CardAnswer(pick: 1), them: "Rohan"), "You both say it’s you. Tell the story that proves it.")
        let fl = Cards.card("fl-0")!
        XCTAssertEqual(talkPoint(fl, CardAnswer(pick: 0), CardAnswer(pick: 2), them: "Rohan"), fl.talk)
    }

    func testHashAndRng() throws {
        for h in try fixtures("hashes") {
            XCTAssertEqual(Shuffle.hashStr(h["s"] as! String), UInt32(Values.num(h["h"])!), h["s"] as! String)
        }
        for g in try fixtures("rngSeq") {
            var r = Shuffle.Rng(UInt32(Values.num(g["seed"])!))
            // (compared as the 32-bit numbers they're made from: JSON text doesn't always round-trip a double's last bit)
            for x in g["xs"] as! [Any] { XCTAssertEqual((r.next() * 4294967296).rounded(), (Values.num(x)! * 4294967296).rounded()) }
        }
    }

    func testDays() throws {
        for d in try fixtures("days") {
            let k = d["key"] as! String
            XCTAssertEqual(Day.add(k, Int(Values.num(d["n"])!)), d["added"] as? String, k)
            XCTAssertEqual(Day.weekday(k), Int(Values.num(d["weekday"])!), k)
            XCTAssertEqual(Day.weekStart(k), d["weekStart"] as? String, k)
        }
    }

    func testCardsFor() throws {
        let all = try fixtures("cards")
        XCTAssertGreaterThan(all.count, 1000)
        var bad = 0
        for c in all {
            let got = Shuffle.cardsFor(LetterKind(rawValue: c["kind"] as! String)!, coupleId: c["coupleId"] as! String, dateKey: c["dateKey"] as! String, startKey: c["startKey"] as! String, heat: Int(Values.num(c["heat"])!))
            if got != (c["ids"] as! [String]) {
                bad += 1
                if bad < 5 { XCTFail("\(c) → \(got)") }
            }
        }
        XCTAssertEqual(bad, 0)
    }

    func state(_ s: [String: Any]) -> LettersState {
        var st = LettersState()
        for kind in LetterKind.allCases {
            for (_, v) in (s[kind.rawValue] as? [String: Any]) ?? [:] {
                var d = v as! Doc
                d["kind"] = kind.rawValue
                let (k, day) = LetterDay.parse(d)!
                st[k][day.dateKey] = day
            }
        }
        st.journeyStart = s["journeyStart"] as? String
        st.repairs = (s["repairs"] as? [String]) ?? []
        return st
    }

    func testStreaks() throws {
        for f in try fixtures("streaks") {
            var st = LettersState()
            for k in f["revealed"] as! [String] { st.daily[k] = LetterDay(dateKey: k, cardIds: [], revealedAt: k + "T21:00:00") }
            for k in f["unopened"] as! [String] { st.daily[k] = LetterDay(dateKey: k, cardIds: []) }
            st.repairs = f["repairs"] as! [String]
            let got = streakInfo(st, today: f["today"] as! String, sinceKey: f["sinceKey"] as? String)
            let want = f["out"] as! [String: Any]
            XCTAssertEqual(got.current, Int(Values.num(want["current"])!))
            XCTAssertEqual(got.best, Int(Values.num(want["best"])!))
            XCTAssertEqual(got.together, Int(Values.num(want["together"])!))
            XCTAssertEqual(got.mendable, want["mendable"] as? String)
            let wk = (want["week"] as! [[String: Any]]).map { "\($0["key"]!) \($0["label"]!) \($0["state"]!)" }
            XCTAssertEqual(got.week.map { "\($0.key) \($0.label) \($0.state.rawValue)" }, wk)
        }
    }

    func testScoresAndJourney() throws {
        for room in try fixtures("demo") {
            let st = state(room["state"] as! [String: Any])
            let today = room["today"] as! String
            let me = room["me"] as! String
            for (k, v) in room["scores"] as! [String: Any] {
                let w = v as! [String: Any]
                let day = k.hasPrefix("j") ? st.journey[k]! : st.daily[k]!
                let s = k.hasPrefix("j") ? scoreDay(day, me: "ub", them: "ua") : scoreDay(day, me: "ua", them: "ub")
                let mg = w["myGuesses"] as! [String: Any], tg = w["theirGuesses"] as! [String: Any]
                XCTAssertEqual(s.same, Int(Values.num(w["same"])!), k)
                XCTAssertEqual(s.total, Int(Values.num(w["total"])!), k)
                XCTAssertEqual(s.myGuesses.right, Int(Values.num(mg["right"])!), k)
                XCTAssertEqual(s.myGuesses.total, Int(Values.num(mg["total"])!), k)
                XCTAssertEqual(s.theirGuesses.right, Int(Values.num(tg["right"])!), k)
                XCTAssertEqual(s.talkAbout, w["talkAbout"] as? String, k)
            }
            for (k, v) in room["answered"] as! [String: Any] {
                let day = st.daily[k]!
                let got = Cards.of(day.cardIds).flatMap { c in [Cards.isAnswered(c, day.by["ua"]?.cards[c.id]), Cards.isAnswered(c, day.by["ub"]?.cards[c.id])] }
                XCTAssertEqual(got, (v as! [Any]).map { ($0 as? Bool) ?? ((Values.num($0) ?? 0) != 0) }, k)
            }
            let j = journeyInfo(st, me: me, today: today)
            let w = room["journey"] as! [String: Any]
            XCTAssertEqual(j.started, w["started"] as? Bool)
            XCTAssertEqual(j.unlocked, Int(Values.num(w["unlocked"])!))
            XCTAssertEqual(j.next, Values.num(w["next"]).map { Int($0) })
            XCTAssertEqual(j.unseen, Values.num(w["unseen"]).map { Int($0) })
            XCTAssertEqual(j.done, Int(Values.num(w["done"])!))
        }
    }

    func testSameAndChapters() throws {
        guard let same = Self.fx?["same"] as? [[Any]] else { throw XCTSkip("no fixtures") }
        let got = Cards.of(["tot-3", "lk-7", "open-2", "know-9"]).map { c in [Cards.sameAnswer(c, CardAnswer(pick: 0), CardAnswer(pick: 0)), Cards.sameAnswer(c, CardAnswer(pick: 0), CardAnswer(pick: 1))] }
        XCTAssertEqual(got, same.map { $0.map { ($0 as? Bool) ?? false } })
        for c in try fixtures("chapters") {
            let ch = Journey.chapter(Int(Values.num(c["n"])!))
            XCTAssertEqual(ch.index, Int(Values.num(c["index"])!))
            XCTAssertEqual(ch.dayInChapter, Int(Values.num(c["dayInChapter"])!))
            XCTAssertEqual(ch.last, c["last"] as? Bool)
        }
    }
}
