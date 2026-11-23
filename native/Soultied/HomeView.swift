import SwiftUI
import SoultiedCore

/*
 * Home: the room, close in on the two of you, fills the first screen: the pictures over the couch (your
 * wall), the couch with your moods over your heads, the coffee table with today's letter, the record
 * player. Everything in it can be tapped. Your names sit just under it; scroll down for the touches you can
 * send and a card each for today's letter, the wall, the streak and the record player (up top while
 * something's playing).
 */

struct HomeView: View {
    let place: PlaceModel
    var paused = false
    /// Home is what's on screen (a song from YouTube plays in its card only then)
    var listening = true
    var go: (AppTab) -> Void
    var onRoom: (HotspotId) -> Void
    var invite: () -> Void
    var openGame: (GameKind) -> Void = { _ in }
    @Environment(\.displayScale) private var displayScale
    /// on FaceTime: its little window sits in the top corner, so the jar of stitches moves out of its way

    var body: some View {
        GeometryReader { geo in
            ScrollViewReader { scroller in
                ScrollView {
                    VStack(spacing: 0) {
                        header
                            .id("top")
                        RoomScene(place: place, couchOnly: true, crop: .home, paused: paused, tourSpots: true, onTap: onRoom)
                            .frame(height: heroHeight(geo.size))
                            .overlay(alignment: .bottom) { Rectangle().fill(Color.ink).frame(height: PX) }
                            // (added to the spots inside it, which a plain anchorPreference would replace)
                            .transformAnchorPreference(key: TourSpots.self, value: .bounds) { $0["room"] = $1 }
                        nameplates
                        if place.wallNews != nil {
                            WallCard(place: place, open: { onRoom(.board) }).padding(.horizontal, 16)
                        }

                        VStack(spacing: 18) {
                            // (before your person's here: their seat comes first)
                            if !place.partnerHere && !place.isDemo { SeatCard(place: place, invite: invite).popIn() }
                            // (the cards come in one after another as Home opens)
                            touches.id("touches").popIn()
                            // would you like a nudge when they've been by? (Push.swift)
                            PushAskCard(place: place).popIn(0.04)
                            // one more quick question about the two of you, a day at a time (AboutViews.swift)
                            QuickAskCard(place: place).popIn(0.05)
                            if place.partnerHere { SnapCard(place: place).id("snap").popIn(0.06) }
                            // (counting down to a day: near the top; no day set yet: a nudge further down)
                            if place.partnerHere && place.visitDays != nil { CountdownCard(place: place).id("countdown").popIn(0.12) }
                            if place.recordOn { RecordCard(place: place, listening: listening, open: { onRoom(.music) }).popIn(0.14) }
                            LetterCard(place: place, open: place.partnerHere ? { go(.letters) } : invite).popIn(0.18)
                            AsksCard(place: place, open: { go(.letters) }).popIn(0.22)
                            // what you were part way through: one tap carries on in Watch (TapeViews.swift)
                            ContinueCard(place: place) { t in
                                WatchCue.shared.tape = t
                                go(.watch)
                            }
                            .id("continue").popIn(0.23)
                            PetHomeCard(place: place, open: { onRoom(.pet) }).id("pet").popIn(0.24)
                            GameCard(place: place, open: openGame).popIn(0.26)
                            if place.wallNews == nil { WallCard(place: place, open: { onRoom(.board) }).popIn(0.3) }
                            StreakCard(place: place).popIn(0.34)
                            if !place.recordOn { RecordCard(place: place, open: { onRoom(.music) }).popIn(0.38) }
                            CouchCard(place: place, invite: invite).popIn(0.42)
                            if place.partnerHere && place.visitDays == nil { CountdownCard(place: place).popIn(0.46) }
                        }
                        .padding(.horizontal, 16)
                        // (close under your names, so the touches show on the first screen, above the tabs)
                        .padding(.top, 10)
                        .padding(.bottom, 120)
                    }
                }
                .scrollIndicators(.hidden)
                .onAppear {
                    if let to = Launch.scrollHome { DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { scroller.scrollTo(to, anchor: .top) } }
                }
                // the tour points at things in the room, so start it from the top
                .onChange(of: Tour.shared.active) { _, on in
                    if on { scroller.scrollTo("top", anchor: .top) }
                }
            }
        }
        .background(RoomBackground())
    }

    /// the room fills the first screen, leaving room for your names under it and a peek at what's below
    private func heroHeight(_ size: CGSize) -> CGFloat {
        let below: CGFloat = 52 + 58 + 70
        return RoomCrop.home.viewHeight(width: size.width, maxHeight: max(200, size.height - below), displayScale: displayScale)
    }

    private var header: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 0) {
                Text(place.space?.name ?? "Our Little Place").font(.px(22, 700)).foregroundStyle(Color.paper).lineLimit(1)
                if let d = place.daysTogether, d > 0 {
                    CountUp(value: d) { "\($0.formatted()) days together" }.font(.pxTiny).foregroundStyle(Color.paper.opacity(0.65))
                }
            }
            Spacer()
            Button {
                onRoom(.decor)
            } label: {
                // the jar of stitches you've earned: spend them on the room
                HStack(spacing: 6) {
                    GlyphView(glyph: Icons.brush, scale: 2)
                    GlyphView(glyph: Icons.stitch, scale: 3).twinkle(period: 2.6)
                    CountUp(value: place.stitches).font(.px(16, 700)).foregroundStyle(Color.inkSoft)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .pxBox()
            }
            .accessibilityLabel("\(place.stitches) stitches. Decorate the room.")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    /// your names, just under the couch: tap yourself for your mood, your person to send a touch
    private var nameplates: some View {
        let s = place.seats
        return HStack(alignment: .top, spacing: 10) {
            plate(s.left, place.hostId, .left)
            plate(s.right, place.guestId, .right)
        }
        .padding(.horizontal, 12)
        .padding(.top, 8)
        .transformAnchorPreference(key: TourSpots.self, value: .bounds) { $0["names"] = $1 }
    }

    @ViewBuilder
    private func plate(_ seat: Seat, _ uid: String?, _ id: HotspotId) -> some View {
        let mine = uid == place.me
        let mood = place.moods.current(uid, now: place.now.timeIntervalSince1970 * 1000)
        let line: String = {
            if seat.status == .empty { return "Saving a seat for \(place.theirName)" }
            if mine { return mood.map { $0.line } ?? "How are you feeling?" }
            return mood.map { $0.line } ?? (seat.status == .online ? "here now" : "send a hug")
        }()
        Button {
            onRoom(id)
        } label: {
            VStack(alignment: id == .left ? .leading : .trailing, spacing: 1) {
                HStack(spacing: 5) {
                    if seat.status == .online && !mine {
                        Rectangle().fill(Color.sage).frame(width: 7, height: 7).beat(every: 1.8, amount: 0.35)
                    }
                    Text(seat.status == .empty ? "An empty seat" : seat.name).font(.px(14, 700)).foregroundStyle(Color.inkSoft)
                }
                Text(line).font(.px(12)).foregroundStyle(Color.muted).lineLimit(1)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .frame(maxWidth: .infinity, alignment: id == .left ? .leading : .trailing)
            .pxBox()
        }
        .accessibilityLabel(seat.status == .empty ? "Invite \(place.theirName)" : mine ? "You. \(line)" : "\(seat.name). \(line)")
    }

    private var touches: some View {
        VStack(alignment: .leading, spacing: 8) {
            if place.partnerHere {
                HStack {
                    Text("Send \(place.theirName)").font(.px(16, 700)).foregroundStyle(Color.paper)
                    Spacer()
                    if let t = place.lastSent {
                        Text("you sent \(touchDef(t.kind).one) · \(ago(t.at))").font(.pxTiny).foregroundStyle(Color.paper.opacity(0.6))
                    }
                }
                TouchButtons(place: place, compact: true)
                HoldBar(place: place).padding(.top, 4)
            }
        }
    }

    private func ago(_ ms: Double) -> String {
        Activity(id: "", type: "", title: "", description: "", at: Values.iso(Date(timeIntervalSince1970: ms / 1000))).ago(now: place.now).lowercased()
    }
}

/* ---------- today's letter ---------- */

struct LetterCard: View {
    let place: PlaceModel
    var open: () -> Void

    var body: some View {
        let d = place.letter(.daily)
        let mine = d.sealed(place.me)
        let theirs = place.them.map { d.sealed($0) } ?? false
        let name = place.theirName
        let (title, line, button): (String, String, String) = {
            if !place.partnerHere {
                return ("Today’s letter", "Letters start once \(name) moves in. Every day you’ll both get five quick cards, answer them in secret, and open them together.", "Send the invite")
            }
            if d.opened, let t = place.them {
                let s = scoreDay(d, me: place.me, them: t)
                let unseen = d.by[place.me]?.seenAt == nil
                return (unseen ? "Your letter is open!" : "Opened together", "In sync on \(s.same) of \(s.total).\(s.myGuesses.total > 0 ? " You read \(name)’s mind \(s.myGuesses.right) of \(s.myGuesses.total) times." : "")", unseen ? "Read it together" : "See it again")
            }
            if mine { return ("Sealed and waiting", "It opens for both of you the moment \(name) seals theirs.", "Look at it") }
            if theirs { return ("\(name) has sealed theirs", "Five little questions are waiting. Answer yours and it opens straight away.", "Open today’s letter") }
            return ("Today’s letter", "Five little questions, about two minutes. Answer in secret; it opens when you’ve both sealed.", "Open today’s letter")
        }()
        Button(action: open) {
            HStack(alignment: .top, spacing: 14) {
                GlyphView(glyph: d.opened ? Icons.heart : mine ? Icons.seal : Icons.envelope, scale: 4)
                    // (waiting on you: the envelope sways, and wiggles once your person has sealed theirs; just
                    // opened: the heart beats)
                    .sway(lift: 3, tilt: 3, period: 2.6, active: place.partnerHere && !d.opened && !mine)
                    .nudge(place.partnerHere && theirs && !mine && !d.opened, every: 4)
                    .beat(d.opened && d.by[place.me]?.seenAt == nil)
                    .frame(width: 60)
                    .padding(.top, 4)
                VStack(alignment: .leading, spacing: 6) {
                    Text(title).font(.pxHeading).foregroundStyle(Color.inkSoft).multilineTextAlignment(.leading)
                    Text(line).font(.pxBody).foregroundStyle(Color.muted).multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                    Text(button + " →").font(.px(16, 700)).foregroundStyle(Color.terracottaD).padding(.top, 2)
                }
                Spacer(minLength: 0)
            }
            .pxCard()
        }
        .buttonStyle(.press)
    }
}

/// a question your person asked you (or one that's just opened)
struct AsksCard: View {
    let place: PlaceModel
    var open: () -> Void
    var body: some View {
        let v = place.asksView
        if let a = v.forMe.first {
            Button(action: open) {
                HStack(alignment: .top, spacing: 14) {
                    if let l = place.theirLook { BustView(look: l, size: 48).nudge(every: 4, phase: 0.3) }
                    VStack(alignment: .leading, spacing: 6) {
                        Text("\(place.theirName) asked you").font(.px(14, 600)).foregroundStyle(Color.muted)
                        Text(a.prompt).font(.pxBodyBold).foregroundStyle(Color.inkSoft).multilineTextAlignment(.leading)
                        Text("Answer →").font(.px(16, 700)).foregroundStyle(Color.terracottaD)
                    }
                    Spacer(minLength: 0)
                }
                .pxCard()
            }
            .buttonStyle(.press)
        } else if let a = v.fresh.first {
            Button(action: open) {
                HStack(spacing: 14) {
                    GlyphView(glyph: Icons.heart, scale: 3).beat()
                    VStack(alignment: .leading, spacing: 4) {
                        Text("A question just opened").font(.px(14, 600)).foregroundStyle(Color.muted)
                        Text(a.prompt).font(.pxBodyBold).foregroundStyle(Color.inkSoft).multilineTextAlignment(.leading)
                    }
                    Spacer(minLength: 0)
                }
                .pxCard()
            }
            .buttonStyle(.press)
        }
    }
}

/* ---------- our wall ---------- */

struct WallCard: View {
    let place: PlaceModel
    var open: () -> Void

    var body: some View {
        let latest = place.notes.first { !$0.gone }
        Button(action: open) {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("Our wall").font(.pxHeading).foregroundStyle(Color.inkSoft)
                    Spacer()
                    if let n = place.wallNews {
                        Text("\(place.theirName) \(n.kind == .voice ? "left a voice note" : "pinned \(n.kind == .photo ? "a photo" : n.kind == .doodle ? "a doodle" : "a note")")")
                            .font(.px(12, 700)).foregroundStyle(Color.cream)
                            .padding(.horizontal, 7).padding(.vertical, 3)
                            .background(Color.thread)
                            .nudge(every: 4.5, angle: 3)
                    }
                }
                HStack(alignment: .top, spacing: 12) {
                    if let art = place.board.art {
                        ArtView(art: art, scale: 3)
                            .padding(4)
                            .background(Color(hex: "#8a5a3c"))
                    }
                    if let n = latest {
                        VStack(alignment: .leading, spacing: 4) {
                            if n.kind == .doodle {
                                DoodleView(px: n.doodle, scale: 0.75)
                            } else {
                                Text(n.text).font(.pxBody).foregroundStyle(Color.inkSoft).lineLimit(4).multilineTextAlignment(.leading)
                            }
                            Text("— \(place.member(n.by)?.name ?? "")").font(.pxTiny).foregroundStyle(Color.muted)
                        }
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(hex: NOTE_PAPERS[n.paper]))
                        .rotationEffect(.degrees(-1.2))
                        .sway(lift: 1.5, tilt: 1, period: 3.6)
                    } else {
                        Text("Pin up a note, a doodle or a photo for \(place.theirName) to find.").font(.pxBody).foregroundStyle(Color.muted)
                    }
                }
                Text("Open our wall →").font(.px(16, 700)).foregroundStyle(Color.terracottaD)
            }
            .pxCard()
        }
        .buttonStyle(.press)
    }
}

/* ---------- the streak ---------- */

struct StreakCard: View {
    let place: PlaceModel

    var body: some View {
        let s = place.streak
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                Group {
                    if s.current > 0 { GlyphView(glyph: Icons.flame, scale: 4).flicker() } else { GlyphView(glyph: Icons.flameOut, scale: 4) }
                }
                VStack(alignment: .leading, spacing: 2) {
                    Group {
                        if s.current > 0 { CountUp(value: s.current) { "\($0)-day streak" } } else { Text("No streak yet") }
                    }
                    .font(.pxHeading).foregroundStyle(Color.inkSoft)
                    Text("Best \(s.best) · \(s.together) \(s.together == 1 ? "letter" : "letters") opened together").font(.pxSmall).foregroundStyle(Color.muted)
                }
                Spacer(minLength: 0)
            }
            HStack(spacing: 6) {
                ForEach(Array(s.week.enumerated()), id: \.offset) { _, d in
                    VStack(spacing: 3) {
                        cell(d.state).frame(height: 24)
                        Text(d.label).font(.pxTiny).foregroundStyle(Color.muted)
                    }
                    .frame(maxWidth: .infinity)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(Day.pretty(d.key)): \(d.state.rawValue)")
                }
            }
            if s.mendable != nil {
                VStack(alignment: .leading, spacing: 8) {
                    Text("You can mend one day this week if you like.").font(.pxSmall).foregroundStyle(Color.inkSoft)
                    Button {
                        place.mendStreak()
                        Haptics.success()
                    } label: {
                        HStack(spacing: 6) {
                            GlyphView(glyph: Icons.stitch, scale: 2)
                            Text("Mend the streak")
                        }
                    }
                    .buttonStyle(.px(.terracotta, small: true, wide: true))
                }
                .padding(12)
                .pxInset()
            }
        }
        .pxCard()
    }

    @ViewBuilder
    private func cell(_ st: DayState) -> some View {
        switch st {
        case .done: Rectangle().fill(Color.terracotta)
        case .mended: Rectangle().fill(Color.butter)
        case .missed: Rectangle().fill(Color.paper2)
        case .today: Rectangle().fill(Color.paperHi).overlay { Rectangle().strokeBorder(Color.terracotta, lineWidth: 3) }.beat(every: 2.2, amount: 0.1)
        case .upcoming: Rectangle().fill(Color.paper2).opacity(0.5)
        case .before: Rectangle().strokeBorder(Color.paper2, lineWidth: 2)
        }
    }
}

/* ---------- scooting closer ---------- */

/// the fire behind the couch: how it's burning, and what keeps it going
struct FireLine: View {
    let place: PlaceModel

    var body: some View {
        let f = place.fire
        HStack(alignment: .top, spacing: 12) {
            Group {
                if f.level > 0 { GlyphView(glyph: Icons.flame, scale: 3).flicker() } else { GlyphView(glyph: Icons.flameOut, scale: 3) }
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(f.level == 0 ? "Embers" : "\(CouchState.fireNames[f.level]) · \(f.streak) \(f.streak == 1 ? "day" : "days") in a row")
                    .font(.pxBody).foregroundStyle(Color.inkSoft)
                Text(line(f)).font(.pxTiny).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .combine)
    }

    private func line(_ f: (streak: Int, level: Int)) -> String {
        if !place.togetherToday {
            return f.level == 0
                ? "It never goes out. Once \(place.theirName) opens Soultied today too, it lights again."
                : "Your log’s on. Once \(place.theirName) opens Soultied today too, the fire keeps going."
        }
        if f.streak < 3 { return "You both put a log on today. \(3 - f.streak) more \(3 - f.streak == 1 ? "day" : "days") in a row and it burns steady." }
        if f.streak < 7 { return "You both put a log on today. \(7 - f.streak) more \(7 - f.streak == 1 ? "day" : "days") in a row and it roars." }
        return "You both put a log on today. It’s roaring: keep it going."
    }
}

struct CouchCard: View {
    let place: PlaceModel
    var invite: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                GlyphView(glyph: Icons.couch, scale: 4)
                Text(place.partnerHere ? "The couch" : "Saving a seat").font(.pxHeading).foregroundStyle(Color.inkSoft)
            }
            if place.partnerHere {
                Text(CouchState.line(place.couchLevel, partnerName: place.theirName)).font(.pxBody).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 5) {
                    ForEach(0..<COUCH_STEPS, id: \.self) { i in
                        Rectangle().fill(i < place.couchLevel ? Color.terracotta : Color.paper2).frame(height: 12)
                    }
                }
                Text(place.togetherToday ? "You were both here today." : "Every day you both open Soultied, you scoot a little closer.").font(.pxTiny).foregroundStyle(Color.muted)
                FireLine(place: place).padding(.top, 6)
            } else {
                Text("Send \(place.theirName) the invite, and they’ll take the empty seat next to you.").font(.pxBody).foregroundStyle(Color.muted)
                Button("Send the invite", action: invite).buttonStyle(.px(.sage, small: true, wide: true))
            }
        }
        .pxCard()
    }
}
