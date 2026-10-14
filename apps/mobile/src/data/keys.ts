export const PROFILE_KEY = ['profile'] as const;
export const ITEMS_ROOT = ['items'] as const;
export const ITEMS_KEY = ['items', { includeArchived: false }] as const;
export const ARCHIVED_ITEMS_KEY = ['items', { includeArchived: true }] as const;
export const OUTFIT_ROOT = ['outfit'] as const;
export const HISTORY_KEY = ['outfits'] as const;
export const WEAR_STATS_ROOT = ['wearStats'] as const;

export function todayKey(date: string) {
  return ['outfit', date] as const;
}

export function historyKey(from: string, to: string) {
  return [...HISTORY_KEY, from, to] as const;
}

export function wearStatsKey(from: string, to: string) {
  return [...WEAR_STATS_ROOT, from, to] as const;
}

export function imageQueryKey(path: string | null) {
  return ['image', path] as const;
}

export function onboardingQueryKey(userId: string | null) {
  return ['onboardingDone', userId] as const;
}

export function notificationsQueryKey(userId: string | null) {
  return ['notificationsOff', userId] as const;
}

export function locationLabelQueryKey(userId: string | null) {
  return ['locationLabel', userId] as const;
}

export function tomorrowKey(date: string) {
  return ['tomorrow', date] as const;
}

export function weatherKey(lat: number | null, lon: number | null, date: string) {
  return ['weather', lat, lon, date] as const;
}
