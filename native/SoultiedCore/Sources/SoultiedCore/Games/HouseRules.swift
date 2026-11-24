import Foundation

/*
 * House rules (src/games/live/houseRules.ts): every live game starts with one fun twist, drawn from the match's
 * seed so both screens see the same one. Either of you can swap it for the next one on the list, once, before the
 * game starts. The rule's id goes into the game's state ("rule"), and each game's rules play by it.
 */

public struct HouseRule: Equatable, Sendable {
    public let id: String
    public let name: String
    /// what it changes, in a line
    public let line: String
}

public enum HouseRules {
    public static let list: [GameKind: [HouseRule]] = [
        .tug: [
            HouseRule(id: "final", name: "Final stretch", line: "In the last five seconds, every tap pulls twice as hard."),
            HouseRule(id: "short", name: "Short rope", line: "A lead of 14 taps pulls the ribbon all the way over."),
            HouseRule(id: "sprint", name: "Sprint", line: "Ten seconds, not twenty."),
        ],
        .rps: [
            HouseRule(id: "quick", name: "Quick hands", line: "Two seconds to pick, not five."),
            HouseRule(id: "banned", name: "Banned hand", line: "Each round, one hand isn’t allowed. Check before you pick."),
            HouseRule(id: "quickest", name: "Fastest wins ties", line: "Pick the same hand and whoever picked first takes the round."),
        ],
        .quickdraw: [
            HouseRule(id: "fake", name: "Fake-outs", line: "The lantern sometimes flickers before it lights. A flicker isn’t a light."),
            HouseRule(id: "fuse", name: "Long fuse", line: "It can take up to eight seconds to light."),
            HouseRule(id: "five", name: "First to five", line: "Five rounds to win, not three."),
        ],
        .coasters: [
            HouseRule(id: "big", name: "Big cap", line: "A bottle cap half as big again."),
            HouseRule(id: "turbo", name: "Turbo cap", line: "The cap flies faster and hardly slows down."),
            HouseRule(id: "sudden", name: "Quick match", line: "First to three goals, not seven."),
        ],
        .kitchen: [
            HouseRule(id: "rush", name: "Rush hour", line: "The orders come in faster."),
            HouseRule(id: "swap", name: "Switch stations", line: "Halfway through, the chopper and the cook swap places."),
            HouseRule(id: "hungry", name: "Hungry customers", line: "Every ticket runs out sooner."),
        ],
    ]

    /// how many times the rule can be swapped before a game
    public static let rerolls = 1

    /// the rule for a game with this seed, after this many swaps
    public static func rule(_ kind: GameKind, seed: Int, rerolls: Int = 0) -> HouseRule? {
        guard let l = list[kind], !l.isEmpty else { return nil }
        let base = abs(seed) % l.count
        return l[(base + max(0, rerolls)) % l.count]
    }

    /// the rule for a live game's match (while it's being set up, and once it's on)
    public static func of(_ m: Match?) -> HouseRule? {
        guard let m else { return nil }
        return rule(m.kind, seed: m.state.int("seed") ?? 0, rerolls: m.state.int("rerolls") ?? 0)
    }

    /// a rule by its id (from a game's state)
    public static func byId(_ kind: GameKind, _ id: String?) -> HouseRule? {
        guard let id else { return nil }
        return list[kind]?.first { $0.id == id }
    }

    /// swap the rule for the next one (only while waiting for the two of you, and only once)
    public static func reroll(_ m: Match, _ seat: Side) -> Match? {
        let n = m.state.int("rerolls") ?? 0
        guard m.status == .setup, m.state.str("phase") == "lobby", n < rerolls, list[m.kind] != nil else { return nil }
        var r = m
        r.state["rerolls"] = n + 1
        r.updatedBy = seat
        r.last = "picked another house rule"
        return r
    }
}
