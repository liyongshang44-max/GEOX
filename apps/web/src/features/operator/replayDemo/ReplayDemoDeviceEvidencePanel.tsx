// apps/web/src/features/operator/replayDemo/ReplayDemoDeviceEvidencePanel.tsx
// Purpose: render device evidence package rows.
// Boundary: device evidence package is snapshot metadata and is not Runtime Health v1 or live device status.

import React from "react";
import { localizedText, useLocale } from "../../../lib/locale";
import { OPERATOR_FORMAL_SURFACE_COPY } from "../../../lib/productSurfaceLabels";
import { type ReplayDemoViewModel } from "./replayDemoViewModel";

type ReplayDemoDeviceEvidencePanelProps = {
  vm: ReplayDemoViewModel;
};

const replayCopy = OPERATOR_FORMAL_SURFACE_COPY.replayDemo;

export default function ReplayDemoDeviceEvidencePanel({ vm }: ReplayDemoDeviceEvidencePanelProps): React.ReactElement {
  const { locale } = useLocale();
  return (
    <section className="operatorReplayDemo__panel" aria-label={localizedText(replayCopy.panels.deviceEvidence, locale)}>
      <div className="operatorReplayDemo__panelHeader"><p className="operatorReplayDemo__eyebrow">{localizedText(replayCopy.panels.deviceEvidence, locale)}</p><h2>{localizedText(replayCopy.panels.deviceEvidence, locale)}</h2></div>
      <p>{locale === "en-US" ? "Device evidence package is snapshot metadata. It is not Runtime Health v1. It is not live device status." : "设备证据包是快照元数据，不是 Runtime Health v1，也不是实时设备状态。"}</p>
      <div className="operatorReplayDemo__table">
        <div className="operatorReplayDemo__tableHeader"><span>{locale === "en-US" ? "Device" : "设备"}</span><span>{localizedText(replayCopy.table.metadata, locale)}</span><span>{localizedText(replayCopy.table.status, locale)}</span></div>
        {vm.deviceEvidence.rows.map((row) => <div className="operatorReplayDemo__tableRow" key={row.label}><span>{row.label}</span><span>{row.value}</span><span>{row.metadataStatus || "metadata_only"}</span></div>)}
      </div>
    </section>
  );
}
