// apps/web/src/lib/locale.tsx
// Purpose: own the formal zh-CN / en-US product locale as persisted browser state.
// Boundary: locale state changes product copy and document language only; it never changes routes, authentication, API context, or business data.

import React from "react";

export type LocaleCode = "zh-CN" | "en-US";

export type LocalizedCopy = {
  zh: string;
  en: string;
};

export const LOCALE_STORAGE_KEY = "geox.locale";

export const SUPPORTED_LOCALES = ["zh-CN", "en-US"] as const satisfies readonly LocaleCode[];

type LocaleContextValue = {
  locale: LocaleCode;
  setLocale: (next: LocaleCode) => void;
  isChinese: boolean;
  text: (zh: string, en: string) => string;
};

export function isLocaleCode(value: unknown): value is LocaleCode {
  return value === "zh-CN" || value === "en-US";
}

export function normalizeLocale(value: unknown): LocaleCode {
  return isLocaleCode(value) ? value : "zh-CN";
}

export function localizedText(copy: LocalizedCopy, locale: LocaleCode): string {
  return locale === "en-US" ? copy.en : copy.zh;
}

function readStoredLocale(): LocaleCode {
  if (typeof window === "undefined") return "zh-CN";
  return normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
}

function persistLocale(locale: LocaleCode): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

function synchronizeDocumentLanguage(locale: LocaleCode): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
  document.documentElement.dataset.locale = locale;
}

const LocaleContext = React.createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [locale, setLocaleState] = React.useState<LocaleCode>(() => readStoredLocale());

  const setLocale = React.useCallback((next: LocaleCode) => {
    const safeLocale = normalizeLocale(next);
    persistLocale(safeLocale);
    setLocaleState(safeLocale);
  }, []);

  React.useLayoutEffect(() => {
    synchronizeDocumentLanguage(locale);
  }, [locale]);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleStorage = (event: StorageEvent): void => {
      if (event.key !== LOCALE_STORAGE_KEY) return;
      const nextLocale = normalizeLocale(event.newValue);
      setLocaleState(nextLocale);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const value = React.useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      isChinese: locale === "zh-CN",
      text: (zh: string, en: string) => localizedText({ zh, en }, locale),
    }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const value = React.useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used within LocaleProvider");
  return value;
}

export function useResolvedLocale(): LocaleCode {
  return React.useContext(LocaleContext)?.locale ?? "zh-CN";
}
