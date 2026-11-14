import Foundation

/*
 * Our list (src/together/bucket.ts): the things you want to do together, some day or the next time you're
 * together. Kept in the place's meta/bucket document, by item: what it is, who added it and when, whether it's
 * for next time, and when it was done (and who ticked it off). Either of you can add, star, tick or take off.
 */

public let BUCKET_TEXT_MAX = 80
/// how many things the list keeps (the oldest done ones go first)
public let BUCKET_MAX = 200

public struct BucketItem: Sendable, Equatable, Identifiable {
    public var id: String
    public var text: String
    public var by: String
    public var at: Double
    /// for the next time you're together
    public var next: Bool
    /// when it was done (ms), or 0
    public var done: Double
    public var doneBy: String

    public init(id: String, text: String, by: String = "", at: Double = 0, next: Bool = false, done: Double = 0, doneBy: String = "") {
        self.id = id
        self.text = text
        self.by = by
        self.at = at
        self.next = next
        self.done = done
        self.doneBy = doneBy
    }

    public var doc: Doc { ["text": text, "by": by, "at": at, "next": next, "done": done, "doneBy": doneBy] }
}

/// JavaScript's \s (and what its trim() takes off)
private func jsSpace(_ s: Unicode.Scalar) -> Bool {
    switch s.value {
    case 0x09...0x0D, 0x20, 0xA0, 0x1680, 0x2000...0x200A, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF: return true
    default: return false
    }
}

/// what's typed: one line, trimmed, no longer than it should be
public func cleanText(_ s: String) -> String {
    var out = String.UnicodeScalarView()
    var space = false
    for sc in s.unicodeScalars {
        if jsSpace(sc) { space = true; continue }
        if space && !out.isEmpty { out.append(" ") }
        space = false
        out.append(sc)
    }
    var cut = String.UnicodeScalarView(out.prefix(BUCKET_TEXT_MAX))
    while let last = cut.last, last == " " { cut.removeLast() }
    return String(cut)
}

public struct BucketDoc: Sendable, Equatable {
    public var items: [String: BucketItem] = [:]

    public init(items: [String: BucketItem] = [:]) { self.items = items }

    public init(_ raw: Doc?) {
        for (id, v) in (raw ?? [:]).map("items") {
            guard let e = v as? Doc else { continue }
            let text = cleanText(e["text"] as? String ?? "")
            guard !text.isEmpty else { continue }
            func num(_ k: String) -> Double { (e[k] is String) ? 0 : (e.num(k).flatMap { $0.isFinite ? $0 : nil } ?? 0) }
            items[id] = BucketItem(id: id, text: text, by: e.str("by") ?? "", at: num("at"), next: (e["next"] as? Bool) == true, done: num("done"), doneBy: e.str("doneBy") ?? "")
        }
    }

    /// the list as it shows: what's still to do (next time's first, then the newest), and what's done (latest first)
    public var view: (todo: [BucketItem], done: [BucketItem]) {
        let all = Array(items.values)
        let todo = all.filter { $0.done == 0 }.sorted { a, b in
            if a.next != b.next { return a.next }
            if a.at != b.at { return a.at > b.at }
            return a.id < b.id
        }
        let done = all.filter { $0.done != 0 }.sorted { a, b in a.done != b.done ? a.done > b.done : a.id < b.id }
        return (todo, done)
    }

    /// the ones to take off so the list keeps to BUCKET_MAX (the oldest done ones, then the oldest still to do)
    public var overflow: [String] {
        let v = view
        let extra = v.todo.count + v.done.count - BUCKET_MAX
        guard extra > 0 else { return [] }
        let oldest: [BucketItem] = Array(v.done.reversed()) + Array(v.todo.reversed())
        return oldest.prefix(extra).map(\.id)
    }

    /// "3 things planned for Goa", "1 thing planned for next time" (nil when there's nothing starred)
    public func plannedLine(_ whereTo: String) -> String? {
        let n = items.values.filter { $0.next && $0.done == 0 }.count
        guard n > 0 else { return nil }
        return "\(n) \(n == 1 ? "thing" : "things") planned for \(whereTo.isEmpty ? "next time" : whereTo)"
    }
}

/// things to do, when you're stuck: some for together, some from afar
public let BUCKET_IDEAS: [String] = [
    "Watch a sunrise together",
    "Cook each other’s favourite dish",
    "Take a train somewhere neither of us has been",
    "Slow-dance in the kitchen",
    "Find the best coffee in your city",
    "Have a picnic with too much food",
    "Go stargazing away from the city lights",
    "Visit the place you grew up",
    "Squeeze into a photo booth",
    "Spend a whole day with our phones off",
    "See a film in an old cinema",
    "Build a blanket fort and nap in it",
    "Order a dish neither of us can pronounce",
    "Walk somewhere new without a map",
    "Re-create our first date",
    "Go to a live gig and sing too loud",
    "Plant something and keep it alive",
    "Swim in the sea at night",
    "Get caught in the rain on purpose",
    "Take a cooking class together",
    "Finish an escape room together",
    "Watch a whole series in sync",
    "Fall asleep on a call",
    "Send each other a song every day for a week",
    "Cook the same recipe at the same time",
    "Write each other a letter on paper and post it",
    "Read the same book and talk about it",
    "Draw each other from memory",
    "Plan a trip down to the last day",
    "Learn ten words of each other’s favourite language",
]

/// the demo room: Aanya and Rohan's list
public func demoBucket(now: Double = Values.nowMs()) -> Doc {
    let day = 86400e3
    func it(_ text: String, _ by: String, _ ago: Double, next: Bool = false, doneAgo: Double = 0, doneBy: String = "") -> Doc {
        ["text": text, "by": by, "at": now - ago * day, "next": next, "done": doneAgo > 0 ? now - doneAgo * day : 0, "doneBy": doneBy]
    }
    return ["items": [
        "wish-demo-1": it("Watch the sunrise from the beach", Demo.them, 9, next: true),
        "wish-demo-2": it("Eat at the shack with the fairy lights", Demo.me, 6, next: true),
        "wish-demo-3": it("Rent a scooter and get a bit lost", Demo.them, 3, next: true),
        "wish-demo-4": it("Read the same book and talk about it", Demo.me, 20),
        "wish-demo-5": it("Finish an escape room together", Demo.me, 30, doneAgo: 4, doneBy: Demo.them),
        "wish-demo-6": it("Fall asleep on a call", Demo.them, 45, doneAgo: 12, doneBy: Demo.me),
    ] as Doc]
}
