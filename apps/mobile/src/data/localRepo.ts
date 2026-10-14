import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { copyFile, deleteFile, documentDir, readableUri } from './files';
import type { ItemRow, OutfitRow, ProfileRow } from '@tenue/backend';
import type { ImageContentType, OutfitPatch, ProfilePatch, Repo } from './repo';

export const DEMO_USER_ID = 'demo-user';
export const LOCAL_USER_ID = 'local-user';
const K_PROFILE = 'profile';
const K_ITEMS = 'items';
const K_OUTFITS = 'outfits';
const K_IMAGES = 'images';

export interface AsyncStorageLike {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
  multiRemove(keys: readonly string[]): Promise<void>;
}

export interface LocalFiles {
  copy(from: string, to: string): Promise<void>;
  remove(uri: string): Promise<void>;
  readable?(uri: string): Promise<string>;
  dir: string;
}

export interface LocalDeps {
  userId: string;
  prefix: string;
  storage: AsyncStorageLike;
  files: LocalFiles;
  defaults?: { locale: 'en' | 'fr'; timezone: string };
}

function deviceDefaults(): { locale: 'en' | 'fr'; timezone: string } {
  const code = getLocales()[0]?.languageCode;
  return {
    locale: code?.toLowerCase().startsWith('fr') ? 'fr' : 'en',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  };
}

export class LocalRepo implements Repo {
  constructor(private readonly deps: LocalDeps) {}

  private async read<T>(key: string, fallback: T): Promise<T> {
    const raw = await this.deps.storage.getItem(this.deps.prefix + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  }

  private write(key: string, value: unknown): Promise<void> {
    return this.deps.storage.setItem(this.deps.prefix + key, JSON.stringify(value));
  }

  async userId(): Promise<string | null> {
    return this.deps.userId;
  }

  async getProfile(): Promise<ProfileRow> {
    const existing = await this.read<ProfileRow | null>(K_PROFILE, null);
    if (existing) return existing;
    const d = this.deps.defaults ?? deviceDefaults();
    const profile: ProfileRow = {
      id: this.deps.userId,
      locale: d.locale,
      push_time: '07:30:00',
      timezone: d.timezone,
      lat: null,
      lon: null,
      expo_push_token: null,
    };
    await this.write(K_PROFILE, profile);
    return profile;
  }

  async updateProfile(patch: ProfilePatch): Promise<void> {
    const profile = await this.getProfile();
    await this.write(K_PROFILE, { ...profile, ...patch });
  }

  async claimPushToken(token: string | null): Promise<void> {
    const profile = await this.getProfile();
    await this.write(K_PROFILE, { ...profile, expo_push_token: token });
  }

  async listItems(opts?: { includeArchived?: boolean }): Promise<ItemRow[]> {
    const stored = await this.read<ItemRow[]>(K_ITEMS, []);
    const stamp = new Date().toISOString();
    const missing = stored.some((i) => !i.created_at);
    const items = stored.map((i) => ({ ...i, unavailable_until: i.unavailable_until ?? null, created_at: i.created_at ?? stamp }));
    if (missing) await this.write(K_ITEMS, items);
    return opts?.includeArchived ? items : items.filter((i) => i.archived_at === null);
  }

  async saveItem(row: ItemRow): Promise<void> {
    const items = await this.read<ItemRow[]>(K_ITEMS, []);
    const idx = items.findIndex((i) => i.id === row.id);
    if (idx >= 0) items[idx] = { ...row, created_at: row.created_at ?? items[idx]!.created_at };
    else items.push({ ...row, created_at: row.created_at ?? new Date().toISOString() });
    await this.write(K_ITEMS, items);
  }

  async uploadImage(localUri: string, path: string, _contentType: ImageContentType): Promise<void> {
    const name = path.replace(/\//g, '_');
    await this.deps.files.copy(localUri, `${this.deps.files.dir}${name}`);
    const images = await this.read<Record<string, string>>(K_IMAGES, {});
    images[path] = name;
    await this.write(K_IMAGES, images);
  }

  async imageUrl(path: string): Promise<string> {
    const images = await this.read<Record<string, string>>(K_IMAGES, {});
    const name = images[path];
    if (!name) throw new Error(`demo image not found: ${path}`);
    const uri = `${this.deps.files.dir}${name}`;
    return this.deps.files.readable ? await this.deps.files.readable(uri) : uri;
  }

  async getOutfit(date: string): Promise<OutfitRow | null> {
    const outfits = await this.read<OutfitRow[]>(K_OUTFITS, []);
    return outfits.find((o) => o.date === date) ?? null;
  }

  async insertOutfit(row: OutfitRow): Promise<'inserted' | 'conflict'> {
    const outfits = await this.read<OutfitRow[]>(K_OUTFITS, []);
    if (outfits.some((o) => o.date === row.date)) return 'conflict';
    const { pushed_at: _pushedAt, ...rest } = row;
    outfits.push({ ...rest, id: rest.id ?? `demo-outfit-${row.date}` });
    await this.write(K_OUTFITS, outfits);
    return 'inserted';
  }

  async updateOutfit(date: string, patch: OutfitPatch): Promise<void> {
    const outfits = await this.read<OutfitRow[]>(K_OUTFITS, []);
    const idx = outfits.findIndex((o) => o.date === date);
    if (idx < 0) return;
    if (patch.status === undefined && outfits[idx]!.status === 'worn') return;
    outfits[idx] = { ...outfits[idx], ...patch };
    await this.write(K_OUTFITS, outfits);
  }

  async listOutfits(fromDate: string, toDate: string): Promise<OutfitRow[]> {
    const outfits = await this.read<OutfitRow[]>(K_OUTFITS, []);
    return outfits
      .filter((o) => o.date >= fromDate && o.date <= toDate)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async deleteAccount(): Promise<void> {
    const images = await this.read<Record<string, string>>(K_IMAGES, {});
    for (const name of Object.values(images)) await this.deps.files.remove(`${this.deps.files.dir}${name}`);
    const keys = (await this.deps.storage.getAllKeys()).filter((k) => k.startsWith(this.deps.prefix));
    await this.deps.storage.multiRemove(keys);
  }
}

export type LocalKind = 'guest' | 'demo';

const KINDS = {
  guest: { userId: LOCAL_USER_ID, prefix: 'tenue-local:', folder: 'local' },
  demo: { userId: DEMO_USER_ID, prefix: 'tenue-demo:', folder: 'demo' },
} as const;

export function createLocalRepo({ kind }: { kind: LocalKind }): LocalRepo {
  const { userId, prefix, folder } = KINDS[kind];
  return new LocalRepo({
    userId,
    prefix,
    storage: AsyncStorage,
    files: {
      dir: documentDir(folder),
      copy: copyFile,
      async remove(uri) {
        deleteFile(uri);
      },
      readable: readableUri,
    },
  });
}
