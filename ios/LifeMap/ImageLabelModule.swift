import Foundation
import React
import UIKit
import Vision

@objc(ImageLabelModule)
class ImageLabelModule: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc func labelImage(
    _ uri: String,
    maxResults: NSNumber,
    minConfidence: NSNumber,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let limit = max(1, maxResults.intValue)
    let threshold = max(0, min(1, minConfidence.doubleValue))

    DispatchQueue.global(qos: .userInitiated).async {
      guard let image = Self.loadUIImage(from: uri),
            let cgImage = image.cgImage
      else {
        rejecter("E_IMAGE", "Could not load image for labeling", nil)
        return
      }

      let request = VNClassifyImageRequest()
      let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])

      do {
        try handler.perform([request])
      } catch {
        rejecter("E_LABEL", error.localizedDescription, error)
        return
      }

      let observations = ((request.results as? [VNClassificationObservation]) ?? [])
        .sorted { $0.confidence > $1.confidence }
      var payload: [[String: Any]] = []
      for observation in observations {
        if observation.confidence < Float(threshold) {
          continue
        }
        let label = observation.identifier
          .replacingOccurrences(of: "_", with: " ")
          .trimmingCharacters(in: .whitespacesAndNewlines)
        if label.isEmpty {
          continue
        }
        payload.append([
          "label": label,
          "confidence": Double(observation.confidence),
        ])
        if payload.count >= limit {
          break
        }
      }

      resolver(payload)
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
