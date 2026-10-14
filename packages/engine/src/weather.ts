import type { Warmth, Weather } from './types.ts';

export const FALLBACK_WEATHER: Readonly<Weather> = Object.freeze({ feelsLikeC: 18, rain: false, assumed: true });

export function usableWeather(w: Weather): Weather {
  return Number.isFinite(w.feelsLikeC) ? w : FALLBACK_WEATHER;
}

export function targetWarmth(feelsLikeC: number): Warmth {
  if (feelsLikeC >= 22) return 1;
  if (feelsLikeC >= 12) return 2;
  return 3;
}

export function outerwearRule(w: Weather): 'required' | 'none' | 'excluded' {
  if (w.feelsLikeC > 22) return 'excluded';
  if (w.feelsLikeC < 15 || w.rain) return 'required';
  return 'none';
}

export function shownTemperature(weather: Weather): number | null {
  const w = usableWeather(weather);
  if (w.assumed) return null;
  const rule = outerwearRule(w);
  if (rule === 'required') return Math.floor(w.feelsLikeC);
  if (rule === 'excluded') return Math.ceil(w.feelsLikeC);
  return Math.round(w.feelsLikeC);
}
