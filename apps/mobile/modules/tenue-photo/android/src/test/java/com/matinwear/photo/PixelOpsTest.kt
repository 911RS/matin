package com.matinwear.photo

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PixelOpsTest {
  @Test
  fun dominantColorPicksMostFrequentBucketMean() {
    val red = 0xFFF01010.toInt()
    val blue = 0xFF1010F0.toInt()
    assertEquals(red, dominantColor(intArrayOf(red, red, red, blue)))
  }

  @Test
  fun dominantColorIsNullWhenAllTransparent() {
    assertNull(dominantColor(intArrayOf(0x7FFF0000, 0x00000000, 0x10FFFFFF)))
  }

  @Test
  fun dominantColorIgnoresTranslucentPixels() {
    val green = 0xFF20F020.toInt()
    val red = 0x7FF01010
    assertEquals(green, dominantColor(intArrayOf(red, red, red, green)))
  }

  @Test
  fun dominantColorTieGoesToLowestBucket() {
    val high = 0xFFF0F0F0.toInt()
    val low = 0xFF101010.toInt()
    assertEquals(low, dominantColor(intArrayOf(high, low, high, low)))
  }

  @Test
  fun dominantColorAveragesPixelsInSameBucket() {
    val a = 0xFF102030.toInt()
    val b = 0xFF1F2F3F.toInt()
    assertEquals(0xFF172737.toInt(), dominantColor(intArrayOf(a, b)))
  }

  @Test
  fun dominantColorOfEmptyIsNull() {
    assertNull(dominantColor(IntArray(0)))
  }

  @Test
  fun opaqueBoundsFindsSinglePixel() {
    val pixels = IntArray(16)
    pixels[1 * 4 + 2] = 0xFF000000.toInt()
    assertArrayEquals(intArrayOf(2, 1, 3, 2), opaqueBounds(pixels, 4, 4))
  }

  @Test
  fun opaqueBoundsSpansMultiplePixels() {
    val pixels = IntArray(12)
    pixels[0 * 4 + 1] = 0x80000000.toInt()
    pixels[2 * 4 + 3] = 0xFFFFFFFF.toInt()
    pixels[2 * 4 + 0] = 0x7FFFFFFF
    assertArrayEquals(intArrayOf(1, 0, 4, 3), opaqueBounds(pixels, 4, 3))
  }

  @Test
  fun opaqueBoundsIsNullWhenNothingOpaque() {
    assertNull(opaqueBounds(IntArray(16) { 0x7FFFFFFF }, 4, 4))
  }

  @Test
  fun sampleSizeIsSmallestPowerOfTwoWithinMaxSide() {
    assertEquals(2, sampleSize(4000, 3000))
    assertEquals(1, sampleSize(1000, 800))
    assertEquals(8, sampleSize(9000, 6000))
    assertEquals(1, sampleSize(2048, 2048))
    assertEquals(2, sampleSize(2049, 10))
  }
}
