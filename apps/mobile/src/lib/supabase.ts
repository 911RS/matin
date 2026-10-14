import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { getConfig } from '../config';

export const SUPABASE_AUTH_OPTIONS = {
  flowType: 'pkce',
  storage: AsyncStorage,
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: Platform.OS === 'web',
} as const;

let client: SupabaseClient | null = null;

export function createSupabaseClient(
  url: string,
  anonKey: string,
  create: typeof createClient = createClient,
): SupabaseClient {
  const created = create(url, anonKey, { auth: SUPABASE_AUTH_OPTIONS });
  if (AppState.currentState === 'active') void created.auth.startAutoRefresh();
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void created.auth.startAutoRefresh();
    else void created.auth.stopAutoRefresh();
  });
  return created;
}

export function getSupabase(): SupabaseClient {
  if (client) return client;
  const config = getConfig();
  if (config.mode !== 'supabase') throw new Error('Supabase is not configured');
  client = createSupabaseClient(config.url, config.anonKey);
  return client;
}
