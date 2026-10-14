import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ItemRow, OutfitRow } from '@tenue/backend';
import { contentTypeFor } from '../closet/uploads';
import { pendingFiles } from '../closet/pending';
import type { PendingFiles } from '../closet/pending';
import { fileExists } from '../data/files';
import type { ProfilePatch, Repo } from '../data/repo';

const ALL_FROM = '0000-01-01';
const ALL_TO = '9999-12-31';

export interface ProgressStore {
  load(): Promise<Set<string>>;
  mark(step: string): Promise<void>;
  clear(): Promise<void>;
}

type StorageLike = Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>;

export function migrateKey(userId: string): string {
  return `tenue-migrate:${userId}`;
}

export function createProgressStore(userId: string, storage: StorageLike = AsyncStorage): ProgressStore {
  const key = migrateKey(userId);
  let done: Set<string> | null = null;
  return {
    async load() {
      const raw = await storage.getItem(key);
      done = new Set(raw ? (JSON.parse(raw) as string[]) : []);
      return new Set(done);
    },
    async mark(step) {
      if (!done) await this.load();
      done!.add(step);
      await storage.setItem(key, JSON.stringify([...done!]));
    },
    async clear() {
      done = new Set();
      await storage.removeItem(key);
    },
  };
}

export function rewritePath(path: string, fromId: string, toId: string): string {
  const prefix = `${fromId}/`;
  return path.startsWith(prefix) ? `${toId}/${path.slice(prefix.length)}` : path;
}

export async function hasGuestData(local: Pick<Repo, 'listItems' | 'listOutfits'>): Promise<boolean> {
  const items = await local.listItems({ includeArchived: true });
  if (items.length > 0) return true;
  return (await local.listOutfits(ALL_FROM, ALL_TO)).length > 0;
}

export interface MigrationOptions {
  pending?: Pick<PendingFiles, 'exists' | 'uriFor'>;
  fileExists?: (uri: string) => boolean;
}

export interface MigrationResult {
  items: number;
  outfits: number;
  skippedItems: string[];
  copiedSettings: boolean;
  copiedLocation: boolean;
}

function defaultFileExists(uri: string): boolean {
  try {
    return fileExists(uri);
  } catch {
    return false;
  }
}

const FRESH = 'cloud:fresh';
const USED = 'cloud:used';
const LOCATION_COPIED = 'profile:location';

export async function migrateLocalToCloud(
  local: Repo,
  cloud: Repo,
  progress: ProgressStore,
  opts: MigrationOptions = {},
): Promise<MigrationResult> {
  const pending = opts.pending ?? pendingFiles;
  const fileExists = opts.fileExists ?? defaultFileExists;
  const fromId = await local.userId();
  const toId = await cloud.userId();
  if (!fromId || !toId) throw new Error('migration needs both users');
  const move = (path: string) => rewritePath(path, fromId, toId);

  const done = await progress.load();
  const mark = async (name: string) => {
    done.add(name);
    await progress.mark(name);
  };
  const step = async (name: string, run: () => Promise<unknown>) => {
    if (done.has(name)) return;
    await run();
    await mark(name);
  };

  if (!done.has(FRESH) && !done.has(USED)) {
    const cloudFresh = !(await hasGuestData(cloud));
    await mark(cloudFresh ? FRESH : USED);
  }
  const fresh = done.has(FRESH);

  const resolve = async (path: string): Promise<string | null> => {
    const uri = await local.imageUrl(path).catch(() => null);
    if (uri && fileExists(uri)) return uri;
    return pending.exists(path) ? pending.uriFor(path) : null;
  };

  const items = await local.listItems({ includeArchived: true });
  const outfits = await local.listOutfits(ALL_FROM, ALL_TO);
  const profile = await local.getProfile();

  const uploads = new Map<string, string>();
  const kept: ItemRow[] = [];
  const skippedItems: string[] = [];
  for (const item of items) {
    const imageUri = await resolve(item.image_path);
    const originalUri = await resolve(item.original_path);
    if (!imageUri && !originalUri) {
      skippedItems.push(item.id);
      continue;
    }
    const imagePath = imageUri ? item.image_path : item.original_path;
    const originalPath = originalUri ? item.original_path : item.image_path;
    if (imageUri) uploads.set(item.image_path, imageUri);
    if (originalUri) uploads.set(item.original_path, originalUri);
    kept.push({ ...item, image_path: imagePath, original_path: originalPath });
  }

  for (const [path, uri] of uploads) {
    await step(`image:${path}`, () => cloud.uploadImage(uri, move(path), contentTypeFor(path)));
  }

  for (const item of kept) {
    await step(`item:${item.id}`, () =>
      cloud.saveItem({
        ...item,
        user_id: toId,
        image_path: move(item.image_path),
        original_path: move(item.original_path),
      } satisfies ItemRow),
    );
  }

  const keptIds = new Set(kept.map((i) => i.id));
  let movedOutfits = 0;
  for (const outfit of outfits) {
    const itemIds = outfit.item_ids.filter((id) => keptIds.has(id));
    if (itemIds.length === 0) continue;
    movedOutfits += 1;
    await step(`outfit:${outfit.date}`, () => {
      const { id: _id, pushed_at: _pushedAt, ...rest } = outfit;
      return cloud.insertOutfit({ ...rest, item_ids: itemIds, user_id: toId } satisfies OutfitRow);
    });
  }

  await step('profile', async () => {
    const current = await cloud.getProfile();
    const patch: ProfilePatch = fresh
      ? { locale: profile.locale, push_time: profile.push_time, timezone: profile.timezone }
      : {};
    const location = profile.lat !== null && profile.lon !== null && (current.lat === null || current.lon === null);
    if (location) Object.assign(patch, { lat: profile.lat, lon: profile.lon });
    if (Object.keys(patch).length > 0) await cloud.updateProfile(patch);
    if (location) await mark(LOCATION_COPIED);
  });

  const copiedLocation = done.has(LOCATION_COPIED);
  await progress.clear();
  await local.deleteAccount();
  return { items: kept.length, outfits: movedOutfits, skippedItems, copiedSettings: fresh, copiedLocation };
}
