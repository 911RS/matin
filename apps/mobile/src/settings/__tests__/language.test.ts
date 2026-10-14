import AsyncStorage from '@react-native-async-storage/async-storage';
import { initI18n } from '../../i18n';
import { chooseLanguage, explicitLanguageKey, hasExplicitLanguage, resolveLocale } from '../language';

describe('chooseLanguage', () => {
  it('applies the choice and marks it as explicit for the user', async () => {
    const i18n = initI18n('en');
    await chooseLanguage('fr', 'u1');
    expect(i18n.language).toBe('fr');
    expect(await AsyncStorage.getItem(explicitLanguageKey('u1'))).toBe('1');
    expect(await hasExplicitLanguage('u1')).toBe(true);
    expect(await hasExplicitLanguage('u2')).toBe(false);
    await chooseLanguage('en', null);
  });

  it('writes the explicit marker before switching the language', async () => {
    const i18n = initI18n('en');
    let markedFirst: string | null = null;
    const spy = jest.spyOn(i18n, 'changeLanguage').mockImplementation(async () => {
      markedFirst = await AsyncStorage.getItem(explicitLanguageKey('u3'));
      return (() => '') as never;
    });
    await chooseLanguage('fr', 'u3');
    expect(markedFirst).toBe('1');
    spy.mockRestore();
  });
});

describe('resolveLocale', () => {
  it('lets the profile win once it is known', () => {
    expect(resolveLocale({ profileLocale: 'fr', device: 'en', explicit: false })).toEqual({ apply: 'fr', write: null });
    expect(resolveLocale({ profileLocale: 'fr', device: 'en', explicit: true })).toEqual({ apply: 'fr', write: null });
  });

  it('writes the device language over the untouched default', () => {
    expect(resolveLocale({ profileLocale: 'en', device: 'fr', explicit: false })).toEqual({ apply: 'fr', write: 'fr' });
  });

  it('keeps an explicit English choice on a French device', () => {
    expect(resolveLocale({ profileLocale: 'en', device: 'fr', explicit: true })).toEqual({ apply: 'en', write: null });
  });

  it('does nothing when profile and device agree', () => {
    expect(resolveLocale({ profileLocale: 'en', device: 'en', explicit: false })).toEqual({ apply: 'en', write: null });
  });
});
