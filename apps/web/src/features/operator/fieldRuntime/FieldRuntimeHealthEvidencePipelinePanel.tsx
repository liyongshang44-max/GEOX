// apps/web/src/features/operator/fieldRuntime/FieldRuntimeHealthEvidencePipelinePanel.tsx
// Purpose: render H62 evidence pipeline availability metadata.

import React from "react";
import { type FieldRuntimeHealthViewModel } from "./fieldRuntimeHealthAdapter";

type FieldRuntimeHealthEvidencePipelinePanelProps = {
  health: FieldRuntimeHealthViewModel;
};

export default function FieldRuntimeHealthEvidencePipelinePanel({ health }: FieldRuntimeHealthEvidencePipelinePanelProps): React.ReactElement {
  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__healthPipeline" data-h62-panel="evidence-pipeline">
      <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">Evidence Pipeline</p><h2 className="operatorFieldRuntime__panelTitle">Evidence Pipeline</h2></div><span className="operatorFieldRuntime__panelMeta">No write surface</span></div>
      <p className="operatorFieldRuntime__stubLead">Pipeline status is read-only availability metadata. No write surface.</p>
      <div className="operatorFieldRuntime__healthTable" role="table" aria-label="Evidence pipeline matrix">
        <div className="operatorFieldRuntime__healthTableHeader" role="row"><span>Stage</span><span>Source</span><span>Status</span><span>Write surface</span></div>
        {health.evidencePipeline.map((row) => <div className="operatorFieldRuntime__healthTableRow" role="row" key={row.stage}><span>{row.stage}</span><span>{row.source}</span><span>{row.status}</span><span>{row.writeSurface ? "true" : "false"}</span></div>)}
      </div>
    </article>
  );
}
