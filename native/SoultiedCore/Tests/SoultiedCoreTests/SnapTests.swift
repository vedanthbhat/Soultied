import XCTest
@testable import SoultiedCore

/// Today's photo: the same prompt as the website, kept and shown the same way (src/together/snap.ts).
final class SnapTests: XCTestCase {
    func fixtures() throws -> Doc {
        guard let d = LettersTests.fx?["snaps"] as? Doc else { throw XCTSkip("no fixtures (set SOULTIED_FIXTURES)") }
        return d
    }

    func testThePrompts() throws {
        let fx = try fixtures()
        XCTAssertEqual(fx.int("count"), SNAP_PROMPTS.count)
        let prompts = fx["prompts"] as! [[String]]
        XCTAssertEqual(prompts.count, 160)
        for p in prompts { XCTAssertEqual(snapPrompt(p[0], p[1]), p[2], "\(p[0]) \(p[1])") }
    }

    func testWhatsKeptAndWhoSeesWhat() throws {
        let fx = try fixtures()
        for d in fx["docs"] as! [Doc] {
            let doc = SnapDoc(d["raw"] as? Doc)
            let want = d.map("doc").map("by")
            XCTAssertEqual(Set(doc.by.keys), Set(want.keys), "\(String(describing: d["raw"]))")
            for (uid, w) in want {
                let w = w as! Doc
                XCTAssertEqual(doc.by[uid]?.caption, w.str("caption"))
                XCTAssertEqual(doc.by[uid]?.w, w.int("w"))
                XCTAssertEqual(doc.by[uid]?.at, w.num("at"))
            }
            for s in d["stages"] as! [[Any]] {
                XCTAssertEqual(snapStage(doc, me: s[0] as! String, them: s[1] as? String).rawValue, s[2] as! String)
            }
        }
    }
}
