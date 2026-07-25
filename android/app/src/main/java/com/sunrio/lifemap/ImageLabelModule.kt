package com.sunrio.lifemap

import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.label.ImageLabeling
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions
import java.io.File
import java.util.concurrent.Executors

class ImageLabelModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val executor = Executors.newSingleThreadExecutor()

  override fun getName(): String = "ImageLabelModule"

  @ReactMethod
  fun labelImage(
    uri: String,
    maxResults: Double,
    minConfidence: Double,
    promise: Promise,
  ) {
    val limit = maxResults.toInt().coerceAtLeast(1)
    val threshold = minConfidence.toFloat().coerceIn(0f, 1f)

    executor.execute {
      try {
        val image = loadInputImage(uri)
          ?: run {
            promise.reject("E_IMAGE", "Could not load image for labeling")
            return@execute
          }

        val options =
          ImageLabelerOptions.Builder()
            .setConfidenceThreshold(threshold)
            .build()
        val labeler = ImageLabeling.getClient(options)

        labeler
          .process(image)
          .addOnSuccessListener { labels ->
            val payload = Arguments.createArray()
            for (label in labels.take(limit)) {
              val text = label.text?.trim().orEmpty()
              if (text.isEmpty()) {
                continue
              }
              val entry = Arguments.createMap()
              entry.putString("label", text)
              entry.putDouble("confidence", label.confidence.toDouble())
              payload.pushMap(entry)
            }
            promise.resolve(payload)
            labeler.close()
          }
          .addOnFailureListener { error ->
            labeler.close()
            promise.reject("E_LABEL", error.message, error)
          }
      } catch (error: Exception) {
        promise.reject("E_LABEL", error.message, error)
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
