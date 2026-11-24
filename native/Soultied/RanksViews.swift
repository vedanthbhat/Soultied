import SwiftUI
import SoultiedCore

/*
 * The couples board (shared with the website's CouplesBoard.tsx): a card on Play, and a sheet with the boards
 * (the fire, Kitchen Rush and Doodle Guess this week and ever, and each escape room) and going on them together.
 * Nobody's on a board until both of you say yes, and all it shows is your two characters, a couple name Soultied
 * makes up from two words, and the numbers.
 */

/// the boards' tabs
private enum RankTab: String, CaseIterable, Identifiable {
    case fire, kitchen, doodle, escape
    var id: String { rawValue }
    var title: String {
        switch self {
        case .fire: return "The fire"
        case .kitchen: return "Kitchen Rush"
        case .doodle: return "Doodle Guess"
        case .escape: return "Escape rooms"
        }
    }
}

/// what a board counts, in a line
private func blurb(_ id: BoardId) -> String {
    switch id {
    case .fire: return "Days in a row you’ve both shown up."
    case .kitchenWeek: return "Most orders served in one shift, this week (from Monday)."
    case .kitchenAll: return "Most orders served in one shift, ever."
    case .doodleWeek: return "Most drawings guessed in one game, this week (from Monday)."
    case .doodleAll: return "Most drawings guessed in one game, ever."
    default: return "Fastest way out, together."
    }
}

/// how to get onto a board you're not on yet
private func hint(_ id: BoardId) -> String {
    switch id {
    case .fire: return "Both show up today and your fire starts."
    case .kitchenWeek, .kitchenAll: return "Play a shift of Kitchen Rush together."
    case .doodleWeek, .doodleAll: return "Play a game of Doodle Guess together."
    default: return "Find your way out of this room together."
    }
}

private func roomName(_ r: RoomId) -> String { r.rawValue.prefix(1).uppercased() + r.rawValue.dropFirst() }

/// the board on Play: what's happening with it, and a way in
struct RanksCard: View {
    let place: PlaceModel
    var open: () -> Void

    private var hot: Bool { place.rankStage == .askedMe }

    private var line: (kicker: String, title: String) {
        let them = place.theirName
        let name = place.ranksDoc.name?.text ?? ""
        switch place.rankStage {
        case .off: return ("COUPLES BOARD", "How do the two of you stack up?")
        case .asked: return ("COUPLES BOARD", "Waiting for \(them) to say yes")
        case .askedMe: return ("\(them.uppercased()) ASKED", "Go on the couples board as \(name)?")
        case .on: return ("COUPLES BOARD", "You’re on it as \(name)")
        }
    }

    var body: some View {
        let l = line
        Button {
            Haptics.tap()
            open()
        } label: {
            HStack(spacing: 12) {
                GlyphView(glyph: Icons.trophy, scale: 3.5).nudge(hot, every: 3.5).twinkle(period: 2.8)
                VStack(alignment: .leading, spacing: 3) {
                    Text(l.kicker).font(.px(11, 700)).kerning(1.4).foregroundStyle(Color.butter).lineLimit(1).minimumScaleFactor(0.7)
                    Text(l.title).font(.px(16, 700)).foregroundStyle(Color.paper).lineLimit(2).minimumScaleFactor(0.8).fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
                Text("→").font(.px(18, 700)).foregroundStyle(Color.paper.opacity(0.8))
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                ZStack {
                    NotchedFrame(notch: PX).fill(hot ? Color.butter : Color.ink).padding(-PX)
                    LinearGradient(colors: [Color(hex: "#5a4636"), Color(hex: "#3f3026")], startPoint: .topLeading, endPoint: .bottomTrailing)
                    VStack(spacing: 0) {
                        Rectangle().fill(Color.white.opacity(0.14)).frame(height: PX)
                        Spacer(minLength: 0)
                        Rectangle().fill(Color.black.opacity(0.3)).frame(height: PX * 1.5)
                    }
                }
                .padding(PX)
            )
            .shadow(color: hot ? Color.butter.opacity(0.35) : .clear, radius: 8)
        }
        .buttonStyle(.press)
        .accessibilityLabel("\(l.kicker.capitalized): \(l.title)")
    }
}

struct RanksSheet: View {
    let place: PlaceModel
    @State private var tab: RankTab = .fire
    @State private var thisWeek = true
    @State private var room: RoomId = .attic
    @State private var rows: [BoardRow]?
    @State private var failed = false
    /// picking a name (to ask with, or a new one)
    @State private var choosing = false
    @State private var names: [RankName] = []
    @State private var pick: RankName?
    @State private var confirmLeave = false

    private var board: BoardId {
        switch tab {
        case .fire: return .fire
        case .kitchen: return thisWeek ? .kitchenWeek : .kitchenAll
        case .doodle: return thisWeek ? .doodleWeek : .doodleAll
        case .escape: return BoardId(rawValue: "esc-\(room.rawValue)") ?? .escAttic
        }
    }

    var body: some View {
        MenuScroll {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Couples board").font(.pxTitle).foregroundStyle(Color.inkSoft)
                    Text("How the two of you stack up against other couples on Soultied.").font(.pxSmall).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
                }
                joinCard
                tabs
                list
            }
            .padding(18)
            .padding(.bottom, 30)
        }
        .task(id: board) { await load() }
        // (your own line goes up a moment after you're both on, and changes with your name)
        .onChange(of: place.rankStage) { _, _ in reloadSoon() }
        .onChange(of: place.ranksDoc.name) { _, _ in reloadSoon() }
        .confirmationDialog("Take the two of you off the board?", isPresented: $confirmLeave, titleVisibility: .visible) {
            Button("Take us off", role: .destructive) {
                place.leaveRanks()
                Haptics.tap()
                reloadSoon()
            }
        } message: {
            Text("Your line comes off every board straight away, for both of you. You can go back on together any time.")
        }
    }

    private func reloadSoon() {
        Task {
            try? await Task.sleep(nanoseconds: 700_000_000)
            await load(quiet: true)
        }
    }

    private func load(quiet: Bool = false) async {
        if !quiet {
            rows = nil
            failed = false
        }
        let r = await place.board(board)
        failed = r == nil
        rows = r ?? rows
    }

    /* ---------- going on the board ---------- */

    @ViewBuilder
    private var joinCard: some View {
        let them = place.theirName
        let name = place.ranksDoc.name?.text ?? ""
        VStack(alignment: .leading, spacing: 10) {
            if !place.partnerHere {
                Text("Once \(them) moves in, you can go on the board together.").font(.pxBody).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
            } else {
                switch place.rankStage {
                case .off:
                    Text("Put the two of you on the board?").font(.pxBodyBold).foregroundStyle(Color.inkSoft)
                    Text("Only your two characters and a couple name show: no names, no photos, nothing you’ve written. You go on once you’ve both said yes.")
                        .font(.pxSmall).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
                    if choosing {
                        chooser(button: "Ask \(them)") { n in
                            place.askRanks(n)
                            Haptics.success()
                            choosing = false
                        }
                    } else {
                        Button("Pick our couple name") { startChoosing() }.buttonStyle(.px(.terracotta, small: true, wide: true))
                    }
                case .asked:
                    Text("Waiting for \(them) to say yes to “\(name)”.").font(.pxBody).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
                    Button("Take it back") {
                        place.leaveRanks()
                        Haptics.tap()
                    }
                    .buttonStyle(.px(.paper, small: true))
                case .askedMe:
                    Text("\(them) wants the two of you on the board as “\(name)”.").font(.pxBodyBold).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
                    Text("Only your two characters and that name show: no names, no photos, nothing you’ve written.")
                        .font(.pxSmall).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
                    HStack(spacing: 8) {
                        Button("Not now") {
                            place.answerRanks(false)
                            Haptics.tap()
                        }
                        .buttonStyle(.px(.paper, small: true, wide: true))
                        Button("Yes, put us on") {
                            place.answerRanks(true)
                            Haptics.success()
                        }
                        .buttonStyle(.px(.terracotta, small: true, wide: true))
                    }
                    .evenRow()
                case .on:
                    Text("You’re on the board as “\(name)”.").font(.pxBodyBold).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
                    if choosing {
                        chooser(button: "Use this name") { n in
                            place.renameRanks(n)
                            Haptics.success()
                            choosing = false
                        }
                    } else {
                        HStack(spacing: 8) {
                            Button("Change our name") { startChoosing() }.buttonStyle(.px(.paper, small: true, wide: true))
                            Button("Take us off") { confirmLeave = true }.buttonStyle(.px(.paper, small: true, wide: true))
                        }
                        .evenRow()
                    }
                }
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pxInset()
    }

    /// three made-up names (none already on the board you're looking at)
    private func startChoosing() {
        Haptics.select()
        let taken = Set((rows ?? []).map(\.name))
        names = Array(Ranks.suggest(systemRandom, count: 8, avoid: place.ranksDoc.name.map { [$0] } ?? []).filter { !taken.contains($0.text) }.prefix(3))
        pick = names.first
        withAnimation(.easeOut(duration: 0.2)) { choosing = true }
    }

    /// three made-up names to pick from, more if none of them is you, and the button
    private func chooser(button: String, done: @escaping (RankName) -> Void) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(names, id: \.self) { n in
                Button {
                    pick = n
                    Haptics.select()
                } label: {
                    HStack {
                        Text(n.text)
                        Spacer(minLength: 0)
                        if pick == n { GlyphView(glyph: Icons.check, scale: 2) }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.px(pick == n ? .sage : .paper, small: true, wide: true))
            }
            HStack(spacing: 8) {
                Button("Other names") { startChoosing() }.buttonStyle(.px(.paper, small: true, wide: true))
                Button(button) { if let p = pick { done(p) } }
                    .buttonStyle(.px(.terracotta, small: true, wide: true))
                    .disabled(pick == nil)
            }
            .evenRow()
            Button("Cancel") { withAnimation(.easeOut(duration: 0.2)) { choosing = false } }
                .font(.pxSmall).foregroundStyle(Color.muted)
        }
        .transition(.opacity)
    }

    /* ---------- the boards ---------- */

    private var tabs: some View {
        VStack(alignment: .leading, spacing: 8) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(RankTab.allCases) { t in
                        Button(t.title) {
                            tab = t
                            Haptics.select()
                        }
                        .buttonStyle(.px(tab == t ? .terracotta : .paper, small: true))
                    }
                }
                .padding(4)
            }
            if tab == .kitchen || tab == .doodle {
                HStack(spacing: 8) {
                    Button("This week") { thisWeek = true }.buttonStyle(.px(thisWeek ? .sage : .paper, small: true))
                    Button("All time") { thisWeek = false }.buttonStyle(.px(thisWeek ? .paper : .sage, small: true))
                }
                .padding(.horizontal, 4)
            }
            if tab == .escape {
                HStack(spacing: 6) {
                    ForEach(Ranks.escapeRooms) { r in
                        Button(roomName(r)) { room = r }.buttonStyle(.px(room == r ? .sage : .paper, small: true))
                    }
                }
                .padding(.horizontal, 4)
            }
            Text(blurb(board)).font(.pxSmall).foregroundStyle(Color.muted).padding(.horizontal, 4)
        }
    }

    @ViewBuilder
    private var list: some View {
        if let rows {
            VStack(spacing: 8) {
                if rows.isEmpty {
                    Text("Nobody’s on this board yet.").font(.pxBody).foregroundStyle(Color.muted).frame(maxWidth: .infinity, alignment: .leading).padding(12).pxInset()
                }
                ForEach(rows) { r in row(r) }
                if place.rankStage == .on, !rows.contains(where: \.mine) { mineBelow }
            }
        } else if failed {
            Text("The board didn’t load. Check your connection and try again.").font(.pxBody).foregroundStyle(Color(hex: "#7f3835")).padding(12).pxInset()
        } else {
            HStack {
                Spacer()
                ProgressView().tint(Color.terracotta)
                Spacer()
            }
            .padding(30)
        }
    }

    /// your own line, when it's not in the top 50 (or not on this board yet)
    private var mineBelow: some View {
        let v = place.rankEntry.flatMap { Ranks.value(board, $0.doc, today: place.today, now: Values.nowMs()) }
        return VStack(alignment: .leading, spacing: 2) {
            Text(v.map { "You two: \(Ranks.valueText(board, $0))" } ?? "You two aren’t on this board yet").font(.pxBodyBold).foregroundStyle(Color.inkSoft)
            Text(v == nil ? hint(board) : "Not in the top \(Ranks.limit) yet. Keep going!").font(.pxSmall).foregroundStyle(Color.muted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color(hex: "#fff1dc"))
        .overlay { Rectangle().strokeBorder(Color.terracotta, lineWidth: 3) }
    }

    private func row(_ r: BoardRow) -> some View {
        let medal: Color? = r.rank == 1 ? Color(hex: "#e2b359") : r.rank == 2 ? Color(hex: "#b9b3a8") : r.rank == 3 ? Color(hex: "#c98a5a") : nil
        return HStack(spacing: 10) {
            Text("\(r.rank)")
                .font(.px(15, 700))
                .foregroundStyle(medal != nil ? Color.ink : Color.muted)
                .frame(width: 30, height: 30)
                .background(medal ?? Color.clear)
            // (the two of them, cut out: head and shoulders, nothing behind)
            HStack(spacing: -3) {
                BustView(look: r.looks.0, size: 40)
                BustView(look: r.looks.1, size: 40)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(r.name).font(.pxBodyBold).foregroundStyle(Color.inkSoft).lineLimit(2).minimumScaleFactor(0.85).fixedSize(horizontal: false, vertical: true)
                if r.mine { Text("You two").font(.pxTiny).foregroundStyle(Color.terracottaD) }
            }
            Spacer(minLength: 4)
            Text(r.text).font(.px(15, 700)).foregroundStyle(Color.inkSoft).lineLimit(1)
        }
        .padding(8)
        .background(r.mine ? Color(hex: "#fff1dc") : Color.paperHi)
        .overlay { Rectangle().strokeBorder(r.mine ? Color.terracotta : Color.paperShade, lineWidth: 3) }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Number \(r.rank): \(r.name)\(r.mine ? ", you two" : ""), \(r.text)")
    }
}
