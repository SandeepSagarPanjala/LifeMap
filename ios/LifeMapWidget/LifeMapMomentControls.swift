import AppIntents
import SwiftUI
import WidgetKit

private enum MomentControlKind {
  static let diary = "com.sunrio.lifemap.control.diary"
  static let voice = "com.sunrio.lifemap.control.voice"
  static let activity = "com.sunrio.lifemap.control.activity"
  static let photo = "com.sunrio.lifemap.control.photo"
}

@available(iOS 18.0, *)
struct DiaryMomentControl: ControlWidget {
  var body: some ControlWidgetConfiguration {
    StaticControlConfiguration(kind: MomentControlKind.diary) {
      ControlWidgetButton(action: OpenWidgetDiaryIntent()) {
        Label("Diary", systemImage: "note.text")
      }
    }
    .displayName("Diary")
    .description("Capture a diary moment in LifeMap.")
  }
}

@available(iOS 18.0, *)
struct VoiceMomentControl: ControlWidget {
  var body: some ControlWidgetConfiguration {
    StaticControlConfiguration(kind: MomentControlKind.voice) {
      ControlWidgetButton(action: OpenWidgetVoiceIntent()) {
        Label("Voice", systemImage: "waveform")
      }
    }
    .displayName("Voice Memo")
    .description("Record a voice moment in LifeMap.")
  }
}

@available(iOS 18.0, *)
struct ActivityMomentControl: ControlWidget {
  var body: some ControlWidgetConfiguration {
    StaticControlConfiguration(kind: MomentControlKind.activity) {
      ControlWidgetButton(action: OpenWidgetActivityIntent()) {
        Label("Activity", systemImage: "figure.walk")
      }
    }
    .displayName("Activity")
    .description("Log an activity moment in LifeMap.")
  }
}

@available(iOS 18.0, *)
struct PhotoMomentControl: ControlWidget {
  var body: some ControlWidgetConfiguration {
    StaticControlConfiguration(kind: MomentControlKind.photo) {
      ControlWidgetButton(action: OpenWidgetPhotoIntent()) {
        Label("Camera", systemImage: "camera.fill")
      }
    }
    .displayName("Camera")
    .description("Capture a photo moment in LifeMap.")
  }
}
