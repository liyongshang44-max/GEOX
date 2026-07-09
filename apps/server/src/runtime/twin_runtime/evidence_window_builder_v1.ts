// apps/server/src/runtime/twin_runtime/evidence_window_builder_v1.ts
// Purpose: freeze one explicit one-hour Replay Evidence Window, enforce no-future-leakage, reject conflicting duplicate observations, select the latest usable soil observation deterministically, and preserve complete model-consumption trace semantics.
// Boundary: pure application logic over caller-supplied records and explicit logical time; no filesystem, database, environment, scheduler, network, or wall-clock reads.

import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalReplayEvidenceRecordV1, ReplayEvidenceRoleV1, TwinScopeKeyV1 } from "./ports.js";

export const A0_EVIDENCE_WINDOW_RULE_V1 = "OPEN_START_CLOSED_END_PT1H_V1" as const;
export const A0_EVIDENCE_SELECTION_POLICY_V1 = "LATEST_USABLE_SOIL_OBSERVATION_OBSERVED_DESC_INGESTED_DESC_ID_ASC_V1" as const;

export type EvidenceDispositionV1 = "ON_TIME_INCLUDED" | "LATE_EXCLUDED" | "FUTURE_EXCLUDED" | "OUTSIDE_WINDOW_EXCLUDED" | "QUALITY_FAIL_EXCLUDED" | "SCOPE_MISMATCH_EXCLUDED";
export type EvidenceModelConsumptionStatusV1 = "CONSUMED_BY_BOOTSTRAP_ESTIMATOR" | "CONTEXT_ONLY_NOT_CONSUMED_BY_BOOTSTRAP_ESTIMATOR" | "NOT_CONSUMED_EXCLUDED";

export type EvidenceWindowRecordSummaryV1 = {
  source_record_id: string;
  source_record_hash: string;
  binding_id: string;
  origin_source_id: string;
  role: ReplayEvidenceRoleV1;
  event_time: string;
  ingested_at: string;
  available_to_runtime_at: string;
  freshness: {
    age_seconds: number;
    status: "CURRENT_WINDOW" | "FUTURE_EVENT" | "AVAILABLE_AFTER_TICK" | "OUTSIDE_WINDOW" | "SCOPE_MISMATCH";
  };
  quality_status: string;
  unit_conversion: {
    source_unit: string;
    canonical_unit: string;
    conversion_rule: Record<string, unknown>;
  };
  limitations: string[];
  disposition: EvidenceDispositionV1;
  reason_code: string;
  model_consumption_status: EvidenceModelConsumptionStatusV1;
  model_consumption_reason: string;
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
  consumed_evidence_refs: string[];
  context_only_evidence_refs: string[];
  selected_source_refs: string[];
  assimilation_observation: CanonicalReplayEvidenceRecordV1;
  coverage: {
    selected_record_count: number;
    consumed_record_count: number;
    context_only_record_count: number;
    soil_moisture_observation_count: number;
    rainfall_observation_count: number;
    historical_et0_input_count: number;
    future_weather_assumption_count: number;
    future_et0_assumption_count: number;
  };
  exclusion_counts: Record<string, number>;
  semantic_digest: string;
};

type ClassifiedEvidenceV1 = {
  record: CanonicalReplayEvidenceRecordV1;
  role: ReplayEvidenceRoleV1;
  event_time: string;
  ingested_at: string;
  available_to_runtime_at: string;
  disposition: EvidenceDispositionV1;
  reason_code: string;
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
  return new Date(Date.parse(requireIsoInstantV1(logicalTime, "LOGICAL_TIME_INVALID")) - 60 * 60 * 1000).toISOString();
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

function ingestedAtV1(record: CanonicalReplayEvidenceRecordV1): string {
  return requireIsoInstantV1(record.role_time?.ingested_at, "INGESTED_AT_REQUIRED");
}

function freshnessStatusV1(item: ClassifiedEvidenceV1): EvidenceWindowRecordSummaryV1["freshness"]["status"] {
  if (item.disposition === "SCOPE_MISMATCH_EXCLUDED") return "SCOPE_MISMATCH";
  if (item.disposition === "FUTURE_EXCLUDED") return "FUTURE_EVENT";
  if (item.disposition === "LATE_EXCLUDED") return "AVAILABLE_AFTER_TICK";
  if (item.disposition === "OUTSIDE_WINDOW_EXCLUDED") return "OUTSIDE_WINDOW";
  return "CURRENT_WINDOW";
}

function summaryV1(item: ClassifiedEvidenceV1, logicalTime: string, consumption: EvidenceModelConsumptionStatusV1, consumptionReason: string): EvidenceWindowRecordSummaryV1 {
  return {
    source_record_id: item.record.source_record_id,
    source_record_hash: item.record.source_record_hash,
    binding_id: item.record.binding_id,
    origin_source_id: item.record.origin_source_id,
    role: item.role,
    event_time: item.event_time,
    ingested_at: item.ingested_at,
    available_to_runtime_at: item.available_to_runtime_at,
    freshness: {
      age_seconds: Math.trunc((Date.parse(logicalTime) - Date.parse(item.event_time)) / 1000),
      status: freshnessStatusV1(item),
    },
    quality_status: String(item.record.quality?.status ?? "UNKNOWN"),
    unit_conversion: {
      source_unit: item.record.source_unit,
      canonical_unit: item.record.canonical_unit,
      conversion_rule: structuredClone(item.record.conversion_rule),
    },
    limitations: [...item.record.limitations],
    disposition: item.disposition,
    reason_code: item.reason_code,
    model_consumption_status: consumption,
    model_consumption_reason: consumptionReason,
  };
}

function compareSummaryV1(a: EvidenceWindowRecordSummaryV1, b: EvidenceWindowRecordSummaryV1): number {
  return a.role.localeCompare(b.role) || a.event_time.localeCompare(b.event_time) || a.ingested_at.localeCompare(b.ingested_at) || a.source_record_id.localeCompare(b.source_record_id);
}

function compareSoilSelectionV1(a: CanonicalReplayEvidenceRecordV1, b: CanonicalReplayEvidenceRecordV1): number {
  return eventTimeV1(b, "SOIL_MOISTURE_OBSERVATION").localeCompare(eventTimeV1(a, "SOIL_MOISTURE_OBSERVATION"))
    || ingestedAtV1(b).localeCompare(ingestedAtV1(a))
    || a.source_record_id.localeCompare(b.source_record_id);
}

function rejectConflictingDuplicateSoilObservationsV1(records: readonly CanonicalReplayEvidenceRecordV1[]): void {
  const groups = new Map<string, CanonicalReplayEvidenceRecordV1[]>();
  for (const record of records) {
    const key = `${record.origin_source_id}|${eventTimeV1(record, "SOIL_MOISTURE_OBSERVATION")}`;
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }
  for (const [key, group] of groups) {
    const canonicalValues = new Set(group.map((record) => semanticHashV1(record.canonical_payload)));
    if (canonicalValues.size > 1) throw new Error(`CONFLICTING_DUPLICATE_OBSERVATION:${key}`);
  }
}

export function buildFrozenEvidenceWindowV1(input: {
  scope: TwinScopeKeyV1;
  logical_time: string;
  candidate_records: readonly CanonicalReplayEvidenceRecordV1[];
}): FrozenEvidenceWindowV1 {
  const logicalTime = requireIsoInstantV1(input.logical_time, "LOGICAL_TIME_INVALID");
  const windowStart = previousHourIsoV1(logicalTime);
  const included: ClassifiedEvidenceV1[] = [];
  const excluded: ClassifiedEvidenceV1[] = [];

  for (const record of input.candidate_records) {
    const role = roleForRecordV1(record);
    const eventTime = eventTimeV1(record, role);
    const ingestedAt = ingestedAtV1(record);
    const available = requireIsoInstantV1(record.available_to_runtime_at, "AVAILABLE_TO_RUNTIME_INVALID");
    const base = { record, role, event_time: eventTime, ingested_at: ingestedAt, available_to_runtime_at: available };
    if (!sameScopeV1(record, input.scope)) {
      excluded.push({ ...base, disposition: "SCOPE_MISMATCH_EXCLUDED", reason_code: "EVIDENCE_SCOPE_MISMATCH" });
    } else if (eventTime > logicalTime) {
      excluded.push({ ...base, disposition: "FUTURE_EXCLUDED", reason_code: "FUTURE_EVIDENCE_FORBIDDEN" });
    } else if (eventTime <= windowStart) {
      excluded.push({ ...base, disposition: "OUTSIDE_WINDOW_EXCLUDED", reason_code: "OUTSIDE_OPEN_START_CLOSED_END_WINDOW" });
    } else if (available > logicalTime) {
      excluded.push({ ...base, disposition: "LATE_EXCLUDED", reason_code: "NOT_AVAILABLE_AT_LOGICAL_TICK" });
    } else if (record.quality?.status === "FAIL") {
      excluded.push({ ...base, disposition: "QUALITY_FAIL_EXCLUDED", reason_code: "QUALITY_FAIL_NOT_USABLE" });
    } else {
      included.push({ ...base, disposition: "ON_TIME_INCLUDED", reason_code: "ELIGIBLE_AT_LOGICAL_TICK" });
    }
  }

  const usableSoil = included
    .filter((item) => item.role === "SOIL_MOISTURE_OBSERVATION" && (item.record.quality.status === "PASS" || item.record.quality.status === "LIMITED"))
    .map((item) => item.record);
  rejectConflictingDuplicateSoilObservationsV1(usableSoil);
  usableSoil.sort(compareSoilSelectionV1);
  if (usableSoil.length === 0) throw new Error("NO_USABLE_SOIL_OBSERVATION_IN_A0_WINDOW");
  const assimilationObservation = usableSoil[0];

  const selected = included.map((item) => item.record.source_record_id === assimilationObservation.source_record_id
    ? summaryV1(item, logicalTime, "CONSUMED_BY_BOOTSTRAP_ESTIMATOR", "SELECTED_SOIL_OBSERVATION_CONSUMED_BY_A0_ASSIMILATION")
    : summaryV1(item, logicalTime, "CONTEXT_ONLY_NOT_CONSUMED_BY_BOOTSTRAP_ESTIMATOR", item.role === "SOIL_MOISTURE_OBSERVATION" ? "ELIGIBLE_SOIL_OBSERVATION_NOT_SELECTED_BY_POLICY" : "CONTEXT_ONLY_NOT_CONSUMED_BY_BOOTSTRAP_ESTIMATOR"));
  const excludedSummaries = excluded.map((item) => summaryV1(item, logicalTime, "NOT_CONSUMED_EXCLUDED", item.reason_code));
  selected.sort(compareSummaryV1);
  excludedSummaries.sort(compareSummaryV1);

  const counts = (role: ReplayEvidenceRoleV1) => selected.filter((record) => record.role === role).length;
  const exclusionCounts: Record<string, number> = {};
  for (const item of excludedSummaries) exclusionCounts[item.reason_code] = (exclusionCounts[item.reason_code] ?? 0) + 1;
  const selectedEvidenceRefs = selected.map((record) => record.source_record_id);
  const consumedEvidenceRefs = selected.filter((record) => record.model_consumption_status === "CONSUMED_BY_BOOTSTRAP_ESTIMATOR").map((record) => record.source_record_id);
  const contextOnlyEvidenceRefs = selected.filter((record) => record.model_consumption_status === "CONTEXT_ONLY_NOT_CONSUMED_BY_BOOTSTRAP_ESTIMATOR").map((record) => record.source_record_id);
  const selectedSourceRefs = [...new Set(selected.map((record) => record.binding_id))].sort();
  const semanticCore = {
    window_rule_id: A0_EVIDENCE_WINDOW_RULE_V1,
    selection_policy_id: A0_EVIDENCE_SELECTION_POLICY_V1,
    window_start_exclusive: windowStart,
    window_end_inclusive: logicalTime,
    selected_records: selected,
    excluded_records: excludedSummaries,
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
    excluded_records: excludedSummaries,
    selected_evidence_refs: selectedEvidenceRefs,
    consumed_evidence_refs: consumedEvidenceRefs,
    context_only_evidence_refs: contextOnlyEvidenceRefs,
    selected_source_refs: selectedSourceRefs,
    assimilation_observation: assimilationObservation,
    coverage: {
      selected_record_count: selected.length,
      consumed_record_count: consumedEvidenceRefs.length,
      context_only_record_count: contextOnlyEvidenceRefs.length,
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
