// apps/web/src/features/operator/fieldRuntime/FieldRuntimeEvidenceGapPanel.tsx
import React from "react";
import { useLocale } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeEvidenceViewModel } from "./fieldRuntimeEvidenceAdapter";

export default function FieldRuntimeEvidenceGapPanel({ evidence }: { evidence: FieldRuntimeEvidenceViewModel }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  return <article className="operatorFieldRuntime__panel" data-h60e-panel="evidence-gaps">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("evidenceGaps")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("evidenceGaps")}</h2></div><span className="operatorFieldRuntime__panelMeta">{t("gapStatusMetadata")}</span></div>
    <p className="operatorFieldRuntime__stubLead">{t("gapLead")}</p>
    <div className="operatorFieldRuntime__evidenceGapList">
      {evidence.dataGaps.length === 0 ? <p>{t("noEvidenceGaps")}</p> : null}
      {evidence.dataGaps.map((gap) => <section key={gap.code} className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{t("gapStatusMetadata")}: {gap.gapStatus}</p><strong>{gap.label}</strong><span>{gap.code}</span></section>)}
    </div>
    <div className="operatorFieldRuntime__evidenceGapList">
      {evidence.lowQualityReasons.length === 0 ? <p>{t("noLowQualityReasons")}</p> : null}
      {evidence.lowQualityReasons.map((reason, index) => <section key={reason.sourceTable + reason.reason + String(index)} className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">{t("lowQualityReasons")}</p><strong>{reason.reason}</strong><span>{reason.sourceTable}</span><span>{reason.missingWindows.join(", ") || t("noMissingWindows")}</span><span>{reason.evidenceRefs.length} {t("evidenceRefs")}</span></section>)}
    </div>
  </article>;
}
