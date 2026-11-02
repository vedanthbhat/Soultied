import Foundation

/*
 * Questions you write for each other (src/together/asks.ts). One of you asks, in your own words or with up
 * to four answers to pick from, and answers it too; it opens for both of you once the other has answered.
 * Kept in the place's meta/asks document.
 */

public let ASK_PROMPT_MAX = 200
public let ASK_OPTION_MAX = 60
public let ASK_ANSWER_MAX = 400

public struct AskAnswer: Sendable, Equatable {
    public var pick: Int?
    public var text: String?
    public var at: Double

    public init(pick: Int? = nil, text: String? = nil, at: Double = Values.nowMs()) {
        self.pick = pick
        self.text = text
        self.at = at
    }

    init?(_ raw: Any?) {
        guard let a = raw as? Doc else { return nil }
        at = a.num("at") ?? 0
        pick = a.int("pick")
        let t = a.str("text").map { String($0.prefix(ASK_ANSWER_MAX)) }
        text = t.flatMap { $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : $0 }
        if pick == nil && text == nil { return nil }
    }

    public var doc: Doc {
        var d: Doc = ["at": at]
        if let p = pick { d["pick"] = p }
        if let t = text { d["text"] = t }
        return d
    }
}

public struct Ask: Sendable, Identifiable, Equatable {
    public let id: String
    public var by: String
    public var prompt: String
    /// 2–4 answers to pick from, or none to answer in your own words
    public var options: [String]
    public var at: Double
    public var answers: [String: AskAnswer]
    /// when each of you first saw it open
    public var seen: [String: Double]

    public func open(_ me: String, _ them: String) -> Bool { answers[me] != nil && answers[them] != nil }

    /// what an answer says, in words
    public func said(_ a: AskAnswer?) -> String {
        guard let a else { return "—" }
        if let p = a.pick, p >= 0, p < options.count { return options[p] }
        return a.text ?? "—"
    }
}

public func asks(_ raw: Doc?) -> [String: Ask] {
    var items: [String: Ask] = [:]
    for (id, v) in (raw ?? [:]).map("items") {
        guard let x = v as? Doc, let by = x.str("by") else { continue }
        let prompt = String((x.str("prompt") ?? "").prefix(ASK_PROMPT_MAX)).trimmingCharacters(in: .whitespacesAndNewlines)
        if prompt.isEmpty { continue }
        let options = Array(x.list("options").compactMap { $0 as? String }.map { String($0.prefix(ASK_OPTION_MAX)).trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }.prefix(4))
        var answers: [String: AskAnswer] = [:]
        for (uid, a) in x.map("answers") { if let n = AskAnswer(a) { answers[uid] = n } }
        items[id] = Ask(id: id, by: by, prompt: prompt, options: options.count >= 2 ? options : [], at: x.num("at") ?? 0, answers: answers, seen: numbers(x.map("seen")))
    }
    return items
}

public struct AsksView: Sendable {
    /// your person asked, you haven't answered
    public var forMe: [Ask] = []
    /// you asked, they haven't answered
    public var waiting: [Ask] = []
    /// both answered, newest first
    public var opened: [Ask] = []
    /// opened since you last looked
    public var fresh: [Ask] = []
}

public func viewAsks(_ items: [String: Ask], me: String, them: String?) -> AsksView {
    let all = items.values.sorted { $0.at > $1.at }
    guard let them else { return AsksView(waiting: all.filter { $0.by == me }) }
    let opened = all.filter { $0.open(me, them) }
    return AsksView(
        forMe: all.filter { $0.by != me && $0.answers[me] == nil },
        waiting: all.filter { $0.by == me && $0.answers[them] == nil },
        opened: opened,
        fresh: opened.filter { $0.seen[me] == nil }
    )
}

/// ideas for when you can't think what to ask (the In your words deck)
public func askIdeas() -> [String] {
    Cards.all.filter { $0.style == .open && !$0.prompt.hasPrefix("Finish this") }.map(\.prompt)
}

public let DEMO_REPLIES = [
    "Easy. You, every time.",
    "Ooh. Ask me again on our call, I want to see your face.",
    "This made me smile at my desk.",
    "Honestly? Same as you, probably.",
]
