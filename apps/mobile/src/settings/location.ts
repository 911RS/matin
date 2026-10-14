import { roundCoord } from '@tenue/backend';

export interface Coords {
  lat: number;
  lon: number;
}

export interface LocationDeps {
  requestPermission(): Promise<boolean>;
  getCurrentPosition(): Promise<Coords>;
  geocode(city: string): Promise<Coords | null>;
}

function rounded({ lat, lon }: Coords): Coords {
  return { lat: roundCoord(lat), lon: roundCoord(lon) };
}

export async function resolveLocation(deps: LocationDeps, city?: string): Promise<Coords | null> {
  if (await deps.requestPermission()) return rounded(await deps.getCurrentPosition());
  const name = city?.trim();
  if (!name) return null;
  const found = await deps.geocode(name);
  return found ? rounded(found) : null;
}

export const NOMINATIM_USER_AGENT = 'Matin/0.1 (https://github.com/911RS/tenue)';

export function nominatimUrl(city: string): string {
  return `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(city)}`;
}

export function nominatimHeaders(language: string): Record<string, string> {
  return { 'User-Agent': NOMINATIM_USER_AGENT, 'Accept-Language': language };
}

export function parseNominatim(json: unknown): Coords | null {
  if (!Array.isArray(json)) return null;
  const first = json[0] as { lat?: unknown; lon?: unknown } | undefined;
  const lat = typeof first?.lat === 'string' ? Number(first.lat) : first?.lat;
  const lon = typeof first?.lon === 'string' ? Number(first.lon) : first?.lon;
  if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}
