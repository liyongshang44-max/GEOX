// apps/web/src/features/operator/replayDemo/ReplayDemoStandardsPanel.tsx
// Purpose: render standards mapping evidence chain.
// Boundary: standards mapping is replay evidence mapping and not external certification.

import React from "react";
import { localizedText, useLocale } from "../../../lib/locale";
import { OPERATOR_FORMAL_SURFACE_COPY } from "../../../lib/productSurfaceLabels";
import { REPLAY_DEMO_COPY, replayText } from "./replayDemoLocaleCopy";
import { type ReplayDemoViewModel } from "./replayDemoViewModel";

type ReplayDemoStandardsPanelProps = {
  vm: ReplayDemoViewModel;
};

const replayCopy = OPERATOR_FORMAL_SURFACE_COPY.replayDemo;

export default function ReplayDemoStandardsPanel({ vm }: ReplayDemoStandardsPanelProps): React.ReactElement {
  const { locale } = useLocale();
  return (
    <section className="operatorReplayDemo__panel" aria-label={localizedText(replayCopy.panels.standardsMapping, locale)}>
      <div className="operatorReplayDemo__panelHeader"><p className="operatorReplayDemo__eyebrow">{localizedText(replayCopy.panels.standardsMapping, locale)}</p><h2>{localizedText(replayCopy.panels.standardsMapping, locale)}</h2></div>
      <p>{replayText(locale, REPLAY_DEMO_COPY.panels.standardsLead)}</p>
      <div className="operatorReplayDemo__table">
        <div className="operatorReplayDemo__tableHeader"><span>{locale === "en-US" ? "Layer" : "层级"}</span><span>{localizedText(replayCopy.table.value, locale)}</span></div>
        {vm.standardsMapping.rows.map((row) => <div className="operatorReplayDemo__tableRow" key={row.label}><span data-locale-neutral="true">{row.label}</span><span data-locale-neutral="true">{row.value}</span></div>)}
      </div>
    </section>
  );
}
