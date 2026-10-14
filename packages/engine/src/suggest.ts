import type { SuggestInput, SuggestResult } from './types.ts';
import { buildSlots } from './candidates.ts';
import { rankSlots } from './score.ts';
import { pickIndex } from './pick.ts';
import { buildReason } from './reason.ts';
import { createRng } from './rng.ts';
import { normalizeInput } from './input.ts';

const MAX_PICK_POOL = 5;

export function suggest(rawInput: SuggestInput): SuggestResult {
  const input = normalizeInput(rawInput);
  const slots = buildSlots(input.items, input.weather, input.date);
  if (slots.missing.length > 0) return { missing: slots.missing };
  const ranked = rankSlots(slots, input, MAX_PICK_POOL);
  const chosen = ranked[pickIndex(ranked, createRng(input.seed))]!;
  return {
    itemIds: chosen.items.map((i) => i.id),
    reason: buildReason(chosen.items, input.weather, slots.noJacket, input.locale),
  };
}
