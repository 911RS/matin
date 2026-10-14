import type { ItemRow, OutfitRow } from '@tenue/backend';
import { initI18n } from '../../i18n';
import i18n from 'i18next';
import { filterItems } from '../filter';
import { daysSince, isForgotten, wearStats } from '../wear';

const worn = (date: string, ...ids: string[]) => ({ date, item_ids: ids, status: 'worn' as const });

describe('wearStats', () => {
  it('counts wears and keeps the latest date per item', () => {
    const outfits: Pick<OutfitRow, 'date' | 'item_ids' | 'status'>[] = [
      worn('2026-10-01', 'a', 'b'),
      worn('2026-10-05', 'a'),
      { date: '2026-10-06', item_ids: ['a', 'c'], status: 'skipped' },
      { date: '2026-10-07', item_ids: ['b'], status: 'suggested' },
    ];
    const stats = wearStats(outfits);
    expect(stats.get('a')).toEqual({ wornCount: 2, lastWorn: '2026-10-05' });
    expect(stats.get('b')).toEqual({ wornCount: 1, lastWorn: '2026-10-01' });
    expect(stats.has('c')).toBe(false);
  });

  it('is independent of input order', () => {
    expect(wearStats([worn('2026-10-05', 'a'), worn('2026-10-01', 'a')]).get('a')?.lastWorn).toBe('2026-10-05');
  });
});

describe('daysSince', () => {
  it('counts calendar days', () => {
    expect(daysSince('2026-09-30', '2026-10-03')).toBe(3);
    expect(daysSince('2026-10-03', '2026-10-03')).toBe(0);
  });
});

describe('isForgotten', () => {
  const today = '2026-10-31';
  const piece = (created_at?: string) => ({ id: 'a', created_at });

  it('needs an item older than 30 days', () => {
    expect(isForgotten(piece('2026-10-01T10:00:00Z'), new Map(), today)).toBe(false);
    expect(isForgotten(piece('2026-09-30T10:00:00Z'), new Map(), today)).toBe(true);
    expect(isForgotten(piece('2026-09-01T10:00:00Z'), new Map(), today)).toBe(true);
  });

  it('compares creation in the local date', () => {
    const edge = piece('2026-09-30T23:30:00Z');
    expect(isForgotten(edge, new Map(), today, 'UTC')).toBe(true);
    expect(isForgotten(edge, new Map(), today, 'Asia/Tokyo')).toBe(false);
  });

  it('is false without a creation date', () => {
    expect(isForgotten(piece(), new Map(), today)).toBe(false);
  });

  it('needs no wear in the last 30 days', () => {
    const old = piece('2026-01-01T00:00:00Z');
    const last = (lastWorn: string) => new Map([['a', { wornCount: 1, lastWorn }]]);
    expect(isForgotten(old, last('2026-10-01'), today)).toBe(false);
    expect(isForgotten(old, last('2026-09-30'), today)).toBe(true);
    expect(isForgotten(old, last('2026-09-01'), today)).toBe(true);
  });

  it('filters the closet', () => {
    const items = [
      { id: 'a', category: 'top', color_family: 'navy', created_at: '2026-01-01T00:00:00Z' },
      { id: 'b', category: 'top', color_family: 'navy', created_at: '2026-01-01T00:00:00Z' },
    ] as ItemRow[];
    const stats = new Map([['b', { wornCount: 1, lastWorn: '2026-10-30' }]]);
    const shown = filterItems(items, { category: null, family: null, forgotten: { stats, today } });
    expect(shown.map((i) => i.id)).toEqual(['a']);
  });
});

describe('wear stat plurals', () => {
  it.each([
    ['en', 1, 'Worn once'],
    ['en', 5, 'Worn 5 times'],
    ['fr', 1, 'Dans tes tenues une fois'],
    ['fr', 5, 'Dans tes tenues 5 fois'],
  ] as const)('%s worn %i', async (lng, count, text) => {
    await initI18n(lng);
    expect(i18n.t('item.stats.worn', { count })).toBe(text);
  });

  it.each([
    ['en', 1, 'Last worn 1 day ago'],
    ['en', 3, 'Last worn 3 days ago'],
    ['fr', 1, 'Dernière fois il y a 1 jour'],
    ['fr', 3, 'Dernière fois il y a 3 jours'],
  ] as const)('%s last %i', async (lng, count, text) => {
    await initI18n(lng);
    expect(i18n.t('item.stats.last', { count })).toBe(text);
  });
});
