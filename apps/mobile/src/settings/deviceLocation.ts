import * as Location from 'expo-location';
import { currentLanguage } from './language';
import { nominatimHeaders, nominatimUrl, parseNominatim } from './location';
import type { Coords, LocationDeps } from './location';

const GEOCODE_TIMEOUT_MS = 8000;

export async function locationPermission(): Promise<{ granted: boolean; canAskAgain: boolean }> {
  const { granted, canAskAgain } = await Location.requestForegroundPermissionsAsync();
  return { granted, canAskAgain };
}

async function currentPosition(): Promise<Coords> {
  const last = await Location.getLastKnownPositionAsync({ maxAge: 30 * 60 * 1000 }).catch(() => null);
  const position = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  return { lat: position.coords.latitude, lon: position.coords.longitude };
}

async function nativeGeocode(city: string): Promise<Coords | null> {
  const { granted } = await Location.getForegroundPermissionsAsync();
  if (!granted) return null;
  const [first] = await Location.geocodeAsync(city).catch(() => []);
  return first ? { lat: first.latitude, lon: first.longitude } : null;
}

async function nominatim(city: string): Promise<Coords | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);
  try {
    const res = await fetch(nominatimUrl(city), {
      headers: nominatimHeaders(currentLanguage()),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`geocode ${res.status}`);
    return parseNominatim(await res.json());
  } finally {
    clearTimeout(timer);
  }
}

async function geocode(city: string): Promise<Coords | null> {
  return (await nativeGeocode(city).catch(() => null)) ?? nominatim(city);
}

export const gpsDeps: LocationDeps = {
  requestPermission: async () => (await locationPermission()).granted,
  getCurrentPosition: currentPosition,
  geocode,
};

export const cityDeps: LocationDeps = {
  requestPermission: async () => false,
  getCurrentPosition: currentPosition,
  geocode,
};

export async function placeName({ lat, lon }: Coords): Promise<string | null> {
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
    return place?.city ?? place?.subregion ?? place?.region ?? null;
  } catch {
    return null;
  }
}
