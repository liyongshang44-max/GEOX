// apps/web/src/features/operator/fieldRuntime/FieldRuntimePrePostStatePanel.tsx
import React from "react";
import { localizedText, useLocale, type LocaleCode, type LocalizedCopy } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeResidualViewModel, type FieldRuntimeStateSnapshotViewModel } from "./fieldRuntimeResidualAdapter";

const COPY = {
  compare: { zh: "仅状态比较", en: "State Compare Only" },
  lead: { zh: "前后状态是核验证据，不是因果证明。", en: "Pre / Post State is verification evidence, not causal proof." },
  pre: { zh: "灌溉前状态", en: "Pre-irrigation State" },
  post: { zh: "灌溉后状态", en: "Post-irrigation State" },
  observed: { zh: "观测时间", en: "Observed At" },
  moisture: { zh: "土壤水分值", en: "Soil Moisture Value" },
  unknown: { zh: "未知", en: "Unknown" },
} as const satisfies Record<string, LocalizedCopy>;

function SnapshotCard({ label, snapshot, locale }: { label: string; snapshot: FieldRuntimeStateSnapshotViewModel; locale: LocaleCode }): React.ReactElement {
  const c = (copy: LocalizedCopy) => localizedText(copy, locale);
  return <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{label}</p><strong>{snapshot.waterState}</strong><span>{localizedText({ zh: "可用", en: "Available" }, locale)}: {snapshot.available === null ? c(COPY.unknown) : snapshot.available ? "true" : "false"}</span><span>{c(COPY.observed)}: {snapshot.observedAt}</span><span>{c(COPY.moisture)}: {snapshot.soilMoistureValue}</span></section>;
}

export default function FieldRuntimePrePostStatePanel({ residual }: { residual: FieldRuntimeResidualViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const c = (copy: LocalizedCopy) => localizedText(copy, locale);
  return <article className="operatorFieldRuntime__panel operatorFieldRuntime__prePostState" data-h60h-panel="pre-post-state">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("prePostState")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("prePostState")}</h2></div><span className="operatorFieldRuntime__panelMeta">{c(COPY.compare)}</span></div>
    <p className="operatorFieldRuntime__stubLead">{c(COPY.lead)}</p>
    <div className="operatorFieldRuntime__metricGrid"><SnapshotCard label={c(COPY.pre)} snapshot={residual.prePostState.pre} locale={locale} /><SnapshotCard label={c(COPY.post)} snapshot={residual.prePostState.post} locale={locale} /></div>
  </article>;
}
