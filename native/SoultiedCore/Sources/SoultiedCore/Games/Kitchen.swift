import Foundation

/*
 * Kitchen Rush (src/games/kitchen.ts): one of you chops, the other cooks, and the orders keep coming. Ninety
 * seconds, on the same side: every order you get out before its ticket runs out counts for both of you.
 *
 * The chopper takes vegetables from the crates and chops them (chops taps each); chopped ones go on the pass.
 * The cook puts what an order needs from the pass into the pot, cooks it, and serves it. Leave a cooked pot too
 * long and it burns. Who chops and who cooks is drawn at the start.
 */

public struct Kitchen: LiveRules {
    public static let shiftMs: Double = 90_000
    public static let chops = 4
    public static let cookMs: Double = 3500
    /// a finished pot burns this long after it's done
    public static let burnMs: Double = 7000
    public static let passMax = 4
    public static let potMax = 3
    public static let maxOrders = 4
    /// how long an order waits before the customer gives up
    public static let patienceMs: Double = 45_000
    /// the gap between new orders: starts at the first, and shrinks to the second as the shift goes on
    static let orderGap: (Double, Double) = (12_000, 7_000)

    public enum Ing: String, CaseIterable, Sendable {
        case tomato, onion, carrot, mushroom, potato
        public var name: String { rawValue.capitalized }
    }

    public enum Dish: String, CaseIterable, Sendable {
        case tomatoSoup, mushroomSoup, stirFry, stew, minestrone
        public var name: String {
            switch self {
            case .tomatoSoup: return "Tomato soup"
            case .mushroomSoup: return "Mushroom soup"
            case .stirFry: return "Stir-fry"
            case .stew: return "Potato stew"
            case .minestrone: return "Minestrone"
            }
        }
        public var needs: [Ing] {
            switch self {
            case .tomatoSoup: return [.tomato, .onion]
            case .mushroomSoup: return [.mushroom, .onion]
            case .stirFry: return [.carrot, .mushroom, .onion]
            case .stew: return [.potato, .carrot, .onion]
            case .minestrone: return [.tomato, .carrot, .potato]
            }
        }
    }

    static let easy: [Dish] = [.tomatoSoup, .mushroomSoup]
    static let all: [Dish] = [.tomatoSoup, .mushroomSoup, .stirFry, .stew, .minestrone]

    public struct Order: Equatable, Sendable {
        public var id: Int
        public var dish: Dish
        public var at: Double
        public var until: Double
        var doc: Doc { ["id": id, "dish": dish.rawValue, "at": at, "until": until] }
        init(id: Int, dish: Dish, at: Double, until: Double) {
            self.id = id
            self.dish = dish
            self.at = at
            self.until = until
        }
        init?(_ raw: Any?) {
            guard let d = raw as? Doc, let id = d.int("id"), let dish = d.str("dish").flatMap({ Dish(rawValue: $0) }) else { return nil }
            self.id = id
            self.dish = dish
            at = d.num("at") ?? 0
            until = d.num("until") ?? 0
        }
    }

    public struct News: Equatable, Sendable {
        /// "served", "wrong", "burnt" or "missed"
        public var kind: String
        public var at: Double
        public var dish: Dish?
        var doc: Doc {
            var d: Doc = ["kind": kind, "at": at]
            if let dish { d["dish"] = dish.rawValue }
            return d
        }
    }

    public struct State: LiveValue, Equatable {
        public var chop: Side
        public var cook: Side
        public var startAt: Double
        public var endsAt: Double
        public var orders: [Order]
        public var nextOrderAt: Double
        public var nextId: Int
        /// the shift's own little random numbers, so new orders are the same on both screens
        public var seed: UInt32
        public var board: (ing: Ing, chops: Int)?
        /// chopped and waiting for the cook
        public var pass: [Ing]
        public var pot: [Ing]
        /// when the pot went on the stove (nil: not cooking)
        public var cookStart: Double?
        public var served: Int
        public var missed: Int
        public var burnt: Int
        public var news: News?
        public var over: Bool

        public static func == (l: State, r: State) -> Bool { l.json == r.json }
        var json: String { (try? JSONSerialization.data(withJSONObject: doc, options: [.sortedKeys])).map { String(decoding: $0, as: UTF8.self) } ?? "" }

        public init?(_ d: Doc) {
            let roles = d.map("roles")
            guard let chop = roles.str("chop").flatMap({ Side(rawValue: $0) }), let startAt = d.num("startAt") else { return nil }
            self.chop = chop
            cook = roles.str("cook").flatMap { Side(rawValue: $0) } ?? chop.other
            self.startAt = startAt
            endsAt = d.num("endsAt") ?? startAt + Kitchen.shiftMs
            orders = d.list("orders").compactMap { Order($0) }
            nextOrderAt = d.num("nextOrderAt") ?? 0
            nextId = d.int("nextId") ?? 1
            seed = UInt32(truncatingIfNeeded: Int64(d.num("seed") ?? 0))
            if let b = d["board"] as? Doc, let ing = b.str("ing").flatMap({ Ing(rawValue: $0) }) { board = (ing, b.int("chops") ?? 0) }
            pass = d.list("pass").compactMap { ($0 as? String).flatMap { Ing(rawValue: $0) } }
            pot = d.list("pot").compactMap { ($0 as? String).flatMap { Ing(rawValue: $0) } }
            cookStart = d.num("cookStart")
            served = d.int("served") ?? 0
            missed = d.int("missed") ?? 0
            burnt = d.int("burnt") ?? 0
            if let n = d["news"] as? Doc, let kind = n.str("kind") { news = News(kind: kind, at: n.num("at") ?? 0, dish: n.str("dish").flatMap { Dish(rawValue: $0) }) }
            over = d.bool("over")
        }

        init(chop: Side, startAt: Double, seed: UInt32) {
            self.chop = chop
            cook = chop.other
            self.startAt = startAt
            endsAt = startAt + Kitchen.shiftMs
            orders = []
            nextOrderAt = startAt + Kitchen.orderGap.0
            nextId = 1
            self.seed = seed
            pass = []
            pot = []
            served = 0
            missed = 0
            burnt = 0
            over = false
        }

        public var doc: Doc {
            ["roles": ["chop": chop.rawValue, "cook": cook.rawValue], "startAt": startAt, "endsAt": endsAt, "orders": orders.map(\.doc), "nextOrderAt": nextOrderAt,
             "nextId": nextId, "seed": Int(seed), "board": board.map { ["ing": $0.ing.rawValue, "chops": $0.chops] as Doc } as Any? ?? NSNull(),
             "pass": pass.map(\.rawValue), "pot": pot.map(\.rawValue), "cookStart": cookStart as Any? ?? NSNull(), "served": served, "missed": missed, "burnt": burnt,
             "news": news?.doc as Any? ?? NSNull(), "over": over]
        }
    }

    public enum Act: LiveValue, Equatable {
        case take(Ing), chop, toss, add(Int), cook, serve, bin

        public init?(_ d: Doc) {
            switch d.str("t") {
            case "take":
                guard let i = d.str("ing").flatMap({ Ing(rawValue: $0) }) else { return nil }
                self = .take(i)
            case "chop": self = .chop
            case "toss": self = .toss
            case "add":
                guard let v = d.num("i"), v == v.rounded(), v.isFinite else { return nil }
                self = .add(Int(v))
            case "cook": self = .cook
            case "serve": self = .serve
            case "bin": self = .bin
            default: return nil
            }
        }

        public var doc: Doc {
            switch self {
            case .take(let i): return ["t": "take", "ing": i.rawValue]
            case .chop: return ["t": "chop"]
            case .toss: return ["t": "toss"]
            case .add(let i): return ["t": "add", "i": i]
            case .cook: return ["t": "cook"]
            case .serve: return ["t": "serve"]
            case .bin: return ["t": "bin"]
            }
        }
    }

    public init() {}

    static func rand(_ seed: UInt32) -> (next: UInt32, r: Double) {
        let next = seed &* 1_664_525 &+ 1_013_904_223
        return (next, Double(next) / 4_294_967_296)
    }

    /// same ingredients, in any order
    public static func sameDish(_ a: [Ing], _ b: [Ing]) -> Bool { a.count == b.count && a.map(\.rawValue).sorted() == b.map(\.rawValue).sorted() }

    /// can this pot still become that dish?
    public static func fitsDish(_ pot: [Ing], _ dish: Dish) -> Bool {
        var left = dish.needs
        for i in pot {
            guard let k = left.firstIndex(of: i) else { return false }
            left.remove(at: k)
        }
        return true
    }

    public enum Pot: String, Sendable { case empty, filling, cooking, done, burning }

    public static func potState(_ s: State, now: Double) -> Pot {
        guard let c = s.cookStart else { return s.pot.isEmpty ? .empty : .filling }
        let t = now - c
        if t < cookMs { return .cooking }
        return t < cookMs + burnMs * 0.6 ? .done : .burning
    }

    static func newOrder(_ s: State, _ now: Double, easy: Bool) -> State {
        let (next, r) = rand(s.seed)
        let list = easy ? Self.easy : Self.all
        let dish = list[floorInt(r * Double(list.count)) % list.count]
        var n = s
        n.seed = next
        n.nextId = s.nextId + 1
        n.orders.append(Order(id: s.nextId, dish: dish, at: now, until: now + patienceMs))
        return n
    }

    /// what the orders still need, less what's chopped, on the board or in the pot (the demo partner uses it)
    public static func stillNeeded(_ s: State) -> [Ing] {
        var need = s.orders.flatMap { $0.dish.needs }
        for have in s.pass + s.pot + (s.board.map { [$0.ing] } ?? []) {
            if let k = need.firstIndex(of: have) { need.remove(at: k) }
        }
        return need
    }

    public func initial(_ rng: @escaping Random, now: Double) -> State {
        let startAt = now + Play.countdownMs
        let chop: Side = rng() < 0.5 ? .a : .b
        var s = State(chop: chop, startAt: startAt, seed: UInt32(floorInt(rng() * 4_294_967_296)))
        s = Self.newOrder(s, startAt, easy: true)
        s = Self.newOrder(s, startAt, easy: true)
        return s
    }

    public func act(_ s: State, _ seat: Side, _ a: Act, now: Double) -> State? {
        if s.over || now >= s.endsAt { return nil }
        var n = s
        if seat == s.chop {
            switch a {
            case .take(let ing) where s.board == nil:
                n.board = (ing, 0)
                return n
            case .toss where s.board != nil:
                n.board = nil
                return n
            case .chop:
                guard let b = s.board, b.chops < Self.chops else { return nil }
                let chops = b.chops + 1
                if chops >= Self.chops && s.pass.count < Self.passMax {
                    n.board = nil
                    n.pass.append(b.ing)
                } else {
                    n.board = (b.ing, chops)
                }
                return n
            default:
                return nil
            }
        }
        // the cook
        switch a {
        case .add(let i):
            if s.cookStart != nil || s.pot.count >= Self.potMax || i < 0 || i >= s.pass.count { return nil }
            n.pot.append(n.pass.remove(at: i))
            return n
        case .cook where s.cookStart == nil && !s.pot.isEmpty:
            n.cookStart = now
            return n
        case .bin where !s.pot.isEmpty || s.cookStart != nil:
            n.pot = []
            n.cookStart = nil
            return n
        case .serve:
            guard let c = s.cookStart, now - c >= Self.cookMs else { return nil }
            n.pot = []
            n.cookStart = nil
            guard let o = s.orders.first(where: { Self.sameDish($0.dish.needs, s.pot) }) else {
                n.news = News(kind: "wrong", at: now, dish: nil)
                return n
            }
            n.served = s.served + 1
            n.orders = s.orders.filter { $0.id != o.id }
            n.news = News(kind: "served", at: now, dish: o.dish)
            return n
        default:
            return nil
        }
    }

    public func tick(_ s: State, now: Double) -> State? {
        if s.over || now < s.startAt { return nil }
        var n = s
        if now >= s.endsAt {
            n.over = true
            return n
        }
        var changed = false
        // a pot left on the stove
        if let c = n.cookStart, now - c >= Self.cookMs + Self.burnMs {
            n.pot = []
            n.cookStart = nil
            n.burnt += 1
            n.news = News(kind: "burnt", at: now, dish: nil)
            changed = true
        }
        // customers who gave up
        let late = n.orders.filter { $0.until <= now }
        if let first = late.first {
            n.orders = n.orders.filter { $0.until > now }
            n.missed += late.count
            n.news = News(kind: "missed", at: now, dish: first.dish)
            changed = true
        }
        // new orders, more often as the shift goes on
        if now >= n.nextOrderAt {
            let k = min(1, (now - n.startAt) / Self.shiftMs)
            let gap = Self.orderGap.0 + (Self.orderGap.1 - Self.orderGap.0) * k
            if n.orders.count < Self.maxOrders { n = Self.newOrder(n, now, easy: n.served + n.missed < 1) }
            n.nextOrderAt = now + gap
            changed = true
        }
        // something chopped, waiting for room on the pass
        if let b = n.board, b.chops >= Self.chops, n.pass.count < Self.passMax {
            n.board = nil
            n.pass.append(b.ing)
            changed = true
        }
        return changed ? n : nil
    }

    public func result(_ s: State) -> LiveResult? {
        guard s.over else { return nil }
        return LiveResult(winner: "draw", line: "served \(s.served) \(s.served == 1 ? "order" : "orders") together", score: [.a: s.served, .b: s.served])
    }

    /// the demo room's partner plays whichever job they were given
    public func bot(_ s: State, _ seat: Side, now: Double) -> Act? {
        if s.over || now < s.startAt { return nil }
        if seat == s.chop {
            if let b = s.board { return b.chops < Self.chops ? .chop : nil }
            if s.pass.count >= Self.passMax { return nil }
            let need = Self.stillNeeded(s)
            guard let ing = need.first ?? s.orders.first?.dish.needs.first else { return nil }
            return .take(ing)
        }
        let pot = Self.potState(s, now: now)
        if pot == .done || pot == .burning { return .serve }
        if pot == .cooking { return nil }
        let fits = s.orders.filter { Self.fitsDish(s.pot, $0.dish) }
        if fits.isEmpty { return s.pot.isEmpty ? nil : .bin }
        if fits.contains(where: { Self.sameDish(s.pot, $0.dish.needs) }) { return .cook }
        // add something from the pass that one of those orders still needs
        for o in fits {
            var want = o.dish.needs
            for i in s.pot { if let k = want.firstIndex(of: i) { want.remove(at: k) } }
            if let i = s.pass.firstIndex(where: { want.contains($0) }) { return .add(i) }
        }
        // the pass is full of things nobody wants: clear some of it through the pot
        if s.pass.count >= Self.passMax && s.pot.count < Self.potMax { return .add(0) }
        return nil
    }

    public var botMs: Double { 480 }
    public var tickMs: Double { 200 }
    public func phase(_ s: State) -> String { s.over ? "over" : "shift" }
}
