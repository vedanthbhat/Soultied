import SwiftUI
import UIKit
import SoultiedCore

/*
 * The other home-screen widget's face: a cork board with your newest wall photos pinned up as Polaroids
 * (and, on the big one, your person's last doodle on a sticky note). Drawn by the widget and, for the
 * screenshots, by the app (WidgetGallery).
 */

/// one thing pinned to the board: a photo, or a doodle on a sticky note
struct BoardItem: Identifiable {
    let id: String
    var image: UIImage?
    var caption: String
    /// a doodle instead of a photo
    var doodle: String?
}

private func hex(_ s: String) -> Color {
    let c = RGB(s)
    return Color(.sRGB, red: Double(c.r) / 255, green: Double(c.g) / 255, blue: Double(c.b) / 255, opacity: 1)
}

private let inkC = hex("#3a2a26")

/// cork, speckled (the same speckles every time)
struct CorkBoard: View {
    var body: some View {
        Canvas { ctx, size in
            ctx.fill(Path(CGRect(origin: .zero, size: size)), with: .color(hex("#c99a64")))
            var seed: UInt32 = 20_261_113
            func next() -> CGFloat {
                seed = seed &* 1_664_525 &+ 1_013_904_223
                return CGFloat(seed >> 8) / CGFloat(1 << 24)
            }
            let dark = hex("#b3844f"), light = hex("#ddb27f")
            for i in 0..<260 {
                let x = (next() * size.width).rounded(), y = (next() * size.height).rounded()
                ctx.fill(Path(CGRect(x: x, y: y, width: 2, height: 2)), with: .color(i % 3 == 0 ? light : dark))
            }
        }
    }
}

/// a red pixel push pin
private struct PushPin: View {
    private static let rows = [".rrrr.", "rhrrrr", "rhrrrr", "rrrrrs", ".rrss.", "..kk..", "..k..."]
    var body: some View {
        Canvas { ctx, size in
            let p = size.width / 6
            for (j, row) in Self.rows.enumerated() {
                for (i, ch) in row.enumerated() {
                    let c: Color? = ch == "r" ? hex("#c4453f") : ch == "h" ? hex("#ef8f88") : ch == "s" ? hex("#8f2f2a") : ch == "k" ? hex("#8d8a99") : nil
                    if let c { ctx.fill(Path(CGRect(x: CGFloat(i) * p, y: CGFloat(j) * p, width: p, height: p)), with: .color(c)) }
                }
            }
        }
    }
}

/// a Polaroid (or a sticky note with a doodle), `width` points wide
struct PolaroidView: View {
    let item: BoardItem?
    let width: CGFloat

    static func height(_ width: CGFloat) -> CGFloat {
        let m = max(4, (width * 0.06).rounded())
        return m + (width - 2 * m) + max(14, (width * 0.17).rounded()) + 4
    }

    var body: some View {
        let m = max(4, (width * 0.06).rounded())
        let inner = width - 2 * m
        let cap = max(14, (width * 0.17).rounded())
        let note = item?.doodle != nil
        VStack(spacing: 0) {
            ZStack {
                if let d = item?.doodle, let img = FrameArt.image(d) {
                    hex("#fbf3e2")
                    Image(decorative: img, scale: 1).resizable().interpolation(.none).aspectRatio(contentMode: .fit)
                } else if let img = item?.image {
                    hex("#d6c29c")
                    Image(uiImage: img).resizable().scaledToFill()
                } else {
                    hex("#e8dcc4")
                    Text("+").font(WidgetFont.px(inner * 0.3, bold: true)).foregroundStyle(hex("#b9a98f"))
                }
            }
            .frame(width: inner, height: inner)
            .clipped()
            Text((item?.caption ?? "").isEmpty ? " " : item!.caption)
                .font(WidgetFont.px(max(9, min(12, width * 0.095))))
                .foregroundStyle(inkC)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .frame(width: inner, height: cap)
        }
        .padding([.top, .horizontal], m)
        .padding(.bottom, 4)
        .background(note ? hex("#f6e39a") : hex("#fffaf0"))
        .padding(2)
        .background(inkC)
        .compositingGroup()
        .shadow(color: .black.opacity(0.3), radius: 0, x: 3, y: 3)
        .overlay(alignment: .top) {
            if note {
                // a strip of tape
                Rectangle().fill(hex("#fff4e2").opacity(0.75)).frame(width: width * 0.4, height: max(8, width * 0.1)).offset(y: -4).rotationEffect(.degrees(-3))
            } else {
                PushPin().frame(width: max(9, width * 0.1), height: max(10.5, width * 0.117)).offset(y: -5)
            }
        }
    }
}

/// the whole board (the cork's drawn behind it, as the widget's background)
struct BoardCard: View {
    /// newest first; photos, then maybe a doodle
    let items: [BoardItem]
    let size: WidgetSize
    let setUp: Bool

    private static let tilts: [Double] = [-4, 3, -2, 4]
    private static let nudges: [CGFloat] = [4, -3, 5, -2]

    private var emptyCaption: String { setUp ? "Add a photo" : "Open Soultied" }
    private var blurb: String {
        setUp ? "Put photos on your wall in Soultied: the newest pin up here." : "Open Soultied and pair up: your photos pin up here."
    }

    var body: some View {
        GeometryReader { geo in
            let W = geo.size.width, H = geo.size.height
            switch size {
            case .small:
                let w = min(W - 40, (H - 24) / 1.18)
                ZStack {
                    if items.count > 1 {
                        PolaroidView(item: items[1], width: w * 0.92).rotationEffect(.degrees(7)).offset(x: 12, y: -6)
                    }
                    PolaroidView(item: items.first ?? BoardItem(id: "", caption: emptyCaption), width: w).rotationEffect(.degrees(-4))
                }
                .frame(width: W, height: H)
            case .medium:
                if items.isEmpty {
                    HStack(spacing: 16) {
                        PolaroidView(item: BoardItem(id: "", caption: emptyCaption), width: min(100, (H - 30) / 1.18)).rotationEffect(.degrees(-4))
                        PaperLabel(text: blurb)
                    }
                    .frame(width: W, height: H)
                } else {
                    let n = min(3, items.count)
                    let w = min((W - 32 - CGFloat(n - 1) * 12) / 3, (H - 30) / 1.18)
                    HStack(spacing: 12) {
                        ForEach(Array(items.prefix(3).enumerated()), id: \.element.id) { i, it in
                            PolaroidView(item: it, width: w).rotationEffect(.degrees(Self.tilts[i])).offset(y: Self.nudges[i])
                        }
                    }
                    .frame(width: W, height: H)
                }
            case .large:
                let w = min((W - 56) / 2, (H - 70) / 2 / 1.18)
                VStack(spacing: 10) {
                    PaperLabel(text: items.isEmpty ? blurb : "Our board").padding(.top, 14)
                    VStack(spacing: 18) {
                        HStack(spacing: 26) {
                            cell(0, w)
                            cell(1, w)
                        }
                        HStack(spacing: 26) {
                            cell(2, w)
                            cell(3, w)
                        }
                    }
                    Spacer(minLength: 0)
                }
                .frame(width: W, height: H)
            }
        }
    }

    /// one place on the big board (an empty board still shows one blank Polaroid, asking for a photo)
    @ViewBuilder
    private func cell(_ i: Int, _ w: CGFloat) -> some View {
        let it: BoardItem? = i < items.count ? items[i] : (i == 0 ? BoardItem(id: "", caption: emptyCaption) : nil)
        if let it {
            PolaroidView(item: it, width: w).rotationEffect(.degrees(Self.tilts[i])).offset(y: Self.nudges[i] / 2)
        } else {
            Color.clear.frame(width: w, height: PolaroidView.height(w))
        }
    }

    /// a strip of paper pinned on, with a few words on it
    private struct PaperLabel: View {
        let text: String
        var body: some View {
            Text(text)
                .font(WidgetFont.px(13, bold: true))
                .foregroundStyle(inkC)
                .multilineTextAlignment(.leading)
                .lineLimit(3)
                .minimumScaleFactor(0.75)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(hex("#fffaf0"))
                .padding(2)
                .background(inkC)
                .rotationEffect(.degrees(-1.5))
                .shadow(color: .black.opacity(0.25), radius: 0, x: 2, y: 2)
        }
    }
}
