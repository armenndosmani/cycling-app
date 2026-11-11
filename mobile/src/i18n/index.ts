import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';

export const defaultNS = 'translation';

// English only at launch (see docs/decisions.md). Every user-facing string lives in
// the translation files; adding a language means adding a resource file here.
export const resources = {
  en: { translation: en },
} as const;

const i18n = createInstance();

// Resources are bundled, so initialisation is synchronous and `t` works on first render.
// initReactI18next makes this instance the one `useTranslation()` uses.
void i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  defaultNS,
  resources,
  initAsync: false,
  interpolation: {
    // React already escapes rendered strings
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

/** The app's i18next instance, for translating outside React components. */
export default i18n;
