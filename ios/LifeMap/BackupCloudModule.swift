import Foundation
import React

@objc(BackupCloudModule)
class BackupCloudModule: NSObject {
  private let containerIdentifier = "iCloud.com.sunrio.lifemap"
  private let backupsRootRelativePath = "Documents/Backups"
  private let currentBackupName = "current"
  private let previousBackupName = "previous"
  private let manifestFileName = "manifest.json"

  @objc static func requiresMainQueueSetup() -> Bool {
    false
  }

  private func backupsRootURL() throws -> URL {
    guard
      let containerURL = FileManager.default.url(
        forUbiquityContainerIdentifier: containerIdentifier
      )
    else {
      throw backupError(
        code: 1,
        message: "iCloud is not available. Sign in to iCloud to use backup."
      )
    }

    let rootURL = containerURL
      .appendingPathComponent(backupsRootRelativePath, isDirectory: true)
    try FileManager.default.createDirectory(
      at: rootURL,
      withIntermediateDirectories: true
    )
    return rootURL
  }

  private func backupDirectoryURL(name: String) throws -> URL {
    try backupsRootURL().appendingPathComponent(name, isDirectory: true)
  }

  private func backupError(code: Int, message: String) -> NSError {
    NSError(
      domain: "BackupCloudModule",
      code: code,
      userInfo: [NSLocalizedDescriptionKey: message]
    )
  }

  private func ensureDownloaded(url: URL, timeout: TimeInterval = 120) throws {
    var isDownloaded = false
    if
      let values = try? url.resourceValues(forKeys: [
        .ubiquitousItemDownloadingStatusKey,
      ]),
      let status = values.ubiquitousItemDownloadingStatus
    {
      isDownloaded = status == .current || status == .downloaded
    }

    if !isDownloaded {
      try FileManager.default.startDownloadingUbiquitousItem(at: url)
    }

    let deadline = Date().addingTimeInterval(timeout)
    while Date() < deadline {
      if
        let values = try? url.resourceValues(forKeys: [
          .ubiquitousItemDownloadingStatusKey,
        ]),
        let status = values.ubiquitousItemDownloadingStatus,
        status == .current || status == .downloaded
      {
        return
      }
      Thread.sleep(forTimeInterval: 0.25)
    }

    throw backupError(
      code: 3,
      message: "Timed out waiting for iCloud to download your backup."
    )
  }

  private func downloadDirectoryIfNeeded(url: URL) throws {
    try ensureDownloaded(url: url)
    let contents = try FileManager.default.contentsOfDirectory(
      at: url,
      includingPropertiesForKeys: [.isDirectoryKey],
      options: [.skipsHiddenFiles]
    )
    for item in contents {
      let values = try item.resourceValues(forKeys: [.isDirectoryKey])
      if values.isDirectory == true {
        try downloadDirectoryIfNeeded(url: item)
      } else {
        try ensureDownloaded(url: item)
      }
    }
  }

  private func readManifest(at backupURL: URL) throws -> [String: Any]? {
    let manifestURL = backupURL.appendingPathComponent(manifestFileName)
    guard FileManager.default.fileExists(atPath: manifestURL.path) else {
      return nil
    }
    try ensureDownloaded(url: manifestURL)
    let data = try Data(contentsOf: manifestURL)
    return try JSONSerialization.jsonObject(with: data) as? [String: Any]
  }

  private func metadataDictionary(from json: [String: Any]) -> [String: Any] {
    [
      "exportedAt": json["exportedAt"] ?? "",
      "totalBytes": json["totalBytes"] ?? 0,
      "formatVersion": json["formatVersion"] ?? 1,
    ]
  }

  private func exportedAtMillis(_ json: [String: Any]) -> Double {
    guard let exportedAt = json["exportedAt"] as? String else {
      return 0
    }
    return exportedAt.isEmpty ? 0 : (ISO8601DateFormatter().date(from: exportedAt)?.timeIntervalSince1970 ?? 0) * 1000
  }

  private func totalBytesValue(_ json: [String: Any]) -> Double {
    if let value = json["totalBytes"] as? NSNumber {
      return value.doubleValue
    }
    if let value = json["totalBytes"] as? Double {
      return value
    }
    if let value = json["totalBytes"] as? Int {
      return Double(value)
    }
    return 0
  }

  private func bestBackupURL() throws -> URL? {
    let currentURL = try backupDirectoryURL(name: currentBackupName)
    let previousURL = try backupDirectoryURL(name: previousBackupName)
    let currentManifest = try readManifest(at: currentURL)
    let previousManifest = try readManifest(at: previousURL)

    switch (currentManifest, previousManifest) {
    case (nil, nil):
      return nil
    case (let current?, nil):
      return currentURL
    case (nil, let previous?):
      return previousURL
    case (let current?, let previous?):
      let currentTime = exportedAtMillis(current)
      let previousTime = exportedAtMillis(previous)
      if currentTime != previousTime {
        return currentTime >= previousTime ? currentURL : previousURL
      }
      let currentBytes = totalBytesValue(current)
      let previousBytes = totalBytesValue(previous)
      return currentBytes >= previousBytes ? currentURL : previousURL
    }
  }

  @objc func isCloudAvailable(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    resolve(
      FileManager.default.url(forUbiquityContainerIdentifier: containerIdentifier) != nil
    )
  }

  @objc func getCloudBackupMetadata(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.global(qos: .utility).async {
      do {
        guard let backupURL = try self.bestBackupURL() else {
          resolve(NSNull())
          return
        }
        guard let json = try self.readManifest(at: backupURL) else {
          resolve(NSNull())
          return
        }
        resolve(self.metadataDictionary(from: json))
      } catch {
        reject("backup_metadata_error", error.localizedDescription, error)
      }
    }
  }

  @objc func uploadBackupDirectory(
    _ localPath: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.global(qos: .utility).async {
      do {
        let sourceURL = URL(fileURLWithPath: localPath, isDirectory: true)
        let currentURL = try self.backupDirectoryURL(name: self.currentBackupName)
        let previousURL = try self.backupDirectoryURL(name: self.previousBackupName)

        if FileManager.default.fileExists(atPath: currentURL.path) {
          if FileManager.default.fileExists(atPath: previousURL.path) {
            try FileManager.default.removeItem(at: previousURL)
          }
          try FileManager.default.moveItem(at: currentURL, to: previousURL)
        }

        if FileManager.default.fileExists(atPath: currentURL.path) {
          try FileManager.default.removeItem(at: currentURL)
        }
        try FileManager.default.copyItem(at: sourceURL, to: currentURL)
        resolve(nil)
      } catch {
        reject("backup_upload_error", error.localizedDescription, error)
      }
    }
  }

  @objc func downloadBackupDirectory(
    _ localPath: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.global(qos: .utility).async {
      do {
        guard let backupURL = try self.bestBackupURL() else {
          throw self.backupError(code: 2, message: "No iCloud backup found.")
        }
        try self.downloadDirectoryIfNeeded(url: backupURL)
        let destinationURL = URL(fileURLWithPath: localPath, isDirectory: true)
        if FileManager.default.fileExists(atPath: destinationURL.path) {
          try FileManager.default.removeItem(at: destinationURL)
        }
        try FileManager.default.copyItem(at: backupURL, to: destinationURL)
        resolve(nil)
      } catch {
        reject("backup_download_error", error.localizedDescription, error)
      }
    }
  }
}
