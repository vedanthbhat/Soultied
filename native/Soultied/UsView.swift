import SwiftUI
import UIKit
import SoultiedCore

/*
 * Us: the two of you, your place, the invite, your look, the app's look, what's happened lately, and your account.
 */

struct UsView: View {
    let app: AppModel
    let place: PlaceModel
    @State private var editingPlace = false
    @State private var confirmDelete = false
    @State private var deleteFailed = false
    @State private var soundsOff = Chiptune.shared.muted
    @State private var decorating = false
    @Environment(\.openURL) private var openURL

    private enum Panel: String, Identifiable {
        case apart, list, recap, lately, you, notifications, settings, invite
        var id: String { rawValue }
    }
    @State private var panel: Panel?
    private var near: Bool { ["city", "together"].contains(place.aboutMine?["far"] ?? "") }

    var body: some View {
        GeometryReader { geometry in
            ScrollView {
                VStack(spacing: 10) {
                    HStack {
                        DarkHeading(title: "Us", sub: place.space?.name)
                        Spacer()
                        Button("Settings") { panel = .settings }.buttonStyle(.px(.paper, small: true))
                    }
                    couple
                    Grid(horizontalSpacing: 10, verticalSpacing: 10) {
                        GridRow {
                            tile(near ? "Our next date" : "How far", planLine, UsGlyphs.calendar, .apart)
                            tile("Our list", "\(place.bucket.view.todo.count) to do", Icons.star, .list)
                        }
                        GridRow {
                            tile("This month", place.recapMemory, Icons.heart, .recap)
                            tile("Lately", place.activities.first?.title ?? "Your room is ready", Icons.envelope, .lately)
                        }
                        GridRow {
                            tile("You", place.myName, Icons.us, .you)
                            tile("Nudges", "Your preferences", Icons.seal, .notifications)
                        }
                    }
                    Button(place.hasPlus ? "Your Soultied Plus plan" : "Explore Soultied Plus") { PlusGate.shared.show(.plain) }
                        .buttonStyle(.px(.paper, wide: true))
                }
                .padding(14)
                .frame(minHeight: geometry.size.height)
            }
        }
        .onAppear {
            if MainView.showLooks || Launch.args.contains("-looks") {
                MainView.showLooks = false
                panel = .settings
            } else if let target = Launch.scrollUs { panel = Panel(rawValue: target) }
        }
        .sheet(item: $panel) { selected in
            if selected == .you { LookSheet(place: place).presentationBackground(Color.paper) } else { ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    HStack { Spacer(); Button("Done") { panel = nil }.buttonStyle(.px(.paper, small: true)) }
                    switch selected {
                    case .apart:
                        CountdownCard(place: place)
                        if place.partnerHere { ApartCard(place: place) }
                    case .list: BucketCard(place: place)
                    case .recap: RecapCard(place: place)
                    case .lately: history
                    case .notifications: NotificationsCard(place: place)
                    case .you: EmptyView()
                    case .invite: InviteCard(place: place)
                    case .settings:
                        LookPicker()
                        account
                            .confirmationDialog("Delete your Soultied account?", isPresented: $confirmDelete, titleVisibility: .visible) {
                                Button("Delete my account", role: .destructive) {
                                    Task { deleteFailed = !(await app.deleteAccount()) }
                                }
                            } message: {
                                Text("Your name and look come off the couch, and your account is deleted. \(place.partnerHere ? "\(place.theirName) keeps the place and your letters together." : "") This can’t be undone.")
                            }
                    }
                }.padding(16)
            }.presentationDragIndicator(.visible).presentationBackground(Color.paper) }
        }
        .background(RoomBackground())
        .sheet(isPresented: $editingPlace) { PlaceSheet(place: place).presentationDetents([.medium]).presentationBackground(Color.paper) }
        .sheet(isPresented: $decorating) { DecorView(place: place).presentationDragIndicator(.visible).presentationBackground(Color.paper) }
    }

    private var planLine: String {
        if !near, let km = place.apartKm {
            return apartLabel(km, miles: countsInMiles(region: Locale.current.region?.identifier))
        }
        if let days = place.visitDays {
            if !place.visit.what.isEmpty { return place.visit.what }
            return days == 0 ? "Today" : "In \(days) days"
        }
        return near ? "Plan a date" : "Plan your next visit"
    }

    private func tile(_ label: String, _ value: String, _ icon: Glyph, _ target: Panel) -> some View {
        Button { panel = target } label: {
            VStack(alignment: .leading, spacing: 7) {
                HStack {
                    if target == .you { HeadView(look: place.myLook, size: 28) } else { GlyphView(glyph: icon, scale: 2) }
                    Text(label).font(.pxSmall)
                }
                    .foregroundStyle(Color.terracottaD)
                if target == .list {
                    if place.bucket.view.todo.isEmpty { Text("Add your first idea").font(.pxSmall) }
                    ForEach(place.bucket.view.todo.prefix(2)) { item in
                        Text("• " + item.text).font(.pxBodyBold).lineLimit(1).truncationMode(.tail)
                    }
                } else { Text(value).font(.pxBodyBold).foregroundStyle(Color.inkSoft).lineLimit(2) }
            }.frame(maxWidth: .infinity, minHeight: 52, maxHeight: .infinity, alignment: .leading).pxCard()
        }.buttonStyle(.press)
    }

    private var couple: some View {
        VStack(spacing: 8) {
            HStack(spacing: 8) {
                CharacterView(look: place.myLook, scale: 2)
                if let look = place.theirLook { CharacterView(look: look, scale: 2) }
                VStack(alignment: .leading, spacing: 4) {
                    Text(place.partnerHere ? "\(place.myName) & \(place.theirName)" : place.myName).font(.pxHeading)
                    if let days = place.daysTogether { Text("\(days) days together").font(.pxSmall) }
                }
                Spacer(minLength: 0)
            }
            if !place.partnerHere {
                Button("Invite your person") { panel = .invite }.buttonStyle(.px(.terracotta, small: true, wide: true))
            }
            HStack {
                Button("Edit our place") { editingPlace = true }.buttonStyle(.px(.paper, small: true, wide: true))
                Button("Decorate the room") { decorating = true }.buttonStyle(.px(.terracotta, small: true, wide: true))
            }.evenRow()
        }.foregroundStyle(Color.inkSoft).pxCard()
    }

    private var history: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Lately").font(.pxHeading).foregroundStyle(Color.inkSoft)
            if place.activities.isEmpty {
                Text("What the two of you get up to shows here.").font(.pxBody).foregroundStyle(Color.muted)
            }
            ForEach(place.activities.prefix(12)) { a in
                HStack(alignment: .top, spacing: 10) {
                    Rectangle().fill(Color.terracotta).frame(width: 8, height: 8).padding(.top, 7)
                    VStack(alignment: .leading, spacing: 1) {
                        HStack {
                            Text(a.title).font(.pxBodyBold).foregroundStyle(Color.inkSoft)
                            Spacer()
                            Text(a.ago(now: place.now)).font(.pxTiny).foregroundStyle(Color.muted)
                        }
                        Text(a.description).font(.pxSmall).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
        .pxCard()
    }

    private var account: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(app.demo ? "The demo room" : "Your account").font(.pxHeading).foregroundStyle(Color.inkSoft)
            if app.demo {
                Text("This is Aanya and Rohan’s place, made up so you can look around. Nothing here is saved.").font(.pxBody).foregroundStyle(Color.muted)
                Button(app.user == nil ? "Leave the demo and sign in" : "Back to my place") { app.leaveDemo() }.buttonStyle(.px(.terracotta, small: true, wide: true))
            } else {
                if let e = app.user?.email { Text("Signed in as \(e)").font(.pxSmall).foregroundStyle(Color.muted) }
                Button("Sign out") { app.signOut() }.buttonStyle(.px(.paper, small: true, wide: true))
                Button("Delete my account") { confirmDelete = true }
                    .font(.px(14, 600)).foregroundStyle(Color(hex: "#7f3835")).underline()
                if deleteFailed, let p = app.problem {
                    Text(p).font(.pxSmall).foregroundStyle(Color(hex: "#7f3835"))
                }
            }
            HStack(spacing: 8) {
                Button("Show me around again") { panel = nil; Tour.shared.start() }
                    .buttonStyle(.px(.paper, small: true, wide: true))
                // the little sounds when you press things and move around the room (the haptics stay)
                Button(soundsOff ? "Sounds: off" : "Sounds: on") {
                    soundsOff.toggle()
                    Chiptune.shared.muted = soundsOff
                }
                .buttonStyle(.px(.paper, small: true, wide: true))
                .accessibilityLabel(soundsOff ? "Turn the sounds on" : "Turn the sounds off")
            }.evenRow()
            HStack(spacing: 16) {
                Button("Privacy") { openURL(URL(string: "https://soultied.app/privacy/")!) }
                Button("Terms") { openURL(URL(string: "https://soultied.app/terms/")!) }
                Button("Contact") { openURL(URL(string: "https://soultied.app/contact/")!) }
            }
            .font(.px(13, 600)).foregroundStyle(Color.terracottaD)
        }
        .pxCard()
    }
}

/// the code and link your person joins with
struct InviteCard: View {
    let place: PlaceModel
    @State private var copied = false
    @State private var doodling = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Save the seat for \(place.theirName)").font(.pxHeading).foregroundStyle(Color.inkSoft)
            Text("Send them the link. They sign in, make their character, and take the empty seat next to you.").font(.pxBody).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
            if place.inviteExpired {
                Text("This invite has run out.").font(.pxBodyBold).foregroundStyle(Color(hex: "#7f3835"))
                Button("Make a fresh invite") { place.newInvite() }.buttonStyle(.px(.sage, small: true, wide: true))
            } else if let code = place.space?.inviteCode, let link = place.inviteLink {
                Text(code).font(.px(22, 700)).foregroundStyle(Color.inkSoft).textSelection(.enabled)
                    .padding(10).frame(maxWidth: .infinity).pxInset()
                HStack(spacing: 10) {
                    ShareLink(item: URL(string: link)!, message: Text("Come sit with me on our little couch in Soultied: \(link)")) {
                        Text("Invite your person")
                    }
                    .buttonStyle(.px(.terracotta, small: true, wide: true))
                    Button(copied ? "Copied" : "Copy the code") {
                        UIPasteboard.general.string = code
                        copied = true
                        Haptics.tap()
                    }
                    .buttonStyle(.px(.paper, small: true, wide: true))
                }.evenRow()
                Button("Leave them a doodle") { doodling = true }.buttonStyle(.px(.paper, small: true))
                    .sheet(isPresented: $doodling) {
                        ScrollView { DoodlePanel(place: place) { doodling = false }.padding(16) }
                            .presentationDragIndicator(.visible).presentationBackground(Color.paper)
                    }
                Text("It works for a week. You can make a fresh one any time.").font(.pxTiny).foregroundStyle(Color.muted)
            }
        }
        .pxCard()
    }
}

struct LookSheet: View {
    let place: PlaceModel
    @State private var look = Wardrobe.defaultA
    @State private var name = ""
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    Text("Your look").font(.pxTitle).foregroundStyle(Color.inkSoft)
                    Spacer()
                    Button("Save") {
                        if name.trimmingCharacters(in: .whitespaces) != place.myName { place.setName(name) }
                        if look != place.myLook { place.setLook(look) }
                        Haptics.success()
                        dismiss()
                    }
                    .buttonStyle(.px(.terracotta, small: true))
                }
                VStack(alignment: .leading, spacing: 6) {
                    PixelLabel(text: "Your name")
                    PixelField(placeholder: "Your name", text: $name, limit: 24)
                }
                StudioView(look: $look)
            }
            .padding(20)
        }
        .onAppear {
            look = place.myLook
            name = place.myName
        }
    }
}

struct PlaceSheet: View {
    let place: PlaceModel
    @State private var name = ""
    @State private var since = Date()
    @State private var sayWhen = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Our place").font(.pxTitle).foregroundStyle(Color.inkSoft)
            VStack(alignment: .leading, spacing: 6) {
                PixelLabel(text: "Its name")
                PixelField(placeholder: "Our Little Place", text: $name, limit: 40)
            }
            Toggle(isOn: $sayWhen) { Text("Say when you got together").font(.pxBody).foregroundStyle(Color.inkSoft) }.tint(Color.sage)
            if sayWhen {
                DatePicker("Together since", selection: $since, in: ...Date(), displayedComponents: .date).font(.pxBody).tint(Color.terracotta)
            }
            Spacer()
            Button("Save") {
                place.rename(name.isEmpty ? (place.space?.name ?? "Our Little Place") : name, togetherSince: sayWhen ? Day.today(since) : nil)
                dismiss()
            }
            .buttonStyle(.px(.terracotta, wide: true))
        }
        .padding(20)
        .onAppear {
            name = place.space?.name ?? ""
            if let t = place.space?.togetherSince {
                sayWhen = true
                var c = DateComponents()
                c.year = Int(t.prefix(4))
                c.month = Int(t.dropFirst(5).prefix(2))
                c.day = Int(t.suffix(2))
                since = Calendar.current.date(from: c) ?? Date()
            }
        }
    }
}
