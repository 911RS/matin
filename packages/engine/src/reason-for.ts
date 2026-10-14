import type { Item, Locale, Weather } from './types.ts';
import { buildSlots } from './candidates.ts';
import { buildReason } from './reason.ts';
import { usableWeather } from './weather.ts';

export function reasonFor(items: Item[], itemIds: string[], weather: Weather, locale: Locale, date?: string): string {
  const w = usableWeather(weather);
  const byId = new Map<string, Item>();
  for (const i of items) if (!byId.has(i.id)) byId.set(i.id, i);
  const chosen = itemIds.flatMap((id) => byId.get(id) ?? []);
  const noJacket = buildSlots(items, w, date).noJacket && !chosen.some((i) => i.category === 'outerwear');
  return buildReason(chosen, w, noJacket, locale);
}
