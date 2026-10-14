import { expect, test, vi } from 'vitest';
import { deleteAccount, type DeleteAccountDeps } from '../src/account.ts';

const UID = '123e4567-e89b-42d3-a456-426614174000';

const makeDeps = (paths: string[]) => {
  const calls: string[] = [];
  const deps: DeleteAccountDeps = {
    listObjectPaths: vi.fn(async () => paths),
    removeObjects: vi.fn(async () => {
      calls.push('remove');
    }),
    deleteAuthUser: vi.fn(async () => {
      calls.push('delete');
    }),
  };
  return { deps, calls };
};

test('removes objects in chunks of 100 then deletes the user', async () => {
  const paths = Array.from({ length: 250 }, (_, i) => `${UID}/item-${i}.jpg`);
  const { deps, calls } = makeDeps(paths);
  await deleteAccount(UID, deps);
  expect(deps.listObjectPaths).toHaveBeenCalledTimes(1);
  expect(deps.listObjectPaths).toHaveBeenCalledWith(`${UID}/`);
  const removed = vi.mocked(deps.removeObjects).mock.calls.map(([chunk]) => chunk);
  expect(removed.map((c) => c.length)).toEqual([100, 100, 50]);
  expect(removed.flat()).toEqual(paths);
  expect(deps.deleteAuthUser).toHaveBeenCalledWith(UID);
  expect(calls).toEqual(['remove', 'remove', 'remove', 'delete']);
});

test('empty folder only deletes the user', async () => {
  const { deps, calls } = makeDeps([]);
  await deleteAccount(UID, deps);
  expect(deps.removeObjects).not.toHaveBeenCalled();
  expect(calls).toEqual(['delete']);
});

test('a failed removal rethrows and keeps the user', async () => {
  const { deps } = makeDeps([`${UID}/a.jpg`]);
  deps.removeObjects = vi.fn(async () => {
    throw new Error('storage down');
  });
  await expect(deleteAccount(UID, deps)).rejects.toThrow('storage down');
  expect(deps.deleteAuthUser).not.toHaveBeenCalled();
});

test.each(['', 'a/b', '../x', '/', 'u1', `${UID}/`, `${UID}x`])('rejects invalid user id %j before touching storage', async (id) => {
  const { deps } = makeDeps(['x']);
  await expect(deleteAccount(id, deps)).rejects.toThrow('Invalid user id');
  expect(deps.listObjectPaths).not.toHaveBeenCalled();
  expect(deps.deleteAuthUser).not.toHaveBeenCalled();
});

test('rejects a non-string user id', async () => {
  const { deps } = makeDeps([]);
  await expect(deleteAccount(undefined as unknown as string, deps)).rejects.toThrow('Invalid user id');
  expect(deps.listObjectPaths).not.toHaveBeenCalled();
});

test('rejects a listed path outside the user folder before any removal', async () => {
  const { deps } = makeDeps([`${UID}/a.jpg`, '00000000-0000-4000-8000-000000000000/b.jpg']);
  await expect(deleteAccount(UID, deps)).rejects.toThrow('Path outside user folder');
  expect(deps.removeObjects).not.toHaveBeenCalled();
  expect(deps.deleteAuthUser).not.toHaveBeenCalled();
});
