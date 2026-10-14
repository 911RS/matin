export interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CropHandle = 'tl' | 'tr' | 'bl' | 'br' | 'move';

export const FULL_CROP: Crop = { x: 0, y: 0, width: 1, height: 1 };
export const MIN_CROP = 0.15;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 1e6) / 1e6;

function tidy(c: Crop): Crop {
  return { x: round(c.x), y: round(c.y), width: round(c.width), height: round(c.height) };
}

export function dragCrop(start: Crop, handle: CropHandle, dx: number, dy: number, min = MIN_CROP): Crop {
  if (handle === 'move') {
    return tidy({
      ...start,
      x: clamp(start.x + dx, 0, 1 - start.width),
      y: clamp(start.y + dy, 0, 1 - start.height),
    });
  }
  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;
  if (handle === 'tl' || handle === 'bl') left = clamp(left + dx, 0, right - min);
  else right = clamp(right + dx, left + min, 1);
  if (handle === 'tl' || handle === 'tr') top = clamp(top + dy, 0, bottom - min);
  else bottom = clamp(bottom + dy, top + min, 1);
  return tidy({ x: left, y: top, width: right - left, height: bottom - top });
}

export function isFullCrop(c: Crop, tolerance = 0.005): boolean {
  return c.x <= tolerance && c.y <= tolerance && c.x + c.width >= 1 - tolerance && c.y + c.height >= 1 - tolerance;
}

export function toPixels(c: Crop, width: number, height: number) {
  const originX = clamp(Math.round(c.x * width), 0, width - 1);
  const originY = clamp(Math.round(c.y * height), 0, height - 1);
  return {
    originX,
    originY,
    width: clamp(Math.round((c.x + c.width) * width) - originX, 1, width - originX),
    height: clamp(Math.round((c.y + c.height) * height) - originY, 1, height - originY),
  };
}
