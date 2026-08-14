import assert from "node:assert/strict";
import type { Pool } from "pg";

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { executeExternalFormalCap04Amendment11CandidateV1 } from "../../apps/server/src/runtime/twin_runtime/external_formal_cap04_amendment11_candidate_execution_service_v1.js";
import {
  MCFT_CAP09_NEGATIVE_ET0_CONDENSATION_NOT_MODELED_LIMITATION_V1,
  MCFT_CAP09_SIGNED_ET0_TO_NONNEGATIVE_WATER_LOSS_DEMAND_POLICY_ID_V1,
  projectSignedEt0ToNonnegativeWaterLossDemandV1,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_et0_consumption_projection_v1.js";
import { PostgresExternalFormalEvidenceSourceV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_evidence_source_v1.js";
import type { CanonicalReplayEvidenceRecordV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";
import {
  EA5B5B_LOGICAL_TIME_V1,
  buildEa5b5bExternalFixtureV1,
} from "./mcft_cap09_ea5b5b_external_fixture_v1.js";

type RowV1 = { fact_id: string; occurred_at: string; record_json: unknown };

function addMinutesV1(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * 60_000).toISOString();
}

function eventTimeV1(record: CanonicalReplayEvidenceRecordV1): string {
  const value = record.role_time.observed_at
    ?? record.role_time.interval_end
    ?? record.role_time.issued_at;
  if (typeof value !== "string") throw new Error(`AMENDMENT11_DB_TO_CAP04_EVENT_TIME_REQUIRED:${record.record_type}`);
  return value;
}

function rowsV1(records: readonly CanonicalReplayEvidenceRecordV1[]): RowV1[] {
  return records.map((record, index) => ({
    fact_id: `amendment11_db_to_cap04_${String(index).padStart(2, "0")}_${record.source_record_id}`,
    occurred_at: eventTimeV1(record),
    record_json: { type: record.record_type, payload: structuredClone(record) },
  }));
}

function fakeReadOnlyPoolV1(rows: readonly RowV1[]) {
  const sql: string[] = [];
  const client = {
    async query(statement: string) {
      sql.push(statement);
      if (/^\s*SELECT\s+fact_id/i.test(statement)) return { rows: structuredClone(rows) };
      return { rows: [] };
    },
    release() {},
  };
  return {
    pool: {
      async connect() { return client; },
    } as unknown as Pool,
    sql,
  };
}

function amendment11DelayedExactEvidenceV1(records: readonly CanonicalReplayEvidenceRecordV1[]): CanonicalReplayEvidenceRecordV1[] {
  const delayed = structuredClone(records) as CanonicalReplayEvidenceRecordV1[];
  for (const record of delayed) {
    if (record.record_type !== "observed_rainfall_v1" && record.record_type !== "historical_et0_estimate_v1") continue;
    record.available_to_runtime_at = addMinutesV1(EA5B5B_LOGICAL_TIME_V1, 1198);
    record.role_time.ingested_at = addMinutesV1(EA5B5B_LOGICAL_TIME_V1, 1199);
  }
  return delayed;
}

function sourceRecordHashV1(record: CanonicalReplayEvidenceRecordV1): string {
  return semanticHashV1({
    scope: {
      tenant_id: record.tenant_id,
      project_id: record.project_id,
      group_id: record.group_id,
      field_id: record.field_id,
      season_id: record.season_id,
      zone_id: record.zone_id,
    },
    record_type: record.record_type,
    source_record_id: record.source_record_id,
    binding_id: record.binding_id,
    origin_source_id: record.origin_source_id,
    role_time: record.role_time,
    canonical_payload: record.canonical_payload,
  });
}

function signedEt0EvidenceV1(records: readonly CanonicalReplayEvidenceRecordV1[]): CanonicalReplayEvidenceRecordV1[] {
  const signed = structuredClone(records) as CanonicalReplayEvidenceRecordV1[];
  const historical = signed.find((record) => record.record_type === "historical_et0_estimate_v1");
  const future = signed.find((record) => record.record_type === "future_et0_assumption_v1");
  if (!historical || !future) throw new Error("AMENDMENT12_SIGNED_ET0_FIXTURE_FAMILIES_REQUIRED");

  historical.canonical_payload.value = -0.125;
  historical.source_record_hash = sourceRecordHashV1(historical);

  const points = future.canonical_payload.points;
  if (!Array.isArray(points) || points.length !== 72) throw new Error("AMENDMENT12_FUTURE_ET0_72_POINTS_REQUIRED");
  const p1 = points[0] as Record<string, unknown>;
  const p18 = points[17] as Record<string, unknown>;
  p1.et0_mm_per_hour = -0.25;
  p18.et0_mm_per_hour = -0.05;
  future.source_record_hash = sourceRecordHashV1(future);
  return signed;
}

function assertReadOnlyV1(sql: readonly string[]): void {
  const joined = sql.join("\n");
  assert.match(joined, /BEGIN TRANSACTION READ ONLY/);
  assert.match(joined, /COMMIT/);
  assert.doesNotMatch(joined, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|ALTER|CREATE|DROP)\b/i);
}

async function loadFiveV1(records: readonly CanonicalReplayEvidenceRecordV1[]) {
  const delayed = amendment11DelayedExactEvidenceV1(records);
  const fake = fakeReadOnlyPoolV1(rowsV1(delayed));
  const evidenceSnapshot = addMinutesV1(EA5B5B_LOGICAL_TIME_V1, 1200);
  const source = new PostgresExternalFormalEvidenceSourceV1(fake.pool);
  const loaded = await source.loadCandidateRecords({
    scope: {
      tenant_id: records[0].tenant_id,
      project_id: records[0].project_id,
      group_id: records[0].group_id,
      field_id: records[0].field_id,
      season_id: records[0].season_id,
      zone_id: records[0].zone_id,
    },
    logical_time: EA5B5B_LOGICAL_TIME_V1,
    evidence_snapshot_time: evidenceSnapshot,
  });
  assertReadOnlyV1(fake.sql);
  return { loaded, evidenceSnapshot };
}

async function main(): Promise<void> {
  const fixture = await buildEa5b5bExternalFixtureV1();
  const positive = await loadFiveV1(fixture.candidates);
  const observerCreatedAt = addMinutesV1(EA5B5B_LOGICAL_TIME_V1, 1201);

  assert.equal(positive.loaded.database_write_count, 0);
  assert.equal(positive.loaded.provider_request_count, 0);
  assert.equal(positive.loaded.selected_record_count, 5);
  assert.equal(positive.loaded.evidence_snapshot_time, positive.evidenceSnapshot);
  assert.equal(positive.loaded.exact_interval_availability_cutoff_time, positive.evidenceSnapshot);
  assert.deepEqual(positive.loaded.family_cardinality, {
    soil: 1,
    rainfall: 1,
    historical_et0: 1,
    future_weather: 1,
    future_et0: 1,
  });

  const byType = new Map(positive.loaded.records.map((record) => [record.record_type, record]));
  assert.equal(byType.get("observed_rainfall_v1")?.available_to_runtime_at, addMinutesV1(EA5B5B_LOGICAL_TIME_V1, 1198));
  assert.equal(byType.get("historical_et0_estimate_v1")?.available_to_runtime_at, addMinutesV1(EA5B5B_LOGICAL_TIME_V1, 1198));
  assert.ok(Date.parse(String(byType.get("future_weather_assumption_v1")?.available_to_runtime_at)) <= Date.parse(EA5B5B_LOGICAL_TIME_V1));
  assert.ok(Date.parse(String(byType.get("future_et0_assumption_v1")?.available_to_runtime_at)) <= Date.parse(EA5B5B_LOGICAL_TIME_V1));

  const candidate = executeExternalFormalCap04Amendment11CandidateV1({
    scope: fixture.scope,
    logical_time: EA5B5B_LOGICAL_TIME_V1,
    created_at: observerCreatedAt,
    evidence_snapshot_time: positive.evidenceSnapshot,
    handoff: fixture.handoff,
    runtime_config: fixture.hourly,
    candidate_records: positive.loaded.records,
    crop_stage_context: fixture.crop,
  });

  assert.equal(candidate.service_id, "MCFT_CAP09_EXTERNAL_FORMAL_CAP04_AMENDMENT11_CANDIDATE_EXECUTION_SERVICE_V1");
  assert.equal(candidate.evidence_snapshot_time, positive.evidenceSnapshot);
  assert.equal(candidate.evidence_snapshot_source, "CALLER_SUPPLIED");
  assert.equal(candidate.operation_variant, "A1");
  assert.equal(candidate.forcing_outcome.status, "SELECTED");
  assert.equal(candidate.forecast_authority.forecast_candidate.status, "COMPLETED");
  assert.equal(candidate.forecast_authority.forecast_candidate.points.length, 72);
  assert.equal(candidate.record_set.members.length, 8);
  assert.equal(candidate.historical_et0_consumption_projection.transformation_applied, false);
  assert.equal(
    candidate.historical_et0_consumption_projection.model_water_loss_demand_mm,
    candidate.historical_et0_consumption_projection.canonical_signed_et0_mm,
  );
  assert.equal(candidate.canonical_persistence_authorized, false);
  assert.deepEqual(
    [candidate.provider_request_count, candidate.database_write_count, candidate.scenario_write_count, candidate.recommendation_write_count, candidate.action_write_count],
    [0, 0, 0, 0, 0],
  );

  const signed = await loadFiveV1(signedEt0EvidenceV1(fixture.candidates));
  const signedBeforeExecution = structuredClone(signed.loaded.records);
  const signedCandidate = executeExternalFormalCap04Amendment11CandidateV1({
    scope: fixture.scope,
    logical_time: EA5B5B_LOGICAL_TIME_V1,
    created_at: observerCreatedAt,
    evidence_snapshot_time: signed.evidenceSnapshot,
    handoff: fixture.handoff,
    runtime_config: fixture.hourly,
    candidate_records: signed.loaded.records,
    crop_stage_context: fixture.crop,
  });

  assert.deepEqual(signed.loaded.records, signedBeforeExecution, "canonical Evidence must not be mutated by model consumption");
  assert.equal(signedCandidate.operation_variant, "A1");
  assert.equal(signedCandidate.forecast_authority.forecast_candidate.status, "COMPLETED");
  assert.equal(signedCandidate.forecast_authority.forecast_candidate.points.length, 72);
  assert.deepEqual(signedCandidate.historical_et0_consumption_projection, {
    canonical_signed_et0_mm: -0.125,
    model_water_loss_demand_mm: 0,
    transformation_applied: true,
    transformation_ref: MCFT_CAP09_SIGNED_ET0_TO_NONNEGATIVE_WATER_LOSS_DEMAND_POLICY_ID_V1,
    limitations: [MCFT_CAP09_NEGATIVE_ET0_CONDENSATION_NOT_MODELED_LIMITATION_V1],
  });
  const transitionProjection = signedCandidate.source_members.twin_state_transition_v1.payload.historical_et0_consumption_projection as Record<string, unknown>;
  assert.equal(transitionProjection.canonical_signed_et0_mm, -0.125);
  assert.equal(transitionProjection.model_water_loss_demand_mm, 0);
  assert.equal(transitionProjection.policy_id, MCFT_CAP09_SIGNED_ET0_TO_NONNEGATIVE_WATER_LOSS_DEMAND_POLICY_ID_V1);
  assert.ok(signedCandidate.source_members.twin_state_transition_v1.limitations.includes(MCFT_CAP09_NEGATIVE_ET0_CONDENSATION_NOT_MODELED_LIMITATION_V1));

  if (signedCandidate.forcing_outcome.status !== "SELECTED") throw new Error("AMENDMENT12_SIGNED_FUTURE_FORCING_MUST_SELECT");
  assert.equal(signedCandidate.forcing_outcome.window.points.length, 72);
  const projectedFuturePoints = signedCandidate.forcing_outcome.window.points.filter((point) => point.et0_assumption_mm === 0
    && point.limitations.includes(MCFT_CAP09_NEGATIVE_ET0_CONDENSATION_NOT_MODELED_LIMITATION_V1));
  assert.equal(projectedFuturePoints.length, 2);
  assert.equal(signedCandidate.forcing_outcome.window.points[0].et0_assumption_mm, 0);
  assert.equal(signedCandidate.forcing_outcome.window.points[17].et0_assumption_mm, 0);
  for (const point of signedCandidate.forcing_outcome.window.points) {
    assert.ok(point.transformation_refs.includes(MCFT_CAP09_SIGNED_ET0_TO_NONNEGATIVE_WATER_LOSS_DEMAND_POLICY_ID_V1));
    assert.ok(point.et0_assumption_mm >= 0);
  }

  const signedHistorical = signed.loaded.records.find((record) => record.record_type === "historical_et0_estimate_v1");
  const signedFuture = signed.loaded.records.find((record) => record.record_type === "future_et0_assumption_v1");
  assert.equal(signedHistorical?.canonical_payload.value, -0.125);
  assert.equal((signedFuture?.canonical_payload.points as Array<Record<string, unknown>>)[0]?.et0_mm_per_hour, -0.25);
  assert.equal((signedFuture?.canonical_payload.points as Array<Record<string, unknown>>)[17]?.et0_mm_per_hour, -0.05);

  assert.throws(
    () => projectSignedEt0ToNonnegativeWaterLossDemandV1(Number.NaN, "AMENDMENT12_NONFINITE_ET0_REJECTED"),
    /AMENDMENT12_NONFINITE_ET0_REJECTED/,
  );

  assert.throws(
    () => executeExternalFormalCap04Amendment11CandidateV1({
      scope: fixture.scope,
      logical_time: EA5B5B_LOGICAL_TIME_V1,
      created_at: observerCreatedAt,
      evidence_snapshot_time: addMinutesV1(EA5B5B_LOGICAL_TIME_V1, -1),
      handoff: fixture.handoff,
      runtime_config: fixture.hourly,
      candidate_records: positive.loaded.records,
      crop_stage_context: fixture.crop,
    }),
    /EXTERNAL_CAP04_AMENDMENT11_EVIDENCE_SNAPSHOT_BEFORE_LOGICAL_TIME/,
  );
  assert.throws(
    () => executeExternalFormalCap04Amendment11CandidateV1({
      scope: fixture.scope,
      logical_time: EA5B5B_LOGICAL_TIME_V1,
      created_at: observerCreatedAt,
      evidence_snapshot_time: addMinutesV1(EA5B5B_LOGICAL_TIME_V1, 1202),
      handoff: fixture.handoff,
      runtime_config: fixture.hourly,
      candidate_records: positive.loaded.records,
      crop_stage_context: fixture.crop,
    }),
    /EXTERNAL_CAP04_AMENDMENT11_EVIDENCE_SNAPSHOT_AFTER_CREATED_AT/,
  );

  console.log(JSON.stringify({
    status: "PASS",
    temporal_authority: "PROVIDER_AVAILABILITY_WATERMARK_V1",
    et0_consumption_policy: MCFT_CAP09_SIGNED_ET0_TO_NONNEGATIVE_WATER_LOSS_DEMAND_POLICY_ID_V1,
    service_id: candidate.service_id,
    logical_time: EA5B5B_LOGICAL_TIME_V1,
    evidence_snapshot_time: positive.evidenceSnapshot,
    evidence_snapshot_offset_minutes: 1200,
    evidence_snapshot_required_at_public_seam: true,
    fixed_432_fallback_exposed_at_public_seam: false,
    delayed_rainfall_to_external_cap04: true,
    delayed_historical_et0_to_external_cap04: true,
    future_forcing_pre_logical_time_preserved: true,
    positive_historical_et0_preserved: true,
    negative_historical_et0_canonical_preserved: true,
    negative_historical_et0_model_demand_zero: true,
    signed_future_et0_canonical_preserved: true,
    signed_future_et0_projection_count: projectedFuturePoints.length,
    signed_future_et0_full_72h_completed: true,
    negative_et0_condensation_not_modeled_explicit: true,
    nonfinite_et0_fail_closed: true,
    external_cap04_operation_variant: signedCandidate.operation_variant,
    external_cap04_forecast_status: signedCandidate.forecast_authority.forecast_candidate.status,
    external_cap04_forecast_point_count: signedCandidate.forecast_authority.forecast_candidate.points.length,
    snapshot_before_t_rejected: true,
    snapshot_after_created_at_rejected: true,
    historical_service_modified: false,
    canonical_persistence_authorized: signedCandidate.canonical_persistence_authorized,
    database_write_count: positive.loaded.database_write_count + signed.loaded.database_write_count + candidate.database_write_count + signedCandidate.database_write_count,
    provider_request_count: positive.loaded.provider_request_count + signed.loaded.provider_request_count + candidate.provider_request_count + signedCandidate.provider_request_count,
  }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});