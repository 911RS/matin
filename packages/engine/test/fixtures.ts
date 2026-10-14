import type { Category, Item, SuggestInput } from '../src/types.ts';
import { seedFromString } from '../src/rng.ts';

export function item(id: string, category: Category, over: Partial<Item> = {}): Item {
  return { id, category, colorFamily: 'black', warmth: 2, formality: 'casual', archivedAt: null, ...over };
}

export const closet = [
  item('t1', 'top', { colorFamily: 'white' }), item('t2', 'top', { colorFamily: 'red' }), item('t3', 'top', { colorFamily: 'grey' }),
  item('b1', 'bottom', { colorFamily: 'navy' }), item('b2', 'bottom', { colorFamily: 'green' }),
  item('s1', 'shoes', { colorFamily: 'white' }), item('o1', 'outerwear', { colorFamily: 'beige', warmth: 3 }),
];
export const input: SuggestInput = { items: closet, recentOutfits: [], weather: { feelsLikeC: 9, rain: true }, date: '2026-10-12', seed: seedFromString('u1|2026-10-12'), locale: 'en' as const };
