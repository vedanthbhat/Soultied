import Foundation

/*
 * Where a place's things are kept: Firestore for a real place (FirestoreBackend, in the app), memory for
 * the demo room and the tests (MemoryBackend). Documents are plain dictionaries in the same shape the
 * website writes, so the two apps share one place.
 */

public typealias Doc = [String: Any]

public protocol Listener: AnyObject {
    func stop()
}

/// A value the database works out when it's written.
public enum Sentinel {
    /// adds these to an array, leaving anything already there
    case arrayUnion([Any])
    /// takes the field out
    case delete
}

/// one row from a listing: the document's id and what's in it
public struct Row {
    public let id: String
    public let data: Doc
    public init(id: String, data: Doc) {
        self.id = id
        self.data = data
    }
}

public enum Comparison {
    case equal, greaterOrEqual, less, arrayContains
}

public struct Filter {
    public let field: String
    public let op: Comparison
    public let value: Any
    public init(_ field: String, _ op: Comparison, _ value: Any) {
        self.field = field
        self.op = op
        self.value = value
    }
    /// the document's own id (for listings by prefix)
    public static let documentId = "__name__"
}

public struct QuerySpec {
    public var collection: String
    public var filters: [Filter] = []
    public var orderBy: String? = nil
    public var descending = false
    public var limit: Int? = nil
    public init(_ collection: String, filters: [Filter] = [], orderBy: String? = nil, descending: Bool = false, limit: Int? = nil) {
        self.collection = collection
        self.filters = filters
        self.orderBy = orderBy
        self.descending = descending
        self.limit = limit
    }
}

public struct Write {
    public let path: String
    public let data: Doc
    public let merge: Bool
    public init(_ path: String, _ data: Doc, merge: Bool = false) {
        self.path = path
        self.data = data
        self.merge = merge
    }
}

public protocol Backend: AnyObject {
    /// a document, live (nil while it doesn't exist)
    func listen(_ path: String, _ fn: @escaping (Doc?) -> Void) -> Listener
    /// a listing, live
    func listen(_ q: QuerySpec, _ fn: @escaping ([Row]) -> Void) -> Listener
    func get(_ path: String) async throws -> Doc?
    func query(_ q: QuerySpec) async throws -> [Row]
    func set(_ path: String, _ data: Doc, merge: Bool) async throws
    /// changes fields of a document that must already exist
    func update(_ path: String, _ data: Doc) async throws
    /// all or nothing
    func commit(_ writes: [Write]) async throws
    /// when a value from the database is a moment in time, as milliseconds
    func millis(_ v: Any?) -> Double?
    /// a moment in time, as the database keeps it
    func timestamp(ms: Double) -> Any
}

public extension Backend {
    func merge(_ path: String, _ data: Doc) async throws { try await set(path, data, merge: true) }
}

/* ---------- reading what comes back ---------- */

public extension Dictionary where Key == String, Value == Any {
    func str(_ k: String) -> String? { self[k] as? String }
    func num(_ k: String) -> Double? { SoultiedCore.Values.num(self[k]) }
    func int(_ k: String) -> Int? { SoultiedCore.Values.num(self[k]).map { Int($0) } }
    func bool(_ k: String) -> Bool { (self[k] as? Bool) ?? false }
    func map(_ k: String) -> Doc { (self[k] as? Doc) ?? [:] }
    func list(_ k: String) -> [Any] { (self[k] as? [Any]) ?? [] }
}

public enum Values {
    /// numbers arrive as Int, Double or NSNumber depending on where they came from
    public static func num(_ v: Any?) -> Double? {
        switch v {
        case let d as Double: return d
        case let i as Int: return Double(i)
        case let i as Int64: return Double(i)
        case let f as Float: return Double(f)
        case let n as NSNumber: return n.doubleValue
        default: return nil
        }
    }

    /// Merges `patch` into `base` the way Firestore's merge does: nested maps merge, anything else replaces.
    public static func deepMerge(_ base: Doc, _ patch: Doc) -> Doc {
        var out = base
        for (k, v) in patch {
            if let s = v as? Sentinel {
                switch s {
                case .delete: out[k] = nil
                case .arrayUnion(let items):
                    var arr = (out[k] as? [Any]) ?? []
                    for it in items where !arr.contains(where: { same($0, it) }) { arr.append(it) }
                    out[k] = arr
                }
            } else if let pm = v as? Doc {
                out[k] = deepMerge((out[k] as? Doc) ?? [:], pm)
            } else if v is NSNull {
                out[k] = nil
            } else {
                out[k] = v
            }
        }
        return out
    }

    /// what a whole-document write leaves behind (sentinels worked out, nulls dropped)
    public static func resolve(_ d: Doc) -> Doc { deepMerge([:], d) }

    static func same(_ a: Any, _ b: Any) -> Bool {
        if let x = a as? String, let y = b as? String { return x == y }
        if let x = num(a), let y = num(b) { return x == y }
        return false
    }

    /// now, as the website writes it ("2026-10-29T12:00:00.000Z")
    public static func isoNow() -> String { iso(Date()) }

    public static func iso(_ d: Date) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.string(from: d)
    }

    public static func date(_ iso: String?) -> Date? {
        guard let s = iso, !s.isEmpty else { return nil }
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: s) { return d }
        f.formatOptions = [.withInternetDateTime]
        if let d = f.date(from: s) { return d }
        // a local time without a zone ("2026-10-29T21:00:00"), as the demo room writes
        let g = DateFormatter()
        g.locale = Locale(identifier: "en_US_POSIX")
        g.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        return g.date(from: String(s.prefix(19)))
    }

    public static func nowMs() -> Double { (Date().timeIntervalSince1970 * 1000).rounded() }

    /// a short random id, sortable by when it was made (the website's newKey)
    public static func newKey(_ prefix: String) -> String {
        let t = String(Int(nowMs()), radix: 36)
        let chars = Array("abcdefghijklmnopqrstuvwxyz0123456789")
        let r = String((0..<4).map { _ in chars.randomElement()! })
        return prefix + t + r
    }

    /// the website's newId ("space-…")
    public static func newId(_ prefix: String) -> String {
        let t = String(Int(nowMs()), radix: 36)
        let chars = Array("abcdefghijklmnopqrstuvwxyz0123456789")
        return "\(prefix)-\(t)\(String((0..<6).map { _ in chars.randomElement()! }))"
    }
}
