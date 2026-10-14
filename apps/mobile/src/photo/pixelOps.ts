const ALPHA_MIN = 128;

type Pixels = ArrayLike<number>;

function isOpaque(pixel: number): boolean {
  return pixel >>> 24 >= ALPHA_MIN;
}

function bucketOf(p: number): number {
  return (((p >>> 20) & 0xf) << 8) | (((p >>> 12) & 0xf) << 4) | ((p >>> 4) & 0xf);
}

export function dominantColor(pixels: Pixels): number | null {
  const counts = new Uint32Array(4096);
  for (let i = 0; i < pixels.length; i++) {
    const p = pixels[i]!;
    if (isOpaque(p)) counts[bucketOf(p)]!++;
  }
  let best = -1;
  let bestCount = 0;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i]! > bestCount) {
      best = i;
      bestCount = counts[i]!;
    }
  }
  if (best < 0) return null;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < pixels.length; i++) {
    const p = pixels[i]!;
    if (!isOpaque(p) || bucketOf(p) !== best) continue;
    r += (p >>> 16) & 0xff;
    g += (p >>> 8) & 0xff;
    b += p & 0xff;
  }
  const mr = Math.floor(r / bestCount);
  const mg = Math.floor(g / bestCount);
  const mb = Math.floor(b / bestCount);
  return ((0xff << 24) | (mr << 16) | (mg << 8) | mb) >>> 0;
}

export function opaqueBounds(pixels: Pixels, width: number, height: number): [number, number, number, number] | null {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (!isOpaque(pixels[row + x]!)) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (right < 0) return null;
  return [left, top, right + 1, bottom + 1];
}

export function sampleSize(width: number, height: number, maxSide = 2048): number {
  const side = Math.max(width, height);
  let s = 1;
  while (Math.floor(side / s) > maxSide) s *= 2;
  return s;
}

export function argbFromRgba(rgba: ArrayLike<number>): Uint32Array {
  const out = new Uint32Array(rgba.length >> 2);
  for (let i = 0, j = 0; i < out.length; i++, j += 4) {
    out[i] = ((rgba[j + 3]! << 24) | (rgba[j]! << 16) | (rgba[j + 1]! << 8) | rgba[j + 2]!) >>> 0;
  }
  return out;
}

export function colorHex(argb: number): string {
  return `#${(argb & 0xffffff).toString(16).padStart(6, '0')}`;
}
