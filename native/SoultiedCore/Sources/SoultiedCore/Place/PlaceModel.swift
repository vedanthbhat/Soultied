import Foundation
import Observation

/*
 * A couple's place, live: everything the screens show, and everything they can do. Reads and writes
 * the same documents the website does (through a Backend: Firestore in the app, memory in the demo
 * room and the tests), so a phone and a laptop share one place.
 */

@Observable
public final class PlaceModel {
    public let sid: String
    public let me: String
    public let isDemo: Bool
    @ObservationIgnored public let db: Backend
    @ObservationIgnored private var listeners: [Listener] = []
    @ObservationIgnored private var earnSent: Set<String> = []
    @ObservationIgnored private var opening: Set<String> = []
    @ObservationIgnored private var playedTouch: String?
    @ObservationIgnored private var timer: Timer?
    @ObservationIgnored private var demoPartner: DemoPartner?

    public internal(set) var space: SpaceDoc?
    public internal(set) var members: [String: MemberDoc] = [:]
    public internal(set) var letters = LettersState()
    public internal(set) var couch = CouchState()
    public internal(set) var decorDoc = DecorDoc()
    public internal(set) var moods = MoodsDoc()
    public internal(set) var touch = TouchDoc()
    public internal(set) var board = BoardDoc()
    /// the notes and doodles up on the wall, newest first
    public internal(set) var notes: [Note] = []
    public internal(set) var photos: [Photo] = []
    public internal(set) var memoryItems: [String: Memory] = [:]
    public internal(set) var activities: [Activity] = []
    public internal(set) var askItems: [String: Ask] = [:]
    /// every game's current match
    public internal(set) var games: [GameKind: Match] = [:]
    /// the record player (nil until anyone's put a record on, ever)
    public internal(set) var turntable: TurntableState?
    /// which documents have arrived at least once
    public internal(set) var loaded: Set<String> = []

    /// today, on this phone's calendar (moves on at midnight)
    public internal(set) var today = Day.today()
    /// ticks every half minute, for who's around and moods that run out
    public internal(set) var now = Date()
    /// something went wrong saving (shown briefly)
    public var problem: String?
    /// "+20 stitches: you showed up, and you're both here today."
    public var stitchNote: String?
    /// a touch the couch should play now (one you sent, or one that just came in)
    public var playing: Touch?

    public init(db: Backend, sid: String, me: String, demo: Bool = false) {
        self.db = db
        self.sid = sid
        self.me = me
        isDemo = demo
    }

    deinit { stop() }

    /* ---------- listening ---------- */

    private func path(_ rest: String) -> String { "spaces/\(sid)/\(rest)" }
    private func meta(_ name: String) -> String { path("meta/\(name)") }

    public func start() {
        stop()
        let since = Day.add(today, -60)
        listeners = [
            db.listen("spaces/\(sid)") { [weak self] d in
                guard let self else { return }
                self.space = SpaceDoc(d, millis: self.db.millis)
                self.loaded.insert("space")
                self.afterChange()
            },
            db.listen(QuerySpec(path("members"))) { [weak self] rows in
                guard let self else { return }
                var m: [String: MemberDoc] = [:]
                for r in rows { m[r.id] = MemberDoc(r.data, fallback: r.id == self.space?.creatorId ? Wardrobe.defaultA : Wardrobe.defaultB) }
                self.members = m
                self.loaded.insert("members")
                self.afterChange()
            },
            db.listen(QuerySpec(path("letters"), filters: [Filter("dateKey", .greaterOrEqual, since)])) { [weak self] rows in
                guard let self else { return }
                var l = self.letters
                l.applyRows(rows)
                self.letters = l
                self.loaded.insert("letters")
                self.openWhatBothSealed()
                self.afterChange()
            },
            db.listen(meta("letters")) { [weak self] d in
                guard let self else { return }
                var l = self.letters
                l.applyMeta(d ?? [:])
                self.letters = l
                self.loaded.insert("lettersMeta")
            },
            db.listen(meta("couch")) { [weak self] d in
                guard let self else { return }
                self.couch = CouchState(d)
                self.loaded.insert("couch")
                self.afterChange()
            },
            db.listen(meta("decor")) { [weak self] d in
                guard let self else { return }
                self.decorDoc = DecorDoc(d)
                self.loaded.insert("decor")
                self.afterChange()
            },
            db.listen(meta("moods")) { [weak self] d in
                self?.moods = MoodsDoc(d)
                self?.loaded.insert("moods")
            },
            db.listen(meta("touch")) { [weak self] d in
                guard let self else { return }
                self.touch = TouchDoc(d)
                self.loaded.insert("touch")
                // a touch just came in (or was waiting when you arrived): the couch plays it once
                if let t = self.touchNews.first, t.id != self.playedTouch {
                    self.playedTouch = t.id
                    self.playing = t
                }
            },
            db.listen(meta("board")) { [weak self] d in
                self?.board = BoardDoc(d)
                self?.loaded.insert("board")
            },
            db.listen(prefixQuery("note-")) { [weak self] rows in
                self?.notes = rows.compactMap { Note(id: $0.id, $0.data) }.sorted { $0.at > $1.at }
                self?.loaded.insert("notes")
            },
            db.listen(prefixQuery("photo-")) { [weak self] rows in
                self?.photos = rows.compactMap { Photo(id: $0.id, $0.data) }.sorted { $0.at > $1.at }
                self?.loaded.insert("photos")
            },
            db.listen(meta("asks")) { [weak self] d in
                self?.askItems = asks(d)
                self?.loaded.insert("asks")
            },
            db.listen(meta("memories")) { [weak self] d in
                self?.memoryItems = memories(d)
                self?.loaded.insert("memories")
            },
            db.listen(prefixQuery("game-")) { [weak self] rows in
                guard let self else { return }
                var next: [GameKind: Match] = [:]
                for r in rows {
                    guard let m = Match(r.data), r.id == m.kind.docName else { continue }
                    // an older copy arriving after our own newer move
                    if let cur = self.games[m.kind], cur.id == m.id, cur.seq > m.seq { next[m.kind] = cur } else { next[m.kind] = m }
                }
                self.games = next
                self.loaded.insert("games")
                self.demoPartner?.games()
            },
            db.listen(QuerySpec(path("activities"), orderBy: "at", descending: true, limit: 30)) { [weak self] rows in
                self?.activities = rows.map { Activity(row: $0) }
                self?.loaded.insert("activities")
            },
            db.listen(meta("turntable")) { [weak self] d in
                self?.turntable = TurntableState(d)
                self?.loaded.insert("turntable")
            },
        ]
        let t = Timer(timeInterval: 30, repeats: true) { [weak self] _ in self?.tick() }
        RunLoop.main.add(t, forMode: .common)
        timer = t
        heartbeat()
        if isDemo { demoPartner = DemoPartner(place: self) }
    }

    public func stop() {
        listeners.forEach { $0.stop() }
        listeners = []
        timer?.invalidate()
        timer = nil
    }

    private func prefixQuery(_ prefix: String) -> QuerySpec {
        QuerySpec(path("meta"), filters: [Filter(Filter.documentId, .greaterOrEqual, prefix), Filter(Filter.documentId, .less, prefix + "\u{f8ff}")])
    }

    /// everything's arrived that the first screen needs
    public var ready: Bool { ["space", "members", "letters", "couch"].allSatisfy(loaded.contains) }

    func tick() {
        now = Date()
        let t = Day.today()
        if t != today {
            today = t
            start()
        }
        // let your person know you're around, every two minutes
        if Int(now.timeIntervalSince1970) % 120 < 30 { heartbeat() }
    }

    /// say you're here (the app calls this when it comes to the front, too)
    public func heartbeat() {
        save(path("members/\(me)"), ["lastActive": Values.isoNow()], "presence")
    }

    private func afterChange() {
        guard ready, space != nil else { return }
        checkIn()
        earnStitches()
    }

    /* ---------- writing ---------- */

    private func save(_ p: String, _ data: Doc, _ what: String) {
        let db = self.db
        Task {
            do { try await db.merge(p, data) } catch { self.failed(what, error) }
        }
    }

    private func commit(_ writes: [Write], _ what: String) {
        let db = self.db
        Task {
            do { try await db.commit(writes) } catch { self.failed(what, error) }
        }
    }

    private func failed(_ what: String, _ error: Error) {
        print("[soultied] \(what): \(error)")
        DispatchQueue.main.async { self.problem = "That didn’t save. Check your connection and try again." }
    }

    private func activity(_ a: Activity) { save(path("activities/\(a.id)"), a.doc, "activity") }

    /* ---------- who's who ---------- */

    public var them: String? { space?.partner(of: me) }
    public var hostId: String { space?.creatorId ?? me }
    public var guestId: String? { space?.partnerId }
    public var partnerHere: Bool { them != nil }

    public func member(_ uid: String?) -> MemberDoc? { uid.flatMap { members[$0] } }

    public var myName: String { members[me]?.name ?? "You" }
    public var myLook: AvatarConfig { members[me]?.avatar ?? (me == hostId ? Wardrobe.defaultA : Wardrobe.defaultB) }
    public var theirName: String {
        if let t = them, let n = members[t]?.name, !n.isEmpty { return n }
        return space?.partnerPlaceholderName.isEmpty == false ? space!.partnerPlaceholderName : "Your person"
    }
    public var theirLook: AvatarConfig? { them.flatMap { members[$0]?.avatar } }

    public func status(_ uid: String) -> SeatStatus { uid == me ? .online : (members[uid]?.status(now: now) ?? .away) }

    /// the two seats on the couch: whoever started the place on the left
    public var seats: (left: Seat, right: Seat) {
        func seat(_ uid: String?) -> Seat {
            guard let uid, let m = members[uid] else { return .empty }
            return Seat(avatar: m.avatar, name: m.name, status: status(uid))
        }
        return (seat(hostId), seat(guestId))
    }

    /* ---------- the couch ---------- */

    public var couchLevel: Int { couch.level }
    public var couchShown: Int { couch.shown[me] ?? 0 }
    public var togetherToday: Bool { couch.together.contains(today) }

    private func checkIn() {
        guard let w = couch.checkIn(me: me, partner: them, today: today) else { return }
        if opening.contains("couch|\(today)|\(w.together)") { return }
        opening.insert("couch|\(today)|\(w.together)")
        var d: Doc = ["seen": [me: today]]
        if w.together { d["together"] = Sentinel.arrayUnion([today]) }
        save(meta("couch"), d, "couch")
    }

    /// you've watched yourselves scoot closer
    public func markCouchShown(_ level: Int) {
        if couchShown < level { save(meta("couch"), ["shown": [me: level]], "couch") }
    }

    /* ---------- letters ---------- */

    public var heat: Int { letters.heat([hostId, guestId].compactMap { $0 }) }
    public var afterDarkOpen: Bool { letters.afterDarkOpen(me, them) }
    public var afterDarkMine: Bool { letters.afterDarkOn[me] == true }
    public var startKey: String { space?.startKey ?? today }

    /// a letter day as it is (or as it will be, the first time either of you touches it)
    public func letter(_ kind: LetterKind, _ key: String? = nil) -> LetterDay {
        let k = key ?? today
        if let d = letters[kind][k] { return d }
        return LetterDay(dateKey: k, cardIds: Shuffle.cardsFor(kind, coupleId: sid, dateKey: k, startKey: startKey, heat: kind == .afterDark ? heat : 1))
    }

    public func answer(_ kind: LetterKind, _ key: String, card: String, _ a: CardAnswer) {
        let d = letter(kind, key)
        guard !d.sealed(me), d.cardIds.contains(card) else { return }
        // shown straight away; the database catches up
        var l = letters
        var day = d
        var mine = day.by[me] ?? UserLetter()
        mine.cards[card] = a
        day.by[me] = mine
        l[kind][key] = day
        letters = l
        save(path("letters/\(LetterDay.docId(kind, key))"), ["kind": kind.rawValue, "dateKey": key, "cardIds": d.cardIds, "by": [me: ["cards": [card: a.doc]]]], "answer")
    }

    /// every card answered (and guessed, where there's a guess)
    public func ready(toSeal kind: LetterKind, _ key: String) -> Bool {
        let d = letter(kind, key)
        guard let mine = d.by[me] else { return false }
        return Cards.of(d.cardIds).allSatisfy { Cards.isAnswered($0, mine.cards[$0.id]) }
    }

    public func seal(_ kind: LetterKind, _ key: String) {
        let d = letter(kind, key)
        guard let mine = d.by[me], mine.sealedAt == nil, ready(toSeal: kind, key) else { return }
        let at = Values.isoNow()
        let both = them.map { d.sealed($0) } ?? false
        var m: Doc = ["sealedAt": at]
        if both { m["seenAt"] = at }
        var doc: Doc = ["kind": kind.rawValue, "dateKey": key, "cardIds": d.cardIds, "by": [me: m]]
        if both { doc["revealedAt"] = at }
        var l = letters
        var day = d
        day.by[me]?.sealedAt = at
        if both {
            day.by[me]?.seenAt = at
            day.revealedAt = at
        }
        l[kind][key] = day
        letters = l
        save(path("letters/\(LetterDay.docId(kind, key))"), doc, "seal")
        if both, let t = them { opened(kind, day, partner: t) }
    }

    private func opened(_ kind: LetterKind, _ day: LetterDay, partner: String) {
        if kind == .daily {
            let s = scoreDay(day, me: me, them: partner)
            activity(.new(.questionRevealed, "Letter opened together", "In sync on \(s.same) of \(s.total)."))
        }
        if kind == .journey, let m = journeyMilestone(day.dateKey) { activity(.new(.questionRevealed, m.title, m.description)) }
    }

    /// Two people can seal at the same moment and each miss the other's seal: whoever notices opens it.
    private func openWhatBothSealed() {
        guard let t = them else { return }
        for kind in LetterKind.allCases {
            for d in letters[kind].values where d.revealedAt == nil && d.sealed(me) && d.sealed(t) {
                let k = "\(kind.rawValue)|\(d.dateKey)"
                if opening.contains(k) { continue }
                opening.insert(k)
                save(path("letters/\(LetterDay.docId(kind, d.dateKey))"), ["kind": kind.rawValue, "dateKey": d.dateKey, "cardIds": d.cardIds, "revealedAt": Values.isoNow()], "open letter")
            }
        }
    }

    public func markSeen(_ kind: LetterKind, _ key: String) {
        let d = letter(kind, key)
        guard d.opened, let mine = d.by[me], mine.seenAt == nil, !opening.contains("seen|\(kind)|\(key)") else { return }
        opening.insert("seen|\(kind)|\(key)")
        save(path("letters/\(LetterDay.docId(kind, key))"), ["kind": kind.rawValue, "dateKey": key, "cardIds": d.cardIds, "by": [me: ["seenAt": Values.isoNow()]]], "seen")
    }

    public func setAfterDark(_ on: Bool) { save(meta("letters"), ["afterDarkOn": [me: on]], "after dark") }
    public func setHeat(_ h: Int) { save(meta("letters"), ["afterDarkHeat": [me: h >= 2 ? 2 : 1]], "after dark") }

    public var journey: JourneyInfo { journeyInfo(letters, me: me, today: today) }
    public func startJourney() {
        if letters.journeyStart == nil { save(meta("letters"), ["journeyStart": today], "the 30 days") }
    }

    public var streak: StreakInfo { streakInfo(letters, today: today, sinceKey: space?.startKey) }
    public func mendStreak() {
        if let k = streak.mendable { save(meta("letters"), ["repairs": Sentinel.arrayUnion([k])], "mend") }
    }

    /// today's letter is waiting for you (or opened and you haven't looked)
    public var letterWaiting: Bool {
        let d = letter(.daily)
        return !d.sealed(me) || (d.opened && d.by[me]?.seenAt == nil)
    }

    /// older letters than the live copy keeps (newest first)
    public func olderLetters(before key: String, _ n: Int = 30) async -> [LetterDay] {
        let rows = (try? await db.query(QuerySpec(path("letters"), filters: [Filter("dateKey", .less, key)], orderBy: "dateKey", descending: true, limit: n))) ?? []
        return rows.compactMap { LetterDay.parse($0.data) }.filter { $0.0 == .daily }.map(\.1)
    }

    /* ---------- moods and touches ---------- */

    public var myMood: MoodEntry? { moods.current(me, now: now.timeIntervalSince1970 * 1000) }
    public var theirMood: MoodEntry? { moods.current(them, now: now.timeIntervalSince1970 * 1000) }
    public var moodNews: MoodEntry? {
        guard let m = theirMood, m.at > (moods.seen[me] ?? 0) else { return nil }
        return m
    }

    public func setMood(_ mood: MoodId?, _ text: String) {
        let words = String(text.trimmingCharacters(in: .whitespacesAndNewlines).prefix(MOOD_TEXT_MAX))
        let entry: Any = mood != nil || !words.isEmpty ? ["mood": mood?.rawValue ?? NSNull(), "text": words, "at": Values.nowMs()] as Doc : NSNull()
        save(meta("moods"), ["by": [me: entry]], "mood")
    }

    public func markMoodSeen() {
        if let m = moodNews { save(meta("moods"), ["seen": [me: m.at]], "mood") }
    }

    public var touchNews: [Touch] { touch.unseen(me: me, them: them) }
    public var lastSent: Touch? { touch.lastSent(by: me) }

    public func sendTouch(_ kind: TouchKind, reply: Bool = false) {
        let t = Touch(id: Values.newKey("t-"), by: me, kind: kind, at: Values.nowMs())
        var items: Doc = [t.id: t.doc]
        for id in touch.toDrop() { items[id] = NSNull() }
        save(meta("touch"), ["items": items], "touch")
        playing = t
        if !reply { demoPartner?.touched(kind) }
    }

    public func markTouchesSeen() {
        if let t = touchNews.first { save(meta("touch"), ["seen": [me: t.at]], "touch") }
    }

    /// "Rohan hugged you back." / "Rohan sent you two hugs and a kiss."
    public var touchLine: String? {
        let news = touchNews
        guard let newest = news.first, partnerHere else { return nil }
        if news.count > 1 { return "\(theirName) sent you \(touchSummary(news))." }
        let back = lastSent.map { $0.kind == newest.kind && newest.at - $0.at > 0 && newest.at - $0.at < 3 * 60e3 && newest.kind != .hands } ?? false
        let ago = now.timeIntervalSince1970 * 1000 - newest.at
        return "\(theirName) \(touchDef(newest.kind).did)\(back ? " back" : "").\(ago > 5 * 60e3 ? " (\(Activity(id: "", type: "", title: "", description: "", at: Values.iso(Date(timeIntervalSince1970: newest.at / 1000))).ago(now: now).lowercased()))" : "")"
    }

    /* ---------- questions you ask each other ---------- */

    public var asksView: AsksView { viewAsks(askItems, me: me, them: them) }

    /// ask (and answer it yourself; your answer stays hidden until your person answers too)
    public func ask(_ prompt: String, options: [String], mine: AskAnswer) {
        let p = String(prompt.trimmingCharacters(in: .whitespacesAndNewlines).prefix(ASK_PROMPT_MAX))
        guard !p.isEmpty else { return }
        let opts = options.map { String($0.trimmingCharacters(in: .whitespaces).prefix(ASK_OPTION_MAX)) }.filter { !$0.isEmpty }
        let id = Values.newKey("ask-")
        let at = Values.nowMs()
        var m = mine
        m.at = at
        let item: Doc = ["id": id, "by": me, "prompt": p, "options": opts.count >= 2 ? Array(opts.prefix(4)) : [String](), "at": at, "answers": [me: m.doc], "seen": Doc()]
        save(meta("asks"), ["items": [id: item]], "ask")
        demoPartner?.asked(id, options: opts.count >= 2 ? opts : [])
    }

    public func answerAsk(_ a: Ask, _ mine: AskAnswer) {
        guard a.answers[me] == nil else { return }
        var m = mine
        m.at = Values.nowMs()
        save(meta("asks"), ["items": [a.id: ["answers": [me: m.doc]]]], "answer")
        if let t = them, a.answers[t] != nil { activity(.new(.questionRevealed, "A question, answered", "“\(a.prompt)”")) }
    }

    public func markAskSeen(_ a: Ask) {
        if a.seen[me] == nil { save(meta("asks"), ["items": [a.id: ["seen": [me: Values.nowMs()]]]], "ask") }
    }

    /// take back a question nobody's answered yet
    public func withdrawAsk(_ a: Ask) {
        guard a.by == me, them.map({ a.answers[$0] == nil }) ?? true else { return }
        save(meta("asks"), ["items": [a.id: NSNull()]], "ask")
    }

    /* ---------- our wall ---------- */

    public var wallNews: (at: Double, kind: PinKind)? { board.news(me: me, them: them) }
    public func markWallSeen() {
        if let n = wallNews { save(meta("board"), ["seen": [me: n.at]], "wall") }
    }

    private func pinned(_ kind: PinKind) { save(meta("board"), ["last": [me: ["at": Values.nowMs(), "kind": kind.rawValue]]], "wall") }

    public func pinNote(_ text: String, paper: Int) {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return }
        let n = Note.new(by: me, text: t, paper: paper)
        db.setLater(meta(n.id), n.doc, self)
        pinned(.text)
    }

    /// pins a doodle up, and hangs it in the frame over the couch if you like
    public func pinDoodle(_ px: [UInt8], hang: Bool) {
        let s = Doodle.encode(px)
        let n = Note.new(by: me, doodle: s)
        db.setLater(meta(n.id), n.doc, self)
        pinned(.doodle)
        if hang { hangArt(Doodle.art(s, ref: n.id, by: me)) }
    }

    public func love(_ note: Note) {
        let on = note.loved[me] == nil
        save(meta(note.id), ["loved": [me: on ? Values.nowMs() as Any : NSNull()]], "wall")
    }

    public func keep(_ note: Note, _ on: Bool = true) { save(meta(note.id), ["kept": on], "wall") }
    public func takeDown(_ note: Note) {
        save(meta(note.id), ["gone": true], "wall")
        if board.art?.ref == note.id { hangArt(nil) }
    }

    /// a photo for the wall: `big` and `thumb` are JPEG data: URLs, `art` the little version for the frame
    public func addPhoto(big: String, thumb: String, w: Int, h: Int, caption: String, day: String, art: WallArt?) {
        let id = Values.newKey("photo-")
        let at = Values.nowMs()
        db.setLater(meta("photobig-" + id.dropFirst(6)), ["data": big], self)
        db.setLater(meta(id), ["by": me, "caption": String(caption.prefix(CAPTION_MAX)), "thumb": thumb, "w": w, "h": h, "at": at, "day": isDayKey(day) ? day : "", "kept": true], self)
        pinned(.photo)
        if var a = art {
            a.ref = id
            a.by = me
            a.at = at
            hangArt(a)
        }
    }

    public func bigPhoto(_ p: Photo) async -> String? {
        (try? await db.get(meta(p.bigName)))?.str("data")
    }

    public func editPhoto(_ p: Photo, caption: String? = nil, day: String? = nil, kept: Bool? = nil) {
        var d: Doc = [:]
        if let c = caption { d["caption"] = String(c.prefix(CAPTION_MAX)) }
        if let x = day { d["day"] = isDayKey(x) ? x : "" }
        if let k = kept { d["kept"] = k }
        save(meta(p.id), d, "photo")
    }

    public func takeDown(_ p: Photo) {
        save(meta(p.id), ["gone": true], "photo")
        if board.art?.ref == p.id { hangArt(nil) }
    }

    public func hangArt(_ a: WallArt?) { save(meta("board"), ["art": a?.doc ?? NSNull()], "frame") }

    public func addMemory(title: String, day: String, text: String, photo: String = "") {
        let t = String(title.trimmingCharacters(in: .whitespacesAndNewlines).prefix(MEMORY_TITLE_MAX))
        guard !t.isEmpty, isDayKey(day) else { return }
        let m = Memory(id: Values.newKey("mem-"), by: me, title: t, day: day, text: String(text.prefix(MEMORY_TEXT_MAX)), photo: photo, at: Values.nowMs())
        save(meta("memories"), ["items": [m.id: m.doc]], "memory")
    }

    public func forget(_ m: Memory) { save(meta("memories"), ["items": [m.id: NSNull()]], "memory") }

    public var moments: [Moment] {
        timeline(memories: Array(memoryItems.values), notes: notes, photos: photos, togetherSince: space?.togetherSince, movedIn: space.map { $0.startKey })
    }

    /* ---------- games ---------- */

    /// whoever made the place is "a", the person who joined is "b"
    public var mySeat: Side { space == nil || space?.creatorId == me ? .a : .b }
    public func seatName(_ s: Side) -> String { s == mySeat ? myName : theirName }
    public func seatLook(_ s: Side) -> AvatarConfig? { s == mySeat ? myLook : theirLook }

    /// the games waiting on you: your move, boats to hide, or an invitation
    public var gamesWaiting: [GameKind] {
        guard partnerHere else { return [] }
        let t = now.timeIntervalSince1970 * 1000
        return GameKind.allCases.filter { Play.needsMe(games[$0], mySeat, now: t) }
    }

    /// a move you made (or a new game you started)
    public func saveGame(_ m: Match) { commitGame(m, by: mySeat) }

    /// the line between the two of you for live things (games, for now)
    public func liveChannel(_ topic: String) -> LiveChannel { db.live(path("live/\(topic)/events")) }

    /// Netflix / Prime Video together: the episodes and films you've watched as a pair, and where you left off
    /// in each show (the website's TogetherLog, in meta/stream)
    public func watchStreamLog(_ fn: @escaping (Doc?) -> Void) -> Listener { db.listen(meta("stream"), fn) }
    public func saveWatched(key: String, showKey: String, show: String, episode: String, url: String, pos: Double) {
        let at = Values.nowMs()
        save(meta("stream"), [
            "seen": [key: ["show": show, "episode": episode, "at": at]],
            "shows": [showKey: ["show": show, "episode": episode, "key": key, "url": url, "pos": pos, "at": at]],
        ], "watched")
    }
    /// a line in what's happened lately ("Watched together: Dark S1:E2 on Netflix.")
    public func noteWatchedTogether(_ description: String) {
        activity(Activity.new(.watchedTogether, "Watched together", description))
    }

    /// Doodle Guess's page, as last saved by whoever's drawing
    public func watchDoodleCanvas(_ fn: @escaping (Doc?) -> Void) -> Listener { db.listen(meta("doodle-canvas"), fn) }
    public func saveDoodleCanvas(_ d: Doc) { db.setLater(meta("doodle-canvas"), d, self) }

    /// Stores a move by `writer` and, if it ended the game, counts the win and notes it in what's happened lately.
    func commitGame(_ m0: Match, by writer: Side) {
        let prev = games[m0.kind]
        // a second tap before the screen caught up would replay a move from an older board: ignore it
        if m0.kind.info.mode == .turns, let p = prev, p.id == m0.id, m0.seq < p.seq { return }
        var m = m0
        m.updatedAt = Values.nowMs()
        m.updatedBy = writer
        m.seq = prev.map { $0.id == m0.id ? $0.seq + 1 : 0 } ?? 0
        let justEnded = m.status == .over && !(prev?.id == m.id && prev?.status == .over)
        if justEnded, let w = m.winnerSeat { m.wins[w, default: 0] += 1 }
        games[m.kind] = m
        db.setLater(meta(m.kind.docName), m.doc, self)
        if justEnded {
            let line = Play.endLine(m, name: seatName)
            if !line.isEmpty { activity(.new(.playedGame, m.kind.info.name, line)) }
        }
        demoPartner?.games()
    }

    /* ---------- the record player (src/music/TurntableContext.tsx) ---------- */

    /// a record (or a song) is on, for both of you
    public var recordOn: Bool { turntable?.isOn(Values.nowMs()) ?? false }

    /// writes the whole record player at once, as the website does
    private func turn(_ t: TurntableState?) {
        guard let t else { return }
        turntable = t
        let db = self.db, p = meta("turntable")
        Task {
            do { try await db.set(p, t.doc, merge: false) } catch { self.failed("record player", error) }
        }
    }

    /// put the jazz record on, from the track after the last one heard
    public func playRecord() { turn(.jazz(turntable, by: me, now: Values.nowMs())) }

    /// put a song from YouTube on instead; what's wrong with the link, if it isn't one
    public func playSong(_ link: String) -> String? {
        guard let t = TurntableState.song(link, turntable, by: me, now: Values.nowMs()) else {
            return "That doesn’t look like a link to a song on YouTube. Try copying it again from Share > Copy link."
        }
        turn(t)
        return nil
    }

    public func liftNeedle() { turn(turntable?.lifted(by: me, now: Values.nowMs())) }
    public func nextTrack() { turn(turntable?.skipped(by: me, now: Values.nowMs())) }
    /// the song's title, once its player knows it (only whoever put it on writes it down)
    public func songTitle(_ id: String, _ title: String) { turn(turntable?.titled(id, title, me: me, now: Values.nowMs())) }
    /// the song finished, or can't play here: the needle lifts for both of you
    public func songEnded(_ id: String) { turn(turntable?.songEnded(id, by: me, now: Values.nowMs())) }

    /* ---------- decorating ---------- */

    public var decor: Decor { decorDoc.decor }
    public var stitches: Int { decorDoc.balance }

    private func earnStitches() {
        guard loaded.contains("decor") else { return }
        let d = decorDoc
        func has(_ k: String) -> Bool { d.earned[k] != nil || earnSent.contains(k) }
        var credits: [(String, Int, String)] = []
        if !has(DecorDoc.earnWelcome) { credits.append((DecorDoc.earnWelcome, Catalogue.welcomeGift(couch.together.count), "welcome")) }
        if partnerHere {
            let v = DecorDoc.earnVisit(today, me)
            if !has(v) { credits.append((v, Catalogue.visit, "you showed up")) }
            if togetherToday && !has(DecorDoc.earnTogether(today)) { credits.append((DecorDoc.earnTogether(today), Catalogue.together, "you’re both here today")) }
            if letter(.daily).opened && !has(DecorDoc.earnLetter(today)) { credits.append((DecorDoc.earnLetter(today), Catalogue.letter, "today’s letter is open")) }
        }
        if credits.isEmpty { return }
        credits.forEach { earnSent.insert($0.0) }
        var earned: Doc = [:]
        for c in credits { earned[c.0] = c.1 }
        save(meta("decor"), ["earned": earned], "stitches")
        let amount = credits.reduce(0) { $0 + $1.1 }
        if credits.contains(where: { $0.2 == "welcome" }) {
            stitchNote = "A housewarming gift: \(amount) stitches to decorate the room with."
        } else {
            let r = credits.map(\.2)
            let why = r.count <= 1 ? (r.first ?? "") : r.dropLast().joined(separator: ", ") + ", and " + r.last!
            stitchNote = "+\(amount) stitches: \(why)."
        }
    }

    public func owns(_ i: DecorItem) -> Bool { decorDoc.owns(i) }

    /// buy it (if you can) and put it out; false when you're short
    @discardableResult
    public func buy(_ i: DecorItem) -> Bool {
        if owns(i) {
            place(i)
            return true
        }
        guard stitches >= i.price else { return false }
        save(meta("decor"), ["bought": [i.key: ["by": me, "at": Values.nowMs(), "price": i.price]], "placed": [i.slot.rawValue: i.id]], "decor")
        let a = Catalogue.announce(i, who: myName)
        activity(.new(.roomDecorated, a.title, a.description))
        return true
    }

    public func place(_ i: DecorItem) {
        if owns(i) { save(meta("decor"), ["placed": [i.slot.rawValue: i.id]], "decor") }
    }

    /* ---------- you two ---------- */

    public func setLook(_ a: AvatarConfig) {
        save(path("members/\(me)"), ["avatar": Wardrobe.dictionary(a)], "look")
        activity(.new(.avatarUpdated, "New look", "\(myName) changed their look."))
    }

    public func setName(_ n: String) {
        let name = String(n.trimmingCharacters(in: .whitespacesAndNewlines).prefix(40))
        if !name.isEmpty { save(path("members/\(me)"), ["name": name], "name") }
    }

    public func rename(_ name: String, togetherSince: String?) {
        var patch: Doc = ["name": String(name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(60))]
        if let t = togetherSince, isDayKey(t) { patch["togetherSince"] = t }
        let db = self.db, p = "spaces/\(sid)", d = patch
        Task {
            do { try await db.update(p, d) } catch { self.failed("place", error) }
        }
    }

    /// a fresh invite, for a week
    public func newInvite() {
        guard let sp = space, sp.creatorId == me, sp.partnerId == nil else { return }
        let code = Places.makeCode()
        let ms = (Values.nowMs() + Places.week).rounded()
        let host = members[me] ?? MemberDoc(name: myName, avatar: myLook)
        let invite = Places.invitePayload(spaceId: sid, creatorId: me, spaceName: sp.name, host: host, partnerName: sp.partnerPlaceholderName, expiresMs: ms, backend: db)
        let db = self.db, sid = self.sid
        Task {
            do {
                try await db.set("invites/\(code)", invite, merge: false)
                try await db.update("spaces/\(sid)", ["inviteCode": code, "inviteExpiresAt": Values.iso(Date(timeIntervalSince1970: ms / 1000)), "inviteExpiresAtMs": ms])
            } catch { self.failed("invite", error) }
        }
    }

    public var inviteLink: String? {
        guard let c = space?.inviteCode, !c.isEmpty else { return nil }
        return "https://soultied.app/?join=\(c)"
    }

    public var inviteExpired: Bool { (space?.inviteExpiresAtMs ?? 0) < now.timeIntervalSince1970 * 1000 }

    /// days since you said you got together (nil if you haven't said)
    public var daysTogether: Int? {
        guard let t = space?.togetherSince else { return nil }
        return Day.number(today) - Day.number(t)
    }
}

extension Backend {
    /// a whole document, written once
    func setLater(_ path: String, _ data: Doc, _ place: PlaceModel) {
        Task {
            do { try await self.set(path, data, merge: false) } catch {
                print("[soultied] \(path): \(error)")
                DispatchQueue.main.async { place.problem = "That didn’t save. Check your connection and try again." }
            }
        }
    }
}

/// every change happens on the main thread (the screens, and the database's callbacks)
extension PlaceModel: @unchecked Sendable {}
