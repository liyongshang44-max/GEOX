// apps/web/src/features/operator/fieldRuntime/FieldRuntimeHealthSourcePanel.tsx
// Purpose: render H62 source freshness metadata.
// Boundary: source freshness is metadata, not live heartbeat or device uptime.

import React from "react";
import { type FieldRuntimeHealthViewModel } from "./fieldRuntimeHealthAdapter";

type FieldRuntimeHealthSourcePanelProps = {
  health: FieldRuntimeHealthViewModel;
};

export default function FieldRuntimeHealthSourcePanel({ health }: FieldRuntimeHealthSourcePanelProps): React.ReactElement {
  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__healthSource" data-h62-panel="source-freshness">
      <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">Source Freshness</p><h2 className="operatorFieldRuntime__panelTitle">Source Freshness</h2></div><span className="operatorFieldRuntime__panelMeta">metadata only</span></div>
      <p className="operatorFieldRuntime__stubLead">Source Freshness is metadata, not live freshness.</p>
      <div className="operatorFieldRuntime__healthTable" role="table" aria-label="Source freshness matrix">
        <div className="operatorFieldRuntime__healthTableHeader" role="row"><span>Source</span><span>Availability</span><span>Meaning</span><span>Does not mean</span></div>
        {health.sourceFreshness.map((row) => <div className="operatorFieldRuntime__healthTableRow" role="row" key={row.source}><span>{row.source}</span><span>{row.availability}</span><span>{row.freshnessMeaning}</span><span>{row.doesNotMean}</span></div>)}
      </div>
    </article>
  );
}
