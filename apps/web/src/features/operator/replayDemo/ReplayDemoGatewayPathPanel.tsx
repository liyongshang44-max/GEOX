// apps/web/src/features/operator/replayDemo/ReplayDemoGatewayPathPanel.tsx
// Purpose: render gateway path replay rows.
// Boundary: gateway path rows are snapshot metadata and not live device counts.

import React from "react";
import { ProductHorizontalScrollRegion } from "../../../design-system/product";
import { localizedText, useLocale } from "../../../lib/locale";
import { OPERATOR_FORMAL_SURFACE_COPY } from "../../../lib/productSurfaceLabels";
import { REPLAY_DEMO_COPY, replayMetadataStatus, replayText } from "./replayDemoLocaleCopy";
import { type ReplayDemoViewModel } from "./replayDemoViewModel";

type ReplayDemoGatewayPathPanelProps = { vm: ReplayDemoViewModel };
const replayCopy = OPERATOR_FORMAL_SURFACE_COPY.replayDemo;

export default function ReplayDemoGatewayPathPanel({ vm }: ReplayDemoGatewayPathPanelProps): React.ReactElement {
  const { locale } = useLocale();
  const regionLabel = localizedText(replayCopy.panels.gatewayPath, locale);
  return (
    <section className="operatorReplayDemo__panel" aria-label={regionLabel}>
      <div className="operatorReplayDemo__panelHeader"><p className="operatorReplayDemo__eyebrow">{regionLabel}</p><h2>{regionLabel}</h2></div>
      <p>{replayText(locale, REPLAY_DEMO_COPY.panels.gatewayPathLead)}</p>
      <ProductHorizontalScrollRegion ariaLabel={regionLabel} overflowOwner="operator-replay-gateway-path">
        <div className="operatorReplayDemo__table">
          <div className="operatorReplayDemo__tableHeader"><span>{localizedText(replayCopy.table.label, locale)}</span><span>{localizedText(replayCopy.table.value, locale)}</span><span>{localizedText(replayCopy.table.metadata, locale)}</span></div>
          {vm.gatewayPath.rows.map((row) => <div className="operatorReplayDemo__tableRow" key={row.label}><span data-locale-neutral="true" data-long-token="true">{row.label}</span><span data-locale-neutral="true" data-long-token="true">{row.value}</span><span>{replayMetadataStatus(locale, row.metadataStatus)}</span></div>)}
        </div>
      </ProductHorizontalScrollRegion>
    </section>
  );
}
