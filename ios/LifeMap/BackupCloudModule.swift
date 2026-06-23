import Foundation
import React

@objc(BackupCloudModule)
class BackupCloudModule: NSObject {
  private let containerIdentifier = "iCloud.com.sunrio.lifemap"
  private let backupRelativePath = "Documents/Backups/current"
  private let manifestFileName = "manifest.json"

  @objc static func requiresMainQueueSetup() -> Bool {
    false
  }

  private func backupDirectoryURL() throws -> URL {
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

    let backupURL = containerURL
      .appendingPathComponent(backupRelativePath, isDirectory: true)
    try FileManager.default.createDirectory(
      at: backupURL.deletingLastPathComponent(),
      withIntermediateDirectories: true
    )
    return backupURL
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
        let backupURL = try self.backupDirectoryURL()
        let manifestURL = backupURL.appendingPathComponent(self.manifestFileName)
        guard FileManager.default.fileExists(atPath: manifestURL.path) else {
          resolve(NSNull())
          return
        }
        try self.ensureDownloaded(url: manifestURL)
        let data = try Data(contentsOf: manifestURL)
        guard
          let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
          resolve(NSNull())
          return
        }
        resolve([
          "exportedAt": json["exportedAt"] ?? "",
          "totalBytes": json["totalBytes"] ?? 0,
          "formatVersion": json["formatVersion"] ?? 1,
        ])
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
        let backupURL = try self.backupDirectoryURL()
        if FileManager.default.fileExists(atPath: backupURL.path) {
          try FileManager.default.removeItem(at: backupURL)
        }
        try FileManager.default.copyItem(at: sourceURL, to: backupURL)
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
        let backupURL = try self.backupDirectoryURL()
        guard FileManager.default.fileExists(atPath: backupURL.path) else {
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
