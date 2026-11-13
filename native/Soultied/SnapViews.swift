import SwiftUI
import PhotosUI
import UIKit
import SoultiedCore

/*
 * Today's photo (meta/snap-{day}, shared with the website): a card on Home with today's prompt and a Polaroid
 * from each of you. Theirs stays locked till you've taken yours; then you both see both, and either can go up
 * on the wall.
 */

/// a photo made small for today's (640 across at most, well under the database's limit)
struct SnapPhoto {
    let photo: String
    let thumb: String
    let w: Int
    let h: Int
    let preview: UIImage

    init(_ img: UIImage) {
        func scaled(_ max: CGFloat, _ q: CGFloat) -> (String, Int, Int, UIImage) {
            let s = img.size
            let k = min(1, max / Swift.max(s.width, s.height))
            let size = CGSize(width: Swift.max(1, (s.width * k).rounded()), height: Swift.max(1, (s.height * k).rounded()))
            let f = UIGraphicsImageRendererFormat()
            f.scale = 1
            let out = UIGraphicsImageRenderer(size: size, format: f).image { _ in img.draw(in: CGRect(origin: .zero, size: size)) }
            return ("data:image/jpeg;base64," + (out.jpegData(compressionQuality: q) ?? Data()).base64EncodedString(), Int(size.width), Int(size.height), out)
        }
        var big = scaled(640, 0.78)
        if big.0.count > 300_000 { big = scaled(480, 0.68) }
        if big.0.count > 300_000 { big = scaled(320, 0.6) }
        photo = big.0
        w = big.1
        h = big.2
        preview = big.3
        thumb = scaled(360, 0.72).0
    }

    /// a smaller copy of one that's already a data: URL (for the wall's grid)
    static func thumb(of url: String) -> String {
        guard let d = dataURLBytes(url), let img = UIImage(data: d) else { return url }
        return SnapPhoto(img).thumb
    }
}

struct SnapCard: View {
    let place: PlaceModel
    @State private var asking = false
    @State private var library = false
    @State private var camera = false
    @State private var item: PhotosPickerItem?
    @State private var draft: SnapPhoto?
    @State private var viewing: (shot: SnapShot, by: String)?

    var body: some View {
        let stage = place.snapStageToday
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                GlyphView(glyph: Icons.camera, scale: 3)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Today’s photo").font(.pxTiny).foregroundStyle(Color.muted)
                    Text(place.snapPromptToday).font(.pxHeading).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
                }
            }
            Text(line(stage)).font(.pxSmall).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
            GeometryReader { geo in
                let w = (geo.size.width - 16) / 2
                HStack(alignment: .top, spacing: 16) {
                    polaroid(place.mySnap, who: "You", by: place.me, locked: false, width: w)
                    polaroid(place.theirSnap, who: place.theirName, by: place.them ?? "", locked: stage == .theirs, width: w)
                }
            }
            .frame(height: polaroidHeight)
            Button(place.mySnap == nil ? "Take mine" : "Retake mine") { asking = true }
                .buttonStyle(.px(place.mySnap == nil ? .sage : .paper, small: place.mySnap != nil, wide: place.mySnap == nil))
        }
        .pxCard()
        .confirmationDialog("Today’s photo", isPresented: $asking, titleVisibility: .hidden) {
            if UIImagePickerController.isSourceTypeAvailable(.camera) { Button("Take a photo") { camera = true } }
            Button("Choose one from your photos") { library = true }
        }
        .photosPicker(isPresented: $library, selection: $item, matching: .images)
        .fullScreenCover(isPresented: $camera) {
            CameraPicker { img in
                camera = false
                if let img { draft = SnapPhoto(img) }
            }
            .ignoresSafeArea()
        }
        .onChange(of: item) { _, it in
            guard let it else { return }
            Task {
                if let data = try? await it.loadTransferable(type: Data.self), let img = UIImage(data: data) { draft = SnapPhoto(img) }
                item = nil
            }
        }
        .sheet(isPresented: Binding(get: { draft != nil }, set: { if !$0 { draft = nil } })) {
            if let d = draft { SnapPostSheet(place: place, draft: d) { draft = nil }.presentationBackground(Color.paper) }
        }
        .sheet(isPresented: Binding(get: { viewing != nil }, set: { if !$0 { viewing = nil } })) {
            if let v = viewing { SnapViewer(place: place, shot: v.shot, by: v.by).presentationBackground(Color.paper) }
        }
    }

    private var polaroidHeight: CGFloat { 230 }

    private func line(_ stage: SnapStage) -> String {
        switch stage {
        case .open: return "You both took one. Here they are."
        case .mine: return "Yours is in. \(place.theirName) sees it once they’ve taken theirs."
        case .theirs: return "\(place.theirName) took theirs. Take yours and you’ll both see both."
        case .none: return "Take one each. Neither of you sees the other’s till you both have."
        }
    }

    @ViewBuilder
    private func polaroid(_ shot: SnapShot?, who: String, by: String, locked: Bool, width: CGFloat) -> some View {
        let inner = width - 16
        let face = VStack(alignment: .leading, spacing: 6) {
            ZStack {
                Color(hex: "#e8dcc4")
                if let shot, !locked {
                    DataImage(url: shot.photo)
                } else {
                    VStack(spacing: 8) {
                        if locked { GlyphView(glyph: Icons.lock, scale: 3) }
                        Text(locked ? "Take yours to see it" : by == place.me ? "Yours goes here" : "Waiting on \(who)")
                            .font(.pxTiny).foregroundStyle(Color.muted).multilineTextAlignment(.center).padding(.horizontal, 6)
                    }
                }
            }
            .frame(width: inner, height: inner)
            .clipped()
            Text(who).font(.px(13, 700)).foregroundStyle(Color.inkSoft).lineLimit(1)
            Text(shot.flatMap { locked || $0.caption.isEmpty ? nil : $0.caption } ?? " ").font(.pxTiny).foregroundStyle(Color.muted).lineLimit(2)
        }
        .padding(8)
        .frame(width: width, alignment: .leading)
        .background(Color(hex: "#fffaf0"))
        .padding(2)
        .background(Color.ink)
        .compositingGroup()
        .shadow(color: .black.opacity(0.3), radius: 0, x: 3, y: 3)
        if let shot, !locked {
            Button { viewing = (shot, by) } label: { face }.buttonStyle(.press)
        } else {
            face
        }
    }
}

/// a few words, then post it
struct SnapPostSheet: View {
    let place: PlaceModel
    let draft: SnapPhoto
    var done: () -> Void
    @State private var caption = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(place.snapPromptToday).font(.pxTitle).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
                Image(uiImage: draft.preview).resizable().scaledToFit().frame(maxHeight: 340).frame(maxWidth: .infinity)
                    .padding(PX).background(NotchedFrame(notch: PX).fill(Color.ink))
                VStack(alignment: .leading, spacing: 6) {
                    PixelLabel(text: "A few words, if you like")
                    PixelField(placeholder: "Raining again", text: $caption, limit: SNAP_CAPTION_MAX)
                }
                Button(place.mySnap == nil ? "Post it" : "Use this one instead") {
                    place.postSnap(photo: draft.photo, w: draft.w, h: draft.h, caption: caption)
                    Haptics.success()
                    done()
                }
                .buttonStyle(.px(.terracotta, wide: true))
                Button("Not this one", action: done).buttonStyle(.px(.paper, wide: true))
            }
            .padding(20)
        }
        .onAppear { caption = place.mySnap?.caption ?? "" }
    }
}

/// one of today's photos, big, and a way to put it on the wall
struct SnapViewer: View {
    let place: PlaceModel
    let shot: SnapShot
    let by: String
    @State private var pinned = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text(by == place.me ? "Yours" : place.theirName).font(.pxTitle).foregroundStyle(Color.inkSoft)
                DataImage(url: shot.photo).aspectRatio(CGFloat(max(1, shot.w)) / CGFloat(max(1, shot.h)), contentMode: .fit).frame(maxWidth: .infinity)
                    .padding(PX).background(NotchedFrame(notch: PX).fill(Color.ink))
                if !shot.caption.isEmpty { Text(shot.caption).font(.pxBody).foregroundStyle(Color.inkSoft) }
                Text(place.snapPromptToday).font(.pxSmall).foregroundStyle(Color.muted)
                Button(pinned ? "It’s on the wall" : "Pin it to the wall") {
                    place.pinSnap(shot, by: by, thumb: SnapPhoto.thumb(of: shot.photo))
                    pinned = true
                    Haptics.success()
                }
                .buttonStyle(.px(.sage, wide: true))
                .disabled(pinned)
            }
            .padding(20)
        }
    }
}

/// the camera, for taking today's photo there and then
struct CameraPicker: UIViewControllerRepresentable {
    var done: (UIImage?) -> Void

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let p = UIImagePickerController()
        p.sourceType = .camera
        p.delegate = context.coordinator
        return p
    }

    func updateUIViewController(_ vc: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(done: done) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let done: (UIImage?) -> Void
        init(done: @escaping (UIImage?) -> Void) { self.done = done }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            done(info[.originalImage] as? UIImage)
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { done(nil) }
    }
}
