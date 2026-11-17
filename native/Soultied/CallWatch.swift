import SwiftUI
import CallKit

/*
 * On FaceTime with your person while you're in the app: FaceTime's little video window floats over a corner of
 * the screen. Apps can't move it, but you can, so the app keeps the top corner clear for it (Home's jar of
 * stitches steps aside) and, as you come in during a call, shows for a few seconds where it fits: an empty
 * picture frame, "Drag Rohan here".
 *
 * CXCallObserver only says a call's going on (FaceTime, a phone call, WhatsApp…), never who with or what's
 * said, and needs no permission.
 */

@Observable
final class CallWatch {
    static let shared = CallWatch()
    /// a call's connected right now
    private(set) var onCall = false
    /// the empty frame's showing (a few seconds, as you come into the app during a call)
    private(set) var hint = false

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

/// where FaceTime's window fits: an empty picture frame in the top corner, for a few seconds
struct CallSlot: View {
    let name: String
    @State private var call = CallWatch.shared
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// about the size of FaceTime's little window on an iPhone
    static let width: CGFloat = 104
    static let height: CGFloat = 156

    var body: some View {
        ZStack(alignment: .topTrailing) {
            if call.hint {
                frame
                    .padding(.top, 4)
                    .padding(.trailing, 8)
                    .transition(reduceMotion ? AnyTransition.opacity : AnyTransition.opacity.combined(with: AnyTransition.scale(scale: 0.92, anchor: .topTrailing)))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
        .allowsHitTesting(false)
    }

    private var frame: some View {
        VStack(spacing: 6) {
            Text("ON FACETIME?").font(.px(10, 700)).kerning(1).foregroundStyle(Color(hex: "#f2d48a"))
            Text("Drag \(name) here").font(.px(14, 700)).foregroundStyle(Color(hex: "#fbf3e2")).multilineTextAlignment(.center)
            Text("so nothing’s hidden").font(.px(10, 500)).foregroundStyle(Color(hex: "#fbf3e2").opacity(0.75)).multilineTextAlignment(.center)
        }
        .padding(10)
        .frame(width: Self.width, height: Self.height)
        .background(Color(hex: "#2a2124").opacity(0.72))
        // like the pictures over the couch: a wooden frame, here with nothing in it yet (dashed)
        .overlay { Rectangle().strokeBorder(Color(hex: "#f2d48a"), style: StrokeStyle(lineWidth: 3, dash: [7, 5])).padding(4) }
        .overlay { Rectangle().strokeBorder(Color(hex: "#8a5a3a"), lineWidth: 4) }
        .overlay(alignment: .topLeading) { corner }
        .overlay(alignment: .topTrailing) { corner }
        .overlay(alignment: .bottomLeading) { corner }
        .overlay(alignment: .bottomTrailing) { corner }
        .shadow(color: .black.opacity(0.35), radius: 0, x: 3, y: 3)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("On FaceTime? Drag \(name)’s video to this corner so it doesn’t cover anything.")
    }

    private var corner: some View {
        Rectangle().fill(Color(hex: "#5e3a24")).frame(width: 8, height: 8)
    }
}
