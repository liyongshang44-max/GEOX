// apps/web/src/features/operator/replayDemo/ReplayDemoLocalizedPage.tsx
import React from "react";
import { fetchP51GatewayViewerSnapshot } from "../../../api/operatorGatewayDemo";
import { ProductBoundaryBanner, ProductErrorState, ProductLoadingState, ProductMetricTile, ProductPageHeader, ProductPageShell, ProductScopeBar, ProductSectionCard, ProductStatusBadge } from "../../../design-system/product";
import { localizedText, useLocale } from "../../../lib/locale";
import { OPERATOR_FORMAL_SURFACE_COPY } from "../../../lib/productSurfaceLabels";
import { buildReplayDemoViewModel, type ReplayDemoViewModel } from "./replayDemoViewModel";
import { REPLAY_DEMO_COPY, replayText } from "./replayDemoLocaleCopy";
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

type State = { status: "loading" } | { status: "ready"; vm: ReplayDemoViewModel } | { status: "error"; message: string };
const copy = OPERATOR_FORMAL_SURFACE_COPY.replayDemo;

export default function ReplayDemoLocalizedPage(): React.ReactElement {
  const { locale } = useLocale();
  const text = (en: string, zh: string) => locale === "en-US" ? en : zh;
  const r = (value: { zh: string; en: string }) => replayText(locale, value);
  const [state, setState] = React.useState<State>({ status: "loading" });
  React.useEffect(() => {
    let active = true;
    fetchP51GatewayViewerSnapshot().then((snapshot) => { if (active) setState({ status: "ready", vm: buildReplayDemoViewModel(snapshot) }); }).catch((error: unknown) => { if (active) setState({ status: "error", message: error instanceof Error ? error.message : text("Snapshot unavailable", "快照不可用") }); });
    return () => { active = false; };
  }, [locale]);

  if (state.status === "loading") return <ProductPageShell surface="operator" width="wide" ariaLabel={localizedText(copy.title, locale)} className="operatorReplayDemo operatorProductSurface"><ProductLoadingState label={localizedText(copy.title, locale)} description={localizedText(copy.loading, locale)} /></ProductPageShell>;
  if (state.status === "error") return <ProductPageShell surface="operator" width="wide" ariaLabel={localizedText(copy.unavailable, locale)} className="operatorReplayDemo operatorProductSurface"><ProductErrorState title={localizedText(copy.unavailable, locale)} message={`${state.message}. ${localizedText(copy.staticRequired, locale)}`} /></ProductPageShell>;

  const vm = state.vm;
  const replayMode = r(REPLAY_DEMO_COPY.hero.replayMode);
  return <ProductPageShell surface="operator" width="wide" ariaLabel={localizedText(copy.title, locale)} className="operatorReplayDemo operatorProductSurface"
    top={<ProductPageHeader eyebrow={localizedText(copy.eyebrow, locale)} title={localizedText(copy.title, locale)} lead={localizedText(copy.heroLead, locale)} metadata={`${text("Route", "路由")}: ${vm.route} / ${text("Mode", "模式")}: ${replayMode}`} nonclaim={localizedText(copy.nonclaimLead, locale)} />}
    aside={<ProductSectionCard title={text("Gateway Demo Boundary", "网关演示边界")} subtitle={text("Replay review without production gateway state.", "不具备生产网关状态的回放审查。")}><div className="operatorProductStatusStack"><ProductStatusBadge status="replayBacked" label={localizedText(copy.nonclaims[0], locale)} /><ProductStatusBadge status="notConnected" label={localizedText(copy.nonclaims[1], locale)} /><ProductStatusBadge status="notOnline" label={localizedText(copy.nonclaims[2], locale)} /><ProductStatusBadge status="disabled" label={localizedText(copy.nonclaims[5], locale)} /></div></ProductSectionCard>}
  >
    <ProductBoundaryBanner tone="replayBacked" title={localizedText(copy.title, locale)} description={localizedText(copy.nonclaimLead, locale)} items={[text("Checked-in Snapshot", "签入快照"), text("Traceability Readback", "可追溯性回查"), text("Not Production Online", "非生产在线")]} />
    <ProductScopeBar surface="operator" items={[{ label: text("Route", "路由"), value: vm.route }, { label: text("Mode", "模式"), value: replayMode }, { label: text("Boundary", "边界"), value: text("Review Only", "仅审查") }]} />
    <div className="operatorProductMetricGrid"><ProductMetricTile label={text("Demo Mode", "演示模式")} value={replayMode} source={r(REPLAY_DEMO_COPY.sources.viewerSnapshot)} status={<ProductStatusBadge status="replayBacked" />} /><ProductMetricTile label={text("Trace Refs", "追踪引用")} value={vm.evidenceRefs.length} source={r(REPLAY_DEMO_COPY.sources.viewModel)} /><ProductMetricTile label={text("Gateway Status", "网关状态")} value={text("Not Online", "未上线")} description={text("Replay demo does not imply production connectivity.", "回放演示不表示生产连接。") } source={r(REPLAY_DEMO_COPY.sources.boundary)} status={<ProductStatusBadge status="notOnline" />} /></div>
    <ReplayDemoHero vm={vm} /><ReplayDemoBoundaryBanner /><ReplayDemoNarrativePanel vm={vm} />
    <section className="operatorReplayDemo__grid" aria-label={text("Replay demo sections", "回放演示区块")}><ReplayDemoSnapshotPanel vm={vm} /><ReplayDemoGatewayPathPanel vm={vm} /><ReplayDemoStandardsPanel vm={vm} /><ReplayDemoDeviceEvidencePanel vm={vm} /><ReplayDemoIngestionPanel vm={vm} /><ReplayDemoTraceabilityPanel vm={vm} /><ReplayDemoHashesPanel vm={vm} /><ReplayDemoSnapshotIdsPanel items={vm.evidenceRefs} /><ReplayDemoBoundaryClaimsPanel vm={vm} /></section>
  </ProductPageShell>;
}
