import { seedFromString, suggest } from '@tenue/engine';
import type { Category, Item } from '@tenue/engine';

function item(id: string, category: Category): Item {
  return { id, category, colorFamily: 'black', warmth: 2, formality: 'casual', archivedAt: null };
}

describe('engine workspace import', () => {
  it('suggests a 3-piece outfit from a 5-item closet', () => {
    const result = suggest({
      items: [
        item('t1', 'top'),
        item('t2', 'top'),
        item('b1', 'bottom'),
        item('b2', 'bottom'),
        item('s1', 'shoes'),
      ],
      recentOutfits: [],
      weather: { feelsLikeC: 20, rain: false },
      date: '2026-10-12',
      seed: seedFromString('2026-10-12'),
      locale: 'en',
    });
    if (!('itemIds' in result)) throw new Error('expected an outfit');
    expect(result.itemIds).toHaveLength(3);
  });
});
