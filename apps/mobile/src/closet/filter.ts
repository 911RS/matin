import type { ItemRow } from '@tenue/backend';
import type { Category, ColorFamily } from '@tenue/engine';
import { swatch } from '../theme';
import { isForgotten } from './wear';
import type { WearStats } from './wear';

export const CATEGORIES: readonly Category[] = ['top', 'bottom', 'dress', 'outerwear', 'shoes'];
export const FAMILIES = Object.keys(swatch) as ColorFamily[];

export interface ClosetFilter {
  category: Category | null;
  family: ColorFamily | null;
  forgotten?: { stats: WearStats; today: string; timezone?: string } | null;
}

export function filterItems(items: readonly ItemRow[], { category, family, forgotten = null }: ClosetFilter): ItemRow[] {
  return items.filter(
    (item) => (category === null || item.category === category) && (family === null || item.color_family === family) &&
      (forgotten === null || isForgotten(item, forgotten.stats, forgotten.today, forgotten.timezone)),
  );
}

export function presentCategories(items: readonly ItemRow[]): Category[] {
  const present = new Set(items.map((i) => i.category));
  return CATEGORIES.filter((c) => present.has(c));
}

export function presentFamilies(items: readonly ItemRow[]): ColorFamily[] {
  const present = new Set(items.map((i) => i.color_family));
  return FAMILIES.filter((f) => present.has(f));
}
