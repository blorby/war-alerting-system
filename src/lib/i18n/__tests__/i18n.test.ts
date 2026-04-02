import en from '@/lib/i18n/messages/en.json';
import he from '@/lib/i18n/messages/he.json';

// ---------------------------------------------------------------------------
// Helpers: replicate the translation lookup logic from useT without React
// ---------------------------------------------------------------------------
const dictionaries: Record<string, Record<string, string>> = { en, he };

function makeT(locale: 'en' | 'he') {
  const dict = dictionaries[locale] ?? dictionaries.en;
  return (key: string, params?: Record<string, string | number>): string => {
    let value = dict[key] ?? dictionaries.en[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(`{${k}}`, String(v));
      }
    }
    return value;
  };
}

// ---------------------------------------------------------------------------
// 1. Dictionary completeness
// ---------------------------------------------------------------------------
describe('dictionary completeness', () => {
  const enKeys = Object.keys(en).sort();
  const heKeys = Object.keys(he).sort();

  it('every key in en.json exists in he.json', () => {
    const missingInHe = enKeys.filter((k) => !(k in (he as Record<string, string>)));
    expect(missingInHe).toEqual([]);
  });

  it('every key in he.json exists in en.json', () => {
    const missingInEn = heKeys.filter((k) => !(k in (en as Record<string, string>)));
    expect(missingInEn).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2. Dictionary values - no empty strings
// ---------------------------------------------------------------------------
describe('dictionary values', () => {
  it('en.json has no empty string values', () => {
    const empties = Object.entries(en).filter(([, v]) => v === '');
    expect(empties).toEqual([]);
  });

  it('he.json has no empty string values', () => {
    const empties = Object.entries(he).filter(([, v]) => v === '');
    expect(empties).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3. Interpolation placeholders match between dictionaries
// ---------------------------------------------------------------------------
describe('interpolation placeholders', () => {
  const placeholderRe = /\{(\w+)\}/g;

  function extractParams(value: string): string[] {
    return [...value.matchAll(placeholderRe)].map((m) => m[1]).sort();
  }

  it('keys with {param} in en.json have the same params in he.json', () => {
    const mismatches: string[] = [];
    for (const [key, enValue] of Object.entries(en)) {
      const enParams = extractParams(enValue);
      if (enParams.length === 0) continue;
      const heValue = (he as Record<string, string>)[key];
      if (!heValue) continue; // covered by completeness test
      const heParams = extractParams(heValue);
      if (JSON.stringify(enParams) !== JSON.stringify(heParams)) {
        mismatches.push(`${key}: en=${enParams} he=${heParams}`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 4. Store defaults
// ---------------------------------------------------------------------------
describe('locale store', () => {
  // Zustand stores can be imported and used outside React
  it('defaults to "he"', async () => {
    const { useLocaleStore } = await import('@/lib/i18n/store');
    expect(useLocaleStore.getState().locale).toBe('he');
  });

  // ---------------------------------------------------------------------------
  // 5. Store switching
  // ---------------------------------------------------------------------------
  it('setLocale("en") changes locale to "en"', async () => {
    const { useLocaleStore } = await import('@/lib/i18n/store');
    useLocaleStore.getState().setLocale('en');
    expect(useLocaleStore.getState().locale).toBe('en');
    // reset
    useLocaleStore.getState().setLocale('he');
  });
});

// ---------------------------------------------------------------------------
// 6. Translation function - direct lookup
// ---------------------------------------------------------------------------
describe('translation function', () => {
  it('t("header.live") returns Hebrew for he locale', () => {
    const t = makeT('he');
    expect(t('header.live')).toBe('שידור חי');
  });

  it('t("header.live") returns "LIVE" for en locale', () => {
    const t = makeT('en');
    expect(t('header.live')).toBe('LIVE');
  });
});

// ---------------------------------------------------------------------------
// 7. Translation fallback
// ---------------------------------------------------------------------------
describe('translation fallback', () => {
  it('t("nonexistent.key") returns the key itself', () => {
    const t = makeT('he');
    expect(t('nonexistent.key')).toBe('nonexistent.key');
  });

  it('t("nonexistent.key") returns the key for en locale too', () => {
    const t = makeT('en');
    expect(t('nonexistent.key')).toBe('nonexistent.key');
  });
});

// ---------------------------------------------------------------------------
// 8. Interpolation
// ---------------------------------------------------------------------------
describe('interpolation', () => {
  it('t("time.minutesAgo", { n: 5 }) returns "לפני 5 דק׳" for he', () => {
    const t = makeT('he');
    expect(t('time.minutesAgo', { n: 5 })).toBe('לפני 5 דק׳');
  });

  it('t("time.minutesAgo", { n: 5 }) returns "5m ago" for en', () => {
    const t = makeT('en');
    expect(t('time.minutesAgo', { n: 5 })).toBe('5m ago');
  });

  it('t("panels.since", { date: "2024-01-01" }) interpolates correctly', () => {
    const t = makeT('en');
    expect(t('panels.since', { date: '2024-01-01' })).toBe('Since 2024-01-01');
  });
});
