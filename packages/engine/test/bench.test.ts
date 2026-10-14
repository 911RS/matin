import { expect, test } from 'vitest';
import { item, input } from './fixtures.ts';
import { suggest } from '../src/suggest.ts';
import type { Item, Weather } from '../src/types.ts';

function medianMs(items: Item[], weather: Weather): number {
  const run = () => suggest({ ...input, items, weather });
  run();
  const times = Array.from({ length: 5 }, () => {
    const t0 = performance.now();
    run();
    return performance.now() - t0;
  }).sort((a, b) => a - b);
  return times[2]!;
}

const mild = { feelsLikeC: 18, rain: false };
const cold = { feelsLikeC: 2, rain: false };

test('50 tops x 30 bottoms x 10 shoes under 50 ms', () => {
  const big = [
    ...Array.from({ length: 50 }, (_, i) => item(`t${i}`, 'top', { colorFamily: i % 2 ? 'white' : 'red' })),
    ...Array.from({ length: 30 }, (_, i) => item(`b${i}`, 'bottom', { colorFamily: i % 3 ? 'navy' : 'green' })),
    ...Array.from({ length: 10 }, (_, i) => item(`s${i}`, 'shoes')),
  ];
  expect(medianMs(big, mild)).toBeLessThan(50);
});

test('every outfit has a formality mismatch, under 50 ms', () => {
  const big = [
    ...Array.from({ length: 50 }, (_, i) => item(`t${i}`, 'top', { formality: 'smart' })),
    ...Array.from({ length: 30 }, (_, i) => item(`b${i}`, 'bottom')),
    ...Array.from({ length: 10 }, (_, i) => item(`s${i}`, 'shoes')),
  ];
  expect(medianMs(big, mild)).toBeLessThan(50);
});

test('formal tops, red/green clash and 5 jackets in the cold, under 50 ms', () => {
  const big = [
    ...Array.from({ length: 50 }, (_, i) => item(`t${i}`, 'top', { colorFamily: 'red', formality: 'formal', warmth: 3 })),
    ...Array.from({ length: 30 }, (_, i) => item(`b${i}`, 'bottom', { colorFamily: 'green', warmth: 3 })),
    ...Array.from({ length: 10 }, (_, i) => item(`s${i}`, 'shoes', { warmth: 3 })),
    ...Array.from({ length: 5 }, (_, i) => item(`o${i}`, 'outerwear', { warmth: 3 })),
  ];
  expect(medianMs(big, cold)).toBeLessThan(50);
});
