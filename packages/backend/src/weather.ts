import type { Weather } from '../../engine/src/index.ts';
import { timeoutSignal } from './signal.ts';

const USER_AGENT = 'Matin/0.1 https://github.com/911RS/tenue';
const WINDOW_START_HOUR = 8;
const WINDOW_END_HOUR = 20;
const RAIN_MM = 0.3;
const TIMEOUT_MS = 8_000;
const RAIN_SYMBOLS = ['rain', 'sleet', 'showers'];
const NOON_HOUR = 12;
const SYMBOL_SUFFIX = /_(day|night|polartwilight)$/;

export function roundCoord(x: number): number {
  return Math.round(x * 100) / 100;
}

export function apparentTemperature(airC: number, rhPercent: number, windMs: number): number {
  const e = (rhPercent / 100) * 6.105 * Math.exp((17.27 * airC) / (237.7 + airC));
  return Math.round((airC + 0.33 * e - 0.7 * windMs - 4) * 10) / 10;
}

type Obj = Record<string, unknown>;

const asObj = (v: unknown): Obj | null => (typeof v === 'object' && v !== null ? (v as Obj) : null);
const asNum = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function localDateHour(time: string, timeZone: string): { date: string; hour: number } | null {
  const ms = Date.parse(time);
  if (Number.isNaN(ms)) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
  }).formatToParts(ms);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
}

function symbolCode(data: Obj): string | null {
  for (const key of ['next_1_hours', 'next_6_hours']) {
    const symbol = asObj(asObj(data[key])?.summary)?.symbol_code;
    if (typeof symbol === 'string' && symbol !== '') return symbol.replace(SYMBOL_SUFFIX, '');
  }
  return null;
}

function isRainy(data: Obj): boolean {
  const next1 = asObj(data.next_1_hours);
  const precip = asNum(asObj(next1?.details)?.precipitation_amount);
  if (precip !== null && precip >= RAIN_MM) return true;
  const summary = asObj((next1 ?? asObj(data.next_6_hours))?.summary);
  const symbol = summary?.symbol_code;
  return typeof symbol === 'string' && RAIN_SYMBOLS.some((s) => symbol.includes(s));
}

export function dayWeather(json: unknown, date: string, timeZone: string): Weather | null {
  try {
    const series = asObj(asObj(json)?.properties)?.timeseries;
    if (!Array.isArray(series)) return null;
    let feelsLikeC: number | null = null;
    let rain = false;
    let condition: string | null = null;
    let conditionDistance = Infinity;
    for (const raw of series) {
      const entry = asObj(raw);
      const data = asObj(entry?.data);
      if (!entry || !data || typeof entry.time !== 'string') continue;
      const local = localDateHour(entry.time, timeZone);
      if (!local || local.date !== date || local.hour < WINDOW_START_HOUR || local.hour > WINDOW_END_HOUR) continue;
      const symbol = symbolCode(data);
      const distance = Math.abs(local.hour - NOON_HOUR);
      if (symbol !== null && distance < conditionDistance) {
        condition = symbol;
        conditionDistance = distance;
      }
      const details = asObj(asObj(data.instant)?.details);
      const air = asNum(details?.air_temperature);
      if (air === null) continue;
      const rh = asNum(details?.relative_humidity);
      const wind = asNum(details?.wind_speed);
      const apparent = rh === null || wind === null ? air : apparentTemperature(air, rh, wind);
      if (!Number.isFinite(apparent)) continue;
      feelsLikeC = feelsLikeC === null ? apparent : Math.min(feelsLikeC, apparent);
      if (isRainy(data)) rain = true;
    }
    if (feelsLikeC === null) return null;
    return condition === null ? { feelsLikeC, rain } : { feelsLikeC, rain, condition };
  } catch {
    return null;
  }
}

export interface FetchWeatherOptions {
  userAgent?: boolean;
}

export async function fetchWeather(
  fetchFn: typeof fetch,
  lat: number,
  lon: number,
  options: FetchWeatherOptions = {},
): Promise<unknown | null> {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${roundCoord(lat)}&lon=${roundCoord(lon)}`;
  const init: RequestInit = { signal: timeoutSignal(TIMEOUT_MS) };
  if (options.userAgent !== false) init.headers = { 'User-Agent': USER_AGENT };
  try {
    const res = await fetchFn(url, init);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
