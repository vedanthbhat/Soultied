import XCTest
@testable import SoultiedCore

/// The next time you're together: kept and counted down exactly as the website does (src/together/visit.ts).
final class VisitTests: XCTestCase {
    func testAgainstTheWebsite() throws {
        guard let r = LettersTests.fx?["room"] as? Doc, let visits = r["visits"] as? [Doc] else { throw XCTSkip("no fixtures (set SOULTIED_FIXTURES)") }
        XCTAssertEqual(visits.count, 54)
        for c in visits {
            let v = VisitDoc(c["raw"] as? Doc)
            let want = c.map("doc")
            let today = c.str("today")!
            XCTAssertEqual(v.date, want.str("date"), "\(String(describing: c["raw"]))")
            XCTAssertEqual(v.what, want.str("what"), "\(String(describing: c["raw"]))")
            XCTAssertEqual(v.daysLeft(today: today), c.int("days"), "\(v.date) from \(today)")
            XCTAssertEqual(v.line(today: today), c.str("line"), "\(v.date) from \(today)")
        }
    }

    func testCountingDown() {
        let v = VisitDoc(date: "2026-03-12", what: "Goa")
        XCTAssertEqual(v.line(today: "2026-02-26"), "14 days until Goa")
        XCTAssertEqual(v.line(today: "2026-03-11"), "Tomorrow: Goa")
        XCTAssertEqual(v.line(today: "2026-03-12"), "Today: Goa")
        XCTAssertNil(v.line(today: "2026-03-13"))
        XCTAssertEqual(VisitDoc(date: "2026-03-12").line(today: "2026-03-01"), "11 days until you’re together")
        XCTAssertNil(VisitDoc().daysLeft(today: "2026-03-01"))
    }
}
