import XCTest
@testable import SoultiedCore

/// Continue watching: which tapes are on the shelf, where each carries on, the words under it and the tape's
/// own pixels, exactly as the website works them out (src/watch/tapes.ts), so a phone and a laptop agree.
final class TapesTests: XCTestCase {
    private var fx: Doc? { LettersTests.fx?["tapes"] as? Doc }

    /// a value as text, the same whichever side made it (maps sorted; whole numbers without a point)
    private func canon(_ v: Any?) -> String {
        guard let v, !(v is NSNull) else { return "null" }
        if let s = v as? String { return "\"\(s)\"" }
        if let d = v as? Doc { return "{" + d.keys.sorted().map { "\($0):\(canon(d[$0]))" }.joined(separator: ",") + "}" }
        if let a = v as? [Any] { return "[" + a.map { canon($0) }.joined(separator: ",") + "]" }
        if let n = Values.num(v) { return n == n.rounded() && abs(n) < 1e15 ? String(Int64(n)) : String(format: "%.9g", n) }
        if let b = v as? Bool { return b ? "1" : "0" }
        return "?"
    }

    private func doc(_ t: Tape) -> Doc {
        ["key": t.key, "platform": t.platform, "show": t.show, "episode": t.episode, "url": t.url, "pos": t.pos, "dur": t.dur, "at": t.at, "by": t.by]
    }

    func testShelf() throws {
        guard let f = fx else { throw XCTSkip("no fixtures (set SOULTIED_FIXTURES)") }
        let now = f.num("now")!
        let docs = f.list("docs").compactMap { $0 as? Doc }
        XCTAssertEqual(docs.count, 5)
        var n = 0
        for (i, d) in docs.enumerated() {
            for set in d.list("sets").compactMap({ $0 as? Doc }) {
                let platforms = (set["platforms"] as? [Any])?.compactMap { $0 as? String }
                let got = Tapes.from(d["raw"] as? Doc, now: now, max: set.int("max")!, platforms: platforms)
                XCTAssertEqual(canon(got.map(doc)), canon(set["tapes"]), "doc \(i) \(platforms ?? [])")
                let words = set.list("words").compactMap { $0 as? Doc }
                XCTAssertEqual(words.count, got.count)
                for (t, w) in zip(got, words) {
                    XCTAssertEqual(t.resumeURL, w.str("url"))
                    XCTAssertEqual(t.title, w.str("title"))
                    XCTAssertEqual(t.left, w.str("left"))
                    XCTAssertEqual(Tapes.who(t, me: "u1", theirName: "Rohan", now: now), w.str("whoMe"))
                    XCTAssertEqual(Tapes.who(t, me: "u2", theirName: "", now: now), w.str("whoThem"))
                    XCTAssertEqual(t.service, w.str("service"))
                    XCTAssertEqual(t.share, w.num("share")!, accuracy: 1e-12)
                    n += 1
                }
            }
        }
        XCTAssertGreaterThan(n, 10)
    }

    func testWords() throws {
        guard let f = fx else { throw XCTSkip("no fixtures (set SOULTIED_FIXTURES)") }
        let now = f.num("now")!
        for c in f.list("ago").compactMap({ $0 as? [Any] }) {
            XCTAssertEqual(Tapes.ago(now - Values.num(c[0])!, now: now), c[1] as? String, "\(c[0])")
        }
        for c in f.list("clocks").compactMap({ $0 as? [Any] }) { XCTAssertEqual(Tapes.clock(Values.num(c[0])!), c[1] as? String) }
        for c in f.list("resumes").compactMap({ $0 as? [Any] }) { XCTAssertEqual(Tapes.resumeAt(Values.num(c[0])!), Values.num(c[1])!) }
        for c in f.list("platforms").compactMap({ $0 as? [Any] }) { XCTAssertEqual(Tapes.platform(c[0] as! String), c[1] as? String) }
        for c in f.list("patches").compactMap({ $0 as? [Any] }) {
            let a = c[0] as! [Any]
            let p = Tapes.youTubePatch(id: a[0] as! String, title: a[1] as! String, pos: Values.num(a[2])!, dur: Values.num(a[3])!, by: a[4] as! String, at: Values.num(a[5])!)
            XCTAssertEqual(canon(p), canon(c[1]))
        }
        // the demo's shelf is the website's
        let demo = f.list("docs").compactMap { $0 as? Doc }[3]
        XCTAssertEqual(canon(Tapes.demo(now: now, them: "u2")), canon(demo["raw"]))
    }

    func testTapeInPixels() throws {
        guard let f = fx else { throw XCTSkip("no fixtures (set SOULTIED_FIXTURES)") }
        let sprites = f.list("sprites").compactMap { $0 as? Doc }
        XCTAssertEqual(sprites.count, 7)
        for s in sprites {
            let got = Tapes.sprite(share: s.num("share")!, platform: s.str("platform")!)
            XCTAssertEqual(got.rows, s.list("rows").compactMap { $0 as? String }, "\(s["share"] ?? "")")
            XCTAssertEqual(got.pal, (s["pal"] as? [String: String]) ?? [:])
        }
    }
}
