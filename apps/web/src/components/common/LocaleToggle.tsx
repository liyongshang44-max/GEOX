// apps/web/src/components/common/LocaleToggle.tsx
// Purpose: render the formal zh-CN / en-US product locale selector.
// Boundary: this component updates LocaleProvider state only and never changes pathname, search, hash, authentication, or API context.

import React from "react";
import { useLocale, type LocaleCode } from "../../lib/locale";

type LocaleOption = {
  code: LocaleCode;
  nativeLabel: string;
};

const OPTIONS: readonly LocaleOption[] = [
  { code: "zh-CN", nativeLabel: "中文" },
  { code: "en-US", nativeLabel: "English" },
];

function optionAriaLabel(code: LocaleCode, text: (zh: string, en: string) => string): string {
  return code === "zh-CN"
    ? text("切换为中文", "Switch to Chinese")
    : text("切换为英文", "Switch to English");
}

export default function LocaleToggle(): React.ReactElement {
  const { locale, setLocale, text } = useLocale();

  return (
    <div
      className="localeToggle"
      role="group"
      aria-label={text("产品语言选择", "Product language selector")}
      data-locale-toggle="true"
      data-active-locale={locale}
    >
      {OPTIONS.map((option) => {
        const isActive = locale === option.code;

        return (
          <button
            key={option.code}
            type="button"
            className={"localeToggle__button" + (isActive ? " isActive" : "")}
            aria-pressed={isActive}
            aria-label={optionAriaLabel(option.code, text)}
            data-locale-option={option.code}
            data-locale-active={isActive ? "true" : "false"}
            lang={option.code}
            onClick={() => setLocale(option.code)}
          >
            {option.nativeLabel}
          </button>
        );
      })}
    </div>
  );
}
