import 'i18next';

import type { defaultNS, resources } from './index';

// Typed translation keys: `t('status.title')` is checked against en.json at compile time.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: (typeof resources)['en'];
  }
}
