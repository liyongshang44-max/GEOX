// apps/web/src/features/operator/replayDemo/ReplayDemoHashesPanel.tsx
// Purpose: render H61 hash metadata as a dedicated Replay Demo panel.
// Boundary: hashes are snapshot metadata only.

import React from "react";
import { useLocale } from "../../../lib/locale";
import { REPLAY_DEMO_COPY, replayMetadataStatus, replayText } from "./replayDemoLocaleCopy";
import { type ReplayDemoViewModel } from "./replayDemoViewModel";

type ReplayDemoHashesPanelProps = {
  vm: ReplayDemoViewModel;
};

export default function ReplayDemoHashesPanel({ vm }: ReplayDemoHashesPanelProps): React.ReactElement {
  const { locale } = useLocale();
  const t = (copy: { zh: string; en: string }) => replayText(locale, copy);
  return (
    <section className="operatorReplayDemo__panel operatorReplayDemo__hashes" aria-label={t(REPLAY_DEMO_COPY.panels.hashesAria)}>
      <div className="operatorReplayDemo__panelHeader"><p className="operatorReplayDemo__eyebrow">{t(REPLAY_DEMO_COPY.panels.hashesTitle)}</p><h2>{t(REPLAY_DEMO_COPY.panels.hashesTitle)}</h2></div>
      <p>{t(REPLAY_DEMO_COPY.panels.hashesLead)}</p>
      <div className="operatorReplayDemo__table">
        <div className="operatorReplayDemo__tableHeader"><span>{t(REPLAY_DEMO_COPY.common.label)}</span><span>{t(REPLAY_DEMO_COPY.common.value)}</span><span>{t(REPLAY_DEMO_COPY.common.metadata)}</span></div>
        {vm.hashes.rows.map((row) => <div className="operatorReplayDemo__tableRow" key={row.label}><span data-locale-neutral="true">{row.label}</span><span data-locale-neutral="true">{row.value}</span><span>{replayMetadataStatus(locale, row.metadataStatus)}</span></div>)}
      </div>
    </section>
  );
}
