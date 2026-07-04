// apps/web/src/features/operator/fieldRuntime/FieldRuntimeHealthReadModelPanel.tsx
// Purpose: render H62 read model availability metadata.

import React from "react";
import { type FieldRuntimeHealthViewModel } from "./fieldRuntimeHealthAdapter";

type FieldRuntimeHealthReadModelPanelProps = {
  health: FieldRuntimeHealthViewModel;
};

export default function FieldRuntimeHealthReadModelPanel({ health }: FieldRuntimeHealthReadModelPanelProps): React.ReactElement {
  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__healthReadModels" data-h62-panel="read-model-availability">
      <div className="operatorFieldRuntime__panelHeader"><div><p className="operatorFieldRuntime__eyebrow">Read Model Availability</p><h2 className="operatorFieldRuntime__panelTitle">Read Model Availability</h2></div><span className="operatorFieldRuntime__panelMeta">UI/read-model availability</span></div>
      <p className="operatorFieldRuntime__stubLead">Read model availability is UI/read-model availability, not production health.</p>
      <div className="operatorFieldRuntime__healthTable" role="table" aria-label="Read model availability matrix">
        <div className="operatorFieldRuntime__healthTableHeader" role="row"><span>Tab</span><span>Read model</span><span>Status</span><span>Backend changed by H62</span></div>
        {health.readModelAvailability.map((row) => <div className="operatorFieldRuntime__healthTableRow" role="row" key={row.tab}><span>{row.tab}</span><span>{row.readModel}</span><span>{row.status}</span><span>{row.backendChangedByH62 ? "true" : "false"}</span></div>)}
      </div>
    </article>
  );
}
