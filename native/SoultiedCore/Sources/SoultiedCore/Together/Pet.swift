import Foundation

/*
 * The pet you both raise (src/together/pet.ts). Whoever sleeps on the cushion by the couch gets looked after:
 * each of you can feed it, play with it and give it a cuddle, once each a day. Every day you BOTH come by counts
 * towards how close it's grown to the two of you (New friend, Settling in, Loyal, Best friend, Family). Missed
 * days never set it back; it just misses you. The room shows it all: the bowl's full once it's been fed, its
 * ball is out once someone's played, a blanket's tucked over it after a cuddle, hearts instead of zzz when you've
 * both been, and a little heart over it when your person's been by and you haven't.
 *
 * Kept in the place's meta/pet document:
 *   care   day → uid → what you did → when (ms); only the last two weeks are kept
 *   days   every day you both looked after it (day → true), for good
 *
 * Days are each person's own calendar day (like the couch and the fire).
 */

public enum PetAct: String, CaseIterable, Sendable {
    case feed, play, cuddle

    public var label: String {
        switch self {
        case .feed: return "Feed"
        case .play: return "Play"
        case .cuddle: return "Cuddle"
        }
    }

    /// "Rohan fed Biscuit", "played with", "cuddled"
    public var did: String {
        switch self {
        case .feed: return "fed"
        case .play: return "played with"
        case .cuddle: return "cuddled"
        }
    }

    public var done: String {
        switch self {
        case .feed: return "Fed"
        case .play: return "Played"
        case .cuddle: return "Cuddled"
        }
    }
}

/// what one of you did on a day: the time (ms) of each
public typealias PetCare = [PetAct: Double]

public enum PetMood: String, Sendable {
    /// you've both been by today; your person has and you haven't; you have and they haven't; neither yet today;
    /// nobody's been by for three days or more
    case both, waiting, mine, resting, missing
}

/// what the room shows of it
public struct PetCareState: Sendable, Equatable {
    public var fed = false
    public var played = false
    public var cuddled = false
    public var both = false
    public var waiting = false
    public var level = 0

    public init(fed: Bool = false, played: Bool = false, cuddled: Bool = false, both: Bool = false, waiting: Bool = false, level: Int = 0) {
        self.fed = fed
        self.played = played
        self.cuddled = cuddled
        self.both = both
        self.waiting = waiting
        self.level = level
    }
}

public struct PetWeekDay: Sendable, Equatable {
    public var day: String
    public var me: Bool
    public var them: Bool
    public var both: Bool
}

public struct PetView: Sendable, Equatable {
    /// what you did today, and what your person did
    public var mine: PetCare = [:]
    public var theirs: PetCare = [:]
    /// whether either of you has today
    public var fed = false
    public var played = false
    public var cuddled = false
    public var mood: PetMood = .resting
    /// days you've both looked after it, its level, and how many more to the next
    public var bond = 0
    public var level = 0
    public var toNext = 3
    /// the last seven days, today last
    public var week: [PetWeekDay] = []

    public init() {}

    public var careState: PetCareState {
        PetCareState(fed: fed, played: played, cuddled: cuddled, both: mood == .both, waiting: mood == .waiting, level: level)
    }

    public var levelName: String { Pet.levels[level].name }
}

public enum Pet {
    /// how many days of care are kept (the bond, in `days`, is kept for good)
    public static let keepDays = 14

    /// how close it's grown, by the days you've both looked after it
    public static let levels: [(at: Int, name: String)] = [
        (0, "New friend"), (3, "Settling in"), (7, "Loyal"), (14, "Best friend"), (30, "Family"),
    ]

    /// which level it's at, and how many more days to the next (0 at the top)
    public static func level(_ bond: Int) -> (level: Int, toNext: Int) {
        var l = 0
        for (i, v) in levels.enumerated() where bond >= v.at { l = i }
        return (l, l + 1 < levels.count ? levels[l + 1].at - bond : 0)
    }

    static func cap(_ s: String) -> String { s.prefix(1).uppercased() + s.dropFirst() }

    /// "fed and cuddled", "fed, played with and cuddled"
    static func didList(_ c: PetCare) -> String {
        let v = PetAct.allCases.filter { c[$0] != nil }.map(\.did)
        if v.count <= 1 { return v.joined() }
        return "\(v.dropLast().joined(separator: ", ")) and \(v.last!)"
    }

    /// how it's doing, in a line: `name` is its name, or "your ginger cat" while it hasn't got one
    public static func line(_ v: PetView, name: String, theirName: String?) -> String {
        let N = cap(name)
        switch v.mood {
        case .both:
            return theirName != nil ? "\(N) is over the moon: you’ve both been by today." : "\(N) is happy you came by."
        case .waiting:
            return "\(theirName ?? "Your person") \(didList(v.theirs)) \(name) today. Your turn."
        case .mine:
            if let t = theirName { return "\(N) is happy. \(t) hasn’t been by yet today." }
            return "\(N) is happy you came by."
        case .missing:
            return "\(N) misses you. Come and say hello."
        case .resting:
            return "\(N) is curled up, waiting for you."
        }
    }

    /// what it does when you look after it
    public static func reaction(_ act: PetAct, name: String) -> String {
        let N = cap(name)
        switch act {
        case .feed: return "\(N) wolfed it down."
        case .play: return "\(N) chased the ball round the rug, then flopped back down."
        case .cuddle: return "\(N) snuggled right in."
        }
    }

    static let levelUpWords = ["is new here", "is settling in", "is loyal to you both now", "is your best friend now", "is family now"]

    /// "Biscuit is loyal to you both now: 7 days of looking after Biscuit together."
    public static func levelUp(_ level: Int, name: String) -> String {
        let l = max(0, min(levels.count - 1, level))
        return "\(cap(name)) \(levelUpWords[l]): \(levels[l].at) days of looking after \(name) together."
    }
}

public struct PetDoc: Sendable, Equatable {
    public var care: [String: [String: PetCare]] = [:]
    public var days: Set<String> = []

    public init() {}

    public init(_ raw: Doc?) {
        let r = raw ?? [:]
        for (day, v) in r.map("care") {
            guard VisitDoc.isKey(day), let by = v as? Doc else { continue }
            var out: [String: PetCare] = [:]
            for (uid, a) in by {
                guard !uid.isEmpty, let acts = a as? Doc else { continue }
                var c: PetCare = [:]
                for act in PetAct.allCases {
                    // (a real moment, after 2001, in ms)
                    if !(acts[act.rawValue] is String), let n = acts.num(act.rawValue), n.isFinite, n >= 1e12 { c[act] = n }
                }
                if !c.isEmpty { out[uid] = c }
            }
            if !out.isEmpty { care[day] = out }
        }
        for (day, v) in r.map("days") where VisitDoc.isKey(day) {
            // (only a true: other numbers are turned away, as a 1 can read as a Bool too)
            if let b = v as? Bool, b, (Values.num(v) ?? 1) == 1 { days.insert(day) }
        }
    }

    static func did(_ c: PetCare?) -> Bool { !(c ?? [:]).isEmpty }

    /// how many days you've both looked after it
    public var bond: Int { days.count }

    public func view(today: String, me: String, them: String?) -> PetView {
        var v = PetView()
        let day = care[today] ?? [:]
        v.mine = day[me] ?? [:]
        v.theirs = them.flatMap { day[$0] } ?? [:]
        func any(_ a: PetAct) -> Bool { v.mine[a] != nil || v.theirs[a] != nil }
        v.fed = any(.feed)
        v.played = any(.play)
        v.cuddled = any(.cuddle)
        let iDid = PetDoc.did(v.mine), theyDid = PetDoc.did(v.theirs)
        if iDid && theyDid { v.mood = .both }
        else if theyDid { v.mood = .waiting }
        else if iDid { v.mood = .mine }
        else {
            // the last day anyone came by (on or before today)
            var last: String?
            for (k, by) in care where k <= today && by.values.contains(where: { PetDoc.did($0) }) && (last == nil || k > last!) { last = k }
            for k in days where k <= today && (last == nil || k > last!) { last = k }
            if let l = last, Day.number(today) - Day.number(l) >= 3 { v.mood = .missing } else { v.mood = .resting }
        }
        v.bond = bond
        (v.level, v.toNext) = Pet.level(bond)
        for i in stride(from: 6, through: 0, by: -1) {
            let k = Day.add(today, -i)
            let m = PetDoc.did(care[k]?[me])
            let t = them.map { PetDoc.did(care[k]?[$0]) } ?? false
            v.week.append(PetWeekDay(day: k, me: m, them: t, both: days.contains(k) || (m && t)))
        }
        return v
    }

    /// Looking after it: what to write when `me` does `act` today (nil when you already have today). Your person
    /// already having been by today makes it a day you both did; care older than two weeks is cleared out.
    public func carePatch(today: String, me: String, them: String?, act: PetAct, now: Double) -> Doc? {
        if care[today]?[me]?[act] != nil { return nil }
        var c: Doc = [today: [me: [act.rawValue: Int(jsRound(now))] as Doc] as Doc]
        let oldest = Day.add(today, -(Pet.keepDays - 1))
        for k in care.keys where k < oldest { c[k] = NSNull() }
        var out: Doc = ["care": c]
        if let t = them, PetDoc.did(care[today]?[t]), !days.contains(today) { out["days"] = [today: true] as Doc }
        return out
    }

    /// days you both came by that aren't counted yet (you both looked after it at once): nil when there are none
    public func missingDays(me: String, them: String?) -> Doc? {
        guard let t = them else { return nil }
        var d: Doc = [:]
        for (k, by) in care where !days.contains(k) && PetDoc.did(by[me]) && PetDoc.did(by[t]) { d[k] = true }
        return d.isEmpty ? nil : ["days": d]
    }

    /// what you'd write to put this in the database (the demo room)
    public var doc: Doc {
        var c: Doc = [:]
        for (k, by) in care {
            var b: Doc = [:]
            for (uid, acts) in by { b[uid] = Dictionary(uniqueKeysWithValues: acts.map { ($0.key.rawValue, Int($0.value) as Any) }) as Doc }
            c[k] = b
        }
        return ["care": c, "days": Dictionary(uniqueKeysWithValues: days.map { ($0, true as Any) }) as Doc]
    }

    /// The demo room: nine days looked after together over the last two weeks (Loyal, five more to Best friend),
    /// and Rohan fed Biscuit and played with Biscuit this morning, so it's waiting for you.
    public static func demo(today: String, now: Double, me: String = Demo.me, them: String = Demo.them) -> PetDoc {
        var p = PetDoc()
        let hour = 3600e3
        func at(_ back: Int, _ h: Double) -> Double { jsRound(now - Double(back) * 86400e3 - h * hour) }
        for b in [1, 2, 3, 5, 6, 8, 9, 10, 12] {
            let k = Day.add(today, -b)
            p.days.insert(k)
            p.care[k] = [
                me: b % 2 == 1 ? [.feed: at(b, 2), .cuddle: at(b, 1)] : [.play: at(b, 3)],
                them: b % 3 != 0 ? [.feed: at(b, 5)] : [.feed: at(b, 6), .play: at(b, 4), .cuddle: at(b, 4)],
            ]
        }
        p.care[Day.add(today, -4)] = [them: [.feed: at(4, 2)]]
        p.care[Day.add(today, -7)] = [me: [.cuddle: at(7, 1)]]
        p.care[today] = [them: [.feed: jsRound(now - 3 * hour), .play: jsRound(now - 3 * hour + 4 * 60e3)]]
        return p
    }
}
