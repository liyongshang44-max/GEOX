// apps/web/src/features/operator/replayDemo/ReplayDemoDeviceEvidencePanel.tsx
// Purpose: render device evidence package rows.
// Boundary: device evidence package is snapshot metadata and is not Runtime Health v1 or live device status.

import React from "react";
import { ProductHorizontalScrollRegion } from "../../../design-system/product";
import { localizedText, useLocale } from "../../../lib/locale";
import { OPERATOR_FORMAL_SURFACE_COPY } from "../../../lib/productSurfaceLabels";
import { REPLAY_DEMO_COPY, replayMetadataStatus, replayText } from "./replayDemoLocaleCopy";
import { type ReplayDemoViewModel } from "./replayDemoViewModel";

type ReplayDemoDeviceEvidencePanelProps = { vm: ReplayDemoViewModel };
const replayCopy = OPERATOR_FORMAL_SURFACE_COPY.replayDemo;

export default function ReplayDemoDeviceEvidencePanel({ vm }: ReplayDemoDeviceEvidencePanelProps): React.ReactElement {
  const { locale } = useLocale();
  const regionLabel = localizedText(replayCopy.panels.deviceEvidence, locale);
  return (
    <section className="operatorReplayDemo__panel" aria-label={regionLabel}>
      <div className="operatorReplayDemo__panelHeader"><p className="operatorReplayDemo__eyebrow">{regionLabel}</p><h2>{regionLabel}</h2></div>
      <p>{replayText(locale, REPLAY_DEMO_COPY.panels.deviceLead)}</p>
      <ProductHorizontalScrollRegion ariaLabel={regionLabel} overflowOwner="operator-replay-device-evidence">
        <div className="operatorReplayDemo__table">
          <div className="operatorReplayDemo__tableHeader"><span>{locale === "en-US" ? "Device" : "设备"}</span><span>{localizedText(replayCopy.table.metadata, locale)}</span><span>{localizedText(replayCopy.table.status, locale)}</span></div>
          {vm.deviceEvidence.rows.map((row) => <div className="operatorReplayDemo__tableRow" key={row.label}><span data-locale-neutral="true" data-long-token="true">{row.label}</span><span data-locale-neutral="true" data-long-token="true">{row.value}</span><span>{replayMetadataStatus(locale, row.metadataStatus)}</span></div>)}
        </div>
      </ProductHorizontalScrollRegion>
    </section>
  );
}
