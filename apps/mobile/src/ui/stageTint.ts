import type { ColorFamily, Weather } from '@tenue/engine';
import { familyTint, weatherTint } from '../theme';

export const NEUTRAL_FAMILIES: ReadonlySet<ColorFamily> = new Set<ColorFamily>([
  'black',
  'white',
  'grey',
  'navy',
  'beige',
  'brown',
  'denim',
]);

export function stageTint(families: ColorFamily[], weather: Weather): string {
  const colored = families.find((family) => !NEUTRAL_FAMILIES.has(family));
  if (colored) return familyTint[colored];
  if (weather.rain) return weatherTint.rain;
  if (weather.feelsLikeC < 12) return weatherTint.cold;
  if (weather.feelsLikeC >= 22) return weatherTint.warm;
  return weatherTint.mild;
}
