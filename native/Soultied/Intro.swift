import SwiftUI
import SoultiedCore

/*
 * The first thing you see when the app opens: two little hearts drift in from either side, a red thread runs
 * between them and ties in a knot, and "Soultied" writes itself underneath, with three soft notes and one
 * small buzz as the knot pulls tight. About two seconds; a tap skips it, and with Reduce Motion it's just
 * the name, fading.
 */

struct Intro: View {
    var done: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// 0 waiting, 1 the hearts drift in, 2 the thread ties, 3 the name, 4 going
    @State private var step = 0
    @State private var thread: CGFloat = 0
    @State private var finished = false

    private static let word = Array("Soultied")
    /// when the opening's over (what's underneath waits to make its own entrance till then)
    static var until: Date = Launch.args.contains("-noIntro") ? .distantPast : Date().addingTimeInterval(2.1)
    /// how far apart the two hearts end up (their centres), in points
    private static let apart: CGFloat = 92

    var body: some View {
        ZStack {
            RoomBackground()
            IntroStars(on: step >= 1 && !reduceMotion)
            VStack(spacing: 26) {
                tie
                    .frame(height: 70)
                    .opacity(reduceMotion ? 0 : 1)
                wordmark
            }
            .offset(y: -20)
        }
        .scaleEffect(step >= 4 && !reduceMotion ? 1.06 : 1)
        .opacity(step >= 4 ? 0 : 1)
        .contentShape(Rectangle())
        .onTapGesture { finish() }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Soultied")
        .accessibilityAddTraits(.isHeader)
        .task { await run() }
    }

    /// the two hearts and the thread between them
    private var tie: some View {
        let half = Self.apart / 2
        let inn = step >= 1
        return ZStack {
            TieThread(progress: thread, gap: Self.apart - 34)
                .fill(Color.thread)
                .frame(width: Self.apart - 34, height: 30)
            GlyphView(glyph: Icons.heart, scale: 5)
                .scaleEffect(step == 2 ? 1.14 : 1)
                .offset(x: inn ? -half : -180)
                .opacity(inn ? 1 : 0)
            GlyphView(glyph: Icons.heart, scale: 5)
                .scaleEffect(step == 2 ? 1.14 : 1)
                .offset(x: inn ? half : 180)
                .opacity(inn ? 1 : 0)
            // the knot
            GlyphView(glyph: Self.knot, scale: 3)
                .offset(y: 3)
                .scaleEffect(step >= 2 ? 1 : 0.2)
                .opacity(step >= 2 ? 1 : 0)
        }
    }

    private static let knot = Glyph(["r...r", ".r.r.", "..r..", ".r.r.", "r...r"], ["r": "#a84f4b"])

    /// "Soultied", a letter at a time, and the line under it
    private var wordmark: some View {
        VStack(spacing: 10) {
            HStack(spacing: 0) {
                ForEach(Array(Self.word.enumerated()), id: \.offset) { i, ch in
                    Text(String(ch))
                        .font(.px(46, 700))
                        .foregroundStyle(Color.paper)
                        .shadow(color: Color.thread.opacity(0.55), radius: 0, x: 0, y: 3)
                        .opacity(step >= 3 ? 1 : 0)
                        .offset(y: step >= 3 ? 0 : 10)
                        .animation(reduceMotion ? .easeOut(duration: 0.4) : .spring(response: 0.38, dampingFraction: 0.62).delay(Double(i) * 0.045), value: step)
                }
            }
            Text("a home for two, however far apart")
                .font(.px(15, 500))
                .foregroundStyle(Color.paper.opacity(0.62))
                .opacity(step >= 3 ? 1 : 0)
                .animation(.easeOut(duration: 0.5).delay(reduceMotion ? 0 : 0.42), value: step)
        }
    }

    private func run() async {
        if reduceMotion {
            step = 3
            try? await Task.sleep(nanoseconds: 1_100_000_000)
            finish()
            return
        }
        Chiptune.shared.hello()
        withAnimation(.easeOut(duration: 0.55)) { step = 1 }
        try? await Task.sleep(nanoseconds: 380_000_000)
        withAnimation(.easeInOut(duration: 0.38)) { thread = 1 }
        try? await Task.sleep(nanoseconds: 400_000_000)
        Haptics.soft()
        withAnimation(.spring(response: 0.28, dampingFraction: 0.5)) { step = 2 }
        try? await Task.sleep(nanoseconds: 160_000_000)
        step = 3
        try? await Task.sleep(nanoseconds: 1_050_000_000)
        // (the screenshots hold it here)
        if Launch.args.contains("-introHold") { return }
        finish()
    }

    private func finish() {
        guard !finished else { return }
        finished = true
        Intro.until = Date().addingTimeInterval(0.2)
        withAnimation(.easeIn(duration: 0.35)) { step = 4 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.36) { done() }
    }
}

/// the red thread, run out from both hearts towards the middle, in pixel steps with a little sag
struct TieThread: Shape {
    var progress: CGFloat
    let gap: CGFloat
    var animatableData: CGFloat {
        get { progress }
        set { progress = newValue }
    }

    func path(in r: CGRect) -> Path {
        var p = Path()
        let px: CGFloat = 3
        let n = max(2, Int(gap / px))
        let reach = Int((CGFloat(n) / 2 * progress).rounded(.up))
        for i in 0..<n where i < reach || i >= n - reach {
            let u = CGFloat(i) / CGFloat(n - 1)
            let sag = (sin(.pi * u) * 5 / px).rounded() * px
            p.addRect(CGRect(x: r.minX + CGFloat(i) * px, y: r.midY + sag - px / 2, width: px, height: px))
        }
        return p
    }
}

/// a few stars, twinkling, behind the hearts
struct IntroStars: View {
    var on: Bool
    private static let spots: [(x: CGFloat, y: CGFloat, s: CGFloat, k: Double)] = (0..<26).map { i in
        let a = Double(i) * 2.399963
        let r = 0.18 + 0.32 * Double((i * 37) % 26) / 26
        return (CGFloat(0.5 + cos(a) * r), CGFloat(0.42 + sin(a) * r * 1.2), CGFloat(i % 3 == 0 ? 3 : 2), Double(i) * 0.7)
    }

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 15, paused: !on)) { ctx in
            let t = ctx.date.timeIntervalSinceReferenceDate
            GeometryReader { geo in
                ForEach(Self.spots.indices, id: \.self) { i in
                    let s = Self.spots[i]
                    Rectangle()
                        .fill(Color.paper.opacity(0.18 + 0.32 * (0.5 + 0.5 * sin(t * 2 + s.k))))
                        .frame(width: s.s, height: s.s)
                        .position(x: s.x * geo.size.width, y: s.y * geo.size.height)
                }
            }
        }
        .opacity(on ? 1 : 0)
        .animation(.easeOut(duration: 0.8), value: on)
        .allowsHitTesting(false)
    }
}
