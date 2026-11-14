import XCTest
@testable import SoultiedCore

/// Our list: kept, ordered and tidied exactly as the website does (src/together/bucket.ts).
final class BucketTests: XCTestCase {
    private var fx: Doc? { LettersTests.fx?["buckets"] as? Doc }

    func testKeptAndOrderedTheSame() throws {
        guard let b = fx else { throw XCTSkip("no fixtures (set SOULTIED_FIXTURES)") }
        let docs = b.list("docs").compactMap { $0 as? Doc }
        XCTAssertEqual(docs.count, 4)
        for c in docs {
            let d = BucketDoc(c["raw"] as? Doc)
            let want = c.map("doc").map("items")
            XCTAssertEqual(Set(d.items.keys), Set(want.keys))
            for (id, v) in want {
                guard let e = v as? Doc, let got = d.items[id] else { continue }
                XCTAssertEqual(got.text, e.str("text"), id)
                XCTAssertEqual(got.by, e.str("by"), id)
                XCTAssertEqual(got.at, e.num("at"), id)
                XCTAssertEqual(got.next, e["next"] as? Bool, id)
                XCTAssertEqual(got.done, e.num("done"), id)
                XCTAssertEqual(got.doneBy, e.str("doneBy"), id)
            }
            let v = d.view
            XCTAssertEqual(v.todo.map(\.id), c.list("todo").compactMap { $0 as? String })
            XCTAssertEqual(v.done.map(\.id), c.list("done").compactMap { $0 as? String })
            XCTAssertEqual(d.overflow, c.list("overflow").compactMap { $0 as? String })
            let planned = c.list("planned")
            XCTAssertEqual(d.plannedLine("Goa"), planned[0] as? String)
            XCTAssertEqual(d.plannedLine(""), planned[1] as? String)
        }
    }

    func testIdeasAndTidying() throws {
        guard let b = fx else { throw XCTSkip("no fixtures (set SOULTIED_FIXTURES)") }
        XCTAssertEqual(BUCKET_IDEAS, b.list("ideas").compactMap { $0 as? String })
        for r in b.list("clean").compactMap({ $0 as? [Any] }) {
            XCTAssertEqual(cleanText(r[0] as! String), r[1] as? String)
        }
    }

    func testTheDemoList() {
        let d = BucketDoc(demoBucket(now: 1e12))
        XCTAssertEqual(d.view.todo.count, 4)
        XCTAssertEqual(d.view.done.count, 2)
        XCTAssertEqual(d.plannedLine("Goa"), "3 things planned for Goa")
        XCTAssertEqual(cleanText("  a \t b\n"), "a b")
    }
}
