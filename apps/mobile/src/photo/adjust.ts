import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { toPixels } from '../closet/cropMath';
import type { Crop } from '../closet/cropMath';

export type ImageEdit = { kind: 'rotate' } | { kind: 'crop'; crop: Crop };
export type AdjustFormat = 'png' | 'jpeg';

export interface AdjustedImage {
  uri: string;
  width: number;
  height: number;
}

const JPEG_QUALITY = 0.92;

export async function adjustImage(uri: string, edit: ImageEdit, format: AdjustFormat): Promise<AdjustedImage> {
  const context = ImageManipulator.manipulate(uri);
  if (edit.kind === 'rotate') {
    context.rotate(90);
  } else {
    const probe = await ImageManipulator.manipulate(uri).renderAsync();
    context.crop(toPixels(edit.crop, probe.width, probe.height));
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({
    format: format === 'png' ? SaveFormat.PNG : SaveFormat.JPEG,
    compress: JPEG_QUALITY,
  });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}
