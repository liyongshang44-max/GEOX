// apps/web/src/features/operator/fieldRuntime/FieldRuntimeAuditBoundaryMatrixPanel.tsx
// Purpose: render the H60-K no-write boundary matrix.
// Boundary: this matrix is audit information, not an action matrix.

import React from "react";
import { type FieldRuntimeAuditViewModel } from "./fieldRuntimeAuditAdapter";

type FieldRuntimeAuditBoundaryMatrixPanelProps = {
  audit: FieldRuntimeAuditViewModel;
};

const H60K_BOUNDARY_LINES = [
  "No facts write",
  "No recommendation creation",
  "No scenario submission in canonical route",
  "No approval",
  "No dispatch",
  "No AO-ACT task",
  "No ROI write",
  "No Field Memory write",
  "No model update",
  "No calibration execution",
  "No production monitoring claim",
  "No product conclusion",
];

export default function FieldRuntimeAuditBoundaryMatrixPanel({ audit }: FieldRuntimeAuditBoundaryMatrixPanelProps): React.ReactElement {
  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__auditBoundaryMatrix" data-h60k-panel="audit-boundary-matrix">
      <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">Audit</p><h2 className="operatorFieldRuntime__panelTitle">Boundary Matrix</h2></div><span className="operatorFieldRuntime__panelMeta">Audit matrix only</span></div>
      <p className="operatorFieldRuntime__stubLead">Boundary Matrix is audit information, not an action matrix.</p>
      <ul className="operatorFieldRuntime__boundaryList">{H60K_BOUNDARY_LINES.map((line) => <li key={line}>{line}</li>)}</ul>
      <div className="operatorFieldRuntime__auditTable" role="table" aria-label="Field Runtime no-write boundary matrix">
        <div className="operatorFieldRuntime__auditTableHeader" role="row"><span>Tab</span><span>Facts</span><span>Recommendation</span><span>Approval</span><span>Dispatch</span><span>AO-ACT</span><span>ROI</span><span>Field Memory</span><span>Model</span></div>
        {audit.boundaryMatrix.map((row) => <div className="operatorFieldRuntime__auditTableRow" role="row" key={row.tab}><span>{row.tab}</span><span>{row.noFactsWrite ? "No facts write" : "false"}</span><span>{row.noRecommendationCreation ? "No recommendation creation" : "false"}</span><span>{row.noApproval ? "No approval" : "false"}</span><span>{row.noDispatch ? "No dispatch" : "false"}</span><span>{row.noAoActTask ? "No AO-ACT task" : "false"}</span><span>{row.noRoiWrite ? "No ROI write" : "false"}</span><span>{row.noFieldMemoryWrite ? "No Field Memory write" : "false"}</span><span>{row.noModelUpdate ? "No model update" : "false"}</span></div>)}
      </div>
    </article>
  );
}
