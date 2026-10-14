import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ItemRow, OutfitRow, ProfileRow } from '@tenue/backend';
import { LocalRepo } from '../../data/localRepo';
import type { ImageContentType, ProfilePatch, Repo } from '../../data/repo';
import { createProgressStore, hasGuestData, migrateLocalToCloud, rewritePath } from '../migrate';

const CLOUD_ID = 'cloud-user';
const weather = { feelsLikeC: 12, rain: false };

function item(id: string, cutout = true, archived: string | null = null): ItemRow {
  return {
    id,
    user_id: 'local-user',
    category: 'top',
    color_hex: '#112233',
    color_family: 'blue',
    warmth: 2,
    formality: 'casual',
    image_path: cutout ? `local-user/${id}.webp` : `local-user/${id}-original.jpg`,
    original_path: `local-user/${id}-original.jpg`,
    archived_at: archived,
    unavailable_until: null,
  };
}

function outfit(date: string, itemIds: string[]): OutfitRow {
  return { user_id: 'local-user', date, item_ids: itemIds, weather, seed: 3, status: 'worn' };
}

class FakeCloud implements Repo {
  images = new Map<string, { from: string; contentType: ImageContentType }>();
  uploads = 0;
  items = new Map<string, ItemRow>();
  outfits = new Map<string, OutfitRow>();
  profile: ProfileRow = {
    id: CLOUD_ID,
    locale: 'en',
    push_time: '07:30:00',
    timezone: 'UTC',
    lat: null,
    lon: null,
    expo_push_token: null,
  };
  failUploadAt: string | null = null;

  async userId() {
    return CLOUD_ID;
  }
  async getProfile() {
    return this.profile;
  }
  async updateProfile(patch: ProfilePatch) {
    this.profile = { ...this.profile, ...patch };
  }
  async claimPushToken() {}
  async listItems() {
    return [...this.items.values()];
  }
  async saveItem(row: ItemRow) {
    this.items.set(row.id, row);
  }
  async uploadImage(from: string, path: string, contentType: ImageContentType) {
    if (path === this.failUploadAt) {
      this.failUploadAt = null;
      throw new Error('network');
    }
    this.uploads += 1;
    this.images.set(path, { from, contentType });
  }
  async imageUrl(path: string) {
    return path;
  }
  async getOutfit(date: string) {
    return this.outfits.get(date) ?? null;
  }
  async insertOutfit(row: OutfitRow) {
    if (this.outfits.has(row.date)) return 'conflict' as const;
    this.outfits.set(row.date, row);
    return 'inserted' as const;
  }
  async updateOutfit() {}
  async listOutfits() {
    return [...this.outfits.values()];
  }
  async deleteAccount() {}
}

const files = {
  dir: 'file:///docs/local/',
  copy: jest.fn().mockResolvedValue(undefined),
  remove: jest.fn().mockResolvedValue(undefined),
};

function makeLocal() {
  return new LocalRepo({
    userId: 'local-user',
    prefix: 'tenue-local:',
    storage: AsyncStorage,
    files,
    defaults: { locale: 'fr', timezone: 'Africa/Tunis' },
  });
}

async function seed(local: LocalRepo) {
  for (const row of [item('a'), item('b', false), item('c', true, '2026-10-01T00:00:00Z')]) {
    await local.saveItem(row);
    await local.uploadImage(`file:///tmp/${row.id}-cut`, row.image_path, 'image/webp');
    await local.uploadImage(`file:///tmp/${row.id}-orig`, row.original_path, 'image/jpeg');
  }
  await local.insertOutfit(outfit('2026-10-10', ['a', 'b']));
  await local.insertOutfit(outfit('2026-10-11', ['a', 'c']));
  await local.updateProfile({ push_time: '06:45:00', lat: 36.81, lon: 10.18 });
}

const noPending = { exists: () => false, uriFor: async (p: string) => `file:///pending/${p}` };
const missing = new Set<string>();
const opts = () => ({ pending: noPending, fileExists: (uri: string) => !missing.has(uri) });
const localUri = (name: string) => `file:///docs/local/local-user_${name}`;

beforeEach(async () => {
  await AsyncStorage.clear();
  missing.clear();
  jest.clearAllMocks();
});

describe('rewritePath', () => {
  it('moves a local path under the new user', () => {
    expect(rewritePath('local-user/a.webp', 'local-user', 'u2')).toBe('u2/a.webp');
    expect(rewritePath('other/a.webp', 'local-user', 'u2')).toBe('other/a.webp');
  });
});

describe('hasGuestData', () => {
  it('is false for an empty store and true with items or outfits', async () => {
    const local = makeLocal();
    await local.getProfile();
    expect(await hasGuestData(local)).toBe(false);
    await local.insertOutfit(outfit('2026-10-10', []));
    expect(await hasGuestData(local)).toBe(true);
  });
});

describe('migrateLocalToCloud', () => {
  it('moves images, items, outfits and settings into a fresh account, then clears the guest store', async () => {
    const local = makeLocal();
    await seed(local);
    const cloud = new FakeCloud();

    const result = await migrateLocalToCloud(local, cloud, createProgressStore(CLOUD_ID), opts());

    expect(result).toEqual({ items: 3, outfits: 2, skippedItems: [], copiedSettings: true, copiedLocation: true });
    expect([...cloud.images.entries()].map(([path, v]) => [path, v.contentType]).sort()).toEqual(
      [
        ['cloud-user/a-original.jpg', 'image/jpeg'],
        ['cloud-user/a.webp', 'image/webp'],
        ['cloud-user/b-original.jpg', 'image/jpeg'],
        ['cloud-user/c-original.jpg', 'image/jpeg'],
        ['cloud-user/c.webp', 'image/webp'],
      ].sort(),
    );
    expect(cloud.images.get('cloud-user/a.webp')?.from).toBe(localUri('a.webp'));
    expect(cloud.items.get('b')).toEqual({
      ...item('b', false),
      created_at: expect.any(String),
      user_id: CLOUD_ID,
      image_path: 'cloud-user/b-original.jpg',
      original_path: 'cloud-user/b-original.jpg',
    });
    expect(cloud.items.get('c')?.archived_at).toBe('2026-10-01T00:00:00Z');
    expect(cloud.outfits.get('2026-10-10')).toEqual({
      user_id: CLOUD_ID,
      date: '2026-10-10',
      item_ids: ['a', 'b'],
      weather,
      seed: 3,
      status: 'worn',
    });
    expect(cloud.profile).toEqual({
      id: CLOUD_ID,
      locale: 'fr',
      push_time: '06:45:00',
      timezone: 'Africa/Tunis',
      lat: 36.81,
      lon: 10.18,
      expo_push_token: null,
    });

    expect(await hasGuestData(local)).toBe(false);
    expect((await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('tenue-local:'))).toEqual([]);
    expect(await AsyncStorage.getItem('tenue-migrate:cloud-user')).toBeNull();
  });

  it('keeps the settings of an account that already has data', async () => {
    const local = makeLocal();
    await seed(local);
    const cloud = new FakeCloud();
    await cloud.saveItem({ ...item('x'), user_id: CLOUD_ID });
    cloud.profile = { ...cloud.profile, push_time: '06:00:00', locale: 'en', timezone: 'Europe/Paris', expo_push_token: 'ExponentPushToken[t]' };

    const result = await migrateLocalToCloud(local, cloud, createProgressStore(CLOUD_ID), opts());

    expect(result.copiedSettings).toBe(false);
    expect(cloud.profile).toEqual({
      id: CLOUD_ID,
      locale: 'en',
      push_time: '06:00:00',
      timezone: 'Europe/Paris',
      lat: 36.81,
      lon: 10.18,
      expo_push_token: 'ExponentPushToken[t]',
    });
  });

  it('keeps the cloud row when an outfit date already exists', async () => {
    const local = makeLocal();
    await seed(local);
    const cloud = new FakeCloud();
    const existing: OutfitRow = { ...outfit('2026-10-11', ['x']), user_id: CLOUD_ID, status: 'suggested' };
    cloud.outfits.set('2026-10-11', existing);

    await migrateLocalToCloud(local, cloud, createProgressStore(CLOUD_ID), opts());

    expect(cloud.outfits.get('2026-10-11')).toBe(existing);
    expect(cloud.outfits.get('2026-10-10')?.item_ids).toEqual(['a', 'b']);
  });

  it('does not overwrite a cloud location', async () => {
    const local = makeLocal();
    await seed(local);
    const cloud = new FakeCloud();
    cloud.profile = { ...cloud.profile, lat: 1, lon: 2 };

    const result = await migrateLocalToCloud(local, cloud, createProgressStore(CLOUD_ID), opts());

    expect(cloud.profile).toMatchObject({ lat: 1, lon: 2, locale: 'fr' });
    expect(result.copiedLocation).toBe(false);
  });

  it('resumes after a failure without redoing finished steps and keeps the first freshness check', async () => {
    const local = makeLocal();
    await seed(local);
    const cloud = new FakeCloud();
    cloud.failUploadAt = 'cloud-user/b-original.jpg';

    await expect(migrateLocalToCloud(local, cloud, createProgressStore(CLOUD_ID), opts())).rejects.toThrow('network');
    expect(await hasGuestData(local)).toBe(true);
    const doneAfterFailure = JSON.parse((await AsyncStorage.getItem('tenue-migrate:cloud-user')) ?? '[]');
    expect(doneAfterFailure).toEqual(expect.arrayContaining(['cloud:fresh', 'image:local-user/a.webp']));
    const uploadsBefore = cloud.uploads;

    const result = await migrateLocalToCloud(local, cloud, createProgressStore(CLOUD_ID), opts());

    expect(cloud.uploads - uploadsBefore).toBe(5 - uploadsBefore);
    expect(cloud.images.size).toBe(5);
    expect(cloud.items.size).toBe(3);
    expect(result.copiedSettings).toBe(true);
    expect(cloud.profile.push_time).toBe('06:45:00');
    expect(await hasGuestData(local)).toBe(false);
  });

  it('survives an upload that succeeded before its step could be marked', async () => {
    const local = makeLocal();
    await seed(local);
    const cloud = new FakeCloud();
    const real = createProgressStore(CLOUD_ID);
    let failed = false;
    const flaky = {
      ...real,
      load: () => real.load(),
      clear: () => real.clear(),
      mark: async (name: string) => {
        if (!failed && name.startsWith('image:')) {
          failed = true;
          throw new Error('storage full');
        }
        await real.mark(name);
      },
    };

    await expect(migrateLocalToCloud(local, cloud, flaky, opts())).rejects.toThrow('storage full');
    expect(cloud.images.size).toBe(1);

    await migrateLocalToCloud(local, cloud, createProgressStore(CLOUD_ID), opts());

    expect(cloud.images.size).toBe(5);
    expect(cloud.items.size).toBe(3);
    expect(await hasGuestData(local)).toBe(false);
  });

  it('uploads from the pending folder when the local copy is missing', async () => {
    const local = makeLocal();
    await local.saveItem(item('a'));
    const cloud = new FakeCloud();
    const pending = { exists: (p: string) => p.startsWith('local-user/a'), uriFor: async (p: string) => `file:///pending/${p}` };

    await migrateLocalToCloud(local, cloud, createProgressStore(CLOUD_ID), { pending, fileExists: () => false });

    expect(cloud.images.get('cloud-user/a.webp')).toEqual({
      from: 'file:///pending/local-user/a.webp',
      contentType: 'image/webp',
    });
    expect(cloud.items.get('a')?.image_path).toBe('cloud-user/a.webp');
  });

  it('falls back to the original photo when the cut-out file is gone', async () => {
    const local = makeLocal();
    await seed(local);
    missing.add(localUri('a.webp'));
    const cloud = new FakeCloud();

    const result = await migrateLocalToCloud(local, cloud, createProgressStore(CLOUD_ID), opts());

    expect(result.skippedItems).toEqual([]);
    expect(cloud.images.has('cloud-user/a.webp')).toBe(false);
    expect(cloud.items.get('a')).toMatchObject({
      image_path: 'cloud-user/a-original.jpg',
      original_path: 'cloud-user/a-original.jpg',
    });
  });

  it('skips a piece with no files at all and drops it from outfits', async () => {
    const local = makeLocal();
    await seed(local);
    missing.add(localUri('c.webp'));
    missing.add(localUri('c-original.jpg'));
    missing.add(localUri('b-original.jpg'));
    const cloud = new FakeCloud();

    const result = await migrateLocalToCloud(local, cloud, createProgressStore(CLOUD_ID), opts());

    expect(result.skippedItems).toEqual(['b', 'c']);
    expect([...cloud.items.keys()]).toEqual(['a']);
    expect(cloud.outfits.get('2026-10-10')?.item_ids).toEqual(['a']);
    expect(cloud.outfits.get('2026-10-11')?.item_ids).toEqual(['a']);
    expect(await hasGuestData(local)).toBe(false);
  });

  it('skips an outfit whose pieces are all gone', async () => {
    const local = makeLocal();
    await local.saveItem(item('a'));
    await local.insertOutfit(outfit('2026-10-12', ['a']));
    missing.add(localUri('a.webp'));
    missing.add(localUri('a-original.jpg'));
    const cloud = new FakeCloud();

    const result = await migrateLocalToCloud(local, cloud, createProgressStore(CLOUD_ID), opts());

    expect(result).toMatchObject({ items: 0, outfits: 0, skippedItems: ['a'] });
    expect(cloud.outfits.size).toBe(0);
    expect(await hasGuestData(local)).toBe(false);
  });

  it('clears its progress before wiping the guest store', async () => {
    const local = makeLocal();
    await local.saveItem(item('a'));
    const cloud = new FakeCloud();
    const order: string[] = [];
    const real = createProgressStore(CLOUD_ID);
    const spyProgress = { ...real, load: () => real.load(), mark: (n: string) => real.mark(n), clear: async () => {
      order.push('clear');
      await real.clear();
    } };
    const wipe = jest.spyOn(local, 'deleteAccount').mockImplementation(async () => {
      order.push('wipe');
    });

    await migrateLocalToCloud(local, cloud, spyProgress, opts());

    expect(order).toEqual(['clear', 'wipe']);
    wipe.mockRestore();
  });
});
