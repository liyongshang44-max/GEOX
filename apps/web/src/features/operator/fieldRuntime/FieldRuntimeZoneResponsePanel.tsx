// apps/web/src/features/operator/fieldRuntime/FieldRuntimeZoneResponsePanel.tsx
// Purpose: render H60-H Zone Response rows from read-only verification data.
// Boundary: zone response is verification row display only and is not a zone prescription or next irrigation advice.

import React from "react";
import { type FieldRuntimeResidualViewModel } from "./fieldRuntimeResidualAdapter";

type FieldRuntimeZoneResponsePanelProps = {
  residual: FieldRuntimeResidualViewModel;
};

export default function FieldRuntimeZoneResponsePanel({ residual }: FieldRuntimeZoneResponsePanelProps): React.ReactElement {
  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__zoneResponse" data-h60h-panel="zone-response">
      <div className="operatorFieldRuntime__panelHeader">
        <div>
          <p className="operatorFieldRuntime__eyebrow">Zone Response</p>
          <h2 className="operatorFieldRuntime__panelTitle">Zone Response</h2>
        </div>
        <span className="operatorFieldRuntime__panelMeta">{residual.zoneResponse.rows.length} rows</span>
      </div>
      <p className="operatorFieldRuntime__stubLead">Zone Response is verification row display, not a zone prescription.</p>
      <div className="operatorFieldRuntime__residualTable" role="table" aria-label="Field Runtime zone response">
        <div className="operatorFieldRuntime__residualTableHeader" role="row"><span>Zone ID</span><span>Status</span><span>Delta Value</span></div>
        {residual.zoneResponse.rows.length === 0 ? <div className="operatorFieldRuntime__residualTableRow" role="row"><span>No zone response rows returned.</span><span>Not available</span><span>Not available</span></div> : null}
        {residual.zoneResponse.rows.map((row) => (
          <div className="operatorFieldRuntime__residualTableRow" role="row" key={row.zoneId}>
            <span>{row.zoneId}</span>
            <span>{row.statusText}</span>
            <span>{row.deltaValue}</span>
          </div>
        ))}
      </div>
    </article>
  );
}
