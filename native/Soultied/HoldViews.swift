import SwiftUI
import SoultiedCore

/*
 * Holding the couch (meta/hold, shared with the website): press and hold, and while your person holds too, you
 * sit side by side in the room and both phones beat softly like a heart.
 */

extension Haptics {
    /// lub-dub
    static func heartbeat() {
        let g = UIImpactFeedbackGenerator(style: .soft)
        g.impactOccurred(intensity: 0.9)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.16) { g.impactOccurred(intensity: 0.55) }
    }
}

struct HoldBar: View {
    let place: PlaceModel
    @State private var since: Date?
    @Environment(\.scenePhase) private var phase

    var body: some View {
        TimelineView(.periodic(from: .now, by: 0.5)) { ctx in
            let mine = place.holding
            let theirs = place.theyHold(now: ctx.date)
            let together = mine && theirs
            HStack(spacing: 12) {
                pad(mine: mine, together: together)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title(mine, theirs)).font(.px(15, 700)).foregroundStyle(Color.paper)
                    Text(line(mine, theirs, now: ctx.date)).font(.pxTiny).foregroundStyle(Color.paper.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }
            .padding(10)
            .background(Color.black.opacity(theirs && !mine ? 0.32 : 0.2))
            .overlay(Rectangle().stroke(theirs && !mine ? Color.terracotta : Color.clear, lineWidth: 2))
            .onChange(of: together) { _, on in since = on ? Date() : nil }
            .onChange(of: theirs) { _, on in if on && !mine { Haptics.soft() } }
            // their heartbeat, in your hand, while you're both holding
            .task(id: together) {
                guard together else { return }
                while !Task.isCancelled {
                    Haptics.heartbeat()
                    try? await Task.sleep(nanoseconds: 900_000_000)
                }
            }
        }
        .onChange(of: phase) { _, p in if p != .active { place.hold(false) } }
        // (the screenshots: holding on, in the demo room, where Rohan holds back)
        .onAppear { if Launch.args.contains("-hold") { place.hold(true) } }
        .onDisappear { place.hold(false) }
    }

    /// the thing you press and hold: a little cushion
    private func pad(mine: Bool, together: Bool) -> some View {
        ZStack {
            Rectangle().fill(together ? Color.terracotta : mine ? Color.sage : Color.paper)
            GlyphView(glyph: Icons.couch, scale: 2)
        }
        .frame(width: 58, height: 44)
        .overlay(Rectangle().stroke(Color.ink, lineWidth: 2))
        .offset(y: mine ? 2 : 0)
        .shadow(color: .black.opacity(mine ? 0 : 0.35), radius: 0, x: 0, y: mine ? 0 : 3)
        .contentShape(Rectangle())
        .gesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in
                    if !place.holding {
                        place.hold(true)
                        Haptics.soft()
                    }
                }
                .onEnded { _ in place.hold(false) }
        )
        .accessibilityLabel("Hold the couch")
        .accessibilityHint("Press and hold. When \(place.theirName) holds it too, you feel each other’s heartbeat.")
    }

    private func title(_ mine: Bool, _ theirs: Bool) -> String {
        if mine && theirs { return "Holding each other" }
        if mine { return "Holding on…" }
        if theirs { return "\(place.theirName) is holding the couch" }
        return "Hold the couch"
    }

    private func line(_ mine: Bool, _ theirs: Bool, now: Date) -> String {
        if mine && theirs {
            let s = Int(now.timeIntervalSince(since ?? now))
            return "Feel that? That’s \(place.theirName). \(s / 60):\(String(format: "%02d", s % 60))"
        }
        if mine { return "Keep holding. When \(place.theirName) holds too, you’ll feel each other." }
        if theirs { return "Press and hold the cushion to hold it with them." }
        return "Press and hold the cushion. When \(place.theirName) does too, you’ll feel each other’s heartbeat."
    }
}
