import type { Session } from '@supabase/supabase-js';
import { waitForSession } from '../waitForSession';
import type { SessionClient } from '../waitForSession';

const session = { access_token: 't', user: { id: 'u1' } } as unknown as Session;

function fakeClient(initial: Session | null) {
  let listener: ((event: string, session: Session | null) => void) | null = null;
  const unsubscribe = jest.fn();
  const client = {
    auth: {
      getSession: jest.fn(async () => ({ data: { session: initial }, error: null })),
      onAuthStateChange: jest.fn((cb: typeof listener) => {
        listener = cb;
        return { data: { subscription: { unsubscribe } } };
      }),
    },
  } as unknown as SessionClient;
  return { client, unsubscribe, emit: (event: string, s: Session | null) => listener?.(event, s) };
}

describe('waitForSession', () => {
  it('resolves with an existing session', async () => {
    const { client, unsubscribe } = fakeClient(session);
    await expect(waitForSession(client)).resolves.toBe(session);
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('resolves when the sign-in event arrives later', async () => {
    const { client, emit, unsubscribe } = fakeClient(null);
    const pending = waitForSession(client);
    await Promise.resolve();
    emit('SIGNED_IN', session);
    await expect(pending).resolves.toBe(session);
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('ignores events without a session', async () => {
    jest.useFakeTimers();
    try {
      const { client, emit } = fakeClient(null);
      const pending = waitForSession(client, 1000);
      emit('INITIAL_SESSION', null);
      jest.advanceTimersByTime(1000);
      await expect(pending).resolves.toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('gives up with null after the timeout', async () => {
    jest.useFakeTimers();
    try {
      const { client, unsubscribe } = fakeClient(null);
      const pending = waitForSession(client, 500);
      jest.advanceTimersByTime(500);
      await expect(pending).resolves.toBeNull();
      expect(unsubscribe).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
