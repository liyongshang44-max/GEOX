// apps/web/src/features/operator/replayDemo/replayDemoViewModel.ts
// Purpose: map the checked-in P51 gateway viewer snapshot into the H61 Replay Demo product ViewModel.
// Boundary: this file performs display-only mapping and does not create gateway, runtime, trace, task, or action records.

import { type GatewayDemoSnapshot } from "../gatewayDemo/gatewayDemoTypes";

export type ReplayDemoMetadataStatus = "available" | "not_available" | "metadata_only";

export type ReplayDemoRow = {
  label: string;
  value: string;
  metadataStatus?: ReplayDemoMetadataStatus;
};

export type ReplayDemoSection = {
  title: string;
  lead: string;
  rows: ReplayDemoRow[];
};

export type ReplayDemoSnapshotSummary = {
  sourceSnapshotRef: string;
  checkedInAs: string;
  generatedBy: string;
  baselineTag: string;
  baselineCommit: string;
  p51FinalTag: string;
  p51FinalCommit: string;
  deterministicHash: string;
};

export type ReplayDemoNarrativeStep = {
  step: string;
  title: string;
  explanation: string;
  doesNotMean: string[];
};

export type ReplayDemoNonclaim = {
  label: string;
  value: boolean;
  displayText: string;
};

export type ReplayDemoBoundary = {
  readOnly: true;
  staticSnapshotOnly: true;
  liveDeviceClaimed: false;
  productionGatewayClaimed: false;
  runtimeHealthClaimed: false;
  dispatchEnabled: false;
  writesCreated: false;
};

export type ReplayDemoViewModel = {
  source: "p51_gateway_viewer_snapshot";
  mode: "replay_backed_demo";
  route: "/operator/twin/gateway-demo";
  title: "Replay-backed Gateway Demo";
  snapshot: ReplayDemoSnapshotSummary;
  narrative: ReplayDemoNarrativeStep[];
  gatewayPath: ReplayDemoSection;
  standardsMapping: ReplayDemoSection;
  deviceEvidence: ReplayDemoSection;
  ingestionWindow: ReplayDemoSection;
  traceability: ReplayDemoSection;
  hashes: ReplayDemoSection;
  nonclaims: ReplayDemoNonclaim[];
  evidenceRefs: string[];
  boundary: ReplayDemoBoundary;
};

function text(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not available";
  return String(value);
}

function booleanText(value: boolean): string {
  return value ? "true" : "false";
}

function metadata(value: unknown): ReplayDemoMetadataStatus {
  return value === null || value === undefined || value === "" ? "not_available" : "metadata_only";
}

function uniqueRefs(refs: string[]): string[] {
  return [...new Set(refs.map((ref) => ref.trim()).filter(Boolean))];
}

function buildSnapshotSummary(snapshot: GatewayDemoSnapshot): ReplayDemoSnapshotSummary {
  return {
    sourceSnapshotRef: text(snapshot.source_snapshot_ref),
    checkedInAs: text(snapshot.source_snapshot_checked_in_as),
    generatedBy: text(snapshot.generated_by),
    baselineTag: text(snapshot.baseline_tag),
    baselineCommit: text(snapshot.baseline_commit),
    p51FinalTag: text(snapshot.p51_final_tag),
    p51FinalCommit: text(snapshot.p51_final_commit),
    deterministicHash: text(snapshot.p51_acceptance?.deterministic_hash),
  };
}

function buildNarrative(): ReplayDemoNarrativeStep[] {
  return [
    {
      step: "1",
      title: "What this demo proves",
      explanation: "Checked-in gateway path replay can be rendered as a stable product demo with evidence refs and hashes.",
      doesNotMean: ["live device deployment", "production gateway online", "continuous runtime monitoring"],
    },
    {
      step: "2",
      title: "What this demo does not prove",
      explanation: "The page is a replay-backed demonstration surface, not a live operational surface.",
      doesNotMean: ["Runtime Health v1", "field pilot execution", "AO-ACT dispatch"],
    },
    {
      step: "3",
      title: "Traceability posture",
      explanation: "Displayed values remain traceable to checked-in snapshot refs and deterministic hashes.",
      doesNotMean: ["trace record creation", "production certification", "runtime incident detection"],
    },
  ];
}

function buildGatewayPath(snapshot: GatewayDemoSnapshot): ReplayDemoSection {
  const summary = snapshot.gateway_summary;
  return {
    title: "Gateway Path Replay",
    lead: "Gateway path values are replay metadata from a checked-in snapshot, not a live device count or production gateway signal.",
    rows: [
      { label: "input_pack_count", value: text(summary.input_pack_count), metadataStatus: "metadata_only" },
      { label: "device_count", value: text(summary.device_count), metadataStatus: "metadata_only" },
      { label: "accepted_observation_count", value: text(summary.accepted_observation_count), metadataStatus: "metadata_only" },
      { label: "health_envelope_count", value: text(summary.health_envelope_count), metadataStatus: "metadata_only" },
      { label: "metric_count", value: text(summary.metric_count), metadataStatus: "metadata_only" },
      { label: "device_ids", value: summary.device_ids.join(", "), metadataStatus: "metadata_only" },
      { label: "gateway_window_start", value: text(summary.gateway_window_start), metadataStatus: "metadata_only" },
      { label: "gateway_window_end", value: text(summary.gateway_window_end), metadataStatus: "metadata_only" },
    ],
  };
}

function buildStandardsMapping(snapshot: GatewayDemoSnapshot): ReplayDemoSection {
  return {
    title: "Standards Mapping",
    lead: "Standards mapping is replay evidence mapping, not external certification.",
    rows: snapshot.standards_chain.map((row) => ({ label: row.layer, value: `${row.summary} · ${row.ref}`, metadataStatus: "metadata_only" })),
  };
}

function buildDeviceEvidence(snapshot: GatewayDemoSnapshot): ReplayDemoSection {
  return {
    title: "Device Evidence Package",
    lead: "Device evidence package is snapshot metadata. It is not Runtime Health v1 and not live device status.",
    rows: snapshot.device_health.map((row) => ({
      label: row.device_id,
      value: `battery=${text(row.battery_percent)} / rssi=${text(row.rssi_dbm)} / fw=${text(row.fw_ver)} / scope=${text(row.health_scope)}`,
      metadataStatus: "metadata_only",
    })),
  };
}

function buildIngestionWindow(snapshot: GatewayDemoSnapshot): ReplayDemoSection {
  return {
    title: "Ingestion Window",
    lead: "Duplicate handling, clock skew, and ingestion window values are replay metadata without production risk coloring.",
    rows: [
      { label: "duplicate_same_payload_deduped_count", value: text(snapshot.duplicate_summary.duplicate_same_payload_deduped_count), metadataStatus: "metadata_only" },
      { label: "duplicate_conflict_blocked_count", value: text(snapshot.duplicate_summary.duplicate_conflict_blocked_count), metadataStatus: "metadata_only" },
      { label: "clock_skew_ok_count", value: text(snapshot.clock_skew_summary.clock_skew_ok_count), metadataStatus: "metadata_only" },
      { label: "clock_skew_warn_count", value: text(snapshot.clock_skew_summary.clock_skew_warn_count), metadataStatus: "metadata_only" },
      { label: "clock_skew_blocked_count", value: text(snapshot.clock_skew_summary.clock_skew_blocked_count), metadataStatus: "metadata_only" },
      { label: "warn_ms", value: text(snapshot.clock_skew_summary.warn_ms), metadataStatus: "metadata_only" },
      { label: "block_ms", value: text(snapshot.clock_skew_summary.block_ms), metadataStatus: "metadata_only" },
      { label: "window_id", value: text(snapshot.ingestion_window.window_id), metadataStatus: "metadata_only" },
      { label: "accepted_observation_count", value: text(snapshot.ingestion_window.accepted_observation_count), metadataStatus: "metadata_only" },
    ],
  };
}

function buildTraceability(snapshot: GatewayDemoSnapshot): ReplayDemoSection {
  return {
    title: "Traceability",
    lead: "Traceability is readback metadata. It does not create trace records.",
    rows: [
      { label: "trace_count", value: text(snapshot.traceability_readback.trace_count), metadataStatus: "metadata_only" },
      ...snapshot.traceability_readback.rows.map((row) => ({
        label: `${row.device_id} / ${row.metric}`,
        value: `${row.raw_sample_fact_id} → ${row.device_observation_ref} → ${row.sensorthings_id} → ${row.sosa_result_time}`,
        metadataStatus: "metadata_only" as const,
      })),
    ],
  };
}

function buildHashes(snapshot: GatewayDemoSnapshot): ReplayDemoSection {
  return {
    title: "Hashes",
    lead: "Hashes are reproducibility metadata, not production certification.",
    rows: [
      { label: "p51 deterministic hash", value: text(snapshot.p51_acceptance.deterministic_hash), metadataStatus: "metadata_only" },
      { label: "acceptance assertion_count", value: text(snapshot.p51_acceptance.assertion_count), metadataStatus: "metadata_only" },
      { label: "acceptance failed_assertion_count", value: text(snapshot.p51_acceptance.failed_assertion_count), metadataStatus: "metadata_only" },
      ...Object.entries(snapshot.hashes).map(([label, value]) => ({ label, value: text(value), metadataStatus: metadata(value) })),
    ],
  };
}

function buildNonclaims(snapshot: GatewayDemoSnapshot): ReplayDemoNonclaim[] {
  const required: ReplayDemoNonclaim[] = [
    { label: "real_live_device_proof", value: snapshot.identity.real_live_device_proof, displayText: `real_live_device_proof=${booleanText(snapshot.identity.real_live_device_proof)}` },
    { label: "production_gateway", value: snapshot.identity.production_gateway, displayText: `production_gateway=${booleanText(snapshot.identity.production_gateway)}` },
    { label: "field_pilot", value: snapshot.identity.field_pilot, displayText: `field_pilot=${booleanText(snapshot.identity.field_pilot)}` },
    { label: "runtime_health_v1", value: snapshot.identity.runtime_health_v1, displayText: `runtime_health_v1=${booleanText(snapshot.identity.runtime_health_v1)}` },
    { label: "read_only", value: snapshot.identity.read_only, displayText: `read_only=${booleanText(snapshot.identity.read_only)}` },
  ];
  const extra = snapshot.nonclaims.map((row) => ({ label: row.label, value: row.value, displayText: `${row.label}=${booleanText(row.value)}` }));
  const byLabel = new Map<string, ReplayDemoNonclaim>();
  [...required, ...extra].forEach((row) => byLabel.set(row.label, row));
  return [...byLabel.values()];
}

export function buildReplayDemoViewModel(snapshot: GatewayDemoSnapshot): ReplayDemoViewModel {
  return {
    source: "p51_gateway_viewer_snapshot",
    mode: "replay_backed_demo",
    route: "/operator/twin/gateway-demo",
    title: "Replay-backed Gateway Demo",
    snapshot: buildSnapshotSummary(snapshot),
    narrative: buildNarrative(),
    gatewayPath: buildGatewayPath(snapshot),
    standardsMapping: buildStandardsMapping(snapshot),
    deviceEvidence: buildDeviceEvidence(snapshot),
    ingestionWindow: buildIngestionWindow(snapshot),
    traceability: buildTraceability(snapshot),
    hashes: buildHashes(snapshot),
    nonclaims: buildNonclaims(snapshot),
    evidenceRefs: uniqueRefs(snapshot.evidence_refs),
    boundary: {
      readOnly: true,
      staticSnapshotOnly: true,
      liveDeviceClaimed: false,
      productionGatewayClaimed: false,
      runtimeHealthClaimed: false,
      dispatchEnabled: false,
      writesCreated: false,
    },
  };
}
