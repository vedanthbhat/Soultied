import Foundation
import SoultiedCore

// Draws the scenes in <dir>/scenes.json with the Swift renderer, to <dir>/swift-*.raw, so they can be
// compared with the website's drawings of the same scenes (scratch tooling; not part of the app).

let dir = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "."
let spec = try! JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: dir + "/scenes.json"))) as! [String: Any]

func glyph(_ v: Any?) -> Glyph? {
    guard let g = v as? [String: Any], let rows = g["rows"] as? [String], let pal = g["pal"] as? [String: String] else { return nil }
    return Glyph(rows: rows, pal: Dictionary(uniqueKeysWithValues: pal.map { (Character($0.key), RGB($0.value)) }))
}

func seat(_ v: Any?) -> Seat {
    guard let s = v as? [String: Any] else { return .empty }
    return Seat(avatar: Wardrobe.normalize(s["avatar"]), name: "x", status: SeatStatus(rawValue: s["status"] as? String ?? "online") ?? .online)
}

let renderer = RoomRenderer()
for sc in spec["scenes"] as! [[String: Any]] {
    let s = sc["state"] as! [String: Any]
    var st = RoomState(left: seat(s["left"]), right: seat(s["right"]))
    st.letterUnread = s["letterUnread"] as? Bool ?? false
    st.fire = (s["fire"] as? Double) ?? 0.6
    st.hover = (s["hover"] as? String).flatMap { HotspotId(rawValue: $0) }
    st.closeness = (s["closeness"] as? Double) ?? 0
    st.scooting = s["scooting"] as? Bool ?? false
    st.heartAt = (s["heartAt"] as? Double) ?? -1
    st.gamesWaiting = s["gamesWaiting"] as? Bool ?? false
    st.music = s["music"] as? Bool ?? false
    let d = s["decor"] as? [String: String] ?? [:]
    st.decor = Decor(wall: d["wall"] ?? "sage", couch: d["couch"] ?? "terracotta", rug: d["rug"] ?? "diamond", pet: d["pet"] ?? "ginger", view: d["view"] ?? "snow", painting: d["painting"] ?? "dusk", plant: d["plant"] ?? "monstera")
    st.bare = s["bare"] as? Bool ?? false
    st.moodLeft = glyph(s["moodLeft"])
    st.moodRight = glyph(s["moodRight"])
    if let tc = s["touch"] as? [String: Any] {
        st.touch = RoomTouch(kind: tc["kind"] as! String, together: tc["together"] as! Bool, from: HotspotId(rawValue: tc["from"] as! String)!, at: tc["at"] as! Double, glyph: glyph(tc["glyph"])!)
    }
    if let a = s["wallArt"] as? [String: Any] {
        st.wallArt = WallArtPixels(w: a["w"] as! Int, h: a["h"] as! Int, pal: (a["pal"] as! [String]).map { RGB($0) }, px: a["px"] as! String)
    }
    st.wallNews = s["wallNews"] as? Bool ?? false
    let t0 = Date()
    let buf = renderer.render(st, sc["t"] as! Double)
    let ms = Date().timeIntervalSince(t0) * 1000
    try! Data(buf.data).write(to: URL(fileURLWithPath: "\(dir)/swift-\(sc["name"] as! String).raw"))
    print(sc["name"] as! String, String(format: "%.1f ms", ms))
}

var out: [UInt8] = []
for c in spec["chars"] as! [[String: Any]] {
    let f = c["frame"] as! [String: Any]
    let r = renderCharacter(Wardrobe.normalize(c["avatar"]), (c["pose"] as! String) == "sit" ? .sit : .stand, CharacterFrame(blink: f["blink"] as! Bool, bob: f["bob"] as! Int, sleepy: f["sleepy"] as! Bool))
    out += r.buf.data
    out.append(UInt8(truncatingIfNeeded: r.headTop))
    out.append(UInt8(truncatingIfNeeded: r.anchor.y))
}
try! Data(out).write(to: URL(fileURLWithPath: dir + "/swift-chars.raw"))

// timing: a second of animation
let t0 = Date()
var st = RoomState(left: Seat(avatar: Wardrobe.defaultA, name: "a", status: .online), right: Seat(avatar: Wardrobe.defaultB, name: "b", status: .online))
for i in 0..<12 { _ = renderer.render(st, Double(i) / 12) }
st.closeness = 1
print(String(format: "12 frames: %.1f ms", Date().timeIntervalSince(t0) * 1000))
