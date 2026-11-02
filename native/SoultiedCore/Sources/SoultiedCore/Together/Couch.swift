import Foundation

/*
 * The couch (src/couch.ts): every day you BOTH open Soultied, the two of you scoot a little closer.
 * Seven such days takes you from the two ends to side by side. Missed days never push you apart.
 */

public let COUCH_STEPS = 7

public struct CouchState: Sendable, Equatable {
    /// the last local day each person opened the app
    public var seen: [String: String] = [:]
    /// every day you were both here, oldest first
    public var together: [String] = []
    /// the closeness each person has already watched happen (so each of you sees the scoot once)
    public var shown: [String: Int] = [:]

    public init(seen: [String: String] = [:], together: [String] = [], shown: [String: Int] = [:]) {
        self.seen = seen
        self.together = together
        self.shown = shown
    }

    public init(_ raw: Doc?) {
        let r = raw ?? [:]
        seen = r.map("seen").compactMapValues { $0 as? String }
        together = r.list("together").compactMap { $0 as? String }
        shown = r.map("shown").compactMapValues { Values.num($0).map { Int($0) } }
    }

    /// 0 = the two ends of the couch, COUCH_STEPS = side by side
    public var level: Int { min(COUCH_STEPS, together.count) }

    /// What showing up today would write, if anything: `me` was here today, and, if your person was too, a day together.
    public func checkIn(me: String, partner: String?, today: String) -> (seen: Bool, together: Bool)? {
        let both = partner.map { seen[$0] == today } ?? false
        let already = together.contains(today)
        if seen[me] == today && (!both || already) { return nil }
        return (true, both && !already)
    }

    public static func line(_ level: Int, partnerName: String) -> String {
        if level >= COUCH_STEPS { return "Side by side with \(partnerName). Keep showing up and stay cosy." }
        let left = COUCH_STEPS - level
        return "\(left) more \(left == 1 ? "day" : "days") of you both showing up and you’ll be sitting side by side."
    }
}

/* ---------- decorating (src/decor/catalogue.ts) ---------- */

public enum SlotId: String, CaseIterable, Sendable {
    case wall, couch, rug, pet, view, painting, plant
}

public struct DecorItem: Sendable, Identifiable, Hashable {
    public let slot: SlotId
    public let id: String
    public let name: String
    /// in stitches; 0 is free (the room you start with, and "no pet")
    public let price: Int
    public let blurb: String
    public var key: String { "\(slot.rawValue):\(id)" }
}

public struct SlotDef: Sendable {
    public let id: SlotId
    public let name: String
    public let start: String
}

public enum Catalogue {
    public static let slots: [SlotDef] = [
        SlotDef(id: .wall, name: "Wallpaper", start: "sage"),
        SlotDef(id: .couch, name: "Couch", start: "terracotta"),
        SlotDef(id: .rug, name: "Rug", start: "diamond"),
        SlotDef(id: .pet, name: "Pet", start: "ginger"),
        SlotDef(id: .view, name: "Window", start: "snow"),
        SlotDef(id: .painting, name: "Painting", start: "dusk"),
        SlotDef(id: .plant, name: "Plant", start: "monstera"),
    ]

    private static func i(_ s: SlotId, _ id: String, _ name: String, _ price: Int, _ blurb: String) -> DecorItem {
        DecorItem(slot: s, id: id, name: name, price: price, blurb: blurb)
    }

    public static let items: [DecorItem] = [
        i(.wall, "sage", "Sage stripes", 0, "The green you moved in with, with tiny sprigs."),
        i(.wall, "blush", "Blush damask", 60, "Dusty rose with a soft damask print."),
        i(.wall, "gingham", "Cottage gingham", 60, "Warm cream checks, like a farmhouse kitchen."),
        i(.wall, "midnight", "Midnight stars", 80, "Deep blue, with little gold stars all over."),
        i(.wall, "clay", "Clay arches", 100, "Terracotta with a row of soft arches."),
        i(.wall, "forest", "Forest leaves", 100, "Dark green, scattered with leaves."),

        i(.couch, "terracotta", "Terracotta", 0, "The couch you started on."),
        i(.couch, "sage", "Sage velvet", 120, "Soft green velvet, with a terracotta throw."),
        i(.couch, "mustard", "Mustard", 120, "Sunny and a little retro."),
        i(.couch, "linen", "Oat linen", 120, "Pale and calm, with rust and sage cushions."),
        i(.couch, "navy", "Navy", 150, "Deep blue, with mustard and cream cushions."),
        i(.couch, "plum", "Plum", 150, "Rich plum velvet, very cosy."),

        i(.rug, "diamond", "Diamond rug", 0, "The cream rug with terracotta diamonds."),
        i(.rug, "moss", "Moss rug", 50, "Plain soft green, with a cream border."),
        i(.rug, "kilim", "Kilim stripes", 80, "Woven bands of rust, cream, sage and gold."),
        i(.rug, "checker", "Checkerboard", 80, "Cream and sage squares."),
        i(.rug, "braided", "Braided oval", 120, "A round rug of braided rings."),

        i(.pet, "ginger", "Ginger cat", 0, "Asleep by the fire, as always."),
        i(.pet, "none", "No pet", 0, "Just the cushion by the hearth."),
        i(.pet, "tuxedo", "Tuxedo cat", 150, "Black and white, very dignified, very asleep."),
        i(.pet, "bunny", "White bunny", 180, "A fluffy loaf with its ears tucked back."),
        i(.pet, "pug", "Sleepy pug", 200, "Snores a little. Worth it."),
        i(.pet, "corgi", "Corgi", 250, "Big ears, short legs, deeply asleep."),

        i(.view, "snow", "Snowy night", 0, "Snow falling on the hills, and a moon."),
        i(.view, "rain", "Rainy evening", 80, "Rain against the glass. Best with the fire on."),
        i(.view, "summer", "Summer night", 120, "Warm hills and fireflies drifting about."),
        i(.view, "blossom", "Spring blossom", 150, "A pink dusk and petals on the breeze."),
        i(.view, "city", "City lights", 150, "A skyline, its windows going on and off."),
        i(.view, "aurora", "Northern lights", 250, "Green lights rippling over the snow."),

        i(.painting, "dusk", "Dusk hills", 0, "The warm landscape over the mantel."),
        i(.painting, "sea", "Seaside", 60, "A little boat on a calm sea."),
        i(.painting, "peaks", "Moonlit peaks", 80, "Snowy mountains under a full moon."),
        i(.painting, "flowers", "Flowers in a vase", 80, "A still life in warm colours."),
        i(.painting, "shapes", "Shapes", 100, "Sun, arch and hill, in blocks of colour."),
        i(.painting, "us", "A portrait of you two", 200, "The two of you, framed over the fire."),

        i(.plant, "monstera", "Big leafy plant", 0, "The one in the corner."),
        i(.plant, "snake", "Snake plant", 40, "Tall striped leaves. Impossible to kill."),
        i(.plant, "fern", "Fern", 60, "Soft, arching fronds."),
        i(.plant, "cactus", "Cactus", 60, "With a little pink flower on top."),
        i(.plant, "lemon", "Lemon tree", 120, "A small tree with real lemons."),
    ]

    public static func item(_ slot: SlotId, _ id: String) -> DecorItem? { items.first { $0.slot == slot && $0.id == id } }
    public static func items(in slot: SlotId) -> [DecorItem] { items.filter { $0.slot == slot } }
    public static func name(_ slot: SlotId) -> String { slots.first { $0.id == slot }!.name }

    /// how you earn stitches
    public static let visit = 10, together = 10, letter = 10
    public static let welcome = 60, welcomePerDay = 10, welcomeMax = 300
    public static func welcomeGift(_ daysTogether: Int) -> Int { min(welcomeMax, welcome + welcomePerDay * daysTogether) }

    public static func announce(_ item: DecorItem, who: String) -> (title: String, description: String) {
        switch item.slot {
        case .wall: return ("New wallpaper", "\(who) put up new wallpaper: \(item.name).")
        case .couch: return ("A new couch", "\(who) got a new couch: \(item.name).")
        case .rug: return ("A new rug", "\(who) put down a new rug: \(item.name).")
        case .pet: return ("Someone new by the fire", "\(who) brought home a \(item.name.lowercased()).")
        case .view: return ("A new view", "\(who) changed the view from the window: \(item.name).")
        case .painting: return ("A new painting", "\(who) hung a new painting over the fire: \(item.name).")
        case .plant: return ("A new plant", "\(who) brought home a new plant: \(item.name).")
        }
    }
}

public struct Purchase: Sendable, Equatable {
    public var by: String
    public var at: Double
    public var price: Int
}

/// the place's meta/decor document
public struct DecorDoc: Sendable, Equatable {
    /// stitches earned, once each: "2026-10-06|visit|<uid>", "2026-10-06|together", "2026-10-06|letter", "welcome"
    public var earned: [String: Int] = [:]
    public var bought: [String: Purchase] = [:]
    public var placed: [String: String] = [:]

    public init() {}

    public init(_ raw: Doc?) {
        let r = raw ?? [:]
        for (k, v) in r.map("earned") { if let n = Values.num(v), !(v is Bool) { earned[k] = Int(n) } }
        for (k, v) in r.map("bought") {
            guard let p = v as? Doc else { continue }
            bought[k] = Purchase(by: p.str("by") ?? "", at: p.num("at") ?? 0, price: p.int("price") ?? 0)
        }
        placed = r.map("placed").compactMapValues { $0 as? String }
    }

    public var balance: Int { earned.values.reduce(0, +) - bought.values.reduce(0) { $0 + $1.price } }
    public func owns(_ i: DecorItem) -> Bool { i.price == 0 || bought[i.key] != nil }

    /// what's out in the room (anything missing, or no longer in the catalogue, is what you started with)
    public var decor: Decor {
        func pick(_ s: SlotId) -> String {
            if let id = placed[s.rawValue], Catalogue.item(s, id) != nil { return id }
            return Catalogue.slots.first { $0.id == s }!.start
        }
        return Decor(wall: pick(.wall), couch: pick(.couch), rug: pick(.rug), pet: pick(.pet), view: pick(.view), painting: pick(.painting), plant: pick(.plant))
    }

    public static func earnVisit(_ day: String, _ uid: String) -> String { "\(day)|visit|\(uid)" }
    public static func earnTogether(_ day: String) -> String { "\(day)|together" }
    public static func earnLetter(_ day: String) -> String { "\(day)|letter" }
    public static let earnWelcome = "welcome"
}

public extension Decor {
    subscript(slot: SlotId) -> String {
        get {
            switch slot {
            case .wall: return wall
            case .couch: return couch
            case .rug: return rug
            case .pet: return pet
            case .view: return view
            case .painting: return painting
            case .plant: return plant
            }
        }
        set {
            switch slot {
            case .wall: wall = newValue
            case .couch: couch = newValue
            case .rug: rug = newValue
            case .pet: pet = newValue
            case .view: view = newValue
            case .painting: painting = newValue
            case .plant: plant = newValue
            }
        }
    }
}
