// apps/web/src/features/operator/gatewayDemo/gatewayDemoViewModel.ts
// Purpose: convert the P51.5 gateway-backed snapshot into a stable read-only display model.
// Boundary: this module validates display readiness; it does not calculate gateway evidence.

import { type GatewayDemoSnapshot } from "./gatewayDemoTypes";

export type GatewayDemoVmRow = {
  label: string;
  value: string;
  status?: "PASS" | "BLOCKING" | "INFO";
};

export type GatewayDemoViewerVm = {
  ready: boolean;
  blockingGaps: string[];
  identity: GatewayDemoVmRow[];
  gatewaySummary: GatewayDemoVmRow[];
  standardsChain: GatewayDemoVmRow[];
  deviceHealthRows: GatewayDemoVmRow[];
  duplicateSummary: GatewayDemoVmRow[];
  clockSkewSummary: GatewayDemoVmRow[];
  ingestionWindowSummary: GatewayDemoVmRow[];
  traceabilityRows: GatewayDemoVmRow[];
  hashRows: GatewayDemoVmRow[];
  nonclaimRows: GatewayDemoVmRow[];
  boundaryBadges: GatewayDemoVmRow[];
  evidenceRefs: string[];
};

function boolText(value: boolean): string {
  return value ? "true" : "false";
}

function text(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function requireGap(condition: boolean, gap: string, gaps: string[]): void {
  if (!condition) gaps.push(gap);
}

export function buildGatewayDemoViewerVm(snapshot: GatewayDemoSnapshot | null | undefined): GatewayDemoViewerVm {
  const gaps: string[] = [];

  if (!snapshot) {
    return {
      ready: false,
      blockingGaps: ["SNAPSHOT_MISSING"],
      identity: [],
      gatewaySummary: [],
      standardsChain: [],
      deviceHealthRows: [],
      duplicateSummary: [],
      clockSkewSummary: [],
      ingestionWindowSummary: [],
      traceabilityRows: [],
      hashRows: [],
      nonclaimRows: [],
      boundaryBadges: [],
      evidenceRefs: [],
    };
  }

  requireGap(snapshot.identity?.source_truth_mode === "device_path_simulation", "SOURCE_TRUTH_MODE_NOT_DEVICE_PATH_SIMULATION", gaps);
  requireGap(snapshot.gateway_summary?.input_pack_count === 24, "PACK_COUNT_NOT_24", gaps);
  requireGap(snapshot.gateway_summary?.device_count === 2, "DEVICE_COUNT_NOT_2", gaps);
  requireGap(snapshot.gateway_summary?.accepted_observation_count === 21, "OBSERVATION_COUNT_NOT_21", gaps);
  requireGap(snapshot.traceability_readback?.trace_count === 21, "TRACEABILITY_READBACK_MISSING", gaps);
  requireGap(Array.isArray(snapshot.nonclaims) && snapshot.nonclaims.length >= 8, "NONCLAIMS_PANEL_MISSING", gaps);

  const identity: GatewayDemoVmRow[] = [
    { label: "phase", value: text(snapshot.identity.phase) },
    { label: "source_truth_mode", value: text(snapshot.identity.source_truth_mode) },
    { label: "device_source_simulated", value: boolText(snapshot.identity.device_source_simulated) },
    { label: "real_live_device_proof", value: boolText(snapshot.identity.real_live_device_proof) },
    { label: "production_gateway", value: boolText(snapshot.identity.production_gateway) },
    { label: "field_pilot", value: boolText(snapshot.identity.field_pilot) },
    { label: "runtime_health_v1", value: boolText(snapshot.identity.runtime_health_v1) },
  ];

  const gatewaySummary: GatewayDemoVmRow[] = [
    { label: "input_pack_count", value: text(snapshot.gateway_summary.input_pack_count) },
    { label: "device_count", value: text(snapshot.gateway_summary.device_count) },
    { label: "accepted_observation_count", value: text(snapshot.gateway_summary.accepted_observation_count) },
    { label: "health_envelope_count", value: text(snapshot.gateway_summary.health_envelope_count) },
    { label: "metric_count", value: text(snapshot.gateway_summary.metric_count) },
    { label: "device_ids", value: snapshot.gateway_summary.device_ids.join(", ") },
    { label: "gateway_window_start", value: text(snapshot.gateway_summary.gateway_window_start) },
    { label: "gateway_window_end", value: text(snapshot.gateway_summary.gateway_window_end) },
  ];

  const standardsChain = snapshot.standards_chain.map((row) => ({
    label: row.layer,
    value: `${row.summary} · ${row.ref}`,
  }));

  const deviceHealthRows = snapshot.device_health.map((row) => ({
    label: row.device_id,
    value: `battery=${text(row.battery_percent)} / rssi=${text(row.rssi_dbm)} / fw=${text(row.fw_ver)} / scope=${row.health_scope}`,
  }));

  const duplicateSummary: GatewayDemoVmRow[] = [
    { label: "duplicate_same_payload_deduped_count", value: text(snapshot.duplicate_summary.duplicate_same_payload_deduped_count) },
    { label: "duplicate_conflict_blocked_count", value: text(snapshot.duplicate_summary.duplicate_conflict_blocked_count) },
    { label: "copy", value: snapshot.duplicate_summary.copy },
  ];

  const clockSkewSummary: GatewayDemoVmRow[] = [
    { label: "clock_skew_ok_count", value: text(snapshot.clock_skew_summary.clock_skew_ok_count) },
    { label: "clock_skew_warn_count", value: text(snapshot.clock_skew_summary.clock_skew_warn_count) },
    { label: "clock_skew_blocked_count", value: text(snapshot.clock_skew_summary.clock_skew_blocked_count) },
    { label: "warn_ms", value: text(snapshot.clock_skew_summary.warn_ms) },
    { label: "block_ms", value: text(snapshot.clock_skew_summary.block_ms) },
    { label: "boundary", value: snapshot.clock_skew_summary.boundary_copy },
  ];

  const ingestionWindowSummary: GatewayDemoVmRow[] = [
    { label: "record_type", value: snapshot.ingestion_window.record_type },
    { label: "window_id", value: snapshot.ingestion_window.window_id },
    { label: "input_pack_count", value: text(snapshot.ingestion_window.input_pack_count) },
    { label: "accepted_observation_count", value: text(snapshot.ingestion_window.accepted_observation_count) },
    { label: "clock_skew_warn_count", value: text(snapshot.ingestion_window.clock_skew_warn_count) },
  ];

  const traceabilityRows = snapshot.traceability_readback.rows.map((row) => ({
    label: `${row.device_id} / ${row.metric}`,
    value: `${row.raw_sample_fact_id} → ${row.device_observation_ref} → ${row.sensorthings_id} → ${row.sosa_result_time}`,
  }));

  const hashRows = Object.entries(snapshot.hashes).map(([label, value]) => ({ label, value }));
  const nonclaimRows = snapshot.nonclaims.map((row) => ({ label: row.label, value: boolText(row.value), status: row.value ? "PASS" as const : "BLOCKING" as const }));
  const boundaryBadges: GatewayDemoVmRow[] = [
    { label: "frontend source", value: snapshot.source_snapshot_checked_in_as },
    { label: "generated_by", value: snapshot.generated_by },
    { label: "p51_hash", value: snapshot.p51_acceptance.deterministic_hash },
  ];

  return {
    ready: gaps.length === 0,
    blockingGaps: gaps,
    identity,
    gatewaySummary,
    standardsChain,
    deviceHealthRows,
    duplicateSummary,
    clockSkewSummary,
    ingestionWindowSummary,
    traceabilityRows,
    hashRows,
    nonclaimRows,
    boundaryBadges,
    evidenceRefs: snapshot.evidence_refs,
  };
}
