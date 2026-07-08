// apps/web/src/features/operator/fieldRuntime/FieldRuntimeEvidenceQualityPanel.tsx
import React from "react";
import { useLocale } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeEvidenceViewModel } from "./fieldRuntimeEvidenceAdapter";

type Props = { evidence: FieldRuntimeEvidenceViewModel };

export default function FieldRuntimeEvidenceQualityPanel({ evidence }: Props): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const summary = evidence.qualitySummary;
  return <article className="operatorFieldRuntime__panel operatorFieldRuntime__qualitySummary" data-h60e-panel="quality-summary">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("qualitySummary")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("qualitySummary")}</h2></div><span className="operatorFieldRuntime__qualityBadge">{t("evidenceQualityStatus")}: {summary.status}</span></div>
    <p className="operatorFieldRuntime__stubLead">{t("qualityNotRisk")}</p>
    <div className="operatorFieldRuntime__metricGrid">
      <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{t("blockingReason")}</p><strong>{summary.blockingReason}</strong></section>
      <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{t("simulationPresent")}</p><strong>{summary.simulationDataPresent ? "true" : "false"}</strong></section>
      <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{t("officialQualified")}</p><strong>{summary.officialDataQualified ? "true" : "false"}</strong></section>
      <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{t("lowQualityReasons")}</p><strong>{summary.lowQualityReasonCount}</strong></section>
    </div>
  </article>;
}
