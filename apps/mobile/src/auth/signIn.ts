import { Platform } from 'react-native';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { withBase } from '../pwa/basePath';

export type AuthClient = {
  auth: Pick<
    SupabaseClient['auth'],
    'signInWithIdToken' | 'signInWithOAuth' | 'exchangeCodeForSession' | 'signInWithOtp' | 'verifyOtp'
  >;
};

export type AppleCredential = { identityToken: string | null };

export type BrowserResult = { type: 'success'; url: string } | { type: string; url?: undefined };

export type OpenBrowser = (url: string, redirectTo: string) => Promise<BrowserResult>;

export function isCancel(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'ERR_REQUEST_CANCELED'
  );
}

export async function signInWithApple(
  client: AuthClient,
  requestCredential: () => Promise<AppleCredential>,
): Promise<Session | null> {
  let credential: AppleCredential;
  try {
    credential = await requestCredential();
  } catch (error) {
    if (isCancel(error)) return null;
    throw error;
  }
  if (!credential.identityToken) throw new Error('Apple returned no identity token');
  const { data, error } = await client.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) throw error;
  return data.session;
}

export function codeFromUrl(url: string): string | null {
  const start = url.search(/[?#]/);
  if (start < 0) return null;
  for (const part of url.slice(start + 1).split(/[&#?]/)) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq) === 'code') {
      const value = decodeURIComponent(part.slice(eq + 1).replace(/\+/g, ' '));
      return value || null;
    }
  }
  return null;
}

export async function startGoogle(
  client: AuthClient,
  openBrowser: OpenBrowser,
  redirectTo: string,
): Promise<Session | null> {
  if (Platform.OS === 'web') {
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${withBase('/auth/callback')}` },
    });
    if (error) throw error;
    return null;
  }
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('No provider URL');
  const result = await openBrowser(data.url, redirectTo);
  if (result.type !== 'success' || !result.url) return null;
  const code = codeFromUrl(result.url);
  if (!code) throw new Error('No auth code in redirect');
  const exchanged = await client.auth.exchangeCodeForSession(code);
  if (exchanged.error) throw exchanged.error;
  return exchanged.data.session;
}

export async function sendEmailCode(client: AuthClient, email: string): Promise<void> {
  const { error } = await client.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
}

export async function verifyEmailCode(client: AuthClient, email: string, code: string): Promise<Session | null> {
  const { data, error } = await client.auth.verifyOtp({
    email: email.trim(),
    token: code.trim(),
    type: 'email',
  });
  if (error) throw error;
  return data.session;
}
