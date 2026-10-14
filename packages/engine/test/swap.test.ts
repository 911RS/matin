import { expect, test } from 'vitest';
import { item, input } from './fixtures.ts';
import { swapPiece } from '../src/swap.ts';

test('swap top cycles through tops, keeps bottom and shoes', () => {
  const start = ['t1', 'b1', 's1', 'o1'];
  const seen = new Set<string>();
  let cur = start;
  for (let i = 0; i < 3; i++) {
    cur = swapPiece(input, cur, 'top').itemIds;
    expect(cur.slice(1)).toEqual(['b1', 's1', 'o1']);
    seen.add(cur[0]!);
  }
  expect(seen).toEqual(new Set(['t1', 't2', 't3']));
});

test('single item in slot returns unchanged', () => {
  expect(swapPiece(input, ['t1', 'b1', 's1', 'o1'], 'shoes').itemIds).toEqual(['t1', 'b1', 's1', 'o1']);
});

test('slot absent from current returns current with a reason', () => {
  const r = swapPiece(input, ['t1', 'b1', 's1', 'o1'], 'dress');
  expect(r.itemIds).toEqual(['t1', 'b1', 's1', 'o1']);
  expect(r.reason.length).toBeGreaterThan(0);
});

test('current not in the ranked list falls back to the first matching candidate', () => {
  const r = swapPiece(input, ['b1', 't1', 's1', 'o1'], 'top');
  expect(r.itemIds).toEqual(['t1', 'b1', 's1', 'o1']);
});

test('returns a copy, never the caller array', () => {
  const absent = ['t1', 'b1', 's1', 'o1'];
  expect(swapPiece(input, absent, 'dress').itemIds).not.toBe(absent);
  const single = ['t1', 'b1', 's1', 'o1'];
  expect(swapPiece(input, single, 'shoes').itemIds).not.toBe(single);
  const unknown = ['zz', 'b1', 's1', 'o1'];
  expect(swapPiece(input, unknown, 'bottom').itemIds).not.toBe(unknown);
});

test('non-finite weather falls back to assumed weather', () => {
  const r = swapPiece({ ...input, weather: { feelsLikeC: NaN, rain: true } }, ['t1', 'b1', 's1'], 'top');
  expect(r.itemIds).toEqual(['t2', 'b1', 's1']);
  expect(r.reason.startsWith('Weather unavailable: no layer needed')).toBe(true);
});

test('swap on a big cold closet stays under 20 ms', () => {
  const big = [
    ...Array.from({ length: 50 }, (_, i) => item(`t${i}`, 'top', { colorFamily: i % 2 ? 'white' : 'red', warmth: 3, formality: i % 3 ? 'casual' : 'formal' })),
    ...Array.from({ length: 30 }, (_, i) => item(`b${i}`, 'bottom', { colorFamily: i % 3 ? 'navy' : 'green', warmth: 3 })),
    ...Array.from({ length: 10 }, (_, i) => item(`s${i}`, 'shoes', { warmth: 3 })),
    ...Array.from({ length: 8 }, (_, i) => item(`o${i}`, 'outerwear', { warmth: 3 })),
  ];
  const inp = { ...input, items: big, weather: { feelsLikeC: 2, rain: false } };
  const run = () => swapPiece(inp, ['t0', 'b0', 's0', 'o0'], 'top');
  expect(run().itemIds.slice(1)).toEqual(['b0', 's0', 'o0']);
  const times = Array.from({ length: 5 }, () => {
    const t0 = performance.now();
    run();
    return performance.now() - t0;
  }).sort((a, b) => a - b);
  expect(times[2]!).toBeLessThan(20);
});
