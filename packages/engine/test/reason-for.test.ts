import { expect, test } from 'vitest';
import { item, input } from './fixtures.ts';
import { reasonFor } from '../src/reason-for.ts';
import { suggest } from '../src/suggest.ts';
import { swapPiece } from '../src/swap.ts';
import { createRng } from '../src/rng.ts';
import type { Category, ColorFamily, Item, Warmth } from '../src/types.ts';

const COLORS: ColorFamily[] = ['black', 'white', 'grey', 'navy', 'blue', 'beige', 'brown', 'green', 'red', 'pink', 'yellow', 'purple', 'denim', 'multi'];
const CATEGORIES: Category[] = ['top', 'bottom', 'dress', 'outerwear', 'shoes'];

test('reasonFor equals the suggest reason over random closets', () => {
  const rng = createRng(12345);
  const pick = <T>(xs: T[]): T => xs[Math.floor(rng() * xs.length)]!;
  let outfits = 0;
  for (let n = 0; n < 200; n++) {
    const items: Item[] = Array.from({ length: 3 + Math.floor(rng() * 12) }, (_, i) =>
      item(`i${i}`, pick(CATEGORIES), { colorFamily: pick(COLORS), warmth: (1 + Math.floor(rng() * 3)) as Warmth }),
    );
    const weather = { feelsLikeC: Math.floor(rng() * 40) - 5, rain: rng() < 0.4, ...(rng() < 0.1 ? { assumed: true } : {}) };
    const locale = rng() < 0.5 ? ('en' as const) : ('fr' as const);
    const r = suggest({ ...input, items, weather, seed: Math.floor(rng() * 1e9), locale });
    if (!('itemIds' in r)) continue;
    outfits++;
    expect(reasonFor(items, r.itemIds, weather, locale)).toBe(r.reason);
  }
  expect(outfits).toBeGreaterThan(50);
});

test('reasonFor describes swapped pieces', () => {
  const items = [
    item('t1', 'top', { colorFamily: 'white' }),
    item('t2', 'top', { colorFamily: 'red' }),
    item('b1', 'bottom', { colorFamily: 'navy' }),
    item('s1', 'shoes', { colorFamily: 'white' }),
  ];
  const weather = { feelsLikeC: 18, rain: false };
  expect(reasonFor(items, ['t1', 'b1', 's1'], weather, 'en')).toContain('neutrals always work');
  expect(reasonFor(items, ['t2', 'b1', 's1'], weather, 'en')).toContain('red with neutrals');
  expect(swapPiece({ ...input, items, weather }, ['t1', 'b1', 's1'], 'top').itemIds[0]).toBe('t2');
});

test('reasonFor ignores unknown ids and normalizes non-finite weather', () => {
  const items = [item('t1', 'top', { colorFamily: 'red' }), item('b1', 'bottom'), item('s1', 'shoes')];
  const r = reasonFor(items, ['t1', 'gone', 'b1', 's1'], { feelsLikeC: NaN, rain: true }, 'en');
  expect(r.startsWith('Weather unavailable: no layer needed')).toBe(true);
  expect(r).toContain('red with neutrals');
});
