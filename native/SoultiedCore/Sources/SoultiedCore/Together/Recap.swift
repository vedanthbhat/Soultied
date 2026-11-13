import Foundation

/*
 * Your month together (src/together/recap.ts): the days you both showed up (and your longest run of them), the
 * letters you opened together and how in sync you were, and what you pinned to the wall. The caller gives each
 * thing's day on its own calendar, so this never has to think about time zones.
 */

public let MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

public struct RecapInput: Sendable {
    /// the days you were both here (couch)
    public var together: [String]
    /// each daily letter: its day, whether you opened it together, and how many answers matched of how many
    public var letters: [(day: String, opened: Bool, same: Int, total: Int)]
    /// the days of the photos and notes you pinned up (doodles are notes too)
    public var photos: [String]
    public var notes: [(day: String, doodle: Bool)]

    public init(together: [String], letters: [(day: String, opened: Bool, same: Int, total: Int)], photos: [String], notes: [(day: String, doodle: Bool)]) {
        self.together = together
        self.letters = letters
        self.photos = photos
        self.notes = notes
    }
}

public struct Recap: Sendable, Equatable {
    /// YYYY-MM, and "November 2026"
    public var month: String
    public var label: String
    public var days: Int
    public var bestStreak: Int
    public var letters: Int
    /// answers that matched, as a percentage (nil if none to compare)
    public var sync: Int?
    public var photos: Int
    public var doodles: Int
    public var notes: Int
}

/// the month a recap's about: the one just gone in its first three days, else this one so far
public func recapMonth(_ today: String) -> (month: String, done: Bool) {
    let p = today.split(separator: "-").map { Int($0) ?? 0 }
    guard p.count == 3 else { return (String(today.prefix(7)), false) }
    if p[2] <= 3 {
        let y = p[1] == 1 ? p[0] - 1 : p[0]
        let m = p[1] == 1 ? 12 : p[1] - 1
        return ("\(y)-\(m < 10 ? "0" : "")\(m)", true)
    }
    return (String(today.prefix(7)), false)
}

public func monthRecap(_ input: RecapInput, month: String) -> Recap {
    func inMonth(_ day: String) -> Bool { day.prefix(7) == month }
    let days = Set(input.together.filter(inMonth)).map { Day.number($0) }.sorted()
    var best = 0, run = 0
    for (i, d) in days.enumerated() {
        run = i > 0 && d == days[i - 1] + 1 ? run + 1 : 1
        best = max(best, run)
    }
    let letters = input.letters.filter { $0.opened && inMonth($0.day) }
    let same = letters.reduce(0) { $0 + $1.same }, total = letters.reduce(0) { $0 + $1.total }
    let notes = input.notes.filter { inMonth($0.day) }
    let ym = month.split(separator: "-").map { Int($0) ?? 1 }
    // (as the website rounds: half up)
    let sync: Int? = total > 0 ? Int((Double(same) / Double(total) * 100 + 0.5).rounded(.down)) : nil
    return Recap(
        month: month, label: "\(MONTH_NAMES[max(0, min(11, (ym.count > 1 ? ym[1] : 1) - 1))]) \(ym.first ?? 0)",
        days: days.count, bestStreak: best, letters: letters.count, sync: sync,
        photos: input.photos.filter(inMonth).count, doodles: notes.filter(\.doodle).count, notes: notes.filter { !$0.doodle }.count
    )
}
