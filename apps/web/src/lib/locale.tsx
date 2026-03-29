import React from "react";

export type LocaleCode = "zh-CN" | "en-US";

type LocaleContextValue = {
  locale: LocaleCode;
  setLocale: (next: LocaleCode) => void;
  isChinese: boolean;
  text: (zh: string, en: string) => string;
};

const STORAGE_KEY = "geox.locale";

function readStoredLocale(): LocaleCode {
  if (typeof window === "undefined") return "zh-CN";
  const hit = window.localStorage.getItem(STORAGE_KEY);
  return hit === "en-US" ? "en-US" : "zh-CN";
}

const LocaleContext = React.createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [locale, setLocaleState] = React.useState<LocaleCode>(() => readStoredLocale());

  const setLocale = React.useCallback((next: LocaleCode) => {
    setLocaleState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  const value = React.useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      isChinese: locale === "zh-CN",
      text: (zh: string, en: string) => (locale === "zh-CN" ? zh : en),
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
