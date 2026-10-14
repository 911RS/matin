import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import type { ProfileRow } from '@tenue/backend';
import { SessionProvider } from '../../auth/SessionContext';
import type { AppSession } from '../../auth/SessionContext';
import { RepoProvider } from '../../data/RepoProvider';
import type { Repo } from '../../data/repo';
import { registerMutationDefaults } from '../../data/mutations';
import i18n, { initI18n } from '../../i18n';
import { createQueryClient } from '../../query';
import { SettingsScreen } from '../SettingsScreen';

const mockCalls: string[] = [];
let mockWeb = false;
let mockPwa = { install: 'none', updateReady: false };
const mockApplyUpdate = jest.fn();
const mockPromptInstall = jest.fn(async () => {});

jest.mock('../../pwa/pwa', () => ({
  usePwa: () => ({ ...mockPwa, applyUpdate: mockApplyUpdate, promptInstall: mockPromptInstall }),
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.0' } } }));
jest.mock('../notifications', () => ({
  get remindersNeedNativeApp() {
    return mockWeb;
  },
  cancelDaily: jest.fn(async () => {
    mockCalls.push('cancel');
  }),
  devicePush: {
    getPermissions: jest.fn(async () => ({ granted: true, canAskAgain: true })),
    requestPermissions: jest.fn(async () => ({ granted: true, canAskAgain: true })),
    getExpoPushToken: jest.fn(),
    projectId: undefined,
  },
}));
jest.mock('../deviceLocation', () => ({
  gpsDeps: {},
  cityDeps: {},
  placeName: jest.fn(),
}));
jest.mock('../../lib/supabase', () => ({
  getSupabase: () => ({
    auth: {
      signOut: jest.fn(async () => {
        mockCalls.push('signOut');
        return { error: null };
      }),
    },
  }),
}));
jest.mock('../../auth/guest', () => ({
  endGuest: jest.fn(async () => {
    mockCalls.push('endGuest');
  }),
}));

const PROFILE: ProfileRow = {
  id: 'u1',
  locale: 'en',
  push_time: '07:30:00',
  timezone: 'Europe/Paris',
  lat: null,
  lon: null,
  expo_push_token: null,
};

function makeRepo(): Repo & { updateProfile: jest.Mock; deleteAccount: jest.Mock; claimPushToken: jest.Mock } {
  return {
    userId: async () => 'u1',
    getProfile: jest.fn(async () => PROFILE),
    updateProfile: jest.fn(async () => {}),
    claimPushToken: jest.fn(async (token: string | null) => {
      mockCalls.push(`claim ${token}`);
    }),
    deleteAccount: jest.fn(async () => {
      mockCalls.push('deleteAccount');
    }),
  } as unknown as Repo & { updateProfile: jest.Mock; deleteAccount: jest.Mock; claimPushToken: jest.Mock };
}

let activeClient: QueryClient | null = null;

async function renderSettings(app: AppSession) {
  const repo = makeRepo();
  const client = createQueryClient();
  const defaults = client.getDefaultOptions();
  client.setDefaultOptions({
    queries: { ...defaults.queries, gcTime: Infinity },
    mutations: { ...defaults.mutations, gcTime: Infinity },
  });
  activeClient = client;
  registerMutationDefaults(client, repo, { alwaysOnline: true });
  await render(
    <QueryClientProvider client={client}>
      <RepoProvider repo={repo}>
        <SessionProvider value={app}>
          <SettingsScreen />
        </SessionProvider>
      </RepoProvider>
    </QueryClientProvider>,
  );
  if (mockWeb) await waitFor(() => expect(repo.getProfile).toHaveBeenCalled());
  else await screen.findByText(/^7:30\sAM$/);
  return { repo, client };
}

const signedIn: AppSession = { session: { status: 'signedIn', userId: 'u1' }, mode: 'supabase' };
const guest: AppSession = { session: { status: 'guest', userId: 'local-user' }, mode: 'supabase' };
const unconfigured: AppSession = { session: { status: 'guest', userId: 'local-user' }, mode: 'guest' };

beforeAll(() => {
  initI18n('en');
});

beforeEach(() => {
  mockCalls.length = 0;
  mockWeb = false;
  mockPwa = { install: 'none', updateReady: false };
  mockApplyUpdate.mockClear();
  mockPromptInstall.mockClear();
});

afterEach(async () => {
  await cleanup();
  activeClient?.getMutationCache().clear();
  activeClient?.clear();
  activeClient = null;
  await act(() => i18n.changeLanguage('en'));
});

describe('SettingsScreen', () => {
  it('shows every group with values', async () => {
    await renderSettings(signedIn);
    for (const text of [
      'Settings',
      'Mornings',
      'App',
      'Account',
      'About',
      'Weather data: MET Norway',
      'Place search: © OpenStreetMap contributors',
      'Version 1.0.0',
    ]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect(screen.getByText('Not set')).toBeTruthy();
    expect(screen.getByText('English')).toBeTruthy();
  });

  it('explains that reminders need the phone app on web', async () => {
    mockWeb = true;
    await renderSettings(guest);
    expect(screen.getByText('Morning reminder')).toBeTruthy();
    expect(screen.getByText('Reminders need the iPhone or Android app.')).toBeTruthy();
    expect(screen.queryByLabelText('Morning reminder')).toBeNull();
    expect(screen.queryByText('Reminder time')).toBeNull();
  });

  it('hides the install and update rows by default', async () => {
    await renderSettings(guest);
    expect(screen.queryByText('Install the app')).toBeNull();
    expect(screen.queryByText('Update ready')).toBeNull();
  });

  it('shows the Safari steps on iOS web', async () => {
    mockPwa = { install: 'ios', updateReady: false };
    await renderSettings(guest);
    expect(screen.getByText('Install the app')).toBeTruthy();
    expect(screen.getByText('Tap Share, then Add to Home Screen.')).toBeTruthy();
  });

  it('starts the browser install prompt', async () => {
    mockPwa = { install: 'prompt', updateReady: false };
    await renderSettings(guest);
    await fireEvent.press(screen.getByText('Install the app'));
    expect(mockPromptInstall).toHaveBeenCalledTimes(1);
  });

  it('applies a waiting update', async () => {
    mockPwa = { install: 'none', updateReady: true };
    await renderSettings(guest);
    await fireEvent.press(screen.getByText('Update ready'));
    expect(mockApplyUpdate).toHaveBeenCalledTimes(1);
  });

  it('offers sign out and account deletion to signed-in users', async () => {
    await renderSettings(signedIn);
    expect(screen.getByText('Sign out')).toBeTruthy();
    expect(screen.getByText('Delete account')).toBeTruthy();
    expect(screen.queryByText('Create an account')).toBeNull();
    expect(screen.queryByText('Delete my data')).toBeNull();
  });

  it('offers account creation and data deletion to guests', async () => {
    await renderSettings(guest);
    expect(screen.getByText('Create an account')).toBeTruthy();
    expect(screen.getByText('Delete my data')).toBeTruthy();
    expect(screen.queryByText('Sign out')).toBeNull();
  });

  it('hides account creation when the build has no backend', async () => {
    await renderSettings(unconfigured);
    expect(screen.queryByText('Create an account')).toBeNull();
    expect(screen.getByText('Delete my data')).toBeTruthy();
  });

  it('drops the push token and cancels reminders before signing out', async () => {
    await renderSettings(signedIn);
    await act(async () => fireEvent.press(screen.getByText('Sign out')));
    await waitFor(() => expect(mockCalls).toContain('signOut'));
    expect(mockCalls).toEqual(['claim null', 'cancel', 'signOut']);
  });

  it('asks for a connection before signing out offline', async () => {
    await renderSettings(signedIn);
    onlineManager.setOnline(false);
    try {
      await act(async () => fireEvent.press(screen.getByText('Sign out')));
      expect(screen.getByText('You need a connection to sign out.')).toBeTruthy();
      expect(mockCalls).toEqual([]);
    } finally {
      onlineManager.setOnline(true);
    }
  });

  it('deletes the account only after two confirmations', async () => {
    const { repo, client } = await renderSettings(signedIn);
    const clear = jest.spyOn(client.getMutationCache(), 'clear');
    await act(async () => fireEvent.press(screen.getByText('Delete account')));
    await act(async () => fireEvent.press(screen.getByText('Continue')));
    expect(repo.deleteAccount).not.toHaveBeenCalled();
    await act(async () => fireEvent.press(screen.getByText('Delete everything')));
    await waitFor(() => expect(repo.deleteAccount).toHaveBeenCalledTimes(1));
    expect(clear.mock.invocationCallOrder[0]).toBeLessThan(repo.deleteAccount.mock.invocationCallOrder[0]);
  });

  it('turns a guest delete into a fresh start', async () => {
    const { repo } = await renderSettings(guest);
    await act(async () => fireEvent.press(screen.getByText('Delete my data')));
    expect(screen.getByText('Delete your data?')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByText('Continue')));
    await act(async () => fireEvent.press(screen.getByText('Delete everything')));
    await waitFor(() => expect(mockCalls).toContain('endGuest'));
    expect(repo.deleteAccount).toHaveBeenCalledTimes(1);
    expect(mockCalls).toEqual(['deleteAccount', 'cancel', 'endGuest']);
  });

  it('opens sign-in from the guest account row', async () => {
    await renderSettings(guest);
    await act(async () => fireEvent.press(screen.getByText('Create an account')));
    expect(mockCalls).toEqual(['endGuest']);
  });

  it('saves the picked reminder time as HH:MM:00', async () => {
    const { repo } = await renderSettings(signedIn);
    await act(async () => fireEvent.press(screen.getByText('Reminder time')));
    await act(async () => fireEvent.press(screen.getByText(/^8:15\sAM$/)));
    await waitFor(() => expect(repo.updateProfile).toHaveBeenCalledWith({ push_time: '08:15:00' }));
    expect(screen.getByText(/^8:15\sAM$/)).toBeTruthy();
  });

  it('switches the language right away and saves it', async () => {
    const { repo } = await renderSettings(signedIn);
    await act(async () => fireEvent.press(screen.getByText('Language')));
    await act(async () => fireEvent.press(screen.getByText('Français')));
    await waitFor(() => expect(repo.updateProfile).toHaveBeenCalledWith({ locale: 'fr' }));
    expect(await screen.findByText('Réglages')).toBeTruthy();
    expect(screen.getByText('Le matin')).toBeTruthy();
    const AsyncStorage = jest.requireMock('@react-native-async-storage/async-storage');
    expect(await AsyncStorage.getItem('tenue-language-explicit:u1')).toBe('1');
  });

  it('remembers that notifications were turned off', async () => {
    await renderSettings(signedIn);
    const toggle = screen.getByLabelText('Morning reminder');
    await act(async () => fireEvent(toggle, 'valueChange', false));
    const AsyncStorage = jest.requireMock('@react-native-async-storage/async-storage');
    expect(await AsyncStorage.getItem('tenue-notifications-off:u1')).toBe('1');
  });
});
