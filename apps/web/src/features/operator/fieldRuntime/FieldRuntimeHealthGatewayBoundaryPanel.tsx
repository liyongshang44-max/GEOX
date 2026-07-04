// apps/web/src/features/operator/fieldRuntime/FieldRuntimeHealthGatewayBoundaryPanel.tsx
// Purpose: render H62 gateway snapshot boundary metadata.
// Boundary: gateway demo remains replay-backed and checked-in snapshot based.

import React from "react";
import { Link } from "react-router-dom";
import { type FieldRuntimeHealthViewModel } from "./fieldRuntimeHealthAdapter";

type FieldRuntimeHealthGatewayBoundaryPanelProps = {
  health: FieldRuntimeHealthViewModel;
};

export default function FieldRuntimeHealthGatewayBoundaryPanel({ health }: FieldRuntimeHealthGatewayBoundaryPanelProps): React.ReactElement {
  const gateway = health.gatewayBoundary;
  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__healthGatewayBoundary" data-h62-panel="gateway-boundary">
      <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">Gateway Snapshot Boundary</p><h2 className="operatorFieldRuntime__panelTitle">Gateway Snapshot Boundary</h2></div><span className="operatorFieldRuntime__panelMeta">{gateway.gatewaySource}</span></div>
      <p className="operatorFieldRuntime__stubLead">Gateway Demo is replay-backed.</p>
      <p className="operatorFieldRuntime__stubLead">Gateway Demo is not production gateway online.</p>
      <p className="operatorFieldRuntime__stubLead">Gateway Demo is not Runtime Health telemetry.</p>
      <div className="operatorFieldRuntime__healthTable" role="table" aria-label="Gateway boundary matrix">
        <div className="operatorFieldRuntime__healthTableHeader" role="row"><span>Route</span><span>Source</span><span>liveGatewayClaimed</span><span>productionGatewayOnlineClaimed</span></div>
        <div className="operatorFieldRuntime__healthTableRow" role="row"><span><Link to={gateway.replayDemoRoute}>Replay Demo only</Link></span><span>{gateway.gatewaySource}</span><span>{gateway.liveGatewayClaimed ? "true" : "false"}</span><span>{gateway.productionGatewayOnlineClaimed ? "true" : "false"}</span></div>
      </div>
    </article>
  );
}
