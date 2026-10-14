import { expect, test } from 'vitest';
import { item, input } from './fixtures.ts';
import { suggest } from '../src/suggest.ts';
import { swapPiece } from '../src/swap.ts';
import { reasonFor } from '../src/reason-for.ts';
import { createRng } from '../src/rng.ts';
import { createScorer } from '../src/score.ts';
import type { Category, ColorFamily, Formality, Item, Warmth } from '../src/types.ts';

const COLORS: ColorFamily[] = ['black', 'white', 'grey', 'navy', 'blue', 'beige', 'brown', 'green', 'red', 'pink', 'yellow', 'purple', 'denim', 'multi'];
const CATEGORIES: Category[] = ['top', 'bottom', 'dress', 'outerwear', 'shoes'];
const LEVELS: Formality[] = ['casual', 'smart', 'formal'];

function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

function baselineDigest(decorate: (i: Item, n: number) => Item): string {
  const rng = createRng(2026);
  const pick = <T>(xs: T[]): T => xs[Math.floor(rng() * xs.length)]!;
  const out: unknown[] = [];
  for (let n = 0; n < 400; n++) {
    const items: Item[] = Array.from({ length: 3 + Math.floor(rng() * 20) }, (_, i) =>
      decorate(item(`i${i}`, pick(CATEGORIES), { colorFamily: pick(COLORS), formality: pick(LEVELS), warmth: (1 + Math.floor(rng() * 3)) as Warmth }), i),
    );
    const weather = { feelsLikeC: Math.floor(rng() * 40) - 5, rain: rng() < 0.4 };
    const worn = items.filter(() => rng() < 0.2).map((i) => i.id);
    const recentOutfits = [{ date: '2026-10-11', itemIds: worn }];
    const locale = rng() < 0.5 ? ('en' as const) : ('fr' as const);
    const inp = { ...input, items, weather, recentOutfits, seed: Math.floor(rng() * 1e9), locale, occasion: undefined };
    const r = suggest(inp);
    out.push(r);
    if ('itemIds' in r) {
      for (const slot of CATEGORIES) out.push(swapPiece(inp, r.itemIds, slot));
      out.push(reasonFor(items, r.itemIds, weather, locale, input.date));
    }
  }
  return fnv(JSON.stringify(out));
}

test('without occasion or unavailable dates, results match the recorded baseline', () => {
  expect(baselineDigest((i) => i)).toBe('77fc7067');
  const past = ['2026-10-01', input.date, null, undefined];
  expect(baselineDigest((i, n) => ({ ...i, unavailableUntil: past[n % past.length] }))).toBe('77fc7067');
});

test('an unavailable item is excluded until its date, then available on the date itself', () => {
  const items = [item('t1', 'top'), item('t2', 'top', { unavailableUntil: '2026-10-12' }), item('b1', 'bottom'), item('s1', 'shoes')];
  const mild = { feelsLikeC: 18, rain: false };
  const picks = (date: string) =>
    new Set(Array.from({ length: 30 }, (_, seed) => (suggest({ ...input, items, weather: mild, date, seed }) as { itemIds: string[] }).itemIds[0]));
  expect(picks('2026-10-11')).toEqual(new Set(['t1']));
  expect(picks('2026-10-12').has('t2')).toBe(true);
});

test('unavailable pieces can leave a slot missing', () => {
  const items = [item('t1', 'top'), item('b1', 'bottom'), item('s1', 'shoes', { unavailableUntil: '2026-10-15' })];
  expect(suggest({ ...input, items, date: '2026-10-12' })).toEqual({ missing: ['shoes'] });
  expect('itemIds' in suggest({ ...input, items, date: '2026-10-15' })).toBe(true);
});

test('swapPiece skips unavailable pieces', () => {
  const items = [
    item('t1', 'top'), item('t2', 'top', { unavailableUntil: '2026-10-13' }), item('t3', 'top'),
    item('b1', 'bottom'), item('s1', 'shoes'),
  ];
  const inp = { ...input, items, weather: { feelsLikeC: 18, rain: false } };
  const seen = new Set<string>();
  let cur = ['t1', 'b1', 's1'];
  for (let n = 0; n < 4; n++) {
    cur = swapPiece(inp, cur, 'top').itemIds;
    seen.add(cur[0]!);
  }
  expect(seen).toEqual(new Set(['t1', 't3']));
});

test('reasonFor treats an unavailable jacket as absent on that date', () => {
  const items = [item('t1', 'top'), item('b1', 'bottom'), item('s1', 'shoes'), item('o1', 'outerwear', { warmth: 3, unavailableUntil: '2026-10-14' })];
  const cold = { feelsLikeC: 2, rain: true };
  expect(reasonFor(items, ['t1', 'b1', 's1'], cold, 'en', '2026-10-12').startsWith('No jacket in your closet')).toBe(true);
  expect(reasonFor(items, ['t1', 'b1', 's1'], cold, 'en', '2026-10-14').startsWith('No jacket in your closet')).toBe(false);
  expect(reasonFor(items, ['t1', 'b1', 's1'], cold, 'en').startsWith('No jacket in your closet')).toBe(false);
  const r = suggest({ ...input, items, weather: cold, date: '2026-10-12' });
  if (!('itemIds' in r)) throw new Error('expected outfit');
  expect(reasonFor(items, r.itemIds, cold, 'en', '2026-10-12')).toBe(r.reason);
});

test('reasonFor skips the no-jacket line when the outfit already has outerwear', () => {
  const items = [item('t1', 'top'), item('b1', 'bottom'), item('s1', 'shoes'), item('o1', 'outerwear', { warmth: 3, unavailableUntil: '2026-10-14' })];
  const cold = { feelsLikeC: 2, rain: true };
  expect(reasonFor(items, ['o1', 't1', 'b1', 's1'], cold, 'en', '2026-10-12').startsWith('No jacket in your closet')).toBe(false);
});

test('occasion changes the pick toward matching formality', () => {
  const items = [
    item('t1', 'top'), item('t2', 'top', { formality: 'formal' }),
    item('b1', 'bottom'), item('b2', 'bottom', { formality: 'formal' }),
    item('s1', 'shoes'), item('s2', 'shoes', { formality: 'formal' }),
  ];
  const inp = { ...input, items, weather: { feelsLikeC: 18, rain: false } };
  const picks = (occasion?: Formality) =>
    new Set(Array.from({ length: 40 }, (_, seed) => (suggest({ ...inp, seed, occasion }) as { itemIds: string[] }).itemIds.join(',')));
  expect(picks()).toEqual(new Set(['t1,b1,s1', 't2,b2,s2']));
  expect(picks('casual')).toEqual(new Set(['t1,b1,s1']));
  expect(picks('formal')).toEqual(new Set(['t2,b2,s2']));
});

test('occasion penalty is 0, 3 or 9 per piece by formality distance', () => {
  const casual = item('t1', 'top');
  const at = (occasion: Formality | undefined) =>
    createScorer({ ...input, weather: { feelsLikeC: 18, rain: false }, occasion }).itemPenalty(casual);
  const base = at(undefined);
  expect([at('casual'), at('smart'), at('formal')].map((p) => p - base)).toEqual([0, 3, 9]);
});
