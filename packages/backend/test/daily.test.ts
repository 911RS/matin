import { readFileSync } from 'node:fs';
import { beforeEach, expect, test, vi } from 'vitest';
import { runDailySuggest, type DailyDeps } from '../src/daily.ts';
import type { ItemRow, OutfitRow, ProfileRow } from '../src/rows.ts';
import { reasonFor, seedFromString, shownTemperature } from '../../engine/src/index.ts';
import { toEngineItem } from '../src/rows.ts';

const fixture = readFileSync(new URL('./fixtures/metno-paris.json', import.meta.url), 'utf8');
const NOW = new Date('2026-10-12T05:30:00Z');
const DATE = '2026-10-12';

const profile = (id: string, over: Partial<ProfileRow> = {}): ProfileRow => ({
  id,
  locale: 'en',
  push_time: '07:30:00',
  timezone: 'Europe/Paris',
  lat: 48.8566,
  lon: 2.3522,
  expo_push_token: `tok-${id}`,
  ...over,
});

const item = (userId: string, id: string, category: ItemRow['category'], warmth: ItemRow['warmth']): ItemRow => ({
  id: `${userId}-${id}`,
  user_id: userId,
  category,
  color_hex: '#000000',
  color_family: 'black',
  warmth,
  formality: 'casual',
  image_path: 'i',
  original_path: 'o',
  archived_at: null,
  unavailable_until: null,
});

const closet = (userId: string): ItemRow[] => [
  item(userId, 't', 'top', 2),
  item(userId, 'b', 'bottom', 2),
  item(userId, 's', 'shoes', 2),
  item(userId, 'o', 'outerwear', 3),
];

interface Harness {
  deps: DailyDeps;
  profiles: ProfileRow[];
  closets: Map<string, ItemRow[]>;
  outfits: OutfitRow[];
  calls: { met: string[]; expo: string[] };
  expoTickets: (messages: { to: string }[]) => unknown[];
  metStatus: { code: number };
  cleared: string[];
  marked: string[];
  logs: { event: string; detail: Record<string, unknown> }[];
  insert: ReturnType<typeof vi.fn>;
}

let h: Harness;

beforeEach(() => {
  const outfits: OutfitRow[] = [];
  const closets = new Map<string, ItemRow[]>();
  const calls = { met: [] as string[], expo: [] as string[] };
  const metStatus = { code: 200 };
  const cleared: string[] = [];
  const marked: string[] = [];
  const logs: Harness['logs'] = [];
  const insert = vi.fn(async (row: OutfitRow) => {
    outfits.push({ ...row });
    return 'inserted' as const;
  });
  const harness: Harness = {
    profiles: [],
    closets,
    outfits,
    calls,
    metStatus,
    cleared,
    marked,
    logs,
    insert,
    expoTickets: (messages) => messages.map(() => ({ status: 'ok', id: 'x' })),
    deps: undefined as unknown as DailyDeps,
  };
  const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('api.met.no')) {
      calls.met.push(u);
      return metStatus.code === 200
        ? ({ ok: true, json: async () => JSON.parse(fixture) } as Response)
        : ({ ok: false, status: metStatus.code } as Response);
    }
    if (u.includes('exp.host')) {
      calls.expo.push(u);
      const sent = JSON.parse(init!.body as string) as { to: string }[];
      return { ok: true, json: async () => ({ data: harness.expoTickets(sent) }) } as Response;
    }
    throw new Error(`unexpected url ${u}`);
  });
  harness.deps = {
    now: NOW,
    listProfiles: async () => harness.profiles,
    listItems: async (id) => harness.closets.get(id) ?? [],
    listRecentOutfits: async (id, since) => outfits.filter((o) => o.user_id === id && o.date >= since),
    getOutfit: async (id, date) => outfits.find((o) => o.user_id === id && o.date === date) ?? null,
    insertOutfit: insert,
    markPushed: async (id, date, at) => {
      const o = outfits.find((x) => x.user_id === id && x.date === date);
      if (o) o.pushed_at = at;
      marked.push(`${id}|${date}`);
    },
    clearPushToken: async (t) => {
      cleared.push(t);
    },
    fetchFn: fetchFn as unknown as typeof fetch,
    log: (event, detail) => {
      logs.push({ event, detail });
    },
  };
  h = harness;
});

const withUsers = (...ids: string[]) => {
  for (const id of ids) {
    h.profiles.push(profile(id));
    h.closets.set(id, closet(id));
  }
};

const capture = () => {
  const sent: { to: string; body: string }[] = [];
  const original = h.deps.fetchFn;
  h.deps.fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).includes('exp.host')) sent.push(...(JSON.parse(init!.body as string) as typeof sent));
    return original(url, init);
  }) as typeof fetch;
  return sent;
};

test('weather is fetched once per rounded location', async () => {
  withUsers('a', 'b');
  h.profiles[1]!.lat = 48.8571;
  h.profiles[1]!.lon = 2.3549;
  h.profiles.push(profile('c', { lat: 43.6, lon: 1.44 }));
  h.closets.set('c', closet('c'));
  const res = await runDailySuggest(h.deps);
  expect(h.calls.met).toHaveLength(2);
  expect(h.calls.expo).toHaveLength(1);
  expect(res).toEqual({ due: 3, sent: 3, failed: 0, invalid: 0 });
  expect(h.outfits.map((o) => o.user_id).sort()).toEqual(['a', 'b', 'c']);
  h.outfits.sort((x, y) => x.user_id.localeCompare(y.user_id));
  expect(h.outfits[0]).toMatchObject({
    date: DATE,
    status: 'suggested',
    seed: seedFromString(`a|${DATE}`),
    weather: { feelsLikeC: 6.7, rain: true },
  });
});

test('the cron skips pieces that are unavailable until after today', async () => {
  withUsers('a');
  const items = h.closets.get('a')!;
  items[0] = { ...items[0]!, unavailable_until: '2026-10-13' };
  items.push({ ...items[0]!, id: 'a-t2', unavailable_until: DATE });
  await runDailySuggest(h.deps);
  expect(h.outfits[0]!.item_ids).toContain('a-t2');
  expect(h.outfits[0]!.item_ids).not.toContain('a-t');
});

test('the reason for a stored row leaves out a jacket that is unavailable today', async () => {
  withUsers('a');
  const items = h.closets.get('a')!;
  items[3] = { ...items[3]!, unavailable_until: '2026-10-14' };
  h.outfits.push({ user_id: 'a', date: DATE, item_ids: ['a-t', 'a-b', 'a-s'], weather: { feelsLikeC: 2, rain: true }, seed: 7, status: 'suggested' });
  const sent = capture();
  await runDailySuggest(h.deps);
  expect(sent[0]!.body.startsWith('No jacket in your closet')).toBe(true);
});

test('a user who is not due gets nothing', async () => {
  withUsers('a');
  h.profiles.push(profile('late', { push_time: '21:00:00' }));
  h.closets.set('late', closet('late'));
  const sent = capture();
  const res = await runDailySuggest(h.deps);
  expect(res).toEqual({ due: 1, sent: 1, failed: 0, invalid: 0 });
  expect(h.insert).toHaveBeenCalledTimes(1);
  expect(sent.map((m) => m.to)).toEqual(['tok-a']);
});

test('an existing row is not re-inserted; its reason describes the stored items and it is marked pushed', async () => {
  withUsers('a');
  const existing: OutfitRow = {
    user_id: 'a',
    date: DATE,
    item_ids: ['a-t', 'a-b', 'a-s', 'a-o'],
    weather: { feelsLikeC: 25, rain: false },
    seed: 7,
    status: 'suggested',
  };
  h.outfits.push(existing);
  const sent = capture();
  const res = await runDailySuggest(h.deps);
  const expected = reasonFor(h.closets.get('a')!.map(toEngineItem), existing.item_ids, existing.weather, 'en');
  expect(h.insert).not.toHaveBeenCalled();
  expect(h.calls.met).toHaveLength(0);
  expect(sent[0]!.body).toBe(expected);
  expect(res.sent).toBe(1);
  expect(h.marked).toEqual([`a|${DATE}`]);
  expect(existing.pushed_at).toBe(NOW.toISOString());
});

test('an existing row with pushed_at set is skipped', async () => {
  withUsers('a');
  h.outfits.push({
    user_id: 'a',
    date: DATE,
    item_ids: ['a-t', 'a-b', 'a-s'],
    weather: { feelsLikeC: 20, rain: false },
    seed: 1,
    status: 'suggested',
    pushed_at: '2026-10-12T05:15:00Z',
  });
  const sent = capture();
  const res = await runDailySuggest(h.deps);
  expect(sent).toHaveLength(0);
  expect(res).toEqual({ due: 1, sent: 0, failed: 0, invalid: 0 });
  expect(h.marked).toEqual([]);
});

test('new rows are inserted unpushed and marked after sending', async () => {
  withUsers('a');
  let markedBeforeSend = 0;
  const original = h.deps.fetchFn;
  h.deps.fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).includes('exp.host')) markedBeforeSend = h.marked.length;
    return original(url, init);
  }) as typeof fetch;
  await runDailySuggest(h.deps);
  expect(h.insert.mock.calls[0]![0]).not.toHaveProperty('pushed_at');
  expect(markedBeforeSend).toBe(0);
  expect(h.marked).toEqual([`a|${DATE}`]);
  expect(h.outfits[0]!.pushed_at).toBe(NOW.toISOString());
});

test('a failed delivery leaves the row unpushed, is counted and logged without the token', async () => {
  withUsers('a', 'b');
  h.expoTickets = (messages) =>
    messages.map((m) =>
      m.to === 'tok-b' ? { status: 'error', message: 'rate', details: { error: 'MessageRateExceeded' } } : { status: 'ok' },
    );
  const res = await runDailySuggest(h.deps);
  expect(res).toEqual({ due: 2, sent: 1, failed: 1, invalid: 0 });
  expect(h.marked).toEqual([`a|${DATE}`]);
  expect(h.outfits.find((o) => o.user_id === 'b')!.pushed_at).toBeUndefined();
  expect(h.logs).toEqual([
    { event: 'daily_suggest_error', detail: { userId: 'b', stage: 'deliver', error: 'MessageRateExceeded' } },
  ]);
  expect(JSON.stringify(h.logs)).not.toContain('tok-');
});

test('markPushed and clearPushToken failures are logged', async () => {
  withUsers('a', 'b');
  h.expoTickets = (messages) =>
    messages.map((m) => (m.to === 'tok-b' ? { status: 'error', details: { error: 'DeviceNotRegistered' } } : { status: 'ok' }));
  h.deps.markPushed = async () => {
    throw new Error('mark down');
  };
  h.deps.clearPushToken = async () => {
    throw new Error('clear down');
  };
  const res = await runDailySuggest(h.deps);
  expect(res).toEqual({ due: 2, sent: 1, failed: 0, invalid: 1 });
  expect(h.logs).toEqual([
    { event: 'daily_suggest_error', detail: { userId: 'a', stage: 'mark_pushed', error: 'mark down' } },
    { event: 'daily_suggest_error', detail: { userId: 'b', stage: 'clear_token', error: 'clear down' } },
  ]);
});

test('due users are processed with at most 10 in flight', async () => {
  const ids = Array.from({ length: 25 }, (_, i) => `u${String(i).padStart(2, '0')}`);
  withUsers(...ids);
  let inFlight = 0;
  let peak = 0;
  const listItems = h.deps.listItems;
  h.deps.listItems = async (id) => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight--;
    return listItems(id);
  };
  const sent = capture();
  const res = await runDailySuggest(h.deps);
  expect(peak).toBe(10);
  expect(res).toEqual({ due: 25, sent: 25, failed: 0, invalid: 0 });
  expect(sent.map((m) => m.to)).toEqual(ids.map((id) => `tok-${id}`));
  expect(h.calls.met).toHaveLength(1);
});

test('running twice with the same now sends once', async () => {
  withUsers('a');
  const first = await runDailySuggest(h.deps);
  const second = await runDailySuggest(h.deps);
  expect(first.sent).toBe(1);
  expect(second.sent).toBe(0);
  expect(h.outfits[0]!.pushed_at).toBe(NOW.toISOString());
  expect(h.calls.expo).toHaveLength(1);
});

test('stored items that no longer exist send the missing message', async () => {
  withUsers('a');
  h.closets.set('a', [item('a', 't', 'top', 2)]);
  h.outfits.push({
    user_id: 'a',
    date: DATE,
    item_ids: ['gone1', 'gone2'],
    weather: { feelsLikeC: 20, rain: false },
    seed: 1,
    status: 'suggested',
  });
  const sent = capture();
  await runDailySuggest(h.deps);
  expect(sent[0]!.body).toBe('Add a bottom, shoes to get suggestions');
});

test('an insert conflict re-reads the row and sends one push', async () => {
  withUsers('a');
  const winner: OutfitRow = {
    user_id: 'a',
    date: DATE,
    item_ids: ['a-t', 'a-b', 'a-s'],
    weather: { feelsLikeC: 30, rain: false },
    seed: 3,
    status: 'suggested',
  };
  let reads = 0;
  h.deps.getOutfit = async () => (reads++ === 0 ? null : winner);
  h.deps.insertOutfit = vi.fn(async () => 'conflict' as const);
  const sent = capture();
  const res = await runDailySuggest(h.deps);
  expect(reads).toBe(2);
  expect(sent).toHaveLength(1);
  expect(sent[0]!.body).toBe(reasonFor(h.closets.get('a')!.map(toEngineItem), winner.item_ids, winner.weather, 'en'));
  expect(sent[0]!.body).toContain('keep it light');
  expect(res.sent).toBe(1);
});

test('a weather failure falls back to assumed weather', async () => {
  withUsers('a');
  h.metStatus.code = 500;
  const sent = capture();
  await runDailySuggest(h.deps);
  expect(sent[0]!.body.startsWith('Weather unavailable: no layer needed')).toBe(true);
  expect(h.outfits[0]!.weather).toMatchObject({ feelsLikeC: 18, assumed: true });
});

test('a user without a location uses the fallback and triggers no fetch', async () => {
  withUsers('a');
  h.profiles[0]!.lat = null;
  h.profiles[0]!.lon = null;
  const sent = capture();
  await runDailySuggest(h.deps);
  expect(h.calls.met).toHaveLength(0);
  expect(sent[0]!.body.startsWith('Weather unavailable: no layer needed')).toBe(true);
});

test('a closet missing pieces gets the missing message and no row', async () => {
  withUsers('a');
  h.closets.set('a', [item('a', 't', 'top', 2)]);
  const sent = capture();
  await runDailySuggest(h.deps);
  expect(h.insert).not.toHaveBeenCalled();
  expect(sent[0]!.body).toBe('Add a bottom, shoes to get suggestions');
});

test('worn outfits from the last 7 days are passed as history', async () => {
  withUsers('a');
  const listRecent = vi.fn(async () => []);
  h.deps.listRecentOutfits = listRecent;
  await runDailySuggest(h.deps);
  expect(listRecent).toHaveBeenCalledWith('a', '2026-10-05');
});

test('DeviceNotRegistered clears that token and is counted', async () => {
  withUsers('a', 'b');
  h.expoTickets = (messages) =>
    messages.map((m) =>
      m.to === 'tok-b'
        ? { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } }
        : { status: 'ok', id: 'x' },
    );
  const res = await runDailySuggest(h.deps);
  expect(h.cleared).toEqual(['tok-b']);
  expect(res).toEqual({ due: 2, sent: 1, failed: 0, invalid: 1 });
  expect(h.marked).toEqual([`a|${DATE}`]);
});

test('one user failing does not stop the others', async () => {
  withUsers('a', 'b');
  const listItems = h.deps.listItems;
  h.deps.listItems = async (id) => {
    if (id === 'a') throw new Error('db down');
    return listItems(id);
  };
  const sent = capture();
  const res = await runDailySuggest(h.deps);
  expect(sent.map((m) => m.to)).toEqual(['tok-b']);
  expect(res).toEqual({ due: 2, sent: 1, failed: 1, invalid: 0 });
  expect(h.logs).toEqual([{ event: 'daily_suggest_error', detail: { userId: 'a', stage: 'items', error: 'db down' } }]);
});

test('a French push shows the same temperature as the app chip, with a no-break space before the colon', async () => {
  h.profiles.push(profile('a', { locale: 'fr' }));
  h.closets.set('a', closet('a'));
  const weather = { feelsLikeC: 22.4, rain: false };
  h.outfits.push({ user_id: 'a', date: DATE, item_ids: ['a-t', 'a-b', 'a-s'], weather, seed: 3, status: 'suggested' });
  const sent = capture();
  await runDailySuggest(h.deps);
  expect(sent[0]!.body.startsWith(`${shownTemperature(weather)}°C\u00a0: reste léger`)).toBe(true);
});
