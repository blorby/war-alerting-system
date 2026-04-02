import { useCallback } from 'react';
import { useLocaleStore } from './store';
import en from './messages/en.json';
import he from './messages/he.json';

const dictionaries: Record<string, Record<string, string>> = { en, he };

export type Locale = 'en' | 'he';

/**
 * Returns a translation function `t(key, params?)` that resolves
 * keys from the active locale's dictionary.
 *
 * Supports simple interpolation: t("time.minutesAgo", { n: 5 }) → "5m ago"
 */
export function useT() {
  const locale = useLocaleStore((s) => s.locale);
  const dict = dictionaries[locale] ?? dictionaries.en;

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let value = dict[key] ?? dictionaries.en[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          value = value.replace(`{${k}}`, String(v));
        }
      }
      return value;
    },
    [dict],
  );

  return t;
}

export function useLocale(): Locale {
  return useLocaleStore((s) => s.locale);
}

export function useSetLocale() {
  return useLocaleStore((s) => s.setLocale);
}
