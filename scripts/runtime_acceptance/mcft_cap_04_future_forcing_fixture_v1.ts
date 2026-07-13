// scripts/runtime_acceptance/mcft_cap_04_future_forcing_fixture_v1.ts
// Purpose: build deterministic CAP-04 S2 weather/ET0 forcing-cycle fixtures, including the exact T selection case and the 24-tick 95-hour target union.
// Boundary: acceptance fixture construction only; no database, filesystem, network, environment, wall clock, Forecast equations, Scenario equations, or canonical writes.

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalReplayEvidenceRecordV1, TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";
import type { Cap04FutureForcingSelectorInputV1 } from "../../apps/server/src/runtime/twin_runtime/future_forcing_selector_v1.js";

export const CAP04_S2_SCOPE_V1: TwinScopeKeyV1 = {
  tenant_id: "tenant_mcft",
  project_id: "project_mcft",
  group_id: "group_mcft",
  field_id: "field_mcft",
  season_id: "season_2026",
  zone_id: "zone_root",
};

export const CAP04_S2_FIRST_LOGICAL_TIME_V1 = "2026-06-03T02:00:00.000Z";
export const CAP04_S2_LAST_LOGICAL_TIME_V1 = "2026-06-04T01:00:00.000Z";

function addMinutesV1(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * 60 * 1000).toISOString();
}

function addHoursV1(value: string, hours: number): string {
  return addMinutesV1(value, hours * 60);
}

function weatherPointsV1(logicalTime: string, seed: number): Array<Record<string, unknown>> {
  return Array.from({ length: 72 }, (_, index) => {
    const horizon = index + 1;
    return {
      horizon,
      valid_from: addHoursV1(logicalTime, horizon - 1),
      valid_to: addHoursV1(logicalTime, horizon),
      precipitation_mm: (seed + horizon) % 41 === 0 ? 1.2 : 0,
    };
  });
}

function et0PointsV1(logicalTime: string, seed: number): Array<Record<string, unknown>> {
  return Array.from({ length: 72 }, (_, index) => {
    const horizon = index + 1;
    return {
      horizon,
      valid_from: addHoursV1(logicalTime, horizon - 1),
      valid_to: addHoursV1(logicalTime, horizon),
      et0_mm_per_hour: Number((0.09 + ((seed + horizon) % 24) * 0.004).toFixed(6)),
    };
  });
}

export function buildCap04FutureForcingSnapshotV1(input: {
  kind: "weather" | "et0";
  logical_time: string;
  issued_at: string;
  available_to_runtime_at: string;
  valid_from?: string;
  valid_to?: string;
  source_record_id: string;
  binding_id?: string;
  origin_source_id?: string;
  quality_status?: string;
  seed?: number;
  points_override?: Array<Record<string, unknown>>;
  scope_override?: Partial<TwinScopeKeyV1>;
}): CanonicalReplayEvidenceRecordV1 {
  const snapshotKind = input.kind === "weather" ? "FUTURE_WEATHER_ASSUMPTION" : "FUTURE_ET0_ASSUMPTION";
  const recordType = input.kind === "weather" ? "future_weather_assumption_v1" : "future_et0_assumption_v1";
  const canonicalPayload = {
    snapshot_kind: snapshotKind,
    points: input.points_override ?? (input.kind === "weather"
      ? weatherPointsV1(input.logical_time, input.seed ?? 0)
      : et0PointsV1(input.logical_time, input.seed ?? 0)),
  };
  const scope = { ...CAP04_S2_SCOPE_V1, ...(input.scope_override ?? {}) };
  const roleTime = {
    issued_at: input.issued_at,
    retrieved_at: input.available_to_runtime_at,
    ingested_at: input.available_to_runtime_at,
    available_to_runtime_at: input.available_to_runtime_at,
    valid_from: input.valid_from ?? input.logical_time,
    valid_to: input.valid_to ?? addHoursV1(input.logical_time, 72),
  };
  const semantic = {
    source_record_id: input.source_record_id,
    record_type: recordType,
    binding_id: input.binding_id ?? `binding_${input.kind}`,
    origin_source_id: input.origin_source_id ?? `origin_${input.kind}`,
    scope,
    role_time: roleTime,
    canonical_payload: canonicalPayload,
  };
  return {
    dataset_id: "mcft_cap_04_s2_fixture_v1",
    source_record_id: input.source_record_id,
    source_record_hash: semanticHashV1(semantic),
    record_type: recordType,
    binding_id: input.binding_id ?? `binding_${input.kind}`,
    origin_source_kind: "CONTROLLED_REPLAY_FIXTURE",
    origin_source_id: input.origin_source_id ?? `origin_${input.kind}`,
    epistemic_class: "ASSUMED",
    ...scope,
    available_to_runtime_at: input.available_to_runtime_at,
    role_time: roleTime,
    quality: { status: input.quality_status ?? "PASS" },
    source_payload: structuredClone(canonicalPayload),
    canonical_payload: canonicalPayload,
    source_unit: "mm",
    canonical_unit: "mm",
    conversion_rule: { rule_id: input.kind === "weather" ? "PRECIPITATION_MM_IDENTITY_V1" : "ET0_MM_PER_HOUR_IDENTITY_V1" },
    limitations: ["controlled synthetic canonical Replay fixture"],
  };
}

export function buildCap04FutureForcingSelectorInputV1(input?: {
  logical_time?: string;
  candidate_records?: CanonicalReplayEvidenceRecordV1[];
}): Cap04FutureForcingSelectorInputV1 {
  const logicalTime = input?.logical_time ?? CAP04_S2_FIRST_LOGICAL_TIME_V1;
  const issuedAt = addMinutesV1(logicalTime, -75);
  const availableAt = addMinutesV1(logicalTime, -55);
  const defaultRecords = [
    buildCap04FutureForcingSnapshotV1({
      kind: "weather",
      logical_time: logicalTime,
      issued_at: issuedAt,
      available_to_runtime_at: availableAt,
      source_record_id: `weather_selected_${logicalTime}`,
      seed: 1,
    }),
    buildCap04FutureForcingSnapshotV1({
      kind: "et0",
      logical_time: logicalTime,
      issued_at: issuedAt,
      available_to_runtime_at: availableAt,
      source_record_id: `et0_selected_${logicalTime}`,
      seed: 1,
    }),
    buildCap04FutureForcingSnapshotV1({
      kind: "weather",
      logical_time: logicalTime,
      issued_at: addMinutesV1(logicalTime, -15),
      available_to_runtime_at: addMinutesV1(logicalTime, 5),
      source_record_id: `weather_future_revision_${logicalTime}`,
      seed: 2,
    }),
    buildCap04FutureForcingSnapshotV1({
      kind: "et0",
      logical_time: logicalTime,
      issued_at: addMinutesV1(logicalTime, -15),
      available_to_runtime_at: addMinutesV1(logicalTime, 5),
      source_record_id: `et0_future_revision_${logicalTime}`,
      seed: 2,
    }),
    buildCap04FutureForcingSnapshotV1({
      kind: "weather",
      logical_time: logicalTime,
      issued_at: addMinutesV1(logicalTime, -135),
      available_to_runtime_at: addMinutesV1(logicalTime, -115),
      valid_to: addHoursV1(logicalTime, 71),
      source_record_id: `weather_incomplete_${logicalTime}`,
      seed: 3,
    }),
  ];
  return {
    scope: structuredClone(CAP04_S2_SCOPE_V1),
    logical_time: logicalTime,
    candidate_records: input?.candidate_records ?? defaultRecords,
    authorized_binding_ids: ["binding_weather", "binding_et0"],
    crop_stage_context: {
      ref: "mcft_crop_stage_context_v1",
      hash: "sha256:crop_stage_context_v1",
      crop_stage_code: "MID_SEASON",
      kc: 1.05,
    },
    runtime_config: {
      ref: `twin_runtime_config_${logicalTime}`,
      hash: semanticHashV1({ logical_time: logicalTime, config_purpose: "FORECAST_AND_THREE_SCENARIO_CONTINUATION_RUNTIME_V1" }),
    },
  };
}

export function buildCap04FutureForcing24TickInputsV1(): Cap04FutureForcingSelectorInputV1[] {
  return Array.from({ length: 24 }, (_, index) => buildCap04FutureForcingSelectorInputV1({
    logical_time: addHoursV1(CAP04_S2_FIRST_LOGICAL_TIME_V1, index),
  }));
}

export function addHoursForCap04S2FixtureV1(value: string, hours: number): string {
  return addHoursV1(value, hours);
}
