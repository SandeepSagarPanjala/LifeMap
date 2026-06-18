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
