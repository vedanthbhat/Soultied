import SwiftUI
import CallKit
import SoultiedCore

/*
 * On FaceTime with your person while you're in the app: FaceTime's little video window floats over a corner of
 * the screen. Apps can't move it, but you can. So while a call's on, every tab (and a game you're playing) sits
 * under a band across the top, as tall as that window, with an empty picture frame on the right where it fits:
 * "Drag Rohan here". Nothing in the app is ever under the video, whichever tab you're on, and the band's other
 * side has your touches, to send one without leaving the call. It can be put away for the rest of the call.
 *
 * CXCallObserver only says a call's going on (FaceTime, a phone call, WhatsApp…), never who with or what's
 * said, and needs no permission.
 */

@Observable
final class CallWatch {
    static let shared = CallWatch()
    /// a call's connected right now
    private(set) var onCall = false
    /// the frame's asking to be noticed (a few seconds, as you come into the app during a call)
    private(set) var hint = false
    /// put away for the rest of this call
    var bandHidden = false

    private let observer = CXCallObserver()
    @ObservationIgnored private var delegate: Delegate?
    @ObservationIgnored private var hideHint: DispatchWorkItem?

    /// (CXCallObserver wants an NSObject to tell)
    private final class Delegate: NSObject, CXCallObserverDelegate {
        weak var owner: CallWatch?
        func callObserver(_ callObserver: CXCallObserver, callChanged call: CXCall) { owner?.refresh(flash: false) }
    }

    private init() {
        // (the screenshots: as if on FaceTime, the frame up the whole time)
        if Launch.onCall {
            onCall = true
            hint = true
            return
        }
        let d = Delegate()
        d.owner = self
        delegate = d
        observer.setDelegate(d, queue: .main)
        refresh(flash: false)
    }

    /// on coming back into the app (flash: show the frame again), and whenever a call starts or ends
    func refresh(flash: Bool) {
        guard !Launch.onCall else { return }
        let was = onCall
        onCall = observer.calls.contains { $0.hasConnected && !$0.hasEnded }
        if onCall && (flash || !was) { showHint() }
        if !onCall {
            hideHint?.cancel()
            hint = false
            bandHidden = false
        }
    }

    private func showHint() {
        hideHint?.cancel()
        withAnimation(.easeOut(duration: 0.3)) { hint = true }
        let w = DispatchWorkItem { [weak self] in
            withAnimation(.easeOut(duration: 0.5)) { self?.hint = false }
        }
        hideHint = w
        DispatchQueue.main.asyncAfter(deadline: .now() + 6, execute: w)
    }
}

/// The size of FaceTime's little window on an iPhone held upright (its smallest, as it first appears): about a
/// third of the way across, and taller than it's wide. A touch generous, so the video never covers anything.
enum CallSize {
    static func slot(_ screenWidth: CGFloat) -> CGSize {
        let w = (min(max(screenWidth, 320), 500) * 0.31).rounded()
        return CGSize(width: w, height: (w * 1.6).rounded())
    }
    /// the gap FaceTime leaves round its window
    static let margin: CGFloat = 8
}

extension View {
    /// while a call's on (and the screen's upright), this sits under the call band
    func callBand(_ place: PlaceModel) -> some View { modifier(CallBandRule(place: place)) }
}

struct CallBandRule: ViewModifier {
    let place: PlaceModel
    @State private var call = CallWatch.shared
    /// how wide the screen under it is (the window's about a third of it)
    @State private var width: CGFloat = 390
    @Environment(\.verticalSizeClass) private var vertical
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        let on = call.onCall && !call.bandHidden && vertical != .compact
        content
            .background {
                GeometryReader { g in
                    Color.clear
                        .onAppear { width = g.size.width }
                        .onChange(of: g.size.width) { _, w in width = w }
                }
            }
            .safeAreaInset(edge: .top, spacing: 0) {
                if on { CallBand(place: place, width: width).transition(.move(edge: .top).combined(with: .opacity)) }
            }
            .animation(reduceMotion ? nil : .easeOut(duration: 0.3), value: on)
    }
}

/// across the top while a call's on: your touches on the left, and on the right an empty frame where FaceTime's
/// window fits
struct CallBand: View {
    let place: PlaceModel
    let width: CGFloat
    @State private var call = CallWatch.shared
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let slot = CallSize.slot(width)
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .firstTextBaseline) {
                    Text("ON A CALL").font(.px(11, 700)).kerning(1).foregroundStyle(Color.terracotta)
                    Spacer(minLength: 4)
                    Button {
                        Haptics.tap()
                        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.3)) { call.bandHidden = true }
                    } label: {
                        Text("Hide").font(.px(12, 700)).foregroundStyle(Color.muted).padding(.horizontal, 6).padding(.vertical, 2)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Put this away for the rest of the call")
                }
                Text("On FaceTime with \(place.theirName)? Drag their video into the frame and it won’t cover anything, on any tab.")
                    .font(.pxSmall).foregroundStyle(Color.inkSoft)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
                if place.partnerHere {
                    Text("Send a touch").font(.pxTiny).foregroundStyle(Color.muted)
                    CallTouches(place: place)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .frame(height: slot.height)
            CallFrame(name: place.theirName, size: slot, hint: call.hint)
        }
        .padding(.leading, 14)
        .padding(.trailing, CallSize.margin)
        .padding(.vertical, CallSize.margin)
        .frame(maxWidth: .infinity)
        .background(Color.paper.ignoresSafeArea(edges: .top))
        .overlay(alignment: .bottom) { Rectangle().fill(Color.ink).frame(height: PX) }
    }
}

/// a few touches, small, two rows of three (the band's narrow)
private struct CallTouches: View {
    let place: PlaceModel
    @State private var busy: TouchKind?

    var body: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 3), spacing: 6) {
            ForEach(TOUCHES, id: \.id) { t in
                Button {
                    guard busy == nil else { return }
                    busy = t.id
                    Haptics.touch(t.id)
                    place.sendTouch(t.id)
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.9) { busy = nil }
                } label: {
                    GlyphView(glyph: t.glyph, scale: 2).frame(height: 16).opacity(busy == t.id ? 0.5 : 1)
                }
                .buttonStyle(ChipStyle(on: busy == t.id))
                .accessibilityLabel("Send \(t.one)")
            }
        }
    }
}

/// where FaceTime's window fits: an empty picture frame, like the ones over the couch
struct CallFrame: View {
    let name: String
    let size: CGSize
    var hint = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(spacing: 6) {
            Text("ON FACETIME?").font(.px(10, 700)).kerning(1).foregroundStyle(Color(hex: "#f2d48a"))
            Text("Drag \(name) here").font(.px(14, 700)).foregroundStyle(Color(hex: "#fbf3e2")).multilineTextAlignment(.center)
            Text("so nothing’s hidden").font(.px(10, 500)).foregroundStyle(Color(hex: "#fbf3e2").opacity(0.75)).multilineTextAlignment(.center)
        }
        .padding(10)
        .frame(width: size.width, height: size.height)
        .background(Color(hex: "#2a2124").opacity(0.85))
        // like the pictures over the couch: a wooden frame, here with nothing in it yet (dashed; it blinks for a
        // few seconds as you come in)
        .overlay {
            TimelineView(.animation(minimumInterval: 0.5, paused: !hint || reduceMotion)) { ctx in
                let dim = hint && !reduceMotion && Int(ctx.date.timeIntervalSinceReferenceDate * 2) % 2 == 0
                Rectangle().strokeBorder(Color(hex: "#f2d48a").opacity(dim ? 0.35 : 1), style: StrokeStyle(lineWidth: 3, dash: [7, 5])).padding(4)
            }
        }
        .overlay { Rectangle().strokeBorder(Color(hex: "#8a5a3a"), lineWidth: 4) }
        .overlay(alignment: .topLeading) { corner }
        .overlay(alignment: .topTrailing) { corner }
        .overlay(alignment: .bottomLeading) { corner }
        .overlay(alignment: .bottomTrailing) { corner }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("On FaceTime? Drag \(name)’s video here so it doesn’t cover anything.")
    }

    private var corner: some View {
        Rectangle().fill(Color(hex: "#5e3a24")).frame(width: 8, height: 8)
    }
}
