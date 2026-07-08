// apps/web/src/features/operator/fieldRuntime/FieldRuntimeForecastTimelinePanel.tsx
import React from "react";
import { localizedText, useLocale, type LocalizedCopy } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeForecastViewModel } from "./fieldRuntimeForecastAdapter";

const COPY = {
  items: { zh: "条时间线记录", en: "timeline items" },
  lead: { zh: "时间线只展示预测信号；置信度是预测元数据，不是行动资格。", en: "The timeline displays forecast signals only; confidence is forecast metadata, not action eligibility." },
  confidence: { zh: "置信度", en: "Confidence" },
} as const satisfies Record<string, LocalizedCopy>;

export default function FieldRuntimeForecastTimelinePanel({ forecast }: { forecast: FieldRuntimeForecastViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const c = (copy: LocalizedCopy) => localizedText(copy, locale);
  return <article className="operatorFieldRuntime__panel operatorFieldRuntime__forecastTimeline" data-h60f-panel="forecast-timeline">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("forecastTimeline")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("forecastTimeline")}</h2></div><span className="operatorFieldRuntime__panelMeta">{forecast.timelineItems.length} {c(COPY.items)}</span></div>
    <p className="operatorFieldRuntime__stubLead">{c(COPY.lead)}</p>
    <div className="operatorFieldRuntime__forecastTimelineList">{forecast.timelineItems.map((item) => <section className="operatorFieldRuntime__forecastTimelineItem" key={item.horizon}>
      <div data-locale-neutral="true"><p className="operatorFieldRuntime__panelMeta">{item.horizon}</p><strong>{item.forecastText}</strong></div>
      <p className="operatorFieldRuntime__forecastReason">{c(COPY.confidence)}: <span data-locale-neutral="true">{item.confidenceText}</span></p>
      <details className="operatorFieldRuntime__forecastRefs"><summary>{item.evidenceRefs.length} {t("evidenceRefs")}</summary><ul data-locale-neutral="true">{item.evidenceRefs.map((ref) => <li key={ref}>{ref}</li>)}</ul></details>
    </section>)}</div>
  </article>;
}
