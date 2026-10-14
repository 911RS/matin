import { FALLBACK_WEATHER, reasonFor, seedFromString, suggest } from '../../engine/src/index.ts';
import type { Weather } from '../../engine/src/index.ts';
import { buildMessage, sendPushes, type PushMessage, type PushOutcome } from './push.ts';
import { toEngineItem, toWornOutfits, type ItemRow, type OutfitRow, type ProfileRow } from './rows.ts';
import { daysBefore, localDate, isDue } from './schedule.ts';
import { dayWeather, fetchWeather, roundCoord } from './weather.ts';

export interface DailyDeps {
  now: Date;
  listProfiles(): Promise<ProfileRow[]>;
  listItems(userId: string): Promise<ItemRow[]>;
  listRecentOutfits(userId: string, sinceDate: string): Promise<OutfitRow[]>;
  getOutfit(userId: string, date: string): Promise<OutfitRow | null>;
  insertOutfit(row: OutfitRow): Promise<'inserted' | 'conflict'>;
  markPushed(userId: string, date: string, at: string): Promise<void>;
  clearPushToken(token: string): Promise<void>;
  fetchFn: typeof fetch;
  log(event: string, detail: Record<string, unknown>): void;
}

export interface DailySummary {
  due: number;
  sent: number;
  failed: number;
  invalid: number;
}

interface Pending {
  userId: string;
  message: PushMessage;
  markDate: string | null;
}

const HISTORY_DAYS = 7;
const CONCURRENCY = 10;
const LOG_EVENT = 'daily_suggest_error';

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

async function eachLimited<T>(list: T[], limit: number, fn: (value: T, index: number) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const index = next++;
      await fn(list[index]!, index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, worker));
}

export async function runDailySuggest(deps: DailyDeps): Promise<DailySummary> {
  const profiles = await deps.listProfiles();
  const due = profiles.filter((p) => isDue(p, deps.now));
  const weatherByLocation = new Map<string, Promise<unknown | null>>();
  const results: (Pending | null)[] = due.map(() => null);
  let failed = 0;

  const report = (userId: string, stage: string, e: unknown) => {
    deps.log(LOG_EVENT, { userId, stage, error: errorMessage(e) });
  };

  const rawWeather = (lat: number, lon: number): Promise<unknown | null> => {
    const key = `${roundCoord(lat)},${roundCoord(lon)}`;
    let pending = weatherByLocation.get(key);
    if (!pending) {
      pending = fetchWeather(deps.fetchFn, lat, lon);
      weatherByLocation.set(key, pending);
    }
    return pending;
  };

  const processUser = async (profile: ProfileRow, token: string, setStage: (s: string) => void): Promise<Pending | null> => {
    const date = localDate(deps.now, profile.timezone);
    const pending = (message: PushMessage, markDate: string | null): Pending => ({ userId: profile.id, message, markDate });
    setStage('items');
    const items = (await deps.listItems(profile.id)).map(toEngineItem);
    setStage('history');
    const recentOutfits = toWornOutfits(await deps.listRecentOutfits(profile.id, daysBefore(date, HISTORY_DAYS)));
    setStage('outfit');
    let row = await deps.getOutfit(profile.id, date);
    if (!row) {
      setStage('weather');
      let weather: Weather = FALLBACK_WEATHER;
      if (profile.lat !== null && profile.lon !== null) {
        const json = await rawWeather(profile.lat, profile.lon);
        weather = (json === null ? null : dayWeather(json, date, profile.timezone)) ?? FALLBACK_WEATHER;
      }
      setStage('suggest');
      const seed = seedFromString(`${profile.id}|${date}`);
      const result = suggest({ items, recentOutfits, weather, date, seed, locale: profile.locale });
      if (!('itemIds' in result)) return pending(buildMessage(token, profile.locale, date, result), null);
      setStage('insert');
      const fresh: OutfitRow = { user_id: profile.id, date, item_ids: result.itemIds, weather, seed, status: 'suggested' };
      if ((await deps.insertOutfit(fresh)) === 'inserted') {
        return pending(buildMessage(token, profile.locale, date, result), date);
      }
      setStage('reread');
      row = await deps.getOutfit(profile.id, date);
      if (!row) return null;
    }

    if (row.pushed_at) return null;
    setStage('suggest');
    const stored = new Set(row.item_ids);
    if (items.some((i) => stored.has(i.id))) {
      const body = reasonFor(items, row.item_ids, row.weather, profile.locale, date);
      return pending(buildMessage(token, profile.locale, date, { itemIds: row.item_ids, reason: body }), date);
    }
    const result = suggest({ items, recentOutfits, weather: row.weather, date, seed: row.seed, locale: profile.locale });
    return pending(buildMessage(token, profile.locale, date, result), date);
  };

  await eachLimited(due, CONCURRENCY, async (profile, index) => {
    if (!profile.expo_push_token) return;
    let stage = 'start';
    try {
      results[index] = await processUser(profile, profile.expo_push_token, (s) => {
        stage = s;
      });
    } catch (e) {
      failed++;
      report(profile.id, stage, e);
    }
  });

  const pending = results.filter((r): r is Pending => r !== null);
  let outcomes: PushOutcome[];
  try {
    outcomes = await sendPushes(deps.fetchFn, pending.map((p) => p.message));
  } catch (e) {
    outcomes = pending.map(() => ({ status: 'error', error: errorMessage(e) }));
  }

  let sent = 0;
  const invalid = new Map<string, string[]>();
  for (const [i, p] of pending.entries()) {
    const outcome = outcomes[i] ?? { status: 'error', error: 'missing outcome' };
    if (outcome.status === 'ok') {
      sent++;
      if (p.markDate === null) continue;
      try {
        await deps.markPushed(p.userId, p.markDate, deps.now.toISOString());
      } catch (e) {
        report(p.userId, 'mark_pushed', e);
      }
    } else if (outcome.status === 'invalid') {
      invalid.set(p.message.to, [...(invalid.get(p.message.to) ?? []), p.userId]);
    } else {
      failed++;
      report(p.userId, 'deliver', outcome.error);
    }
  }

  for (const [token, userIds] of invalid) {
    try {
      await deps.clearPushToken(token);
    } catch (e) {
      for (const userId of userIds) report(userId, 'clear_token', e);
    }
  }
  return { due: due.length, sent, failed, invalid: invalid.size };
}
