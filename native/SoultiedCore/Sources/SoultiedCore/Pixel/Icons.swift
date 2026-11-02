import Foundation

/// The little pixel icons the website uses (src/components/letters/PixelIcon.tsx), and a few for the iPhone's tabs.
public enum Icons {
    static let INK = "#3a2a26"

    public static let envelope = Glyph([
        "###############", "##ooooooooooo##", "#o#ooooooooo#o#", "#oo#ooooooo#oo#", "#ooo##ooo##ooo#", "#ooooo#r#ooooo#",
        "#ooooorrrooooo#", "#ooooooroooooo#", "#ooooooooooooo#", "#sssssssssssss#", "###############",
    ], ["#": INK, "o": "#f4e8d0", "s": "#d6c29c", "r": "#a84f4b"])
    public static let seal = Glyph(["..rrrrr..", ".rrrrrrr.", "rrllrllrr", "rrlllllrr", "rrrlllrrr", "rrrrlrrrr", "rrrrrrrrr", ".rrrrrrr.", "..ddddd.."], ["r": "#a84f4b", "l": "#e8a39a", "d": "#7f3835"])
    public static let flame = Glyph(["...r...", "..rr...", "..rrr..", ".rryrr.", ".ryyyr.", "rryyyrr", "ryywyyr", "ryywwyr", ".rrrrr."], ["r": "#c4453f", "y": "#e2b359", "w": "#fff1c2"])
    public static let flameOut = Glyph(["...g...", "..gg...", "..ggg..", ".gg.gg.", ".g...g.", "gg...gg", "g.....g", "g.....g", ".ggggg."], ["g": "#b9a98f"])
    public static let moon = Glyph(["..mmmm..", ".mmm....", "mmm...s.", "mmm.....", "mmm..s..", "mmm.....", ".mmm....", "..mmmm.."], ["m": "#e9d7b7", "s": "#f6e7a8"])
    public static let heart = Glyph([".##.##.", "#######", "#h#####", ".#####.", "..###..", "...#..."], ["#": "#d9534f", "h": "#f3a19c"])
    public static let heartEmpty = Glyph([".##.##.", "#..#..#", "#.....#", ".#...#.", "..#.#..", "...#..."], ["#": "#b9a98f"])
    public static let check = Glyph(["......g", ".....gg", "g...gg.", "gg.gg..", ".ggg...", "..g...."], ["g": "#5f7a45"])
    public static let cross = Glyph(["x....x", ".x..x.", "..xx..", "..xx..", ".x..x.", "x....x"], ["x": "#a84f4b"])
    public static let lock = Glyph(["..kkk..", ".k...k.", ".k...k.", "kkkkkkk", "kkk.kkk", "kkk.kkk", "kkkkkkk"], ["k": "#7a5a48"])
    public static let couch = Glyph(["..ccccccc..", ".cCCCCCCCc.", "aacccccccaa", "aaCCCCCCCaa", "aakkkkkkkaa", ".d.......d."], ["c": "#b8674f", "C": "#cc7c62", "a": "#95513e", "k": "#763f31", "d": "#5a3a2c"])
    public static let stitch = Glyph(["y.y.y.y", ".y.y.y.", "y.y.y.y"], ["y": "#b48c4a"])
    public static let spool = Glyph(["wwwwwww", ".ttttt.", ".tTtTt.", ".ttttt.", ".tTtTt.", ".ttttt.", "wwwwwww"], ["w": "#9a6a43", "t": "#a84f4b", "T": "#d07a70"])
    public static let book = Glyph([
        "#########.", "#ccccccc#p", "#cyyyyyc#p", "#ccccccc#p", "#cyyyyyc#p", "#ccccccc#p", "#cccchcc#p", "#########p", ".pppppppp.",
    ], ["#": INK, "c": "#b8674f", "y": "#efdcb8", "h": "#f3a19c", "p": "#f4e8d0"])

    /* ---------- the tab bar ---------- */

    /// a little house
    public static let home = Glyph(["....##....", "...####...", "..######..", ".########.", "##########", ".#oo##oo#.", ".#oo##oo#.", ".########.", ".###dd###.", ".###dd###."], ["#": "#b8674f", "o": "#f6dc7a", "d": "#5a3a2c"])
    /// a pinned note
    public static let pin = Glyph(["....rr....", "...rrrr...", "....rr....", "yyyyyyyyyy", "yhhhhhhhhy", "yyyyyyyyyy", "yhhhhhhhhy", "yyyyyyyyyy", "yhhhhhy...", "yyyyyyy..."], ["r": "#c4453f", "y": "#f6e39a", "h": "#b48c4a"])
    /// a little game controller
    public static let play = Glyph(["..######..", ".########.", "##.##oo.##", "#...#oo..#", "##.##..r##", "#########.", ".##....##.", ".#......#."], ["#": "#8a9a72", "o": "#f4e8d0", "r": "#c4453f"])
    /// two hearts, linked
    public static let us = Glyph([".rr.rr.....", "rrrrrrr.RR.", "rrrrrrrRRRR", ".rrrrrRRRRR", "..rrrRRRRR.", "...r.RRRR..", "......RR..."], ["r": "#d9534f", "R": "#e2b359"])
    /// a paint brush (decorating)
    public static let brush = Glyph([".......kk", "......kkk", ".....kkk.", "....kkk..", "...wkk...", "..rrw....", ".rrrr....", "rrrr.....", "rr......."], ["k": "#8a5a3c", "w": "#d6c29c", "r": "#b8674f"])
    /// a camera (photos)
    public static let camera = Glyph(["...kkk....", "kkkkkkkkkk", "k..kkkk..k", "k.kwwwwk.k", "k.kwbbwk.k", "k.kwwwwk.k", "k..kkkk..k", "kkkkkkkkkk"], ["k": "#3a2a26", "w": "#c4dcef", "b": "#4f6fb0"])
    /// a pencil (doodles)
    public static let pencil = Glyph([".......pp", "......pyp", ".....yyp.", "....yyy..", "...yyy...", "..yyy....", ".kyy.....", "kkk......", "kk......."], ["p": "#ef8f88", "y": "#e2b359", "k": "#3a2a26"])
    /// a little star (memories)
    public static let star = Glyph(["....y....", "....y....", "...yyy...", "yyyyyyyyy", ".yyyyyyy.", "..yyyyy..", ".yyy.yyy.", ".yy...yy."], ["y": "#e2b359"])
    /// an open door (escape rooms)
    public static let door = Glyph(["#######", "#ooooo#", "#ooooo#", "#ooooo#", "#ooogo#", "#ooooo#", "#ooooo#", "#ooooo#"], ["#": "#5a3a2c", "o": "#8a5a3c", "g": "#e2b359"])
    /// a television (watching together)
    public static let tv = Glyph(["..k...k..", "...k.k...", "kkkkkkkkk", "kbbbbbbbk", "kbbwbbbbk", "kbbbbbbbk", "kkkkkkkkk", ".k.....k."], ["k": "#3a2a26", "b": "#4f6fb0", "w": "#c4dcef"])
}

public extension Glyph {
    var pixelWidth: Int { rows.map(\.count).max() ?? 0 }
    var pixelHeight: Int { rows.count }

    /// as RGBA, for a picture ('.' and anything not in the palette is see-through)
    func rgba() -> [UInt8] {
        let w = pixelWidth, h = pixelHeight
        var out = [UInt8](repeating: 0, count: w * h * 4)
        for (y, row) in rows.enumerated() {
            for (x, ch) in row.enumerated() {
                guard let c = pal[ch] else { continue }
                let i = (y * w + x) * 4
                out[i] = c.r
                out[i + 1] = c.g
                out[i + 2] = c.b
                out[i + 3] = 255
            }
        }
        return out
    }
}
