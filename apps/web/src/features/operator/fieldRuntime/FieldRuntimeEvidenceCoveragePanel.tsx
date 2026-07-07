// apps/web/src/features/operator/fieldRuntime/FieldRuntimeEvidenceCoveragePanel.tsx
import React from "react";
import { useLocale } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeEvidenceViewModel } from "./fieldRuntimeEvidenceAdapter";

type Props = { evidence: FieldRuntimeEvidenceViewModel };

export default function FieldRuntimeEvidenceCoveragePanel({ evidence }: Props): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  return <article className="operatorFieldRuntime__panel" data-h60e-panel="evidence-coverage">
    <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("dataCoverage")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("dataCoverage")}</h2></div><span className="operatorFieldRuntime__panelMeta">{t("coverageLead")}</span></div>
    <div className="operatorFieldRuntime__coverageTable" role="table" aria-label={t("coverageAria")}>
      <div className="operatorFieldRuntime__tableHeader" role="row"><span>{t("metric")}</span><span>{t("available")}</span><span>{t("rows")}</span><span>{t("latestTimestamp")}</span><span>{t("refs")}</span></div>
      {evidence.coverageRows.map((row) => <div className="operatorFieldRuntime__tableRow" role="row" key={row.metric + row.sourceTable}>
        <span><strong>{row.metric}</strong><small>{row.sourceTable}</small></span>
        <span>{row.available ? t("available") : t("limited")}</span>
        <span>{row.rowCount}</span><span>{row.latestTsText}</span><span>{row.evidenceRefCount}</span>
        <small className="operatorFieldRuntime__tableNote">{row.gapNotes.join(", ") || row.qualityStatus}</small>
      </div>)}
    </div>
  </article>;
}
