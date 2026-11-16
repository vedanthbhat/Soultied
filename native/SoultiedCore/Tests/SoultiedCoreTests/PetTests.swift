import XCTest
@testable import SoultiedCore

/// The pet you both raise: what's kept, how it's doing, its lines, and what looking after it writes, exactly as
/// the website works them out (src/together/pet.ts), so a phone and a laptop agree on how Biscuit is.
final class PetTests: XCTestCase {
    private var fx: Doc? { LettersTests.fx?["pet"] as? Doc }

    /// a value as text, the same whichever side made it (maps sorted; true and 1 read alike, as JSON on Linux
    /// can't tell them apart)
    private func canon(_ v: Any?) -> String {
        guard let v, !(v is NSNull) else { return "null" }
        if let s = v as? String { return "\"\(s)\"" }
        if let d = v as? Doc { return "{" + d.keys.sorted().map { "\($0):\(canon(d[$0]))" }.joined(separator: ",") + "}" }
        if let a = v as? [Any] { return "[" + a.map { canon($0) }.joined(separator: ",") + "]" }
        if let n = Values.num(v) { return n == n.rounded() && abs(n) < 1e15 ? String(Int64(n)) : "\(n)" }
        if let b = v as? Bool { return b ? "1" : "0" }
        return "?"
    }

    private func care(_ c: PetCare) -> Doc { Dictionary(uniqueKeysWithValues: c.map { ($0.key.rawValue, $0.value as Any) }) }

    private func viewDoc(_ v: PetView) -> Doc {
        [
            "mine": care(v.mine), "theirs": care(v.theirs), "fed": v.fed, "played": v.played, "cuddled": v.cuddled,
            "mood": v.mood.rawValue, "bond": v.bond, "level": v.level, "toNext": v.toNext,
            "week": v.week.map { ["day": $0.day, "me": $0.me, "them": $0.them, "both": $0.both] as Doc },
        ]
    }

    func testLookingAfterIt() throws {
        guard let p = fx else { throw XCTSkip("no fixtures (set SOULTIED_FIXTURES)") }
        let docs = p.list("docs").compactMap { $0 as? Doc }
        XCTAssertEqual(docs.count, 7)
        var n = 0
        for (i, c) in docs.enumerated() {
            let d = PetDoc(c["raw"] as? Doc)
            XCTAssertEqual(canon(d.doc), canon(c["doc"]), "doc \(i)")
            for k in c.list("cases").compactMap({ $0 as? Doc }) {
                let today = k.str("today")!, me = k.str("me")!, them = k.str("them")
                let what = "doc \(i), \(today), \(me)/\(them ?? "-")"
                let v = d.view(today: today, me: me, them: them)
                XCTAssertEqual(canon(viewDoc(v)), canon(k["view"]), what)
                let cs = v.careState, want = k.map("care")
                XCTAssertEqual(cs, PetCareState(fed: want.bool("fed"), played: want.bool("played"), cuddled: want.bool("cuddled"), both: want.bool("both"), waiting: want.bool("waiting"), level: want.int("level")!), what)
                let lines = k.list("lines").compactMap { $0 as? String }
                XCTAssertEqual(Pet.line(v, name: "Biscuit", theirName: them == nil ? nil : "Rohan"), lines[0], what)
                XCTAssertEqual(Pet.line(v, name: "your ginger cat", theirName: them == nil ? nil : "Rohan"), lines[1], what)
                let patches = k.list("patches")
                for (j, act) in PetAct.allCases.enumerated() {
                    let got = d.carePatch(today: today, me: me, them: them, act: act, now: 1_794_994_200_000.4)
                    XCTAssertEqual(canon(got), canon(patches[j]), "\(what) \(act)")
                }
                XCTAssertEqual(canon(d.missingDays(me: me, them: them)), canon(k["missing"]), what)
                n += 1
            }
        }
        XCTAssertEqual(n, 84)
    }

    func testWords() throws {
        guard let p = fx else { throw XCTSkip("no fixtures (set SOULTIED_FIXTURES)") }
        for l in p.list("levels").compactMap({ $0 as? [Any] }) {
            let want = l[1] as! Doc
            let got = Pet.level(Int(Values.num(l[0])!))
            XCTAssertEqual(got.level, want.int("level"))
            XCTAssertEqual(got.toNext, want.int("toNext"))
        }
        for r in p.list("reactions").compactMap({ $0 as? [Any] }) {
            let act = PetAct(rawValue: r[0] as! String)!
            XCTAssertEqual(Pet.reaction(act, name: "Biscuit"), r[1] as? String)
            XCTAssertEqual(Pet.reaction(act, name: "your duckling"), r[2] as? String)
        }
        for u in p.list("levelUps").compactMap({ $0 as? [Any] }) {
            XCTAssertEqual(Pet.levelUp(Int(Values.num(u[0])!), name: "Biscuit"), u[1] as? String)
        }
    }

    /// the demo room's Biscuit: Loyal, five more days to Best friend, and Rohan's been by this morning
    func testDemo() {
        let today = "2026-11-18"
        let d = PetDoc.demo(today: today, now: 1_794_994_200_000)
        let v = d.view(today: today, me: Demo.me, them: Demo.them)
        XCTAssertEqual(v.bond, 9)
        XCTAssertEqual(v.levelName, "Loyal")
        XCTAssertEqual(v.toNext, 5)
        XCTAssertEqual(v.mood, .waiting)
        XCTAssertTrue(v.fed && v.played && !v.cuddled)
        XCTAssertEqual(Pet.line(v, name: "Biscuit", theirName: "Rohan"), "Rohan fed and played with Biscuit today. Your turn.")
        // and it round-trips through the database
        XCTAssertEqual(PetDoc(d.doc), d)
    }

    /// looking after it in a place: the bowl fills, it's a day you both did, and that's ten stitches
    func testInAPlace() throws {
        let db = MemoryBackend(synchronous: true)
        let sid = "space-x"
        db.seed("spaces/\(sid)", ["id": sid, "creatorId": "a", "partnerId": "b", "members": ["a", "b"], "name": "Ours", "createdAt": "2026-10-01T00:00:00.000Z"])
        db.seed("spaces/\(sid)/members/a", MemberDoc(name: "Aanya", avatar: Wardrobe.defaultA, lastActive: Values.isoNow()).doc)
        db.seed("spaces/\(sid)/members/b", MemberDoc(name: "Rohan", avatar: Wardrobe.defaultB, lastActive: Values.isoNow()).doc)
        let today = Day.today()
        db.seed("spaces/\(sid)/meta/couch", ["seen": ["a": today, "b": today], "together": [today]])
        db.seed("spaces/\(sid)/meta/decor", ["earned": ["welcome": 60], "bought": Doc(), "placed": Doc(), "petNames": ["ginger": "Biscuit"]])
        db.seed("spaces/\(sid)/meta/pet", ["care": [today: ["b": ["feed": Values.nowMs() - 1000]]]])
        let m = PlaceModel(db: db, sid: sid, me: "a")
        m.start()
        defer { m.stop() }
        let up = expectation(description: "loaded")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { up.fulfill() }
        wait(for: [up], timeout: 2)
        XCTAssertEqual(m.petView?.mood, .waiting)
        XCTAssertNil(m.decorDoc.earned[DecorDoc.earnPet(today)])
        let r = m.carePet(.cuddle)
        XCTAssertEqual(r?.reaction, "Biscuit snuggled right in.")
        XCTAssertNil(r?.levelUp)
        XCTAssertNil(m.carePet(.cuddle), "once a day")
        let done = expectation(description: "cared")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { done.fulfill() }
        wait(for: [done], timeout: 2)
        XCTAssertEqual(m.petView?.mood, .both)
        XCTAssertEqual(m.petDoc.bond, 1)
        XCTAssertEqual(db.snapshot("spaces/\(sid)/meta/pet")?.map("days")[today] as? Bool, true)
        XCTAssertEqual(m.decorDoc.earned[DecorDoc.earnPet(today)], 10)
    }
}
