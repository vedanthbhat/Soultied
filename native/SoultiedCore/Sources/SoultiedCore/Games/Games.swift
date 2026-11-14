import Foundation

/*
 * Games for two (src/games/types.ts and registry.ts). Each game keeps one "match" document,
 * spaces/{id}/meta/game-{kind}: whose move it is, the board, and a running tally of wins. The games
 * you take turns at live entirely in that document, so you can take your turn hours after your person
 * took theirs, on the website or on the iPhone.
 */

/// which side of a game you are: "a" is whoever made the place, "b" the person who joined (as on the couch)
public enum Side: String, Sendable, Hashable, CaseIterable {
    case a, b
    public var other: Side { self == .a ? .b : .a }
}

public enum GameKind: String, CaseIterable, Sendable, Identifiable {
    case fireflies, boats, doodle, noughts, fence, lanterns, tug, quickdraw, rps, coasters, kitchen, ludo, chess, carrom
    public var id: String { rawValue }
    public var info: GameInfo { GAMES[self]! }
    public var docName: String { "game-\(rawValue)" }
}

public enum GameMode: Sendable { case turns, live }

public struct GameInfo: Sendable {
    public let kind: GameKind
    public let name: String
    public let tagline: String
    /// how it's played, shown on the box
    public let style: String
    public let mode: GameMode
}

public let GAMES: [GameKind: GameInfo] = {
    let all: [GameInfo] = [
        GameInfo(kind: .fireflies, name: "Fireflies", tagline: "Drop fireflies into the jar. Four in a row, any direction, wins.", style: "Take turns", mode: .turns),
        GameInfo(kind: .boats, name: "Paper Boats", tagline: "Hide four paper boats on your pond, then take turns guessing where theirs are.", style: "Take turns", mode: .turns),
        GameInfo(kind: .doodle, name: "Doodle Guess", tagline: "One draws on a little pixel canvas, the other guesses. Then swap. Six drawings, scored together.", style: "Live, together", mode: .live),
        GameInfo(kind: .noughts, name: "Noughts & Hearts", tagline: "Three in a row on a little board. Best of five, and whoever went second starts the next one.", style: "Take turns", mode: .turns),
        GameInfo(kind: .fence, name: "Fence the Garden", tagline: "Take turns adding a bit of fence. Close a bed and it’s yours, and you go again. Most beds wins.", style: "Take turns", mode: .turns),
        GameInfo(kind: .lanterns, name: "Lanterns", tagline: "Light a lantern to trap theirs in a line, and they all turn your colour. Most lanterns at the end wins.", style: "Take turns", mode: .turns),
        GameInfo(kind: .tug, name: "Tug of War", tagline: "Tap as fast as you can to pull the ribbon over to your side. Twenty seconds, no mercy.", style: "Live", mode: .live),
        GameInfo(kind: .quickdraw, name: "Quick Draw", tagline: "Wait for the lantern to light, then tap. Quickest wins the round; tap too soon and you lose it. First to three.", style: "Live", mode: .live),
        GameInfo(kind: .rps, name: "Paper, Scissors, Stone", tagline: "Pick before the timer runs out, and see what they picked. First to three rounds.", style: "Live", mode: .live),
        GameInfo(kind: .coasters, name: "Coasters", tagline: "Air hockey on the coffee table with two drink coasters and a bottle cap. First to 7.", style: "Live", mode: .live),
        GameInfo(kind: .kitchen, name: "Kitchen Rush", tagline: "One of you chops, the other cooks, and the orders keep coming. Ninety seconds, on the same side.", style: "Together, live", mode: .live),
        GameInfo(kind: .ludo, name: "Ludo", tagline: "Roll the die and race your tokens round the board and home. Land on one of theirs and it goes back to the start.", style: "Take turns", mode: .turns),
        GameInfo(kind: .chess, name: "Chess", tagline: "Proper chess, a move whenever you’re here. Whoever starts plays white; offer a draw, or play it out to checkmate.", style: "Take turns", mode: .turns),
        GameInfo(kind: .carrom, name: "Carrom", tagline: "Flick the striker and sink your nine before they sink theirs. Sink one and you go again; the red queen needs covering.", style: "Take turns", mode: .turns),
    ]
    return Dictionary(uniqueKeysWithValues: all.map { ($0.kind, $0) })
}()

/// the games you take turns at, in the order the shelf shows them
public let TURN_GAMES: [GameKind] = [.fireflies, .boats, .noughts, .fence, .lanterns, .ludo, .chess, .carrom]
/// the games you play at the same moment
public let LIVE_GAMES: [GameKind] = [.tug, .quickdraw, .rps, .doodle, .coasters, .kitchen]

public enum MatchStatus: String, Sendable { case setup, playing, over }

/// One game of something, as the website keeps it. `state` is the game's own board (see TurnGames.swift).
public struct Match: @unchecked Sendable {
    public var kind: GameKind
    /// a new id every game, so a rematch is never mistaken for the last one
    public var id: String
    public var status: MatchStatus
    /// whose move it is (nil while setting up, and once it's over)
    public var turn: Side?
    /// "a", "b", "draw", or nil
    public var winner: String?
    public var startedBy: Side
    public var startedAt: Double
    public var updatedAt: Double
    public var updatedBy: Side
    /// goes up by one with every move
    public var seq: Int
    public var state: Doc
    /// wins so far, across every game of this kind
    public var wins: [Side: Int]
    /// a short line about the last thing that happened, e.g. "dropped a firefly in the middle"
    public var last: String

    public init(kind: GameKind, starter: Side, state: Doc, wins: [Side: Int]?, now: Double = Values.nowMs()) {
        self.kind = kind
        id = Match.newId()
        status = .playing
        turn = starter
        winner = nil
        startedBy = starter
        startedAt = now
        updatedAt = now
        updatedBy = starter
        seq = 0
        self.state = state
        self.wins = [.a: wins?[.a] ?? 0, .b: wins?[.b] ?? 0]
        last = "started a game"
    }

    public init?(_ d: Doc?) {
        guard let d, let k = d.str("kind").flatMap({ GameKind(rawValue: $0) }), let id = d.str("id") else { return nil }
        kind = k
        self.id = id
        status = MatchStatus(rawValue: d.str("status") ?? "") ?? .over
        turn = d.str("turn").flatMap { Side(rawValue: $0) }
        winner = d.str("winner")
        startedBy = Side(rawValue: d.str("startedBy") ?? "") ?? .a
        startedAt = d.num("startedAt") ?? 0
        updatedAt = d.num("updatedAt") ?? 0
        updatedBy = Side(rawValue: d.str("updatedBy") ?? "") ?? .a
        seq = d.int("seq") ?? 0
        state = d.map("state")
        let w = d.map("wins")
        wins = [.a: w.int("a") ?? 0, .b: w.int("b") ?? 0]
        last = d.str("last") ?? ""
    }

    public var doc: Doc {
        ["kind": kind.rawValue, "id": id, "status": status.rawValue, "turn": turn?.rawValue as Any? ?? NSNull(), "winner": winner as Any? ?? NSNull(),
         "startedBy": startedBy.rawValue, "startedAt": startedAt, "updatedAt": updatedAt, "updatedBy": updatedBy.rawValue, "seq": seq,
         "state": state, "wins": ["a": wins[.a] ?? 0, "b": wins[.b] ?? 0], "last": last]
    }

    /// m + base-36 time + four random letters, as the website makes them
    public static func newId(_ now: Double = Values.nowMs()) -> String {
        let chars = Array("0123456789abcdefghijklmnopqrstuvwxyz")
        return "m" + String(Int(now), radix: 36) + String((0..<4).map { _ in chars.randomElement()! })
    }

    public var winnerSeat: Side? { winner.flatMap { Side(rawValue: $0) } }
}

/* ---------- the moves of each game, from one match to the next ---------- */

public enum Play {
    /* Fireflies */
    public static func newFireflies(_ starter: Side, wins: [Side: Int]? = nil) -> Match {
        Match(kind: .fireflies, starter: starter, state: Fireflies.State().doc, wins: wins)
    }

    public static func fireflies(_ m: Match, _ seat: Side, col: Int) -> Match? {
        guard m.status == .playing, m.turn == seat else { return nil }
        let st = Fireflies.State(m.state)
        guard let d = Fireflies.drop(st.board, col, seat) else { return nil }
        let line = Fireflies.findLine(d.board)
        let over = line != nil || Fireflies.isFull(d.board)
        var n = m
        n.state = Fireflies.State(board: d.board, lastCell: d.cell, line: line?.cells).doc
        n.status = over ? .over : .playing
        n.turn = over ? nil : seat.other
        n.winner = line.map { $0.seat.rawValue } ?? (over ? "draw" : nil)
        n.last = line != nil ? "lined up four fireflies" : over ? "filled the jar, so it’s a draw" : "dropped a firefly \(Fireflies.columnPlace(col))"
        return n
    }

    /* Paper Boats */
    public static func newBoats(_ starter: Side, wins: [Side: Int]? = nil) -> Match {
        var m = Match(kind: .boats, starter: starter, state: Boats.State().doc, wins: wins)
        m.status = .setup
        m.turn = nil
        return m
    }

    public static func boatsReady(_ m: Match, _ seat: Side, _ fleet: [Boats.Boat]) -> Match? {
        var st = Boats.State(m.state)
        guard m.status == .setup, st.fleets[seat] == nil else { return nil }
        st.fleets[seat] = fleet
        let both = st.fleets[.a] != nil && st.fleets[.b] != nil
        var n = m
        n.state = st.doc
        n.status = both ? .playing : .setup
        // whoever hides their boats second is here right now, so they go first
        n.turn = both ? seat : nil
        n.last = "hid their boats"
        return n
    }

    public static func boatsShot(_ m: Match, _ seat: Side, cell: Int) -> Match? {
        guard m.status == .playing, m.turn == seat, let r = Boats.shoot(Boats.State(m.state), seat, cell) else { return nil }
        let at = Boats.coordName(cell)
        var n = m
        n.state = r.state.doc
        n.status = r.allSunk ? .over : .playing
        n.turn = r.allSunk ? nil : seat.other
        n.winner = r.allSunk ? seat.rawValue : nil
        n.last = r.allSunk ? "sank the last boat at \(at)" : r.sunk.map { "sank \(Boats.boatName($0)) at \(at)" } ?? (r.hit ? "hit a boat at \(at)" : "guessed \(at): just water")
        return n
    }

    /* Noughts & Hearts */
    public static func newNoughts(_ starter: Side, wins: [Side: Int]? = nil) -> Match {
        Match(kind: .noughts, starter: starter, state: Noughts.State(opener: starter).doc, wins: wins)
    }

    public static func noughts(_ m: Match, _ seat: Side, cell: Int) -> Match? {
        guard m.status == .playing, m.turn == seat, let mv = Noughts.placeMark(Noughts.State(m.state), seat, cell) else { return nil }
        var n = m
        n.state = mv.state.doc
        n.status = mv.over ? .over : .playing
        n.turn = mv.next
        n.winner = mv.winner
        n.last = mv.line
        return n
    }

    /* Fence the Garden */
    public static func newFence(_ starter: Side, wins: [Side: Int]? = nil) -> Match {
        Match(kind: .fence, starter: starter, state: Fence.State().doc, wins: wins)
    }

    public static func fence(_ m: Match, _ seat: Side, edge: Int) -> Match? {
        guard m.status == .playing, m.turn == seat, let mv = Fence.build(Fence.State(m.state), seat, edge) else { return nil }
        var n = m
        n.state = mv.state.doc
        n.status = mv.over ? .over : .playing
        n.turn = Fence.next(seat, mv)
        n.winner = mv.winner
        n.last = mv.line
        return n
    }

    /* Lanterns */
    public static func newLanterns(_ starter: Side, wins: [Side: Int]? = nil) -> Match {
        Match(kind: .lanterns, starter: starter, state: Lanterns.State(starter: starter).doc, wins: wins)
    }

    public static func lanterns(_ m: Match, _ seat: Side, cell: Int) -> Match? {
        guard m.status == .playing, m.turn == seat, let mv = Lanterns.light(Lanterns.State(m.state), seat, cell) else { return nil }
        var n = m
        n.state = mv.state.doc
        n.status = mv.over ? .over : .playing
        n.turn = mv.next
        n.winner = mv.winner
        n.last = mv.line
        return n
    }

    /* Ludo */
    /// a quick game (two tokens each) or a full one (four)
    public static func newLudo(_ starter: Side, wins: [Side: Int]? = nil, count: Int = 4) -> Match {
        Match(kind: .ludo, starter: starter, state: Ludo.State(count: count).doc, wins: wins)
    }

    private static func ludoStep(_ m: Match, _ s: Ludo.Step?) -> Match? {
        guard let s else { return nil }
        var n = m
        n.state = s.state.doc
        n.status = s.over ? .over : .playing
        n.turn = s.next
        n.winner = s.winner
        n.last = s.line
        return n
    }

    public static func ludoRoll(_ m: Match, _ seat: Side, dice: Int) -> Match? {
        guard m.status == .playing, m.turn == seat else { return nil }
        return ludoStep(m, Ludo.roll(Ludo.State(m.state), seat, dice))
    }

    public static func ludoMove(_ m: Match, _ seat: Side, token: Int) -> Match? {
        guard m.status == .playing, m.turn == seat else { return nil }
        return ludoStep(m, Ludo.move(Ludo.State(m.state), seat, token))
    }

    /* Chess */
    /// whoever starts plays white
    public static func newChess(_ starter: Side, wins: [Side: Int]? = nil) -> Match {
        Match(kind: .chess, starter: starter, state: Chess.State(white: starter).doc, wins: wins)
    }

    public static func chess(_ m: Match, _ seat: Side, move: Chess.Move) -> Match? {
        guard m.status == .playing, m.turn == seat, let s = Chess.play(Chess.State(m.state), seat, move) else { return nil }
        var n = m
        n.state = s.state.doc
        n.status = s.over ? .over : .playing
        n.turn = s.next
        n.winner = s.winner
        n.last = s.line
        return n
    }

    /// offer a draw (on your move or theirs); it stands until they answer or someone moves
    public static func chessOffer(_ m: Match, _ seat: Side) -> Match? {
        var st = Chess.State(m.state)
        guard m.status == .playing, st.offer == nil else { return nil }
        st.offer = seat
        var n = m
        n.state = st.doc
        n.last = "offered a draw"
        return n
    }

    public static func chessAnswer(_ m: Match, _ seat: Side, yes: Bool) -> Match? {
        var st = Chess.State(m.state)
        guard m.status == .playing, st.offer == seat.other else { return nil }
        st.offer = nil
        var n = m
        if !yes {
            n.state = st.doc
            n.last = "said no to a draw, so play on"
            return n
        }
        st.end = "agreed"
        n.state = st.doc
        n.status = .over
        n.turn = nil
        n.winner = "draw"
        n.last = "agreed to a draw"
        return n
    }

    public static func chessResign(_ m: Match, _ seat: Side) -> Match? {
        guard m.status == .playing else { return nil }
        var st = Chess.State(m.state)
        st.offer = nil
        st.end = "resigned"
        var n = m
        n.state = st.doc
        n.status = .over
        n.turn = nil
        n.winner = seat.other.rawValue
        n.last = "resigned"
        return n
    }

    /* Carrom */
    /// whoever starts plays white
    public static func newCarrom(_ starter: Side, wins: [Side: Int]? = nil) -> Match {
        Match(kind: .carrom, starter: starter, state: Carrom.State(white: starter).doc, wins: wins)
    }

    public static func carrom(_ m: Match, _ seat: Side, x: Double, dx: Double, dy: Double, power: Double) -> Match? {
        guard m.status == .playing, m.turn == seat, let s = Carrom.shoot(Carrom.State(m.state), seat, x: x, dx: dx, dy: dy, power: power) else { return nil }
        var n = m
        n.state = s.state.doc
        n.status = s.over ? .over : .playing
        n.turn = s.next
        n.winner = s.winner?.rawValue
        n.last = s.line
        return n
    }

    /// a draw your person offered at chess, waiting on you
    public static func chessOfferFor(_ m: Match?, _ seat: Side) -> Bool {
        guard let m, m.kind == .chess, m.status == .playing else { return false }
        return Chess.State(m.state).offer == seat.other
    }

    /// a fresh game of `kind`: the person who didn't start the last one goes first
    public static func rematch(_ kind: GameKind, me: Side, last: Match?) -> Match? {
        let starter = kind == .fireflies || kind == .boats ? me : (last.map { $0.status == .over ? $0.startedBy.other : me } ?? me)
        let w = last?.wins
        switch kind {
        case .fireflies: return newFireflies(starter, wins: w)
        case .boats: return newBoats(starter, wins: w)
        case .noughts: return newNoughts(starter, wins: w)
        case .fence: return newFence(starter, wins: w)
        case .lanterns: return newLanterns(starter, wins: w)
        case .ludo: return newLudo(starter, wins: w, count: last.map { Ludo.State($0.state).count } ?? 4)
        case .chess: return newChess(starter, wins: w)
        case .carrom: return newCarrom(starter, wins: w)
        default: return nil
        }
    }

    /* ---------- live games: the invitation and the result (the game itself goes over the live line: see Live.swift) ---------- */

    /// an invitation nobody answered, or a game nobody finished, is forgotten after this long
    public static let liveStaleMs: Double = 15 * 60 * 1000
    /// a Doodle Guess nobody's touched for a while
    public static let doodleStaleMs: Double = 30 * 60 * 1000

    public static func isLiveInvite(_ kind: GameKind) -> Bool { kind.info.mode == .live && kind != .doodle }

    /// the games the iPhone plays itself (all of them; a game missing here would send you to soultied.app)
    public static let onIPhone: Set<GameKind> = Set(GameKind.allCases)

    public static func stale(_ m: Match, now: Double = Values.nowMs()) -> Bool {
        guard m.status != .over else { return false }
        if isLiveInvite(m.kind) { return now - m.updatedAt > liveStaleMs }
        if m.kind == .doodle { return now - m.updatedAt > doodleStaleMs }
        return false
    }

    /* ---------- what each game needs from whom ---------- */

    public static func needsMe(_ m: Match?, _ seat: Side, now: Double = Values.nowMs()) -> Bool {
        guard let m else { return false }
        if isLiveInvite(m.kind) {
            return m.status == .setup && !stale(m, now: now) && !m.state.map("joined").bool(seat.rawValue)
        }
        if m.kind == .doodle {
            if m.status == .over || stale(m, now: now) { return false }
            let phase = m.state.str("phase") ?? ""
            let drawer = m.state.str("drawer").flatMap { Side(rawValue: $0) }
            if phase == "lobby" { return !m.state.map("joined").bool(seat.rawValue) }
            if phase == "choosing" { return drawer == seat }
            if phase == "drawing" { return drawer != seat && (m.state.num("endsAt") ?? 0) > now }
            return false
        }
        if chessOfferFor(m, seat) { return true }
        if m.status == .playing { return m.turn == seat }
        if m.status == .setup && m.kind == .boats { return Boats.State(m.state).fleets[seat] == nil }
        return false
    }

    /// the line for the little note in the room, e.g. "Rohan dropped a firefly in the middle in Fireflies. Your move."
    public static func note(_ m: Match, who: String, me: Side? = nil) -> String {
        let game = m.kind.info.name
        if isLiveInvite(m.kind) { return "\(who) wants to play \(game) with you, right now. Join them\(onIPhone.contains(m.kind) ? "" : " on soultied.app")?" }
        if m.kind == .doodle {
            switch m.state.str("phase") {
            case "lobby": return "\(who) wants to play \(game). Join them?"
            case "drawing": return "\(who) is drawing something in \(game). Come and guess!"
            default: return "It’s your turn to draw in \(game)."
            }
        }
        if let me, chessOfferFor(m, me) { return "\(who) offered a draw in \(game). Take it, or play on?" }
        if m.status == .setup { return "\(who) started \(game). Hide your boats!" }
        if m.seq == 0 { return "\(who) started a game of \(game). Your move." }
        return "\(who) \(m.last) in \(game). Your move."
    }

    /// short words for the games on the shelf, and whether it's waiting on you
    public static func shelfLine(_ m: Match?, kind: GameKind, me: Side, name: (Side) -> String, now: Double = Values.nowMs()) -> (text: String, hot: Bool) {
        let partner = name(me.other)
        if kind == .doodle {
            guard let d = m, d.status != .over, !stale(d, now: now) else {
                let best = m?.state.int("best") ?? 0
                return (best > 0 ? "Your best: \(best) of 6" : "Start a game", false)
            }
            let phase = d.state.str("phase") ?? ""
            if needsMe(d, me, now: now) { return (phase == "lobby" ? "\(partner) is waiting for you" : phase == "drawing" ? "\(partner) is drawing: guess!" : "Your turn to draw", true) }
            return (phase == "lobby" ? "Waiting for \(partner)" : "Playing now", false)
        }
        if isLiveInvite(kind) {
            if let l = m, !stale(l, now: now), l.status == .setup {
                return needsMe(l, me, now: now) ? ("\(partner) wants to play!", true) : ("Waiting for \(partner) to join", false)
            }
            if let l = m, !stale(l, now: now), l.status == .playing { return ("Playing now", false) }
            guard let l = m, l.status == .over, let w = l.winner else { return ("Invite \(partner)", false) }
            return (w == "draw" ? "Last game: a draw" : "\(name(Side(rawValue: w) ?? .a)) won last time", false)
        }
        guard let m else { return ("Start a game", false) }
        if chessOfferFor(m, me) { return ("\(partner) offered a draw", true) }
        if needsMe(m, me, now: now) { return (m.status == .setup ? "Hide your boats" : "Your move", true) }
        if m.status == .setup { return ("\(partner) is hiding boats", false) }
        if m.status == .playing { return ("\(partner)’s move", false) }
        return (m.winner == "draw" ? "Last game: a draw" : "\(name(m.winnerSeat ?? .a)) won last time", false)
    }

    /// for the activity feed, once a game is over
    public static func endLine(_ m: Match, name: (Side) -> String) -> String {
        let game = m.kind.info.name
        if isLiveInvite(m.kind) && m.winner == nil { return "" }
        if m.kind == .kitchen {
            guard let line = m.state.map("result").str("line"), let first = line.first else { return "" }
            return "\(first.uppercased())\(line.dropFirst()) at \(game)."
        }
        if m.kind == .doodle {
            let n = m.state.list("rounds").filter { (($0 as? Doc)?["secs"]).map { !($0 is NSNull) } ?? false }.count
            return "Guessed \(n) of 6 drawings together at \(game)."
        }
        return m.winner == "draw" ? "A draw at \(game)." : "\(name(m.winnerSeat ?? .a)) won at \(game)."
    }

    /* ---------- the demo room's partner ---------- */

    /// the pretend partner's move, if it has one to make
    public static func botAct(_ m: Match, _ bot: Side, _ rng: Random = { Double.random(in: 0..<1) }) -> Match? {
        if isLiveInvite(m.kind) { return m.status == .setup ? liveJoin(m, bot) : nil }
        switch m.kind {
        case .noughts:
            guard m.status == .playing, m.turn == bot else { return nil }
            return noughts(m, bot, cell: Noughts.botCell(Noughts.State(m.state).board, bot, rng))
        case .fence:
            guard m.status == .playing, m.turn == bot else { return nil }
            return fence(m, bot, edge: Fence.botEdge(Fence.State(m.state), bot, rng))
        case .lanterns:
            guard m.status == .playing, m.turn == bot else { return nil }
            return lanterns(m, bot, cell: Lanterns.botLantern(Lanterns.State(m.state).board, bot, rng))
        case .fireflies:
            guard m.status == .playing, m.turn == bot else { return nil }
            return fireflies(m, bot, col: Fireflies.botColumn(Fireflies.State(m.state).board, bot, rng))
        case .boats:
            let st = Boats.State(m.state)
            if m.status == .setup && st.fleets[bot] == nil { return boatsReady(m, bot, Boats.randomFleet(rng)) }
            if m.status == .playing && m.turn == bot { return boatsShot(m, bot, cell: Boats.botShot(st, bot, rng)) }
            return nil
        case .carrom:
            guard m.status == .playing, m.turn == bot else { return nil }
            let s = Carrom.botShot(Carrom.State(m.state), bot, rng)
            return carrom(m, bot, x: s.x, dx: s.dx, dy: s.dy, power: s.power)
        case .chess:
            guard m.status == .playing else { return nil }
            let st = Chess.State(m.state)
            // a draw: yes when it's behind
            if st.offer == bot.other { return chessAnswer(m, bot, yes: Chess.evaluate(st.board, st.color(of: bot)) < -150) }
            return m.turn == bot ? chess(m, bot, move: Chess.botMove(st, rng)) : nil
        case .ludo:
            guard m.status == .playing, m.turn == bot else { return nil }
            let st = Ludo.State(m.state)
            return st.phase == "roll" ? ludoRoll(m, bot, dice: Ludo.rollD6(rng)) : ludoMove(m, bot, token: Ludo.botToken(st, bot, rng))
        case .doodle:
            return doodleBot(m, bot, rng)
        default:
            return nil
        }
    }

    /// how long the pretend partner thinks, in seconds
    public static func botDelay(_ m: Match) -> Double {
        if m.kind == .doodle {
            let phase = m.state.str("phase")
            if phase == "drawing" { return 7 + Double.random(in: 0..<7) }
            if phase == "reveal" { return 5 }
            return 1.5
        }
        if isLiveInvite(m.kind) { return 1.4 }
        if m.kind == .boats && m.status == .setup { return 0.9 }
        // (after the last shot has rolled to a stop)
        if m.kind == .carrom { return 4.2 + Double.random(in: 0..<1.5) }
        if m.kind == .ludo { return Ludo.State(m.state).phase == "roll" ? 0.8 + Double.random(in: 0..<0.7) : 0.9 + Double.random(in: 0..<0.5) }
        return 1.1 + Double.random(in: 0..<0.9)
    }
}
