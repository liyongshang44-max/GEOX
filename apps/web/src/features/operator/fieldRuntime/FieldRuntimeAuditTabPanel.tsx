// apps/web/src/features/operator/fieldRuntime/FieldRuntimeAuditTabPanel.tsx
// Purpose: render the H60-K canonical Field Runtime Audit tab.
// Boundary: Audit reviews local route, source, contract, boundary, and bridge metadata only.

import React from "react";
import { type FieldRuntimeAuditLoadState } from "./fieldRuntimeAuditAdapter";
import FieldRuntimeAuditBoundaryMatrixPanel from "./FieldRuntimeAuditBoundaryMatrixPanel";
import FieldRuntimeAuditCompletionPanel from "./FieldRuntimeAuditCompletionPanel";
import FieldRuntimeAuditLegacyBridgePanel from "./FieldRuntimeAuditLegacyBridgePanel";
import FieldRuntimeAuditRouteMatrixPanel from "./FieldRuntimeAuditRouteMatrixPanel";
import FieldRuntimeAuditSourceMatrixPanel from "./FieldRuntimeAuditSourceMatrixPanel";
import FieldRuntimeTraceReadbackBridgePanel from "./FieldRuntimeTraceReadbackBridgePanel";

type FieldRuntimeAuditTabPanelProps = {
  loadState?: FieldRuntimeAuditLoadState;
};

export default function FieldRuntimeAuditTabPanel({ loadState }: FieldRuntimeAuditTabPanelProps): React.ReactElement {
  if (!loadState || loadState.status !== "ready") {
    return <article className="operatorFieldRuntime__panel"><h2 className="operatorFieldRuntime__panelTitle">Audit</h2><p>Audit metadata is not available.</p></article>;
  }

  const audit = loadState.audit;
  return (
    <div className="operatorFieldRuntime__auditGrid" data-h60k="audit-tab-ready" data-audit-source={audit.source}>
      <article className="operatorFieldRuntime__panel" data-h60k-panel="audit-intro">
        <div className="operatorFieldRuntime__panelHeader">
          <div>
            <p className="operatorFieldRuntime__eyebrow">Audit</p>
            <h2 className="operatorFieldRuntime__panelTitle">Field Runtime Audit</h2>
          </div>
          <span className="operatorFieldRuntime__panelMeta">source: field_runtime_audit_v1</span>
        </div>
        <p className="operatorFieldRuntime__stubLead">Audit content is derived from local Field Runtime route, source, contract, and boundary metadata.</p>
        <p className="operatorFieldRuntime__stubLead">Audit is displayed for traceability review only.</p>
        <p className="operatorFieldRuntime__stubLead">Audit does not create product conclusions.</p>
        <p className="operatorFieldRuntime__stubLead">Audit does not rank, recommend, approve, dispatch, or update model state.</p>
        <p className="operatorFieldRuntime__stubLead">Health remains not_enabled and planned for H62.</p>
      </article>
      <FieldRuntimeAuditCompletionPanel audit={audit} />
      <FieldRuntimeAuditSourceMatrixPanel audit={audit} />
      <FieldRuntimeAuditRouteMatrixPanel audit={audit} />
      <FieldRuntimeAuditLegacyBridgePanel audit={audit} />
      <FieldRuntimeAuditBoundaryMatrixPanel audit={audit} />
      <FieldRuntimeTraceReadbackBridgePanel audit={audit} />
    </div>
  );
}
