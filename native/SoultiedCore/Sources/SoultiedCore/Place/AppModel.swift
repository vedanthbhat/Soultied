import Foundation
import Observation

/*
 * The whole app's state: who's signed in, and which place is open (or the demo room). Sign-in itself
 * lives in the app (Apple and Google need its windows); this only needs to know who's here.
 */

public struct AuthUser: Sendable, Equatable {
    public let uid: String
    public let name: String?
    public let email: String?
    public init(uid: String, name: String?, email: String?) {
        self.uid = uid
        self.name = name
        self.email = email
    }
}

public enum SignInWay: Sendable { case apple, google }

public protocol AuthService: AnyObject {
    /// tells `fn` who's signed in now, and whenever that changes
    func observe(_ fn: @escaping (AuthUser?) -> Void) -> Listener
    func signIn(_ way: SignInWay) async throws
    func signOut() throws
    /// deletes the account itself (it may ask you to sign in again first)
    func deleteAccount() async throws
}

public enum JoinResult: Sendable, Equatable { case ok, notFound, full, expired, failed(String) }

@Observable
public final class AppModel {
    public enum Phase: Equatable {
        /// working out who's here
        case starting
        case signedOut
        /// looking for your place
        case finding
        /// signed in, no place yet: start one or join one
        case needsPlace
        case ready
    }

    public internal(set) var phase: Phase = .starting
    public internal(set) var user: AuthUser?
    public internal(set) var place: PlaceModel?
    public internal(set) var demo = false
    /// what went wrong signing in, starting or joining a place
    public var problem: String?
    /// an invite code that opened the app (soultied.app/?join=…), waiting for you to sign in
    public var pendingJoin: String?
    public var busy = false

    @ObservationIgnored public let auth: AuthService
    @ObservationIgnored public let cloud: () -> Backend
    @ObservationIgnored private var authListener: Listener?
    @ObservationIgnored private var backend: Backend?

    public init(auth: AuthService, cloud: @escaping () -> Backend) {
        self.auth = auth
        self.cloud = cloud
    }

    public func start() {
        guard authListener == nil else { return }
        authListener = auth.observe { [weak self] u in
            guard let self else { return }
            let changed = u?.uid != self.user?.uid
            self.user = u
            if self.demo { return }
            if u == nil {
                self.closePlace()
                self.phase = .signedOut
            } else if changed || self.phase == .starting || self.phase == .signedOut {
                Task { await self.findPlace() }
            }
        }
    }

    private var db: Backend {
        if let b = backend { return b }
        let b = cloud()
        backend = b
        return b
    }

    private func closePlace() {
        place?.stop()
        place = nil
    }

    private func open(_ sid: String, uid: String) {
        closePlace()
        let p = PlaceModel(db: db, sid: sid, me: uid)
        p.start()
        place = p
        phase = .ready
    }

    @MainActor
    public func findPlace() async {
        guard let u = user else { return }
        phase = .finding
        do {
            let rows = try await db.query(QuerySpec("spaces", filters: [Filter("members", .arrayContains, u.uid)], limit: 10))
            if let sid = Places.best(rows, uid: u.uid) {
                open(sid, uid: u.uid)
            } else {
                phase = .needsPlace
            }
        } catch {
            problem = "Couldn’t reach your place. Check your connection and try again."
            phase = .needsPlace
        }
    }

    /* ---------- the demo room ---------- */

    public func openDemo() {
        closePlace()
        demo = true
        let p = PlaceModel(db: Demo.backend(), sid: Demo.sid, me: Demo.me, demo: true)
        p.start()
        place = p
        phase = .ready
    }

    public func leaveDemo() {
        closePlace()
        demo = false
        if authListener == nil {
            phase = .starting
            start()
        } else if user != nil {
            Task { await findPlace() }
        } else {
            phase = .signedOut
        }
    }

    /* ---------- signing in ---------- */

    @MainActor
    public func signIn(_ way: SignInWay) async {
        problem = nil
        busy = true
        defer { busy = false }
        do {
            try await auth.signIn(way)
        } catch {
            let ns = error as NSError
            // closing the sign-in sheet isn't a problem
            if ns.code == 1001 || ns.code == -5 || "\(error)".localizedCaseInsensitiveContains("cancel") { return }
            problem = "That sign-in didn’t work. Try again?"
        }
    }

    public func signOut() {
        closePlace()
        demo = false
        try? auth.signOut()
        phase = .signedOut
    }

    /// Takes you out of the place (your name and look go blank) and deletes your account.
    @MainActor
    public func deleteAccount() async -> Bool {
        busy = true
        defer { busy = false }
        if let p = place, !demo {
            try? await p.db.merge("spaces/\(p.sid)/members/\(p.me)", ["name": "", "left": true, "lastActive": ""])
        }
        do {
            try await auth.deleteAccount()
            signOut()
            return true
        } catch {
            problem = "To delete your account, sign in again first, then try once more."
            return false
        }
    }

    /* ---------- starting or joining a place ---------- */

    @MainActor
    public func createPlace(myName: String, look: AvatarConfig, placeName: String, partnerName: String, togetherSince: String? = nil) async {
        guard let u = user else { return }
        busy = true
        defer { busy = false }
        let me = MemberDoc(name: clean(myName, "Me"), avatar: look)
        let made = Places.create(uid: u.uid, name: clean(placeName, "Our Little Place"), partnerName: clean(partnerName, "my person"), togetherSince: togetherSince, me: me, backend: db)
        do {
            try await db.commit(made.writes)
            open(made.spaceId, uid: u.uid)
        } catch {
            problem = "Couldn’t make your place just now. Check your connection and try again."
        }
    }

    public func lookupInvite(_ code: String) async -> Invite? {
        let c = Places.cleanCode(code)
        guard !c.isEmpty else { return nil }
        return Invite(try? await db.get("invites/\(c)"), millis: db.millis)
    }

    @MainActor
    public func join(code raw: String, myName: String, look: AvatarConfig) async -> JoinResult {
        guard let u = user else { return .failed("Sign in first.") }
        busy = true
        defer { busy = false }
        let code = Places.cleanCode(raw)
        guard let invite = await lookupInvite(code) else { return .notFound }
        if invite.expiresAtMs < Values.nowMs() { return .expired }
        let sid = invite.spaceId
        let name = clean(myName, "Me")
        do {
            try await db.update("spaces/\(sid)", ["partnerId": u.uid, "members": Sentinel.arrayUnion([u.uid]), "joinCode": code, "partnerPlaceholderName": name])
        } catch {
            // turned away: the seat's taken (or you're already in, and then you can read it)
            let already = ((try? await db.get("spaces/\(sid)"))?.list("members").compactMap { $0 as? String } ?? []).contains(u.uid)
            if already {
                open(sid, uid: u.uid)
                return .ok
            }
            return .full
        }
        do {
            try await db.set("spaces/\(sid)/members/\(u.uid)", MemberDoc(name: name, avatar: look).doc, merge: false)
            let a = Activity.joined(name)
            try await db.set("spaces/\(sid)/activities/\(a.id)", a.doc, merge: false)
        } catch {
            problem = "You’re in, but something didn’t save. It’ll catch up."
        }
        pendingJoin = nil
        open(sid, uid: u.uid)
        return .ok
    }

    private func clean(_ s: String, _ fallback: String) -> String {
        let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? fallback : String(t.prefix(40))
    }

    /// soultied.app/?join=ST-… (an invite link that opened the app)
    public func handle(url: URL) {
        guard let q = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems, let code = q.first(where: { $0.name == "join" })?.value, !code.isEmpty else { return }
        pendingJoin = Places.cleanCode(code)
    }
}
