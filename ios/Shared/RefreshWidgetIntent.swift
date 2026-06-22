import AppIntents
import WidgetKit

@available(iOS 17.0, *)
struct RefreshWidgetIntent: AppIntent {
  static var title: LocalizedStringResource = "Refresh LifeMap"
  static var description = IntentDescription("Update the LifeMap widget with your latest location.")
  static var openAppWhenRun = false

  func perform() async throws -> some IntentResult {
    WidgetRefreshRequestStore.markRequested()
    WidgetCenter.shared.reloadAllTimelines()
    return .result()
  }
}
