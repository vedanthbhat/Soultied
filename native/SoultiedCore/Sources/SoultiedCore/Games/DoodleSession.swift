import Foundation
import Observation

/**
 * Doodle Guess on this screen (the website's DoodleGame.tsx, without the drawing of it): your pen, the page as
 * you see it, and keeping the two of you in step.
 *
 * Whoever draws sends their ink over the live channel a few times a second (numbered, so it's laid down in
 * order) and saves the whole page every few seconds. Whoever guesses lays the ink since over the last saved
 * page. Moves (choosing a word, guessing, moving on) go in the match document like any other game.
 *
 * Call `sync()` when the match changes and `pulse()` often while the game is open.
 */
@Observable
public final class DoodleSession {
    public enum Tool: String, Sendable { case pen, fill, erase }

    @ObservationIgnored private weak var place: PlaceModel?
    @ObservationIgnored private let clock: () -> Double
    @ObservationIgnored private let channel: () -> LiveChannel?

    /// the page as this screen shows it
    public private(set) var pixels = DoodleGuess.blank
    public var tool: Tool = .pen
    public var color: Character = "k"
    public var size = 1
    /// what you said last, and how it went (until the next round)
    public private(set) var said: (verdict: DoodleGuess.Verdict, text: String)?

    /// ink sent this often while you draw, and the whole page saved this often
    static let sendMs: Double = 300
    static let saveMs: Double = 2500
    /// if the person drawing has gone quiet, the guesser ends the round this long after time's up
    static let graceMs: Double = 4000

    private struct RoundRef {
        var key = ""
        var mid = ""
        var r = 0
        var drawer = false
        var startedAt: Double = 0
    }

    private enum Pending {
        case cells(Character, [Int])
        case all(Character)
    }

    @ObservationIgnored private var R = RoundRef()
    @ObservationIgnored private var base: (n: Int, pixels: String) = (-1, DoodleGuess.blank)
    @ObservationIgnored private var ink: [String: [Int: [DoodleGuess.InkOp]]] = [:]
    @ObservationIgnored private var lastDoc: Doc?
    @ObservationIgnored private var nRef = 0
    @ObservationIgnored private var pending: [Pending] = []
    @ObservationIgnored private var dirty = false
    @ObservationIgnored private var stroke: (x: Int, y: Int)?
    @ObservationIgnored private var chan: LiveChannel?
    @ObservationIgnored private var canvasWatch: Listener?
    @ObservationIgnored private var lastSend: Double = 0
    @ObservationIgnored private var lastSave: Double = 0
    @ObservationIgnored private var ended = ""
    @ObservationIgnored private var joinedFor = ""
    @ObservationIgnored private var kept = ""
    @ObservationIgnored private var bot: (key: String, strokes: [(Int, Character)], i: Int, n: Int, at: Double)?
    @ObservationIgnored private var closed = false

    public init(place: PlaceModel, clock: @escaping () -> Double = Values.nowMs, channel: (() -> LiveChannel?)? = nil) {
        self.place = place
        self.clock = clock
        self.channel = channel ?? { [weak place] in place?.liveChannel("doodle") }
    }

    /* ---------- who's who ---------- */

    public var mySeat: Side { place?.mySeat ?? .a }
    public var demo: Bool { place?.isDemo ?? false }
    public var ready: Bool { (place?.partnerHere ?? false) || demo }
    public var raw: Match? { place?.games[.doodle] }
    /// the game under way (one left hanging for half an hour doesn't count)
    public var match: Match? {
        guard let m = raw, m.status != .over, !Play.doodleStale(m, now: clock()) else { return nil }
        return m
    }
    /// the last finished game, for the look back
    public var over: Match? { raw?.status == .over ? raw : nil }
    public var state: DoodleGuess.State? { match.map { DoodleGuess.State($0.state) } }
    public var iDraw: Bool { state?.drawer == mySeat }
    public var drawing: Bool { state?.phase == "drawing" }

    /// seconds left to draw
    public func left(now: Double? = nil) -> Int {
        guard drawing, let e = state?.endsAt else { return DoodleGuess.drawSeconds }
        return max(0, Int(((e - (now ?? clock())) / 1000).rounded(.up)))
    }

    /* ---------- moves ---------- */

    private func save(_ m: Match?) { if let m { place?.saveGame(m) } }

    public func start() { save(Play.newDoodle(mySeat, best: raw.map { DoodleGuess.State($0.state).best } ?? 0)) }

    public func choose(_ word: String) {
        guard let m = match else { return }
        save(Play.doodleChoose(m, mySeat, word, now: clock()))
    }

    @discardableResult
    public func guess(_ text: String) -> DoodleGuess.Verdict? {
        guard let m = match, drawing, !iDraw, let r = Play.doodleGuess(m, mySeat, text, pixels: pixels, now: clock()) else { return nil }
        save(r.match)
        said = (r.verdict, text.trimmingCharacters(in: .whitespacesAndNewlines))
        return r.verdict
    }

    /// too hard (for whoever draws), or give up (for whoever guesses)
    public func skip() {
        guard let m = match else { return }
        if iDraw { flush() }
        save(Play.doodleTimeUp(m, pixels: pixels, gaveUp: true))
    }

    public func next() {
        guard let m = match else { return }
        save(Play.doodleNext(m))
    }

    /* ---------- your pen ---------- */

    private var canDraw: Bool { drawing && iDraw }
    private var inkKey: Character { tool == .erase ? "." : color }

    private func put(_ cells: [Int], _ key: Character) {
        if cells.isEmpty { return }
        pixels = DoodleGuess.paint(pixels, cells, key)
        if case .cells(let c, let have)? = pending.last, c == key {
            pending[pending.count - 1] = .cells(c, have + cells)
        } else {
            pending.append(.cells(key, cells))
        }
    }

    public func penDown(_ x: Int, _ y: Int) {
        guard canDraw else { return }
        let x = max(0, min(DoodleGuess.w - 1, x)), y = max(0, min(DoodleGuess.h - 1, y))
        if tool == .fill {
            let at = y * DoodleGuess.w + x
            if Array(pixels.utf8)[at] != color.asciiValue { put(DoodleGuess.fillCells(pixels, at), color) }
            return
        }
        stroke = (x, y)
        put(DoodleGuess.brushLine(x, y, x, y, size: tool == .erase ? max(2, size) : size), inkKey)
    }

    public func penMove(_ x: Int, _ y: Int) {
        guard canDraw else { return }
        guard let s = stroke else {
            // (a finger that landed without the page noticing)
            if tool != .fill { penDown(x, y) }
            return
        }
        let x = max(0, min(DoodleGuess.w - 1, x)), y = max(0, min(DoodleGuess.h - 1, y))
        if x == s.x && y == s.y { return }
        put(DoodleGuess.brushLine(s.x, s.y, x, y, size: tool == .erase ? max(2, size) : size), inkKey)
        stroke = (x, y)
    }

    public func penUp() { stroke = nil }

    public func clearPage() {
        guard canDraw else { return }
        pixels = DoodleGuess.blank
        pending.append(.all("."))
    }

    /* ---------- keeping in step ---------- */

    /// the match changed: a new round starts with a blank page; say you're here; keep a finished drawing
    public func sync() {
        guard !closed else { return }
        openLines()
        let m = match
        let st = m.map { DoodleGuess.State($0.state) }
        let key = m != nil && (st?.round ?? 0) > 0 ? "\(m!.id):\(st!.round)" : ""
        if key.isEmpty {
            R = RoundRef()
        } else if let m, let st {
            let drawer = st.drawer == mySeat
            if R.key == key && R.drawer == drawer {
                R.startedAt = st.startedAt ?? R.startedAt
            } else {
                R = RoundRef(key: key, mid: m.id, r: st.round, drawer: drawer, startedAt: st.startedAt ?? 0)
                pixels = DoodleGuess.blank
                base = (-1, DoodleGuess.blank)
                nRef = 0
                pending = []
                stroke = nil
                tool = .pen
                said = nil
                for k in ink.keys where !k.hasPrefix("\(m.id):") || (Int(k.split(separator: ":").last ?? "") ?? 0) < st.round { ink[k] = nil }
                takeDoc(lastDoc)
                recompute()
            }
        }

        guard let m, let st else { return }
        // you came to play: say you're here
        if ready, st.phase == "lobby", st.joined[mySeat] != true, joinedFor != m.id {
            joinedFor = m.id
            save(Play.doodleJoin(m, mySeat))
        }
        // the round's picture stays with it for the look back at the end
        if st.phase == "reveal", let r = st.rounds.last {
            let k = "\(m.id):\(st.round)"
            if let p = r.pixels, p != pixels, R.key == k, !iDraw { pixels = p }
            if iDraw, r.pixels == nil, R.key == k, kept != k {
                kept = k
                save(Play.doodleKeepDrawing(m, pixels))
            }
        }
    }

    /// call often while the game is open: send your ink, save the page, call time, and (in the demo room) let your pretend partner draw
    public func pulse() {
        guard !closed else { return }
        let now = clock()
        if canDraw {
            if now - lastSend >= Self.sendMs {
                lastSend = now
                flush()
            }
            if now - lastSave >= Self.saveMs {
                lastSave = now
                saveCanvas()
            }
        } else if dirty || !pending.isEmpty {
            // the round just ended: the last of your ink goes out
            flush()
            saveCanvas()
        }
        if let m = match, let st = state, st.phase == "drawing", let e = st.endsAt {
            let late = now - e
            // whoever's drawing calls time; the guesser does if they've gone quiet (or it's the demo room's partner)
            if late >= 0 && (iDraw || demo || late >= Self.graceMs) {
                let k = "\(m.id):\(st.round)"
                if ended != k {
                    ended = k
                    if iDraw { flush() }
                    save(Play.doodleTimeUp(m, pixels: pixels))
                }
            }
        }
        botDraws(now)
    }

    public func close() {
        if canDraw {
            flush()
            saveCanvas()
        }
        closed = true
        chan?.close()
        chan = nil
        canvasWatch?.stop()
        canvasWatch = nil
    }

    private func openLines() {
        guard ready, let place else { return }
        if chan == nil, let c = channel() {
            chan = c
            let me = place.me
            c.subscribe { [weak self] e in
                guard let self, e.str("by") != me, let mid = e.str("mid"), let n = e.int("n"), let r = e.int("r"), let ops = e["ops"] as? [Any] else { return }
                let key = "\(mid):\(r)"
                self.ink[key, default: [:]][n] = ops.compactMap { DoodleGuess.InkOp($0) }
                if key == self.R.key { self.recompute() }
            }
        }
        if canvasWatch == nil { canvasWatch = place.watchDoodleCanvas { [weak self] d in self?.takeDoc(d) } }
    }

    /// what the person guessing sees: the last saved page, plus ink since
    private func recompute() {
        guard !R.key.isEmpty, !R.drawer else { return }
        var p = base.pixels
        if let got = ink[R.key] { for n in got.keys.filter({ $0 > base.n }).sorted() { p = DoodleGuess.apply(p, got[n]!) } }
        if p != pixels { pixels = p }
    }

    /// a saved page arrived (or was already here): the person drawing picks up where they were; the guesser lays it under the ink
    private func takeDoc(_ d: Doc?) {
        if let d { lastDoc = d }
        guard let d, !R.key.isEmpty, d.str("mid") == R.mid, d.int("r") == R.r, let px = d.str("pixels"), px.utf8.count == DoodleGuess.w * DoodleGuess.h else { return }
        let n = d.int("n") ?? 0
        if R.drawer {
            // only when coming back to a round already under way, never over what you've drawn since
            if n > nRef {
                pixels = px
                nRef = n
            }
            return
        }
        if n <= base.n { return }
        base = (n, px)
        if var got = ink[R.key] {
            for k in got.keys where k <= n { got[k] = nil }
            ink[R.key] = got
        }
        recompute()
    }

    private func flush() {
        guard R.drawer, !R.key.isEmpty, !pending.isEmpty, let place else { return }
        let ops: [Doc] = pending.map {
            switch $0 {
            case .all(let c): return DoodleGuess.InkOp(c: c, s: "*").doc
            case .cells(let c, let cells):
                var seen = Set<Int>()
                return DoodleGuess.InkOp(c: c, s: DoodleGuess.pack(cells.filter { seen.insert($0).inserted })).doc
            }
        }
        pending = []
        let now = clock()
        // counts up through the round, and keeps counting up if you come back halfway through
        nRef = max(nRef + 1, Int(now - (R.startedAt > 0 ? R.startedAt : now)))
        chan?.send(["by": place.me, "at": now, "mid": R.mid, "r": R.r, "n": nRef, "ops": ops])
        dirty = true
    }

    private func saveCanvas() {
        guard R.drawer, !R.key.isEmpty, dirty, let place else { return }
        dirty = false
        let d: Doc = ["mid": R.mid, "r": R.r, "n": nRef, "pixels": pixels]
        lastDoc = d
        place.saveDoodleCanvas(d)
    }

    /// the demo room's partner draws too: four cells at a time, a colour at a time
    private func botDraws(_ now: Double) {
        guard demo, drawing, !iDraw, let m = match, let st = state, let word = st.word else {
            bot = nil
            return
        }
        let rk = "\(m.id):\(st.round)"
        if bot?.key != rk {
            let k = DoodleGuess.botKeys.first { DoodleGuess.botWords[$0] == word } ?? "sun"
            var strokes = DoodleGuess.botStrokes(k)
            var order: [Character] = []
            for (_, c) in strokes where !order.contains(c) { order.append(c) }
            strokes.sort { a, b in
                let ia = order.firstIndex(of: a.1)!, ib = order.firstIndex(of: b.1)!
                return ia != ib ? ia < ib : a.0 < b.0
            }
            bot = (rk, strokes, 0, 0, now)
        }
        guard var b = bot, b.i < b.strokes.count, now - b.at >= 130 else { return }
        let bit = b.strokes[b.i..<min(b.i + 4, b.strokes.count)]
        b.i += 4
        b.n += 1
        b.at = now
        bot = b
        ink[rk, default: [:]][b.n] = bit.map { DoodleGuess.InkOp(c: $0.1, s: DoodleGuess.pack([$0.0])) }
        recompute()
    }
}
