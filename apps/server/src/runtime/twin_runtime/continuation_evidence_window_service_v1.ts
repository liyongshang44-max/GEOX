// apps/server/src/runtime/twin_runtime/continuation_evidence_window_service_v1.ts
// Purpose: build one deterministic continuation Evidence Window for an explicit Replay logical hour, select exact-hour rainfall and ET0, select eligible execution Evidence, resolve crop-stage configuration context, and preserve complete model-consumption trace semantics.
// Boundary: pure application logic over caller-supplied records and configuration context; no filesystem, database, environment, scheduler, network, wall clock, persistence, checkpoint advancement, or Runtime tick execution.

import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalReplayEvidenceRecordV1, ReplayEvidenceRoleV1, TwinScopeKeyV1 } from "./ports.js";

export const CONTINUATION_EVIDENCE_WINDOW_RULE_V1 = "OPEN_START_CLOSED_END_PT1H_V1" as const;
export const EXACT_HOUR_INTERVAL_POLICY_V1 = "EXACT_INTERVAL_START_END_MATCH_V1" as const;
export const IDENTICAL_DUPLICATE_WINNER_POLICY_V1 = "INGESTED_DESC_SOURCE_RECORD_ID_ASC_V1" as const;
export const CROP_STAGE_RESOLUTION_POLICY_V1 = "CONFIGURATION_EFFECTIVE_INTERVAL_AT_LOGICAL_TIME_V1" as const;

export type ContinuationEvidenceConsumptionStatusV1 =
  | "CONSUMED_BY_DYNAMICS"
  | "AVAILABLE_NOT_CONSUMED_MCFT_CAP_02"
  | "CONTEXT_ONLY_NOT_EXECUTED"
  | "AVAILABLE_NOT_CONSUMED_FORECAST_BLOCKED"
  | "EXCLUDED_LATE"
  | "EXCLUDED_FUTURE"
  | "EXCLUDED_QUALITY"
  | "EXCLUDED_SCOPE"
  | "EXCLUDED_CONFLICT"
  | "EXCLUDED_INTERVAL_MISMATCH";

export type ContinuationEvidenceWindowDispositionV1 =
  | "INCLUDED_EXACT_INTERVAL"
  | "INCLUDED_EVENT_WINDOW"
  | "INCLUDED_CONTEXT"
  | "DEDUPLICATED_IDENTICAL"
  | "EXCLUDED_LATE"
  | "EXCLUDED_FUTURE"
  | "EXCLUDED_QUALITY"
  | "EXCLUDED_SCOPE"
  | "EXCLUDED_INTERVAL_MISMATCH"
  | "EXCLUDED_OUTSIDE_WINDOW";

export type ContinuationCropStageScheduleEntryV1 = {
  stage_code: string;
  effective_from: string;
  effective_to: string;
  kc: number;
  crop_root_depth_mm?: number;
  effective_model_root_depth_mm?: number;
};

export type ContinuationCropStageConfigurationContextV1 = {
  schema_version: string;
  dataset_id: string;
  context_class: "CONFIGURATION_DERIVED_CONTEXT";
  evidence_record: false;
  configuration_matrix_ref: string;
  configuration_matrix_hash: string;
  crop_water_use_binding_ref: string;
  crop_water_use_configuration_source_id: string;
  crop_stage_mapping_source: string;
  timezone: "UTC";
  coverage_start: string;
  coverage_end_exclusive: string;
  crop_stage_schedule: ContinuationCropStageScheduleEntryV1[];
  limitations: string[];
  determinism_hash: string;
};

export type ResolvedContinuationCropStageContextV1 = {
  context_kind: "CONFIGURATION_DERIVED_CONTEXT";
  context_ref: string;
  context_hash: string;
  configuration_matrix_ref: string;
  configuration_matrix_hash: string;
  crop_water_use_binding_ref: string;
  crop_water_use_configuration_source_id: string;
  crop_stage_mapping_source: string;
  resolution_policy_id: typeof CROP_STAGE_RESOLUTION_POLICY_V1;
  stage_code: string;
  effective_from: string;
  effective_to: string;
  kc: number;
  non_consumed_crop_root_depth_mm: number | null;
  non_consumed_effective_model_root_depth_mm: number | null;
  limitations: string[];
};

export type ContinuationEvidenceRecordSummaryV1 = {
  source_record_id: string;
  source_record_hash: string;
  binding_id: string;
  origin_source_id: string;
  role: ReplayEvidenceRoleV1;
  event_time: string;
  interval_start: string | null;
  interval_end: string | null;
  ingested_at: string;
  available_to_runtime_at: string;
  quality_status: string;
  freshness: {
    age_seconds: number;
    status: "CURRENT_WINDOW" | "FUTURE_EVENT" | "AVAILABLE_AFTER_TICK" | "OUTSIDE_WINDOW" | "SCOPE_MISMATCH";
  };
  unit_conversion: {
    source_unit: string;
    canonical_unit: string;
    conversion_rule: Record<string, unknown>;
  };
  limitations: string[];
  window_disposition: ContinuationEvidenceWindowDispositionV1;
  model_consumption_status: ContinuationEvidenceConsumptionStatusV1;
  exclusion_reason: string | null;
  semantic_identity: string;
  canonical_payload_hash: string;
};

export type ContinuationEvidenceWindowV1 = {
  window_rule_id: typeof CONTINUATION_EVIDENCE_WINDOW_RULE_V1;
  exact_hour_interval_policy_id: typeof EXACT_HOUR_INTERVAL_POLICY_V1;
  identical_duplicate_winner_policy_id: typeof IDENTICAL_DUPLICATE_WINNER_POLICY_V1;
  logical_time: string;
  window_start_exclusive: string;
  window_end_inclusive: string;
  frozen: true;
  candidate_record_count: number;
  selected_records: ContinuationEvidenceRecordSummaryV1[];
  excluded_records: ContinuationEvidenceRecordSummaryV1[];
  deduplicated_records: ContinuationEvidenceRecordSummaryV1[];
  selected_evidence_refs: string[];
  consumed_evidence_refs: string[];
  context_only_evidence_refs: string[];
  rainfall_record: CanonicalReplayEvidenceRecordV1;
  historical_et0_record: CanonicalReplayEvidenceRecordV1;
  irrigation_execution_records: CanonicalReplayEvidenceRecordV1[];
  soil_moisture_records: CanonicalReplayEvidenceRecordV1[];
  approved_irrigation_plan_records: CanonicalReplayEvidenceRecordV1[];
  future_weather_assumption_records: CanonicalReplayEvidenceRecordV1[];
  future_et0_assumption_records: CanonicalReplayEvidenceRecordV1[];
  crop_stage_context: ResolvedContinuationCropStageContextV1;
  coverage: {
    selected_record_count: number;
    consumed_record_count: number;
    context_only_record_count: number;
    deduplicated_record_count: number;
    rainfall_observation_count: number;
    historical_et0_input_count: number;
    irrigation_execution_evidence_count: number;
    soil_moisture_observation_count: number;
    approved_irrigation_plan_count: number;
    future_weather_assumption_count: number;
    future_et0_assumption_count: number;
  };
  exclusion_counts: Record<string, number>;
  semantic_digest: string;
};

type ClassifiedContinuationEvidenceV1 = {
  record: CanonicalReplayEvidenceRecordV1;
  role: ReplayEvidenceRoleV1;
  event_time: string;
  interval_start: string | null;
  interval_end: string | null;
  ingested_at: string;
  available_to_runtime_at: string;
  disposition: ContinuationEvidenceWindowDispositionV1;
  consumption_status: ContinuationEvidenceConsumptionStatusV1;
  exclusion_reason: string | null;
  semantic_identity: string;
  canonical_payload_hash: string;
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
  return new Date(Date.parse(value)).toISOString();
}

function previousHourIsoV1(logicalTime: string): string {
  return new Date(Date.parse(logicalTime) - 60 * 60 * 1000).toISOString();
}

function sameScopeV1(record: CanonicalReplayEvidenceRecordV1, scope: TwinScopeKeyV1): boolean {
  return record.tenant_id === scope.tenant_id
    && record.project_id === scope.project_id
    && record.group_id === scope.group_id
    && record.field_id === scope.field_id
    && record.season_id === scope.season_id
    && record.zone_id === scope.zone_id;
}

function scopeIdentityV1(record: CanonicalReplayEvidenceRecordV1): string {
  return [record.tenant_id, record.project_id, record.group_id, record.field_id, record.season_id, record.zone_id].join("|");
}

function roleForRecordV1(record: CanonicalReplayEvidenceRecordV1): ReplayEvidenceRoleV1 {
  const role = RECORD_TYPE_TO_ROLE_V1[record.record_type];
  if (!role) throw new Error(`UNSUPPORTED_REPLAY_RECORD_TYPE:${record.record_type}`);
  return role;
}

function roleEventTimeV1(record: CanonicalReplayEvidenceRecordV1, role: ReplayEvidenceRoleV1): string {
  return requireIsoInstantV1(record.role_time?.[ROLE_EVENT_FIELD_V1[role]], `ROLE_EVENT_TIME_REQUIRED:${role}`);
}

function roleIntervalV1(record: CanonicalReplayEvidenceRecordV1, role: ReplayEvidenceRoleV1): { interval_start: string | null; interval_end: string | null } {
  if (role !== "RAINFALL_OBSERVATION" && role !== "HISTORICAL_ET0_INPUT") return { interval_start: null, interval_end: null };
  return {
    interval_start: requireIsoInstantV1(record.role_time?.interval_start, `INTERVAL_START_REQUIRED:${role}`),
    interval_end: requireIsoInstantV1(record.role_time?.interval_end, `INTERVAL_END_REQUIRED:${role}`),
  };
}

function qualityUsableV1(record: CanonicalReplayEvidenceRecordV1): boolean {
  return record.quality?.status === "PASS" || record.quality?.status === "LIMITED";
}

function semanticIdentityV1(record: CanonicalReplayEvidenceRecordV1, role: ReplayEvidenceRoleV1, eventTime: string, intervalStart: string | null, intervalEnd: string | null): string {
  const base = [record.binding_id, record.origin_source_id, scopeIdentityV1(record)];
  if (role === "RAINFALL_OBSERVATION") return [...base, intervalStart, intervalEnd].join("|");
  if (role === "HISTORICAL_ET0_INPUT") {
    return [
      ...base,
      intervalStart,
      intervalEnd,
      String(record.role_time?.calculation_method ?? record.canonical_payload.calculation_method ?? ""),
      String(record.role_time?.method_version ?? record.canonical_payload.method_version ?? ""),
    ].join("|");
  }
  if (role === "IRRIGATION_EXECUTION_EVIDENCE") {
    const eventId = record.canonical_payload.event_id ?? record.source_payload.event_id;
    if (typeof eventId !== "string" || eventId.length === 0) throw new Error("EXECUTION_STABLE_IDENTITY_REQUIRED");
    return [...base, eventTime, eventId].join("|");
  }
  return [...base, eventTime, record.source_record_id].join("|");
}

function consumptionStatusForIncludedRoleV1(role: ReplayEvidenceRoleV1): ContinuationEvidenceConsumptionStatusV1 {
  if (role === "RAINFALL_OBSERVATION" || role === "HISTORICAL_ET0_INPUT" || role === "IRRIGATION_EXECUTION_EVIDENCE") return "CONSUMED_BY_DYNAMICS";
  if (role === "SOIL_MOISTURE_OBSERVATION") return "AVAILABLE_NOT_CONSUMED_MCFT_CAP_02";
  if (role === "APPROVED_IRRIGATION_PLAN") return "CONTEXT_ONLY_NOT_EXECUTED";
  return "AVAILABLE_NOT_CONSUMED_FORECAST_BLOCKED";
}

function freshnessStatusV1(item: ClassifiedContinuationEvidenceV1): ContinuationEvidenceRecordSummaryV1["freshness"]["status"] {
  if (item.disposition === "EXCLUDED_SCOPE") return "SCOPE_MISMATCH";
  if (item.disposition === "EXCLUDED_FUTURE") return "FUTURE_EVENT";
  if (item.disposition === "EXCLUDED_LATE") return "AVAILABLE_AFTER_TICK";
  if (item.disposition === "EXCLUDED_OUTSIDE_WINDOW" || item.disposition === "EXCLUDED_INTERVAL_MISMATCH") return "OUTSIDE_WINDOW";
  return "CURRENT_WINDOW";
}

function summaryV1(item: ClassifiedContinuationEvidenceV1, logicalTime: string): ContinuationEvidenceRecordSummaryV1 {
  return {
    source_record_id: item.record.source_record_id,
    source_record_hash: item.record.source_record_hash,
    binding_id: item.record.binding_id,
    origin_source_id: item.record.origin_source_id,
    role: item.role,
    event_time: item.event_time,
    interval_start: item.interval_start,
    interval_end: item.interval_end,
    ingested_at: item.ingested_at,
    available_to_runtime_at: item.available_to_runtime_at,
    quality_status: String(item.record.quality?.status ?? "UNKNOWN"),
    freshness: {
      age_seconds: Math.trunc((Date.parse(logicalTime) - Date.parse(item.event_time)) / 1000),
      status: freshnessStatusV1(item),
    },
    unit_conversion: {
      source_unit: item.record.source_unit,
      canonical_unit: item.record.canonical_unit,
      conversion_rule: structuredClone(item.record.conversion_rule),
    },
    limitations: [...item.record.limitations],
    window_disposition: item.disposition,
    model_consumption_status: item.consumption_status,
    exclusion_reason: item.exclusion_reason,
    semantic_identity: item.semantic_identity,
    canonical_payload_hash: item.canonical_payload_hash,
  };
}

function compareSummaryV1(a: ContinuationEvidenceRecordSummaryV1, b: ContinuationEvidenceRecordSummaryV1): number {
  return a.role.localeCompare(b.role)
    || a.event_time.localeCompare(b.event_time)
    || a.ingested_at.localeCompare(b.ingested_at)
    || a.source_record_id.localeCompare(b.source_record_id);
}

function compareDuplicateWinnerV1(a: ClassifiedContinuationEvidenceV1, b: ClassifiedContinuationEvidenceV1): number {
  return b.ingested_at.localeCompare(a.ingested_at) || a.record.source_record_id.localeCompare(b.record.source_record_id);
}

function validateExecutionInputV1(record: CanonicalReplayEvidenceRecordV1): void {
  const amount = record.canonical_payload.executed_amount_mm;
  const coverage = record.canonical_payload.coverage_fraction;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) throw new Error("EXECUTED_AMOUNT_REQUIRED");
  if (typeof coverage !== "number" || !Number.isFinite(coverage) || coverage < 0 || coverage > 1) throw new Error("EXECUTION_COVERAGE_OUT_OF_RANGE");
  for (const forbidden of ["approved_amount_mm", "planned_amount_mm", "dispatched_amount_mm"]) {
    if (forbidden in record.canonical_payload || forbidden in record.source_payload) throw new Error(`NON_EXECUTED_IRRIGATION_AMOUNT_FORBIDDEN:${forbidden}`);
  }
}

function classifyRecordV1(input: {
  record: CanonicalReplayEvidenceRecordV1;
  scope: TwinScopeKeyV1;
  logical_time: string;
  window_start: string;
}): ClassifiedContinuationEvidenceV1 {
  const role = roleForRecordV1(input.record);
  const eventTime = roleEventTimeV1(input.record, role);
  const interval = roleIntervalV1(input.record, role);
  const ingestedAt = requireIsoInstantV1(input.record.role_time?.ingested_at, "INGESTED_AT_REQUIRED");
  const availableAt = requireIsoInstantV1(input.record.available_to_runtime_at, "AVAILABLE_TO_RUNTIME_INVALID");
  const canonicalPayloadHash = semanticHashV1(input.record.canonical_payload);
  const identity = semanticIdentityV1(input.record, role, eventTime, interval.interval_start, interval.interval_end);
  const base = {
    record: input.record,
    role,
    event_time: eventTime,
    interval_start: interval.interval_start,
    interval_end: interval.interval_end,
    ingested_at: ingestedAt,
    available_to_runtime_at: availableAt,
    semantic_identity: identity,
    canonical_payload_hash: canonicalPayloadHash,
  };

  if (!sameScopeV1(input.record, input.scope)) return { ...base, disposition: "EXCLUDED_SCOPE", consumption_status: "EXCLUDED_SCOPE", exclusion_reason: "EVIDENCE_SCOPE_MISMATCH" };
  if (eventTime > input.logical_time) return { ...base, disposition: "EXCLUDED_FUTURE", consumption_status: "EXCLUDED_FUTURE", exclusion_reason: "FUTURE_EVIDENCE_FORBIDDEN" };
  if (availableAt > input.logical_time || ingestedAt > input.logical_time) return { ...base, disposition: "EXCLUDED_LATE", consumption_status: "EXCLUDED_LATE", exclusion_reason: "NOT_AVAILABLE_AT_LOGICAL_TICK" };
  if (!qualityUsableV1(input.record)) return { ...base, disposition: "EXCLUDED_QUALITY", consumption_status: "EXCLUDED_QUALITY", exclusion_reason: "QUALITY_NOT_USABLE" };

  if (role === "RAINFALL_OBSERVATION" || role === "HISTORICAL_ET0_INPUT") {
    if (interval.interval_start !== input.window_start || interval.interval_end !== input.logical_time) {
      return { ...base, disposition: "EXCLUDED_INTERVAL_MISMATCH", consumption_status: "EXCLUDED_INTERVAL_MISMATCH", exclusion_reason: "EXACT_HOUR_INTERVAL_MISMATCH" };
    }
    return { ...base, disposition: "INCLUDED_EXACT_INTERVAL", consumption_status: "CONSUMED_BY_DYNAMICS", exclusion_reason: null };
  }

  if (eventTime <= input.window_start) return { ...base, disposition: "EXCLUDED_OUTSIDE_WINDOW", consumption_status: "EXCLUDED_INTERVAL_MISMATCH", exclusion_reason: "OUTSIDE_OPEN_START_CLOSED_END_WINDOW" };
  if (role === "IRRIGATION_EXECUTION_EVIDENCE") validateExecutionInputV1(input.record);
  return {
    ...base,
    disposition: role === "APPROVED_IRRIGATION_PLAN" || role === "FUTURE_WEATHER_ASSUMPTION" || role === "FUTURE_ET0_ASSUMPTION" ? "INCLUDED_CONTEXT" : "INCLUDED_EVENT_WINDOW",
    consumption_status: consumptionStatusForIncludedRoleV1(role),
    exclusion_reason: null,
  };
}

function deduplicateIncludedV1(included: readonly ClassifiedContinuationEvidenceV1[]): {
  winners: ClassifiedContinuationEvidenceV1[];
  duplicates: ClassifiedContinuationEvidenceV1[];
} {
  const groups = new Map<string, ClassifiedContinuationEvidenceV1[]>();
  for (const item of included) {
    const key = `${item.role}|${item.semantic_identity}`;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  const winners: ClassifiedContinuationEvidenceV1[] = [];
  const duplicates: ClassifiedContinuationEvidenceV1[] = [];
  for (const [key, group] of groups) {
    const payloadHashes = new Set(group.map((item) => item.canonical_payload_hash));
    if (payloadHashes.size > 1) throw new Error(`CONFLICTING_DUPLICATE_EVIDENCE:${key}`);
    group.sort(compareDuplicateWinnerV1);
    winners.push(group[0]);
    for (const duplicate of group.slice(1)) {
      duplicates.push({
        ...duplicate,
        disposition: "DEDUPLICATED_IDENTICAL",
        consumption_status: "AVAILABLE_NOT_CONSUMED_MCFT_CAP_02",
        exclusion_reason: "IDENTICAL_DUPLICATE_DEDUPLICATED",
      });
    }
  }
  return { winners, duplicates };
}

function requireSingleExactRecordV1(items: readonly ClassifiedContinuationEvidenceV1[], role: "RAINFALL_OBSERVATION" | "HISTORICAL_ET0_INPUT"): CanonicalReplayEvidenceRecordV1 {
  const matches = items.filter((item) => item.role === role);
  if (matches.length === 0) throw new Error(role === "RAINFALL_OBSERVATION" ? "MISSING_EXACT_HOURLY_RAINFALL_INTERVAL" : "MISSING_EXACT_HOURLY_ET0_INTERVAL");
  if (matches.length > 1) throw new Error(role === "RAINFALL_OBSERVATION" ? "MULTIPLE_EXACT_HOURLY_RAINFALL_INTERVALS" : "MULTIPLE_EXACT_HOURLY_ET0_INTERVALS");
  return matches[0].record;
}

export function resolveContinuationCropStageContextV1(input: {
  logical_time: string;
  context_ref: string;
  context_hash: string;
  context: ContinuationCropStageConfigurationContextV1;
}): ResolvedContinuationCropStageContextV1 {
  const logicalTime = requireIsoInstantV1(input.logical_time, "LOGICAL_TIME_INVALID");
  if (input.context.context_class !== "CONFIGURATION_DERIVED_CONTEXT" || input.context.evidence_record !== false) throw new Error("CROP_STAGE_CONTEXT_CLASS_INVALID");
  if (input.context.determinism_hash !== input.context_hash) throw new Error("CROP_STAGE_CONTEXT_HASH_MISMATCH");
  if (input.context.timezone !== "UTC") throw new Error("CROP_STAGE_CONTEXT_TIMEZONE_MUST_BE_UTC");
  if (logicalTime < requireIsoInstantV1(input.context.coverage_start, "CROP_STAGE_COVERAGE_START_INVALID") || logicalTime >= requireIsoInstantV1(input.context.coverage_end_exclusive, "CROP_STAGE_COVERAGE_END_INVALID")) throw new Error("CROP_STAGE_CONTEXT_OUTSIDE_COVERAGE");

  const matches = input.context.crop_stage_schedule.filter((stage) => {
    const from = requireIsoInstantV1(stage.effective_from, "CROP_STAGE_EFFECTIVE_FROM_INVALID");
    const to = requireIsoInstantV1(stage.effective_to, "CROP_STAGE_EFFECTIVE_TO_INVALID");
    return logicalTime >= from && logicalTime < to;
  });
  if (matches.length !== 1) throw new Error(matches.length === 0 ? "CROP_STAGE_CONTEXT_MISSING" : "CROP_STAGE_CONTEXT_OVERLAP");
  const stage = matches[0];
  if (!Number.isFinite(stage.kc) || stage.kc < 0) throw new Error("CROP_STAGE_KC_INVALID");

  return {
    context_kind: "CONFIGURATION_DERIVED_CONTEXT",
    context_ref: input.context_ref,
    context_hash: input.context_hash,
    configuration_matrix_ref: input.context.configuration_matrix_ref,
    configuration_matrix_hash: input.context.configuration_matrix_hash,
    crop_water_use_binding_ref: input.context.crop_water_use_binding_ref,
    crop_water_use_configuration_source_id: input.context.crop_water_use_configuration_source_id,
    crop_stage_mapping_source: input.context.crop_stage_mapping_source,
    resolution_policy_id: CROP_STAGE_RESOLUTION_POLICY_V1,
    stage_code: stage.stage_code,
    effective_from: requireIsoInstantV1(stage.effective_from, "CROP_STAGE_EFFECTIVE_FROM_INVALID"),
    effective_to: requireIsoInstantV1(stage.effective_to, "CROP_STAGE_EFFECTIVE_TO_INVALID"),
    kc: stage.kc,
    non_consumed_crop_root_depth_mm: Number.isFinite(stage.crop_root_depth_mm) ? Number(stage.crop_root_depth_mm) : null,
    non_consumed_effective_model_root_depth_mm: Number.isFinite(stage.effective_model_root_depth_mm) ? Number(stage.effective_model_root_depth_mm) : null,
    limitations: [...input.context.limitations, "crop root-depth fields are recorded but not consumed by MCFT-CAP-02 State geometry"],
  };
}

export function buildContinuationEvidenceWindowV1(input: {
  scope: TwinScopeKeyV1;
  logical_time: string;
  candidate_records: readonly CanonicalReplayEvidenceRecordV1[];
  crop_stage_context_ref: string;
  crop_stage_context_hash: string;
  crop_stage_context: ContinuationCropStageConfigurationContextV1;
}): ContinuationEvidenceWindowV1 {
  const logicalTime = requireIsoInstantV1(input.logical_time, "LOGICAL_TIME_INVALID");
  const windowStart = previousHourIsoV1(logicalTime);
  const classified = input.candidate_records.map((record) => classifyRecordV1({ record, scope: input.scope, logical_time: logicalTime, window_start: windowStart }));
  const included = classified.filter((item) => item.exclusion_reason === null);
  const excluded = classified.filter((item) => item.exclusion_reason !== null);
  const { winners, duplicates } = deduplicateIncludedV1(included);

  const rainfallRecord = requireSingleExactRecordV1(winners, "RAINFALL_OBSERVATION");
  const historicalEt0Record = requireSingleExactRecordV1(winners, "HISTORICAL_ET0_INPUT");
  const cropStageContext = resolveContinuationCropStageContextV1({
    logical_time: logicalTime,
    context_ref: input.crop_stage_context_ref,
    context_hash: input.crop_stage_context_hash,
    context: input.crop_stage_context,
  });

  const selectedSummaries = winners.map((item) => summaryV1(item, logicalTime)).sort(compareSummaryV1);
  const excludedSummaries = excluded.map((item) => summaryV1(item, logicalTime)).sort(compareSummaryV1);
  const duplicateSummaries = duplicates.map((item) => summaryV1(item, logicalTime)).sort(compareSummaryV1);
  const selectedEvidenceRefs = selectedSummaries.map((item) => item.source_record_id);
  const consumedEvidenceRefs = selectedSummaries.filter((item) => item.model_consumption_status === "CONSUMED_BY_DYNAMICS").map((item) => item.source_record_id);
  const contextOnlyEvidenceRefs = selectedSummaries.filter((item) => item.model_consumption_status !== "CONSUMED_BY_DYNAMICS").map((item) => item.source_record_id);
  const recordsForRole = (role: ReplayEvidenceRoleV1) => winners.filter((item) => item.role === role).map((item) => item.record);
  const countRole = (role: ReplayEvidenceRoleV1) => selectedSummaries.filter((item) => item.role === role).length;
  const exclusionCounts: Record<string, number> = {};
  for (const item of [...excludedSummaries, ...duplicateSummaries]) {
    const reason = item.exclusion_reason ?? "NONE";
    exclusionCounts[reason] = (exclusionCounts[reason] ?? 0) + 1;
  }

  const semanticCore = {
    window_rule_id: CONTINUATION_EVIDENCE_WINDOW_RULE_V1,
    exact_hour_interval_policy_id: EXACT_HOUR_INTERVAL_POLICY_V1,
    identical_duplicate_winner_policy_id: IDENTICAL_DUPLICATE_WINNER_POLICY_V1,
    logical_time: logicalTime,
    window_start_exclusive: windowStart,
    window_end_inclusive: logicalTime,
    selected_records: selectedSummaries,
    excluded_records: excludedSummaries,
    deduplicated_records: duplicateSummaries,
    crop_stage_context: cropStageContext,
  };

  return {
    window_rule_id: CONTINUATION_EVIDENCE_WINDOW_RULE_V1,
    exact_hour_interval_policy_id: EXACT_HOUR_INTERVAL_POLICY_V1,
    identical_duplicate_winner_policy_id: IDENTICAL_DUPLICATE_WINNER_POLICY_V1,
    logical_time: logicalTime,
    window_start_exclusive: windowStart,
    window_end_inclusive: logicalTime,
    frozen: true,
    candidate_record_count: input.candidate_records.length,
    selected_records: selectedSummaries,
    excluded_records: excludedSummaries,
    deduplicated_records: duplicateSummaries,
    selected_evidence_refs: selectedEvidenceRefs,
    consumed_evidence_refs: consumedEvidenceRefs,
    context_only_evidence_refs: contextOnlyEvidenceRefs,
    rainfall_record: rainfallRecord,
    historical_et0_record: historicalEt0Record,
    irrigation_execution_records: recordsForRole("IRRIGATION_EXECUTION_EVIDENCE"),
    soil_moisture_records: recordsForRole("SOIL_MOISTURE_OBSERVATION"),
    approved_irrigation_plan_records: recordsForRole("APPROVED_IRRIGATION_PLAN"),
    future_weather_assumption_records: recordsForRole("FUTURE_WEATHER_ASSUMPTION"),
    future_et0_assumption_records: recordsForRole("FUTURE_ET0_ASSUMPTION"),
    crop_stage_context: cropStageContext,
    coverage: {
      selected_record_count: selectedSummaries.length,
      consumed_record_count: consumedEvidenceRefs.length,
      context_only_record_count: contextOnlyEvidenceRefs.length,
      deduplicated_record_count: duplicateSummaries.length,
      rainfall_observation_count: countRole("RAINFALL_OBSERVATION"),
      historical_et0_input_count: countRole("HISTORICAL_ET0_INPUT"),
      irrigation_execution_evidence_count: countRole("IRRIGATION_EXECUTION_EVIDENCE"),
      soil_moisture_observation_count: countRole("SOIL_MOISTURE_OBSERVATION"),
      approved_irrigation_plan_count: countRole("APPROVED_IRRIGATION_PLAN"),
      future_weather_assumption_count: countRole("FUTURE_WEATHER_ASSUMPTION"),
      future_et0_assumption_count: countRole("FUTURE_ET0_ASSUMPTION"),
    },
    exclusion_counts: Object.fromEntries(Object.entries(exclusionCounts).sort(([a], [b]) => a.localeCompare(b))),
    semantic_digest: semanticHashV1(semanticCore),
  };
}
