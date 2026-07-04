// apps/web/src/features/operator/fieldRuntime/FieldRuntimeTraceReadbackBridgePanel.tsx
// Purpose: render the H60-K trace readback bridge to the existing Twin Trace Readback surface.
// Boundary: this panel only links; it does not fetch trace data or render raw readback content.

import React from "react";
import { Link } from "react-router-dom";
import { type FieldRuntimeAuditViewModel } from "./fieldRuntimeAuditAdapter";

type FieldRuntimeTraceReadbackBridgePanelProps = {
  audit: FieldRuntimeAuditViewModel;
};

export default function FieldRuntimeTraceReadbackBridgePanel({ audit }: FieldRuntimeTraceReadbackBridgePanelProps): React.ReactElement {
  const bridge = audit.traceBridge;
  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__traceBridge" data-h60k-panel="trace-readback-bridge">
      <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">Audit</p><h2 className="operatorFieldRuntime__panelTitle">Trace Readback Bridge</h2></div><span className="operatorFieldRuntime__panelMeta">Bridge only</span></div>
      <p className="operatorFieldRuntime__stubLead">Trace Readback Bridge only.</p>
      <p className="operatorFieldRuntime__stubLead">Full trace readback remains in existing Twin Trace Readback surface.</p>
      <p className="operatorFieldRuntime__stubLead">Audit tab does not replace Twin Trace Readback.</p>
      <p className="operatorFieldRuntime__panelMeta">decision_cycle_id: {bridge.hasDecisionCycleId ? bridge.decisionCycleId : "No decision_cycle_id provided"}</p>
      {bridge.hasDecisionCycleId ? <Link className="operatorFieldRuntime__tab" to={bridge.traceReadbackPath}>Open existing Twin Trace Readback</Link> : null}
      <p className="operatorFieldRuntime__panelMeta">{bridge.traceReadbackPath || "/operator/twin/traces/:decisionCycleId"}</p>
    </article>
  );
}
