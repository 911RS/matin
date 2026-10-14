import { expect, test } from 'vitest';
import { item, input } from './fixtures.ts';
import { suggest } from '../src/suggest.ts';
import { FALLBACK_WEATHER } from '../src/weather.ts';

test('same input gives same outfit', () => expect(suggest(input)).toEqual(suggest(input)));

test('cold rain includes the jacket', () => {
  const r = suggest(input);
  if (!('itemIds' in r)) throw new Error('expected outfit');
  expect(r.itemIds).toContain('o1');
});

test('red + green never picked when better options exist', () => {
  for (let s = 0; s < 50; s++) {
    const r = suggest({ ...input, seed: s });
    if (!('itemIds' in r)) throw new Error('expected outfit');
    expect(r.itemIds.includes('t2') && r.itemIds.includes('b2')).toBe(false);
  }
});

test('item worn yesterday is avoided', () => {
  const r = suggest({ ...input, recentOutfits: [{ date: '2026-10-11', itemIds: ['t1', 't3'] }] });
  if (!('itemIds' in r)) throw new Error('expected outfit');
  expect(r.itemIds[0]).toBe('t2');
});

test('tiny closet, cold rain gives outfit with noJacket reason', () => {
  const tiny = [item('t1', 'top'), item('t2', 'top'), item('b1', 'bottom'), item('b2', 'bottom'), item('s1', 'shoes')];
  const r = suggest({ ...input, items: tiny });
  expect('itemIds' in r && r.reason.startsWith('No jacket in your closet')).toBe(true);
});

test('missing', () => expect(suggest({ ...input, items: [item('t1', 'top')] })).toEqual({ missing: ['bottom', 'shoes'] }));

test('shuffle (seed+1) can change the pick', () => {
  const picks = new Set(Array.from({ length: 20 }, (_, s) => JSON.stringify((suggest({ ...input, seed: s }) as { itemIds: string[] }).itemIds)));
  expect(picks.size).toBeGreaterThan(1);
});

test.each([NaN, Infinity, -Infinity])('non-finite feelsLikeC %d falls back to assumed weather', (feelsLikeC) => {
  const r = suggest({ ...input, weather: { feelsLikeC, rain: true } });
  const fallback = suggest({ ...input, weather: FALLBACK_WEATHER });
  expect(r).toEqual(fallback);
  if (!('itemIds' in r)) throw new Error('expected outfit');
  expect(r.reason.startsWith('Weather unavailable: no layer needed')).toBe(true);
  expect(r.itemIds).not.toContain('o1');
});

test('invalid date throws', () => {
  expect(() => suggest({ ...input, date: '12/10/2026' })).toThrow('Invalid date');
  expect(() => suggest({ ...input, items: [], date: '2026-02-30' })).toThrow('Invalid date');
});

test('worn timestamp dates still avoid repeats', () => {
  const r = suggest({ ...input, recentOutfits: [{ date: '2026-10-11T07:00:00Z', itemIds: ['t1', 't3'] }] });
  if (!('itemIds' in r)) throw new Error('expected outfit');
  expect(r.itemIds[0]).toBe('t2');
});
