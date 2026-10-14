import { expect, test } from 'vitest';
import { item } from './fixtures.ts';
import { scoreCandidate } from '../src/score.ts';
import { pickIndex } from '../src/pick.ts';

test('cleaner outfit scores higher', () => {
  const base = { recentOutfits: [], weather: { feelsLikeC: 18, rain: false }, date: '2026-10-12', seed: 1, locale: 'en' as const, items: [] };
  const good = [item('t', 'top', { colorFamily: 'white' }), item('b', 'bottom', { colorFamily: 'navy' }), item('s', 'shoes')];
  const bad = [item('t', 'top', { colorFamily: 'red', formality: 'formal' }), item('b', 'bottom', { colorFamily: 'green' }), item('s', 'shoes')];
  expect(scoreCandidate(good, base)).toBe(0);
  expect(scoreCandidate(bad, base)).toBe(-16);
});

test('pickIndex ignores candidates more than 5 below the best', () => {
  expect(pickIndex([{ score: 0 }, { score: -6 }, { score: -7 }], () => 0.99)).toBe(0);
  expect(pickIndex([{ score: 0 }, { score: -1 }], () => 0.99)).toBe(1);
  expect(pickIndex([{ score: 0 }, { score: -1 }], () => 0)).toBe(0);
});
