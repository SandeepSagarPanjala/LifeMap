import Foundation

/// Drains Transistor's native location queue and writes to SQLite without React Native.
/// This is the belt that must keep working when JS is suspended mid-drive.
@objc final class LifeMapNativePersistLoop: NSObject {
  @objc static let shared = LifeMapNativePersistLoop()

  private let queue = DispatchQueue(label: "com.sunrio.lifemap.native-persist-loop", qos: .utility)
  private var timer: DispatchSourceTimer?
  private var isRunning = false

  private let tickIntervalSec: TimeInterval = 15
  /// If no row lands for this long, native code must wake GPS without waiting for JS.
  private let staleRecoveryMs: Int64 = 90_000

  private override init() {
    super.init()
  }

  @objc func start() {
    queue.async {
      guard !self.isRunning else {
        return
      }
      self.isRunning = true
      self.scheduleTimer()
      self.tick(reason: "loop_start")
    }
  }

  @objc func stop() {
    queue.async {
      self.isRunning = false
      self.timer?.cancel()
      self.timer = nil
    }
  }

  @objc func tickNow() {
    queue.async {
      self.tick(reason: "manual")
    }
  }

  private func scheduleTimer() {
    timer?.cancel()
    let source = DispatchSource.makeTimerSource(queue: queue)
    source.schedule(deadline: .now() + tickIntervalSec, repeating: tickIntervalSec)
    source.setEventHandler { [weak self] in
      self?.tick(reason: "timer")
    }
    source.resume()
    timer = source
  }

  private func tick(reason: String) {
    guard isRunning else {
      return
    }

    let imported = TransistorBridge.drainPersistedLocations()
    let lastTimestampMs = LifeMapDatabase.shared.lastPersistedTimestampMs()
    let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
    let sinceLastSaveMs =
      lastTimestampMs == nil ? Int64.max : nowMs - (lastTimestampMs ?? nowMs)

    if imported == 0 && sinceLastSaveMs >= staleRecoveryMs {
      LocationWakeCoordinator.shared.requestStaleRecovery(reason: reason)
      let afterRecovery = TransistorBridge.drainPersistedLocations()
      if afterRecovery > 0 {
        NSLog(
          "[LifeMap] native persist loop recovered %d after stale wake (%@, staleMs=%lld)",
          afterRecovery,
          reason,
          sinceLastSaveMs
        )
      } else {
        NSLog(
          "[LifeMap] native persist loop stale wake (%@, staleMs=%lld)",
          reason,
          sinceLastSaveMs
        )
      }
    } else if imported > 0 {
      NSLog("[LifeMap] native persist loop imported %d (%@)", imported, reason)
    }
  }
}
