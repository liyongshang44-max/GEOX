// apps/web/src/features/operator/fieldRuntime/FieldRuntimeScenarioStatusPanel.tsx
import React from "react";
import { localizedText, useLocale, type LocalizedCopy } from "../../../lib/locale";
import { operatorSafeDisplay, operatorStatusLabel } from "../../../lib/productCopy/operatorLocale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeScenarioViewModel } from "./fieldRuntimeScenarioAdapter";

const COPY = {
  metadata: { zh: "情景集 ID 是来源细节元数据。", en: "The scenario-set ID is source-detail metadata." },
  baselineLead: { zh: "无行动基线是比较参照，不是推荐方案。", en: "The no-action baseline is a comparison reference, not a recommended plan." },
  baseline: { zh: "无行动基线", en: "No-action Baseline" },
  present: { zh: "存在", en: "Present" },
  absent: { zh: "不存在", en: "Not Present" },
  reason: { zh: "不可用原因", en: "Unavailable Reason" },
  reasonUnavailable: { zh: "未提供不可用原因。", en: "No unavailable reason was provided." },
  setId: { zh: "情景集 ID", en: "Scenario Set ID" },
} as const satisfies Record<string, LocalizedCopy>;

export default function FieldRuntimeScenarioStatusPanel({ scenario }: { scenario: FieldRuntimeScenarioViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const c = (copy: LocalizedCopy) => localizedText(copy, locale);
  const compare = scenario.scenarioCompare;
  return <article className="operatorFieldRuntime__panel operatorFieldRuntime__scenarioStatus" data-h60g-panel="scenario-status">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("scenarioReview")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("scenarioStatus")}</h2></div><span className="operatorFieldRuntime__panelMeta">{c(COPY.metadata)}</span></div>
    <p className="operatorFieldRuntime__stubLead">{c(COPY.baselineLead)}</p>
    <div className="operatorFieldRuntime__metricGrid">
      <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{t("status")}</p><strong data-status={compare.status}>{operatorStatusLabel(compare.status, locale)}</strong></section>
      <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{c(COPY.baseline)}</p><strong>{compare.noActionBaselinePresent ? c(COPY.present) : c(COPY.absent)}</strong></section>
      <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{c(COPY.reason)}</p><strong>{operatorSafeDisplay(compare.unavailableReason, locale, COPY.reasonUnavailable)}</strong></section>
      <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{c(COPY.setId)}</p><strong data-locale-neutral="true">{compare.scenarioSetId}</strong></section>
    </div>
  </article>;
}
