// apps/web/src/components/common/LocaleToggle.tsx
// Purpose: render a local-only language toggle for future formal product shells.
// Boundary: this component updates LocaleProvider state only and does not change navigation.

import React from "react";
import { useLocale, type LocaleCode } from "../../lib/locale";

const OPTIONS: Array<{ code: LocaleCode; label: string }> = [
  { code: "zh-CN", label: "中文" },
  { code: "en-US", label: "English" },
];

export default function LocaleToggle(): React.ReactElement {
  const { locale, setLocale } = useLocale();

  return (
    <div className="localeToggle" role="group" aria-label="Language selector">
      {OPTIONS.map((option) => (
        <button
          key={option.code}
          type="button"
          className={"localeToggle__button" + (locale === option.code ? " isActive" : "")}
          aria-pressed={locale === option.code}
          aria-label={`Set language to ${option.label}`}
          onClick={() => setLocale(option.code)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
