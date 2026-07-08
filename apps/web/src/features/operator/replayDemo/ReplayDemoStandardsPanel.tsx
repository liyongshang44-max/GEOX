// apps/web/src/features/operator/replayDemo/ReplayDemoStandardsPanel.tsx
// Purpose: render standards mapping evidence chain.
// Boundary: standards mapping is replay evidence mapping and not external certification.

import React from "react";
import { ProductHorizontalScrollRegion } from "../../../design-system/product";
import { localizedText, useLocale } from "../../../lib/locale";
import { OPERATOR_FORMAL_SURFACE_COPY } from "../../../lib/productSurfaceLabels";
import { REPLAY_DEMO_COPY, replayText } from "./replayDemoLocaleCopy";
import { type ReplayDemoViewModel } from "./replayDemoViewModel";

type ReplayDemoStandardsPanelProps = { vm: ReplayDemoViewModel };
const replayCopy = OPERATOR_FORMAL_SURFACE_COPY.replayDemo;

export default function ReplayDemoStandardsPanel({ vm }: ReplayDemoStandardsPanelProps): React.ReactElement {
  const { locale } = useLocale();
  const regionLabel = localizedText(replayCopy.panels.standardsMapping, locale);
  return (
    <section className="operatorReplayDemo__panel" aria-label={regionLabel}>
      <div className="operatorReplayDemo__panelHeader"><p className="operatorReplayDemo__eyebrow">{regionLabel}</p><h2>{regionLabel}</h2></div>
      <p>{replayText(locale, REPLAY_DEMO_COPY.panels.standardsLead)}</p>
      <ProductHorizontalScrollRegion ariaLabel={regionLabel} overflowOwner="operator-replay-standards">
        <div className="operatorReplayDemo__table">
          <div className="operatorReplayDemo__tableHeader"><span>{locale === "en-US" ? "Layer" : "层级"}</span><span>{localizedText(replayCopy.table.value, locale)}</span></div>
          {vm.standardsMapping.rows.map((row) => <div className="operatorReplayDemo__tableRow" key={row.label}><span data-locale-neutral="true" data-long-token="true">{row.label}</span><span data-locale-neutral="true" data-long-token="true">{row.value}</span></div>)}
        </div>
      </ProductHorizontalScrollRegion>
    </section>
  );
}
