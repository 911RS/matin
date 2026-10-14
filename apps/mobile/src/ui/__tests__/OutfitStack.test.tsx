import { Animated } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ItemRow } from '@tenue/backend';
import { initI18n } from '../../i18n';
import { createQueryClient } from '../../query';
import { RepoProvider } from '../../data/RepoProvider';
import type { Repo } from '../../data/repo';
import { OutfitStack } from '../OutfitStack';

jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('../../closet/pending', () => ({
  pendingFiles: { exists: () => false, uriFor: async (p: string) => `file:///pending/${p}` },
}));

function item(id: string, category: ItemRow['category']): ItemRow {
  return {
    id,
    user_id: 'u',
    category,
    color_hex: '#000000',
    color_family: 'navy',
    warmth: 2,
    formality: 'casual',
    image_path: `u/${id}.webp`,
    original_path: `u/${id}.jpg`,
    archived_at: null,
    unavailable_until: null,
  };
}

beforeAll(() => initI18n('en'));

describe('OutfitStack', () => {
  it('keeps the outgoing piece mounted while the swap cross-fades, across re-renders', async () => {
    const client = createQueryClient();
    const repo = { imageUrl: jest.fn(async (p: string) => `https://img.example/${p}`) } as unknown as Repo;
    const ui = (top: ItemRow, extra = 0) => (
      <QueryClientProvider client={client}>
        <RepoProvider repo={repo}>
          <OutfitStack key="stack" items={[top, item('b1', 'bottom'), item('s1', 'shoes')]} onSwap={() => extra} />
        </RepoProvider>
      </QueryClientProvider>
    );
    await render(ui(item('t1', 'top')));
    await fireEvent(screen.getByTestId('outfit-stack'), 'layout', { nativeEvent: { layout: { width: 360, height: 480 } } });
    await waitFor(() => expect(repo.imageUrl).toHaveBeenCalledWith('u/t1.webp'));
    await waitFor(() => expect(client.getQueryData(['image', 'u/t1.webp'])).toBeTruthy());

    client.setQueryData(['image', 'u/t2.webp'], 'https://img.example/u/t2.webp');
    const stops: jest.Mock[] = [];
    const timing = jest.spyOn(Animated, 'timing').mockImplementation(() => {
      const stop = jest.fn();
      stops.push(stop);
      return { start: jest.fn(), stop, reset: jest.fn() } as unknown as Animated.CompositeAnimation;
    });
    await screen.rerender(ui(item('t2', 'top')));
    expect(screen.queryByTestId('piece-outgoing')).toBeTruthy();
    await screen.rerender(ui(item('t2', 'top'), 1));
    await screen.rerender(ui(item('t2', 'top'), 2));
    expect(screen.queryByTestId('piece-outgoing')).toBeTruthy();
    expect(timing).toHaveBeenCalledTimes(1);
    expect(stops[0]).not.toHaveBeenCalled();
    timing.mockRestore();
    await screen.unmount();
    expect(stops[0]).toHaveBeenCalledTimes(1);
    client.clear();
  });

  it('removes the outgoing piece once the cross-fade ends', async () => {
    const client = createQueryClient();
    const repo = { imageUrl: jest.fn(async (p: string) => `https://img.example/${p}`) } as unknown as Repo;
    client.setQueryData(['image', 'u/t1.webp'], 'https://img.example/u/t1.webp');
    client.setQueryData(['image', 'u/t2.webp'], 'https://img.example/u/t2.webp');
    const ui = (top: ItemRow) => (
      <QueryClientProvider client={client}>
        <RepoProvider repo={repo}>
          <OutfitStack items={[top, item('b1', 'bottom'), item('s1', 'shoes')]} onSwap={() => {}} />
        </RepoProvider>
      </QueryClientProvider>
    );
    await render(ui(item('t1', 'top')));
    await fireEvent(screen.getByTestId('outfit-stack'), 'layout', { nativeEvent: { layout: { width: 360, height: 480 } } });
    await screen.rerender(ui(item('t2', 'top')));
    await waitFor(() => expect(screen.queryByTestId('piece-outgoing')).toBeNull());
    await screen.unmount();
    client.clear();
  });
});
