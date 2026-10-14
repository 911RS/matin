import AsyncStorage from '@react-native-async-storage/async-storage';
import { createQueryClient } from '../../query';
import { registerMutationDefaults } from '../../data/mutations';
import { LocalRepo } from '../../data/localRepo';
import type { PendingFiles } from '../pending';
import { reencodeOriginal, saveNewItem } from '../addItem';

jest.mock('../../../modules/tenue-photo', () => ({ processPhoto: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { JPEG: 'jpeg' },
}));

const { ImageManipulator } = jest.requireMock('expo-image-manipulator') as {
  ImageManipulator: { manipulate: jest.Mock };
};

const tags = { category: 'top', colorFamily: 'navy', colorHex: '#1f2a44', warmth: 2, formality: 'casual' } as const;

function setup() {
  const files = {
    dir: 'file:///docs/local/',
    copy: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  const repo = new LocalRepo({
    userId: 'local-user',
    prefix: 'tenue-local:',
    storage: AsyncStorage,
    files,
    defaults: { locale: 'en', timezone: 'Europe/Paris' },
  });
  const client = createQueryClient();
  clients.push(client);
  const pending: PendingFiles = {
    uriFor: async (path) => `file:///docs/pending/${path.replace(/\//g, '_')}`,
    copy: jest.fn(async (_from: string, path: string) => `file:///docs/pending/${path.replace(/\//g, '_')}`),
    exists: () => false,
    remove: jest.fn(),
    list: () => [],
  };
  registerMutationDefaults(client, repo, { alwaysOnline: true, pending });
  const toJpeg = jest.fn().mockResolvedValue('file:///cache/orig-2048.jpg');
  const deleteTemp = jest.fn();
  const deps = { repo, queryClient: client, newId: () => 'item-1', pending, toJpeg, deleteTemp };
  return { repo, client, files, pending, toJpeg, deleteTemp, deps };
}

async function settle(client: ReturnType<typeof createQueryClient>) {
  for (let i = 0; i < 50 && client.isMutating() > 0; i++) await new Promise((r) => setTimeout(r, 0));
  expect(client.isMutating()).toBe(0);
}

const clients: ReturnType<typeof createQueryClient>[] = [];

beforeEach(async () => {
  await AsyncStorage.clear();
});

afterEach(() => {
  for (const client of clients.splice(0)) {
    for (const mutation of client.getMutationCache().getAll()) mutation.destroy();
    client.clear();
  }
});

describe('saveNewItem', () => {
  it('saves the row with the cut-out and original paths', async () => {
    const { deps, repo, client } = setup();
    const row = await saveNewItem(deps, {
      prepared: { cutoutUri: 'file:///cache/cut.webp', originalUri: 'file:///picker/orig.jpg' },
      ...tags,
    });
    expect(row).toEqual({
      id: 'item-1',
      user_id: 'local-user',
      category: 'top',
      color_family: 'navy',
      color_hex: '#1f2a44',
      warmth: 2,
      formality: 'casual',
      image_path: 'local-user/item-1.webp',
      original_path: 'local-user/item-1-original.jpg',
      archived_at: null,
      unavailable_until: null,
    });
    await settle(client);
    expect(await repo.listItems()).toEqual([{ ...row, created_at: expect.any(String) }]);
    expect(await repo.imageUrl(row.image_path)).toBe('file:///docs/local/local-user_item-1.webp');
    expect(await repo.imageUrl(row.original_path)).toBe('file:///docs/local/local-user_item-1-original.jpg');
  });

  it('re-encodes the original to JPEG and uploads both files from the pending copies', async () => {
    const { deps, client, pending, toJpeg, files, deleteTemp } = setup();
    await saveNewItem(deps, {
      prepared: { cutoutUri: 'file:///cache/cut.webp', originalUri: 'file:///picker/orig.jpg' },
      ...tags,
      originalSize: { width: 4000, height: 3000 },
    });
    await settle(client);
    expect(toJpeg).toHaveBeenCalledWith('file:///picker/orig.jpg', { width: 4000, height: 3000 });
    expect(deleteTemp).toHaveBeenCalledWith('file:///cache/orig-2048.jpg');
    expect(pending.copy).toHaveBeenCalledWith('file:///cache/cut.webp', 'local-user/item-1.webp');
    expect(pending.copy).toHaveBeenCalledWith('file:///cache/orig-2048.jpg', 'local-user/item-1-original.jpg');
    expect(files.copy).toHaveBeenCalledWith(
      'file:///docs/pending/local-user_item-1.webp',
      'file:///docs/local/local-user_item-1.webp',
    );
    expect(files.copy).toHaveBeenCalledWith(
      'file:///docs/pending/local-user_item-1-original.jpg',
      'file:///docs/local/local-user_item-1-original.jpg',
    );
    expect(jest.mocked(pending.remove).mock.calls.map((c) => c[0]).sort()).toEqual([
      'local-user/item-1-original.jpg',
      'local-user/item-1.webp',
    ]);
  });

  it('stores and uploads a PNG cut-out under a .png path', async () => {
    const { deps, client, pending } = setup();
    const row = await saveNewItem(deps, {
      prepared: { cutoutUri: 'blob:cut/1', cutoutFormat: 'png', originalUri: 'file:///picker/orig.jpg' },
      ...tags,
    });
    expect(row.image_path).toBe('local-user/item-1.png');
    expect(pending.copy).toHaveBeenCalledWith('blob:cut/1', 'local-user/item-1.png');
    const uploads = client
      .getMutationCache()
      .getAll()
      .filter((m) => m.options.mutationKey?.[0] === 'uploadImage')
      .map((m) => m.state.variables);
    expect(uploads).toContainEqual({ path: 'local-user/item-1.png', contentType: 'image/png' });
    await settle(client);
  });

  it('queues the uploads before the row in the shared scope', async () => {
    const { deps, client } = setup();
    await saveNewItem(deps, {
      prepared: { cutoutUri: 'file:///cache/cut.webp', originalUri: 'file:///picker/orig.jpg' },
      ...tags,
    });
    const keys = client.getMutationCache().getAll().map((m) => m.options.mutationKey?.[0]);
    expect(keys).toEqual(['uploadImage', 'uploadImage', 'saveItem']);
    await settle(client);
  });

  it('shows the row in the items cache right away', async () => {
    const { deps, client } = setup();
    client.setQueryData(['items', { includeArchived: false }], []);
    const row = await saveNewItem(deps, {
      prepared: { cutoutUri: 'file:///cache/cut.webp', originalUri: 'file:///picker/orig.jpg' },
      ...tags,
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(client.getQueryData(['items', { includeArchived: false }])).toEqual([row]);
    await settle(client);
  });

  it('Use anyway points image_path at the original and uploads only the original', async () => {
    const { deps, repo, client, pending } = setup();
    const row = await saveNewItem(deps, {
      prepared: { cutoutUri: null, originalUri: 'file:///picker/orig.jpg' },
      ...tags,
    });
    expect(row.image_path).toBe('local-user/item-1-original.jpg');
    expect(row.original_path).toBe('local-user/item-1-original.jpg');
    await settle(client);
    expect(pending.copy).toHaveBeenCalledTimes(1);
    expect(await repo.imageUrl(row.image_path)).toBe('file:///docs/local/local-user_item-1-original.jpg');
  });

  it('removes the pending copies and the temp JPEG when copying fails', async () => {
    const { deps, client, pending, deleteTemp } = setup();
    jest
      .mocked(pending.copy)
      .mockResolvedValueOnce('file:///docs/pending/local-user_item-1.webp')
      .mockRejectedValueOnce(new Error('disk full'));
    await expect(
      saveNewItem(deps, {
        prepared: { cutoutUri: 'file:///cache/cut.webp', originalUri: 'file:///picker/orig.jpg' },
        ...tags,
      }),
    ).rejects.toThrow('disk full');
    expect(deleteTemp).toHaveBeenCalledWith('file:///cache/orig-2048.jpg');
    expect(pending.remove).toHaveBeenCalledWith('local-user/item-1.webp');
    expect(pending.remove).toHaveBeenCalledWith('local-user/item-1-original.jpg');
    expect(client.getMutationCache().getAll()).toEqual([]);
  });

  it('throws without a user', async () => {
    const { deps } = setup();
    const repo = { ...deps.repo, userId: async () => null } as unknown as typeof deps.repo;
    await expect(
      saveNewItem({ ...deps, repo }, { prepared: { cutoutUri: null, originalUri: 'file:///o.jpg' }, ...tags }),
    ).rejects.toThrow();
  });
});

describe('reencodeOriginal', () => {
  beforeEach(() => ImageManipulator.manipulate.mockReset());

  function fakeContext(width: number, height: number, uri: string) {
    const saveAsync = jest.fn().mockResolvedValue({ uri });
    const image = { width, height, saveAsync };
    const context = { resize: jest.fn(), renderAsync: jest.fn().mockResolvedValue(image) };
    context.resize.mockReturnValue(context);
    return { context, saveAsync };
  }

  it('scales the long side down to 2048 and saves a JPEG', async () => {
    const probe = fakeContext(4000, 3000, 'unused');
    const resized = fakeContext(2048, 1536, 'file:///cache/out.jpg');
    ImageManipulator.manipulate.mockReturnValueOnce(probe.context).mockReturnValueOnce(resized.context);
    await expect(reencodeOriginal('file:///big.jpg')).resolves.toBe('file:///cache/out.jpg');
    expect(resized.context.resize).toHaveBeenCalledWith({ width: 2048 });
    expect(resized.saveAsync).toHaveBeenCalledWith(expect.objectContaining({ format: 'jpeg' }));
  });

  it('uses the known picker size and decodes only once', async () => {
    const single = fakeContext(2048, 1536, 'file:///cache/known.jpg');
    ImageManipulator.manipulate.mockReturnValueOnce(single.context);
    await expect(reencodeOriginal('file:///big.jpg', { width: 4000, height: 3000 })).resolves.toBe(
      'file:///cache/known.jpg',
    );
    expect(ImageManipulator.manipulate).toHaveBeenCalledTimes(1);
    expect(single.context.resize).toHaveBeenCalledWith({ width: 2048 });
  });

  it('keeps the size of small photos but still re-encodes them', async () => {
    const probe = fakeContext(1200, 1600, 'file:///cache/small.jpg');
    ImageManipulator.manipulate.mockReturnValueOnce(probe.context);
    await expect(reencodeOriginal('file:///small.jpg')).resolves.toBe('file:///cache/small.jpg');
    expect(probe.context.resize).not.toHaveBeenCalled();
    expect(probe.saveAsync).toHaveBeenCalledWith(expect.objectContaining({ format: 'jpeg' }));
  });
});
