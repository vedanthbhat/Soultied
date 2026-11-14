import Foundation

/*
 * Voice notes (src/together/voice.ts): up to a minute of you, left on the wall for your person. Each is its own
 * meta/voice-… document: who, when, how long, the recording itself (AAC in an MP4 box, base64, which every
 * browser and the iPhone can play), a little picture of its loudness (a digit per bar), and when each of you
 * first heard it.
 */

public let VOICE_MAX_SECS = 60.0
/// the recording, base64 (about 300 KB: a minute at 32 kbit/s, with room to spare)
public let VOICE_MAX_CHARS = 420_000
public let VOICE_BARS = 24
/// what gets recorded (and what the iPhone can play)
public let VOICE_MIMES = ["audio/mp4", "audio/aac", "audio/x-m4a", "audio/m4a"]

public struct VoiceNote: Sendable, Equatable, Identifiable {
    public var id: String
    public var by: String
    public var at: Double
    /// seconds, to a tenth
    public var secs: Double
    public var mime: String
    /// base64
    public var audio: String
    /// loudness, 0–9 per bar
    public var peaks: [Int]
    /// when each of you first heard it (ms)
    public var heard: [String: Double]
    public var gone: Bool

    public init?(id: String, _ raw: Doc?) {
        guard let v = raw, let by = v["by"] as? String, !by.isEmpty else { return nil }
        let gone = (v["gone"] as? Bool) == true
        let audio = v["audio"] as? String ?? ""
        let mime = (v["mime"] as? String ?? "").split(separator: ";", omittingEmptySubsequences: false).first.map { $0.trimmingCharacters(in: .whitespaces).lowercased() } ?? ""
        if !gone && (audio.isEmpty || audio.utf8.count > VOICE_MAX_CHARS || !VoiceNote.isBase64(audio) || !VOICE_MIMES.contains(mime)) { return nil }
        func num(_ k: String) -> Double? { (v[k] is String) ? nil : v.num(k).flatMap { $0.isFinite ? $0 : nil } }
        self.id = id
        self.by = by
        self.gone = gone
        self.audio = gone ? "" : audio
        self.mime = mime.isEmpty ? "audio/mp4" : mime
        at = num("at") ?? 0
        secs = num("secs").map { jsRound(min(VOICE_MAX_SECS, max(0, $0)) * 10) / 10 } ?? 0
        let p = v["peaks"] as? String ?? ""
        peaks = (1...64).contains(p.utf8.count) && p.utf8.allSatisfy { $0 >= 48 && $0 <= 57 } ? p.utf8.map { Int($0) - 48 } : []
        var h: [String: Double] = [:]
        for (uid, at) in (v["heard"] as? Doc) ?? [:] where !(at is String) { if let n = Values.num(at), n.isFinite { h[uid] = n } }
        heard = h
    }

    /// base64, with up to two = at the end
    static func isBase64(_ s: String) -> Bool {
        var pad = 0
        var body = 0
        for c in s.utf8 {
            if c == 61 { pad += 1; continue }
            if pad > 0 { return false }
            let ok = (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c == 43 || c == 47
            if !ok { return false }
            body += 1
        }
        return body > 0 && pad <= 2
    }

    /// the doc to keep
    public static func doc(by: String, secs: Double, audio: String, peaks: String) -> Doc {
        ["by": by, "at": Values.nowMs(), "secs": jsRound(secs * 10) / 10, "mime": "audio/mp4", "audio": audio, "peaks": peaks, "heard": Doc(), "gone": false]
    }
}

/// loudness over time (any number of readings, 0 and up) as bars of digits: the loudest bar is 9, any sound at all at least 1
public func peaksFrom(_ levels: [Double], bars: Int = VOICE_BARS) -> String {
    guard !levels.isEmpty else { return String(repeating: "0", count: bars) }
    var top = [Double](repeating: 0, count: bars)
    for (i, l) in levels.enumerated() {
        let b = min(bars - 1, (i * bars) / levels.count)
        if l > top[b] { top[b] = l }
    }
    let mx = top.max() ?? 0
    guard mx > 0 else { return String(repeating: "0", count: bars) }
    return top.map { v in v > 0 ? String(max(1, min(9, Int(jsRound(v / mx * 9))))) : "0" }.joined()
}

/// "0:07", "1:00"
public func voiceLength(_ secs: Double) -> String {
    let s = max(0, Int(jsRound(secs)))
    return "\(s / 60):\(s % 60 < 10 ? "0" : "")\(s % 60)"
}

/// the newest voice note your person left that you haven't heard yet
public func unheardVoice(_ items: [VoiceNote], me: String, them: String?) -> VoiceNote? {
    guard let them else { return nil }
    var best: VoiceNote?
    for v in items where !v.gone && v.by == them && v.heard[me] == nil {
        if best == nil || v.at > best!.at { best = v }
    }
    return best
}
