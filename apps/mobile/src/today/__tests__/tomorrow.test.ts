import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ItemRow, OutfitRow } from '@tenue/backend';
import { FALLBACK_WEATHER, seedFromString } from '@tenue/engine';
import { runDailySuggest } from '../../../../../packages/backend/src/daily';
import type { DailyDeps } from '../../../../../packages/backend/src/daily';
import { LocalRepo, DEMO_USER_ID } from '../../data/localRepo';
import { occasionKey } from '../occasion';
import { previewTomorrow, tomorrowOf } from '../flows';
import type { FlowDeps } from '../flows';
import metno from '../../../../../packages/backend/test/fixtures/metno-paris.json';

const fixture = JSON.parse(JSON.stringify(metno).replace(/2026-10-13T/g, '2026-10-14T').replace(/2026-10-12T/g, '2026-10-13T'));
const NOW = new Date('2026-10-12T08:00:00Z');
const TODAY = '2026-10-12';
const TOMORROW = '2026-10-13';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    async getItem(k: string) {
      return map.get(k) ?? null;
    },
    async setItem(k: string, v: string) {
      map.set(k, v);
    },
    async getAllKeys() {
      return [...map.keys()];
    },
    async multiRemove(keys: readonly string[]) {
      keys.forEach((k) => map.delete(k));
    },
  };
}

function item(id: string, category: ItemRow['category'], color: ItemRow['color_family'], over: Partial<ItemRow> = {}): ItemRow {
  return {
    id,
    user_id: DEMO_USER_ID,
    category,
    color_hex: '#000000',
    color_family: color,
    warmth: 2,
    formality: 'casual',
    image_path: `${id}.webp`,
    original_path: `${id}.jpg`,
    archived_at: null,
    unavailable_until: null,
    ...over,
  };
}

const CLOSET: ItemRow[] = [
  item('t1', 'top', 'white'),
  item('t2', 'top', 'beige'),
  item('t3', 'top', 'grey'),
  item('b1', 'bottom', 'navy'),
  item('b2', 'bottom', 'black'),
  item('s1', 'shoes', 'black'),
  item('s2', 'shoes', 'white'),
];

function worn(date: string, item_ids: string[]): OutfitRow {
  return { user_id: DEMO_USER_ID, date, item_ids, weather: FALLBACK_WEATHER, seed: 1, status: 'worn' };
}

async function setup(items: ItemRow[] = CLOSET, outfits: OutfitRow[] = []) {
  const repo = new LocalRepo({
    userId: DEMO_USER_ID,
    prefix: 'tenue-demo:',
    storage: memoryStorage(),
    files: { dir: 'file:///demo/', copy: async () => {}, remove: async () => {} },
    defaults: { locale: 'en', timezone: 'Europe/Paris' },
  });
  await repo.updateProfile({ lat: 48.86, lon: 2.35 });
  for (const i of items) await repo.saveItem(i);
  for (const o of outfits) await repo.insertOutfit(o);
  const fetchFn = jest.fn(async () => new Response(JSON.stringify(fixture), { status: 200 }));
  const deps: FlowDeps = { repo, now: () => NOW, fetchFn: fetchFn as unknown as typeof fetch };
  return { repo, deps, fetchFn };
}

function outfitOf(state: Awaited<ReturnType<typeof previewTomorrow>>) {
  if (state.kind !== 'outfit') throw new Error('expected outfit');
  return state;
}

async function cronRow(items: ItemRow[], outfits: OutfitRow[]): Promise<OutfitRow> {
  const inserted: OutfitRow[] = [];
  const deps: DailyDeps = {
    now: new Date('2026-10-13T05:30:00Z'),
    listProfiles: async () => [
      { id: DEMO_USER_ID, locale: 'en', push_time: '07:30:00', timezone: 'Europe/Paris', lat: 48.86, lon: 2.35, expo_push_token: 'tok' },
    ],
    listItems: async () => items,
    listRecentOutfits: async (_id, since) => outfits.filter((o) => o.date >= since),
    getOutfit: async () => null,
    insertOutfit: async (row) => {
      inserted.push(row);
      return 'inserted';
    },
    markPushed: async () => {},
    clearPushToken: async () => {},
    fetchFn: (async (url: string) =>
      new Response(url.includes('met.no') ? JSON.stringify(fixture) : JSON.stringify({ data: [{ status: 'ok' }] }), {
        status: 200,
      })) as unknown as typeof fetch,
    log: () => {},
  };
  await runDailySuggest(deps);
  return inserted[0]!;
}

describe('tomorrowOf', () => {
  it.each([
    ['2026-10-12', '2026-10-13'],
    ['2026-10-31', '2026-11-01'],
    ['2026-12-31', '2027-01-01'],
    ['2028-02-28', '2028-02-29'],
    ['2027-02-28', '2027-03-01'],
  ])('%s -> %s', (today, next) => {
    expect(tomorrowOf(today)).toBe(next);
  });
});

describe('previewTomorrow', () => {
  it('uses the cron seed formula and gives the same pick as the cron', async () => {
    const history = [worn('2026-10-05', ['t1', 'b1', 's1']), worn('2026-10-09', ['t2', 'b2', 's2']), worn(TODAY, ['t3', 'b1', 's1'])];
    const { deps } = await setup(CLOSET, history);
    const preview = outfitOf(await previewTomorrow(deps, TODAY));
    const cron = await cronRow(CLOSET, history);
    expect(cron.date).toBe(TOMORROW);
    expect(preview.date).toBe(TOMORROW);
    expect(preview.row.seed).toBe(seedFromString(`${DEMO_USER_ID}|${TOMORROW}`));
    expect(preview.row.seed).toBe(cron.seed);
    expect(preview.row.item_ids).toEqual(cron.item_ids);
    expect(preview.row.weather).toEqual(cron.weather);
  });

  it('uses the weather for tomorrow', async () => {
    const { deps } = await setup();
    const preview = outfitOf(await previewTomorrow(deps, TODAY));
    const seen = await cronRow(CLOSET, []);
    expect(preview.row.weather).toEqual(seen.weather);
    expect(preview.row.weather.assumed).toBeUndefined();
  });

  it('uses the supplied weather loader and today row over stored history', async () => {
    const { deps, fetchFn } = await setup();
    const weatherFor = jest.fn(async () => ({ feelsLikeC: 3, rain: true }));
    const todayRow = worn(TODAY, ['t1', 'b1', 's1']);
    const preview = outfitOf(await previewTomorrow(deps, TODAY, { weatherFor, todayRow }));
    expect(weatherFor).toHaveBeenCalledWith(expect.objectContaining({ id: DEMO_USER_ID }), TOMORROW);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(preview.row.weather).toEqual({ feelsLikeC: 3, rain: true });
    const stored = await setup(CLOSET, [todayRow]);
    const expected = outfitOf(await previewTomorrow(stored.deps, TODAY, { weatherFor }));
    expect(preview.row.item_ids).toEqual(expected.row.item_ids);
  });

  it('excludes items unavailable on tomorrow and keeps items back by then', async () => {
    const away = [
      item('t1', 'top', 'white', { unavailable_until: '2026-10-14' }),
      item('t2', 'top', 'beige', { unavailable_until: '2026-10-14' }),
      item('t3', 'top', 'grey'),
      CLOSET[3]!,
      CLOSET[5]!,
    ];
    const { deps } = await setup(away);
    expect(outfitOf(await previewTomorrow(deps, TODAY)).row.item_ids).toContain('t3');
    const back = [item('t1', 'top', 'white', { unavailable_until: TOMORROW }), CLOSET[3]!, CLOSET[5]!];
    const ready = await setup(back);
    expect(outfitOf(await previewTomorrow(ready.deps, TODAY)).row.item_ids).toContain('t1');
    const gone = [item('t1', 'top', 'white', { unavailable_until: '2026-10-14' }), CLOSET[3]!, CLOSET[5]!];
    const none = await setup(gone);
    expect((await previewTomorrow(none.deps, TODAY)).kind).toBe('missing');
  });

  it('ignores an occasion stored for tomorrow', async () => {
    const { deps } = await setup();
    const before = outfitOf(await previewTomorrow(deps, TODAY));
    await AsyncStorage.setItem(occasionKey(DEMO_USER_ID, TOMORROW), 'formal');
    const after = outfitOf(await previewTomorrow(deps, TODAY));
    expect(after.row.item_ids).toEqual(before.row.item_ids);
    expect(after.row.seed).toBe(before.row.seed);
  });

  it('never writes', async () => {
    const { repo, deps } = await setup(CLOSET, [worn(TODAY, ['t1', 'b1', 's1'])]);
    const insert = jest.spyOn(repo, 'insertOutfit');
    const update = jest.spyOn(repo, 'updateOutfit');
    const save = jest.spyOn(repo, 'saveItem');
    await previewTomorrow(deps, TODAY);
    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(await repo.getOutfit(TOMORROW)).toBeNull();
  });

  it('reports missing categories', async () => {
    const { deps } = await setup([CLOSET[0]!]);
    const state = await previewTomorrow(deps, TODAY);
    expect(state.kind).toBe('missing');
    expect(state.date).toBe(TOMORROW);
  });
});
