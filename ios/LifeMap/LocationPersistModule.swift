import CoreLocation
import Foundation
import React

@objc(LocationPersistModule)
class LocationPersistModule: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc func startNativeTracking(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    LocationWakeCoordinator.shared.startIfAuthorized()
    resolve([
      "started": true,
      "databasePath": LifeMapDatabase.shared.databasePath(),
    ])
  }

  @objc func stopNativeTracking(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    LocationWakeCoordinator.shared.stop()
    resolve(true)
  }

  @objc func insertLocation(
    _ timestampMs: NSNumber,
    lat: NSNumber,
    lng: NSNumber,
    accuracy: NSNumber,
    altitude: NSNumber,
    speed: NSNumber,
    source: NSString,
    extras: NSDictionary?,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let point = LifeMapLocationInsert(
      timestampMs: timestampMs.int64Value,
      lat: lat.doubleValue,
      lng: lng.doubleValue,
      accuracy: optionalNonNegative(accuracy),
      altitude: optionalAltitude(altitude),
      speed: optionalNonNegative(speed),
      source: source as String,
      heading: optionalExtrasDouble(extras, key: "heading"),
      headingAccuracy: optionalExtrasDouble(extras, key: "headingAccuracy"),
      speedAccuracy: optionalExtrasDouble(extras, key: "speedAccuracy"),
      altitudeAccuracy: optionalExtrasDouble(extras, key: "altitudeAccuracy"),
      activityType: optionalExtrasString(extras, key: "activityType"),
      activityConfidence: optionalExtrasInt(extras, key: "activityConfidence"),
      isMoving: optionalExtrasBool(extras, key: "isMoving"),
      isMock: optionalExtrasBool(extras, key: "isMock"),
      uuid: optionalExtrasString(extras, key: "uuid"),
      batteryLevel: optionalExtrasDouble(extras, key: "batteryLevel"),
      batteryIsCharging: optionalExtrasBool(extras, key: "batteryIsCharging")
    )
    let inserted = LifeMapDatabase.shared.insertLocation(point, dedupe: true)
    resolver(inserted)
  }

  @objc func drainTransistorQueue(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let imported = TransistorBridge.drainPersistedLocations()
    resolve(imported)
  }

  @objc func syncGeofences(
    _ specs: NSArray,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    do {
      let data = try JSONSerialization.data(withJSONObject: specs, options: [])
      let decoded = try JSONDecoder().decode([NativeGeofenceSpec].self, from: data)
      LocationWakeCoordinator.shared.syncGeofences(decoded)
      resolver(decoded.count)
    } catch {
      rejecter("E_GEOFENCE_SYNC", "Unable to sync geofences", error)
    }
  }

  @objc func getNativePersistStatus(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    resolve([
      "databasePath": LifeMapDatabase.shared.databasePath(),
      "lastTimestampMs": LifeMapDatabase.shared.lastPersistedTimestampMs() as Any,
    ])
  }

  /// JS sends -1 for missing accuracy/speed. Negative values are never valid for those fields.
  private func optionalNonNegative(_ value: NSNumber) -> Double? {
    let number = value.doubleValue
    guard number.isFinite, number >= 0 else {
      return nil
    }
    return number
  }

  /// JS sends -1 when altitude is missing. Real altitudes may be below sea level.
  private func optionalAltitude(_ value: NSNumber) -> Double? {
    let number = value.doubleValue
    guard number.isFinite, number != -1 else {
      return nil
    }
    return number
  }

  private func optionalExtrasDouble(_ extras: NSDictionary?, key: String) -> Double? {
    guard let value = extras?[key] as? NSNumber else {
      return nil
    }
    let number = value.doubleValue
    return number.isFinite ? number : nil
  }

  private func optionalExtrasInt(_ extras: NSDictionary?, key: String) -> Int? {
    guard let value = extras?[key] as? NSNumber else {
      return nil
    }
    return value.intValue
  }

  private func optionalExtrasBool(_ extras: NSDictionary?, key: String) -> Bool? {
    guard let value = extras?[key] as? NSNumber else {
      return nil
    }
    return value.boolValue
  }

  private func optionalExtrasString(_ extras: NSDictionary?, key: String) -> String? {
    guard let value = extras?[key] as? String else {
      return nil
    }
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
  }
}
