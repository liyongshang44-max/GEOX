// apps/web/src/features/operator/fieldRuntime/FieldRuntimeVerificationGapPanel.tsx
import React from "react";
import { useLocale } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeResidualViewModel } from "./fieldRuntimeResidualAdapter";

export default function FieldRuntimeVerificationGapPanel({ residual }: { residual: FieldRuntimeResidualViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  const label = (en: string, zh: string) => locale === "en-US" ? en : zh;
  return <article className="operatorFieldRuntime__panel operatorFieldRuntime__verificationGaps" data-h60h-panel="verification-gaps">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("verificationGaps")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("verificationGaps")}</h2></div><span className="operatorFieldRuntime__panelMeta">{label("Verification Gap Status Metadata", "核验缺口状态元数据")}</span></div>
    <div className="operatorFieldRuntime__residualGapList">
      {residual.verificationGaps.length === 0 ? <p>{label("No verification gaps returned.", "未返回核验缺口。")}</p> : null}
      {residual.verificationGaps.map((gap) => <section className="operatorFieldRuntime__metricCard" key={gap.gapCode}><p className="operatorFieldRuntime__panelMeta">{label("Verification Gap Status", "核验缺口状态")}: {gap.gapStatus}</p><strong>{gap.label}</strong><span>{gap.gapCode}</span></section>)}
    </div>
  </article>;
}
