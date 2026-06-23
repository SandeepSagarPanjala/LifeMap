import AppIntents

@available(iOS 17.0, *)
struct LifeMapAppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: OpenWidgetDiaryIntent(),
      phrases: [
        "Capture diary in \(.applicationName)",
        "Diary moment in \(.applicationName)",
      ],
      shortTitle: "Diary",
      systemImageName: "note.text"
    )
    AppShortcut(
      intent: OpenWidgetVoiceIntent(),
      phrases: [
        "Capture voice in \(.applicationName)",
        "Voice memo in \(.applicationName)",
      ],
      shortTitle: "Voice Memo",
      systemImageName: "waveform"
    )
    AppShortcut(
      intent: OpenWidgetActivityIntent(),
      phrases: [
        "Log activity in \(.applicationName)",
        "Activity moment in \(.applicationName)",
      ],
      shortTitle: "Activity",
      systemImageName: "figure.walk"
    )
    AppShortcut(
      intent: OpenWidgetPhotoIntent(),
      phrases: [
        "Capture photo in \(.applicationName)",
        "Camera moment in \(.applicationName)",
      ],
      shortTitle: "Camera",
      systemImageName: "camera.fill"
    )
    AppShortcut(
      intent: RefreshWidgetIntent(),
      phrases: [
        "Refresh \(.applicationName)",
      ],
      shortTitle: "Refresh Widget",
      systemImageName: "arrow.clockwise"
    )
  }
}
