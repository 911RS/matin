import type { ColorFamily, Item, SuggestInput } from './types.ts';
import { NEUTRALS, accentPenalty } from './color.ts';
import { FORMALITY_RANK, occasionPenalty, rangePenalty } from './formality.ts';
import { createRepeatPenalty } from './repeat.ts';
import type { Slots } from './candidates.ts';
import { targetWarmth } from './weather.ts';

export interface RankedOutfit {
  items: Item[];
  score: number;
}

export interface Entry {
  items: Item[];
  score: number;
  key?: string;
}

const keyOf = (e: Entry): string => (e.key ??= e.items.map((i) => i.id).join(','));

export function order(a: Entry, b: Entry): number {
  if (b.score !== a.score) return b.score - a.score;
  const ka = keyOf(a);
  const kb = keyOf(b);
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

export interface Scorer {
  score: (items: Item[]) => number;
  itemPenalty: (i: Item) => number;
  mixPenalty: (items: Item[]) => number;
}

export function createScorer(input: SuggestInput): Scorer {
  const target = targetWarmth(input.weather.feelsLikeC);
  const repeat = createRepeatPenalty(input.recentOutfits, input.date);
  const cache = new Map<Item, number>();
  const itemPenalty = (i: Item): number => {
    let p = cache.get(i);
    if (p === undefined) {
      p = Math.abs(i.warmth - target) + repeat(i.id) + occasionPenalty(i.formality, input.occasion);
      cache.set(i, p);
    }
    return p;
  };
  // Color + formality penalty; never decreases as items are added.
  const mixPenalty = (items: Item[]): number => {
    let accents = 0;
    let a: ColorFamily = 'multi';
    let b: ColorFamily = 'multi';
    let min = 2;
    let max = 0;
    for (const i of items) {
      if (!NEUTRALS.has(i.colorFamily)) {
        if (accents === 0) a = i.colorFamily;
        else if (accents === 1) b = i.colorFamily;
        accents++;
      }
      const r = FORMALITY_RANK[i.formality];
      if (r < min) min = r;
      if (r > max) max = r;
    }
    return accentPenalty(accents, a, b) + (max > min ? rangePenalty(min, max) : 0);
  };
  const score = (items: Item[]): number => {
    let penalty = mixPenalty(items);
    for (const i of items) penalty += itemPenalty(i);
    return 0 - penalty;
  };
  return { score, itemPenalty, mixPenalty };
}

export function scoreCandidate(c: Item[], input: SuggestInput): number {
  return createScorer(input).score(c);
}

export function rankCandidates(cands: Item[][], input: SuggestInput): RankedOutfit[] {
  const { score } = createScorer(input);
  return cands
    .map((items): Entry => ({ items, score: score(items) }))
    .sort(order)
    .map(({ items, score }) => ({ items, score }));
}

// Top `limit` outfits of the slot cross product, pruning branches that cannot qualify.
export function rankSlots(slots: Slots, input: SuggestInput, limit: number): RankedOutfit[] {
  const { score, itemPenalty, mixPenalty } = createScorer(input);
  const kept: Entry[] = [];
  const parts: Item[] = [];

  const cheapest = (xs: (Item | null)[]): number =>
    xs.reduce((m, x) => Math.min(m, x ? itemPenalty(x) : 0), Infinity);
  const minBottom = cheapest(slots.bottoms);
  const minShoe = cheapest(slots.shoes);
  const minLayer = cheapest(slots.layers);

  // True when no outfit starting with `prefix` can beat the current worst kept one.
  const hopeless = (bound: number, prefix: string): boolean => {
    if (kept.length < limit) return false;
    const worst = kept[limit - 1]!;
    if (bound !== 0 - worst.score) return bound > 0 - worst.score;
    return prefix > keyOf(worst).slice(0, prefix.length);
  };

  const consider = (): void => {
    const s = score(parts);
    const full = kept.length === limit;
    const worst = full ? kept[limit - 1]! : undefined;
    if (worst && s < worst.score) return;
    let key: string | undefined;
    if (worst && s === worst.score) {
      key = parts.map((i) => i.id).join(',');
      if (key >= keyOf(worst)) return;
    }
    const entry: Entry = { items: parts.slice(), score: s, key };
    let at = kept.length;
    while (at > 0 && order(entry, kept[at - 1]!) < 0) at--;
    kept.splice(at, 0, entry);
    if (kept.length > limit) kept.pop();
  };

  const withLayers = (base: number): void => {
    for (const layer of slots.layers) {
      parts.length = base;
      if (layer) parts.push(layer);
      consider();
    }
  };

  for (const top of slots.tops) {
    const topPenalty = itemPenalty(top);
    const topKey = top.id + ',';
    if (hopeless(topPenalty + minBottom + minShoe + minLayer, topKey)) continue;
    for (const bottom of slots.bottoms) {
      const pair = topPenalty + itemPenalty(bottom);
      const pairKey = topKey + bottom.id + ',';
      parts.length = 0;
      parts.push(top, bottom);
      if (hopeless(pair + mixPenalty(parts) + minShoe + minLayer, pairKey)) continue;
      for (const shoe of slots.shoes) {
        parts.length = 2;
        parts.push(shoe);
        if (hopeless(pair + itemPenalty(shoe) + mixPenalty(parts) + minLayer, pairKey + shoe.id)) continue;
        withLayers(3);
      }
    }
  }
  for (const dress of slots.dresses) {
    const dressPenalty = itemPenalty(dress);
    const dressKey = dress.id + ',';
    if (hopeless(dressPenalty + minShoe + minLayer, dressKey)) continue;
    for (const shoe of slots.shoes) {
      parts.length = 0;
      parts.push(dress, shoe);
      if (hopeless(dressPenalty + itemPenalty(shoe) + mixPenalty(parts) + minLayer, dressKey + shoe.id)) continue;
      withLayers(2);
    }
  }
  return kept.map(({ items, score }) => ({ items, score }));
}
