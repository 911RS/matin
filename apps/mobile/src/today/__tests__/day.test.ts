import { msUntilNextDay } from '../day';

describe('msUntilNextDay', () => {
  it('counts to the next local midnight in the given zone', () => {
    expect(msUntilNextDay(new Date('2026-10-12T23:00:00Z'), 'UTC')).toBe(60 * 60 * 1000);
    expect(msUntilNextDay(new Date('2026-10-12T21:30:00Z'), 'Europe/Paris')).toBe(30 * 60 * 1000);
    expect(msUntilNextDay(new Date('2026-10-12T12:00:00Z'), 'Pacific/Kiritimati')).toBe(22 * 60 * 60 * 1000);
  });

  it('never returns less than a second', () => {
    expect(msUntilNextDay(new Date('2026-10-12T23:59:59.900Z'), 'UTC')).toBe(1000);
  });
});
