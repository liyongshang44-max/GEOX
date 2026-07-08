// apps/web/src/features/operator/fieldRuntime/FieldRuntimeForecastEvidencePanel.tsx
import React from "react";
import { localizedText, useLocale, type LocalizedCopy } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeForecastViewModel } from "./fieldRuntimeForecastAdapter";

const COPY = {
  fullTrace: { zh: "完整证据追踪可在证据标签中查看。", en: "The full evidence trace is available in the Evidence tab." },
  refsOnly: { zh: "预测证据仅列出预测窗口和时间线使用的引用。", en: "Forecast Evidence lists only the references used by the forecast window and timeline." },
} as const satisfies Record<string, LocalizedCopy>;

export default function FieldRuntimeForecastEvidencePanel({ forecast }: { forecast: FieldRuntimeForecastViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const c = (copy: LocalizedCopy) => localizedText(copy, locale);
  return <article className="operatorFieldRuntime__panel operatorFieldRuntime__forecastEvidence" data-h60f-panel="forecast-evidence">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("forecastEvidence")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("forecastEvidence")}</h2></div><span className="operatorFieldRuntime__panelMeta">{forecast.evidenceRefs.length} {t("refs")}</span></div>
    <p className="operatorFieldRuntime__stubLead">{c(COPY.fullTrace)}</p>
    <p className="operatorFieldRuntime__stubLead">{c(COPY.refsOnly)}</p>
    <details className="operatorFieldRuntime__forecastRefs" open><summary>{t("forecastEvidence")} {t("refs")}</summary><ul data-locale-neutral="true">{forecast.evidenceRefs.map((ref) => <li key={ref}>{ref}</li>)}</ul></details>
  </article>;
}
