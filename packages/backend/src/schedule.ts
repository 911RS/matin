import type { ProfileRow } from './rows.ts';

function parts(now: Date, timeZone: string): Record<string, string> {
  const make = (tz: string) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = make(timeZone);
  } catch {
    fmt = make('UTC');
  }
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(now)) out[p.type] = p.value;
  return out;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysBefore(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!) - days * DAY_MS).toISOString().slice(0, 10);
}

export function localDate(now: Date, timeZone: string): string {
  const p = parts(now, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

export function localMinutes(now: Date, timeZone: string): number {
  const p = parts(now, timeZone);
  return Number(p.hour) * 60 + Number(p.minute);
}

export function isDue(
  profile: Pick<ProfileRow, 'push_time' | 'timezone'>,
  now: Date,
  windowMinutes = 15,
): boolean {
  const [h, m] = profile.push_time.split(':');
  const pushMinutes = Number(h) * 60 + Number(m);
  if (!Number.isFinite(pushMinutes)) return false;
  const current = localMinutes(now, profile.timezone);
  const start = current - (current % windowMinutes);
  return pushMinutes >= start && pushMinutes < start + windowMinutes;
}
