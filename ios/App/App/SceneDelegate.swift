import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = SoultiedViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

/// The whole app is soultied.app in a web view. It sits inside the screen's safe area (clear of the
/// notch, the Dynamic Island and the home bar), and the strips around it are the room's dark brown,
/// so the website doesn't need to know about any of that.
class SoultiedViewController: UIViewController {
    private let bridgeController = CAPBridgeViewController()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0x1d / 255, green: 0x15 / 255, blue: 0x12 / 255, alpha: 1)

        addChild(bridgeController)
        let web = bridgeController.view!
        web.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(web)
        let safe = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            web.topAnchor.constraint(equalTo: safe.topAnchor),
            web.bottomAnchor.constraint(equalTo: safe.bottomAnchor),
            web.leadingAnchor.constraint(equalTo: safe.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: safe.trailingAnchor),
        ])
        bridgeController.didMove(toParent: self)
    }

    // light status bar text on the dark strip at the top
    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
    override var childForStatusBarStyle: UIViewController? { nil }
}
