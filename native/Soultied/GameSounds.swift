import SwiftUI
import SoultiedCore

/*
 * The games' little sounds and their music, made on the fly by Chiptune like the rest of the app's sounds
 * (no sound files). Each game has a short tune of its own that loops softly while its screen is open: a bass
 * note on the beat and a plucked line over it, in the game's own key and pace. It stays quiet while the
 * record player's on (that's your music), and with Sounds off in Us, or the note in a game's corner.
 */

enum GameSound {
    /// you put something down (a firefly, a nought, a fence, a lantern, a shot)
    case move
    /// your person did
    case theirMove
    case win, lose, draw
    /// a round, or a point, to you; or to them, or a slip
    case point, miss
    /// three, two, one, and go
    case count, go
    /// Tug of War's pad
    case tap
    /// Coasters: the cap off a coaster, and a goal
    case hit, goal
    /// Quick Draw: the lantern lights
    case bell
    /// Kitchen Rush
    case pick, chop, plop, cook, serve
}

extension Chiptune {
    func game(_ s: GameSound) {
        switch s {
        case .move:
            tone(784, 0.05, 0, .triangle, 0.03)
            tone(1047, 0.07, 0.04, .triangle, 0.022)
        case .theirMove:
            tone(659, 0.06, 0, .triangle, 0.026)
            tone(523, 0.09, 0.05, .triangle, 0.02)
        case .win:
            for (i, f) in [523.25, 659.25, 783.99, 1046.5].enumerated() { tone(f, 0.16, Double(i) * 0.09, .square, 0.03) }
            tone(1318.5, 0.4, 0.36, .triangle, 0.035)
            tone(523.25, 0.5, 0.36, .triangle, 0.03)
        case .lose:
            for (i, f) in [523.25, 466.16, 392.0].enumerated() { tone(f, 0.2, Double(i) * 0.14, .triangle, 0.03) }
            tone(330, 0.45, 0.42, .triangle, 0.026)
        case .draw:
            tone(523.25, 0.14, 0, .triangle, 0.028)
            tone(523.25, 0.24, 0.16, .triangle, 0.028)
        case .point:
            tone(880, 0.06, 0, .square, 0.022)
            tone(1318.5, 0.12, 0.06, .square, 0.02)
        case .miss:
            slide(392, 262, 0.22, 0, .triangle, 0.03)
        case .count:
            tone(660, 0.09, 0, .square, 0.026)
        case .go:
            tone(1320, 0.2, 0, .square, 0.026)
            tone(660, 0.2, 0, .triangle, 0.03)
        case .tap:
            tone(220 + Double.random(in: 0..<60), 0.03, 0, .square, 0.012)
        case .hit:
            tone(1900, 0.018, 0, .square, 0.016)
            tone(950, 0.03, 0.01, .triangle, 0.02)
        case .goal:
            for (i, f) in [784.0, 988, 1175, 1568].enumerated() { tone(f, 0.1, Double(i) * 0.06, .square, 0.022) }
        case .bell:
            tone(1568, 0.5, 0, .triangle, 0.04)
            tone(2093, 0.4, 0.01, .triangle, 0.018)
        case .pick:
            tone(1175, 0.04, 0, .triangle, 0.022)
        case .chop:
            tone(180, 0.04, 0, .square, 0.02)
            tone(2400, 0.015, 0, .square, 0.008)
        case .plop:
            slide(300, 620, 0.09, 0, .triangle, 0.03)
        case .cook:
            for i in 0..<6 { tone(2600 + Double((i * 377) % 1100), 0.02, Double(i) * 0.05, .square, 0.006) }
        case .serve:
            tone(1047, 0.08, 0, .triangle, 0.03)
            tone(1319, 0.08, 0.07, .triangle, 0.03)
            tone(1568, 0.18, 0.14, .triangle, 0.03)
        }
    }
}

/* ---------- each game's tune ---------- */

/// a game's loop: its pace and key, the chords (one a bar, as steps up the scale), and the plucked line over
/// them (eight notes a bar: which note of the chord, or a rest)
struct GameTune {
    var bpm: Double
    /// the key's home note, in Hz
    var root: Double
    var minor = false
    var chords: [Int]
    var line: [Int?]
    var lead: Chiptune.Wave = .triangle
    /// a soft tick on the off-beats
    var ticks = false

    static func of(_ k: GameKind) -> GameTune {
        switch k {
        // dreamy, by night
        case .fireflies: return GameTune(bpm: 76, root: 220, minor: true, chords: [0, 5, 3, 4], line: [0, 2, 3, 2, 1, 2, 3, nil])
        // a rolling sea song
        case .boats: return GameTune(bpm: 96, root: 196, chords: [0, 3, 4, 0], line: [0, nil, 2, 3, nil, 2, 1, 2])
        case .noughts: return GameTune(bpm: 108, root: 261.63, chords: [0, 5, 3, 4], line: [0, 2, 1, 2, 3, 2, 1, nil], lead: .square)
        // out in the garden
        case .fence: return GameTune(bpm: 92, root: 174.61, chords: [0, 3, 0, 4], line: [0, 1, 2, nil, 3, 2, 1, nil])
        case .lanterns: return GameTune(bpm: 70, root: 196, minor: true, chords: [0, 3, 5, 4], line: [0, nil, 2, nil, 3, nil, 2, 1])
        // quick and pulling
        case .tug: return GameTune(bpm: 140, root: 220, chords: [0, 4, 5, 3], line: [0, 0, 2, 0, 3, 0, 2, 1], lead: .square, ticks: true)
        case .rps: return GameTune(bpm: 122, root: 233.08, chords: [0, 3, 4, 4], line: [0, 2, nil, 2, 1, nil, 3, nil], lead: .square, ticks: true)
        // waiting for the light: sparse
        case .quickdraw: return GameTune(bpm: 84, root: 164.81, minor: true, chords: [0, 0, 5, 4], line: [0, nil, nil, 2, nil, 1, nil, nil])
        case .doodle: return GameTune(bpm: 104, root: 293.66, chords: [0, 5, 1, 4], line: [0, 1, 2, 3, 2, 1, nil, nil])
        case .coasters: return GameTune(bpm: 118, root: 196, minor: true, chords: [0, 5, 6, 4], line: [0, nil, 0, 2, nil, 3, 2, nil], lead: .square, ticks: true)
        // a busy kitchen
        case .kitchen: return GameTune(bpm: 132, root: 261.63, chords: [0, 3, 4, 0], line: [0, 1, 2, 1, 3, 2, 1, 2], lead: .square, ticks: true)
        // a bouncy parlour game
        case .ludo: return GameTune(bpm: 112, root: 246.94, chords: [0, 4, 5, 3], line: [0, 2, 4, 2, 3, nil, 1, 2], lead: .triangle, ticks: true)
        // a slow, thinking waltz
        case .chess: return GameTune(bpm: 66, root: 196, minor: true, chords: [0, 3, 4, 0], line: [0, nil, 2, nil, 1, nil, nil, nil])
        // an afternoon on the verandah
        case .carrom: return GameTune(bpm: 100, root: 220, chords: [0, 5, 3, 4], line: [0, 2, nil, 3, 2, nil, 1, nil])
        }
    }

    private static let major = [0, 2, 4, 5, 7, 9, 11]
    private static let minorScale = [0, 2, 3, 5, 7, 8, 10]

    /// a note of the chord on step `degree` (0 the chord's root, 1 its third, 2 its fifth, 3 the octave), in Hz
    func note(_ degree: Int, _ i: Int, octave: Int = 0) -> Double {
        let scale = minor ? Self.minorScale : Self.major
        let step = degree + [0, 2, 4, 7][max(0, min(3, i))]
        let semis = scale[step % 7] + 12 * (step / 7) + 12 * octave
        return root * pow(2, Double(semis) / 12)
    }
}

/// plays the open game's tune, a bar at a time, a little ahead of time
final class GameMusic {
    static let shared = GameMusic()

    private static let offKey = "soultied_game_music_off"
    /// the music's switched off in the games (the sounds stay)
    var off: Bool {
        get { UserDefaults.standard.bool(forKey: Self.offKey) }
        set {
            UserDefaults.standard.set(newValue, forKey: Self.offKey)
            if newValue { timer?.invalidate(); timer = nil } else if let k = kind { start(k) }
        }
    }

    private var kind: GameKind?
    private var timer: Timer?
    private var bar = 0
    /// when the next bar starts
    private var next = Date()

    func start(_ k: GameKind) {
        kind = k
        timer?.invalidate()
        guard !off, !Chiptune.shared.muted else { return }
        bar = 0
        next = Date().addingTimeInterval(0.6)
        let t = Timer(timeInterval: 0.25, repeats: true) { [weak self] _ in self?.fill() }
        RunLoop.main.add(t, forMode: .common)
        timer = t
        fill()
    }

    func stop() {
        timer?.invalidate()
        timer = nil
        kind = nil
    }

    /// queue up the bars that start in the next second
    private func fill() {
        guard let k = kind else { return }
        let tune = GameTune.of(k)
        let beat = 60 / tune.bpm
        let barLen = beat * 4
        // (after the phone's been away, start again from now rather than catching up)
        if next.timeIntervalSinceNow < -0.2 { next = Date().addingTimeInterval(0.1) }
        while next.timeIntervalSinceNow < 1.0 {
            // the record player's your music: the game keeps quiet while it plays
            if !(RecordDeck.shared.hearing || RecordDeck.shared.songHearing) {
                play(tune, bar, at: max(0, next.timeIntervalSinceNow), beat: beat)
            }
            bar += 1
            next = next.addingTimeInterval(barLen)
        }
    }

    private func play(_ t: GameTune, _ bar: Int, at when: Double, beat: Double) {
        let c = Chiptune.shared
        let chord = t.chords[bar % t.chords.count]
        // the bass: the chord's root on the first beat, its fifth on the third
        c.tone(t.note(chord, 0, octave: -1), beat * 1.6, when, .triangle, 0.02)
        c.tone(t.note(chord, 2, octave: -1), beat * 1.6, when + beat * 2, .triangle, 0.017)
        // the line, an octave up; every fourth bar it turns round, so it doesn't just go round and round
        let line = bar % 4 == 3 ? Array(t.line.reversed()) : t.line
        for (i, n) in line.enumerated() {
            guard let n else { continue }
            c.tone(t.note(chord, n, octave: 1), beat * 0.45, when + Double(i) * beat / 2, t.lead, t.lead == .square ? 0.008 : 0.013)
        }
        if t.ticks {
            for i in 0..<4 { c.tone(5200, 0.012, when + (Double(i) + 0.5) * beat, .square, 0.0035) }
        }
    }
}

/// the note in a game's corner: the music on or off (the sounds stay)
struct MusicToggle: View {
    @State private var off = GameMusic.shared.off

    var body: some View {
        Button {
            Haptics.select()
            off.toggle()
            GameMusic.shared.off = off
        } label: {
            GlyphView(glyph: Self.note, scale: 2)
                .opacity(off ? 0.35 : 1)
                .overlay { if off { Rectangle().fill(Color.thread).frame(width: 22, height: 3).rotationEffect(.degrees(-40)) } }
                .frame(width: 34, height: 30)
                .pxBox()
        }
        .buttonStyle(.press)
        .accessibilityLabel(off ? "Turn the music on" : "Turn the music off")
    }

    private static let note = Glyph(["...kkk", "...kkk", "...k..", "...k..", "...k..", ".kkk..", "kkkk..", ".kk..."], ["k": "#3a2a26"])
}

/* ---------- a win: a little confetti ---------- */

/// pixel confetti falling over the board for a couple of seconds
struct Confetti: View {
    @State private var start = Date()
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private static let colors: [Color] = [Color(hex: "#e2b359"), Color(hex: "#b8674f"), Color(hex: "#8a9a72"), Color(hex: "#6e56a8"), Color(hex: "#f4e8d0"), Color(hex: "#c4453f")]
    private static let bits: [(x: Double, delay: Double, speed: Double, sway: Double, c: Int)] = (0..<46).map { i in
        let r = Double((i * 7919) % 1000) / 1000
        let q = Double((i * 104_729) % 1000) / 1000
        return (x: r, delay: q * 0.5, speed: 0.55 + 0.4 * Double((i * 31) % 10) / 10, sway: q * 2 - 1, c: i % colors.count)
    }

    var body: some View {
        if !reduceMotion {
            TimelineView(.animation(minimumInterval: 1.0 / 30)) { ctx in
                let t = ctx.date.timeIntervalSince(start)
                Canvas { g, size in
                    for b in Self.bits {
                        let k = (t - b.delay) * b.speed
                        guard k > 0, k < 1.25 else { continue }
                        let y = CGFloat(k * 1.1 - 0.1) * size.height
                        let x = CGFloat(b.x) * size.width + CGFloat(sin(k * 9 + b.sway * 3) * 10 * b.sway)
                        let s: CGFloat = 5
                        // (they flutter: flat, then face on)
                        let h: CGFloat = k.truncatingRemainder(dividingBy: 0.2) < 0.1 ? s : s / 2
                        g.fill(Path(CGRect(x: (x / 3).rounded() * 3, y: (y / 3).rounded() * 3, width: s, height: h)),
                               with: .color(Self.colors[b.c].opacity(k > 1 ? max(0, 1.25 - k) * 4 : 1)))
                    }
                }
            }
        }
    }
}
