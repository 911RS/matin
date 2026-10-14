private let alphaMin = 128

private func bucketOf(_ r: Int, _ g: Int, _ b: Int) -> Int {
  return ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
}

private func unpremultiply(_ c: UInt8, _ a: Int) -> Int {
  return min(255, Int(c) * 255 / a)
}

private func opaqueRGB(_ rgba: [UInt8], _ o: Int) -> (Int, Int, Int)? {
  let a = Int(rgba[o + 3])
  if a < alphaMin { return nil }
  return (unpremultiply(rgba[o], a), unpremultiply(rgba[o + 1], a), unpremultiply(rgba[o + 2], a))
}

func dominantColor(rgba: [UInt8]) -> (UInt8, UInt8, UInt8)? {
  let count = rgba.count / 4
  var counts = [Int](repeating: 0, count: 4096)
  for i in 0..<count {
    guard let px = opaqueRGB(rgba, i * 4) else { continue }
    counts[bucketOf(px.0, px.1, px.2)] += 1
  }
  var best = -1
  var bestCount = 0
  for i in 0..<counts.count where counts[i] > bestCount {
    best = i
    bestCount = counts[i]
  }
  if best < 0 { return nil }
  var sumR = 0
  var sumG = 0
  var sumB = 0
  for i in 0..<count {
    guard let px = opaqueRGB(rgba, i * 4), bucketOf(px.0, px.1, px.2) == best else { continue }
    sumR += px.0
    sumG += px.1
    sumB += px.2
  }
  return (UInt8(sumR / bestCount), UInt8(sumG / bestCount), UInt8(sumB / bestCount))
}

func opaqueBounds(rgba: [UInt8], width: Int, height: Int) -> (left: Int, top: Int, right: Int, bottom: Int)? {
  var left = width
  var top = height
  var right = -1
  var bottom = -1
  for y in 0..<height {
    let row = y * width
    for x in 0..<width {
      if Int(rgba[(row + x) * 4 + 3]) < alphaMin { continue }
      if x < left { left = x }
      if x > right { right = x }
      if y < top { top = y }
      if y > bottom { bottom = y }
    }
  }
  if right < 0 { return nil }
  return (left, top, right + 1, bottom + 1)
}

func fitSize(width: Int, height: Int, maxSide: Int) -> (width: Int, height: Int) {
  let side = max(width, height)
  if side <= maxSide { return (width, height) }
  let scale = Float(maxSide) / Float(side)
  return (max(1, Int((Float(width) * scale).rounded())), max(1, Int((Float(height) * scale).rounded())))
}

func hexColor(_ r: UInt8, _ g: UInt8, _ b: UInt8) -> String {
  return "#" + [r, g, b].map { value -> String in
    let s = String(value, radix: 16)
    return s.count == 1 ? "0" + s : s
  }.joined()
}
