import { expect, test } from 'vitest';
import { buildCandidates } from '../src/candidates.ts';
import { item } from './fixtures.ts';

const mild = { feelsLikeC: 18, rain: false };
const coldRain = { feelsLikeC: 8, rain: true };
const tiny = [item('t1', 'top'), item('t2', 'top'), item('b1', 'bottom'), item('b2', 'bottom'), item('s1', 'shoes')];

test('tiny closet, mild: 4 candidates, no outerwear', () => {
  const r = buildCandidates(tiny, mild);
  expect(r.missing).toEqual([]);
  expect(r.candidates).toHaveLength(4);
  expect(r.candidates[0].map((i) => i.id)).toEqual(['t1', 'b1', 's1']);
});

test('tiny closet, cold rain, no jacket: still candidates, noJacket', () => {
  const r = buildCandidates(tiny, coldRain);
  expect(r.candidates).toHaveLength(4);
  expect(r.noJacket).toBe(true);
});

test('outerwear required adds each jacket', () => {
  const r = buildCandidates([...tiny, item('o1', 'outerwear'), item('o2', 'outerwear')], coldRain);
  expect(r.candidates).toHaveLength(8);
  expect(r.noJacket).toBe(false);
  expect(r.candidates.every((c) => c[3]?.category === 'outerwear')).toBe(true);
});

test('outerwear excluded when hot', () => {
  const r = buildCandidates([...tiny, item('o1', 'outerwear', { warmth: 1 })], { feelsLikeC: 30, rain: true });
  expect(r.noJacket).toBe(false);
  expect(r.candidates.every((c) => c.length === 3)).toBe(true);
});

test('dress candidates', () => {
  const r = buildCandidates([item('d1', 'dress'), item('s1', 'shoes')], mild);
  expect(r.candidates.map((c) => c.map((i) => i.id))).toEqual([['d1', 's1']]);
});

test('dresses follow top/bottom candidates', () => {
  const r = buildCandidates([item('t1', 'top'), item('b1', 'bottom'), item('d1', 'dress'), item('s1', 'shoes')], mild);
  expect(r.candidates.map((c) => c.map((i) => i.id))).toEqual([['t1', 'b1', 's1'], ['d1', 's1']]);
});

test('missing', () => {
  expect(buildCandidates([item('t1', 'top'), item('s1', 'shoes')], mild).missing).toEqual(['bottom']);
  expect(buildCandidates([item('t1', 'top'), item('b1', 'bottom')], mild).missing).toEqual(['shoes']);
  expect(buildCandidates([], mild).missing).toEqual(['top', 'bottom', 'shoes']);
  const r = buildCandidates([item('d1', 'dress')], mild);
  expect(r.missing).toEqual(['shoes']);
  expect(r.candidates).toEqual([]);
});

test('archived items never used', () => {
  const r = buildCandidates([...tiny, item('t3', 'top', { archivedAt: '2026-10-01T00:00:00Z' })], mild);
  expect(r.candidates.flat().some((i) => i.id === 't3')).toBe(false);
});

test('warmth fallback: only light tops at -5C still gives candidates', () => {
  const closet = [item('t1', 'top', { warmth: 1 }), item('b1', 'bottom', { warmth: 3 }), item('s1', 'shoes', { warmth: 3 })];
  const r = buildCandidates(closet, { feelsLikeC: -5, rain: false });
  expect(r.missing).toEqual([]);
  expect(r.candidates).toHaveLength(1);
});

test('warmth filter applies when alternatives exist', () => {
  const closet = [item('t1', 'top', { warmth: 1 }), item('t2', 'top', { warmth: 3 }), item('b1', 'bottom'), item('s1', 'shoes')];
  const r = buildCandidates(closet, { feelsLikeC: -5, rain: false });
  expect(r.candidates.map((c) => c[0].id)).toEqual(['t2']);
});

test('duplicate item ids are kept once, first wins', () => {
  const closet = [item('t1', 'top'), item('t1', 'top', { colorFamily: 'red' }), item('b1', 'bottom'), item('s1', 'shoes'), item('s1', 'shoes')];
  const r = buildCandidates(closet, mild);
  expect(r.candidates).toHaveLength(1);
  expect(r.candidates[0]![0]!.colorFamily).toBe('black');
});
