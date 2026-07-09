// apps/server/src/runtime/twin_runtime/evidence_window_builder_v1.ts
// Purpose: freeze one explicit one-hour Replay Evidence Window, enforce no-future-leakage, and select the latest usable soil observation for A0 bootstrap assimilation.
// Boundary: pure application logic over caller-supplied records and explicit logical time; no filesystem, database, environment, scheduler, network, or wall-clock reads.

import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalReplayEvidenceRecordV1, ReplayEvidenceRoleV1, TwinScopeKeyV1 } from "./ports.js";

export const A0_EVIDENCE_WINDOW_RULE_V1 = "OPEN_START_CLOSED_END_PT1H_V1" as const;
export const A0_EVIDENCE_SELECTION_POLICY_V1 = "LATEST_USABLE_SOIL_OBSERVATION_BEFORE_TICK_V1" as const;

export type EvidenceDispositionV1 = "ON_TIME_INCLUDED" | "LATE_EXCLUDED" | "FUTURE_EXCLUDED" | "OUTSIDE_WINDOW_EXCLUDED" | "QUALITY_FAIL_EXCLUDED" | "SCOPE_MISMATCH_EXCLUDED";

export type EvidenceWindowRecordSummaryV1 = {
  source_record_id: string;
  source_record_hash: string;
  binding_id: string;
  role: ReplayEvidenceRoleV1;
  event_time: string;
  available_to_runtime_at: string;
  quality_status: string;
  disposition: EvidenceDispositionV1;
  reason_code: string;
};

export type FrozenEvidenceWindowV1 = {
  window_rule_id: typeof A0_EVIDENCE_WINDOW_RULE_V1;
  selection_policy_id: typeof A0_EVIDENCE_SELECTION_POLICY_V1;
  window_start_exclusive: string;
  window_end_inclusive: string;
  logical_time: string;
  frozen: true;
  candidate_record_count: number;
  selected_records: EvidenceWindowRecordSummaryV1[];
  excluded_records: EvidenceWindowRecordSummaryV1[];
  selected_evidence_refs: string[];
  selected_source_refs: string[];
  assimilation_observation: CanonicalReplayEvidenceRecordV1;
  coverage: {
    selected_record_count: number;
    soil_moisture_observation_count: number;
    rainfall_observation_count: number;
    historical_et0_input_count: number;
    future_weather_assumption_count: number;
    future_et0_assumption_count: number;
  };
  exclusion_counts: Record<string, number>;
  semantic_digest: string;
};

const RECORD_TYPE_TO_ROLE_V1: Readonly<Record<string, ReplayEvidenceRoleV1>> = {
  soil_moisture_observation_v1: "SOIL_MOISTURE_OBSERVATION",
  observed_rainfall_v1: "RAINFALL_OBSERVATION",
  historical_et0_estimate_v1: "HISTORICAL_ET0_INPUT",
  future_weather_assumption_v1: "FUTURE_WEATHER_ASSUMPTION",
  future_et0_assumption_v1: "FUTURE_ET0_ASSUMPTION",
  approved_irrigation_plan_snapshot_v1: "APPROVED_IRRIGATION_PLAN",
  irrigation_execution_evidence_v1: "IRRIGATION_EXECUTION_EVIDENCE",
};

const ROLE_EVENT_FIELD_V1: Readonly<Record<ReplayEvidenceRoleV1, string>> = {
  SOIL_MOISTURE_OBSERVATION: "observed_at",
  RAINFALL_OBSERVATION: "interval_end",
  HISTORICAL_ET0_INPUT: "interval_end",
  FUTURE_WEATHER_ASSUMPTION: "issued_at",
  FUTURE_ET0_ASSUMPTION: "issued_at",
  APPROVED_IRRIGATION_PLAN: "approved_at",
  IRRIGATION_EXECUTION_EVIDENCE: "executed_at",
};

function requireIsoInstantV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new Error(code);
  return value;
}

function previousHourIsoV1(logicalTime: string): string {
  const endMs = Date.parse(requireIsoInstantV1(logicalTime, "LOGICAL_TIME_INVALID"));
  return new Date(endMs - 60 * 60 * 1000).toISOString();
}

function sameScopeV1(record: CanonicalReplayEvidenceRecordV1, scope: TwinScopeKeyV1): boolean {
  return record.tenant_id === scope.tenant_id
    && record.project_id === scope.project_id
    && record.group_id === scope.group_id
    && record.field_id === scope.field_id
    && record.season_id === scope.season_id
    && record.zone_id === scope.zone_id;
}

function roleForRecordV1(record: CanonicalReplayEvidenceRecordV1): ReplayEvidenceRoleV1 {
  const role = RECORD_TYPE_TO_ROLE_V1[record.record_type];
  if (!role) throw new Error(`UNSUPPORTED_REPLAY_RECORD_TYPE:${record.record_type}`);
  return role;
}

function eventTimeV1(record: CanonicalReplayEvidenceRecordV1, role: ReplayEvidenceRoleV1): string {
  return requireIsoInstantV1(record.role_time?.[ROLE_EVENT_FIELD_V1[role]], `ROLE_EVENT_TIME_REQUIRED:${role}`);
}

function summaryV1(record: CanonicalReplayEvidenceRecordV1, role: ReplayEvidenceRoleV1, eventTime: string, disposition: EvidenceDispositionV1, reasonCode: string): EvidenceWindowRecordSummaryV1 {
  return {
    source_record_id: record.source_record_id,
    source_record_hash: record.source_record_hash,
    binding_id: record.binding_id,
    role,
    event_time: eventTime,
    available_to_runtime_at: requireIsoInstantV1(record.available_to_runtime_at, "AVAILABLE_TO_RUNTIME_INVALID"),
    quality_status: String(record.quality?.status ?? "UNKNOWN"),
    disposition,
    reason_code: reasonCode,
  };
}

function compareSummaryV1(a: EvidenceWindowRecordSummaryV1, b: EvidenceWindowRecordSummaryV1): number {
  return a.role.localeCompare(b.role) || a.event_time.localeCompare(b.event_time) || a.source_record_id.localeCompare(b.source_record_id);
}

export function buildFrozenEvidenceWindowV1(input: {
  scope: TwinScopeKeyV1;
  logical_time: string;
  candidate_records: readonly CanonicalReplayEvidenceRecordV1[];
}): FrozenEvidenceWindowV1 {
  const logicalTime = requireIsoInstantV1(input.logical_time, "LOGICAL_TIME_INVALID");
  const windowStart = previousHourIsoV1(logicalTime);
  const selected: EvidenceWindowRecordSummaryV1[] = [];
  const excluded: EvidenceWindowRecordSummaryV1[] = [];
  const eligibleRecords: CanonicalReplayEvidenceRecordV1[] = [];

  for (const record of input.candidate_records) {
    const role = roleForRecordV1(record);
    const eventTime = eventTimeV1(record, role);
    const available = requireIsoInstantV1(record.available_to_runtime_at, "AVAILABLE_TO_RUNTIME_INVALID");
    if (!sameScopeV1(record, input.scope)) {
      excluded.push(summaryV1(record, role, eventTime, "SCOPE_MISMATCH_EXCLUDED", "EVIDENCE_SCOPE_MISMATCH"));
      continue;
    }
    if (eventTime > logicalTime) {
      excluded.push(summaryV1(record, role, eventTime, "FUTURE_EXCLUDED", "FUTURE_EVIDENCE_FORBIDDEN"));
      continue;
    }
    if (eventTime <= windowStart) {
      excluded.push(summaryV1(record, role, eventTime, "OUTSIDE_WINDOW_EXCLUDED", "OUTSIDE_OPEN_START_CLOSED_END_WINDOW"));
      continue;
    }
    if (available > logicalTime) {
      excluded.push(summaryV1(record, role, eventTime, "LATE_EXCLUDED", "NOT_AVAILABLE_AT_LOGICAL_TICK"));
      continue;
    }
    if (record.quality?.status === "FAIL") {
      excluded.push(summaryV1(record, role, eventTime, "QUALITY_FAIL_EXCLUDED", "QUALITY_FAIL_NOT_USABLE"));
      continue;
    }
    selected.push(summaryV1(record, role, eventTime, "ON_TIME_INCLUDED", "ELIGIBLE_AT_LOGICAL_TICK"));
    eligibleRecords.push(record);
  }

  selected.sort(compareSummaryV1);
  excluded.sort(compareSummaryV1);
  const usableSoil = eligibleRecords
    .filter((record) => roleForRecordV1(record) === "SOIL_MOISTURE_OBSERVATION" && (record.quality.status === "PASS" || record.quality.status === "LIMITED"))
    .sort((a, b) => eventTimeV1(b, "SOIL_MOISTURE_OBSERVATION").localeCompare(eventTimeV1(a, "SOIL_MOISTURE_OBSERVATION")) || a.source_record_id.localeCompare(b.source_record_id));
  if (usableSoil.length === 0) throw new Error("NO_USABLE_SOIL_OBSERVATION_IN_A0_WINDOW");
  const assimilationObservation = usableSoil[0];
  const counts = (role: ReplayEvidenceRoleV1) => selected.filter((record) => record.role === role).length;
  const exclusionCounts: Record<string, number> = {};
  for (const item of excluded) exclusionCounts[item.reason_code] = (exclusionCounts[item.reason_code] ?? 0) + 1;
  const selectedEvidenceRefs = selected.map((record) => record.source_record_id);
  const selectedSourceRefs = [...new Set(selected.map((record) => record.binding_id))].sort();
  const semanticCore = {
    window_rule_id: A0_EVIDENCE_WINDOW_RULE_V1,
    selection_policy_id: A0_EVIDENCE_SELECTION_POLICY_V1,
    window_start_exclusive: windowStart,
    window_end_inclusive: logicalTime,
    selected_records: selected,
    excluded_records: excluded,
    assimilation_observation_ref: assimilationObservation.source_record_id,
  };
  return {
    window_rule_id: A0_EVIDENCE_WINDOW_RULE_V1,
    selection_policy_id: A0_EVIDENCE_SELECTION_POLICY_V1,
    window_start_exclusive: windowStart,
    window_end_inclusive: logicalTime,
    logical_time: logicalTime,
    frozen: true,
    candidate_record_count: input.candidate_records.length,
    selected_records: selected,
    excluded_records: excluded,
    selected_evidence_refs: selectedEvidenceRefs,
    selected_source_refs: selectedSourceRefs,
    assimilation_observation: assimilationObservation,
    coverage: {
      selected_record_count: selected.length,
      soil_moisture_observation_count: counts("SOIL_MOISTURE_OBSERVATION"),
      rainfall_observation_count: counts("RAINFALL_OBSERVATION"),
      historical_et0_input_count: counts("HISTORICAL_ET0_INPUT"),
      future_weather_assumption_count: counts("FUTURE_WEATHER_ASSUMPTION"),
      future_et0_assumption_count: counts("FUTURE_ET0_ASSUMPTION"),
    },
    exclusion_counts: Object.fromEntries(Object.entries(exclusionCounts).sort(([a], [b]) => a.localeCompare(b))),
    semantic_digest: semanticHashV1(semanticCore),
  };
}
