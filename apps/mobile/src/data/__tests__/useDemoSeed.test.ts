import { absoluteUrl, bundledAssetUri } from '../useDemoSeed';

const mockAssets: { localUri: string | null; downloaded: boolean; downloadAsync: jest.Mock }[] = [];

jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: jest.fn(() => mockAssets.shift()),
  },
}));

function asset(uris: (string | null)[]) {
  const a = {
    localUri: null as string | null,
    downloaded: false,
    downloadAsync: jest.fn(async () => {
      a.localUri = uris.shift() ?? null;
      a.downloaded = true;
    }),
  };
  mockAssets.push(a);
  return a;
}

describe('bundledAssetUri', () => {
  it('returns the file uri in debug builds', async () => {
    const a = asset(['file:///cache/top.webp']);
    await expect(bundledAssetUri(1)).resolves.toBe('file:///cache/top.webp');
    expect(a.downloadAsync).toHaveBeenCalledTimes(1);
  });

  it('copies a release-build resource name to a file uri with a second download', async () => {
    const a = asset(['assets_demo_topnavysweater', 'file:///data/user/0/com.matinwear.app/cache/ExponentAsset-1.webp']);
    await expect(bundledAssetUri(1)).resolves.toBe('file:///data/user/0/com.matinwear.app/cache/ExponentAsset-1.webp');
    expect(a.downloadAsync).toHaveBeenCalledTimes(2);
  });

  it('fails when no file uri can be produced', async () => {
    asset(['assets_demo_topnavysweater', 'assets_demo_topnavysweater']);
    await expect(bundledAssetUri(1)).rejects.toThrow('demo asset unavailable');
  });
});

describe('absoluteUrl', () => {
  it('resolves a bundled web asset path against the page', () => {
    expect(absoluteUrl('/assets/demo/top.webp', 'https://matin.app/today')).toBe('https://matin.app/assets/demo/top.webp');
    expect(absoluteUrl('https://cdn.x/a.webp', 'https://matin.app/')).toBe('https://cdn.x/a.webp');
  });
});
