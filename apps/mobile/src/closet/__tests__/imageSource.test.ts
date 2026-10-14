import type { Repo } from '../../data/repo';
import type { PendingFiles } from '../pending';
import { itemImageSource, itemImageUri } from '../imageSource';

function pending(existing: string[]): PendingFiles {
  return {
    uriFor: async (path) => `file:///docs/pending/${path.replace(/\//g, '_')}`,
    copy: jest.fn(),
    exists: (path) => existing.includes(path),
    remove: jest.fn(),
    list: () => [],
  };
}

describe('itemImageUri', () => {
  const repo = { imageUrl: jest.fn(async (p: string) => `https://cdn/${p}`) } as unknown as Repo;

  it('prefers the pending local file while it waits to upload', async () => {
    await expect(itemImageUri(repo, 'u/1.webp', pending(['u/1.webp']))).resolves.toBe(
      'file:///docs/pending/u_1.webp',
    );
    expect(repo.imageUrl).not.toHaveBeenCalled();
  });

  it('falls back to the repo URL', async () => {
    await expect(itemImageUri(repo, 'u/1.webp', pending([]))).resolves.toBe('https://cdn/u/1.webp');
  });

  it('falls back to the last persisted https URL when the repo cannot sign offline', async () => {
    const offline = { imageUrl: jest.fn().mockRejectedValue(new Error('Network request failed')) } as unknown as Repo;
    await expect(
      itemImageUri(offline, 'u/1.webp', pending([]), 'https://signed.example/u/1.webp?token=old'),
    ).resolves.toBe('https://signed.example/u/1.webp?token=old');
  });

  it('rethrows offline when there is no remote URL to fall back to', async () => {
    const offline = { imageUrl: jest.fn().mockRejectedValue(new Error('offline')) } as unknown as Repo;
    await expect(itemImageUri(offline, 'u/1.webp', pending([]), null)).rejects.toThrow('offline');
    await expect(itemImageUri(offline, 'u/1.webp', pending([]), 'file:///old.webp')).rejects.toThrow('offline');
  });

  it('prefers a fresh URL over the last known one when online', async () => {
    await expect(itemImageUri(repo, 'u/1.webp', pending([]), 'https://old')).resolves.toBe('https://cdn/u/1.webp');
  });
});

describe('itemImageSource', () => {
  it('keys the disk cache by storage path, not by the rotating URL', () => {
    expect(itemImageSource('https://signed.example/u/1.webp?token=a', 'u/1.webp')).toEqual({
      uri: 'https://signed.example/u/1.webp?token=a',
      cacheKey: 'u/1.webp',
    });
  });
});
