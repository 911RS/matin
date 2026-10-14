import type { ItemRow, OutfitRow } from '@tenue/backend';
import { FALLBACK_WEATHER, seedFromString } from '@tenue/engine';
import { LocalRepo, DEMO_USER_ID } from '../../data/localRepo';
import { ensureToday, loadWeather, markWorn, offlineToday, shuffle, swap, type FlowDeps } from '../flows';
import { outfitReason } from '../present';
import type { TodayState } from '../types';
import fixture from '../../../../../packages/backend/test/fixtures/metno-paris.json';

const NOW = new Date('2026-10-12T08:00:00Z');
const DATE = '2026-10-12';

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

function item(id: string, category: ItemRow['category'], color: ItemRow['color_family'] = 'navy', warmth: ItemRow['warmth'] = 2): ItemRow {
  return {
    id,
    user_id: DEMO_USER_ID,
    category,
    color_hex: '#000000',
    color_family: color,
    warmth,
    formality: 'casual',
    image_path: `${id}.webp`,
    original_path: `${id}.jpg`,
    archived_at: null,
    unavailable_until: null,
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

function setup(opts: { items?: ItemRow[]; lat?: number | null; fetchOk?: boolean } = {}) {
  const repo = new LocalRepo({
    userId: DEMO_USER_ID,
    prefix: 'tenue-demo:',
    storage: memoryStorage(),
    files: { dir: 'file:///demo/', copy: async () => {}, remove: async () => {} },
    defaults: { locale: 'en', timezone: 'Europe/Paris' },
  });
  const fetchFn = jest.fn(async () => {
    if (opts.fetchOk === false) throw new Error('offline');
    return new Response(JSON.stringify(fixture), { status: 200 });
  });
  const deps: FlowDeps = { repo, now: () => NOW, fetchFn: fetchFn as unknown as typeof fetch };
  const ready = (async () => {
    await repo.updateProfile({ lat: opts.lat === undefined ? 48.86 : opts.lat, lon: 2.35 });
    for (const i of opts.items ?? CLOSET) await repo.saveItem(i);
  })();
  return { repo, deps, fetchFn, ready };
}

const asOutfit = (s: TodayState) => {
  if (s.kind !== 'outfit') throw new Error('expected outfit');
  return s;
};

describe('today flows', () => {
  it('first call inserts a row and returns an outfit', async () => {
    const { repo, deps, fetchFn, ready } = setup();
    await ready;
    const state = asOutfit(await ensureToday(deps));
    const row = await repo.getOutfit(DATE);
    expect(row?.item_ids).toEqual(state.row.item_ids);
    expect(row?.status).toBe('suggested');
    expect(state.items.map((i) => i.id)).toEqual(state.row.item_ids.filter((id) => CLOSET.some((c) => c.id === id)));
    expect(state.row.weather.assumed).toBeUndefined();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('second call returns the same row without fetching weather', async () => {
    const { deps, fetchFn, ready } = setup();
    await ready;
    const first = asOutfit(await ensureToday(deps));
    const second = asOutfit(await ensureToday(deps));
    expect(second.row.item_ids).toEqual(first.row.item_ids);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('returns a pre-seeded row written by the cron', async () => {
    const { repo, deps, fetchFn, ready } = setup();
    await ready;
    const seeded: OutfitRow = {
      user_id: DEMO_USER_ID,
      date: DATE,
      item_ids: ['t3', 'b2', 's2'],
      weather: { feelsLikeC: 20, rain: false },
      seed: 5,
      status: 'suggested',
    };
    await repo.insertOutfit(seeded);
    const state = asOutfit(await ensureToday(deps));
    expect(state.row.item_ids).toEqual(['t3', 'b2', 's2']);
    expect(state.row).toMatchObject(seeded);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('recovers from an insert conflict by returning the stored row', async () => {
    const { repo, deps, ready } = setup();
    await ready;
    const stored: OutfitRow = {
      user_id: DEMO_USER_ID,
      date: DATE,
      item_ids: ['t2', 'b1', 's1'],
      weather: { feelsLikeC: 20, rain: false },
      seed: 9,
      status: 'suggested',
    };
    jest.spyOn(repo, 'getOutfit').mockResolvedValueOnce(null).mockResolvedValue(stored);
    jest.spyOn(repo, 'insertOutfit').mockResolvedValue('conflict');
    const state = asOutfit(await ensureToday(deps));
    expect(state.row.item_ids).toEqual(['t2', 'b1', 's1']);
    expect(state.row.weather).toEqual(stored.weather);
  });

  it('reports missing categories and writes nothing', async () => {
    const { repo, deps, ready } = setup({ items: [item('t1', 'top')] });
    await ready;
    const state = await ensureToday(deps);
    expect(state).toEqual({ kind: 'missing', date: DATE, missing: ['bottom', 'shoes'] });
    expect(await repo.getOutfit(DATE)).toBeNull();
  });

  it('drops ids no longer in the closet; re-suggests without writing when none remain', async () => {
    const { repo, deps, ready } = setup();
    await ready;
    await repo.insertOutfit({
      user_id: DEMO_USER_ID,
      date: DATE,
      item_ids: ['t1', 'gone', 'b1'],
      weather: { feelsLikeC: 20, rain: false },
      seed: 1,
      status: 'suggested',
    });
    expect(asOutfit(await ensureToday(deps)).items.map((i) => i.id)).toEqual(['t1', 'b1']);

    const other = setup();
    await other.ready;
    await other.repo.insertOutfit({
      user_id: DEMO_USER_ID,
      date: DATE,
      item_ids: ['x', 'y'],
      weather: { feelsLikeC: 20, rain: false },
      seed: 1,
      status: 'suggested',
    });
    const state = asOutfit(await ensureToday(other.deps));
    expect(state.row.item_ids.every((id) => CLOSET.some((c) => c.id === id))).toBe(true);
    expect((await other.repo.getOutfit(DATE))?.item_ids).toEqual(['x', 'y']);
  });

  it('shuffle bumps the seed by one and returns the patch without writing', async () => {
    const { repo, deps, ready } = setup();
    await ready;
    const first = asOutfit(await ensureToday(deps));
    const write = jest.spyOn(repo, 'updateOutfit');
    const { state, patch } = await shuffle(deps, first);
    const next = asOutfit(state);
    expect(next.row.seed).toBe(first.row.seed + 1);
    expect(next.row.weather).toEqual(first.row.weather);
    expect(patch).toEqual({ seed: first.row.seed + 1, item_ids: next.row.item_ids });
    expect(write).not.toHaveBeenCalled();
    expect((await repo.getOutfit(DATE))?.seed).toBe(first.row.seed);
  });

  it('shuffle shows a different outfit even when one outfit scores clearly best', async () => {
    const closet = [item('fresh', 'top', 'white'), item('worn', 'top', 'grey'), item('b1', 'bottom', 'navy'), item('s1', 'shoes', 'black')];
    const { repo, deps, ready } = setup({ items: closet });
    await ready;
    await repo.insertOutfit({
      user_id: DEMO_USER_ID,
      date: '2026-10-11',
      item_ids: ['worn', 'b1', 's1'],
      weather: FALLBACK_WEATHER,
      seed: 1,
      status: 'worn',
    });
    const first = asOutfit(await ensureToday(deps));
    expect(first.row.item_ids).toContain('fresh');
    const next = asOutfit((await shuffle(deps, first)).state);
    expect(next.row.item_ids).toContain('worn');
  });

  it('swap on top keeps bottom and shoes and returns the patch without writing', async () => {
    const { repo, deps, ready } = setup();
    await ready;
    const first = asOutfit(await ensureToday(deps));
    const write = jest.spyOn(repo, 'updateOutfit');
    const cat = (id: string) => CLOSET.find((c) => c.id === id)!.category;
    const keep = first.row.item_ids.filter((id) => cat(id) !== 'top');
    const { state, patch } = await swap(deps, first, 'top');
    const next = asOutfit(state);
    expect(next.row.item_ids.filter((id) => cat(id) !== 'top')).toEqual(keep);
    expect(next.row.item_ids.find((id) => cat(id) === 'top')).not.toBe(first.row.item_ids.find((id) => cat(id) === 'top'));
    expect(patch).toEqual({ item_ids: next.row.item_ids });
    expect(write).not.toHaveBeenCalled();
  });

  it('markWorn returns the worn state and patch', async () => {
    const { deps, ready } = setup();
    await ready;
    const first = asOutfit(await ensureToday(deps));
    const { state, patch } = markWorn(first);
    expect(asOutfit(state).row.status).toBe('worn');
    expect(asOutfit(state).items).toBe(first.items);
    expect(patch).toEqual({ status: 'worn', item_ids: first.row.item_ids, seed: first.row.seed });
  });

  it('a worn patch replaces the outfit a conflicting insert left in the store', async () => {
    const { repo, deps, ready } = setup();
    await ready;
    const first = asOutfit(await ensureToday(deps));
    await repo.deleteAccount();
    const cron: OutfitRow = { ...first.row, item_ids: ['t3', 'b2', 's2'], seed: 5 };
    await repo.insertOutfit(cron);
    expect(await repo.insertOutfit(first.row)).toBe('conflict');
    await repo.updateOutfit(DATE, markWorn(first).patch!);
    const stored = await repo.getOutfit(DATE);
    expect(stored).toMatchObject({ status: 'worn', item_ids: first.row.item_ids, seed: first.row.seed });
  });

  it('shuffle reports missing pieces with no patch when the closet shrank', async () => {
    const { repo, deps, ready } = setup();
    await ready;
    const first = asOutfit(await ensureToday(deps));
    for (const row of CLOSET.filter((c) => c.category === 'shoes')) await repo.saveItem({ ...row, archived_at: '2026-10-12T09:00:00Z' });
    const { state, patch } = await shuffle(deps, first);
    expect(state).toEqual({ kind: 'missing', date: DATE, missing: ['shoes'] });
    expect(patch).toBeNull();
  });

  it('ensureToday uses the given date', async () => {
    const { deps, ready } = setup();
    await ready;
    expect((await ensureToday(deps, '2026-10-13')).date).toBe('2026-10-13');
  });

  it('avoids items worn 2 days ago but ignores older or unworn outfits', async () => {
    const base = setup();
    await base.ready;
    const picked = asOutfit(await ensureToday(base.deps)).row.item_ids;

    const pickAfter = async (date: string, status: OutfitRow['status']) => {
      const s = setup();
      await s.ready;
      await s.repo.insertOutfit({
        user_id: DEMO_USER_ID,
        date,
        item_ids: picked,
        weather: { feelsLikeC: 20, rain: false },
        seed: 1,
        status,
      });
      return asOutfit(await ensureToday(s.deps)).row.item_ids;
    };

    const recentWorn = await pickAfter('2026-10-10', 'worn');
    expect(recentWorn.filter((id) => picked.includes(id))).toEqual([]);
    expect(await pickAfter('2026-10-10', 'suggested')).toEqual(picked);
    expect(await pickAfter('2026-10-04', 'worn')).toEqual(picked);
  });

  it('uses assumed weather without fetching when the profile has no location', async () => {
    const { repo, deps, fetchFn, ready } = setup({ lat: null });
    await ready;
    await repo.updateProfile({ timezone: 'UTC', lon: null });
    const state = asOutfit(await ensureToday(deps));
    expect(state.row.weather).toEqual(FALLBACK_WEATHER);
    expect(outfitReason(state, 'en').startsWith('Weather unavailable: no layer needed')).toBe(true);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('falls back to assumed weather when fetch fails', async () => {
    const { deps, ready } = setup({ fetchOk: false });
    await ready;
    const state = asOutfit(await ensureToday(deps));
    expect(state.row.weather).toEqual(FALLBACK_WEATHER);
    expect(outfitReason(state, 'en').startsWith('Weather unavailable: no layer needed')).toBe(true);
  });
});

describe('assumed weather refresh', () => {
  async function assumedRow(repo: LocalRepo, deps: FlowDeps, over: Partial<OutfitRow> = {}) {
    await repo.updateProfile({ lat: null, lon: null });
    const first = asOutfit(await ensureToday(deps));
    await repo.updateProfile({ lat: 48.86, lon: 2.35 });
    if (Object.keys(over).length > 0) await repo.updateOutfit(DATE, over);
    return first.row;
  }

  it('re-suggests with real weather and reports the patch', async () => {
    const { repo, deps, fetchFn, ready } = setup();
    await ready;
    const fetchCalls = fetchFn.mock.calls.length;
    expect(fetchCalls).toBe(0);
    const row = await assumedRow(repo, deps);
    const onRefresh = jest.fn();
    const state = asOutfit(await ensureToday({ ...deps, onRefresh }));
    expect(state.row.weather.assumed).toBeUndefined();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(onRefresh).toHaveBeenCalledWith({ state, patch: { weather: state.row.weather, item_ids: state.row.item_ids } });
    expect(state.row.seed).toBe(row.seed);
  });

  it('refreshes at most once per session and date', async () => {
    const { repo, deps, fetchFn, ready } = setup();
    await ready;
    await assumedRow(repo, deps);
    const onRefresh = jest.fn();
    const refreshed = new Set<string>();
    await ensureToday({ ...deps, onRefresh, refreshed });
    await ensureToday({ ...deps, onRefresh, refreshed });
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['shuffled', { seed: 99 }],
    ['worn', { status: 'worn' as const }],
  ])('does not refresh a %s row', async (_n, over) => {
    const { repo, deps, fetchFn, ready } = setup();
    await ready;
    await assumedRow(repo, deps, over);
    const onRefresh = jest.fn();
    await ensureToday({ ...deps, onRefresh });
    expect(onRefresh).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('does not refresh a swapped row', async () => {
    const { repo, deps, fetchFn, ready } = setup();
    await ready;
    const row = await assumedRow(repo, deps);
    const state = asOutfit(await ensureToday(deps));
    const { patch } = await swap(deps, state, 'top');
    expect(patch!.item_ids).not.toEqual(row.item_ids);
    await repo.updateOutfit(DATE, patch!);
    const onRefresh = jest.fn();
    await ensureToday({ ...deps, onRefresh });
    expect(onRefresh).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('does not refresh when weather is still unavailable', async () => {
    const { repo, deps, ready } = setup({ fetchOk: false });
    await ready;
    const row = await assumedRow(repo, deps);
    const onRefresh = jest.fn();
    const state = asOutfit(await ensureToday({ ...deps, onRefresh }));
    expect(onRefresh).not.toHaveBeenCalled();
    expect(state.row.item_ids).toEqual(row.item_ids);
  });

  it('does not refresh without a location', async () => {
    const { repo, deps, fetchFn, ready } = setup({ lat: null });
    await ready;
    await assumedRow(repo, deps);
    await repo.updateProfile({ lat: null, lon: null });
    const onRefresh = jest.fn();
    await ensureToday({ ...deps, onRefresh });
    expect(onRefresh).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('offlineToday', () => {
  it('picks the same outfit as ensureToday with assumed weather and returns the row to insert', async () => {
    const { repo, deps, ready } = setup({ lat: null });
    await ready;
    const profile = await repo.getProfile();
    const local = offlineToday({ profile, items: CLOSET, recent: [] }, DATE);
    const online = asOutfit(await ensureToday(deps, DATE));
    const state = asOutfit(local.state);
    expect(state.row.weather).toEqual(FALLBACK_WEATHER);
    expect(state.row.item_ids).toEqual(online.row.item_ids);
    expect(local.insert).toMatchObject({ date: DATE, seed: online.row.seed, item_ids: online.row.item_ids, status: 'suggested' });
  });

  it('only counts cached history from the last week', async () => {
    const { repo, ready } = setup({ lat: null });
    await ready;
    const profile = await repo.getProfile();
    const base = asOutfit(offlineToday({ profile, items: CLOSET, recent: [] }, DATE).state).row.item_ids;
    const worn = (date: string): OutfitRow => ({ user_id: DEMO_USER_ID, date, item_ids: base, weather: FALLBACK_WEATHER, seed: 1, status: 'worn' });
    const old = asOutfit(offlineToday({ profile, items: CLOSET, recent: [worn('2026-09-01')] }, DATE).state);
    expect(old.row.item_ids).toEqual(base);
    const recent = asOutfit(offlineToday({ profile, items: CLOSET, recent: [worn('2026-10-11')] }, DATE).state);
    expect(recent.row.item_ids.filter((id) => base.includes(id))).toEqual([]);
  });

  it('reports missing pieces without a row to insert', async () => {
    const { repo, ready } = setup();
    await ready;
    const profile = await repo.getProfile();
    const local = offlineToday({ profile, items: CLOSET.filter((i) => i.category !== 'shoes'), recent: [] }, DATE);
    expect(local).toEqual({ state: { kind: 'missing', date: DATE, missing: ['shoes'] }, insert: null });
  });
});

describe('shuffle within a session', () => {
  it('does not ping-pong between two near-equal outfits on consecutive shuffles', async () => {
    const closet = [
      item('t1', 'top', 'white'),
      item('t2', 'top', 'white'),
      item('t3', 'top', 'white', 3),
      item('b1', 'bottom', 'navy'),
      item('s1', 'shoes', 'black'),
    ];
    const { deps, ready } = setup({ items: closet, lat: null });
    await ready;
    const top = (s: { row: { item_ids: string[] } }) => s.row.item_ids.find((id) => id.startsWith('t'));
    let pingPongs = 0;
    for (let d = 10; d < 30; d++) {
      const first = asOutfit(await ensureToday(deps, `2026-10-${d}`));
      const second = asOutfit((await shuffle(deps, first)).state);
      const third = asOutfit((await shuffle(deps, second, [first.row.item_ids])).state);
      expect(new Set([top(first), top(second), top(third)]).size).toBe(3);
      const withoutMemory = asOutfit((await shuffle(deps, second)).state);
      if (top(withoutMemory) === top(first)) pingPongs++;
    }
    expect(pingPongs).toBeGreaterThan(0);
  });
});

describe('loadWeather', () => {
  it('returns the fallback without coordinates, without fetching', async () => {
    const { repo, deps, fetchFn, ready } = setup({ lat: null });
    await ready;
    expect(await loadWeather(deps, await repo.getProfile(), DATE)).toEqual(FALLBACK_WEATHER);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('returns the fallback when the day is not in the forecast', async () => {
    const { repo, deps, ready } = setup();
    await ready;
    expect(await loadWeather(deps, await repo.getProfile(), '2030-01-01')).toEqual(FALLBACK_WEATHER);
  });

  it('parses the day from the forecast', async () => {
    const { repo, deps, ready } = setup();
    await ready;
    const w = await loadWeather(deps, await repo.getProfile(), DATE);
    expect(w.assumed).toBeUndefined();
    expect(typeof w.feelsLikeC).toBe('number');
  });
});

