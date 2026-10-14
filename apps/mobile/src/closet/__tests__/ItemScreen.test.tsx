import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { daysBefore, localDate } from '@tenue/backend';
import type { ItemRow } from '@tenue/backend';
import { ITEMS_KEY } from '../../data/keys';
import { registerMutationDefaults } from '../../data/mutations';
import { RepoProvider } from '../../data/RepoProvider';
import type { Repo } from '../../data/repo';
import { initI18n } from '../../i18n';
import { createQueryClient } from '../../query';
import ItemScreen from '../../../app/item/[id]';

const mockBack = jest.fn();

jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-router', () => ({
  router: { back: () => mockBack() },
  useLocalSearchParams: () => ({ id: 't1' }),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('../pending', () => ({
  pendingFiles: { exists: () => false, uriFor: async (p: string) => `file:///pending/${p}`, remove: () => {} },
}));

const ITEM: ItemRow = {
  id: 't1',
  user_id: 'u',
  category: 'top',
  color_hex: '#FFFFFF',
  color_family: 'white',
  warmth: 2,
  formality: 'casual',
  image_path: 'u/t1.webp',
  original_path: 'u/t1-original.jpg',
  archived_at: null,
  unavailable_until: null,
};

beforeAll(() => initI18n('en'));

function dispose(client: ReturnType<typeof createQueryClient>) {
  for (const mutation of client.getMutationCache().getAll()) mutation.destroy();
  for (const query of client.getQueryCache().getAll()) query.destroy();
  client.clear();
}
afterEach(() => mockBack.mockClear());

async function show(saveItem: Repo['saveItem']) {
  const repo = {
    saveItem: jest.fn(saveItem),
    listItems: jest.fn(async () => [ITEM]),
    listOutfits: jest.fn(async () => []),
    imageUrl: jest.fn(async (p: string) => `https://img/${p}`),
  } as unknown as Repo;
  const client = createQueryClient();
  registerMutationDefaults(client, repo, { alwaysOnline: true });
  client.setMutationDefaults(['saveItem'], { ...client.getMutationDefaults(['saveItem']), retry: false });
  client.setQueryData(ITEMS_KEY, [ITEM]);
  await render(
    <QueryClientProvider client={client}>
      <RepoProvider repo={repo}>
        <ItemScreen />
      </RepoProvider>
    </QueryClientProvider>,
  );
  return { client, repo };
}

describe('ItemScreen', () => {
  it('shows and announces an inline error when an edit fails', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const { client } = await show(async () => {
      throw new Error('denied');
    });
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Warm' }));
    });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not save this piece. Try again.'));
    expect(announce).toHaveBeenCalledWith('Could not save this piece. Try again.');
    await screen.unmount();
    dispose(client);
  });

  it('stays on the screen with an inline error when archiving fails', async () => {
    const { client } = await show(async () => {
      throw new Error('denied');
    });
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Archive piece' }));
    });
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Archive' }));
    });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not archive this piece. Try again.'));
    expect(mockBack).not.toHaveBeenCalled();
    expect(client.getQueryData<ItemRow[]>(ITEMS_KEY)).toEqual([ITEM]);
    await screen.unmount();
    dispose(client);
  });

  it('goes back once the archive is saved', async () => {
    const { client } = await show(async () => {});
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Archive piece' }));
    });
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Archive' }));
    });
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).toBeNull();
    await screen.unmount();
    dispose(client);
  });

  it('saves the chosen number of days as the unavailable date', async () => {
    const { client, repo } = await show(async () => {});
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: '3 days' }));
    });
    await waitFor(() => expect(repo.saveItem).toHaveBeenCalled());
    const saved = jest.mocked(repo.saveItem).mock.calls[0]![0] as ItemRow;
    const today = localDate(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(saved.unavailable_until).toBe(daysBefore(today, -3));
    expect(screen.getByRole('button', { name: 'Available' }).props.accessibilityState.selected).toBe(true);
    await screen.unmount();
    dispose(client);
  });
});
