// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_08_S1_BASE_RUNTIME_DB.ts
// Purpose: prove the bounded S1 runner establishes B00 and commits exactly 24 contiguous A-then-B base ticks in one fresh PostgreSQL database.
// Boundary: destructive fresh-database slice acceptance only; no final formal run, restart fault proof, late correction, Decision, Action Feedback, Residual, Calibration, route, scheduler, live ingestion, or production claim.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { PostgresForecastScenarioRecoveryRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_recovery_repository_v1.js";
import { PostgresNextTickRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import { PostgresRuntimeRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import { A0BootstrapRuntimeServiceV1 } from "../../apps/server/src/runtime/twin_runtime/a0_bootstrap_runtime_service_v1.js";
import { Cap04ForecastScenarioSingleTickServiceV1, type Cap04SingleTickPersistencePortV1 } from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import { Cap08DeferredScenarioPersistenceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_deferred_scenario_persistence_v1.js";
import { Cap08FrozenEvidenceSourceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_frozen_evidence_source_v1.js";
import { Cap08S1BaseTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s1_base_tick_service_v1.js";
import { Cap08S1BaseRangeServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s1_base_range_service_v1.js";
import { Cap08S1BaseRuntimeServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s1_base_runtime_service_v1.js";
import { CAP08_PHASE_ORDER_V1, CAP08_S1_PHASE_ENGINE_CONTRACT_DIGEST_V1 } from "../../apps/server/src/domain/twin_runtime/cap08_phase_engine_contracts_v1.js";
import { buildCap08S1FixtureV1, CAP08_S1_CREATED_AT_V1 } from "./mcft_cap_08_s1_fixture_v1.js";

if (process.env.MCFT_CAP08_S1_DESTRUCTIVE_ACCEPTANCE !== "1") throw new Error("SET_MCFT_CAP08_S1_DESTRUCTIVE_ACCEPTANCE_1");
const databaseUrl = String(process.env.DATABASE_URL || "");
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
if (!/(mcft|cap08|s1|acceptance|test)/.test(databaseName)) throw new Error("CAP08_S1_FRESH_ACCEPTANCE_DATABASE_REQUIRED");
const expectedRunner = "geox_mcft_cap08_runner_v1";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUTPUT = path.join(ROOT, "acceptance-output/MCFT_CAP_08_S1_BASE_RUNTIME_DB_RESULT.json");
const pool = new Pool({ connectionString: databaseUrl, max: 1 });

function sourceDigestV1(): string {
  const files = [
    "apps/server/src/domain/twin_runtime/cap08_phase_engine_contracts_v1.ts",
    "apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_repository_v1.ts",
    "apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.ts",
    "apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.ts",
    "apps/server/src/runtime/twin_runtime/cap08_deferred_scenario_persistence_v1.ts",
    "apps/server/src/runtime/twin_runtime/cap08_frozen_evidence_source_v1.ts",
    "apps/server/src/runtime/twin_runtime/cap08_s1_base_tick_service_v1.ts",
    "apps/server/src/runtime/twin_runtime/cap08_s1_base_range_service_v1.ts",
    "apps/server/src/runtime/twin_runtime/cap08_s1_base_runtime_service_v1.ts",
  ].sort();
  const hash = crypto.createHash("sha256");
  for (const file of files) {
    hash.update(file);
    hash.update("\0");
    hash.update(fs.readFileSync(path.join(ROOT, file)));
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}

function persistenceAdapterV1(
  runtimeRepository: PostgresRuntimeRepositoryV1,
  repository: PostgresForecastScenarioRecoveryRepositoryV1,
  order: string[],
): Cap04SingleTickPersistencePortV1 {
  return {
    acquireLease: runtimeRepository.acquireLease.bind(runtimeRepository),
    lookupARecordSet: repository.lookupARecordSet.bind(repository),
    async commitARecordSet(input) {
      const result = await repository.commitARecordSet(input);
      order.push(`A:${input.record_set.operation_key.logical_time}`);
      return result;
    },
    readARecordSet: repository.readARecordSet.bind(repository),
    lookupScenarioSet: repository.lookupScenarioSet.bind(repository),
    async commitScenarioSet(input) {
      const result = await repository.commitScenarioSet(input);
      order.push(`B:${input.record.scenario_set.logical_time}`);
      return result;
    },
    readScenarioSet: repository.readScenarioSet.bind(repository),
    readScenarioSetBySourceForecast: repository.readScenarioSetBySourceForecast.bind(repository),
    detectPendingScenario: repository.detectPendingScenario.bind(repository),
    rebuildForecastProjections: repository.rebuildForecastProjections.bind(repository),
    rebuildScenarioProjections: repository.rebuildScenarioProjections.bind(repository),
  };
}

async function countObjectTypeV1(objectType: string): Promise<number> {
  const result = await pool.query(
    "SELECT count(*)::int AS n FROM facts WHERE record_json->'payload'->>'object_type'=$1",
    [objectType],
  );
  return Number(result.rows[0].n);
}

async function countFactsV1(): Promise<number> {
  return Number((await pool.query("SELECT count(*)::int AS n FROM facts")).rows[0].n);
}

async function countRuntimeFactsV1(): Promise<number> {
  const objectTypes = [
    "twin_runtime_lineage_v1",
    "twin_state_estimate_v1",
    "twin_runtime_tick_v1",
    "twin_forecast_run_v1",
    "twin_scenario_set_v1",
    "twin_decision_record_v1",
    "twin_action_feedback_v1",
    "twin_forecast_residual_v1",
    "twin_calibration_candidate_v1",
    "twin_shadow_evaluation_v1",
    "twin_model_activation_v1",
  ];
  const result = await pool.query(
    "SELECT count(*)::int AS n FROM facts WHERE record_json->'payload'->>'object_type'=ANY($1::text[])",
    [objectTypes],
  );
  return Number(result.rows[0].n);
}

function writeResultV1(value: unknown): void {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(value, null, 2)}\n`);
}

async function main(): Promise<void> {
  const checks: Array<{ name: string; status: "PASS" }> = [];
  const ok = (name: string): void => { checks.push({ name, status: "PASS" }); console.log(`PASS ${name}`); };
  try {
    const identity = await pool.query("SELECT current_user AS current_user,current_database() AS current_database");
    assert.equal(identity.rows[0].current_user, expectedRunner);
    assert.equal(identity.rows[0].current_database, databaseName);
    ok("bounded CAP-08 runner identity connected to fresh target database");

    const baselineFactCount = await countFactsV1();
    assert.ok(baselineFactCount >= 0);
    assert.equal(await countRuntimeFactsV1(), 0);
    ok("fresh database starts with zero CAP-08 canonical Runtime facts");

    const fixture = buildCap08S1FixtureV1();
    const runtimeRepository = new PostgresRuntimeRepositoryV1(pool);
    const nextTickRepository = new PostgresNextTickRepositoryV1(pool);
    const forecastRepository = new PostgresForecastScenarioRecoveryRepositoryV1(pool);
    const realityBindingFirst = await nextTickRepository.commitRealityBindingSnapshot(fixture.reality_binding_snapshot);
    assert.equal(realityBindingFirst.status, "INSERTED");
    const realityBindingReplay = await nextTickRepository.commitRealityBindingSnapshot(fixture.reality_binding_snapshot);
    assert.equal(realityBindingReplay.status, "EXISTING_IDEMPOTENT_SUCCESS");
    assert.equal(await nextTickRepository.readRealityBindingSnapshot(fixture.reality_binding_snapshot.binding_id).then((value) => value?.determinism_hash), fixture.reality_binding_snapshot.determinism_hash);
    ok("immutable Reality Binding snapshot inserts and replays under SELECT/INSERT-only authority");
    for (const config of fixture.runtime_configs) {
      const inserted = await runtimeRepository.commitRuntimeConfig(config);
      assert.equal(inserted.status, "INSERTED");
    }
    const replayConfigs = [
      fixture.runtime_configs[0],
      fixture.runtime_configs[fixture.runtime_configs.length - 1],
    ];
    for (const config of replayConfigs) {
      assert.ok(config);
      const replay = await runtimeRepository.commitRuntimeConfig(config);
      assert.equal(replay.status, "EXISTING_IDEMPOTENT_SUCCESS");
    }
    ok("Runtime Config immutable idempotency inserts and exact-readback replays under SELECT/INSERT-only authority");

    const callOrder: string[] = [];
    const canonicalPersistence = persistenceAdapterV1(runtimeRepository, forecastRepository, callOrder);
    const deferred = new Cap08DeferredScenarioPersistenceV1(canonicalPersistence);
    const frozenEvidence = new Cap08FrozenEvidenceSourceV1(fixture.evidence_source);
    const handoff = new PrepareNextTickInputServiceV1(nextTickRepository);
    const cap04Tick = new Cap04ForecastScenarioSingleTickServiceV1(
      handoff,
      frozenEvidence,
      runtimeRepository,
      deferred,
    );
    const cap08Tick = new Cap08S1BaseTickServiceV1(handoff, frozenEvidence, deferred, cap04Tick);
    const phaseSourceDigest = sourceDigestV1();
    const range = new Cap08S1BaseRangeServiceV1(handoff, cap08Tick, phaseSourceDigest);
    const bootstrap = new A0BootstrapRuntimeServiceV1(runtimeRepository, runtimeRepository, fixture.evidence_source);
    const service = new Cap08S1BaseRuntimeServiceV1(bootstrap, range);

    const first = await service.execute({
      formal_run_id: fixture.formal_run_id,
      scope: fixture.scope,
      created_at: CAP08_S1_CREATED_AT_V1,
      bootstrap_runtime_config: fixture.bootstrap_runtime_config,
      bootstrap_hydraulic: fixture.hydraulic,
      soil_hydraulic_config_ref: "soil_hydraulic_config_c8_v1",
      runtime_config_refs_by_logical_time: fixture.runtime_config_refs_by_logical_time,
      runtime_config_hashes_by_logical_time: fixture.runtime_config_hashes_by_logical_time,
      authorized_future_forcing_binding_ids: ["binding_weather", "binding_et0"],
      crop_stage_context: fixture.crop_stage_context,
      lease_owner: "mcft-cap08-s1-base-runtime",
      lease_duration_seconds: 300,
    });
    assert.equal(first.status, "COMPLETED");
    assert.equal(first.bootstrap_id, "B00");
    assert.equal(first.bootstrap_counted_as_successful_tick, false);
    assert.equal(first.bootstrap.record_set.members.length, 9);
    assert.equal(first.range.executed_tick_count, 24);
    assert.equal(first.range.completed_tick_count, 24);
    assert.equal(first.range.posterior_state_count, 24);
    assert.equal(first.range.successful_forecast_count, 24);
    assert.equal(first.range.scenario_set_count, 24);
    assert.equal(first.range.forecast_point_count, 1728);
    assert.equal(first.range.scenario_point_count, 5184);
    assert.equal(first.range.action_feedback_count, 0);
    assert.equal(first.range.decision_count, 0);
    assert.equal(first.range.residual_count, 0);
    assert.equal(first.range.final_formal_run_id, null);
    assert.equal(first.range.phase_engine_contract_digest, CAP08_S1_PHASE_ENGINE_CONTRACT_DIGEST_V1);
    assert.equal(first.range.phase_engine_source_digest, phaseSourceDigest);
    ok("B00 plus exactly 24 successful base ticks completed");

    assert.equal(first.range.tick_results.length, 24);
    for (const result of first.range.tick_results) {
      assert.deepEqual(result.phase_trace.map((phase) => phase.phase), [...CAP08_PHASE_ORDER_V1]);
      assert.equal(result.barrier.status, "COMPLETE");
      assert.equal(result.barrier.next_tick_legal, true);
      assert.equal(result.barrier.action_feedback_count, 0);
      assert.equal(result.barrier.decision_count, 0);
      assert.equal(result.barrier.residual_count, 0);
      assert.equal(result.b_record.scenario_set.payload.options.length, 3);
      assert.ok(result.b_record.scenario_set.payload.options.every((option) => option.trajectory_points.length === 72));
    }
    ok("every Tick follows resolve/E/H/A/B/G/C/barrier with empty H/G/C providers");

    assert.equal(callOrder.length, 48);
    for (let index = 0; index < 24; index += 1) {
      assert.match(callOrder[index * 2], /^A:/);
      assert.match(callOrder[index * 2 + 1], /^B:/);
      assert.equal(callOrder[index * 2].slice(2), callOrder[index * 2 + 1].slice(2));
    }
    ok("real canonical database writes are ordered A then B for all 24 ticks");

    assert.equal(await countObjectTypeV1("twin_runtime_lineage_v1"), 1);
    assert.equal(await countObjectTypeV1("twin_state_estimate_v1"), 25);
    assert.equal(await countObjectTypeV1("twin_runtime_tick_v1"), 25);
    assert.equal(await countObjectTypeV1("twin_forecast_run_v1"), 25);
    assert.equal(await countObjectTypeV1("twin_scenario_set_v1"), 24);
    assert.equal(await countObjectTypeV1("twin_decision_record_v1"), 0);
    assert.equal(await countObjectTypeV1("twin_action_feedback_v1"), 0);
    assert.equal(await countObjectTypeV1("twin_forecast_residual_v1"), 0);
    assert.equal(await countObjectTypeV1("twin_calibration_candidate_v1"), 0);
    assert.equal(await countObjectTypeV1("twin_shadow_evaluation_v1"), 0);
    assert.equal(await countObjectTypeV1("twin_model_activation_v1"), 0);
    ok("canonical cardinality and S1 nonclaims are exact");

    assert.equal(Number((await pool.query("SELECT count(*)::int AS n FROM twin_forecast_point_projection_v1")).rows[0].n), 1728);
    assert.equal(Number((await pool.query("SELECT count(*)::int AS n FROM twin_scenario_point_projection_v1")).rows[0].n), 5184);
    assert.equal(Number((await pool.query("SELECT count(*)::int AS n FROM twin_scenario_set_projection_v1")).rows[0].n), 24);
    const checkpoint = await pool.query(
      `SELECT
         f.record_json->'payload'->'payload'->>'next_tick_logical_time' AS next_logical_tick_time,
         (f.record_json->'payload'->'payload'->>'tick_sequence')::int AS tick_sequence
       FROM twin_runtime_checkpoint_latest_index_v1 i
       JOIN facts f ON f.fact_id=i.source_fact_id
       WHERE i.tenant_id=$1 AND i.project_id=$2 AND i.group_id=$3
         AND i.field_id=$4 AND i.season_id=$5 AND i.zone_id=$6`,
      [fixture.scope.tenant_id, fixture.scope.project_id, fixture.scope.group_id, fixture.scope.field_id, fixture.scope.season_id, fixture.scope.zone_id],
    );
    assert.equal(checkpoint.rows.length, 1);
    assert.equal(new Date(checkpoint.rows[0].next_logical_tick_time).toISOString(), "2026-06-02T00:00:00.000Z");
    assert.equal(Number(checkpoint.rows[0].tick_sequence), 24);
    ok("forecast/scenario projections and final persisted handoff are exact");

    const factsAfterFirst = await countFactsV1();
    const callOrderAfterFirst = [...callOrder];
    const second = await service.execute({
      formal_run_id: fixture.formal_run_id,
      scope: fixture.scope,
      created_at: CAP08_S1_CREATED_AT_V1,
      bootstrap_runtime_config: fixture.bootstrap_runtime_config,
      bootstrap_hydraulic: fixture.hydraulic,
      soil_hydraulic_config_ref: "soil_hydraulic_config_c8_v1",
      runtime_config_refs_by_logical_time: fixture.runtime_config_refs_by_logical_time,
      runtime_config_hashes_by_logical_time: fixture.runtime_config_hashes_by_logical_time,
      authorized_future_forcing_binding_ids: ["binding_weather", "binding_et0"],
      crop_stage_context: fixture.crop_stage_context,
      lease_owner: "mcft-cap08-s1-base-runtime-replay",
      lease_duration_seconds: 300,
    });
    assert.equal(second.status, "ALREADY_COMPLETE");
    assert.equal(second.range.executed_tick_count, 0);
    assert.equal(await countFactsV1(), factsAfterFirst);
    assert.deepEqual(callOrder, callOrderAfterFirst);
    ok("completed rerun is database-only idempotent readback with zero canonical writes");

    const result = {
      schema_version: "geox_mcft_cap08_s1_base_runtime_db_result_v1",
      status: "PASS",
      database_class: "FRESH_DISPOSABLE_POSTGRESQL_DATABASE",
      current_user: expectedRunner,
      formal_run_id: fixture.formal_run_id,
      bootstrap_id: "B00",
      bootstrap_counted_as_successful_tick: false,
      successful_tick_count: 24,
      bootstrap_inclusive_state_count: 25,
      successful_forecast_count: 24,
      forecast_point_count: 1728,
      scenario_set_count: 24,
      scenario_option_count: 72,
      scenario_point_count: 5184,
      action_feedback_count: 0,
      decision_count: 0,
      residual_count: 0,
      calibration_candidate_count: 0,
      shadow_evaluation_count: 0,
      model_activation_count: 0,
      phase_order: CAP08_PHASE_ORDER_V1,
      canonical_write_order: "A_THEN_B",
      phase_engine_contract_digest: CAP08_S1_PHASE_ENGINE_CONTRACT_DIGEST_V1,
      phase_engine_source_digest: phaseSourceDigest,
      source_evidence_load_count: fixture.evidence_source_load_count(),
      baseline_fact_count: baselineFactCount,
      total_fact_count: factsAfterFirst,
      canonical_runtime_fact_delta: factsAfterFirst - baselineFactCount,
      slice_acceptance_only: true,
      final_formal_run_id: null,
      final_formal_closure_executed: false,
      production_runtime_source_authorized: false,
      public_http_writer_authorized: false,
      background_scheduler_authorized: false,
      mcft_cap_09_authorized: false,
      checks,
    };
    writeResultV1(result);
    console.log(JSON.stringify(result));
  } catch (error) {
    const result = {
      schema_version: "geox_mcft_cap08_s1_base_runtime_db_result_v1",
      status: "FAIL",
      error: error instanceof Error ? error.message : String(error),
      checks,
    };
    writeResultV1(result);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
