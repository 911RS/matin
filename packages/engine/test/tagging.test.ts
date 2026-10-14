import { test, expect } from 'vitest';
import { hexToColorFamily, labelsToCategory } from '../src/tagging.ts';

test.each([
  ['#000000', 'black'],
  ['#FFFFFF', 'white'],
  ['808080', 'grey'],
  ['#1b2a4a', 'navy'],
  ['#2f6fe0', 'blue'],
  ['#d9c4a0', 'beige'],
  ['#704020', 'brown'],
  ['#2e8b3a', 'green'],
  ['#d02020', 'red'],
  ['#f4a6c0', 'pink'],
  ['#f5d000', 'yellow'],
  ['#7a2f9a', 'purple'],
  ['#5a76a8', 'denim'],
])('hex %s → %s', (h, f) => expect(hexToColorFamily(h)).toBe(f));

test('invalid hex throws', () => expect(() => hexToColorFamily('#12')).toThrow('Invalid hex'));

test('labels', () => {
  expect(labelsToCategory(['Jeans', 'Denim'])).toBe('bottom');
  expect(labelsToCategory(['Textile', 'Sneakers'])).toBe('shoes');
  expect(labelsToCategory(['Dress shirt'])).toBe('top');
  expect(labelsToCategory(['Coat', 'Sweater'])).toBe('outerwear');
  expect(labelsToCategory(['Desktop'])).toBeNull();
  expect(labelsToCategory([])).toBeNull();
});
