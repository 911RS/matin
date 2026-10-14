import { dehydrate } from '@tanstack/react-query';
import { createQueryClient, CACHE_MAX_AGE, dehydrateOptions } from '../query';

describe('createQueryClient', () => {
  it('keeps data for 7 days and works offline first', () => {
    const d = createQueryClient().getDefaultOptions();
    expect(d.queries?.gcTime).toBe(CACHE_MAX_AGE);
    expect(d.queries?.networkMode).toBe('offlineFirst');
    expect(d.mutations?.networkMode).toBe('online');
  });
});

describe('dehydrateOptions', () => {
  it('persists signed https image URLs but not local pending files', () => {
    const client = createQueryClient();
    client.setQueryData(['items', { includeArchived: false }], []);
    client.setQueryData(['image', 'u/1.webp'], 'https://signed.example/u/1.webp');
    client.setQueryData(['image', 'u/2.webp'], 'file:///docs/pending/u~2.webp');
    const keys = dehydrate(client, dehydrateOptions).queries.map((q) => q.queryKey);
    expect(keys).toEqual([['items', { includeArchived: false }], ['image', 'u/1.webp']]);
    client.clear();
  });
});
