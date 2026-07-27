package com.sunrio.lifemap

import android.net.Uri
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.io.File
import java.util.concurrent.Executors

class TextRecognizeModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val executor = Executors.newSingleThreadExecutor()

  override fun getName(): String = "TextRecognizeModule"

  override fun invalidate() {
    executor.shutdownNow()
    super.invalidate()
  }

  @Suppress("DEPRECATION")
  override fun onCatalystInstanceDestroy() {
    executor.shutdownNow()
    super.onCatalystInstanceDestroy()
  }

  @ReactMethod
  fun recognizeText(uri: String, promise: Promise) {
    executor.execute {
      try {
        val image =
          loadInputImage(uri)
            ?: run {
              promise.reject("E_IMAGE", "Could not load image for text recognition")
              return@execute
            }

        val recognizer =
          TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        recognizer
          .process(image)
          .addOnSuccessListener { result ->
            promise.resolve(result.text.orEmpty())
            recognizer.close()
          }
          .addOnFailureListener { error ->
            recognizer.close()
            promise.reject("E_OCR", error.message, error)
          }
      } catch (error: Exception) {
        promise.reject("E_OCR", error.message, error)
      }
    }
  }

  private fun loadInputImage(uri: String): InputImage? {
    val context = reactApplicationContext
    return try {
      when {
        uri.startsWith("content://") || uri.startsWith("file://") ->
          InputImage.fromFilePath(context, Uri.parse(uri))
        else -> {
          val file = File(uri)
          if (!file.exists()) {
            null
          } else {
            InputImage.fromFilePath(context, Uri.fromFile(file))
          }
        }
      }
    } catch (_: Exception) {
      null
    }
  }
}
