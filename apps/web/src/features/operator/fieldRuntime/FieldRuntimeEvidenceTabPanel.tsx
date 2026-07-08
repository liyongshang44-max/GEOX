// apps/web/src/features/operator/fieldRuntime/FieldRuntimeEvidenceTabPanel.tsx
import React from "react";
import { useLocale } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeEvidenceLoadState } from "./fieldRuntimeEvidenceAdapter";
import FieldRuntimeEvidenceBoundaryPanel from "./FieldRuntimeEvidenceBoundaryPanel";
import FieldRuntimeEvidenceCoveragePanel from "./FieldRuntimeEvidenceCoveragePanel";
import FieldRuntimeEvidenceGapPanel from "./FieldRuntimeEvidenceGapPanel";
import FieldRuntimeEvidenceQualityPanel from "./FieldRuntimeEvidenceQualityPanel";
import FieldRuntimeEvidenceTracePanel from "./FieldRuntimeEvidenceTracePanel";
import FieldRuntimeSourceIndexPanel from "./FieldRuntimeSourceIndexPanel";

const SOURCE_LABEL = "source: operator_field_twin_evidence_quality_v1";
type Props = { loadState?: FieldRuntimeEvidenceLoadState };

export default function FieldRuntimeEvidenceTabPanel({ loadState }: Props): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);

  if (!loadState || loadState.status === "idle") return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">{t("evidence")}</h2><p>{loadState?.message || t("evidenceWaiting")}</p></article>;
  if (loadState.status === "loading") return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">{t("evidence")}</h2><p>{t("evidenceLoading")}</p></article>;
  if (loadState.status === "error") return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">{t("evidence")}</h2><p>{t("evidenceFailed")}: <span data-locale-neutral="true">{loadState.message}</span></p></article>;

  const evidence = loadState.evidence;
  return <div className="operatorFieldRuntime__evidenceGrid" data-h60e="evidence-tab-ready" data-evidence-source={evidence.source}>
    <article className="operatorFieldRuntime__panel" data-h60e-panel="evidence-intro">
      <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("evidence")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("evidence")}</h2></div><span className="operatorFieldRuntime__panelMeta" data-locale-neutral="true">{SOURCE_LABEL}</span></div>
      <p className="operatorFieldRuntime__stubLead">{t("evidenceIntro")}</p>
      <p className="operatorFieldRuntime__stubLead">{t("evidenceTraceReview")}</p>
      <p className="operatorFieldRuntime__stubLead">{t("noEvidenceActions")}</p>
    </article>
    <FieldRuntimeEvidenceQualityPanel evidence={evidence} />
    <FieldRuntimeEvidenceTracePanel evidence={evidence} />
    <FieldRuntimeEvidenceCoveragePanel evidence={evidence} />
    <FieldRuntimeSourceIndexPanel evidence={evidence} />
    <FieldRuntimeEvidenceGapPanel evidence={evidence} />
    <FieldRuntimeEvidenceBoundaryPanel evidence={evidence} />
  </div>;
}
