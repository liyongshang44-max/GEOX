// apps/web/src/features/operator/fieldRuntime/FieldRuntimeResidualTabPanel.tsx
// Purpose: render the H60-H canonical Field Runtime Residual / Verification tab from existing read-only verification read models.
// Boundary: this tab reviews verification data only and creates no recommendations, downstream writes, approvals, dispatches, or AO-ACT tasks.

import React from "react";
import { type FieldRuntimeResidualLoadState } from "./fieldRuntimeResidualAdapter";
import FieldRuntimeExecutionEvidencePanel from "./FieldRuntimeExecutionEvidencePanel";
import FieldRuntimeExecutionTailPanel from "./FieldRuntimeExecutionTailPanel";
import FieldRuntimePrePostStatePanel from "./FieldRuntimePrePostStatePanel";
import FieldRuntimeResidualBoundaryPanel from "./FieldRuntimeResidualBoundaryPanel";
import FieldRuntimeResponseDeltaPanel from "./FieldRuntimeResponseDeltaPanel";
import FieldRuntimeVerificationGapPanel from "./FieldRuntimeVerificationGapPanel";
import FieldRuntimeVerificationSummaryPanel from "./FieldRuntimeVerificationSummaryPanel";
import FieldRuntimeZoneResponsePanel from "./FieldRuntimeZoneResponsePanel";

const FIELD_RUNTIME_RESIDUAL_SOURCE_LABEL = "source: operator_field_twin_post_irrigation_verification_v1";
const FIELD_RUNTIME_CLOSURE_SOURCE_LABEL = "closure source: operator_twin_h31_h45_closure_v1";

type FieldRuntimeResidualTabPanelProps = {
  loadState?: FieldRuntimeResidualLoadState;
};

export default function FieldRuntimeResidualTabPanel({ loadState }: FieldRuntimeResidualTabPanelProps): React.ReactElement {
  if (!loadState || loadState.status === "idle") {
    return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">Residual / Verification</h2><p>{loadState?.message || "Residual / Verification is waiting for a field context."}</p></article>;
  }
  if (loadState.status === "loading") {
    return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">Residual / Verification</h2><p>Loading read-only response verification...</p></article>;
  }
  if (loadState.status === "error") {
    return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">Residual / Verification</h2><p>Residual / Verification load failed: {loadState.message}</p></article>;
  }

  const residual = loadState.residual;
  return (
    <div className="operatorFieldRuntime__residualGrid" data-h60h="residual-tab-ready" data-residual-source={residual.source} data-closure-source={residual.closureSource}>
      <article className="operatorFieldRuntime__panel" data-h60h-panel="residual-intro">
        <div className="operatorFieldRuntime__panelHeader">
          <div>
            <p className="operatorFieldRuntime__eyebrow">Residual / Verification</p>
            <h2 className="operatorFieldRuntime__panelTitle">Residual / Verification</h2>
          </div>
          <span className="operatorFieldRuntime__panelMeta">{FIELD_RUNTIME_RESIDUAL_SOURCE_LABEL}</span>
        </div>
        <p className="operatorFieldRuntime__stubLead">{FIELD_RUNTIME_CLOSURE_SOURCE_LABEL}</p>
        <p className="operatorFieldRuntime__stubLead">Residual content is derived from the existing read-only Operator Field Twin post-irrigation verification read model.</p>
        <p className="operatorFieldRuntime__stubLead">Residual / Verification is displayed for review only.</p>
        <p className="operatorFieldRuntime__stubLead">Residual is not causal proof. Residual does not write ROI. Residual does not write Field Memory.</p>
        <p className="operatorFieldRuntime__stubLead">No approval / dispatch / AO-ACT task is created.</p>
      </article>

      <FieldRuntimeVerificationSummaryPanel residual={residual} />
      <FieldRuntimePrePostStatePanel residual={residual} />
      <FieldRuntimeResponseDeltaPanel residual={residual} />
      <FieldRuntimeExecutionEvidencePanel residual={residual} />
      <FieldRuntimeZoneResponsePanel residual={residual} />
      <FieldRuntimeVerificationGapPanel residual={residual} />
      <FieldRuntimeExecutionTailPanel residual={residual} />
      <FieldRuntimeResidualBoundaryPanel residual={residual} />
    </div>
  );
}
