import SwiftUI
import SoultiedCore

/*
 * The escape rooms' pieces (the website's ClueCard, LockPanel and Glyph): what you see when you look closely
 * at something, the locks, and the little pixel pictures.
 */

/* ---------- pictures ---------- */

enum EscapeArt {
    static func pixels(_ b: PixelBuffer) -> CGImage? { Pixels.image(b) }

    static var glyphCache: [String: CGImage] = [:]

    /// one of the 7 × 7 symbols
    static func glyph(_ g: EscapeGlyph, _ color: String = "#3a2a26") -> CGImage? {
        let key = g.rawValue + color
        if let c = glyphCache[key] { return c }
        let b = PixelBuffer(7, 7)
        let c = RGB(color)
        for (y, row) in g.rows.enumerated() {
            for (x, k) in row.enumerated() where k == "#" { b.set(x, y, c) }
        }
        let img = Pixels.image(b)
        glyphCache[key] = img
        return img
    }

    /// a little door for the corridor, in the room's colour
    static func door(_ accent: String, open: Bool) -> CGImage? {
        let w = 22, h = 36
        let b = PixelBuffer(w, h)
        func px(_ x: Int, _ y: Int, _ rw: Int, _ rh: Int, _ c: String) { b.rect(x, y, rw, rh, RGB(c)) }
        // frame + arch
        px(0, 4, w, h - 4, "#1a1214")
        px(2, 2, w - 4, 2, "#1a1214")
        px(4, 0, w - 8, 2, "#1a1214")
        if open {
            // the glow beyond it
            px(2, 5, w - 4, h - 5, accent)
            px(4, 3, w - 8, 2, accent)
        } else {
            px(2, 5, w - 4, h - 5, "#2a2024")
            px(4, 3, w - 8, 2, "#2a2024")
            var y = 8
            while y < h - 2 {
                px(4, y, 6, 7, "#352a2e")
                px(12, y, 6, 7, "#352a2e")
                y += 9
            }
            px(w - 6, 20, 2, 2, accent)
            // light leaking under the door
            px(2, h - 1, w - 4, 1, accent)
        }
        return Pixels.image(b)
    }

    /// the clock lock's face, 33 × 33
    static func clock(_ h: Int, _ m: Int) -> CGImage? {
        let n = 33, r = 15.0, cx = 16.0
        let b = PixelBuffer(n, n)
        for y in 0..<n {
            for x in 0..<n {
                let d = hypot(Double(x) + 0.5 - (cx + 0.5), Double(y) + 0.5 - (cx + 0.5))
                if d > r + 1 { continue }
                b.set(x, y, RGB(d > r - 1 ? "#5a3a2c" : "#efe3cb"))
            }
        }
        for k in 0..<12 {
            let a = Double(k) / 12 * Double.pi * 2
            b.set(Int(jsRound(cx + sin(a) * (r - 2.5))), Int(jsRound(cx - cos(a) * (r - 2.5))), RGB("#a08a74"))
        }
        func hand(_ ang: Double, _ len: Double) {
            var i = 0.0
            while i <= len {
                b.set(Int(jsRound(cx + sin(ang) * i)), Int(jsRound(cx - cos(ang) * i)), RGB("#3a2a26"))
                i += 0.5
            }
        }
        hand(Double(m) / 60 * Double.pi * 2, r - 3)
        hand((Double(h % 12) + Double(m) / 60) / 12 * Double.pi * 2, r - 7)
        b.set(16, 16, RGB("#a84f4b"))
        return Pixels.image(b)
    }
}

struct EscapeGlyphView: View {
    let glyph: EscapeGlyph
    var color = "#3a2a26"
    var size: CGFloat = 28
    var body: some View {
        PixelImage(image: EscapeArt.glyph(glyph, color), scale: size / 7)
            .accessibilityLabel(glyph.name)
    }
}

struct DoorSprite: View {
    let accent: String
    var open = false
    var scale: CGFloat = 4
    var body: some View { PixelImage(image: EscapeArt.door(accent, open: open), scale: scale).accessibilityHidden(true) }
}

/* ---------- what you see when you look closely ---------- */

struct ClueCard: View {
    let clue: Clue

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(clue.title).font(.px(19, 700)).foregroundStyle(Color.inkSoft)
            if let t = clue.text { Text(t).font(.pxBody).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true) }
            content
        }
    }

    @ViewBuilder private var content: some View {
        switch clue {
        case .note(_, let text, let sign):
            VStack(alignment: .leading, spacing: 8) {
                Text(text).font(.px(19)).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
                if let sign { Text(sign).font(.pxSmall).foregroundStyle(Color.muted).frame(maxWidth: .infinity, alignment: .trailing) }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(hex: "#f6ecd6"))
            .pxInset()
        case .glyphs(_, _, let gs):
            FlowRow(spacing: 10) {
                ForEach(Array(gs.enumerated()), id: \.offset) { i, g in
                    VStack(spacing: 4) {
                        EscapeGlyphView(glyph: g, size: 42)
                        Text("\(i + 1)").font(.pxTiny).foregroundStyle(Color.muted)
                    }
                    .padding(.horizontal, 10)
                    .padding(.top, 10)
                    .padding(.bottom, 6)
                    .pxInset()
                }
            }
        case .colors(_, _, let cs, let style):
            if style == "notes" {
                HStack(alignment: .bottom, spacing: 8) {
                    ForEach(Array(cs.enumerated()), id: \.offset) { i, c in
                        VStack(spacing: 4) {
                            NoteShape(color: c)
                            Text("\(i + 1)").font(.pxTiny).foregroundStyle(Color.muted)
                        }
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("\(i + 1): \(c.label)")
                    }
                }
            } else {
                VStack(spacing: 4) {
                    ForEach(Array(cs.enumerated()), id: \.offset) { i, c in
                        HStack(spacing: 8) {
                            Text("\(i + 1)").font(.pxTiny).foregroundStyle(Color.muted).frame(width: 18, alignment: .trailing)
                            Rectangle().fill(Color(hex: c.hex))
                                .overlay(alignment: .bottom) { Rectangle().fill(Color(hex: c.dark)).frame(height: 3) }
                                .frame(height: style == "panes" ? 26 : 16)
                        }
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("\(i + 1): \(c.label)")
                    }
                }
                .frame(maxWidth: 260)
            }
        case .pattern(_, _, let rows):
            VStack(spacing: 6) {
                ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                    HStack(spacing: 6) {
                        ForEach(Array(row.enumerated()), id: \.offset) { _, c in
                            Rectangle().fill(Color(hex: c == "#" ? "#cdb3ff" : "#4a3f60"))
                                .overlay(Rectangle().strokeBorder(Color(hex: "#e8dcff"), lineWidth: c == "#" ? 2 : 0))
                                .frame(width: 34, height: 34)
                                .accessibilityLabel(c == "#" ? "glowing" : "dark")
                        }
                    }
                }
            }
            .padding(10)
            .background(Color(hex: "#3d3350"))
        case .letters(_, _, let ls):
            HStack(spacing: 10) {
                ForEach(Array(ls.enumerated()), id: \.offset) { _, l in
                    VStack(spacing: 2) {
                        Text("\(l.0)").font(.pxTiny).foregroundStyle(Color.muted)
                        Text(l.1 ?? "?").font(.px(30, 700)).foregroundStyle(l.1 == nil ? Color(hex: "#b9a98f") : Color.inkSoft)
                    }
                    .frame(minWidth: 46)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 6)
                    .pxInset()
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(l.0): \(l.1 ?? "blank")")
                }
            }
        case .cards(_, _, let cards):
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 8)], alignment: .leading, spacing: 8) {
                ForEach(Array(cards.enumerated()), id: \.offset) { _, c in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(c.name).font(.pxBodyBold).foregroundStyle(Color.inkSoft)
                        ForEach(c.lines, id: \.self) { l in Text(l).font(.pxSmall).foregroundStyle(Color.inkSoft) }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .pxInset()
                }
            }
        }
    }
}

/// a coloured note on the sheet music
struct NoteShape: View {
    let color: EscapeColor
    var body: some View {
        ZStack(alignment: .topLeading) {
            Rectangle().fill(Color.inkSoft).frame(width: 4, height: 28).offset(x: 18)
            Rectangle().fill(Color(hex: color.hex))
                .overlay(alignment: .bottomTrailing) {
                    ZStack(alignment: .bottomTrailing) {
                        Rectangle().fill(Color(hex: color.dark)).frame(width: 22, height: 3)
                        Rectangle().fill(Color(hex: color.dark)).frame(width: 3, height: 16)
                    }
                }
                .frame(width: 22, height: 16)
                .offset(y: 22)
        }
        .frame(width: 26, height: 40, alignment: .topLeading)
    }
}

/// things in a row that wrap onto the next line when there's no room
struct FlowRow: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, row: CGFloat = 0, widest: CGFloat = 0
        for s in subviews {
            let d = s.sizeThatFits(.unspecified)
            if x > 0 && x + d.width > width {
                y += row + spacing
                x = 0
                row = 0
            }
            x += d.width + spacing
            row = max(row, d.height)
            widest = max(widest, x - spacing)
        }
        return CGSize(width: min(widest, width), height: y + row)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, row: CGFloat = 0
        for s in subviews {
            let d = s.sizeThatFits(.unspecified)
            if x > bounds.minX && x + d.width > bounds.maxX {
                y += row + spacing
                x = bounds.minX
                row = 0
            }
            s.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(d))
            x += d.width + spacing
            row = max(row, d.height)
        }
    }
}

/* ---------- the locks ---------- */

/// The lock for one puzzle. Most locks open by themselves the moment they're right.
struct LockPanel: View {
    let puzzle: Puzzle
    let session: EscapeSession
    /// whose half this panel is in
    let side: Side

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(puzzle.title).font(.px(19, 700)).foregroundStyle(Color.inkSoft)
                Text(puzzle.prompt).font(.pxBody).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
            }
            lock
        }
    }

    private func tryIt(_ g: String) -> Bool { session.guess(puzzle, g) }

    @ViewBuilder private var lock: some View {
        switch puzzle.lock {
        case .digits(let n): WheelsLock(length: n, alphabet: Array("0123456789"), session: session, check: tryIt)
        case .letters(let n): WheelsLock(length: n, alphabet: Array("ABCDEFGHIJKLMNOPQRSTUVWXYZ"), session: session, check: tryIt)
        case .glyphs(let slots, let set): GlyphLock(slots: slots, set: set, session: session, check: tryIt)
        case .sequence(let n, let colors, let noun): SequenceLock(length: n, colors: colors, noun: noun, session: session, check: tryIt)
        case .switches(let n): SwitchesLock(count: n, session: session, check: tryIt)
        case .clock(let step): ClockLock(step: step, session: session, check: tryIt)
        case .grid(let n): GridLock(size: n, session: session, check: tryIt)
        case .choice(let options): ChoiceLock(options: options, session: session, check: tryIt)
        case .map(let cols, let cells, let start): MapLock(cols: cols, cells: cells, start: start, session: session, check: tryIt)
        case .together(let label, _): TogetherLock(label: label, session: session, side: side)
        }
    }
}

private struct ArrowButton: View {
    let up: Bool
    let label: String
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(up ? "▲" : "▼").frame(maxWidth: .infinity)
        }
        .buttonStyle(.px(.paper, small: true))
        .accessibilityLabel(label)
    }
}

/// number or letter wheels: turn them with the arrows, or swipe up and down on a wheel
struct WheelsLock: View {
    let length: Int
    let alphabet: [Character]
    let session: EscapeSession
    let check: (String) -> Bool
    @State private var vals: [Int] = []
    @State private var dragged: [Int: CGFloat] = [:]

    var body: some View {
        HStack(spacing: 10) {
            ForEach(0..<length, id: \.self) { i in
                VStack(spacing: 6) {
                    ArrowButton(up: true, label: "Wheel \(i + 1) up") { turn(i, 1) }
                    Text(String(alphabet[value(i)]))
                        .font(.px(32, 700))
                        .foregroundStyle(Color.inkSoft)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                        .pxInset()
                        .contentShape(Rectangle())
                        .gesture(
                            DragGesture(minimumDistance: 6)
                                .onChanged { g in
                                    let steps = Int((-(g.translation.height) / 22).rounded(.towardZero))
                                    let done = Int(dragged[i] ?? 0)
                                    if steps != done {
                                        turn(i, steps - done)
                                        dragged[i] = CGFloat(steps)
                                    }
                                }
                                .onEnded { _ in dragged[i] = nil }
                        )
                        .onTapGesture { turn(i, 1) }
                        .accessibilityLabel("Wheel \(i + 1): \(String(alphabet[value(i)]))")
                        .accessibilityAdjustableAction { d in turn(i, d == .increment ? 1 : -1) }
                    ArrowButton(up: false, label: "Wheel \(i + 1) down") { turn(i, -1) }
                }
                .frame(width: 56)
            }
        }
        .onAppear { if vals.count != length { vals = Array(repeating: 0, count: length) } }
    }

    private func value(_ i: Int) -> Int { i < vals.count ? vals[i] : 0 }

    private func turn(_ i: Int, _ d: Int) {
        if vals.count != length { vals = Array(repeating: 0, count: length) }
        let n = alphabet.count
        vals[i] = ((vals[i] + d) % n + n) % n
        session.sound(.tick)
        _ = check(String(vals.map { alphabet[$0] }))
    }
}

/// picture dials
struct GlyphLock: View {
    let slots: Int
    let set: [EscapeGlyph]
    let session: EscapeSession
    let check: (String) -> Bool
    @State private var vals: [Int] = []

    var body: some View {
        HStack(spacing: 10) {
            ForEach(0..<slots, id: \.self) { i in
                VStack(spacing: 6) {
                    ArrowButton(up: true, label: "Dial \(i + 1) next") { turn(i, 1) }
                    Button { turn(i, 1) } label: {
                        EscapeGlyphView(glyph: set[value(i)], size: 35)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 8)
                            .pxInset()
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Dial \(i + 1): \(set[value(i)].name)")
                    ArrowButton(up: false, label: "Dial \(i + 1) back") { turn(i, -1) }
                }
                .frame(width: 62)
            }
        }
    }

    private func value(_ i: Int) -> Int { i < vals.count ? vals[i] : 0 }

    private func turn(_ i: Int, _ d: Int) {
        if vals.count != slots { vals = Array(repeating: 0, count: slots) }
        let n = set.count
        vals[i] = ((vals[i] + d) % n + n) % n
        session.sound(.tick)
        _ = check(vals.map { set[$0].rawValue }.joined(separator: ","))
    }
}

/// press the colours in order
struct SequenceLock: View {
    let length: Int
    let colors: [EscapeColor]
    let noun: String
    let session: EscapeSession
    let check: (String) -> Bool
    @State private var seq: [EscapeColor] = []
    @State private var bad = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            FlowRow(spacing: 10) {
                ForEach(colors, id: \.self) { c in
                    Button { press(c) } label: {
                        Text(c.label)
                            .font(.px(15, 700))
                            .foregroundStyle(c == .white || c == .gold ? Color.inkSoft : Color.cream)
                            .frame(width: 62, height: 64)
                            .background(Color(hex: c.hex))
                            .overlay(alignment: .bottom) { Rectangle().fill(Color(hex: c.dark)).frame(height: 4) }
                            .overlay(Rectangle().strokeBorder(Color.ink, lineWidth: 3))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(c.label) \(noun)")
                }
            }
            HStack(spacing: 8) {
                Text(bad ? "Hmm, not quite. Try again." : "Order so far:").font(.pxSmall).foregroundStyle(bad ? Color.thread : Color.muted)
                ForEach(0..<length, id: \.self) { i in
                    Rectangle().fill(i < seq.count ? Color(hex: seq[i].hex) : Color.paper2).frame(width: 16, height: 16)
                }
                if !seq.isEmpty && !bad {
                    Button("start over") { seq = [] }.font(.pxSmall).foregroundStyle(Color.terracottaD)
                }
            }
        }
    }

    private func press(_ c: EscapeColor) {
        if bad { return }
        session.sound(.note(c))
        seq.append(c)
        guard seq.count == length else { return }
        if check(seq.map(\.rawValue).joined(separator: ",")) { return }
        bad = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            session.sound(.wrong)
            seq = []
            bad = false
        }
    }
}

struct SwitchesLock: View {
    let count: Int
    let session: EscapeSession
    let check: (String) -> Bool
    @State private var vals: [Bool] = []

    var body: some View {
        HStack(spacing: 12) {
            ForEach(0..<count, id: \.self) { i in
                let up = i < vals.count && vals[i]
                Button { flip(i) } label: {
                    VStack(spacing: 4) {
                        ZStack(alignment: .top) {
                            Rectangle().fill(Color(hex: "#2a3033")).frame(width: 26, height: 60)
                            Rectangle().fill(Color(hex: "#e6dccb"))
                                .overlay(alignment: .bottom) { Rectangle().fill(Color(hex: "#b9ad95")).frame(height: 3) }
                                .frame(width: 20, height: 24)
                                .offset(y: up ? 4 : 32)
                        }
                        Text(up ? "UP" : "DOWN").font(.pxTiny).foregroundStyle(Color(hex: "#e6dccb"))
                    }
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Switch \(i + 1): \(up ? "up" : "down")")
            }
        }
        .padding(12)
        .background(Color(hex: "#3d474a"))
    }

    private func flip(_ i: Int) {
        if vals.count != count { vals = Array(repeating: false, count: count) }
        vals[i].toggle()
        session.sound(.tick)
        _ = check(vals.map { $0 ? "U" : "D" }.joined())
    }
}

struct ClockLock: View {
    let step: Int
    let session: EscapeSession
    let check: (String) -> Bool
    @State private var h = 12
    @State private var m = 0

    var body: some View {
        HStack(spacing: 18) {
            PixelImage(image: EscapeArt.clock(h, m), scale: 4).accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 8) {
                Text("\(h):\(String(format: "%02d", m))").font(.px(32, 700)).foregroundStyle(Color.inkSoft)
                row("Hour", back: { set(((h - 1 - 1 + 12) % 12) + 1, m) }, fwd: { set(((h - 1 + 1 + 12) % 12) + 1, m) })
                row("Minutes", back: { set(h, (m - step + 60) % 60) }, fwd: { set(h, (m + step + 60) % 60) })
            }
        }
    }

    private func row(_ label: String, back: @escaping () -> Void, fwd: @escaping () -> Void) -> some View {
        HStack(spacing: 8) {
            Text(label).font(.pxSmall).foregroundStyle(Color.muted).frame(width: 66, alignment: .leading)
            Button("−", action: back).buttonStyle(.px(.paper, small: true)).accessibilityLabel("\(label) back")
            Button("+", action: fwd).buttonStyle(.px(.paper, small: true)).accessibilityLabel("\(label) forward")
        }
    }

    private func set(_ nh: Int, _ nm: Int) {
        h = nh
        m = nm
        session.sound(.tick)
        _ = check("\(nh):\(String(format: "%02d", nm))")
    }
}

/// tiles to light up
struct GridLock: View {
    let size: Int
    let session: EscapeSession
    let check: (String) -> Bool
    @State private var cells: [Bool] = []

    var body: some View {
        VStack(spacing: 6) {
            ForEach(0..<size, id: \.self) { j in
                HStack(spacing: 6) {
                    ForEach(0..<size, id: \.self) { i in
                        let k = j * size + i
                        let on = k < cells.count && cells[k]
                        Button { flip(k) } label: {
                            Rectangle().fill(Color(hex: on ? "#cdb3ff" : "#6a6272"))
                                .overlay(alignment: .bottom) { if !on { Rectangle().fill(Color(hex: "#544c5c")).frame(height: 3) } }
                                .overlay(Rectangle().strokeBorder(Color(hex: "#e8dcff"), lineWidth: on ? 2 : 0))
                                .frame(width: 44, height: 44)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Row \(j + 1), tile \(i + 1): \(on ? "lit" : "dark")")
                    }
                }
            }
        }
        .padding(10)
        .background(Color(hex: "#4a4250"))
    }

    private func flip(_ k: Int) {
        if cells.count != size * size { cells = Array(repeating: false, count: size * size) }
        cells[k].toggle()
        session.sound(.tick)
        let rows: [String] = (0..<size).map { j in (0..<size).map { i in cells[j * size + i] ? "#" : "." }.joined() }
        _ = check(rows.joined(separator: "/"))
    }
}

/// pick the one that fits
struct ChoiceLock: View {
    let options: [Lock.ChoiceOption]
    let session: EscapeSession
    let check: (String) -> Bool
    @State private var wrong: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 8)], spacing: 8) {
                ForEach(options) { o in
                    Button {
                        if check(o.id) { return }
                        session.sound(.wrong)
                        wrong = o.id
                    } label: {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(o.label).font(.pxBodyBold)
                            ForEach(o.lines, id: \.self) { l in Text(l).font(.pxSmall).fixedSize(horizontal: false, vertical: true) }
                        }
                        .foregroundStyle(Color.inkSoft)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(10)
                        .pxBox(.paper)
                        .opacity(wrong == o.id ? 0.55 : 1)
                    }
                    .buttonStyle(.plain)
                }
            }
            if wrong != nil { Text("That one doesn’t fit every fact. Check them again.").font(.pxSmall).foregroundStyle(Color.thread) }
        }
    }
}

/// the city map: tap where the directions lead
struct MapLock: View {
    let cols: Int
    let cells: [String]
    let start: Int
    let session: EscapeSession
    let check: (String) -> Bool
    @State private var wrong: Int?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: max(1, cols)), spacing: 4) {
                ForEach(Array(cells.enumerated()), id: \.offset) { i, c in
                    Button {
                        if i == start { return }
                        if check(String(i)) { return }
                        session.sound(.wrong)
                        wrong = i
                    } label: {
                        // a word to a line, made a little smaller when a long one ("Lighthouse") doesn't fit,
                        // rather than broken in the middle
                        let words = c.split(separator: " ")
                        Text(words.joined(separator: "\n"))
                            .font(.px(11, i == start ? 700 : 500))
                            .foregroundStyle(i == start ? Color.cream : Color.inkSoft)
                            .multilineTextAlignment(.center)
                            .lineLimit(max(1, words.count))
                            .minimumScaleFactor(0.55)
                            .padding(3)
                            .frame(maxWidth: .infinity, minHeight: 50)
                            .background(Color(hex: i == start ? "#a84f4b" : wrong == i ? "#c8b089" : "#e6dcc4"))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(5)
            .background(Color(hex: "#b8a888"))
            Text("North is the top of the map. The red square is where you start.").font(.pxSmall).foregroundStyle(Color.muted)
            if let w = wrong { Text("Nothing at \(cells[w]). Check the directions again.").font(.pxSmall).foregroundStyle(Color.thread) }
        }
    }
}

/// hold it down at the same moment as the other one
struct TogetherLock: View {
    let label: String
    let session: EscapeSession
    let side: Side

    var body: some View {
        let both = session.mode == .here
        VStack(alignment: .leading, spacing: 12) {
            if both {
                // one phone, two thumbs
                HStack(spacing: 10) {
                    HoldPad(title: session.name(.a), holding: session.holds[.a] == true) { session.setHold(.a, $0) }
                    HoldPad(title: session.name(.b), holding: session.holds[.b] == true) { session.setHold(.b, $0) }
                }
            } else {
                HoldPad(title: "Hold: \(label)", holding: session.holds[side] == true) { session.setHold(side, $0) }
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Rectangle().fill(Color.paper2)
                    Rectangle().fill(Color.butter).frame(width: geo.size.width * session.holdProgress)
                }
            }
            .frame(height: 16)
            Text(words(both)).font(.pxSmall).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
        }
    }

    private func words(_ both: Bool) -> String {
        let mine = session.holds[side] == true, theirs = session.holds[side.other] == true
        let them = session.name(side.other)
        if both { return mine && theirs ? "Together! Keep holding…" : "One thumb each, at the same time: \(label.lowercased())." }
        if mine && theirs { return "Together! Keep holding…" }
        if theirs { return "\(them) is holding. Hold yours too!" }
        if mine { return "Waiting for \(them) to hold theirs…" }
        return "Hold at the same time as \(them)."
    }
}

struct HoldPad: View {
    let title: String
    let holding: Bool
    let onHold: (Bool) -> Void
    @State private var down = false

    var body: some View {
        Text(holding ? "Holding…" : title)
            .font(.px(18, 700))
            .foregroundStyle(Color.cream)
            .multilineTextAlignment(.center)
            .padding(.vertical, 18)
            .padding(.horizontal, 12)
            .frame(maxWidth: .infinity)
            .background(holding ? Color.terracottaD : Color.terracotta)
            .overlay(Rectangle().strokeBorder(Color.ink, lineWidth: 3))
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in
                        if !down {
                            down = true
                            Haptics.tap()
                            onHold(true)
                        }
                    }
                    .onEnded { _ in
                        down = false
                        onHold(false)
                    }
            )
            .accessibilityAddTraits(.isButton)
            .accessibilityLabel(title)
            .accessibilityHint("Hold it down")
    }
}
