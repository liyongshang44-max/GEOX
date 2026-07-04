// apps/web/src/features/operator/fieldRuntime/FieldRuntimeResponseDeltaPanel.tsx
// Purpose: render H60-H Response Delta from read-only verification data.
// Boundary: expected-response metadata is not automatic acceptance, ROI, or Field Memory trigger.

import React from "react";
import { type FieldRuntimeResidualViewModel } from "./fieldRuntimeResidualAdapter";

type FieldRuntimeResponseDeltaPanelProps = {
  residual: FieldRuntimeResidualViewModel;
};

export default function FieldRuntimeResponseDeltaPanel({ residual }: FieldRuntimeResponseDeltaPanelProps): React.ReactElement {
  const delta = residual.responseDelta;
  return (
    <article className="operatorFieldRuntime__panel operatorFieldRuntime__responseDelta" data-h60h-panel="response-delta">
      <div className="operatorFieldRuntime__panelHeader">
        <div>
          <p className="operatorFieldRuntime__eyebrow">Response Delta</p>
          <h2 className="operatorFieldRuntime__panelTitle">Response Delta</h2>
        </div>
        <span className="operatorFieldRuntime__panelMeta">Verification metadata</span>
      </div>
      <p className="operatorFieldRuntime__stubLead">Meets expected response is verification metadata, not automatic acceptance.</p>
      <div className="operatorFieldRuntime__metricGrid">
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Status</p><strong>{delta.statusText}</strong></section>
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Delta Direction</p><strong>{delta.deltaDirection}</strong></section>
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Delta Value</p><strong>{delta.deltaValue}</strong></section>
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Meets expected response</p><strong>{delta.meetsExpectedResponse}</strong></section>
        <section className="operatorFieldRuntime__metricCard"><p className="operatorFieldRuntime__panelMeta">Reason Codes</p><strong>{delta.reasonCodes.join(", ") || "None"}</strong></section>
      </div>
    </article>
  );
}
