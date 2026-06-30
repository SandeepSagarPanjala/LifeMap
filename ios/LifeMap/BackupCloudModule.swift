import Foundation
import React

@objc(BackupCloudModule)
class BackupCloudModule: NSObject {
  private let containerIdentifier = "iCloud.com.sunrio.lifemap"
  private let backupsRootRelativePath = "Documents/Backups"
  /// Single cloud backup folder (replaces legacy current/previous rotation).
  private let backupName = "backup"
  private let legacyCurrentBackupName = "current"
  private let legacyPreviousBackupName = "previous"
  private let manifestFileName = "manifest.json"

  @objc static func requiresMainQueueSetup() -> Bool {
    false
  }

  private func hasUbiquityIdentity() -> Bool {
    FileManager.default.ubiquityIdentityToken != nil
  }

  private func resolveContainerURL() -> URL? {
    if let url = FileManager.default.url(
      forUbiquityContainerIdentifier: containerIdentifier
    ) {
      return url
    }
    return FileManager.default.url(forUbiquityContainerIdentifier: nil)
  }

  private func resolveContainerURLQuick() -> URL? {
    resolveContainerURLWithRetry(maxAttempts: 2, delaySeconds: 0.5)
  }

  private func resolveContainerURLWithRetry(
    maxAttempts: Int = 10,
    delaySeconds: TimeInterval = 1.5
  ) -> URL? {
    for attempt in 0..<maxAttempts {
      if attempt > 0 {
        Thread.sleep(forTimeInterval: delaySeconds)
      }
      if let url = resolveContainerURL() {
        return url
      }
    }
    return nil
  }

  private func backupsRootURLQuick() -> URL? {
    guard let containerURL = resolveContainerURLQuick() else {
      return nil
    }
    let rootURL = containerURL
      .appendingPathComponent(backupsRootRelativePath, isDirectory: true)
    do {
      try FileManager.default.createDirectory(
        at: rootURL,
        withIntermediateDirectories: true
      )
      return rootURL
    } catch {
      return nil
    }
  }

  private func namedBackupDirectoryURLQuick(name: String) -> URL? {
    guard let rootURL = backupsRootURLQuick() else {
      return nil
    }
    return rootURL.appendingPathComponent(name, isDirectory: true)
  }

  /// Fast metadata probe — no 15s container retry loop (used on app launch).
  private func resolveBackupURLQuick() -> URL? {
    if let singleURL = namedBackupDirectoryURLQuick(name: backupName),
      let manifest = try? readManifest(at: singleURL, downloadTimeout: 3)
    {
      _ = manifest
      return singleURL
    }

    guard
      let currentURL = namedBackupDirectoryURLQuick(name: legacyCurrentBackupName),
      let previousURL = namedBackupDirectoryURLQuick(name: legacyPreviousBackupName)
    else {
      return nil
    }

    let currentManifest = try? readManifest(at: currentURL, downloadTimeout: 3)
    let previousManifest = try? readManifest(at: previousURL, downloadTimeout: 3)
    return pickBestLegacyBackupURL(
      currentURL: currentURL,
      previousURL: previousURL,
      currentManifest: currentManifest,
      previousManifest: previousManifest
    )
  }

  private func backupsRootURL() throws -> URL {
    if let containerURL = resolveContainerURLWithRetry() {
      let rootURL = containerURL
        .appendingPathComponent(backupsRootRelativePath, isDirectory: true)
      try FileManager.default.createDirectory(
        at: rootURL,
        withIntermediateDirectories: true
      )
      return rootURL
    }

    if !hasUbiquityIdentity() {
      throw backupError(
        code: 1,
        message:
          "Sign in to iCloud on this device to use backup. In Settings → Apple Account → iCloud, make sure LifeMap is allowed to use iCloud."
      )
    }

    throw backupError(
      code: 4,
      message:
        "LifeMap could not open its iCloud backup folder. Stay on Wi‑Fi and try again in a minute."
    )
  }

  private func namedBackupDirectoryURL(name: String) throws -> URL {
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

  private func readManifest(at backupURL: URL, downloadTimeout: TimeInterval = 120) throws -> [String: Any]? {
    let manifestURL = backupURL.appendingPathComponent(manifestFileName)
    guard FileManager.default.fileExists(atPath: manifestURL.path) else {
      return nil
    }
    try ensureDownloaded(url: manifestURL, timeout: downloadTimeout)
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

  private func pickBestLegacyBackupURL(
    currentURL: URL,
    previousURL: URL,
    currentManifest: [String: Any]?,
    previousManifest: [String: Any]?
  ) -> URL? {
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

  /// Resolves the active backup folder — prefers single `backup`, falls back to legacy slots.
  private func resolveBackupURL() throws -> URL? {
    let singleURL = try namedBackupDirectoryURL(name: backupName)
    if let manifest = try readManifest(at: singleURL, downloadTimeout: 30) {
      return singleURL
    }

    let currentURL = try namedBackupDirectoryURL(name: legacyCurrentBackupName)
    let previousURL = try namedBackupDirectoryURL(name: legacyPreviousBackupName)
    let currentManifest = try readManifest(at: currentURL, downloadTimeout: 30)
    let previousManifest = try readManifest(at: previousURL, downloadTimeout: 30)
    return pickBestLegacyBackupURL(
      currentURL: currentURL,
      previousURL: previousURL,
      currentManifest: currentManifest,
      previousManifest: previousManifest
    )
  }

  private func removeLegacyBackupDirectories() throws {
    for name in [legacyCurrentBackupName, legacyPreviousBackupName] {
      let url = try namedBackupDirectoryURL(name: name)
      if FileManager.default.fileExists(atPath: url.path) {
        try FileManager.default.removeItem(at: url)
      }
    }
  }

  @objc func isCloudAvailable(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.global(qos: .utility).async {
      resolve(self.resolveContainerURLQuick() != nil)
    }
  }

  @objc func getCloudBackupMetadata(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.global(qos: .utility).async {
      do {
        guard let backupURL = self.resolveBackupURLQuick() else {
          resolve(NSNull())
          return
        }
        guard let json = try self.readManifest(at: backupURL, downloadTimeout: 3) else {
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
        let backupURL = try self.namedBackupDirectoryURL(name: self.backupName)

        if FileManager.default.fileExists(atPath: backupURL.path) {
          try FileManager.default.removeItem(at: backupURL)
        }
        try FileManager.default.copyItem(at: sourceURL, to: backupURL)
        try self.removeLegacyBackupDirectories()
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
        guard let backupURL = try self.resolveBackupURL() else {
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
