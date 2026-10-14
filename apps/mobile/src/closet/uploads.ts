import type { QueryClient } from '@tanstack/react-query';
import type { ImageContentType } from '../data/repo';
import { enqueue } from '../data/mutations';
import type { UploadImageVars } from '../data/mutations';
import type { PendingFiles } from './pending';

export function contentTypeFor(path: string): ImageContentType {
  if (path.endsWith('.webp')) return 'image/webp';
  return path.endsWith('.png') ? 'image/png' : 'image/jpeg';
}

function queuedUploadPaths(queryClient: QueryClient): Set<string> {
  const paths = new Set<string>();
  for (const mutation of queryClient.getMutationCache().getAll()) {
    if (mutation.options.mutationKey?.[0] !== 'uploadImage') continue;
    if (mutation.state.status !== 'pending') continue;
    const vars = mutation.state.variables as Partial<UploadImageVars> | undefined;
    if (typeof vars?.path === 'string') paths.add(vars.path);
  }
  return paths;
}

export function resumeOrphanUploads(
  queryClient: QueryClient,
  pending: Pick<PendingFiles, 'list'>,
  userId: string | null,
): string[] {
  if (!userId) return [];
  let files: string[];
  try {
    files = pending.list();
  } catch {
    return [];
  }
  const queued = queuedUploadPaths(queryClient);
  const started: string[] = [];
  for (const path of files) {
    if (!path.startsWith(`${userId}/`) || queued.has(path)) continue;
    enqueue<UploadImageVars>(queryClient, 'uploadImage', { path, contentType: contentTypeFor(path) });
    started.push(path);
  }
  return started;
}
