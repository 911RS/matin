import { expect, test } from 'vitest';
import { colorKind, colorPenalty } from '../src/color.ts';

test('neutrals only', () => expect(colorPenalty(['black', 'white', 'denim'])).toBe(0));
test('one accent', () => expect(colorPenalty(['red', 'navy', 'white'])).toBe(0));
test('known pair either order', () => {
  expect(colorPenalty(['yellow', 'blue', 'white'])).toBe(2);
  expect(colorPenalty(['blue', 'yellow'])).toBe(2);
});
test('same accent twice', () => expect(colorPenalty(['green', 'green'])).toBe(2));
test('clash', () => expect(colorPenalty(['red', 'green', 'black'])).toBe(8));
test('multi counts as accent', () => expect(colorPenalty(['multi', 'red'])).toBe(8));
test('three accents', () => expect(colorPenalty(['red', 'green', 'purple'])).toBe(16));
test('colorKind', () => {
  expect(colorKind(['black', 'white'])).toEqual({ kind: 'neutral' });
  expect(colorKind(['red', 'white'])).toEqual({ kind: 'accent', color: 'red' });
  expect(colorKind(['blue', 'yellow'])).toEqual({ kind: 'pair', a: 'blue', b: 'yellow' });
  expect(colorKind(['red', 'green'])).toEqual({ kind: 'clash' });
  expect(colorKind(['green', 'green'])).toEqual({ kind: 'accent', color: 'green' });
  expect(colorKind(['red', 'green', 'purple'])).toEqual({ kind: 'clash' });
});
test('two multi pieces clash', () => {
  expect(colorPenalty(['multi', 'multi'])).toBe(8);
  expect(colorPenalty(['multi', 'multi', 'white'])).toBe(8);
  expect(colorKind(['multi', 'multi'])).toEqual({ kind: 'clash' });
  expect(colorKind(['multi', 'navy'])).toEqual({ kind: 'accent', color: 'multi' });
});
