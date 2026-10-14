import { Platform } from 'react-native';
import type { AuthClient } from '../signIn';
import { codeFromUrl, sendEmailCode, signInWithApple, startGoogle, verifyEmailCode } from '../signIn';

const session = { access_token: 't', user: { id: 'u1' } };

function fakeClient(over: Record<string, jest.Mock> = {}) {
  const auth = {
    signInWithIdToken: jest.fn(async () => ({ data: { session }, error: null })),
    signInWithOAuth: jest.fn(async () => ({
      data: { provider: 'google', url: 'https://auth.example/authorize?x=1' },
      error: null,
    })),
    exchangeCodeForSession: jest.fn(async () => ({ data: { session }, error: null })),
    signInWithOtp: jest.fn(async () => ({ data: {}, error: null })),
    verifyOtp: jest.fn(async () => ({ data: { session }, error: null })),
    ...over,
  };
  return { client: { auth } as unknown as AuthClient, auth };
}

describe('signInWithApple', () => {
  it('signs in with the identity token', async () => {
    const { client, auth } = fakeClient();
    const result = await signInWithApple(client, async () => ({ identityToken: 'apple-jwt' }));
    expect(auth.signInWithIdToken).toHaveBeenCalledWith({ provider: 'apple', token: 'apple-jwt' });
    expect(result).toBe(session);
  });

  it('returns null when the user cancels', async () => {
    const { client, auth } = fakeClient();
    const cancel = Object.assign(new Error('cancelled'), { code: 'ERR_REQUEST_CANCELED' });
    const result = await signInWithApple(client, async () => {
      throw cancel;
    });
    expect(result).toBeNull();
    expect(auth.signInWithIdToken).not.toHaveBeenCalled();
  });

  it('rethrows other credential errors', async () => {
    const { client } = fakeClient();
    await expect(
      signInWithApple(client, async () => {
        throw Object.assign(new Error('boom'), { code: 'ERR_REQUEST_FAILED' });
      }),
    ).rejects.toThrow('boom');
  });

  it('fails when Apple returns no identity token', async () => {
    const { client } = fakeClient();
    await expect(signInWithApple(client, async () => ({ identityToken: null }))).rejects.toThrow();
  });

  it('throws the Supabase error', async () => {
    const err = new Error('bad token');
    const { client } = fakeClient({
      signInWithIdToken: jest.fn(async () => ({ data: { session: null }, error: err })),
    });
    await expect(signInWithApple(client, async () => ({ identityToken: 'x' }))).rejects.toBe(err);
  });
});

describe('codeFromUrl', () => {
  it('reads the code from the query string', () => {
    expect(codeFromUrl('matin://auth/callback?code=abc123&state=s')).toBe('abc123');
  });

  it('reads a code placed in the fragment', () => {
    expect(codeFromUrl('matin://auth/callback#code=a%2Fb')).toBe('a/b');
  });

  it('returns null when there is no code', () => {
    expect(codeFromUrl('matin://auth/callback?error=access_denied')).toBeNull();
  });
});

describe('startGoogle', () => {
  const redirectTo = 'matin://auth/callback';

  it('opens the provider URL and exchanges the returned code', async () => {
    const { client, auth } = fakeClient();
    const openBrowser = jest.fn(async () => ({ type: 'success' as const, url: `${redirectTo}?code=xyz` }));
    const result = await startGoogle(client, openBrowser, redirectTo);
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    expect(openBrowser).toHaveBeenCalledWith('https://auth.example/authorize?x=1', redirectTo);
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('xyz');
    expect(result).toBe(session);
  });

  it('returns null when the browser is dismissed', async () => {
    const { client, auth } = fakeClient();
    const result = await startGoogle(client, async () => ({ type: 'cancel' as const }), redirectTo);
    expect(result).toBeNull();
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('throws when the redirect has no code', async () => {
    const { client } = fakeClient();
    await expect(
      startGoogle(client, async () => ({ type: 'success' as const, url: `${redirectTo}?error=denied` }), redirectTo),
    ).rejects.toThrow();
  });

  it('throws when Supabase cannot build the provider URL', async () => {
    const err = new Error('provider disabled');
    const { client } = fakeClient({
      signInWithOAuth: jest.fn(async () => ({ data: { provider: 'google', url: null }, error: err })),
    });
    await expect(startGoogle(client, jest.fn(), redirectTo)).rejects.toBe(err);
  });
});

describe('startGoogle on web', () => {
  const original = Platform.OS;
  const globals = globalThis as { window?: unknown };
  const hadWindow = 'window' in globals;
  const previousWindow = globals.window;

  beforeEach(() => {
    Platform.OS = 'web';
    globals.window = { location: { origin: 'https://matin.example' } };
  });

  afterEach(() => {
    Platform.OS = original;
    if (hadWindow) globals.window = previousWindow;
    else delete globals.window;
  });

  it('redirects the page to the web callback without opening a browser', async () => {
    const { client, auth } = fakeClient();
    const openBrowser = jest.fn();
    const result = await startGoogle(client, openBrowser, 'matin://auth/callback');
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://matin.example/auth/callback' },
    });
    expect(openBrowser).not.toHaveBeenCalled();
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('throws when Supabase refuses the request', async () => {
    const err = new Error('provider disabled');
    const { client } = fakeClient({
      signInWithOAuth: jest.fn(async () => ({ data: { provider: 'google', url: null }, error: err })),
    });
    await expect(startGoogle(client, jest.fn(), 'matin://auth/callback')).rejects.toBe(err);
  });
});

describe('email code', () => {
  it('sends a code to the trimmed email and creates the user if needed', async () => {
    const { client, auth } = fakeClient();
    await sendEmailCode(client, '  me@example.com ');
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'me@example.com',
      options: { shouldCreateUser: true },
    });
  });

  it('verifies the 6-digit code as an email OTP', async () => {
    const { client, auth } = fakeClient();
    const result = await verifyEmailCode(client, 'me@example.com', ' 123456 ');
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'me@example.com', token: '123456', type: 'email' });
    expect(result).toBe(session);
  });

  it('throws when sending fails', async () => {
    const err = new Error('rate limited');
    const { client } = fakeClient({ signInWithOtp: jest.fn(async () => ({ data: {}, error: err })) });
    await expect(sendEmailCode(client, 'me@example.com')).rejects.toBe(err);
  });

  it('throws when the code is wrong', async () => {
    const err = new Error('expired');
    const { client } = fakeClient({
      verifyOtp: jest.fn(async () => ({ data: { session: null }, error: err })),
    });
    await expect(verifyEmailCode(client, 'me@example.com', '000000')).rejects.toBe(err);
  });
});
