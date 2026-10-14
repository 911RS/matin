export interface MonthRef {
  year: number;
  month: number;
}

export interface DayCell {
  date: string;
  day: number;
}

export interface MonthGrid {
  title: string;
  weekdays: string[];
  cells: (DayCell | null)[];
}

const pad = (n: number) => String(n).padStart(2, '0');

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

type WeekInfo = { firstDay?: number };
type LocaleWithWeek = { getWeekInfo?: () => WeekInfo; weekInfo?: WeekInfo };

export function fallbackWeekStart(locale: string): number {
  return locale.startsWith('fr') ? 1 : 0;
}

export function weekStartsOn(locale: string): number {
  try {
    const IntlLocale = (Intl as { Locale?: new (tag: string) => LocaleWithWeek }).Locale;
    if (IntlLocale) {
      const loc = new IntlLocale(locale);
      const first = (loc.getWeekInfo?.() ?? loc.weekInfo)?.firstDay;
      if (typeof first === 'number' && first >= 1 && first <= 7) return first % 7;
    }
  } catch {}
  return fallbackWeekStart(locale);
}

export function shiftMonth(ref: MonthRef, delta: number): MonthRef {
  const index = ref.year * 12 + (ref.month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function monthOf(date: string): MonthRef {
  const [year, month] = date.split('-').map(Number);
  return { year: year!, month: month! };
}

export function monthGrid(year: number, month: number, locale: string): MonthGrid {
  const start = weekStartsOn(locale);
  const first = new Date(year, month - 1, 1);
  const length = new Date(year, month, 0).getDate();
  const lead = (first.getDay() - start + 7) % 7;

  const cells: (DayCell | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= length; day++) cells.push({ date: isoDate(year, month, day), day });
  while (cells.length % 7 !== 0) cells.push(null);

  const narrow = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
  const weekdays = Array.from({ length: 7 }, (_, i) => narrow.format(new Date(2026, 0, 4 + start + i)).toUpperCase());

  const title = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(first);
  return { title: title.charAt(0).toUpperCase() + title.slice(1), weekdays, cells };
}
