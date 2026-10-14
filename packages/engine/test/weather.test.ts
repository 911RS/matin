import { expect, test } from 'vitest';
import { FALLBACK_WEATHER, outerwearRule, shownTemperature, targetWarmth } from '../src/weather.ts';

test.each([[30, 1], [22, 1], [21.9, 2], [12, 2], [11.9, 3], [-5, 3]])('targetWarmth(%d) = %d', (t, w) => {
  expect(targetWarmth(t)).toBe(w);
});

test.each([
  [{ feelsLikeC: 10, rain: false }, 'required'],
  [{ feelsLikeC: 14.9, rain: false }, 'required'],
  [{ feelsLikeC: 15, rain: false }, 'none'],
  [{ feelsLikeC: 18, rain: true }, 'required'],
  [{ feelsLikeC: 22, rain: true }, 'required'],
  [{ feelsLikeC: 22.1, rain: true }, 'excluded'],
  [{ feelsLikeC: 30, rain: false }, 'excluded'],
])('outerwearRule(%o) = %s', (w, r) => {
  expect(outerwearRule(w)).toBe(r);
});

test('FALLBACK_WEATHER is flagged as assumed', () => {
  expect(FALLBACK_WEATHER).toEqual({ feelsLikeC: 18, rain: false, assumed: true });
});

test('FALLBACK_WEATHER is frozen', () => {
  expect(Object.isFrozen(FALLBACK_WEATHER)).toBe(true);
});

test.each([
  [{ feelsLikeC: 14.6, rain: false }, 14],
  [{ feelsLikeC: 9.4, rain: true }, 9],
  [{ feelsLikeC: 22.4, rain: false }, 23],
  [{ feelsLikeC: 17.5, rain: false }, 18],
  [{ feelsLikeC: -0.4, rain: false }, -1],
])('shownTemperature(%o) = %d', (w, t) => {
  expect(shownTemperature(w)).toBe(t);
});

test('shownTemperature is null when the weather is assumed or unusable', () => {
  expect(shownTemperature(FALLBACK_WEATHER)).toBeNull();
  expect(shownTemperature({ feelsLikeC: 8, rain: false, assumed: true })).toBeNull();
  expect(shownTemperature({ feelsLikeC: Number.NaN, rain: false })).toBeNull();
});
