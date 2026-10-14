import type { AppLanguage } from '../i18n';

const STEP_MINUTES = 15;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function toPushTime(hour: number, minute: number): string {
  return `${pad(hour)}:${pad(minute)}:00`;
}

export function timeOptions(): string[] {
  const out: string[] = [];
  for (let m = 0; m < 24 * 60; m += STEP_MINUTES) out.push(toPushTime(Math.floor(m / 60), m % 60));
  return out;
}

export function parsePushTime(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export function nearestOption(value: string): string {
  const parsed = parsePushTime(value);
  if (!parsed) return toPushTime(7, 30);
  const total = Math.round((parsed.hour * 60 + parsed.minute) / STEP_MINUTES) * STEP_MINUTES;
  const clamped = Math.min(total, 24 * 60 - STEP_MINUTES);
  return toPushTime(Math.floor(clamped / 60), clamped % 60);
}

export function formatTime(value: string, language: AppLanguage): string {
  const parsed = parsePushTime(value);
  if (!parsed) return '';
  const at = new Date(2000, 0, 1, parsed.hour, parsed.minute);
  return new Intl.DateTimeFormat(language, { hour: 'numeric', minute: '2-digit' }).format(at);
}
