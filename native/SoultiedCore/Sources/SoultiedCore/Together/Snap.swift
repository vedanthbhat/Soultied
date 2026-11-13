import Foundation

/*
 * Today's photo (src/together/snap.ts): every day there's a little prompt ("the view from where you are"), and
 * you each take a photo of it. Yours stays hidden from your person until they've posted theirs too, then both of
 * you see both. Kept in the place's meta/snap-{day} document.
 */

public let SNAP_PROMPTS: [String] = [
    "The view from where you are",
    "What you’re eating today",
    "Your shoes right now",
    "Something blue",
    "The sky above you",
    "Where you’re sitting",
    "Something that made you smile today",
    "Your hands",
    "The last thing you bought",
    "Your favourite thing in this room",
    "What’s on your desk",
    "Something that reminds you of me",
    "Your face, right now",
    "A corner of your home",
    "What you’re drinking",
    "The book, show or song you’re on",
    "Something green",
    "Out of your window",
    "Something soft",
    "Your bed, as it is",
    "Your way home",
    "Something old",
    "A selfie with a silly face",
    "What the weather’s doing",
    "Something you’re looking forward to",
    "The light where you are",
    "Something small",
    "Your fridge, open",
    "Something you made",
    "Something you’d show me if I were there",
    "A shadow",
    "Your pocket or bag, emptied",
    "Something red",
    "Your street",
    "The messiest bit of your day",
    "Something that smells good",
    "What’s keeping you busy",
    "A sign or a word you spotted",
    "Your comfy clothes",
    "Something you’d want us to do together",
]

public let SNAP_CAPTION_MAX = 80

/// today's prompt, the same for both of you (and different for each place)
public func snapPrompt(_ sid: String, _ day: String) -> String {
    SNAP_PROMPTS[Int(Shuffle.hashStr("\(sid):snap:\(day)") % UInt32(SNAP_PROMPTS.count))]
}

public func snapDocName(_ day: String) -> String { "snap-\(day)" }

public struct SnapShot: Sendable, Equatable {
    /// a JPEG data: URL, kept small
    public var photo: String
    public var w: Int
    public var h: Int
    public var caption: String
    public var at: Double

    public init(photo: String, w: Int, h: Int, caption: String, at: Double) {
        self.photo = photo
        self.w = w
        self.h = h
        self.caption = caption
        self.at = at
    }
}

public struct SnapDoc: Sendable, Equatable {
    public var by: [String: SnapShot] = [:]

    public init() {}

    public init(_ raw: Doc?) {
        for (uid, v) in (raw ?? [:]).map("by") {
            guard let s = v as? Doc, let photo = s.str("photo"), photo.hasPrefix("data:image/"), photo.utf16.count <= 900_000 else { continue }
            by[uid] = SnapShot(
                photo: photo, w: s.int("w") ?? 0, h: s.int("h") ?? 0,
                caption: String((s.str("caption") ?? "").prefix(SNAP_CAPTION_MAX)).trimmingCharacters(in: .whitespaces),
                at: s.num("at") ?? 0
            )
        }
    }
}

/// where today's photo is: nobody's posted yet; only you have (waiting on them); only they have (locked till you
/// post yours); or both (open: you both see both)
public enum SnapStage: String, Sendable { case none, mine, theirs, open }

public func snapStage(_ doc: SnapDoc, me: String, them: String?) -> SnapStage {
    let mine = doc.by[me] != nil
    let theirs = them.map { doc.by[$0] != nil } ?? false
    return mine && theirs ? .open : mine ? .mine : theirs ? .theirs : .none
}

/// the demo room's: Rohan's already taken his (the view from his window, at dusk; the same picture as the website's)
public let DEMO_SNAP_PHOTO = "data:image/jpeg;base64,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"
