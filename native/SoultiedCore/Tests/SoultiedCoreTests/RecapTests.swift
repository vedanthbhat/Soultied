import XCTest
@testable import SoultiedCore

/// Your month together, worked out exactly as the website does (src/together/recap.ts).
final class RecapTests: XCTestCase {
    func testAgainstTheWebsite() throws {
        guard let fx = LettersTests.fx?["recaps"] as? Doc else { throw XCTSkip("no fixtures (set SOULTIED_FIXTURES)") }
        let cases = fx["cases"] as! [Doc]
        XCTAssertEqual(cases.count, 24)
        for c in cases {
            let i = c.map("input")
            let input = RecapInput(
                together: i["together"] as! [String],
                letters: (i["letters"] as! [Doc]).map { ($0.str("day")!, $0["opened"] as! Bool, $0.int("same")!, $0.int("total")!) },
                photos: i["photos"] as! [String],
                notes: (i["notes"] as! [Doc]).map { ($0.str("day")!, $0["doodle"] as! Bool) }
            )
            let r = monthRecap(input, month: c.str("month")!)
            let w = c.map("recap")
            XCTAssertEqual(r.label, w.str("label"))
            XCTAssertEqual(r.days, w.int("days"), r.month)
            XCTAssertEqual(r.bestStreak, w.int("bestStreak"), r.month)
            XCTAssertEqual(r.letters, w.int("letters"), r.month)
            XCTAssertEqual(r.sync, w.int("sync"), r.month)
            XCTAssertEqual(r.photos, w.int("photos"), r.month)
            XCTAssertEqual(r.doodles, w.int("doodles"), r.month)
            XCTAssertEqual(r.notes, w.int("notes"), r.month)
        }
        for m in fx["months"] as! [[Any]] {
            let r = recapMonth(m[0] as! String)
            XCTAssertEqual(r.month, m[1] as! String)
            XCTAssertEqual(r.done, m[2] as! Bool)
        }
    }
}
