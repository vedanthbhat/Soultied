import Foundation

/*
 * The living room: 320 x 180 native pixels, drawn from code every frame. The same as the website's
 * src/pixel/room.ts, line for line, so the room on the iPhone matches the room on the website.
 *
 * Numbers here are Doubles, the way they are in JavaScript, and pixels are placed the way the website
 * places them (fractions dropped), so the two draw exactly the same picture.
 */

public let ROOM_W = 320
public let ROOM_H = 180
let RW = 320.0
let RH = 180.0

/// a tiny picture: rows of characters, each a colour from `pal` ('.' is see-through)
public struct Glyph: Hashable, Sendable {
    public let rows: [String]
    public let pal: [Character: RGB]
    public init(rows: [String], pal: [Character: RGB]) {
        self.rows = rows
        self.pal = pal
    }
    public init(_ rows: [String], _ pal: [Character: String]) {
        self.rows = rows
        self.pal = pal.mapValues { RGB($0) }
    }
    var width: Double { Double(rows.map { $0.count }.max() ?? 0) }
}

public enum SeatStatus: String, Sendable { case online, away, offline, empty }

public struct Seat: Sendable {
    public var avatar: AvatarConfig?
    public var name: String
    public var status: SeatStatus
    public init(avatar: AvatarConfig?, name: String, status: SeatStatus) {
        self.avatar = avatar
        self.name = name
        self.status = status
    }
    public static let empty = Seat(avatar: nil, name: "", status: .empty)
}

public enum HotspotId: String, CaseIterable, Sendable {
    case left, right, letter, fire, photo, remote, door, games, music, decor, board, pet
}

public struct Hotspot: Sendable {
    public let id: HotspotId
    public let x: Double, y: Double, w: Double, h: Double
}

/// what's out in the room (see Decor.swift)
public struct Decor: Hashable, Sendable {
    public var wall: String
    public var couch: String
    public var rug: String
    public var pet: String
    public var view: String
    public var painting: String
    public var plant: String
    public init(wall: String = "sage", couch: String = "terracotta", rug: String = "diamond", pet: String = "ginger", view: String = "snow", painting: String = "dusk", plant: String = "monstera") {
        self.wall = wall
        self.couch = couch
        self.rug = rug
        self.pet = pet
        self.view = view
        self.painting = painting
        self.plant = plant
    }
    public static let start = Decor()
}

/// the picture in the frame over the couch: a doodle or photo, as a few pixels
public struct WallArtPixels: Hashable, Sendable {
    public let w: Int
    public let h: Int
    public let pal: [RGB]
    public let px: [Character]
    public init(w: Int, h: Int, pal: [RGB], px: String) {
        self.w = w
        self.h = h
        self.pal = pal
        self.px = Array(px)
    }
}

public struct RoomTouch: Sendable {
    public var kind: String
    /// they slide together for it (all but a boop)
    public var together: Bool
    /// whoever sent it
    public var from: HotspotId
    public var at: Double
    public var glyph: Glyph
    public init(kind: String, together: Bool, from: HotspotId, at: Double, glyph: Glyph) {
        self.kind = kind
        self.together = together
        self.from = from
        self.at = at
        self.glyph = glyph
    }
}

public struct RoomState {
    public var left: Seat
    public var right: Seat
    public var letterUnread = false
    /// 0..1 fire intensity: stoked on a tap
    public var fire = 0.6
    /// how many days in a row you've both shown up, as a fire: 0 embers, 1 a small flame, 2 steady, 3 roaring (see CouchState.fire)
    public var flame = 2
    /// whose log is on the fire today (each of you adds one when you show up)
    public var logLeft = false
    public var logRight = false
    public var hover: HotspotId? = nil
    /// how close the two sit: 0 = the two ends, 1 = side by side
    public var closeness = 0.0
    public var scooting = false
    /// scene time a little heart started floating up between them (-1 for none)
    public var heartAt = -1.0
    public var gamesWaiting = false
    public var music = false
    public var decor: Decor = .start
    /// just the room, nobody on the couch (the catalogue's thumbnails)
    public var bare = false
    public var moodLeft: Glyph? = nil
    public var moodRight: Glyph? = nil
    public var touch: RoomTouch? = nil
    public var wallArt: WallArtPixels? = nil
    public var wallNews = false

    public init(left: Seat, right: Seat) {
        self.left = left
        self.right = right
    }
}

/// how long a touch plays, in seconds
public let TOUCH_LEN = 2.8

// Layout constants shared by drawing and hotspots
let FLOOR_Y = 121.0
struct CouchBox { static let x = 186.0, y = 121.0, w = 92.0, seatY = 140.0, baseY = 150.0 }
let COUCH_MID = CouchBox.x + CouchBox.w / 2
let SEAT_FAR = 26.0
let SEAT_NEAR = 7.0

/// Where the two sit, given how close they've grown (0..1).
public func seatXs(_ closeness: Double = 0) -> (left: Double, right: Double) {
    let c = max(0, min(1, closeness))
    let d = jsRound(SEAT_FAR + (SEAT_NEAR - SEAT_FAR) * c)
    return (COUCH_MID - d, COUCH_MID + d)
}

// the fireplace is on the back wall, behind the couch, so the fire burns between the two of you
struct FireBox { static let x = 232.0, cx = 232.0, openX = 218.0, openW = 29.0, openY = 78.0, openB = 116.0 }
/// how far the fireplace's arch cuts in, on its top five rows
let FIRE_ARCH: [Double] = [9, 5, 3, 2, 1]
struct TableBox { static let x = 205.0, y = 163.0, w = 54.0 }
struct DoorBox { static let x = 160.0, y = 64.0, w = 24.0 }
struct GamesBox { static let x = 168.0, y = 133.0, w = 14.0, h = 17.0 }
struct SideTableBox { static let x = 279.0, y = 130.0, w = 20.0 }
struct DeckBox { static let x = 280.0, y = 125.0, w = 18.0 }

let HOTSPOTS: [Hotspot] = [
    Hotspot(id: .letter, x: TableBox.x + 19, y: TableBox.y - 9, w: 18, h: 12),
    Hotspot(id: .fire, x: FireBox.openX, y: FireBox.openY, w: FireBox.openW, h: FireBox.openB - FireBox.openY),
    Hotspot(id: .photo, x: 200, y: 43, w: 12, h: 12),
    Hotspot(id: .remote, x: TableBox.x + 36, y: TableBox.y - 4, w: 10, h: 6),
    Hotspot(id: .music, x: SideTableBox.x - 1, y: DeckBox.y - 10, w: SideTableBox.w + 2, h: 151 - (DeckBox.y - 10)),
    Hotspot(id: .door, x: DoorBox.x - 1, y: DoorBox.y - 2, w: DoorBox.w + 2, h: FLOOR_Y - DoorBox.y + 2),
    Hotspot(id: .games, x: GamesBox.x - 1, y: GamesBox.y - 2, w: GamesBox.w + 2, h: GamesBox.h + 2),
    // the painting over the sideboard: decorate the room
    Hotspot(id: .decor, x: 109, y: 14, w: 38, h: 28),
    // the picture over the mantel, and the two beside the chimney: our wall (notes, doodles, photos, memories)
    Hotspot(id: .board, x: 214, y: 24, w: 34, h: 26),
    Hotspot(id: .board, x: 263, y: 20, w: 47, h: 28),
    // the pet asleep on its cushion: choose who sleeps there
    Hotspot(id: .pet, x: PetBox.x - 4, y: PetBox.y - 5, w: 28, h: 15),
]

/// Focal point to keep in view when the screen is narrower than 16:9.
public let ROOM_FOCUS_X = 232.0

/// The tappable spots, with the two seats wherever the couple is sitting now.
public func hotspots(_ closeness: Double = 0) -> [Hotspot] {
    let s = seatXs(closeness)
    let w = min(20, s.right - s.left + 2)
    return [
        Hotspot(id: .left, x: s.left - (w / 2).rounded(.down), y: 112, w: w, h: 38),
        Hotspot(id: .right, x: s.right - (w / 2).rounded(.up) + 1, y: 112, w: w, h: 38),
    ] + HOTSPOTS
}

public func hitTest(_ x: Double, _ y: Double, _ closeness: Double = 0) -> HotspotId? {
    for h in hotspots(closeness) where x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h { return h.id }
    return nil
}

public func hotspotRect(_ id: HotspotId, _ closeness: Double = 0) -> Hotspot {
    hotspots(closeness).first { $0.id == id }!
}

/* ------------------------------------------------------------------------------------------------ */

@inline(__always) func hx(_ s: String) -> RGB { RGB(s) }

enum P {
    static let crown = hx("#3f2e29"), crownL = hx("#57403a")
    static let wall = hx("#4f5f53"), wallStripe = hx("#4c5b50"), wallDot = hx("#56675a")
    static let wains = hx("#6a4a3a"), wainsL = hx("#7d5a47"), wainsD = hx("#523829"), wainsDD = hx("#432e22")
    static let floorA = hx("#7a5337"), floorB = hx("#6f4b31"), floorC = hx("#835a3c"), floorSeam = hx("#4e3322")
    static let brick = hx("#9a5a44"), brickL = hx("#ad6a51"), brickD = hx("#814736"), mortar = hx("#5f3b30")
    static let stone = hx("#a3978a"), stoneL = hx("#b8ad9f"), stoneD = hx("#817568"), stoneDD = hx("#655b51")
    static let soot = hx("#221718"), sootL = hx("#33221f")
    static let mantel = hx("#5a3a2c"), mantelL = hx("#7a5540"), mantelD = hx("#402920")
    static let couch = hx("#b8674f"), couchL = hx("#cc7c62"), couchD = hx("#95513e"), couchDD = hx("#763f31")
    static let cream = hx("#efdcb8"), creamD = hx("#d2bb93")
    static let mustard = hx("#d09a3e"), mustardD = hx("#a7772b")
    static let sage = hx("#8a9a72"), sageD = hx("#6a7856")
    static let rugA = hx("#e3cfa7"), rugB = hx("#b8674f"), rugC = hx("#7d8b69"), rugD = hx("#c8b088")
    static let wood = hx("#6b4633"), woodL = hx("#845a42"), woodD = hx("#4d3224")
    static let leaf = hx("#6f8f4e"), leafL = hx("#8fae62"), leafD = hx("#4f6e38")
    static let pot = hx("#b8674f"), potD = hx("#8f4b3a")
    static let frame = hx("#e6d6b8"), frameD = hx("#bba888")
    static let skyA = hx("#1b2340"), skyB = hx("#232d52"), skyC = hx("#2e3a64")
    static let moon = hx("#f4ecd0")
    static let brass = hx("#b48c4a"), brassL = hx("#d6ad63")
}

/// JavaScript's % on numbers (the sign follows the left side)
@inline(__always) func jm(_ a: Double, _ b: Double) -> Double { a.truncatingRemainder(dividingBy: b) }
@inline(__always) func fl(_ v: Double) -> Double { v.rounded(.down) }
/// JavaScript's `v | 0` (and `>>` and `&` work on these, as 32-bit integers)
@inline(__always) func i32(_ v: Double) -> Int { ti(v) }

/// A layer of the room: pixels, and which of them give off their own light (so the lighting leaves them be).
public final class Layer: PixelBuffer {
    public var emit: [UInt8]

    override public init(_ w: Int, _ h: Int) {
        emit = [UInt8](repeating: 0, count: w * h)
        super.init(w, h)
    }

    @inline(__always) func S(_ x: Double, _ y: Double, _ c: RGB, _ a: Double = 255) { set(ti(x), ti(y), c, a) }

    func R(_ x: Double, _ y: Double, _ rw: Double, _ rh: Double, _ c: RGB, _ a: Double = 255) {
        var j = 0.0
        while j < rh {
            var i = 0.0
            while i < rw {
                S(x + i, y + j, c, a)
                i += 1
            }
            j += 1
        }
    }

    func HL(_ x: Double, _ y: Double, _ lw: Double, _ c: RGB) { R(x, y, lw, 1, c) }
    func VL(_ x: Double, _ y: Double, _ lh: Double, _ c: RGB) { R(x, y, 1, lh, c) }

    @inline(__always) func G(_ x: Double, _ y: Double, _ c: RGB, _ a: Double = 255) {
        S(x, y, c, a)
        let xi = ti(x), yi = ti(y)
        if xi >= 0 && yi >= 0 && xi < w && yi < h { emit[yi * w + xi] = 1 }
    }

    func UG(_ x: Double, _ y: Double, _ uw: Double, _ uh: Double) {
        var j = y
        while j < y + uh {
            var i = x
            while i < x + uw {
                // the website writes to a typed array, where a fractional index does nothing
                if i >= 0 && j >= 0 && i < Double(w) && j < Double(h) && i == i.rounded() && j == j.rounded() { emit[Int(j) * w + Int(i)] = 0 }
                i += 1
            }
            j += 1
        }
    }

    func copyFrom(_ o: Layer) {
        data = o.data
        emit = o.emit
    }

    /// a sprite drawn from rows (for the pets and the like); unknown keys are see-through
    func rows(_ rows: [String], _ pal: [Character: RGB], _ x: Double, _ y: Double) {
        for (j, row) in rows.enumerated() {
            for (i, k) in row.enumerated() where k != "." {
                if let c = pal[k] { S(x + Double(i), y + Double(j), c) }
            }
        }
    }
}

/* ------------------------------------------------------------------------------------------------ */

/// The parts that never move, drawn once per look of the room.
private var STATIC: [String: Layer] = [:]
private var STATIC_ORDER: [String] = []
private let staticLock = NSLock()

func staticLayer(_ d: Decor) -> Layer {
    let key = "\(d.wall)|\(d.view)|\(d.rug)|\(d.couch)"
    staticLock.lock()
    defer { staticLock.unlock() }
    if let hit = STATIC[key] { return hit }
    let L = Layer(ROOM_W, ROOM_H)
    drawWall(L, d.wall)
    drawFloor(L)
    drawWindow(L, d.view)
    drawFireplace(L)
    drawSideboard(L)
    drawGallery(L)
    drawDarkDoor(L)
    drawBookshelf(L)
    drawLamp(L)
    drawRug(L, d.rug)
    drawSideTable(L)
    drawCouch(L, d.couch)
    // trying things on (and the catalogue's thumbnails) makes a few of these; keep the latest
    if STATIC_ORDER.count >= 12 {
        STATIC[STATIC_ORDER.removeFirst()] = nil
    }
    STATIC[key] = L
    STATIC_ORDER.append(key)
    return L
}

/// One room drawn at a time (the app draws off the main thread, and the drawing keeps a few caches).
let roomLock = NSLock()

/// Draws the room. Keep one per screen: it reuses its frame.
public final class RoomRenderer {
    let frame = Layer(ROOM_W, ROOM_H)
    public init() {}

    /// One frame of the room for time `t` (seconds), as RGBA. (Safe from any thread; the frame it returns is
    /// reused by the next call, so copy it out before drawing again.)
    public func render(_ state: RoomState, _ t: Double) -> PixelBuffer {
        roomLock.lock()
        defer { roomLock.unlock() }
        renderRoom(frame, state, t)
        return frame
    }
}

func renderRoom(_ L: Layer, _ state: RoomState, _ t: Double) {
    let d = state.decor
    L.copyFrom(staticLayer(d))
    drawPainting(L, d.painting, state)
    drawWallArt(L, state, t)
    drawFire(L, t, state.fire, state)
    drawDoorGlow(L, t, state.hover == .door)
    drawCandles(L, t)
    drawWeather(L, t, d.view)
    drawPhotoPortrait(L, state)
    drawPet(L, t, d.pet)
    drawGameStack(L, t, state.gamesWaiting, state.hover == .games)
    drawTurntable(L, t, state.music, state.hover == .music)

    // characters on the couch (left seat first so the right one overlaps on lean)
    let closeness = state.closeness
    let leftEmpty = state.left.avatar == nil || state.left.status == .empty
    let rightEmpty = state.right.avatar == nil || state.right.status == .empty
    // a touch playing: for most, they slide together, lean in, and slide back
    let tc = state.touch != nil && !leftEmpty && !rightEmpty && !state.bare ? state.touch : nil
    let age = tc != nil ? t - tc!.at : -1
    let playing = tc != nil && age >= 0 && age <= TOUCH_LEN
    let pullRaw = playing && tc!.together ? (age < 0.5 ? age / 0.5 : age > TOUCH_LEN - 0.6 ? (TOUCH_LEN - age) / 0.6 : 1) : 0
    let pull = max(0, min(1, pullRaw))
    let eased = pull * pull * (3 - 2 * pull)
    let s = seatXs(closeness + (1 - closeness) * eased)
    let lx = s.left, rx = s.right
    let sliding = pull > 0 && pull < 1 && closeness < 1
    // a little hop on alternate frames while they shuffle along
    let lift: Double = (state.scooting || sliding) && Int(fl(t * 8)) % 2 == 0 ? 1 : 0
    let snug = closeness >= 1 && !state.scooting && !leftEmpty && !rightEmpty
    let holding = pull >= 1
    var leanL: Double = snug || holding ? 1 : 0
    var leanR: Double = snug || holding ? -1 : 0
    if holding && (tc!.kind == "kiss" || tc!.kind == "forehead") {
        leanL = 2
        leanR = -2
    }
    // a boop: whoever sent it leans over for a moment
    if playing && tc!.kind == "boop" && age < 1.1 {
        if tc!.from == .left { leanL = max(leanL, 2) } else { leanR = min(leanR, -2) }
    }
    if !state.bare {
        var headL = 0.0
        var headR = 0.0
        if leftEmpty { drawEmptySeat(L, lx, t, state.hover == .left) } else { headL = seatCharacter(L, state.left, lx, t, 0, state.hover == .left, lift, leanL, state.moodLeft != nil) }
        if rightEmpty { drawEmptySeat(L, rx, t, state.hover == .right) } else { headR = seatCharacter(L, state.right, rx, t, 1.7, state.hover == .right, lift, leanR, state.moodRight != nil) }
        drawThread(L, state, t, lx, rx)
        let heartAt = state.heartAt
        if playing { drawTouchFx(L, tc!, age, lx, rx, headL, headR) }
        else if heartAt >= 0 && t - heartAt < 2.6 { drawHeart(L, (lx + rx) / 2, t, heartAt) }
        // side by side: now and then a heart drifts up on its own
        else if snug { drawHeart(L, (lx + rx) / 2, jm(t, 9), 0) }
        // how they're feeling (tucked away while a touch plays, so the two don't crowd each other)
        if !playing || !tc!.together {
            if let m = state.moodLeft, headL != 0 { drawMoodBubble(L, m, lx, headL, .left, t, 0) }
            if let m = state.moodRight, headR != 0 { drawMoodBubble(L, m, rx, headR, .right, t, 1.3) }
        }
    }

    drawTable(L)
    drawSteam(L, t)
    drawLetter(L, t, state.letterUnread, state.hover == .letter)
    drawPlant(L, d.plant)

    applyLighting(L, t, state.fire, state)
}

/// The room with `decor` in it, cropped to a spot (the catalogue's little pictures).
public let DECOR_CROPS: [String: (Int, Int, Int, Int)] = [
    "wall": (56, 6, 96, 64),
    "couch": (180, 108, 102, 68),
    "rug": (88, 124, 84, 56),
    "pet": (170, 132, 54, 36),
    "view": (12, 14, 66, 70),
    "painting": (104, 10, 48, 32),
    "plant": (0, 94, 48, 72),
]

public func renderDecorThumb(_ decor: Decor, _ slot: String, _ left: Seat, _ right: Seat) -> PixelBuffer {
    var st = RoomState(left: left, right: right)
    st.decor = decor
    st.bare = true
    let room = Layer(ROOM_W, ROOM_H)
    roomLock.lock()
    renderRoom(room, st, 1.3)
    roomLock.unlock()
    let (x0, y0, w, h) = DECOR_CROPS[slot] ?? (0, 0, ROOM_W, ROOM_H)
    let out = PixelBuffer(w, h)
    for j in 0..<h {
        let from = ((y0 + j) * ROOM_W + x0) * 4
        out.data.replaceSubrange((j * w * 4)..<((j + 1) * w * 4), with: room.data[from..<(from + w * 4)])
    }
    return out
}
