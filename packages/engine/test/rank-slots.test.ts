import { expect, test } from 'vitest';
import { item, input } from './fixtures.ts';
import { buildCandidates, buildSlots } from '../src/candidates.ts';
import { rankCandidates, rankSlots } from '../src/score.ts';
import { createRng } from '../src/rng.ts';
import type { Category, ColorFamily, Formality, Item, Warmth } from '../src/types.ts';

const colors: ColorFamily[] = ['black', 'white', 'red', 'green', 'blue', 'pink', 'navy', 'yellow'];
const levels: Formality[] = ['casual', 'smart', 'formal'];
const allColors: ColorFamily[] = [...colors, 'grey', 'beige', 'brown', 'denim', 'purple', 'multi'];

function closet(n: number, tops = 6) {
  const pick = <T,>(xs: T[], i: number) => xs[(i * 7 + n) % xs.length]!;
  const make = (cat: 'top' | 'bottom' | 'dress' | 'shoes' | 'outerwear', count: number) =>
    Array.from({ length: count }, (_, i) =>
      item(`${cat[0]}${i}`, cat, {
        colorFamily: pick(colors, i + cat.length),
        formality: pick(levels, i),
        warmth: ((i + n) % 3 + 1) as Warmth,
      }));
  return [...make('top', tops), ...make('bottom', 5), ...make('dress', 3), ...make('shoes', 3), ...make('outerwear', 3)];
}

function randomCloset(seed: number): Item[] {
  const rng = createRng(seed);
  const pickOf = <T,>(xs: T[]) => xs[Math.floor(rng() * xs.length)]!;
  const slotLevel: Partial<Record<Category, Formality>> = {};
  for (const cat of ['top', 'bottom', 'dress', 'shoes', 'outerwear'] as const) {
    if (rng() < 0.5) slotLevel[cat] = pickOf(levels);
  }
  const accentRate = rng();
  const make = (cat: Category, count: number) =>
    Array.from({ length: count }, (_, i) =>
      item(`${cat[0]}${i}`, cat, {
        colorFamily: rng() < accentRate ? pickOf(allColors) : pickOf(['black', 'white', 'navy'] as ColorFamily[]),
        formality: slotLevel[cat] ?? pickOf(levels),
        warmth: (1 + Math.floor(rng() * 3)) as Warmth,
      }));
  return [
    ...make('top', 2 + Math.floor(rng() * 14)), ...make('bottom', 1 + Math.floor(rng() * 7)),
    ...make('dress', Math.floor(rng() * 4)), ...make('shoes', 1 + Math.floor(rng() * 4)), ...make('outerwear', Math.floor(rng() * 4)),
  ];
}

const occasions: (Formality | undefined)[] = [undefined, 'casual', 'smart', 'formal'];
const weathers = [{ feelsLikeC: 8, rain: true }, { feelsLikeC: 18, rain: false }, { feelsLikeC: 25, rain: false }];

test('rankSlots matches the top of rankCandidates', () => {
  for (let n = 0; n < 6; n++) {
    for (const tops of [6, 14]) {
    for (const weather of weathers) {
      for (const occasion of occasions) {
        const items = closet(n, tops);
        const inp = { ...input, items, weather, occasion, recentOutfits: [{ date: '2026-10-11', itemIds: ['t1', 'b2', 's0'] }] };
        const full = rankCandidates(buildCandidates(items, weather).candidates, inp).slice(0, 5);
        expect(rankSlots(buildSlots(items, weather), inp, 5)).toEqual(full);
      }
    }
    }
  }
});

test('rankSlots matches rankCandidates on random closets with mixed formality and accents', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const rng = createRng(seed * 31);
    const items = randomCloset(seed).map((i) => (rng() < 0.1 ? { ...i, unavailableUntil: '2026-10-13' } : i));
    const worn = items.filter(() => rng() < 0.2).map((i) => i.id);
    const recentOutfits = [{ date: '2026-10-11', itemIds: worn.slice(0, 3) }, { date: '2026-10-06', itemIds: worn.slice(3) }];
    const weather = weathers[seed % weathers.length]!;
    const occasion = occasions[Math.floor(seed / weathers.length) % occasions.length];
    const inp = { ...input, items, weather, recentOutfits, occasion };
    for (const limit of [1, 5]) {
      const full = rankCandidates(buildCandidates(items, weather, inp.date).candidates, inp).slice(0, limit);
      expect(rankSlots(buildSlots(items, weather, inp.date), inp, limit)).toEqual(full);
    }
  }
});

test('duplicate item ids enter the ranking once', () => {
  const items = [item('t1', 'top'), item('t1', 'top'), item('t2', 'top'), item('b1', 'bottom'), item('s1', 'shoes')];
  const weather = { feelsLikeC: 18, rain: false };
  const ranked = rankSlots(buildSlots(items, weather), { ...input, items, weather }, 5);
  expect(ranked.map((r) => r.items.map((i) => i.id).join(','))).toEqual(['t1,b1,s1', 't2,b1,s1']);
});
