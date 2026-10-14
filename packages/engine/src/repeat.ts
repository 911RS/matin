import type { WornOutfit } from './types.ts';

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

// Day number of the YYYY-MM-DD prefix of `date`, or null when it is not a real calendar date.
function dayNumber(date: string): number | null {
  const m = DATE.exec(date.slice(0, 10));
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(y, mo - 1, d);
  const back = new Date(ms);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return ms / 86_400_000;
}

export function parseDay(date: string): number {
  const day = dayNumber(date);
  if (day === null) throw new Error('Invalid date');
  return day;
}

export function createRepeatPenalty(recent: WornOutfit[], date: string): (id: string) => number {
  const today = parseDay(date);
  const latest = new Map<string, number>();
  for (const w of recent) {
    const day = typeof w.date === 'string' ? dayNumber(w.date) : null;
    if (day === null || day >= today) continue;
    for (const id of w.itemIds) {
      if (day > (latest.get(id) ?? -Infinity)) latest.set(id, day);
    }
  }
  return (id) => {
    const ago = today - (latest.get(id) ?? -Infinity);
    if (ago <= 3) return 10;
    if (ago <= 7) return 3;
    return 0;
  };
}

export function repeatPenalty(itemIds: string[], recent: WornOutfit[], date: string): number {
  const penalty = createRepeatPenalty(recent, date);
  let total = 0;
  for (const id of itemIds) total += penalty(id);
  return total;
}
