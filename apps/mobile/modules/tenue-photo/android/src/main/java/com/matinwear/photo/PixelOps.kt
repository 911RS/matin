package com.matinwear.photo

private const val ALPHA_MIN = 128

private fun isOpaque(pixel: Int): Boolean = (pixel ushr 24) >= ALPHA_MIN

fun dominantColor(pixels: IntArray): Int? {
  val counts = IntArray(4096)
  for (p in pixels) {
    if (!isOpaque(p)) continue
    val bucket = (((p shr 20) and 0xF) shl 8) or (((p shr 12) and 0xF) shl 4) or ((p shr 4) and 0xF)
    counts[bucket]++
  }
  var best = -1
  var bestCount = 0
  for (i in counts.indices) {
    if (counts[i] > bestCount) {
      best = i
      bestCount = counts[i]
    }
  }
  if (best < 0) return null
  var r = 0L
  var g = 0L
  var b = 0L
  for (p in pixels) {
    if (!isOpaque(p)) continue
    val bucket = (((p shr 20) and 0xF) shl 8) or (((p shr 12) and 0xF) shl 4) or ((p shr 4) and 0xF)
    if (bucket != best) continue
    r += (p shr 16) and 0xFF
    g += (p shr 8) and 0xFF
    b += p and 0xFF
  }
  val mr = (r / bestCount).toInt()
  val mg = (g / bestCount).toInt()
  val mb = (b / bestCount).toInt()
  return (0xFF shl 24) or (mr shl 16) or (mg shl 8) or mb
}

fun opaqueBounds(pixels: IntArray, width: Int, height: Int): IntArray? {
  var left = width
  var top = height
  var right = -1
  var bottom = -1
  for (y in 0 until height) {
    val row = y * width
    for (x in 0 until width) {
      if (!isOpaque(pixels[row + x])) continue
      if (x < left) left = x
      if (x > right) right = x
      if (y < top) top = y
      if (y > bottom) bottom = y
    }
  }
  if (right < 0) return null
  return intArrayOf(left, top, right + 1, bottom + 1)
}

fun sampleSize(width: Int, height: Int, maxSide: Int = 2048): Int {
  val side = maxOf(width, height)
  var s = 1
  while (side / s > maxSide) s *= 2
  return s
}
