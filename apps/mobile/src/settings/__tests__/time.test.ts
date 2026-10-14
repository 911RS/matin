import { formatTime, parsePushTime, timeOptions, toPushTime } from '../time';

describe('time helpers', () => {
  it('lists every quarter hour of the day', () => {
    const options = timeOptions();
    expect(options).toHaveLength(96);
    expect(options[0]).toBe('00:00:00');
    expect(options[1]).toBe('00:15:00');
    expect(options[95]).toBe('23:45:00');
  });

  it('builds HH:MM:00 values', () => {
    expect(toPushTime(7, 5)).toBe('07:05:00');
    expect(toPushTime(23, 45)).toBe('23:45:00');
  });

  it('parses push times with or without seconds', () => {
    expect(parsePushTime('07:30:00')).toEqual({ hour: 7, minute: 30 });
    expect(parsePushTime('21:15')).toEqual({ hour: 21, minute: 15 });
    expect(parsePushTime('25:00:00')).toBeNull();
    expect(parsePushTime('')).toBeNull();
  });

  it('formats times for each language', () => {
    const plain = (s: string) => s.replace(/\s/g, ' ');
    expect(plain(formatTime('07:30:00', 'en'))).toBe('7:30 AM');
    expect(plain(formatTime('00:15:00', 'en'))).toBe('12:15 AM');
    expect(plain(formatTime('12:00:00', 'en'))).toBe('12:00 PM');
    expect(plain(formatTime('21:45:00', 'en'))).toBe('9:45 PM');
    expect(formatTime('07:30:00', 'fr')).toMatch(/^0?7:30$/);
    expect(formatTime('21:45:00', 'fr')).toBe('21:45');
    expect(formatTime('bad', 'fr')).toBe('');
  });
});
