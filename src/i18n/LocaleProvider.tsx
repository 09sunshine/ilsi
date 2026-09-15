import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { dictionaries, type Locale, type TranslationKey } from "./translations";

const STORAGE_KEY = "ilsi.locale";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "fr") setLocaleState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      const table = dictionaries[locale] as Record<string, string>;
      let value = table[key] ?? (dictionaries.en as Record<string, string>)[key] ?? key;
      if (vars) {
        for (const [name, replacement] of Object.entries(vars)) {
          value = value.replaceAll(`{${name}}`, String(replacement));
        }
      }
      return value;
    },
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** Fallback used if the context is momentarily unavailable (e.g. dev hot-reload). */
const fallbackI18n: LocaleContextValue = {
  locale: "en",
  setLocale: () => {},
  t: (key, vars) => {
    let value = (dictionaries.en as Record<string, string>)[key] ?? key;
    if (vars) {
      for (const [name, replacement] of Object.entries(vars)) {
        value = value.replaceAll(`{${name}}`, String(replacement));
      }
    }
    return value;
  },
};

export function useI18n() {
  return useContext(LocaleContext) ?? fallbackI18n;
}

/** Picks the right language variant from a bilingual content field. */
export function useLocalized() {
  const { locale } = useI18n();
  return useCallback(
    (value: { en: string; fr: string }) => (locale === "fr" ? value.fr : value.en),
    [locale],
  );
}
