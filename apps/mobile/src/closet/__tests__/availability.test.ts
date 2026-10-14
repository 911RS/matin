import { hasUnavailable, isUnavailable, washDaysOf, washing, washUntil } from '../availability';

describe('availability', () => {
  it('adds days across a month and year boundary', () => {
    expect(washUntil('2026-01-30', 3)).toBe('2026-02-02');
    expect(washUntil('2026-02-26', 7)).toBe('2026-03-05');
    expect(washUntil('2026-12-29', 3)).toBe('2027-01-01');
    expect(washUntil('2026-10-13', 1)).toBe('2026-10-14');
  });

  it('clears the date for Available', () => {
    expect(washUntil('2026-10-13', 0)).toBeNull();
  });

  it('is unavailable only before the date', () => {
    expect(isUnavailable({ unavailable_until: '2026-10-14' }, '2026-10-13')).toBe(true);
    expect(isUnavailable({ unavailable_until: '2026-10-13' }, '2026-10-13')).toBe(false);
    expect(isUnavailable({ unavailable_until: null }, '2026-10-13')).toBe(false);
  });

  it('maps a stored date back to its chip', () => {
    expect(washDaysOf({ unavailable_until: null }, '2026-10-13')).toBe(0);
    expect(washDaysOf({ unavailable_until: '2026-10-12' }, '2026-10-13')).toBe(0);
    expect(washDaysOf({ unavailable_until: '2026-10-16' }, '2026-10-13')).toBe(3);
    expect(washDaysOf({ unavailable_until: '2026-10-20' }, '2026-10-13')).toBe(7);
    expect(washDaysOf({ unavailable_until: '2026-10-15' }, '2026-10-13')).toBeNull();
  });

  it('detects a shown piece that became unavailable, using the live item', () => {
    const shown = [{ id: 'a', unavailable_until: null }];
    expect(hasUnavailable(shown, '2026-10-13')).toBe(false);
    expect(washing(shown, [{ id: 'a', unavailable_until: '2026-10-15' }], '2026-10-13')).toBe(true);
    expect(washing(shown, [{ id: 'a', unavailable_until: null }], '2026-10-13')).toBe(false);
    expect(washing([{ id: 'a', unavailable_until: '2026-10-15' }], [], '2026-10-13')).toBe(true);
  });
});
