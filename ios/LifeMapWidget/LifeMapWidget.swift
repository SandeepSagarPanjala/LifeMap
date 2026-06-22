import AppIntents
import SwiftUI
import WidgetKit

@main
struct LifeMapWidgetBundle: WidgetBundle {
  var body: some Widget {
    LifeMapTodayWidget()
  }
}

struct LifeMapTodayWidget: Widget {
  let kind: String = "LifeMapTodayWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: LifeMapWidgetProvider()) { entry in
      LifeMapWidgetView(entry: entry)
    }
    .configurationDisplayName("LifeMap Today")
    .description("See where you are and capture moments.")
    .supportedFamilies([.systemMedium])
    .contentMarginsDisabled()
  }
}

struct LifeMapWidgetEntry: TimelineEntry {
  let date: Date
  let snapshot: WidgetSnapshotPayload
}

struct LifeMapWidgetProvider: TimelineProvider {
  func placeholder(in context: Context) -> LifeMapWidgetEntry {
    LifeMapWidgetEntry(date: Date(), snapshot: .placeholder)
  }

  func getSnapshot(in context: Context, completion: @escaping (LifeMapWidgetEntry) -> Void) {
    completion(LifeMapWidgetEntry(date: Date(), snapshot: WidgetSnapshotStore.read()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<LifeMapWidgetEntry>) -> Void) {
    let entry = LifeMapWidgetEntry(date: Date(), snapshot: WidgetSnapshotStore.read())
    let timeline = Timeline(entries: [entry], policy: .never)
    completion(timeline)
  }
}

private enum WidgetPalette {
  static let background = Color(red: 0.14, green: 0.14, blue: 0.15)
  static let barBackground = Color(red: 0.10, green: 0.10, blue: 0.11)
  static let primaryText = Color.white
  static let secondaryText = Color.white.opacity(0.78)
  static let tertiaryText = Color.white.opacity(0.52)
  static let icon = Color.white.opacity(0.94)
  static let divider = Color.white.opacity(0.14)
}

private enum WidgetLayout {
  static let inset: CGFloat = 16
}

struct LifeMapWidgetView: View {
  let entry: LifeMapWidgetEntry

  var body: some View {
    VStack(spacing: 0) {
      topSection

      Spacer(minLength: 0)

      actionBar
        .frame(height: 48)
        .background(
          RoundedRectangle(cornerRadius: 12, style: .continuous)
            .fill(WidgetPalette.barBackground)
        )
        .overlay(
          RoundedRectangle(cornerRadius: 12, style: .continuous)
            .strokeBorder(WidgetPalette.divider, lineWidth: 0.5)
        )
    }
    .padding(WidgetLayout.inset)
    .widgetBackground(WidgetPalette.background)
  }

  private var topSection: some View {
    HStack(alignment: .top, spacing: 12) {
      VStack(alignment: .leading, spacing: 6) {
        Text(entry.snapshot.placeLabel)
          .font(.system(size: 22, weight: .bold))
          .foregroundStyle(WidgetPalette.primaryText)
          .lineLimit(1)

        if let duration = entry.snapshot.durationLabel, !duration.isEmpty {
          HStack(spacing: 6) {
            Image(systemName: "clock.fill")
              .font(.system(size: 11, weight: .semibold))
              .foregroundStyle(WidgetPalette.secondaryText)
            Text(duration)
              .font(.system(size: 14, weight: .regular))
              .foregroundStyle(WidgetPalette.secondaryText)
              .lineLimit(1)
          }
        }

        Text(entry.snapshot.dateLabel)
          .font(.system(size: 13, weight: .regular))
          .foregroundStyle(WidgetPalette.tertiaryText)
          .lineLimit(1)
      }

      Spacer(minLength: 0)

      refreshControl
    }
  }

  @ViewBuilder
  private var refreshControl: some View {
    if #available(iOS 17.0, *) {
      Button(intent: RefreshWidgetIntent()) {
        Image(systemName: "arrow.clockwise")
          .font(.system(size: 15, weight: .semibold))
          .foregroundStyle(WidgetPalette.secondaryText)
          .frame(width: 36, height: 36)
          .background(
            Circle()
              .fill(Color.white.opacity(0.08))
          )
      }
      .buttonStyle(.plain)
    }
  }

  private var actionBar: some View {
    HStack(spacing: 0) {
      captureActionSegment(symbol: "note.text", action: .note, url: "lifemap://capture/note")
      barDivider
      captureActionSegment(symbol: "waveform", action: .voice, url: "lifemap://capture/voice")
      barDivider
      captureActionSegment(symbol: "figure.walk", action: .activity, url: "lifemap://capture/activity")
      barDivider
      captureActionSegment(symbol: "camera.fill", action: .photo, url: "lifemap://capture/photo")
    }
    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
  }

  private var barDivider: some View {
    Rectangle()
      .fill(WidgetPalette.divider)
      .frame(width: 0.5)
      .padding(.vertical, 12)
  }

  private func captureActionSegment(
    symbol: String,
    action: WidgetPendingAction,
    url: String
  ) -> some View {
    Group {
      if #available(iOS 17.0, *) {
        switch action {
        case .note:
          Button(intent: OpenWidgetDiaryIntent()) {
            actionIcon(symbol)
          }
        case .photo:
          Button(intent: OpenWidgetPhotoIntent()) {
            actionIcon(symbol)
          }
        case .voice:
          Button(intent: OpenWidgetVoiceIntent()) {
            actionIcon(symbol)
          }
        case .activity:
          Button(intent: OpenWidgetActivityIntent()) {
            actionIcon(symbol)
          }
        case .refresh:
          EmptyView()
        }
      } else {
        Link(destination: URL(string: url)!) {
          actionIcon(symbol)
        }
      }
    }
    .buttonStyle(.plain)
  }

  private func actionIcon(_ symbol: String) -> some View {
    Image(systemName: symbol)
      .font(.system(size: 18, weight: .regular))
      .foregroundStyle(WidgetPalette.icon)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

private extension View {
  @ViewBuilder
  func widgetBackground(_ color: Color) -> some View {
    if #available(iOS 17.0, *) {
      containerBackground(for: .widget) {
        color
      }
    } else {
      background(color)
    }
  }
}
