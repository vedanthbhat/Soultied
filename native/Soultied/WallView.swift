import SwiftUI
import PhotosUI
import UIKit
import SoultiedCore

/*
 * Our wall: notes and doodles you pin up for each other, your photos, and the memories you keep.
 * A doodle or a photo can go in the frame over the couch.
 */

enum WallTab: String, CaseIterable, Identifiable {
    case notes = "Notes", doodle = "Doodle", photos = "Photos", voices = "Voices", memories = "Memories"
    var id: String { rawValue }
    var glyph: Glyph {
        switch self {
        case .notes: return Icons.pin
        case .doodle: return Icons.pencil
        case .photos: return Icons.camera
        case .voices: return Icons.mic
        case .memories: return Icons.star
        }
    }
}

struct WallView: View {
    let place: PlaceModel
    @State private var tab: WallTab

    init(place: PlaceModel, start: WallTab = .notes) {
        self.place = place
        _tab = State(initialValue: start)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                DarkHeading(title: "Our wall", sub: "Notes, doodles and photos for each other, and the memories you keep")
                HStack(spacing: 8) {
                    ForEach(WallTab.allCases) { t in
                        Button {
                            Haptics.tap()
                            tab = t
                        } label: {
                            VStack(spacing: 3) {
                                GlyphView(glyph: t.glyph, scale: 2)
                                Text(t.rawValue).lineLimit(1).minimumScaleFactor(0.8)
                            }
                        }
                        .buttonStyle(ChipStyle(on: tab == t))
                    }
                }
                switch tab {
                case .notes: NotesPanel(place: place)
                case .doodle: DoodlePanel(place: place) { tab = .notes }
                case .photos: PhotosPanel(place: place)
                case .voices: VoicesPanel(place: place)
                case .memories: MemoriesPanel(place: place)
                }
            }
            .padding(16)
            .padding(.bottom, 100)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(RoomBackground())
        .onAppear {
            // (a voice note's the news: open on the voices; and the screenshots)
            if place.wallNews?.kind == .voice || Launch.args.contains("-voices") { tab = .voices }
            place.markWallSeen()
        }
    }
}

/* ---------- notes ---------- */

struct NotesPanel: View {
    let place: PlaceModel
    @State private var text = ""
    @State private var paper = 0

    var body: some View {
        let shown = place.notes.filter { !$0.gone }
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 10) {
                PixelLabel(text: "A note for \(place.theirName)")
                PixelField(placeholder: "Left you a playlist for the train…", text: $text, limit: NOTE_MAX, lines: 3)
                HStack(spacing: 8) {
                    ForEach(NOTE_PAPERS.indices, id: \.self) { i in
                        Button {
                            paper = i
                        } label: {
                            Rectangle().fill(Color(hex: NOTE_PAPERS[i])).frame(width: 28, height: 28)
                                .overlay { Rectangle().strokeBorder(paper == i ? Color.ink : Color.paperShade, lineWidth: paper == i ? 3 : 2) }
                        }
                        .accessibilityLabel("Paper \(i + 1)")
                    }
                    Spacer()
                    Button("Pin it up") {
                        place.pinNote(text, paper: paper)
                        text = ""
                        Haptics.success()
                    }
                    .buttonStyle(.px(.terracotta, small: true))
                    .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .pxCard()

            if shown.isEmpty {
                Text("Nothing up yet. Notes stay on the wall until one of you takes them down.").font(.pxBody).foregroundStyle(Color.paper.opacity(0.75))
            }
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 14), GridItem(.flexible(), spacing: 14)], spacing: 16) {
                ForEach(Array(shown.enumerated()), id: \.element.id) { i, n in
                    NoteView(place: place, note: n, tilt: [-2.0, 1.5, -1.0, 2.0, 0.5][i % 5])
                }
            }
        }
    }
}

struct NoteView: View {
    let place: PlaceModel
    let note: Note
    var tilt: Double = 0

    var body: some View {
        let mine = note.by == place.me
        let loved = note.loved[mine ? (place.them ?? "") : place.me] != nil
        VStack(alignment: .leading, spacing: 8) {
            Rectangle().fill(Color(hex: "#c4453f")).frame(width: 10, height: 10).frame(maxWidth: .infinity)
            if note.kind == .doodle {
                DoodleView(px: note.doodle, scale: 1.5)
                    .frame(maxWidth: .infinity)
                    .scaleEffect(0.95)
            } else {
                Text(note.text).font(.pxBody).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
            }
            HStack(spacing: 6) {
                Text(place.member(note.by)?.name ?? "").font(.pxTiny).foregroundStyle(Color.muted)
                Spacer()
                if mine {
                    if note.loved[place.them ?? ""] != nil { GlyphView(glyph: Icons.heart, scale: 2) }
                } else {
                    Button {
                        place.love(note)
                        Haptics.soft()
                    } label: {
                        GlyphView(glyph: loved ? Icons.heart : Icons.heartEmpty, scale: 2)
                    }
                    .accessibilityLabel(loved ? "Take the heart off" : "Put a heart on it")
                }
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, minHeight: 120, alignment: .topLeading)
        .background(Color(hex: NOTE_PAPERS[note.paper]))
        // (flattened first, so only the paper casts a shadow, not each line of writing on it)
        .compositingGroup()
        .shadow(color: .black.opacity(0.35), radius: 0, x: 3, y: 3)
        .rotationEffect(.degrees(tilt))
        .contextMenu {
            Button(note.kept ? "Take out of our memories" : "Keep with our memories") { place.keep(note, !note.kept) }
            if note.kind == .doodle {
                Button("Hang it over the couch") { place.hangArt(Doodle.art(note.doodle, ref: note.id, by: note.by)) }
            }
            Button("Take it down", role: .destructive) { place.takeDown(note) }
        }
    }
}

/* ---------- doodles ---------- */

struct DoodlePanel: View {
    let place: PlaceModel
    var pinned: () -> Void
    @State private var px = Doodle.blank()
    @State private var ink: UInt8 = 1
    /// the pen's tip, in pixels across
    @State private var size = 2
    @State private var hang = true
    @State private var history: [[UInt8]] = []
    /// where the pen last was, while a stroke's going (so a quick stroke is a line, not a trail of dots)
    @State private var pen: (x: Int, y: Int)?

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            GeometryReader { geo in
                let cell = geo.size.width / CGFloat(DOODLE_W)
                DoodleView(px: Doodle.encode(px), scale: cell)
                    .contentShape(Rectangle())
                    .gesture(
                        DragGesture(minimumDistance: 0)
                            .onChanged { v in
                                let at = (x: Int((v.location.x / cell).rounded(.down)), y: Int((v.location.y / cell).rounded(.down)))
                                if let from = pen {
                                    line(from, at)
                                } else {
                                    // a new stroke: something to undo back to
                                    history.append(px)
                                    if history.count > 30 { history.removeFirst() }
                                    stamp(at.x, at.y)
                                }
                                pen = at
                            }
                            .onEnded { _ in pen = nil }
                    )
            }
            .aspectRatio(CGFloat(DOODLE_W) / CGFloat(DOODLE_H), contentMode: .fit)
            .padding(PX)
            .background(NotchedFrame(notch: PX).fill(Color.ink))

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 8), spacing: 6) {
                ForEach(0..<16, id: \.self) { i in
                    Button {
                        ink = UInt8(i)
                    } label: {
                        Rectangle().fill(Color(hex: DOODLE_PAL[i])).frame(height: 30)
                            .overlay { if i == 0 { GlyphView(glyph: Icons.cross, scale: 2) } }
                            .overlay { Rectangle().strokeBorder(ink == UInt8(i) ? Color.ink : Color.paperShade, lineWidth: ink == UInt8(i) ? 3 : 2) }
                    }
                    .accessibilityLabel(i == 0 ? "Eraser" : "Pen \(i)")
                }
            }
            HStack(spacing: 8) {
                Button(size == 1 ? "Fine pen" : size == 2 ? "Mid pen" : "Thick pen") { size = size == 1 ? 2 : size == 2 ? 4 : 1 }
                    .buttonStyle(.px(.paper, small: true, wide: true))
                    .accessibilityHint("Changes how thick the pen draws")
                Button("Undo") { if let last = history.popLast() { px = last } }.buttonStyle(.px(.paper, small: true, wide: true)).disabled(history.isEmpty)
                Button("Clear") {
                    history.append(px)
                    px = Doodle.blank()
                }
                .buttonStyle(.px(.paper, small: true, wide: true))
            }.evenRow()
            Toggle(isOn: $hang) { Text("Hang it in the frame over the couch").font(.pxBody).foregroundStyle(Color.inkSoft) }.tint(Color.sage)
            Button("Pin it up for \(place.theirName)") {
                place.pinDoodle(px, hang: hang)
                Haptics.success()
                px = Doodle.blank()
                history = []
                pinned()
            }
            .buttonStyle(.px(.terracotta, wide: true))
            .disabled(!px.contains { $0 != 0 })
        }
        .pxCard()
    }

    /// every cell between where the pen was and where it is now (the finger moves faster than the screen reports it)
    private func line(_ a: (x: Int, y: Int), _ b: (x: Int, y: Int)) {
        var x = a.x, y = a.y
        let dx = abs(b.x - a.x), dy = -abs(b.y - a.y)
        let sx = a.x < b.x ? 1 : -1, sy = a.y < b.y ? 1 : -1
        var err = dx + dy
        while true {
            stamp(x, y)
            if x == b.x && y == b.y { break }
            let e2 = 2 * err
            if e2 >= dy { err += dy; x += sx }
            if e2 <= dx { err += dx; y += sy }
        }
    }

    /// the pen's tip on one cell (centred on it, so a thick line runs where you drew it)
    private func stamp(_ x: Int, _ y: Int) {
        let o = (size - 1) / 2
        for dy in 0..<size {
            for dx in 0..<size {
                let xx = x + dx - o, yy = y + dy - o
                if xx >= 0, yy >= 0, xx < DOODLE_W, yy < DOODLE_H { px[yy * DOODLE_W + xx] = ink }
            }
        }
    }
}

/* ---------- photos ---------- */

struct PhotosPanel: View {
    let place: PlaceModel
    @State private var item: PhotosPickerItem?
    @State private var draft: PreparedPhoto?
    @State private var caption = ""
    @State private var day = Date()
    @State private var sayDay = false
    @State private var hang = false
    @State private var busy = false
    @State private var viewing: Photo?

    var body: some View {
        let shown = place.photos.filter { !$0.gone }
        VStack(alignment: .leading, spacing: 16) {
            if let d = draft {
                VStack(alignment: .leading, spacing: 12) {
                    Image(uiImage: d.preview).resizable().scaledToFit().frame(maxHeight: 260).frame(maxWidth: .infinity)
                    PixelField(placeholder: "A caption, if you like", text: $caption, limit: CAPTION_MAX)
                    Toggle(isOn: $sayDay) { Text("Say when it was taken").font(.pxBody).foregroundStyle(Color.inkSoft) }.tint(Color.sage)
                    if sayDay { DatePicker("Taken on", selection: $day, in: ...Date(), displayedComponents: .date).font(.pxBody).tint(Color.terracotta) }
                    Toggle(isOn: $hang) { Text("Hang it in the frame over the couch").font(.pxBody).foregroundStyle(Color.inkSoft) }.tint(Color.sage)
                    HStack {
                        Button("Not this one") { draft = nil }.buttonStyle(.px(.paper, small: true))
                        Spacer()
                        Button("Put it on the wall") {
                            place.addPhoto(big: d.big, thumb: d.thumb, w: d.w, h: d.h, caption: caption, day: sayDay ? Day.today(day) : "", art: hang ? d.art : nil)
                            Haptics.success()
                            draft = nil
                            caption = ""
                        }
                        .buttonStyle(.px(.terracotta, wide: true))
                    }
                }
                .pxCard()
            } else {
                PhotosPicker(selection: $item, matching: .images) {
                    HStack(spacing: 8) {
                        GlyphView(glyph: Icons.camera, scale: 2)
                        Text(busy ? "Opening it…" : "Add a photo")
                    }
                }
                .buttonStyle(.px(.terracotta, wide: true))
                .disabled(busy)
            }

            if shown.isEmpty && draft == nil {
                Text("Your photos live here, for both of you. They’re kept small, so they load quickly anywhere.").font(.pxBody).foregroundStyle(Color.paper.opacity(0.75))
            }
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 14) {
                ForEach(shown) { p in
                    Button {
                        viewing = p
                    } label: {
                        VStack(spacing: 6) {
                            DataImage(url: p.thumb).frame(height: 130).clipped()
                            if !p.caption.isEmpty { Text(p.caption).font(.pxTiny).foregroundStyle(Color.inkSoft).lineLimit(2) }
                        }
                        .padding(8)
                        .padding(.bottom, 6)
                        .background(Color.paperHi)
                        .compositingGroup()
                        .shadow(color: .black.opacity(0.35), radius: 0, x: 3, y: 3)
                    }
                    .buttonStyle(.press)
                }
            }
        }
        .onChange(of: item) { _, it in
            guard let it else { return }
            busy = true
            Task {
                if let data = try? await it.loadTransferable(type: Data.self), let img = UIImage(data: data) {
                    draft = PreparedPhoto(img, by: place.me)
                    hang = shown.isEmpty
                }
                busy = false
                item = nil
            }
        }
        .sheet(item: $viewing) { p in PhotoViewer(place: place, photo: p) }
    }
}

/// a photo made small enough to keep (well under the database's 1 MB a document), as the website does
struct PreparedPhoto {
    let preview: UIImage
    let big: String
    let thumb: String
    let w: Int
    let h: Int
    let art: WallArt?

    init?(_ img: UIImage, by: String) {
        func scaled(_ max: CGFloat, _ q: CGFloat) -> (String, Int, Int, UIImage) {
            let s = img.size
            let k = min(1, max / Swift.max(s.width, s.height))
            let size = CGSize(width: Swift.max(1, (s.width * k).rounded()), height: Swift.max(1, (s.height * k).rounded()))
            let f = UIGraphicsImageRendererFormat()
            f.scale = 1
            let out = UIGraphicsImageRenderer(size: size, format: f).image { _ in img.draw(in: CGRect(origin: .zero, size: size)) }
            let data = out.jpegData(compressionQuality: q) ?? Data()
            return ("data:image/jpeg;base64," + data.base64EncodedString(), Int(size.width), Int(size.height), out)
        }
        var big = scaled(1280, 0.8)
        if big.0.count > 700_000 { big = scaled(1024, 0.7) }
        if big.0.count > 700_000 { big = scaled(800, 0.6) }
        let thumb = scaled(360, 0.72)
        preview = big.3
        self.big = big.0
        self.thumb = thumb.0
        w = big.1
        h = big.2
        art = PreparedPhoto.art(img, by: by)
    }

    /// the middle 4:3 of it, 24 × 18, for the frame
    static func art(_ img: UIImage, by: String) -> WallArt? {
        guard let cg = img.cgImage else { return nil }
        let iw = CGFloat(cg.width), ih = CGFloat(cg.height)
        let want = CGFloat(ART_W) / CGFloat(ART_H)
        var sw = iw, sh = ih
        if iw / ih > want { sw = ih * want } else { sh = iw / want }
        guard let crop = cg.cropping(to: CGRect(x: (iw - sw) / 2, y: (ih - sh) / 2, width: sw, height: sh)) else { return nil }
        var buf = [UInt8](repeating: 0, count: ART_W * ART_H * 4)
        let ok: Bool = buf.withUnsafeMutableBytes { raw in
            guard let ctx = CGContext(data: raw.baseAddress, width: ART_W, height: ART_H, bitsPerComponent: 8, bytesPerRow: ART_W * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { return false }
            ctx.interpolationQuality = .high
            ctx.draw(crop, in: CGRect(x: 0, y: 0, width: ART_W, height: ART_H))
            return true
        }
        guard ok else { return nil }
        var rgb = [UInt8](repeating: 0, count: ART_W * ART_H * 3)
        for i in 0..<(ART_W * ART_H) {
            rgb[i * 3] = buf[i * 4]
            rgb[i * 3 + 1] = buf[i * 4 + 1]
            rgb[i * 3 + 2] = buf[i * 4 + 2]
        }
        return photoArt(rgb: rgb, ref: "", by: by)
    }
}

struct PhotoViewer: View {
    let place: PlaceModel
    let photo: Photo
    @State private var big: String?
    @State private var caption = ""
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                DataImage(url: big ?? photo.thumb).aspectRatio(CGFloat(photo.w) / CGFloat(max(1, photo.h)), contentMode: .fit).frame(maxWidth: .infinity)
                    .padding(PX).background(NotchedFrame(notch: PX).fill(Color.ink))
                HStack {
                    Text("From \(place.member(photo.by)?.name ?? "")\(photo.day.isEmpty ? "" : " · \(Day.pretty(photo.day))")").font(.pxSmall).foregroundStyle(Color.muted)
                    Spacer()
                }
                PixelField(placeholder: "A caption", text: $caption, limit: CAPTION_MAX)
                HStack(spacing: 8) {
                    Button("Save caption") { place.editPhoto(photo, caption: caption) }.buttonStyle(.px(.paper, small: true, wide: true)).disabled(caption == photo.caption)
                    Button("Hang it over the couch") {
                        if let ui = UIImage(data: dataURLBytes(big ?? photo.thumb) ?? Data()), var a = PreparedPhoto.art(ui, by: place.me) {
                            a.ref = photo.id
                            place.hangArt(a)
                            Haptics.success()
                        }
                    }
                    .buttonStyle(.px(.sage, small: true, wide: true))
                }.evenRow()
                Toggle(isOn: Binding(get: { photo.kept }, set: { place.editPhoto(photo, kept: $0) })) {
                    Text("Keep with our memories").font(.pxBody).foregroundStyle(Color.inkSoft)
                }
                .tint(Color.sage)
                Button("Take it down") {
                    place.takeDown(photo)
                    dismiss()
                }
                .buttonStyle(.px(.paper, small: true, wide: true))
            }
            .padding(20)
        }
        .background(Color.paper)
        .task {
            caption = photo.caption
            big = await place.bigPhoto(photo)
        }
    }
}

/* ---------- memories ---------- */

struct MemoriesPanel: View {
    let place: PlaceModel
    @State private var adding = false
    @State private var title = ""
    @State private var text = ""
    @State private var day = Date()

    var body: some View {
        let moments = place.moments
        let today = onThisDay(moments, today: place.today)
        VStack(alignment: .leading, spacing: 16) {
            if !today.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    PixelTag(text: "On this day")
                    ForEach(today) { m in
                        Text("\(m.title) · \(yearsAgo(m.day))").font(.pxBodyBold).foregroundStyle(Color.inkSoft)
                    }
                }
                .pxCard()
            }
            if adding {
                VStack(alignment: .leading, spacing: 10) {
                    PixelLabel(text: "A memory")
                    PixelField(placeholder: "First date: the bookshop café", text: $title, limit: MEMORY_TITLE_MAX)
                    DatePicker("When", selection: $day, in: ...Date(), displayedComponents: .date).font(.pxBody).tint(Color.terracotta)
                    PixelField(placeholder: "What you want to remember about it", text: $text, limit: MEMORY_TEXT_MAX, lines: 3)
                    HStack {
                        Button("Cancel") { adding = false }.buttonStyle(.px(.paper, small: true))
                        Spacer()
                        Button("Keep it") {
                            place.addMemory(title: title, day: Day.today(day), text: text)
                            Haptics.success()
                            adding = false
                            title = ""
                            text = ""
                        }
                        .buttonStyle(.px(.terracotta, small: true, wide: true))
                        .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }
                .pxCard()
            } else {
                Button("Write down a memory") { adding = true }.buttonStyle(.px(.sage, wide: true))
            }

            VStack(alignment: .leading, spacing: 0) {
                ForEach(moments.reversed()) { m in
                    HStack(alignment: .top, spacing: 12) {
                        VStack(spacing: 0) {
                            Rectangle().fill(m.kind == .together || m.kind == .movedIn ? Color.thread : Color.terracotta).frame(width: 12, height: 12)
                            Rectangle().fill(Color.paper.opacity(0.25)).frame(width: 3).frame(maxHeight: .infinity)
                        }
                        VStack(alignment: .leading, spacing: 4) {
                            Text(Day.pretty(m.day, long: false) + " " + String(m.day.prefix(4))).font(.pxTiny).foregroundStyle(Color.paper.opacity(0.7))
                            VStack(alignment: .leading, spacing: 6) {
                                Text(m.title).font(.pxBodyBold).foregroundStyle(Color.inkSoft)
                                if !m.text.isEmpty { Text(m.text).font(.pxSmall).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true) }
                                if m.kind == .photo, let p = place.photos.first(where: { $0.id == m.photo }) {
                                    DataImage(url: p.thumb).frame(height: 120).clipped()
                                }
                                if m.kind == .note, let n = place.notes.first(where: { $0.id == m.id }), n.kind == .doodle {
                                    DoodleView(px: n.doodle, scale: 1)
                                }
                            }
                            .pxCard(shadow: false)
                            .contextMenu {
                                if m.kind == .memory, let mem = place.memoryItems[m.id] {
                                    Button("Forget this one", role: .destructive) { place.forget(mem) }
                                }
                            }
                        }
                        .padding(.bottom, 14)
                    }
                }
            }
        }
    }

    private func yearsAgo(_ key: String) -> String {
        let n = (Int(place.today.prefix(4)) ?? 0) - (Int(key.prefix(4)) ?? 0)
        return n <= 0 ? "today" : n == 1 ? "a year ago" : "\(n) years ago"
    }
}
