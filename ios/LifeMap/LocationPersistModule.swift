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
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let point = LifeMapLocationInsert(
      timestampMs: timestampMs.int64Value,
      lat: lat.doubleValue,
      lng: lng.doubleValue,
      accuracy: optionalDouble(accuracy),
      altitude: optionalDouble(altitude),
      speed: optionalSpeed(speed),
      source: source as String
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

  private func optionalDouble(_ value: NSNumber) -> Double? {
    value.doubleValue < 0 ? nil : value.doubleValue
  }

  private func optionalSpeed(_ value: NSNumber) -> Double? {
    value.doubleValue < 0 ? nil : value.doubleValue
  }
}
