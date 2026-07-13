// apps/server/src/runtime/twin_runtime/future_forcing_selector_v1.ts
// Purpose: select the latest complete matching weather/ET0 forcing-cycle pair available at logical time T, collapse identical duplicates, reject conflicts, and build the exact 72-point Forecast forcing window.
// Boundary: deterministic application logic over caller-supplied canonical Replay Evidence; no persistence, Forecast equations, Scenario equations, scheduler, filesystem, network, environment, or wall-clock reads.

import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import {
  CAP04_FUTURE_FORCING_BLOCK_REASON_V1,
  CAP04_FUTURE_FORCING_POINT_COUNT_V1,
  CAP04_FUTURE_FORCING_SELECTION_POLICY_ID_V1,
  computeCap04ForcingWindowHashV1,
  deriveCap04ForcingCycleKeyV1,
  validateCap04ForecastForcingWindowV1,
  type Cap04ForecastForcingPointV1,
  type Cap04ForecastForcingWindowV1,
  type Cap04ForcingCycleBasisV1,
  type Cap04FutureForcingSelectionResultV1,
  type Cap04FutureForcingSelectionTraceV1,
} from "../../domain/twin_runtime/future_forcing_contracts_v1.js";
import {
  CAP04_FUTURE_FORCING_FALLBACK_POLICY_ID_V1,
  CAP04_FUTURE_FORCING_FRESHNESS_POLICY_ID_V1,
  CAP04_FUTURE_FORCING_PAIR_POLICY_ID_V1,
  CAP04_FUTURE_FORCING_POLICY_ID_V1,
} from "../../domain/twin_runtime/forecast_scenario_runtime_config_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  TwinScopeKeyV1,
} from "./ports.js";

export type Cap04FutureForcingSelectorInputV1 = {
  scope: TwinScopeKeyV1;
  logical_time: string;
  candidate_records: readonly CanonicalReplayEvidenceRecordV1[];
  authorized_binding_ids: readonly string[];
  crop_stage_context: {
    ref: string;
    hash: string;
    crop_stage_code: string;
    kc: number;
  };
  runtime_config: {
    ref: string;
    hash: string;
  };
};

type SnapshotKindV1 = "FUTURE_WEATHER_ASSUMPTION" | "FUTURE_ET0_ASSUMPTION";

type NormalizedSnapshotPointV1 = {
  horizon_hour: number;
  interval_start: string;
  interval_end: string;
  value_mm: number;
};

type NormalizedSnapshotV1 = {
  snapshot_kind: SnapshotKindV1;
  snapshot_ref: string;
  snapshot_hash: string;
  binding_id: string;
  origin_source_id: string;
  scope: TwinScopeKeyV1;
  issued_at: string;
  available_to_runtime_at: string;
  valid_from: string;
  valid_to: string;
  forcing_cycle_basis: Cap04ForcingCycleBasisV1;
  forcing_cycle_key: string;
  canonical_payload_hash: string;
  points: NormalizedSnapshotPointV1[];
  transformation_refs: string[];
  limitations: string[];
};

type NormalizationResultV1 =
  | { status: "ELIGIBLE"; snapshot: NormalizedSnapshotV1 }
  | { status: "EXCLUDED"; reason_code: string };

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function canonicalIsoV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function canonicalHourV1(value: unknown, code: string): string {
  const text = canonicalIsoV1(value, code);
  if (!text.endsWith(":00:00.000Z")) throw new Error(code);
  return text;
}

function addHoursV1(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 60 * 60 * 1000).toISOString();
}

function sortedUniqueStringsV1(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim()))].sort();
}

function sameScopeV1(record: CanonicalReplayEvidenceRecordV1, scope: TwinScopeKeyV1): boolean {
  return record.tenant_id === scope.tenant_id
    && record.project_id === scope.project_id
    && record.group_id === scope.group_id
    && record.field_id === scope.field_id
    && record.season_id === scope.season_id
    && record.zone_id === scope.zone_id;
}

function scopeFromRecordV1(record: CanonicalReplayEvidenceRecordV1): TwinScopeKeyV1 {
  return {
    tenant_id: record.tenant_id,
    project_id: record.project_id,
    group_id: record.group_id,
    field_id: record.field_id,
    season_id: record.season_id,
    zone_id: record.zone_id,
  };
}

function kindForRecordV1(record: CanonicalReplayEvidenceRecordV1): SnapshotKindV1 | null {
  if (record.record_type === "future_weather_assumption_v1") return "FUTURE_WEATHER_ASSUMPTION";
  if (record.record_type === "future_et0_assumption_v1") return "FUTURE_ET0_ASSUMPTION";
  return null;
}

function transformationRefsV1(record: CanonicalReplayEvidenceRecordV1): string[] {
  const refs: string[] = [];
  const rule = record.conversion_rule;
  if (rule && typeof rule === "object" && !Array.isArray(rule)) {
    for (const field of ["rule_id", "method_id", "transformation_ref"] as const) {
      const value = (rule as Record<string, unknown>)[field];
      if (typeof value === "string" && value.trim()) refs.push(value);
    }
  }
  return sortedUniqueStringsV1(refs);
}

function parseSnapshotPointsV1(
  record: CanonicalReplayEvidenceRecordV1,
  kind: SnapshotKindV1,
  logicalTime: string,
): NormalizedSnapshotPointV1[] | null {
  const payload = record.canonical_payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  if (payload.snapshot_kind !== kind || !Array.isArray(payload.points) || payload.points.length !== CAP04_FUTURE_FORCING_POINT_COUNT_V1) return null;
  const result: NormalizedSnapshotPointV1[] = [];
  for (let index = 0; index < payload.points.length; index += 1) {
    const raw = payload.points[index];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const point = raw as Record<string, unknown>;
    const horizon = index + 1;
    if (point.horizon !== horizon && point.horizon_hour !== horizon) return null;
    const intervalStart = addHoursV1(logicalTime, horizon - 1);
    const intervalEnd = addHoursV1(logicalTime, horizon);
    if (point.valid_from !== intervalStart || point.valid_to !== intervalEnd) return null;
    const value = kind === "FUTURE_WEATHER_ASSUMPTION" ? point.precipitation_mm : point.et0_mm_per_hour;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
    result.push({
      horizon_hour: horizon,
      interval_start: intervalStart,
      interval_end: intervalEnd,
      value_mm: value,
    });
  }
  return result;
}

function normalizeSnapshotV1(
  record: CanonicalReplayEvidenceRecordV1,
  input: Cap04FutureForcingSelectorInputV1,
  logicalTime: string,
  authorizedBindings: ReadonlySet<string>,
): NormalizationResultV1 | null {
  const kind = kindForRecordV1(record);
  if (!kind) return null;
  if (!sameScopeV1(record, input.scope)) return { status: "EXCLUDED", reason_code: "FORCING_SCOPE_MISMATCH" };
  if (!authorizedBindings.has(record.binding_id)) return { status: "EXCLUDED", reason_code: "FORCING_BINDING_NOT_AUTHORIZED" };
  if (record.quality?.status !== "PASS" && record.quality?.status !== "LIMITED") return { status: "EXCLUDED", reason_code: "FORCING_QUALITY_NOT_USABLE" };
  const issuedAt = canonicalIsoV1(record.role_time?.issued_at, "FORCING_ISSUED_AT_INVALID");
  const roleAvailable = canonicalIsoV1(record.role_time?.available_to_runtime_at, "FORCING_ROLE_AVAILABLE_AT_INVALID");
  const availableAt = canonicalIsoV1(record.available_to_runtime_at, "FORCING_AVAILABLE_AT_INVALID");
  const validFrom = canonicalHourV1(record.role_time?.valid_from, "FORCING_VALID_FROM_INVALID");
  const validTo = canonicalHourV1(record.role_time?.valid_to, "FORCING_VALID_TO_INVALID");
  if (roleAvailable !== availableAt) return { status: "EXCLUDED", reason_code: "FORCING_AVAILABILITY_MISMATCH" };
  if (issuedAt > logicalTime) return { status: "EXCLUDED", reason_code: "FORCING_ISSUED_AFTER_LOGICAL_TIME" };
  if (availableAt > logicalTime) return { status: "EXCLUDED", reason_code: "FORCING_AVAILABLE_AFTER_LOGICAL_TIME" };
  if (validFrom !== logicalTime || validTo !== addHoursV1(logicalTime, CAP04_FUTURE_FORCING_POINT_COUNT_V1)) return { status: "EXCLUDED", reason_code: "FORCING_WINDOW_COVERAGE_MISMATCH" };
  const points = parseSnapshotPointsV1(record, kind, logicalTime);
  if (!points) return { status: "EXCLUDED", reason_code: "FORCING_POINTS_NOT_EXACT_72_HOURLY" };
  const scope = scopeFromRecordV1(record);
  const forcingCycleBasis: Cap04ForcingCycleBasisV1 = {
    scope,
    issued_at: issuedAt,
    available_to_runtime_at: availableAt,
    valid_from: validFrom,
    valid_to: validTo,
  };
  return {
    status: "ELIGIBLE",
    snapshot: {
      snapshot_kind: kind,
      snapshot_ref: requiredStringV1(record.source_record_id, "FORCING_SNAPSHOT_REF_REQUIRED"),
      snapshot_hash: requiredStringV1(record.source_record_hash, "FORCING_SNAPSHOT_HASH_REQUIRED"),
      binding_id: requiredStringV1(record.binding_id, "FORCING_BINDING_ID_REQUIRED"),
      origin_source_id: requiredStringV1(record.origin_source_id, "FORCING_ORIGIN_SOURCE_ID_REQUIRED"),
      scope,
      issued_at: issuedAt,
      available_to_runtime_at: availableAt,
      valid_from: validFrom,
      valid_to: validTo,
      forcing_cycle_basis: forcingCycleBasis,
      forcing_cycle_key: deriveCap04ForcingCycleKeyV1(forcingCycleBasis),
      canonical_payload_hash: semanticHashV1(record.canonical_payload),
      points,
      transformation_refs: transformationRefsV1(record),
      limitations: sortedUniqueStringsV1(Array.isArray(record.limitations) ? record.limitations.filter((value): value is string => typeof value === "string") : []),
    },
  };
}

function snapshotSemanticIdentityV1(snapshot: NormalizedSnapshotV1): string {
  return semanticHashV1({
    binding_id: snapshot.binding_id,
    origin_source_id: snapshot.origin_source_id,
    scope: snapshot.scope,
    issued_at: snapshot.issued_at,
    available_to_runtime_at: snapshot.available_to_runtime_at,
    valid_from: snapshot.valid_from,
    valid_to: snapshot.valid_to,
    snapshot_kind: snapshot.snapshot_kind,
  });
}

function collapseIdenticalDuplicatesV1(snapshots: readonly NormalizedSnapshotV1[]): NormalizedSnapshotV1[] {
  const groups = new Map<string, NormalizedSnapshotV1[]>();
  for (const snapshot of snapshots) {
    const key = snapshotSemanticIdentityV1(snapshot);
    const group = groups.get(key) ?? [];
    group.push(snapshot);
    groups.set(key, group);
  }
  const collapsed: NormalizedSnapshotV1[] = [];
  for (const [identity, group] of groups) {
    const payloadHashes = new Set(group.map((snapshot) => snapshot.canonical_payload_hash));
    if (payloadHashes.size > 1) throw new Error(`CONFLICTING_FORCING_SNAPSHOT:${identity}`);
    group.sort((left, right) => left.snapshot_ref.localeCompare(right.snapshot_ref) || left.snapshot_hash.localeCompare(right.snapshot_hash));
    collapsed.push(group[0]);
  }
  return collapsed;
}

function matchingPairsV1(snapshots: readonly NormalizedSnapshotV1[]): Array<{
  forcing_cycle_key: string;
  forcing_cycle_basis: Cap04ForcingCycleBasisV1;
  weather: NormalizedSnapshotV1;
  et0: NormalizedSnapshotV1;
}> {
  const cycles = new Map<string, { basis: Cap04ForcingCycleBasisV1; weather: NormalizedSnapshotV1[]; et0: NormalizedSnapshotV1[] }>();
  for (const snapshot of snapshots) {
    const cycle = cycles.get(snapshot.forcing_cycle_key) ?? { basis: snapshot.forcing_cycle_basis, weather: [], et0: [] };
    if (snapshot.snapshot_kind === "FUTURE_WEATHER_ASSUMPTION") cycle.weather.push(snapshot);
    else cycle.et0.push(snapshot);
    cycles.set(snapshot.forcing_cycle_key, cycle);
  }
  const pairs: Array<{ forcing_cycle_key: string; forcing_cycle_basis: Cap04ForcingCycleBasisV1; weather: NormalizedSnapshotV1; et0: NormalizedSnapshotV1 }> = [];
  for (const [forcingCycleKey, cycle] of cycles) {
    if (cycle.weather.length > 1 || cycle.et0.length > 1) throw new Error(`CONFLICTING_FORCING_CYCLE:${forcingCycleKey}`);
    if (cycle.weather.length === 1 && cycle.et0.length === 1) {
      pairs.push({
        forcing_cycle_key: forcingCycleKey,
        forcing_cycle_basis: cycle.basis,
        weather: cycle.weather[0],
        et0: cycle.et0[0],
      });
    }
  }
  pairs.sort((left, right) =>
    right.forcing_cycle_basis.available_to_runtime_at.localeCompare(left.forcing_cycle_basis.available_to_runtime_at)
    || right.forcing_cycle_basis.issued_at.localeCompare(left.forcing_cycle_basis.issued_at)
    || left.weather.snapshot_ref.localeCompare(right.weather.snapshot_ref)
    || left.et0.snapshot_ref.localeCompare(right.et0.snapshot_ref));
  return pairs;
}

function buildWindowV1(
  input: Cap04FutureForcingSelectorInputV1,
  logicalTime: string,
  pair: {
    forcing_cycle_key: string;
    forcing_cycle_basis: Cap04ForcingCycleBasisV1;
    weather: NormalizedSnapshotV1;
    et0: NormalizedSnapshotV1;
  },
): Cap04ForecastForcingWindowV1 {
  const transformationRefs = sortedUniqueStringsV1([...pair.weather.transformation_refs, ...pair.et0.transformation_refs]);
  const limitations = sortedUniqueStringsV1([...pair.weather.limitations, ...pair.et0.limitations]);
  const points: Cap04ForecastForcingPointV1[] = pair.weather.points.map((weatherPoint, index) => {
    const et0Point = pair.et0.points[index];
    if (!et0Point || et0Point.horizon_hour !== weatherPoint.horizon_hour || et0Point.interval_start !== weatherPoint.interval_start || et0Point.interval_end !== weatherPoint.interval_end) throw new Error("FORCING_PAIR_POINT_ALIGNMENT_MISMATCH");
    return {
      horizon_hour: weatherPoint.horizon_hour,
      interval_start: weatherPoint.interval_start,
      interval_end: weatherPoint.interval_end,
      target_time: weatherPoint.interval_end,
      forcing_cycle_key: pair.forcing_cycle_key,
      precipitation_assumption_mm: weatherPoint.value_mm,
      precipitation_snapshot_ref: pair.weather.snapshot_ref,
      precipitation_snapshot_hash: pair.weather.snapshot_hash,
      precipitation_issued_at: pair.weather.issued_at,
      precipitation_available_to_runtime_at: pair.weather.available_to_runtime_at,
      precipitation_epistemic_status: "ASSUMED",
      et0_assumption_mm: et0Point.value_mm,
      et0_snapshot_ref: pair.et0.snapshot_ref,
      et0_snapshot_hash: pair.et0.snapshot_hash,
      et0_issued_at: pair.et0.issued_at,
      et0_available_to_runtime_at: pair.et0.available_to_runtime_at,
      et0_epistemic_status: "ASSUMED",
      crop_stage_context_ref: input.crop_stage_context.ref,
      crop_stage_context_hash: input.crop_stage_context.hash,
      crop_stage_code: input.crop_stage_context.crop_stage_code,
      kc: input.crop_stage_context.kc,
      runtime_config_ref: input.runtime_config.ref,
      runtime_config_hash: input.runtime_config.hash,
      transformation_refs: [...transformationRefs],
      limitations: [...limitations],
    };
  });
  const window: Cap04ForecastForcingWindowV1 = {
    contract_id: "MCFT_CAP_04_FUTURE_FORCING_WINDOW_V1",
    logical_time: logicalTime,
    selection_policy_id: CAP04_FUTURE_FORCING_SELECTION_POLICY_ID_V1,
    future_forcing_pair_policy_id: CAP04_FUTURE_FORCING_PAIR_POLICY_ID_V1,
    future_forcing_policy_id: CAP04_FUTURE_FORCING_POLICY_ID_V1,
    future_forcing_fallback_policy_id: CAP04_FUTURE_FORCING_FALLBACK_POLICY_ID_V1,
    future_forcing_freshness_policy_id: CAP04_FUTURE_FORCING_FRESHNESS_POLICY_ID_V1,
    forcing_cycle_key: pair.forcing_cycle_key,
    forcing_cycle_basis: structuredClone(pair.forcing_cycle_basis),
    weather_snapshot_ref: pair.weather.snapshot_ref,
    weather_snapshot_hash: pair.weather.snapshot_hash,
    weather_snapshot_issued_at: pair.weather.issued_at,
    weather_snapshot_available_to_runtime_at: pair.weather.available_to_runtime_at,
    et0_snapshot_ref: pair.et0.snapshot_ref,
    et0_snapshot_hash: pair.et0.snapshot_hash,
    et0_snapshot_issued_at: pair.et0.issued_at,
    et0_snapshot_available_to_runtime_at: pair.et0.available_to_runtime_at,
    crop_stage_context_ref: requiredStringV1(input.crop_stage_context.ref, "CROP_STAGE_CONTEXT_REF_REQUIRED"),
    crop_stage_context_hash: requiredStringV1(input.crop_stage_context.hash, "CROP_STAGE_CONTEXT_HASH_REQUIRED"),
    crop_stage_code: requiredStringV1(input.crop_stage_context.crop_stage_code, "CROP_STAGE_CODE_REQUIRED"),
    kc: input.crop_stage_context.kc,
    runtime_config_ref: requiredStringV1(input.runtime_config.ref, "RUNTIME_CONFIG_REF_REQUIRED"),
    runtime_config_hash: requiredStringV1(input.runtime_config.hash, "RUNTIME_CONFIG_HASH_REQUIRED"),
    evidence_refs: sortedUniqueStringsV1([pair.weather.snapshot_ref, pair.et0.snapshot_ref]),
    points,
    forcing_window_hash: computeCap04ForcingWindowHashV1(points),
  };
  validateCap04ForecastForcingWindowV1(window);
  return window;
}

export function selectCap04FutureForcingWindowV1(
  input: Cap04FutureForcingSelectorInputV1,
): Cap04FutureForcingSelectionResultV1 {
  const logicalTime = canonicalHourV1(input.logical_time, "CAP04_FORCING_LOGICAL_TIME_INVALID");
  if (typeof input.crop_stage_context.kc !== "number" || !Number.isFinite(input.crop_stage_context.kc) || input.crop_stage_context.kc < 0) throw new Error("CROP_STAGE_KC_INVALID");
  const authorizedBindings = new Set(input.authorized_binding_ids);
  const excludedReasonCounts: Record<string, number> = {};
  const eligible: NormalizedSnapshotV1[] = [];
  let forcingCandidateCount = 0;
  for (const record of input.candidate_records) {
    const normalized = normalizeSnapshotV1(record, input, logicalTime, authorizedBindings);
    if (!normalized) continue;
    forcingCandidateCount += 1;
    if (normalized.status === "ELIGIBLE") eligible.push(normalized.snapshot);
    else excludedReasonCounts[normalized.reason_code] = (excludedReasonCounts[normalized.reason_code] ?? 0) + 1;
  }
  const collapsed = collapseIdenticalDuplicatesV1(eligible);
  const pairs = matchingPairsV1(collapsed);
  const trace: Cap04FutureForcingSelectionTraceV1 = {
    candidate_snapshot_count: forcingCandidateCount,
    eligible_snapshot_count: eligible.length,
    collapsed_snapshot_count: collapsed.length,
    matching_pair_count: pairs.length,
    excluded_reason_counts: Object.fromEntries(Object.entries(excludedReasonCounts).sort(([left], [right]) => left.localeCompare(right))),
  };
  if (pairs.length === 0) {
    return {
      status: "BLOCKED",
      reason_codes: [CAP04_FUTURE_FORCING_BLOCK_REASON_V1],
      trace,
    };
  }
  return {
    status: "SELECTED",
    window: buildWindowV1(input, logicalTime, pairs[0]),
    trace,
  };
}
