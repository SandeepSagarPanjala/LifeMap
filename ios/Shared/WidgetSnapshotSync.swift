import Foundation
import WidgetKit

enum WidgetSnapshotSync {
  static func refreshAndReload() {
    let snapshot = WidgetSnapshotBuilder.build()
    publish(snapshot)
  }

  static func reloadTimelines() {
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadAllTimelines()
    }
  }

  static func publish(_ snapshot: WidgetSnapshotPayload) {
    let existing = WidgetSnapshotStore.read()
    if !shouldReplace(existing: existing, with: snapshot) {
      reloadTimelines()
      return
    }
    try? WidgetSnapshotStore.write(snapshot: snapshot)
    reloadTimelines()
  }

  private static func shouldReplace(
    existing: WidgetSnapshotPayload,
    with snapshot: WidgetSnapshotPayload
  ) -> Bool {
    if existing.updatedAt.isEmpty {
      return true
    }
    if snapshot.hasReliableDuration {
      return true
    }
    if existing.hasReliableDuration {
      return false
    }
    return true
  }
}

private extension WidgetSnapshotPayload {
  var hasReliableDuration: Bool {
    guard let durationLabel, !durationLabel.isEmpty else {
      return false
    }
    return durationLabel != "Here for 1 min"
  }
}
