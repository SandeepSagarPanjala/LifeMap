import Foundation

enum WidgetRefreshRequestStore {
  private static let fileName = "widget-refresh-requested.txt"

  static func markRequested() {
    guard let url = fileURL() else {
      return
    }
    let stamp = String(Int64(Date().timeIntervalSince1970 * 1000))
    try? stamp.write(to: url, atomically: true, encoding: .utf8)
  }

  static func consumeIfRequested() -> Bool {
    guard let url = fileURL(), FileManager.default.fileExists(atPath: url.path) else {
      return false
    }
    try? FileManager.default.removeItem(at: url)
    return true
  }

  private static func fileURL() -> URL? {
    WidgetSnapshotStore.containerURL()?.appendingPathComponent(fileName)
  }
}
