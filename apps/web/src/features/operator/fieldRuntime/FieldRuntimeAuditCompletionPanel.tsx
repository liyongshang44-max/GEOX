// apps/web/src/features/operator/fieldRuntime/FieldRuntimeAuditCompletionPanel.tsx
// Purpose: render the H60-K migration completion matrix.
// Boundary: this panel reports phase completion metadata only.

import React from "react";
import { type FieldRuntimeAuditViewModel } from "./fieldRuntimeAuditAdapter";

type FieldRuntimeAuditCompletionPanelProps = {
  audit: FieldRuntimeAuditViewModel;
};

export default function FieldRuntimeAuditCompletionPanel({ audit }: FieldRuntimeAuditCompletionPanelProps): React.ReactElement {
  const rows = [
    ["H60-D Overview / State", audit.completionSummary.h60D],
    ["H60-E Evidence", audit.completionSummary.h60E],
    ["H60-F Forecast", audit.completionSummary.h60F],
    ["H60-G Scenario read-only split", audit.completionSummary.h60G],
    ["H60-H Residual / Verification", audit.completionSummary.h60H],
    ["H60-I Calibration", audit.completionSummary.h60I],
    ["Health", "not_enabled / planned for H62"],
    ["Audit", "H60-K"],
  ];
  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__auditCompletion" data-h60k-panel="audit-completion">
      <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">Audit</p><h2 className="operatorFieldRuntime__panelTitle">Field Runtime Audit Completion</h2></div><span className="operatorFieldRuntime__panelMeta">H60 completion summary</span></div>
      <div className="operatorFieldRuntime__auditTable" role="table" aria-label="Field Runtime audit completion matrix">
        <div className="operatorFieldRuntime__auditTableHeader" role="row"><span>Phase</span><span>Status</span></div>
        {rows.map(([phase, status]) => <div className="operatorFieldRuntime__auditTableRow" role="row" key={phase}><span>{phase}</span><span>{status}</span></div>)}
      </div>
    </article>
  );
}
