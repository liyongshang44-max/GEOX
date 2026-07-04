// apps/web/src/features/operator/fieldRuntime/FieldRuntimePrePostStatePanel.tsx
// Purpose: render H60-H Pre/Post State comparison from read-only verification data.
// Boundary: pre/post difference is verification evidence only and does not claim causality.

import React from "react";
import { type FieldRuntimeResidualViewModel, type FieldRuntimeStateSnapshotViewModel } from "./fieldRuntimeResidualAdapter";

type FieldRuntimePrePostStatePanelProps = {
  residual: FieldRuntimeResidualViewModel;
};

function SnapshotCard({ label, snapshot }: { label: string; snapshot: FieldRuntimeStateSnapshotViewModel }): React.ReactElement {
  return (
    <section className="operatorFieldRuntime__metricCard">
      <p className="operatorFieldRuntime__panelMeta">{label}</p>
      <strong>{snapshot.waterState}</strong>
      <span>available: {snapshot.available === null ? "unknown" : snapshot.available ? "true" : "false"}</span>
      <span>observed at: {snapshot.observedAt}</span>
      <span>soil moisture value: {snapshot.soilMoistureValue}</span>
    </section>
  );
}

export default function FieldRuntimePrePostStatePanel({ residual }: FieldRuntimePrePostStatePanelProps): React.ReactElement {
  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__prePostState" data-h60h-panel="pre-post-state">
      <div className="operatorFieldRuntime__panelHeader">
        <div>
          <p className="operatorFieldRuntime__eyebrow">Pre/Post State</p>
          <h2 className="operatorFieldRuntime__panelTitle">Pre/Post State</h2>
        </div>
        <span className="operatorFieldRuntime__panelMeta">State compare only</span>
      </div>
      <p className="operatorFieldRuntime__stubLead">Pre/Post State is verification evidence, not causal proof.</p>
      <div className="operatorFieldRuntime__metricGrid">
        <SnapshotCard label="Pre-irrigation state" snapshot={residual.prePostState.pre} />
        <SnapshotCard label="Post-irrigation state" snapshot={residual.prePostState.post} />
      </div>
    </article>
  );
}
