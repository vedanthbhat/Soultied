import SwiftUI
import SoultiedCore

/*
 * The next time you'll be together (meta/visit, shared with the website): a card on Home that counts down to
 * the day, and a sheet for either of you to set it or change it.
 */

struct CountdownCard: View {
    let place: PlaceModel
    @State private var editing = false

    var body: some View {
        let left = place.visitDays
        HStack(alignment: .center, spacing: 14) {
            GlyphView(glyph: UsGlyphs.calendar, scale: 4)
            VStack(alignment: .leading, spacing: 2) {
                Text("Next time together").font(.pxTiny).foregroundStyle(Color.muted)
                if let left {
                    Text(left > 1 ? "\(left) days" : left == 1 ? "Tomorrow" : "Today!").font(.pxHeading).foregroundStyle(Color.inkSoft)
                    Text(place.visit.what.isEmpty ? (left > 1 ? "until you’re together" : "you’re together") : (left > 1 ? "until \(place.visit.what)" : place.visit.what))
                        .font(.pxBody).foregroundStyle(Color.muted).lineLimit(2)
                    if let planned = place.bucket.plannedLine(place.visit.what) {
                        Text(planned).font(.pxSmall).foregroundStyle(Color.terracottaD).lineLimit(1).minimumScaleFactor(0.8)
                    }
                } else {
                    Text("When do you see each other next?").font(.pxBodyBold).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
                    Text("Set the day and you’ll both count down to it.").font(.pxSmall).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: 0)
            Button(left == nil ? "Set it" : "Change") { editing = true }
                .buttonStyle(.px(.sage, small: true))
        }
        .pxCard()
        .accessibilityElement(children: .combine)
        .sheet(isPresented: $editing) { VisitSheet(place: place).presentationDetents([.large]).presentationBackground(Color.paper) }
    }
}

struct VisitSheet: View {
    let place: PlaceModel
    @State private var day = Date()
    @State private var what = ""
    @Environment(\.dismiss) private var dismiss

    private var range: ClosedRange<Date> {
        let start = Calendar.current.startOfDay(for: Date())
        return start...(Calendar.current.date(byAdding: .year, value: 3, to: start) ?? start)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Next time together").font(.pxTitle).foregroundStyle(Color.inkSoft)
                Text("Pick the day you’ll see each other. \(place.theirName) gets the countdown too, on Soultied and on the widgets.")
                    .font(.pxBody).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
                DatePicker("The day", selection: $day, in: range, displayedComponents: .date)
                    .datePickerStyle(.graphical)
                    .tint(Color.terracotta)
                    .padding(8)
                    .background(Color.paperInput)
                VStack(alignment: .leading, spacing: 6) {
                    PixelLabel(text: "Where, or what for (if you like)")
                    PixelField(placeholder: "Goa, the wedding, your birthday", text: $what, limit: VISIT_WHAT_MAX)
                }
                Button("Save the day") {
                    place.setVisit(date: Day.today(day), what: what)
                    Haptics.success()
                    dismiss()
                }
                .buttonStyle(.px(.terracotta, wide: true))
                if place.visitDays != nil {
                    Button("Take it down") {
                        place.setVisit(date: "", what: "")
                        dismiss()
                    }
                    .buttonStyle(.px(.paper, wide: true))
                }
            }
            .padding(20)
        }
        .onAppear {
            what = place.visit.what
            if place.visitDays != nil, let d = localDate(place.visit.date) { day = d }
            else { day = Calendar.current.date(byAdding: .day, value: 14, to: Date()) ?? Date() }
        }
    }
}

/// a day key ("2026-11-20") as that day here
func localDate(_ key: String) -> Date? {
    var c = DateComponents()
    c.year = Int(key.prefix(4))
    c.month = Int(key.dropFirst(5).prefix(2))
    c.day = Int(key.suffix(2))
    return Calendar.current.date(from: c)
}
