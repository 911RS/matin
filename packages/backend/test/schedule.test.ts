import { expect, test } from 'vitest';
import { daysBefore, isDue, localDate, localMinutes } from '../src/schedule.ts';

const paris = (push_time: string) => ({ push_time, timezone: 'Europe/Paris' });

test('localDate uses the local calendar day', () => {
  expect(localDate(new Date('2026-10-12T23:30:00Z'), 'Europe/Paris')).toBe('2026-10-13');
});

test('invalid timezone falls back to UTC', () => {
  const now = new Date('2026-10-12T23:30:00Z');
  expect(localDate(now, 'Bad/Zone')).toBe('2026-10-12');
  expect(localMinutes(now, 'Bad/Zone')).toBe(23 * 60 + 30);
  expect(isDue({ push_time: '23:30', timezone: 'Bad/Zone' }, now)).toBe(true);
});

test('localMinutes counts midnight as zero', () => {
  expect(localMinutes(new Date('2026-10-11T22:00:00Z'), 'Europe/Paris')).toBe(0);
});

test('isDue covers the 15-minute window containing now', () => {
  expect(isDue(paris('07:30:00'), new Date('2026-10-12T05:30:00Z'))).toBe(true);
  expect(isDue(paris('07:30:00'), new Date('2026-10-12T05:44:00Z'))).toBe(true);
  expect(isDue(paris('07:30:00'), new Date('2026-10-12T05:45:00Z'))).toBe(false);
  expect(isDue(paris('07:30:00'), new Date('2026-10-12T05:15:00Z'))).toBe(false);
});

test('isDue accepts HH:MM without seconds', () => {
  expect(isDue(paris('07:30'), new Date('2026-10-12T05:30:00Z'))).toBe(true);
});

test('isDue supports half-hour offsets', () => {
  const p = { push_time: '07:30:00', timezone: 'America/St_Johns' };
  expect(isDue(p, new Date('2026-10-12T10:00:00Z'))).toBe(true);
  expect(isDue(p, new Date('2026-10-12T09:45:00Z'))).toBe(false);
});

function dueSlots(profile: { push_time: string; timezone: string }, day: string): string[] {
  const start = Date.parse(`${day}T00:00:00Z`);
  const slots: string[] = [];
  for (let i = 0; i < 96; i++) {
    const at = new Date(start + i * 15 * 60_000);
    if (isDue(profile, at)) slots.push(at.toISOString());
  }
  return slots;
}

test('DST end day has exactly one due slot', () => {
  const p = paris('07:30:00');
  expect(isDue(p, new Date('2026-10-25T06:30:00Z'))).toBe(true);
  expect(isDue(p, new Date('2026-10-25T05:30:00Z'))).toBe(false);
  expect(dueSlots(p, '2026-10-25')).toHaveLength(1);
});

test('a push time inside the spring-forward gap is not due that day', () => {
  const p = paris('02:30:00');
  expect(dueSlots(p, '2026-03-29')).toHaveLength(0);
  expect(dueSlots(p, '2026-03-30')).toHaveLength(1);
});

test('daysBefore steps back across month, year and leap-day boundaries', () => {
  expect(daysBefore('2026-03-03', 7)).toBe('2026-02-24');
  expect(daysBefore('2026-01-03', 7)).toBe('2025-12-27');
  expect(daysBefore('2024-03-03', 7)).toBe('2024-02-25');
  expect(daysBefore('2026-10-12', 1)).toBe('2026-10-11');
});
