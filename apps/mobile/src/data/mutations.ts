import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { ItemRow, OutfitRow } from '@tenue/backend';
import { pendingFiles } from '../closet/pending';
import type { PendingFiles } from '../closet/pending';
import type { TodayState } from '../today/types';
import { HISTORY_KEY, imageQueryKey, ITEMS_ROOT, OUTFIT_ROOT, todayKey, WEAR_STATS_ROOT } from './keys';
import type { ImageContentType, OutfitPatch, ProfilePatch, Repo } from './repo';

export interface UploadImageVars {
  path: string;
  contentType: ImageContentType;
}

export type PendingSource = Pick<PendingFiles, 'uriFor' | 'remove'>;

export interface UpdateOutfitVars {
  date: string;
  patch: OutfitPatch;
}

type Snapshot = [QueryKey, unknown][];

const SCOPE = { id: 'tenue-writes' };

function applyItem(old: ItemRow[], row: ItemRow, includeArchived: boolean): ItemRow[] {
  const without = old.filter((i) => i.id !== row.id);
  if (!includeArchived && row.archived_at !== null) return without;
  const idx = old.findIndex((i) => i.id === row.id);
  if (idx < 0) return [...old, row];
  const next = old.slice();
  next[idx] = row;
  return next;
}

export function enqueue<V>(queryClient: QueryClient, key: string, vars: V, onError?: (error: unknown) => void): void {
  const mutation = queryClient.getMutationCache().build<unknown, unknown, V, unknown>(queryClient, {
    mutationKey: [key],
  });
  mutation.execute(vars).catch((error: unknown) => onError?.(error));
}

function restore(queryClient: QueryClient, prev: Snapshot | undefined): void {
  for (const [key, data] of prev ?? []) queryClient.setQueryData(key, data);
}

export function registerMutationDefaults(
  queryClient: QueryClient,
  repo: Repo,
  opts: { alwaysOnline?: boolean; pending?: PendingSource } = {},
): void {
  const pending = opts.pending ?? pendingFiles;
  const networkMode = opts.alwaysOnline ? 'always' : 'online';
  const base = { retry: 3, networkMode, scope: SCOPE } as const;

  queryClient.setMutationDefaults(['saveItem'], {
    ...base,
    mutationFn: (row: ItemRow) => repo.saveItem(row),
    onMutate: async (row: ItemRow) => {
      await queryClient.cancelQueries({ queryKey: ITEMS_ROOT });
      const prev: Snapshot = queryClient.getQueriesData({ queryKey: ITEMS_ROOT });
      for (const [key, old] of prev) {
        if (!Array.isArray(old)) continue;
        const opt = key[1] as { includeArchived?: boolean } | undefined;
        queryClient.setQueryData(key, applyItem(old as ItemRow[], row, opt?.includeArchived === true));
      }
      return { prev };
    },
    onError: (_e: unknown, _row: ItemRow, ctx: { prev: Snapshot } | undefined) => {
      restore(queryClient, ctx?.prev);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ITEMS_ROOT }),
        queryClient.invalidateQueries({ queryKey: OUTFIT_ROOT }),
      ]),
  });

  queryClient.setMutationDefaults(['uploadImage'], {
    ...base,
    mutationFn: async (v: UploadImageVars) => repo.uploadImage(await pending.uriFor(v.path), v.path, v.contentType),
    onSuccess: (_d: unknown, v: UploadImageVars) => {
      try {
        pending.remove(v.path);
      } catch {}
      return queryClient.invalidateQueries({ queryKey: imageQueryKey(v.path) });
    },
  });

  queryClient.setMutationDefaults(['insertOutfit'], {
    ...base,
    mutationFn: (row: OutfitRow) => repo.insertOutfit(row),
    onSettled: (_d: unknown, _e: unknown, row: OutfitRow) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: todayKey(row.date) }),
        queryClient.invalidateQueries({ queryKey: HISTORY_KEY }),
        queryClient.invalidateQueries({ queryKey: WEAR_STATS_ROOT }),
      ]),
  });

  queryClient.setMutationDefaults(['updateOutfit'], {
    ...base,
    mutationFn: (v: UpdateOutfitVars) => repo.updateOutfit(v.date, v.patch),
    onMutate: async (v: UpdateOutfitVars) => {
      const key = todayKey(v.date);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: key }),
        queryClient.cancelQueries({ queryKey: HISTORY_KEY }),
      ]);
      const prev: Snapshot = [
        ...queryClient.getQueriesData({ queryKey: key }),
        ...queryClient.getQueriesData({ queryKey: HISTORY_KEY }),
      ];
      queryClient.setQueryData<TodayState>(key, (old) =>
        old?.kind === 'outfit' ? { ...old, row: { ...old.row, ...v.patch } } : old,
      );
      queryClient.setQueriesData<OutfitRow[]>({ queryKey: HISTORY_KEY }, (old) =>
        old?.some((row) => row.date === v.date)
          ? old.map((row) => (row.date === v.date ? { ...row, ...v.patch } : row))
          : old,
      );
      return { prev };
    },
    onError: (_e: unknown, _v: UpdateOutfitVars, ctx: { prev: Snapshot } | undefined) => {
      restore(queryClient, ctx?.prev);
    },
    onSettled: (_d: unknown, _e: unknown, v: UpdateOutfitVars) => {
      if (queryClient.isMutating({ mutationKey: ['updateOutfit'] }) > 1) return;
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: todayKey(v.date) }),
        queryClient.invalidateQueries({ queryKey: HISTORY_KEY }),
        ...('status' in v.patch ? [queryClient.invalidateQueries({ queryKey: WEAR_STATS_ROOT })] : []),
      ]);
    },
  });

  queryClient.setMutationDefaults(['updateProfile'], {
    ...base,
    mutationFn: (patch: ProfilePatch) => repo.updateProfile(patch),
  });
}
