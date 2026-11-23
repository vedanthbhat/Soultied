import SwiftUI
import UIKit
import SoultiedCore

/*
 * The faces of two home-screen widgets, drawn by the widget and, for the screenshots, by the app (WidgetGallery):
 *   Their voice   your person's newest voice note (tap: it plays in Soultied)
 *   Memories      one memory from your wall each day, the ones from this day in other years first
 */

private func hexK(_ s: String) -> Color {
    let c = RGB(s)
    return Color(.sRGB, red: Double(c.r) / 255, green: Double(c.g) / 255, blue: Double(c.b) / 255, opacity: 1)
}

private let inkK = hexK("#3a2a26")
private let paperK = hexK("#fbf3e2")
private let mutedK = hexK("#7d6a5c")
private let terraK = hexK("#b8674f")
private let barK = hexK("#d6c29c")
private let creamK = hexK("#fff4e2")
private let nightK = hexK("#1a1214")

enum KeepsakeGlyphs {
    /// a little microphone
    static let mic = Glyph([".rrr.", "rrrrr", "rrrrr", "rrrrr", "rrrrr", ".rrr.", "k...k", ".kkk.", "..k..", ".kkk."], ["r": "#c4453f", "k": "#3a2a26"])
    /// the play button's triangle
    static let play = Glyph(["w....", "ww...", "www..", "wwww.", "wwwww", "wwww.", "www..", "ww...", "w...."], ["w": "#fff4e2"])
    /// a little star, for memories
    static let star = Icons.star
}

/* ---------- their voice ---------- */

/// your person's newest voice note, as the widget shows it
struct VoiceNow: Codable, Equatable {
    var id: String
    var secs: Double
    /// when they left it (ms)
    var at: Double
    /// loudness, 0–9 a bar
    var peaks: [Int]
    /// you've played it already
    var heard: Bool

    static let demo = VoiceNow(id: "voice-demo", secs: 42, at: Date().timeIntervalSince1970 * 1000 - 3 * 3600e3,
                               peaks: [2, 4, 6, 3, 7, 9, 5, 4, 6, 8, 3, 2, 5, 7, 6, 4, 3, 5, 8, 6, 4, 2, 3, 2], heard: false)
}

enum KeepsakeArt {
    /// the loudness bars, fitted to `n` bars (the loudest in each stretch)
    static func squeeze(_ peaks: [Int], _ n: Int) -> [Int] {
        guard n > 0 else { return [] }
        guard !peaks.isEmpty else { return Array(repeating: 2, count: n) }
        return (0..<n).map { i in
            let a = i * peaks.count / n
            let b = max(a + 1, (i + 1) * peaks.count / n)
            return peaks[min(a, peaks.count - 1)..<min(b, peaks.count)].max() ?? 2
        }
    }

    /// which memory to show today: one from this day in an earlier year (the newest), or else a different one
    /// each day, taking turns (`days` are YYYY-MM-DD, in a fixed order)
    static func pick(_ days: [String], today: String) -> (index: Int, onThisDay: Bool)? {
        guard !days.isEmpty, today.count == 10 else { return nil }
        let monthDay = String(today.suffix(5))
        let same = days.indices.filter { days[$0].suffix(5) == monthDay && days[$0] < today }
        if let i = same.max(by: { days[$0] < days[$1] }) { return (i, true) }
        let number = dayNumber(today) ?? 0
        return (((number % days.count) + days.count) % days.count, false)
    }

    /// days since 1 January 1970 (the turns move on at midnight)
    private static func dayNumber(_ day: String) -> Int? {
        let p = day.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3 else { return nil }
        var c = DateComponents()
        c.year = p[0]
        c.month = p[1]
        c.day = p[2]
        c.timeZone = TimeZone(identifier: "UTC")
        guard let d = Calendar(identifier: .gregorian).date(from: c) else { return nil }
        return Int((d.timeIntervalSince1970 / 86400).rounded(.down))
    }

    /// "11 Feb 2023", or "2 years ago today"
    static func when(_ day: String, onThisDay: Bool, today: String) -> String {
        let p = day.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3 else { return day }
        if onThisDay, let y = Int(today.prefix(4)) {
            let n = y - p[0]
            return n == 1 ? "A year ago today" : "\(n) years ago today"
        }
        let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        return "\(p[2]) \(months[max(0, min(11, p[1] - 1))]) \(p[0])"
    }

    /// today, YYYY-MM-DD, on this phone
    static func today(_ date: Date = Date()) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 1970, c.month ?? 1, c.day ?? 1)
    }
}

private func glyphK(_ g: Glyph, _ scale: CGFloat) -> some View {
    PixelPic(image: UsArt.glyph(g)).frame(width: CGFloat(g.pixelWidth) * scale, height: CGFloat(g.pixelHeight) * scale)
}

/// your person's newest voice note: their name, a play button, its loudness bars, how long and when
struct VoiceFace: View {
    let voice: VoiceNow?
    let name: String
    let setUp: Bool
    var medium = false
    var now = Date()

    private var who: String { name.isEmpty ? "Your person" : name }

    var body: some View {
        ZStack {
            paperK
            VStack(alignment: .leading, spacing: medium ? 8 : 6) {
                HStack(spacing: 6) {
                    glyphK(KeepsakeGlyphs.mic, 2)
                    Text(setUp ? who : "Voice notes").font(WidgetFont.px(11, bold: true)).foregroundStyle(mutedK).lineLimit(1)
                    Spacer(minLength: 0)
                    if voice?.heard == false {
                        Text("NEW").font(WidgetFont.px(9, bold: true)).foregroundStyle(creamK)
                            .padding(.horizontal, 4).padding(.vertical, 1).background(terraK)
                    }
                }
                Spacer(minLength: 0)
                if let v = voice {
                    HStack(spacing: 8) {
                        playButton
                        bars(v.peaks, medium ? 30 : 13)
                    }
                    Spacer(minLength: 0)
                    Text(medium ? "\(who) left you a voice note" : "A voice note for you")
                        .font(WidgetFont.px(medium ? 14 : 12, bold: true)).foregroundStyle(inkK).lineLimit(1).minimumScaleFactor(0.8)
                    Text("\(voiceLength(v.secs)) · \(WidgetShare.ago(v.at, now: now))").font(WidgetFont.px(10)).foregroundStyle(mutedK).lineLimit(1)
                } else {
                    Text(setUp ? "No voice notes yet" : "Open Soultied").font(WidgetFont.px(14, bold: true)).foregroundStyle(inkK)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(setUp ? "When \(who) leaves you one, it’s here. Tap to leave the first." : "Then your person’s voice notes show up here.")
                        .font(WidgetFont.px(10)).foregroundStyle(mutedK).fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .padding(12)
        }
    }

    /// a pixel play button (the whole widget's a tap to play it in Soultied)
    private var playButton: some View {
        ZStack {
            Rectangle().fill(inkK)
            Rectangle().fill(terraK).padding(3)
            glyphK(KeepsakeGlyphs.play, 2).offset(x: 1)
        }
        .frame(width: 36, height: 36)
    }

    private func bars(_ peaks: [Int], _ n: Int) -> some View {
        let ps = KeepsakeArt.squeeze(peaks, n)
        return HStack(alignment: .center, spacing: 2) {
            ForEach(ps.indices, id: \.self) { i in
                Rectangle().fill(i % 3 == 0 ? terraK : barK).frame(width: 4, height: 4 + CGFloat(ps[i]) * 2.6)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(height: 30)
    }
}

/* ---------- memories ---------- */

/// one memory from your wall, as the widget shows it
struct MemoryNow: Equatable {
    var title: String
    /// when it happened, YYYY-MM-DD
    var day: String
    var text: String
    var photo: UIImage?
    var onThisDay: Bool

    static let demo = MemoryNow(title: "First date: the bookshop café", day: "2023-02-11",
                                text: "You spilled the hot chocolate and laughed so hard the owner gave us cookies.", photo: nil, onThisDay: false)
}

/// a memory: its title, when it was, a little of what you wrote, and its photo if it has one
struct MemoryFace: View {
    let memory: MemoryNow?
    let setUp: Bool
    var size: WidgetSize = .small
    var now = Date()

    var body: some View {
        if let m = memory, let photo = m.photo, size == .small {
            // a small one with a photo: the photo, with the memory over it
            ZStack(alignment: .bottomLeading) {
                Image(uiImage: photo).resizable().scaledToFill()
                LinearGradient(colors: [nightK.opacity(0), nightK.opacity(0.9)], startPoint: .top, endPoint: .bottom).frame(height: 90)
                VStack(alignment: .leading, spacing: 2) {
                    Text(m.title).font(WidgetFont.px(13, bold: true)).foregroundStyle(creamK).lineLimit(2)
                    Text(KeepsakeArt.when(m.day, onThisDay: m.onThisDay, today: KeepsakeArt.today(now))).font(WidgetFont.px(10)).foregroundStyle(hexK("#ffd76a")).lineLimit(1)
                }
                .padding(.horizontal, 12)
                .padding(.bottom, 10)
            }
        } else {
            ZStack {
                paperK
                HStack(alignment: .top, spacing: 12) {
                    if let m = memory, let photo = m.photo {
                        Image(uiImage: photo).resizable().scaledToFill()
                            .frame(width: size == .large ? 130 : 96, height: size == .large ? 130 : 96).clipped()
                            .padding(5).padding(.bottom, 10).background(Color.white)
                            .shadow(color: .black.opacity(0.25), radius: 0, x: 2, y: 2)
                            .rotationEffect(.degrees(-3))
                    }
                    words
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .padding(12)
            }
        }
    }

    private var words: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 6) {
                glyphK(KeepsakeGlyphs.star, 1.5)
                Text(memory?.onThisDay == true ? "On this day" : "A memory").font(WidgetFont.px(11, bold: true)).foregroundStyle(mutedK).lineLimit(1)
            }
            if let m = memory {
                Text(m.title).font(WidgetFont.px(size == .small ? 14 : 16, bold: true)).foregroundStyle(inkK)
                    .lineLimit(size == .small ? 3 : 2).minimumScaleFactor(0.85)
                Text(KeepsakeArt.when(m.day, onThisDay: m.onThisDay, today: KeepsakeArt.today(now))).font(WidgetFont.px(10)).foregroundStyle(mutedK).lineLimit(1)
                if size != .small && !m.text.isEmpty {
                    Text(m.text).font(WidgetFont.px(12)).foregroundStyle(inkK).lineLimit(size == .large ? 8 : 3)
                }
            } else {
                Spacer(minLength: 0)
                Text(setUp ? "No memories yet" : "Open Soultied").font(WidgetFont.px(14, bold: true)).foregroundStyle(inkK)
                Text(setUp ? "Keep one on your wall, and one comes back here each day." : "Then the memories you keep show up here.")
                    .font(WidgetFont.px(10)).foregroundStyle(mutedK).fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}
