import Foundation
import React
import WidgetKit

@objc(WidgetSnapshotModule)
class WidgetSnapshotModule: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc func writeSnapshot(
    _ json: String,
    resolver: RCTPromiseResolveBlock,
    rejecter: RCTPromiseRejectBlock
  ) {
    do {
      try WidgetSnapshotStore.write(json: json)
      resolver(nil)
    } catch {
      rejecter("widget_snapshot_write_failed", error.localizedDescription, error)
    }
  }

  @objc func reloadTimelines(
    _ resolver: RCTPromiseResolveBlock,
    rejecter: RCTPromiseRejectBlock
  ) {
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadAllTimelines()
    }
    resolver(nil)
  }

  @objc func consumePendingAction(
    _ resolver: RCTPromiseResolveBlock,
    rejecter: RCTPromiseRejectBlock
  ) {
    if let action = WidgetPendingActionStore.consume() {
      resolver(action.rawValue)
      return
    }
    resolver(NSNull())
  }
}
