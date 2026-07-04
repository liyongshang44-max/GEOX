// apps/web/src/features/operator/fieldRuntime/FieldRuntimeHealthModePanel.tsx
// Purpose: render the H62 Runtime Mode matrix.
// Boundary: values are explicit replay/nonclaim labels, not runtime connectivity assertions.

import React from "react";
import { type FieldRuntimeHealthViewModel } from "./fieldRuntimeHealthAdapter";

type FieldRuntimeHealthModePanelProps = {
  health: FieldRuntimeHealthViewModel;
};

export default function FieldRuntimeHealthModePanel({ health }: FieldRuntimeHealthModePanelProps): React.ReactElement {
  const rows = [
    ["Runtime Mode", "Replay-backed Demo"],
    ["Health Mode", "Replay-backed Health Review"],
    ["Read-only", health.boundary.readOnly ? "true" : "false"],
    ["Live Device", "Not connected"],
    ["Production Gateway", "Not online"],
    ["Field Pilot", "Not started"],
    ["AO-ACT Dispatch", "Disabled"],
  ];
  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__healthMode" data-h62-panel="runtime-mode">
      <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">Runtime Health</p><h2 className="operatorFieldRuntime__panelTitle">Runtime Mode</h2></div><span className="operatorFieldRuntime__panelMeta">mode: {health.mode}</span></div>
      <div className="operatorFieldRuntime__healthTable" role="table" aria-label="Runtime mode matrix">
        <div className="operatorFieldRuntime__healthTableHeader" role="row"><span>Label</span><span>Value</span></div>
        {rows.map(([label, value]) => <div className="operatorFieldRuntime__healthTableRow" role="row" key={label}><span>{label}</span><span>{value}</span></div>)}
      </div>
    </article>
  );
}
