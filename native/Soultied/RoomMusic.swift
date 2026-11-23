import MusicKit
import SwiftUI
import SoultiedCore

/// Only the catalog ID and transport controls travel between partners.
@MainActor @Observable
final class RoomMusic {
    static let shared = RoomMusic()
    private let player = ApplicationMusicPlayer.shared
    private var loadedID: String?
    var message: String?
    var retry = 0

    func authorize() async -> Bool {
        guard await MusicAuthorization.request() == .authorized else {
            message = "Allow Apple Music access for Soultied in Settings."
            return false
        }
        do {
            guard try await MusicSubscription.current.canPlayCatalogContent else {
                message = "Sign in to an active Apple Music subscription on this iPhone."
                return false
            }
            message = nil
            retry += 1
            return true
        } catch {
            message = "Couldn’t check your subscription. Try connecting again."
            return false
        }
    }

    private var playbackTask: Task<Void, Never>?

    func update(_ song: AppleRoomSong?, updated: Double = 0) {
        let previous = playbackTask
        previous?.cancel()
        if song?.playing != true { player.pause() }
        playbackTask = Task {
            // An older asynchronous play call can finish after cancellation.
            // Apply the latest transport state only after that call returns.
            await previous?.value
            guard !Task.isCancelled else { return }
            guard let song else { player.pause(); return }
            await follow(song, updated: updated)
        }
    }

    private func follow(_ song: AppleRoomSong, updated: Double) async {
        guard MusicAuthorization.currentStatus == .authorized else {
            message = "Connect Apple Music to listen on this iPhone."
            return
        }
        guard song.playing, song.position(at: Values.nowMs(), since: updated) < song.duration else {
            player.pause()
            return
        }
        do {
            if loadedID != song.id {
                player.pause()
                let response = try await MusicCatalogResourceRequest<Song>(matching: \.id, equalTo: MusicItemID(song.id)).response()
                try Task.checkCancellation()
                guard let item = response.items.first, item.playParameters != nil else {
                    message = "This song is unavailable in your Apple Music region."
                    return
                }
                player.queue = [item]
                loadedID = nil
                try await player.prepareToPlay()
                try Task.checkCancellation()
                loadedID = song.id
            }
            while !Task.isCancelled {
                let target = song.position(at: Values.nowMs(), since: updated)
                if !song.playing || target >= song.duration {
                    player.pause()
                    return
                }
                if player.state.playbackStatus != .playing {
                    player.playbackTime = target
                    try await player.play()
                    try Task.checkCancellation()
                }
                let currentTarget = song.position(at: Values.nowMs(), since: updated)
                if abs(player.playbackTime - currentTarget) > 1.25 { player.playbackTime = currentTarget }
                message = nil
                try await Task.sleep(for: .seconds(1))
            }
        } catch {
            if !Task.isCancelled {
                player.pause()
                loadedID = nil
                message = "Apple Music couldn’t play this song. Check your subscription and connection, then retry."
            }
        }
    }
}

struct RoomMusicPlayback: ViewModifier {
    let place: PlaceModel
    @Environment(\.scenePhase) private var phase
    private struct Input: Equatable {
        let state: TurntableState?
        let enabled: Bool
        let retry: Int
    }

    func body(content: Content) -> some View {
        let music = RoomMusic.shared
        let deck = RecordDeck.shared
        let input = Input(state: place.turntable, enabled: phase == .active && place.hasPlus && !deck.mutedForMe && !deck.hushed, retry: music.retry)
        content.onChange(of: input, initial: true) { _, input in
            guard input.enabled, let state = input.state, let song = state.apple else {
                music.update(nil)
                return
            }
            music.update(song, updated: state.at)
        }.onDisappear { music.update(nil) }
    }
}

struct RoomSongControls: View {
    let place: PlaceModel
    let state: TurntableState
    let song: AppleRoomSong
    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { timeline in
            let position = song.position(at: timeline.date.timeIntervalSince1970 * 1000, since: state.at)
            let playing = song.playing && position < song.duration
            VStack(alignment: .leading, spacing: 8) {
                Text("Our song · Apple Music").font(.pxSmall)
                Text(song.title).font(.pxBodyBold)
                Text(song.artist).font(.pxSmall)
                HStack {
                    Button(playing ? "Pause" : position >= song.duration ? "Replay" : "Resume") {
                        place.controlAppleSong(song, position: position >= song.duration ? 0 : position, playing: !playing)
                    }
                    Button("+15 sec") { place.controlAppleSong(song, position: position + 15, playing: playing) }
                }.buttonStyle(.px(.paper, small: true))
                let deck = RecordDeck.shared
                Button(deck.mutedForMe ? "Unmute here" : "Mute for me") { deck.setMuted(!deck.mutedForMe) }
                    .buttonStyle(.px(.paper, small: true))
                if let message = RoomMusic.shared.message {
                    Text(message).font(.pxSmall)
                    Button("Connect or retry") { Task { _ = await RoomMusic.shared.authorize() } }
                }
            }
        }
    }
}

struct RoomSongPicker: View {
    let place: PlaceModel
    @Environment(\.dismiss) private var dismiss
    @State private var authorized = false
    @State private var connecting = false
    @State private var query = ""
    @State private var matches: [Song] = []
    @State private var status = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("Our song").font(.pxHeading)
                if !place.hasPlus {
                    Text("Our song comes with Soultied Plus.").font(.pxBody)
                } else if !authorized {
                    Text("Connect your own Apple Music subscription. Your partner connects theirs on their iPhone.").font(.pxBody)
                    Button("Connect Apple Music") {
                        Task {
                            connecting = true
                            authorized = await RoomMusic.shared.authorize()
                            connecting = false
                        }
                    }.buttonStyle(.px(.terracotta)).disabled(connecting)
                    if let message = RoomMusic.shared.message { Text(message).font(.pxSmall) }
                } else {
                    if let saved = place.ourSong {
                        Button("Play " + saved.title) { place.chooseAppleSong(saved); dismiss() }.buttonStyle(.px(.sage))
                    }
                    PixelField(placeholder: "Search songs or artists", text: $query)
                    Text(status).font(.pxSmall)
                    ForEach(matches) { song in
                        Button {
                            guard let pick = AppleRoomSong(id: song.id.rawValue, title: song.title, artist: song.artistName, duration: song.duration ?? 0) else { return }
                            place.chooseAppleSong(pick)
                            dismiss()
                        } label: {
                            VStack(alignment: .leading) {
                                Text(song.title).font(.pxBodyBold)
                                Text(song.artistName).font(.pxSmall)
                            }.frame(maxWidth: .infinity, alignment: .leading).pxCard()
                        }.buttonStyle(.press)
                    }
                }
                Button("Done") { dismiss() }.buttonStyle(.px(.paper, small: true))
            }.padding(16)
        }.task {
            if place.hasPlus && MusicAuthorization.currentStatus == .authorized {
                authorized = await RoomMusic.shared.authorize()
            }
        }.task(id: query) {
            matches = []
            status = ""
            let term = query.trimmingCharacters(in: .whitespacesAndNewlines)
            guard authorized, !term.isEmpty else { return }
            do {
                try await Task.sleep(for: .milliseconds(350))
                var request = MusicCatalogSearchRequest(term: term, types: [Song.self])
                request.limit = 20
                let result = try await request.response()
                try Task.checkCancellation()
                matches = result.songs.filter { $0.playParameters != nil && ($0.duration ?? 0) > 0 }
                status = matches.isEmpty ? "No playable songs found." : ""
            } catch {
                if !Task.isCancelled { status = "Search couldn’t load. Try searching again." }
            }
        }
    }
}
