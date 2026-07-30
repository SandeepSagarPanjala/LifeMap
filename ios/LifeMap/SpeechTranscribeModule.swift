import Foundation
import React
import Speech

@objc(SpeechTranscribeModule)
class SpeechTranscribeModule: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc func transcribeFile(
    _ uri: String,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    SFSpeechRecognizer.requestAuthorization { status in
      guard status == .authorized else {
        rejecter("E_AUTH", "Speech recognition not authorized", nil)
        return
      }

      guard let recognizer = SFSpeechRecognizer(), recognizer.isAvailable else {
        rejecter("E_UNAVAILABLE", "Speech recognizer unavailable", nil)
        return
      }

      guard let url = Self.fileURL(from: uri) else {
        rejecter("E_FILE", "Could not resolve audio file", nil)
        return
      }

      let request = SFSpeechURLRecognitionRequest(url: url)
      request.shouldReportPartialResults = false

      recognizer.recognitionTask(with: request) { result, error in
        if let error {
          rejecter("E_STT", error.localizedDescription, error)
          return
        }
        guard let result, result.isFinal else {
          return
        }
        let transcript = result.bestTranscription.formattedString
          .trimmingCharacters(in: .whitespacesAndNewlines)
        resolver(transcript)
      }
    }
  }

  private static func fileURL(from uri: String) -> URL? {
    if uri.hasPrefix("file://"), let url = URL(string: uri) {
      return url
    }
    if FileManager.default.fileExists(atPath: uri) {
      return URL(fileURLWithPath: uri)
    }
    if let url = URL(string: uri), url.isFileURL {
      return url
    }
    return nil
  }
}
