import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { onlineManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import type { GateRoute } from '../src/auth/gate';
import { SessionProvider } from '../src/auth/SessionContext';
import { useGateRoute } from '../src/auth/useGateRoute';
import { useSession } from '../src/auth/useSession';
import type { SessionState } from '../src/auth/useSession';
import { getConfig } from '../src/config';
import type { AppConfig } from '../src/config';
import { cacheBuster, useCacheScope } from '../src/data/cacheScope';
import { pendingFiles } from '../src/closet/pending';
import { resumeOrphanUploads } from '../src/closet/uploads';
import { createLocalRepo } from '../src/data/localRepo';
import { registerMutationDefaults } from '../src/data/mutations';
import type { Repo } from '../src/data/repo';
import { RepoProvider, useRepo } from '../src/data/RepoProvider';
import { SupabaseRepo } from '../src/data/supabaseRepo';
import { useDemoSeed } from '../src/data/useDemoSeed';
import { useFilesReady } from '../src/data/useFilesReady';
import { initI18n } from '../src/i18n';
import { MigrationBanner } from '../src/migrate/MigrationBanner';
import { useGuestMigration } from '../src/migrate/useGuestMigration';
import { getSupabase } from '../src/lib/supabase';
import { warmUpPhotoModels } from '../src/photo/warmup';
import { startPwa } from '../src/pwa/pwa';
import { CACHE_MAX_AGE, createQueryClient, dehydrateOptions, persister, wireOnlineManager } from '../src/query';
import { useTimezoneSync } from '../src/settings/timezone';
import { useLocaleSync, useReminderSync } from '../src/settings/useSettingsSync';
import { colors } from '../src/theme';
import { installWebCss } from '../src/ui/webCss';

initI18n();
installWebCss();
SplashScreen.preventAutoHideAsync().catch(() => {});

type Mode = AppConfig['mode'];

type RepoKind = 'demo' | 'guest' | 'supabase';

const screenOptions = { headerShown: false, contentStyle: { backgroundColor: colors.paper } } as const;

function repoKindFor(mode: Mode, session: SessionState): RepoKind | null {
  if (mode === 'demo') return 'demo';
  if (session.status === 'loading') return null;
  return session.status === 'guest' ? 'guest' : 'supabase';
}

function buildRepo(kind: RepoKind): Repo {
  if (kind === 'demo') return createLocalRepo({ kind: 'demo' });
  if (kind === 'guest') return createLocalRepo({ kind: 'guest' });
  return new SupabaseRepo(getSupabase());
}

function Routes({ route }: { route: GateRoute }) {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={screenOptions}>
        <Stack.Protected guard={route === '/(tabs)'}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="item/[id]" />
        </Stack.Protected>
        <Stack.Protected guard={route === '/onboarding'}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={route === '/sign-in'}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        <Stack.Protected guard={route === '/(tabs)' || route === '/onboarding'}>
          <Stack.Screen name="add-item" options={{ presentation: 'modal' }} />
        </Stack.Protected>
        <Stack.Protected guard={__DEV__}>
          <Stack.Screen name="dev-photo" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

function Gate({ session }: { session: SessionState }) {
  const repo = useRepo();
  useTimezoneSync(repo, session.status, session.userId);
  const route = useGateRoute(session);
  const inApp = route === '/(tabs)';
  useLocaleSync(route !== null && route !== '/sign-in');
  useReminderSync(inApp);
  const migration = useGuestMigration();
  if (route === null) return null;
  return (
    <View style={styles.root}>
      <Routes route={route} />
      <MigrationBanner status={migration.status} />
    </View>
  );
}

function ConfiguredRoot({
  repo,
  kind,
  mode,
  session,
}: {
  repo: Repo;
  kind: RepoKind;
  mode: Mode;
  session: SessionState;
}) {
  const [client] = useState(() => {
    const created = createQueryClient();
    registerMutationDefaults(created, repo, { alwaysOnline: kind !== 'supabase' });
    return created;
  });

  const scoped = useCacheScope(client, session, persister);
  const sessionValue = useMemo(() => ({ session, mode }), [session, mode]);

  useEffect(() => wireOnlineManager(), []);
  const restored = useRef(false);
  useEffect(
    () =>
      onlineManager.subscribe((online) => {
        if (online && restored.current) resumeOrphanUploads(client, pendingFiles, session.userId);
      }),
    [client, session.userId],
  );
  useEffect(() => {
    warmUpPhotoModels();
    startPwa();
  }, []);

  if (!scoped) return null;
  return (
    <PersistQueryClientProvider
      key={cacheBuster(session.userId)}
      client={client}
      persistOptions={{
        persister,
        maxAge: CACHE_MAX_AGE,
        buster: cacheBuster(session.userId),
        dehydrateOptions,
      }}
      onSuccess={() => {
        restored.current = true;
        resumeOrphanUploads(client, pendingFiles, session.userId);
        return client.resumePausedMutations();
      }}
    >
      <RepoProvider repo={repo}>
        <SessionProvider value={sessionValue}>
          <Gate session={session} />
        </SessionProvider>
      </RepoProvider>
    </PersistQueryClientProvider>
  );
}

export default function RootLayout() {
  const [mode] = useState(() => getConfig().mode);
  const filesReady = useFilesReady();
  const session = useSession();
  const seeded = useDemoSeed(mode === 'demo');
  const kind = repoKindFor(mode, session);
  const repo = useMemo(() => (kind ? buildRepo(kind) : null), [kind]);

  if (!seeded || !filesReady) return null;
  if (!kind || !repo) return null;
  return (
    <ConfiguredRoot key={kind} repo={repo} kind={kind} mode={mode} session={session} />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
