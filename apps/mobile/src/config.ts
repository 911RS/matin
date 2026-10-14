export type AppConfig =
  | { mode: 'demo' }
  | { mode: 'supabase'; url: string; anonKey: string }
  | { mode: 'guest' };

type Env = Record<string, string | undefined>;

function buildEnv(): Env {
  return {
    EXPO_PUBLIC_DEMO: process.env.EXPO_PUBLIC_DEMO,
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export function getConfig(env: Env = buildEnv()): AppConfig {
  if (env.EXPO_PUBLIC_DEMO === '1') return { mode: 'demo' };
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (url && anonKey) return { mode: 'supabase', url, anonKey };
  return { mode: 'guest' };
}
