// apps/web/src/features/operator/replayDemo/ReplayDemoPage.tsx
// Purpose: load the checked-in gateway snapshot and render the replay-backed demo product surface.
// Boundary: this page uses static GET only and does not create runtime, gateway, trace, task, or action records.

import React from "react";
import { fetchP51GatewayViewerSnapshot } from "../../../api/operatorGatewayDemo";
import {
  ProductBoundaryBanner,
  ProductErrorState,
  ProductLoadingState,
  ProductMetricTile,
  ProductPageHeader,
  ProductPageShell,
  ProductScopeBar,
  ProductSectionCard,
  ProductStatusBadge,
} from "../../../design-system/product";
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
    return () => { cancelled = true; };
  }, []);

  if (state.status === "loading") {
    return (
      <ProductPageShell surface="operator" width="wide" ariaLabel="Operator gateway replay demo loading" className="operatorReplayDemo operatorProductSurface">
        <ProductLoadingState label={localizedText(replayCopy.title, locale)} description={localizedText(replayCopy.loading, locale)} />
      </ProductPageShell>
    );
  }

  if (state.status === "error") {
    return (
      <ProductPageShell surface="operator" width="wide" ariaLabel="Operator gateway replay demo unavailable" className="operatorReplayDemo operatorProductSurface">
        <ProductErrorState title={localizedText(replayCopy.unavailable, locale)} message={`${state.message}. ${localizedText(replayCopy.staticRequired, locale)}`} />
      </ProductPageShell>
    );
  }

  const vm = state.vm;
  return (
    <ProductPageShell
      surface="operator"
      width="wide"
      ariaLabel="Operator replay-backed gateway demo"
      className="operatorReplayDemo operatorProductSurface"
      top={
        <ProductPageHeader
          eyebrow="Operator Runtime Console / Gateway Demo"
          title={localizedText(replayCopy.title, locale)}
          lead="Replay-backed gateway demo using a checked-in snapshot, trace path, and source identity metadata."
          metadata={`Route: ${vm.route} / Mode: ${vm.mode}`}
          nonclaim="Gateway Demo is not a live gateway. Production Gateway: Not online. Live Device: Not connected."
        />
      }
      aside={
        <ProductSectionCard title="Gateway demo boundary" subtitle="Demo-ready technical readback without gateway authority.">
          <div className="operatorProductStatusStack">
            <ProductStatusBadge status="replayBacked" label="Replay-backed" />
            <ProductStatusBadge status="notConnected" label="Live Device: Not connected" />
            <ProductStatusBadge status="notOnline" label="Production Gateway: Not online" />
            <ProductStatusBadge status="disabled" label="Gateway control: Disabled" />
          </div>
        </ProductSectionCard>
      }
    >
      <ProductBoundaryBanner
        tone="replayBacked"
        title="Replay-backed Gateway Demo"
        description="This route renders checked-in gateway snapshot evidence for review. It does not connect to a live gateway, open a production gateway, or control devices."
        items={["Checked-in snapshot", "Traceability readback", "Not production online"]}
      />
      <ProductScopeBar surface="operator" items={[{ label: "Route", value: vm.route }, { label: "Mode", value: vm.mode }, { label: "Boundary", value: "review only" }]} />
      <div className="operatorProductMetricGrid">
        <ProductMetricTile label="Demo mode" value={vm.mode} source="P51 gateway viewer snapshot" status={<ProductStatusBadge status="replayBacked" />} />
        <ProductMetricTile label="Trace refs" value={vm.evidenceRefs.length} source="Replay demo view model" />
        <ProductMetricTile label="Gateway status" value="Not online" description="Nonclaim: gateway demo does not imply production connectivity." source="Replay demo boundary" status={<ProductStatusBadge status="notOnline" />} />
      </div>
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
    </ProductPageShell>
  );
}
