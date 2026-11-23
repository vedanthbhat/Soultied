import Foundation

/// A catalog selection plus a playback position at the turntable's last update.
public struct AppleRoomSong: Sendable, Equatable {
    public let id: String
    public let title: String
    public let artist: String
    public let duration: Double
    public private(set) var offset: Double = 0
    public private(set) var playing = false

    public init?(id: String, title: String, artist: String, duration: Double) {
        guard !id.isEmpty, !title.isEmpty, duration.isFinite, duration > 0 else { return nil }
        self.id = id
        self.title = title
        self.artist = artist
        self.duration = duration
    }

    public init?(_ data: Doc?) {
        guard let data, let id = data.str("id"), let title = data.str("title"),
              let duration = data.num("duration") else { return nil }
        self.init(id: id, title: title, artist: data.str("artist") ?? "", duration: duration)
        self = positioned(data.num("offset") ?? 0, playing: data.bool("playing"))
    }

    public func positioned(_ seconds: Double, playing: Bool) -> Self {
        var song = self
        song.offset = min(duration, max(0, seconds))
        song.playing = playing && song.offset < duration
        return song
    }

    public func position(at now: Double, since update: Double) -> Double {
        min(duration, offset + (playing ? max(0, now - update) / 1000 : 0))
    }

    public var doc: Doc {
        ["id": id, "title": title, "artist": artist, "duration": duration, "offset": offset, "playing": playing]
    }
}
