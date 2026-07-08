// apps/web/src/features/operator/fieldRuntime/FieldRuntimeVerificationSummaryPanel.tsx
import React from "react";
import { localizedText, useLocale, type LocalizedCopy } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeResidualViewModel } from "./fieldRuntimeResidualAdapter";

const COPY = {
  candidate: { zh: "下游候选元数据", en: "Downstream Candidate Metadata" },
  lead: { zh: "下游候选标记仅为元数据。", en: "Downstream candidate flags are metadata only." },
  reason: { zh: "原因", en: "Reason" },
  id: { zh: "核验 ID", en: "Verification ID" },
  transition: { zh: "类别转换", en: "Class Transition" },
  memory: { zh: "仅 Field Memory 候选元数据", en: "Field Memory Candidate Metadata Only" },
  roi: { zh: "仅 ROI 候选元数据", en: "ROI Candidate Metadata Only" },
  writeReady: { zh: "仅写入准备度元数据", en: "Write-readiness Metadata Only" },
} as const satisfies Record<string, LocalizedCopy>;

export default function FieldRuntimeVerificationSummaryPanel({ residual }: { residual: FieldRuntimeResidualViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const c = (copy: LocalizedCopy) => localizedText(copy, locale);
  const summary = residual.verificationSummary;
  return <article className="operatorFieldRuntime__panel operatorFieldRuntime__verificationSummary" data-h60h-panel="verification-summary">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("verificationSummary")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("verificationSummary")}</h2></div><span className="operatorFieldRuntime__panelMeta">{c(COPY.candidate)}</span></div>
    <p className="operatorFieldRuntime__stubLead">{c(COPY.lead)}</p>
    <div className="operatorFieldRuntime__metricGrid operatorFieldRuntime__residualMetadata">
      <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{t("status")}</p><strong>{summary.statusText}</strong></section>
      <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{c(COPY.reason)}</p><strong>{summary.reasonText}</strong></section>
      <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{c(COPY.id)}</p><strong>{summary.verificationId}</strong></section>
      <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{c(COPY.transition)}</p><strong>{summary.classTransitionText}</strong></section>
      <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{c(COPY.memory)}</p><strong>{summary.fieldMemoryCandidate ? "true" : "false"}</strong></section>
      <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{c(COPY.roi)}</p><strong>{summary.roiCandidate ? "true" : "false"}</strong></section>
      <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{c(COPY.writeReady)}</p><strong>{summary.writeReadyMetadata ? "true" : "false"}</strong></section>
    </div>
  </article>;
}
