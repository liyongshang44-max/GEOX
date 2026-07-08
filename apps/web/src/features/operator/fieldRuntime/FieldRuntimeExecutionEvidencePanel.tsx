// apps/web/src/features/operator/fieldRuntime/FieldRuntimeExecutionEvidencePanel.tsx
import React from "react";
import { useLocale } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeResidualViewModel } from "./fieldRuntimeResidualAdapter";

export default function FieldRuntimeExecutionEvidencePanel({ residual }: { residual: FieldRuntimeResidualViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const evidence = residual.executionEvidence;
  const label = (en: string, zh: string) => locale === "en-US" ? en : zh;
  return <article className="operatorFieldRuntime__panel operatorFieldRuntime__executionEvidence" data-h60h-panel="execution-evidence">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("executionEvidence")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("executionEvidence")}</h2></div><span className="operatorFieldRuntime__panelMeta">{evidence.evidenceRefs.length} {t("refs")}</span></div>
    <p className="operatorFieldRuntime__stubLead">{label("Existing evidence package review only.", "仅回查现有证据包。")}</p>
    <div className="operatorFieldRuntime__metricGrid">
      <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{label("Receipt Available", "回执可用")}</p><strong>{evidence.receiptAvailable ? "true" : "false"}</strong></section>
      <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{label("As-executed Available", "实执行记录可用")}</p><strong>{evidence.asExecutedAvailable ? "true" : "false"}</strong></section>
      <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{label("Acceptance Available", "验收可用")}</p><strong>{evidence.acceptanceAvailable ? "true" : "false"}</strong></section>
      <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{label("Operation Report Available", "作业报告可用")}</p><strong>{evidence.operationReportAvailable ? "true" : "false"}</strong></section>
    </div>
    <details className="operatorFieldRuntime__residualRefs" open><summary>{t("executionEvidence")} {t("refs")}</summary><ul>{evidence.evidenceRefs.map((ref) => <li key={ref}>{ref}</li>)}</ul></details>
  </article>;
}
