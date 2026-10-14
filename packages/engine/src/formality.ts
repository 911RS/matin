import type { Formality } from './types.ts';

export const FORMALITY_RANK: Record<Formality, number> = { casual: 0, smart: 1, formal: 2 };
const PENALTY = [0, 2, 8];
const OCCASION_PENALTY = [0, 3, 9];

// Penalty for an outfit whose formality ranks span `max - min`.
export function rangePenalty(min: number, max: number): number {
  return PENALTY[max - min]!;
}

export function formalityPenalty(levels: Formality[]): number {
  if (levels.length < 2) return 0;
  const ranks = levels.map((l) => FORMALITY_RANK[l]);
  return rangePenalty(Math.min(...ranks), Math.max(...ranks));
}

export function occasionPenalty(level: Formality, occasion: Formality | undefined): number {
  return occasion === undefined ? 0 : OCCASION_PENALTY[Math.abs(FORMALITY_RANK[level] - FORMALITY_RANK[occasion])]!;
}
