import type { Category, Locale, SuggestResult } from '../../engine/src/index.ts';
import { timeoutSignal } from './signal.ts';

const EXPO_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE = 100;
const TIMEOUT_MS = 15_000;

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data: { date: string };
}

const TITLE: Record<Locale, string> = { en: "Today's outfit", fr: 'Ta tenue du jour' };

const WORDS: Record<Locale, Partial<Record<Category, string>>> = {
  en: { shoes: 'shoes', top: 'a top', bottom: 'a bottom' },
  fr: { shoes: 'des chaussures', top: 'un haut', bottom: 'un bas' },
};

export function buildMessage(token: string, locale: Locale, date: string, result: SuggestResult): PushMessage {
  let body: string;
  if ('missing' in result) {
    const list = result.missing.map((c) => WORDS[locale][c] ?? c).join(', ');
    body = locale === 'fr' ? `Ajoute ${list} pour avoir des suggestions` : `Add ${list} to get suggestions`;
  } else {
    body = result.reason;
  }
  return { to: token, title: TITLE[locale], body, data: { date } };
}

interface Ticket {
  status?: string;
  details?: { error?: string };
}

export type PushOutcome = { status: 'ok' } | { status: 'invalid' } | { status: 'error'; error: string };

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : 'request failed');

async function request(fetchFn: typeof fetch, chunk: PushMessage[]): Promise<(Ticket | null)[] | string> {
  try {
    const res = await fetchFn(EXPO_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(chunk),
      signal: timeoutSignal(TIMEOUT_MS),
    });
    if (!res.ok) return `HTTP ${res.status}`;
    const body = (await res.json()) as { data?: unknown } | null;
    if (!body || !Array.isArray(body.data)) return 'no ticket data';
    return body.data as (Ticket | null)[];
  } catch (e) {
    return errorMessage(e);
  }
}

function outcome(ticket: Ticket | null | undefined): PushOutcome {
  if (!ticket) return { status: 'error', error: 'missing ticket' };
  if (ticket.status === 'ok') return { status: 'ok' };
  if (ticket.details?.error === 'DeviceNotRegistered') return { status: 'invalid' };
  return { status: 'error', error: ticket.details?.error ?? 'ticket error' };
}

async function sendChunk(fetchFn: typeof fetch, chunk: PushMessage[]): Promise<PushOutcome[]> {
  const tickets = await request(fetchFn, chunk);
  if (typeof tickets !== 'string') return chunk.map((_, i) => outcome(tickets[i]));
  const out: PushOutcome[] = [];
  for (const message of chunk) {
    const single = await request(fetchFn, [message]);
    out.push(typeof single === 'string' ? { status: 'error', error: single } : outcome(single[0]));
  }
  return out;
}

export async function sendPushes(fetchFn: typeof fetch, messages: PushMessage[]): Promise<PushOutcome[]> {
  const out: PushOutcome[] = [];
  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    out.push(...(await sendChunk(fetchFn, messages.slice(i, i + CHUNK_SIZE))));
  }
  return out;
}
