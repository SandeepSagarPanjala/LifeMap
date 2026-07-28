import Foundation
import React
import UIKit
import Vision

@objc(TextRecognizeModule)
class TextRecognizeModule: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc func recognizeText(
    _ uri: String,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.global(qos: .userInitiated).async {
      guard let image = Self.loadUIImage(from: uri),
            let cgImage = image.cgImage
      else {
        rejecter("E_IMAGE", "Could not load image for text recognition", nil)
        return
      }

      let request = VNRecognizeTextRequest()
      request.recognitionLevel = .accurate
      request.usesLanguageCorrection = true
      let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])

      do {
        try handler.perform([request])
      } catch {
        rejecter("E_OCR", error.localizedDescription, error)
        return
      }

      let observations = ((request.results as? [VNRecognizedTextObservation]) ?? [])
        // Vision does not guarantee reading order — sort top→bottom, then left→right
        // so "Total" sits below "Subtotal" like on the receipt.
        .sorted { a, b in
          let ay = a.boundingBox.midY
          let by = b.boundingBox.midY
          if abs(ay - by) > 0.008 {
            return ay > by
          }
          return a.boundingBox.minX < b.boundingBox.minX
        }

      var lines: [String] = []
      for observation in observations {
        if let top = observation.topCandidates(1).first {
          let text = top.string.trimmingCharacters(in: .whitespacesAndNewlines)
          if !text.isEmpty {
            lines.append(text)
          }
        }
      }
      resolver(lines.joined(separator: "\n"))
    }
  }

  private static func loadUIImage(from uri: String) -> UIImage? {
    if uri.hasPrefix("file://"), let url = URL(string: uri) {
      return UIImage(contentsOfFile: url.path)
    }
    if FileManager.default.fileExists(atPath: uri) {
      return UIImage(contentsOfFile: uri)
    }
    if let url = URL(string: uri), url.isFileURL {
      return UIImage(contentsOfFile: url.path)
    }
    return nil
  }
}
