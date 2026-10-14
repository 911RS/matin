import type { Category, Item, Weather } from './types.ts';
import { outerwearRule, targetWarmth } from './weather.ts';

export interface CandidateSet {
  candidates: Item[][];
  missing: Category[];
  noJacket: boolean;
}

export interface Slots {
  tops: Item[];
  bottoms: Item[];
  dresses: Item[];
  shoes: Item[];
  layers: (Item | null)[];
  missing: Category[];
  noJacket: boolean;
}

export function isAvailable(i: Item, date: string | undefined): boolean {
  return date === undefined || !i.unavailableUntil || date >= i.unavailableUntil.slice(0, 10);
}

export function buildSlots(items: Item[], weather: Weather, date?: string): Slots {
  const target = targetWarmth(weather.feelsLikeC);
  const seen = new Set<string>();
  const active = items.filter((i) => !seen.has(i.id) && seen.add(i.id) && i.archivedAt === null && isAvailable(i, date));

  const slot = (category: Category): Item[] => {
    const all = active.filter((i) => i.category === category);
    const fit = all.filter((i) => Math.abs(i.warmth - target) <= 1);
    return fit.length > 0 ? fit : all;
  };

  const tops = slot('top');
  const bottoms = slot('bottom');
  const dresses = slot('dress');
  const shoes = slot('shoes');
  const outerwear = slot('outerwear');

  const missing: Category[] = [];
  if (dresses.length === 0 && tops.length === 0) missing.push('top');
  if (dresses.length === 0 && bottoms.length === 0) missing.push('bottom');
  if (shoes.length === 0) missing.push('shoes');

  const rule = outerwearRule(weather);
  const noJacket = missing.length === 0 && rule === 'required' && outerwear.length === 0;
  const layers: (Item | null)[] = rule === 'required' && outerwear.length > 0 ? outerwear : [null];
  return { tops, bottoms, dresses, shoes, layers, missing, noJacket };
}

export function buildCandidates(items: Item[], weather: Weather, date?: string): CandidateSet {
  const { tops, bottoms, dresses, shoes, layers, missing, noJacket } = buildSlots(items, weather, date);
  if (missing.length > 0) return { candidates: [], missing, noJacket: false };

  const candidates: Item[][] = [];
  const push = (base: Item[]) => {
    for (const layer of layers) candidates.push(layer ? [...base, layer] : base);
  };

  for (const top of tops) {
    for (const bottom of bottoms) {
      for (const shoe of shoes) push([top, bottom, shoe]);
    }
  }
  for (const dress of dresses) {
    for (const shoe of shoes) push([dress, shoe]);
  }

  return { candidates, missing, noJacket };
}
