// apps/web/src/components/common/LocaleToggle.tsx
// Purpose: render a local-only language toggle for future formal product shells.
// Boundary: this component updates LocaleProvider state only and does not change navigation.

import React from "react";
import { useLocale, type LocaleCode } from "../../lib/locale";

const OPTIONS: Array<{ code: LocaleCode; label: string }> = [
  { code: "zh-CN", label: "中文" },
  { code: "en-US", label: "English" },
];

function optionAriaLabel(code: LocaleCode, text: (zh: string, en: string) => string): string {
  return code === "zh-CN" ? text("切换为中文", "Switch to Chinese") : text("切换为英文", "Switch to English");
}

export default function LocaleToggle(): React.ReactElement {
  const { locale, setLocale, text } = useLocale();

  return (
    <div className="localeToggle" role="group" aria-label={text("语言选择", "Language selector")}>
      {OPTIONS.map((option) => (
        <button
          key={option.code}
          type="button"
          className={"localeToggle__button" + (locale === option.code ? " isActive" : "")}
          aria-pressed={locale === option.code}
          aria-label={optionAriaLabel(option.code, text)}
          onClick={() => setLocale(option.code)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
