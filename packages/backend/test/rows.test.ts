import { expect, test } from 'vitest';
import { toEngineItem, toWornOutfits } from '../src/rows.ts';
import type { ItemRow, OutfitRow } from '../src/rows.ts';

const itemRow: ItemRow = {
  id: 'i1',
  user_id: 'u1',
  category: 'top',
  color_hex: '#112233',
  color_family: 'navy',
  warmth: 2,
  formality: 'smart',
  image_path: 'u1/i1.webp',
  original_path: 'u1/i1.jpg',
  archived_at: null,
  unavailable_until: null,
};

test('toEngineItem maps snake_case to engine fields only', () => {
  expect(toEngineItem(itemRow)).toEqual({
    id: 'i1',
    category: 'top',
    colorFamily: 'navy',
    warmth: 2,
    formality: 'smart',
    archivedAt: null,
    unavailableUntil: null,
  });
});

test('toEngineItem keeps archived_at', () => {
  expect(toEngineItem({ ...itemRow, archived_at: '2026-10-01T00:00:00Z' }).archivedAt).toBe('2026-10-01T00:00:00Z');
});

test('toWornOutfits keeps worn outfits only', () => {
  const base = { user_id: 'u1', weather: { feelsLikeC: 10, rain: false }, seed: 1 };
  const rows: OutfitRow[] = [
    { ...base, date: '2026-10-10', item_ids: ['a', 'b'], status: 'worn' },
    { ...base, date: '2026-10-11', item_ids: ['c'], status: 'suggested' },
    { ...base, date: '2026-10-12', item_ids: ['d'], status: 'skipped' },
  ];
  expect(toWornOutfits(rows)).toEqual([{ date: '2026-10-10', itemIds: ['a', 'b'] }]);
});

test('toEngineItem maps unavailable_until', () => {
  expect(toEngineItem({ ...itemRow, unavailable_until: '2026-10-15' }).unavailableUntil).toBe('2026-10-15');
  const legacy = { ...itemRow } as Partial<ItemRow>;
  delete legacy.unavailable_until;
  expect(toEngineItem(legacy as ItemRow).unavailableUntil).toBeNull();
});
