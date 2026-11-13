import SwiftUI
import UIKit
import SoultiedCore

/*
 * The faces of the fire, countdown and mood widgets (home screen and lock screen), drawn by the widget and,
 * for the screenshots, by the app (WidgetGallery). What they show is worked out from WidgetShare.Us for the
 * day they're showing (so the countdown and the fire move on at midnight by themselves).
 */

private func hexC(_ s: String) -> Color {
    let c = RGB(s)
    return Color(.sRGB, red: Double(c.r) / 255, green: Double(c.g) / 255, blue: Double(c.b) / 255, opacity: 1)
}

private let inkU = hexC("#3a2a26")
private let paperU = hexC("#fbf3e2")
private let mutedU = hexC("#7d6a5c")
private let emberU = hexC("#ffd76a")
private let nightU = hexC("#1a1214")

/// what the widgets show, for one day
struct UsNow {
    var setUp = true
    var themName = "Your person"
    /// the fire: 0 embers … 3 roaring, and the days in a row
    var level = 2
    var streak = 0
    var themToday = false
    var togetherToday = false
    var logLeft = false
    var logRight = false
    var wall = "sage"
    /// days since you got together (nil if you haven't said)
    var daysTogether: Int?
    /// the next time you're together
    var visitDays: Int?
    var visitWhat = ""
    /// your person's mood (nil once it's a day old), and how long ago they said it
    var mood: MoodEntry?
    var moodAgo = ""

    init() {}

    init(_ s: WidgetShare.Saved, at date: Date) {
        guard let c = s.config, let u = s.us else {
            setUp = s.config != nil
            themName = s.config?.themName ?? ""
            return
        }
        let today = Day.today(date)
        themName = c.themName.isEmpty ? "Your person" : c.themName
        let f = CouchState(together: u.together).fire(today: today)
        level = f.level
        streak = f.streak
        togetherToday = u.together.contains(today)
        themToday = u.themSeen == today
        let meToday = u.meSeen == today
        logLeft = u.meLeft ? meToday : themToday
        logRight = u.meLeft ? themToday : meToday
        wall = u.wall
        if VisitDoc.isKey(u.since) {
            let n = Day.number(today) - Day.number(u.since)
            daysTogether = n >= 0 ? n : nil
        }
        let v = VisitDoc(date: u.visitDate, what: u.visitWhat)
        visitDays = v.daysLeft(today: today)
        visitWhat = u.visitWhat
        let ms = date.timeIntervalSince1970 * 1000
        if u.mood != nil || !u.moodText.isEmpty, ms - u.moodAt < MOOD_TTL {
            mood = MoodEntry(mood: u.mood.flatMap { MoodId(rawValue: $0) }, text: u.moodText, at: u.moodAt)
            moodAgo = WidgetShare.ago(u.moodAt, now: date)
        }
    }

    /// the demo room's: a steady fire four days on, Goa in twelve days, and Rohan missing you
    static var demo: UsNow {
        var u = UsNow()
        u.themName = "Rohan"
        u.level = 2
        u.streak = 4
        u.themToday = true
        u.togetherToday = true
        u.logLeft = true
        u.logRight = true
        u.daysTogether = 518
        u.visitDays = 12
        u.visitWhat = "Goa"
        u.mood = MoodEntry(mood: .missing, text: "counting the days", at: Date().timeIntervalSince1970 * 1000 - 2 * 3600e3)
        u.moodAgo = "2 hours ago"
        return u
    }

    var fireName: String { CouchState.fireNames[max(0, min(3, level))] }
    /// "4 days in a row", or what lights it again
    var fireLine: String { level == 0 ? "Both show up today to light it" : "\(streak) \(streak == 1 ? "day" : "days") in a row" }
    /// "Rohan’s been in today" / "Waiting on Rohan"
    var hereLine: String { togetherToday ? "You’re both here today" : themToday ? "\(themName)’s log is on" : "Waiting on \(themName) today" }

    /// the big number and what it's counting: "12" "days until Goa", or "518" "days together"
    var count: (n: String, label: String)? {
        if let d = visitDays {
            if d == 0 { return ("Today", visitWhat.isEmpty ? "you’re together" : visitWhat) }
            if d == 1 { return ("1", visitWhat.isEmpty ? "day to go" : "day until \(visitWhat)") }
            return ("\(d)", visitWhat.isEmpty ? "days to go" : "days until \(visitWhat)")
        }
        if let t = daysTogether { return ("\(t)", t == 1 ? "day together" : "days together") }
        return nil
    }

    var countLine: String {
        guard let c = count else { return "Set the day in Soultied" }
        return c.n == "Today" ? "Today: \(c.label)" : "\(c.n) \(c.label)"
    }
}

/* ---------- pictures ---------- */

enum UsArt {
    private static let space = CGColorSpaceCreateDeviceRGB()

    static func image(_ data: [UInt8], _ w: Int, _ h: Int) -> CGImage? {
        guard w > 0, h > 0, data.count >= w * h * 4, let provider = CGDataProvider(data: Data(data) as CFData) else { return nil }
        return CGImage(
            width: w, height: h, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: w * 4, space: space,
            bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.last.rawValue), provider: provider, decode: nil,
            shouldInterpolate: false, intent: .defaultIntent
        )
    }

    static func glyph(_ g: Glyph) -> CGImage? { image(g.rgba(), g.pixelWidth, g.pixelHeight) }

    /// the fireplace behind the couch, burning as it is today (the room's own drawing, cropped close)
    static func fire(_ u: UsNow) -> CGImage? {
        var st = RoomState(left: .empty, right: .empty)
        st.bare = true
        st.flame = u.level
        st.logLeft = u.logLeft
        st.logRight = u.logRight
        st.decor = Decor(wall: u.wall)
        let room = RoomRenderer().render(st, 2.0)
        let (x0, y0, w, h) = (192, 44, 80, 80)
        var out = [UInt8](repeating: 0, count: w * h * 4)
        for j in 0..<h {
            let from = ((y0 + j) * ROOM_W + x0) * 4
            out.replaceSubrange((j * w * 4)..<((j + 1) * w * 4), with: room.data[from..<(from + w * 4)])
        }
        return image(out, w, h)
    }
}

/// a pixel picture, scaled up without smoothing
struct PixelPic: View {
    let image: CGImage?
    var body: some View {
        if let image { Image(decorative: image, scale: 1).resizable().interpolation(.none) } else { Color.clear }
    }
}

private func glyphView(_ g: Glyph, _ scale: CGFloat) -> some View {
    PixelPic(image: UsArt.glyph(g)).frame(width: CGFloat(g.pixelWidth) * scale, height: CGFloat(g.pixelHeight) * scale)
}

/* ---------- home screen ---------- */

/// the fire, filling a small widget, with how it's burning under it
struct FireFace: View {
    let u: UsNow
    var body: some View {
        ZStack(alignment: .bottomLeading) {
            PixelPic(image: UsArt.fire(u)).aspectRatio(1, contentMode: .fill)
            LinearGradient(colors: [nightU.opacity(0), nightU.opacity(0.92)], startPoint: .top, endPoint: .bottom).frame(height: 70)
            VStack(alignment: .leading, spacing: 1) {
                Text(u.setUp ? u.fireName : "The fire").font(WidgetFont.px(15, bold: true)).foregroundStyle(paperU)
                Text(u.setUp ? u.fireLine : "Open Soultied to light it").font(WidgetFont.px(11)).foregroundStyle(emberU).lineLimit(1).minimumScaleFactor(0.8)
            }
            .padding(.horizontal, 12)
            .padding(.bottom, 10)
        }
    }
}

/// a little paper card: the background of the countdown and the mood
struct PaperFace<Content: View>: View {
    @ViewBuilder let content: () -> Content
    var body: some View {
        ZStack {
            paperU
            content().padding(12)
        }
    }
}

/// the next time you're together: a big number (or the days you've been together)
struct CountdownFace: View {
    let u: UsNow
    var body: some View {
        PaperFace {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    glyphView(UsGlyphs.calendar, 2.5)
                    Text(u.visitDays != nil ? "Next time" : "Together").font(WidgetFont.px(11, bold: true)).foregroundStyle(mutedU).lineLimit(1)
                }
                Spacer(minLength: 0)
                if let c = u.count {
                    Text(c.n).font(WidgetFont.px(c.n.count > 3 ? 38 : 46, bold: true)).foregroundStyle(inkU).lineLimit(1).minimumScaleFactor(0.6)
                    Text(c.label).font(WidgetFont.px(13)).foregroundStyle(inkU).lineLimit(2).minimumScaleFactor(0.8)
                } else {
                    Text(u.setUp ? "When do you see each other next?" : "Open Soultied").font(WidgetFont.px(14, bold: true)).foregroundStyle(inkU).fixedSize(horizontal: false, vertical: true)
                    Text("Set the day in Soultied").font(WidgetFont.px(11)).foregroundStyle(mutedU)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        }
    }
}

/// how your person's feeling
struct MoodFace: View {
    let u: UsNow
    var body: some View {
        PaperFace {
            VStack(alignment: .leading, spacing: 6) {
                Text(u.themName).font(WidgetFont.px(11, bold: true)).foregroundStyle(mutedU).lineLimit(1)
                if let m = u.mood {
                    glyphView(m.glyph, 6)
                    Spacer(minLength: 0)
                    Text(moodDef(m.mood)?.label ?? "Says").font(WidgetFont.px(16, bold: true)).foregroundStyle(inkU).lineLimit(1).minimumScaleFactor(0.7)
                    if !m.text.isEmpty {
                        Text("“\(m.text)”").font(WidgetFont.px(12)).foregroundStyle(inkU).lineLimit(2).minimumScaleFactor(0.8)
                    }
                    Text(u.moodAgo).font(WidgetFont.px(10)).foregroundStyle(mutedU)
                } else {
                    glyphView(WORDS_GLYPH, 6)
                    Spacer(minLength: 0)
                    Text(u.setUp ? "Hasn’t said how they’re feeling today" : "Open Soultied").font(WidgetFont.px(13, bold: true)).foregroundStyle(inkU).fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        }
    }
}

/// all three, side by side: the fire, and the countdown and their mood beside it
struct UsFace: View {
    let u: UsNow
    var body: some View {
        HStack(spacing: 0) {
            FireFace(u: u).frame(maxWidth: .infinity, maxHeight: .infinity).clipped()
            PaperFace {
                VStack(alignment: .leading, spacing: 10) {
                    row(UsGlyphs.calendar, u.count.map { $0.n == "Today" ? "Today" : "\($0.n) \($0.label.split(separator: " ").first ?? "")" } ?? "Next time?", u.count.map { $0.n == "Today" ? $0.label : $0.label.split(separator: " ").dropFirst().joined(separator: " ") } ?? "Set the day in Soultied")
                    if let m = u.mood {
                        row(m.glyph, "\(u.themName): \(moodDef(m.mood)?.label.lowercased() ?? "says")", m.text.isEmpty ? u.moodAgo : "“\(m.text)”")
                    } else {
                        row(WORDS_GLYPH, u.themName, "No mood today yet")
                    }
                    Text(u.hereLine).font(WidgetFont.px(10)).foregroundStyle(mutedU).lineLimit(1)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private func row(_ g: Glyph, _ title: String, _ sub: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            glyphView(g, 3).frame(width: 24, alignment: .center)
            VStack(alignment: .leading, spacing: 1) {
                Text(title).font(WidgetFont.px(13, bold: true)).foregroundStyle(inkU).lineLimit(1).minimumScaleFactor(0.7)
                Text(sub).font(WidgetFont.px(11)).foregroundStyle(mutedU).lineLimit(1).minimumScaleFactor(0.8)
            }
        }
    }
}

/* ---------- lock screen (drawn in one colour by iOS; the shapes do the work) ---------- */

/// round: the fire's flame and the days in a row
struct FireRound: View {
    let u: UsNow
    var body: some View {
        VStack(spacing: 1) {
            glyphView(u.level > 0 ? UsGlyphs.flame : UsGlyphs.flameOut, 2.5)
            Text(u.level > 0 ? "\(u.streak)" : "0").font(WidgetFont.px(16, bold: true)).lineLimit(1).minimumScaleFactor(0.6)
        }
    }
}

/// round: the days to go (or together)
struct CountdownRound: View {
    let u: UsNow
    var body: some View {
        VStack(spacing: 0) {
            Text(u.count?.n ?? "?").font(WidgetFont.px((u.count?.n.count ?? 1) > 3 ? 15 : 20, bold: true)).lineLimit(1).minimumScaleFactor(0.5)
            Text(u.visitDays != nil ? (u.visitDays == 0 ? "together" : "to go") : "together").font(WidgetFont.px(10)).lineLimit(1).minimumScaleFactor(0.7)
        }
        .padding(4)
    }
}

/// round: their mood's picture
struct MoodRound: View {
    let u: UsNow
    var body: some View { glyphView(u.mood?.glyph ?? WORDS_GLYPH, 3.5) }
}

/// a line under the clock, with a picture
struct LockRow: View {
    let glyph: Glyph
    let title: String
    let sub: String
    var body: some View {
        HStack(spacing: 8) {
            glyphView(glyph, 3)
            VStack(alignment: .leading, spacing: 0) {
                Text(title).font(WidgetFont.px(15, bold: true)).lineLimit(1).minimumScaleFactor(0.7)
                Text(sub).font(WidgetFont.px(12)).lineLimit(2).minimumScaleFactor(0.8)
            }
            Spacer(minLength: 0)
        }
    }
}

enum UsGlyphs {
    /// a little calendar page, with a heart on one of its days
    static let calendar = Glyph(
        [".k.....k.", "#rkrrrkr#", "#rrrrrrr#", "#ppppppp#", "#pdpdpdp#", "#ppppppp#", "#pdphpdp#", "#ppppppp#", "#########"],
        ["#": "#8a5a3c", "k": "#3a2a26", "r": "#c4453f", "p": "#fffaf0", "d": "#b9a98f", "h": "#d9534f"]
    )
    static let flame = Icons.flame
    static let flameOut = Icons.flameOut
}
