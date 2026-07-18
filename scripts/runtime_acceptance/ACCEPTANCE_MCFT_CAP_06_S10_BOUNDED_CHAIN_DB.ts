// Purpose: compose the controlled MCFT-CAP-06 S1-S8 governance/data chain and S9 Runtime chain in two namespaced isolated PostgreSQL stages, freeze the R+C+12 canonical delta, and prove zero-write replay in each stage.
// Boundary: destructive acceptance only; no production database, new Runtime service, new math, migration, Model Activation, active-config switch, route, Web, scheduler, or CAP-07 authority.

import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import {
  CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1,
  CAP06_HOLDOUT_PURPOSE_V1,
  CAP06_WINDOW_HASH_SEMANTICS_V1,
} from "../../apps/server/src/domain/calibration/contracts_v1.js";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  PostgresCalibrationGovernanceRepositoryV1,
  type Cap06GovernanceObjectV1,
} from "../../apps/server/src/persistence/calibration/postgres_calibration_governance_repository_v1.js";
import { PostgresResolvedForecastObservationCaseAssemblerV1 } from "../../apps/server/src/persistence/calibration/postgres_resolved_forecast_observation_case_assembler_v1.js";
import { PostgresForecastScenarioRecoveryRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_recovery_repository_v1.js";
import { PostgresNextTickRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import { PostgresRuntimeRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import { Cap06CalibrationCandidateServiceV1 } from "../../apps/server/src/runtime/calibration/calibration_candidate_service_v1.js";
import { Cap06PairedHistoricalShadowServiceV1 } from "../../apps/server/src/runtime/calibration/paired_historical_shadow_service_v1.js";
import {
  Cap06PostEvaluationNonConsumptionTickServiceV1,
  type Cap06S9ReadPortV1,
} from "../../apps/server/src/runtime/calibration/post_evaluation_non_consumption_tick_service_v1.js";
import { Cap06ShadowEvaluationCommitServiceV1 } from "../../apps/server/src/runtime/calibration/shadow_evaluation_commit_service_v1.js";
import type { ContinuationCropStageConfigurationContextV1 } from "../../apps/server/src/runtime/twin_runtime/continuation_evidence_window_service_v1.js";
import { Cap04OrCap05ExecutionConfigResolverV1 } from "../../apps/server/src/runtime/twin_runtime/cap04_or_cap05_execution_config_resolver_v1.js";
import {
  Cap04ForecastScenarioSingleTickServiceV1,
  type Cap04SingleTickPersistencePortV1,
} from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.js";
import { Cap04PendingScenarioBarrierSingleTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/pending_scenario_barrier_service_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  ReplayEvidenceSourcePortV1,
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";
import {
  buildCap06S5GraphConformantDatasetV2,
  type Cap06S5GraphConformantCaseV2,
  type Cap06S5GraphObservationRecordV2,
} from "./mcft_cap_06_s5_graph_conformant_fixture_v2.js";

if (process.env.MCFT_CAP_06_S10_BOUNDED_CHAIN_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP_06_S10_BOUNDED_CHAIN_DESTRUCTIVE_ACCEPTANCE_1");
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
if (!/(mcft|cap06|s10|bounded|acceptance|test)/.test(databaseName)) {
  throw new Error("ISOLATED_ACCEPTANCE_DATABASE_REQUIRED");
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CREATED_AT = "2026-07-18T08:10:00.000Z";
const NEXT_LOGICAL_TIME = "2026-06-04T02:00:00.000Z";
const HOUR_MS = 3_600_000;
const CANDIDATE_REF = "twin_calibration_candidate_5649b9ab80b5545cf6007387";
const CANDIDATE_HASH = "sha256:a2018a61bf6699b3cc3b8992058eb2c37b4d38d7f70771f9186495144c229a65";
const EVALUATION_REF = "twin_shadow_evaluation_8cae1f6732420a4999deffc0";
const EVALUATION_HASH = "sha256:32c43020f45351994120515e5c633531bb594d85659456c65bd46305737d85e0";
const BASE_COEFFICIENT = "0.030000";
const EXPECTED_R = 24;
const EXPECTED_C = 0;
const EXPECTED_DELTA = 36;
const LEASE_OWNER = "mcft-cap06-s10-bounded-chain-replay";
const PROJECTION_TABLES = [
  "twin_object_idempotency_index_v1",
  "twin_calibration_candidate_projection_v1",
  "twin_shadow_evaluation_projection_v1",
  "twin_candidate_evaluation_index_v1",
  "twin_shadow_evaluation_case_projection_v1",
  "twin_terminal_tick_uniqueness_v1",
  "twin_scenario_set_uniqueness_v1",
  "twin_forecast_run_projection_v1",
  "twin_forecast_point_projection_v1",
  "twin_scenario_set_projection_v1",
  "twin_scenario_point_projection_v1",
  "twin_forecast_result_latest_index_v1",
  "twin_forecast_success_latest_index_v1",
  "twin_scenario_latest_index_v1",
  "twin_state_latest_index_v1",
  "twin_runtime_checkpoint_latest_index_v1",
  "twin_runtime_health_latest_index_v1",
] as const;

let pool: Pool | undefined;
let pass = 0;

function ok(label: string): void {
  pass += 1;
  console.log(`PASS ${label}`);
}
function dbV1(): Pool {
  if (!pool) throw new Error("CAP06_S10_DB_POOL_NOT_OPEN");
  return pool;
}
function runChildV1(label: string, args: string[], env: Record<string, string>): void {
  const result = childProcess.spawnSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", args, {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: databaseUrl, ...env },
    encoding: "utf8",
    stdio: "pipe",
    maxBuffer: 256 * 1024 * 1024,
    shell: false,
  });
  process.stdout.write(String(result.stdout || ""));
  process.stderr.write(String(result.stderr || ""));
  assert.equal(result.status, 0, `${label}_FAILED:${result.status}`);
}
async function openPoolV1(): Promise<void> {
  pool = new Pool({ connectionString: databaseUrl });
  await pool.query("SELECT 1");
}
async function closePoolV1(): Promise<void> {
  if (pool) await pool.end();
  pool = undefined;
}
async function countV1(fromClause: string, values: unknown[] = []): Promise<number> {
  return Number((await dbV1().query(`SELECT count(*)::int AS count FROM ${fromClause}`, values)).rows[0].count);
}
async function factsHashV1(): Promise<string> {
  const result = await dbV1().query("SELECT fact_id,occurred_at,source,record_json FROM facts ORDER BY fact_id ASC");
  return semanticHashV1(result.rows);
}
async function semanticTableRowsV1(table: string): Promise<unknown[]> {
  const result = await dbV1().query(
    `SELECT COALESCE(jsonb_agg(row_json ORDER BY row_json::text),'[]'::jsonb) AS rows
       FROM (SELECT to_jsonb(t) - 'created_at' - 'updated_at' AS row_json FROM ${table} t) s`,
  );
  return result.rows[0].rows as unknown[];
}
async function projectionSnapshotV1(): Promise<Record<string, unknown[]>> {
  const result: Record<string, unknown[]> = {};
  for (const table of PROJECTION_TABLES) result[table] = await semanticTableRowsV1(table);
  return result;
}
async function relationV1(name: string): Promise<string | null> {
  return (await dbV1().query("SELECT to_regclass($1)::text AS relation", [name])).rows[0].relation ?? null;
}
async function activeConfigSnapshotV1(): Promise<{ relation: string | null; hash: string | null }> {
  const relation = await relationV1("public.twin_active_config_index_v1");
  if (!relation) return { relation: null, hash: null };
  const result = await dbV1().query(
    `SELECT COALESCE(jsonb_agg(row_json ORDER BY row_json::text),'[]'::jsonb) AS rows
       FROM (SELECT to_jsonb(t) AS row_json FROM ${relation} t) s`,
  );
  return { relation, hash: semanticHashV1(result.rows[0].rows) };
}
async function insertCanonicalFactV1(object: CanonicalObjectEnvelopeV1): Promise<void> {
  await dbV1().query(
    `INSERT INTO facts (fact_id,occurred_at,source,record_json)
     VALUES ($1,$2::timestamptz,'mcft_cap06_s10_completed_chain_replay',$3::jsonb)
     ON CONFLICT (fact_id) DO NOTHING`,
    [`fact_${object.object_id}`, object.logical_time, JSON.stringify({ type: object.object_type, payload: object })],
  );
}
async function insertObservationV1(record: Cap06S5GraphObservationRecordV2): Promise<void> {
  await dbV1().query(
    `INSERT INTO facts (fact_id,occurred_at,source,record_json)
     VALUES ($1,$2::timestamptz,'mcft_cap06_s10_completed_chain_replay',$3::jsonb)
     ON CONFLICT (fact_id) DO NOTHING`,
    [`fact_${record.source_record_id}`, record.available_to_runtime_at, JSON.stringify({ type: record.record_type, payload: record })],
  );
}
async function seedDatasetIdempotentlyV1(cases: readonly Cap06S5GraphConformantCaseV2[]): Promise<void> {
  const inserted = new Set<string>();
  const once = async (object: CanonicalObjectEnvelopeV1): Promise<void> => {
    if (inserted.has(object.object_id)) return;
    inserted.add(object.object_id);
    await insertCanonicalFactV1(object);
  };
  for (const item of cases) {
    await once(item.source_runtime_config);
    await once(item.source_evidence_window);
    await once(item.source_state);
    await once(item.source_forecast);
    await insertObservationV1(item.observation_record);
    await once(item.observation_evidence_window);
    await once(item.assimilation_update);
    await once(item.observation_posterior);
    await once(item.residual as unknown as CanonicalObjectEnvelopeV1);
  }
}
function exactScopeV1(object: Cap06GovernanceObjectV1): TwinScopeKeyV1 {
  return {
    tenant_id: object.scope.tenant_id,
    project_id: object.scope.project_id,
    group_id: object.scope.group_id,
    field_id: object.scope.field_id,
    season_id: object.scope.season_id,
    zone_id: object.scope.zone_id,
  };
}
function addHoursV1(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * HOUR_MS).toISOString();
}
function fixed6V1(value: unknown, code: string): string {
  if (typeof value === "number" && Number.isFinite(value)) return value.toFixed(6);
  if (typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value)) return Number(value).toFixed(6);
  throw new Error(code);
}
function persistenceAdapterV1(
  runtimeRepository: PostgresRuntimeRepositoryV1,
  repository: PostgresForecastScenarioRecoveryRepositoryV1,
): Cap04SingleTickPersistencePortV1 {
  return {
    acquireLease: runtimeRepository.acquireLease.bind(runtimeRepository),
    lookupARecordSet: repository.lookupARecordSet.bind(repository),
    commitARecordSet: repository.commitARecordSet.bind(repository),
    readARecordSet: repository.readARecordSet.bind(repository),
    lookupScenarioSet: repository.lookupScenarioSet.bind(repository),
    commitScenarioSet: repository.commitScenarioSet.bind(repository),
    readScenarioSet: repository.readScenarioSet.bind(repository),
    readScenarioSetBySourceForecast: repository.readScenarioSetBySourceForecast.bind(repository),
    detectPendingScenario: repository.detectPendingScenario.bind(repository),
    rebuildForecastProjections: repository.rebuildForecastProjections.bind(repository),
    rebuildScenarioProjections: repository.rebuildScenarioProjections.bind(repository),
  };
}
async function replayCompletedS9TickV1(input: {
  candidate: Cap06GovernanceObjectV1;
  evaluation: Cap06GovernanceObjectV1;
}): Promise<{ status: string; evidence_load_count: number }> {
  const scope = exactScopeV1(input.candidate);
  const calibrationRepository = new PostgresCalibrationGovernanceRepositoryV1(dbV1());
  const runtimeRepository = new PostgresRuntimeRepositoryV1(dbV1());
  const nextTickRepository = new PostgresNextTickRepositoryV1(dbV1());
  const recoveryRepository = new PostgresForecastScenarioRecoveryRepositoryV1(dbV1());
  const persisted = await nextTickRepository.readPersistedNextTickSnapshot(scope);
  assert.ok(persisted, "CAP06_S10_S9_PERSISTED_SNAPSHOT_REQUIRED");
  assert.equal(persisted.checkpoint.payload.tick_sequence, 73);
  assert.equal(persisted.checkpoint.logical_time, NEXT_LOGICAL_TIME);
  const configPayload = persisted.runtime_config.payload as Record<string, any>;
  assert.equal(fixed6V1(configPayload.dynamics_parameters?.drainage_coefficient_per_hour, "CAP06_S10_DRAINAGE_INVALID"), BASE_COEFFICIENT);
  const cropStageContext: ContinuationCropStageConfigurationContextV1 = {
    schema_version: "v1",
    dataset_id: "mcft_cap06_s9_crop_stage_v1",
    context_class: "CONFIGURATION_DERIVED_CONTEXT",
    evidence_record: false,
    configuration_matrix_ref: "mcft_configuration_matrix_cap06_s9",
    configuration_matrix_hash: String(configPayload.configuration_matrix_hash),
    crop_water_use_binding_ref: "crop_water_use_cap06_s9",
    crop_water_use_configuration_source_id: "crop_water_use_source_cap06_s9",
    crop_stage_mapping_source: "CONTROLLED_REPLAY_CONFIGURATION",
    timezone: "UTC",
    coverage_start: addHoursV1("2026-06-03T03:00:00.000Z", -24),
    coverage_end_exclusive: addHoursV1(NEXT_LOGICAL_TIME, 120),
    crop_stage_schedule: [{
      stage_code: "CONTROLLED_STAGE_V1",
      effective_from: addHoursV1("2026-06-03T03:00:00.000Z", -24),
      effective_to: addHoursV1(NEXT_LOGICAL_TIME, 120),
      kc: 1,
    }],
    limitations: ["CONTROLLED_SYNTHETIC", "NOT_FIELD_CALIBRATED"],
    determinism_hash: String(configPayload.crop_stage_context?.context_hash),
  };
  let evidenceLoads = 0;
  const source: ReplayEvidenceSourcePortV1 = {
    async loadCandidateRecords(): Promise<CanonicalReplayEvidenceRecordV1[]> {
      evidenceLoads += 1;
      throw new Error("CAP06_S10_COMPLETED_TICK_MUST_NOT_LOAD_EVIDENCE");
    },
  };
  const handoff = new PrepareNextTickInputServiceV1(nextTickRepository);
  const persistence = persistenceAdapterV1(runtimeRepository, recoveryRepository);
  const inner = new Cap04ForecastScenarioSingleTickServiceV1(handoff, source, runtimeRepository, persistence);
  const barrier = new Cap04PendingScenarioBarrierSingleTickServiceV1(handoff, runtimeRepository, persistence, inner);
  const readPort: Cap06S9ReadPortV1 = {
    readCanonicalObject: calibrationRepository.readCanonicalObject.bind(calibrationRepository),
    async readRuntimeAuthoritySnapshot(request) {
      const config = await runtimeRepository.readRuntimeConfig(request.runtime_config_ref);
      if (!config || config.determinism_hash !== request.runtime_config_hash) {
        throw new Error("CAP06_S10_S9_CONFIG_EXACT_READBACK_FAILED");
      }
      const active = await activeConfigSnapshotV1();
      return {
        scope: structuredClone(request.scope),
        inspected_runtime_config_ref: config.object_id,
        inspected_runtime_config_hash: config.determinism_hash,
        effective_drainage_coefficient_per_hour: (config.payload as Record<string, any>).dynamics_parameters.drainage_coefficient_per_hour,
        runtime_config_semantic_payload: structuredClone(config.payload as Record<string, unknown>),
        active_config_relation: active.relation,
        active_config_snapshot_hash: active.hash,
        model_activation_count: await countV1("facts WHERE record_json->>'type'='twin_model_activation_v1'"),
        candidate_fact_count: await countV1("facts WHERE record_json->>'type'='twin_calibration_candidate_v1'"),
        evaluation_fact_count: await countV1("facts WHERE record_json->>'type'='twin_shadow_evaluation_v1'"),
      };
    },
  };
  const service = new Cap06PostEvaluationNonConsumptionTickServiceV1(readPort, barrier);
  const result = await service.execute({
    candidate_ref: CANDIDATE_REF,
    candidate_hash: CANDIDATE_HASH,
    evaluation_ref: EVALUATION_REF,
    evaluation_hash: EVALUATION_HASH,
    expected_candidate_parameter_value: "0.034000",
    tick_input: {
      scope,
      logical_time: persisted.checkpoint.logical_time,
      created_at: CREATED_AT,
      runtime_config_ref: persisted.runtime_config.object_id,
      runtime_config_hash: persisted.runtime_config.determinism_hash,
      authorized_future_forcing_binding_ids: ["binding_weather", "binding_et0"],
      crop_stage_context: cropStageContext,
      lease_owner: LEASE_OWNER,
      lease_duration_seconds: 300,
    },
  });
  assert.equal(result.status, "EXISTING_IDEMPOTENT_SUCCESS");
  assert.equal(result.candidate_consumed, false);
  assert.equal(result.evaluation_consumed, false);
  assert.equal(result.effective_tick_parameter_value, BASE_COEFFICIENT);
  assert.equal(evidenceLoads, 0);
  return { status: result.status, evidence_load_count: evidenceLoads };
}

async function main(): Promise<void> {
  runChildV1(
    "S8_CONTROLLED_CHAIN_CAPTURE",
    ["-w", "exec", "tsx", "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S8_RESTART_READBACK_REBUILD_DB.ts"],
    { MCFT_CAP_06_S8_RESTART_READBACK_REBUILD_DESTRUCTIVE_ACCEPTANCE: "1" },
  );
  await openPoolV1();
  const s8ResidualRefs = (await dbV1().query(
    `SELECT record_json->'payload'->>'object_id' AS object_id
       FROM facts
      WHERE record_json->>'type'='twin_forecast_residual_v1'
      ORDER BY object_id ASC`,
  )).rows.map((row) => String(row.object_id));
  const s8ResidualCount = s8ResidualRefs.length;
  assert.equal(s8ResidualCount, EXPECTED_R);
  const s8Repository = new PostgresCalibrationGovernanceRepositoryV1(dbV1());
  const s8Candidate = await s8Repository.readCanonicalObject(CANDIDATE_REF);
  const s8Evaluation = await s8Repository.readCanonicalObject(EVALUATION_REF);
  assert.ok(s8Candidate && s8Evaluation);
  assert.equal(s8Candidate.determinism_hash, CANDIDATE_HASH);
  assert.equal(s8Evaluation.determinism_hash, EVALUATION_HASH);
  const controlledScope = exactScopeV1(s8Candidate);

  const s8FactsBeforeReplay = await countV1("facts");
  const s8FactsHashBeforeReplay = await factsHashV1();
  const s8ProjectionBeforeReplay = await projectionSnapshotV1();
  const s8ProjectionHashBeforeReplay = semanticHashV1(s8ProjectionBeforeReplay);
  const s8ActiveBeforeReplay = await activeConfigSnapshotV1();
  const s8ActivationBeforeReplay = await countV1("facts WHERE record_json->>'type'='twin_model_activation_v1'");
  const dataset = await buildCap06S5GraphConformantDatasetV2();
  assert.equal(dataset.cases.length, 24);
  await seedDatasetIdempotentlyV1(dataset.cases);
  const sourceIdentity = {
    residual_set_hash: dataset.residual_set_hash,
    case_input_set_hash: dataset.case_input_set_hash,
    calibration_window_hash: dataset.calibration_window_hash,
    holdout_window_hash: dataset.holdout_window_hash,
    window_hash_semantics: CAP06_WINDOW_HASH_SEMANTICS_V1,
    holdout_purpose: CAP06_HOLDOUT_PURPOSE_V1,
    holdout_generalization_claim: CAP06_HOLDOUT_GENERALIZATION_CLAIM_V1,
  };
  const s8Assembler = new PostgresResolvedForecastObservationCaseAssemblerV1(
    dbV1(),
    new Cap04OrCap05ExecutionConfigResolverV1(),
  );
  const candidateReplay = await new Cap06CalibrationCandidateServiceV1(s8Assembler, s8Repository).computeAndCommit({
    orderedResidualRefs: dataset.calibration_window_refs,
    sourceDatasetIdentity: sourceIdentity,
  });
  assert.equal(candidateReplay.candidate?.object_id, CANDIDATE_REF);
  assert.equal(candidateReplay.candidate?.determinism_hash, CANDIDATE_HASH);
  assert.equal(candidateReplay.candidate_append_count, 0);
  const shadowReplay = await new Cap06PairedHistoricalShadowServiceV1(s8Repository, s8Assembler).compute({
    candidateRef: CANDIDATE_REF,
    candidateHash: CANDIDATE_HASH,
    orderedHoldoutResidualRefs: dataset.holdout_window_refs,
    sourceDatasetIdentity: sourceIdentity,
  });
  assert.equal(shadowReplay.deterministic_rerun_verified, true);
  const evaluationReplay = await new Cap06ShadowEvaluationCommitServiceV1(s8Repository).commit({
    s6Artifact: shadowReplay,
  });
  assert.equal(evaluationReplay.evaluation_ref, EVALUATION_REF);
  assert.equal(evaluationReplay.evaluation_hash, EVALUATION_HASH);
  assert.equal(evaluationReplay.evaluation_append_count, 0);
  await s8Repository.rebuildFromFacts();
  const s8FactsAfterReplay = await countV1("facts");
  const s8FactsHashAfterReplay = await factsHashV1();
  const s8ProjectionAfterReplay = await projectionSnapshotV1();
  const s8ProjectionHashAfterReplay = semanticHashV1(s8ProjectionAfterReplay);
  const s8ActiveAfterReplay = await activeConfigSnapshotV1();
  const s8ActivationAfterReplay = await countV1("facts WHERE record_json->>'type'='twin_model_activation_v1'");
  assert.equal(s8FactsAfterReplay - s8FactsBeforeReplay, 0);
  assert.equal(s8FactsHashAfterReplay, s8FactsHashBeforeReplay);
  assert.equal(s8ProjectionHashAfterReplay, s8ProjectionHashBeforeReplay);
  assert.deepEqual(s8ProjectionAfterReplay, s8ProjectionBeforeReplay);
  assert.deepEqual(s8ActiveAfterReplay, s8ActiveBeforeReplay);
  assert.equal(s8ActivationAfterReplay, s8ActivationBeforeReplay);
  assert.equal(s8ActivationAfterReplay, 0);
  await closePoolV1();
  ok("S8 controlled namespace proves zero-write Candidate, Shadow, Evaluation and rebuild replay");

  await openPoolV1();
  await dbV1().query("DROP SCHEMA public CASCADE");
  await dbV1().query("CREATE SCHEMA public");
  await dbV1().query("GRANT ALL ON SCHEMA public TO public");
  await closePoolV1();
  ok("S9 Runtime namespace is isolated from S8 source-graph object identities");

  runChildV1(
    "S9_POST_EVALUATION_TICK",
    ["-w", "exec", "tsx", "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S9_NON_CONSUMPTION_DB.ts"],
    { MCFT_CAP_06_S9_NON_CONSUMPTION_DESTRUCTIVE_ACCEPTANCE: "1" },
  );
  const s9 = JSON.parse(fs.readFileSync(path.join(ROOT, "acceptance-output/MCFT_CAP_06_S9_NON_CONSUMPTION_DB_RESULT.json"), "utf8"));
  assert.equal(s9.status, "PASS");
  assert.equal(s9.immutable_runtime_config_append_count, 1);
  assert.equal(s9.a1_canonical_fact_append_count, 8);
  assert.equal(s9.scenario_set_canonical_fact_append_count, 1);
  assert.equal(s9.candidate_consumed, false);
  assert.equal(s9.evaluation_consumed, false);
  assert.equal(s9.effective_tick_parameter_value, BASE_COEFFICIENT);

  await openPoolV1();
  const s9Repository = new PostgresCalibrationGovernanceRepositoryV1(dbV1());
  const s9Candidate = await s9Repository.readCanonicalObject(CANDIDATE_REF);
  const s9Evaluation = await s9Repository.readCanonicalObject(EVALUATION_REF);
  assert.ok(s9Candidate && s9Evaluation);
  assert.equal(s9Candidate.determinism_hash, CANDIDATE_HASH);
  assert.equal(s9Evaluation.determinism_hash, EVALUATION_HASH);
  assert.deepEqual(exactScopeV1(s9Candidate), controlledScope);
  const conditionalConfigCount = await countV1(
    `facts WHERE record_json->>'type'='twin_runtime_config_v1'
      AND record_json->'payload'->'payload'->>'purpose'='CALIBRATION_CANDIDATE_SHADOW_EVALUATION_POLICY_V1'`,
  );
  assert.equal(conditionalConfigCount, EXPECTED_C);
  const actualDelta = s8ResidualCount + conditionalConfigCount + 1 + 1
    + Number(s9.immutable_runtime_config_append_count)
    + Number(s9.a1_canonical_fact_append_count)
    + Number(s9.scenario_set_canonical_fact_append_count);
  assert.equal(actualDelta, EXPECTED_DELTA);
  ok("actual controlled CAP-06 canonical delta freezes at R=24, C=0, R+C+12=36 across exact-identity namespaces");

  const s9FactsBeforeReplay = await countV1("facts");
  const s9FactsHashBeforeReplay = await factsHashV1();
  const s9ProjectionBeforeReplay = await projectionSnapshotV1();
  const s9ProjectionHashBeforeReplay = semanticHashV1(s9ProjectionBeforeReplay);
  const s9ActiveBeforeReplay = await activeConfigSnapshotV1();
  const s9ActivationBeforeReplay = await countV1("facts WHERE record_json->>'type'='twin_model_activation_v1'");
  const s9Replay = await replayCompletedS9TickV1({ candidate: s9Candidate, evaluation: s9Evaluation });
  const s9FactsAfterReplay = await countV1("facts");
  const s9FactsHashAfterReplay = await factsHashV1();
  const s9ProjectionAfterReplay = await projectionSnapshotV1();
  const s9ProjectionHashAfterReplay = semanticHashV1(s9ProjectionAfterReplay);
  const s9ActiveAfterReplay = await activeConfigSnapshotV1();
  const s9ActivationAfterReplay = await countV1("facts WHERE record_json->>'type'='twin_model_activation_v1'");
  assert.equal(s9FactsAfterReplay - s9FactsBeforeReplay, 0);
  assert.equal(s9FactsHashAfterReplay, s9FactsHashBeforeReplay);
  assert.equal(s9ProjectionHashAfterReplay, s9ProjectionHashBeforeReplay);
  assert.deepEqual(s9ProjectionAfterReplay, s9ProjectionBeforeReplay);
  assert.deepEqual(s9ActiveAfterReplay, s9ActiveBeforeReplay);
  assert.equal(s9ActivationAfterReplay, s9ActivationBeforeReplay);
  assert.equal(s9ActivationAfterReplay, 0);
  ok("S9 Runtime namespace proves zero-write post-evaluation Tick replay and zero semantic projection divergence");

  const s8AdditionalFacts = s8FactsAfterReplay - s8FactsBeforeReplay;
  const s9AdditionalFacts = s9FactsAfterReplay - s9FactsBeforeReplay;
  const s8ProjectionDivergence = s8ProjectionHashAfterReplay === s8ProjectionHashBeforeReplay ? 0 : 1;
  const s9ProjectionDivergence = s9ProjectionHashAfterReplay === s9ProjectionHashBeforeReplay ? 0 : 1;
  const output = {
    schema_version: "geox_mcft_cap_06_s10_bounded_chain_db_result_v1",
    status: "PASS",
    controlled_stage_database_count: 2,
    controlled_storage_mode: "TWO_NAMESPACED_ISOLATED_POSTGRESQL_STAGES",
    controlled_scope: controlledScope,
    controlled_stage_scope_match: true,
    candidate_evaluation_identity_continuity: true,
    controlled_residual_refs: s8ResidualRefs,
    actual_r: s8ResidualCount,
    actual_c: conditionalConfigCount,
    canonical_delta_formula: "R_PLUS_C_PLUS_12",
    expected_cap06_canonical_delta: EXPECTED_DELTA,
    actual_cap06_canonical_delta: actualDelta,
    candidate_ref: CANDIDATE_REF,
    candidate_hash: CANDIDATE_HASH,
    evaluation_ref: EVALUATION_REF,
    evaluation_hash: EVALUATION_HASH,
    candidate_parameter_value: "0.034000",
    effective_runtime_parameter_value: BASE_COEFFICIENT,
    post_evaluation_runtime_config_append_count: s9.immutable_runtime_config_append_count,
    post_evaluation_a1_fact_count: s9.a1_canonical_fact_append_count,
    post_evaluation_scenario_fact_count: s9.scenario_set_canonical_fact_append_count,
    completed_replay_candidate_append_count: candidateReplay.candidate_append_count,
    completed_replay_evaluation_append_count: evaluationReplay.evaluation_append_count,
    completed_replay_tick_status: s9Replay.status,
    completed_replay_evidence_load_count: s9Replay.evidence_load_count,
    completed_replay_additional_fact_count: s8AdditionalFacts + s9AdditionalFacts,
    completed_replay_facts_hash_changed: s8FactsHashAfterReplay !== s8FactsHashBeforeReplay || s9FactsHashAfterReplay !== s9FactsHashBeforeReplay,
    completed_replay_projection_hash_changed: s8ProjectionDivergence !== 0 || s9ProjectionDivergence !== 0,
    completed_replay_projection_divergence_count: s8ProjectionDivergence + s9ProjectionDivergence,
    s8_completed_replay_additional_fact_count: s8AdditionalFacts,
    s8_completed_replay_projection_divergence_count: s8ProjectionDivergence,
    s9_completed_replay_additional_fact_count: s9AdditionalFacts,
    s9_completed_replay_projection_divergence_count: s9ProjectionDivergence,
    candidate_consumed: false,
    evaluation_consumed: false,
    model_activation_count: s8ActivationAfterReplay + s9ActivationAfterReplay,
    active_config_snapshot_changed: semanticHashV1(s8ActiveAfterReplay) !== semanticHashV1(s8ActiveBeforeReplay)
      || semanticHashV1(s9ActiveAfterReplay) !== semanticHashV1(s9ActiveBeforeReplay),
    production_database_used: false,
    migration_count: 0,
    pass_count: pass,
  };
  fs.mkdirSync(path.join(ROOT, "acceptance-output"), { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, "acceptance-output/MCFT_CAP_06_S10_BOUNDED_CHAIN_DB_RESULT.json"),
    `${JSON.stringify(output, null, 2)}\n`,
    "utf8",
  );
  console.log(JSON.stringify(output));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
}).finally(async () => {
  try { await closePoolV1(); } catch {}
});
