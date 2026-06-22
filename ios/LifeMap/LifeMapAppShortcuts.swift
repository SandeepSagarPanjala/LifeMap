import AppIntents

@available(iOS 17.0, *)
struct LifeMapAppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
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
