import SwiftUI
import AVFoundation
import SoultiedCore

/*
 * Voices on the wall (meta/voice-…, shared with the website): up to a minute of you, recorded here as AAC (the
 * same kind the website records, so either of you can play either), with a little picture of how loud it was.
 */

extension Icons {
    static let mic = Glyph([".rrr.", "rrrrr", "rrrrr", "rrrrr", "rrrrr", ".rrr.", "k...k", ".kkk.", "..k..", ".kkk."], ["r": "#c4453f", "k": "#3a2a26"])
    static let play = Glyph(["k.....", "kkk...", "kkkkk.", "kkkkkk", "kkkkk.", "kkk...", "k....."], ["k": "#3a2a26"])
    static let pause = Glyph(["kk.kk", "kk.kk", "kk.kk", "kk.kk", "kk.kk", "kk.kk", "kk.kk"], ["k": "#3a2a26"])
}

/// records one voice note at a time
@MainActor final class VoiceRecorder: NSObject, ObservableObject, AVAudioRecorderDelegate {
    @Published var recording = false
    @Published var elapsed = 0.0
    @Published var live: [Double] = []
    @Published var draft: (data: Data, secs: Double, levels: [Double])?
    @Published var said: String?
    private var recorder: AVAudioRecorder?
    private var timer: Timer?
    private var levels: [Double] = []
    private var before: AVAudioSession.Category?
    private let url = FileManager.default.temporaryDirectory.appendingPathComponent("soultied-voice.m4a")

    func start() async {
        said = nil
        draft = nil
        guard await AVAudioApplication.requestRecordPermission() else {
            said = "The microphone’s off for Soultied. You can turn it on in Settings."
            return
        }
        let session = AVAudioSession.sharedInstance()
        before = session.category
        do {
            try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetooth])
            try session.setActive(true)
            let r = try AVAudioRecorder(url: url, settings: [
                AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
                AVSampleRateKey: 22050,
                AVNumberOfChannelsKey: 1,
                AVEncoderBitRateKey: 32000,
                AVEncoderAudioQualityKey: AVAudioQuality.medium.rawValue,
            ])
            r.delegate = self
            r.isMeteringEnabled = true
            guard r.record(forDuration: VOICE_MAX_SECS) else { throw CocoaError(.fileWriteUnknown) }
            recorder = r
            levels = []
            elapsed = 0
            live = []
            recording = true
            let t = Timer(timeInterval: 0.1, repeats: true) { [weak self] _ in
                Task { @MainActor in self?.tick() }
            }
            RunLoop.main.add(t, forMode: .common)
            timer = t
        } catch {
            said = "Couldn’t start the microphone just now."
            restore()
        }
    }

    private func tick() {
        guard let r = recorder, r.isRecording else { return }
        r.updateMeters()
        // (decibels to a 0…1 loudness)
        levels.append(Double(pow(10, r.averagePower(forChannel: 0) / 20)))
        elapsed = r.currentTime
        live = Array(levels.suffix(VOICE_BARS))
    }

    func stop() { recorder?.stop() }

    nonisolated func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {
        Task { @MainActor in self.finish(flag) }
    }

    private func finish(_ ok: Bool) {
        timer?.invalidate()
        timer = nil
        recording = false
        let secs = min(VOICE_MAX_SECS, max(elapsed, levels.isEmpty ? 0 : Double(levels.count) / 10))
        recorder = nil
        restore()
        guard ok, secs >= 0.6, let data = try? Data(contentsOf: url) else { return }
        draft = (data, secs, levels)
    }

    func bin() { draft = nil }

    private func restore() {
        let session = AVAudioSession.sharedInstance()
        try? session.setActive(false, options: .notifyOthersOnDeactivation)
        if let before { try? session.setCategory(before) }
    }
}

/// plays one voice note at a time
@MainActor final class VoicePlayer: NSObject, ObservableObject, AVAudioPlayerDelegate {
    @Published var playing: String?
    @Published var at = 0.0
    private var player: AVAudioPlayer?
    private var timer: Timer?

    func toggle(_ id: String, _ data: Data?) -> Bool {
        if playing == id {
            stop()
            return false
        }
        stop()
        guard let data, let p = try? AVAudioPlayer(data: data, fileTypeHint: AVFileType.m4a.rawValue) else { return false }
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
        try? AVAudioSession.sharedInstance().setActive(true)
        p.delegate = self
        guard p.play() else { return false }
        player = p
        playing = id
        at = 0
        let t = Timer(timeInterval: 0.1, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.at = self?.player?.currentTime ?? 0 }
        }
        RunLoop.main.add(t, forMode: .common)
        timer = t
        return true
    }

    func stop() {
        player?.stop()
        player = nil
        timer?.invalidate()
        timer = nil
        playing = nil
        at = 0
    }

    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in self.stop() }
    }
}

/// the loudness bars, filled up to how far it's played
struct VoiceBars: View {
    let peaks: [Int]
    let played: Double
    var body: some View {
        let ps = peaks.isEmpty ? Array(repeating: 2, count: VOICE_BARS) : peaks
        HStack(alignment: .center, spacing: 2) {
            ForEach(ps.indices, id: \.self) { i in
                Rectangle()
                    .fill(Double(i) / Double(ps.count) < played ? Color.terracotta : Color(hex: "#c9b89a"))
                    .frame(maxWidth: 6)
                    .frame(height: 4 + CGFloat(ps[i]) * 2.6)
            }
        }
        .frame(height: 30)
        .accessibilityHidden(true)
    }
}

struct VoicesPanel: View {
    let place: PlaceModel
    @StateObject private var rec = VoiceRecorder()
    @StateObject private var player = VoicePlayer()
    @State private var tooBig = false

    var body: some View {
        let shown = place.voices.filter { !$0.gone }
        VStack(alignment: .leading, spacing: 16) {
            recorder.pxCard()
            if shown.isEmpty {
                Text("No voice notes yet. Leave the first one.").font(.pxBody).foregroundStyle(Color.paper.opacity(0.75))
            }
            ForEach(shown) { v in row(v) }
        }
        .onDisappear { player.stop() }
        // (the screenshots: playing Rohan's)
        .onAppear {
            if Launch.args.contains("-voicePlay"), let v = shown.first {
                _ = player.toggle(v.id, Data(base64Encoded: v.audio))
            }
        }
    }

    private var recorder: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text("A voice note for \(place.theirName)").font(.pxHeading).foregroundStyle(Color.inkSoft)
                Text("Up to a minute. You can listen back before you send it.").font(.pxSmall).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
            }
            if rec.recording {
                HStack(spacing: 10) {
                    Rectangle().fill(Color(hex: "#c4453f")).frame(width: 10, height: 10)
                    Text("\(voiceLength(rec.elapsed)) / \(voiceLength(VOICE_MAX_SECS))").font(.px(15, 700)).foregroundStyle(Color.inkSoft).monospacedDigit()
                    VoiceBars(peaks: rec.live.map { min(9, Int(($0 * 60).rounded())) }, played: 1)
                    Button("Stop") { rec.stop() }.buttonStyle(.px(.terracotta, small: true))
                }
            } else if let d = rec.draft {
                HStack(spacing: 10) {
                    Button {
                        _ = player.toggle("draft", d.data)
                    } label: {
                        GlyphView(glyph: player.playing == "draft" ? Icons.pause : Icons.play, scale: 3).frame(width: 40, height: 40)
                            .background(Color.paperInput).overlay(Rectangle().strokeBorder(Color.ink, lineWidth: 2))
                    }
                    .accessibilityLabel(player.playing == "draft" ? "Pause" : "Listen back")
                    VoiceBars(peaks: Array(peaksFrom(d.levels).utf8.map { Int($0) - 48 }), played: player.playing == "draft" ? player.at / max(0.1, d.secs) : 0)
                    Text(voiceLength(d.secs)).font(.pxSmall).foregroundStyle(Color.muted)
                }
                HStack(spacing: 8) {
                    Button("Send it to \(place.theirName)") {
                        player.stop()
                        tooBig = !place.sendVoice(d.data, secs: d.secs, levels: d.levels)
                        if !tooBig {
                            rec.bin()
                            Haptics.success()
                        }
                    }
                    .buttonStyle(.px(.sage, small: true))
                    Button("Again") {
                        player.stop()
                        Task { await rec.start() }
                    }
                    .buttonStyle(.px(.paper, small: true))
                    Button("Bin it") {
                        player.stop()
                        rec.bin()
                    }
                    .buttonStyle(.px(.paper, small: true))
                }
                if tooBig {
                    Text("That one’s a little too big to send. Try a shorter one.").font(.pxSmall).foregroundStyle(Color.terracottaD)
                }
            } else {
                Button {
                    player.stop()
                    tooBig = false
                    Task { await rec.start() }
                } label: {
                    HStack(spacing: 8) {
                        GlyphView(glyph: Icons.mic, scale: 2)
                        Text("Record")
                    }
                }
                .buttonStyle(.px(.terracotta))
            }
            if let s = rec.said {
                Text(s).font(.pxSmall).foregroundStyle(Color.terracottaD).fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func row(_ v: VoiceNote) -> some View {
        let mine = v.by == place.me
        let isNew = !mine && v.heard[place.me] == nil
        let playingThis = player.playing == v.id
        return HStack(spacing: 12) {
            Button {
                if player.toggle(v.id, Data(base64Encoded: v.audio)), isNew { place.heardVoice(v.id) }
            } label: {
                GlyphView(glyph: playingThis ? Icons.pause : Icons.play, scale: 3).frame(width: 40, height: 40)
                    .background(Color.paperInput).overlay(Rectangle().strokeBorder(Color.ink, lineWidth: 2))
            }
            .accessibilityLabel(playingThis ? "Pause" : "Play the voice note from \(mine ? "you" : place.theirName)")
            VStack(alignment: .leading, spacing: 4) {
                VoiceBars(peaks: v.peaks, played: playingThis && v.secs > 0 ? player.at / v.secs : 0)
                HStack(spacing: 6) {
                    Text(playingThis ? "\(voiceLength(player.at)) / \(voiceLength(v.secs))" : voiceLength(v.secs))
                    Text("· \(mine ? "from you" : "from \(place.theirName)") · \(WidgetShare.ago(v.at, now: Date()))")
                    if isNew { Text("new").font(.px(11, 700)).foregroundStyle(Color.terracottaD) }
                }
                .font(.pxTiny).foregroundStyle(Color.muted).lineLimit(1).minimumScaleFactor(0.8)
            }
            if mine {
                Button {
                    if playingThis { player.stop() }
                    place.removeVoice(v.id)
                } label: { GlyphView(glyph: Icons.cross, scale: 2).padding(6) }
                    .accessibilityLabel("Take it down")
            }
        }
        .padding(10)
        .background(mine ? Color.paper2 : Color.paperInput)
        .overlay(Rectangle().strokeBorder(Color.ink, lineWidth: 2))
    }
}
