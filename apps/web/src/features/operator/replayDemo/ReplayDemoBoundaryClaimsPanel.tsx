// apps/web/src/features/operator/replayDemo/ReplayDemoBoundaryClaimsPanel.tsx
// Purpose: render H61 replay demo boundary claims as a dedicated bilingual panel.
// Boundary: values describe demo scope only.

import React from "react";
import { useLocale } from "../../../lib/locale";
import { REPLAY_DEMO_COPY, replayBoolean, replayClaimLabel, replayClaimMeaning, replayText } from "./replayDemoLocaleCopy";
import { type ReplayDemoViewModel } from "./replayDemoViewModel";

type ReplayDemoBoundaryClaimsPanelProps = {
  vm: ReplayDemoViewModel;
};

export default function ReplayDemoBoundaryClaimsPanel({ vm }: ReplayDemoBoundaryClaimsPanelProps): React.ReactElement {
  const { locale } = useLocale();
  const t = (copy: { zh: string; en: string }) => replayText(locale, copy);

  return (
    <section className="operatorReplayDemo__panel operatorReplayDemo__boundaryClaims" aria-label={t(REPLAY_DEMO_COPY.boundaryClaims.aria)}>
      <div className="operatorReplayDemo__panelHeader"><p className="operatorReplayDemo__eyebrow">{t(REPLAY_DEMO_COPY.boundaryClaims.title)}</p><h2>{t(REPLAY_DEMO_COPY.boundaryClaims.title)}</h2></div>
      <div className="operatorReplayDemo__table">
        <div className="operatorReplayDemo__tableHeader"><span>{t(REPLAY_DEMO_COPY.boundaryClaims.claim)}</span><span>{t(REPLAY_DEMO_COPY.boundaryClaims.value)}</span><span>{t(REPLAY_DEMO_COPY.boundaryClaims.meaning)}</span></div>
        {vm.nonclaims.map((row) => <div className="operatorReplayDemo__tableRow" key={row.label}><span>{replayClaimLabel(locale, row.label)}<small data-locale-neutral="true">{row.label}</small></span><span>{replayBoolean(locale, row.value)}</span><span>{replayClaimMeaning(locale, row.label)}</span></div>)}
      </div>
    </section>
  );
}
