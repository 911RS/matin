package com.matinwear.photo

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import com.google.android.gms.common.moduleinstall.ModuleInstall
import com.google.android.gms.common.moduleinstall.ModuleInstallRequest
import com.google.mlkit.common.MlKitException
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.label.ImageLabeling
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream
import java.util.Locale
import java.util.UUID
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext

private const val MAX_DECODE_SIDE = 2048
private const val COLOR_SIDE = 512
private const val LABEL_CONFIDENCE = 0.5f
private const val MAX_LABELS = 10
private const val STALE_FILE_MS = 60 * 60 * 1000L
private const val CACHE_DIR = "tenue-photo"

private fun noSubject() = CodedException("ERR_NO_SUBJECT", "No subject found", null)

class TenuePhotoModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TenuePhoto")

    AsyncFunction("processPhoto") Coroutine { uri: String ->
      withContext(Dispatchers.Default) {
        deleteStaleFiles()
        try {
          process(uri)
        } catch (e: CodedException) {
          throw e
        } catch (e: CancellationException) {
          throw e
        } catch (e: Throwable) {
          throw CodedException("ERR_PROCESS", e.message ?: e.toString(), e)
        }
      }
    }

    AsyncFunction("prepareModels") Coroutine { ->
      withContext(Dispatchers.Default) {
        prepareModels()
      }
    }
  }

  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("React context is not available")

  private suspend fun process(uri: String): Map<String, Any> {
    val source = decode(uri)
    val cutout: Bitmap
    val labels: List<String>
    try {
      cutout = segment(source)
      labels = try {
        label(source)
      } catch (e: CancellationException) {
        cutout.recycle()
        throw e
      } catch (_: Throwable) {
        emptyList()
      }
    } finally {
      source.recycle()
    }
    try {
      val color = colorOf(cutout) ?: throw noSubject()
      val file = writePng(cutout)
      return mapOf(
        "cutoutUri" to Uri.fromFile(file).toString(),
        "width" to cutout.width,
        "height" to cutout.height,
        "dominantColor" to String.format(Locale.ROOT, "#%06x", color and 0xFFFFFF),
        "labels" to labels
      )
    } finally {
      cutout.recycle()
    }
  }

  private fun open(path: String): InputStream {
    if (path.startsWith("/")) return FileInputStream(File(path))
    val uri = Uri.parse(path)
    return when (uri.scheme) {
      "content" -> context.contentResolver.openInputStream(uri)
        ?: throw IllegalArgumentException("Cannot open $uri")
      "file" -> FileInputStream(File(uri.path ?: throw IllegalArgumentException("Invalid uri $uri")))
      else -> throw IllegalArgumentException("Unsupported uri scheme ${uri.scheme}")
    }
  }

  private fun decode(uri: String): Bitmap {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    open(uri).use { BitmapFactory.decodeStream(it, null, bounds) }
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
      throw IllegalArgumentException("Cannot decode image at $uri")
    }
    val options = BitmapFactory.Options().apply {
      inSampleSize = sampleSize(bounds.outWidth, bounds.outHeight, MAX_DECODE_SIDE)
      inPreferredConfig = Bitmap.Config.ARGB_8888
    }
    val decoded = open(uri).use { BitmapFactory.decodeStream(it, null, options) }
      ?: throw IllegalArgumentException("Cannot decode image at $uri")
    val orientation = try {
      open(uri).use {
        ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
      }
    } catch (e: Exception) {
      ExifInterface.ORIENTATION_NORMAL
    }
    return applyOrientation(decoded, orientation)
  }

  private fun applyOrientation(bitmap: Bitmap, orientation: Int): Bitmap {
    val matrix = Matrix()
    when (orientation) {
      ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.setScale(-1f, 1f)
      ExifInterface.ORIENTATION_ROTATE_180 -> matrix.setRotate(180f)
      ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.setScale(1f, -1f)
      ExifInterface.ORIENTATION_TRANSPOSE -> {
        matrix.setRotate(90f)
        matrix.postScale(-1f, 1f)
      }
      ExifInterface.ORIENTATION_ROTATE_90 -> matrix.setRotate(90f)
      ExifInterface.ORIENTATION_TRANSVERSE -> {
        matrix.setRotate(-90f)
        matrix.postScale(-1f, 1f)
      }
      ExifInterface.ORIENTATION_ROTATE_270 -> matrix.setRotate(-90f)
      else -> return bitmap
    }
    val rotated = try {
      Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
    } catch (e: Throwable) {
      bitmap.recycle()
      throw e
    }
    if (rotated !== bitmap) bitmap.recycle()
    return rotated
  }

  private fun segmenterOptions() = SubjectSegmenterOptions.Builder().enableForegroundBitmap().build()

  private suspend fun segment(bitmap: Bitmap): Bitmap {
    val segmenter = SubjectSegmentation.getClient(segmenterOptions())
    val foreground = try {
      segmenter.process(InputImage.fromBitmap(bitmap, 0)).await().foregroundBitmap
    } catch (e: CancellationException) {
      throw e
    } catch (e: Exception) {
      if (isModelDownloading(e)) {
        requestModelInstall()
        throw CodedException("ERR_MODEL_DOWNLOADING", "Model downloading, try again shortly", e)
      }
      throw e
    } finally {
      segmenter.close()
    }
    if (foreground == null) throw noSubject()
    try {
      val w = foreground.width
      val h = foreground.height
      val pixels = IntArray(w * h)
      foreground.getPixels(pixels, 0, w, 0, 0, w, h)
      val box = opaqueBounds(pixels, w, h) ?: throw noSubject()
      val crop = Bitmap.createBitmap(foreground, box[0], box[1], box[2] - box[0], box[3] - box[1])
      return if (crop === foreground) crop.copy(Bitmap.Config.ARGB_8888, false) else crop
    } finally {
      foreground.recycle()
    }
  }

  private fun requestModelInstall() {
    try {
      val request = ModuleInstallRequest.newBuilder()
        .addApi(SubjectSegmentation.getClient(segmenterOptions()))
        .build()
      ModuleInstall.getClient(context).installModules(request)
    } catch (_: Exception) {
    }
  }

  private suspend fun prepareModels(): String {
    val segmenter = SubjectSegmentation.getClient(segmenterOptions())
    return try {
      val response = ModuleInstall.getClient(context).areModulesAvailable(segmenter).await()
      if (response.areModulesAvailable()) {
        "ready"
      } else {
        requestModelInstall()
        "downloading"
      }
    } catch (e: CancellationException) {
      throw e
    } catch (_: Exception) {
      "downloading"
    } finally {
      segmenter.close()
    }
  }

  private fun deleteStaleFiles() {
    try {
      val cutoff = System.currentTimeMillis() - STALE_FILE_MS
      File(appContext.cacheDirectory, CACHE_DIR).listFiles()?.forEach { file ->
        if (file.isFile && file.lastModified() < cutoff) file.delete()
      }
    } catch (_: Exception) {
    }
  }

  private fun isModelDownloading(error: Throwable): Boolean {
    var current: Throwable? = error
    while (current != null) {
      if (current is MlKitException && current.errorCode == MlKitException.UNAVAILABLE) return true
      if (current.message?.contains("to be downloaded", ignoreCase = true) == true) return true
      current = current.cause
    }
    return false
  }

  private suspend fun label(bitmap: Bitmap): List<String> {
    val labeler = ImageLabeling.getClient(
      ImageLabelerOptions.Builder().setConfidenceThreshold(LABEL_CONFIDENCE).build()
    )
    try {
      val labels = labeler.process(InputImage.fromBitmap(bitmap, 0)).await()
      return labels.sortedByDescending { it.confidence }.take(MAX_LABELS).map { it.text }
    } finally {
      labeler.close()
    }
  }

  private fun colorOf(cutout: Bitmap): Int? {
    val scale = minOf(1f, COLOR_SIDE.toFloat() / maxOf(cutout.width, cutout.height))
    val scaled = if (scale < 1f) {
      Bitmap.createScaledBitmap(
        cutout,
        maxOf(1, Math.round(cutout.width * scale)),
        maxOf(1, Math.round(cutout.height * scale)),
        true
      )
    } else {
      cutout
    }
    try {
      val pixels = IntArray(scaled.width * scaled.height)
      scaled.getPixels(pixels, 0, scaled.width, 0, 0, scaled.width, scaled.height)
      return dominantColor(pixels)
    } finally {
      if (scaled !== cutout) scaled.recycle()
    }
  }

  private fun writePng(bitmap: Bitmap): File {
    val dir = File(appContext.cacheDirectory, CACHE_DIR)
    if (!dir.mkdirs() && !dir.isDirectory) throw IllegalStateException("Cannot create $dir")
    val file = File(dir, "${UUID.randomUUID()}.png")
    FileOutputStream(file).use { out ->
      if (!bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)) {
        throw IllegalStateException("Cannot write PNG")
      }
    }
    return file
  }
}
