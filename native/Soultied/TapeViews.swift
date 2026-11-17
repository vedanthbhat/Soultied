import SwiftUI
import SoultiedCore

/*
 * Continue watching: what the two of you were part way through on YouTube, Netflix and Prime Video, as pixel
 * video tapes on a little shelf at the top of Watch, and the latest one on Home. The title's written on each
 * tape's label, the reels are wound on as far as you got, and under it how long's left and who had it on
 * last. Tap one to carry on from where you stopped (the same tapes as soultied.app: SoultiedCore/Watch/Tapes).
 */

/// Home → Watch: the tape you tapped on Home, for Watch to carry on with as it opens
@Observable
final class WatchCue {
    static let shared = WatchCue()
    var tape: Tape?
}

/// one tape: the shell in pixels, its title written on the label
struct TapeArt: View {
    let tape: Tape
    var scale: CGFloat = 3

    var body: some View {
        let L = Tapes.label
        let small = scale < 3
        GlyphView(glyph: Tapes.glyph(tape), scale: scale)
            .frame(width: CGFloat(Tapes.width) * scale, height: CGFloat(Tapes.height) * scale)
            .overlay(alignment: .topLeading) {
                Text(tape.title)
                    .font(.px(small ? 9 : 11, 700))
                    .foregroundStyle(Color(hex: "#3a2a26"))
                    .lineLimit(small ? 1 : 2)
                    .multilineTextAlignment(.leading)
                    .frame(width: CGFloat(L.w - 2) * scale, height: CGFloat(L.h - 2) * scale - 1, alignment: small ? .leading : .topLeading)
                    .offset(x: CGFloat(L.x + 1) * scale, y: CGFloat(L.y + 2) * scale + 1)
            }
            .accessibilityHidden(true)
    }
}

/// how far through, as a little bar (nothing when it's not known how long it is)
struct TapeBar: View {
    let tape: Tape
    let width: CGFloat

    var body: some View {
        if tape.dur > 0 {
            Rectangle()
                .fill(Color(hex: "#2a2124"))
                .frame(width: width, height: 8)
                .overlay(alignment: .leading) {
                    Rectangle().fill(Color.terracotta).frame(width: max(3, (width - 4) * tape.share), height: 4).padding(.leading, 2)
                }
                .accessibilityHidden(true)
        }
    }
}

/// the shelf: the tapes standing on a plank, scrolling sideways when there are more than fit
struct TapeShelf: View {
    let place: PlaceModel
    let tapes: [Tape]
    var scale: CGFloat = 2
    var pick: (Tape) -> Void

    var body: some View {
        if !tapes.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text("Continue watching").font(.pxHeading).foregroundStyle(Color.inkSoft)
                ScrollView(.horizontal, showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 0) {
                        HStack(alignment: .bottom, spacing: 14) {
                            ForEach(tapes) { t in tapeButton(t) }
                        }
                        .padding(.top, 4)
                        // the plank they stand on
                        Rectangle().fill(Color(hex: "#8a5a3a")).frame(height: 6)
                            .overlay(alignment: .bottom) { Rectangle().fill(Color(hex: "#5e3a24")).frame(height: 2) }
                            .padding(.top, 3)
                    }
                    .padding(.bottom, 2)
                }
            }
            .pxCard()
        }
    }

    private func tapeButton(_ t: Tape) -> some View {
        let w = CGFloat(Tapes.width) * scale
        let now = place.now.timeIntervalSince1970 * 1000
        return Button {
            pick(t)
        } label: {
            VStack(alignment: .leading, spacing: 4) {
                TapeArt(tape: t, scale: scale)
                TapeBar(tape: t, width: w)
                Text(t.service).font(.px(11, 700)).foregroundStyle(Color.inkSoft).lineLimit(1)
                Text(t.left).font(.px(11, 500)).foregroundStyle(Color.muted).lineLimit(1)
            }
            .frame(width: w, alignment: .leading)
        }
        .buttonStyle(.press)
        .accessibilityLabel("\(t.title) on \(t.service), \(t.left). \(Tapes.who(t, me: place.me, theirName: place.theirName, now: now)).")
        .accessibilityHint("Carry on from where you stopped")
    }
}

/// on Home: the last thing you were part way through, one tap to carry on
struct ContinueCard: View {
    let place: PlaceModel
    var open: (Tape) -> Void

    var body: some View {
        let tapes = place.tapes
        if let t = tapes.first {
            let now = place.now.timeIntervalSince1970 * 1000
            Button {
                open(t)
            } label: {
                HStack(alignment: .center, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        TapeArt(tape: t, scale: 2)
                        TapeBar(tape: t, width: CGFloat(Tapes.width) * 2)
                    }
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Continue watching").font(.px(12, 600)).foregroundStyle(Color.muted)
                        Text(t.title).font(.pxBodyBold).foregroundStyle(Color.inkSoft).lineLimit(2).multilineTextAlignment(.leading)
                        Text("\(t.service) · \(t.left)").font(.pxSmall).foregroundStyle(Color.terracottaD).lineLimit(1)
                        Text(Tapes.who(t, me: place.me, theirName: place.theirName, now: now)).font(.pxSmall).foregroundStyle(Color.muted).lineLimit(1)
                        if tapes.count > 1 {
                            Text("\(tapes.count - 1) more on the shelf in Watch").font(.px(11, 500)).foregroundStyle(Color.muted)
                        }
                    }
                    Spacer(minLength: 0)
                    Text("→").font(.pxBodyBold).foregroundStyle(Color.terracottaD)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.press)
            .pxCard()
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Continue watching: \(t.title) on \(t.service), \(t.left). \(Tapes.who(t, me: place.me, theirName: place.theirName, now: now)).")
            .accessibilityHint("Carry on from where you stopped")
            .accessibilityAddTraits(.isButton)
        }
    }
}
