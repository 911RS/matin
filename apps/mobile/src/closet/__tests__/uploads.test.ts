import { createQueryClient } from '../../query';
import { registerMutationDefaults } from '../../data/mutations';
import type { Repo } from '../../data/repo';
import { contentTypeFor, resumeOrphanUploads } from '../uploads';

const clients: ReturnType<typeof createQueryClient>[] = [];

afterEach(() => {
  for (const client of clients.splice(0)) {
    for (const mutation of client.getMutationCache().getAll()) mutation.destroy();
    client.clear();
  }
});

function setup(files: string[], upload: Repo['uploadImage'] = jest.fn(() => new Promise<void>(() => {}))) {
  const client = createQueryClient();
  clients.push(client);
  const repo = { uploadImage: upload } as unknown as Repo;
  const pending = {
    uriFor: async (p: string) => `file:///pending/${p.replace('/', '~')}`,
    remove: jest.fn(),
    list: jest.fn(() => files),
  };
  registerMutationDefaults(client, repo, { alwaysOnline: true, pending });
  return { client, repo, pending };
}

function uploadPaths(client: ReturnType<typeof createQueryClient>): string[] {
  return client
    .getMutationCache()
    .getAll()
    .filter((m) => m.options.mutationKey?.[0] === 'uploadImage')
    .map((m) => (m.state.variables as { path: string }).path);
}

describe('resumeOrphanUploads', () => {
  it('queues an upload for every pending file of the user', () => {
    const { client } = setup(['u1/a.webp', 'u1/a-original.jpg']);
    expect(resumeOrphanUploads(client, { list: () => ['u1/a.webp', 'u1/a-original.jpg'] }, 'u1')).toEqual([
      'u1/a.webp',
      'u1/a-original.jpg',
    ]);
    expect(uploadPaths(client)).toEqual(['u1/a.webp', 'u1/a-original.jpg']);
    const vars = client.getMutationCache().getAll()[0].state.variables;
    expect(vars).toEqual({ path: 'u1/a.webp', contentType: 'image/webp' });
  });

  it('skips files that already have a queued upload, so it is idempotent', () => {
    const files = ['u1/a.webp', 'u1/b.webp'];
    const { client, pending } = setup(files);
    resumeOrphanUploads(client, pending, 'u1');
    expect(resumeOrphanUploads(client, pending, 'u1')).toEqual([]);
    expect(uploadPaths(client)).toEqual(['u1/a.webp', 'u1/b.webp']);
  });

  it('ignores files that belong to another user', () => {
    const { client, pending } = setup(['u2/a.webp', 'u1/b.webp']);
    expect(resumeOrphanUploads(client, pending, 'u1')).toEqual(['u1/b.webp']);
  });

  it('does nothing without a user', () => {
    const { client, pending } = setup(['u1/a.webp']);
    expect(resumeOrphanUploads(client, pending, null)).toEqual([]);
    expect(pending.list).not.toHaveBeenCalled();
  });

  it('re-queues an upload whose earlier attempt failed', async () => {
    const upload = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const { client, pending } = setup(['u1/a.webp'], upload);
    client.setMutationDefaults(['uploadImage'], { ...client.getMutationDefaults(['uploadImage']), retry: 0 });
    resumeOrphanUploads(client, pending, 'u1');
    for (let i = 0; i < 20 && client.isMutating() > 0; i++) await new Promise((r) => setTimeout(r, 0));
    expect(client.getMutationCache().getAll()[0].state.status).toBe('error');
    expect(resumeOrphanUploads(client, pending, 'u1')).toEqual(['u1/a.webp']);
    for (let i = 0; i < 20 && client.isMutating() > 0; i++) await new Promise((r) => setTimeout(r, 0));
    expect(upload).toHaveBeenCalledTimes(2);
    expect(pending.remove).toHaveBeenCalledWith('u1/a.webp');
  });

  it('survives a failing directory listing', () => {
    const { client } = setup([]);
    const broken = {
      list: () => {
        throw new Error('io');
      },
    };
    expect(resumeOrphanUploads(client, broken, 'u1')).toEqual([]);
  });
});

describe('contentTypeFor', () => {
  it('maps extensions to content types', () => {
    expect(contentTypeFor('u/a.webp')).toBe('image/webp');
    expect(contentTypeFor('u/a.png')).toBe('image/png');
    expect(contentTypeFor('u/a-original.jpg')).toBe('image/jpeg');
  });
});
