import { createStore, del, get, keys, set } from 'idb-keyval';

const ROOT = 'idb://';
const store = createStore('tenue-files', 'files');
const stored = new Set<string>();
const blobs = new Map<string, Blob>();
const loading = new Map<string, Promise<Blob>>();
const urls = new Map<string, string>();

type StoredFile = { type: string; data: ArrayBuffer };

const ready: Promise<void> = hydrate();

function requestPersistence(): void {
  try {
    navigator.storage?.persist?.().catch(() => {});
  } catch {}
}

async function hydrate(): Promise<void> {
  requestPersistence();
  try {
    for (const key of await keys(store)) if (typeof key === 'string') stored.add(key);
  } catch {}
}

export function filesReady(): Promise<void> {
  return ready;
}

export function documentDir(folder: string): string {
  return `${ROOT}${folder}/`;
}

function releaseUrl(uri: string): void {
  const url = urls.get(uri);
  if (url === undefined) return;
  URL.revokeObjectURL(url);
  urls.delete(uri);
}

function forget(uri: string): void {
  releaseUrl(uri);
  blobs.delete(uri);
  loading.delete(uri);
}

function keyForUrl(url: string): string | null {
  for (const [key, value] of urls) if (value === url) return key;
  return null;
}

function load(key: string): Promise<Blob> {
  const cached = blobs.get(key);
  if (cached) return Promise.resolve(cached);
  let pending = loading.get(key);
  if (!pending) {
    pending = get<StoredFile>(key, store).then((value) => {
      if (!value) throw new Error(`Missing ${key}`);
      const blob = new Blob([value.data], { type: value.type });
      if (loading.get(key) === pending) {
        loading.delete(key);
        blobs.set(key, blob);
      }
      return blob;
    });
    loading.set(key, pending);
    pending.catch(() => {
      if (loading.get(key) === pending) loading.delete(key);
    });
  }
  return pending;
}

async function blobFor(uri: string): Promise<Blob> {
  const key = stored.has(uri) ? uri : keyForUrl(uri);
  if (key !== null) return load(key);
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`Could not read ${uri}`);
  return response.blob();
}

export async function copyFile(from: string, to: string): Promise<void> {
  await ready;
  const blob = await blobFor(from);
  await set(to, { type: blob.type, data: await blob.arrayBuffer() } satisfies StoredFile, store);
  forget(to);
  stored.add(to);
  blobs.set(to, blob);
}

export function fileExists(uri: string): boolean {
  return stored.has(uri) || keyForUrl(uri) !== null;
}

export function deleteFile(uri: string): void {
  if (!stored.has(uri)) {
    if (uri.startsWith('blob:') && keyForUrl(uri) === null) URL.revokeObjectURL(uri);
    return;
  }
  forget(uri);
  stored.delete(uri);
  void del(uri, store).catch(() => {});
}

export function listFiles(dir: string): string[] {
  const names: string[] = [];
  for (const uri of stored) {
    if (!uri.startsWith(dir)) continue;
    const name = uri.slice(dir.length);
    if (name && !name.includes('/')) names.push(name);
  }
  return names;
}

export async function readBytes(uri: string): Promise<Uint8Array> {
  await ready;
  return new Uint8Array(await (await blobFor(uri)).arrayBuffer());
}

export async function readableUri(uri: string): Promise<string> {
  await ready;
  if (!stored.has(uri)) return uri;
  const cached = urls.get(uri);
  if (cached !== undefined) return cached;
  const blob = await load(uri);
  const current = urls.get(uri);
  if (current !== undefined) return current;
  if (!stored.has(uri)) return uri;
  if (blobs.get(uri) !== blob) return readableUri(uri);
  const url = URL.createObjectURL(blob);
  urls.set(uri, url);
  return url;
}
