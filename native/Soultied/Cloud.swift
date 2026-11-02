import Foundation
import UIKit
import AuthenticationServices
import CryptoKit
import FirebaseCore
import FirebaseAuth
import FirebaseFirestore
import GoogleSignIn
import SoultiedCore

/* ---------- Firestore: the same documents the website reads and writes ---------- */

final class FirestoreBackend: Backend {
    private let db = Firestore.firestore()

    final class Handle: Listener {
        let reg: ListenerRegistration
        init(_ r: ListenerRegistration) { reg = r }
        func stop() { reg.remove() }
    }

    private func encode(_ v: Any) -> Any {
        switch v {
        case let s as Sentinel:
            switch s {
            case .arrayUnion(let items): return FieldValue.arrayUnion(items.map(encode))
            case .delete: return FieldValue.delete()
            }
        case let d as Doc: return d.mapValues(encode)
        case let a as [Any]: return a.map(encode)
        case let date as Date: return Timestamp(date: date)
        default: return v
        }
    }

    private func encodeDoc(_ d: Doc) -> [String: Any] { d.mapValues(encode) }

    private func makeQuery(_ q: QuerySpec) -> Query {
        var x: Query = db.collection(q.collection)
        for f in q.filters {
            let field = f.field == Filter.documentId ? FieldPath.documentID() : FieldPath([f.field])
            switch f.op {
            case .equal: x = x.whereField(field, isEqualTo: f.value)
            case .greaterOrEqual: x = x.whereField(field, isGreaterThanOrEqualTo: f.value)
            case .less: x = x.whereField(field, isLessThan: f.value)
            case .arrayContains: x = x.whereField(field, arrayContains: f.value)
            }
        }
        if let o = q.orderBy { x = x.order(by: o, descending: q.descending) }
        if let n = q.limit { x = x.limit(to: n) }
        return x
    }

    func listen(_ path: String, _ fn: @escaping (Doc?) -> Void) -> Listener {
        Handle(db.document(path).addSnapshotListener { snap, err in
            if let err {
                print("[soultied] \(path): \(err.localizedDescription)")
                return
            }
            fn(snap?.exists == true ? snap?.data() : nil)
        })
    }

    func listen(_ q: QuerySpec, _ fn: @escaping ([Row]) -> Void) -> Listener {
        Handle(makeQuery(q).addSnapshotListener { snap, err in
            if let err {
                print("[soultied] \(q.collection): \(err.localizedDescription)")
                return
            }
            fn((snap?.documents ?? []).map { Row(id: $0.documentID, data: $0.data()) })
        })
    }

    func get(_ path: String) async throws -> Doc? {
        let s = try await db.document(path).getDocument()
        return s.exists ? s.data() : nil
    }

    func query(_ q: QuerySpec) async throws -> [Row] {
        try await makeQuery(q).getDocuments().documents.map { Row(id: $0.documentID, data: $0.data()) }
    }

    func set(_ path: String, _ data: Doc, merge: Bool) async throws {
        try await db.document(path).setData(encodeDoc(data), merge: merge)
    }

    func update(_ path: String, _ data: Doc) async throws {
        try await db.document(path).updateData(encodeDoc(data))
    }

    func commit(_ writes: [Write]) async throws {
        let b = db.batch()
        for w in writes { b.setData(encodeDoc(w.data), forDocument: db.document(w.path), merge: w.merge) }
        try await b.commit()
    }

    func millis(_ v: Any?) -> Double? {
        if let t = v as? Timestamp { return Double(t.seconds) * 1000 + Double(t.nanoseconds) / 1e6 }
        if let d = v as? Date { return d.timeIntervalSince1970 * 1000 }
        return Values.num(v)
    }

    func timestamp(ms: Double) -> Any { Timestamp(date: Date(timeIntervalSince1970: ms / 1000)) }
}

/* ---------- signing in: Apple and Google, through Firebase ---------- */

final class FirebaseAuthService: NSObject, AuthService {
    final class Handle: Listener {
        let h: AuthStateDidChangeListenerHandle
        init(_ h: AuthStateDidChangeListenerHandle) { self.h = h }
        func stop() { Auth.auth().removeStateDidChangeListener(h) }
    }

    func observe(_ fn: @escaping (AuthUser?) -> Void) -> Listener {
        Handle(Auth.auth().addStateDidChangeListener { _, u in
            fn(u.map { AuthUser(uid: $0.uid, name: $0.displayName, email: $0.email) })
        })
    }

    func signIn(_ way: SignInWay) async throws {
        switch way {
        case .apple:
            let a = try await AppleSignIn.go()
            _ = try await Auth.auth().signIn(with: a.credential)
            // Apple gives the name only the first time: keep it on the account
            if let name = a.name, let u = Auth.auth().currentUser, (u.displayName ?? "").isEmpty {
                let ch = u.createProfileChangeRequest()
                ch.displayName = name
                try? await ch.commitChanges()
            }
        case .google:
            let c = try await googleCredential()
            _ = try await Auth.auth().signIn(with: c)
        }
    }

    @MainActor
    private func googleCredential() async throws -> AuthCredential {
        guard let clientID = FirebaseApp.app()?.options.clientID else { throw NSError(domain: "soultied", code: 2, userInfo: [NSLocalizedDescriptionKey: "Google sign-in isn't set up"]) }
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
        guard let root = topViewController() else { throw NSError(domain: "soultied", code: 3) }
        let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: root)
        guard let idToken = result.user.idToken?.tokenString else { throw NSError(domain: "soultied", code: 4) }
        return GoogleAuthProvider.credential(withIDToken: idToken, accessToken: result.user.accessToken.tokenString)
    }

    /* Sign in with Apple's own button (WelcomeView) asks for the request and hands back the answer */

    private var appleNonce = ""

    func prepareApple(_ req: ASAuthorizationAppleIDRequest) {
        appleNonce = AppleSignIn.randomNonce()
        req.requestedScopes = [.fullName, .email]
        req.nonce = AppleSignIn.sha256(appleNonce)
    }

    @MainActor
    func finishApple(_ result: Swift.Result<ASAuthorization, Error>) async throws {
        let authorization = try result.get()
        guard let apple = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = apple.identityToken, let token = String(data: tokenData, encoding: .utf8)
        else { throw NSError(domain: "soultied", code: 6) }
        let credential = OAuthProvider.appleCredential(withIDToken: token, rawNonce: appleNonce, fullName: apple.fullName)
        _ = try await Auth.auth().signIn(with: credential)
        let name = apple.fullName.flatMap { PersonNameComponentsFormatter().string(from: $0) } ?? ""
        if !name.isEmpty, let u = Auth.auth().currentUser, (u.displayName ?? "").isEmpty {
            let ch = u.createProfileChangeRequest()
            ch.displayName = name
            try? await ch.commitChanges()
        }
    }

    func signOut() throws {
        GIDSignIn.sharedInstance.signOut()
        try Auth.auth().signOut()
    }

    /// Signs in once more (Apple and Firebase ask for that before an account goes), lets go of Apple's
    /// link to Soultied, then deletes the account.
    func deleteAccount() async throws {
        guard let u = Auth.auth().currentUser else { return }
        let providers = u.providerData.map(\.providerID)
        if providers.contains("apple.com") {
            let a = try await AppleSignIn.go()
            _ = try await u.reauthenticate(with: a.credential)
            if let code = a.authorizationCode { try? await Auth.auth().revokeToken(withAuthorizationCode: code) }
        } else if providers.contains("google.com") {
            let c = try await googleCredential()
            _ = try await u.reauthenticate(with: c)
        }
        try await u.delete()
        GIDSignIn.sharedInstance.signOut()
    }
}

@MainActor
func topViewController() -> UIViewController? {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    let window = scenes.flatMap(\.windows).first { $0.isKeyWindow } ?? scenes.first?.windows.first
    var top = window?.rootViewController
    while let p = top?.presentedViewController { top = p }
    return top
}

/// One Sign in with Apple, as an async call.
@MainActor
final class AppleSignIn: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    struct Result {
        let credential: AuthCredential
        let name: String?
        let authorizationCode: String?
    }

    private var nonce = ""
    private var cont: CheckedContinuation<Result, Error>?

    /// asks Apple once, on the main thread
    static func go() async throws -> Result { try await AppleSignIn().run() }
    private var keep: AppleSignIn?

    func run() async throws -> Result {
        nonce = Self.randomNonce()
        let req = ASAuthorizationAppleIDProvider().createRequest()
        req.requestedScopes = [.fullName, .email]
        req.nonce = Self.sha256(nonce)
        let c = ASAuthorizationController(authorizationRequests: [req])
        c.delegate = self
        c.presentationContextProvider = self
        keep = self
        return try await withCheckedThrowingContinuation { k in
            cont = k
            c.performRequests()
        }
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        return scenes.flatMap(\.windows).first { $0.isKeyWindow } ?? ASPresentationAnchor()
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        defer { keep = nil }
        guard let apple = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = apple.identityToken, let token = String(data: tokenData, encoding: .utf8)
        else {
            cont?.resume(throwing: NSError(domain: "soultied", code: 6))
            cont = nil
            return
        }
        let credential = OAuthProvider.appleCredential(withIDToken: token, rawNonce: nonce, fullName: apple.fullName)
        let name = apple.fullName.flatMap { PersonNameComponentsFormatter().string(from: $0) }.flatMap { $0.isEmpty ? nil : $0 }
        let code = apple.authorizationCode.flatMap { String(data: $0, encoding: .utf8) }
        cont?.resume(returning: Result(credential: credential, name: name, authorizationCode: code))
        cont = nil
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        cont?.resume(throwing: error)
        cont = nil
        keep = nil
    }

    nonisolated static func randomNonce(_ length: Int = 32) -> String {
        let chars = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        var g = SystemRandomNumberGenerator()
        return String((0..<length).map { _ in chars[Int(g.next() % UInt64(chars.count))] })
    }

    nonisolated static func sha256(_ s: String) -> String {
        SHA256.hash(data: Data(s.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}
