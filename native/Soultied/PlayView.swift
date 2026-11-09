import SwiftUI
import SoultiedCore

/*
 * Play: the game that needs you, big, at the top (your move, or your person waiting to play live, or a pick
 * for tonight), and every game as a square tile under it, all on one screen: the ones you take turns at
 * (and the escape rooms), then the live ones. Decorating the room lives with the room now (the stitches on
 * Home, and Us).
 */

struct PlayView: View {
    let place: PlaceModel
    @State private var open: GameKind?
    @State private var escaping = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                DarkHeading(title: "Play", sub: "Games for two, and the rooms behind the dark door")
                UpNextCard(place: place) { open = $0 }
                GameGrid(place: place, open: { open = $0 }, escape: {
                    Haptics.tap()
                    escaping = true
                })
            }
            .padding(16)
            .padding(.bottom, 100)
        }
        .scrollIndicators(.hidden)
        .background(RoomBackground())
        .fullScreenCover(isPresented: $escaping) { EscapeScreen(place: place) }
        .fullScreenCover(item: $open) { k in GameScreen(place: place, kind: k) }
    }
}

/// each game's colour on its tile
enum GameColors {
    static func of(_ k: GameKind) -> Color {
        switch k {
        case .fireflies: return Color(hex: "#3b4a6b")
        case .boats: return Color(hex: "#3e6f8a")
        case .noughts: return Color(hex: "#8f4b3a")
        case .fence: return Color(hex: "#5d7a48")
        case .lanterns: return Color(hex: "#2f5b55")
        case .tug: return Color(hex: "#a8574b")
        case .quickdraw: return Color(hex: "#4a3b5c")
        case .rps: return Color(hex: "#7a6430")
        case .doodle: return Color(hex: "#6b4f7a")
        case .coasters: return Color(hex: "#5a4636")
        case .kitchen: return Color(hex: "#9a5a3a")
        }
    }
    static let escape = Color(hex: "#2a1d18")
    /// the glow behind a game's picture
    static func glow(_ k: GameKind) -> Color {
        switch k {
        case .fireflies, .lanterns, .quickdraw, .rps: return Color.butter
        case .noughts, .tug, .kitchen: return Color(hex: "#f39a5a")
        default: return Color(hex: "#c4dcef")
        }
    }
}

/// the one game that's up next: your move, your person waiting to play, or a pick for tonight
struct UpNextCard: View {
    let place: PlaceModel
    var open: (GameKind) -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var ready: Bool { place.partnerHere || place.isDemo }

    /// what to show: the game, the line over its name, what it says, and the button
    private var pick: (kind: GameKind, kicker: String, text: String, button: String) {
        let them = place.theirName
        if let k = place.gamesWaiting.first, let m = place.games[k] {
            let live = Play.isLiveInvite(k)
            return (k, live ? "\(them.uppercased()) WANTS TO PLAY" : "YOUR MOVE", Play.note(m, who: them), live ? "Join →" : "Play →")
        }
        // nothing waiting: something for tonight (a live one when they're around), a different one each day
        let day = Int(Day.today().replacingOccurrences(of: "-", with: "")) ?? 0
        let around = place.them.map { place.status($0) == .online } ?? false
        let pool = around ? LIVE_GAMES : TURN_GAMES
        let k = pool[day % pool.count]
        return (k, around ? "\(them.uppercased()) IS HERE · PLAY NOW" : "A PICK FOR TONIGHT", k.info.tagline, Play.isLiveInvite(k) ? "Invite \(them) →" : "Start →")
    }

    var body: some View {
        if !ready {
            VStack(alignment: .leading, spacing: 8) {
                Text("GAMES FOR TWO").font(.px(11, 700)).kerning(1.4).foregroundStyle(Color.butter)
                Text("Once \(place.theirName) moves in").font(.px(22, 700)).foregroundStyle(Color.paper)
                Text("Every game here is for the two of you. Send the invite from Us, and you can start the moment they take their seat.")
                    .font(.pxSmall).foregroundStyle(Color.paper.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(card(Color(hex: "#3a2a26")))
        } else {
            let p = pick
            Button {
                open(p.kind)
            } label: {
                HStack(alignment: .center, spacing: 12) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(p.kicker).font(.px(11, 700)).kerning(1.4).foregroundStyle(Color.butter).lineLimit(1).minimumScaleFactor(0.7)
                        Text(p.kind.info.name).font(.px(24, 700)).foregroundStyle(Color.paper).lineLimit(1).minimumScaleFactor(0.7)
                        Text(p.text).font(.px(13, 500)).foregroundStyle(Color.paper.opacity(0.8)).lineLimit(3).fixedSize(horizontal: false, vertical: true)
                        Text(p.button)
                            .font(.px(15, 700))
                            .foregroundStyle(Color.cream)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(Color.terracotta)
                            .overlay(Rectangle().stroke(Color.ink, lineWidth: PX))
                            .padding(.top, 4)
                    }
                    Spacer(minLength: 0)
                    TimelineView(.animation(minimumInterval: 1.0 / 12, paused: reduceMotion)) { ctx in
                        let g = reduceMotion ? 0.6 : 0.5 + 0.5 * sin(ctx.date.timeIntervalSinceReferenceDate * 2)
                        GlyphView(glyph: GameArt.icon(p.kind), scale: 9)
                            .background {
                                Circle().fill(GameColors.glow(p.kind).opacity(0.25 + 0.25 * g)).frame(width: 110, height: 110).blur(radius: 24)
                            }
                    }
                    .frame(width: 104, height: 104)
                    .accessibilityHidden(true)
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(card(GameColors.of(p.kind)))
            }
            .buttonStyle(.press)
            .accessibilityLabel("\(p.kicker.capitalized): \(p.kind.info.name). \(p.text)")
        }
    }

    private func card(_ c: Color) -> some View {
        ZStack {
            NotchedFrame(notch: PX).fill(Color.ink).padding(-PX)
            LinearGradient(colors: [c.opacity(0.95), c.opacity(0.7)], startPoint: .topLeading, endPoint: .bottomTrailing)
            Color.black.opacity(0.12)
            VStack(spacing: 0) {
                Rectangle().fill(Color.white.opacity(0.14)).frame(height: PX)
                Spacer(minLength: 0)
                Rectangle().fill(Color.black.opacity(0.3)).frame(height: PX * 2)
            }
        }
        .padding(PX)
    }
}

/// every game as a tile: the ones you play whenever you like (and the escape rooms), then the live ones
struct GameGrid: View {
    let place: PlaceModel
    var open: (GameKind) -> Void
    var escape: () -> Void

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 10), count: 3)
    private var ready: Bool { place.partnerHere || place.isDemo }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            label("Anytime", "take turns whenever you’re here")
            LazyVGrid(columns: columns, spacing: 10) {
                ForEach(TURN_GAMES) { k in tile(k) }
                GameTile(title: "Escape rooms", glyph: Icons.door, color: GameColors.escape, tag: nil, action: escape)
            }
            label("Live", "when you’re both here at once")
                .padding(.top, 4)
            LazyVGrid(columns: columns, spacing: 10) {
                ForEach(LIVE_GAMES) { k in tile(k) }
            }
        }
    }

    private func label(_ title: String, _ sub: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(title).font(.px(16, 700)).foregroundStyle(Color.paper)
            Text(sub).font(.px(12, 500)).foregroundStyle(Color.paper.opacity(0.55)).lineLimit(1).minimumScaleFactor(0.8)
        }
    }

    private func tile(_ k: GameKind) -> some View {
        let line = Play.shelfLine(place.games[k], kind: k, me: place.mySeat, name: place.seatName, now: place.now.timeIntervalSince1970 * 1000)
        let tag: String? = !ready || !line.hot ? nil : Play.isLiveInvite(k) || k == .doodle ? "JOIN" : "YOUR MOVE"
        return GameTile(title: k.info.name, glyph: GameArt.icon(k), color: GameColors.of(k), tag: tag) { open(k) }
            .disabled(!ready)
            .opacity(ready ? 1 : 0.55)
            .accessibilityHint(ready ? line.text : "Once \(place.theirName) has joined")
    }
}

/// a game's square: its picture and name on its colour, and a tag when it's waiting on you
struct GameTile: View {
    let title: String
    let glyph: Glyph
    let color: Color
    var tag: String?
    var action: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Button(action: action) {
            VStack(spacing: 7) {
                Spacer(minLength: 0)
                GlyphView(glyph: glyph, scale: 4).frame(height: 38)
                Text(title)
                    .font(.px(12, 700))
                    .foregroundStyle(Color.cream)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .minimumScaleFactor(0.8)
                    .shadow(color: .black.opacity(0.35), radius: 0, x: 0, y: 2)
                    .padding(.horizontal, 4)
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity)
            .aspectRatio(1.14, contentMode: .fit)
            .background(
                ZStack {
                    NotchedFrame(notch: PX).fill(tag != nil ? Color.butter : Color.ink).padding(-PX)
                    Rectangle().fill(color)
                    VStack(spacing: 0) {
                        Rectangle().fill(Color.white.opacity(0.14)).frame(height: PX)
                        Spacer(minLength: 0)
                        Rectangle().fill(Color.black.opacity(0.3)).frame(height: PX * 1.5)
                    }
                }
            )
            .padding(PX)
            .overlay(alignment: .topTrailing) {
                if let tag {
                    Text(tag)
                        .font(.px(9, 700))
                        .kerning(0.6)
                        .foregroundStyle(Color.cream)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(Color.thread)
                        .overlay(Rectangle().stroke(Color.ink, lineWidth: 2))
                        .offset(x: -6, y: 6)
                }
            }
            .shadow(color: tag != nil && !reduceMotion ? Color.butter.opacity(0.35) : .clear, radius: 8)
        }
        .buttonStyle(.press)
        .accessibilityLabel(tag.map { "\(title), \($0.lowercased())" } ?? title)
    }
}

/* ---------- decorating ---------- */

struct DecorView: View {
    let place: PlaceModel
    @State private var slot: SlotId
    @State private var trying: DecorItem?
    @State private var short = false
    @Environment(\.displayScale) private var displayScale

    /// `start`: the spot it opens on (tapping the pet opens on the pets)
    init(place: PlaceModel, start: SlotId = .couch) {
        self.place = place
        _slot = State(initialValue: start)
    }

    private var shown: Decor {
        var d = place.decor
        if let t = trying { d[t.slot] = t.id }
        return d
    }

    var body: some View {
        VStack(spacing: 0) {
            GeometryReader { geo in
                RoomScene(place: place, couchOnly: false, decor: shown)
                    .allowsHitTesting(false)
                    .frame(width: geo.size.width, height: geo.size.height)
            }
            .frame(height: 230)
            .background(Color.roomBrown)
            .overlay(alignment: .bottom) { Rectangle().fill(Color.ink).frame(height: PX) }

            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    HStack {
                        Text("Decorate").font(.pxTitle).foregroundStyle(Color.inkSoft)
                        Spacer()
                        HStack(spacing: 6) {
                            GlyphView(glyph: Icons.stitch, scale: 3)
                            Text("\(place.stitches)").font(.px(18, 700)).foregroundStyle(Color.inkSoft)
                        }
                    }
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(Catalogue.slots, id: \.id) { s in
                                Button(s.name) {
                                    slot = s.id
                                    trying = nil
                                }
                                .buttonStyle(.px(slot == s.id ? .terracotta : .paper, small: true))
                            }
                        }
                        .padding(4)
                    }
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                        ForEach(Catalogue.items(in: slot)) { item in itemCard(item) }
                    }
                    if short {
                        Text("Not enough stitches yet. You earn them by showing up: \(Catalogue.visit) each day each of you visits, \(Catalogue.together) more when you’re both here, and \(Catalogue.letter) when the day’s letter opens.")
                            .font(.pxSmall).foregroundStyle(Color(hex: "#7f3835")).padding(10).pxInset()
                    }
                    if let t = trying {
                        let owned = place.owns(t)
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(t.name).font(.pxBodyBold).foregroundStyle(Color.inkSoft)
                                Text(t.blurb).font(.pxSmall).foregroundStyle(Color.muted)
                            }
                            Spacer()
                            Button(owned ? "Put it out" : "Buy for \(t.price)") {
                                if place.buy(t) {
                                    Haptics.success()
                                    trying = nil
                                    short = false
                                } else {
                                    short = true
                                }
                            }
                            .buttonStyle(.px(.terracotta, small: true))
                        }
                        .padding(12)
                        .pxInset()
                    }
                }
                .padding(18)
            }
        }
        .background(Color.paper)
    }

    private func itemCard(_ item: DecorItem) -> some View {
        let placed = place.decor[item.slot] == item.id
        let owned = place.owns(item)
        var d = place.decor
        d[item.slot] = item.id
        let seats = place.seats
        let thumb = Pixels.image(renderDecorThumb(d, item.slot.rawValue, seats.left, seats.right))
        return Button {
            Haptics.tap()
            short = false
            trying = placed ? nil : item
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                if let thumb {
                    Image(decorative: thumb, scale: 1).resizable().interpolation(.none).aspectRatio(contentMode: .fit).frame(maxWidth: .infinity)
                }
                Text(item.name).font(.px(14, 700)).foregroundStyle(Color.inkSoft).lineLimit(1)
                HStack(spacing: 4) {
                    if placed {
                        Text("In the room").font(.pxTiny).foregroundStyle(Color.sageD)
                    } else if owned {
                        Text(item.price == 0 ? "Free" : "Yours").font(.pxTiny).foregroundStyle(Color.sageD)
                    } else {
                        GlyphView(glyph: Icons.stitch, scale: 2)
                        Text("\(item.price)").font(.px(13, 700)).foregroundStyle(Color.terracottaD)
                    }
                }
            }
            .padding(8)
            .background(trying?.id == item.id && trying?.slot == item.slot ? Color(hex: "#fff1dc") : Color.paperHi)
            .overlay { Rectangle().strokeBorder(placed ? Color.sage : trying == item ? Color.terracotta : Color.paperShade, lineWidth: 3) }
        }
        .buttonStyle(.press)
    }
}
