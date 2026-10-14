import { toPixels } from '../closet/cropMath';
import type { AdjustedImage, AdjustFormat, ImageEdit } from './adjust';

const JPEG_QUALITY = 0.92;

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function adjustImage(uri: string, edit: ImageEdit, format: AdjustFormat): Promise<AdjustedImage> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`Cannot read ${uri}`);
  const bitmap = await createImageBitmap(await response.blob());
  const canvas = document.createElement('canvas');
  try {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is not available');
    if (edit.kind === 'rotate') {
      canvas.width = bitmap.height;
      canvas.height = bitmap.width;
      context.translate(bitmap.height, 0);
      context.rotate(Math.PI / 2);
      context.drawImage(bitmap, 0, 0);
    } else {
      const rect = toPixels(edit.crop, bitmap.width, bitmap.height);
      canvas.width = rect.width;
      canvas.height = rect.height;
      context.drawImage(bitmap, rect.originX, rect.originY, rect.width, rect.height, 0, 0, rect.width, rect.height);
    }
    const type = format === 'png' ? 'image/png' : 'image/jpeg';
    const blob = await toBlob(canvas, type, format === 'jpeg' ? JPEG_QUALITY : undefined);
    if (!blob) throw new Error('Cannot encode the adjusted image');
    return { uri: URL.createObjectURL(blob), width: canvas.width, height: canvas.height };
  } finally {
    bitmap.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}
