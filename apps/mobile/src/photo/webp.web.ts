import { fitSize } from './fit';
import type { EncodedCutout } from './webp';

const CUTOUT_MAX_SIDE = 1024;
const WEBP_QUALITY = 0.85;

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function encodeWebp(uri: string, width: number, height: number): Promise<EncodedCutout> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`Cannot read ${uri}`);
  const bitmap = await createImageBitmap(await response.blob());
  const size = fitSize(width, height, CUTOUT_MAX_SIDE);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  try {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is not available');
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    const webp = await toBlob(canvas, 'image/webp', WEBP_QUALITY);
    const blob = webp?.type === 'image/webp' ? webp : await toBlob(canvas, 'image/png');
    if (!blob) throw new Error('Cannot encode the cut-out');
    return { uri: URL.createObjectURL(blob), format: blob.type === 'image/webp' ? 'webp' : 'png' };
  } finally {
    bitmap.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}
