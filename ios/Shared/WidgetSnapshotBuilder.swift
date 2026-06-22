import Foundation
import SQLite3

enum WidgetDatabase {
  static var path: String? {
    let library = NSSearchPathForDirectoriesInDomains(.libraryDirectory, .userDomainMask, true).first
    return library.map { ($0 as NSString).appendingPathComponent("lifemap.db") }
  }
}

enum WidgetDateFormat {
  private static var calendar: Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "America/Chicago") ?? .current
    return calendar
  }

  static func todayKey(now: Date = Date()) -> String {
    let components = calendar.dateComponents([.year, .month, .day], from: now)
    guard let year = components.year, let month = components.month, let day = components.day else {
      return ""
    }
    return String(format: "%04d-%02d-%02d", year, month, day)
  }

  static func mapDateLabel(dateKey: String, now: Date = Date()) -> String {
    let formatter = DateFormatter()
    formatter.timeZone = calendar.timeZone
    formatter.dateFormat = "MMM d"
    let todayKey = todayKey(now: now)
    let dayLabel = dateKeyToDate(dateKey).map { formatter.string(from: $0) } ?? ""
    if dateKey == todayKey {
      return "Today · \(dayLabel)"
    }
    formatter.dateFormat = "EEE"
    let weekday = dateKeyToDate(dateKey).map { formatter.string(from: $0) } ?? ""
    return "\(weekday) · \(dayLabel)"
  }

  static func iso8601(_ date: Date) -> String {
    ISO8601DateFormatter().string(from: date)
  }

  private static func dateKeyToDate(_ dateKey: String) -> Date? {
    let parts = dateKey.split(separator: "-").compactMap { Int($0) }
    guard parts.count == 3 else { return nil }
    return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
  }

  static func dayStartMs(dateKey: String) -> Int64? {
    dateKeyToDate(dateKey).map { Int64($0.timeIntervalSince1970 * 1000) }
  }
}

private struct SavedPlaceRow {
  let kind: String
  let label: String
  let lat: Double
  let lng: Double
  let radiusMeters: Double
}

private struct LocationPointRow {
  let lat: Double
  let lng: Double
  let timestampMs: Int64
}

private struct StayRow {
  let startAtMs: Int64
  let endAtMs: Int64
  let centroidLat: Double
  let centroidLng: Double
  let savedPlaceLabel: String?
}

enum WidgetSnapshotBuilder {
  static func build(now: Date = Date()) -> WidgetSnapshotPayload {
    let dateKey = WidgetDateFormat.todayKey(now: now)
    let dateLabel = WidgetDateFormat.mapDateLabel(dateKey: dateKey, now: now)
    let updatedAt = WidgetDateFormat.iso8601(now)

    guard
      let dbPath = WidgetDatabase.path,
      let db = openDatabase(path: dbPath)
    else {
      return WidgetSnapshotPayload(
        updatedAt: updatedAt,
        placeLabel: "LifeMap",
        placeKind: "none",
        durationLabel: nil,
        dateLabel: dateLabel,
        isOngoing: false
      )
    }
    defer { sqlite3_close(db) }

    let lastPoint = fetchLastLocationPoint(db: db)
    let savedPlaces = fetchSavedPlaces(db: db)
    let latestStay = fetchLatestStay(db: db, dateKey: dateKey)
    let hasTravelAfterLatestStay = latestStay.map {
      hasTravelAfterStay(db: db, dateKey: dateKey, stayStartMs: $0.startAtMs)
    } ?? false

    if let point = lastPoint {
      if let place = matchSavedPlace(point: point, places: savedPlaces) {
        let dayStartMs = WidgetDateFormat.dayStartMs(dateKey: dateKey)
        let startMs = durationStartMs(
          stay: latestStay,
          place: place,
          point: point,
          hasTravelAfterStay: hasTravelAfterLatestStay
        ) ?? dayStartMs.flatMap {
          fetchFirstPointNearPlaceToday(db: db, place: place, dayStartMs: $0)
        }
        return WidgetSnapshotPayload(
          updatedAt: updatedAt,
          placeLabel: displayLabel(for: place),
          placeKind: place.kind,
          durationLabel: startMs.map { formatHereFor(durationMs: max(0, nowMs(now) - $0)) },
          dateLabel: dateLabel,
          isOngoing: startMs != nil
        )
      }

      if let stay = latestStay,
         !hasTravelAfterLatestStay,
         isNear(point, lat: stay.centroidLat, lng: stay.centroidLng, radiusM: 150) {
        let label = stay.savedPlaceLabel?.trimmingCharacters(in: .whitespacesAndNewlines)
        let placeLabel = (label?.isEmpty == false) ? label! : "Nearby"
        return WidgetSnapshotPayload(
          updatedAt: updatedAt,
          placeLabel: placeLabel,
          placeKind: "nearby",
          durationLabel: formatHereFor(durationMs: max(0, nowMs(now) - stay.startAtMs)),
          dateLabel: dateLabel,
          isOngoing: true
        )
      }
    }

    return WidgetSnapshotPayload(
      updatedAt: updatedAt,
      placeLabel: "On the move",
      placeKind: "none",
      durationLabel: nil,
      dateLabel: dateLabel,
      isOngoing: false
    )
  }

  private static func nowMs(_ date: Date) -> Int64 {
    Int64(date.timeIntervalSince1970 * 1000)
  }

  private static func openDatabase(path: String) -> OpaquePointer? {
    var db: OpaquePointer?
    guard sqlite3_open_v2(path, &db, SQLITE_OPEN_READONLY, nil) == SQLITE_OK else {
      return nil
    }
    sqlite3_busy_timeout(db, 2_000)
    return db
  }

  private static func fetchLastLocationPoint(db: OpaquePointer) -> LocationPointRow? {
    let sql = "SELECT lat, lng, timestamp FROM location_points ORDER BY timestamp DESC LIMIT 1;"
    var statement: OpaquePointer?
    guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK, let statement else {
      return nil
    }
    defer { sqlite3_finalize(statement) }
    guard sqlite3_step(statement) == SQLITE_ROW else { return nil }
    return LocationPointRow(
      lat: sqlite3_column_double(statement, 0),
      lng: sqlite3_column_double(statement, 1),
      timestampMs: sqlite3_column_int64(statement, 2)
    )
  }

  private static func fetchSavedPlaces(db: OpaquePointer) -> [SavedPlaceRow] {
    let sql = "SELECT kind, label, lat, lng, radius_meters FROM saved_places;"
    var statement: OpaquePointer?
    guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK, let statement else {
      return []
    }
    defer { sqlite3_finalize(statement) }

    var rows: [SavedPlaceRow] = []
    while sqlite3_step(statement) == SQLITE_ROW {
      let kind = String(cString: sqlite3_column_text(statement, 0))
      let label = String(cString: sqlite3_column_text(statement, 1))
      rows.append(
        SavedPlaceRow(
          kind: kind,
          label: label,
          lat: sqlite3_column_double(statement, 2),
          lng: sqlite3_column_double(statement, 3),
          radiusMeters: sqlite3_column_double(statement, 4)
        )
      )
    }
    return rows
  }

  private static func fetchLatestStay(db: OpaquePointer, dateKey: String) -> StayRow? {
    let sql = """
      SELECT start_at, end_at, centroid_lat, centroid_lng, saved_place_label
      FROM trips
      WHERE date_key = ? AND kind = 'stay'
      ORDER BY segment_order DESC
      LIMIT 1;
      """
    var statement: OpaquePointer?
    guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK, let statement else {
      return nil
    }
    defer { sqlite3_finalize(statement) }
    dateKey.withCString { pointer in
      sqlite3_bind_text(statement, 1, pointer, -1, unsafeBitCast(-1, to: sqlite3_destructor_type.self))
    }
    guard sqlite3_step(statement) == SQLITE_ROW else { return nil }
    let savedLabel = sqlite3_column_type(statement, 4) != SQLITE_NULL
      ? String(cString: sqlite3_column_text(statement, 4))
      : nil
    return StayRow(
      startAtMs: sqlite3_column_int64(statement, 0),
      endAtMs: sqlite3_column_int64(statement, 1),
      centroidLat: sqlite3_column_double(statement, 2),
      centroidLng: sqlite3_column_double(statement, 3),
      savedPlaceLabel: savedLabel
    )
  }

  private static func matchSavedPlace(point: LocationPointRow, places: [SavedPlaceRow]) -> SavedPlaceRow? {
    let kindPriority = ["home": 0, "work": 1, "favorite": 2]
    var best: SavedPlaceRow?
    var bestPriority = Int.max
    var bestDistance = Double.infinity

    for place in places {
      let distanceM = distanceMeters(
        lat1: point.lat, lng1: point.lng,
        lat2: place.lat, lng2: place.lng
      )
      guard distanceM <= place.radiusMeters else { continue }
      let priority = kindPriority[place.kind] ?? 99
      if priority < bestPriority || (priority == bestPriority && distanceM < bestDistance) {
        best = place
        bestPriority = priority
        bestDistance = distanceM
      }
    }
    return best
  }

  private static func hasTravelAfterStay(
    db: OpaquePointer,
    dateKey: String,
    stayStartMs: Int64
  ) -> Bool {
    let sql = """
      SELECT COUNT(*)
      FROM trips
      WHERE date_key = ? AND kind = 'travel' AND start_at > ?;
      """
    var statement: OpaquePointer?
    guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK, let statement else {
      return false
    }
    defer { sqlite3_finalize(statement) }
    dateKey.withCString { pointer in
      sqlite3_bind_text(statement, 1, pointer, -1, unsafeBitCast(-1, to: sqlite3_destructor_type.self))
    }
    sqlite3_bind_int64(statement, 2, stayStartMs)
    guard sqlite3_step(statement) == SQLITE_ROW else { return false }
    return sqlite3_column_int(statement, 0) > 0
  }

  private static func durationStartMs(
    stay: StayRow?,
    place: SavedPlaceRow,
    point: LocationPointRow,
    hasTravelAfterStay: Bool
  ) -> Int64? {
    guard let stay, !hasTravelAfterStay else {
      return nil
    }
    if stayMatchesSavedPlace(stay: stay, place: place) {
      return stay.startAtMs
    }
    if isNear(point, lat: stay.centroidLat, lng: stay.centroidLng, radiusM: max(place.radiusMeters, 150)) {
      return stay.startAtMs
    }
    if isNear(point, lat: place.lat, lng: place.lng, radiusM: place.radiusMeters) {
      return stay.startAtMs
    }
    return nil
  }

  private static func stayMatchesSavedPlace(stay: StayRow, place: SavedPlaceRow) -> Bool {
    if let label = stay.savedPlaceLabel?.trimmingCharacters(in: .whitespacesAndNewlines), !label.isEmpty {
      switch place.kind {
      case "home":
        return label.compare("Home", options: .caseInsensitive) == .orderedSame
      case "work":
        return label.compare("Work", options: .caseInsensitive) == .orderedSame
      default:
        return label.caseInsensitiveCompare(place.label) == .orderedSame
      }
    }
    return isNear(
      LocationPointRow(lat: stay.centroidLat, lng: stay.centroidLng, timestampMs: 0),
      lat: place.lat,
      lng: place.lng,
      radiusM: place.radiusMeters
    )
  }

  private static func fetchFirstPointNearPlaceToday(
    db: OpaquePointer,
    place: SavedPlaceRow,
    dayStartMs: Int64
  ) -> Int64? {
    let sql = """
      SELECT lat, lng, timestamp
      FROM location_points
      WHERE timestamp >= ?
      ORDER BY timestamp ASC;
      """
    var statement: OpaquePointer?
    guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK, let statement else {
      return nil
    }
    defer { sqlite3_finalize(statement) }
    sqlite3_bind_int64(statement, 1, dayStartMs)

    while sqlite3_step(statement) == SQLITE_ROW {
      let point = LocationPointRow(
        lat: sqlite3_column_double(statement, 0),
        lng: sqlite3_column_double(statement, 1),
        timestampMs: sqlite3_column_int64(statement, 2)
      )
      if isNear(point, lat: place.lat, lng: place.lng, radiusM: place.radiusMeters) {
        return point.timestampMs
      }
    }
    return nil
  }

  private static func displayLabel(for place: SavedPlaceRow) -> String {
    switch place.kind {
    case "home":
      return "Home"
    case "work":
      return "Work"
    default:
      return place.label
    }
  }

  private static func isNear(_ point: LocationPointRow, lat: Double, lng: Double, radiusM: Double) -> Bool {
    distanceMeters(lat1: point.lat, lng1: point.lng, lat2: lat, lng2: lng) <= radiusM
  }

  private static func distanceMeters(lat1: Double, lng1: Double, lat2: Double, lng2: Double) -> Double {
    let earthRadius = 6_371_000.0
    let dLat = (lat2 - lat1) * .pi / 180
    let dLng = (lng2 - lng1) * .pi / 180
    let a = sin(dLat / 2) * sin(dLat / 2)
      + cos(lat1 * .pi / 180) * cos(lat2 * .pi / 180) * sin(dLng / 2) * sin(dLng / 2)
    return earthRadius * 2 * atan2(sqrt(a), sqrt(1 - a))
  }

  private static func formatHereFor(durationMs: Int64) -> String {
    let totalMinutes = max(1, Int((durationMs + 30_000) / 60_000))
    let hours = totalMinutes / 60
    let minutes = totalMinutes % 60
    if hours == 0 {
      return "Here for \(minutes) min"
    }
    if minutes == 0 {
      return "Here for \(hours) hr"
    }
    return "Here for \(hours) hr \(minutes) min"
  }
}
