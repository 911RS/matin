import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { fitLongSide } from './fit';

const CUTOUT_MAX_SIDE = 1024;
const WEBP_QUALITY = 0.85;

export type CutoutFormat = 'webp' | 'png';

export interface EncodedCutout {
  uri: string;
  format: CutoutFormat;
}

export async function encodeWebp(uri: string, width: number, height: number): Promise<EncodedCutout> {
  const context = ImageManipulator.manipulate(uri);
  const size = fitLongSide(width, height, CUTOUT_MAX_SIDE);
  if (size) context.resize(size);
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.WEBP, compress: WEBP_QUALITY });
  return { uri: saved.uri, format: 'webp' };
}
