import SwiftUI
import UIKit
import SoultiedCore

/*
 * Your month together (Recap, shared with the website): a card in Us with this month so far (or, in a month's
 * first few days, the one just gone), and a picture of it to share: the two of you on the couch by the fire,
 * and the month in numbers.
 */

private struct RecapStat: Identifiable {
    let id: String
    let n: String
    let label: String
}

private func stats(_ r: Recap) -> [RecapStat] {
    [
        RecapStat(id: "days", n: "\(r.days)", label: r.days == 1 ? "day you both showed up" : "days you both showed up"),
        RecapStat(id: "run", n: "\(r.bestStreak)", label: r.bestStreak == 1 ? "day in a row, at best" : "days in a row, at best"),
        RecapStat(id: "letters", n: "\(r.letters)", label: r.letters == 1 ? "letter opened together" : "letters opened together"),
        RecapStat(id: "sync", n: r.sync.map { "\($0)%" } ?? "–", label: "in sync"),
        RecapStat(id: "photos", n: "\(r.photos)", label: r.photos == 1 ? "photo pinned up" : "photos pinned up"),
        RecapStat(id: "notes", n: "\(r.doodles + r.notes)", label: "doodles and notes"),
    ]
}

/// shorter, for the picture
private func shortStats(_ r: Recap) -> [RecapStat] {
    [
        RecapStat(id: "days", n: "\(r.days)", label: "days both here"),
        RecapStat(id: "run", n: "\(r.bestStreak)", label: "in a row, at best"),
        RecapStat(id: "letters", n: "\(r.letters)", label: "letters together"),
        RecapStat(id: "sync", n: r.sync.map { "\($0)%" } ?? "–", label: "in sync"),
        RecapStat(id: "photos", n: "\(r.photos)", label: r.photos == 1 ? "photo" : "photos"),
        RecapStat(id: "notes", n: "\(r.doodles + r.notes)", label: "doodles & notes"),
    ]
}

/// the month's title: "Your October" once it's over, "November so far" while it's going
private func title(_ r: Recap, done: Bool) -> String {
    let name = r.label.split(separator: " ").first.map(String.init) ?? r.label
    return done ? "Your \(name)" : "\(name) so far"
}

struct RecapCard: View {
    let place: PlaceModel
    @State private var sharing = false

    var body: some View {
        let r = place.recap
        let done = recapMonth(place.today).done
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                GlyphView(glyph: Icons.heart, scale: 3)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title(r, done: done)).font(.pxHeading).foregroundStyle(Color.inkSoft)
                    Text("You and \(place.theirName), in numbers").font(.pxTiny).foregroundStyle(Color.muted)
                }
            }
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                ForEach(stats(r)) { s in
                    VStack(alignment: .leading, spacing: 0) {
                        Text(s.n).font(.px(24, 700)).foregroundStyle(Color.inkSoft)
                        Text(s.label).font(.pxTiny).foregroundStyle(Color.muted).lineLimit(2).fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(10)
                    .background(Color.paper2)
                }
            }
            Button("Make a picture to share") { sharing = true }.buttonStyle(.px(.terracotta, wide: true))
        }
        .pxCard()
        .sheet(isPresented: $sharing) { RecapShareSheet(place: place).presentationBackground(Color.paper) }
        // (the screenshots: the picture, made)
        .onAppear { if Launch.args.contains("-recapShare") { sharing = true } }
    }
}

/// the picture: the two of you on the couch by the fire, and the month in numbers (1080 × 1350)
struct RecapPicture: View {
    let recap: Recap
    let done: Bool
    let names: String
    let room: CGImage?

    var body: some View {
        VStack(spacing: 10) {
            Text(title(recap, done: done)).font(.px(30, 700)).foregroundStyle(Color(hex: "#3a2a26"))
            Text(names).font(.px(14)).foregroundStyle(Color(hex: "#7d6a5c"))
            if let room {
                Image(decorative: room, scale: 1).resizable().interpolation(.none).aspectRatio(contentMode: .fit)
                    .padding(3).background(Color(hex: "#3a2a26"))
            }
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 10) {
                ForEach(shortStats(recap)) { s in
                    VStack(spacing: 1) {
                        Text(s.n).font(.px(22, 700)).foregroundStyle(Color(hex: "#3a2a26"))
                        Text(s.label).font(.px(10)).foregroundStyle(Color(hex: "#7d6a5c")).multilineTextAlignment(.center).lineLimit(1).minimumScaleFactor(0.8)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            Spacer(minLength: 0)
            Text("soultied.app").font(.px(11, 600)).foregroundStyle(Color(hex: "#a68a6d"))
        }
        .padding(18)
        .frame(width: 360, height: 450)
        .background(Color(hex: "#fbf3e2"))
    }

    /// the room as it is now, cropped close around the fire and the couch
    @MainActor static func room(_ place: PlaceModel) -> CGImage? {
        let seats = place.seats
        var st = RoomState(left: seats.left, right: seats.right)
        st.decor = place.decor
        st.closeness = Double(place.couchLevel) / Double(COUCH_STEPS)
        st.flame = place.partnerHere ? place.fire.level : 2
        st.wallArt = place.board.art?.pixels
        let room = RoomRenderer().render(st, 2.0)
        let (x0, y0, w, h) = (170, 34, 132, 112)
        var out = [UInt8](repeating: 0, count: w * h * 4)
        for j in 0..<h {
            let from = ((y0 + j) * ROOM_W + x0) * 4
            out.replaceSubrange((j * w * 4)..<((j + 1) * w * 4), with: room.data[from..<(from + w * 4)])
        }
        return Pixels.image(out, w, h)
    }
}

struct RecapShareSheet: View {
    let place: PlaceModel
    @State private var image: UIImage?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                if let image {
                    Image(uiImage: image).resizable().scaledToFit().frame(maxWidth: 340)
                        .shadow(color: .black.opacity(0.25), radius: 0, x: 4, y: 4)
                    ShareLink(item: Image(uiImage: image), preview: SharePreview(title(place.recap, done: recapMonth(place.today).done), image: Image(uiImage: image))) {
                        Text("Share it")
                    }
                    .buttonStyle(.px(.terracotta, wide: true))
                } else {
                    ProgressView().padding(40)
                }
                Button("Done") { dismiss() }.buttonStyle(.px(.paper, wide: true))
            }
            .padding(20)
        }
        .task { render() }
    }

    @MainActor private func render() {
        let names = [place.seats.left.name, place.seats.right.name].filter { !$0.isEmpty }.joined(separator: " & ")
        let view = RecapPicture(recap: place.recap, done: recapMonth(place.today).done, names: names, room: RecapPicture.room(place))
        let r = ImageRenderer(content: view)
        r.scale = 3
        image = r.uiImage
    }
}
