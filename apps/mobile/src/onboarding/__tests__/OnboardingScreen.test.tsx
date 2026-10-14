import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import type { ItemRow, ProfileRow } from '@tenue/backend';
import { SessionProvider } from '../../auth/SessionContext';
import type { AppSession } from '../../auth/SessionContext';
import { RepoProvider } from '../../data/RepoProvider';
import type { Repo } from '../../data/repo';
import i18n, { initI18n } from '../../i18n';
import { createQueryClient } from '../../query';
import { onboardingDoneKey } from '../flag';
import { OnboardingScreen } from '../OnboardingScreen';

const mockPush = jest.fn();
let mockWeb = false;

jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('../../settings/notifications', () => ({
  get remindersNeedNativeApp() {
    return mockWeb;
  },
  cancelDaily: jest.fn(),
  devicePush: {
    getPermissions: jest.fn(async () => ({ granted: false, canAskAgain: false })),
    requestPermissions: jest.fn(async () => ({ granted: false, canAskAgain: false })),
    getExpoPushToken: jest.fn(),
    projectId: undefined,
  },
}));
jest.mock('../../settings/deviceLocation', () => ({ gpsDeps: {}, cityDeps: {}, placeName: jest.fn() }));

const PROFILE: ProfileRow = {
  id: 'u1',
  locale: 'en',
  push_time: '07:30:00',
  timezone: 'Europe/Paris',
  lat: null,
  lon: null,
  expo_push_token: null,
};

function item(id: string, category: string): ItemRow {
  return { id, category, color_family: 'navy', image_path: null } as unknown as ItemRow;
}

const ITEMS = [item('1', 'top'), item('2', 'top'), item('3', 'bottom'), item('4', 'bottom'), item('5', 'shoes')];

let client: QueryClient | null = null;
const hardwareBack = jest.spyOn(BackHandler, 'addEventListener');

async function renderScreen(userId: string | null, repoUserId: string | null, items: ItemRow[] = []) {
  const repo = {
    userId: jest.fn(async () => repoUserId),
    getProfile: jest.fn(async () => PROFILE),
    listItems: jest.fn(async () => items),
  } as unknown as Repo;
  client = createQueryClient();
  const app: AppSession = { session: { status: 'guest', userId }, mode: 'guest' };
  await render(
    <QueryClientProvider client={client}>
      <RepoProvider repo={repo}>
        <SessionProvider value={app}>
          <OnboardingScreen />
        </SessionProvider>
      </RepoProvider>
    </QueryClientProvider>,
  );
  return repo;
}

beforeAll(() => {
  initI18n('en');
});

afterEach(async () => {
  await cleanup();
  client?.clear();
  client = null;
  mockPush.mockClear();
  hardwareBack.mockClear();
  await AsyncStorage.clear();
  await act(() => i18n.changeLanguage('en'));
});

describe('OnboardingScreen', () => {
  it('offers Add a piece until the closet is complete, then Continue', async () => {
    await renderScreen('u1', 'u1', ITEMS.slice(0, 2));
    await screen.findByText('2 / 2');
    expect(screen.getByText('Add a piece')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByText('Add a piece')));
    expect(mockPush).toHaveBeenCalledWith('/add-item');
  });

  it('moves to step 2 and back with the Back button and hardware back', async () => {
    await renderScreen('u1', 'u1', ITEMS);
    await act(async () => fireEvent.press(await screen.findByText('Continue')));
    expect(screen.getByText('Set up your mornings')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByText('Back')));
    expect(screen.getByText('Start your closet')).toBeTruthy();

    await act(async () => fireEvent.press(screen.getByText('Continue')));
    const press = hardwareBack.mock.calls.at(-1)?.[1] as () => boolean;
    let handled = false;
    await act(async () => {
      handled = press();
    });
    expect(handled).toBe(true);
    await waitFor(() => expect(screen.getByText('Start your closet')).toBeTruthy());
  });

  it('shows the blocked-notifications hint with a way to open settings', async () => {
    await renderScreen('u1', 'u1', ITEMS);
    await act(async () => fireEvent.press(await screen.findByText('Continue')));
    expect(await screen.findByText('Open settings')).toBeTruthy();
  });

  it('explains that reminders need the phone app on web', async () => {
    mockWeb = true;
    try {
      await renderScreen('u1', 'u1', ITEMS);
      await act(async () => fireEvent.press(await screen.findByText('Continue')));
      expect(await screen.findByText('Reminders need the iPhone or Android app.')).toBeTruthy();
      expect(screen.queryByLabelText('Morning reminder')).toBeNull();
      expect(screen.queryByText('Open settings')).toBeNull();
      expect(screen.queryByText('Reminder time')).toBeNull();
    } finally {
      mockWeb = false;
    }
  });

  it('lets the user try again when no account id is available', async () => {
    const repo = await renderScreen(null, null);
    const skip = await screen.findByText('Skip for now');
    await act(async () => fireEvent.press(skip));
    await waitFor(() => expect(repo.userId).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Skip for now' }).props.accessibilityState.disabled).toBe(false),
    );
    await act(async () => fireEvent.press(screen.getByText('Skip for now')));
    await waitFor(() => expect(repo.userId).toHaveBeenCalledTimes(2));
  });

  it('stores the flag on skip when a user id is known', async () => {
    await renderScreen('u1', 'u1');
    await act(async () => fireEvent.press(await screen.findByText('Skip for now')));
    await waitFor(async () => expect(await AsyncStorage.getItem(onboardingDoneKey('u1'))).toBe('1'));
  });
});
