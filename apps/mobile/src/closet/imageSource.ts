import type { ImageSource } from 'expo-image';
import type { Repo } from '../data/repo';
import { pendingFiles } from './pending';
import type { PendingFiles } from './pending';

export function isRemoteUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('https://');
}

export async function itemImageUri(
  repo: Repo,
  path: string,
  pending: Pick<PendingFiles, 'exists' | 'uriFor'> = pendingFiles,
  lastKnown: unknown = null,
): Promise<string> {
  if (pending.exists(path)) return pending.uriFor(path);
  try {
    return await repo.imageUrl(path);
  } catch (error) {
    if (isRemoteUrl(lastKnown)) return lastKnown;
    throw error;
  }
}

export function itemImageSource(uri: string, path: string): ImageSource {
  return { uri, cacheKey: path };
}
