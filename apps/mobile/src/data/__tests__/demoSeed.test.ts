import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ItemRow } from '@tenue/backend';
import { DEMO_PIECES, DEMO_SEEDED_KEY, PARIS, seedDemo } from '../demoSeed';
import type { DemoSeedDeps } from '../demoSeed';
import { DEMO_USER_ID, LocalRepo } from '../localRepo';

const NOW = new Date('2026-10-13T08:00:00Z');

function make(overrides: Partial<DemoSeedDeps> = {}) {
  const files = {
    dir: 'file:///docs/demo/',
    copy: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  const repo = new LocalRepo({
    userId: DEMO_USER_ID,
    prefix: 'tenue-demo:',
    storage: AsyncStorage,
    files,
    defaults: { locale: 'en', timezone: 'Europe/Paris' },
  });
  const markOnboarded = jest.fn().mockResolvedValue(undefined);
  const setLocationLabel = jest.fn().mockResolvedValue(undefined);
  const deps: DemoSeedDeps = {
    repo,
    storage: AsyncStorage,
    assetUri: jest.fn(async (asset: number) => `file:///cache/asset-${asset}.webp`),
    markOnboarded,
    setLocationLabel,
    now: () => NOW,
    ...overrides,
  };
  return { repo, files, deps, markOnboarded, setLocationLabel };
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('seedDemo', () => {
  it('seeds 8 pieces with images, a Paris profile, 5 worn days and the onboarding flag', async () => {
    const { repo, files, deps, markOnboarded, setLocationLabel } = make();

    expect(await seedDemo(deps)).toBe(true);

    const items = await repo.listItems({ includeArchived: true });
    expect(items).toHaveLength(8);
    const counts = items.reduce<Record<string, number>>((acc, i) => {
      acc[i.category] = (acc[i.category] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts).toEqual({ top: 2, bottom: 2, dress: 1, shoes: 2, outerwear: 1 });
    expect(new Set(items.map((i) => i.color_family)).size).toBe(8);
    expect(files.copy).toHaveBeenCalledTimes(8);
    for (const item of items) {
      expect(await repo.imageUrl(item.image_path)).toMatch(/^file:\/\/\/docs\/demo\//);
    }

    const profile = await repo.getProfile();
    expect(profile.lat).toBe(PARIS.lat);
    expect(profile.lon).toBe(PARIS.lon);
    expect(setLocationLabel).toHaveBeenCalledWith(DEMO_USER_ID, 'Paris');

    const outfits = await repo.listOutfits('2026-10-01', '2026-10-31');
    expect(outfits.map((o) => o.date)).toEqual([
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
      '2026-10-12',
    ]);
    expect(outfits.every((o) => o.status === 'worn')).toBe(true);
    const ids = new Set(items.map((i) => i.id));
    expect(outfits.every((o) => o.item_ids.every((id) => ids.has(id)))).toBe(true);

    expect(markOnboarded).toHaveBeenCalledWith(DEMO_USER_ID);
    expect(await AsyncStorage.getItem(DEMO_SEEDED_KEY)).toBe('1');
  });

  it('does not duplicate anything when run twice', async () => {
    const { repo, files, deps } = make();

    await seedDemo(deps);
    expect(await seedDemo(deps)).toBe(false);

    expect(await repo.listItems({ includeArchived: true })).toHaveLength(8);
    expect(await repo.listOutfits('2026-10-01', '2026-10-31')).toHaveLength(5);
    expect(files.copy).toHaveBeenCalledTimes(8);
  });

  it('finishes a seed that was interrupted part way without duplicating', async () => {
    const { repo, deps } = make();
    let calls = 0;
    const failing = make({
      assetUri: async (asset: number) => {
        calls += 1;
        if (calls > 3) throw new Error('disk full');
        return `file:///cache/asset-${asset}.webp`;
      },
    }).deps;

    await expect(seedDemo({ ...failing, repo })).rejects.toThrow('disk full');
    expect(await AsyncStorage.getItem(DEMO_SEEDED_KEY)).toBeNull();

    expect(await seedDemo(deps)).toBe(true);
    expect(await repo.listItems({ includeArchived: true })).toHaveLength(8);
    expect(await repo.listOutfits('2026-10-01', '2026-10-31')).toHaveLength(5);
  });

  it('leaves a demo store that already has the user own pieces alone', async () => {
    const { repo, files, deps, markOnboarded } = make();
    const own: ItemRow = {
      id: 'mine',
      user_id: DEMO_USER_ID,
      category: 'top',
      color_hex: '#112233',
      color_family: 'blue',
      warmth: 2,
      formality: 'casual',
      image_path: `${DEMO_USER_ID}/mine.webp`,
      original_path: `${DEMO_USER_ID}/mine.webp`,
      archived_at: null,
      unavailable_until: null,
    };
    await repo.saveItem(own);

    expect(await seedDemo(deps)).toBe(false);

    expect(await repo.listItems({ includeArchived: true })).toEqual([{ ...own, created_at: expect.any(String) }]);
    expect(files.copy).not.toHaveBeenCalled();
    expect(markOnboarded).not.toHaveBeenCalled();
  });

  it('defines one asset per piece', () => {
    expect(DEMO_PIECES).toHaveLength(8);
    expect(new Set(DEMO_PIECES.map((p) => p.id)).size).toBe(8);
  });
});

describe('seedDemo retry', () => {
  it('does not duplicate the history when a failed seed is retried', async () => {
    const markOnboarded = jest.fn().mockRejectedValueOnce(new Error('disk full')).mockResolvedValue(undefined);
    const { repo, deps } = make({ markOnboarded });
    await expect(seedDemo(deps)).rejects.toThrow('disk full');
    expect(await AsyncStorage.getItem(DEMO_SEEDED_KEY)).toBeNull();
    const insert = jest.spyOn(repo, 'insertOutfit');

    expect(await seedDemo(deps)).toBe(true);

    expect(insert).toHaveBeenCalledTimes(5);
    for (const result of await Promise.all(insert.mock.results.map((r) => r.value))) expect(result).toBe('conflict');
    const history = await repo.listOutfits('2026-10-01', '2026-10-13');
    expect(history).toHaveLength(5);
    expect(new Set(history.map((o) => o.date)).size).toBe(5);
    expect(await repo.listItems({ includeArchived: true })).toHaveLength(DEMO_PIECES.length);
  });
});
