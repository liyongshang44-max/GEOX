// apps/web/src/features/operator/replayDemo/ReplayDemoTraceabilityPanel.tsx
// Purpose: render traceability readback metadata as a dedicated Replay Demo panel.
// Boundary: this panel displays checked-in snapshot metadata and does not create trace records.

import React from "react";
import { localizedText, useLocale } from "../../../lib/locale";
import { OPERATOR_FORMAL_SURFACE_COPY } from "../../../lib/productSurfaceLabels";
import { type ReplayDemoViewModel } from "./replayDemoViewModel";

type ReplayDemoTraceabilityPanelProps = {
  vm: ReplayDemoViewModel;
};

const replayCopy = OPERATOR_FORMAL_SURFACE_COPY.replayDemo;

export default function ReplayDemoTraceabilityPanel({ vm }: ReplayDemoTraceabilityPanelProps): React.ReactElement {
  const { locale } = useLocale();
  return (
    <section className="operatorReplayDemo__panel operatorReplayDemo__traceability" aria-label={localizedText(replayCopy.panels.traceability, locale)}>
      <div className="operatorReplayDemo__panelHeader"><p className="operatorReplayDemo__eyebrow">{localizedText(replayCopy.panels.traceability, locale)}</p><h2>{localizedText(replayCopy.panels.traceability, locale)}</h2></div>
      <p>{vm.traceability.lead}</p>
      <div className="operatorReplayDemo__table">
        <div className="operatorReplayDemo__tableHeader"><span>{localizedText(replayCopy.table.label, locale)}</span><span>{localizedText(replayCopy.table.metadata, locale)}</span><span>{localizedText(replayCopy.table.status, locale)}</span></div>
        {vm.traceability.rows.map((row) => <div className="operatorReplayDemo__tableRow" key={row.label}><span>{row.label}</span><span>{row.value}</span><span>{row.metadataStatus || "metadata_only"}</span></div>)}
      </div>
    </section>
  );
}
