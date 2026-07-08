// apps/web/src/features/operator/fieldRuntime/FieldRuntimeScenarioOptionsPanel.tsx
import React from "react";
import { localizedText, useLocale, type LocalizedCopy } from "../../../lib/locale";
import { operatorSafeDisplay, operatorStatusLabel } from "../../../lib/productCopy/operatorLocale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeScenarioViewModel } from "./fieldRuntimeScenarioAdapter";

const COPY = {
  order: { zh: "保持后端返回顺序。", en: "Backend return order is preserved." },
  lead: { zh: "情景选项置信度和变化量仅为比较元数据，不是行动资格或任务优先级。", en: "Scenario confidence and deltas are comparison metadata, not action eligibility or task priority." },
  delta: { zh: "预测变化", en: "Forecast Delta" },
  confidence: { zh: "置信度元数据", en: "Confidence Metadata" },
  baseline: { zh: "无行动基线", en: "No-action Baseline" },
  failures: { zh: "失败条件", en: "Failure Conditions" },
  option: { zh: "情景选项", en: "Scenario Option" },
  unavailable: { zh: "暂不可用", en: "Unavailable" },
} as const satisfies Record<string, LocalizedCopy>;

export default function FieldRuntimeScenarioOptionsPanel({ scenario }: { scenario: FieldRuntimeScenarioViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const c = (copy: LocalizedCopy) => localizedText(copy, locale);
  return <article className="operatorFieldRuntime__panel operatorFieldRuntime__scenarioOptions" data-h60g-panel="scenario-options">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("scenarioOptions")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("scenarioOptions")}</h2></div><span className="operatorFieldRuntime__panelMeta">{c(COPY.order)}</span></div>
    <p className="operatorFieldRuntime__stubLead">{c(COPY.lead)}</p>
    <div className="operatorFieldRuntime__scenarioOptionList">{scenario.options.map((option) => <section className="operatorFieldRuntime__scenarioOption" key={option.optionId + option.label}>
      <div><p className="operatorFieldRuntime__panelMeta" data-locale-neutral="true">{option.optionId}</p><strong>{operatorSafeDisplay(option.label, locale, COPY.option)}</strong></div>
      <dl className="operatorFieldRuntime__scenarioDetailList">
        <div><dt>{c(COPY.delta)}</dt><dd>{operatorStatusLabel(option.forecastDeltaText, locale)}</dd></div>
        <div><dt>{c(COPY.confidence)}</dt><dd>{operatorSafeDisplay(option.confidenceText, locale, COPY.unavailable)}</dd></div>
        <div><dt>{c(COPY.baseline)}</dt><dd>{option.isNoActionBaseline ? "true" : "false"}</dd></div>
        <div><dt>{c(COPY.failures)}</dt><dd data-locale-neutral="true">{option.failureConditions.join(", ") || t("none")}</dd></div>
      </dl>
    </section>)}</div>
  </article>;
}
