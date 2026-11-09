import SwiftUI
import SoultiedCore

/*
 * The app's two looks. Cozy: paper cards and terracotta around the room's warm dark, like the website.
 * Starlight: the dusk-by-the-sea sky from Soultied's videos and store art, deep purple with pixel stars and a
 * moon, lavender moon-paper cards and violet buttons. The room itself is the same in both. Each phone keeps its
 * own look; Us > The app's look switches it.
 */

enum AppLook: String, CaseIterable, Identifiable {
    case cozy, starlight
    var id: String { rawValue }

    /// the look a phone starts with until it picks one (change this line to change the default)
    static let standard: AppLook = .cozy

    var name: String { self == .cozy ? "Cozy" : "Starlight" }
    var line: String { self == .cozy ? "Paper and terracotta, by the fire" : "Dusk purple, under the stars" }
    var palette: Palette { self == .cozy ? .cozy : .starlight }

    fileprivate static let key = "soultied_look"
    /// this phone's look (-theme starlight picks one for the screenshots)
    static func saved() -> AppLook {
        Launch.theme.flatMap(AppLook.init) ?? UserDefaults.standard.string(forKey: key).flatMap(AppLook.init) ?? standard
    }
}

/// the colours a look is made of (Color.ink, Color.paper... read the one that's on)
struct Palette {
    let ink: Color
    let inkSoft: Color
    /// the shadowed edge of a dark button
    let inkDeep: Color
    let muted: Color
    let paper: Color
    let paper2: Color
    let paperShade: Color
    let paperHi: Color
    let paperInput: Color
    let terracotta: Color
    let terracottaD: Color
    let sage: Color
    let sageD: Color
    let thread: Color
    let butter: Color
    let cream: Color
    let room: Color
    let roomBrown: Color
    let night: Color
    /// a button you can't press yet, and its edge
    let disabled: Color
    let disabledD: Color
    /// your own lines in a chat
    let bubbleMine: Color
    /// the strip along the top of the Netflix and Prime screens
    let bar: Color

    /// the look that's on
    static var now: Palette = AppLook.saved().palette

    static let cozy = Palette(
        ink: Color(hex: "#2b1e1c"), inkSoft: Color(hex: "#3a2a26"), inkDeep: Color(hex: "#241816"), muted: Color(hex: "#7a5a48"),
        paper: Color(hex: "#f4e8d0"), paper2: Color(hex: "#eadbbd"), paperShade: Color(hex: "#d6c29c"),
        paperHi: Color(hex: "#fff8ea"), paperInput: Color(hex: "#fbf3e2"),
        terracotta: Color(hex: "#b8674f"), terracottaD: Color(hex: "#8f4b3a"), sage: Color(hex: "#8a9a72"), sageD: Color(hex: "#6a7856"),
        thread: Color(hex: "#a84f4b"), butter: Color(hex: "#e2b359"), cream: Color(hex: "#fff4e2"),
        room: Color(hex: "#1a1214"), roomBrown: Color(hex: "#1d1512"), night: Color(hex: "#2a2033"),
        disabled: Color(hex: "#b9a98f"), disabledD: Color(hex: "#9a8a70"), bubbleMine: Color(hex: "#f1e0c4"), bar: Color(hex: "#2a1f1a")
    )

    /// the store art's night: sky #1c1f3a to #51395f, moon cream, a violet for buttons and a sea-glass green
    static let starlight = Palette(
        ink: Color(hex: "#1d1a33"), inkSoft: Color(hex: "#2c2748"), inkDeep: Color(hex: "#14122a"), muted: Color(hex: "#625a7e"),
        paper: Color(hex: "#ece5f1"), paper2: Color(hex: "#ddd3e8"), paperShade: Color(hex: "#bdb0cf"),
        paperHi: Color(hex: "#f8f4fb"), paperInput: Color(hex: "#f3eef7"),
        terracotta: Color(hex: "#6e56a8"), terracottaD: Color(hex: "#533e8c"), sage: Color(hex: "#4f8a83"), sageD: Color(hex: "#3a6863"),
        thread: Color(hex: "#c95a52"), butter: Color(hex: "#f0c66e"), cream: Color(hex: "#fff6ea"),
        room: Color(hex: "#13132a"), roomBrown: Color(hex: "#15142b"), night: Color(hex: "#1c1f3a"),
        disabled: Color(hex: "#a9a0ba"), disabledD: Color(hex: "#8a809e"), bubbleMine: Color(hex: "#e1d5ee"), bar: Color(hex: "#1e1c36")
    )
}

/// the look that's on, for views to follow (switching it draws the app again, in the new colours)
@Observable
final class Looks {
    static let shared = Looks()
    private(set) var look = AppLook.saved()
    private init() {}

    func choose(_ l: AppLook) {
        guard l != look else { return }
        UserDefaults.standard.set(l.rawValue, forKey: AppLook.key)
        Palette.now = l.palette
        look = l
    }
}

/* ---------- Starlight's sky ---------- */

/// deep purple going to dusk at the bottom in dithered pixel bands, pixel stars (the same ones on every
/// screen), and the moon. Drawn once for the screen's size; nothing in it moves.
struct StarSky: View {
    var moon = true

    private static let bands: [(at: CGFloat, color: Color)] = [
        (0, Color(hex: "#1c1f3a")), (0.5, Color(hex: "#232447")), (0.7, Color(hex: "#2b294f")),
        (0.84, Color(hex: "#352d55")), (0.94, Color(hex: "#433259")),
    ]
    private static let moonCream = Color(hex: "#f4e7c9")
    private static let moonShade = Color(hex: "#e2cfa8")
    /// the moon's craters, as (row × 100 + column) from its middle
    private static let craters: Set<Int> = [-102, -103, -202, -2, -101, 203, 202, 103]

    var body: some View {
        Canvas(opaque: true) { ctx, size in
            let px: CGFloat = 3
            let w = size.width, h = size.height
            func snap(_ v: CGFloat) -> CGFloat { (v / px).rounded() * px }

            // the bands, each with a dithered edge reaching up into the one above
            for (i, b) in Self.bands.enumerated() {
                let y0 = snap(b.at * h)
                let y1 = i + 1 < Self.bands.count ? snap(Self.bands[i + 1].at * h) : h
                ctx.fill(Path(CGRect(x: 0, y: y0, width: w, height: y1 - y0)), with: .color(b.color))
                guard i > 0 else { continue }
                var edge = Path()
                var x: CGFloat = 0
                while x < w {
                    edge.addRect(CGRect(x: x, y: y0 - px, width: px, height: px))
                    if Int(x / px) % 4 == 1 { edge.addRect(CGRect(x: x, y: y0 - px * 2, width: px, height: px)) }
                    x += px * 2
                }
                ctx.fill(edge, with: .color(b.color))
            }

            // the stars: a fixed scatter, thinning out towards the dusk
            var seed: UInt32 = 0x50_7C_1E
            func next() -> CGFloat {
                seed = seed &* 1_664_525 &+ 1_013_904_223
                return CGFloat(seed >> 8) / CGFloat(1 << 24)
            }
            let count = Int(w * h / 2300)
            for i in 0..<count {
                let x = snap(next() * w)
                let y = snap(pow(next(), 1.6) * h * 0.8)
                let bright = 0.3 + 0.6 * next()
                let c = Self.moonCream.opacity(Double(bright))
                ctx.fill(Path(CGRect(x: x, y: y, width: px, height: px)), with: .color(c))
                // one in eleven twinkles with a little cross
                if i % 11 == 0 {
                    var cross = Path()
                    for (dx, dy) in [(-1, 0), (1, 0), (0, -1), (0, 1)] {
                        cross.addRect(CGRect(x: x + CGFloat(dx) * px, y: y + CGFloat(dy) * px, width: px, height: px))
                    }
                    ctx.fill(cross, with: .color(Self.moonCream.opacity(Double(bright) * 0.45)))
                }
            }

            // the moon, up on the right, in a soft glow
            guard moon else { return }
            let r: CGFloat = 18
            let cx = snap(w - 54), cy = snap(150)
            ctx.fill(
                Path(ellipseIn: CGRect(x: cx - r * 3.2, y: cy - r * 3.2, width: r * 6.4, height: r * 6.4)),
                with: .radialGradient(
                    Gradient(colors: [Self.moonCream.opacity(0.16), Self.moonCream.opacity(0)]),
                    center: CGPoint(x: cx, y: cy), startRadius: r, endRadius: r * 3.2
                )
            )
            var disc = Path()
            var shade = Path()
            let n = Int(r / px)
            for gy in -n...n {
                for gx in -n...n {
                    let dx = (CGFloat(gx) + 0.5) * px, dy = (CGFloat(gy) + 0.5) * px
                    guard dx * dx + dy * dy <= r * r else { continue }
                    let cell = CGRect(x: cx + CGFloat(gx) * px, y: cy + CGFloat(gy) * px, width: px, height: px)
                    // two craters and a shaded lower-right edge
                    let crater = Self.craters.contains(gy * 100 + gx)
                    let rim = (dx + px) * (dx + px) + (dy + px) * (dy + px) > r * r && dx + dy > 0
                    if crater || rim { shade.addRect(cell) } else { disc.addRect(cell) }
                }
            }
            ctx.fill(disc, with: .color(Self.moonCream))
            ctx.fill(shade, with: .color(Self.moonShade))
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

/* ---------- picking one (Us) ---------- */

struct LookPicker: View {
    @State private var looks = Looks.shared

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("The app’s look").font(.pxHeading).foregroundStyle(Color.inkSoft)
            Text("Just for this phone. The room looks the same in both.").font(.pxSmall).foregroundStyle(Color.muted)
            HStack(spacing: 10) {
                ForEach(AppLook.allCases) { swatch($0) }
            }
        }
        .pxCard()
    }

    private func swatch(_ l: AppLook) -> some View {
        let on = looks.look == l
        let p = l.palette
        return Button {
            guard !on else { return }
            Haptics.select()
            // (the app's drawn again in the new colours: come back to Us)
            MainView.resume = .us
            withAnimation(.easeInOut(duration: 0.35)) { looks.choose(l) }
        } label: {
            VStack(alignment: .leading, spacing: 7) {
                // a little picture of it: its backdrop, a card and a button
                ZStack(alignment: .bottomLeading) {
                    if l == .starlight {
                        StarSky(moon: false)
                    } else {
                        LinearGradient(colors: [Color(hex: "#3a2620"), p.room], startPoint: .top, endPoint: .bottom)
                    }
                    VStack(alignment: .leading, spacing: 5) {
                        Rectangle().fill(p.paper).frame(height: 16).overlay(Rectangle().strokeBorder(p.ink, lineWidth: 2))
                        Rectangle().fill(p.terracotta).frame(width: 42, height: 12).overlay(Rectangle().strokeBorder(p.ink, lineWidth: 2))
                    }
                    .padding(8)
                }
                .frame(height: 74)
                .frame(maxWidth: .infinity)
                .clipped()
                .overlay(alignment: .topTrailing) {
                    if l == .starlight {
                        Rectangle().fill(Color(hex: "#f4e7c9")).frame(width: 9, height: 9).padding(10)
                    } else {
                        Rectangle().fill(p.butter).frame(width: 7, height: 7).padding(11)
                    }
                }
                .overlay(Rectangle().strokeBorder(Color.ink, lineWidth: 2))
                HStack(spacing: 6) {
                    Text(l.name).font(.pxBodyBold).foregroundStyle(Color.inkSoft)
                    Spacer(minLength: 0)
                    if on { PixelTag(text: "On") }
                }
                Text(l.line).font(.pxTiny).foregroundStyle(Color.muted).lineLimit(2).fixedSize(horizontal: false, vertical: true)
            }
            .padding(8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(on ? Color.paperHi : Color.paper2)
            .overlay(Rectangle().strokeBorder(on ? Color.terracotta : Color.paperShade, lineWidth: 3))
        }
        .buttonStyle(.press)
        .accessibilityLabel("\(l.name): \(l.line)")
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}
