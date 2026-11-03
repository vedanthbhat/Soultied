import Foundation

/// A database that lives in memory: the demo room, and the tests. Behaves like Firestore for what
/// Soultied does with it (merges, array unions, live listeners, listings by prefix and date).
public final class MemoryBackend: Backend {
    private var docs: [String: Doc] = [:]
    private var docListeners: [String: [Int: (Doc?) -> Void]] = [:]
    private var queryListeners: [Int: (QuerySpec, ([Row]) -> Void)] = [:]
    private var nextId = 0
    /// deliver changes straight away rather than on the next turn of the main queue
    public var synchronous: Bool

    public init(synchronous: Bool = false) {
        self.synchronous = synchronous
    }

    final class Handle: Listener {
        let onStop: () -> Void
        init(_ onStop: @escaping () -> Void) { self.onStop = onStop }
        func stop() { onStop() }
    }

    private func deliver(_ fn: @escaping () -> Void) {
        if synchronous { fn() } else { DispatchQueue.main.async(execute: fn) }
    }

    /// put documents in without telling anyone (setting up the demo room)
    public func seed(_ path: String, _ data: Doc) { docs[path] = Values.resolve(data) }

    public func snapshot(_ path: String) -> Doc? { docs[path] }

    public func listen(_ path: String, _ fn: @escaping (Doc?) -> Void) -> Listener {
        nextId += 1
        let id = nextId
        docListeners[path, default: [:]][id] = fn
        let now = docs[path]
        deliver { fn(now) }
        return Handle { [weak self] in self?.docListeners[path]?[id] = nil }
    }

    public func listen(_ q: QuerySpec, _ fn: @escaping ([Row]) -> Void) -> Listener {
        nextId += 1
        let id = nextId
        queryListeners[id] = (q, fn)
        let rows = run(q)
        deliver { fn(rows) }
        return Handle { [weak self] in self?.queryListeners[id] = nil }
    }

    // Everything happens on the main thread, one thing at a time, as Firestore's listeners do.
    public func get(_ path: String) async throws -> Doc? { await MainActor.run { docs[path] } }

    public func query(_ q: QuerySpec) async throws -> [Row] { await MainActor.run { run(q) } }

    public func set(_ path: String, _ data: Doc, merge: Bool) async throws {
        let w = Write(path, data, merge: merge)
        await MainActor.run { apply(w) }
    }

    public func update(_ path: String, _ data: Doc) async throws {
        let w = Write(path, data, merge: true)
        let ok = await MainActor.run { () -> Bool in
            guard docs[path] != nil else { return false }
            apply(w)
            return true
        }
        if !ok { throw NSError(domain: "soultied", code: 5, userInfo: [NSLocalizedDescriptionKey: "No document at \(path)"]) }
    }

    public func commit(_ writes: [Write]) async throws {
        await MainActor.run { for w in writes { apply(w) } }
    }

    /// write without waiting (handy from synchronous code)
    public func apply(_ w: Write) {
        let before = docs[w.path] ?? [:]
        docs[w.path] = w.merge ? Values.deepMerge(before, w.data) : Values.resolve(w.data)
        changed(w.path)
    }

    private func changed(_ path: String) {
        let now = docs[path]
        for fn in (docListeners[path] ?? [:]).values { deliver { fn(now) } }
        let coll = collectionOf(path)
        for (q, fn) in queryListeners.values where q.collection == coll {
            let rows = run(q)
            deliver { fn(rows) }
        }
    }

    private func collectionOf(_ path: String) -> String {
        var parts = path.split(separator: "/")
        parts.removeLast()
        return parts.joined(separator: "/")
    }

    private func run(_ q: QuerySpec) -> [Row] {
        let prefix = q.collection + "/"
        var rows: [Row] = docs.compactMap { (path, d) in
            guard path.hasPrefix(prefix) else { return nil }
            let id = String(path.dropFirst(prefix.count))
            if id.contains("/") { return nil }
            return Row(id: id, data: d)
        }
        for f in q.filters {
            rows = rows.filter { r in
                let v: Any? = f.field == Filter.documentId ? r.id : r.data[f.field]
                switch f.op {
                case .equal: return v.map { Values.same($0, f.value) } ?? false
                case .arrayContains: return ((v as? [Any]) ?? []).contains { Values.same($0, f.value) }
                case .greaterOrEqual, .less:
                    let ge: Bool
                    if let a = v as? String, let b = f.value as? String { ge = a >= b }
                    else if let a = Values.num(v), let b = Values.num(f.value) { ge = a >= b }
                    else { return false }
                    return f.op == .greaterOrEqual ? ge : !ge
                }
            }
        }
        rows.sort { a, b in
            if let k = q.orderBy {
                let x = a.data[k] as? String ?? "", y = b.data[k] as? String ?? ""
                return q.descending ? x > y : x < y
            }
            return a.id < b.id
        }
        if let n = q.limit { rows = Array(rows.prefix(n)) }
        return rows
    }

    public func millis(_ v: Any?) -> Double? {
        if let d = v as? Date { return d.timeIntervalSince1970 * 1000 }
        return Values.num(v)
    }

    public func timestamp(ms: Double) -> Any { Date(timeIntervalSince1970: ms / 1000) }

    /* ---------- live channels: everyone listening on a collection hears every message, their own too ---------- */

    private var buses: [String: [Int: (Doc) -> Void]] = [:]
    private var outbox: [(String, Doc)] = []
    private var sending = false

    final class Channel: LiveChannel {
        weak var db: MemoryBackend?
        let collection: String
        let id: Int
        init(_ db: MemoryBackend, _ collection: String, _ id: Int) {
            self.db = db
            self.collection = collection
            self.id = id
        }
        var isLocal: Bool { true }
        func send(_ e: Doc) { db?.post(collection, e) }
        func subscribe(_ fn: @escaping (Doc) -> Void) { db?.buses[collection, default: [:]][id] = fn }
        func close() { db?.buses[collection]?[id] = nil }
    }

    public func live(_ collection: String) -> LiveChannel {
        nextId += 1
        return Channel(self, collection, nextId)
    }

    /// one message at a time, in the order they were sent (a reply sent while hearing a message waits its turn)
    private func post(_ collection: String, _ e: Doc) {
        if !synchronous {
            DispatchQueue.main.async { [weak self] in
                for fn in (self?.buses[collection] ?? [:]).values { fn(e) }
            }
            return
        }
        outbox.append((collection, e))
        if sending { return }
        sending = true
        while !outbox.isEmpty {
            let (c, m) = outbox.removeFirst()
            for (_, fn) in (buses[c] ?? [:]).sorted(by: { $0.key < $1.key }) { fn(m) }
        }
        sending = false
    }
}
