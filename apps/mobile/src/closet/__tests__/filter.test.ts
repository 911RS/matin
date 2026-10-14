import type { ItemRow } from '@tenue/backend';
import type { Category, ColorFamily } from '@tenue/engine';
import { filterItems, presentCategories, presentFamilies } from '../filter';

function item(id: string, category: Category, color_family: ColorFamily): ItemRow {
  return { id, category, color_family } as ItemRow;
}

const items = [
  item('a', 'top', 'navy'),
  item('b', 'bottom', 'denim'),
  item('c', 'top', 'white'),
  item('d', 'shoes', 'navy'),
];

describe('filterItems', () => {
  it('returns everything without filters', () => {
    expect(filterItems(items, { category: null, family: null })).toEqual(items);
  });

  it('filters by category', () => {
    expect(filterItems(items, { category: 'top', family: null }).map((i) => i.id)).toEqual(['a', 'c']);
  });

  it('filters by color family', () => {
    expect(filterItems(items, { category: null, family: 'navy' }).map((i) => i.id)).toEqual(['a', 'd']);
  });

  it('combines both filters', () => {
    expect(filterItems(items, { category: 'top', family: 'navy' }).map((i) => i.id)).toEqual(['a']);
    expect(filterItems(items, { category: 'bottom', family: 'navy' })).toEqual([]);
  });
});

describe('present filters', () => {
  it('lists categories in wardrobe order, only those present', () => {
    expect(presentCategories(items)).toEqual(['top', 'bottom', 'shoes']);
  });

  it('lists color families in palette order, only those present', () => {
    expect(presentFamilies(items)).toEqual(['white', 'navy', 'denim']);
  });
});
