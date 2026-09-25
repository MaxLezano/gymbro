import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import esCatalog from './locales/es/catalog.json';
import esExercises from './locales/es/exercises.json';
import enCatalog from './locales/en/catalog.json';

/**
 * Translations live in ./locales/<language>/<namespace>.json. To add a
 * language, copy the `es` folder, translate it and register it here.
 * Missing keys fall back to Spanish, then to the value the caller provides.
 */
export const resources = {
  es: { catalog: esCatalog, exercises: esExercises },
  en: { catalog: enCatalog },
} as const;

export type Language = keyof typeof resources;
export const SUPPORTED_LANGUAGES = Object.keys(resources) as Language[];
export const DEFAULT_LANGUAGE: Language = 'es';

/**
 * The screens are still written in Spanish, so the app stays in Spanish until
 * they move to translation files; flip this to follow the device language.
 */
const FOLLOW_DEVICE_LANGUAGE = false;

/** First device language the app supports, or Spanish. */
export function deviceLanguage(): Language {
  try {
    const match = getLocales()
      .map((locale) => locale.languageCode)
      .find((code): code is Language => !!code && code in resources);
    return match ?? DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

const i18n = createInstance();

// Synchronous init: the exercise catalog reads translations at module load.
void i18n.use(initReactI18next).init({
  resources,
  lng: FOLLOW_DEVICE_LANGUAGE ? deviceLanguage() : DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  ns: ['catalog', 'exercises'],
  defaultNS: 'catalog',
  initAsync: false,
  interpolation: { escapeValue: false },
});

export const t = i18n.t.bind(i18n);
export default i18n;
