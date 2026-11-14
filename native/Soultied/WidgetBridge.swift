import SwiftUI
import WidgetKit
import FirebaseCore
import FirebaseAuth
import SoultiedCore

/*
 * The app's side of the home-screen widgets (SoultiedWidget): it leaves them a way in, the last doodle
 * your person sent, and what the fire, countdown and mood widgets show, in the keychain group they share
 * (WidgetShare), and asks iOS to draw them again when something new turns up. A tap on a widget comes back
 * here as soultied://doodle, soultied://photos or soultied://home.
 */

/// a tap on one of the widgets
@Observable
final class WidgetLink {
    static let shared = WidgetLink()
    /// which part of the wall to open: the doodle pad or the photos
    var open: WallTab?
    private init() {}

    /// says whether it was one of ours
    func handle(_ url: URL) -> Bool {
        guard url.scheme == "soultied" else { return false }
        switch url.host {
        case "doodle": open = .doodle
        case "photos": open = .photos
        default: break
        }
        return true
    }
}

enum WidgetBridge {
    /// what the board widget shows, so it's only drawn again when that changes
    private static var lastPhotos: [String] = []

    /// (called from the views, on the main thread)
    static func sync(_ place: PlaceModel) {
        guard !place.isDemo, let them = place.them, let options = FirebaseApp.app()?.options,
              let user = Auth.auth().currentUser, user.uid == place.me, let refresh = user.refreshToken else { return }
        let before = WidgetShare.load()
        var s = before
        let config = WidgetShare.Config(
            sid: place.sid, me: place.me, them: them, themName: place.theirName,
            apiKey: options.apiKey ?? "", project: options.projectID ?? "", bundle: Bundle.main.bundleIdentifier ?? "", refresh: refresh
        )
        // (another place, or another person: start again)
        if s.config?.sid != config.sid || s.config?.them != config.them { s.drawing = nil }
        s.config = config
        // their newest doodle that's still up (or the widget's own, if it found a newer one than the app's seen)
        if let had = s.drawing, place.notes.contains(where: { $0.id == had.id && $0.gone }) { s.drawing = nil }
        if let n = place.notes.filter({ $0.kind == .doodle && $0.by == them && !$0.gone }).max(by: { $0.at < $1.at }), n.at >= (s.drawing?.at ?? 0) {
            s.drawing = WidgetShare.Drawing(id: n.id, px: n.doodle, at: n.at)
        }
        // the fire, the countdown and their mood
        var u = s.us ?? WidgetShare.Us()
        u.together = Array(place.couch.together.suffix(400))
        u.meSeen = place.couch.seen[place.me] ?? ""
        u.themSeen = place.couch.seen[them] ?? ""
        u.meLeft = place.hostId == place.me
        u.since = place.space?.togetherSince ?? ""
        u.visitDate = place.visit.date
        u.visitWhat = place.visit.what
        let m = place.moods.by[them]
        u.mood = m?.mood?.rawValue
        u.moodText = m?.text ?? ""
        u.moodAt = m?.at ?? 0
        u.wall = place.decor.wall
        u.themTz = place.whereTheirs?.tz
        u.apartKm = place.apartKm
        s.us = u
        if WidgetShare.store(s) {
            if before.config != s.config || before.drawing != s.drawing { WidgetCenter.shared.reloadTimelines(ofKind: WidgetShare.kind) }
            if before.config != s.config || before.us != s.us { WidgetShare.usKinds.forEach { WidgetCenter.shared.reloadTimelines(ofKind: $0) } }
        }

        let photos = place.photos.filter { !$0.gone }.sorted { $0.id > $1.id }.prefix(4).map { "\($0.id) \($0.caption)" }
        if photos != lastPhotos {
            lastPhotos = photos
            WidgetCenter.shared.reloadTimelines(ofKind: WidgetShare.boardKind)
        }
    }

    /// signed out, or out of the place: the widgets go back to asking you to open the app
    static func signedOut() {
        guard WidgetShare.load().config != nil else { return }
        WidgetShare.clear()
        lastPhotos = []
        WidgetCenter.shared.reloadAllTimelines()
    }
}

/// keeps the widgets up to date while the room's open, and opens what a tap on one asked for
struct WidgetSync: ViewModifier {
    let place: PlaceModel
    let link: WidgetLink
    let open: () -> Void

    func body(content: Content) -> some View {
        content
            .onAppear {
                WidgetBridge.sync(place)
                open()
            }
            .onChange(of: place.notes) { _, _ in WidgetBridge.sync(place) }
            .onChange(of: place.photos) { _, _ in WidgetBridge.sync(place) }
            .onChange(of: place.them) { _, _ in WidgetBridge.sync(place) }
            .onChange(of: place.couch) { _, _ in WidgetBridge.sync(place) }
            .onChange(of: place.moods) { _, _ in WidgetBridge.sync(place) }
            .onChange(of: place.visit) { _, _ in WidgetBridge.sync(place) }
            .onChange(of: place.space?.togetherSince) { _, _ in WidgetBridge.sync(place) }
            .onChange(of: place.decor.wall) { _, _ in WidgetBridge.sync(place) }
            .onChange(of: link.open) { _, _ in open() }
    }
}
