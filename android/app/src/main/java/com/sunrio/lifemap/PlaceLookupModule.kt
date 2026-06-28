package com.sunrio.lifemap

import android.location.Geocoder
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.util.Locale

class PlaceLookupModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "PlaceLookupModule"

  @ReactMethod
  fun geocodeAddress(address: String, promise: Promise) {
    val trimmed = address.trim()
    if (trimmed.isEmpty()) {
      promise.reject("E_INVALID_ADDRESS", "Address is required")
      return
    }

    val context = reactApplicationContext
    if (!Geocoder.isPresent()) {
      promise.reject("E_GEOCODE", "Address lookup is not available on this device")
      return
    }

    try {
      val geocoder = Geocoder(context, Locale.getDefault())
      @Suppress("DEPRECATION")
      val addresses = geocoder.getFromLocationName(trimmed, 5)
      if (addresses.isNullOrEmpty()) {
        promise.reject("E_GEOCODE", "Could not find that address")
        return
      }

      val results: WritableArray = Arguments.createArray()
      val seen = mutableSetOf<String>()
      for (match in addresses) {
        val key = "${"%.5f".format(match.latitude)},${"%.5f".format(match.longitude)}"
        if (!seen.add(key)) {
          continue
        }
        val street = listOfNotNull(match.subThoroughfare, match.thoroughfare)
          .filter { it.isNotBlank() }
          .joinToString(" ")
        val cityState = listOfNotNull(match.locality, match.adminArea)
          .filter { it.isNotBlank() }
          .joinToString(", ")
        val line = listOfNotNull(
          street.takeIf { it.isNotBlank() },
          cityState.takeIf { it.isNotBlank() },
          match.postalCode?.takeIf { it.isNotBlank() },
        )
          .joinToString(", ")
          .ifBlank { match.featureName ?: match.getAddressLine(0) }

        val entry = Arguments.createMap()
        entry.putDouble("lat", match.latitude)
        entry.putDouble("lng", match.longitude)
        entry.putString("addressLine", line)
        results.pushMap(entry)
      }

      if (results.size() == 0) {
        promise.reject("E_GEOCODE", "Could not find that address")
        return
      }

      val result = Arguments.createMap()
      result.putArray("results", results)
      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("E_GEOCODE", error.message, error)
    }
  }

  @ReactMethod
  fun lookupNearbyPlace(lat: Double, lng: Double, radiusM: Double, promise: Promise) {
    val context = reactApplicationContext
    if (!Geocoder.isPresent()) {
      promise.resolve(emptyResult(null))
      return
    }

    try {
      val geocoder = Geocoder(context, Locale.getDefault())
      @Suppress("DEPRECATION")
      val addresses = geocoder.getFromLocation(lat, lng, 1)
      if (addresses.isNullOrEmpty()) {
        promise.resolve(emptyResult(null))
        return
      }

      val address = addresses[0]
      val line = listOfNotNull(
        address.subThoroughfare,
        address.thoroughfare,
        address.locality,
      )
        .filter { it.isNotBlank() }
        .joinToString(" ")
        .ifBlank { address.featureName ?: address.getAddressLine(0) }

      val candidates: WritableArray = Arguments.createArray()
      if (!line.isNullOrBlank()) {
        val candidate = Arguments.createMap()
        candidate.putString("id", "address-$lat-$lng")
        candidate.putString("name", line)
        candidate.putString("kind", "address")
        candidate.putDouble("distanceM", 0.0)
        candidates.pushMap(candidate)
      }

      val result = Arguments.createMap()
      result.putString("addressLine", line)
      result.putArray("candidates", candidates)
      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("E_PLACE_LOOKUP", error.message, error)
    }
  }

  private fun emptyResult(addressLine: String?): WritableMap {
    val result = Arguments.createMap()
    result.putString("addressLine", addressLine)
    result.putArray("candidates", Arguments.createArray())
    return result
  }
}
