import SwiftUI
import AuthenticationServices
import SoultiedCore

/* ---------- the front door ---------- */

/// an empty room, the couch waiting
private func emptyRoomPlace() -> PlaceModel {
    let p = PlaceModel(db: MemoryBackend(), sid: "front-door", me: "nobody")
    return p
}

struct WelcomeView: View {
    let app: AppModel
    @State private var door = emptyRoomPlace()
    /// the screen settles in a piece at a time (the room, the name, the card, the buttons)
    @State private var shown = 0
    @Environment(\.openURL) private var openURL
    @Environment(\.displayScale) private var displayScale
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { geo in
            ScrollView {
                VStack(spacing: 18) {
                    // the room, like a game's title screen: the name sits on it, over a soft fade into the night
                    RoomScene(place: door, couchOnly: true, crop: .welcome)
                        .frame(height: RoomCrop.welcome.viewHeight(width: geo.size.width, displayScale: displayScale))
                        .allowsHitTesting(false)
                        .overlay(alignment: .bottom) {
                            LinearGradient(colors: [.clear, Color.room.opacity(0.88)], startPoint: .top, endPoint: .bottom)
                                .frame(height: 96)
                        }
                        .overlay(alignment: .bottomLeading) { title }
                        .opacity(shown >= 1 ? 1 : 0)

                    VStack(alignment: .leading, spacing: 14) {
                        Text("A shared home for long-distance couples.").font(.px(20, 700)).foregroundStyle(Color.inkSoft)
                        features
                        Text("A letter to open together every day, touches that buzz in their pocket, your wall of notes and photos, shows in sync, and a couch you scoot closer on every day you both show up.")
                            .font(.pxBody).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)

                        if app.pendingJoin != nil {
                            Text("You’re invited. Sign in to take your seat.").font(.pxBodyBold).foregroundStyle(Color.terracottaD)
                        }

                        SignInWithAppleButton(.continue) { req in
                            (app.auth as? FirebaseAuthService)?.prepareApple(req)
                        } onCompletion: { result in
                            Task { @MainActor in
                                do {
                                    try await (app.auth as? FirebaseAuthService)?.finishApple(result)
                                } catch {
                                    let ns = error as NSError
                                    if ns.code != ASAuthorizationError.Code.canceled.rawValue { app.problem = "That sign-in didn’t work. Try again?" }
                                }
                            }
                        }
                        .signInWithAppleButtonStyle(.black)
                        .frame(height: 50)
                        .padding(PX)
                        .background(NotchedFrame(notch: PX).fill(Color.ink))

                        Button {
                            Task { await app.signIn(.google) }
                        } label: {
                            Text(app.busy ? "Opening Google…" : "Continue with Google")
                        }
                        .buttonStyle(.px(.paper, wide: true))
                        .disabled(app.busy)

                        if let p = app.problem {
                            Text(p).font(.pxSmall).foregroundStyle(Color(hex: "#7f3835")).padding(10).frame(maxWidth: .infinity, alignment: .leading).pxInset()
                        }

                        Text("Pick the same account you use on soultied.app, and your place is right here. We only use it to sign you in; your letters stay between the two of you.")
                            .font(.pxTiny).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)

                        HStack(spacing: 18) {
                            Button("Peek at a demo room") { app.openDemo() }
                            Button("Privacy") { openURL(URL(string: "https://soultied.app/privacy/")!) }
                            Button("Terms") { openURL(URL(string: "https://soultied.app/terms/")!) }
                        }
                        .font(.px(14, 600))
                        .foregroundStyle(Color.terracottaD)
                        .underline()
                    }
                    .pxCard()
                    .padding(.horizontal, 16)
                    .opacity(shown >= 3 ? 1 : 0)
                    .offset(y: shown >= 3 || reduceMotion ? 0 : 28)
                }
                .padding(.bottom, 30)
            }
            .scrollBounceBehavior(.basedOnSize)
        }
        .task {
            // (after the opening, a beat at a time)
            let wait = max(0, Intro.until.timeIntervalSinceNow)
            if wait > 0 { try? await Task.sleep(nanoseconds: UInt64(wait * 1_000_000_000)) }
            for i in 1...3 {
                try? await Task.sleep(nanoseconds: i == 1 ? 120_000_000 : 220_000_000)
                withAnimation(reduceMotion ? .easeOut(duration: 0.3) : .spring(response: 0.5, dampingFraction: 0.82)) { shown = i }
            }
        }
    }

    /// "Soultied", on the room
    private var title: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 10) {
                GlyphView(glyph: Icons.heart, scale: 4)
                Text("OUR PLACE · FOR TWO").font(.px(12, 700)).kerning(1.8).foregroundStyle(Color.butter)
            }
            Text("Soultied")
                .font(.px(48, 700))
                .foregroundStyle(Color.paper)
                .shadow(color: Color.thread.opacity(0.7), radius: 0, x: 0, y: 3)
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 10)
        .opacity(shown >= 2 ? 1 : 0)
        .offset(y: shown >= 2 || reduceMotion ? 0 : 12)
    }

    /// what's inside, at a glance
    private var features: some View {
        HStack(spacing: 8) {
            feature(Icons.envelope, "Daily letters")
            feature(Icons.tv, "Watch together")
            feature(Icons.play, "Games for two")
            feature(Icons.couch, "One couch")
        }
    }

    private func feature(_ g: Glyph, _ label: String) -> some View {
        VStack(spacing: 6) {
            GlyphView(glyph: g, scale: 3).frame(height: 30)
            Text(label).font(.px(11, 700)).foregroundStyle(Color.inkSoft).multilineTextAlignment(.center).lineLimit(2).minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, minHeight: 74)
        .padding(.horizontal, 2)
        .pxInset()
    }
}

/* ---------- starting a place, or joining one ---------- */

struct SetupView: View {
    let app: AppModel
    enum Step { case choose, names, look, join, joinLook }
    @State private var step: Step = .choose
    @State private var myName = ""
    @State private var theirName = ""
    @State private var placeName = ""
    @State private var since = Date()
    @State private var sayWhen = false
    @State private var look = Wardrobe.defaultA
    @State private var code = ""
    @State private var invite: Invite?
    @State private var joinProblem: String?
    @State private var looking = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                switch step {
                case .choose: choose
                case .names: names
                case .look: lookStep(join: false)
                case .join: join
                case .joinLook: lookStep(join: true)
                }
            }
            .pxCard()
            .padding(16)
            .padding(.top, 20)
        }
        .scrollDismissesKeyboard(.interactively)
        .onAppear {
            myName = app.user?.name?.split(separator: " ").first.map(String.init) ?? ""
            if let c = app.pendingJoin {
                code = c
                step = .join
                Task { await find() }
            }
        }
        .animation(.easeOut(duration: 0.2), value: step)
    }

    private var choose: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("WELCOME IN").font(.px(12, 600)).kerning(1.6).foregroundStyle(Color.terracottaD)
            Text("Is this a new place, or are you joining your person?").font(.pxTitle).foregroundStyle(Color.inkSoft).fixedSize(horizontal: false, vertical: true)
            Button("Build our place →") { step = .names }.buttonStyle(.px(.terracotta, wide: true))
            Button("I have an invite") { step = .join }.buttonStyle(.px(.paper, wide: true))
            Button("Peek at a demo room first") { app.openDemo() }
                .font(.px(14, 600)).foregroundStyle(Color.terracottaD).underline()
            Divider().overlay(Color.paperShade)
            Button("Sign out") { app.signOut() }.font(.pxSmall).foregroundStyle(Color.muted)
        }
    }

    private var names: some View {
        VStack(alignment: .leading, spacing: 16) {
            Dots(n: 1, of: 3)
            Text("First, the two of you.").font(.pxTitle).foregroundStyle(Color.inkSoft)
            Text("Just names for now. You can change everything later.").font(.pxBody).foregroundStyle(Color.muted)
            VStack(alignment: .leading, spacing: 6) {
                PixelLabel(text: "Your name")
                PixelField(placeholder: "e.g. Vedanth", text: $myName, limit: 24)
            }
            VStack(alignment: .leading, spacing: 6) {
                PixelLabel(text: "Your person’s name")
                PixelField(placeholder: "We’ll save them a seat", text: $theirName, limit: 24)
            }
            VStack(alignment: .leading, spacing: 6) {
                PixelLabel(text: "Name your place")
                PixelField(placeholder: "Our Little Place", text: $placeName, limit: 40)
            }
            Toggle(isOn: $sayWhen) { Text("Say when you got together").font(.pxBody).foregroundStyle(Color.inkSoft) }
                .tint(Color.sage)
            if sayWhen {
                DatePicker("Together since", selection: $since, in: ...Date(), displayedComponents: .date)
                    .font(.pxBody).foregroundStyle(Color.inkSoft).tint(Color.terracotta)
            }
            HStack {
                Button("Back") { step = .choose }.buttonStyle(.px(.paper, small: true))
                Spacer()
                Button("Next: your character →") { step = .look }
                    .buttonStyle(.px(.terracotta))
                    .disabled(myName.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
    }

    private func lookStep(join: Bool) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Dots(n: join ? 2 : 2, of: join ? 2 : 3)
            Text("Make your little character.").font(.pxTitle).foregroundStyle(Color.inkSoft)
            Text(join ? "This is you on the couch, next to \(invite?.hostName ?? "them")." : "This is you on the couch. Your person makes theirs when they join.")
                .font(.pxBody).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
            StudioView(look: $look)
            if let p = joinProblem ?? app.problem {
                Text(p).font(.pxSmall).foregroundStyle(Color(hex: "#7f3835")).padding(10).frame(maxWidth: .infinity, alignment: .leading).pxInset()
            }
            HStack {
                Button("Back") { step = join ? .join : .names }.buttonStyle(.px(.paper, small: true))
                Spacer()
                Button(app.busy ? "Moving in…" : join ? "Take my seat →" : "Move in →") {
                    Task {
                        if join {
                            let r = await app.join(code: code, myName: myName, look: look)
                            joinProblem = message(r)
                        } else {
                            await app.createPlace(myName: myName, look: look, placeName: placeName, partnerName: theirName, togetherSince: sayWhen ? Day.today(since) : nil)
                        }
                    }
                }
                .buttonStyle(.px(.terracotta))
                .disabled(app.busy)
            }
        }
    }

    private var join: some View {
        VStack(alignment: .leading, spacing: 16) {
            Dots(n: 1, of: 2)
            Text("Take your seat.").font(.pxTitle).foregroundStyle(Color.inkSoft)
            Text("Paste the invite code your person sent you (it looks like ST-ABCD-EFGH-JKMN).").font(.pxBody).foregroundStyle(Color.muted).fixedSize(horizontal: false, vertical: true)
            VStack(alignment: .leading, spacing: 6) {
                PixelLabel(text: "Invite code")
                PixelField(placeholder: "ST-…", text: $code, limit: 24)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
            }
            if let inv = invite {
                HStack(spacing: 12) {
                    HeadView(look: inv.hostAvatar, size: 44)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(inv.hostName)’s invite").font(.pxBodyBold).foregroundStyle(Color.inkSoft)
                        Text("to \(inv.spaceName)").font(.pxSmall).foregroundStyle(Color.muted)
                    }
                }
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .pxInset()
                VStack(alignment: .leading, spacing: 6) {
                    PixelLabel(text: "Your name")
                    PixelField(placeholder: inv.partnerPlaceholderName.isEmpty ? "Your name" : inv.partnerPlaceholderName, text: $myName, limit: 24)
                }
            }
            if let p = joinProblem {
                Text(p).font(.pxSmall).foregroundStyle(Color(hex: "#7f3835")).padding(10).frame(maxWidth: .infinity, alignment: .leading).pxInset()
            }
            HStack {
                Button("Back") {
                    invite = nil
                    step = .choose
                }
                .buttonStyle(.px(.paper, small: true))
                Spacer()
                if invite == nil {
                    Button(looking ? "Looking…" : "Find the invite") { Task { await find() } }
                        .buttonStyle(.px(.terracotta))
                        .disabled(code.trimmingCharacters(in: .whitespaces).count < 6 || looking)
                } else {
                    Button("Next: your character →") {
                        look = Wardrobe.defaultB
                        step = .joinLook
                    }
                    .buttonStyle(.px(.terracotta))
                    .disabled(myName.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }

    private func find() async {
        looking = true
        defer { looking = false }
        joinProblem = nil
        let inv = await app.lookupInvite(code)
        if let inv {
            if inv.expiresAtMs < Values.nowMs() {
                joinProblem = "That invite has run out. Ask \(inv.hostName) for a fresh one (they can make one in Us)."
                return
            }
            invite = inv
            if myName.isEmpty { myName = inv.partnerPlaceholderName == "my person" ? "" : inv.partnerPlaceholderName }
        } else {
            joinProblem = "We couldn’t find that invite. Check the code, or ask your person to send it again."
        }
    }

    private func message(_ r: JoinResult) -> String? {
        switch r {
        case .ok: return nil
        case .notFound: return "We couldn’t find that invite. Check the code, or ask your person to send it again."
        case .expired: return "That invite has run out. Ask your person for a fresh one."
        case .full: return "Someone’s already sitting in that seat. If it’s you, sign in with the account you used then."
        case .failed(let s): return s
        }
    }
}

/// "step 1 of 3" as little squares
struct Dots: View {
    var n: Int
    var of: Int
    var body: some View {
        HStack(spacing: 6) {
            ForEach(1...of, id: \.self) { i in
                Rectangle().fill(i <= n ? Color.terracotta : Color.paperShade).frame(width: i == n ? 22 : 10, height: 10)
            }
        }
        .accessibilityLabel("Step \(n) of \(of)")
    }
}

/* ---------- the wardrobe ---------- */

struct StudioView: View {
    @Binding var look: AvatarConfig
    enum Tab: String, CaseIterable { case body = "Body", hair = "Hair", outfit = "Outfit", extras = "Extras" }
    @State private var tab: Tab = .body

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .bottom, spacing: 14) {
                ZStack(alignment: .bottom) {
                    Rectangle().fill(Color(hex: "#c9ae86")).frame(height: 26)
                    CharacterView(look: look, scale: 4).padding(.bottom, 8)
                }
                .frame(width: 132, height: 214)
                .pxInset()
                VStack(alignment: .leading, spacing: 10) {
                    Button("Surprise me") {
                        Haptics.tap()
                        look = Wardrobe.random()
                    }
                    .buttonStyle(.px(.paper, small: true))
                    Text("Tap anything below to try it on.").font(.pxSmall).foregroundStyle(Color.muted)
                }
            }
            HStack(spacing: 0) {
                ForEach(Tab.allCases, id: \.self) { t in
                    Button {
                        tab = t
                    } label: {
                        Text(t.rawValue)
                            .font(.px(16, 600))
                            .foregroundStyle(tab == t ? Color.inkSoft : Color.muted)
                            .padding(.vertical, 6)
                            .frame(maxWidth: .infinity)
                            .overlay(alignment: .bottom) { Rectangle().fill(tab == t ? Color.terracotta : Color.clear).frame(height: 3) }
                    }
                }
            }
            switch tab {
            case .body:
                swatches("Skin tone", Wardrobe.skinTones, look.skin) { look.skin = $0 }
                choices("Height", [Opt("short", "Short"), Opt("medium", "Medium"), Opt("tall", "Tall")], look.height) { look.height = $0 }
                choices("Facial hair", Wardrobe.facialHair.map { Opt($0.id, $0.name) }, look.facialHair) { look.facialHair = $0 }
            case .hair:
                choices("Style", Wardrobe.hairStyles.map { Opt($0.id, $0.name) }, look.hairStyle) { id in
                    let hijab = id == "hijab"
                    if hijab && !Wardrobe.clothColors.contains(where: { $0.id == look.hairColor }) {
                        look.hairColor = "sage"
                        look.hat = "none"
                    } else if !hijab && !Wardrobe.hairColors.contains(where: { $0.id == look.hairColor }) {
                        look.hairColor = "cocoa"
                    }
                    look.hairStyle = id
                }
                if look.hairStyle != "bald" {
                    let hijab = look.hairStyle == "hijab"
                    swatches(hijab ? "Scarf colour" : "Hair colour", hijab ? Wardrobe.clothColors : Wardrobe.hairColors, look.hairColor) { look.hairColor = $0 }
                }
            case .outfit:
                choices("Top", Wardrobe.tops.map { Opt($0.id, $0.name) }, look.top) { look.top = $0 }
                swatches("Top colour", Wardrobe.clothColors, look.topColor) { look.topColor = $0 }
                choices("Bottoms", Wardrobe.bottoms.map { Opt($0.id, $0.name) }, look.bottom) { look.bottom = $0 }
                swatches("Bottoms colour", Wardrobe.clothColors, look.bottomColor) { look.bottomColor = $0 }
                choices("On your feet", Wardrobe.shoes.map { Opt($0.id, $0.name) }, look.shoes) { look.shoes = $0 }
                swatches("Socks & shoes colour", Wardrobe.clothColors, look.shoesColor) { look.shoesColor = $0 }
            case .extras:
                choices("Glasses", Wardrobe.glasses.map { Opt($0.id, $0.name) }, look.glasses) { look.glasses = $0 }
                if look.hairStyle != "hijab" {
                    choices("On your head", Wardrobe.hats.map { Opt($0.id, $0.name) }, look.hat) { look.hat = $0 }
                }
                choices("Little extras", Wardrobe.extras.map { Opt($0.id, $0.name) }, look.extra) { look.extra = $0 }
            }
        }
    }

    private func choices(_ label: String, _ list: [Opt], _ current: String, _ pick: @escaping (String) -> Void) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            PixelLabel(text: label)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 96), spacing: 8)], spacing: 8) {
                ForEach(list) { item in
                    Button(item.name) {
                        Haptics.tap()
                        pick(item.id)
                    }
                    .buttonStyle(ChipStyle(on: current == item.id))
                }
            }
        }
    }

    private func swatches(_ label: String, _ list: [Swatch], _ current: String, _ pick: @escaping (String) -> Void) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            PixelLabel(text: label)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 34), spacing: 10)], spacing: 10) {
                ForEach(list, id: \.id) { s in
                    Button {
                        Haptics.tap()
                        pick(s.id)
                    } label: {
                        Rectangle()
                            .fill(Color(.sRGB, red: Double(s.base.r) / 255, green: Double(s.base.g) / 255, blue: Double(s.base.b) / 255))
                            .frame(width: 30, height: 30)
                            .overlay(alignment: .bottom) { Rectangle().fill(Color.black.opacity(0.2)).frame(height: 4) }
                            .padding(PX)
                            .background(NotchedFrame(notch: PX).fill(current == s.id ? Color.ink : Color.paperShade))
                            .padding(current == s.id ? 3 : 0)
                            .background(current == s.id ? Color.terracotta : Color.clear)
                    }
                    .accessibilityLabel(s.name)
                    .accessibilityAddTraits(current == s.id ? .isSelected : [])
                }
            }
        }
    }
}

/// one thing to pick
struct Opt: Identifiable, Hashable {
    let id: String
    let name: String
    init(_ id: String, _ name: String) {
        self.id = id
        self.name = name
    }
}
