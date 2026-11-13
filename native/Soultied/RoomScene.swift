import SwiftUI
import SoultiedCore

/*
 * The living room, drawn by the same renderer as the website (SoultiedCore's RoomRenderer, checked pixel
 * for pixel against it). On the iPhone's home it's cropped close around the two of you: the pictures over
 * the couch (your wall), the couch, and the coffee table with today's letter. Turned sideways, it's the
 * whole room.
 */

/// which part of the room a cropped view shows (in room pixels), always at a whole number of screen pixels each
struct RoomCrop {
    /// the room x to keep in the middle
    var focusX: CGFloat
    /// the top of the crop, and how tall it is
    var top: CGFloat
    var height: CGFloat
    /// how many room pixels across it shows, at least
    var minWidth: CGFloat

    /// the welcome: the couch, a little way back
    static let couch = RoomCrop(focusX: CGFloat(ROOM_FOCUS_X), top: 34, height: 130, minWidth: 160)
    /// Home: close in on the two of you, from the pictures over the couch down to the letter on the table
    static let home = RoomCrop(focusX: 236, top: 14, height: 162, minWidth: 108)
    /// the welcome: the couch, with the rug in front of it for the name to sit on
    static let welcome = RoomCrop(focusX: CGFloat(ROOM_FOCUS_X), top: 30, height: 150, minWidth: 160)

    /// screen pixels per room pixel, for this much space (as big as fits across, and down if there's a limit)
    func scale(width: CGFloat, height: CGFloat? = nil, displayScale: CGFloat) -> CGFloat {
        var k = (width * displayScale / minWidth).rounded(.down)
        if let height { k = min(k, (height * displayScale / self.height + 0.001).rounded(.down)) }
        return max(1, k)
    }

    /// how tall the view is, in points
    func viewHeight(width: CGFloat, maxHeight: CGFloat? = nil, displayScale: CGFloat) -> CGFloat {
        height * scale(width: width, height: maxHeight, displayScale: displayScale) / displayScale
    }
}

struct RoomScene: View {
    let place: PlaceModel
    /// cropped (the home screen, the welcome), or the whole room (sideways)
    var couchOnly = true
    /// the part of the room a cropped view shows
    var crop = RoomCrop.couch
    var paused = false
    /// what to show instead of what's out in the room (trying something on in the catalogue)
    var decor: Decor?
    /// mark where the things you can tap are, for the first-run tour (Tour.swift)
    var tourSpots = false
    var onTap: (HotspotId) -> Void = { _ in }

    @Environment(\.displayScale) private var displayScale
    @State private var painter = RoomPainter()
    @State private var start = Date()
    @State private var fireAt = -100.0
    @State private var scoot: (from: Double, to: Double, at: Double)?
    @State private var heartAt = -1.0
    @State private var touch: RoomTouch?
    @State private var scootNote: String?

    private func now() -> Double { Date().timeIntervalSince(start) }

    /// pt per room pixel, and where the room's top-left corner goes
    private func layout(_ size: CGSize) -> (u: CGFloat, x: CGFloat, y: CGFloat, h: CGFloat) {
        let W = max(1, size.width)
        if couchOnly {
            let u = crop.scale(width: W, height: size.height > 1 ? size.height : nil, displayScale: displayScale) / displayScale
            var x = W / 2 - crop.focusX * u
            x = min(0, max(W - CGFloat(ROOM_W) * u, x))
            return (u, x, -crop.top * u, crop.height * u)
        }
        let H = max(1, size.height)
        let k = max(1, min(W * displayScale / CGFloat(ROOM_W), H * displayScale / CGFloat(ROOM_H)).rounded(.down))
        let u = k / displayScale
        return (u, (W - CGFloat(ROOM_W) * u) / 2, (H - CGFloat(ROOM_H) * u) / 2, H)
    }

    /// how close the two of you sit right now (scooting closer plays once, for each of you)
    private func closeness(_ t: Double) -> (Double, Bool) {
        let settled = Double(place.couchLevel) / Double(COUCH_STEPS)
        guard let s = scoot else { return (Double(min(place.couchShown, place.couchLevel)) / Double(COUCH_STEPS), false) }
        let p = (t - s.at) / 1.4
        if p <= 0 { return (s.from, false) }
        if p >= 1 { return (settled, false) }
        let e = p < 0.5 ? 2 * p * p : 1 - pow(-2 * p + 2, 2) / 2
        return (s.from + (s.to - s.from) * e, true)
    }

    /// how the fire's burning (worked out once per change, not every frame), and whose log is on it today
    private struct Hearth {
        var level = 2
        var left = false
        var right = false
    }

    private var hearth: Hearth {
        guard place.partnerHere else { return Hearth() }
        return Hearth(level: place.fire.level, left: place.hereToday(place.hostId), right: place.hereToday(place.guestId))
    }

    private func state(_ t: Double, _ h: Hearth) -> RoomState {
        let seats = place.seats
        var st = RoomState(left: seats.left, right: seats.right)
        st.decor = decor ?? place.decor
        st.letterUnread = place.letterWaiting
        st.fire = 0.6 + 0.4 * max(0, 1 - (t - fireAt) / 6)
        st.flame = h.level
        st.logLeft = h.left
        st.logRight = h.right
        let (c, moving) = closeness(t)
        st.closeness = c
        st.scooting = moving
        st.heartAt = heartAt
        let host = place.hostId, guest = place.guestId
        st.moodLeft = place.moods.current(host, now: place.now.timeIntervalSince1970 * 1000)?.glyph
        st.moodRight = place.moods.current(guest, now: place.now.timeIntervalSince1970 * 1000)?.glyph
        if let tc = touch, t - tc.at < TOUCH_LEN { st.touch = tc }
        st.wallArt = place.board.art?.pixels
        st.wallNews = place.wallNews != nil
        st.gamesWaiting = !place.gamesWaiting.isEmpty
        st.music = place.recordOn
        return st
    }

    var body: some View {
        GeometryReader { geo in
            let L = layout(geo.size)
            let h = hearth
            TimelineView(.animation(minimumInterval: 1.0 / 12, paused: paused)) { ctx in
                let t = ctx.date.timeIntervalSince(start)
                // (asks for the frame; it's drawn off the main thread and shows when it's ready)
                let _ = painter.request(state(t, h), t)
                RoomFrame(painter: painter, w: CGFloat(ROOM_W) * L.u, h: CGFloat(ROOM_H) * L.u, x: L.x, y: L.y)
                    .frame(width: geo.size.width, height: couchOnly ? L.h : geo.size.height, alignment: .topLeading)
                    .clipped()
            }
            .contentShape(Rectangle())
            .gesture(
                SpatialTapGesture().onEnded { v in
                    let rx = Double((v.location.x - L.x) / L.u), ry = Double((v.location.y - L.y) / L.u)
                    guard let id = hitTest(rx, ry, closeness(now()).0) else { return }
                    if id == .fire {
                        fireAt = now()
                        Haptics.soft()
                    }
                    onTap(id)
                }
            )
            .overlay(alignment: .topLeading) {
                if tourSpots { spots(L) }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityText)
        .onAppear { startScootIfDue() }
        .onChange(of: place.couchLevel) { _, _ in startScootIfDue() }
        .onChange(of: place.playing?.id) { _, _ in playTouch() }
    }

    /// where you, your person, the wall, the letter and the record player are on screen
    @ViewBuilder
    private func spots(_ L: (u: CGFloat, x: CGFloat, y: CGFloat, h: CGFloat)) -> some View {
        let c = closeness(now()).0
        ForEach([HotspotId.left, .right, .board, .pet, .letter, .music], id: \.self) { id in
            let h = hotspotRect(id, c)
            // (marked before it's positioned: a positioned view fills its whole parent, and the mark would too)
            Color.clear
                .frame(width: CGFloat(h.w) * L.u, height: CGFloat(h.h) * L.u)
                .anchorPreference(key: TourSpots.self, value: .bounds) { ["spot.\(id.rawValue)": $0] }
                .position(x: L.x + CGFloat(h.x + h.w / 2) * L.u, y: L.y + CGFloat(h.y + h.h / 2) * L.u)
                .allowsHitTesting(false)
        }
    }

    private var accessibilityText: String {
        let s = place.seats
        if s.right.status == .empty { return "\(s.left.name) on the couch, saving a seat for \(place.theirName)." }
        let f = place.fire
        let fire = f.level == 0 ? "the fire behind them down to embers" : "\(CouchState.fireNames[f.level].lowercased()) behind them, \(f.streak) \(f.streak == 1 ? "day" : "days") in a row"
        return "\(s.left.name) and \(s.right.name) on the couch, \(fire)."
    }

    private func startScootIfDue() {
        let level = place.couchLevel, shown = place.couchShown
        guard place.partnerHere, shown < level, scoot == nil else { return }
        let t = now() + 0.9
        scoot = (Double(shown) / Double(COUCH_STEPS), Double(level) / Double(COUCH_STEPS), t)
        heartAt = t + 1.2
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.6) {
            place.markCouchShown(level)
            Haptics.soft()
        }
    }

    private func playTouch() {
        guard let p = place.playing else { return }
        let d = touchDef(p.kind)
        touch = RoomTouch(kind: p.kind.rawValue, together: d.together, from: p.by == place.hostId ? .left : .right, at: now(), glyph: d.glyph)
        if p.by != place.me { Haptics.touch(p.kind) }
    }
}

/// The room's frames, drawn off the main thread so nothing moving on screen (a card sliding in, a scroll, a
/// tab changing) waits on them. The first frame is drawn straight away, so the room never shows up empty; after
/// that each one goes to the drawing queue and shows when it comes back. If a frame's asked for while one's
/// still drawing, the newest waits its turn and the rest are skipped.
@Observable
final class RoomPainter {
    /// the newest frame back from the queue
    private(set) var image: CGImage?
    /// the newest frame, however it was drawn (the first one never goes through `image`, so asking for it
    /// mid-update doesn't change what's being watched)
    @ObservationIgnored private(set) var current: CGImage?
    @ObservationIgnored private var renderer: RoomRenderer?
    @ObservationIgnored private var busy = false
    @ObservationIgnored private var waiting: (RoomState, Double)?

    private static let queue = DispatchQueue(label: "app.soultied.room", qos: .userInitiated)

    func request(_ state: RoomState, _ t: Double) {
        guard let r = renderer else {
            let r = RoomRenderer()
            renderer = r
            current = Pixels.image(r.render(state, t))
            return
        }
        if busy {
            waiting = (state, t)
            return
        }
        draw(r, state, t)
    }

    private func draw(_ r: RoomRenderer, _ state: RoomState, _ t: Double) {
        busy = true
        Self.queue.async {
            let img = Pixels.image(r.render(state, t))
            DispatchQueue.main.async {
                self.current = img
                self.image = img
                self.busy = false
                if let w = self.waiting {
                    self.waiting = nil
                    self.draw(r, w.0, w.1)
                }
            }
        }
    }
}

/// the room's picture, scaled up in whole pixels (on its own, so only it redraws when a frame comes back)
private struct RoomFrame: View {
    let painter: RoomPainter
    let w: CGFloat
    let h: CGFloat
    let x: CGFloat
    let y: CGFloat

    var body: some View {
        ZStack(alignment: .topLeading) {
            Color.roomBrown
            if let img = painter.image ?? painter.current {
                Image(decorative: img, scale: 1)
                    .resizable()
                    .interpolation(.none)
                    .frame(width: w, height: h)
                    .offset(x: x, y: y)
            }
        }
    }
}

/// how tall the welcome's couch view is for a width
func couchHeight(width: CGFloat, scale: CGFloat) -> CGFloat {
    RoomCrop.couch.viewHeight(width: width, displayScale: scale)
}
