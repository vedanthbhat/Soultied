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
            var want = try XCTUnwrap(Match(s["after"] as? Doc))
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
            case .carrom:
                // (the numbers from their exact text: this platform's JSON reader can be a hair off)
                let ex = s["exact"] as! [String: Any]
                func d(_ k: String) -> Double { Double(ex[k] as! String)! }
                func ds(_ k: String) -> [Double] { (ex[k] as! [String]).map { Double($0)! } }
                var b = before
                var bs = Carrom.State(b.state)
                bs.xs = ds("bx")
                bs.ys = ds("by")
                b.state = bs.doc
                got = Play.carrom(b, seat, x: d("x"), dx: d("dx"), dy: d("dy"), power: d("power"))
                if let g = got {
                    let gs = Carrom.State(g.state)
                    argOK = gs.xs == ds("ax") && gs.ys == ds("ay")
                    var w = want
                    var ws = Carrom.State(w.state)
                    ws.xs = gs.xs
                    ws.ys = gs.ys
                    ws.shot = gs.shot
                    w.state = ws.doc
                    want = w
                }
            case .chess:
                let mv = Chess.botMove(Chess.State(before.state)) { r.next() }
                let a = s["arg"] as! [String: Any]
                argOK = mv.from == Int(Values.num(a["from"])!) && mv.to == Int(Values.num(a["to"])!) && mv.promo.map(String.init) == (a["promo"] as? String)
                got = Play.chess(before, seat, move: mv)
            case .ludo:
                let st = Ludo.State(before.state)
                if st.phase == "roll" {
                    let d = Ludo.rollD6 { r.next() }
                    argOK = d == Int(Values.num(s["arg"])!)
                    got = Play.ludoRoll(before, seat, dice: d)
                } else {
                    let t = Ludo.botToken(st, seat) { r.next() }
                    argOK = t == Int(Values.num(s["arg"])!)
                    got = Play.ludoMove(before, seat, token: t)
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
        XCTAssertEqual(kinds, ["fireflies", "noughts", "fence", "lanterns", "boats", "ludo", "chess", "carrom"])
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

    func testLudoRules() throws {
        // a six brings a token out onto your start square, and you roll again
        var m = Play.newLudo(.a, count: 2)
        XCTAssertNil(Play.ludoRoll(m, .b, dice: 6), "not your turn")
        let stuck = try XCTUnwrap(Play.ludoRoll(m, .a, dice: 3))
        XCTAssertEqual(stuck.turn, .b)
        XCTAssertEqual(stuck.last, "rolled a 3 but couldn’t move")
        m = try XCTUnwrap(Play.ludoRoll(m, .a, dice: 6))
        XCTAssertEqual(Ludo.State(m.state).phase, "move")
        m = try XCTUnwrap(Play.ludoMove(m, .a, token: 0))
        XCTAssertEqual(m.turn, .a)
        XCTAssertEqual(m.last, "brought a token out")
        XCTAssertEqual(Ludo.State(m.state).of(.a), [0, -1])

        // landing on theirs sends it home (but not on a star)
        var st = Ludo.State(count: 2)
        st.tokens = [.a: [10, -1], .b: [(39 + 14 - 13 + 52) % 52, -1]]
        st.phase = "move"
        st.dice = 4
        XCTAssertEqual(Ludo.trackSquare(.a, 14), Ludo.trackSquare(.b, st.of(.b)[0]))
        let hit = try XCTUnwrap(Ludo.move(st, .a, 0))
        XCTAssertEqual(hit.state.of(.b), [-1, -1])
        XCTAssertEqual(hit.state.sent, [0])
        XCTAssertEqual(hit.next, .a, "sending one back rolls again")
        XCTAssertEqual(hit.line, "sent one of yours back to the start")
        st.tokens = [.a: [4, -1], .b: [(39 + 8 - 13 + 52) % 52, -1]]
        XCTAssertTrue(Ludo.safe.contains(Ludo.trackSquare(.a, 8)!))
        let star = try XCTUnwrap(Ludo.move(st, .a, 0))
        XCTAssertNil(star.state.sent, "nobody's sent back from a star")
        XCTAssertEqual(star.next, .b)

        // exactly home, and three sixes pass the turn
        st.tokens = [.a: [53, 56], .b: [-1, -1]]
        st.dice = 3
        let won = try XCTUnwrap(Ludo.move(st, .a, 0))
        XCTAssertTrue(won.over)
        XCTAssertEqual(won.winner, "a")
        st.dice = 4
        XCTAssertNil(Ludo.move(st, .a, 0), "you need the exact roll to get home")
        var six = Ludo.State(count: 2)
        six.tokens = [.a: [5, -1], .b: [-1, -1]]
        six.sixes = 2
        XCTAssertEqual(Ludo.roll(six, .a, 6)?.next, .b)

        // the board: 52 squares round, every one different, and both paths end next to the middle
        XCTAssertEqual(Ludo.path.count, 52)
        XCTAssertEqual(Set(Ludo.path.map { $0.0 * 15 + $0.1 }).count, 52)
        XCTAssertEqual(Ludo.square(Ludo.path[39].0, Ludo.path[39].1), .start(.a))
        XCTAssertEqual(Ludo.square(10, 2), .yard(.a))
        XCTAssertEqual(Ludo.square(7, 7), .middle)
        let back = try XCTUnwrap(Match(m.doc))
        XCTAssertEqual(Ludo.State(back.state), Ludo.State(m.state))
    }

    /// a position from FEN, for the tests
    func fen(_ f: String) -> Chess.State {
        let parts = f.split(separator: " ").map(String.init)
        var board = ""
        for ch in parts[0] where ch != "/" { board += ch.isNumber ? String(repeating: ".", count: Int(String(ch))!) : String(ch) }
        var st = Chess.State(white: .a)
        st.board = Array(board.utf8)
        st.side = parts[1] == "w" ? .w : .b
        st.castling = parts[2] == "-" ? "" : parts[2]
        st.ep = parts[3] == "-" ? nil : (8 - Int(String(parts[3].last!))!) * 8 + Int(Array("abcdefgh").firstIndex(of: parts[3].first!)!)
        st.seen = []
        return st
    }

    func perft(_ st: Chess.State, _ d: Int) -> Int {
        if d == 0 { return 1 }
        var n = 0
        for mv in Chess.legalMoves(st) { n += perft(Chess.play(st, st.seat(of: st.side), mv)!.state, d - 1) }
        return n
    }

    func testChessRules() throws {
        // every legal move, counted out from known positions (the usual move-generator checks)
        XCTAssertEqual([1, 2, 3].map { perft(Chess.State(white: .a), $0) }, [20, 400, 8902])
        XCTAssertEqual([1, 2].map { perft(fen("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -"), $0) }, [48, 2039])
        XCTAssertEqual([1, 2, 3].map { perft(fen("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - -"), $0) }, [14, 191, 2812])
        XCTAssertEqual([1, 2].map { perft(fen("r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq -"), $0) }, [6, 264])

        // the quickest checkmate there is
        var m = Play.newChess(.b)
        XCTAssertEqual(Chess.State(m.state).white, .b)
        XCTAssertNil(Play.chess(m, .a, move: Chess.Move(52, 36)), "white moves first, and that's Rohan")
        for (seat, f, t) in [(Side.b, 53, 45), (.a, 12, 28), (.b, 54, 38)] { m = try XCTUnwrap(Play.chess(m, seat, move: Chess.Move(f, t))) }
        m = try XCTUnwrap(Play.chess(m, .a, move: Chess.Move(3, 39)))
        XCTAssertEqual(m.status, .over)
        XCTAssertEqual(m.winner, "a")
        XCTAssertEqual(m.last, "moved a queen to h4: checkmate")

        // castling, taking in passing, and making a pawn a queen
        let castle = try XCTUnwrap(Chess.play(fen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq -"), .a, Chess.Move(60, 62)))
        XCTAssertEqual(castle.line, "castled on the king’s side")
        XCTAssertEqual(castle.state.castling, "kq")
        XCTAssertEqual(castle.state.piece(61), "R")
        let passing = try XCTUnwrap(Chess.play(fen("4k3/8/8/3Pp3/8/8/8/4K3 w - e6"), .a, Chess.Move(27, 20)))
        XCTAssertEqual(passing.line, "took your pawn on e5 in passing")
        XCTAssertEqual(passing.state.piece(28), ".")
        let queen = try XCTUnwrap(Chess.play(fen("4k3/1P6/8/8/8/8/8/4K3 w - -"), .a, Chess.Move(9, 1, promo: "q")))
        XCTAssertEqual(queen.state.piece(1), "Q")
        XCTAssertEqual(queen.line, "made a pawn a queen on b8 and put you in check")
        XCTAssertTrue(Chess.deadPosition(fen("4k3/8/8/8/8/8/8/4KB2 w - -").board))

        // a draw offered, answered; resigning
        var g = Play.newChess(.a)
        g = try XCTUnwrap(Play.chessOffer(g, .a))
        XCTAssertTrue(Play.needsMe(g, .b))
        XCTAssertEqual(Play.note(g, who: "Aanya", me: .b), "Aanya offered a draw in Chess. Take it, or play on?")
        XCTAssertEqual(Play.shelfLine(g, kind: .chess, me: .b, name: { $0 == .a ? "Aanya" : "Rohan" }).text, "Aanya offered a draw")
        XCTAssertNil(Play.chessAnswer(g, .a, yes: true), "not your own offer")
        let no = try XCTUnwrap(Play.chessAnswer(g, .b, yes: false))
        XCTAssertNil(Chess.State(no.state).offer)
        XCTAssertEqual(try XCTUnwrap(Play.chessAnswer(g, .b, yes: true)).winner, "draw")
        let gone = try XCTUnwrap(Play.chessResign(no, .a))
        XCTAssertEqual(gone.winner, "b")
        XCTAssertEqual(Chess.State(Match(gone.doc)!.state), Chess.State(gone.state))
    }

    /// a carrom shot played out step by step comes out the same as the website's, every frame
    func testCarromPhysicsMatchesTheWebsite() throws {
        guard let shots = LettersTests.fx?["carromFrames"] as? [[String: Any]] else { throw XCTSkip("no fixtures (set SOULTIED_FIXTURES)") }
        XCTAssertEqual(shots.count, 3)
        for s in shots {
            func d(_ k: String) -> Double { Double(s[k] as! String)! }
            func ds(_ k: String) -> [Double] { (s[k] as! [String]).map { Double($0)! } }
            let seat = Side(rawValue: s["seat"] as! String)!
            let sim = Carrom.simulate(ds("bx"), ds("by"), seat, d("x"), d("dx"), d("dy"), d("power"), every: 4)
            XCTAssertEqual(sim.steps, Int(Values.num(s["steps"])!))
            let want = (s["frames"] as! [[String]]).map { $0.map { Double($0)! } }
            let got = sim.frames.enumerated().filter { $0.offset % 6 == 0 }.map(\.element)
            XCTAssertEqual(got.count, want.count)
            for (g, w) in zip(got, want) { XCTAssertEqual(g, w) }
        }
    }

    func testCarromRules() throws {
        var m = Play.newCarrom(.a)
        let st = Carrom.State(m.state)
        XCTAssertEqual(st.xs.count, 19)
        XCTAssertEqual(st.xs[0], 50)
        XCTAssertFalse(Carrom.strikerFits(st.xs, st.ys, .a, 10), "off the end of the baseline")
        XCTAssertNil(Play.carrom(m, .a, x: 50, dx: 0, dy: 1, power: 0.5), "backwards")
        XCTAssertNil(Play.carrom(m, .b, x: 50, dx: 0, dy: 1, power: 0.5), "not your turn")
        // straight up the middle, hard: the break
        m = try XCTUnwrap(Play.carrom(m, .a, x: 50, dx: 0, dy: -1, power: 1))
        let after = Carrom.State(m.state)
        XCTAssertEqual(after.shots, 1)
        XCTAssertEqual(after.shot?.xs, st.xs)
        XCTAssertNotEqual(after.xs, st.xs, "the break scatters them")
        XCTAssertEqual(Carrom.State(Match(m.doc)!.state), after)
        // a coin that comes back lands in the middle if it's free, or right next to it
        var xs = after.xs, ys = after.ys
        xs[0] = -1
        let spot = Carrom.freeSpot(xs, ys)
        for i in 0..<19 where xs[i] >= 0 { XCTAssertGreaterThanOrEqual((xs[i] - spot.0) * (xs[i] - spot.0) + (ys[i] - spot.1) * (ys[i] - spot.1), 4 * Carrom.rCoin * Carrom.rCoin - 1e-9) }
        ys[0] = 0
    }
}
