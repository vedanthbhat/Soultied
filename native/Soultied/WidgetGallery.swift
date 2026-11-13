import SwiftUI
import UIKit
import SoultiedCore

/*
 * The home-screen widgets, drawn by the app at their real sizes on a pretend home screen, so each build's
 * screenshots show them (a simulator can't put a widget on its home screen from a script).
 *   -widgets doodle | board | empty
 */
struct WidgetGallery: View {
    let which: String

    // (an iPhone 15 Pro's widget sizes)
    private let small = CGSize(width: 158, height: 158)
    private let medium = CGSize(width: 338, height: 158)
    private let large = CGSize(width: 338, height: 354)

    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(hex: "#3b4f86"), Color(hex: "#8f6aa0"), Color(hex: "#d9967f")], startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()
            VStack(spacing: 20) {
                switch which {
                case "board":
                    HStack(spacing: 22) {
                        tile(small) { board(.small, Self.photos) }
                        tile(small) { board(.small, []) }
                    }
                    tile(medium) { board(.medium, Self.photos) }
                    tile(large) { board(.large, Array(Self.photos.prefix(3)) + [BoardItem(id: "d", caption: "from Rohan", doodle: Doodle.demo)]) }
                case "empty":
                    HStack(spacing: 22) {
                        tile(small) { doodle(.small, .wood, nil, setUp: false) }
                        tile(small) { board(.small, [], setUp: false) }
                    }
                    tile(medium) { doodle(.medium, .rose, nil, setUp: true) }
                    tile(large) { board(.large, [], setUp: true) }
                default:
                    HStack(spacing: 22) {
                        tile(small) { doodle(.small, .wood, Doodle.demo) }
                        tile(small) { doodle(.small, .night, Doodle.demo) }
                    }
                    tile(medium) { doodle(.medium, .gold, Doodle.demo) }
                    tile(large) { doodle(.large, .rose, Doodle.demo) }
                }
            }
        }
    }

    private func tile<V: View>(_ size: CGSize, @ViewBuilder _ face: () -> V) -> some View {
        face()
            .frame(width: size.width, height: size.height)
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .shadow(color: .black.opacity(0.25), radius: 8, y: 4)
    }

    private func doodle(_ size: WidgetSize, _ look: FrameLook, _ px: String?, setUp: Bool = true) -> some View {
        DoodleCard(px: px, name: "Rohan", at: Date().timeIntervalSince1970 * 1000 - 3 * 3600e3, look: look, size: size, setUp: setUp)
            .background(FrameWall(look: look))
    }

    private func board(_ size: WidgetSize, _ items: [BoardItem], setUp: Bool = true) -> some View {
        BoardCard(items: items, size: size, setUp: setUp)
            .background(CorkBoard())
    }

    /// pretend photos for the demo room's board: a sunset over the sea, chai, the hills, a rainy window
    static let photos: [BoardItem] = [
        BoardItem(id: "p0", image: scene { ctx, s in
            band(ctx, s, ["#f2b16b", "#e8875f", "#b85a6a", "#5f4a86"])
            ctx.setFillColor(UIColor(hex: "#ffe3a3").cgColor)
            ctx.fillEllipse(in: CGRect(x: s * 0.36, y: s * 0.42, width: s * 0.28, height: s * 0.28))
            ctx.setFillColor(UIColor(hex: "#2f4f7a").cgColor)
            ctx.fill(CGRect(x: 0, y: s * 0.62, width: s, height: s * 0.38))
            ctx.setFillColor(UIColor(hex: "#f7c98a").withAlphaComponent(0.7).cgColor)
            for i in 0..<5 { ctx.fill(CGRect(x: s * (0.38 + Double(i % 2) * 0.04), y: s * (0.66 + Double(i) * 0.05), width: s * 0.2, height: s * 0.015)) }
        }, caption: "Goa, finally"),
        BoardItem(id: "p1", image: scene { ctx, s in
            band(ctx, s, ["#7a5a48", "#8a6450"])
            ctx.setFillColor(UIColor(hex: "#f4e8d0").cgColor)
            ctx.fill(CGRect(x: s * 0.28, y: s * 0.4, width: s * 0.44, height: s * 0.42))
            ctx.fill(CGRect(x: s * 0.72, y: s * 0.48, width: s * 0.1, height: s * 0.2))
            ctx.setFillColor(UIColor(hex: "#c98a52").cgColor)
            ctx.fill(CGRect(x: s * 0.31, y: s * 0.43, width: s * 0.38, height: s * 0.1))
            ctx.setFillColor(UIColor(hex: "#fff8ea").withAlphaComponent(0.6).cgColor)
            for i in 0..<3 { ctx.fill(CGRect(x: s * (0.38 + Double(i) * 0.1), y: s * (0.16 + Double(i % 2) * 0.06), width: s * 0.03, height: s * 0.16)) }
        }, caption: "our first chai"),
        BoardItem(id: "p2", image: scene { ctx, s in
            band(ctx, s, ["#a9d0e8", "#cfe3ef"])
            ctx.setFillColor(UIColor(hex: "#6a7856").cgColor)
            ctx.move(to: CGPoint(x: 0, y: s * 0.8)); ctx.addLine(to: CGPoint(x: s * 0.35, y: s * 0.38)); ctx.addLine(to: CGPoint(x: s * 0.7, y: s * 0.8)); ctx.fillPath()
            ctx.setFillColor(UIColor(hex: "#4f7a45").cgColor)
            ctx.move(to: CGPoint(x: s * 0.3, y: s * 0.85)); ctx.addLine(to: CGPoint(x: s * 0.68, y: s * 0.46)); ctx.addLine(to: CGPoint(x: s, y: s * 0.8)); ctx.fillPath()
            ctx.setFillColor(UIColor(hex: "#7a9a5a").cgColor)
            ctx.fill(CGRect(x: 0, y: s * 0.8, width: s, height: s * 0.2))
        }, caption: "the hills trip"),
        BoardItem(id: "p3", image: scene { ctx, s in
            band(ctx, s, ["#5d6b85", "#7d8aa3"])
            ctx.setFillColor(UIColor(hex: "#cfd8e6").withAlphaComponent(0.5).cgColor)
            for i in 0..<14 { ctx.fill(CGRect(x: s * Double((i * 37) % 100) / 100, y: s * Double((i * 53) % 100) / 100, width: s * 0.012, height: s * 0.07)) }
            ctx.setFillColor(UIColor(hex: "#3a2a26").cgColor)
            ctx.fill(CGRect(x: s * 0.48, y: 0, width: s * 0.04, height: s))
            ctx.fill(CGRect(x: 0, y: s * 0.48, width: s, height: s * 0.04))
        }, caption: "rainy Sunday"),
    ]

    private static func scene(_ draw: (CGContext, Double) -> Void) -> UIImage {
        let s = 240.0
        let f = UIGraphicsImageRendererFormat()
        f.scale = 1
        return UIGraphicsImageRenderer(size: CGSize(width: s, height: s), format: f).image { draw($0.cgContext, s) }
    }

    private static func band(_ ctx: CGContext, _ s: Double, _ colors: [String]) {
        for (i, c) in colors.enumerated() {
            ctx.setFillColor(UIColor(hex: c).cgColor)
            ctx.fill(CGRect(x: 0, y: s * Double(i) / Double(colors.count), width: s, height: s / Double(colors.count) + 1))
        }
    }
}

private extension UIColor {
    convenience init(hex: String) {
        let c = RGB(hex)
        self.init(red: CGFloat(c.r) / 255, green: CGFloat(c.g) / 255, blue: CGFloat(c.b) / 255, alpha: 1)
    }
}
