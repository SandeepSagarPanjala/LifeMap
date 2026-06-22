import Foundation

enum WidgetPendingAction: String, Codable {
  case note
  case photo
  case voice
  case activity
  case refresh
}

enum WidgetPendingActionStore {
  private static let fileName = "widget-pending-action.txt"

  static func write(action: WidgetPendingAction) throws {
    guard let url = fileURL() else {
      throw NSError(
        domain: "WidgetPendingActionStore",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "App Group container unavailable"]
      )
    }
    try action.rawValue.write(to: url, atomically: true, encoding: .utf8)
  }

  static func consume() -> WidgetPendingAction? {
    guard let url = fileURL(),
          let raw = try? String(contentsOf: url, encoding: .utf8),
          let action = WidgetPendingAction(rawValue: raw.trimmingCharacters(in: .whitespacesAndNewlines))
    else {
      return nil
    }

    try? FileManager.default.removeItem(at: url)
    return action
  }

  static func action(from url: URL) -> WidgetPendingAction? {
    guard url.scheme?.lowercased() == "lifemap" else {
      return nil
    }

    if url.host == "capture" {
      switch url.path {
      case "/note":
        return .note
      case "/photo":
        return .photo
      default:
        return nil
      }
    }

    if url.host == "map" {
      guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
            let value = components.queryItems?.first(where: { $0.name == "widgetAction" })?.value,
            let action = WidgetPendingAction(rawValue: value)
      else {
        return nil
      }
      return action
    }

    return nil
  }

  private static func fileURL() -> URL? {
    WidgetSnapshotStore.containerURL()?.appendingPathComponent(fileName)
  }
}
