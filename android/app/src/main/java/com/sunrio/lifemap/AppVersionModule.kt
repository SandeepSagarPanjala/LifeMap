package com.sunrio.lifemap

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AppVersionModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "AppVersionModule"

  @ReactMethod
  fun getVersion(promise: Promise) {
    try {
      val packageInfo =
        reactApplicationContext.packageManager.getPackageInfo(
          reactApplicationContext.packageName,
          0,
        )
      promise.resolve(packageInfo.versionName ?: "0")
    } catch (error: Exception) {
      promise.reject("APP_VERSION_ERROR", error)
    }
  }

  @ReactMethod
  fun getBuildNumber(promise: Promise) {
    try {
      val packageInfo =
        reactApplicationContext.packageManager.getPackageInfo(
          reactApplicationContext.packageName,
          0,
        )
      promise.resolve(packageInfo.longVersionCode.toString())
    } catch (error: Exception) {
      promise.reject("APP_BUILD_ERROR", error)
    }
  }
}
