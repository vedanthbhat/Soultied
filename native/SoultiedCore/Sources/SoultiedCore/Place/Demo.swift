import Foundation

/*
 * The demo room: Aanya and Rohan's place (two made-up people), kept in memory, so you can look around
 * Soultied without signing in. You're Aanya; Rohan answers back.
 */

public enum Demo {
    public static let sid = "space-demo"
    public static let me = "user-aanya"
    public static let them = "user-rohan"

    /// a place full of history, in memory
    public static func backend(now: Date = Date()) -> MemoryBackend {
        let db = MemoryBackend()
        let today = Day.today(now)
        let nowMs = (now.timeIntervalSince1970 * 1000).rounded()
        let createdAt = Values.iso(now.addingTimeInterval(-21 * 86400))
        let p = "spaces/\(sid)"
        db.seed(p, [
            "id": sid, "name": "Our Little Place", "inviteCode": Places.makeCode(), "inviteExpiresAt": Values.iso(now.addingTimeInterval(7 * 86400)),
            "inviteExpiresAtMs": nowMs + Places.week, "creatorId": me, "partnerId": them, "partnerPlaceholderName": "Rohan",
            "togetherSince": "2025-06-14", "timezone": TimeZone.current.identifier, "createdAt": createdAt, "members": [me, them],
        ])
        var rohan = Wardrobe.defaultB
        rohan.facialHair = "stubble"
        db.seed("\(p)/members/\(me)", MemberDoc(name: "Aanya", avatar: Wardrobe.defaultA, lastActive: Values.iso(now)).doc)
        db.seed("\(p)/members/\(them)", MemberDoc(name: "Rohan", avatar: rohan, lastActive: Values.iso(now)).doc)

        let st = letters(coupleId: sid, startKey: String(createdAt.prefix(10)), a: me, b: them, today: today)
        for kind in LetterKind.allCases {
            for d in st[kind].values { db.seed("\(p)/letters/\(LetterDay.docId(kind, d.dateKey))", d.doc(kind)) }
        }
        db.seed("\(p)/meta/letters", ["afterDarkOn": [them: true], "journeyStart": st.journeyStart ?? today, "repairs": [String](), "afterDarkHeat": Doc()])
        db.seed("\(p)/meta/couch", [
            "seen": [me: Day.add(today, -1), them: Day.add(today, -1)],
            "together": [-6, -4, -1].map { Day.add(today, $0) },
            "shown": [me: 3, them: 3],
        ])
        db.seed("\(p)/meta/decor", ["earned": ["welcome": 240], "bought": Doc(), "placed": Doc()])
        db.seed("\(p)/meta/moods", ["by": [them: ["mood": "missing", "text": "counting the days", "at": nowMs - 2 * 3600e3]], "seen": Doc()])
        db.seed("\(p)/meta/touch", ["items": Doc(), "seen": Doc()])
        db.seed("\(p)/meta/board", ["last": [them: ["at": nowMs - 3 * 3600e3, "kind": "doodle"]], "seen": Doc(), "art": Doodle.art(Doodle.demo, ref: "note-demo-2", by: them, at: nowMs).doc])
        db.seed("\(p)/meta/note-demo-0", ["by": me, "kind": "text", "text": "Left you a playlist for the train. Track 4 is us.", "paper": 1, "at": nowMs - 2 * 86400e3, "loved": [them: nowMs - 2 * 86400e3 + 600e3], "kept": false])
        db.seed("\(p)/meta/note-demo-1", ["by": them, "kind": "text", "text": "Twelve days. I’ve started packing in my head.", "paper": 0, "at": nowMs - 26 * 3600e3, "loved": Doc(), "kept": true])
        db.seed("\(p)/meta/note-demo-2", ["by": them, "kind": "doodle", "doodle": Doodle.demo, "paper": 0, "at": nowMs - 3 * 3600e3, "loved": Doc(), "kept": false])
        db.seed("\(p)/meta/memories", ["items": [
            "mem-demo-0": ["id": "mem-demo-0", "by": me, "title": "First date: the bookshop café", "day": "2023-02-11", "text": "You spilled the hot chocolate and laughed so hard the owner gave us cookies.", "photo": "", "at": 0],
            "mem-demo-1": ["id": "mem-demo-1", "by": them, "title": "The rainy city trip", "day": "2024-07-19", "text": "Two umbrellas, one of them broken. Best weekend.", "photo": "", "at": 0],
        ]])
        db.seed("\(p)/meta/asks", ["items": [
            "ask-demo-1": ["id": "ask-demo-1", "by": them, "prompt": "What’s the first thing you want to do when I land?", "options": [String](), "at": nowMs - 2 * 3600e3,
                           "answers": [them: ["text": "Hug you at arrivals for an embarrassingly long time.", "at": nowMs - 2 * 3600e3]], "seen": Doc()],
            "ask-demo-0": ["id": "ask-demo-0", "by": me, "prompt": "Which of our trips would you do again tomorrow?",
                           "options": ["The beach weekend", "The rainy city one", "The mountain cabin", "The one we haven’t had yet"], "at": nowMs - 3 * 86400e3,
                           "answers": [me: ["pick": 2, "at": nowMs - 3 * 86400e3], them: ["pick": 2, "at": nowMs - 3 * 86400e3 + 5400e3]],
                           "seen": [me: nowMs - 2 * 86400e3, them: nowMs - 2 * 86400e3]],
        ]])
        let acts: [(String, String, String, Double)] = [
            ("question_revealed", "Letter opened together", "In sync on 4 of 5.", 86400),
            ("avatar_updated", "Wardrobe refresh", "Rohan put on a terracotta cardigan and round glasses.", 3 * 86400),
            ("partner_joined", "Moved in", "Rohan joined Our Little Place with the invite link.", 21 * 86400),
        ]
        for (i, a) in acts.enumerated() {
            db.seed("\(p)/activities/act-\(i + 1)", ["id": "act-\(i + 1)", "type": a.0, "title": a.1, "description": a.2, "timestamp": "", "at": Values.iso(now.addingTimeInterval(-a.3))])
        }
        return db
    }

    private static let NOTES = [
        "Can’t wait for December.", "You make the distance feel smaller.", "Call me tonight?",
        "Still thinking about our last trip.", "Proud of you, always.", "Save me a seat on the couch.",
    ]
    private static let WORDS = [
        "Honestly? The way you laugh at your own jokes before you finish them.",
        "A slow Sunday: pancakes, a long walk, and a film we both fall asleep to.",
        "When you stayed on the call until I fell asleep, even though it was 3 am for you.",
        "Probably something about whose turn it is to do the dishes.",
        "That you’re braver than you think. I see it every week.",
        "Fairy lights, a big sofa, and too many plants.",
        "The first time we met, I couldn’t stop smiling for the whole train home.",
        "Our next visit. I’ve already planned the first day.",
    ]

    /// the demo room's made-up letters (src/letters/cards.ts demoLetters, the same answers)
    public static func letters(coupleId: String, startKey: String, a: String, b: String, today: String) -> LettersState {
        var r = Shuffle.Rng(Shuffle.hashStr(coupleId + today))
        func rnd() -> Double { r.next() }
        func fl(_ x: Double) -> Int { Int(x.rounded(.down)) }
        var st = LettersState()
        func answer(_ c: Card, _ other: CardAnswer? = nil) -> CardAnswer {
            if c.style == .open { return CardAnswer(pick: 0, text: WORDS[fl(rnd() * Double(WORDS.count))]) }
            let n = c.options.count
            if c.style == .likely {
                if let o = other, rnd() < 0.6 { return CardAnswer(pick: 1 - o.pick) }
                return CardAnswer(pick: fl(rnd() * 2))
            }
            if let o = other, rnd() < 0.6 { return CardAnswer(pick: o.pick) }
            return CardAnswer(pick: fl(rnd() * Double(n)))
        }
        // (the website's `other && r() < 0.6` only draws when there's an other; so do these)
        func build(_ key: String, _ who: String, _ note: String? = nil) {
            let ids = Shuffle.cardsFor(.daily, coupleId: coupleId, dateKey: key, startKey: startKey)
            var A = UserLetter(), B = UserLetter()
            for c in Cards.of(ids) {
                var x = answer(c)
                var y = answer(c, x)
                if c.guess {
                    x.guess = rnd() < 0.55 ? y.pick : fl(rnd() * Double(c.options.count))
                    y.guess = rnd() < 0.65 ? x.pick : fl(rnd() * Double(c.options.count))
                }
                if c.note {
                    if rnd() < 0.5 { x.note = NOTES[fl(rnd() * Double(NOTES.count))] }
                    y.note = note ?? (rnd() < 0.6 ? NOTES[fl(rnd() * Double(NOTES.count))] : nil)
                }
                A.cards[c.id] = x
                B.cards[c.id] = y
            }
            let at = "\(key)T21:\(Day.pad(10 + fl(rnd() * 40))):00"
            var day = LetterDay(dateKey: key, cardIds: ids)
            if who != "b" {
                A.sealedAt = at
                A.seenAt = who == "both" ? at : nil
                day.by[a] = A
            }
            if who != "a" {
                B.sealedAt = at
                B.seenAt = who == "both" ? at : nil
                day.by[b] = B
            }
            if who == "both" { day.revealedAt = at }
            st.daily[key] = day
        }
        for back in [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 14, 16, 17] { build(Day.add(today, -back), "both") }
        build(Day.add(today, -5), "a")
        build(today, "b", "Miss your laugh. Call tonight?")
        st.afterDarkOn[b] = true

        // three days into the 30 days; Rohan has already answered day 4
        st.journeyStart = Day.add(today, -3)
        let JNOTES = ["Same, always.", "Okay this one made me smile.", "Tell you the story on our call."]
        for n in 1...4 {
            let key = Journey.key(n)
            guard let card = Cards.card("jr-\(n - 1)") else { continue }
            var x = answer(card)
            var y = answer(card, x)
            x.guess = rnd() < 0.6 ? y.pick : fl(rnd() * 4)
            y.guess = rnd() < 0.6 ? x.pick : fl(rnd() * 4)
            if n % 2 == 1 { y.note = JNOTES[(n - 1) / 2] }
            let at = "\(Day.add(today, n - 4))T22:\(Day.pad(10 + n)):00"
            var day = LetterDay(dateKey: key, cardIds: [card.id], by: [b: UserLetter(cards: [card.id: y], sealedAt: at, seenAt: n < 4 ? at : nil)])
            if n < 4 {
                day.by[a] = UserLetter(cards: [card.id: x], sealedAt: at, seenAt: at)
                day.revealedAt = at
            }
            st.journey[key] = day
        }
        return st
    }
}

extension LetterDay {
    /// as it's kept in the database
    func doc(_ kind: LetterKind) -> Doc {
        var by: Doc = [:]
        for (uid, l) in self.by {
            var m: Doc = ["cards": l.cards.mapValues { $0.doc } as Doc]
            if let s = l.sealedAt { m["sealedAt"] = s }
            if let s = l.seenAt { m["seenAt"] = s }
            by[uid] = m
        }
        var d: Doc = ["kind": kind.rawValue, "dateKey": dateKey, "cardIds": cardIds, "by": by]
        if let r = revealedAt { d["revealedAt"] = r }
        return d
    }
}

/// Rohan, in the demo room: sends a touch back, and answers today's letter once you've sealed yours.
final class DemoPartner {
    weak var place: PlaceModel?
    init(place: PlaceModel) { self.place = place }

    func asked(_ id: String, options: [String]) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.5) { [weak self] in
            guard let p = self?.place, let db = p.db as? MemoryBackend else { return }
            let reply: Doc = options.isEmpty ? ["text": DEMO_REPLIES.randomElement()!, "at": Values.nowMs()] : ["pick": Int.random(in: 0..<options.count), "at": Values.nowMs()]
            db.apply(Write("spaces/\(p.sid)/meta/asks", ["items": [id: ["answers": [Demo.them: reply]]]], merge: true))
        }
    }

    func touched(_ kind: TouchKind) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.8) { [weak self] in
            guard let p = self?.place, let db = p.db as? MemoryBackend else { return }
            let t = Touch(id: Values.newKey("t-"), by: Demo.them, kind: kind, at: Values.nowMs())
            db.apply(Write("spaces/\(p.sid)/meta/touch", ["items": [t.id: t.doc]], merge: true))
        }
    }
}
