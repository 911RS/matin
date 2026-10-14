import { expect, test, vi } from 'vitest';
import { buildMessage, sendPushes, type PushMessage } from '../src/push.ts';

const outfit = { itemIds: ['a', 'b'], reason: 'Mild day, light layers.' };

test('buildMessage for an outfit uses the reason', () => {
  expect(buildMessage('tok', 'en', '2026-10-12', outfit)).toEqual({
    to: 'tok',
    title: "Today's outfit",
    body: 'Mild day, light layers.',
    data: { date: '2026-10-12' },
  });
  const fr = buildMessage('tok', 'fr', '2026-10-12', outfit);
  expect(fr.title).toBe('Ta tenue du jour');
  expect(fr.body).toBe('Mild day, light layers.');
});

test('buildMessage for missing categories follows the array order', () => {
  const missing = { missing: ['top', 'shoes'] as ('top' | 'shoes')[] };
  expect(buildMessage('t', 'en', 'd', missing).body).toBe('Add a top, shoes to get suggestions');
  expect(buildMessage('t', 'fr', 'd', missing).body).toBe(
    'Ajoute un haut, des chaussures pour avoir des suggestions',
  );
  expect(buildMessage('t', 'en', 'd', { missing: ['bottom'] }).body).toBe('Add a bottom to get suggestions');
});

const msgs = (n: number): PushMessage[] =>
  Array.from({ length: n }, (_, i) => ({ to: `tok${i}`, title: 't', body: 'b', data: { date: 'd' } }));

const okResponse = (data: unknown) => ({ ok: true, json: async () => ({ data }) }) as Response;
const sentIn = (init?: RequestInit) => JSON.parse(init!.body as string) as PushMessage[];
const allOk = (init?: RequestInit) => okResponse(sentIn(init).map((_, i) => ({ status: 'ok', id: String(i) })));
const statuses = (out: { status: string }[]) => out.map((o) => o.status);

test('sendPushes chunks by 100 and reports one outcome per message', async () => {
  const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) =>
    okResponse(
      sentIn(init).map((_, i) =>
        i === 3
          ? { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } }
          : { status: 'ok', id: String(i) },
      ),
    ),
  );
  const out = await sendPushes(fetchFn as unknown as typeof fetch, msgs(150));
  expect(fetchFn).toHaveBeenCalledTimes(2);
  const [url, init] = fetchFn.mock.calls[0]!;
  expect(url).toBe('https://exp.host/--/api/v2/push/send');
  expect(init!.method).toBe('POST');
  expect(init!.headers).toEqual({ Accept: 'application/json', 'Content-Type': 'application/json' });
  expect(init!.signal).toBeInstanceOf(AbortSignal);
  expect(sentIn(fetchFn.mock.calls[1]![1])).toHaveLength(50);
  expect(out).toHaveLength(150);
  expect(out.flatMap((o, i) => (o.status === 'invalid' ? [i] : []))).toEqual([3, 103]);
  expect(out.filter((o) => o.status === 'ok')).toHaveLength(148);
});

test('other ticket errors are failures, not invalid tokens', async () => {
  const fetchFn = vi.fn(async () =>
    okResponse([{ status: 'error', message: 'x', details: { error: 'MessageRateExceeded' } }, { status: 'error', message: 'y' }]),
  );
  const out = await sendPushes(fetchFn as unknown as typeof fetch, msgs(3));
  expect(out).toEqual([
    { status: 'error', error: 'MessageRateExceeded' },
    { status: 'error', error: 'ticket error' },
    { status: 'error', error: 'missing ticket' },
  ]);
});

test('a rejected chunk is retried one message at a time', async () => {
  const fetchFn = vi.fn(async (_u: unknown, init?: RequestInit) => {
    const sent = sentIn(init);
    if (sent.length > 1) return { ok: false, status: 400, json: async () => ({}) } as Response;
    if (sent[0]!.to === 'tok1') return { ok: false, status: 400, json: async () => ({}) } as Response;
    if (sent[0]!.to === 'tok2') throw new Error('network');
    if (sent[0]!.to === 'tok3') return okResponse([{ status: 'error', details: { error: 'DeviceNotRegistered' } }]);
    return allOk(init);
  });
  const out = await sendPushes(fetchFn as unknown as typeof fetch, msgs(5));
  expect(fetchFn).toHaveBeenCalledTimes(6);
  expect(statuses(out)).toEqual(['ok', 'error', 'error', 'invalid', 'ok']);
  expect(out[1]).toEqual({ status: 'error', error: 'HTTP 400' });
  expect(out[2]).toEqual({ status: 'error', error: 'network' });
});

test('a chunk that throws or lacks a data array is retried per message', async () => {
  let call = 0;
  const fetchFn = vi.fn(async (_u: unknown, init?: RequestInit) => {
    call++;
    if (call === 1) throw new Error('network');
    if (call === 4) return { ok: true, json: async () => ({ errors: [] }) } as Response;
    return allOk(init);
  });
  const out = await sendPushes(fetchFn as unknown as typeof fetch, msgs(3));
  expect(fetchFn).toHaveBeenCalledTimes(4);
  expect(statuses(out)).toEqual(['ok', 'ok', 'error']);
});

test('sendPushes with no messages makes no requests', async () => {
  const fetchFn = vi.fn();
  expect(await sendPushes(fetchFn as unknown as typeof fetch, [])).toEqual([]);
  expect(fetchFn).not.toHaveBeenCalled();
});
