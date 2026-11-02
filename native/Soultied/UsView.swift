import SwiftUI
import UIKit
import SoultiedCore

/*
 * Us: the two of you, your place, the invite, your look, what's happened lately, and your account.
 */

struct UsView: View {
    let app: AppModel
    let place: PlaceModel
    @State private var editingLook = false
    @State private var editingPlace = false
    @State private var confirmDelete = false
    @State private var deleteFailed = false
    @Environment(\.openURL) private var openURL

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                DarkHeading(title: "Us", sub: place.space?.name)
                couple
                if !place.partnerHere { InviteCard(place: place) }
                you
                history
                account
            }
            .padding(16)
            .padding(.bottom, 100)
        }
        .background(RoomBackground())
        .sheet(isPresented: $editingLook) { LookSheet(place: place).presentationBackground(Color.paper) }
        .sheet(isPresented: $editingPlace) { PlaceSheet(place: place).presentationDetents([.medium]).presentationBackground(Color.paper) }
        .confirmationDialog("Delete your Soultied account?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete my account", role: .destructive) {
                Task { deleteFailed = !(await app.deleteAccount()) }
            }
        } message: {
            Text("Your name and look come off the couch, and your account is deleted. \(place.partnerHere ? "\(place.theirName) keeps the place and your letters together." : "") This can’t be undone.")
        }
    }

    private var couple: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .bottom, spacing: 18) {
                CharacterView(look: place.myLook, scale: 3)
                if let l = place.theirLook {
                    CharacterView(look: l, scale: 3)
                }
                Spacer()
            }
            .frame(maxWidth: .infinity)
            Text(place.partnerHere ? "\(place.myName) & \(place.theirName)" : place.myName).font(.pxTitle).foregroundStyle(Color.inkSoft)
            if let t = place.space?.togetherSince, let d = place.daysTogether {
                Text("Together since \(Day.pretty(t, long: true)) \(t.prefix(4)) · \(d.formatted()) days").font(.pxBody).foregroundStyle(Color.muted)
            }
            if let s = place.space {
                Text("In your little place since \(Day.pretty(s.startKey)) \(s.startKey.prefix(4)) · \(place.streak.together) letters opened together").font(.pxSmall).foregroundStyle(Color.muted)
            }
            Button("Edit our place") { editingPlace = true }.buttonStyle(.px(.paper, small: true))
        }
        .pxCard()
    }

    private var you: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("You").font(.pxHeading).foregroundStyle(Color.inkSoft)
            HStack(spacing: 12) {
                HeadView(look: place.myLook, size: 44)
                VStack(alignment: .leading, spacing: 2) {
                    Text(place.myName).font(.pxBodyBold).foregroundStyle(Color.inkSoft)
                    Text(place.myMood.map { "Feeling \($0.line)" } ?? "No mood up right now").font(.pxSmall).foregroundStyle(Color.muted)
                }
            }
            Button("Change my look and name") { editingLook = true }.buttonStyle(.px(.terracotta, small: true))
        }
        .pxCard()
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
                Button(app.user == nil ? "Leave the demo and sign in" : "Back to my place") { app.leaveDemo() }.buttonStyle(.px(.terracotta, small: true))
            } else {
                if let e = app.user?.email { Text("Signed in as \(e)").font(.pxSmall).foregroundStyle(Color.muted) }
                Button("Sign out") { app.signOut() }.buttonStyle(.px(.paper, small: true))
                Button("Delete my account") { confirmDelete = true }
                    .font(.px(14, 600)).foregroundStyle(Color(hex: "#7f3835")).underline()
                if deleteFailed, let p = app.problem {
                    Text(p).font(.pxSmall).foregroundStyle(Color(hex: "#7f3835"))
                }
            }
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

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Save the seat for \(place.theirName)").font(.pxHeading).foregroundStyle(Color.inkSoft)
            Text("Send them the link. They sign in, make their character, and take the empty seat next to you.").font(.pxBody).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
            if place.inviteExpired {
                Text("This invite has run out.").font(.pxBodyBold).foregroundStyle(Color(hex: "#7f3835"))
                Button("Make a fresh invite") { place.newInvite() }.buttonStyle(.px(.sage, small: true))
            } else if let code = place.space?.inviteCode, let link = place.inviteLink {
                Text(code).font(.px(22, 700)).foregroundStyle(Color.inkSoft).textSelection(.enabled)
                    .padding(10).frame(maxWidth: .infinity).pxInset()
                HStack(spacing: 10) {
                    ShareLink(item: URL(string: link)!, message: Text("Come sit with me on our little couch in Soultied: \(link)")) {
                        Text("Send the invite")
                    }
                    .buttonStyle(.px(.terracotta, small: true))
                    Button(copied ? "Copied" : "Copy the code") {
                        UIPasteboard.general.string = code
                        copied = true
                        Haptics.tap()
                    }
                    .buttonStyle(.px(.paper, small: true))
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
