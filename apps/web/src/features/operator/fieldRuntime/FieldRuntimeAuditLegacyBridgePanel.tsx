// apps/web/src/features/operator/fieldRuntime/FieldRuntimeAuditLegacyBridgePanel.tsx
// Purpose: render the H60-K legacy route bridge matrix.
// Boundary: legacy routes are preserved and not redirected by H60-K.

import React from "react";
import { type FieldRuntimeAuditViewModel } from "./fieldRuntimeAuditAdapter";

type FieldRuntimeAuditLegacyBridgePanelProps = {
  audit: FieldRuntimeAuditViewModel;
};

export default function FieldRuntimeAuditLegacyBridgePanel({ audit }: FieldRuntimeAuditLegacyBridgePanelProps): React.ReactElement {
  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__auditLegacyBridge" data-h60k-panel="audit-legacy-bridge">
      <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">Audit</p><h2 className="operatorFieldRuntime__panelTitle">Legacy Route Bridge</h2></div><span className="operatorFieldRuntime__panelMeta">{audit.legacyRouteFamily}</span></div>
      <p className="operatorFieldRuntime__stubLead">Legacy routes preserved. No redirect is introduced. Scenario legacy governed submission remains isolated.</p>
      <div className="operatorFieldRuntime__auditTable" role="table" aria-label="Field Runtime legacy route bridge">
        <div className="operatorFieldRuntime__auditTableHeader" role="row"><span>Canonical route</span><span>Legacy route</span><span>Strategy</span></div>
        {audit.legacyRoutes.map((row) => <div className="operatorFieldRuntime__auditTableRow" role="row" key={row.canonicalRoute + row.legacyRoute}><span>{row.canonicalRoute}</span><span>{row.legacyRoute}</span><span>{row.strategy}</span></div>)}
      </div>
    </article>
  );
}
