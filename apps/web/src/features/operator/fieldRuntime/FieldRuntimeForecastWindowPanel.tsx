// apps/web/src/features/operator/fieldRuntime/FieldRuntimeForecastWindowPanel.tsx
import React from "react";
import { localizedText, useLocale, type LocalizedCopy } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeForecastViewModel } from "./fieldRuntimeForecastAdapter";

const COPY = {
  lead: { zh: "预测窗口是只读可用性窗口，不是行动窗口。", en: "The forecast window is a read-only availability window, not an action window." },
  horizon: { zh: "可用时域", en: "Available Horizon" },
  limited: { zh: "时域受限", en: "Horizon Limited" },
  unavailable: { zh: "不可用时域", en: "Unavailable Horizons" },
  reason: { zh: "预测限制原因", en: "Forecast Limitation Reason" },
} as const satisfies Record<string, LocalizedCopy>;

export default function FieldRuntimeForecastWindowPanel({ forecast }: { forecast: FieldRuntimeForecastViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const c = (copy: LocalizedCopy) => localizedText(copy, locale);
  const window = forecast.forecastWindow;
  return <article className="operatorFieldRuntime__panel operatorFieldRuntime__forecastWindow" data-h60f-panel="forecast-window">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("forecastWindow")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("forecastWindow")}</h2></div><span className="operatorFieldRuntime__panelMeta">{c(COPY.lead)}</span></div>
    <p className="operatorFieldRuntime__stubLead">{c(COPY.lead)}</p>
    <div className="operatorFieldRuntime__metricGrid">
      <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{c(COPY.horizon)}</p><strong>{window.availableHorizon}</strong></section>
      <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{c(COPY.limited)}</p><strong>{window.horizonLimited ? "true" : "false"}</strong></section>
      <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{c(COPY.unavailable)}</p><strong>{window.unavailableHorizons.join(", ") || t("none")}</strong></section>
      <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{c(COPY.reason)}</p><strong>{window.limitationReason}</strong></section>
      <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{t("forecastEvidence")}</p><strong>{window.evidenceRefs.length} {t("refs")}</strong></section>
    </div>
  </article>;
}
