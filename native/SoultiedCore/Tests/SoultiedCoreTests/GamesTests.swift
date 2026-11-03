import XCTest
@testable import SoultiedCore

/// The games' rules and the demo room's partner, against the website's (scripts/native-fixtures.ts plays whole
/// games with the website's rules and writes down every move). A game started on a laptop and finished on a
/// phone must come out the same.
final class GamesTests: XCTestCase {
    func json(_ v: Any) -> String {
        let d = try! JSONSerialization.data(withJSONObject: ["v": v], options: [.sortedKeys, .fragmentsAllowed])
        return String(decoding: d, as: UTF8.self)
    }

    func testMovesAndPartnerMatchTheWebsite() throws {
        guard let steps = LettersTests.fx?["games"] as? [[String: Any]] else { throw XCTSkip("no fixtures (set SOULTIED_FIXTURES)") }
        XCTAssertGreaterThan(steps.count, 1000)
        var bad = 0
        var kinds = Set<String>()
        for s in steps {
            let kind = GameKind(rawValue: s["kind"] as! String)!
            kinds.insert(kind.rawValue)
            let seat = Side(rawValue: s["seat"] as! String)!
            var r = Shuffle.Rng(UInt32(Values.num(s["seed"])!))
            let before = try XCTUnwrap(Match(s["before"] as? Doc))
            let want = try XCTUnwrap(Match(s["after"] as? Doc))
            let got: Match?
            var argOK = true
            switch kind {
            case .fireflies:
                let c = Fireflies.botColumn(Fireflies.State(before.state).board, seat) { r.next() }
                argOK = c == Int(Values.num(s["arg"])!)
                got = Play.fireflies(before, seat, col: c)
            case .noughts:
                let c = Noughts.botCell(Noughts.State(before.state).board, seat) { r.next() }
                argOK = c == Int(Values.num(s["arg"])!)
                got = Play.noughts(before, seat, cell: c)
            case .fence:
                let e = Fence.botEdge(Fence.State(before.state), seat) { r.next() }
                argOK = e == Int(Values.num(s["arg"])!)
                got = Play.fence(before, seat, edge: e)
            case .lanterns:
                let c = Lanterns.botLantern(Lanterns.State(before.state).board, seat) { r.next() }
                argOK = c == Int(Values.num(s["arg"])!)
                got = Play.lanterns(before, seat, cell: c)
            case .boats:
                if before.status == .setup {
                    let fleet = Boats.randomFleet { r.next() }
                    argOK = json(fleet.map(\.doc)) == json(s["arg"]!)
                    got = Play.boatsReady(before, seat, fleet)
                } else {
                    let c = Boats.botShot(Boats.State(before.state), seat) { r.next() }
                    argOK = c == Int(Values.num(s["arg"])!)
                    got = Play.boatsShot(before, seat, cell: c)
                }
            default:
                got = nil
            }
            guard let g = got else {
                bad += 1
                if bad < 5 { XCTFail("\(kind) no move: \(s["arg"]!)") }
                continue
            }
            let same = argOK && g.status == want.status && g.turn == want.turn && g.winner == want.winner && g.last == want.last && json(g.state) == json(want.state)
            if !same {
                bad += 1
                if bad < 5 { XCTFail("\(kind) seq \(before.seq): partner picked ok=\(argOK); got \(g.status) \(String(describing: g.turn)) \(String(describing: g.winner)) “\(g.last)” \(json(g.state)) want \(want.status) \(String(describing: want.turn)) \(String(describing: want.winner)) “\(want.last)” \(json(want.state))") }
            }
        }
        XCTAssertEqual(bad, 0)
        XCTAssertEqual(kinds, ["fireflies", "noughts", "fence", "lanterns", "boats"])
    }

    func testMatchRoundTripsAndWhoseMove() throws {
        var m = Play.newNoughts(.b, wins: [.a: 2])
        XCTAssertEqual(m.turn, .b)
        XCTAssertTrue(Play.needsMe(m, .b))
        XCTAssertFalse(Play.needsMe(m, .a))
        XCTAssertNil(Play.noughts(m, .a, cell: 4), "not your move")
        m = try XCTUnwrap(Play.noughts(m, .b, cell: 4))
        XCTAssertEqual(m.last, "put a mark in the middle")
        m.seq = 1
        let back = try XCTUnwrap(Match(m.doc))
        XCTAssertEqual(back.id, m.id)
        XCTAssertEqual(back.wins[.a], 2)
        XCTAssertEqual(json(back.state), json(m.state))
        XCTAssertEqual(Play.note(back, who: "Rohan"), "Rohan put a mark in the middle in Noughts & Hearts. Your move.")

        let boats = Play.newBoats(.a)
        XCTAssertEqual(boats.status, .setup)
        XCTAssertTrue(Play.needsMe(boats, .a) && Play.needsMe(boats, .b))
        XCTAssertEqual(Play.shelfLine(boats, kind: .boats, me: .a, name: { $0 == .a ? "Aanya" : "Rohan" }).text, "Hide your boats")
        let fleet = Boats.randomFleet { Double.random(in: 0..<1) }
        XCTAssertEqual(fleet.map(\.len), Boats.fleetLengths)
        for (i, b) in fleet.enumerated() { XCTAssertTrue(Boats.canPlace(Array(fleet[..<i]), b)) }

        // a live game's invitation, from the website
        var invite = Match(kind: .tug, starter: .b, state: ["phase": "lobby", "joined": ["b": true], "seed": 5], wins: nil)
        invite.status = .setup
        invite.turn = nil
        XCTAssertTrue(Play.needsMe(invite, .a))
        XCTAssertEqual(Play.shelfLine(invite, kind: .tug, me: .a, name: { $0 == .a ? "Aanya" : "Rohan" }).text, "Rohan wants to play!")
        invite.updatedAt -= Play.liveStaleMs + 1000
        XCTAssertFalse(Play.needsMe(invite, .a), "an old invitation stops nagging")
    }

    func testLanternsOpeningAndPass() {
        let st = Lanterns.State(starter: .a)
        XCTAssertEqual(Lanterns.count(st.board, .a), 2)
        XCTAssertEqual(Lanterns.legal(st.board, .a).count, 4)
        let mv = Lanterns.light(st, .a, Lanterns.legal(st.board, .a)[0])!
        XCTAssertEqual(mv.state.flipped.count, 1)
        XCTAssertEqual(mv.next, .b)
        XCTAssertEqual(mv.line, "turned one lantern")
    }
}
