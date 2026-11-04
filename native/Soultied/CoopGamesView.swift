import SwiftUI
import SoultiedCore

/*
 * Coasters (air hockey on the coffee table) and Kitchen Rush (one chops, one cooks) on the iPhone: live, over
 * the same line as the website's, so a phone can play a laptop.
 */

/* ---------- a little pixel canvas ---------- */

/// RGBA pixels drawn the way the website's canvas draws them (whole pixels, colours laid over with alpha)
struct Raster {
    let w: Int
    let h: Int
    var data: [UInt8]

    init(_ w: Int, _ h: Int) {
        self.w = w
        self.h = h
        data = [UInt8](repeating: 0, count: w * h * 4)
    }

    mutating func fill(_ x: Int, _ y: Int, _ fw: Int, _ fh: Int, _ c: RGB, _ a: Double = 1) {
        let x0 = max(0, x), y0 = max(0, y), x1 = min(w, x + fw), y1 = min(h, y + fh)
        if x0 >= x1 || y0 >= y1 { return }
        for yy in y0..<y1 {
            for xx in x0..<x1 {
                let i = (yy * w + xx) * 4
                if a >= 1 {
                    data[i] = c.r
                    data[i + 1] = c.g
                    data[i + 2] = c.b
                    data[i + 3] = 255
                } else {
                    data[i] = UInt8((Double(data[i]) * (1 - a) + Double(c.r) * a).rounded())
                    data[i + 1] = UInt8((Double(data[i + 1]) * (1 - a) + Double(c.g) * a).rounded())
                    data[i + 2] = UInt8((Double(data[i + 2]) * (1 - a) + Double(c.b) * a).rounded())
                    data[i + 3] = 255
                }
            }
        }
    }

    /// a filled pixel circle, row by row (the website's disc)
    mutating func disc(_ cx: Double, _ cy: Double, _ r: Int, _ c: RGB, _ a: Double = 1) {
        let x0 = Int(jsRound(cx)), y0 = Int(jsRound(cy))
        for j in -r...r {
            let sj = j == 0 ? 0.0 : (j > 0 ? 0.5 : -0.5)
            let v = Double(r * r) - pow(Double(j) + sj, 2) + Double(r) * 0.6
            if v < 0 { continue }
            let ww = Int(v.squareRoot().rounded(.down))
            fill(x0 - ww, y0 + j, ww * 2 + 1, 1, c, a)
        }
    }

    mutating func ring(_ cx: Double, _ cy: Double, _ r: Double, _ c: RGB) {
        let x0 = Int(jsRound(cx)), y0 = Int(jsRound(cy))
        for k in 0..<40 {
            let t = Double(k) / 40 * .pi * 2
            fill(x0 + Int(jsRound(cos(t) * r)), y0 + Int(jsRound(sin(t) * r)), 1, 1, c)
        }
    }

    var image: CGImage? { Pixels.image(data, w, h) }
}

/* ---------- Coasters ---------- */

enum CoastersArt {
    static let W = Int(Coasters.w), H = Int(Coasters.h)

    /// the coffee table, drawn once: planks, rails, the goal slots, the centre line and circle
    static let table: Raster = {
        var r = Raster(W, H)
        let wood = [RGB("#8a5a3c"), RGB("#83553a"), RGB("#8f5f40"), RGB("#7d5036")]
        for y in 0..<H {
            r.fill(0, y, W, 1, wood[(y / 10) % wood.count])
            if y % 10 == 0 { r.fill(0, y, W, 1, RGB("#5e3c28")) }
        }
        // grain
        for k in 0..<140 {
            let x = (k * 37) % W, y = (k * 53 + k / 3) % H
            if y % 10 != 0 { r.fill(x, y, 2 + k % 3, 1, RGB(60, 36, 24), 0.35) }
        }
        // the play markings
        let line = RGB("#efe3cb")
        let mid = Int(Coasters.mid)
        for x in stride(from: 2, to: W - 2, by: 4) { r.fill(x, mid, 2, 1, line, 0.55) }
        for a in stride(from: 0, to: 48, by: 2) {
            let t = Double(a) / 48 * .pi * 2
            r.fill(Int(jsRound(Double(W) / 2 + cos(t) * 13)), Int(jsRound(Coasters.mid + sin(t) * 13)), 1, 1, line, 0.55)
        }
        for a in 0...24 {
            let t = Double(a) / 24 * .pi
            let x = Int(jsRound(Double(W) / 2 + cos(t) * 20))
            r.fill(x, Int(jsRound(sin(t) * 18)), 1, 1, line, 0.3)
            r.fill(x, Int(jsRound(Double(H) - 1 - sin(t) * 18)), 1, 1, line, 0.3)
        }
        // rails, and the goal slots in the ends
        let rail = RGB("#3a2418")
        r.fill(0, 0, 2, H, rail)
        r.fill(W - 2, 0, 2, H, rail)
        r.fill(0, 0, W, 2, rail)
        r.fill(0, H - 2, W, 2, rail)
        let g0 = Int(Coasters.goalX0), g1 = Int(Coasters.goalX1)
        r.fill(g0, 0, g1 - g0, 3, RGB("#140c0e"))
        r.fill(g0, H - 3, g1 - g0, 3, RGB("#140c0e"))
        for (x, y) in [(g0 - 1, 0), (g1, 0), (g0 - 1, H - 4), (g1, H - 4)] { r.fill(x, y, 1, 4, RGB("#e2b359")) }
        return r
    }()

    static func coaster(_ r: inout Raster, _ x: Double, _ y: Double, _ band: RGB) {
        let R = Int(Coasters.malletR)
        r.disc(x + 1, y + 1, R, RGB(20, 10, 8), 0.45)
        r.disc(x, y, R, RGB("#6b4a2f"))
        r.disc(x, y, R - 1, RGB("#c89a5c"))
        r.ring(x, y, Coasters.malletR - 3, band)
        let xi = Int(jsRound(x)), yi = Int(jsRound(y))
        for (dx, dy) in [(-4, 2), (3, -4), (2, 4)] { r.fill(xi + dx, yi + dy, 1, 1, RGB("#a87a44")) }
        r.disc(x, y, 1, band)
    }

    static func cap(_ r: inout Raster, _ x: Double, _ y: Double) {
        let R = Int(Coasters.puckR)
        r.disc(x + 1, y + 1, R, RGB(20, 10, 8), 0.45)
        r.disc(x, y, R, RGB("#8f2f2b"))
        r.disc(x, y, R - 1, RGB("#c4453f"))
        r.fill(Int(jsRound(x)) - 1, Int(jsRound(y)) - 2, 2, 1, RGB("#f08a80"))
    }

    static let mine = RGB("#b8674f")
    static let theirs = RGB("#8a9a72")
}

struct CoastersGameView: View {
    let place: PlaceModel
    var body: some View {
        LiveHost(place: place, kind: .coasters, rules: Coasters()) { session, now in CoastersBoard(place: place, session: session, now: now) }
    }
}

private struct CoastersBoard: View {
    let place: PlaceModel
    let session: LiveSession<Coasters>
    let now: Double
    /// where your finger is, on the table
    @State private var aim: (x: Double, y: Double)?
    @State private var flash: (who: Side, at: Double)?
    @State private var goals = -1

    var body: some View {
        let s = session.state
        let me = place.mySeat, them = me.other
        let partner = place.theirName
        let live = session.stage(now: now) == .play && s != nil && s?.winner == nil
        let serving = s.map { now < session.local($0.serveAt) && ($0.score[.a] ?? 0) + ($0.score[.b] ?? 0) > 0 } ?? false
        LiveFrame(place: place, session: session, title: "Coasters",
                  howTo: "Air hockey on the coffee table. Move your finger on your half to move your coaster, and knock the bottle cap into \(partner)’s goal. First to \(Coasters.toWin).",
                  playing: say(("You \(s?.score[me] ?? 0) · \(s?.score[them] ?? 0) \(partner)", true), (serving ? " · next serve in a moment…" : "", false)), now: now) {
            table(nil, live: false).frame(maxHeight: 440)
        } content: {
            VStack(spacing: 10) {
                HStack {
                    HStack(spacing: 8) { Text(partner).lineLimit(1).fixedSize(); Pips(won: s?.score[them] ?? 0, of: Coasters.toWin) }
                    Spacer()
                    Text("their goal ↑").font(.pxSmall).opacity(0.7)
                }
                ZStack {
                    table(s, live: live).frame(maxHeight: 440)
                    if let f = flash, now - f.at < 1000 {
                        Text(f.who == me ? "Goal!" : "\(partner) scores").font(.px(30, 700)).foregroundStyle(Color.inkSoft).padding(.horizontal, 20).padding(.vertical, 8).pxCard()
                    }
                }
                HStack {
                    HStack(spacing: 8) { Text("You"); Pips(won: s?.score[me] ?? 0, of: Coasters.toWin) }
                    Spacer()
                    Text("your goal ↓").font(.pxSmall).opacity(0.7)
                }
            }
            .font(.px(16, 700))
            .foregroundStyle(Color.paper)
            .onChange(of: s.map { ($0.score[.a] ?? 0) + ($0.score[.b] ?? 0) }) { _, total in
                guard let total, let s else { return }
                if goals >= 0 && total > goals, let who = s.lastGoal {
                    flash = (who, now)
                    if who == me { Haptics.success() } else { Haptics.soft() }
                }
                goals = total
            }
            .onChange(of: s?.hits) { _, _ in UIImpactFeedbackGenerator(style: .light).impactOccurred(intensity: 0.5) }
        }
    }

    /// the table as you see it: your own goal at the bottom
    private func table(_ s: Coasters.State?, live: Bool) -> some View {
        let me = place.mySeat
        let flip = me == .b
        func view(_ x: Double, _ y: Double) -> (Double, Double) { flip ? (Coasters.w - x, Coasters.h - y) : (x, y) }
        var r = CoastersArt.table
        if let s {
            let age = max(0, (now - session.local(s.t)) / 1000)
            let p = now < session.local(s.serveAt) ? s.puck : Coasters.glide(s.puck, age)
            let mine = s.mal[me]!, other = s.mal[me.other]!
            let target: (x: Double, y: Double) = (x: mine.tx, y: mine.ty)
            let want: (x: Double, y: Double) = live ? (aim ?? target) : target
            let m1 = Coasters.towards(mine.x, mine.y, want.x, want.y, age + 0.05)
            let m2 = Coasters.towards(other.x, other.y, other.tx, other.ty, age)
            let pv = view(p.x, p.y), v1 = view(m1.x, m1.y), v2 = view(m2.x, m2.y)
            CoastersArt.cap(&r, pv.0, pv.1)
            CoastersArt.coaster(&r, v2.0, v2.1, CoastersArt.theirs)
            CoastersArt.coaster(&r, v1.0, v1.1, CoastersArt.mine)
        } else {
            let a = view(Coasters.w / 2, Coasters.h - 22), b = view(Coasters.w / 2, 22)
            CoastersArt.coaster(&r, (me == .a ? a : b).0, (me == .a ? a : b).1, CoastersArt.mine)
            CoastersArt.coaster(&r, (me == .a ? b : a).0, (me == .a ? b : a).1, CoastersArt.theirs)
            let p = view(Coasters.w / 2, Coasters.mid)
            CoastersArt.cap(&r, p.0, p.1)
        }
        let image = r.image
        return GeometryReader { g in
            Group {
                if let image { Image(decorative: image, scale: 1).resizable().interpolation(.none) } else { Color(hex: "#8a5a3c") }
            }
            .contentShape(Rectangle())
            // (ahead of the page scrolling: a finger on the table moves your coaster)
            .highPriorityGesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { v in
                        guard live else { return }
                        let vx = v.location.x / g.size.width * Coasters.w, vy = v.location.y / g.size.height * Coasters.h
                        let t = view(vx, vy)
                        let a = Coasters.reach(me, t.0, t.1)
                        aim = a
                        session.act(Coasters.Act(x: a.x, y: a.y), fast: true)
                    }
            )
        }
        .aspectRatio(Coasters.w / Coasters.h, contentMode: .fit)
        .overlay(Rectangle().strokeBorder(Color(hex: "#1b1411"), lineWidth: 4))
        .accessibilityLabel("The coffee table. Move your finger on your half to move your coaster.")
    }
}

/* ---------- Kitchen Rush ---------- */

enum VegArt {
    static func whole(_ i: Kitchen.Ing) -> Glyph {
        switch i {
        case .tomato:
            return Glyph(["....gg....", "..gGggGg..", ".rrrrrrrr.", "rrRrrrrrrr", "rRrrrrrrrr", "rrrrrrrrrr", "rrrrrrrrrr", ".rrrrrrrr.", "..rrrrrr..", "...rrrr..."], ["r": "#c4453f", "R": "#f08a80", "g": "#4d6b52", "G": "#8a9a72"])
        case .onion:
            return Glyph(["....gg....", "....g.....", "...pPPp...", "..pPppPp..", ".pPpppppp.", ".pppppPpp.", ".pppppppp.", "..pppppp..", "...pppp...", "....ww...."], ["p": "#9c4f6e", "P": "#c98fa6", "g": "#8a9a72", "w": "#e0c9a0"])
        case .carrot:
            return Glyph(["....gG.g..", ".....gGg..", "....ooo...", "....oOo...", "...ooOo...", "...oooo...", "..ooOo....", "..ooo.....", ".ooo......", ".o........"], ["o": "#e07a3a", "O": "#f2a65a", "g": "#4d6b52", "G": "#8a9a72"])
        case .mushroom:
            return Glyph(["...bbbb...", ".bbBbbbbb.", "bbbbbbBbbb", "bBbbbbbbbb", "bbbbbbbbbb", "...cccc...", "...cccc...", "...cCcc...", "...cccc...", "..cccccc.."], ["b": "#8a5a3c", "B": "#c89a5c", "c": "#efe3cb", "C": "#d6c29c"])
        case .potato:
            return Glyph(["..........", "...pppp...", ".ppPpppp..", "ppppppdpp.", "pPpppppppp", "ppppdppppp", "pppppppPpp", ".pppppppp.", "..pppppp..", ".........."], ["p": "#c9a46a", "P": "#e2c48a", "d": "#8a6a36"])
        }
    }

    /// three cut slices: the skin round the edge, the cut face inside
    static func chopped(_ i: Kitchen.Ing) -> Glyph {
        let rows = ["..........", ".xxx......", "xXXXx.xxx.", "xXXXxxXXXx", ".xxx.xXXXx", "......xxx.", "..xxx.....", ".xXXXx....", ".xXXXx....", "..xxx....."]
        switch i {
        case .tomato: return Glyph(rows, ["x": "#c4453f", "X": "#f08a80"])
        case .onion: return Glyph(rows, ["x": "#c98fa6", "X": "#f1dde6"])
        case .carrot: return Glyph(rows, ["x": "#e07a3a", "X": "#f2c27a"])
        case .mushroom: return Glyph(rows, ["x": "#c89a5c", "X": "#efe3cb"])
        case .potato: return Glyph(rows, ["x": "#e2c48a", "X": "#fff1c9"])
        }
    }

    static let steam = Glyph([".w...w...w.", "w...w...w..", ".w...w...w.", "..w...w...w", ".w...w...w.", "w...w...w.."], ["w": "#e7dcc6"])
    static let flame = Glyph(["....r......", "...rr...r..", "..ryr..rr..", ".ryyrr.ryr.", ".ryyyrryyr.", "rryyyyyyyrr"], ["r": "#c4453f", "y": "#ffd76a"])

    static func a(_ i: Kitchen.Ing) -> String { i == .onion ? "an onion" : "a \(i.name.lowercased())" }
}

private struct TicketBar: View {
    let k: Double
    let color: Color
    var height: CGFloat = 8
    var body: some View {
        GeometryReader { g in
            ZStack(alignment: .leading) {
                Color.inkSoft.opacity(0.18)
                color.frame(width: g.size.width * max(0, min(1, k)))
            }
        }
        .frame(height: height)
        .overlay(Rectangle().strokeBorder(Color.inkSoft.opacity(0.35), lineWidth: 2))
    }
}

struct KitchenGameView: View {
    let place: PlaceModel
    var body: some View {
        LiveHost(place: place, kind: .kitchen, rules: Kitchen()) { session, now in KitchenBoard(place: place, session: session, now: now) }
    }
}

private struct KitchenBoard: View {
    let place: PlaceModel
    let session: LiveSession<Kitchen>
    let now: Double
    @State private var toast: (text: String, at: Double)?
    @State private var seenNews: Double = 0

    var body: some View {
        let s = session.state
        // the times in the game are by the host's clock: this screen's now, on the host's terms
        let hostNow = session.hostTime(now)
        let live = session.stage(now: now) == .play && s != nil && s?.over == false && hostNow < (s?.endsAt ?? 0)
        let chopper = s?.chop == place.mySeat
        let partner = place.theirName
        let left = s.map { hostNow < $0.startAt ? Kitchen.shiftMs : $0.endsAt - hostNow } ?? Kitchen.shiftMs
        let role = s == nil ? "" : chopper ? "You’re chopping. \(partner)’s cooking." : "You’re cooking. \(partner)’s chopping."
        let tally = s.map { $0.missed + $0.burnt > 0 ? " (\($0.missed) gave up, \($0.burnt) burnt.)" : "" } ?? ""
        LiveFrame(place: place, session: session, title: "Kitchen Rush",
                  howTo: "One of you chops, the other cooks. Chop what the tickets need, put it in the pot, cook it and serve it before the ticket runs out. Ninety seconds, on the same side.",
                  playing: say((role, true), (" Served \(s?.served ?? 0) · \(clock(left)) left", false)), now: now,
                  outcome: { r in say(("Shift over!", true), (" You \(r.line).\(tally)", false)) },
                  coop: { side in note(side, s, hostNow) }) {
            HStack(spacing: 10) { ForEach(Kitchen.Ing.allCases, id: \.self) { GlyphView(glyph: VegArt.whole($0), scale: 5) } }.padding(.vertical, 20)
        } content: {
            VStack(spacing: 14) {
                if let s {
                    tickets(s, hostNow)
                    if chopper { chopStation(s, live) } else { cookStation(s, live, hostNow) }
                }
            }
            .overlay(alignment: .bottom) {
                if let t = toast, now - t.at < 2200 {
                    Text(t.text).font(.px(15, 700)).foregroundStyle(Color.inkSoft).multilineTextAlignment(.center).padding(.horizontal, 14).padding(.vertical, 8).pxCard().padding(.bottom, 8)
                        .allowsHitTesting(false)
                }
            }
            .onChange(of: s?.news?.at) { _, at in
                guard let at, let n = s?.news else { return }
                if seenNews != 0 && at != seenNews {
                    switch n.kind {
                    case "served":
                        toast = ("\(n.dish?.name ?? "That"), served!", now)
                        Haptics.success()
                    case "wrong":
                        toast = ("That’s not on any ticket. Into the bin it goes.", now)
                        Haptics.soft()
                    case "burnt":
                        toast = ("Burnt! The pot was left on too long.", now)
                        Haptics.soft()
                    default:
                        toast = ("A customer gave up on their \(n.dish?.name.lowercased() ?? "order").", now)
                        Haptics.soft()
                    }
                }
                seenNews = at
            }
            .onAppear { seenNews = s?.news?.at ?? 1 }
        }
    }

    private func clock(_ ms: Double) -> String {
        let s = max(0, Int((ms / 1000).rounded(.up)))
        return "\(s / 60):\(String(format: "%02d", s % 60))"
    }

    private func note(_ side: Side, _ s: Kitchen.State?, _ hostNow: Double) -> String {
        guard let s else { return "" }
        if side == s.chop {
            guard let b = s.board else { return "Chopping" }
            return b.chops >= Kitchen.chops ? "Waiting for room on the pass" : "Chopping \(VegArt.a(b.ing)) (\(b.chops)/\(Kitchen.chops))"
        }
        switch Kitchen.potState(s, now: hostNow) {
        case .cooking: return "Cooking…"
        case .done: return "Ready to serve!"
        case .burning: return "It’s burning!"
        case .filling: return "Filling the pot"
        case .empty: return "Cooking"
        }
    }

    private func tickets(_ s: Kitchen.State, _ hostNow: Double) -> some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
            ForEach(s.orders, id: \.id) { o in
                let left = o.until - hostNow
                VStack(alignment: .leading, spacing: 6) {
                    Text(o.dish.name).font(.px(15, 700)).foregroundStyle(Color.inkSoft).lineLimit(1).minimumScaleFactor(0.8)
                    HStack(spacing: 4) { ForEach(Array(o.dish.needs.enumerated()), id: \.offset) { _, i in GlyphView(glyph: VegArt.whole(i), scale: 2.6) } }
                    TicketBar(k: left / Kitchen.patienceMs, color: left < 12_000 ? Color(hex: "#c4453f") : left < 25_000 ? Color(hex: "#e2b359") : Color(hex: "#8a9a72"))
                }
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .pxBox()
            }
            if s.orders.isEmpty {
                Text("No orders right now. Get ahead: chop some onions.").font(.pxSmall).foregroundStyle(Color.inkSoft).padding(10).frame(maxWidth: .infinity).pxBox()
            }
        }
    }

    private func pass(_ s: Kitchen.State, _ live: Bool, chopper: Bool) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("The pass \(chopper ? "(\(place.theirName) takes from here)" : "(tap one to put it in the pot)") · \(s.pass.count)/\(Kitchen.passMax)").font(.pxSmall).foregroundStyle(Color.paper.opacity(0.85))
            HStack(spacing: 10) {
                ForEach(0..<Kitchen.passMax, id: \.self) { k in
                    let ing = k < s.pass.count ? s.pass[k] : nil
                    let can = !chopper && live && ing != nil && s.cookStart == nil && s.pot.count < Kitchen.potMax
                    Button {
                        Haptics.tap()
                        session.act(.add(k))
                    } label: {
                        ZStack {
                            (ing != nil ? Color(hex: "#efe3cb") : Color.paper.opacity(0.12))
                            if let ing { GlyphView(glyph: VegArt.chopped(ing), scale: 4) }
                        }
                        .frame(height: 60)
                        .overlay(Rectangle().strokeBorder(Color(hex: "#1b1411"), lineWidth: 3))
                    }
                    .buttonStyle(.plain)
                    .disabled(!can)
                    .accessibilityLabel(ing.map { "Put the chopped \($0.name.lowercased()) in the pot" } ?? "Empty spot on the pass")
                }
            }
        }
    }

    private func chopStation(_ s: Kitchen.State, _ live: Bool) -> some View {
        VStack(spacing: 14) {
            HStack(spacing: 6) {
                ForEach(Kitchen.Ing.allCases, id: \.self) { ing in
                    Button {
                        Haptics.tap()
                        session.act(.take(ing))
                    } label: {
                        VStack(spacing: 2) {
                            GlyphView(glyph: VegArt.whole(ing), scale: 3.4)
                            Text(ing.name).font(.px(11, 700)).foregroundStyle(Color.inkSoft).lineLimit(1).minimumScaleFactor(0.7)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                        .pxBox()
                    }
                    .buttonStyle(.plain)
                    .disabled(!live || s.board != nil)
                    .opacity(!live || s.board != nil ? 0.6 : 1)
                    .accessibilityLabel("Take \(VegArt.a(ing)) from the crate")
                }
            }
            PressPad(enabled: live && s.board != nil, onPress: {
                guard let b = s.board, b.chops < Kitchen.chops else { return }
                UIImpactFeedbackGenerator(style: .rigid).impactOccurred(intensity: 0.7)
                session.act(.chop)
            }) {
                VStack(spacing: 8) {
                    if let b = s.board {
                        GlyphView(glyph: b.chops >= Kitchen.chops ? VegArt.chopped(b.ing) : VegArt.whole(b.ing), scale: 7).rotationEffect(.degrees(Double(b.chops * 8 - 12)))
                        Text(b.chops >= Kitchen.chops ? "Chopped! Waiting for room on the pass" : "CHOP! \(b.chops)/\(Kitchen.chops)").font(.px(18, 700))
                    } else {
                        Text("Take something from a crate").font(.px(18, 700)).opacity(0.8)
                    }
                }
                .foregroundStyle(Color(hex: "#2b1e1c"))
                .frame(maxWidth: .infinity)
                .frame(height: 150)
                .background(Color(hex: "#c89a5c"))
                .overlay(alignment: .bottom) { Color(hex: "#a87a44").frame(height: 6) }
                .overlay(Rectangle().strokeBorder(Color(hex: "#1b1411"), lineWidth: 4))
            }
            .accessibilityLabel("Chop")
            HStack {
                Text("Tap the board to chop.").font(.pxSmall).foregroundStyle(Color.paper.opacity(0.8))
                Spacer()
                if s.board != nil { Button("Put it back") { session.act(.toss) }.buttonStyle(.px(.paper, small: true)).disabled(!live) }
            }
            pass(s, live, chopper: true)
        }
    }

    private func cookStation(_ s: Kitchen.State, _ live: Bool, _ hostNow: Double) -> some View {
        let pot = Kitchen.potState(s, now: hostNow)
        return VStack(spacing: 14) {
            pass(s, live, chopper: false)
            VStack(spacing: 10) {
                Text("The pot · \(s.pot.count)/\(Kitchen.potMax)").font(.pxSmall).foregroundStyle(Color.paper.opacity(0.85))
                ZStack {
                    Color(hex: "#4a4548")
                    VStack(spacing: 0) {
                        Spacer()
                        Color(hex: "#343033").frame(height: 8)
                    }
                    HStack(spacing: 6) { ForEach(Array(s.pot.enumerated()), id: \.offset) { _, i in GlyphView(glyph: VegArt.chopped(i), scale: 4) } }
                }
                .frame(width: 220, height: 92)
                .overlay(Rectangle().strokeBorder(Color(hex: "#1b1411"), lineWidth: 3))
                .overlay(alignment: .top) {
                    if pot == .cooking || pot == .done || pot == .burning {
                        GlyphView(glyph: pot == .burning ? VegArt.flame : VegArt.steam, scale: 4).modifier(Blink(on: pot == .burning)).offset(y: -30)
                    }
                }
                .padding(.top, 24)
                if pot == .cooking, let c = s.cookStart { TicketBar(k: (hostNow - c) / Kitchen.cookMs, color: Color(hex: "#e2b359"), height: 10).frame(width: 220) }
                HStack(spacing: 10) {
                    Button("Cook") {
                        Haptics.tap()
                        session.act(.cook)
                    }
                    .buttonStyle(.px(.sage))
                    .disabled(!live || pot != .filling)
                    Button("Serve") {
                        Haptics.tap()
                        session.act(.serve)
                    }
                    .buttonStyle(.px(.terracotta))
                    .disabled(!live || (pot != .done && pot != .burning))
                    Button("Bin it") { session.act(.bin) }
                        .buttonStyle(.px(.paper))
                        .disabled(!live || pot == .empty)
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity)
            .background(Color(hex: "#2b2224"))
            .overlay(Rectangle().strokeBorder(pot == .burning ? Color(hex: "#c4453f") : Color(hex: "#1b1411"), lineWidth: 4))
        }
    }
}
