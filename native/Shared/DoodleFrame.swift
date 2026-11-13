import SwiftUI
import UIKit
import CoreText
import SoultiedCore

/*
 * The home-screen widget's face: your person's last doodle, hung in a little pixel frame on a nail, on a
 * striped wall. Drawn by the widget (SoultiedWidget) and, for the screenshots, by the app (WidgetGallery).
 */

/// the frames you can pick for it (press and hold the widget, Edit Widget)
enum FrameLook: String, CaseIterable {
    case wood, gold, rose, night

    struct Colors {
        let wall: Color
        let stripe: Color
        let band: Color
        let bandHi: Color
        let bandLo: Color
        let mat: Color
        let ink: Color
        let text: Color
        let sub: Color
        let chip: Color
        let chipText: Color
    }

    var colors: Colors {
        switch self {
        case .wood:
            return Colors(wall: hex("#f1e3c8"), stripe: hex("#e9d8b8"), band: hex("#8a5a3c"), bandHi: hex("#b07a52"), bandLo: hex("#5e3a26"),
                          mat: hex("#fbf3e2"), ink: hex("#3a2a26"), text: hex("#3a2a26"), sub: hex("#7a5a48"), chip: hex("#b8674f"), chipText: hex("#fff4e2"))
        case .gold:
            return Colors(wall: hex("#e3e7d3"), stripe: hex("#d8dec4"), band: hex("#d99a2b"), bandHi: hex("#f2d66b"), bandLo: hex("#a8701c"),
                          mat: hex("#fffaf0"), ink: hex("#3a2a26"), text: hex("#3a2a26"), sub: hex("#5f6b4c"), chip: hex("#6a7856"), chipText: hex("#fff4e2"))
        case .rose:
            return Colors(wall: hex("#f7e0da"), stripe: hex("#f0d2cb"), band: hex("#e38780"), bandHi: hex("#f6b9b3"), bandLo: hex("#b24c46"),
                          mat: hex("#fffaf0"), ink: hex("#3a2a26"), text: hex("#3a2a26"), sub: hex("#8a5a56"), chip: hex("#c4453f"), chipText: hex("#fff4e2"))
        case .night:
            return Colors(wall: hex("#232447"), stripe: hex("#2a2a50"), band: hex("#9a86c8"), bandHi: hex("#c4b6e6"), bandLo: hex("#6e56a8"),
                          mat: hex("#fbf3e2"), ink: hex("#14122a"), text: hex("#f4e7c9"), sub: hex("#bdb0cf"), chip: hex("#6e56a8"), chipText: hex("#fff6ea"))
        }
    }
}

private func hex(_ s: String) -> Color {
    let c = RGB(s)
    return Color(.sRGB, red: Double(c.r) / 255, green: Double(c.g) / 255, blue: Double(c.b) / 255, opacity: 1)
}

enum WidgetSize { case small, medium, large }

/// the pixel font (Pixelify Sans, in each one's bundle), or the system's if it isn't there
enum WidgetFont {
    static func px(_ size: CGFloat, bold: Bool = false) -> Font {
        var attrs: [UIFontDescriptor.AttributeName: Any] = [.name: "PixelifySans-Regular"]
        attrs[UIFontDescriptor.AttributeName(rawValue: kCTFontVariationAttribute as String)] = [0x7767_6874: bold ? 700 : 400]
        // (no ligatures: the font's "fi" and "fl" would come out as one odd letter)
        attrs[.featureSettings] = [[UIFontDescriptor.FeatureKey.type: kLigaturesType, UIFontDescriptor.FeatureKey.selector: kCommonLigaturesOffSelector]]
        let f = UIFont(descriptor: UIFontDescriptor(fontAttributes: attrs), size: size)
        let use = f.familyName == "Pixelify Sans" ? f : UIFont.systemFont(ofSize: size, weight: bold ? .bold : .regular)
        return Font(use as CTFont)
    }
}

/// a doodle as a picture, a pixel a pixel (it's scaled up without smoothing)
enum FrameArt {
    static func image(_ px: String) -> CGImage? {
        guard Doodle.isDoodle(px) else { return nil }
        let pal = DOODLE_PAL.map { RGB($0) }
        var data = [UInt8](repeating: 255, count: DOODLE_W * DOODLE_H * 4)
        for (i, ch) in Doodle.full(px).utf8.enumerated() where i < DOODLE_W * DOODLE_H {
            let k = ch >= 97 ? Int(ch) - 87 : Int(ch) - 48
            let c = pal[max(0, min(15, k))]
            data[i * 4] = c.r
            data[i * 4 + 1] = c.g
            data[i * 4 + 2] = c.b
        }
        guard let provider = CGDataProvider(data: Data(data) as CFData) else { return nil }
        return CGImage(
            width: DOODLE_W, height: DOODLE_H, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: DOODLE_W * 4,
            space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.last.rawValue),
            provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent
        )
    }
}

/// the wall behind it: wallpaper stripes (and a few stars, at night)
struct FrameWall: View {
    let look: FrameLook
    var body: some View {
        let c = look.colors
        Canvas { ctx, size in
            ctx.fill(Path(CGRect(origin: .zero, size: size)), with: .color(c.wall))
            var x: CGFloat = 4
            while x < size.width {
                ctx.fill(Path(CGRect(x: x, y: 0, width: 6, height: size.height)), with: .color(c.stripe))
                x += 16
            }
            if look == .night {
                for (fx, fy) in [(0.08, 0.12), (0.9, 0.08), (0.82, 0.86), (0.14, 0.9), (0.5, 0.05), (0.95, 0.5)] {
                    ctx.fill(Path(CGRect(x: size.width * fx, y: size.height * fy, width: 2, height: 2)), with: .color(hex("#f4e7c9").opacity(0.8)))
                }
            }
        }
    }
}

/// the frame's moulding: lit along the top and left, shadowed along the bottom and right
private struct FrameBand: View {
    let look: FrameLook
    let band: CGFloat
    var body: some View {
        let c = look.colors
        Canvas { ctx, size in
            let w = size.width, h = size.height, e = max(2, (band / 3).rounded())
            ctx.fill(Path(CGRect(x: 0, y: 0, width: w, height: h)), with: .color(c.band))
            ctx.fill(Path(CGRect(x: 0, y: 0, width: w, height: e)), with: .color(c.bandHi))
            ctx.fill(Path(CGRect(x: 0, y: 0, width: e, height: h)), with: .color(c.bandHi))
            ctx.fill(Path(CGRect(x: 0, y: h - e, width: w, height: e)), with: .color(c.bandLo))
            ctx.fill(Path(CGRect(x: w - e, y: e, width: e, height: h - e)), with: .color(c.bandLo))
        }
    }
}

/// a nail, and the string the frame hangs from
private struct Hanger: View {
    let color: Color
    var body: some View {
        Canvas { ctx, size in
            let mid = size.width / 2
            var s = Path()
            s.move(to: CGPoint(x: mid - size.width * 0.26, y: size.height))
            s.addLine(to: CGPoint(x: mid, y: 3))
            s.addLine(to: CGPoint(x: mid + size.width * 0.26, y: size.height))
            ctx.stroke(s, with: .color(color.opacity(0.75)), lineWidth: 1.5)
            ctx.fill(Path(CGRect(x: mid - 2, y: 0, width: 4, height: 4)), with: .color(color))
        }
    }
}

/// a little pixel heart, for an empty frame
private struct PixelHeart: View {
    let color: Color
    private static let rows = [".xx.xx.", "xxxxxxx", "xxxxxxx", ".xxxxx.", "..xxx..", "...x..."]
    var body: some View {
        Canvas { ctx, size in
            let p = min(size.width / 7, size.height / 6)
            for (j, row) in Self.rows.enumerated() {
                for (i, ch) in row.enumerated() where ch == "x" {
                    ctx.fill(Path(CGRect(x: CGFloat(i) * p, y: CGFloat(j) * p, width: p, height: p)), with: .color(color))
                }
            }
        }
    }
}

/// a doodle in its frame, hung on a nail (the nail sits just above the frame)
struct FramedDoodle: View {
    let px: String?
    let look: FrameLook
    var band: CGFloat = 8

    var body: some View {
        let c = look.colors
        ZStack {
            c.mat
            if let px, let img = FrameArt.image(px) {
                Image(decorative: img, scale: 1)
                    .resizable()
                    .interpolation(.none)
            } else {
                PixelHeart(color: c.band.opacity(0.6)).frame(width: 21, height: 18)
            }
        }
        .aspectRatio(CGFloat(DOODLE_W) / CGFloat(DOODLE_H), contentMode: .fit)
        .padding(3)
        .background(c.mat)
        .padding(2)
        .background(c.ink)
        .padding(band)
        .background(FrameBand(look: look, band: band))
        .padding(2)
        .background(c.ink)
        .compositingGroup()
        .shadow(color: .black.opacity(0.28), radius: 0, x: 3, y: 3)
        .overlay(alignment: .top) {
            Hanger(color: c.ink).frame(height: 12).offset(y: -12)
        }
    }
}

/// what it looks like as a button (the whole widget's the button: it opens the doodle pad)
private struct WidgetChip: View {
    let text: String
    let look: FrameLook
    var body: some View {
        let c = look.colors
        Text(text)
            .font(WidgetFont.px(12, bold: true))
            .foregroundStyle(c.chipText)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            .padding(.horizontal, 9)
            .padding(.vertical, 5)
            .background(c.chip)
            .padding(2)
            .background(c.ink)
    }
}

/// the widget's whole face (its wall is drawn behind it, as the widget's background)
struct DoodleCard: View {
    let px: String?
    /// your person's name ("" if there isn't one yet)
    let name: String
    /// when they pinned it up (ms)
    let at: Double?
    let look: FrameLook
    let size: WidgetSize
    /// signed in, with a person
    let setUp: Bool
    var now = Date()

    private var who: String { name.isEmpty ? "your person" : name }
    private var title: String {
        if !setUp { return "Your person’s doodles" }
        return px == nil ? "Nothing from \(who) yet" : "From \(who)"
    }
    private var subtitle: String {
        if !setUp { return "Open Soultied and pair up: their doodles hang here." }
        if px == nil { return "When \(who) draws you something, it hangs here." }
        return at.map { WidgetShare.ago($0, now: now) } ?? ""
    }
    private var caption: String {
        if !setUp { return "Open Soultied" }
        guard px != nil else { return "Nothing yet" }
        return at.map { "\(who) · \(WidgetShare.ago($0, now: now))" } ?? who
    }
    private var chip: String { !setUp ? "Open Soultied" : px == nil ? "Draw them one" : "Draw one back" }

    var body: some View {
        let c = look.colors
        switch size {
        case .small:
            VStack(spacing: 7) {
                FramedDoodle(px: px, look: look, band: 6)
                    .padding(.top, 12)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                Text(caption)
                    .font(WidgetFont.px(11, bold: true))
                    .foregroundStyle(c.text)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }
            .padding(12)
        case .medium:
            HStack(spacing: 14) {
                FramedDoodle(px: px, look: look, band: 7)
                    .padding(.top, 12)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                VStack(alignment: .leading, spacing: 4) {
                    Text(title).font(WidgetFont.px(16, bold: true)).foregroundStyle(c.text).lineLimit(2).minimumScaleFactor(0.7)
                    Text(subtitle).font(WidgetFont.px(12)).foregroundStyle(c.sub).lineLimit(3).minimumScaleFactor(0.8)
                    Spacer(minLength: 4)
                    WidgetChip(text: chip, look: look)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            }
            .padding(14)
        case .large:
            VStack(spacing: 14) {
                FramedDoodle(px: px, look: look, band: 10)
                    .padding(.top, 16)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                HStack(alignment: .bottom, spacing: 10) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(title).font(WidgetFont.px(17, bold: true)).foregroundStyle(c.text).lineLimit(1).minimumScaleFactor(0.7)
                        Text(subtitle).font(WidgetFont.px(12)).foregroundStyle(c.sub).lineLimit(2).minimumScaleFactor(0.8)
                    }
                    Spacer(minLength: 6)
                    WidgetChip(text: chip, look: look)
                }
            }
            .padding(16)
        }
    }
}
