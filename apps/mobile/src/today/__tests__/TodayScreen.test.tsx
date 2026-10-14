import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ItemRow, OutfitRow } from '@tenue/backend';
import i18n, { initI18n } from '../../i18n';
import { createQueryClient } from '../../query';
import { RepoProvider } from '../../data/RepoProvider';
import type { Repo } from '../../data/repo';
import type { TodayApi } from '../useToday';
import type { TodayState } from '../types';
import { TodayScreen } from '../TodayScreen';
import { outfitReason, splitReason } from '../present';

jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View };
});
jest.mock('../../closet/pending', () => ({
  pendingFiles: { exists: () => false, uriFor: async (p: string) => `file:///pending/${p}` },
}));

const mockApi: {
  initial: TodayState | undefined;
  busy: boolean;
  failed: boolean;
  offline: boolean;
  wear: jest.Mock;
  swap: jest.Mock;
  shuffle: jest.Mock;
  choose: jest.Mock;
} = {
  initial: undefined,
  busy: false,
  failed: false,
  offline: false,
  wear: jest.fn(),
  swap: jest.fn(),
  shuffle: jest.fn(),
  choose: jest.fn(),
};

jest.mock('../useToday', () => ({
  flowReads: jest.requireActual<typeof import('../useToday')>('../useToday').flowReads,
  useToday: (): TodayApi => {
    const { useState: useMockState } = jest.requireActual<typeof import('react')>('react');
    const [state, setState] = useMockState(mockApi.initial);
    return {
      date: '2026-10-12',
      state,
      status: state ? 'success' : 'pending',
      offline: mockApi.offline,
      busy: mockApi.busy,
      failed: mockApi.failed,
      refetch: () => {},
      shuffle: mockApi.shuffle,
      occasion: null,
      chooseOccasion: mockApi.choose,
      swap: mockApi.swap,
      wear: () => {
        mockApi.wear();
        setState((s) => (s?.kind === 'outfit' ? { ...s, row: { ...s.row, status: 'worn' } } : s));
      },
    };
  },
}));

function item(id: string, category: ItemRow['category'], color: ItemRow['color_family']): ItemRow {
  return {
    id,
    user_id: 'u',
    category,
    color_hex: '#000000',
    color_family: color,
    warmth: 2,
    formality: 'casual',
    image_path: `u/${id}.webp`,
    original_path: `u/${id}.jpg`,
    archived_at: null,
    unavailable_until: null,
  };
}

const ITEMS = [item('t1', 'top', 'white'), item('b1', 'bottom', 'navy'), item('s1', 'shoes', 'black')];
const ROW: OutfitRow = {
  user_id: 'u',
  date: '2026-10-12',
  item_ids: ITEMS.map((i) => i.id),
  weather: { feelsLikeC: 9.4, rain: true, condition: 'rain' },
  seed: 1,
  status: 'suggested',
};
const OUTFIT: TodayState = {
  kind: 'outfit',
  date: '2026-10-12',
  row: ROW,
  items: ITEMS,
};

const OUTFIT_SHAPE = { items: ITEMS, row: ROW };

async function show(state: TodayState | undefined) {
  mockApi.initial = state;
  const client = createQueryClient();
  const repo = { imageUrl: jest.fn(async (p: string) => `https://img.example/${p}`) } as unknown as Repo;
  await render(
    <QueryClientProvider client={client}>
      <RepoProvider repo={repo}>
        <TodayScreen />
      </RepoProvider>
    </QueryClientProvider>,
  );
  return client;
}

beforeAll(() => initI18n('en'));
afterEach(async () => {
  jest.clearAllMocks();
  mockApi.busy = false;
  mockApi.failed = false;
  mockApi.offline = false;
  await i18n.changeLanguage('en');
});

describe('TodayScreen', () => {
  it('shows the reason in the current language after a language switch', async () => {
    await i18n.changeLanguage('fr');
    await show(OUTFIT);
    const fr = splitReason(outfitReason(OUTFIT_SHAPE, 'fr'));
    expect(fr).not.toEqual(splitReason(outfitReason(OUTFIT_SHAPE, 'en')));
    for (const line of fr) expect(screen.getByText(line)).toBeTruthy();
  });

  it('renders the date, weather, reason lines and the pieces', async () => {
    const client = await show(OUTFIT);
    expect(screen.getByText('Monday 12')).toBeTruthy();
    expect(screen.getByText('October')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Monday, October 12' })).toBeTruthy();
    expect(screen.getByText('9°')).toBeTruthy();
    expect(screen.getByText('Rain')).toBeTruthy();
    expect(screen.getByLabelText('Weather for today, Feels like 9°, Rain')).toBeTruthy();
    for (const line of splitReason(outfitReason(OUTFIT_SHAPE, 'en'))) expect(screen.getByText(line)).toBeTruthy();

    await fireEvent(screen.getByTestId('outfit-stack'), 'layout', { nativeEvent: { layout: { width: 360, height: 480 } } });
    expect(screen.getByRole('button', { name: 'Swap the white top' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Swap the navy bottom' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Swap the black shoes' }));
    expect(mockApi.swap).toHaveBeenCalledWith('shoes');

    await fireEvent.press(screen.getByRole('button', { name: 'Shuffle' }));
    expect(mockApi.shuffle).toHaveBeenCalledTimes(1);
    await screen.unmount();
    client.clear();
  });

  it('shows the occasion chips and reports a press', async () => {
    await show(OUTFIT);
    await fireEvent.press(screen.getByRole('radio', { name: 'Going out' }));
    expect(mockApi.choose).toHaveBeenCalledWith('formal');
    expect(screen.getByRole('radio', { name: 'Casual' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Work' }).props.accessibilityState).toEqual({ checked: false });
  });

  it('hides the occasion chips once worn', async () => {
    await show(OUTFIT);
    await fireEvent.press(screen.getByRole('button', { name: 'Wear this' }));
    expect(screen.queryByRole('radio', { name: 'Work' })).toBeNull();
  });

  it('wear calls wear and shows the worn label', async () => {
    const client = await show(OUTFIT);
    await fireEvent.press(screen.getByRole('button', { name: 'Wear this' }));
    expect(mockApi.wear).toHaveBeenCalledTimes(1);
    const worn = screen.getByRole('button', { name: 'Worn today' });
    expect(worn.props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.queryByRole('button', { name: 'Wear this' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Shuffle' })).toBeNull();
    await screen.unmount();
    client.clear();
  });

  it('renders the missing state with a localized list', async () => {
    const client = await show({ kind: 'missing', date: '2026-10-12', missing: ['top', 'shoes'] });
    expect(screen.getByText('Add a top and shoes to get suggestions.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add a piece' })).toBeTruthy();
    await screen.unmount();
    client.clear();
  });

  it('renders the missing state in French', async () => {
    await i18n.changeLanguage('fr');
    const client = await show({ kind: 'missing', date: '2026-10-12', missing: ['top', 'bottom', 'shoes'] });
    expect(screen.getByText('Ajoute un haut, un bas et des chaussures pour avoir des suggestions.')).toBeTruthy();
    expect(screen.getByText('Lundi 12')).toBeTruthy();
    await screen.unmount();
    client.clear();
  });

  it('blocks Wear and Shuffle while a change runs and shows a failure', async () => {
    mockApi.busy = true;
    mockApi.failed = true;
    const client = await show(OUTFIT);
    expect(screen.getByRole('button', { name: 'Wear this' }).props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByRole('button', { name: 'Shuffle' }).props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByRole('button', { name: 'Wear this' }));
    expect(mockApi.wear).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Try again.');
    await screen.unmount();
    client.clear();
  });

  it('shows an error with retry instead of empty slots when nothing is missing', async () => {
    const client = await show({ kind: 'missing', date: '2026-10-12', missing: [] });
    expect(screen.getByText('Something went wrong. Try again.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    await screen.unmount();
    client.clear();
  });

  it('shows the offline message instead of the loading skeleton when nothing is cached', async () => {
    mockApi.offline = true;
    const client = await show(undefined);
    expect(screen.getByRole('alert')).toHaveTextContent('You are offline. Changes will sync later.');
    expect(screen.queryByLabelText('Choosing your outfit…')).toBeNull();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    await screen.unmount();
    client.clear();
  });

  it('labels the temperature as feels-like, in French too', async () => {
    await i18n.changeLanguage('fr');
    const client = await show(OUTFIT);
    expect(screen.getByLabelText(/Ressenti 9°/)).toBeTruthy();
    expect(screen.getByText('Lundi 12')).toBeTruthy();
    await screen.unmount();
    client.clear();
  });

  it('hides the number and keeps the marker when the weather is assumed', async () => {
    const client = await show({ ...OUTFIT, row: { ...ROW, weather: { feelsLikeC: 18, rain: false, assumed: true } } });
    expect(screen.queryByText(/°/)).toBeNull();
    expect(screen.getByText('Weather assumed')).toBeTruthy();
    expect(screen.getByLabelText('Weather for today, Weather assumed')).toBeTruthy();
    await screen.unmount();
    client.clear();
  });

  it('shows the same temperature in the chip and the reason', async () => {
    const weather = { feelsLikeC: 22.4, rain: false };
    const client = await show({ ...OUTFIT, row: { ...ROW, weather } });
    expect(screen.getByText('23°')).toBeTruthy();
    expect(screen.getByText('23°C: keep it light')).toBeTruthy();
    await screen.unmount();
    client.clear();
  });

  it('offers a new outfit when a shown piece is in the wash', async () => {
    const washed = { ...OUTFIT, items: [{ ...ITEMS[0]!, unavailable_until: '2026-10-14' }, ...ITEMS.slice(1)] } as TodayState;
    await show(washed);
    expect(screen.getByText('A piece is in the wash')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'New outfit' }));
    expect(mockApi.shuffle).toHaveBeenCalled();
  });

  it('shows no wash notice when every piece is available', async () => {
    await show(OUTFIT);
    expect(screen.queryByText('A piece is in the wash')).toBeNull();
  });

  it('switches to a read-only tomorrow preview and back', async () => {
    await show(OUTFIT);
    expect(screen.queryByText('Back to today')).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: 'Tomorrow' }));
    expect(screen.getByRole('radio', { name: 'Tomorrow' }).props.accessibilityState).toEqual({ checked: true });
    expect(screen.getByText('Tuesday 13')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Swap/ })).toBeNull();
    expect(screen.getByText('Preview. It may change if you add pieces or the forecast changes.')).toBeTruthy();
    expect(screen.queryByText('Wear this')).toBeNull();
    expect(screen.queryByLabelText('Shuffle')).toBeNull();
    expect(screen.queryByLabelText('Occasion')).toBeNull();
    await fireEvent.press(screen.getByText('Back to today'));
    expect(screen.getByText('Wear this')).toBeTruthy();
    expect(screen.queryByText('Back to today')).toBeNull();
  });
});
