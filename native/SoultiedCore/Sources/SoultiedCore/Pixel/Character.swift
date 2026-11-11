import Foundation

/*
 * A person, drawn from code: the same as the website's src/pixel/character.ts, so a character made on
 * the iPhone looks exactly like it does on the website (and the other way round).
 */

public struct AvatarConfig: Codable, Hashable, Sendable {
    public var rendererVersion: Int = 2
    public var height: String
    public var skin: String
    public var hairStyle: String
    public var hairColor: String
    public var facialHair: String
    public var top: String
    public var topColor: String
    public var bottom: String
    public var bottomColor: String
    public var shoes: String
    public var shoesColor: String
    public var glasses: String
    public var hat: String
    public var extra: String

    public init(height: String, skin: String, hairStyle: String, hairColor: String, facialHair: String, top: String, topColor: String, bottom: String, bottomColor: String, shoes: String, shoesColor: String, glasses: String, hat: String, extra: String) {
        self.height = height
        self.skin = skin
        self.hairStyle = hairStyle
        self.hairColor = hairColor
        self.facialHair = facialHair
        self.top = top
        self.topColor = topColor
        self.bottom = bottom
        self.bottomColor = bottomColor
        self.shoes = shoes
        self.shoesColor = shoesColor
        self.glasses = glasses
        self.hat = hat
        self.extra = extra
    }
}

public struct Swatch: Sendable {
    public let id: String
    public let name: String
    public let base: RGB
    public let light: RGB
    public let shadow: RGB
    public let blush: RGB

    init(_ id: String, _ name: String, _ base: String, _ light: String, _ shadow: String, _ blush: String = "#000000") {
        self.id = id
        self.name = name
        self.base = RGB(base)
        self.light = RGB(light)
        self.shadow = RGB(shadow)
        self.blush = RGB(blush)
    }
}

public struct Choice: Sendable, Hashable {
    public let id: String
    public let name: String
    init(_ id: String, _ name: String) {
        self.id = id
        self.name = name
    }
}

public enum Wardrobe {
    public static let skinTones: [Swatch] = [
        Swatch("porcelain", "Porcelain", "#f6dcc8", "#fbe9dc", "#dcb49c", "#eaa39a"),
        Swatch("peach", "Peach", "#eec1a0", "#f6d4ba", "#d19c7a", "#d9837a"),
        Swatch("wheat", "Wheat", "#dca77c", "#e8bc95", "#bb865e", "#c86f5f"),
        Swatch("caramel", "Caramel", "#c18559", "#d19a6d", "#9e6641", "#b05a4a"),
        Swatch("chestnut", "Chestnut", "#8f5a3a", "#a46c48", "#704329", "#8e4436"),
        Swatch("espresso", "Espresso", "#5e3a28", "#724833", "#472a1c", "#6e3328"),
    ]

    public static let hairColors: [Swatch] = [
        Swatch("black", "Soft black", "#2c2527", "#463b3c", "#1c1718"),
        Swatch("cocoa", "Cocoa", "#4a3129", "#664439", "#33211c"),
        Swatch("chestnut", "Chestnut", "#6e4131", "#8c5641", "#502e22"),
        Swatch("auburn", "Auburn", "#96482e", "#b65f3d", "#6e3220"),
        Swatch("honey", "Honey", "#c9974f", "#e0b468", "#a0733a"),
        Swatch("ash", "Silver", "#a9a6a4", "#c8c5c1", "#817d7b"),
        Swatch("lilac", "Dusty lilac", "#8f7d98", "#a996b2", "#6d5d76"),
    ]

    public static let clothColors: [Swatch] = [
        Swatch("terracotta", "Terracotta", "#b8674f", "#cf7f64", "#8f4b3a"),
        Swatch("sage", "Sage", "#8a9a72", "#a2b187", "#6a7856"),
        Swatch("cream", "Cream", "#eadcc0", "#f6ecd8", "#c9b894"),
        Swatch("mustard", "Mustard", "#d09a3e", "#e2b359", "#a7772b"),
        Swatch("denim", "Denim", "#4f6583", "#667d9b", "#3a4c65"),
        Swatch("forest", "Forest", "#4d6b52", "#628566", "#38503c"),
        Swatch("plum", "Plum", "#7a5068", "#936580", "#5b3a4e"),
        Swatch("rose", "Dusty rose", "#c98f86", "#dba69d", "#a7706a"),
        Swatch("charcoal", "Charcoal", "#4a4548", "#605a5d", "#343033"),
        Swatch("cocoa", "Cocoa", "#6b4a3c", "#825c4b", "#4f352b"),
        Swatch("lilac", "Lilac", "#9a86b8", "#b19fcc", "#76648f"),
        Swatch("sky", "Sky", "#7d9fc0", "#97b6d3", "#5d7d9c"),
        Swatch("coral", "Coral", "#dd7a62", "#ec947c", "#b35d48"),
    ]

    public static let hairStyles: [Choice] = [
        Choice("tousled", "Tousled"), Choice("crop", "Side part"), Choice("curls", "Curls"), Choice("bob", "Bob"),
        Choice("long", "Long waves"), Choice("bun", "Top bun"), Choice("braid", "Side braid"), Choice("hijab", "Hijab"),
        Choice("buzz", "Buzz"), Choice("bald", "Bald"), Choice("afro", "Big afro"), Choice("pigtails", "Pigtails"),
    ]
    public static let facialHair: [Choice] = [Choice("none", "None"), Choice("stubble", "Stubble"), Choice("mustache", "Mustache"), Choice("beard", "Beard"), Choice("handlebar", "Handlebar")]
    public static let tops: [Choice] = [
        Choice("sweater", "Sweater"), Choice("cardigan", "Cardigan"), Choice("hoodie", "Hoodie"), Choice("shirt", "Shirt"),
        Choice("turtleneck", "Turtleneck"), Choice("tee", "Tee"), Choice("kurta", "Kurta"),
    ]
    public static let bottoms: [Choice] = [
        Choice("trousers", "Trousers"), Choice("jeans", "Jeans"), Choice("joggers", "Joggers"), Choice("pajamas", "Pyjamas"),
        Choice("skirt", "Skirt"), Choice("shorts", "Shorts"),
    ]
    public static let shoes: [Choice] = [Choice("socks", "Cosy socks"), Choice("slippers", "Slippers"), Choice("sneakers", "Sneakers"), Choice("boots", "Boots"), Choice("bunnies", "Bunny slippers")]
    public static let glasses: [Choice] = [
        Choice("none", "None"), Choice("round", "Round"), Choice("square", "Square"), Choice("gold", "Gold wire"),
        Choice("hearts", "Heart specs"), Choice("shades", "Cool shades"), Choice("monocle", "Monocle"),
    ]
    public static let hats: [Choice] = [
        Choice("none", "None"), Choice("beanie", "Beanie"), Choice("cap", "Cap"), Choice("clip", "Hair clip"),
        Choice("party", "Party hat"), Choice("crown", "Crown"), Choice("bunny", "Bunny ears"), Choice("propeller", "Propeller cap"),
        Choice("flowers", "Flower crown"), Choice("frog", "Frog hat"),
    ]
    public static let extras: [Choice] = [
        Choice("none", "None"), Choice("scarf", "Red thread scarf"), Choice("headphones", "Headphones"), Choice("hoops", "Gold hoops"),
        Choice("blanket", "Blanket (sitting)"), Choice("bowtie", "Bow tie"), Choice("nose", "Clown nose"), Choice("freckles", "Freckles"),
        Choice("mug", "Mug of tea"),
    ]

    public static let defaultA = AvatarConfig(
        height: "medium", skin: "wheat", hairStyle: "long", hairColor: "cocoa", facialHair: "none", top: "sweater", topColor: "sage",
        bottom: "trousers", bottomColor: "cream", shoes: "socks", shoesColor: "terracotta", glasses: "none", hat: "none", extra: "hoops"
    )
    public static let defaultB = AvatarConfig(
        height: "tall", skin: "caramel", hairStyle: "tousled", hairColor: "black", facialHair: "none", top: "cardigan", topColor: "terracotta",
        bottom: "jeans", bottomColor: "denim", shoes: "socks", shoesColor: "cream", glasses: "round", hat: "none", extra: "none"
    )

    static func find(_ l: [Swatch], _ id: String) -> Swatch { l.first { $0.id == id } ?? l[0] }

    /// Accept anything that was ever saved and return a valid config (the website's normalizeAvatar).
    public static func normalize(_ raw: Any?, fallback: AvatarConfig = defaultA) -> AvatarConfig {
        guard let r = raw as? [String: Any], (r["rendererVersion"] as? NSNumber)?.intValue == 2 || (r["rendererVersion"] as? Int) == 2 else { return fallback }
        func pick(_ ids: [String], _ v: Any?, _ d: String) -> String {
            if let s = v as? String, ids.contains(s) { return s }
            return d
        }
        let hs = r["height"] as? String
        let style = r["hairStyle"] as? String
        return AvatarConfig(
            height: hs == "short" || hs == "tall" ? hs! : "medium",
            skin: pick(skinTones.map(\.id), r["skin"], fallback.skin),
            hairStyle: pick(hairStyles.map(\.id), r["hairStyle"], fallback.hairStyle),
            hairColor: style == "hijab" ? pick(clothColors.map(\.id), r["hairColor"], "sage") : pick(hairColors.map(\.id), r["hairColor"], fallback.hairColor),
            facialHair: pick(facialHair.map(\.id), r["facialHair"], "none"),
            top: pick(tops.map(\.id), r["top"], fallback.top),
            topColor: pick(clothColors.map(\.id), r["topColor"], fallback.topColor),
            bottom: pick(bottoms.map(\.id), r["bottom"], fallback.bottom),
            bottomColor: pick(clothColors.map(\.id), r["bottomColor"], fallback.bottomColor),
            shoes: pick(shoes.map(\.id), r["shoes"], fallback.shoes),
            shoesColor: pick(clothColors.map(\.id), r["shoesColor"], fallback.shoesColor),
            glasses: pick(glasses.map(\.id), r["glasses"], "none"),
            hat: pick(hats.map(\.id), r["hat"], "none"),
            extra: pick(extras.map(\.id), r["extra"], "none")
        )
    }

    /// what's saved in the database (the website reads the same shape)
    public static func dictionary(_ a: AvatarConfig) -> [String: Any] {
        [
            "rendererVersion": 2, "height": a.height, "skin": a.skin, "hairStyle": a.hairStyle, "hairColor": a.hairColor,
            "facialHair": a.facialHair, "top": a.top, "topColor": a.topColor, "bottom": a.bottom, "bottomColor": a.bottomColor,
            "shoes": a.shoes, "shoesColor": a.shoesColor, "glasses": a.glasses, "hat": a.hat, "extra": a.extra,
        ]
    }

    public static func random() -> AvatarConfig {
        func any(_ l: [Choice]) -> String { l.randomElement()!.id }
        func anyS(_ l: [Swatch]) -> String { l.randomElement()!.id }
        // (the sillier pieces are there to pick, not to be handed at random)
        let hairStyle = any(Array(hairStyles.prefix(10)))
        return AvatarConfig(
            height: ["short", "medium", "tall"].randomElement()!,
            skin: anyS(skinTones),
            hairStyle: hairStyle,
            hairColor: hairStyle == "hijab" ? anyS(clothColors) : anyS(Array(hairColors.prefix(6))),
            facialHair: Double.random(in: 0..<1) < 0.3 ? any(Array(facialHair.prefix(4))) : "none",
            top: any(tops),
            topColor: anyS(clothColors),
            bottom: any(bottoms),
            bottomColor: anyS(clothColors),
            shoes: any(Array(shoes.prefix(4))),
            shoesColor: anyS(clothColors),
            glasses: Double.random(in: 0..<1) < 0.35 ? any(Array(glasses[1..<4])) : "none",
            hat: Double.random(in: 0..<1) < 0.2 && hairStyle != "hijab" ? any(Array(hats[1..<4])) : "none",
            extra: Double.random(in: 0..<1) < 0.4 ? any(Array(extras[1..<4])) : "none"
        )
    }
}

/* ------------------------------------------------------------------------------------------------ */
/*  Sprite parts. Coordinates are relative to the 24 x 48 character canvas. Head occupies x 6..17.     */
/*    s skin  l skin light  d skin shadow  b blush  e eye  m mouth                                     */
/*    h hair  H hair light  j hair shadow                                                              */
/*    c cloth C cloth light k cloth shadow  i inner/trim  I inner shadow                               */
/* ------------------------------------------------------------------------------------------------ */

private let HEAD = [
    "..ssssssss..",
    ".ssssssssss.",
    "slsssssssssd",
    "slsssssssssd",
    "ssssssssssss",
    "sssesssseddd",
    "sssesssseddd",
    "ssbssssssbsd",
    "sssssmmssssd",
    ".dssssssssd.",
    "..dddddddd..",
]
private let EYE_L = 3
private let EYE_R = 8

/// front hair: 14 wide, a pixel left of the head, `top` rows above it (`dx` moves a wider one left)
private let HAIR_FRONT: [String: (top: Int, rows: [String], dx: Int)] = [
    "afro": (6, [
        "....hhhhhhhhhh....",
        "..hhhHhhhHhhhhhh..",
        ".hhHhhHhhhhhHhhhh.",
        ".hHhhhhhhhhhhhhhh.",
        "hhhhhHhhhhhHhhhhhh",
        "hHhhhhhhhhhhhhhhjh",
        "hhhhhhhhhhhhhhhhjh",
        "hhhhhjhhhhhhjhhhjh",
        "hhhj..........jhhh",
        "hhh............hhh",
        "hhh............hhh",
        "hhj............jhh",
        "hj..............jh",
        ".h..............h.",
    ], -2),
    "pigtails": (2, [
        "...hhhhhhhh...",
        "..hHHHhhhhhh..",
        ".hHHhhhhhhhhh.",
        "hHHhhhhhhhhhhh",
        "hHhhhhhhhhhhhh",
        "hhhjjjjjjjjhhh",
        "hhj........jhh",
        "hj..........jh",
    ], 0),
    "tousled": (3, [
        "....hhh.hh....",
        "..hhHHhhHhhh..",
        ".hhHHhhhhHhhh.",
        ".hHHhhhhhhhhhh",
        "hhHhhhhhhhhhhh",
        "hhhhjhhhhjhhhh",
        "hhj..jhhj..jhh",
        "hh.........jhh",
        "hj...........h",
    ], 0),
    "crop": (2, [
        "...hhhhhhhh...",
        "..hHHHHhhhhh..",
        ".hHHhhhhhhhhh.",
        "hhHhhhhhhhhhhh",
        "hhhhhhhhjjjhhh",
        "hhhhhjj....jhh",
        "hj.........jhh",
        "h............h",
    ], 0),
    "curls": (4, [
        "...hH.hHh.Hh..",
        "..hHhhHhhhhHh.",
        ".hHhhjhHhhjhhh",
        "hHhjhhhhhjhhhH",
        "hhhhhHhhhhHhjh",
        "hjhHhhjhHhhhhh",
        "hhhhjhhhhjhhjh",
        "hhj.hh.jh.hhhh",
        "hh..........hh",
        "hj..........jh",
        "h............h",
    ], 0),
    "bob": (2, [
        "...hhhhhhhh...",
        "..hHHHhhhhhh..",
        ".hHHhhhhhhhhh.",
        "hHHhhhhhhhhhhh",
        "hHhhhhhhhhhhhh",
        "hhhjjjjjjjjhhh",
        "hhh........hhh",
        "hhh........hhh",
        "hhh........hhh",
        "hhj........jhh",
        "hhj........jhh",
        "hj..........jh",
    ], 0),
    "long": (2, [
        "...hhhhhhhh...",
        "..hHHHhhhhhh..",
        ".hHHhhhhhjhhh.",
        "hHHhhhhhjhhhhh",
        "hHhhhhhjhhhhhh",
        "hhhhhhj..jhhhh",
        "hhhhj......hhh",
        "hhh........hhh",
        "hhh........jhh",
        "hhj........jhh",
        "hhj........jhh",
        "hj..........jh",
    ], 0),
    "bun": (7, [
        ".....hhhh.....",
        "....hHHhhh....",
        "....hHhhhh....",
        ".....hhhj.....",
        "...hhhjjhhh...",
        "..hHHhhhhhhh..",
        ".hHHhhhhhhhhh.",
        "hHHhhhhhhhhhhh",
        "hHhhhhhhhhhhhh",
        "hhhhjj..jjhhhh",
        "hhj........jhh",
        "hj..........jh",
    ], 0),
    "braid": (2, [
        "...hhhhhhhh...",
        "..hHHHhhhhhh..",
        ".hHHhhhhhhhhh.",
        "hHHhhhhhhhhhhh",
        "hHhhhhhhhhhhhh",
        "hhhjjjj..jjhhh",
        "hhj........hhh",
        "hh.........hhh",
        "h..........jhh",
        "...........hhj",
        "...........jhh",
        "...........hhj",
    ], 0),
    "hijab": (3, [
        "....hhhhhh....",
        "..hhHHHhhhhh..",
        ".hHHhhhhhhhhh.",
        "hHhhhhhhhhhhhj",
        "hHhhhhhhhhhhhj",
        "hHhjjjjjjjjhhj",
        "hHj........jhj",
        "hHj........jhj",
        "hhj........jhj",
        "hhj........jhj",
        "hhhj......jhhj",
        "hHhhj....jhhhj",
        "hHhhhhhhhhhhhj",
        "jhhhhhHHhhhhjj",
    ], 0),
    "buzz": (1, [
        "..jjjjjjjjjj..",
        ".jhjhjhjhjhjj.",
        ".jjhjhjhjhjhj.",
        ".j..........j.",
    ], 0),
    "bald": (0, [], 0),
]

/// back hair, behind the head and body (same origin as the front; `dx` moves a wider one left)
private let HAIR_BACK: [String: (from: Int, rows: [String], dx: Int)] = [
    // two bunches, tied with red bands, sticking out either side
    "pigtails": (6, [
        ".jh............hj.",
        "hhhr..........rhhh",
        "hHhh..........hhHh",
        "hHhh..........hhHh",
        "hhhj..........jhhh",
        ".hj............jh.",
        ".j..............j.",
    ], -2),
    "long": (9, [
        "jhh........hhj",
        "jhh........hhj",
        "jhhh......hhhj",
        "jhhh......hhhj",
        "jhhh......hhhj",
        "jhhj......jhhj",
        ".hhj......jhh.",
        ".jh........hj.",
        "..j........j..",
    ], 0),
    "bob": (10, ["jhh........hhj", "jhhj......jhhj", ".jj........jj."], 0),
    "hijab": (12, [
        "jhhhhhhhhhhhhj",
        "jhhhhhhhhhhhhj",
        "jhhhhhhhhhhhhj",
        ".jhhhhhhhhhhj.",
        "..jjhhhhhhjj..",
    ], 0),
    "braid": (11, ["...........hhj", "...........jhh", "...........hhj", "...........jhh", "...........hjj", "...........Hh."], 0),
    "curls": (10, ["hj..........jh", "hh..........hh", ".j..........j."], 0),
]

private let TOPS_ART: [String: [String]] = [
    "sweater": [
        ".....dd.....",
        "...kkkkkk...",
        ".ccccCCcccc.",
        "cCcccccccckc",
        "cCkcccccckkc",
        "cCkcccccckkc",
        "cCkcccccckkc",
        "cCkcccccckkc",
        "kkkkkkkkkkkk",
    ],
    "cardigan": [
        ".....dd.....",
        "...ciiiic...",
        ".cccciiiccc.",
        "cCcckiiikckc",
        "cCckciiickkc",
        "cCckcIiickkc",
        "cCckciiickkc",
        "cCckciiickkc",
        "kkkkkiiikkkk",
    ],
    "hoodie": [
        "..kccddcck..",
        ".kcCkkkkCck.",
        ".ccciccicccc",
        "cCccicciccKc",
        "cCkcccccckkc",
        "cCkkkkkkkkkc",
        "cCkcccccckkc",
        "cCkcccccckkc",
        "kkkkkkkkkkkk",
    ],
    "shirt": [
        ".....dd.....",
        "...cckkcc...",
        ".ccCckkcCcc.",
        "cCcccikcccKc",
        "cCkccikcckkc",
        "cCkccikcckkc",
        "cCkccikcckkc",
        "cCkccikcckkc",
        "kkkkkikkkkkk",
    ],
    "turtleneck": [
        "....kCCk....",
        "....kkkk....",
        ".ccccCCcccc.",
        "cCcccccccckc",
        "cCkcccccckkc",
        "cCkcccccckkc",
        "cCkcccccckkc",
        "cCkcccccckkc",
        "kCkccccccckk",
    ],
    "tee": [
        ".....dd.....",
        "...kkddkk...",
        ".cccckkcccc.",
        "cCcccccccckc",
        "sscccccccccd",
        "slkcccccckdd",
        "slkcccccckdd",
        "slkcccccckdd",
        "sdkkkkkkkkdd",
    ],
    "kurta": [
        ".....dd.....",
        "...ckkkkc...",
        ".cccCkiccccc",
        "cCcccikccckc",
        "cCkccikcckkc",
        "cCkccikcckkc",
        "cCkcccccckkc",
        "cCkcccccckkc",
        "cCkcccccckkc",
    ],
]

private let GLASSES_ART: [String: (rows: [String], y: Int)] = [
    "round": (["..ggg..ggg..", ".gw..fgw...g", ".g...f.....g", "..fff..fff.."], 4),
    "square": ([".gggggggggg.", ".gw..ggw..g.", ".f...f.f..f.", ".fffff.ffff."], 4),
    "gold": (["..GGG..GGG..", ".Gw..GGw..G.", ".G...G.G..G.", "..GGG..GGG.."], 4),
    "hearts": (["..r.r..r.r..", ".rrRrrrrRrr.", "..rrr..rrr..", "...r....r..."], 4),
    "shades": ([".gggggggggg.", ".gwkkggwkkg.", "..kkk..kkk.."], 4),
    "monocle": ([".......GGG..", "......G...G.", "......G...G.", ".......GGGG.", "..........G.", "..........G."], 4),
]

private let HAT_ART: [String: (rows: [String], top: Int, pal: Palette?)] = [
    "beanie": ([
        ".....tTt......",
        "....tttttt....",
        "..tTTtttttt...",
        ".tTTttttttttt.",
        "tTtttttttttttt",
        "rRrRrRrRrRrRrR",
        "rrrrrrrrrrrrrr",
    ], 5, nil),
    "cap": ([
        "....tTTttt....",
        "..tTTtttttttt.",
        ".tTttttttttttt",
        "tTttttttttttttr",
        "rrrrrrrrrrrrrrrrr",
    ], 3, nil),
    "clip": (["..........yY..", "..........Yy.."], 0, nil),
    "party": ([
        "......yy......", "......Yy......", "......bb......", ".....baab.....", ".....aabb.....", "....abbaab....", "....bbaabb....", "...baabbaab...",
    ], 9, ["a": RGB("#c4453f"), "b": RGB("#f3e7cf"), "y": RGB("#e2b359"), "Y": RGB("#f6d77a")]),
    "crown": ([
        "..Y...YY...Y..", "..yY.yYYy.Yy..", "..yyyyyyyyyy..", "..yryybbyyry..", "..zzzzzzzzzz..",
    ], 5, ["y": RGB("#e2b359"), "Y": RGB("#f6d77a"), "z": RGB("#b0842f"), "r": RGB("#c4453f"), "b": RGB("#5d7fb3")]),
    "bunny": ([
        "...ww....ww...", "..wppw..wppw..", "..wppw..wppw..", "..wppw..wppw..", "...ww....ww...", "...ww....ww...", "..bbbbbbbbbb..",
    ], 8, ["w": RGB("#f3ece0"), "p": RGB("#e8a9b0"), "b": RGB("#d98c8c")]),
    "propeller": ([
        "..rrrr..bbbb..", "......yy......", ".....rygb.....", "....rrygbb....", "...rrrygbbb...", "..rrrrygbbbb..", ".YYYYYYYYYYYY.",
    ], 8, ["r": RGB("#c4453f"), "b": RGB("#4f6fa8"), "y": RGB("#e2b359"), "Y": RGB("#f6d77a"), "g": RGB("#6a8f5a")]),
    "flowers": ([
        "..p...y...w...", ".pPpgyoygwywg.", "g.p.g.y.g.w.g.",
    ], 3, ["p": RGB("#e8a9b0"), "P": RGB("#f6cfd3"), "y": RGB("#f0c860"), "w": RGB("#fbf5e9"), "g": RGB("#6a8f5a"), "o": RGB("#e07a5f")]),
    "frog": ([
        "..www....www..", "..wkw....wkw..", "..gGgggggggg..", ".gGggggggggdg.", "gGgmgggggmggdg", "gggmmmmmmmggdg", "GGGGGGGGGGGGGG", "dddddddddddddd",
    ], 7, ["w": RGB("#fbf5e9"), "k": RGB("#1f1a1c"), "g": RGB("#6a9a4f"), "G": RGB("#8bbf68"), "d": RGB("#4a7236"), "m": RGB("#2f4a24")]),
]

public enum Pose: Sendable { case stand, sit }

public struct CharacterFrame: Hashable, Sendable {
    public var blink = false
    /// 0 or 1 px breathing offset (upper body)
    public var bob = 0
    /// eyes closed
    public var sleepy = false
    public init(blink: Bool = false, bob: Int = 0, sleepy: Bool = false) {
        self.blink = blink
        self.bob = bob
        self.sleepy = sleepy
    }
}

public let CHAR_W = 24
public let CHAR_H = 48

public struct RenderedCharacter {
    public let buf: PixelBuffer
    /// in the 24x48 buffer: centre-bottom of the feet (stand) or the seat (sit)
    public let anchor: (x: Int, y: Int)
    public let headTop: Int
}

private let INK_EYE = RGB("#2a1e22")

/// Render a character into a fresh 24x48 buffer (the website's renderCharacter).
public func renderCharacter(_ cfg: AvatarConfig, _ pose: Pose, _ frame: CharacterFrame = CharacterFrame()) -> RenderedCharacter {
    let buf = PixelBuffer(CHAR_W, CHAR_H)
    let skin = Wardrobe.find(Wardrobe.skinTones, cfg.skin)
    let hair = cfg.hairStyle == "hijab"
        ? (Wardrobe.clothColors.first { $0.id == cfg.hairColor } ?? Wardrobe.clothColors[1])
        : Wardrobe.find(Wardrobe.hairColors, cfg.hairColor)
    let top = Wardrobe.find(Wardrobe.clothColors, cfg.topColor)
    let bot = Wardrobe.find(Wardrobe.clothColors, cfg.bottomColor)
    let shoe = Wardrobe.find(Wardrobe.clothColors, cfg.shoesColor)

    let legLen = pose == .sit ? 6 : cfg.height == "short" ? 9 : cfg.height == "tall" ? 13 : 11
    let bob = frame.bob

    // vertical layout, bottom-up so feet/seat stay fixed
    let feetY = CHAR_H - 2
    let shoeTop = feetY - 1
    let legTop = shoeTop - legLen
    let lapTop = pose == .sit ? legTop - 3 : legTop
    let torsoTop = (pose == .sit ? lapTop - 8 : legTop - 8) + bob
    let headTop = torsoTop - 10

    let skinPal: Palette = ["s": skin.base, "l": skin.light, "d": skin.shadow, "b": skin.blush, "e": INK_EYE, "m": mix(skin.shadow, RGB("#6a3030"), 0.45)]
    let hairPal: Palette = ["h": hair.base, "H": hair.light, "j": hair.shadow, "r": RGB("#c4453f")]
    func clothPal(_ sw: Swatch, _ inner: RGB, _ innerShadow: RGB) -> Palette {
        ["c": sw.base, "C": sw.light, "k": sw.shadow, "K": sw.shadow, "i": inner, "I": innerShadow, "s": skin.base, "l": skin.light, "d": skin.shadow]
    }

    let hf = HAIR_FRONT[cfg.hairStyle] ?? HAIR_FRONT["bald"]!
    let hairX = 5
    let hairY = headTop - hf.top

    // 1. back hair
    if let hb = HAIR_BACK[cfg.hairStyle] { buf.sprite(hb.rows, hairPal, hairX + hb.dx, hairY + hb.from) }

    // 2. legs / bottoms
    drawBottoms(buf, cfg, pose, lapTop: lapTop, legTop: legTop, legLen: legLen, sw: bot, skin: skin)

    // 3. shoes
    drawShoes(buf, cfg.shoes, shoe, shoeTop)

    // 4. torso
    let tArt = TOPS_ART[cfg.top] ?? TOPS_ART["sweater"]!
    var tPal = clothPal(top, cfg.top == "cardigan" ? RGB("#efe3cb") : top.light, RGB("#d3c3a3"))
    if cfg.top == "hoodie" { tPal["i"] = RGB("#efe3cb") }
    buf.sprite(tArt, tPal, 6, torsoTop)
    if cfg.top == "kurta" {
        // long hem over the thighs
        let hemRows = pose == .sit ? 3 : 5
        for r in 0..<hemRows {
            let y = torsoTop + 9 + r
            let w = pose == .sit ? 12 : 10 + min(r, 2)
            let x0 = 12 - w / 2
            buf.rect(x0, y, w, 1, r == hemRows - 1 ? top.shadow : top.base)
            buf.set(x0, y, top.shadow)
            if r < hemRows - 1 { buf.set(x0 + w - 1, y, top.shadow) }
        }
    }

    // 5. hands
    let handY = torsoTop + 8
    if pose == .stand {
        buf.rect(6, handY + 1, 2, 2, skin.base)
        buf.set(6, handY + 2, skin.shadow)
        buf.rect(16, handY + 1, 2, 2, skin.base)
        buf.set(17, handY + 2, skin.shadow)
    } else {
        buf.rect(7, lapTop, 3, 2, skin.base)
        buf.set(7, lapTop + 1, skin.shadow)
        buf.rect(14, lapTop, 3, 2, skin.base)
        buf.set(16, lapTop + 1, skin.shadow)
    }

    // 6. head, with the eyes patched in so shading never hides them
    buf.sprite(HEAD, skinPal, 6, headTop)
    let eyeY = headTop + 5
    let closed = frame.blink || frame.sleepy
    for ex in [EYE_L, EYE_R] {
        if closed {
            buf.set(6 + ex, eyeY, ex == EYE_R ? skin.shadow : skin.base)
            buf.set(6 + ex, eyeY + 1, INK_EYE)
        } else {
            buf.set(6 + ex, eyeY, INK_EYE)
            buf.set(6 + ex, eyeY + 1, INK_EYE)
        }
    }
    buf.set(6 + 2, headTop + 7, skin.blush)
    buf.set(6 + 9, headTop + 7, skin.blush)

    drawFacialHair(buf, cfg.facialHair, hair, skin, headTop)

    // 7. front hair
    if !hf.rows.isEmpty { buf.sprite(hf.rows, hairPal, hairX + hf.dx, hairY) }

    // 8. glasses
    if let gl = GLASSES_ART[cfg.glasses] {
        let pal: Palette = ["g": RGB("#3a2a26"), "f": mix(RGB("#3a2a26"), skin.shadow, 0.55), "G": RGB("#c9a24e"), "w": RGB("#fbf3e4"), "r": RGB("#d9475b"), "R": RGB("#f08a96"), "k": RGB("#1f1a1c")]
        buf.sprite(gl.rows, pal, 6, headTop + gl.y)
        buf.set(6 + EYE_L, eyeY, closed ? skin.base : INK_EYE)
        buf.set(6 + EYE_R, eyeY, closed ? skin.base : INK_EYE)
    }

    // 9. hats
    if let hat = HAT_ART[cfg.hat] {
        let hatSw = cfg.hat == "cap" ? top : Wardrobe.clothColors.first { $0.id == (cfg.topColor == "mustard" ? "terracotta" : "mustard") }!
        let pal: Palette = hat.pal ?? ["t": hatSw.base, "T": hatSw.light, "r": hatSw.shadow, "R": hatSw.base, "y": RGB("#d9a441"), "Y": RGB("#f0c860")]
        buf.sprite(hat.rows, pal, cfg.hat == "clip" ? 5 : cfg.hat == "cap" ? 4 : 5, cfg.hat == "clip" ? headTop + 1 : headTop - hat.top)
    }

    // 10. extras
    if cfg.extra == "scarf" {
        let r = RGB("#a84f4b"), R = RGB("#c4625b"), k = RGB("#7f3835")
        buf.rect(8, torsoTop + 1, 8, 2, r)
        buf.hline(8, torsoTop + 1, 8, R)
        buf.rect(13, torsoTop + 3, 2, pose == .sit ? 4 : 6, r)
        buf.vline(14, torsoTop + 3, pose == .sit ? 4 : 6, k)
        buf.hline(13, torsoTop + (pose == .sit ? 7 : 9), 2, k)
    } else if cfg.extra == "headphones" {
        let k = RGB("#3b3437"), K = RGB("#5a5155")
        buf.rect(7, torsoTop + 1, 10, 1, k)
        buf.rect(6, torsoTop, 2, 3, K)
        buf.rect(16, torsoTop, 2, 3, K)
        buf.set(6, torsoTop + 2, k)
        buf.set(17, torsoTop + 2, k)
    } else if cfg.extra == "hoops" && cfg.hairStyle != "hijab" {
        buf.set(5, headTop + 7, RGB("#e2b555"))
        buf.set(5, headTop + 8, RGB("#b88a30"))
        buf.set(18, headTop + 7, RGB("#e2b555"))
        buf.set(18, headTop + 8, RGB("#b88a30"))
    } else if cfg.extra == "bowtie" {
        let r = RGB("#a84f4b"), R = RGB("#c4625b"), k = RGB("#7f3835")
        let bow: [(Int, Int, RGB)] = [
            (9, 1, R), (10, 1, r), (13, 1, r), (14, 1, R),
            (9, 2, r), (10, 2, r), (11, 2, k), (12, 2, k), (13, 2, r), (14, 2, r),
            (9, 3, R), (10, 3, r), (13, 3, r), (14, 3, R),
        ]
        for (x, y, c) in bow { buf.set(x, torsoTop + y, c) }
    } else if cfg.extra == "nose" {
        buf.rect(11, headTop + 6, 2, 2, RGB("#d33a3a"))
        buf.set(11, headTop + 6, RGB("#f08a80"))
        buf.set(12, headTop + 7, RGB("#a82a2a"))
    } else if cfg.extra == "freckles" {
        let f = mix(skin.shadow, RGB("#7a4a32"), 0.5)
        for (x, y) in [(7, 7), (9, 8), (8, 9), (16, 7), (14, 8), (15, 9)] { buf.set(x, headTop + y, f) }
    } else if cfg.extra == "mug" {
        // a mug of tea in your hand (on your lap, sitting)
        let mx = pose == .sit ? 14 : 17
        let my = pose == .sit ? lapTop - 4 : handY - 1
        buf.rect(mx, my, 4, 4, RGB("#f3e7cf"))
        buf.hline(mx, my, 4, RGB("#7a4a32"))
        buf.hline(mx, my + 3, 4, RGB("#d3c3a3"))
        buf.rect(mx + 1, my + 1, 2, 2, RGB("#b8674f"))
        buf.set(mx + 4, my + 1, RGB("#d3c3a3"))
        buf.set(mx + 4, my + 2, RGB("#d3c3a3"))
        buf.set(mx + 1, my - 2, RGB("#e9e0d0"))
        buf.set(mx + 2, my - 3, RGB("#e9e0d0"))
    }

    buf.outline(darken: 0.38)

    // the blanket goes over the outline so it reads as a separate object
    if cfg.extra == "blanket" && pose == .sit {
        let a = RGB("#d9a441"), b = RGB("#efdcb8"), e = RGB("#8f6424")
        for y in (lapTop - 1)..<(lapTop + 6) {
            for x in 4..<20 {
                let edge = x == 4 || x == 19 || y == lapTop + 5
                let check = ((x >> 1) + (y >> 1)) % 2 == 0
                buf.set(x, y, edge ? e : check ? a : b)
            }
        }
    }

    return RenderedCharacter(buf: buf, anchor: pose == .sit ? (12, lapTop + 1) : (12, feetY), headTop: headTop)
}

private func drawBottoms(_ buf: PixelBuffer, _ cfg: AvatarConfig, _ pose: Pose, lapTop: Int, legTop: Int, legLen: Int, sw: Swatch, skin: Swatch) {
    let style = cfg.bottom
    let base = sw.base, light = sw.light, shadow = sw.shadow
    let denimSeam = mix(sw.light, RGB("#e8d6a8"), 0.4)
    let pj = mix(base, RGB("#f3e7cf"), 0.55)

    func legPixel(_ x: Int, _ isLeft: Bool, _ row: Int) -> RGB {
        var c = base
        if isLeft ? x == 8 : x == 13 { c = light }
        if isLeft ? x == 10 : x == 15 { c = shadow }
        if style == "pajamas" && (x + row) % 3 == 0 && row % 2 == 0 { c = pj }
        return c
    }

    if pose == .stand {
        // hips
        for r in 0..<2 { for x in 8...15 { buf.set(x, legTop + r, x == 8 ? light : x == 15 ? shadow : base) } }
        if style == "jeans" {
            buf.set(9, legTop, denimSeam)
            buf.set(14, legTop, denimSeam)
        }
        if style == "skirt" {
            let len = min(legLen, 8)
            for r in 0..<len {
                let spread = Int((Double(r) / 2.5).rounded(.down))
                let x0 = 8 - spread
                let x1 = 15 + spread
                for x in x0...x1 {
                    var c = base
                    if x == x0 { c = light }
                    if x == x1 { c = shadow }
                    if r > 2 && (x - x0) % 3 == 2 { c = shadow }
                    buf.set(x, legTop + r, r == len - 1 ? shadow : c)
                }
            }
            if len < legLen {
                for r in len..<legLen {
                    buf.rect(9, legTop + r, 2, 1, skin.base)
                    buf.rect(13, legTop + r, 2, 1, skin.base)
                    buf.set(10, legTop + r, skin.shadow)
                }
            }
            return
        }
        let pantsRows = style == "shorts" ? 5 : legLen
        if legLen > 2 {
            for r in 2..<legLen {
                let y = legTop + r
                if r < pantsRows {
                    for x in 8...10 { buf.set(x, y, legPixel(x, true, r)) }
                    for x in 13...15 { buf.set(x, y, legPixel(x, false, r)) }
                    if style == "joggers" && r == legLen - 1 {
                        buf.hline(8, y, 3, shadow)
                        buf.hline(13, y, 3, shadow)
                    }
                } else {
                    buf.rect(9, y, 2, 1, skin.base)
                    buf.set(10, y, skin.shadow)
                    buf.rect(13, y, 2, 1, skin.base)
                }
            }
        }
        if pantsRows > 2 {
            // gap between legs, top of it is a crotch shadow
            buf.set(11, legTop + 2, shadow)
            buf.set(12, legTop + 2, shadow)
        }
    } else {
        // sitting: lap block (thighs toward viewer) then hanging shins
        let lapW = 12
        let mid = mix(base, shadow, 0.5)
        for r in 0..<3 {
            for x in 6..<(6 + lapW) {
                var c = r == 2 ? shadow : base
                if r == 0 { c = light }
                if x == 11 || x == 12 { c = r == 2 ? shadow : mid }
                if style == "skirt" { c = r == 2 ? shadow : r == 0 ? light : base }
                if style == "pajamas" && (x + r) % 3 == 0 { c = pj }
                buf.set(x, lapTop + r, c)
            }
        }
        let coverRows = style == "skirt" ? 2 : style == "shorts" ? 0 : legLen
        for r in 0..<legLen {
            let y = legTop + r
            if r < coverRows {
                if style == "skirt" {
                    buf.rect(6, y, 12, 1, r == coverRows - 1 ? shadow : base)
                    continue
                }
                for x in 8...10 { buf.set(x, y, legPixel(x, true, r)) }
                for x in 13...15 { buf.set(x, y, legPixel(x, false, r)) }
                if style == "joggers" && r == legLen - 1 {
                    buf.hline(8, y, 3, shadow)
                    buf.hline(13, y, 3, shadow)
                }
            } else {
                buf.rect(9, y, 2, 1, skin.base)
                buf.set(10, y, skin.shadow)
                buf.rect(13, y, 2, 1, skin.base)
                buf.set(14, y, skin.shadow)
            }
        }
    }
}

private func drawShoes(_ buf: PixelBuffer, _ style: String, _ sw: Swatch, _ y: Int) {
    if style == "socks" {
        for x0 in [8, 13] {
            buf.rect(x0, y - 1, 3, 1, sw.light)
            buf.rect(x0, y, 3, 2, sw.base)
            buf.set(x0 + (x0 == 8 ? -1 : 3), y + 1, sw.base)
            buf.hline(x0, y + 1, 3, sw.shadow)
        }
        return
    }
    if style == "slippers" {
        for x0 in [7, 13] {
            buf.rect(x0, y, 4, 2, sw.base)
            buf.hline(x0, y, 4, RGB("#f4ead6"))
            buf.set(x0 + 1, y, RGB("#fbf5e9"))
            buf.hline(x0, y + 1, 4, sw.shadow)
        }
        return
    }
    if style == "bunnies" {
        // fluffy white bunnies, ears up
        for x0 in [7, 13] {
            buf.rect(x0, y, 4, 2, RGB("#f3ece0"))
            buf.hline(x0, y + 1, 4, RGB("#cfc6b8"))
            buf.set(x0 + 1, y - 1, RGB("#f3ece0"))
            buf.set(x0 + 2, y - 1, RGB("#e8a9b0"))
            buf.set(x0 == 7 ? x0 : x0 + 3, y, RGB("#e8a9b0"))
            buf.set(x0 == 7 ? x0 + 1 : x0 + 2, y, RGB("#3a2a26"))
        }
        return
    }
    if style == "boots" {
        for x0 in [7, 13] {
            buf.rect(x0 + 1, y - 2, 3, 2, RGB("#6a4430"))
            buf.rect(x0, y, 4, 1, RGB("#7d5238"))
            buf.hline(x0, y + 1, 4, RGB("#3a261c"))
            buf.set(x0 + 1, y - 2, RGB("#8a5d40"))
        }
        return
    }
    // sneakers
    for x0 in [7, 13] {
        buf.rect(x0, y, 4, 1, RGB("#f1e8d8"))
        buf.set(x0 == 7 ? x0 + 2 : x0 + 1, y, sw.base)
        buf.hline(x0, y + 1, 4, RGB("#a39888"))
    }
}

private func drawFacialHair(_ buf: PixelBuffer, _ style: String, _ hair: Swatch, _ skin: Swatch, _ headTop: Int) {
    let X = 6
    if style == "stubble" {
        let c = mix(skin.shadow, hair.base, 0.18)
        for (x, y) in [(2, 9), (4, 10), (7, 10), (9, 9), (5, 10), (6, 10), (3, 9), (8, 9)] { buf.set(X + x, headTop + y, c) }
    } else if style == "mustache" {
        buf.rect(X + 4, headTop + 7, 4, 1, hair.base)
        buf.set(X + 3, headTop + 8, hair.shadow)
        buf.set(X + 8, headTop + 8, hair.shadow)
    } else if style == "handlebar" {
        // a big one, curled up at the ends
        buf.rect(X + 3, headTop + 7, 6, 1, hair.base)
        buf.set(X + 5, headTop + 7, hair.light)
        buf.set(X + 2, headTop + 7, hair.shadow)
        buf.set(X + 9, headTop + 7, hair.shadow)
        buf.set(X + 1, headTop + 6, hair.base)
        buf.set(X + 10, headTop + 6, hair.base)
    } else if style == "beard" {
        for y in 7...11 {
            for x in 0..<12 {
                let inFace: Bool
                switch y {
                case 7: inFace = x <= 1 || x >= 10
                case 8: inFace = x <= 3 || x >= 8
                case 11: inFace = x >= 3 && x <= 8
                default: inFace = true
                }
                if !inFace { continue }
                if y == 9 && x >= 5 && x <= 6 { continue }
                if y == 10 && (x == 0 || x == 11) { continue }
                if y == 9 && (x == 0 || x == 11) { continue }
                buf.set(X + x, headTop + y, (x + y) % 4 == 0 ? hair.light : hair.base)
            }
        }
        buf.rect(X + 4, headTop + 7, 4, 1, hair.base)
        buf.rect(X + 5, headTop + 9, 2, 1, mix(skin.shadow, RGB("#5a2626"), 0.4))
    }
}
