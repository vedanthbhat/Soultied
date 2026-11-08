import SwiftUI
import SoultiedCore

/*
 * Play: decorating the room with the stitches you earn, the games for two, and the escape rooms and watch nights.
 */

struct PlayView: View {
    let place: PlaceModel
    @State private var decorating = false
    @State private var open: GameKind?
    @State private var escaping = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                DarkHeading(title: "Play", sub: "Make the room yours, and things to do together")

                Button {
                    decorating = true
                } label: {
                    HStack(alignment: .top, spacing: 14) {
                        GlyphView(glyph: Icons.brush, scale: 4)
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Decorate the room").font(.pxHeading).foregroundStyle(Color.inkSoft)
                            Text("Wallpaper, a new couch, a pet by the fire, the view from the window. You share the jar of stitches: you earn them by showing up.")
                                .font(.pxBody).foregroundStyle(Color.muted).multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                            HStack(spacing: 6) {
                                GlyphView(glyph: Icons.stitch, scale: 3)
                                Text("\(place.stitches) stitches in the jar").font(.px(15, 700)).foregroundStyle(Color.terracottaD)
                            }
                        }
                        Spacer(minLength: 0)
                    }
                    .pxCard()
                }
                .buttonStyle(.plain)

                GamesShelf(place: place) { open = $0 }

                Button {
                    Haptics.tap()
                    escaping = true
                } label: {
                    HStack(alignment: .top, spacing: 14) {
                        GlyphView(glyph: Icons.door, scale: 4)
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Escape rooms").font(.pxHeading).foregroundStyle(Color.inkSoft)
                            Text("Four rooms behind the dark door. Each of you sees half the clues, so talk it through to get out. Play on one phone, or each on your own.")
                                .font(.pxBody).foregroundStyle(Color.muted).multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                            Text("Open the dark door →").font(.px(16, 700)).foregroundStyle(Color.terracottaD)
                        }
                        Spacer(minLength: 0)
                    }
                    .pxCard()
                }
                .buttonStyle(.plain)
            }
            .fullScreenCover(isPresented: $escaping) { EscapeScreen(place: place) }
            .padding(16)
            .padding(.bottom, 100)
        }
        .background(RoomBackground())
        .sheet(isPresented: $decorating) {
            DecorView(place: place).presentationBackground(Color.paper)
        }
        .fullScreenCover(item: $open) { k in GameScreen(place: place, kind: k) }
    }
}

/* ---------- decorating ---------- */

struct DecorView: View {
    let place: PlaceModel
    @State private var slot: SlotId = .couch
    @State private var trying: DecorItem?
    @State private var short = false
    @Environment(\.displayScale) private var displayScale

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
        .buttonStyle(.plain)
    }
}
