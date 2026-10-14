import { getLocales } from 'expo-localization';
import i18n, { detectLanguage, initI18n, setLanguage } from '../index';

jest.mock('expo-localization', () => ({ getLocales: jest.fn() }));

const locales = getLocales as jest.Mock;

describe('i18n init', () => {
  it('maps fr* device locales to French and others to English', () => {
    locales.mockReturnValue([{ languageCode: 'fr' }]);
    expect(detectLanguage()).toBe('fr');
    locales.mockReturnValue([{ languageCode: 'de' }]);
    expect(detectLanguage()).toBe('en');
    locales.mockReturnValue([]);
    expect(detectLanguage()).toBe('en');
  });

  it('initialises and switches language', async () => {
    initI18n('fr');
    expect(i18n.t('common.retry')).toBe('Réessayer');
    await setLanguage('en');
    expect(i18n.t('common.retry')).toBe('Retry');
    expect(i18n.t('closet.count', { count: 2 })).toBe('2 pieces');
  });
});
