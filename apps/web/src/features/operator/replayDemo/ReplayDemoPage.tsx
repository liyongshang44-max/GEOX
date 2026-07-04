// apps/web/src/features/operator/replayDemo/ReplayDemoPage.tsx
// Purpose: load the checked-in P51 gateway snapshot and render the H61 replay-backed demo product surface.
// Boundary: this page uses static GET only and does not create runtime, gateway, trace, task, or action records.

import React from "react";
import { fetchP51GatewayViewerSnapshot } from "../../../api/operatorGatewayDemo";
import { buildReplayDemoViewModel, type ReplayDemoViewModel } from "./replayDemoViewModel";
import ReplayDemoBoundaryBanner from "./ReplayDemoBoundaryBanner";
import ReplayDemoDeviceEvidencePanel from "./ReplayDemoDeviceEvidencePanel";
import ReplayDemoEvidenceRefsPanel from "./ReplayDemoEvidenceRefsPanel";
import ReplayDemoGatewayPathPanel from "./ReplayDemoGatewayPathPanel";
import ReplayDemoHashesPanel from "./ReplayDemoHashesPanel";
import ReplayDemoHero from "./ReplayDemoHero";
import ReplayDemoIngestionPanel from "./ReplayDemoIngestionPanel";
import ReplayDemoNarrativePanel from "./ReplayDemoNarrativePanel";
import ReplayDemoNonclaimsPanel from "./ReplayDemoNonclaimsPanel";
import ReplayDemoSnapshotPanel from "./ReplayDemoSnapshotPanel";
import ReplayDemoStandardsPanel from "./ReplayDemoStandardsPanel";
import ReplayDemoTraceabilityPanel from "./ReplayDemoTraceabilityPanel";
import "../../../styles/operatorReplayDemo.css";

type ReplayDemoLoadState =
  | { status: "loading" }
  | { status: "ready"; vm: ReplayDemoViewModel }
  | { status: "error"; message: string };

export default function ReplayDemoPage(): React.ReactElement {
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
    return <main className="operatorReplayDemo"><section className="operatorReplayDemo__panel"><h1 className="operatorReplayDemo__title">Replay-backed Gateway Demo</h1><p>Loading checked-in snapshot...</p></section></main>;
  }

  if (state.status === "error") {
    return <main className="operatorReplayDemo"><section className="operatorReplayDemo__panel"><h1 className="operatorReplayDemo__title">Replay-backed Gateway Demo</h1><p>Snapshot unavailable: {state.message}</p><p>Static checked-in snapshot is required for this replay-backed demo.</p></section></main>;
  }

  const vm = state.vm;
  return (
    <main className="operatorReplayDemo" data-h61="replay-demo-productization" data-route={vm.route} data-mode={vm.mode}>
      <ReplayDemoHero vm={vm} />
      <ReplayDemoBoundaryBanner />
      <ReplayDemoNarrativePanel vm={vm} />
      <section className="operatorReplayDemo__grid" aria-label="Replay demo sections">
        <ReplayDemoSnapshotPanel vm={vm} />
        <ReplayDemoGatewayPathPanel vm={vm} />
        <ReplayDemoStandardsPanel vm={vm} />
        <ReplayDemoDeviceEvidencePanel vm={vm} />
        <ReplayDemoIngestionPanel vm={vm} />
        <ReplayDemoTraceabilityPanel vm={vm} />
        <ReplayDemoHashesPanel vm={vm} />
        <ReplayDemoEvidenceRefsPanel vm={vm} />
        <ReplayDemoNonclaimsPanel vm={vm} />
      </section>
    </main>
  );
}
