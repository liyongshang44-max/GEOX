import React from "react";
import type { FlightTableApiSnapshotV1, FlightTableLaneV1, FlightTableRunV1 } from "../../../api/flightTable";
import { summarizeFlightTableManifest } from "../../../viewmodels/flightTableVm";
import FlightRunHeader from "./FlightRunHeader";
import FlightAssemblyPanel from "./FlightAssemblyPanel";
import LaneComposer from "./LaneComposer";
import FlightMatrix from "./FlightMatrix";
import ManifestPanel from "./ManifestPanel";
import ApiSnapshotPanel from "./ApiSnapshotPanel";
import UiReplayLinks from "./UiReplayLinks";
import DiagnosticsPanel from "./DiagnosticsPanel";

type Props = {
  run: FlightTableRunV1 | null;
  snapshots: FlightTableApiSnapshotV1[];
  runIdDraft: string;
  laneDraft: FlightTableLaneV1;
  onRunIdDraftChange: (next: string) => void;
  onLaneDraftChange: (next: FlightTableLaneV1) => void;
  onCreateRun: () => void;
  onVerify: () => void;
  onClean: () => void;
  onRetryStep: (stepKey: string) => void;
  loading: boolean;
  error: string | null;
};

type TabKey = "assembly" | "lane" | "monitor" | "replay" | "diagnostics";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "assembly", label: "对象装配" },
  { key: "lane", label: "航线编排" },
  { key: "monitor", label: "运行监控" },
  { key: "replay", label: "验收回放" },
  { key: "diagnostics", label: "诊断报告" },
];

export default function FlightTableShell(props: Props): React.ReactElement {
  const [activeTab, setActiveTab] = React.useState<TabKey>("assembly");
  const summary = summarizeFlightTableManifest(props.run?.manifest ?? null);
  return (
    <div className="flight-table-shell">
      <aside className="flight-sidebar">
        <strong>飞行台</strong>
        {[
          "飞行总览",
          "对象装配",
          "航线编排",
          "运行监控",
          "验收回放",
          "诊断报告",
          "客户页面映射",
          "运营页面映射",
        ].map((item) => <span key={item}>{item}</span>)}
      </aside>
      <main className="flight-main">
        <FlightRunHeader
          run={props.run}
          runIdDraft={props.runIdDraft}
          laneDraft={props.laneDraft}
          onRunIdDraftChange={props.onRunIdDraftChange}
          onLaneDraftChange={(next) => props.onLaneDraftChange(next as FlightTableLaneV1)}
          onCreateRun={props.onCreateRun}
          onVerify={props.onVerify}
          onClean={props.onClean}
          loading={props.loading}
        />
        {props.error ? <div className="flight-alert">{props.error}</div> : null}
        <section className="flight-summary-grid">
          {summary.map((item) => (
            <article key={item.label} className="flight-summary-card">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </section>
        <nav className="flight-tabs" aria-label="flight table tabs">
          {TABS.map((tab) => (
            <button key={tab.key} type="button" className={activeTab === tab.key ? "active" : ""} onClick={() => setActiveTab(tab.key)}>{tab.label}</button>
          ))}
        </nav>
        {activeTab === "assembly" ? <FlightAssemblyPanel manifest={props.run?.manifest ?? null} /> : null}
        {activeTab === "lane" ? <LaneComposer selectedLane={props.laneDraft} onLaneChange={props.onLaneDraftChange} /> : null}
        {activeTab === "monitor" ? <FlightMatrix run={props.run} onRetryStep={props.onRetryStep} loading={props.loading} /> : null}
        {activeTab === "replay" ? <><UiReplayLinks run={props.run} /><ManifestPanel manifest={props.run?.manifest ?? null} /><ApiSnapshotPanel snapshots={props.snapshots} /></> : null}
        {activeTab === "diagnostics" ? <DiagnosticsPanel run={props.run} error={props.error} /> : null}
      </main>
    </div>
  );
}
