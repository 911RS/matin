import 'fake-indexeddb/auto';
import { clear, createStore, set } from 'idb-keyval';

type FilesWeb = typeof import('../files.web');

const urls: string[] = [];
const revoked: string[] = [];
const sources = new Map<string, Blob>();

beforeAll(() => {
  let n = 0;
  URL.createObjectURL = () => {
    const url = `blob:test/${++n}`;
    urls.push(url);
    return url;
  };
  URL.revokeObjectURL = (url: string) => {
    revoked.push(url);
  };
  globalThis.fetch = (async (input: string) => {
    const blob = sources.get(input);
    if (!blob) return { ok: false } as Response;
    return { ok: true, blob: async () => blob } as Response;
  }) as typeof fetch;
});

beforeEach(async () => {
  urls.length = 0;
  revoked.length = 0;
  sources.clear();
  await clear(createStore('tenue-files', 'files'));
});

function load(): FilesWeb {
  let mod!: FilesWeb;
  jest.isolateModules(() => {
    mod = require('../files.web') as FilesWeb;
  });
  return mod;
}

function source(url: string, text: string): void {
  sources.set(url, new Blob([text], { type: 'image/webp' }));
}

describe('files.web', () => {
  it('round-trips a copied file and returns an object URL', async () => {
    const files = load();
    await files.filesReady();
    source('blob:src/1', 'hello');
    const to = `${files.documentDir('local')}u_item.webp`;
    expect(files.fileExists(to)).toBe(false);
    await files.copyFile('blob:src/1', to);
    expect(files.fileExists(to)).toBe(true);
    const url = await files.readableUri(to);
    expect(url).toMatch(/^blob:test\//);
    await expect(files.readableUri(to)).resolves.toBe(url);
    expect(new TextDecoder().decode(await files.readBytes(to))).toBe('hello');
  });

  it('keeps files across a reload', async () => {
    const first = load();
    await first.filesReady();
    source('blob:src/1', 'kept');
    const to = `${first.documentDir('local')}a.webp`;
    await first.copyFile('blob:src/1', to);
    const second = load();
    expect(second.fileExists(to)).toBe(false);
    await second.filesReady();
    expect(second.fileExists(to)).toBe(true);
    expect(new TextDecoder().decode(await second.readBytes(to))).toBe('kept');
  });

  it('lists by directory prefix and isolates guest and demo', async () => {
    const files = load();
    await files.filesReady();
    source('blob:src/1', 'x');
    const guest = files.documentDir('local');
    const demo = files.documentDir('demo');
    await files.copyFile('blob:src/1', `${guest}a.webp`);
    await files.copyFile('blob:src/1', `${guest}b.webp`);
    await files.copyFile('blob:src/1', `${demo}c.webp`);
    expect(files.listFiles(guest).sort()).toEqual(['a.webp', 'b.webp']);
    expect(files.listFiles(demo)).toEqual(['c.webp']);
    expect(files.listFiles(files.documentDir('pending'))).toEqual([]);
    files.deleteFile(`${guest}a.webp`);
    expect(files.listFiles(guest)).toEqual(['b.webp']);
    expect(files.listFiles(demo)).toEqual(['c.webp']);
  });

  it('removes a file from the index and from IndexedDB', async () => {
    const files = load();
    await files.filesReady();
    source('blob:src/1', 'x');
    const to = `${files.documentDir('local')}a.webp`;
    await files.copyFile('blob:src/1', to);
    await files.readableUri(to);
    files.deleteFile(to);
    expect(files.fileExists(to)).toBe(false);
    expect(revoked).toEqual(urls);
    const again = load();
    await again.filesReady();
    expect(again.fileExists(to)).toBe(false);
  });

  it('revokes the object URL when a file is replaced', async () => {
    const files = load();
    await files.filesReady();
    source('blob:src/1', 'one');
    source('blob:src/2', 'two');
    const to = `${files.documentDir('local')}a.webp`;
    await files.copyFile('blob:src/1', to);
    const first = await files.readableUri(to);
    await files.copyFile('blob:src/2', to);
    expect(revoked).toEqual([first]);
    const second = await files.readableUri(to);
    expect(second).not.toBe(first);
    expect(new TextDecoder().decode(await files.readBytes(to))).toBe('two');
  });

  it('copies from another stored file', async () => {
    const files = load();
    await files.filesReady();
    source('blob:src/1', 'shared');
    const from = `${files.documentDir('local')}a.webp`;
    const to = `${files.documentDir('pending')}u~a.webp`;
    await files.copyFile('blob:src/1', from);
    await files.copyFile(from, to);
    expect(new TextDecoder().decode(await files.readBytes(to))).toBe('shared');
  });

  it('treats an object URL it handed out as an existing file', async () => {
    const files = load();
    await files.filesReady();
    source('blob:src/1', 'x');
    const to = `${files.documentDir('local')}a.webp`;
    await files.copyFile('blob:src/1', to);
    expect(files.fileExists(await files.readableUri(to))).toBe(true);
    expect(files.fileExists('blob:test/unknown')).toBe(false);
  });

  it('rejects when the source cannot be read', async () => {
    const files = load();
    await files.filesReady();
    await expect(files.copyFile('blob:src/missing', `${files.documentDir('local')}a.webp`)).rejects.toThrow();
  });

  it('asks the browser for persistent storage once', async () => {
    const persist = jest.fn(async () => true);
    Object.defineProperty(globalThis, 'navigator', {
      value: { storage: { persist } },
      configurable: true,
    });
    const files = load();
    await files.filesReady();
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('does not wait for the persistent storage answer', async () => {
    const persist = jest.fn(() => new Promise<boolean>(() => {}));
    Object.defineProperty(globalThis, 'navigator', {
      value: { storage: { persist } },
      configurable: true,
    });
    const files = load();
    await files.filesReady();
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('ignores a rejected persistent storage request', async () => {
    const persist = jest.fn(() => Promise.reject(new Error('denied')));
    Object.defineProperty(globalThis, 'navigator', {
      value: { storage: { persist } },
      configurable: true,
    });
    const files = load();
    await files.filesReady();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('indexes only keys at start-up and loads a blob on first use', async () => {
    const first = load();
    await first.filesReady();
    source('blob:src/1', 'old');
    const to = `${first.documentDir('local')}a.webp`;
    await first.copyFile('blob:src/1', to);
    const second = load();
    await second.filesReady();
    const changed = new TextEncoder().encode('new');
    await set(to, { type: 'image/webp', data: changed.buffer }, createStore('tenue-files', 'files'));
    expect(urls).toEqual([]);
    expect(new TextDecoder().decode(await second.readBytes(to))).toBe('new');
  });

  it('creates one object URL per key, also for concurrent callers', async () => {
    const first = load();
    await first.filesReady();
    source('blob:src/1', 'x');
    const to = `${first.documentDir('local')}a.webp`;
    await first.copyFile('blob:src/1', to);
    urls.length = 0;
    const second = load();
    await second.filesReady();
    const [a, b] = await Promise.all([second.readableUri(to), second.readableUri(to)]);
    expect(a).toBe(b);
    await expect(second.readableUri(to)).resolves.toBe(a);
    expect(urls).toEqual([a]);
  });

  it('passes unknown URIs through', async () => {
    const files = load();
    await expect(files.readableUri('https://cdn/a.webp')).resolves.toBe('https://cdn/a.webp');
    expect(urls).toEqual([]);
  });

  it('revokes a temporary object URL it did not create when deleted', async () => {
    const files = load();
    await files.filesReady();
    source('blob:src/1', 'x');
    const to = `${files.documentDir('local')}a.webp`;
    await files.copyFile('blob:src/1', to);
    const own = await files.readableUri(to);
    files.deleteFile(own);
    expect(files.fileExists(to)).toBe(true);
    expect(revoked).toEqual([]);
    files.deleteFile('blob:tmp/cutout');
    expect(revoked).toEqual(['blob:tmp/cutout']);
  });
});
