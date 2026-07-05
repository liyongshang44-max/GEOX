// apps/web/src/features/operator/replayDemo/ReplayDemoPage.tsx
// Purpose: load the checked-in gateway snapshot and render the replay-backed demo product surface.
// Boundary: this page uses static GET only and does not create runtime, gateway, trace, task, or action records.

import React from "react";
import { fetchP51GatewayViewerSnapshot } from "../../../api/operatorGatewayDemo";
import { localizedText, useLocale } from "../../../lib/locale";
import { OPERATOR_FORMAL_SURFACE_COPY } from "../../../lib/productSurfaceLabels";
import { buildReplayDemoViewModel, type ReplayDemoViewModel } from "./replayDemoViewModel";
import ReplayDemoBoundaryBanner from "./ReplayDemoBoundaryBanner";
import ReplayDemoBoundaryClaimsPanel from "./ReplayDemoBoundaryClaimsPanel";
import ReplayDemoDeviceEvidencePanel from "./ReplayDemoDeviceEvidencePanel";
import ReplayDemoGatewayPathPanel from "./ReplayDemoGatewayPathPanel";
import ReplayDemoHashesPanel from "./ReplayDemoHashesPanel";
import ReplayDemoHero from "./ReplayDemoHero";
import ReplayDemoIngestionPanel from "./ReplayDemoIngestionPanel";
import ReplayDemoNarrativePanel from "./ReplayDemoNarrativePanel";
import ReplayDemoSnapshotIdsPanel from "./ReplayDemoSnapshotIdsPanel";
import ReplayDemoSnapshotPanel from "./ReplayDemoSnapshotPanel";
import ReplayDemoStandardsPanel from "./ReplayDemoStandardsPanel";
import ReplayDemoTraceabilityPanel from "./ReplayDemoTraceabilityPanel";
import "../../../styles/operatorReplayDemo.css";

type ReplayDemoLoadState =
  | { status: "loading" }
  | { status: "ready"; vm: ReplayDemoViewModel }
  | { status: "error"; message: string };

const replayCopy = OPERATOR_FORMAL_SURFACE_COPY.replayDemo;

export default function ReplayDemoPage(): React.ReactElement {
  const { locale } = useLocale();
  const [state, setState] = React.useState<ReplayDemoLoadState>({ status: "loading" });

  React.useEffect(() => {
    let cancelled = false;
    fetchP51GatewayViewerSnapshot()
      .then((snapshot) => {
        if (!cancelled) setState({ status: "ready", vm: buildReplayDemoViewModel(snapshot) });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: "error", message: error instanceof Error ? error.message : "snapshot unavailable" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return <main className="operatorReplayDemo"><section className="operatorReplayDemo__panel"><h1 className="operatorReplayDemo__title">{localizedText(replayCopy.title, locale)}</h1><p>{localizedText(replayCopy.loading, locale)}</p></section></main>;
  }

  if (state.status === "error") {
    return <main className="operatorReplayDemo"><section className="operatorReplayDemo__panel"><h1 className="operatorReplayDemo__title">{localizedText(replayCopy.title, locale)}</h1><p>{localizedText(replayCopy.unavailable, locale)}: {state.message}</p><p>{localizedText(replayCopy.staticRequired, locale)}</p></section></main>;
  }

  const vm = state.vm;
  return (
    <main className="operatorReplayDemo" data-h61="replay-demo-productization" data-route={vm.route} data-mode={vm.mode}>
      <ReplayDemoHero vm={vm} />
      <ReplayDemoBoundaryBanner />
      <ReplayDemoNarrativePanel vm={vm} />
      <section className="operatorReplayDemo__grid" aria-label={locale === "en-US" ? "Replay demo sections with hashes and evidence refs" : "回放演示区块，包含哈希与证据引用"}>
        <ReplayDemoSnapshotPanel vm={vm} />
        <ReplayDemoGatewayPathPanel vm={vm} />
        <ReplayDemoStandardsPanel vm={vm} />
        <ReplayDemoDeviceEvidencePanel vm={vm} />
        <ReplayDemoIngestionPanel vm={vm} />
        <ReplayDemoTraceabilityPanel vm={vm} />
        <ReplayDemoHashesPanel vm={vm} />
        <ReplayDemoSnapshotIdsPanel items={vm.evidenceRefs} />
        <ReplayDemoBoundaryClaimsPanel vm={vm} />
      </section>
    </main>
  );
}
