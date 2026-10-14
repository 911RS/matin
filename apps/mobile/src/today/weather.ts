import { Platform } from 'react-native';
import { FALLBACK_WEATHER, type Weather } from '@tenue/engine';
import { dayWeather, fetchWeather, type ProfileRow } from '@tenue/backend';

export async function loadWeather(fetchFn: typeof fetch, profile: ProfileRow, date: string): Promise<Weather> {
  if (profile.lat === null || profile.lon === null) return FALLBACK_WEATHER;
  const json = await fetchWeather(fetchFn, profile.lat, profile.lon, { userAgent: Platform.OS !== 'web' });
  if (json === null) return FALLBACK_WEATHER;
  return dayWeather(json, date, profile.timezone) ?? FALLBACK_WEATHER;
}
