import Foundation
import SQLite3

struct LifeMapLocationInsert {
  let timestampMs: Int64
  let lat: Double
  let lng: Double
  let accuracy: Double?
  let altitude: Double?
  let speed: Double?
  let source: String
  let heading: Double?
  let headingAccuracy: Double?
  let speedAccuracy: Double?
  let altitudeAccuracy: Double?
  let activityType: String?
  let activityConfidence: Int?
  let isMoving: Bool?
  let isMock: Bool?
  let uuid: String?
  let batteryLevel: Double?
  let batteryIsCharging: Bool?
}

struct LifeMapPersistStats {
  let insertedCount: Int
  let skippedDuplicateCount: Int
  let lastSource: String?
}

final class LifeMapDatabase {
  static let shared = LifeMapDatabase()

  private let queue = DispatchQueue(label: "com.sunrio.lifemap.database", qos: .utility)
  private var db: OpaquePointer?

  private init() {}

  func databasePath() -> String {
    let library = NSSearchPathForDirectoriesInDomains(.libraryDirectory, .userDomainMask, true)[0]
    return (library as NSString).appendingPathComponent("lifemap.db")
  }

  func openIfNeeded() -> Bool {
    if db != nil {
      return true
    }

    var handle: OpaquePointer?
    let flags = SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX
    let status = sqlite3_open_v2(databasePath(), &handle, flags, nil)
    guard status == SQLITE_OK, let handle else {
      return false
    }

    db = handle
    sqlite3_busy_timeout(handle, 5_000)
    _ = sqlite3_exec(handle, "PRAGMA journal_mode=WAL;", nil, nil, nil)
    return true
  }

  func close() {
    queue.sync {
      if let db {
        sqlite3_close(db)
      }
      self.db = nil
    }
  }

  func insertLocation(
    _ point: LifeMapLocationInsert,
    dedupe: Bool = true
  ) -> Bool {
    queue.sync {
      guard openIfNeeded(), let db else {
        return false
      }

      if dedupe && hasDuplicate(db: db, point: point) {
        return false
      }

      let sql =
        """
        INSERT INTO location_points (
          timestamp, lat, lng, accuracy, altitude, speed, source,
          heading, heading_accuracy, speed_accuracy, altitude_accuracy,
          activity_type, activity_confidence, is_moving, is_mock, uuid,
          battery_level, battery_is_charging
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """
      var statement: OpaquePointer?
      guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK,
            let statement else {
        return false
      }
      defer { sqlite3_finalize(statement) }

      sqlite3_bind_int64(statement, 1, point.timestampMs)
      sqlite3_bind_double(statement, 2, point.lat)
      sqlite3_bind_double(statement, 3, point.lng)
      bindOptionalDouble(statement, index: 4, value: point.accuracy)
      bindOptionalDouble(statement, index: 5, value: point.altitude)
      bindOptionalDouble(statement, index: 6, value: point.speed)
      sqlite3_bind_text(statement, 7, point.source, -1, SQLITE_TRANSIENT)
      bindOptionalDouble(statement, index: 8, value: point.heading)
      bindOptionalDouble(statement, index: 9, value: point.headingAccuracy)
      bindOptionalDouble(statement, index: 10, value: point.speedAccuracy)
      bindOptionalDouble(statement, index: 11, value: point.altitudeAccuracy)
      bindOptionalText(statement, index: 12, value: point.activityType)
      bindOptionalInt(statement, index: 13, value: point.activityConfidence)
      bindOptionalBool(statement, index: 14, value: point.isMoving)
      bindOptionalBool(statement, index: 15, value: point.isMock)
      bindOptionalText(statement, index: 16, value: point.uuid)
      bindOptionalDouble(statement, index: 17, value: point.batteryLevel)
      bindOptionalBool(statement, index: 18, value: point.batteryIsCharging)

      return sqlite3_step(statement) == SQLITE_DONE
    }
  }

  func lastPersistedTimestampMs() -> Int64? {
    queue.sync {
      guard openIfNeeded(), let db else {
        return nil
      }

      let sql = "SELECT timestamp FROM location_points ORDER BY timestamp DESC LIMIT 1;"
      var statement: OpaquePointer?
      guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK,
            let statement else {
        return nil
      }
      defer { sqlite3_finalize(statement) }

      guard sqlite3_step(statement) == SQLITE_ROW else {
        return nil
      }
      return sqlite3_column_int64(statement, 0)
    }
  }

  private func hasDuplicate(db: OpaquePointer, point: LifeMapLocationInsert) -> Bool {
    let sql =
      "SELECT id FROM location_points WHERE timestamp = ? AND lat = ? AND lng = ? LIMIT 1;"
    var statement: OpaquePointer?
    guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK,
          let statement else {
      return false
    }
    defer { sqlite3_finalize(statement) }

    sqlite3_bind_int64(statement, 1, point.timestampMs)
    sqlite3_bind_double(statement, 2, point.lat)
    sqlite3_bind_double(statement, 3, point.lng)
    return sqlite3_step(statement) == SQLITE_ROW
  }

  private func bindOptionalDouble(
    _ statement: OpaquePointer,
    index: Int32,
    value: Double?
  ) {
    if let value {
      sqlite3_bind_double(statement, index, value)
    } else {
      sqlite3_bind_null(statement, index)
    }
  }

  private func bindOptionalInt(
    _ statement: OpaquePointer,
    index: Int32,
    value: Int?
  ) {
    if let value {
      sqlite3_bind_int64(statement, index, Int64(value))
    } else {
      sqlite3_bind_null(statement, index)
    }
  }

  private func bindOptionalBool(
    _ statement: OpaquePointer,
    index: Int32,
    value: Bool?
  ) {
    if let value {
      sqlite3_bind_int(statement, index, value ? 1 : 0)
    } else {
      sqlite3_bind_null(statement, index)
    }
  }

  private func bindOptionalText(
    _ statement: OpaquePointer,
    index: Int32,
    value: String?
  ) {
    if let value {
      sqlite3_bind_text(statement, index, value, -1, SQLITE_TRANSIENT)
    } else {
      sqlite3_bind_null(statement, index)
    }
  }
}

private let SQLITE_TRANSIENT = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
