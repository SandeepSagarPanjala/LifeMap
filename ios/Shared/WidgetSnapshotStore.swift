import Foundation

enum WidgetShared {
  static let appGroupId = "group.com.sunrio.lifemap"
  static let snapshotFileName = "widget-snapshot.json"
}

struct WidgetSnapshotPayload: Codable {
  var updatedAt: String
  var placeLabel: String
  var placeKind: String
  var durationLabel: String?
  var dateLabel: String
  var isOngoing: Bool

  static let placeholder = WidgetSnapshotPayload(
    updatedAt: "",
    placeLabel: "LifeMap",
    placeKind: "none",
    durationLabel: nil,
    dateLabel: "Open app to load location",
    isOngoing: false
  )
}

enum WidgetSnapshotStore {
  static func containerURL() -> URL? {
    FileManager.default.containerURL(
      forSecurityApplicationGroupIdentifier: WidgetShared.appGroupId
    )
  }

  static func snapshotURL() -> URL? {
    containerURL()?.appendingPathComponent(WidgetShared.snapshotFileName)
  }

  static func read() -> WidgetSnapshotPayload {
    guard
      let url = snapshotURL(),
      let data = try? Data(contentsOf: url),
      let payload = try? JSONDecoder().decode(WidgetSnapshotPayload.self, from: data)
    else {
      return .placeholder
    }
    return payload
  }

  static func write(snapshot: WidgetSnapshotPayload) throws {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    let data = try encoder.encode(snapshot)
    guard let json = String(data: data, encoding: .utf8) else {
      throw NSError(
        domain: "WidgetSnapshotStore",
        code: 2,
        userInfo: [NSLocalizedDescriptionKey: "Could not encode widget snapshot"]
      )
    }
    try write(json: json)
  }

  static func write(json: String) throws {
    guard let url = snapshotURL() else {
      throw NSError(
        domain: "WidgetSnapshotStore",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "App Group container unavailable"]
      )
    }
    try json.write(to: url, atomically: true, encoding: .utf8)
  }
}
