import Foundation

/*
 * The next time you'll be together (src/together/visit.ts): a day you both count down to (and where, or what
 * for), kept in the place's meta/visit document. Either of you can set it or change it; once the day's been,
 * it's gone and you can set the next one.
 */

public let VISIT_WHAT_MAX = 30

public struct VisitDoc: Sendable, Equatable {
    /// the day (YYYY-MM-DD), or "" for none set
    public var date = ""
    /// where, or what for: "Goa", "the wedding"
    public var what = ""
    /// who set it, and when (ms)
    public var by = ""
    public var at = 0.0

    public init(date: String = "", what: String = "", by: String = "", at: Double = 0) {
        self.date = date
        self.what = what
        self.by = by
        self.at = at
    }

    public init(_ raw: Doc?) {
        let r = raw ?? [:]
        let d = r.str("date") ?? ""
        date = VisitDoc.isKey(d) ? d : ""
        what = String((r.str("what") ?? "").prefix(VISIT_WHAT_MAX)).trimmingCharacters(in: .whitespaces)
        by = r.str("by") ?? ""
        at = r.num("at") ?? 0
    }

    public static func isKey(_ s: String) -> Bool {
        let u = Array(s.utf8)
        guard u.count == 10 else { return false }
        for (i, c) in u.enumerated() {
            if i == 4 || i == 7 { if c != UInt8(ascii: "-") { return false } } else if c < 48 || c > 57 { return false }
        }
        return true
    }

    /// days from today to the day (nil: none set, or it's been)
    public func daysLeft(today: String) -> Int? {
        guard !date.isEmpty else { return nil }
        let n = Day.number(date) - Day.number(today)
        return n >= 0 ? n : nil
    }

    /// "12 days until Goa", "Tomorrow: Goa", "Together today" (nil when there's nothing to count down to)
    public func line(today: String) -> String? {
        guard let n = daysLeft(today: today) else { return nil }
        if n == 0 { return what.isEmpty ? "Together today" : "Today: \(what)" }
        if n == 1 { return what.isEmpty ? "Together tomorrow" : "Tomorrow: \(what)" }
        return what.isEmpty ? "\(n) days until you’re together" : "\(n) days until \(what)"
    }
}
