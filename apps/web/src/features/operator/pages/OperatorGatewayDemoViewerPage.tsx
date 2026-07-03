// apps/web/src/features/operator/pages/OperatorGatewayDemoViewerPage.tsx
// Purpose: render the P51.5 read-only Operator Gateway-backed Twin Demo Viewer.
// Boundary: this page consumes a checked-in snapshot and does not create gateway, runtime, or action records.

import React from "react";
import { fetchP51GatewayViewerSnapshot } from "../../../api/operatorGatewayDemo";
import { buildGatewayDemoViewerVm, type GatewayDemoVmRow, type GatewayDemoViewerVm } from "../gatewayDemo/gatewayDemoViewModel";
import { type GatewayDemoSnapshot } from "../gatewayDemo/gatewayDemoTypes";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; snapshot: GatewayDemoSnapshot; vm: GatewayDemoViewerVm }
  | { status: "error"; message: string; vm: GatewayDemoViewerVm };

const sectionStyle: React.CSSProperties = {
  border: "1px solid rgba(15, 23, 42, 0.12)",
  borderRadius: 14,
  padding: 16,
  background: "rgba(255, 255, 255, 0.92)",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 16,
};

function DemoSection({ title, lead, rows }: { title: string; lead: string; rows: GatewayDemoVmRow[] }): React.ReactElement {
  return (
    <section style={sectionStyle} data-p51-5-section={title}>
      <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>{title}</h2>
      <p style={{ margin: "0 0 14px", color: "#64748b", lineHeight: 1.55 }}>{lead}</p>
      <div style={{ display: "grid", gap: 10 }}>
        {rows.map((row) => (
          <div key={`${title}-${row.label}`} style={{ borderTop: "1px solid rgba(15, 23, 42, 0.08)", paddingTop: 10 }}>
            <div style={{ color: "#475569", fontSize: 12, fontWeight: 700, letterSpacing: 0.2 }}>{row.label}</div>
            <div style={{ color: row.status === "BLOCKING" ? "#991b1b" : "#0f172a", fontSize: 14, lineHeight: 1.5, wordBreak: "break-word" }}>{row.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function EvidenceRefs({ refs }: { refs: string[] }): React.ReactElement {
  return (
    <section style={sectionStyle} data-p51-5-section="Evidence refs">
      <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>Evidence refs / hashes</h2>
      <p style={{ margin: "0 0 14px", color: "#64748b", lineHeight: 1.55 }}>Every displayed value is backed by the checked-in P51 gateway viewer snapshot.</p>
      <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
        {refs.map((ref) => <li key={ref} style={{ wordBreak: "break-word" }}>{ref}</li>)}
      </ul>
    </section>
  );
}

export default function OperatorGatewayDemoViewerPage(): React.ReactElement {
  const [state, setState] = React.useState<LoadState>({ status: "loading" });

  React.useEffect(() => {
    let cancelled = false;

    fetchP51GatewayViewerSnapshot()
      .then((snapshot) => {
        if (!cancelled) setState({ status: "ready", snapshot, vm: buildGatewayDemoViewerVm(snapshot) });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: "error", message: error instanceof Error ? error.message : "snapshot unavailable", vm: buildGatewayDemoViewerVm(null) });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return <div className="card" style={{ padding: 16 }}>Gateway-backed Twin Demo Viewer 加载中...</div>;
  }

  if (state.status === "error") {
    return (
      <div className="card" style={{ padding: 16 }}>
        <h1>Gateway 支撑的 Twin Demo Viewer</h1>
        <p>Snapshot unavailable: {state.message}</p>
        <p>Formal unavailable state: {state.vm.blockingGaps.join(", ")}</p>
      </div>
    );
  }

  const vm = state.vm;

  return (
    <div data-p51-5-viewer="gateway-backed-twin-demo" style={{ display: "grid", gap: 18 }}>
      <section style={{ ...sectionStyle, background: "rgba(248, 250, 252, 0.96)" }}>
        <div style={{ color: "#475569", fontSize: 12, fontWeight: 700 }}>P51.5 · OPERATOR · READ ONLY</div>
        <h1 style={{ margin: "8px 0 8px", fontSize: 28 }}>Gateway 支撑的 Twin Demo Viewer</h1>
        <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>
          This page renders the P51 gateway-backed snapshot. It does not rerun gateway ingestion, connect real devices, or create runtime/action records.
        </p>
        {!vm.ready && <p style={{ color: "#991b1b" }}>BLOCKING demo gap: {vm.blockingGaps.join(", ")}</p>}
      </section>

      <div style={gridStyle}>
        <DemoSection title="A. Demo Identity" lead="First-screen identity and boundary facts." rows={vm.identity} />
        <DemoSection title="B. Gateway Input Summary" lead="The viewer reads the P51 gateway path snapshot, not random UI mock data." rows={vm.gatewaySummary} />
      </div>

      <DemoSection title="C. Standards Mapping Chain" lead="SenML-like pack to SensorThings, SOSA, and GEOX compatibility projections." rows={vm.standardsChain} />

      <div style={gridStyle}>
        <DemoSection title="D. Device Evidence Health" lead="Device evidence health only; this is not Runtime Health v1." rows={vm.deviceHealthRows} />
        <DemoSection title="E. Duplicate Handling" lead="Gateway path recorded duplicate handling behavior." rows={vm.duplicateSummary} />
      </div>

      <div style={gridStyle}>
        <DemoSection title="F. Clock Skew" lead="Gateway evidence timing signal, not device fault or field risk conclusion." rows={vm.clockSkewSummary} />
        <DemoSection title="G. Ingestion Window" lead="Gateway ingestion window summary from the P51 snapshot." rows={vm.ingestionWindowSummary} />
      </div>

      <DemoSection title="G. Traceability Readback" lead="Each displayed value links back to gateway evidence refs." rows={vm.traceabilityRows} />

      <div style={gridStyle}>
        <DemoSection title="Hashes" lead="Stable evidence hashes carried by the viewer snapshot." rows={vm.hashRows} />
        <DemoSection title="H. Nonclaims Panel" lead="These boundaries are displayed in the page, not hidden in documentation." rows={vm.nonclaimRows} />
      </div>

      <DemoSection title="Boundary badges" lead="Snapshot origin and P51 acceptance references." rows={vm.boundaryBadges} />
      <EvidenceRefs refs={vm.evidenceRefs} />
    </div>
  );
}
