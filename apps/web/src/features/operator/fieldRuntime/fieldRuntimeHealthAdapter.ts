// apps/web/src/features/operator/fieldRuntime/fieldRuntimeHealthAdapter.ts
// Purpose: build H62 Runtime Health Review from local metadata only.
// Boundary: no network request, no live polling, and no writes.

import { FIELD_RUNTIME_NONCLAIMS } from "./runtimeNonclaims";

export type FieldRuntimeHealthAvailability = "available" | "not_enabled" | "metadata_only";

export type FieldRuntimeHealthNonclaim = {
  label: string;
  value: string;
  claimAllowed: false;
};

export type FieldRuntimeHealthSourceFreshnessRow = {
  source: string;
  availability: FieldRuntimeHealthAvailability;
  freshnessMeaning: string;
  doesNotMean: string;
};

export type FieldRuntimeHealthReadModelRow = {
  tab: string;
  readModel: string;
  status: "available" | "not_enabled";
  backendChangedByH62: false;
};

export type FieldRuntimeHealthEvidencePipelineRow = {
  stage: string;
  source: string;
  status: FieldRuntimeHealthAvailability;
  writeSurface: false;
};

export type FieldRuntimeHealthViewModel = {
  fieldId: string;
  source: "field_runtime_health_review_v1";
  mode: "replay_backed_health_review";
  runtimeNonclaims: FieldRuntimeHealthNonclaim[];
  sourceFreshness: FieldRuntimeHealthSourceFreshnessRow[];
  readModelAvailability: FieldRuntimeHealthReadModelRow[];
  evidencePipeline: FieldRuntimeHealthEvidencePipelineRow[];
  gatewayBoundary: {
    replayDemoRoute: "/operator/twin/gateway-demo";
    gatewaySource: "checked_in_snapshot";
    liveGatewayClaimed: false;
    productionGatewayOnlineClaimed: false;
  };
  traceability: {
    fieldRuntimeAuditRoute: string;
    replayDemoRoute: "/operator/twin/gateway-demo";
    traceReadbackBridgeAvailable: true;
    createsTrace: false;
  };
  boundary: {
    readOnly: true;
    liveDeviceClaimed: false;
    productionMonitoringClaimed: false;
    alertingEnabled: false;
    dispatchEnabled: false;
    aoActEnabled: false;
    writesCreated: false;
  };
};

export type FieldRuntimeHealthLoadState = {
  status: "ready";
  health: FieldRuntimeHealthViewModel;
};

const healthNonclaims: FieldRuntimeHealthNonclaim[] = [
  ...FIELD_RUNTIME_NONCLAIMS.map((label) => ({ label, value: label, claimAllowed: false as const })),
  { label: "No live device connection", value: "not connected", claimAllowed: false },
  { label: "No production gateway online claim", value: "not online", claimAllowed: false },
  { label: "No continuous runtime monitoring claim", value: "not active", claimAllowed: false },
  { label: "No alerting claim", value: "not enabled", claimAllowed: false },
  { label: "No incident detection claim", value: "not enabled", claimAllowed: false },
  { label: "No dispatch", value: "disabled", claimAllowed: false },
  { label: "No AO-ACT task", value: "disabled", claimAllowed: false },
  { label: "No facts write", value: "not created", claimAllowed: false },
  { label: "No recommendation", value: "not created", claimAllowed: false },
  { label: "No ROI write", value: "not created", claimAllowed: false },
  { label: "No Field Memory write", value: "not created", claimAllowed: false },
  { label: "No model update", value: "not created", claimAllowed: false },
];

const sourceFreshness: FieldRuntimeHealthSourceFreshnessRow[] = [
  { source: "Field Runtime source family", availability: "metadata_only", freshnessMeaning: "Route and tab metadata are available.", doesNotMean: "live freshness" },
  { source: "Replay Demo source family", availability: "available", freshnessMeaning: "Replay-backed demo route is available as static source reference.", doesNotMean: "live gateway" },
  { source: "Static checked-in snapshot", availability: "metadata_only", freshnessMeaning: "Snapshot identity is checked-in source metadata.", doesNotMean: "device uptime" },
  { source: "Local health metadata", availability: "available", freshnessMeaning: "Health review is built locally from source and boundary metadata.", doesNotMean: "online heartbeat" },
];

const readModelAvailability: FieldRuntimeHealthReadModelRow[] = [
  { tab: "Overview / State", readModel: "operator_field_twin_workspace_v1", status: "available", backendChangedByH62: false },
  { tab: "Evidence", readModel: "operator_field_twin_evidence_quality_v1", status: "available", backendChangedByH62: false },
  { tab: "Forecast", readModel: "operator_field_twin_forecast_panel_v1", status: "available", backendChangedByH62: false },
  { tab: "Scenario", readModel: "operator_field_twin_scenario_compare_v1", status: "available", backendChangedByH62: false },
  { tab: "Residual / Verification", readModel: "operator_field_twin_post_irrigation_verification_v1", status: "available", backendChangedByH62: false },
  { tab: "Calibration", readModel: "operator_field_twin_calibration_replay_v1", status: "available", backendChangedByH62: false },
  { tab: "Audit", readModel: "field_runtime_audit_v1", status: "available", backendChangedByH62: false },
  { tab: "Health", readModel: "field_runtime_health_review_v1", status: "available", backendChangedByH62: false },
  { tab: "Gateway Demo", readModel: "p51_gateway_viewer_snapshot", status: "available", backendChangedByH62: false },
];

const evidencePipeline: FieldRuntimeHealthEvidencePipelineRow[] = [
  { stage: "Field Runtime Overview / State", source: "Workspace adapter", status: "available", writeSurface: false },
  { stage: "Evidence Quality", source: "Evidence adapter", status: "available", writeSurface: false },
  { stage: "Forecast Panel", source: "Forecast adapter", status: "available", writeSurface: false },
  { stage: "Scenario Compare", source: "Scenario adapter", status: "available", writeSurface: false },
  { stage: "Residual Verification", source: "Residual adapter", status: "available", writeSurface: false },
  { stage: "Calibration Replay", source: "Calibration adapter", status: "available", writeSurface: false },
  { stage: "Audit Metadata", source: "Audit local adapter", status: "metadata_only", writeSurface: false },
  { stage: "Replay Demo Snapshot", source: "Replay Demo static GET", status: "metadata_only", writeSurface: false },
];

export function buildFieldRuntimeHealth(fieldId: string): FieldRuntimeHealthLoadState {
  const safeFieldId = fieldId || "not-selected";
  return {
    status: "ready",
    health: {
      fieldId: safeFieldId,
      source: "field_runtime_health_review_v1",
      mode: "replay_backed_health_review",
      runtimeNonclaims: healthNonclaims,
      sourceFreshness,
      readModelAvailability,
      evidencePipeline,
      gatewayBoundary: { replayDemoRoute: "/operator/twin/gateway-demo", gatewaySource: "checked_in_snapshot", liveGatewayClaimed: false, productionGatewayOnlineClaimed: false },
      traceability: { fieldRuntimeAuditRoute: `/operator/fields/${safeFieldId}/audit`, replayDemoRoute: "/operator/twin/gateway-demo", traceReadbackBridgeAvailable: true, createsTrace: false },
      boundary: { readOnly: true, liveDeviceClaimed: false, productionMonitoringClaimed: false, alertingEnabled: false, dispatchEnabled: false, aoActEnabled: false, writesCreated: false },
    },
  };
}
