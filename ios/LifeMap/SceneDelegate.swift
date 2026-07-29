import UIKit
import React
import React_RCTAppDelegate

/**
 * iOS 27 (Xcode 27 SDK) requires UIScene lifecycle adoption.
 * Window + React Native startup live here; AppDelegate keeps process-level work.
 */
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          session.role == .windowApplication,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate
    else {
      return
    }

    if let existingWindow = appDelegate.window {
      // UIKit disconnects the scene of a backgrounded app to reclaim resources
      // (common here because location tracking keeps the process alive), then
      // reconnects it on reopen. React Native is per-process, so restarting it
      // would attach a second BootSplash that no JS code ever hides — the app
      // would sit on the splash until it is force quit. Reuse the live window.
      window = existingWindow
      existingWindow.windowScene = windowScene
      existingWindow.makeKeyAndVisible()
    } else {
      let newWindow = UIWindow(windowScene: windowScene)
      window = newWindow
      appDelegate.window = newWindow

      appDelegate.reactNativeFactory?.startReactNative(
        withModuleName: "LifeMap",
        in: newWindow,
        launchOptions: Self.launchOptions(from: connectionOptions)
      )
    }

    // Cold-start deep links / universal links delivered via scene connection options.
    if !connectionOptions.urlContexts.isEmpty {
      self.scene(scene, openURLContexts: connectionOptions.urlContexts)
    }
    if !connectionOptions.userActivities.isEmpty {
      for activity in connectionOptions.userActivities {
        self.scene(scene, continue: activity)
      }
    }
  }

  // UIKit stops calling the UIApplicationDelegate foreground/background hooks
  // once the app adopts scenes, so the app-active work lives here now.
  func sceneDidBecomeActive(_ scene: UIScene) {
    appDelegate?.handleDidBecomeActive()
  }

  func sceneDidEnterBackground(_ scene: UIScene) {
    appDelegate?.handleDidEnterBackground()
  }

  func scene(
    _ scene: UIScene,
    openURLContexts URLContexts: Set<UIOpenURLContext>
  ) {
    for context in URLContexts {
      let url = context.url
      if let action = WidgetPendingActionStore.action(from: url) {
        try? WidgetPendingActionStore.write(action: action)
      }
      _ = RCTLinkingManager.application(
        UIApplication.shared,
        open: url,
        options: [:]
      )
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = RCTLinkingManager.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in }
    )
  }

  private var appDelegate: AppDelegate? {
    UIApplication.shared.delegate as? AppDelegate
  }

  private static func launchOptions(
    from connectionOptions: UIScene.ConnectionOptions
  ) -> [UIApplication.LaunchOptionsKey: Any]? {
    var options: [UIApplication.LaunchOptionsKey: Any] = [:]

    if let url = connectionOptions.urlContexts.first?.url {
      options[.url] = url
    }
    if let activity = connectionOptions.userActivities.first {
      options[.userActivityDictionary] = [
        UIApplication.LaunchOptionsKey.userActivityType: activity.activityType,
        "UIApplicationLaunchOptionsUserActivityKey": activity,
      ]
    }

    return options.isEmpty ? nil : options
  }
}
