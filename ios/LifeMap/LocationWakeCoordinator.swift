import CoreLocation
import Foundation

struct NativeGeofenceSpec: Codable {
  let identifier: String
  let lat: Double
  let lng: Double
  let radiusMeters: Double
}

@objc final class LocationWakeCoordinator: NSObject, CLLocationManagerDelegate {
  @objc static let shared = LocationWakeCoordinator()

  private let manager = CLLocationManager()
  private var isStarted = false
  private var registeredGeofenceIds: Set<String> = []

  private override init() {
    super.init()
    manager.delegate = self
    manager.pausesLocationUpdatesAutomatically = false
    manager.desiredAccuracy = kCLLocationAccuracyBest
    manager.distanceFilter = kCLDistanceFilterNone
  }

  @objc func start() {
    startIfAuthorized()
  }

  @objc func startIfAuthorized() {
    guard !isStarted else {
      return
    }

    let status = manager.authorizationStatus
    guard status == .authorizedAlways else {
      return
    }
    isStarted = true

    manager.allowsBackgroundLocationUpdates = true
    manager.startMonitoringVisits()
    manager.startMonitoringSignificantLocationChanges()
    LifeMapNativePersistLoop.shared.start()
  }

  @objc func requestStaleRecovery(reason: String) {
    DispatchQueue.main.async {
      TransistorBridge.forceMovingMode(reason: "native_stale_recovery:\(reason)")
      self.requestFreshLocation(source: "native_stale_recovery", forceMoving: false)
    }
  }

  @objc func stop() {
    guard isStarted else {
      return
    }
    isStarted = false
    LifeMapNativePersistLoop.shared.stop()
    manager.stopMonitoringVisits()
    manager.stopMonitoringSignificantLocationChanges()
    for identifier in registeredGeofenceIds {
      for region in manager.monitoredRegions where region.identifier == identifier {
        manager.stopMonitoring(for: region)
      }
    }
    registeredGeofenceIds.removeAll()
  }

  func syncGeofences(_ specs: [NativeGeofenceSpec]) {
    let status = manager.authorizationStatus
    guard status == .authorizedAlways else {
      return
    }

    let nextIds = Set(specs.map(\.identifier))
    for identifier in registeredGeofenceIds.subtracting(nextIds) {
      for region in manager.monitoredRegions where region.identifier == identifier {
        manager.stopMonitoring(for: region)
      }
    }

    registeredGeofenceIds = nextIds
    for spec in specs.prefix(18) {
      guard CLLocationManager.isMonitoringAvailable(for: CLCircularRegion.self) else {
        continue
      }
      let radius = max(spec.radiusMeters, 100)
      let region = CLCircularRegion(
        center: CLLocationCoordinate2D(latitude: spec.lat, longitude: spec.lng),
        radius: radius,
        identifier: spec.identifier
      )
      region.notifyOnEntry = true
      region.notifyOnExit = true
      manager.startMonitoring(for: region)
    }
  }

  private func persist(
    _ location: CLLocation,
    source: String,
    forceMoving: Bool
  ) {
    let point = LifeMapLocationInsert(
      timestampMs: Int64(location.timestamp.timeIntervalSince1970 * 1000),
      lat: location.coordinate.latitude,
      lng: location.coordinate.longitude,
      accuracy: location.horizontalAccuracy >= 0 ? location.horizontalAccuracy : nil,
      altitude: location.verticalAccuracy >= 0 ? location.altitude : nil,
      speed: location.speed >= 0 ? location.speed : nil,
      source: source
    )
    _ = LifeMapDatabase.shared.insertLocation(point, dedupe: true)
    if forceMoving {
      TransistorBridge.forceMovingMode(reason: source)
    }
  }

  private func requestFreshLocation(source: String, forceMoving: Bool) {
    manager.requestLocation()
    pendingWakeSource = source
    pendingForceMoving = forceMoving
  }

  private var pendingWakeSource: String?
  private var pendingForceMoving = false

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard let location = locations.last else {
      return
    }
    let source = pendingWakeSource ?? "native_location"
    let forceMoving = pendingForceMoving
    pendingWakeSource = nil
    pendingForceMoving = false
    persist(location, source: source, forceMoving: forceMoving)
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    pendingWakeSource = nil
    pendingForceMoving = false
  }

  func locationManager(_ manager: CLLocationManager, didVisit visit: CLVisit) {
    if visit.departureDate != Date.distantPast {
      let location = CLLocation(
        latitude: visit.coordinate.latitude,
        longitude: visit.coordinate.longitude
      )
      persist(location, source: "native_visit_departure", forceMoving: true)
      requestFreshLocation(source: "native_visit_departure_gps", forceMoving: true)
      return
    }

    if visit.arrivalDate != Date.distantPast {
      let location = CLLocation(
        latitude: visit.coordinate.latitude,
        longitude: visit.coordinate.longitude
      )
      persist(location, source: "native_visit_arrival", forceMoving: false)
    }
  }

  func locationManager(
    _ manager: CLLocationManager,
    didExitRegion region: CLRegion
  ) {
    guard let circular = region as? CLCircularRegion else {
      return
    }
    let location = CLLocation(
      latitude: circular.center.latitude,
      longitude: circular.center.longitude
    )
    persist(
      location,
      source: "native_geofence_exit:\(region.identifier)",
      forceMoving: true
    )
    requestFreshLocation(
      source: "native_geofence_exit_gps:\(region.identifier)",
      forceMoving: true
    )
  }

  func locationManager(
    _ manager: CLLocationManager,
    didEnterRegion region: CLRegion
  ) {
    guard let circular = region as? CLCircularRegion else {
      return
    }
    let location = CLLocation(
      latitude: circular.center.latitude,
      longitude: circular.center.longitude
    )
    persist(
      location,
      source: "native_geofence_enter:\(region.identifier)",
      forceMoving: false
    )
  }

  func locationManager(
    _ manager: CLLocationManager,
    monitoringDidFailFor region: CLRegion?,
    withError error: Error
  ) {
    // Geofence monitoring can fail when regions overlap or exceed platform limits.
  }
}

enum TransistorBridge {
  static func forceMovingMode(reason: String) {
    LifeMapTransistorSafe.forceMovingMode()
    NSLog("[LifeMap] Transistor changePace(true) from %@", reason)
  }

  static func drainPersistedLocations() -> Int {
    let locations = LifeMapTransistorSafe.drainLocations()
    var imported = 0
    for case let location as CLLocation in locations {
      let point = LifeMapLocationInsert(
        timestampMs: Int64(location.timestamp.timeIntervalSince1970 * 1000),
        lat: location.coordinate.latitude,
        lng: location.coordinate.longitude,
        accuracy: location.horizontalAccuracy >= 0 ? location.horizontalAccuracy : nil,
        altitude: location.verticalAccuracy >= 0 ? location.altitude : nil,
        speed: location.speed >= 0 ? location.speed : nil,
        source: "native_ts_queue"
      )
      if LifeMapDatabase.shared.insertLocation(point, dedupe: true) {
        imported += 1
      }
    }
    return imported
  }
}
