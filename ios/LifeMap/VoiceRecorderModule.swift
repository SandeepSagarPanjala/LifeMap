import AVFoundation
import Foundation
import React

@objc(VoiceRecorderModule)
class VoiceRecorderModule: RCTEventEmitter {
  private var audioRecorder: AVAudioRecorder?
  private var recordPath: String?
  private var progressTimer: Timer?

  override static func requiresMainQueueSetup() -> Bool {
    true
  }

  override func supportedEvents() -> [String]! {
    ["VoiceRecorderProgress"]
  }

  @objc override func addListener(_ eventName: String!) {}

  @objc override func removeListeners(_ count: Double) {}

  @objc func getRecordingProgress(
    _ resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock,
  ) {
    DispatchQueue.main.async {
      guard let recorder = self.audioRecorder, recorder.isRecording else {
        resolver([
          "currentPosition": 0,
          "currentMetering": -160,
          "isRecording": false,
        ])
        return
      }
      recorder.updateMeters()
      resolver([
        "currentPosition": Int(recorder.currentTime * 1000),
        "currentMetering": recorder.averagePower(forChannel: 0),
        "isRecording": true,
      ])
    }
  }

  @objc func requestPermission(
    _ resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock,
  ) {
    AVAudioSession.sharedInstance().requestRecordPermission { granted in
      DispatchQueue.main.async {
        resolver(granted)
      }
    }
  }

  @objc func startRecording(
    _ filePath: String,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock,
  ) {
    DispatchQueue.main.async {
      do {
        try self.startRecordingOnMain(filePath: filePath)
        resolver(filePath)
      } catch {
        rejecter("VOICE_RECORDER_START", error.localizedDescription, error)
      }
    }
  }

  @objc func stopRecording(
    _ resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock,
  ) {
    DispatchQueue.main.async {
      guard let recorder = self.audioRecorder else {
        rejecter("VOICE_RECORDER_STOP", "No active recording.", nil)
        return
      }

      let durationMs = Int(recorder.currentTime * 1000)
      let path = self.recordPath ?? recorder.url.path
      recorder.stop()
      self.clearRecorderState()

      resolver([
        "filePath": path,
        "durationMs": durationMs,
      ])
    }
  }

  @objc func cancelRecording(
    _ resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock,
  ) {
    DispatchQueue.main.async {
      let path = self.recordPath
      self.audioRecorder?.stop()
      self.clearRecorderState()
      if let path {
        try? FileManager.default.removeItem(atPath: path)
      }
      resolver(true)
    }
  }

  @objc func releaseSession(
    _ resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock,
  ) {
    DispatchQueue.main.async {
      self.audioRecorder?.stop()
      self.clearRecorderState()
      let session = AVAudioSession.sharedInstance()
      try? session.setActive(false, options: [.notifyOthersOnDeactivation])
      resolver(true)
    }
  }

  private func startRecordingOnMain(filePath: String) throws {
    audioRecorder?.stop()
    clearRecorderState()

    let permission = AVAudioSession.sharedInstance().recordPermission
    switch permission {
    case .denied:
      throw recorderError("Microphone permission denied.")
    case .undetermined:
      throw recorderError("Microphone permission has not been granted yet.")
    default:
      break
    }

    try configureSessionForRecording()

    let url = URL(fileURLWithPath: filePath)
    let directory = url.deletingLastPathComponent()
    if !FileManager.default.fileExists(atPath: directory.path) {
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    let settings: [String: Any] = [
      AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
      AVSampleRateKey: 44100,
      AVNumberOfChannelsKey: 1,
      AVEncoderAudioQualityKey: AVAudioQuality.medium.rawValue,
      AVEncoderBitRateKey: 128000,
    ]

    let recorder = try AVAudioRecorder(url: url, settings: settings)
    recorder.isMeteringEnabled = true

    guard recorder.prepareToRecord() else {
      throw recorderError("Failed to prepare recorder.")
    }
    guard recorder.record() else {
      throw recorderError("Failed to start recording.")
    }

    audioRecorder = recorder
    recordPath = filePath
    startProgressTimer()
  }

  private func configureSessionForRecording() throws {
    let session = AVAudioSession.sharedInstance()
    try session.setCategory(
      .playAndRecord,
      mode: .default,
      options: [.defaultToSpeaker, .allowBluetoothHFP],
    )
    try session.setActive(true)
    if let builtInMic = session.availableInputs?.first(where: { $0.portType == .builtInMic }) {
      try session.setPreferredInput(builtInMic)
    }
  }

  private func startProgressTimer() {
    stopProgressTimer()
    emitProgress()
    let timer = Timer(timeInterval: 0.1, repeats: true) { [weak self] _ in
      self?.emitProgress()
    }
    progressTimer = timer
    RunLoop.main.add(timer, forMode: .common)
  }

  private func emitProgress() {
    guard let recorder = audioRecorder, recorder.isRecording else {
      return
    }
    recorder.updateMeters()
    sendEvent(
      withName: "VoiceRecorderProgress",
      body: [
        "currentPosition": Int(recorder.currentTime * 1000),
        "currentMetering": recorder.averagePower(forChannel: 0),
      ],
    )
  }

  private func stopProgressTimer() {
    progressTimer?.invalidate()
    progressTimer = nil
  }

  private func clearRecorderState() {
    stopProgressTimer()
    audioRecorder = nil
    recordPath = nil
  }

  private func recorderError(_ message: String) -> NSError {
    NSError(domain: "VoiceRecorder", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
  }
}
