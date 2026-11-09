import AVFoundation
import SoultiedCore

/*
 * Tiny chiptune sounds made on the fly, like the website's (src/escape/sfx.ts): a few square, triangle and saw
 * notes, each fading away. No sound files. Quiet, mixed with whatever else is playing, and silent when the
 * phone's ring switch is.
 */
final class Chiptune {
    static let shared = Chiptune()

    enum Wave { case square, triangle, sawtooth }

    private struct Voice {
        var f0: Double
        var f1: Double
        var start: Int
        var len: Int
        var vol: Double
        var wave: Wave
        /// seconds of fading in (a slide), else it starts at full volume
        var attack: Double
        var phase = 0.0
    }

    private let engine = AVAudioEngine()
    private var node: AVAudioSourceNode?
    private let lock = NSLock()
    private var voices: [Voice] = []
    /// samples played so far
    private var clock = 0
    private var rate = 44_100.0
    private var started = false

    static let mutedKey = "soultied_sfx_muted"

    var muted: Bool {
        get { UserDefaults.standard.bool(forKey: Self.mutedKey) }
        set {
            UserDefaults.standard.set(newValue, forKey: Self.mutedKey)
            if newValue {
                lock.lock()
                voices.removeAll()
                lock.unlock()
            }
        }
    }

    private func ready() -> Bool {
        if started { return true }
        let session = AVAudioSession.sharedInstance()
        // (while the record player is on, it has the session set for music; leave it be)
        if session.category != .playback { try? session.setCategory(.ambient, options: [.mixWithOthers]) }
        try? session.setActive(true)
        let out = engine.outputNode.inputFormat(forBus: 0)
        rate = out.sampleRate > 0 ? out.sampleRate : 44_100
        guard let mono = AVAudioFormat(standardFormatWithSampleRate: rate, channels: 1) else { return false }
        let n = AVAudioSourceNode(format: mono) { [weak self] _, _, frames, list -> OSStatus in
            self?.render(Int(frames), UnsafeMutableAudioBufferListPointer(list))
            return noErr
        }
        engine.attach(n)
        engine.connect(n, to: engine.mainMixerNode, format: mono)
        do { try engine.start() } catch { return false }
        node = n
        started = true
        return true
    }

    private func add(_ f0: Double, _ f1: Double, _ dur: Double, _ when: Double, _ wave: Wave, _ vol: Double, attack: Double) {
        guard !muted, ready() else { return }
        if !engine.isRunning { try? engine.start() }
        lock.lock()
        // a hair later than now, so the first one isn't clipped
        voices.append(Voice(f0: f0, f1: f1, start: clock + Int((when + 0.01) * rate), len: max(1, Int(dur * rate)), vol: vol, wave: wave, attack: attack))
        lock.unlock()
    }

    func tone(_ freq: Double, _ dur: Double, _ when: Double = 0, _ wave: Wave = .square, _ vol: Double = 0.04) {
        add(freq, freq, dur, when, wave, vol, attack: 0)
    }

    /// a note that glides from one pitch to another (a creak)
    func slide(_ from: Double, _ to: Double, _ dur: Double, _ when: Double = 0, _ wave: Wave = .triangle, _ vol: Double = 0.03) {
        add(from, to, dur, when, wave, vol, attack: min(0.03, dur / 3))
    }

    private func render(_ n: Int, _ list: UnsafeMutableAudioBufferListPointer) {
        guard let out = list.first?.mData?.assumingMemoryBound(to: Float.self) else { return }
        for i in 0..<n { out[i] = 0 }
        lock.lock()
        defer { lock.unlock() }
        var k = 0
        while k < voices.count {
            var v = voices[k]
            let lenD = Double(v.len)
            for i in 0..<n {
                let s = clock + i - v.start
                if s < 0 { continue }
                if s >= v.len { break }
                let p = Double(s) / lenD
                let f = v.f0 == v.f1 ? v.f0 : v.f0 * pow(v.f1 / v.f0, p)
                v.phase += f / rate
                v.phase -= v.phase.rounded(.down)
                let x: Double
                switch v.wave {
                case .square: x = v.phase < 0.5 ? 0.8 : -0.8
                case .triangle: x = 1 - 4 * abs(v.phase - 0.5)
                case .sawtooth: x = 2 * v.phase - 1
                }
                var g = v.vol * pow(0.0001 / v.vol, p)
                let secs = Double(s) / rate
                if v.attack > 0 && secs < v.attack { g = v.vol * pow(0.0001 / v.vol, 1 - secs / v.attack) }
                out[i] += Float(x * g)
            }
            if clock + n - v.start >= v.len {
                voices.remove(at: k)
            } else {
                voices[k] = v
                k += 1
            }
        }
        clock += n
    }

    /* ---------- the escape rooms ---------- */

    func play(_ s: EscapeSound) {
        switch s {
        case .tick: tone(1400, 0.03, 0, .square, 0.02)
        case .note(let c): tone(c.hz, 0.25, 0, .triangle, 0.06)
        case .wrong:
            tone(180, 0.12, 0, .sawtooth, 0.03)
            tone(140, 0.16, 0.1, .sawtooth, 0.03)
        case .open:
            for (i, f) in [523.0, 659, 784].enumerated() { tone(f, 0.18, Double(i) * 0.09, .triangle, 0.05) }
        case .win:
            for (i, f) in [523.0, 659, 784, 1047, 784, 1047].enumerated() { tone(f, 0.22, Double(i) * 0.12, .triangle, 0.06) }
        case .melody(let cs):
            for (i, c) in cs.enumerated() { tone(c.hz, 0.3, Double(i) * 0.28, .triangle, 0.06) }
        }
    }

    /* ---------- pressing things ---------- */

    /// a button or a card under your finger: a tiny wooden tick
    func tick() {
        tone(1480, 0.016, 0, .triangle, 0.016)
        tone(2220, 0.012, 0.012, .triangle, 0.008)
    }

    /// moving between tabs: one note each, from the same five (so Home to Us climbs)
    func tab(_ i: Int) {
        let notes = [523.25, 587.33, 659.25, 783.99, 880.0]
        let f = notes[max(0, min(notes.count - 1, i))]
        tone(f, 0.06, 0, .triangle, 0.02)
        tone(f * 1.5, 0.08, 0.045, .triangle, 0.011)
    }

    /// the app opening: two notes meeting, then a third above them (the thread tying)
    func hello() {
        tone(392, 0.16, 0, .triangle, 0.03)
        tone(523.25, 0.16, 0.12, .triangle, 0.03)
        tone(783.99, 0.34, 0.3, .triangle, 0.026)
        tone(1046.5, 0.3, 0.42, .triangle, 0.012)
    }

    /* ---------- the living room: one small sound for each thing you can touch ---------- */

    func room(_ id: HotspotId) {
        let soft = 0.022
        switch id {
        case .left:
            tone(392, 0.09, 0, .triangle, soft)
            tone(523, 0.12, 0.07, .triangle, soft)
        case .right:
            tone(440, 0.09, 0, .triangle, soft)
            tone(587, 0.12, 0.07, .triangle, soft)
        case .letter:
            tone(1047, 0.06, 0, .triangle, soft)
            tone(1319, 0.1, 0.05, .triangle, soft * 0.9)
        case .fire:
            for (i, w) in [0, 0.06, 0.15, 0.21].enumerated() { tone(1700 + Double((i * 433) % 900), 0.018, w, .square, soft * 0.45) }
            tone(110, 0.18, 0, .triangle, soft)
        case .photo:
            tone(1600, 0.02, 0, .square, soft * 0.6)
            tone(900, 0.04, 0.03, .square, soft * 0.5)
        case .remote:
            tone(880, 0.05, 0, .square, soft * 0.6)
            tone(1320, 0.08, 0.05, .square, soft * 0.5)
        case .door: slide(210, 140, 0.32, 0, .triangle, soft)
        case .games:
            tone(659, 0.07, 0, .triangle, soft)
            tone(784, 0.11, 0.07, .triangle, soft)
        case .music: tone(1200, 0.02, 0, .square, soft * 0.5)
        case .board:
            tone(988, 0.05, 0, .triangle, soft)
            tone(740, 0.08, 0.05, .triangle, soft * 0.8)
        case .decor:
            tone(1319, 0.06, 0, .triangle, soft * 0.8)
            tone(1568, 0.09, 0.05, .triangle, soft * 0.8)
        // a sleepy purr
        case .pet:
            tone(196, 0.07, 0, .triangle, soft)
            tone(185, 0.07, 0.08, .triangle, soft * 0.9)
            tone(196, 0.1, 0.16, .triangle, soft * 0.8)
        }
    }
}
