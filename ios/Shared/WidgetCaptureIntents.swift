import AppIntents

@available(iOS 17.0, *)
struct OpenWidgetDiaryIntent: AppIntent {
  static var title: LocalizedStringResource = "Open Diary"
  static var description = IntentDescription("Open LifeMap diary capture.")
  static var openAppWhenRun = true

  func perform() async throws -> some IntentResult {
    try WidgetPendingActionStore.write(action: .note)
    return .result()
  }
}

@available(iOS 17.0, *)
struct OpenWidgetPhotoIntent: AppIntent {
  static var title: LocalizedStringResource = "Open Camera"
  static var description = IntentDescription("Open LifeMap photo capture.")
  static var openAppWhenRun = true

  func perform() async throws -> some IntentResult {
    try WidgetPendingActionStore.write(action: .photo)
    return .result()
  }
}

@available(iOS 17.0, *)
struct OpenWidgetVoiceIntent: AppIntent {
  static var title: LocalizedStringResource = "Open Voice Memo"
  static var description = IntentDescription("Open LifeMap voice capture.")
  static var openAppWhenRun = true

  func perform() async throws -> some IntentResult {
    try WidgetPendingActionStore.write(action: .voice)
    return .result()
  }
}

@available(iOS 17.0, *)
struct OpenWidgetActivityIntent: AppIntent {
  static var title: LocalizedStringResource = "Open Activity Log"
  static var description = IntentDescription("Open LifeMap activity capture.")
  static var openAppWhenRun = true

  func perform() async throws -> some IntentResult {
    try WidgetPendingActionStore.write(action: .activity)
    return .result()
  }
}
