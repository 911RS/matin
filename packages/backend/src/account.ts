export interface DeleteAccountDeps {
  listObjectPaths(prefix: string): Promise<string[]>;
  removeObjects(paths: string[]): Promise<void>;
  deleteAuthUser(userId: string): Promise<void>;
}

const CHUNK_SIZE = 100;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function deleteAccount(userId: string, deps: DeleteAccountDeps): Promise<void> {
  if (typeof userId !== 'string' || !UUID_RE.test(userId)) {
    throw new Error('Invalid user id');
  }
  const prefix = `${userId}/`;
  const paths = await deps.listObjectPaths(prefix);
  if (paths.some((p) => !p.startsWith(prefix))) {
    throw new Error('Path outside user folder');
  }
  for (let i = 0; i < paths.length; i += CHUNK_SIZE) {
    await deps.removeObjects(paths.slice(i, i + CHUNK_SIZE));
  }
  await deps.deleteAuthUser(userId);
}
