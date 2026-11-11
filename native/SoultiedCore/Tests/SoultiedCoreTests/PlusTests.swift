import XCTest
@testable import SoultiedCore

/// What Soultied Plus opens (the website's src/plus/rules.ts says the same).
final class PlusTests: XCTestCase {
    func testRules() {
        XCTAssertEqual(PlusRules.freeGames.count, 5)
        XCTAssertTrue(PlusRules.freeGames.contains(.rps))
        XCTAssertFalse(PlusRules.freeGames.contains(.coasters))
        XCTAssertEqual(PlusRules.freeRooms, [.attic])
        XCTAssertEqual(PlusRules.month("2026-11-11"), "2026-11")
        XCTAssertEqual(PlusRules.bonusKey("2026-11-11"), "plus-2026-11")
    }

    func testNights() {
        var d = PlusDoc(["nights": ["2026-11": ["2026-11-01": true, "2026-11-03": true, "2026-11-04": false], "2026-10": ["2026-10-30": true]]] as Doc)
        XCTAssertEqual(d.used("2026-11"), 2)
        XCTAssertEqual(d.used("2026-10"), 1)
        // one left this month
        XCTAssertEqual(nightCheck(d, today: "2026-11-11", plus: false), NightCheck(ok: true, left: 1, already: false))
        d.nights["2026-11", default: []].insert("2026-11-11")
        // tonight's had: carry on
        XCTAssertEqual(nightCheck(d, today: "2026-11-11", plus: false), NightCheck(ok: true, left: 0, already: true))
        // a fourth night: no, unless Plus
        XCTAssertFalse(nightCheck(d, today: "2026-11-12", plus: false).ok)
        XCTAssertTrue(nightCheck(d, today: "2026-11-12", plus: true).ok)
        // a new month starts fresh
        XCTAssertEqual(nightCheck(d, today: "2026-12-01", plus: false), NightCheck(ok: true, left: 3, already: false))
        XCTAssertEqual(PlusDoc(nil), PlusDoc())
    }
}
