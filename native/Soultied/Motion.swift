import SwiftUI

/*
 * Small motions that make the place feel lived in (the website's mo-* classes in src/index.css): things that bob
 * and sway while they wait for a tap, a little wiggle every few seconds on whatever's waiting for you, hearts
 * that beat, cards that pop in as a screen opens, and numbers that count up. Everything here stands still for
 * anyone who's asked for less motion (Settings > Accessibility > Motion > Reduce Motion).
 */

/// bobs up and down and tilts a touch, forever (`phase` 0…1 staggers neighbours so they don't move as one)
struct Sway: ViewModifier {
    var lift: CGFloat = 3
    var tilt: Double = 1.2
    var period: Double = 2.8
    var phase: Double = 0
    var active = true
    @Environment(\.accessibilityReduceMotion) private var reduce

    @ViewBuilder
    func body(content: Content) -> some View {
        if reduce || !active {
            content
        } else {
            TimelineView(.animation(minimumInterval: 1.0 / 30)) { ctx in
                let t = ctx.date.timeIntervalSinceReferenceDate / period + phase
                content
                    .offset(y: -lift * (0.5 + 0.5 * sin(t * 2 * .pi)))
                    .rotationEffect(.degrees(tilt * sin((t + 0.25) * 2 * .pi)))
            }
        }
    }
}

/// a quick wiggle every few seconds: "over here", for whatever's waiting on you
struct Nudge: ViewModifier {
    var active = true
    var every: Double = 4.5
    var phase: Double = 0
    var angle: Double = 4
    @Environment(\.accessibilityReduceMotion) private var reduce

    @ViewBuilder
    func body(content: Content) -> some View {
        if reduce || !active {
            content
        } else {
            TimelineView(.animation(minimumInterval: 1.0 / 30)) { ctx in
                let t = (ctx.date.timeIntervalSinceReferenceDate + phase * every).truncatingRemainder(dividingBy: every)
                let k = t < 0.6 ? 1 - t / 0.6 : 0
                content
                    .rotationEffect(.degrees(angle * sin(t / 0.6 * .pi * 4) * k))
                    .scaleEffect(1 + 0.05 * k)
            }
        }
    }
}

/// a heartbeat: two quick swells, then a rest
struct Beat: ViewModifier {
    var active = true
    var every: Double = 1.6
    var amount: CGFloat = 0.14
    var phase: Double = 0
    @Environment(\.accessibilityReduceMotion) private var reduce

    @ViewBuilder
    func body(content: Content) -> some View {
        if reduce || !active {
            content
        } else {
            TimelineView(.animation(minimumInterval: 1.0 / 30)) { ctx in
                let t = (ctx.date.timeIntervalSinceReferenceDate + phase * every).truncatingRemainder(dividingBy: every)
                let a = t < 0.14 ? sin(t / 0.14 * .pi) : (t > 0.24 && t < 0.38) ? 0.6 * sin((t - 0.24) / 0.14 * .pi) : 0
                content.scaleEffect(1 + amount * a)
            }
        }
    }
}

/// a soft glow coming and going (stars, the stitch, a flame)
struct Twinkle: ViewModifier {
    var period: Double = 2.2
    var phase: Double = 0
    @Environment(\.accessibilityReduceMotion) private var reduce

    @ViewBuilder
    func body(content: Content) -> some View {
        if reduce {
            content
        } else {
            TimelineView(.animation(minimumInterval: 1.0 / 20)) { ctx in
                let s = 0.5 + 0.5 * sin((ctx.date.timeIntervalSinceReferenceDate / period + phase) * 2 * .pi)
                content
                    .scaleEffect(0.94 + 0.1 * s)
                    .brightness(0.08 * s)
            }
        }
    }
}

/// a flame's flicker: a little taller, a little shorter, never still
struct Flicker: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduce
    @ViewBuilder
    func body(content: Content) -> some View {
        if reduce {
            content
        } else {
            TimelineView(.animation(minimumInterval: 1.0 / 12)) { ctx in
                let t = ctx.date.timeIntervalSinceReferenceDate
                let s = 0.5 * sin(t * 9) + 0.3 * sin(t * 23 + 1) + 0.2 * sin(t * 4)
                content.scaleEffect(x: 1 - 0.03 * s, y: 1 + 0.07 * s, anchor: .bottom)
            }
        }
    }
}

/// comes in as the screen opens: up from a little below, fading in, a beat after the one before it
struct PopIn: ViewModifier {
    var delay: Double = 0
    @State private var shown = false
    @Environment(\.accessibilityReduceMotion) private var reduce

    func body(content: Content) -> some View {
        let on = shown || reduce
        return content
            .opacity(on ? 1 : 0)
            .offset(y: on ? 0 : 14)
            .scaleEffect(on ? 1 : 0.97, anchor: .top)
            .onAppear {
                guard !shown else { return }
                withAnimation(.spring(response: 0.45, dampingFraction: 0.8).delay(min(delay, 0.6))) { shown = true }
            }
    }
}

/// hops when it becomes the one that's picked (a tab, a choice)
struct Hop: ViewModifier {
    var on: Bool
    @State private var up = false
    @Environment(\.accessibilityReduceMotion) private var reduce

    @ViewBuilder
    func body(content: Content) -> some View {
        content
            .offset(y: up ? -5 : 0)
            .onChange(of: on) { _, now in
                guard now, !reduce else { return }
                withAnimation(.spring(response: 0.18, dampingFraction: 0.5)) { up = true }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.16) {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.55)) { up = false }
                }
            }
    }
}

extension View {
    func sway(lift: CGFloat = 3, tilt: Double = 1.2, period: Double = 2.8, phase: Double = 0, active: Bool = true) -> some View {
        modifier(Sway(lift: lift, tilt: tilt, period: period, phase: phase, active: active))
    }
    func nudge(_ active: Bool = true, every: Double = 4.5, phase: Double = 0, angle: Double = 4) -> some View {
        modifier(Nudge(active: active, every: every, phase: phase, angle: angle))
    }
    func beat(_ active: Bool = true, every: Double = 1.6, amount: CGFloat = 0.14, phase: Double = 0) -> some View {
        modifier(Beat(active: active, every: every, amount: amount, phase: phase))
    }
    func twinkle(period: Double = 2.2, phase: Double = 0) -> some View { modifier(Twinkle(period: period, phase: phase)) }
    func flicker() -> some View { modifier(Flicker()) }
    func popIn(_ delay: Double = 0) -> some View { modifier(PopIn(delay: delay)) }
    func hop(_ on: Bool) -> some View { modifier(Hop(on: on)) }
}

/// a number that counts up to itself when it first shows (518 days, 4-day streak…)
struct CountUp: View {
    let value: Int
    var format: (Int) -> String
    @State private var shown: Double = 0
    @Environment(\.accessibilityReduceMotion) private var reduce

    init(value: Int, format: @escaping (Int) -> String = { "\($0)" }) {
        self.value = value
        self.format = format
    }

    var body: some View {
        Counting(value: reduce ? Double(value) : shown, format: format)
            .onAppear { count() }
            .onChange(of: value) { _, _ in count() }
            .accessibilityLabel(format(value))
    }

    private func count() {
        guard !reduce else { return }
        // (small numbers tick quickly, big ones take a little longer, never long)
        let d = min(1.1, 0.35 + Double(abs(value)) / 600)
        withAnimation(.easeOut(duration: d)) { shown = Double(value) }
    }

    private struct Counting: View, Animatable {
        var value: Double
        var format: (Int) -> String
        var animatableData: Double {
            get { value }
            set { value = newValue }
        }
        var body: some View { Text(format(Int(value.rounded()))) }
    }
}
