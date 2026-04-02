import { useLocaleStore } from '@/lib/i18n/store';

beforeEach(() => {
  // Reset to default
  useLocaleStore.setState({ locale: 'he' });
});

describe('useLocaleStore', () => {
  it('default locale is "he"', () => {
    expect(useLocaleStore.getState().locale).toBe('he');
  });

  it('setLocale("en") changes locale to en', () => {
    useLocaleStore.getState().setLocale('en');
    expect(useLocaleStore.getState().locale).toBe('en');
  });

  it('setLocale("he") changes locale back to he', () => {
    useLocaleStore.getState().setLocale('en');
    useLocaleStore.getState().setLocale('he');
    expect(useLocaleStore.getState().locale).toBe('he');
  });

  it('setting an arbitrary string is accepted by the store (no runtime validation)', () => {
    // The Locale type is 'en' | 'he' at compile time, but at runtime
    // zustand doesn't enforce it. This tests the runtime behavior.
    (useLocaleStore.getState().setLocale as (l: string) => void)('fr');
    expect(useLocaleStore.getState().locale).toBe('fr');
  });
});
