// apps/web/src/features/operator/gatewayDemo/gatewayDemoTypes.ts
// Purpose: define the static P51.5 gateway-backed demo viewer snapshot contract.
// Boundary: these types describe a read-only checked-in artifact; they do not model live ingest or production writes.

export type GatewayDemoIdentity = {
  phase: string;
  source_truth_mode: string;
  device_source_simulated: boolean;
  real_live_device_proof: boolean;
  production_gateway: boolean;
  field_pilot: boolean;
  runtime_health_v1: boolean;
  read_only: boolean;
};

export type GatewayDemoSummary = {
  input_pack_count: number;
  device_count: number;
  accepted_observation_count: number;
  health_envelope_count: number;
  metric_count: number;
  device_ids: string[];
  gateway_window_start: string;
  gateway_window_end: string;
};

export type GatewayDemoStandardLayer = {
  layer: string;
  summary: string;
  ref: string;
};

export type GatewayDemoDeviceHealth = {
  device_id: string;
  battery_percent: number | null;
  rssi_dbm: number | null;
  fw_ver: string | null;
  health_scope: string;
};

export type GatewayDemoDuplicateSummary = {
  duplicate_same_payload_deduped_count: number;
  duplicate_conflict_blocked_count: number;
  copy: string;
};

export type GatewayDemoClockSkewSummary = {
  clock_skew_ok_count: number;
  clock_skew_warn_count: number;
  clock_skew_blocked_count: number;
  warn_ms: number;
  block_ms: number;
  boundary_copy: string;
};

export type GatewayDemoIngestionWindow = {
  record_type: string;
  window_id: string;
  input_pack_count: number;
  device_count: number;
  accepted_observation_count: number;
  duplicate_same_payload_deduped_count: number;
  duplicate_conflict_blocked_count: number;
  clock_skew_warn_count: number;
};

export type GatewayDemoTraceabilityRow = {
  metric: string;
  device_id: string;
  raw_sample_fact_id: string;
  device_observation_ref: string;
  sensorthings_id: string;
  sosa_result_time: string;
};

export type GatewayDemoTraceabilityReadback = {
  record_type: string;
  trace_count: number;
  rows: GatewayDemoTraceabilityRow[];
};

export type GatewayDemoNonclaim = {
  label: string;
  value: boolean;
};

export type GatewayDemoSnapshot = {
  schema_version: string;
  phase: string;
  source_phase: string;
  source_snapshot_ref: string;
  source_snapshot_checked_in_as: string;
  generated_by: string;
  baseline_tag: string;
  baseline_commit: string;
  p51_final_tag: string;
  p51_final_commit: string;
  p51_acceptance: {
    assertion_count: number;
    failed_assertion_count: number;
    deterministic_hash: string;
  };
  identity: GatewayDemoIdentity;
  gateway_summary: GatewayDemoSummary;
  standards_chain: GatewayDemoStandardLayer[];
  device_health: GatewayDemoDeviceHealth[];
  duplicate_summary: GatewayDemoDuplicateSummary;
  clock_skew_summary: GatewayDemoClockSkewSummary;
  ingestion_window: GatewayDemoIngestionWindow;
  traceability_readback: GatewayDemoTraceabilityReadback;
  hashes: Record<string, string>;
  nonclaims: GatewayDemoNonclaim[];
  evidence_refs: string[];
};
