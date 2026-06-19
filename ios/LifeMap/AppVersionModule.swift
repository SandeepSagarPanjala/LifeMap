import Foundation
import React

@objc(AppVersionModule)
class AppVersionModule: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc func getVersion(
    _ resolver: RCTPromiseResolveBlock,
    rejecter: RCTPromiseRejectBlock,
  ) {
    let version =
      Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
      ?? "0"
    resolver(version)
  }

  @objc func getBuildNumber(
    _ resolver: RCTPromiseResolveBlock,
    rejecter: RCTPromiseRejectBlock,
  ) {
    let build =
      Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String
      ?? "0"
    resolver(build)
  }
}
