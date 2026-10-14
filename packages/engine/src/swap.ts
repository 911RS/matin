import type { Category, Item, SuggestInput } from './types.ts';
import { buildSlots, type Slots } from './candidates.ts';
import { createScorer, order, type Entry } from './score.ts';
import { buildReason } from './reason.ts';
import { normalizeInput } from './input.ts';

const TOP_FAMILY: Category[] = ['top', 'bottom', 'shoes', 'outerwear'];
const DRESS_FAMILY: Category[] = ['dress', 'shoes', 'outerwear'];

export function swapPiece(rawInput: SuggestInput, current: string[], slot: Category): { itemIds: string[]; reason: string } {
  const input = normalizeInput(rawInput);
  const slots = buildSlots(input.items, input.weather, input.date);
  const byId = new Map<string, Item>();
  for (const i of input.items) if (!byId.has(i.id)) byId.set(i.id, i);
  const reasonFor = (ids: string[]) =>
    buildReason(ids.flatMap((id) => byId.get(id) ?? []), input.weather, slots.noJacket, input.locale);

  const replaced = current.find((id) => byId.get(id)?.category === slot);
  if (replaced === undefined) return { itemIds: current.slice(), reason: reasonFor(current) };

  const matching = slots.missing.length > 0 ? [] : matchingOutfits(slots, input, current, replaced);
  const key = current.join(',');
  const at = matching.findIndex((e) => e.key === key);
  const next = matching[(at + 1) % matching.length]?.items.map((i) => i.id) ?? current.slice();
  return { itemIds: next, reason: reasonFor(next) };
}

// Outfits of the same shape as `current` that contain every other piece of it, best first.
function matchingOutfits(slots: Slots, input: SuggestInput, current: string[], replaced: string): Entry[] {
  const withLayer = slots.layers[0] !== null;
  const lists: Record<Category, Item[]> = {
    top: slots.tops,
    bottom: slots.bottoms,
    dress: slots.dresses,
    shoes: slots.shoes,
    outerwear: withLayer ? (slots.layers as Item[]) : [],
  };
  const kept = new Set(current.filter((id) => id !== replaced));

  for (const family of [TOP_FAMILY, DRESS_FAMILY]) {
    const shape = withLayer ? family : family.slice(0, -1);
    if (shape.length !== current.length) continue;
    const choices: Item[][] = shape.map((c) => lists[c]);
    const fixed = new Set<string>();
    for (const [p, list] of choices.entries()) {
      const hit = list.filter((i) => kept.has(i.id));
      if (hit.length > 1) return [];
      if (hit.length === 1) {
        choices[p] = hit;
        fixed.add(hit[0]!.id);
      }
    }
    if (fixed.size !== kept.size) return [];

    const { score } = createScorer(input);
    const out: Entry[] = [];
    const parts: Item[] = [];
    const walk = (p: number): void => {
      if (p === choices.length) {
        const items = parts.slice();
        out.push({ items, score: score(items), key: items.map((i) => i.id).join(',') });
        return;
      }
      for (const i of choices[p]!) {
        parts[p] = i;
        walk(p + 1);
      }
    };
    walk(0);
    return out.sort(order);
  }
  return [];
}
