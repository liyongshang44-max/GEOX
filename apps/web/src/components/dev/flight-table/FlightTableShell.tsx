import React from "react";
import type {
  CreateFlightTableGeometryResponseV1,
  FlightTableApiSnapshotV1,
  FlightTableDeviceSummaryV1,
  FlightTableDeviceTemplateV1,
  FlightTableLaneV1,
  FlightTableManifestV1,
  FlightTableRunV1,
  FlightTableSkillAssemblyResponseV1,
  FlightTableSkillFailureTypeV1,
} from "../../../api/flightTable";
import type { FlightTableDecisionRunResultV1 } from "../../../api/flightTableDecision";
import type { FlightTableEvidenceRunResultV1 } from "../../../api/flightTableEvidence";
import type { FlightTableOperationRunResultV1 } from "../../../api/flightTableOperation";
import type { FlightTableReportLearningRunResultV1 } from "../../../api/flightTableReportLearning";
import type {
  FlightTableTelemetryResponseV1,
  FlightTableTelemetryScenarioKeyV1,
} from "../../../api/flightTableTelemetry";
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
  manifest?: FlightTableManifestV1 | null;
  verifyReport?: Record<string, unknown> | null;
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
  decisionResult: FlightTableDecisionRunResultV1 | null;
  decisionLoading: boolean;
  decisionError: string | null;
  operationResult: FlightTableOperationRunResultV1 | null;
  operationLoading: boolean;
  operationError: string | null;
  evidenceResult: FlightTableEvidenceRunResultV1 | null;
  evidenceLoading: boolean;
  evidenceError: string | null;
  reportLearningResult: FlightTableReportLearningRunResultV1 | null;
  reportLearningLoading: boolean;
  reportLearningError: string | null;
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
  onRunDecision: () => void;
  onRunOperation: () => void;
  onRunEvidence: () => void;
  onRunReportLearning: () => void;
  onVerify: () => void;
  onRetryFailedStep: () => void;
  onClean: () => void;
  onExportAcceptancePackage: () => void;
  onRetryStep: (stepKey: string) => void;
  loading: boolean;
  error: string | null;
};

type TabKey = "assembly" | "lane" | "monitor" | "replay" | "diagnostics";

type NavItem = { label: string; tab?: TabKey };

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "assembly", label: "对象装配" },
  { key: "lane", label: "航线编排" },
  { key: "monitor", label: "运行监控" },
  { key: "replay", label: "验收回放" },
  { key: "diagnostics", label: "诊断报告" },
];

const NAV_ITEMS: NavItem[] = [
  { label: "飞行总览", tab: "assembly" },
  { label: "对象装配", tab: "assembly" },
  { label: "航线编排", tab: "lane" },
  { label: "运行监控", tab: "monitor" },
  { label: "验收回放", tab: "replay" },
  { label: "诊断报告", tab: "diagnostics" },
  { label: "客户页面映射", tab: "replay" },
  { label: "运营页面映射", tab: "replay" },
];

function buildSummaryCards(params: {
  manifest: FlightTableManifestV1 | null;
  devices: FlightTableDeviceSummaryV1[];
  skillResult: FlightTableSkillAssemblyResponseV1 | null;
}): Array<{ label: string; value: string; hint: string }> {
  const { manifest, devices, skillResult } = params;
  const onlineCount = devices.filter((device) => device.online_status === "ONLINE").length;
  const boundSkills = manifest?.skill_binding_ids.length ?? 0;
  const missingSkills = skillResult?.items.filter((item) => item.status === "MISSING" || item.status === "FAILED").length ?? 0;
  return [
    { label: "田块对象", value: manifest?.field_id ? "已创建" : "未创建", hint: manifest?.field_id ?? "等待创建 field" },
    { label: "田块空间", value: manifest?.geometry_id ? "已上传 GeoJSON" : "未上传", hint: manifest?.geometry_id ?? "无 geometry 时不伪造地图" },
    { label: "设备接入", value: `${manifest?.device_ids.length ?? 0} 台设备 / ${onlineCount} 台在线`, hint: "在线状态来自真实设备接入向导结果" },
    { label: "技能绑定", value: `${boundSkills} 条已绑定 / ${missingSkills} 缺失`, hint: "技能状态来自 flightTable adapter 与 manifest" },
  ];
}

function renderMatrix(props: Props): React.ReactElement {
  return (
    <FlightMatrix
      run={props.run}
      decisionResult={props.decisionResult}
      operationResult={props.operationResult}
      evidenceResult={props.evidenceResult}
      reportLearningResult={props.reportLearningResult}
      onRetryStep={props.onRetryStep}
      onRunDecision={props.onRunDecision}
      onRunOperation={props.onRunOperation}
      onRunEvidence={props.onRunEvidence}
      onRunReportLearning={props.onRunReportLearning}
      loading={props.loading}
      decisionLoading={props.decisionLoading}
      operationLoading={props.operationLoading}
      evidenceLoading={props.evidenceLoading}
      reportLearningLoading={props.reportLearningLoading}
      decisionError={props.decisionError}
      operationError={props.operationError}
      evidenceError={props.evidenceError}
      reportLearningError={props.reportLearningError}
    />
  );
}

export default function FlightTableShell(props: Props): React.ReactElement {
  const [activeTab, setActiveTab] = React.useState<TabKey>("assembly");
  const manifest = props.manifest ?? props.run?.manifest ?? null;
  const summary = buildSummaryCards({ manifest, devices: props.onboardedDevices, skillResult: props.skillResult });
  return (
    <div className="flight-table-shell flight-console-shell">
      <aside className="flight-sidebar flight-console-sidebar">
        <strong>飞行台</strong>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.label}
            type="button"
            className={item.tab === activeTab ? "active" : ""}
            onClick={() => item.tab && setActiveTab(item.tab)}
          >
            {item.label}
          </button>
        ))}
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
        <section className="flight-summary-grid flight-console-summary-grid">
          {summary.map((item) => (
            <article key={item.label} className="flight-summary-card">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.hint}</small>
            </article>
          ))}
        </section>
        <nav className="flight-tabs" aria-label="flight table tabs">
          {TABS.map((tab) => (
            <button key={tab.key} type="button" className={activeTab === tab.key ? "active" : ""} onClick={() => setActiveTab(tab.key)}>{tab.label}</button>
          ))}
        </nav>
        {activeTab === "assembly" ? (
          <>
            <FlightAssemblyPanel
              manifest={manifest}
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
            <section className="flight-console-bottom-grid" aria-label="bottom flight controls">
              <article className="flight-card">
                <div className="flight-card-head"><h2>航线编排</h2><button type="button" onClick={() => setActiveTab("lane")}>打开</button></div>
                <LaneComposer selectedLane={props.laneDraft} selectedSkillFailureType={props.skillFailureType} onLaneChange={props.onLaneDraftChange} onSkillFailureTypeChange={props.onSkillFailureTypeChange} />
              </article>
              <article className="flight-card flight-console-monitor-card">
                <div className="flight-card-head"><h2>运行监控</h2><button type="button" onClick={() => setActiveTab("monitor")}>打开</button></div>
                {renderMatrix(props)}
              </article>
              <article className="flight-card">
                <div className="flight-card-head"><h2>验收回放</h2><button type="button" onClick={() => setActiveTab("replay")}>打开</button></div>
                <UiReplayLinks run={props.run} />
              </article>
            </section>
          </>
        ) : null}
        {activeTab === "lane" ? <LaneComposer selectedLane={props.laneDraft} selectedSkillFailureType={props.skillFailureType} onLaneChange={props.onLaneDraftChange} onSkillFailureTypeChange={props.onSkillFailureTypeChange} /> : null}
        {activeTab === "monitor" ? renderMatrix(props) : null}
        {activeTab === "replay" ? <><UiReplayLinks run={props.run} /><ManifestPanel manifest={manifest} /><ApiSnapshotPanel snapshots={props.snapshots} /></> : null}
        {activeTab === "diagnostics" ? <DiagnosticsPanel run={props.run} manifest={manifest} verifyReport={props.verifyReport ?? null} snapshots={props.snapshots} error={props.error} /> : null}
      </main>
    </div>
  );
}
