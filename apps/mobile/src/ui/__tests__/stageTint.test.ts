import type { ColorFamily, Weather } from '@tenue/engine';
import { familyTint, weatherTint } from '../../theme';
import { NEUTRAL_FAMILIES, stageTint } from '../stageTint';

const mild: Weather = { feelsLikeC: 16, rain: false };

describe('stageTint', () => {
  it('uses the first non-neutral family in outfit order', () => {
    expect(stageTint(['navy', 'green', 'red', 'black'], mild)).toBe(familyTint.green);
  });

  it('treats blue and multi as colors', () => {
    expect(stageTint(['white', 'blue'], mild)).toBe(familyTint.blue);
    expect(stageTint(['multi', 'red'], mild)).toBe(familyTint.multi);
  });

  it('ignores every neutral family', () => {
    const all: ColorFamily[] = ['black', 'white', 'grey', 'navy', 'beige', 'brown', 'denim'];
    expect([...NEUTRAL_FAMILIES].sort()).toEqual([...all].sort());
    expect(stageTint(all, mild)).toBe(weatherTint.mild);
  });

  it('uses the rain tint when it rains, whatever the temperature', () => {
    expect(stageTint(['black'], { feelsLikeC: 30, rain: true })).toBe(weatherTint.rain);
    expect(stageTint([], { feelsLikeC: 2, rain: true })).toBe(weatherTint.rain);
  });

  it('uses the cold tint below 12°C', () => {
    expect(stageTint(['grey'], { feelsLikeC: 11.9, rain: false })).toBe(weatherTint.cold);
    expect(stageTint(['grey'], { feelsLikeC: 12, rain: false })).toBe(weatherTint.mild);
  });

  it('uses the warm tint from 22°C', () => {
    expect(stageTint(['beige'], { feelsLikeC: 22, rain: false })).toBe(weatherTint.warm);
    expect(stageTint(['beige'], { feelsLikeC: 21.9, rain: false })).toBe(weatherTint.mild);
  });

  it('lets a colored piece win over the weather', () => {
    expect(stageTint(['black', 'yellow'], { feelsLikeC: 5, rain: true })).toBe(familyTint.yellow);
  });
});
