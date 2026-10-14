import { fallbackWeekStart, monthGrid, shiftMonth, weekStartsOn } from '../monthGrid';

const days = (cells: ReturnType<typeof monthGrid>['cells']) => cells.map((c) => (c ? c.day : 0));

describe('monthGrid', () => {
  it('starts weeks on Monday in French', () => {
    const grid = monthGrid(2026, 10, 'fr');
    expect(grid.weekdays).toEqual(['L', 'M', 'M', 'J', 'V', 'S', 'D']);
    expect(days(grid.cells).slice(0, 7)).toEqual([0, 0, 0, 1, 2, 3, 4]);
    expect(grid.cells[3]).toEqual({ date: '2026-10-01', day: 1 });
  });

  it('starts weeks on Sunday in English', () => {
    const grid = monthGrid(2026, 10, 'en');
    expect(grid.weekdays).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S']);
    expect(days(grid.cells).slice(0, 7)).toEqual([0, 0, 0, 0, 1, 2, 3]);
  });

  it('pads to whole weeks and covers every day', () => {
    for (const locale of ['en', 'fr'] as const) {
      const grid = monthGrid(2026, 10, locale);
      expect(grid.cells.length % 7).toBe(0);
      expect(grid.cells.filter(Boolean)).toHaveLength(31);
      expect(grid.cells.filter(Boolean).at(-1)).toEqual({ date: '2026-10-31', day: 31 });
    }
  });

  it('handles a leap February', () => {
    const leap = monthGrid(2024, 2, 'fr');
    expect(leap.cells.filter(Boolean)).toHaveLength(29);
    expect(days(leap.cells).slice(0, 7)).toEqual([0, 0, 0, 1, 2, 3, 4]);
    expect(monthGrid(2026, 2, 'en').cells.filter(Boolean)).toHaveLength(28);
  });

  it('names the month with the year', () => {
    expect(monthGrid(2026, 10, 'en').title).toBe('October 2026');
    expect(monthGrid(2026, 10, 'fr').title).toBe('Octobre 2026');
  });
});

describe('shiftMonth', () => {
  it('crosses year boundaries', () => {
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth({ year: 2025, month: 12 }, 1)).toEqual({ year: 2026, month: 1 });
    expect(shiftMonth({ year: 2026, month: 5 }, 1)).toEqual({ year: 2026, month: 6 });
  });
});

describe('weekStartsOn', () => {
  it('reads the locale week info, with the fr/en rule as fallback', () => {
    expect(weekStartsOn('fr')).toBe(1);
    expect(weekStartsOn('en')).toBe(0);
    expect(weekStartsOn('en-GB')).toBe(1);
    expect(fallbackWeekStart('fr')).toBe(1);
    expect(fallbackWeekStart('en')).toBe(0);
  });

  it('falls back when Intl.Locale is missing', () => {
    const original = Intl.Locale;
    Object.defineProperty(Intl, 'Locale', { value: undefined, configurable: true, writable: true });
    try {
      expect(weekStartsOn('fr')).toBe(1);
      expect(weekStartsOn('en-GB')).toBe(0);
    } finally {
      Object.defineProperty(Intl, 'Locale', { value: original, configurable: true, writable: true });
    }
  });
});
