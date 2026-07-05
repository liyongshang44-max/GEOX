// apps/web/src/lib/locale.tsx
import React from "react";

export type LocaleCode = "zh-CN" | "en-US";

export type LocalizedCopy = {
  zh: string;
  en: string;
};

export const LOCALE_STORAGE_KEY = "geox.locale";

export const SUPPORTED_LOCALES: LocaleCode[] = ["zh-CN", "en-US"];

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

const LocaleContext = React.createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [locale, setLocaleState] = React.useState<LocaleCode>(() => readStoredLocale());

  const setLocale = React.useCallback((next: LocaleCode) => {
    const safeLocale = normalizeLocale(next);
    setLocaleState(safeLocale);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, safeLocale);
    }
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
