// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_FORECAST_RESIDUAL_OUTCOME_TICK_DB.ts
// Purpose: prove the production PostgreSQL historical-Forecast source resolves a post-receipt Forecast through canonical fact/projection identity, then the real outcome-tick service commits, replays and recovers one C Forecast Residual.
// Boundary: destructive isolated-database acceptance only; no production database, route, scheduler, range, restart/backfill, Recommendation, AO-ACT, calibration, model activation, causal attribution or CAP-06 authority.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { validateCap05ForecastResidualV1 } from "../../apps/server/src/domain/twin_runtime/forecast_observation_residual_v1.js";
import { PostgresFeedbackPersistenceRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_feedback_persistence_repository_v1.js";
import { PostgresForecastResidualSourceV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_forecast_residual_source_v1.js";
import { Cap05ForecastResidualOutcomeTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/forecast_residual_outcome_tick_service_v1.js";
import {
  CAP05_S8_OUTCOME_TIME_V1,
  buildCap05S8ForecastResidualFixtureV1,
  memberFromCap05S8TickV1,
} from "./mcft_cap_05_s8_forecast_residual_fixture_v1.js";

if (process.env.MCFT_CAP_05_S8_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP_05_S8_DESTRUCTIVE_ACCEPTANCE_1");
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
if (!/(mcft|cap05|s8|residual|acceptance|test)/.test(databaseName)) {
  throw new Error("ISOLATED_ACCEPTANCE_DATABASE_REQUIRED");
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pool = new Pool({ connectionString: databaseUrl });
let pass = 0;

function ok(label: string): void {
  pass += 1;
  console.log(`PASS ${label}`);
}

function readSqlV1(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function factIdV1(objectId: string): string {
  return `fact_${objectId}`;
}

function recordJsonV1(object: CanonicalObjectEnvelopeV1): string {
  return JSON.stringify({ type: object.object_type, payload: object });
}

async function initializeSchemaV1(): Promise<void> {
  await pool.query(readSqlV1("docker/postgres/init/001_schema.sql"));
  await pool.query(readSqlV1("apps/server/db/migrations/2026_07_09_mcft_cap_01_a0_persistence.sql"));
  await pool.query(readSqlV1("apps/server/db/migrations/2026_07_10_mcft_cap_02_continuation_persistence.sql"));
  await pool.query(readSqlV1("apps/server/db/migrations/2026_07_13_mcft_cap_04_forecast_scenario_persistence.sql"));
  await pool.query(readSqlV1("apps/server/db/migrations/2026_07_14_mcft_cap_05_feedback_persistence.sql"));
}

async function insertCanonicalFactV1(object: CanonicalObjectEnvelopeV1): Promise<void> {
  await pool.query(
    `INSERT INTO facts (fact_id,occurred_at,source,record_json)
     VALUES ($1,$2::timestamptz,'system',$3::jsonb)`,
    [factIdV1(object.object_id), object.logical_time, recordJsonV1(object)],
  );
}

async function seedForecastAuthorityV1(input: {
  forecast: CanonicalObjectEnvelopeV1;
  state: CanonicalObjectEnvelopeV1;
  evidence: CanonicalObjectEnvelopeV1;
}): Promise<void> {
  await insertCanonicalFactV1(input.evidence);
  await insertCanonicalFactV1(input.state);
  await insertCanonicalFactV1(input.forecast);
  const payload = input.forecast.payload;
  if (payload.status !== "COMPLETED" || !Array.isArray(payload.points) || payload.points.length !== 72) {
    throw new Error("CAP05_S8_DB_COMPLETED_FORECAST_REQUIRED");
  }
  await pool.query(
    `INSERT INTO twin_forecast_run_projection_v1
     (forecast_object_id,tenant_id,project_id,group_id,field_id,season_id,zone_id,lineage_id,revision_id,
      logical_time,forecast_status,source_posterior_ref,source_posterior_hash,runtime_config_ref,runtime_config_hash,
      forcing_window_hash,point_count,determinism_hash,canonical_payload,source_fact_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20)`,
    [
      input.forecast.object_id,
      input.forecast.tenant_id,
      input.forecast.project_id,
      input.forecast.group_id,
      input.forecast.field_id,
      input.forecast.season_id,
      input.forecast.zone_id,
      input.forecast.lineage_id,
      input.forecast.revision_id,
      input.forecast.logical_time,
      payload.status,
      payload.source_posterior_ref,
      payload.source_posterior_hash,
      input.forecast.runtime_config_ref,
      input.forecast.runtime_config_hash,
      payload.forcing_window_hash,
      payload.points.length,
      input.forecast.determinism_hash,
      JSON.stringify(payload),
      factIdV1(input.forecast.object_id),
    ],
  );
  for (const point of payload.points as Array<Record<string, unknown>>) {
    await pool.query(
      `INSERT INTO twin_forecast_point_projection_v1
       (forecast_object_id,horizon_hour,target_time,storage_mean_mm,storage_variance_mm2,
        available_water_fraction,determinism_hash,canonical_point)
       VALUES ($1,$2,$3::timestamptz,$4,$5,$6,$7,$8::jsonb)`,
      [
        input.forecast.object_id,
        point.horizon_hour,
        point.target_time,
        point.storage_mean_mm,
        point.storage_variance_mm2,
        point.available_water_fraction,
        point.determinism_hash,
        JSON.stringify(point),
      ],
    );
  }
}

async function countV1(fromClause: string, values: unknown[] = []): Promise<number> {
  const result = await pool.query(`SELECT count(*)::int AS count FROM ${fromClause}`, values);
  return result.rows[0].count as number;
}

async function main(): Promise<void> {
  await initializeSchemaV1();
  const fixture = await buildCap05S8ForecastResidualFixtureV1();
  const postReceiptState = memberFromCap05S8TickV1(fixture.post_receipt_tick, "twin_state_estimate_v1");
  const postReceiptEvidence = memberFromCap05S8TickV1(fixture.post_receipt_tick, "twin_evidence_window_v1");
  const repository = new PostgresFeedbackPersistenceRepositoryV1(pool);
  assert.equal((await repository.commitCanonicalObject({ object: fixture.action_feedback })).status, "INSERTED");
  await seedForecastAuthorityV1({
    forecast: fixture.historical_forecast,
    state: postReceiptState,
    evidence: postReceiptEvidence,
  });
  ok("isolated PostgreSQL contains canonical H plus the exact post-receipt State, Evidence Window and COMPLETED Forecast authority");

  const source = new PostgresForecastResidualSourceV1(pool);
  const candidates = await source.loadHistoricalForecastCandidates({
    scope: fixture.scope,
    lineage_id: String(fixture.historical_forecast.lineage_id),
    revision_id: String(fixture.historical_forecast.revision_id),
    observation_target_time: CAP05_S8_OUTCOME_TIME_V1,
    observation_available_to_runtime_at: CAP05_S8_OUTCOME_TIME_V1,
  });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].forecast.object_id, fixture.historical_forecast.object_id);
  assert.deepEqual(candidates[0].source_posterior_action_feedback_refs, [fixture.action_feedback.object_id]);
  ok("production PostgreSQL source reconstructs the exact historical Forecast and proves source-posterior H consumption");

  const service = new Cap05ForecastResidualOutcomeTickServiceV1(
    fixture.outcome_tick_service,
    fixture.runtime,
    source,
    repository,
  );
  const inserted = await service.executeOneTickAndCommitResidual(fixture.input);
  validateCap05ForecastResidualV1(inserted.residual);
  assert.equal(inserted.residual_status, "INSERTED");
  assert.equal(inserted.residual.payload.forecast_run_ref, fixture.historical_forecast.object_id);
  assert.equal(inserted.residual.payload.actual_observation_ref, fixture.observation_record.source_record_id);
  assert.equal(inserted.residual.payload.assimilation_update_ref, memberFromCap05S8TickV1(inserted.tick, "twin_assimilation_update_v1").object_id);
  ok("real outcome tick and production C repository append one canonical Forecast Residual with exact source and observation refs");

  assert.equal(await countV1("facts WHERE record_json->>'type'='twin_forecast_residual_v1'"), 1);
  assert.equal(await countV1("twin_forecast_residual_projection_v1"), 1);
  assert.equal(await countV1("twin_object_idempotency_index_v1 WHERE identity_kind='C_FORECAST_RESIDUAL'"), 1);
  assert.equal((await repository.readCanonicalObject(inserted.residual.object_id))?.determinism_hash, inserted.residual.determinism_hash);
  ok("C fact, projection, idempotency guard and canonical readback are one-to-one");

  const replay = await service.executeOneTickAndCommitResidual(fixture.input);
  assert.equal(replay.tick.status, "EXISTING_IDEMPOTENT_SUCCESS");
  assert.equal(replay.residual_status, "EXISTING_IDEMPOTENT_SUCCESS");
  assert.equal(replay.residual.determinism_hash, inserted.residual.determinism_hash);
  assert.equal(await countV1("facts WHERE record_json->>'type'='twin_forecast_residual_v1'"), 1);
  ok("full outcome-tick plus C replay is idempotent and creates no duplicate residual fact");

  const wrongScope = await source.loadHistoricalForecastCandidates({
    scope: { ...fixture.scope, zone_id: `${fixture.scope.zone_id}_wrong` },
    lineage_id: String(fixture.historical_forecast.lineage_id),
    revision_id: String(fixture.historical_forecast.revision_id),
    observation_target_time: CAP05_S8_OUTCOME_TIME_V1,
    observation_available_to_runtime_at: CAP05_S8_OUTCOME_TIME_V1,
  });
  assert.deepEqual(wrongScope, []);
  ok("historical Forecast source enforces exact Reality scope");

  await pool.query("DELETE FROM twin_forecast_residual_projection_v1");
  await pool.query("DELETE FROM twin_object_idempotency_index_v1 WHERE identity_kind='C_FORECAST_RESIDUAL'");
  const recovery = await repository.rebuildAllSupportState();
  assert.equal(recovery.forecast_residual_projections_rebuilt, 1);
  assert.equal(await countV1("twin_forecast_residual_projection_v1"), 1);
  assert.equal(await countV1("twin_object_idempotency_index_v1 WHERE identity_kind='C_FORECAST_RESIDUAL'"), 1);
  assert.equal(await countV1("facts WHERE record_json->>'type'='twin_forecast_residual_v1'"), 1);
  ok("deleted C support state rebuilds from append-only facts without duplicate canonical history");

  await pool.query("DELETE FROM twin_action_feedback_projection_v1");
  const noFeedbackProof = await source.loadHistoricalForecastCandidates({
    scope: fixture.scope,
    lineage_id: String(fixture.historical_forecast.lineage_id),
    revision_id: String(fixture.historical_forecast.revision_id),
    observation_target_time: CAP05_S8_OUTCOME_TIME_V1,
    observation_available_to_runtime_at: CAP05_S8_OUTCOME_TIME_V1,
  });
  assert.equal(noFeedbackProof.length, 1);
  assert.deepEqual(noFeedbackProof[0].source_posterior_action_feedback_refs, []);
  ok("missing H projection proof does not infer Action Feedback consumption from the Evidence ref alone");

  assert.equal(pass, 8);
  console.log(`MCFT-CAP-05 S8 Forecast Residual PostgreSQL path: ${pass} PASS / 0 FAIL`);
}

main().finally(async () => pool.end());
