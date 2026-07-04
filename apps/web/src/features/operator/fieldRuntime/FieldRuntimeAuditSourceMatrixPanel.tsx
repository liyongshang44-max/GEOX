// apps/web/src/features/operator/fieldRuntime/FieldRuntimeAuditSourceMatrixPanel.tsx
// Purpose: render the H60-K source contract and read model matrix.
// Boundary: source contracts are audit details, not product conclusions.

import React from "react";
import { type FieldRuntimeAuditViewModel } from "./fieldRuntimeAuditAdapter";

type FieldRuntimeAuditSourceMatrixPanelProps = {
  audit: FieldRuntimeAuditViewModel;
};

export default function FieldRuntimeAuditSourceMatrixPanel({ audit }: FieldRuntimeAuditSourceMatrixPanelProps): React.ReactElement {
  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__auditSourceMatrix" data-h60k-panel="audit-source-matrix">
      <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">Audit</p><h2 className="operatorFieldRuntime__panelTitle">Source Contract Matrix</h2></div><span className="operatorFieldRuntime__panelMeta">Read Model Matrix</span></div>
      <p className="operatorFieldRuntime__stubLead">Source contract values are audit detail metadata.</p>
      <div className="operatorFieldRuntime__auditTable" role="table" aria-label="Field Runtime source contract matrix">
        <div className="operatorFieldRuntime__auditTableHeader" role="row"><span>Tab</span><span>Read model</span><span>Fetcher</span><span>Source contract</span><span>Backend changed by H60</span></div>
        {audit.sourceContracts.map((row) => <div className="operatorFieldRuntime__auditTableRow" role="row" key={row.tab}><span>{row.tab}</span><span>{row.readModel}</span><span>{row.fetcher}</span><span>{row.sourceContract}</span><span>{row.backendChangedByH60 ? "true" : "false"}</span></div>)}
      </div>
    </article>
  );
}
