import type { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { SessionProvider } from '../../auth/SessionContext';
import { onboardingQueryKey } from '../../data/keys';
import { LOCAL_USER_ID } from '../../data/localRepo';
import { RepoProvider } from '../../data/RepoProvider';
import type { Repo } from '../../data/repo';
import { getOnboardingDone, setOnboardingDone } from '../../onboarding/flag';
import { explicitLanguageKey, hasExplicitLanguage } from '../../settings/language';
import { getOccasion, setOccasion } from '../../today/occasion';
import { getLocationLabel, setLocationLabel } from '../../settings/prefs';
import { carryOverOnboarding, carryOverPrefs, useGuestMigration } from '../useGuestMigration';

jest.mock('expo-file-system', () => ({
  Paths: { document: { uri: 'file:///docs/' } },
  Directory: jest.fn(),
  File: jest.fn(() => ({ exists: false })),
}));

beforeEach(() => AsyncStorage.clear());

describe('carryOverPrefs', () => {
  it('moves the explicit language choice to the cloud user when settings were copied', async () => {
    await AsyncStorage.setItem(explicitLanguageKey(LOCAL_USER_ID), '1');
    await setLocationLabel(LOCAL_USER_ID, 'Tunis');
    await carryOverPrefs('cloud-1', { copiedLocation: true, copiedSettings: true });
    expect(await hasExplicitLanguage('cloud-1')).toBe(true);
    expect(await getLocationLabel('cloud-1')).toBe('Tunis');
    expect(await getLocationLabel(LOCAL_USER_ID)).toBeNull();
  });

  it('leaves the cloud language alone when the cloud profile kept its own settings', async () => {
    await AsyncStorage.setItem(explicitLanguageKey(LOCAL_USER_ID), '1');
    await carryOverPrefs('cloud-1', { copiedLocation: false, copiedSettings: false });
    expect(await hasExplicitLanguage('cloud-1')).toBe(false);
  });
});

describe('occasion carry-over', () => {
  it('moves only today\'s occasion to the cloud user', async () => {
    const now = () => new Date('2026-10-12T10:00:00Z');
    await setOccasion(LOCAL_USER_ID, '2026-10-12', 'formal');
    await setOccasion(LOCAL_USER_ID, '2026-10-11', 'smart');
    await carryOverPrefs('cloud-1', { copiedLocation: false, copiedSettings: false }, now);
    expect(await getOccasion('cloud-1', '2026-10-12')).toBe('formal');
    expect(await getOccasion('cloud-1', '2026-10-11')).toBeNull();
    expect(await getOccasion(LOCAL_USER_ID, '2026-10-12')).toBeNull();
  });
});

describe('carryOverOnboarding', () => {
  it('copies the guest onboarding flag', async () => {
    await setOnboardingDone(LOCAL_USER_ID);
    const onDone = jest.fn();
    await carryOverOnboarding('cloud-1', onDone);
    expect(await getOnboardingDone('cloud-1')).toBe(true);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the guest never finished onboarding', async () => {
    const onDone = jest.fn();
    await carryOverOnboarding('cloud-1', onDone);
    expect(await getOnboardingDone('cloud-1')).toBe(false);
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe('useGuestMigration', () => {
  it('copies the onboarding flag before checking for guest data', async () => {
    await setOnboardingDone(LOCAL_USER_ID);
    const client = new QueryClient();
    const repo = {} as Repo;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <RepoProvider repo={repo}>
          <SessionProvider value={{ mode: 'supabase', session: { status: 'signedIn', userId: 'cloud-2' } as never }}>
            {children}
          </SessionProvider>
        </RepoProvider>
      </QueryClientProvider>
    );
    const hook = await renderHook(() => useGuestMigration(), { wrapper });
    await waitFor(() => expect(client.getQueryData(onboardingQueryKey('cloud-2'))).toBe(true));
    expect(await getOnboardingDone('cloud-2')).toBe(true);
    expect(hook.result.current.status).toBe('idle');
    await hook.unmount();
    client.clear();
  });
});
