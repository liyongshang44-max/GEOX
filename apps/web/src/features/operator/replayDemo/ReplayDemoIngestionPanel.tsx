// apps/web/src/features/operator/replayDemo/ReplayDemoIngestionPanel.tsx
// Purpose: render H61 duplicate handling, clock skew, and ingestion window rows.
// Boundary: blocked and warn counts are metadata labels only and not business risk colors.

import React from "react";
import { ProductHorizontalScrollRegion } from "../../../design-system/product";
import { useLocale } from "../../../lib/locale";
import { REPLAY_DEMO_COPY, replayMetadataStatus, replayText } from "./replayDemoLocaleCopy";
import { type ReplayDemoViewModel } from "./replayDemoViewModel";

type ReplayDemoIngestionPanelProps = { vm: ReplayDemoViewModel };

export default function ReplayDemoIngestionPanel({ vm }: ReplayDemoIngestionPanelProps): React.ReactElement {
  const { locale } = useLocale();
  const t = (copy: { zh: string; en: string }) => replayText(locale, copy);
  const regionLabel = t(REPLAY_DEMO_COPY.panels.ingestionAria);
  return (
    <section className="operatorReplayDemo__panel" aria-label={regionLabel}>
      <div className="operatorReplayDemo__panelHeader"><p className="operatorReplayDemo__eyebrow">{t(REPLAY_DEMO_COPY.panels.ingestionEyebrow)}</p><h2>{t(REPLAY_DEMO_COPY.panels.ingestionTitle)}</h2></div>
      <p>{t(REPLAY_DEMO_COPY.panels.ingestionLead)}</p>
      <ProductHorizontalScrollRegion ariaLabel={regionLabel} overflowOwner="operator-replay-ingestion">
        <div className="operatorReplayDemo__table">
          <div className="operatorReplayDemo__tableHeader"><span>{t(REPLAY_DEMO_COPY.common.label)}</span><span>{t(REPLAY_DEMO_COPY.common.value)}</span><span>{t(REPLAY_DEMO_COPY.common.metadata)}</span></div>
          {vm.ingestionWindow.rows.map((row) => <div className="operatorReplayDemo__tableRow" key={row.label}><span data-locale-neutral="true" data-long-token="true">{row.label}</span><span data-locale-neutral="true" data-long-token="true">{row.value}</span><span>{replayMetadataStatus(locale, row.metadataStatus)}</span></div>)}
        </div>
      </ProductHorizontalScrollRegion>
    </section>
  );
}
