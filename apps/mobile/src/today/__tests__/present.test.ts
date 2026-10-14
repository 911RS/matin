import { initI18n } from '../../i18n';
import i18n from '../../i18n';
import type { ItemRow } from '@tenue/backend';
import { toEngineItem } from '@tenue/backend';
import { reasonFor } from '@tenue/engine';
import { conditionKey, dayHeader, joinList, missingSentence, outfitReason, splitReason } from '../present';

beforeAll(() => initI18n('en'));
afterAll(() => i18n.changeLanguage('en'));

describe('splitReason', () => {
  it('splits on the middle dot and capitalizes each line', () => {
    expect(splitReason('Rain expected: jacket on · navy + beige match')).toEqual([
      'Rain expected: jacket on',
      'Navy + beige match',
    ]);
  });

  it('keeps a single part and drops empty ones', () => {
    expect(splitReason('18°C, no layer needed')).toEqual(['18°C, no layer needed']);
    expect(splitReason('')).toEqual([]);
  });
});

describe('joinList', () => {
  it('joins with commas and a final conjunction', () => {
    expect(joinList(['a'], 'and')).toBe('a');
    expect(joinList(['a', 'b'], 'and')).toBe('a and b');
    expect(joinList(['a', 'b', 'c'], 'et')).toBe('a, b et c');
  });
});

describe('missingSentence', () => {
  it('builds the English sentence', async () => {
    await i18n.changeLanguage('en');
    expect(missingSentence(['top', 'shoes'], i18n.t)).toBe('Add a top and shoes to get suggestions.');
    expect(missingSentence(['top', 'bottom', 'shoes'], i18n.t)).toBe('Add a top, a bottom and shoes to get suggestions.');
  });

  it('builds the French sentence', async () => {
    await i18n.changeLanguage('fr');
    expect(missingSentence(['top', 'bottom', 'shoes'], i18n.t)).toBe(
      'Ajoute un haut, un bas et des chaussures pour avoir des suggestions.',
    );
    expect(missingSentence(['shoes'], i18n.t)).toBe('Ajoute des chaussures pour avoir des suggestions.');
  });
});

describe('dayHeader', () => {
  it('formats the weekday with the day number and the month', () => {
    expect(dayHeader('2026-10-12', 'en')).toEqual({ day: 'Monday 12', month: 'October' });
    expect(dayHeader('2026-10-12', 'fr')).toEqual({ day: 'Lundi 12', month: 'Octobre' });
  });
});

describe('conditionKey', () => {
  it('maps MET symbol codes and falls back on the rain flag', () => {
    expect(conditionKey({ feelsLikeC: 10, rain: false, condition: 'clearsky_day' })).toBe('clear');
    expect(conditionKey({ feelsLikeC: 10, rain: true, condition: 'lightrainshowers_night' })).toBe('rain');
    expect(conditionKey({ feelsLikeC: 10, rain: false, condition: 'partlycloudy_day' })).toBe('partlyCloudy');
    expect(conditionKey({ feelsLikeC: 0, rain: false, condition: 'heavysnow' })).toBe('snow');
    expect(conditionKey({ feelsLikeC: 10, rain: true })).toBe('showers');
    expect(conditionKey({ feelsLikeC: 10, rain: true, condition: 'cloudy' })).toBe('showers');
    expect(conditionKey({ feelsLikeC: 10, rain: true, condition: 'partlycloudy_day' })).toBe('showers');
    expect(conditionKey({ feelsLikeC: 0, rain: true, condition: 'heavysnow' })).toBe('snow');
    expect(conditionKey({ feelsLikeC: 10, rain: false })).toBeNull();
    expect(conditionKey({ feelsLikeC: 18, rain: false, assumed: true })).toBeNull();
  });
});

describe('outfitReason', () => {
  const piece = (id: string, category: ItemRow['category'], color: ItemRow['color_family']): ItemRow => ({
    id,
    user_id: 'u',
    category,
    color_hex: '#000000',
    color_family: color,
    warmth: 2,
    formality: 'casual',
    image_path: `${id}.webp`,
    original_path: `${id}.webp`,
    archived_at: null,
    unavailable_until: null,
  });
  const items = [piece('t', 'top', 'blue'), piece('b', 'bottom', 'beige'), piece('s', 'shoes', 'white')];
  const outfit = { items, row: { item_ids: ['t', 'b', 's'], weather: { feelsLikeC: 16, rain: false } } };

  it('follows the current language, not the one the outfit was made in', () => {
    const en = outfitReason(outfit, 'en');
    const fr = outfitReason(outfit, 'fr-FR');
    expect(en).toBe(reasonFor(items.map(toEngineItem), ['t', 'b', 's'], { feelsLikeC: 16, rain: false }, 'en'));
    expect(fr).toBe(reasonFor(items.map(toEngineItem), ['t', 'b', 's'], { feelsLikeC: 16, rain: false }, 'fr'));
    expect(fr).not.toBe(en);
  });

  it('leaves out a jacket that is unavailable on the outfit date', () => {
    const jacket = { ...piece('o', 'outerwear', 'black'), warmth: 3 as const, unavailable_until: '2026-10-14' };
    const cold = { item_ids: ['t', 'b', 's'], weather: { feelsLikeC: 2, rain: true } };
    expect(outfitReason({ items: [...items, jacket], row: { ...cold, date: '2026-10-13' } }, 'en')).toMatch(/^No jacket in your closet/);
    expect(outfitReason({ items: [...items, jacket], row: { ...cold, date: '2026-10-14' } }, 'en')).not.toMatch(/^No jacket/);
  });
});
