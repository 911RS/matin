import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import fr from './fr.json';

export type AppLanguage = 'en' | 'fr';

export function detectLanguage(): AppLanguage {
  const code = getLocales()[0]?.languageCode;
  return code?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

export function initI18n(locale: AppLanguage = detectLanguage()) {
  if (i18n.isInitialized) {
    void i18n.changeLanguage(locale);
    return i18n;
  }
  void i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, fr: { translation: fr } },
    lng: locale,
    fallbackLng: 'en',
    compatibilityJSON: 'v4',
    interpolation: { escapeValue: false },
    initAsync: false,
  });
  return i18n;
}

export function setLanguage(locale: AppLanguage): Promise<unknown> {
  return i18n.changeLanguage(locale);
}

export default i18n;
