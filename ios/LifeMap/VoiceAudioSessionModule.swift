import AVFoundation
import Foundation
import React

@objc(VoiceAudioSessionModule)
class VoiceAudioSessionModule: NSObject {
  private static var routeObserverRegistered = false

  @objc static func requiresMainQueueSetup() -> Bool {
    true
  }

  @objc func prepareForRecording(
    _ resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock,
  ) {
    Self.registerRouteObserverIfNeeded()
    Self.prepareForRecordingInternal(attempt: 0, resolver: resolver, rejecter: rejecter)
  }

  private static func registerRouteObserverIfNeeded() {
    guard !routeObserverRegistered else {
      return
    }
    routeObserverRegistered = true
    NotificationCenter.default.addObserver(
      forName: AVAudioSession.routeChangeNotification,
      object: AVAudioSession.sharedInstance(),
      queue: .main,
    ) { notification in
      guard
        let reasonValue = notification.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
        let reason = AVAudioSession.RouteChangeReason(rawValue: reasonValue)
      else {
        return
      }
      switch reason {
      case .oldDeviceUnavailable, .newDeviceAvailable, .categoryChange:
        Self.prepareForRecordingInternal(
          attempt: 0,
          resolver: { _ in },
          rejecter: { _, _, _ in },
        )
      default:
        break
      }
    }
  }

  private static func prepareForRecordingInternal(
    attempt: Int,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock,
  ) {
    let maxAttempts = 3
    let session = AVAudioSession.sharedInstance()
    let delay = 0.25 + Double(attempt) * 0.2

    if session.category != .playAndRecord {
      try? session.setActive(false, options: [.notifyOthersOnDeactivation])
    }

    DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
      do {
        try session.setCategory(
          .playAndRecord,
          mode: .default,
          options: [.defaultToSpeaker, .allowBluetoothHFP],
        )
        try session.setActive(true, options: [])

        if let builtInMic = session.availableInputs?.first(where: { $0.portType == .builtInMic }) {
          try session.setPreferredInput(builtInMic)
        }

        resolver(true)
      } catch {
        if attempt < maxAttempts - 1 {
          prepareForRecordingInternal(
            attempt: attempt + 1,
            resolver: resolver,
            rejecter: rejecter,
          )
          return
        }
        rejecter("VOICE_AUDIO_SESSION", error.localizedDescription, error)
      }
    }
  }
}
