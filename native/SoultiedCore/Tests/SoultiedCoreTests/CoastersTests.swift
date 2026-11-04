import XCTest
@testable import SoultiedCore

/// Coasters against the website's table (scripts/native-fixtures.ts): every touch of a coaster, a sample of the
/// host's ticks, and some shots at an open goal. The numbers are the website's to within a rounding.
final class CoastersTests: XCTestCase {
    /// the same, numbers to within `tol`
    func near(_ a: Any?, _ b: Any?, _ tol: Double = 0.0101) -> Bool {
        if let x = a as? Doc, let y = b as? Doc { return Set(x.keys) == Set(y.keys) && x.keys.allSatisfy { near(x[$0], y[$0], tol) } }
        if let x = a as? String, let y = b as? String { return x == y }
        if (a == nil || a is NSNull) && (b == nil || b is NSNull) { return true }
        if let x = Values.num(a), let y = Values.num(b) { return abs(x - y) <= tol }
        return false
    }

    func testTableMatchesTheWebsite() throws {
        guard let steps = LettersTests.fx?["coasters"] as? [Doc] else { throw XCTSkip("no fixtures (set SOULTIED_FIXTURES)") }
        XCTAssertGreaterThan(steps.count, 3000)
        let rules = Coasters()
        var bad = 0, goals = 0
        for st in steps {
            let now = Values.num(st["now"])!
            let before = try XCTUnwrap(Coasters.State(st["before"] as! Doc))
            let want = st["after"].flatMap { $0 is NSNull ? nil : $0 as? Doc }
            var got: Doc?
            if st.str("op") == "tick" {
                got = rules.tick(before, now: now)?.doc
            } else {
                let seat = Side(rawValue: st.str("seat")!)!
                let a = try XCTUnwrap(Coasters.Act(st["a"] as! Doc))
                if let b = rules.bot(before, seat, now: now), !near(b.doc, a.doc, 0.05) {
                    bad += 1
                    if bad < 5 { XCTFail("bot \(seat) at \(now): \(b.doc) want \(a.doc)") }
                }
                got = rules.act(before, seat, a, now: now)?.doc
            }
            if !near(got, want) {
                bad += 1
                if bad < 5 { XCTFail("\(st.str("op")!) at \(now): \(String(describing: got)) want \(String(describing: want))") }
            }
            if let w = want, let wd = Coasters.State(w), wd.score != before.score { goals += 1 }
        }
        XCTAssertEqual(bad, 0)
        XCTAssertEqual(goals, 4)
    }

    func testReachAndGoal() {
        XCTAssertEqual(Coasters.reach(.a, -5, 10).x, Coasters.malletR)
        XCTAssertEqual(Coasters.reach(.a, -5, 10).y, Coasters.mid + Coasters.malletR, "your own half")
        XCTAssertEqual(Coasters.reach(.b, 50, 150).y, Coasters.mid - Coasters.malletR)
        let rules = Coasters()
        var s = rules.initial({ 0.2 }, now: 0)
        XCTAssertEqual(s.puck.y, Coasters.mid + 24, "served to the bottom half")
        XCTAssertNil(rules.act(s, .a, Coasters.Act(x: 50, y: 138), now: 1), "already there")
        s.serveAt = 0
        s.puck = Coasters.Body(x: 50, y: 158, vx: 0, vy: 200)
        s.mal[.a] = Coasters.home(.b)
        let n = rules.tick(s, now: 50)!
        XCTAssertEqual(n.score[.b], 1)
        XCTAssertEqual(n.lastGoal, .b)
        XCTAssertEqual(n.puck.y, Coasters.mid + 24, "served to whoever let it in")
        XCTAssertEqual(rules.phase(n), "0-1")
        let g = Coasters.glide(Coasters.Body(x: 50, y: 150, vx: 0, vy: 300), 0.1)
        XCTAssertLessThanOrEqual(g.y, Coasters.h + Coasters.puckR, "never into a goal")
    }
}
