// apps/server/src/domain/soil_water/executed_irrigation_input_v1.ts
// Purpose: deterministically deduplicate, order, validate, and coverage-weight eligible executed-irrigation inputs for pure hourly Dynamics.
// Boundary: pure domain aggregation only; no Evidence query, database, Runtime orchestration, action approval, dispatch, or spatial-overlap inference.

import { canonicalJsonV1 } from "../twin_runtime/canonical_json_v1.js";
import {
  WATER_AMOUNT_SCALE_V1,
  compareIsoInstantV1,
  formatFixedDecimalV1,
  multiplyFixedUnitsV1,
  parseFixedDecimalV1,
} from "./fixed_point_water_decimal_v1.js";

export const EXECUTED_IRRIGATION_INPUT_POLICY_ID_V1 = "COVERAGE_WEIGHTED_EXECUTED_AMOUNT_SUM_V1" as const;
export const EXECUTED_IRRIGATION_ORDER_V1 = "executed_at_asc_ingested_at_asc_source_record_id_asc" as const;
export const EXECUTED_IRRIGATION_SPATIAL_OVERLAP_POLICY_V1 = "NOT_ESTABLISHED" as const;

export type ExecutedIrrigationScopeV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  zone_id: string;
};

export type ExecutedIrrigationCandidateV1 = {
  binding_id: string;
  origin_source_id: string;
  scope: ExecutedIrrigationScopeV1;
  event_id: string;
  source_record_id: string;
  executed_at: string;
  ingested_at: string;
  executed_amount_mm: string;
  coverage_fraction: string;
  eligible_for_state_input: boolean;
  source_quality: "USABLE" | "UNUSABLE";
  execution_status: "EXECUTED";
};

export type ExecutedIrrigationTraceEventV1 = {
  source_record_id: string;
  executed_at: string;
  ingested_at: string;
  executed_amount_mm: string;
  coverage_fraction: string;
  effective_irrigation_mm: string;
};

export type ExecutedIrrigationAggregationV1 = {
  policy_id: typeof EXECUTED_IRRIGATION_INPUT_POLICY_ID_V1;
  deterministic_order: typeof EXECUTED_IRRIGATION_ORDER_V1;
  spatial_overlap_deduplication: typeof EXECUTED_IRRIGATION_SPATIAL_OVERLAP_POLICY_V1;
  selected_events: ExecutedIrrigationTraceEventV1[];
  identical_duplicate_record_ids: string[];
  excluded_record_ids: string[];
  effective_irrigation_mm: string;
};

const FORBIDDEN_AMOUNT_KEYS_V1 = [
  "approved_amount_mm",
  "planned_amount_mm",
  "dispatched_amount_mm",
] as const;

function requireStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function requireScopeV1(value: unknown): ExecutedIrrigationScopeV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("EXECUTION_SCOPE_REQUIRED");
  const scope = value as Record<string, unknown>;
  return {
    tenant_id: requireStringV1(scope.tenant_id, "EXECUTION_SCOPE_TENANT_REQUIRED"),
    project_id: requireStringV1(scope.project_id, "EXECUTION_SCOPE_PROJECT_REQUIRED"),
    group_id: requireStringV1(scope.group_id, "EXECUTION_SCOPE_GROUP_REQUIRED"),
    field_id: requireStringV1(scope.field_id, "EXECUTION_SCOPE_FIELD_REQUIRED"),
    season_id: requireStringV1(scope.season_id, "EXECUTION_SCOPE_SEASON_REQUIRED"),
    zone_id: requireStringV1(scope.zone_id, "EXECUTION_SCOPE_ZONE_REQUIRED"),
  };
}

function requireCanonicalIsoV1(value: unknown, code: string): string {
  const text = requireStringV1(value, code);
  try {
    if (new Date(text).toISOString() !== text) throw new Error(code);
  } catch {
    throw new Error(code);
  }
  return text;
}

function rejectForbiddenAmountKeysV1(candidate: Record<string, unknown>): void {
  for (const key of FORBIDDEN_AMOUNT_KEYS_V1) {
    if (Object.prototype.hasOwnProperty.call(candidate, key)) throw new Error(`EXECUTION_FORBIDDEN_AMOUNT_KEY:${key}`);
  }
}

function validateCandidateV1(value: unknown): ExecutedIrrigationCandidateV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("EXECUTION_CANDIDATE_REQUIRED");
  const candidate = value as Record<string, unknown>;
  rejectForbiddenAmountKeysV1(candidate);
  if (candidate.execution_status !== "EXECUTED") throw new Error("EXECUTION_STATUS_MUST_BE_EXECUTED");
  if (candidate.source_quality !== "USABLE" && candidate.source_quality !== "UNUSABLE") throw new Error("EXECUTION_SOURCE_QUALITY_INVALID");
  if (typeof candidate.eligible_for_state_input !== "boolean") throw new Error("EXECUTION_ELIGIBILITY_REQUIRED");
  const coverageUnits = parseFixedDecimalV1(candidate.coverage_fraction, WATER_AMOUNT_SCALE_V1, "EXECUTION_COVERAGE_REQUIRED");
  if (coverageUnits < 0n || coverageUnits > 1_000_000n) throw new Error("EXECUTION_COVERAGE_OUT_OF_RANGE");
  const executedAmountUnits = parseFixedDecimalV1(candidate.executed_amount_mm, WATER_AMOUNT_SCALE_V1, "EXECUTION_AMOUNT_REQUIRED");
  if (executedAmountUnits < 0n) throw new Error("EXECUTION_AMOUNT_NEGATIVE");
  return {
    binding_id: requireStringV1(candidate.binding_id, "EXECUTION_BINDING_ID_REQUIRED"),
    origin_source_id: requireStringV1(candidate.origin_source_id, "EXECUTION_ORIGIN_SOURCE_ID_REQUIRED"),
    scope: requireScopeV1(candidate.scope),
    event_id: requireStringV1(candidate.event_id, "EXECUTION_EVENT_ID_REQUIRED"),
    source_record_id: requireStringV1(candidate.source_record_id, "EXECUTION_SOURCE_RECORD_ID_REQUIRED"),
    executed_at: requireCanonicalIsoV1(candidate.executed_at, "EXECUTION_EXECUTED_AT_REQUIRED"),
    ingested_at: requireCanonicalIsoV1(candidate.ingested_at, "EXECUTION_INGESTED_AT_REQUIRED"),
    executed_amount_mm: formatFixedDecimalV1(executedAmountUnits, WATER_AMOUNT_SCALE_V1),
    coverage_fraction: formatFixedDecimalV1(coverageUnits, WATER_AMOUNT_SCALE_V1),
    eligible_for_state_input: candidate.eligible_for_state_input,
    source_quality: candidate.source_quality,
    execution_status: "EXECUTED",
  };
}

function semanticIdentityV1(candidate: ExecutedIrrigationCandidateV1): string {
  return canonicalJsonV1({
    binding_id: candidate.binding_id,
    origin_source_id: candidate.origin_source_id,
    scope: candidate.scope,
    executed_at: candidate.executed_at,
    event_id: candidate.event_id,
  });
}

function canonicalPayloadV1(candidate: ExecutedIrrigationCandidateV1): string {
  return canonicalJsonV1({
    executed_amount_mm: candidate.executed_amount_mm,
    coverage_fraction: candidate.coverage_fraction,
    eligible_for_state_input: candidate.eligible_for_state_input,
    source_quality: candidate.source_quality,
    execution_status: candidate.execution_status,
  });
}

function chooseIdenticalDuplicateWinnerV1(candidates: ExecutedIrrigationCandidateV1[]): ExecutedIrrigationCandidateV1 {
  return [...candidates].sort((left, right) => {
    const ingested = compareIsoInstantV1(right.ingested_at, left.ingested_at);
    if (ingested !== 0) return ingested;
    return left.source_record_id.localeCompare(right.source_record_id);
  })[0];
}

export function aggregateExecutedIrrigationV1(input: {
  candidates: unknown[];
  interval_start_exclusive: string;
  interval_end_inclusive: string;
}): ExecutedIrrigationAggregationV1 {
  const intervalStart = requireCanonicalIsoV1(input.interval_start_exclusive, "EXECUTION_INTERVAL_START_REQUIRED");
  const intervalEnd = requireCanonicalIsoV1(input.interval_end_inclusive, "EXECUTION_INTERVAL_END_REQUIRED");
  if (compareIsoInstantV1(intervalStart, intervalEnd) >= 0) throw new Error("EXECUTION_INTERVAL_INVALID");
  if (!Array.isArray(input.candidates)) throw new Error("EXECUTION_CANDIDATES_REQUIRED");

  const validated = input.candidates.map(validateCandidateV1);
  const grouped = new Map<string, ExecutedIrrigationCandidateV1[]>();
  for (const candidate of validated) {
    const key = semanticIdentityV1(candidate);
    const group = grouped.get(key) ?? [];
    group.push(candidate);
    grouped.set(key, group);
  }

  const identicalDuplicateRecordIds: string[] = [];
  const deduplicated: ExecutedIrrigationCandidateV1[] = [];
  for (const group of grouped.values()) {
    const payloads = new Set(group.map(canonicalPayloadV1));
    if (payloads.size > 1) throw new Error("CONFLICTING_DUPLICATE_EVIDENCE");
    const winner = chooseIdenticalDuplicateWinnerV1(group);
    deduplicated.push(winner);
    for (const candidate of group) {
      if (candidate.source_record_id !== winner.source_record_id) identicalDuplicateRecordIds.push(candidate.source_record_id);
    }
  }

  const excludedRecordIds: string[] = [];
  const selected = deduplicated.filter((candidate) => {
    const inInterval = compareIsoInstantV1(candidate.executed_at, intervalStart) > 0 && compareIsoInstantV1(candidate.executed_at, intervalEnd) <= 0;
    const eligible = candidate.eligible_for_state_input && candidate.source_quality === "USABLE" && inInterval;
    if (!eligible) excludedRecordIds.push(candidate.source_record_id);
    return eligible;
  }).sort((left, right) => {
    const executed = compareIsoInstantV1(left.executed_at, right.executed_at);
    if (executed !== 0) return executed;
    const ingested = compareIsoInstantV1(left.ingested_at, right.ingested_at);
    if (ingested !== 0) return ingested;
    return left.source_record_id.localeCompare(right.source_record_id);
  });

  let totalUnits = 0n;
  const selectedEvents = selected.map((candidate): ExecutedIrrigationTraceEventV1 => {
    const amountUnits = parseFixedDecimalV1(candidate.executed_amount_mm, WATER_AMOUNT_SCALE_V1);
    const coverageUnits = parseFixedDecimalV1(candidate.coverage_fraction, WATER_AMOUNT_SCALE_V1);
    const effectiveUnits = multiplyFixedUnitsV1(
      amountUnits,
      WATER_AMOUNT_SCALE_V1,
      coverageUnits,
      WATER_AMOUNT_SCALE_V1,
      WATER_AMOUNT_SCALE_V1,
    );
    totalUnits += effectiveUnits;
    return {
      source_record_id: candidate.source_record_id,
      executed_at: candidate.executed_at,
      ingested_at: candidate.ingested_at,
      executed_amount_mm: candidate.executed_amount_mm,
      coverage_fraction: candidate.coverage_fraction,
      effective_irrigation_mm: formatFixedDecimalV1(effectiveUnits, WATER_AMOUNT_SCALE_V1),
    };
  });

  return {
    policy_id: EXECUTED_IRRIGATION_INPUT_POLICY_ID_V1,
    deterministic_order: EXECUTED_IRRIGATION_ORDER_V1,
    spatial_overlap_deduplication: EXECUTED_IRRIGATION_SPATIAL_OVERLAP_POLICY_V1,
    selected_events: selectedEvents,
    identical_duplicate_record_ids: identicalDuplicateRecordIds.sort(),
    excluded_record_ids: excludedRecordIds.sort(),
    effective_irrigation_mm: formatFixedDecimalV1(totalUnits, WATER_AMOUNT_SCALE_V1),
  };
}
