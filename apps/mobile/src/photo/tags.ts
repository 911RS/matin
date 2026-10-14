import { hexToColorFamily, labelsToCategory } from '@tenue/engine';
import type { Category, ColorFamily } from '@tenue/engine';
import type { ProcessedPhoto } from '../../modules/tenue-photo';

export interface SuggestedTags {
  category: Category | null;
  colorFamily: ColorFamily;
  colorHex: string;
}

export function toTags(p: Pick<ProcessedPhoto, 'dominantColor' | 'labels'>): SuggestedTags {
  let colorFamily: ColorFamily;
  try {
    colorFamily = hexToColorFamily(p.dominantColor);
  } catch {
    colorFamily = 'multi';
  }
  return {
    category: labelsToCategory(p.labels),
    colorFamily,
    colorHex: p.dominantColor,
  };
}
