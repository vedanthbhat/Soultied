import XCTest
@testable import SoultiedCore

/// How far apart, and their time: kept, measured and said exactly as the website does (src/together/where.ts).
final class WhereTests: XCTestCase {
    private var fx: Doc? { LettersTests.fx?["wheres"] as? Doc }

    func testKeptTheSame() throws {
        guard let w = fx else { throw XCTSkip("no fixtures (set SOULTIED_FIXTURES)") }
        let docs = w.list("docs").compactMap { $0 as? Doc }
        XCTAssertEqual(docs.count, 7)
        for c in docs {
            let d = WhereDoc(c["raw"] as? Doc)
            let want = c.map("doc").map("by")
            XCTAssertEqual(Set(d.by.keys), Set(want.keys), "\(String(describing: c["raw"]))")
            for (uid, v) in want {
                guard let e = v as? Doc, let got = d.by[uid] else { continue }
                XCTAssertEqual(got.lat, e.num("lat"), "\(uid) lat")
                XCTAssertEqual(got.lon, e.num("lon"), "\(uid) lon")
                XCTAssertEqual(got.tz, e.str("tz"), "\(uid) tz")
                XCTAssertEqual(got.at, e.num("at"), "\(uid) at")
            }
            let km = d.apartKm(me: "a", them: "b")
            if let want = c.num("km") { XCTAssertEqual(km ?? -1, want, accuracy: 1e-6) } else { XCTAssertNil(km) }
        }
    }

    func testDistances() throws {
        guard let w = fx else { throw XCTSkip("no fixtures (set SOULTIED_FIXTURES)") }
        let rows = w.list("dists").compactMap { $0 as? [Any] }
        XCTAssertEqual(rows.count, 80)
        for r in rows {
            let n = r.compactMap { Values.num($0) }
            XCTAssertEqual(distanceKm(n[0], n[1], n[2], n[3]), n[4], accuracy: 1e-6, "\(n)")
        }
    }

    func testSaidTheSame() throws {
        guard let w = fx else { throw XCTSkip("no fixtures (set SOULTIED_FIXTURES)") }
        for r in w.list("labels").compactMap({ $0 as? [Any] }) {
            let km = Values.num(r[0])!
            XCTAssertEqual(apartLabel(km), r[1] as? String, "\(km)")
            XCTAssertEqual(apartLabel(km, miles: true), r[2] as? String, "\(km) miles")
        }
        for r in w.list("aheads").compactMap({ $0 as? [Any] }) {
            let d = Values.num(r[0])!
            XCTAssertEqual(aheadLine(d), r[1] as? String, "\(d)")
        }
    }

    func testLondonAndBengaluru() {
        let d = WhereDoc(demoWhere(now: 0))
        XCTAssertEqual(apartLabel(d.apartKm(me: Demo.me, them: Demo.them)!), "8,050 km apart")
        XCTAssertEqual(aheadLine(-330), "5½ hours behind you")
        XCTAssertEqual(zoneDiffMinutes(theirs: "Asia/Kolkata", mine: "Asia/Kolkata"), 0)
        XCTAssertNil(zoneDiffMinutes(theirs: "Nowhere/Land", mine: "UTC"))
        XCTAssertTrue(WhereDoc.isZone("America/Argentina/Buenos_Aires"))
        XCTAssertFalse(WhereDoc.isZone("Bad Zone!"))
        XCTAssertFalse(WhereDoc.isZone("/Asia"))
    }
}
