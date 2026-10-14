import { expect, test } from 'vitest';
import { repeatPenalty } from '../src/repeat.ts';

const recent = [
  { date: '2026-10-11', itemIds: ['a'] },
  { date: '2026-10-07', itemIds: ['b'] },
  { date: '2026-10-01', itemIds: ['c'] },
  { date: '2026-10-12', itemIds: ['d'] },
  { date: '2026-10-05', itemIds: ['a'] },
  { date: '2026-10-13', itemIds: ['e'] },
];

test('repeat', () => {
  expect(repeatPenalty(['a'], recent, '2026-10-12')).toBe(10);
  expect(repeatPenalty(['b'], recent, '2026-10-12')).toBe(3);
  expect(repeatPenalty(['c'], recent, '2026-10-12')).toBe(0);
  expect(repeatPenalty(['d'], recent, '2026-10-12')).toBe(0);
  expect(repeatPenalty(['e'], recent, '2026-10-12')).toBe(0);
  expect(repeatPenalty(['a', 'b', 'z'], recent, '2026-10-12')).toBe(13);
  expect(repeatPenalty(['b'], [{ date: '2026-03-27', itemIds: ['b'] }], '2026-03-30')).toBe(10);
});

test('timestamp wear dates still count', () => {
  expect(repeatPenalty(['a'], [{ date: '2026-10-11T07:00:00Z', itemIds: ['a'] }], '2026-10-12')).toBe(10);
  expect(repeatPenalty(['a'], [{ date: '2026-10-07T23:30:00+02:00', itemIds: ['a'] }], '2026-10-12')).toBe(3);
});

test('invalid input date throws', () => {
  for (const date of ['', '12/10/2026', '2026-1-12', '2026-13-01', '2026-02-30', 'nonsense']) {
    expect(() => repeatPenalty(['a'], [], date)).toThrow('Invalid date');
  }
});

test('malformed wear entries are skipped, others still count', () => {
  const wears = [
    { date: 'yesterday', itemIds: ['a'] },
    { date: '2026-10-32', itemIds: ['a'] },
    { date: '2026-10-09', itemIds: ['a'] },
  ];
  expect(repeatPenalty(['a'], wears, '2026-10-12')).toBe(10);
});

test.each([[1, 10], [3, 10], [4, 3], [7, 3], [8, 0]])('worn %i days ago costs %i', (ago, penalty) => {
  const date = new Date(Date.UTC(2026, 9, 12 - ago)).toISOString().slice(0, 10);
  expect(repeatPenalty(['a'], [{ date, itemIds: ['a'] }], '2026-10-12')).toBe(penalty);
});
