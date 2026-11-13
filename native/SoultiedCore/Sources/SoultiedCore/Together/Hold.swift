import Foundation

/*
 * Holding the couch (src/together/hold.ts): you each press and hold, and while you're both holding, the two of
 * you sit side by side in the room and each phone beats softly like a heart. Kept in the place's meta/hold
 * document: while you hold, your entry beats about once a second; letting go says so. Whether your person is
 * still holding is judged by when their last beat arrived here, not by their clock (phones' clocks differ).
 */

/// how often a beat goes out while you hold, how long after the last one arrives they still count as holding,
/// and how far off a beat's own time can be before it's taken as old (left over from before)
public let HOLD_BEAT: Double = 1.0
public let HOLD_STALE: Double = 3.0
public let HOLD_SKEW_MS: Double = 20_000

public struct HoldEntry: Sendable, Equatable {
    public var holding: Bool
    /// when the beat went out (their clock, ms)
    public var beat: Double

    public init(holding: Bool, beat: Double) {
        self.holding = holding
        self.beat = beat
    }
}

public struct HoldDoc: Sendable, Equatable {
    public var by: [String: HoldEntry] = [:]

    public init() {}

    public init(_ raw: Doc?) {
        for (uid, v) in (raw ?? [:]).map("by") {
            guard let e = v as? Doc else { continue }
            by[uid] = HoldEntry(holding: e["holding"] as? Bool ?? false, beat: e.num("beat") ?? 0)
        }
    }
}

/// whether someone's holding now: their entry says so, their last beat arrived here lately (`seen`, this
/// phone's clock), and the beat isn't one left over from long ago
public func isHolding(_ e: HoldEntry?, seen: Date?, now: Date = Date()) -> Bool {
    guard let e, e.holding, let seen else { return false }
    return now.timeIntervalSince(seen) < HOLD_STALE && abs(now.timeIntervalSince1970 * 1000 - e.beat) < HOLD_SKEW_MS
}
