import { useQuery } from '@tanstack/react-query';
import { daysBefore, localDate } from '@tenue/backend';
import type { ItemRow, OutfitRow } from '@tenue/backend';
import { wearStatsKey } from '../data/keys';
import { useRepo } from '../data/RepoProvider';
import { useProfileTimezone } from '../today/useToday';
import { useLocalDay } from './availability';

export const STATS_DAYS = 365;
export const FORGOTTEN_DAYS = 30;
const STATS_STALE_MS = 10 * 60 * 1000;

type WornOutfit = Pick<OutfitRow, 'date' | 'item_ids' | 'status'>;

export interface WearStat {
  wornCount: number;
  lastWorn: string | null;
}

export type WearStats = ReadonlyMap<string, WearStat>;

export const NEVER_WORN: WearStat = { wornCount: 0, lastWorn: null };

export function wearStats(outfits: readonly WornOutfit[]): Map<string, WearStat> {
  const stats = new Map<string, WearStat>();
  for (const outfit of outfits) {
    if (outfit.status !== 'worn') continue;
    for (const id of new Set(outfit.item_ids)) {
      const prev = stats.get(id) ?? NEVER_WORN;
      stats.set(id, {
        wornCount: prev.wornCount + 1,
        lastWorn: prev.lastWorn === null || outfit.date > prev.lastWorn ? outfit.date : prev.lastWorn,
      });
    }
  }
  return stats;
}

export function daysSince(date: string, today: string): number {
  const [y1, m1, d1] = date.split('-').map(Number);
  const [y2, m2, d2] = today.split('-').map(Number);
  return Math.round((Date.UTC(y2!, m2! - 1, d2!) - Date.UTC(y1!, m1! - 1, d1!)) / 86_400_000);
}

export function isForgotten(
  item: Pick<ItemRow, 'id' | 'created_at'>,
  stats: WearStats,
  today: string,
  timezone = 'UTC',
): boolean {
  if (!item.created_at) return false;
  const cutoff = daysBefore(today, FORGOTTEN_DAYS);
  if (localDate(new Date(item.created_at), timezone) >= cutoff) return false;
  const last = stats.get(item.id)?.lastWorn;
  return last == null || last < cutoff;
}

export function useWearStats(): { stats: WearStats; ready: boolean } {
  const repo = useRepo();
  const today = useLocalDay();
  const from = daysBefore(today, STATS_DAYS);
  const outfits = useQuery({
    queryKey: wearStatsKey(from, today),
    queryFn: async (): Promise<WornOutfit[]> =>
      (await repo.listOutfits(from, today))
        .filter((o) => o.status === 'worn')
        .map(({ date, item_ids, status }) => ({ date, item_ids, status })),
    staleTime: STATS_STALE_MS,
  });
  const data = outfits.data;
  return { stats: data ? wearStats(data) : new Map(), ready: data !== undefined };
}
