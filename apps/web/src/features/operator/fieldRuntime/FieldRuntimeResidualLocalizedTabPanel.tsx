// apps/web/src/features/operator/fieldRuntime/FieldRuntimeResidualLocalizedTabPanel.tsx
import React from "react";
import { useLocale } from "../../../lib/locale";
import { fieldRuntimeText, type FieldRuntimeCopyKey } from "./fieldRuntimeLocaleCopy";
import { type FieldRuntimeResidualLoadState } from "./fieldRuntimeResidualAdapter";
import FieldRuntimeExecutionEvidencePanel from "./FieldRuntimeExecutionEvidencePanel";
import FieldRuntimeExecutionTailPanel from "./FieldRuntimeExecutionTailPanel";
import FieldRuntimePrePostStatePanel from "./FieldRuntimePrePostStatePanel";
import FieldRuntimeResidualBoundaryPanel from "./FieldRuntimeResidualBoundaryPanel";
import FieldRuntimeResponseDeltaPanel from "./FieldRuntimeResponseDeltaPanel";
import FieldRuntimeVerificationGapPanel from "./FieldRuntimeVerificationGapPanel";
import FieldRuntimeVerificationSummaryPanel from "./FieldRuntimeVerificationSummaryPanel";
import FieldRuntimeZoneResponsePanel from "./FieldRuntimeZoneResponsePanel";

export default function FieldRuntimeResidualLocalizedTabPanel({ loadState }: { loadState?: FieldRuntimeResidualLoadState }): React.ReactElement {
  const { locale } = useLocale();
  const t = (key: FieldRuntimeCopyKey) => fieldRuntimeText(locale, key);
  if (!loadState || loadState.status === "idle") return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">{t("residual")}</h2><p>{loadState?.message || t("residualWaiting")}</p></article>;
  if (loadState.status === "loading") return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">{t("residual")}</h2><p>{t("residualLoading")}</p></article>;
  if (loadState.status === "error") return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">{t("residual")}</h2><p>{t("residualFailed")}: {loadState.message}</p></article>;
  const residual = loadState.residual;
  return <div className="operatorFieldRuntime__residualGrid" data-h60h="residual-tab-ready" data-residual-source={residual.source} data-closure-source={residual.closureSource}>
    <article className="operatorFieldRuntime__panel" data-h60h-panel="residual-intro">
      <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">{t("residual")}</p><h2 className="operatorFieldRuntime__panelTitle">{t("residual")}</h2></div><span className="operatorFieldRuntime__panelMeta">operator_field_twin_verification_v1</span></div>
      <p className="operatorFieldRuntime__stubLead">{t("residualIntro")}</p><p className="operatorFieldRuntime__stubLead">{t("residualReview")}</p><p className="operatorFieldRuntime__stubLead">{t("residualNonclaim")}</p><p className="operatorFieldRuntime__stubLead">{t("noApprovalDispatch")}</p>
    </article>
    <FieldRuntimeVerificationSummaryPanel residual={residual} /><FieldRuntimePrePostStatePanel residual={residual} /><FieldRuntimeResponseDeltaPanel residual={residual} /><FieldRuntimeExecutionEvidencePanel residual={residual} /><FieldRuntimeZoneResponsePanel residual={residual} /><FieldRuntimeVerificationGapPanel residual={residual} /><FieldRuntimeExecutionTailPanel residual={residual} /><FieldRuntimeResidualBoundaryPanel residual={residual} />
  </div>;
}
