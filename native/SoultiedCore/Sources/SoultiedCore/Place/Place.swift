import Foundation

/*
 * A couple's place, as the website keeps it (src/cloud/storeFs.ts):
 *
 *   spaces/{spaceId}                     the place: name, both members, invite
 *   spaces/{spaceId}/members/{uid}       each person's name + look
 *   spaces/{spaceId}/letters/{kind_date} one letter day
 *   spaces/{spaceId}/meta/…              letters, couch, decor, moods, touch, board, notes, photos…
 *   spaces/{spaceId}/activities/{id}     the little "what happened" feed
 *   invites/{code}                       lets a partner find the place from an invite code
 */

public struct SpaceDoc: Sendable, Equatable {
    public var id: String
    public var name: String
    public var inviteCode: String
    public var inviteExpiresAt: String
    public var inviteExpiresAtMs: Double
    public var creatorId: String
    public var partnerId: String?
    public var partnerPlaceholderName: String
    /// YYYY-MM-DD
    public var togetherSince: String?
    public var timezone: String
    public var createdAt: String
    public var members: [String]
    /// Soultied Plus: until when (ms), if the place has it
    public var plusUntil: Double?

    public init?(_ d: Doc?, millis: (Any?) -> Double? = { Values.num($0) }) {
        guard let d, let id = d.str("id") else { return nil }
        self.id = id
        name = d.str("name") ?? "Our little place"
        inviteCode = d.str("inviteCode") ?? ""
        inviteExpiresAt = d.str("inviteExpiresAt") ?? ""
        inviteExpiresAtMs = d.num("inviteExpiresAtMs") ?? 0
        creatorId = d.str("creatorId") ?? ""
        partnerId = d.str("partnerId")
        partnerPlaceholderName = d.str("partnerPlaceholderName") ?? ""
        togetherSince = d.str("togetherSince").flatMap { isDayKey($0) ? $0 : nil }
        timezone = d.str("timezone") ?? TimeZone.current.identifier
        createdAt = d.str("createdAt") ?? Values.isoNow()
        members = d.list("members").compactMap { $0 as? String }
        plusUntil = (d["plus"] as? Doc).flatMap { millis($0["until"]) }
    }

    /// the couple's first day, which every letter counts from
    public var startKey: String { startKeyOf(createdAt: createdAt) }

    public func partner(of me: String) -> String? {
        if me == creatorId { return partnerId }
        return members.first { $0 != me } ?? (creatorId == me ? nil : creatorId)
    }

    public var hasPlus: Bool { (plusUntil ?? 0) > Values.nowMs() }
}

public struct MemberDoc: Sendable, Equatable {
    public var name: String
    public var avatar: AvatarConfig
    public var lastActive: String

    public init(name: String, avatar: AvatarConfig, lastActive: String = Values.isoNow()) {
        self.name = name
        self.avatar = avatar
        self.lastActive = lastActive
    }

    public init(_ d: Doc, fallback: AvatarConfig = Wardrobe.defaultA) {
        name = d.str("name") ?? ""
        avatar = Wardrobe.normalize(d["avatar"], fallback: fallback)
        lastActive = d.str("lastActive") ?? ""
    }

    public var doc: Doc { ["name": name, "avatar": Wardrobe.dictionary(avatar), "lastActive": lastActive] }

    /// here in the last four minutes (each open app says so every two), or away
    public func status(now: Date = Date()) -> SeatStatus {
        guard let t = Values.date(lastActive) else { return .away }
        return now.timeIntervalSince(t) < 4 * 60 ? .online : .away
    }
}

/// invites/{code}
public struct Invite: Sendable {
    public var spaceId: String
    public var creatorId: String
    public var spaceName: String
    public var hostName: String
    public var hostAvatar: AvatarConfig
    public var partnerPlaceholderName: String
    public var expiresAtMs: Double

    public init?(_ d: Doc?, millis: (Any?) -> Double?) {
        guard let d, let sid = d.str("spaceId") else { return nil }
        spaceId = sid
        creatorId = d.str("creatorId") ?? ""
        spaceName = d.str("spaceName") ?? ""
        hostName = d.str("hostName") ?? ""
        hostAvatar = Wardrobe.normalize(d["hostAvatar"])
        partnerPlaceholderName = d.str("partnerPlaceholderName") ?? ""
        expiresAtMs = millis(d["expiresAt"]) ?? 0
    }
}

public enum ActivityType: String, Sendable {
    case questionRevealed = "question_revealed", partnerJoined = "partner_joined", spaceCreated = "space_created", avatarUpdated = "avatar_updated"
    case watchedTogether = "watched_together", playedGame = "played_game", roomDecorated = "room_decorated"
}

public struct Activity: Sendable, Identifiable, Equatable {
    public let id: String
    public var type: String
    public var title: String
    public var description: String
    public var at: String

    public init(id: String, type: String, title: String, description: String, at: String) {
        self.id = id
        self.type = type
        self.title = title
        self.description = description
        self.at = at
    }

    public init(row: Row) {
        id = row.id
        type = row.data.str("type") ?? ""
        title = row.data.str("title") ?? ""
        description = row.data.str("description") ?? ""
        at = row.data.str("at") ?? ""
    }

    public static func joined(_ name: String) -> Activity { new(.partnerJoined, "Moved in", "\(name.isEmpty ? "Your person" : name) took the seat on the couch.") }

    public static func new(_ type: ActivityType, _ title: String, _ description: String) -> Activity {
        Activity(id: Values.newId("act"), type: type.rawValue, title: title, description: description, at: Values.isoNow())
    }

    public var doc: Doc { ["id": id, "type": type, "title": title, "description": description, "timestamp": "", "at": at] }

    /// "Just now", "3 hours ago", "2 weeks ago"
    public func ago(now: Date = Date()) -> String {
        guard let t = Values.date(at) else { return "" }
        let m = Int((now.timeIntervalSince(t) / 60).rounded())
        if m < 2 { return "Just now" }
        if m < 60 { return "\(m) min ago" }
        let h = Int((Double(m) / 60).rounded())
        if h < 24 { return "\(h) \(h == 1 ? "hour" : "hours") ago" }
        let d = Int((Double(h) / 24).rounded())
        if d < 7 { return d == 1 ? "Yesterday" : "\(d) days ago" }
        let w = Int((Double(d) / 7).rounded())
        if w < 5 { return "\(w) \(w == 1 ? "week" : "weeks") ago" }
        let f = DateFormatter()
        f.dateStyle = .medium
        return f.string(from: t)
    }
}

public enum Places {
    public static let week: Double = 7 * 24 * 3600 * 1000

    /// ST-XXXX-XXXX-XXXX, from letters and digits that can't be mistaken for each other
    public static func makeCode() -> String {
        let chars = Array("23456789ABCDEFGHJKMNPQRSTUVWXYZ")
        var g = SystemRandomNumberGenerator()
        let s = (0..<12).map { _ in chars[Int(UInt8.random(in: 0...255, using: &g)) % chars.count] }
        return "ST-\(String(s[0..<4]))-\(String(s[4..<8]))-\(String(s[8..<12]))"
    }

    /// tidies a typed code ("st-abcd efgh-jkmn" → "ST-ABCD-EFGH-JKMN")
    public static func cleanCode(_ s: String) -> String {
        let raw = s.uppercased().filter { $0.isLetter || $0.isNumber }
        let body = raw.hasPrefix("ST") ? String(raw.dropFirst(2)) : raw
        guard body.count == 12 else { return s.trimmingCharacters(in: .whitespaces).uppercased() }
        let c = Array(body)
        return "ST-\(String(c[0..<4]))-\(String(c[4..<8]))-\(String(c[8..<12]))"
    }

    /// The place to open for this person: a place you share beats one you started alone, newest first.
    public static func best(_ rows: [Row], uid: String) -> String? {
        func rank(_ d: Doc) -> Int { (d.str("partnerId") != nil ? 2 : 0) + (d.str("creatorId") == uid ? 0 : 1) }
        return rows.sorted { a, b in
            let ra = rank(a.data), rb = rank(b.data)
            if ra != rb { return ra > rb }
            return (a.data.str("createdAt") ?? "") > (b.data.str("createdAt") ?? "")
        }.first.flatMap { $0.data.str("id") ?? $0.id }
    }

    /// Everything written when someone starts a place (one batch: the security rules check them together).
    public static func create(uid: String, name: String, partnerName: String, togetherSince: String? = nil, me: MemberDoc, backend: Backend, now: Date = Date()) -> (spaceId: String, writes: [Write]) {
        let sid = Values.newId("space")
        let code = makeCode()
        let createdAt = Values.iso(now)
        let expiresMs = (now.timeIntervalSince1970 * 1000 + week).rounded()
        let expires = Values.iso(Date(timeIntervalSince1970: expiresMs / 1000))
        var space: Doc = [
            "id": sid, "name": name, "inviteCode": code, "inviteExpiresAt": expires, "inviteExpiresAtMs": expiresMs,
            "creatorId": uid, "partnerPlaceholderName": partnerName, "timezone": TimeZone.current.identifier, "createdAt": createdAt, "members": [uid],
        ]
        if let t = togetherSince, isDayKey(t) { space["togetherSince"] = t }
        let first = Activity.new(.spaceCreated, "Moved in", "\(me.name) set up \(name).")
        return (sid, [
            Write("spaces/\(sid)", space),
            Write("spaces/\(sid)/members/\(uid)", me.doc),
            Write("invites/\(code)", invitePayload(spaceId: sid, creatorId: uid, spaceName: name, host: me, partnerName: partnerName, expiresMs: expiresMs, backend: backend)),
            Write("spaces/\(sid)/activities/\(first.id)", first.doc),
        ])
    }

    public static func invitePayload(spaceId: String, creatorId: String, spaceName: String, host: MemberDoc, partnerName: String, expiresMs: Double, backend: Backend) -> Doc {
        ["spaceId": spaceId, "creatorId": creatorId, "spaceName": spaceName, "hostName": host.name, "hostAvatar": Wardrobe.dictionary(host.avatar),
         "partnerPlaceholderName": partnerName, "expiresAt": backend.timestamp(ms: expiresMs)]
    }
}
