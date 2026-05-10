import React from "react";
import type {
  CreateFlightTableGeometryResponseV1,
  FlightTableApiSnapshotV1,
  FlightTableDeviceSummaryV1,
  FlightTableDeviceTemplateV1,
  FlightTableLaneV1,
  FlightTableRunV1,
  FlightTableSkillAssemblyResponseV1,
  FlightTableSkillFailureTypeV1,
} from "../../../api/flightTable";
import type {
  FlightTableTelemetryResponseV1,
  FlightTableTelemetryScenarioKeyV1,
} from "../../../api/flightTableTelemetry";
import { summarizeFlightTableManifest } from "../../../viewmodels/flightTableVm";
import FlightRunHeader from "./FlightRunHeader";
import FlightAssemblyPanel from "./FlightAssemblyPanel";
import type { FieldAssemblyDraftV1 } from "./FieldAssemblyCard";
import type { FieldSpatialDraftV1 } from "./FieldSpatialCard";
import type { DeviceOnboardingDraftV1 } from "./DeviceOnboardingWizard";
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
  skillFailureType: FlightTableSkillFailureTypeV1;
  fieldDraft: FieldAssemblyDraftV1;
  fieldLoading: boolean;
  fieldError: string | null;
  customerVisible: boolean;
  reportVisible: boolean;
  spatialDraft: FieldSpatialDraftV1;
  spatialLoading: boolean;
  spatialError: string | null;
  geometryResult: CreateFlightTableGeometryResponseV1 | null;
  deviceDraft: DeviceOnboardingDraftV1;
  deviceLoading: boolean;
  deviceError: string | null;
  deviceTemplates: FlightTableDeviceTemplateV1[];
  onboardedDevices: FlightTableDeviceSummaryV1[];
  telemetryScenarios: FlightTableTelemetryScenarioKeyV1[];
  selectedTelemetryScenarios: FlightTableTelemetryScenarioKeyV1[];
  telemetryResult: FlightTableTelemetryResponseV1 | null;
  telemetryLoading: boolean;
  telemetryError: string | null;
  skillResult: FlightTableSkillAssemblyResponseV1 | null;
  skillLoading: boolean;
  skillError: string | null;
  onRunIdDraftChange: (next: string) => void;
  onLaneDraftChange: (next: FlightTableLaneV1) => void;
  onSkillFailureTypeChange: (next: FlightTableSkillFailureTypeV1) => void;
  onFieldDraftChange: (patch: Partial<FieldAssemblyDraftV1>) => void;
  onSpatialDraftChange: (patch: Partial<FieldSpatialDraftV1>) => void;
  onDeviceDraftChange: (patch: Partial<DeviceOnboardingDraftV1>) => void;
  onCreateRun: () => void;
  onStartRun: () => void;
  onCreateField: () => void;
  onVerifyField: () => void;
  onSubmitGeometry: () => void;
  onOnboardDevice: () => void;
  onRetryDevice: () => void;
  onTelemetryScenarioToggle: (scenario: FlightTableTelemetryScenarioKeyV1) => void;
  onPublishTelemetry: (deviceId?: string | null) => void;
  onVerifyTelemetry: (deviceId?: string | null) => void;
  onBindSkills: () => void;
  onFailOneSkill: () => void;
  onRestoreSkills: () => void;
  onVerify: () => void;
  onRetryFailedStep: () => void;
  onClean: () => void;
  onExportAcceptancePackage: () => void;
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
          onStartRun={props.onStartRun}
          onVerify={props.onVerify}
          onRetryFailedStep={props.onRetryFailedStep}
          onClean={props.onClean}
          onExportAcceptancePackage={props.onExportAcceptancePackage}
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
        {activeTab === "assembly" ? (
          <FlightAssemblyPanel
            manifest={props.run?.manifest ?? null}
            fieldDraft={props.fieldDraft}
            fieldLoading={props.fieldLoading}
            fieldError={props.fieldError}
            customerVisible={props.customerVisible}
            reportVisible={props.reportVisible}
            spatialDraft={props.spatialDraft}
            spatialLoading={props.spatialLoading}
            spatialError={props.spatialError}
            geometryResult={props.geometryResult}
            deviceDraft={props.deviceDraft}
            deviceLoading={props.deviceLoading}
            deviceError={props.deviceError}
            deviceTemplates={props.deviceTemplates}
            onboardedDevices={props.onboardedDevices}
            telemetryScenarios={props.telemetryScenarios}
            selectedTelemetryScenarios={props.selectedTelemetryScenarios}
            telemetryResult={props.telemetryResult}
            telemetryLoading={props.telemetryLoading}
            telemetryError={props.telemetryError}
            skillResult={props.skillResult}
            skillFailureType={props.skillFailureType}
            skillLoading={props.skillLoading}
            skillError={props.skillError}
            onFieldDraftChange={props.onFieldDraftChange}
            onCreateField={props.onCreateField}
            onVerifyField={props.onVerifyField}
            onSpatialDraftChange={props.onSpatialDraftChange}
            onSubmitGeometry={props.onSubmitGeometry}
            onDeviceDraftChange={props.onDeviceDraftChange}
            onOnboardDevice={props.onOnboardDevice}
            onRetryDevice={props.onRetryDevice}
            onTelemetryScenarioToggle={props.onTelemetryScenarioToggle}
            onPublishTelemetry={props.onPublishTelemetry}
            onVerifyTelemetry={props.onVerifyTelemetry}
            onSkillFailureTypeChange={props.onSkillFailureTypeChange}
            onBindSkills={props.onBindSkills}
            onFailOneSkill={props.onFailOneSkill}
            onRestoreSkills={props.onRestoreSkills}
          />
        ) : null}
        {activeTab === "lane" ? <LaneComposer selectedLane={props.laneDraft} selectedSkillFailureType={props.skillFailureType} onLaneChange={props.onLaneDraftChange} onSkillFailureTypeChange={props.onSkillFailureTypeChange} /> : null}
        {activeTab === "monitor" ? <FlightMatrix run={props.run} onRetryStep={props.onRetryStep} loading={props.loading} /> : null}
        {activeTab === "replay" ? <><UiReplayLinks run={props.run} /><ManifestPanel manifest={props.run?.manifest ?? null} /><ApiSnapshotPanel snapshots={props.snapshots} /></> : null}
        {activeTab === "diagnostics" ? <DiagnosticsPanel run={props.run} error={props.error} /> : null}
      </main>
    </div>
  );
}
