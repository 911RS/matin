import { useMemo } from 'react';
import { daysBefore } from '@tenue/backend';
import type { ItemRow } from '@tenue/backend';
import { useDayKey, useProfileTimezone } from '../today/useToday';

export const WASH_OPTIONS = [0, 1, 3, 7] as const;
export type WashDays = (typeof WASH_OPTIONS)[number];

const systemNow = () => new Date();

export function useLocalDay(): string {
  const { timezone } = useProfileTimezone();
  return useDayKey(systemNow, timezone);
}

export function washUntil(today: string, days: WashDays): string | null {
  return days === 0 ? null : daysBefore(today, -days);
}

export function isUnavailable(item: Pick<ItemRow, 'unavailable_until'>, today: string): boolean {
  return item.unavailable_until != null && item.unavailable_until > today;
}

export function washDaysOf(item: Pick<ItemRow, 'unavailable_until'>, today: string): WashDays | null {
  if (!isUnavailable(item, today)) return 0;
  return WASH_OPTIONS.find((n) => n > 0 && washUntil(today, n) === item.unavailable_until) ?? null;
}

export function hasUnavailable(items: readonly Pick<ItemRow, 'unavailable_until'>[], today: string): boolean {
  return items.some((item) => isUnavailable(item, today));
}

export function washing(
  shown: readonly Pick<ItemRow, 'id' | 'unavailable_until'>[],
  current: readonly Pick<ItemRow, 'id' | 'unavailable_until'>[],
  today: string,
): boolean {
  const live = new Map(current.map((item) => [item.id, item]));
  return shown.some((item) => isUnavailable(live.get(item.id) ?? item, today));
}

export function useWashDate(date: string | null | undefined, language: string): string {
  return useMemo(() => {
    if (!date) return '';
    const [y, m, d] = date.split('-').map(Number);
    return new Intl.DateTimeFormat(language, { timeZone: 'UTC', day: 'numeric', month: 'long' }).format(
      new Date(Date.UTC(y!, m! - 1, d!)),
    );
  }, [date, language]);
}
