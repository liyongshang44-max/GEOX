// apps/web/src/features/operator/fieldRuntime/FieldRuntimeEvidenceTabPanel.tsx
// Purpose: render the H60-E canonical Field Runtime Evidence tab from the existing read-only evidence quality read model.
// Boundary: this tab reviews evidence only and creates no actions, facts, recommendations, approvals, dispatches, or AO-ACT tasks.

import React from "react";
import { type FieldRuntimeEvidenceLoadState } from "./fieldRuntimeEvidenceAdapter";
import FieldRuntimeEvidenceBoundaryPanel from "./FieldRuntimeEvidenceBoundaryPanel";
import FieldRuntimeEvidenceCoveragePanel from "./FieldRuntimeEvidenceCoveragePanel";
import FieldRuntimeEvidenceGapPanel from "./FieldRuntimeEvidenceGapPanel";
import FieldRuntimeEvidenceQualityPanel from "./FieldRuntimeEvidenceQualityPanel";
import FieldRuntimeEvidenceTracePanel from "./FieldRuntimeEvidenceTracePanel";
import FieldRuntimeSourceIndexPanel from "./FieldRuntimeSourceIndexPanel";

const FIELD_RUNTIME_EVIDENCE_SOURCE_LABEL = "source: operator_field_twin_evidence_quality_v1";

type FieldRuntimeEvidenceTabPanelProps = {
  loadState?: FieldRuntimeEvidenceLoadState;
};

export default function FieldRuntimeEvidenceTabPanel({ loadState }: FieldRuntimeEvidenceTabPanelProps): React.ReactElement {
  if (!loadState || loadState.status === "idle") {
    return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">Evidence</h2><p>{loadState?.message || "Evidence is waiting for a field context."}</p></article>;
  }
  if (loadState.status === "loading") {
    return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">Evidence</h2><p>Loading read-only evidence quality...</p></article>;
  }
  if (loadState.status === "error") {
    return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">Evidence</h2><p>Evidence load failed: {loadState.message}</p></article>;
  }

  const evidence = loadState.evidence;
  return (
    <div className="operatorFieldRuntime__evidenceGrid" data-h60e="evidence-tab-ready" data-evidence-source={evidence.source}>
      <article className="operatorFieldRuntime__panel" data-h60e-panel="evidence-intro">
        <div className="operatorFieldRuntime__panelHeader">
          <div>
            <p className="operatorFieldRuntime__eyebrow">Evidence</p>
            <h2 className="operatorFieldRuntime__panelTitle">Evidence</h2>
          </div>
          <span className="operatorFieldRuntime__panelMeta">{FIELD_RUNTIME_EVIDENCE_SOURCE_LABEL}</span>
        </div>
        <p className="operatorFieldRuntime__stubLead">Evidence content is derived from the existing read-only Operator Field Twin evidence quality read model.</p>
        <p className="operatorFieldRuntime__stubLead">Full Evidence trace is displayed for review only.</p>
        <p className="operatorFieldRuntime__stubLead">No facts are written. No recommendation is created. No approval / dispatch / AO-ACT task is created.</p>
      </article>

      <FieldRuntimeEvidenceQualityPanel evidence={evidence} />
      <FieldRuntimeEvidenceTracePanel evidence={evidence} />
      <FieldRuntimeEvidenceCoveragePanel evidence={evidence} />
      <FieldRuntimeSourceIndexPanel evidence={evidence} />
      <FieldRuntimeEvidenceGapPanel evidence={evidence} />
      <FieldRuntimeEvidenceBoundaryPanel evidence={evidence} />
    </div>
  );
}
