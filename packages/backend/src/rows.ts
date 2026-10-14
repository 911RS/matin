import type { Category, ColorFamily, Formality, Item, Warmth, Weather, WornOutfit } from '../../engine/src/index.ts';

export interface ProfileRow {
  id: string;
  locale: 'en' | 'fr';
  push_time: string;
  timezone: string;
  lat: number | null;
  lon: number | null;
  expo_push_token: string | null;
}

export interface ItemRow {
  id: string;
  user_id: string;
  category: Category;
  color_hex: string;
  color_family: ColorFamily;
  warmth: Warmth;
  formality: Formality;
  image_path: string;
  original_path: string;
  archived_at: string | null;
  unavailable_until: string | null;
  created_at?: string;
}

export interface OutfitRow {
  id?: string;
  user_id: string;
  date: string;
  item_ids: string[];
  weather: Weather;
  seed: number;
  status: 'suggested' | 'worn' | 'skipped';
  pushed_at?: string | null;
}

export function toEngineItem(r: ItemRow): Item {
  return {
    id: r.id,
    category: r.category,
    colorFamily: r.color_family,
    warmth: r.warmth,
    formality: r.formality,
    archivedAt: r.archived_at,
    unavailableUntil: r.unavailable_until ?? null,
  };
}

export function toWornOutfits(rows: OutfitRow[]): WornOutfit[] {
  return rows.filter((r) => r.status === 'worn').map((r) => ({ date: r.date, itemIds: r.item_ids }));
}
