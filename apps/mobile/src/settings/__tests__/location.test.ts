import { nominatimHeaders, nominatimUrl, parseNominatim, resolveLocation } from '../location';
import type { LocationDeps } from '../location';

function deps(granted: boolean, overrides: Partial<LocationDeps> = {}): LocationDeps {
  return {
    requestPermission: jest.fn().mockResolvedValue(granted),
    getCurrentPosition: jest.fn().mockResolvedValue({ lat: 48.856613, lon: 2.352222 }),
    geocode: jest.fn().mockResolvedValue({ lat: 36.806495, lon: 10.181532 }),
    ...overrides,
  };
}

describe('resolveLocation', () => {
  it('uses rounded GPS coordinates when permission is granted', async () => {
    const d = deps(true);
    await expect(resolveLocation(d, 'Tunis')).resolves.toEqual({ lat: 48.86, lon: 2.35 });
    expect(d.geocode).not.toHaveBeenCalled();
  });

  it('geocodes the city when permission is denied', async () => {
    const d = deps(false);
    await expect(resolveLocation(d, '  Tunis ')).resolves.toEqual({ lat: 36.81, lon: 10.18 });
    expect(d.getCurrentPosition).not.toHaveBeenCalled();
    expect(d.geocode).toHaveBeenCalledWith('Tunis');
  });

  it('returns null when permission is denied and there is no city', async () => {
    const d = deps(false);
    await expect(resolveLocation(d)).resolves.toBeNull();
    await expect(resolveLocation(d, '   ')).resolves.toBeNull();
    expect(d.geocode).not.toHaveBeenCalled();
  });

  it('returns null when the city is not found', async () => {
    const d = deps(false, { geocode: jest.fn().mockResolvedValue(null) });
    await expect(resolveLocation(d, 'Nowhere')).resolves.toBeNull();
  });
});

describe('Nominatim city search', () => {
  it('builds an encoded search URL', () => {
    expect(nominatimUrl('Saint-Étienne')).toBe(
      'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=Saint-%C3%89tienne',
    );
  });

  it('identifies the app and asks for the app language', () => {
    expect(nominatimHeaders('fr')).toEqual({
      'User-Agent': 'Matin/0.1 (https://github.com/911RS/tenue)',
      'Accept-Language': 'fr',
    });
  });

  it('reads the first result, whose coordinates are strings', () => {
    expect(parseNominatim([{ lat: '48.8534951', lon: '2.3483915', display_name: 'Paris' }])).toEqual({
      lat: 48.8534951,
      lon: 2.3483915,
    });
  });

  it('returns null when nothing matches', () => {
    expect(parseNominatim([])).toBeNull();
    expect(parseNominatim({})).toBeNull();
    expect(parseNominatim(null)).toBeNull();
    expect(parseNominatim([{ lat: 'x', lon: '2' }])).toBeNull();
  });
});
