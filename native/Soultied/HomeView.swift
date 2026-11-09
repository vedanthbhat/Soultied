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
    var openGame: (GameKind) -> Void = { _ in }
    @Environment(\.displayScale) private var displayScale

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

                        VStack(spacing: 18) {
                            touches
                            if place.recordOn { RecordCard(place: place, listening: listening, open: { onRoom(.music) }) }
                            LetterCard(place: place, open: { go(.letters) })
                            AsksCard(place: place, open: { go(.letters) })
                            GameCard(place: place, open: openGame)
                            WallCard(place: place, open: { onRoom(.board) })
                            StreakCard(place: place)
                            if !place.recordOn { RecordCard(place: place, open: { onRoom(.music) }) }
                            CouchCard(place: place, invite: { go(.us) })
                        }
                        .padding(.horizontal, 16)
                        .padding(.top, 22)
                        .padding(.bottom, 120)
                    }
                }
                .scrollIndicators(.hidden)
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
        let below: CGFloat = 52 + 58 + 60
        return RoomCrop.home.viewHeight(width: size.width, maxHeight: max(200, size.height - below), displayScale: displayScale)
    }

    private var header: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 0) {
                Text(place.space?.name ?? "Our Little Place").font(.px(22, 700)).foregroundStyle(Color.paper).lineLimit(1)
                if let d = place.daysTogether, d > 0 {
                    Text("\(d.formatted()) days together").font(.pxTiny).foregroundStyle(Color.paper.opacity(0.65))
                }
            }
            Spacer()
            Button {
                onRoom(.decor)
            } label: {
                // the jar of stitches you've earned: spend them on the room
                HStack(spacing: 6) {
                    GlyphView(glyph: Icons.brush, scale: 2)
                    GlyphView(glyph: Icons.stitch, scale: 3)
                    Text("\(place.stitches)").font(.px(16, 700)).foregroundStyle(Color.inkSoft)
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
        .padding(.top, 10)
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
                        Rectangle().fill(Color.sage).frame(width: 7, height: 7)
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
        VStack(alignment: .leading, spacing: 10) {
            if place.partnerHere {
                HStack {
                    Text("Send \(place.theirName)").font(.px(16, 700)).foregroundStyle(Color.paper)
                    Spacer()
                    if let t = place.lastSent {
                        Text("you sent \(touchDef(t.kind).one) · \(ago(t.at))").font(.pxTiny).foregroundStyle(Color.paper.opacity(0.6))
                    }
                }
                TouchButtons(place: place, compact: true)
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
                    if let l = place.theirLook { HeadView(look: l, size: 44) }
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
                    GlyphView(glyph: Icons.heart, scale: 3)
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
                        Text("\(place.theirName) pinned \(n.kind == .photo ? "a photo" : n.kind == .doodle ? "a doodle" : "a note")")
                            .font(.px(12, 700)).foregroundStyle(Color.cream)
                            .padding(.horizontal, 7).padding(.vertical, 3)
                            .background(Color.thread)
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
                                DoodleView(px: n.doodle, scale: 1.5)
                            } else {
                                Text(n.text).font(.pxBody).foregroundStyle(Color.inkSoft).lineLimit(4).multilineTextAlignment(.leading)
                            }
                            Text("— \(place.member(n.by)?.name ?? "")").font(.pxTiny).foregroundStyle(Color.muted)
                        }
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(hex: NOTE_PAPERS[n.paper]))
                        .rotationEffect(.degrees(-1.2))
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
                GlyphView(glyph: s.current > 0 ? Icons.flame : Icons.flameOut, scale: 4)
                VStack(alignment: .leading, spacing: 2) {
                    Text(s.current > 0 ? "\(s.current)-day streak" : "No streak yet").font(.pxHeading).foregroundStyle(Color.inkSoft)
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
                    Text("Yesterday’s letter didn’t get opened. You can mend one missed day a week so the streak survives.").font(.pxSmall).foregroundStyle(Color.inkSoft)
                    Button {
                        place.mendStreak()
                        Haptics.success()
                    } label: {
                        HStack(spacing: 6) {
                            GlyphView(glyph: Icons.stitch, scale: 2)
                            Text("Mend the streak")
                        }
                    }
                    .buttonStyle(.px(.terracotta, small: true))
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
        case .today: Rectangle().fill(Color.paperHi).overlay { Rectangle().strokeBorder(Color.terracotta, lineWidth: 3) }
        case .upcoming: Rectangle().fill(Color.paper2).opacity(0.5)
        case .before: Rectangle().strokeBorder(Color.paper2, lineWidth: 2)
        }
    }
}

/* ---------- scooting closer ---------- */

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
            } else {
                Text("Send \(place.theirName) the invite, and they’ll take the empty seat next to you.").font(.pxBody).foregroundStyle(Color.muted)
                Button("Send the invite", action: invite).buttonStyle(.px(.sage, small: true))
            }
        }
        .pxCard()
    }
}
