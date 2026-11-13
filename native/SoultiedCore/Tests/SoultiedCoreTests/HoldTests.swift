import XCTest
@testable import SoultiedCore

/// Holding the couch: who counts as holding, judged by when their beats arrive here (src/together/hold.ts).
final class HoldTests: XCTestCase {
    func testWhoIsHolding() {
        let now = Date(timeIntervalSince1970: 1_790_000_000)
        let ms = now.timeIntervalSince1970 * 1000
        let on = HoldEntry(holding: true, beat: ms - 500)
        XCTAssertTrue(isHolding(on, seen: now.addingTimeInterval(-1), now: now))
        // their beats stopped arriving: they've gone
        XCTAssertFalse(isHolding(on, seen: now.addingTimeInterval(-3.5), now: now))
        // they let go
        XCTAssertFalse(isHolding(HoldEntry(holding: false, beat: ms), seen: now, now: now))
        // a beat from long ago (left over from before): not holding, even if it only just arrived
        XCTAssertFalse(isHolding(HoldEntry(holding: true, beat: ms - 60_000), seen: now, now: now))
        // their clock a few seconds off from ours is fine
        XCTAssertTrue(isHolding(HoldEntry(holding: true, beat: ms + 8_000), seen: now, now: now))
        XCTAssertFalse(isHolding(nil, seen: now, now: now))
        XCTAssertFalse(isHolding(on, seen: nil, now: now))
    }

    func testTheDocument() {
        let d = HoldDoc(["by": ["a": ["holding": true, "beat": 12.0], "b": ["holding": false], "c": "nope"]])
        XCTAssertEqual(d.by["a"], HoldEntry(holding: true, beat: 12))
        XCTAssertEqual(d.by["b"], HoldEntry(holding: false, beat: 0))
        XCTAssertNil(d.by["c"])
    }
}
