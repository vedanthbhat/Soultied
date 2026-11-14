import XCTest
@testable import SoultiedCore

/// Voice notes: kept, drawn and timed exactly as the website does (src/together/voice.ts).
final class VoiceTests: XCTestCase {
    private var fx: Doc? { LettersTests.fx?["voices"] as? Doc }

    func testKeptTheSame() throws {
        guard let f = fx else { throw XCTSkip("no fixtures (set SOULTIED_FIXTURES)") }
        var kept: [VoiceNote] = []
        for c in f.list("docs").compactMap({ $0 as? Doc }) {
            let id = c.str("id")!
            var raw = c["raw"] as? Doc
            if (c["long"] as? Bool) == true { raw?["audio"] = String(repeating: "A", count: VOICE_MAX_CHARS + 1) }
            let v = VoiceNote(id: id, raw)
            guard let want = c["voice"] as? Doc else {
                XCTAssertNil(v, id)
                continue
            }
            guard let v else { XCTFail("\(id) should be kept"); continue }
            kept.append(v)
            XCTAssertEqual(v.by, want.str("by"), id)
            XCTAssertEqual(v.at, want.num("at"), id)
            XCTAssertEqual(v.secs, want.num("secs"), id)
            XCTAssertEqual(v.mime, want.str("mime"), id)
            XCTAssertEqual(v.audio, want.str("audio"), id)
            XCTAssertEqual(v.peaks, want.list("peaks").compactMap { Values.num($0).map(Int.init) }, id)
            XCTAssertEqual(v.heard, want.map("heard").mapValues { Values.num($0) ?? -1 }, id)
            XCTAssertEqual(v.gone, want["gone"] as? Bool, id)
        }
        let u = f.list("unheard").map { $0 as? String }
        XCTAssertEqual(unheardVoice(kept, me: "u1", them: "u2")?.id, u[0])
        XCTAssertEqual(unheardVoice(kept, me: "u3", them: "u2")?.id, u[1])
        XCTAssertEqual(unheardVoice(kept, me: "u2", them: "u1")?.id, u[2])
        XCTAssertEqual(unheardVoice(kept, me: "u1", them: nil)?.id, u[3])
    }

    func testBarsAndLengths() throws {
        guard let f = fx else { throw XCTSkip("no fixtures (set SOULTIED_FIXTURES)") }
        for r in f.list("peaks").compactMap({ $0 as? [Any] }) {
            let levels = (r[0] as? [Any] ?? []).compactMap { Values.num($0) }
            XCTAssertEqual(peaksFrom(levels), r[1] as? String)
            XCTAssertEqual(peaksFrom(levels, bars: 8), r[2] as? String)
        }
        for r in f.list("lengths").compactMap({ $0 as? [Any] }) {
            XCTAssertEqual(voiceLength(Values.num(r[0])!), r[1] as? String)
        }
    }
}
