import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { apparentTemperature, dayWeather, fetchWeather, roundCoord } from '../src/weather.ts';

interface Fixture { properties: { timeseries: { time: string }[] } }

const load = (): Fixture =>
  JSON.parse(readFileSync(new URL('./fixtures/metno-paris.json', import.meta.url), 'utf8'));

test('apparentTemperature matches the Steadman formula', () => {
  expect(apparentTemperature(20, 50, 0)).toBeCloseTo(19.8, 1);
  expect(apparentTemperature(5, 80, 8)).toBeCloseTo(-2.3, 1);
  expect(apparentTemperature(30, 40, 2)).toBeCloseTo(30.2, 1);
});

test('dayWeather uses the local 08:00-20:00 window and detects rain', () => {
  expect(dayWeather(load(), '2026-10-12', 'Europe/Paris')).toEqual({ feelsLikeC: 6.7, rain: true, condition: 'cloudy' });
});

test('dayWeather reports no rain when the rain entry is removed', () => {
  const fixture = load();
  fixture.properties.timeseries = fixture.properties.timeseries.filter((e) => e.time !== '2026-10-12T15:00:00Z');
  expect(dayWeather(fixture, '2026-10-12', 'Europe/Paris')?.rain).toBe(false);
});

test('dayWeather detects rain from a symbol code', () => {
  const json = {
    properties: {
      timeseries: [
        {
          time: '2026-10-12T10:00:00Z',
          data: {
            instant: { details: { air_temperature: 12 } },
            next_6_hours: { summary: { symbol_code: 'heavyshowers_day' } },
          },
        },
      ],
    },
  };
  expect(dayWeather(json, '2026-10-12', 'UTC')).toEqual({ feelsLikeC: 12, rain: true, condition: 'heavyshowers' });
});

test('dayWeather condition is the symbol closest to local noon without its suffix', () => {
  const at = (time: string, next: Record<string, unknown>) => ({
    time,
    data: { instant: { details: { air_temperature: 10 } }, ...next },
  });
  const sym = (symbol_code: string) => ({ summary: { symbol_code } });
  const json = {
    properties: {
      timeseries: [
        at('2026-10-12T07:00:00Z', { next_1_hours: sym('fog') }),
        at('2026-10-12T09:00:00Z', { next_1_hours: sym('partlycloudy_day') }),
        at('2026-10-12T10:00:00Z', { next_1_hours: sym('clearsky_polartwilight'), next_6_hours: sym('rain') }),
        at('2026-10-12T12:00:00Z', { next_6_hours: sym('snow_night') }),
        at('2026-10-12T13:00:00Z', { next_1_hours: {} }),
      ],
    },
  };
  expect(dayWeather(json, '2026-10-12', 'Europe/Paris')?.condition).toBe('clearsky');
  json.properties.timeseries.splice(2, 1);
  expect(dayWeather(json, '2026-10-12', 'Europe/Paris')?.condition).toBe('partlycloudy');
  json.properties.timeseries.splice(1, 1);
  expect(dayWeather(json, '2026-10-12', 'Europe/Paris')?.condition).toBe('snow');
});

test('dayWeather skips entries without air temperature', () => {
  const json = {
    properties: {
      timeseries: [
        { time: '2026-10-12T10:00:00Z', data: { instant: { details: {} } } },
        { time: '2026-10-12T11:00:00Z', data: { instant: { details: { air_temperature: 9 } } } },
      ],
    },
  };
  expect(dayWeather(json, '2026-10-12', 'UTC')).toEqual({ feelsLikeC: 9, rain: false });
});

test('dayWeather returns null for malformed input or an empty window', () => {
  expect(dayWeather({}, '2026-10-12', 'Europe/Paris')).toBeNull();
  expect(dayWeather(null, '2026-10-12', 'Europe/Paris')).toBeNull();
  expect(dayWeather(load(), '2026-11-01', 'Europe/Paris')).toBeNull();
  expect(dayWeather(load(), '2026-10-12', 'Not/AZone')).toBeNull();
});

test('dayWeather window edges follow the local time zone', () => {
  const at = (time: string, air_temperature: number) => ({ time, data: { instant: { details: { air_temperature } } } });
  const json = {
    properties: {
      timeseries: [
        at('2026-10-12T14:00:00Z', 0),
        at('2026-10-12T15:00:00Z', 12),
        at('2026-10-13T03:00:00Z', 11),
        at('2026-10-13T04:00:00Z', -5),
      ],
    },
  };
  expect(dayWeather(json, '2026-10-12', 'America/Los_Angeles')).toEqual({ feelsLikeC: 11, rain: false });
});

test('dayWeather returns null for hostile JSON without throwing', () => {
  const ok = { data: { instant: { details: { air_temperature: 9 } } } };
  const cases: unknown[] = [
    { properties: { timeseries: {} } },
    { properties: { timeseries: [null, undefined] } },
    { properties: { timeseries: [42] } },
    { properties: { timeseries: [{ ...ok, time: 5 }] } },
    { properties: { timeseries: [{ time: '2026-10-12T10:00:00Z', data: { instant: { details: { air_temperature: '9' } } } }] } },
    { properties: { timeseries: [{ time: '2026-10-12T10:00:00Z', data: { instant: { details: null } } }] } },
  ];
  for (const json of cases) expect(dayWeather(json, '2026-10-12', 'UTC')).toBeNull();
});

test('roundCoord rounds to 2 decimals', () => {
  expect(roundCoord(48.8566)).toBe(48.86);
  expect(roundCoord(2.3522)).toBe(2.35);
});

test('fetchWeather requests the MET Norway URL with a User-Agent', async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fakeFetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ ok: 1 }), { status: 200 });
  }) as unknown as typeof fetch;
  expect(await fetchWeather(fakeFetch, 48.8566, 2.3522)).toEqual({ ok: 1 });
  expect(calls[0].url).toBe('https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=48.86&lon=2.35');
  expect(calls[0].init?.headers).toEqual({ 'User-Agent': 'Matin/0.1 https://github.com/911RS/tenue' });
  expect(calls[0].init?.signal).toBeInstanceOf(AbortSignal);
});

test('fetchWeather can leave out the User-Agent for browsers', async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fakeFetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ ok: 1 }), { status: 200 });
  }) as unknown as typeof fetch;
  expect(await fetchWeather(fakeFetch, 48.8566, 2.3522, { userAgent: false })).toEqual({ ok: 1 });
  expect(calls[0].init?.headers).toBeUndefined();
  expect(calls[0].init?.signal).toBeInstanceOf(AbortSignal);
});

test('fetchWeather returns null on non-2xx and on network error', async () => {
  const serverError = (async () => new Response('x', { status: 500 })) as unknown as typeof fetch;
  const broken = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
  expect(await fetchWeather(serverError, 1, 2)).toBeNull();
  expect(await fetchWeather(broken, 1, 2)).toBeNull();
});
