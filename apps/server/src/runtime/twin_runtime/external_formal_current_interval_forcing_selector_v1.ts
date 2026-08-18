// Purpose: resolve the exact current-hour State process forcing without coupling the hourly Runtime scheduler to KBS daily-batch publication.
// Boundary: pure deterministic selection over caller-supplied canonical External Formal records; no database, provider, scheduler, persistence, wall clock, canonical write, or retroactive mutation.

import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
} from "../../domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import {
  MCFT_CAP09_SIGNED_ET0_TO_NONNEGATIVE_WATER_LOSS_DEMAND_POLICY_ID_V1,
  projectSignedEt0ToNonnegativeWaterLossDemandV1,
} from "./external_formal_et0_consumption_projection_v1.js";
import type { CanonicalReplayEvidenceRecordV1, TwinScopeKeyV1 } from "./ports.js";

export const MCFT_CAP09_CURRENT_INTERVAL_STATE_FORCING_AUTHORITY_ID_V1 =
  "MCFT_CAP09_CURRENT_INTERVAL_STATE_FORCING_AUTHORITY_V1" as const;
export const MCFT_CAP09_CURRENT_INTERVAL_STATE_FORCING_SELECTION_POLICY_ID_V1 =
  "EXACT_PROVIDER_PAIR_ELSE_PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR_NO_WAIT_V1" as const;
export const MCFT_CAP09_CURRENT_INTERVAL_FORCING_ASSUMPTION_DEGRADED_REASON_V1 =
  "DELAYED_EXACT_PROVIDER_INTERVAL_NOT_AVAILABLE_AT_BOUNDARY" as const;

export type ExternalFormalCurrentIntervalForcingModeV1 =
  | "EXACT_PROVIDER_INTERVAL_PAIR"
  | "PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR";

export type ExternalFormalCurrentIntervalForcingSelectionV1 = {
  contract_id: typeof MCFT_CAP09_CURRENT_INTERVAL_STATE_FORCING_AUTHORITY_ID_V1;
  selection_policy_id: typeof MCFT_CAP09_CURRENT_INTERVAL_STATE_FORCING_SELECTION_POLICY_ID_V1;
  logical_time: string;
  interval_start: string;
  interval_end: string;
  evidence_snapshot_time: string;
  mode: ExternalFormalCurrentIntervalForcingModeV1;
  runtime_health: "HEALTHY" | "DEGRADED";
  precipitation_mm: number;
  reference_et0_canonical_signed_mm: number;
  reference_et0_model_water_loss_demand_mm: number;
  et0_consumption_transformation_ref: typeof MCFT_CAP09_SIGNED_ET0_TO_NONNEGATIVE_WATER_LOSS_DEMAND_POLICY_ID_V1;
  precipitation_epistemic_class: "OBSERVED" | "ASSUMED";
  et0_epistemic_class: "ESTIMATED" | "ASSUMED";
  source_record_refs: string[];
  source_record_hashes: string[];
  forcing_cycle_basis: null | {
    issued_at: string;
    available_to_runtime_at: string;
    valid_from: string;
    valid_to: string;
    forcing_cycle_key: string;
  };
  exact_provider_pair_available: boolean;
  partial_exact_provider_refs_suppressed: string[];
  provider_wait_required: false;
  completed_tick_retroactive_rewrite_authorized: false;
  relabel_assumption_as_provider_observation_authorized: false;
  limitations: string[];
  selection_hash: string;
};

export type SelectExternalFormalCurrentIntervalForcingInputV1 = {
  scope: TwinScopeKeyV1;
  logical_time: string;
  evidence_snapshot_time: string;
  candidate_records: readonly CanonicalReplayEvidenceRecordV1[];
};

type AssumptionKindV1 = "WEATHER" | "ET0";
type NormalizedAssumptionV1 = {
  kind: AssumptionKindV1;
  record: CanonicalReplayEvidenceRecordV1;
  issued_at: string;
  available_to_runtime_at: string;
  ingested_at: string;
  valid_from: string;
  valid_to: string;
  value_mm: number;
  canonical_payload_hash: string;
};

function requiredTextV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function canonicalIsoV1(value: unknown, code: string): string {
  const text = requiredTextV1(value, code);
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
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}

function sameScopeV1(record: CanonicalReplayEvidenceRecordV1, scope: TwinScopeKeyV1): boolean {
  return record.tenant_id === scope.tenant_id
    && record.project_id === scope.project_id
    && record.group_id === scope.group_id
    && record.field_id === scope.field_id
    && record.season_id === scope.season_id
    && record.zone_id === scope.zone_id;
}

function usableQualityV1(record: CanonicalReplayEvidenceRecordV1): boolean {
  return record.quality?.status === "PASS" || record.quality?.status === "LIMITED";
}

function finiteNumberV1(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(code);
  return value;
}

function uniqueSortedV1(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()))].sort();
}

function validateCausalTimesV1(record: CanonicalReplayEvidenceRecordV1, code: string): {
  available_at: string;
  ingested_at: string;
} {
  const availableAt = canonicalIsoV1(record.available_to_runtime_at, `${code}_AVAILABLE_AT_INVALID`);
  const ingestedAt = canonicalIsoV1(record.role_time?.ingested_at, `${code}_INGESTED_AT_INVALID`);
  if (Date.parse(availableAt) > Date.parse(ingestedAt)) throw new Error(`${code}_CAUSAL_ORDER_INVALID`);
  return { available_at: availableAt, ingested_at: ingestedAt };
}

function normalizeExactProviderRecordV1(input: {
  record: CanonicalReplayEvidenceRecordV1;
  scope: TwinScopeKeyV1;
  logical_time: string;
  interval_start: string;
  evidence_snapshot_time: string;
  kind: "RAINFALL" | "ET0";
}): CanonicalReplayEvidenceRecordV1 | null {
  const expectedType = input.kind === "RAINFALL" ? "observed_rainfall_v1" : "historical_et0_estimate_v1";
  if (input.record.record_type !== expectedType || !sameScopeV1(input.record, input.scope)) return null;
  const expectedBinding = input.kind === "RAINFALL"
    ? MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1
    : MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1;
  const expectedEpistemic = input.kind === "RAINFALL" ? "OBSERVED" : "ESTIMATED";
  if (input.record.binding_id !== expectedBinding) throw new Error(`AMENDMENT19_EXACT_${input.kind}_BINDING_MISMATCH`);
  if (input.record.epistemic_class !== expectedEpistemic) throw new Error(`AMENDMENT19_EXACT_${input.kind}_EPISTEMIC_MISMATCH`);
  if (!usableQualityV1(input.record)) return null;
  const start = canonicalIsoV1(input.record.role_time?.interval_start, `AMENDMENT19_EXACT_${input.kind}_INTERVAL_START_INVALID`);
  const end = canonicalIsoV1(input.record.role_time?.interval_end, `AMENDMENT19_EXACT_${input.kind}_INTERVAL_END_INVALID`);
  if (start !== input.interval_start || end !== input.logical_time) return null;
  const { available_at: availableAt, ingested_at: ingestedAt } = validateCausalTimesV1(input.record, `AMENDMENT19_EXACT_${input.kind}`);
  if (Date.parse(availableAt) > Date.parse(input.evidence_snapshot_time)
    || Date.parse(ingestedAt) > Date.parse(input.evidence_snapshot_time)) return null;
  requiredTextV1(input.record.source_record_id, `AMENDMENT19_EXACT_${input.kind}_SOURCE_REF_REQUIRED`);
  requiredTextV1(input.record.source_record_hash, `AMENDMENT19_EXACT_${input.kind}_SOURCE_HASH_REQUIRED`);
  return input.record;
}

function selectUniqueExactV1(records: readonly CanonicalReplayEvidenceRecordV1[], kind: "RAINFALL" | "ET0"): CanonicalReplayEvidenceRecordV1 | null {
  const byId = new Map<string, CanonicalReplayEvidenceRecordV1>();
  for (const record of records) {
    const id = requiredTextV1(record.source_record_id, `AMENDMENT19_EXACT_${kind}_SOURCE_REF_REQUIRED`);
    const existing = byId.get(id);
    if (existing && existing.source_record_hash !== record.source_record_hash) throw new Error(`AMENDMENT19_EXACT_${kind}_SOURCE_IDENTITY_CONFLICT:${id}`);
    if (!existing) byId.set(id, record);
  }
  const unique = [...byId.values()];
  if (unique.length > 1) throw new Error(`AMENDMENT19_EXACT_${kind}_CONFLICTING_INTERVAL_RECORDS`);
  return unique[0] ?? null;
}

function assumptionKindV1(record: CanonicalReplayEvidenceRecordV1): AssumptionKindV1 | null {
  if (record.record_type === "future_weather_assumption_v1") return "WEATHER";
  if (record.record_type === "future_et0_assumption_v1") return "ET0";
  return null;
}

function normalizeAssumptionV1(input: {
  record: CanonicalReplayEvidenceRecordV1;
  scope: TwinScopeKeyV1;
  base_logical_time: string;
  current_logical_time: string;
}): NormalizedAssumptionV1 | null {
  const kind = assumptionKindV1(input.record);
  if (!kind || !sameScopeV1(input.record, input.scope)) return null;
  const expectedBinding = kind === "WEATHER"
    ? MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1
    : MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1;
  if (input.record.binding_id !== expectedBinding) throw new Error(`AMENDMENT19_ASSUMPTION_${kind}_BINDING_MISMATCH`);
  if (input.record.epistemic_class !== "ASSUMED") throw new Error(`AMENDMENT19_ASSUMPTION_${kind}_EPISTEMIC_MISMATCH`);
  if (!usableQualityV1(input.record)) return null;
  const issuedAt = canonicalIsoV1(input.record.role_time?.issued_at, `AMENDMENT19_ASSUMPTION_${kind}_ISSUED_AT_INVALID`);
  const roleAvailable = canonicalIsoV1(input.record.role_time?.available_to_runtime_at, `AMENDMENT19_ASSUMPTION_${kind}_ROLE_AVAILABLE_AT_INVALID`);
  const { available_at: availableAt, ingested_at: ingestedAt } = validateCausalTimesV1(input.record, `AMENDMENT19_ASSUMPTION_${kind}`);
  if (roleAvailable !== availableAt) throw new Error(`AMENDMENT19_ASSUMPTION_${kind}_AVAILABILITY_MISMATCH`);
  const validFrom = canonicalHourV1(input.record.role_time?.valid_from, `AMENDMENT19_ASSUMPTION_${kind}_VALID_FROM_INVALID`);
  const validTo = canonicalHourV1(input.record.role_time?.valid_to, `AMENDMENT19_ASSUMPTION_${kind}_VALID_TO_INVALID`);
  if (validFrom !== input.base_logical_time || validTo !== addHoursV1(input.base_logical_time, 72)) return null;
  if (Date.parse(issuedAt) > Date.parse(input.base_logical_time)
    || Date.parse(availableAt) > Date.parse(input.base_logical_time)
    || Date.parse(ingestedAt) > Date.parse(input.base_logical_time)) return null;
  const payload = input.record.canonical_payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error(`AMENDMENT19_ASSUMPTION_${kind}_PAYLOAD_INVALID`);
  const expectedSnapshotKind = kind === "WEATHER" ? "FUTURE_WEATHER_ASSUMPTION" : "FUTURE_ET0_ASSUMPTION";
  if (payload.snapshot_kind !== expectedSnapshotKind || !Array.isArray(payload.points) || payload.points.length !== 72) {
    throw new Error(`AMENDMENT19_ASSUMPTION_${kind}_EXACT_72_POINT_WINDOW_REQUIRED`);
  }
  let horizonOneValue: number | null = null;
  for (let index = 0; index < 72; index += 1) {
    const raw = payload.points[index];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`AMENDMENT19_ASSUMPTION_${kind}_POINT_INVALID:H${index + 1}`);
    const point = raw as Record<string, unknown>;
    const horizon = index + 1;
    if (point.horizon !== horizon && point.horizon_hour !== horizon) throw new Error(`AMENDMENT19_ASSUMPTION_${kind}_HORIZON_MISMATCH:H${horizon}`);
    const expectedStart = addHoursV1(input.base_logical_time, index);
    const expectedEnd = addHoursV1(input.base_logical_time, horizon);
    if (point.valid_from !== expectedStart || point.valid_to !== expectedEnd) throw new Error(`AMENDMENT19_ASSUMPTION_${kind}_POINT_TIME_MISMATCH:H${horizon}`);
    const rawValue = kind === "WEATHER" ? point.precipitation_mm : point.et0_mm_per_hour;
    const value = finiteNumberV1(rawValue, `AMENDMENT19_ASSUMPTION_${kind}_POINT_VALUE_INVALID:H${horizon}`);
    if (kind === "WEATHER" && value < 0) throw new Error(`AMENDMENT19_ASSUMPTION_WEATHER_NEGATIVE:H${horizon}`);
    if (horizon === 1) {
      if (expectedStart !== input.base_logical_time || expectedEnd !== input.current_logical_time) throw new Error("AMENDMENT19_ASSUMPTION_H1_CURRENT_INTERVAL_MISMATCH");
      horizonOneValue = value;
    }
  }
  if (horizonOneValue === null) throw new Error(`AMENDMENT19_ASSUMPTION_${kind}_H1_REQUIRED`);
  return {
    kind,
    record: input.record,
    issued_at: issuedAt,
    available_to_runtime_at: availableAt,
    ingested_at: ingestedAt,
    valid_from: validFrom,
    valid_to: validTo,
    value_mm: horizonOneValue,
    canonical_payload_hash: semanticHashV1(payload),
  };
}

function assumptionIdentityV1(item: NormalizedAssumptionV1): string {
  return [item.issued_at, item.available_to_runtime_at, item.valid_from, item.valid_to].join("|");
}

function selectAssumptionPairV1(items: readonly NormalizedAssumptionV1[]): { weather: NormalizedAssumptionV1; et0: NormalizedAssumptionV1 } | null {
  const groups = new Map<string, { weather: NormalizedAssumptionV1[]; et0: NormalizedAssumptionV1[] }>();
  for (const item of items) {
    const key = assumptionIdentityV1(item);
    const group = groups.get(key) ?? { weather: [], et0: [] };
    (item.kind === "WEATHER" ? group.weather : group.et0).push(item);
    groups.set(key, group);
  }
  const pairs: Array<{ weather: NormalizedAssumptionV1; et0: NormalizedAssumptionV1 }> = [];
  for (const [identity, group] of groups) {
    for (const list of [group.weather, group.et0]) {
      const byCanonicalPayload = new Set(list.map((item) => item.canonical_payload_hash));
      if (byCanonicalPayload.size > 1) throw new Error(`AMENDMENT19_ASSUMPTION_CONFLICTING_CYCLE:${identity}`);
      list.sort((left, right) => String(left.record.source_record_id).localeCompare(String(right.record.source_record_id)));
    }
    if (group.weather.length >= 1 && group.et0.length >= 1) pairs.push({ weather: group.weather[0]!, et0: group.et0[0]! });
  }
  pairs.sort((left, right) =>
    right.weather.available_to_runtime_at.localeCompare(left.weather.available_to_runtime_at)
    || right.weather.issued_at.localeCompare(left.weather.issued_at)
    || String(left.weather.record.source_record_id).localeCompare(String(right.weather.record.source_record_id)));
  return pairs[0] ?? null;
}

function finalizeSelectionV1(value: Omit<ExternalFormalCurrentIntervalForcingSelectionV1, "selection_hash">): ExternalFormalCurrentIntervalForcingSelectionV1 {
  return { ...value, selection_hash: semanticHashV1(value) };
}

export function selectExternalFormalCurrentIntervalForcingV1(
  input: SelectExternalFormalCurrentIntervalForcingInputV1,
): ExternalFormalCurrentIntervalForcingSelectionV1 {
  const logicalTime = canonicalHourV1(input.logical_time, "AMENDMENT19_CURRENT_INTERVAL_LOGICAL_TIME_INVALID");
  const snapshot = canonicalIsoV1(input.evidence_snapshot_time, "AMENDMENT19_CURRENT_INTERVAL_SNAPSHOT_INVALID");
  if (Date.parse(snapshot) < Date.parse(logicalTime)) throw new Error("AMENDMENT19_CURRENT_INTERVAL_SNAPSHOT_BEFORE_LOGICAL_TIME");
  const intervalStart = addHoursV1(logicalTime, -1);

  const rainfallCandidates = input.candidate_records
    .map((record) => normalizeExactProviderRecordV1({ record, scope: input.scope, logical_time: logicalTime, interval_start: intervalStart, evidence_snapshot_time: snapshot, kind: "RAINFALL" }))
    .filter((record): record is CanonicalReplayEvidenceRecordV1 => record !== null);
  const et0Candidates = input.candidate_records
    .map((record) => normalizeExactProviderRecordV1({ record, scope: input.scope, logical_time: logicalTime, interval_start: intervalStart, evidence_snapshot_time: snapshot, kind: "ET0" }))
    .filter((record): record is CanonicalReplayEvidenceRecordV1 => record !== null);
  const rainfall = selectUniqueExactV1(rainfallCandidates, "RAINFALL");
  const exactEt0 = selectUniqueExactV1(et0Candidates, "ET0");

  if (rainfall && exactEt0) {
    const rainfallValue = finiteNumberV1(rainfall.canonical_payload?.value, "AMENDMENT19_EXACT_RAINFALL_VALUE_REQUIRED");
    if (rainfallValue < 0) throw new Error("AMENDMENT19_EXACT_RAINFALL_NEGATIVE");
    const et0Value = finiteNumberV1(exactEt0.canonical_payload?.value, "AMENDMENT19_EXACT_ET0_VALUE_REQUIRED");
    const et0Projection = projectSignedEt0ToNonnegativeWaterLossDemandV1(et0Value);
    const limitations = uniqueSortedV1([
      ...(Array.isArray(rainfall.limitations) ? rainfall.limitations.filter((value): value is string => typeof value === "string") : []),
      ...(Array.isArray(exactEt0.limitations) ? exactEt0.limitations.filter((value): value is string => typeof value === "string") : []),
      ...et0Projection.limitations,
    ]);
    return finalizeSelectionV1({
      contract_id: MCFT_CAP09_CURRENT_INTERVAL_STATE_FORCING_AUTHORITY_ID_V1,
      selection_policy_id: MCFT_CAP09_CURRENT_INTERVAL_STATE_FORCING_SELECTION_POLICY_ID_V1,
      logical_time: logicalTime,
      interval_start: intervalStart,
      interval_end: logicalTime,
      evidence_snapshot_time: snapshot,
      mode: "EXACT_PROVIDER_INTERVAL_PAIR",
      runtime_health: "HEALTHY",
      precipitation_mm: rainfallValue,
      reference_et0_canonical_signed_mm: et0Value,
      reference_et0_model_water_loss_demand_mm: et0Projection.model_water_loss_demand_mm,
      et0_consumption_transformation_ref: et0Projection.transformation_ref,
      precipitation_epistemic_class: "OBSERVED",
      et0_epistemic_class: "ESTIMATED",
      source_record_refs: uniqueSortedV1([rainfall.source_record_id, exactEt0.source_record_id]),
      source_record_hashes: uniqueSortedV1([rainfall.source_record_hash, exactEt0.source_record_hash]),
      forcing_cycle_basis: null,
      exact_provider_pair_available: true,
      partial_exact_provider_refs_suppressed: [],
      provider_wait_required: false,
      completed_tick_retroactive_rewrite_authorized: false,
      relabel_assumption_as_provider_observation_authorized: false,
      limitations,
    });
  }

  const partialExactRefs = uniqueSortedV1([
    ...(rainfall ? [rainfall.source_record_id] : []),
    ...(exactEt0 ? [exactEt0.source_record_id] : []),
  ]);
  const assumptionItems = input.candidate_records
    .map((record) => normalizeAssumptionV1({ record, scope: input.scope, base_logical_time: intervalStart, current_logical_time: logicalTime }))
    .filter((item): item is NormalizedAssumptionV1 => item !== null);
  const pair = selectAssumptionPairV1(assumptionItems);
  if (!pair) throw new Error("AMENDMENT19_NO_CAUSAL_CURRENT_INTERVAL_FORCING_PAIR");
  const et0Projection = projectSignedEt0ToNonnegativeWaterLossDemandV1(pair.et0.value_mm);
  const basis = {
    issued_at: pair.weather.issued_at,
    available_to_runtime_at: pair.weather.available_to_runtime_at,
    valid_from: pair.weather.valid_from,
    valid_to: pair.weather.valid_to,
  };
  if (pair.et0.issued_at !== basis.issued_at
    || pair.et0.available_to_runtime_at !== basis.available_to_runtime_at
    || pair.et0.valid_from !== basis.valid_from
    || pair.et0.valid_to !== basis.valid_to) throw new Error("AMENDMENT19_ASSUMPTION_PAIR_BASIS_MISMATCH");
  const forcingCycleKey = semanticHashV1({ scope: input.scope, ...basis });
  const limitations = uniqueSortedV1([
    MCFT_CAP09_CURRENT_INTERVAL_FORCING_ASSUMPTION_DEGRADED_REASON_V1,
    "CURRENT_INTERVAL_PROCESS_FORCING_IS_PRIOR_STEP_ASSUMPTION_NOT_KBS_OBSERVATION",
    "NO_RETROACTIVE_STATE_REWRITE_WHEN_LATE_EXACT_PROVIDER_EVIDENCE_ARRIVES",
    ...(Array.isArray(pair.weather.record.limitations) ? pair.weather.record.limitations.filter((value): value is string => typeof value === "string") : []),
    ...(Array.isArray(pair.et0.record.limitations) ? pair.et0.record.limitations.filter((value): value is string => typeof value === "string") : []),
    ...et0Projection.limitations,
  ]);
  return finalizeSelectionV1({
    contract_id: MCFT_CAP09_CURRENT_INTERVAL_STATE_FORCING_AUTHORITY_ID_V1,
    selection_policy_id: MCFT_CAP09_CURRENT_INTERVAL_STATE_FORCING_SELECTION_POLICY_ID_V1,
    logical_time: logicalTime,
    interval_start: intervalStart,
    interval_end: logicalTime,
    evidence_snapshot_time: snapshot,
    mode: "PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR",
    runtime_health: "DEGRADED",
    precipitation_mm: pair.weather.value_mm,
    reference_et0_canonical_signed_mm: pair.et0.value_mm,
    reference_et0_model_water_loss_demand_mm: et0Projection.model_water_loss_demand_mm,
    et0_consumption_transformation_ref: et0Projection.transformation_ref,
    precipitation_epistemic_class: "ASSUMED",
    et0_epistemic_class: "ASSUMED",
    source_record_refs: uniqueSortedV1([pair.weather.record.source_record_id, pair.et0.record.source_record_id]),
    source_record_hashes: uniqueSortedV1([pair.weather.record.source_record_hash, pair.et0.record.source_record_hash]),
    forcing_cycle_basis: { ...basis, forcing_cycle_key: forcingCycleKey },
    exact_provider_pair_available: false,
    partial_exact_provider_refs_suppressed: partialExactRefs,
    provider_wait_required: false,
    completed_tick_retroactive_rewrite_authorized: false,
    relabel_assumption_as_provider_observation_authorized: false,
    limitations,
  });
}
