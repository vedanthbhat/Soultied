import SwiftUI
import UIKit
import CoreText
import SoultiedCore

/*
 * Soultied's look, the same as the website's pixel kit (src/index.css): paper cards with a hard ink edge
 * and notched corners, terracotta and sage buttons, Pixelify Sans everywhere, the dark room around it all.
 * (The colours come from the look that's on: Cozy, or Starlight's purple night. See Looks.swift.)
 */

extension Color {
    init(hex: String) {
        let c = RGB(hex)
        self.init(.sRGB, red: Double(c.r) / 255, green: Double(c.g) / 255, blue: Double(c.b) / 255, opacity: 1)
    }

    // (the look that's on: Cozy or Starlight, Looks.swift)
    static var ink: Color { Palette.now.ink }
    static var inkSoft: Color { Palette.now.inkSoft }
    static var muted: Color { Palette.now.muted }
    static var paper: Color { Palette.now.paper }
    static var paper2: Color { Palette.now.paper2 }
    static var paperShade: Color { Palette.now.paperShade }
    static var paperHi: Color { Palette.now.paperHi }
    static var paperInput: Color { Palette.now.paperInput }
    static var terracotta: Color { Palette.now.terracotta }
    static var terracottaD: Color { Palette.now.terracottaD }
    static var sage: Color { Palette.now.sage }
    static var sageD: Color { Palette.now.sageD }
    static var thread: Color { Palette.now.thread }
    static var butter: Color { Palette.now.butter }
    static var cream: Color { Palette.now.cream }
    /// the dark around the room
    static var room: Color { Palette.now.room }
    static var roomBrown: Color { Palette.now.roomBrown }
    static var night: Color { Palette.now.night }
}

/* ---------- the pixel font ---------- */

enum PixelFont {
    /// (making a font at a weight is slow enough to show when a screen's drawn: each one's made once)
    private static var made: [Int: UIFont] = [:]
    private static let lock = NSLock()

    /// Pixelify Sans at a weight (it's a variable font: 400 to 700), with its odd fi/fl ligatures off
    static func ui(_ size: CGFloat, _ weight: CGFloat = 400) -> UIFont {
        let key = Int((size * 100).rounded()) * 1000 + Int(weight.rounded())
        lock.lock()
        defer { lock.unlock() }
        if let f = made[key] { return f }
        let f = make(size, weight)
        if f.familyName == "Pixelify Sans" { made[key] = f }
        return f
    }

    private static func make(_ size: CGFloat, _ weight: CGFloat) -> UIFont {
        var attrs: [UIFontDescriptor.AttributeName: Any] = [.name: "PixelifySans-Regular"]
        attrs[UIFontDescriptor.AttributeName(rawValue: kCTFontVariationAttribute as String)] = [0x7767_6874: weight]
        attrs[.featureSettings] = [[UIFontDescriptor.FeatureKey.type: kLigaturesType, UIFontDescriptor.FeatureKey.selector: kCommonLigaturesOffSelector]]
        let f = UIFont(descriptor: UIFontDescriptor(fontAttributes: attrs), size: size)
        return f.familyName == "Pixelify Sans" ? f : UIFont.systemFont(ofSize: size, weight: weight >= 600 ? .bold : .regular)
    }
}

extension Font {
    static func px(_ size: CGFloat, _ weight: CGFloat = 400) -> Font {
        let key = Int((size * 100).rounded()) * 1000 + Int(weight.rounded())
        if let f = pxMade[key] { return f }
        let f = Font(PixelFont.ui(size, weight) as CTFont)
        pxMade[key] = f
        return f
    }
    /// (fonts are asked for in views' bodies, on the main thread)
    private static var pxMade: [Int: Font] = [:]
    static let pxTitle = px(28, 700)
    static let pxHeading = px(21, 700)
    static let pxBody = px(17)
    static let pxBodyBold = px(17, 600)
    static let pxSmall = px(14)
    static let pxTiny = px(12)
}

/* ---------- boxes ---------- */

/// a rectangle `notch` wide on every side, its corners left out (the web's four box-shadows)
struct NotchedFrame: Shape {
    var notch: CGFloat
    func path(in r: CGRect) -> Path {
        let p = notch, x0 = r.minX, y0 = r.minY, x1 = r.maxX, y1 = r.maxY
        var path = Path()
        path.move(to: CGPoint(x: x0 + p, y: y0))
        path.addLine(to: CGPoint(x: x1 - p, y: y0))
        path.addLine(to: CGPoint(x: x1 - p, y: y0 + p))
        path.addLine(to: CGPoint(x: x1, y: y0 + p))
        path.addLine(to: CGPoint(x: x1, y: y1 - p))
        path.addLine(to: CGPoint(x: x1 - p, y: y1 - p))
        path.addLine(to: CGPoint(x: x1 - p, y: y1))
        path.addLine(to: CGPoint(x: x0 + p, y: y1))
        path.addLine(to: CGPoint(x: x0 + p, y: y1 - p))
        path.addLine(to: CGPoint(x: x0, y: y1 - p))
        path.addLine(to: CGPoint(x: x0, y: y0 + p))
        path.addLine(to: CGPoint(x: x0 + p, y: y0 + p))
        path.closeSubpath()
        return path
    }
}

let PX: CGFloat = 3

/// The paper card: an ink edge with notched corners, a light line along the top and a shade along the bottom.
struct PixelBox: ViewModifier {
    var fill: Color = .paper
    var edge: Color = .ink
    var hi: Color? = .paperHi
    var shade: Color? = .paperShade
    var shadow = false

    func body(content: Content) -> some View {
        content
            .background(
                ZStack {
                    if shadow {
                        NotchedFrame(notch: PX).fill(Color.black.opacity(0.35)).padding(-PX).offset(x: PX * 2, y: PX * 2)
                    }
                    NotchedFrame(notch: PX).fill(edge).padding(-PX)
                    Rectangle().fill(fill)
                    VStack(spacing: 0) {
                        if let hi { Rectangle().fill(hi).frame(height: PX) }
                        Spacer(minLength: 0)
                        if let shade { Rectangle().fill(shade).frame(height: PX * 2) }
                    }
                }
            )
            .padding(PX)
    }
}

/// a sunken panel inside a card (the web's px-inset)
struct PixelInset: ViewModifier {
    func body(content: Content) -> some View {
        content.background(
            ZStack {
                NotchedFrame(notch: PX).fill(Color.paperShade).padding(-PX)
                Rectangle().fill(Color.paper2)
                VStack(spacing: 0) {
                    Rectangle().fill(Color.paperShade.opacity(0.6)).frame(height: PX)
                    Spacer(minLength: 0)
                }
            }
        )
        .padding(PX)
    }
}

extension View {
    func pxBox(_ fill: Color = .paper, shadow: Bool = false) -> some View {
        modifier(PixelBox(fill: fill, hi: fill == .paper ? .paperHi : nil, shade: fill == .paper ? .paperShade : nil, shadow: shadow))
    }
    func pxCard(shadow: Bool = true) -> some View {
        padding(16).frame(maxWidth: .infinity, alignment: .leading).modifier(PixelBox(shadow: shadow))
    }
    func pxInset() -> some View { modifier(PixelInset()) }
    /// ink on paper, in the pixel font
    func pxText(_ font: Font = .pxBody, _ color: Color = .inkSoft) -> some View { self.font(font).foregroundStyle(color) }
}

/* ---------- buttons ---------- */

enum PixelTone {
    case terracotta, sage, paper, ink, night
    var bg: Color {
        switch self {
        case .terracotta: return .terracotta
        case .sage: return .sage
        case .paper: return .paper
        case .ink: return .inkSoft
        case .night: return Color(hex: "#4a3a5a")
        }
    }
    var dark: Color {
        switch self {
        case .terracotta: return .terracottaD
        case .sage: return .sageD
        case .paper: return .paperShade
        case .ink: return Palette.now.inkDeep
        case .night: return Color(hex: "#30263d")
        }
    }
    var fg: Color {
        switch self {
        case .paper: return .inkSoft
        case .ink: return .paper
        default: return .cream
        }
    }
}

struct PixelButtonStyle: ButtonStyle {
    var tone: PixelTone = .terracotta
    var small = false
    var wide = false
    @Environment(\.isEnabled) private var enabled
    @Environment(\.evenRow) private var even

    func makeBody(configuration: Configuration) -> some View {
        let pressed = configuration.isPressed
        let bg = enabled ? tone.bg : Palette.now.disabled
        let dark = enabled ? tone.dark : Palette.now.disabledD
        return configuration.label
            .font(small ? .px(15, 600) : .px(18, 600))
            .foregroundStyle(enabled ? tone.fg : Color.cream.opacity(0.85))
            .lineLimit(2)
            .multilineTextAlignment(.center)
            .padding(.horizontal, small ? 12 : 18)
            .padding(.vertical, small ? 7 : 11)
            .frame(maxWidth: wide ? .infinity : nil, maxHeight: wide && even ? .infinity : nil)
            .background(
                ZStack {
                    NotchedFrame(notch: PX).fill(Color.ink).padding(-PX)
                    Rectangle().fill(bg)
                    VStack(spacing: 0) {
                        Rectangle().fill(pressed ? dark : Color.white.opacity(0.22)).frame(height: PX)
                        Spacer(minLength: 0)
                        if !pressed { Rectangle().fill(dark).frame(height: PX * 1.5) }
                    }
                }
            )
            .padding(PX)
            .offset(y: pressed ? 2 : 0)
            .contentShape(Rectangle())
            .onChange(of: pressed) { _, down in
                if down && enabled { Feedback.press() }
            }
    }
}

/// Pressing something: a soft tick and a light tap under your finger, kept small (and quiet when the ring
/// switch is, or Sounds is off in Us).
enum Feedback {
    private static var last = Date.distantPast
    static func press() {
        let now = Date()
        guard now.timeIntervalSince(last) > 0.06 else { return }
        last = now
        Haptics.tap()
        Chiptune.shared.tick()
    }
}

/// a card or a row you can tap: it gives a little under your finger, with the same tick and tap
struct PressStyle: ButtonStyle {
    @Environment(\.isEnabled) private var enabled
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.easeOut(duration: 0.08), value: configuration.isPressed)
            .onChange(of: configuration.isPressed) { _, down in
                if down && enabled { Feedback.press() }
            }
    }
}

extension ButtonStyle where Self == PressStyle {
    static var press: PressStyle { PressStyle() }
}

private struct EvenRowKey: EnvironmentKey { static let defaultValue = false }
extension EnvironmentValues {
    var evenRow: Bool {
        get { self[EvenRowKey.self] }
        set { self[EvenRowKey.self] = newValue }
    }
}

extension View {
    /// a row of wide buttons that all stand as tall as the tallest (when one's words wrap onto two lines)
    func evenRow() -> some View {
        environment(\.evenRow, true).fixedSize(horizontal: false, vertical: true)
    }
}

extension ButtonStyle where Self == PixelButtonStyle {
    static var px: PixelButtonStyle { PixelButtonStyle() }
    static func px(_ tone: PixelTone, small: Bool = false, wide: Bool = false) -> PixelButtonStyle { PixelButtonStyle(tone: tone, small: small, wide: wide) }
}

/// an answer tile on a letter card (the web's px-option)
struct OptionStyle: ButtonStyle {
    var selected = false
    var big = false
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.px(big ? 20 : 17, 600))
            .foregroundStyle(Color.inkSoft)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 12)
            .padding(.vertical, big ? 18 : 12)
            .frame(maxWidth: .infinity, minHeight: big ? 76 : 56)
            .background(
                ZStack {
                    NotchedFrame(notch: PX).fill(selected ? Color.terracotta : Color.ink).padding(-PX)
                    Rectangle().fill(selected ? Color(hex: "#fff1dc") : Color.paperHi)
                    VStack(spacing: 0) {
                        Spacer(minLength: 0)
                        Rectangle().fill(selected ? Color.terracotta.opacity(0.5) : Color.paperShade).frame(height: PX * 1.5)
                    }
                }
            )
            .padding(PX)
            .offset(y: configuration.isPressed ? 2 : 0)
            .contentShape(Rectangle())
            .onChange(of: configuration.isPressed) { _, down in
                if down { Feedback.press() }
            }
    }
}

/* ---------- text fields ---------- */

struct PixelField: View {
    var placeholder: String
    @Binding var text: String
    var limit: Int = 140
    var lines: Int = 1

    var body: some View {
        Group {
            if lines > 1 {
                TextField("", text: $text, prompt: Text(placeholder).foregroundColor(Color(hex: "#a08a74")), axis: .vertical)
                    .lineLimit(lines...max(lines, 10))
            } else {
                TextField("", text: $text, prompt: Text(placeholder).foregroundColor(Color(hex: "#a08a74")))
            }
        }
        .font(.pxBody)
        .foregroundStyle(Color.inkSoft)
        .tint(Color.terracotta)
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(
            ZStack {
                NotchedFrame(notch: PX).fill(Color.ink).padding(-PX)
                Rectangle().fill(Color.paperInput)
                VStack(spacing: 0) {
                    Rectangle().fill(Color.paperShade).frame(height: PX)
                    Spacer(minLength: 0)
                }
            }
        )
        .padding(PX)
        .onChange(of: text) { _, v in
            if v.count > limit { text = String(v.prefix(limit)) }
        }
    }
}

/// small label over a field
struct PixelLabel: View {
    var text: String
    var body: some View {
        Text(text).font(.px(14, 600)).foregroundStyle(Color.muted).kerning(0.3)
    }
}

/// a little tag ("This or that", "Day 7")
struct PixelTag: View {
    var text: String
    var night = false
    var body: some View {
        Text(text.uppercased())
            .font(.px(11, 700))
            .kerning(0.6)
            .foregroundStyle(night ? Color.paper : Color.cream)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(night ? Color(hex: "#4a3a5a") : Color.terracotta)
    }
}

/// a chip you can turn on and off (moods, choices in the wardrobe)
struct ChipStyle: ButtonStyle {
    var on = false
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.px(13, 500))
            .foregroundStyle(Color.inkSoft)
            .padding(.horizontal, 6)
            .padding(.vertical, 6)
            .frame(maxWidth: .infinity)
            .background(
                ZStack {
                    NotchedFrame(notch: PX).fill(on ? Color.terracotta : Color.paperShade).padding(-PX)
                    Rectangle().fill(on ? Color(hex: "#fff6e4") : Color.paper2)
                }
            )
            .padding(PX)
            .offset(y: configuration.isPressed ? 1 : 0)
            .contentShape(Rectangle())
    }
}

/* ---------- haptics ---------- */

enum Haptics {
    /// (one tap's worth at a time: a press and the action it starts don't both buzz)
    private static var last = Date.distantPast
    private static func once(_ f: () -> Void) {
        let now = Date()
        guard now.timeIntervalSince(last) > 0.25 else { return }
        last = now
        f()
    }
    static func tap() { once { UIImpactFeedbackGenerator(style: .light).impactOccurred() } }
    static func soft() { once { UIImpactFeedbackGenerator(style: .soft).impactOccurred() } }
    /// switching between tabs, or picking one of a few
    static func select() { once { UISelectionFeedbackGenerator().selectionChanged() } }
    static func success() { UINotificationFeedbackGenerator().notificationOccurred(.success) }
    /// a touch from your person: a hug is a long squeeze, a boop a quick tap
    static func touch(_ k: TouchKind) {
        switch k {
        case .boop:
            UIImpactFeedbackGenerator(style: .rigid).impactOccurred(intensity: 0.7)
        case .highfive:
            UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
        case .kiss, .forehead:
            let g = UIImpactFeedbackGenerator(style: .soft)
            g.impactOccurred(intensity: 0.8)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.18) { g.impactOccurred(intensity: 0.5) }
        case .hug, .hands:
            let g = UIImpactFeedbackGenerator(style: .soft)
            for (i, s) in [0.5, 0.75, 1.0, 0.75, 0.5].enumerated() {
                DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * 0.12) { g.impactOccurred(intensity: s) }
            }
        }
    }
}
