import type { ColorFamily } from './types.ts';

export const NEUTRALS: ReadonlySet<ColorFamily> = new Set<ColorFamily>([
  'black', 'white', 'grey', 'navy', 'beige', 'brown', 'denim',
]);

const ACCENT_PAIRS: ReadonlyArray<readonly [ColorFamily, ColorFamily]> = [
  ['blue', 'yellow'],
  ['blue', 'red'],
  ['green', 'pink'],
  ['purple', 'yellow'],
  ['red', 'pink'],
  ['blue', 'green'],
  ['green', 'yellow'],
];

export type ColorKind =
  | { kind: 'neutral' }
  | { kind: 'accent'; color: ColorFamily }
  | { kind: 'pair'; a: ColorFamily; b: ColorFamily }
  | { kind: 'clash' };

function isMatchingPair(a: ColorFamily, b: ColorFamily): boolean {
  if (a === b) return a !== 'multi';
  return ACCENT_PAIRS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

function accentsOf(families: ColorFamily[]): ColorFamily[] {
  return families.filter((f) => !NEUTRALS.has(f));
}

// Penalty for an outfit with `count` accents, the first two being `a` and `b`.
export function accentPenalty(count: number, a: ColorFamily, b: ColorFamily): number {
  if (count <= 1) return 0;
  if (count === 2) return isMatchingPair(a, b) ? 2 : 8;
  return 8 * (count - 1);
}

export function colorPenalty(families: ColorFamily[]): number {
  const accents = accentsOf(families);
  return accentPenalty(accents.length, accents[0]!, accents[1]!);
}

export function colorKind(families: ColorFamily[]): ColorKind {
  const accents = accentsOf(families);
  if (accents.length === 0) return { kind: 'neutral' };
  if (accents.length === 1) return { kind: 'accent', color: accents[0]! };
  if (accents.length === 2) {
    const [a, b] = [accents[0]!, accents[1]!];
    if (isMatchingPair(a, b)) return a === b ? { kind: 'accent', color: a } : { kind: 'pair', a, b };
  }
  return { kind: 'clash' };
}
