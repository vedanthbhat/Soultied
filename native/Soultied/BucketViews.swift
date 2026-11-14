import SwiftUI
import SoultiedCore

/*
 * Our list (meta/bucket, shared with the website): the things you want to do together. A card on Us with
 * what's next on it, and a sheet with the whole list: add things (or take an idea), star them for the next
 * time you're together, tick them off once you've done them.
 */

private let starOff = Glyph(["....y....", "....y....", "...yyy...", "yyyyyyyyy", ".yyyyyyy.", "..yyyyy..", ".yyy.yyy.", ".yy...yy."], ["y": "#c9b89a"])

private func shortDay(_ ms: Double) -> String {
    Date(timeIntervalSince1970: ms / 1000).formatted(.dateTime.day().month(.abbreviated))
}

/// where "next time" is: the place you're counting down to, if it has a name
private func nextName(_ place: PlaceModel) -> String {
    place.visitDays != nil && !place.visit.what.isEmpty ? place.visit.what : "next time"
}

struct BucketCard: View {
    let place: PlaceModel
    @State private var open = false

    var body: some View {
        let v = place.bucket.view
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                GlyphView(glyph: Icons.star, scale: 3)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Our list").font(.pxHeading).foregroundStyle(Color.inkSoft)
                    Text(v.todo.isEmpty && v.done.isEmpty ? "Things to do together, some day or next time" : "\(v.todo.count) to do · \(v.done.count) done together")
                        .font(.pxTiny).foregroundStyle(Color.muted)
                }
                Spacer(minLength: 0)
            }
            if v.todo.isEmpty {
                Text("Nothing on it yet. Add the first thing, or take an idea.").font(.pxSmall).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(v.todo.prefix(3)) { i in
                        HStack(alignment: .top, spacing: 8) {
                            GlyphView(glyph: i.next ? Icons.star : starOff, scale: 2).padding(.top, 2)
                            Text(i.text).font(.pxBody).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    if v.todo.count > 3 {
                        Text("and \(v.todo.count - 3) more").font(.pxSmall).foregroundStyle(Color.muted)
                    }
                }
            }
            Button(v.todo.isEmpty && v.done.isEmpty ? "Start our list" : "Open our list") { open = true }
                .buttonStyle(.px(.sage, wide: true))
        }
        .pxCard()
        .sheet(isPresented: $open) { BucketSheet(place: place).presentationDragIndicator(.visible).presentationBackground(Color.paper) }
        // (the screenshots: the list, open)
        .onAppear { if Launch.args.contains("-bucket") { open = true } }
    }
}

struct BucketSheet: View {
    let place: PlaceModel
    @State private var text = ""
    @State private var ideasAt: Int?
    @State private var showDone = false
    @Environment(\.dismiss) private var dismiss

    /// three ideas that aren't on the list yet (a different three each time you ask)
    private var ideas: [String] {
        guard let at = ideasAt else { return [] }
        let have = Set(place.bucket.items.values.map { $0.text.lowercased() })
        let left = BUCKET_IDEAS.filter { !have.contains($0.lowercased()) }
        guard !left.isEmpty else { return [] }
        return (0..<min(3, left.count)).map { left[(at * 3 + $0) % left.count] }
    }

    var body: some View {
        let v = place.bucket.view
        let next = nextName(place)
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Our list").font(.pxTitle).foregroundStyle(Color.inkSoft)
                    Text("Things to do together, some day or next time. Star the ones for \(next).").font(.pxSmall).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
                }
                HStack(spacing: 10) {
                    PixelField(placeholder: "Watch the sunrise from the beach", text: $text, limit: BUCKET_TEXT_MAX)
                        .submitLabel(.done)
                        .onSubmit(add)
                    Button("Add", action: add).buttonStyle(.px(.terracotta, small: true)).disabled(cleanText(text).isEmpty)
                }
                Button(ideasAt == nil ? "Need ideas?" : "More ideas") {
                    ideasAt = (ideasAt ?? Int.random(in: 0..<10)) + (ideasAt == nil ? 0 : 1)
                    Haptics.select()
                }
                .buttonStyle(.px(.paper, small: true))
                if !ideas.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(ideas, id: \.self) { idea in
                            Button {
                                place.addWish(idea)
                                Haptics.select()
                            } label: {
                                Text("+ \(idea)").frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .buttonStyle(.px(.paper, small: true, wide: true))
                        }
                    }
                }
                if !v.todo.isEmpty {
                    VStack(spacing: 8) {
                        ForEach(v.todo) { i in row(i, next: next) }
                    }
                }
                if !v.done.isEmpty {
                    Button(showDone ? "Hide what you’ve done together" : "What you’ve done together (\(v.done.count))") {
                        withAnimation(.easeOut(duration: 0.2)) { showDone.toggle() }
                    }
                    .font(.pxBodyBold).foregroundStyle(Color.terracottaD)
                    if showDone {
                        VStack(spacing: 8) {
                            ForEach(v.done) { i in doneRow(i) }
                        }
                    }
                }
                Button("Done") { dismiss() }.buttonStyle(.px(.paper, wide: true))
            }
            .padding(20)
        }
        .onAppear { if Launch.args.contains("-bucket") { showDone = true } }
    }

    private func add() {
        guard !cleanText(text).isEmpty else { return }
        place.addWish(text)
        text = ""
        Haptics.select()
    }

    private func row(_ i: BucketItem, next: String) -> some View {
        HStack(alignment: .center, spacing: 10) {
            Button {
                place.tickWish(i.id, done: true)
                Haptics.success()
            } label: {
                Rectangle().fill(Color.paperInput).frame(width: 24, height: 24).overlay(Rectangle().strokeBorder(Color.ink, lineWidth: 2))
            }
            .accessibilityLabel("Done: \(i.text)")
            VStack(alignment: .leading, spacing: 2) {
                Text(i.text).font(.pxBody).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
                if i.next { Text("for \(next)").font(.pxTiny).foregroundStyle(Color.terracottaD) }
            }
            Spacer(minLength: 0)
            Button { place.starWish(i.id, next: !i.next) } label: { GlyphView(glyph: i.next ? Icons.star : starOff, scale: 2).padding(6) }
                .accessibilityLabel(i.next ? "Not for \(next)" : "For \(next)")
            Button { place.dropWish(i.id) } label: { GlyphView(glyph: Icons.cross, scale: 2).padding(6) }
                .accessibilityLabel("Take it off the list")
        }
        .padding(10)
        .background(Color.paper2)
    }

    private func doneRow(_ i: BucketItem) -> some View {
        HStack(alignment: .center, spacing: 10) {
            Button { place.tickWish(i.id, done: false) } label: {
                Rectangle().fill(Color.paperInput).frame(width: 24, height: 24)
                    .overlay(Rectangle().strokeBorder(Color.ink, lineWidth: 2))
                    .overlay(GlyphView(glyph: Icons.check, scale: 2))
            }
            .accessibilityLabel("Not done yet: \(i.text)")
            VStack(alignment: .leading, spacing: 2) {
                Text(i.text).font(.pxBody).strikethrough().foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
                Text("done \(shortDay(i.done))").font(.pxTiny).foregroundStyle(Color.muted)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
    }
}
