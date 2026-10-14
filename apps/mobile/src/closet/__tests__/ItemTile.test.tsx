import { render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { Image } from 'expo-image';
import type { ItemRow } from '@tenue/backend';
import { initI18n } from '../../i18n';
import { createQueryClient } from '../../query';
import { RepoProvider } from '../../data/RepoProvider';
import type { Repo } from '../../data/repo';
import { ItemTile } from '../ItemTile';

jest.mock('expo-image', () => ({ Image: jest.fn(() => null) }));
jest.mock('../pending', () => ({
  pendingFiles: { exists: () => false, uriFor: async (p: string) => `file:///pending/${p}` },
}));

const item = {
  id: 'i1',
  user_id: 'u',
  category: 'shoes',
  color_family: 'navy',
  color_hex: '#1f2a44',
  warmth: 2,
  formality: 'casual',
  image_path: 'u/i1.webp',
  original_path: 'u/i1-original.jpg',
  archived_at: null,
} as ItemRow;

beforeAll(() => initI18n());

describe('ItemTile', () => {
  it('passes the storage path as the disk cache key, with a disk cache policy', async () => {
    const client = createQueryClient();
    const repo = { imageUrl: jest.fn().mockResolvedValue('https://signed.example/u/i1.webp?t=1') } as unknown as Repo;
    await render(
      <QueryClientProvider client={client}>
        <RepoProvider repo={repo}>
          <ItemTile item={item} onPress={() => {}} />
        </RepoProvider>
      </QueryClientProvider>,
    );
    const lastProps = () => jest.mocked(Image).mock.calls.at(-1)?.[0] as Record<string, unknown> | undefined;
    await waitFor(() => expect(lastProps()?.source).toBeTruthy());
    expect(lastProps()?.source).toEqual({ uri: 'https://signed.example/u/i1.webp?t=1', cacheKey: 'u/i1.webp' });
    expect(lastProps()?.cachePolicy).toBe('disk');
    expect(screen.getByRole('button', { name: 'Navy shoes' })).toBeTruthy();
    await screen.unmount();
    client.clear();
  });

  it('dims an unavailable piece and adds the wash note to its label', async () => {
    const client = createQueryClient();
    const repo = { imageUrl: jest.fn().mockResolvedValue('https://signed.example/u/i1.webp') } as unknown as Repo;
    await render(
      <QueryClientProvider client={client}>
        <RepoProvider repo={repo}>
          <ItemTile item={{ ...item, unavailable_until: '2026-10-16' }} today="2026-10-13" onPress={() => {}} />
          <ItemTile item={{ ...item, id: 'i2', unavailable_until: '2026-10-13' }} today="2026-10-13" onPress={() => {}} />
        </RepoProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByRole('button', { name: 'Navy shoes, in the wash until October 16' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Navy shoes' })).toHaveLength(1);
    await screen.unmount();
    client.clear();
  });
});
