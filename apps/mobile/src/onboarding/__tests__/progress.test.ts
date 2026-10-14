import type { ItemRow } from '@tenue/backend';
import type { Category } from '@tenue/engine';
import { onboardingProgress } from '../progress';

function items(...categories: Category[]): ItemRow[] {
  return categories.map((category, i) => ({ id: String(i), category }) as ItemRow);
}

describe('onboardingProgress', () => {
  it('starts empty and not done', () => {
    expect(onboardingProgress([])).toEqual({ tops: 0, bottoms: 0, shoes: 0, done: false });
  });

  it('counts each category', () => {
    expect(onboardingProgress(items('top', 'bottom', 'bottom', 'shoes'))).toEqual({
      tops: 1,
      bottoms: 2,
      shoes: 1,
      done: false,
    });
  });

  it('is done with 2 tops, 2 bottoms and 1 pair of shoes', () => {
    expect(onboardingProgress(items('top', 'top', 'bottom', 'bottom', 'shoes')).done).toBe(true);
  });

  it('needs shoes', () => {
    expect(onboardingProgress(items('top', 'top', 'bottom', 'bottom', 'outerwear')).done).toBe(false);
  });

  it('counts dresses toward tops and bottoms', () => {
    const p = onboardingProgress(items('dress', 'dress', 'shoes'));
    expect(p).toEqual({ tops: 2, bottoms: 2, shoes: 1, done: true });
  });

  it('mixes dresses with separates', () => {
    const p = onboardingProgress(items('dress', 'top', 'bottom', 'shoes'));
    expect(p).toMatchObject({ tops: 2, bottoms: 2, done: true });
  });

  it('ignores items without a category', () => {
    const rows = [{ id: 'x', category: null }, { id: 'y', category: 'top' }] as unknown as ItemRow[];
    expect(onboardingProgress(rows)).toEqual({ tops: 1, bottoms: 0, shoes: 0, done: false });
  });
});
