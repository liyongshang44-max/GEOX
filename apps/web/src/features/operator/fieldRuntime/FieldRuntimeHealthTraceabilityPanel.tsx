// apps/web/src/features/operator/fieldRuntime/FieldRuntimeHealthTraceabilityPanel.tsx
// Purpose: render H62 traceability availability metadata.

import React from "react";
import { Link } from "react-router-dom";
import { type FieldRuntimeHealthViewModel } from "./fieldRuntimeHealthAdapter";

type FieldRuntimeHealthTraceabilityPanelProps = {
  health: FieldRuntimeHealthViewModel;
};

export default function FieldRuntimeHealthTraceabilityPanel({ health }: FieldRuntimeHealthTraceabilityPanelProps): React.ReactElement {
  const traceability = health.traceability;
  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__healthTraceability" data-h62-panel="traceability">
      <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">Traceability Availability</p><h2 className="operatorFieldRuntime__panelTitle">Traceability Availability</h2></div><span className="operatorFieldRuntime__panelMeta">createsTrace=false</span></div>
      <p className="operatorFieldRuntime__stubLead">Traceability availability is navigation/readback metadata. It does not create trace records.</p>
      <div className="operatorFieldRuntime__healthTable" role="table" aria-label="Traceability availability matrix">
        <div className="operatorFieldRuntime__healthTableHeader" role="row"><span>Audit route</span><span>Replay Demo route</span><span>Bridge available</span><span>createsTrace</span></div>
        <div className="operatorFieldRuntime__healthTableRow" role="row"><span>{traceability.fieldRuntimeAuditRoute}</span><span><Link to={traceability.replayDemoRoute}>Replay Demo only</Link></span><span>{traceability.traceReadbackBridgeAvailable ? "true" : "false"}</span><span>{traceability.createsTrace ? "true" : "false"}</span></div>
      </div>
    </article>
  );
}
