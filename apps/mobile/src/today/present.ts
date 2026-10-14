import type { TFunction } from 'i18next';
import type { ItemRow, OutfitRow } from '@tenue/backend';
import { toEngineItem } from '@tenue/backend';
import { FALLBACK_WEATHER, reasonFor } from '@tenue/engine';
import type { Category, Weather } from '@tenue/engine';

export type ConditionKey = 'clear' | 'partlyCloudy' | 'cloudy' | 'fog' | 'rain' | 'showers' | 'sleet' | 'snow' | 'thunder';

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function splitReason(reason: string): string[] {
  return reason
    .split(' · ')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map(capitalize);
}

export function outfitReason(
  outfit: { items: ItemRow[]; row: Pick<OutfitRow, 'item_ids' | 'weather'> & Partial<Pick<OutfitRow, 'date'>> },
  language: string,
): string {
  const locale = language.toLowerCase().startsWith('fr') ? 'fr' : 'en';
  const { item_ids, weather, date } = outfit.row;
  return reasonFor(outfit.items.map(toEngineItem), item_ids, weather ?? FALLBACK_WEATHER, locale, date);
}

export function joinList(parts: string[], conjunction: string): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} ${conjunction} ${parts[parts.length - 1]}`;
}

export function missingSentence(missing: Category[], t: TFunction): string {
  const list = joinList(
    missing.map((category) => t(`missing.inline.${category}`)),
    t('today.and'),
  );
  return t('today.missingSentence', { list });
}

function localDay(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

export function dayHeader(date: string, locale: string): { day: string; month: string } {
  const value = localDay(date);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(value);
  const month = new Intl.DateTimeFormat(locale, { month: 'long' }).format(value);
  return { day: `${capitalize(weekday)} ${value.getDate()}`, month: capitalize(month) };
}

export function longDay(date: string, locale: string): string {
  const value = localDay(date);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(value);
  const month = new Intl.DateTimeFormat(locale, { month: 'long' }).format(value);
  return locale.startsWith('fr')
    ? `${capitalize(weekday)} ${value.getDate()} ${month}`
    : `${capitalize(weekday)}, ${capitalize(month)} ${value.getDate()}`;
}

export function inSentence(day: string, locale: string): string {
  return locale.startsWith('fr') ? day.charAt(0).toLowerCase() + day.slice(1) : day;
}

const CONDITIONS: [RegExp, ConditionKey][] = [
  [/thunder/, 'thunder'],
  [/sleet/, 'sleet'],
  [/snow/, 'snow'],
  [/rain/, 'rain'],
  [/fog/, 'fog'],
  [/^cloudy/, 'cloudy'],
  [/^(partlycloudy|fair)/, 'partlyCloudy'],
  [/^clearsky/, 'clear'],
];

const WET: ConditionKey[] = ['thunder', 'sleet', 'snow', 'rain'];

export function conditionKey(weather: Weather): ConditionKey | null {
  if (weather.assumed) return null;
  const code = weather.condition ?? '';
  const found = CONDITIONS.find(([pattern]) => pattern.test(code))?.[1] ?? null;
  if (weather.rain && (found === null || !WET.includes(found))) return 'showers';
  return found;
}
