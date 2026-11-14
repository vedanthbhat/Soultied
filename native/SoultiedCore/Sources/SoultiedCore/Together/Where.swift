import Foundation

/*
 * How far apart you are, and what time it is for your person (src/together/where.ts). Kept in the place's
 * meta/where document, by person: your time zone (always, so they can see your time), and roughly where you
 * are (only once you choose to share it, and only to a tenth of a degree, about 11 km: the town, never the street).
 */

public struct WhereEntry: Sendable, Equatable {
    /// roughly where (a tenth of a degree), or nil while you're not sharing it
    public var lat: Double?
    public var lon: Double?
    /// your time zone ("Asia/Kolkata"), or ""
    public var tz: String
    /// when it was last set (ms)
    public var at: Double

    public init(lat: Double? = nil, lon: Double? = nil, tz: String = "", at: Double = 0) {
        self.lat = lat
        self.lon = lon
        self.tz = tz
        self.at = at
    }

    public var sharing: Bool { lat != nil && lon != nil }
}

/// to a tenth of a degree (about 11 km)
public func roundCoord(_ x: Double) -> Double { jsRound(x * 10) / 10 }

public struct WhereDoc: Sendable, Equatable {
    public var by: [String: WhereEntry] = [:]

    public init(by: [String: WhereEntry] = [:]) { self.by = by }

    public init(_ raw: Doc?) {
        func coord(_ v: Any?, _ lim: Double) -> Double? {
            guard let d = Values.num(v), d.isFinite, abs(d) <= lim else { return nil }
            return roundCoord(d)
        }
        for (uid, v) in (raw ?? [:]).map("by") {
            guard let e = v as? Doc else { continue }
            var lat = coord(e["lat"], 90)
            var lon = coord(e["lon"], 180)
            if lat == nil || lon == nil { lat = nil; lon = nil }
            let tz = e["tz"] as? String ?? ""
            let at = e.num("at") ?? 0
            by[uid] = WhereEntry(lat: lat, lon: lon, tz: WhereDoc.isZone(tz) ? tz : "", at: at.isFinite ? at : 0)
        }
    }

    /// a time zone's name ("Asia/Kolkata", "Etc/GMT+5")
    public static func isZone(_ s: String) -> Bool {
        guard !s.isEmpty, s.utf8.count <= 64 else { return false }
        let parts = s.split(separator: "/", omittingEmptySubsequences: false)
        for (i, p) in parts.enumerated() {
            guard !p.isEmpty else { return false }
            for (j, c) in p.unicodeScalars.enumerated() {
                let letter = (c >= "A" && c <= "Z") || (c >= "a" && c <= "z")
                let other = (c >= "0" && c <= "9") || c == "_" || c == "+" || c == "-"
                if i == 0 && j == 0 { if !letter { return false } } else if !(letter || other) { return false }
            }
        }
        return true
    }

    /// how far apart the two of you are (nil until you've both shared roughly where you are)
    public func apartKm(me: String, them: String?) -> Double? {
        guard let a = by[me], let t = them, let b = by[t], let la = a.lat, let lo = a.lon, let lb = b.lat, let lob = b.lon else { return nil }
        return distanceKm(la, lo, lb, lob)
    }
}

/// how far apart two places are, in km, over the earth's surface
public func distanceKm(_ lat1: Double, _ lon1: Double, _ lat2: Double, _ lon2: Double) -> Double {
    let rad = Double.pi / 180
    let dLat = (lat2 - lat1) * rad
    let dLon = (lon2 - lon1) * rad
    let s1 = sin(dLat / 2), s2 = sin(dLon / 2)
    let h = s1 * s1 + cos(lat1 * rad) * cos(lat2 * rad) * s2 * s2
    return 2 * 6371 * asin(min(1, h.squareRoot()))
}

private func grouped(_ n: Int) -> String {
    let s = String(n)
    var out = ""
    for (i, c) in s.enumerated() {
        if i > 0 && (s.count - i) % 3 == 0 { out.append(",") }
        out.append(c)
    }
    return out
}

/// "8,050 km apart", "5,000 miles apart", or "Close by" (in miles where people count in miles)
public func apartLabel(_ km: Double, miles: Bool = false) -> String {
    if km < 20 { return "Close by" }
    let v = miles ? km * 0.621371 : km
    let r = v < 100 ? jsRound(v / 5) * 5 : v < 1000 ? jsRound(v / 10) * 10 : jsRound(v / 50) * 50
    return "\(grouped(Int(r))) \(miles ? "miles" : "km") apart"
}

/// where your person's clock is next to yours: "5½ hours behind you", "Same time as you" (from the minutes between)
public func aheadLine(_ diffMinutes: Double) -> String {
    let d = Int(jsRound(diffMinutes))
    if abs(d) < 8 { return "Same time as you" }
    let a = abs(d)
    var h = a / 60
    var q = Int(jsRound(Double(a % 60) / 15))
    if q == 4 {
        h += 1
        q = 0
    }
    let way = d > 0 ? "ahead of you" : "behind you"
    if h == 0 { return "\(q == 2 ? "Half an hour" : "\(q * 15) minutes") \(way)" }
    return "\(h)\(["", "¼", "½", "¾"][q]) \(h == 1 && q == 0 ? "hour" : "hours") \(way)"
}

/// in the small hours for them (so: probably asleep)
public func asleepHour(_ hour: Int) -> Bool { hour >= 0 && hour < 6 }

/// minutes between their clock and yours, now (nil if either zone isn't known)
public func zoneDiffMinutes(theirs: String, mine: String, at: Date = Date()) -> Double? {
    guard let t = TimeZone(identifier: theirs), let m = TimeZone(identifier: mine) else { return nil }
    return Double(t.secondsFromGMT(for: at) - m.secondsFromGMT(for: at)) / 60
}

/// places where distances are in miles
public func countsInMiles(region: String?) -> Bool { ["US", "GB", "LR", "MM"].contains(region ?? "") }

/// the demo room: Aanya in Bengaluru, Rohan in London
public func demoWhere(now: Double = Values.nowMs()) -> Doc {
    ["by": [
        Demo.me: ["lat": 13.0, "lon": 77.6, "tz": "Asia/Kolkata", "at": now - 3600e3] as Doc,
        Demo.them: ["lat": 51.5, "lon": -0.1, "tz": "Europe/London", "at": now - 3 * 3600e3] as Doc,
    ] as Doc]
}
