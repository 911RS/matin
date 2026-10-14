import { expect, test } from 'vitest';
import { createRng, seedFromString } from '../src/rng.ts';

test('seedFromString is stable and unsigned', () => {
  expect(seedFromString('user-1|2026-10-12')).toBe(seedFromString('user-1|2026-10-12'));
  expect(seedFromString('user-1|2026-10-12')).not.toBe(seedFromString('user-1|2026-10-13'));
  expect(seedFromString('')).toBe(2166136261);
});

test('createRng is deterministic and in [0,1)', () => {
  const a = createRng(42), b = createRng(42);
  const xs = Array.from({ length: 100 }, () => a());
  expect(xs).toEqual(Array.from({ length: 100 }, () => b()));
  expect(xs.every(x => x >= 0 && x < 1)).toBe(true);
  expect(createRng(43)()).not.toBe(createRng(42)());
});

test('golden values', () => {
  expect(seedFromString('user-1|2026-10-12')).toBe(4128721252);
  const r = createRng(42);
  expect([r(), r(), r()]).toEqual([0.6011037519201636, 0.44829055899754167, 0.8524657934904099]);
});
