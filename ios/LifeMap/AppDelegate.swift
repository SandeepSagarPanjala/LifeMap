import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import BackgroundTasks

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    registerBackgroundWakeTask()

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "LifeMap",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }

  func applicationDidBecomeActive(_ application: UIApplication) {
    scheduleBackgroundWakeTask()
    if WidgetRefreshRequestStore.consumeIfRequested() {
      WidgetSnapshotSync.refreshAndReload()
    }
    LifeMapNativePersistLoop.shared.tickNow()
  }

  func applicationDidEnterBackground(_ application: UIApplication) {
    scheduleBackgroundWakeTask()
  }

  func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    if let action = WidgetPendingActionStore.action(from: url) {
      try? WidgetPendingActionStore.write(action: action)
    }
    return RCTLinkingManager.application(app, open: url, options: options)
  }

  func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    RCTLinkingManager.application(
      application,
      continue: userActivity,
      restorationHandler: restorationHandler
    )
  }

  private func registerBackgroundWakeTask() {
    BGTaskScheduler.shared.register(
      forTaskWithIdentifier: "com.sunrio.lifemap.location-wake",
      using: nil
    ) { task in
      guard let refreshTask = task as? BGAppRefreshTask else {
        task.setTaskCompleted(success: false)
        return
      }
      self.handleBackgroundWake(task: refreshTask)
    }
  }

  private func scheduleBackgroundWakeTask() {
    let request = BGAppRefreshTaskRequest(identifier: "com.sunrio.lifemap.location-wake")
    request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
    try? BGTaskScheduler.shared.submit(request)
  }

  private func handleBackgroundWake(task: BGAppRefreshTask) {
    scheduleBackgroundWakeTask()
    task.expirationHandler = {
      task.setTaskCompleted(success: false)
    }

    LocationWakeCoordinator.shared.startIfAuthorized()
    LifeMapNativePersistLoop.shared.tickNow()
    task.setTaskCompleted(success: true)
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
