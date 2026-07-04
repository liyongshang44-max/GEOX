// apps/web/src/features/operator/fieldRuntime/FieldRuntimeAuditRouteMatrixPanel.tsx
// Purpose: render the H60-K canonical route ownership matrix.
// Boundary: route rows are ownership metadata only.

import React from "react";
import { type FieldRuntimeAuditViewModel } from "./fieldRuntimeAuditAdapter";

type FieldRuntimeAuditRouteMatrixPanelProps = {
  audit: FieldRuntimeAuditViewModel;
};

export default function FieldRuntimeAuditRouteMatrixPanel({ audit }: FieldRuntimeAuditRouteMatrixPanelProps): React.ReactElement {
  const routeRows = ["/operator/fields", ...audit.migratedTabs.map((row) => row.route)];
  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__auditRouteMatrix" data-h60k-panel="audit-route-matrix">
      <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">Audit</p><h2 className="operatorFieldRuntime__panelTitle">Route Ownership</h2></div><span className="operatorFieldRuntime__panelMeta">{audit.canonicalRouteFamily}</span></div>
      <p className="operatorFieldRuntime__stubLead">Health route exists as not_enabled placeholder, not as production monitoring surface.</p>
      <div className="operatorFieldRuntime__auditTable" role="table" aria-label="Field Runtime route ownership matrix">
        <div className="operatorFieldRuntime__auditTableHeader" role="row"><span>Route</span><span>Owner</span><span>Status</span></div>
        {routeRows.map((route) => <div className="operatorFieldRuntime__auditTableRow" role="row" key={route}><span>{route}</span><span>FieldRuntimeRoutePage</span><span>preserved</span></div>)}
      </div>
    </article>
  );
}
