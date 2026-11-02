import Foundation

/*
 * The questions themselves (src/letters/cards.ts). The decks are written out by scripts/native-decks.mjs
 * from the website's own deck files, so both apps ask the same questions under the same ids.
 */

public struct Card: Sendable, Identifiable, Decodable {
    public let id: String
    public let kind: CardKind
    public let style: CardStyle
    public let prompt: String
    public let options: [String]
    /// also guess what your partner picked
    public let guess: Bool
    /// optional one-line note to your partner
    public let note: Bool
    /// a different label (and length) for the note
    public let noteLabel: String?
    public let noteMax: Int?

    public init(id: String, kind: CardKind, style: CardStyle = .choice, prompt: String, options: [String], guess: Bool = false, note: Bool = false, noteLabel: String? = nil, noteMax: Int? = nil) {
        self.id = id
        self.kind = kind
        self.style = style
        self.prompt = prompt
        self.options = options
        self.guess = guess
        self.note = note
        self.noteLabel = noteLabel
        self.noteMax = noteMax
    }

    /// "Chai or coffee?" reads better than a generic "This or that?" once answered.
    public var title: String {
        options.count == 2 && prompt == "This or that?" ? "\(options[0]) or \(options[1])?" : prompt
    }

    /// cards you can be "in sync" on (everything but answers in your own words)
    public var comparable: Bool { style != .open }
}

extension CardKind: Decodable {}
extension CardStyle: Decodable {}

public struct CardAnswer: Sendable, Equatable {
    /// the option picked (0 on an open card)
    public var pick: Int
    public var guess: Int?
    public var note: String?
    /// an open card's answer, in your own words
    public var text: String?

    public init(pick: Int, guess: Int? = nil, note: String? = nil, text: String? = nil) {
        self.pick = pick
        self.guess = guess
        self.note = note
        self.text = text
    }

    public init?(_ d: Doc) {
        guard let p = d.int("pick") else { return nil }
        pick = p
        guess = d.int("guess")
        note = d.str("note")
        text = d.str("text")
    }

    /// as the website writes it (fields left out rather than null)
    public var doc: Doc {
        var d: Doc = ["pick": pick]
        if let g = guess { d["guess"] = g }
        if let n = note, !n.isEmpty { d["note"] = n }
        if let t = text { d["text"] = t }
        return d
    }

    /// On a "who's more likely" card: true when this answer points at whoever gave it.
    public var likelyIsSelf: Bool { pick == 0 }
}

public enum Cards {
    public struct Chapter: Sendable, Decodable {
        public let title: String
        public let blurb: String
        public let days: Int
    }

    struct File: Decodable {
        let cards: [Card]
        let chapters: [Chapter]
        let journeyDays: Int
    }

    static let file: File = {
        guard let url = Bundle.module.url(forResource: "decks", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let f = try? JSONDecoder().decode(File.self, from: data)
        else {
            print("[soultied] the question decks didn't load")
            return File(cards: [], chapters: [Chapter(title: "", blurb: "", days: 30)], journeyDays: 30)
        }
        return f
    }()

    static let byId: [String: Card] = Dictionary(file.cards.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })

    public static var all: [Card] { file.cards }
    public static var count: Int { file.cards.count }
    public static var chapters: [Chapter] { file.chapters }
    public static var journeyDays: Int { file.journeyDays }

    public static func card(_ id: String) -> Card? { byId[id] }
    public static func of(_ ids: [String]) -> [Card] { ids.compactMap { byId[$0] } }

    /// decks whose size doesn't match DECK_SIZES (which the day's cards are picked from); empty when all's well
    public static func mismatches() -> [String] {
        var n: [CardKind: Int] = [:]
        for c in file.cards { n[c.kind, default: 0] += 1 }
        return DECK_SIZES.compactMap { k, v in n[k] == v ? nil : "\(k.rawValue): \(n[k] ?? 0) cards, expected \(v)" }
    }

    public static func isAnswered(_ card: Card, _ a: CardAnswer?) -> Bool {
        guard let a else { return false }
        if card.style == .open { return !(a.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        if card.guess && a.guess == nil { return false }
        return true
    }

    /// Did you two give the same answer? (Open cards can't match.)
    public static func sameAnswer(_ card: Card, _ a: CardAnswer, _ b: CardAnswer) -> Bool {
        switch card.style {
        case .open: return false
        // "me" from one of you and "you" from the other point at the same person
        case .likely: return a.pick != b.pick
        case .choice: return a.pick == b.pick
        }
    }
}

/* ---------- scoring ---------- */

public struct Score: Sendable, Equatable {
    public var same = 0
    public var total = 0
    public var myGuesses = (right: 0, total: 0)
    public var theirGuesses = (right: 0, total: 0)
    /// the card worth talking about tonight (first one you split on, deepest first)
    public var talkAbout: String?

    public static func == (a: Score, b: Score) -> Bool {
        a.same == b.same && a.total == b.total && a.myGuesses == b.myGuesses && a.theirGuesses == b.theirGuesses && a.talkAbout == b.talkAbout
    }
}

public func scoreDay(_ day: LetterDay, me: String, them: String) -> Score {
    let cards = Cards.of(day.cardIds)
    let mine = day.by[me]?.cards ?? [:]
    let theirs = day.by[them]?.cards ?? [:]
    var s = Score()
    s.total = cards.filter(\.comparable).count
    var splits: [(Int, Card)] = []
    for (i, c) in cards.enumerated() {
        guard let a = mine[c.id], let b = theirs[c.id], c.comparable else { continue }
        if Cards.sameAnswer(c, a, b) { s.same += 1 } else { splits.append((i, c)) }
        if c.guess {
            s.myGuesses.total += 1
            s.theirGuesses.total += 1
            if a.guess == b.pick { s.myGuesses.right += 1 }
            if b.guess == a.pick { s.theirGuesses.right += 1 }
        }
    }
    let depth: [CardKind: Int] = [.journey: -1, .connect: 0, .distance: 0, .open: 0, .spicy: 1, .hot: 1, .know: 2, .likely: 2, .tot: 3]
    // a stable sort, as Array.prototype.sort is
    splits.sort { x, y in
        let dx = depth[x.1.kind]!, dy = depth[y.1.kind]!
        if dx != dy { return dx < dy }
        if x.1.options.count != y.1.options.count { return x.1.options.count > y.1.options.count }
        return x.0 < y.0
    }
    s.talkAbout = splits.first?.1.id
    return s
}
