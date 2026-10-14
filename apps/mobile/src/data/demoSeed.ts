import type { ItemRow, OutfitRow } from '@tenue/backend';
import { localDate } from '@tenue/backend';
import type { Category, ColorFamily, Formality, Warmth, Weather } from '@tenue/engine';
import { DEMO_USER_ID } from './localRepo';
import type { AsyncStorageLike } from './localRepo';
import type { Repo } from './repo';

export const DEMO_SEEDED_KEY = 'tenue-demo:seeded';
export const PARIS = { lat: 48.86, lon: 2.35, label: 'Paris' } as const;

export interface DemoPiece {
  id: string;
  category: Category;
  colorFamily: ColorFamily;
  colorHex: string;
  warmth: Warmth;
  formality: Formality;
  asset: number;
}

export const DEMO_PIECES: readonly DemoPiece[] = [
  {
    id: 'demo-top-navy-sweater',
    category: 'top',
    colorFamily: 'navy',
    colorHex: '#1F2A44',
    warmth: 2,
    formality: 'casual',
    asset: require('../../assets/demo/top-navy-sweater.webp'),
  },
  {
    id: 'demo-top-blue-shirt',
    category: 'top',
    colorFamily: 'blue',
    colorHex: '#94B4E2',
    warmth: 1,
    formality: 'smart',
    asset: require('../../assets/demo/top-blue-shirt.webp'),
  },
  {
    id: 'demo-bottom-beige-trousers',
    category: 'bottom',
    colorFamily: 'beige',
    colorHex: '#D8C3A5',
    warmth: 2,
    formality: 'smart',
    asset: require('../../assets/demo/bottom-beige-trousers.webp'),
  },
  {
    id: 'demo-bottom-denim-jeans',
    category: 'bottom',
    colorFamily: 'denim',
    colorHex: '#5470A0',
    warmth: 2,
    formality: 'casual',
    asset: require('../../assets/demo/bottom-denim-jeans.webp'),
  },
  {
    id: 'demo-dress-green',
    category: 'dress',
    colorFamily: 'green',
    colorHex: '#3F7D3A',
    warmth: 1,
    formality: 'smart',
    asset: require('../../assets/demo/dress-green.webp'),
  },
  {
    id: 'demo-shoes-white-sneakers',
    category: 'shoes',
    colorFamily: 'white',
    colorHex: '#F7F7F5',
    warmth: 2,
    formality: 'casual',
    asset: require('../../assets/demo/shoes-white-sneakers.webp'),
  },
  {
    id: 'demo-shoes-brown-boots',
    category: 'shoes',
    colorFamily: 'brown',
    colorHex: '#6B4423',
    warmth: 3,
    formality: 'smart',
    asset: require('../../assets/demo/shoes-brown-boots.webp'),
  },
  {
    id: 'demo-outerwear-grey-coat',
    category: 'outerwear',
    colorFamily: 'grey',
    colorHex: '#9A9DA0',
    warmth: 3,
    formality: 'smart',
    asset: require('../../assets/demo/outerwear-grey-coat.webp'),
  },
];

const HISTORY: readonly { daysAgo: number; ids: string[]; weather: Weather }[] = [
  {
    daysAgo: 1,
    ids: ['demo-dress-green', 'demo-shoes-brown-boots'],
    weather: { feelsLikeC: 21, rain: false, condition: 'clearsky_day' },
  },
  {
    daysAgo: 2,
    ids: ['demo-outerwear-grey-coat', 'demo-top-blue-shirt', 'demo-bottom-denim-jeans', 'demo-shoes-brown-boots'],
    weather: { feelsLikeC: 9, rain: true, condition: 'rain' },
  },
  {
    daysAgo: 3,
    ids: ['demo-top-blue-shirt', 'demo-bottom-denim-jeans', 'demo-shoes-brown-boots'],
    weather: { feelsLikeC: 14, rain: false, condition: 'cloudy' },
  },
  {
    daysAgo: 4,
    ids: ['demo-top-navy-sweater', 'demo-bottom-denim-jeans', 'demo-shoes-white-sneakers'],
    weather: { feelsLikeC: 17, rain: false, condition: 'partlycloudy_day' },
  },
  {
    daysAgo: 5,
    ids: ['demo-outerwear-grey-coat', 'demo-top-blue-shirt', 'demo-bottom-beige-trousers', 'demo-shoes-brown-boots'],
    weather: { feelsLikeC: 8, rain: false, condition: 'cloudy' },
  },
];

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DemoSeedDeps {
  repo: Repo;
  storage: Pick<AsyncStorageLike, 'getItem' | 'setItem'>;
  assetUri: (asset: number) => Promise<string>;
  markOnboarded: (userId: string) => Promise<void>;
  setLocationLabel: (userId: string, label: string) => Promise<void>;
  now: () => Date;
}

function imagePath(id: string): string {
  return `${DEMO_USER_ID}/${id}.webp`;
}

export async function seedDemo(deps: DemoSeedDeps): Promise<boolean> {
  const { repo, storage } = deps;
  if ((await storage.getItem(DEMO_SEEDED_KEY)) === '1') return false;

  const seedIds = new Set(DEMO_PIECES.map((p) => p.id));
  const existing = await repo.listItems({ includeArchived: true });
  if (existing.some((i) => !seedIds.has(i.id))) {
    await storage.setItem(DEMO_SEEDED_KEY, '1');
    return false;
  }

  const have = new Set(existing.map((i) => i.id));
  for (const piece of DEMO_PIECES) {
    if (have.has(piece.id)) continue;
    const path = imagePath(piece.id);
    await repo.uploadImage(await deps.assetUri(piece.asset), path, 'image/webp');
    const row: ItemRow = {
      id: piece.id,
      user_id: DEMO_USER_ID,
      category: piece.category,
      color_hex: piece.colorHex,
      color_family: piece.colorFamily,
      warmth: piece.warmth,
      formality: piece.formality,
      image_path: path,
      original_path: path,
      archived_at: null,
      unavailable_until: null,
    };
    await repo.saveItem(row);
  }

  const profile = await repo.getProfile();
  await repo.updateProfile({ lat: PARIS.lat, lon: PARIS.lon });
  await deps.setLocationLabel(DEMO_USER_ID, PARIS.label);

  const now = deps.now().getTime();
  for (const [index, day] of HISTORY.entries()) {
    const row: OutfitRow = {
      user_id: DEMO_USER_ID,
      date: localDate(new Date(now - day.daysAgo * DAY_MS), profile.timezone),
      item_ids: day.ids,
      weather: day.weather,
      seed: 1000 + index,
      status: 'worn',
    };
    await repo.insertOutfit(row);
  }

  await deps.markOnboarded(DEMO_USER_ID);
  await storage.setItem(DEMO_SEEDED_KEY, '1');
  return true;
}
