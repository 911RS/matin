import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ItemRow, OutfitRow } from '@tenue/backend';
import { LocalRepo } from '../localRepo';

const weather = { feelsLikeC: 18, rain: false };

function item(id: string, archived: string | null = null): ItemRow {
  return {
    id,
    user_id: 'demo-user',
    category: 'top',
    color_hex: '#112233',
    color_family: 'blue',
    warmth: 2,
    formality: 'casual',
    image_path: `demo-user/${id}.webp`,
    original_path: `demo-user/${id}.jpg`,
    archived_at: archived,
    unavailable_until: null,
  };
}

function outfit(date: string): OutfitRow {
  return { user_id: 'demo-user', date, item_ids: ['a'], weather, seed: 1, status: 'suggested' };
}

function make() {
  const files = {
    dir: 'file:///docs/demo/',
    copy: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  const repo = new LocalRepo({
    userId: 'demo-user',
    prefix: 'tenue-demo:',
    storage: AsyncStorage,
    files,
    defaults: { locale: 'fr', timezone: 'Europe/Paris' },
  });
  return { repo, files };
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('LocalRepo', () => {
  it('creates and persists a default profile', async () => {
    const { repo } = make();
    expect(await repo.userId()).toBe('demo-user');
    const p = await repo.getProfile();
    expect(p).toEqual({
      id: 'demo-user',
      locale: 'fr',
      push_time: '07:30:00',
      timezone: 'Europe/Paris',
      lat: null,
      lon: null,
      expo_push_token: null,
    });
    await repo.updateProfile({ lat: 1.5, lon: 2.5 });
    expect(await repo.getProfile()).toMatchObject({ lat: 1.5, lon: 2.5, push_time: '07:30:00' });
  });

  it('claimPushToken sets and clears the token', async () => {
    const { repo } = make();
    await repo.claimPushToken('tok');
    expect((await repo.getProfile()).expo_push_token).toBe('tok');
    await repo.claimPushToken(null);
    expect((await repo.getProfile()).expo_push_token).toBeNull();
  });

  it('hides archived items unless asked', async () => {
    const { repo } = make();
    await repo.saveItem(item('a'));
    await repo.saveItem(item('b', '2026-10-01T00:00:00Z'));
    expect((await repo.listItems()).map((i) => i.id)).toEqual(['a']);
    expect((await repo.listItems({ includeArchived: true })).map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('upserts items by id', async () => {
    const { repo } = make();
    await repo.saveItem(item('a'));
    await repo.saveItem({ ...item('a'), color_hex: '#ffffff' });
    const items = await repo.listItems();
    expect(items).toHaveLength(1);
    expect(items[0].color_hex).toBe('#ffffff');
  });

  it('stores unavailable_until and reads old rows without it as null', async () => {
    const { repo } = make();
    await repo.saveItem({ ...item('a'), unavailable_until: '2026-10-15' });
    expect((await repo.listItems())[0].unavailable_until).toBe('2026-10-15');
    const { unavailable_until: _, ...legacy } = item('b');
    await AsyncStorage.setItem('tenue-demo:items', JSON.stringify([legacy]));
    expect((await repo.listItems())[0].unavailable_until).toBeNull();
  });

  it('backfills created_at once for items stored without it', async () => {
    const { repo } = make();
    const { created_at: _, ...legacy } = item('a');
    await AsyncStorage.setItem('tenue-demo:items', JSON.stringify([legacy]));
    const first = (await repo.listItems())[0].created_at;
    expect(first).toEqual(expect.any(String));
    expect(JSON.parse((await AsyncStorage.getItem('tenue-demo:items'))!)[0].created_at).toBe(first);
    expect((await repo.listItems())[0].created_at).toBe(first);
  });

  it('returns conflict when an outfit exists for the date', async () => {
    const { repo } = make();
    expect(await repo.insertOutfit(outfit('2026-10-12'))).toBe('inserted');
    expect(await repo.insertOutfit(outfit('2026-10-12'))).toBe('conflict');
    expect((await repo.getOutfit('2026-10-12'))?.seed).toBe(1);
    expect(await repo.getOutfit('2026-10-13')).toBeNull();
  });

  it('updates and lists outfits by range', async () => {
    const { repo } = make();
    await repo.insertOutfit(outfit('2026-10-10'));
    await repo.insertOutfit(outfit('2026-10-12'));
    await repo.updateOutfit('2026-10-12', { status: 'worn', seed: 9 });
    const rows = await repo.listOutfits('2026-10-11', '2026-10-13');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'worn', seed: 9 });
  });

  it('leaves a worn outfit alone unless the patch sets the status', async () => {
    const { repo } = make();
    await repo.insertOutfit(outfit('2026-10-12'));
    await repo.updateOutfit('2026-10-12', { status: 'worn' });
    await repo.updateOutfit('2026-10-12', { item_ids: ['x'], seed: 42 });
    expect(await repo.getOutfit('2026-10-12')).toMatchObject({ status: 'worn', seed: 1 });
    await repo.updateOutfit('2026-10-12', { status: 'suggested', seed: 5 });
    expect(await repo.getOutfit('2026-10-12')).toMatchObject({ status: 'suggested', seed: 5 });
  });

  it('copies uploaded images and resolves their local uri', async () => {
    const { repo, files } = make();
    await repo.uploadImage('file:///tmp/x.webp', 'demo-user/a.webp', 'image/webp');
    expect(files.copy).toHaveBeenCalledWith('file:///tmp/x.webp', 'file:///docs/demo/demo-user_a.webp');
    expect(await repo.imageUrl('demo-user/a.webp')).toBe('file:///docs/demo/demo-user_a.webp');
    await expect(repo.imageUrl('missing')).rejects.toThrow();
  });

  it('resolves images against the current files dir', async () => {
    const { repo, files } = make();
    await repo.uploadImage('file:///tmp/x.webp', 'demo-user/a.webp', 'image/webp');
    files.dir = 'file:///new-container/demo/';
    expect(await repo.imageUrl('demo-user/a.webp')).toBe('file:///new-container/demo/demo-user_a.webp');
    await repo.deleteAccount();
    expect(files.remove).toHaveBeenCalledWith('file:///new-container/demo/demo-user_a.webp');
  });

  it('deleteAccount clears demo keys and files only', async () => {
    const { repo, files } = make();
    await repo.getProfile();
    await repo.saveItem(item('a'));
    await repo.uploadImage('file:///tmp/x.webp', 'demo-user/a.webp', 'image/webp');
    await AsyncStorage.setItem('other', '1');
    await repo.deleteAccount();
    expect(files.remove).toHaveBeenCalledWith('file:///docs/demo/demo-user_a.webp');
    expect((await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('tenue-demo:'))).toEqual([]);
    expect(await AsyncStorage.getItem('other')).toBe('1');
  });

  it('uses the user id it is given', async () => {
    const repo = new LocalRepo({
      userId: 'local-user',
      prefix: 'tenue-local:',
      storage: AsyncStorage,
      files: { dir: 'file:///docs/demo/', copy: jest.fn(), remove: jest.fn() },
      defaults: { locale: 'en', timezone: 'UTC' },
    });
    expect(await repo.userId()).toBe('local-user');
    expect((await repo.getProfile()).id).toBe('local-user');
  });

  it('keeps guest and demo stores isolated', async () => {
    const mk = (userId: string, prefix: string) =>
      new LocalRepo({
        userId,
        prefix,
        storage: AsyncStorage,
        files: { dir: 'file:///docs/x/', copy: jest.fn(), remove: jest.fn() },
        defaults: { locale: 'en', timezone: 'UTC' },
      });
    const guest = mk('local-user', 'tenue-local:');
    const demo = mk('demo-user', 'tenue-demo:');
    await guest.saveItem(item('g1'));
    await demo.saveItem(item('d1'));
    expect((await guest.listItems()).map((i) => i.id)).toEqual(['g1']);
    expect((await demo.listItems()).map((i) => i.id)).toEqual(['d1']);
    await demo.deleteAccount();
    expect((await guest.listItems()).map((i) => i.id)).toEqual(['g1']);
    expect(await demo.listItems()).toEqual([]);
  });
});
