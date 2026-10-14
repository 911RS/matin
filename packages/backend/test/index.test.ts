import { expect, test } from 'vitest';
import * as backend from '../src/index.ts';
import type { ItemRow, OutfitRow, ProfileRow } from '../src/index.ts';

test('public API exposes only the shared row helpers', () => {
  expect(Object.keys(backend).sort()).toEqual(
    ['dayWeather', 'daysBefore', 'fetchWeather', 'localDate', 'roundCoord', 'toEngineItem', 'toWornOutfits'],
  );
});

test('row types are exported', () => {
  const rows: [ProfileRow | null, ItemRow | null, OutfitRow | null] = [null, null, null];
  expect(rows).toHaveLength(3);
});
