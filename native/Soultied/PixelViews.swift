import SwiftUI
import UIKit
import SoultiedCore

/* ---------- pixels to pictures ---------- */

enum Pixels {
    static let space = CGColorSpaceCreateDeviceRGB()

    /// RGBA bytes (straight alpha, as a canvas gives them) as a picture
    static func image(_ data: [UInt8], _ w: Int, _ h: Int) -> CGImage? {
        guard w > 0, h > 0, data.count >= w * h * 4, let provider = CGDataProvider(data: Data(data) as CFData) else { return nil }
        return CGImage(
            width: w, height: h, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: w * 4, space: space,
            bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.last.rawValue), provider: provider, decode: nil,
            shouldInterpolate: false, intent: .defaultIntent
        )
    }

    static func image(_ b: PixelBuffer) -> CGImage? { image(b.data, b.w, b.h) }

    static var glyphs: [Glyph: CGImage] = [:]
    static func image(_ g: Glyph) -> CGImage? {
        if let c = glyphs[g] { return c }
        let c = image(g.rgba(), g.pixelWidth, g.pixelHeight)
        if glyphs.count > 300 { glyphs.removeAll() }
        glyphs[g] = c
        return c
    }

    static var heads: [String: CGImage] = [:]
    /// a character's head and shoulders, for avatars beside names
    static func head(_ a: AvatarConfig) -> CGImage? {
        let key = "\(a.hashValue)"
        if let c = heads[key] { return c }
        let r = renderCharacter(a, .stand)
        // the top of the 24 × 48 character: hair, face and shoulders
        let top = max(0, r.headTop - 2)
        let h = min(22, r.buf.h - top)
        var out = [UInt8](repeating: 0, count: r.buf.w * h * 4)
        for y in 0..<h {
            let from = ((top + y) * r.buf.w) * 4
            out.replaceSubrange((y * r.buf.w * 4)..<((y + 1) * r.buf.w * 4), with: r.buf.data[from..<(from + r.buf.w * 4)])
        }
        let c = image(out, r.buf.w, h)
        if heads.count > 50 { heads.removeAll() }
        heads[key] = c
        return c
    }

    static var bodies: [String: CGImage] = [:]
    static func character(_ a: AvatarConfig, _ pose: Pose = .stand, blink: Bool = false, bob: Int = 0) -> CGImage? {
        let key = "\(a.hashValue)|\(pose)|\(blink)|\(bob)"
        if let c = bodies[key] { return c }
        let r = renderCharacter(a, pose, CharacterFrame(blink: blink, bob: bob))
        let c = image(r.buf)
        if bodies.count > 60 { bodies.removeAll() }
        bodies[key] = c
        return c
    }
}

/// A pixel picture, blown up with hard edges.
struct PixelImage: View {
    let image: CGImage?
    var scale: CGFloat
    var body: some View {
        if let image {
            Image(decorative: image, scale: 1)
                .resizable()
                .interpolation(.none)
                .frame(width: CGFloat(image.width) * scale, height: CGFloat(image.height) * scale)
        } else {
            Color.clear.frame(width: 1, height: 1)
        }
    }
}

/// one of the little icons
struct GlyphView: View {
    let glyph: Glyph
    var scale: CGFloat = 3
    var body: some View { PixelImage(image: Pixels.image(glyph), scale: scale).accessibilityHidden(true) }
}

/// someone's head and shoulders in a little paper square
struct HeadView: View {
    let look: AvatarConfig
    var size: CGFloat = 28
    var body: some View {
        PixelImage(image: Pixels.head(look), scale: size / 22)
            .frame(width: size, height: size)
            .background(Color.paper2)
            .clipped()
            .accessibilityHidden(true)
    }
}

/// a whole character, standing (the wardrobe, the welcome)
struct CharacterView: View {
    let look: AvatarConfig
    var scale: CGFloat = 4
    var body: some View {
        TimelineView(.periodic(from: .now, by: 0.5)) { ctx in
            let t = ctx.date.timeIntervalSinceReferenceDate
            let bob = Int(t * 2) % 4 == 0 ? 1 : 0
            let blink = Int(t * 2) % 9 == 0
            PixelImage(image: Pixels.character(look, .stand, blink: blink, bob: bob), scale: scale)
        }
        .accessibilityHidden(true)
    }
}

/// a 24 × 18 picture for the frame (a doodle or a photo)
struct ArtView: View {
    let art: WallArt
    var scale: CGFloat = 4
    var body: some View {
        let pal = art.pal.map { RGB($0) }
        var data = [UInt8](repeating: 0, count: ART_W * ART_H * 4)
        let paper = RGB("#fbf3e2")
        for (i, ch) in art.px.enumerated() where i < ART_W * ART_H {
            let k = ch == "." ? -1 : Int(String(ch), radix: 16) ?? -1
            let c = k >= 0 && k < pal.count ? pal[k] : paper
            data[i * 4] = c.r
            data[i * 4 + 1] = c.g
            data[i * 4 + 2] = c.b
            data[i * 4 + 3] = 255
        }
        return PixelImage(image: Pixels.image(data, ART_W, ART_H), scale: scale)
    }
}

/// a 48 × 36 doodle
struct DoodleView: View {
    let px: String
    var scale: CGFloat = 4
    var body: some View {
        let pal = DOODLE_PAL.map { RGB($0) }
        var data = [UInt8](repeating: 255, count: DOODLE_W * DOODLE_H * 4)
        for (i, ch) in px.enumerated() where i < DOODLE_W * DOODLE_H {
            let c = pal[min(15, Int(String(ch), radix: 16) ?? 0)]
            data[i * 4] = c.r
            data[i * 4 + 1] = c.g
            data[i * 4 + 2] = c.b
        }
        return PixelImage(image: Pixels.image(data, DOODLE_W, DOODLE_H), scale: scale)
    }
}

/// a photo kept as a data: URL
struct DataImage: View {
    let url: String
    var body: some View {
        if let d = dataURLBytes(url), let ui = UIImage(data: d) {
            Image(uiImage: ui).resizable().scaledToFill()
        } else {
            Color.paper2
        }
    }
}

/* ---------- the dark room around everything ---------- */

/// what's behind every screen: the room's warm dark, or Starlight's sky
struct RoomBackground: View {
    var body: some View {
        if Looks.shared.look == .starlight {
            StarSky()
        } else {
            LinearGradient(colors: [Color(hex: "#24181a"), Color.room], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
        }
    }
}

/// a heading on the dark background
struct DarkHeading: View {
    var title: String
    var sub: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.pxTitle).foregroundStyle(Color.paper)
            if let sub { Text(sub).font(.pxSmall).foregroundStyle(Color.paper.opacity(0.7)) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// a note along the bottom: "Rohan hugged you." [Hug back] [Later]
struct Toast<Actions: View>: View {
    var glyph: Glyph?
    var text: String
    @ViewBuilder var actions: () -> Actions
    var body: some View {
        HStack(spacing: 12) {
            if let glyph { GlyphView(glyph: glyph, scale: 3) }
            Text(text).font(.pxBody).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
            actions()
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .pxBox(shadow: true)
        .padding(.horizontal, 12)
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }
}
