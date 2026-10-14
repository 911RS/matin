import { expect, test } from 'vitest';
import { item } from './fixtures.ts';
import { buildReason } from '../src/reason.ts';
import { shownTemperature } from '../src/weather.ts';

test('reason EN/FR', () => {
  const outfit = [item('t', 'top', { colorFamily: 'white' }), item('b', 'bottom', { colorFamily: 'navy' }), item('s', 'shoes'), item('o', 'outerwear')];
  expect(buildReason(outfit, { feelsLikeC: 13.6, rain: true }, false, 'en')).toBe('Rain expected: jacket on · neutrals always work');
  expect(buildReason(outfit, { feelsLikeC: 8.2, rain: false }, false, 'fr')).toBe('8°C\u00a0: couche chaude · les neutres vont avec tout');
  expect(buildReason(outfit.slice(0, 3), { feelsLikeC: 8, rain: true }, true, 'en')).toBe('No jacket in your closet · neutrals always work');
  expect(buildReason([item('t', 'top', { colorFamily: 'red' }), item('b', 'bottom')], { feelsLikeC: 18, rain: false, assumed: true }, false, 'fr'))
    .toBe('Météo indisponible\u00a0: pas besoin de veste · rouge avec des neutres');
});

test('assumed weather gives one weather line without a temperature', () => {
  const outfit = [item('t', 'top', { colorFamily: 'white' }), item('b', 'bottom'), item('s', 'shoes')];
  const assumed = (feelsLikeC: number, rain = false) => ({ feelsLikeC, rain, assumed: true });
  expect(buildReason(outfit, assumed(18), false, 'en')).toBe('Weather unavailable: no layer needed · neutrals always work');
  expect(buildReason(outfit, assumed(8), false, 'en')).toBe('Weather unavailable: warm layer · neutrals always work');
  expect(buildReason(outfit, assumed(30), false, 'en')).toBe('Weather unavailable: keep it light · neutrals always work');
  expect(buildReason(outfit, assumed(18, true), false, 'en')).toBe('Weather unavailable: jacket on · neutrals always work');
  expect(buildReason(outfit, assumed(8), false, 'fr')).toBe('Météo indisponible\u00a0: couche chaude · les neutres vont avec tout');
  expect(buildReason(outfit, assumed(30), false, 'fr')).toBe('Météo indisponible\u00a0: reste léger · les neutres vont avec tout');
  expect(buildReason(outfit, assumed(18, true), false, 'fr')).toBe('Météo indisponible\u00a0: veste conseillée · les neutres vont avec tout');
});

test('shown temperature agrees with the outerwear rule', () => {
  const outfit = [item('t', 'top', { colorFamily: 'white' }), item('b', 'bottom'), item('s', 'shoes')];
  expect(buildReason(outfit, { feelsLikeC: 14.6, rain: false }, false, 'en')).toBe('14°C: warm layer · neutrals always work');
  expect(buildReason(outfit, { feelsLikeC: 14.6, rain: false }, false, 'fr')).toBe('14°C\u00a0: couche chaude · les neutres vont avec tout');
  expect(buildReason(outfit, { feelsLikeC: 22.4, rain: false }, false, 'en')).toBe('23°C: keep it light · neutrals always work');
  expect(buildReason(outfit, { feelsLikeC: 22.4, rain: false }, false, 'fr')).toBe('23°C\u00a0: reste léger · les neutres vont avec tout');
});

test('pair, clash and excluded branches EN/FR', () => {
  const pair = [item('t', 'top', { colorFamily: 'blue' }), item('b', 'bottom', { colorFamily: 'yellow' }), item('s', 'shoes')];
  expect(buildReason(pair, { feelsLikeC: 18, rain: false }, false, 'en')).toBe('18°C, no layer needed · blue + yellow match');
  expect(buildReason(pair, { feelsLikeC: 18, rain: false }, false, 'fr')).toBe('18°C, pas besoin de veste · bleu + jaune vont bien ensemble');
  const clash = [item('t', 'top', { colorFamily: 'red' }), item('b', 'bottom', { colorFamily: 'green' }), item('s', 'shoes')];
  expect(buildReason(clash, { feelsLikeC: 18, rain: false }, false, 'en')).toBe('18°C, no layer needed');
  expect(buildReason(clash, { feelsLikeC: 18, rain: false }, false, 'fr')).toBe('18°C, pas besoin de veste');
  const multi = [item('t', 'top', { colorFamily: 'multi' }), item('b', 'bottom', { colorFamily: 'multi' }), item('s', 'shoes')];
  expect(buildReason(multi, { feelsLikeC: 18, rain: false }, false, 'en')).toBe('18°C, no layer needed');
  expect(buildReason(clash, { feelsLikeC: 30, rain: true }, false, 'en')).toBe('30°C: keep it light');
  expect(buildReason(clash, { feelsLikeC: 30, rain: true }, false, 'fr')).toBe('30°C\u00a0: reste léger');
});

test('the reason shows the same temperature as shownTemperature', () => {
  const outfit = [item('t', 'top', { colorFamily: 'white' }), item('b', 'bottom'), item('s', 'shoes')];
  for (const feelsLikeC of [-3.5, 8.5, 14.5, 14.6, 15.5, 21.5, 22.4, 29.5]) {
    const w = { feelsLikeC, rain: false };
    expect(buildReason(outfit, w, false, 'en').startsWith(`${shownTemperature(w)}°C`)).toBe(true);
  }
});

test('French reasons put a no-break space before colons', () => {
  const outfit = [item('t', 'top', { colorFamily: 'white' }), item('b', 'bottom'), item('s', 'shoes')];
  const cases = [
    buildReason(outfit, { feelsLikeC: 8, rain: false }, false, 'fr'),
    buildReason(outfit, { feelsLikeC: 30, rain: false }, false, 'fr'),
    buildReason(outfit, { feelsLikeC: 13, rain: true }, false, 'fr'),
    buildReason(outfit, { feelsLikeC: 18, rain: false, assumed: true }, false, 'fr'),
  ];
  for (const text of cases) {
    expect(text).toContain('\u00a0:');
    expect(text).not.toMatch(/ :/);
  }
});
