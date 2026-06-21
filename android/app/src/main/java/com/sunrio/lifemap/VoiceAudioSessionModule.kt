package com.sunrio.lifemap

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class VoiceAudioSessionModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "VoiceAudioSessionModule"

  @ReactMethod
  fun prepareForRecording(promise: Promise) {
    promise.resolve(true)
  }
}
