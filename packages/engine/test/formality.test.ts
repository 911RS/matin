import { expect, test } from 'vitest';
import { formalityPenalty } from '../src/formality.ts';

test('formality', () => {
  expect(formalityPenalty([])).toBe(0);
  expect(formalityPenalty(['formal'])).toBe(0);
  expect(formalityPenalty(['smart', 'smart', 'smart'])).toBe(0);
  expect(formalityPenalty(['casual', 'smart'])).toBe(2);
  expect(formalityPenalty(['casual', 'smart', 'formal'])).toBe(8);
});
