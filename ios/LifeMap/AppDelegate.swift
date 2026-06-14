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
  }

  func applicationDidEnterBackground(_ application: UIApplication) {
    scheduleBackgroundWakeTask()
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
