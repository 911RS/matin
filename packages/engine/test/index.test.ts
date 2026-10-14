import { expect, test } from 'vitest';
import * as engine from '../src/index.ts';

test('public API exposes only the supported entry points', () => {
  expect(Object.keys(engine).sort()).toEqual(
    ['FALLBACK_WEATHER', 'hexToColorFamily', 'labelsToCategory', 'reasonFor', 'seedFromString', 'shownTemperature', 'suggest', 'swapPiece'],
  );
});
