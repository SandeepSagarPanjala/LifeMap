import Contacts
import CoreLocation
import Foundation
import MapKit
import React

@objc(PlaceLookupModule)
class PlaceLookupModule: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc func lookupNearbyPlace(
    _ lat: Double,
    lng: Double,
    radiusM: Double,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let coordinate = CLLocationCoordinate2D(latitude: lat, longitude: lng)
    let location = CLLocation(latitude: lat, longitude: lng)
    var collectedCandidates: [[String: Any]] = []
    var addressLine: String?
    let searchRadius = max(50, min(radiusM, 5000))

    let geocoder = CLGeocoder()
    geocoder.reverseGeocodeLocation(location) { placemarks, geocodeError in
      if let placemark = placemarks?.first {
        addressLine = Self.formatAddress(placemark)
        if let name = placemark.name,
           !name.isEmpty,
           name != placemark.thoroughfare,
           name != addressLine {
          collectedCandidates.append([
            "id": "geocode-\(name)",
            "name": name,
            "kind": "poi",
            "distanceM": 0,
          ])
        }
      }

      if #available(iOS 16.0, *) {
        let poiRequest = MKLocalPointsOfInterestRequest(center: coordinate, radius: searchRadius)
        let search = MKLocalSearch(request: poiRequest)
        search.start { response, searchError in
          if let items = response?.mapItems {
            for item in items.prefix(5) {
              guard let name = item.name, !name.isEmpty else { continue }
              let itemLocation = item.placemark.location ?? location
              collectedCandidates.append([
                "id": "poi-\(name)-\(item.placemark.coordinate.latitude)",
                "name": name,
                "kind": "poi",
                "distanceM": location.distance(from: itemLocation),
              ])
            }
          }

          if geocodeError != nil && searchError != nil && addressLine == nil && collectedCandidates.isEmpty {
            rejecter(
              "E_PLACE_LOOKUP",
              "Unable to resolve nearby place",
              searchError ?? geocodeError
            )
            return
          }

          resolver([
            "addressLine": addressLine as Any,
            "candidates": collectedCandidates,
          ])
        }
        return
      }

      if geocodeError != nil && addressLine == nil && collectedCandidates.isEmpty {
        rejecter(
          "E_PLACE_LOOKUP",
          "Unable to resolve nearby place",
          geocodeError
        )
        return
      }

      resolver([
        "addressLine": addressLine as Any,
        "candidates": collectedCandidates,
      ])
    }
  }

  private static func formatAddress(_ placemark: CLPlacemark) -> String? {
    if let formatted = placemark.postalAddress {
      let lines = CNPostalAddressFormatter()
        .string(from: formatted)
        .split(separator: "\n")
        .map(String.init)
      if let first = lines.first, !first.isEmpty {
        return first
      }
    }

    let parts = [
      placemark.subThoroughfare,
      placemark.thoroughfare,
      placemark.locality,
    ].compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }

    return parts.isEmpty ? placemark.name : parts.joined(separator: " ")
  }
}
