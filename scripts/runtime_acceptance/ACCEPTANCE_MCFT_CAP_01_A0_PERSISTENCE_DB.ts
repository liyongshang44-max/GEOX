// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_01_A0_PERSISTENCE_DB.ts
// Purpose: prove S3A Runtime Config persistence, A0 atomicity, idempotency, conflict rejection, stale fencing, fault rollback, and projection rebuild against Postgres.
// Boundary: contract-valid synthetic persistence fixture only; no State mathematics, Evidence selection, A0 Runtime orchestration, or bootstrap capability claim.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { computeA0RecordSetDeterminismHashV1, computeMemberDeterminismHashV1, deriveA0IdentityV1, deriveSemanticObjectIdV1, semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { validateA0RecordSetV1, type A0RecordSetV1, type CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { PostgresProjectionRebuilderV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_projection_rebuilder_v1.js";
import { PostgresRuntimeRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import { compileRuntimeConfigFromAuthorityArtifactsV1, type Mcft00ConfigurationMatrixArtifactV1, type Mcft00RealityArtifactV1, type Mcft00SourceMatrixArtifactV1 } from "../../apps/server/src/runtime/twin_runtime/runtime_config_authority_adapter_v1.js";
import type { TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

if (process.env.MCFT_CAP_01_S3A_DESTRUCTIVE_ACCEPTANCE !== "1") throw new Error("SET_MCFT_CAP_01_S3A_DESTRUCTIVE_ACCEPTANCE_1");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
function readJson<T>(relative: string): T { return JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8")) as T; }
const reality = readJson<Mcft00RealityArtifactV1>("docs/digital_twin/mcft/GEOX-MCFT-00-REALITY-BINDING.json");
const sourceMatrix = readJson<Mcft00SourceMatrixArtifactV1>("docs/digital_twin/mcft/GEOX-MCFT-00-SOURCE-BINDING-MATRIX.json");
const configurationMatrix = readJson<Mcft00ConfigurationMatrixArtifactV1>("docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json");
const scope = reality.semantic_payload.scope as TwinScopeKeyV1;
const runtimeConfig = compileRuntimeConfigFromAuthorityArtifactsV1({ realityArtifact: reality, sourceMatrixArtifact: sourceMatrix, configurationMatrixArtifact: configurationMatrix, logical_time: "2026-06-01T00:00:00.000Z", created_at: "2026-06-01T00:00:00.000Z" });
const pool = new Pool({ connectionString: databaseUrl });
const repository = new PostgresRuntimeRepositoryV1(pool);
const rebuilder = new PostgresProjectionRebuilderV1(pool);
let pass = 0;
function ok(message: string): void { pass += 1; console.log(`PASS ${message}`); }
function common(type: CanonicalObjectEnvelopeV1["object_type"], objectId: string, idempotencyKey: string, payload: Record<string, unknown>, lineageId?: string, revisionId?: string): CanonicalObjectEnvelopeV1 {
  const object: CanonicalObjectEnvelopeV1 = {
    object_id: objectId, object_type: type, schema_version: "v1", ...scope,
    logical_time: "2026-06-01T01:00:00.000Z", as_of: "2026-06-01T01:00:00.000Z",
    source_refs: [reality.binding_id], evidence_refs: type === "twin_evidence_window_v1" ? ["mcft_src_persistence_fixture"] : [],
    runtime_config_ref: runtimeConfig.object_id, runtime_config_hash: runtimeConfig.determinism_hash,
    idempotency_key: idempotencyKey, determinism_hash: "", limitations: ["S3A_CONTRACT_VALID_PERSISTENCE_FIXTURE", "NO_STATE_MATH_CLAIM"],
    created_at: "2026-06-01T01:00:00.000Z", payload,
    ...(lineageId ? { lineage_id: lineageId } : {}), ...(revisionId ? { revision_id: revisionId } : {}),
  };
  object.determinism_hash = computeMemberDeterminismHashV1(object as unknown as Record<string, unknown>);
  return object;
}

function buildRecordSet(): A0RecordSetV1 {
  const a0IdentityInput = {
    scope,
    bootstrap_logical_time: "2026-06-01T01:00:00.000Z",
    reality_binding_hash: reality.determinism_hash,
    runtime_config_hash: runtimeConfig.determinism_hash,
    evidence_window_semantic_digest: semanticHashV1({ fixture: "S3A_CONTRACT_VALID_PERSISTENCE_FIXTURE", observation: 0.184 }),
    model_component_versions: { contracts: "v1", persistence: "v1", fixture: "v1" },
    operation_variant: "A0_BOOTSTRAP_STATE_COMMIT" as const,
  };
  const identity = deriveA0IdentityV1(a0IdentityInput);
  const ids = identity.member_object_ids;
  const lineageId = deriveSemanticObjectIdV1("lineage", { scope, logical_time: a0IdentityInput.bootstrap_logical_time, runtime_config_hash: runtimeConfig.determinism_hash, reality_binding_hash: reality.determinism_hash });
  const revisionId = deriveSemanticObjectIdV1("revision", { revision_kind: "INITIAL", lineage_id: lineageId, logical_time: a0IdentityInput.bootstrap_logical_time });
  const key = (type: string) => deriveSemanticObjectIdV1("a0_member_key", { a0_idempotency_key: identity.a0_idempotency_key, object_type: type });
  const members: CanonicalObjectEnvelopeV1[] = [
    common("twin_runtime_lineage_v1", ids.twin_runtime_lineage_v1, key("twin_runtime_lineage_v1"), { lineage_kind: "INITIAL", parent_lineage_ref: null, revision_run_ref: null, bootstrap_runtime_config_ref: runtimeConfig.object_id, bootstrap_reality_binding_ref: reality.binding_id, initial_revision_id: revisionId }),
    common("twin_evidence_window_v1", ids.twin_evidence_window_v1, key("twin_evidence_window_v1"), { window_start_exclusive: "2026-06-01T00:00:00.000Z", window_end_inclusive: "2026-06-01T01:00:00.000Z", included_refs: ["mcft_src_persistence_fixture"], excluded_refs: [], frozen: true }, lineageId, revisionId),
    common("twin_state_transition_v1", ids.twin_state_transition_v1, key("twin_state_transition_v1"), { transition_kind: "BOOTSTRAP", previous_posterior_ref: null, bootstrap_prior: { prior_kind: "CONFIGURED_WEAK_BOOTSTRAP_PRIOR", mean: 0.21, variance: 0.0081, stddev: 0.09, derivation_rule_id: "MIDPOINT_WILTING_FIELD_CAPACITY_WEAK_PRIOR_V1", source_runtime_config_ref: runtimeConfig.object_id, source_soil_hydraulic_config_ref: "soil_hydraulic_config_c8_v1" }, process_model_status: "NOT_APPLIED_BOOTSTRAP", assimilation_update_ref: ids.twin_assimilation_update_v1, posterior_state_ref: ids.twin_state_estimate_v1 }, lineageId, revisionId),
    common("twin_assimilation_update_v1", ids.twin_assimilation_update_v1, key("twin_assimilation_update_v1"), { state_transition_ref: ids.twin_state_transition_v1, posterior_state_ref: ids.twin_state_estimate_v1, observation_ref: "mcft_src_persistence_fixture", disposition: "S3A_PERSISTENCE_FIXTURE_ONLY" }, lineageId, revisionId),
    common("twin_state_estimate_v1", ids.twin_state_estimate_v1, key("twin_state_estimate_v1"), { prior_transition_ref: ids.twin_state_transition_v1, assimilation_update_ref: ids.twin_assimilation_update_v1, confidence: { status: "NOT_ESTABLISHED", reason_code: "NO_CALIBRATED_CONFIDENCE_MODEL" }, use_eligibility: { state_valid: true, posterior_chain_eligible: true, forecast_source_eligible: true, recommendation_input_eligible: false, action_input_eligible: false }, fixture_state: { mean: 0.192595, variance: 0.002678 } }, lineageId, revisionId),
    common("twin_forecast_run_v1", ids.twin_forecast_run_v1, key("twin_forecast_run_v1"), { status: "BLOCKED", points: [], reason_codes: ["FUTURE_WEATHER_ASSUMPTION_NOT_AVAILABLE", "FUTURE_ET0_ASSUMPTION_NOT_AVAILABLE"], source_posterior_ref: ids.twin_state_estimate_v1, scenario_eligible: false }, lineageId, revisionId),
    common("twin_runtime_tick_v1", ids.twin_runtime_tick_v1, key("twin_runtime_tick_v1"), { status: "COMPLETED_WITH_LIMITATIONS", evidence_window_ref: ids.twin_evidence_window_v1, state_transition_ref: ids.twin_state_transition_v1, assimilation_update_ref: ids.twin_assimilation_update_v1, posterior_state_ref: ids.twin_state_estimate_v1, forecast_result_ref: ids.twin_forecast_run_v1, checkpoint_ref: ids.twin_runtime_checkpoint_v1 }, lineageId, revisionId),
    common("twin_runtime_checkpoint_v1", ids.twin_runtime_checkpoint_v1, key("twin_runtime_checkpoint_v1"), { checkpoint_kind: "INITIAL", previous_checkpoint_ref: null, last_completed_tick_ref: ids.twin_runtime_tick_v1, last_posterior_state_ref: ids.twin_state_estimate_v1, forecast_result_ref: ids.twin_forecast_run_v1 }, lineageId, revisionId),
    common("twin_runtime_health_v1", ids.twin_runtime_health_v1, key("twin_runtime_health_v1"), { operation_status: "A0_COMMITTED_WITH_BLOCKED_FORECAST", checkpoint_ref: ids.twin_runtime_checkpoint_v1 }),
  ];
  const recordSet: A0RecordSetV1 = { a0_identity_input: a0IdentityInput, a0_semantic_seed: identity.a0_semantic_seed, a0_record_set_id: identity.a0_record_set_id, a0_idempotency_key: identity.a0_idempotency_key, a0_record_set_determinism_hash: "", members };
  recordSet.a0_record_set_determinism_hash = computeA0RecordSetDeterminismHashV1({ a0_record_set_id: recordSet.a0_record_set_id, members: members as unknown as Record<string, unknown>[] });
  validateA0RecordSetV1(recordSet);
  return recordSet;
}

const recordSet = buildRecordSet();
const scopeParams = [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
const projectionTables = ["twin_active_lineage_index_v1","twin_state_history_projection_v1","twin_state_latest_index_v1","twin_forecast_result_latest_index_v1","twin_runtime_checkpoint_latest_index_v1","twin_runtime_health_latest_index_v1"];
async function cleanupA0(): Promise<void> {
  for (const table of projectionTables) await pool.query(`DELETE FROM ${table} WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`, scopeParams);
  await pool.query("DELETE FROM twin_forecast_success_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", scopeParams);
  await pool.query("DELETE FROM twin_object_idempotency_index_v1 WHERE identity_kind='A0_RECORD_SET' AND record_set_id=$1", [recordSet.a0_record_set_id]);
  await pool.query("DELETE FROM facts WHERE record_json->'payload'->>'object_id'=ANY($1::text[])", [recordSet.members.map((member) => member.object_id)]);
  await pool.query("DELETE FROM twin_runtime_lease_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", scopeParams);
}
async function a0FactCount(): Promise<number> {
  const result = await pool.query("SELECT count(*)::int AS count FROM facts WHERE record_json->'payload'->>'object_id'=ANY($1::text[])", [recordSet.members.map((member) => member.object_id)]);
  return result.rows[0].count;
}
async function projectionCount(): Promise<number> {
  let count = 0;
  for (const table of projectionTables) {
    const result = await pool.query(`SELECT count(*)::int AS count FROM ${table} WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`, scopeParams);
    count += result.rows[0].count;
  }
  return count;
}

async function main(): Promise<void> {
  try {
    await pool.query(fs.readFileSync(path.join(ROOT, "apps/server/db/migrations/2026_07_09_mcft_cap_01_a0_persistence.sql"), "utf8"));
    await cleanupA0();
    await pool.query("DELETE FROM twin_object_idempotency_index_v1 WHERE identity_kind='RUNTIME_CONFIG' AND idempotency_key=$1", [runtimeConfig.idempotency_key]);
    await pool.query("DELETE FROM facts WHERE record_json->'payload'->>'object_id'=$1", [runtimeConfig.object_id]);
    const configFirst = await repository.commitRuntimeConfig(runtimeConfig);
    assert.equal(configFirst.status, "INSERTED"); ok("Runtime Config inserted");
    const configSecond = await repository.commitRuntimeConfig(runtimeConfig);
    assert.equal(configSecond.status, "EXISTING_IDEMPOTENT_SUCCESS"); ok("Runtime Config idempotent readback");

    const faultStages = recordSet.members.map((member, index) => `before_fact_${index + 1}_${member.object_type}`).concat(["before_active_lineage_projection","before_state_history_projection","before_state_latest_projection","before_forecast_result_projection","before_checkpoint_projection","before_health_projection","before_idempotency_index","before_commit"]);
    for (const stage of faultStages) {
      await cleanupA0();
      const lease = await repository.acquireLease({ ...scope, lease_owner: "mcft-cap-01-s3a-acceptance", lease_duration_seconds: 300 });
      await assert.rejects(repository.commitBootstrapState({ scope, lease, expected: { active_lineage_ref: null, checkpoint_ref: null, state_ref: null, forecast_result_ref: null, successful_forecast_ref: null }, record_set: recordSet, fault_injection: (current) => { if (current === stage) throw new Error(`FAULT:${stage}`); } }), new RegExp(`FAULT:${stage}`));
      assert.equal(await a0FactCount(), 0); assert.equal(await projectionCount(), 0);
    }
    ok(`${faultStages.length} fault stages rolled back fully`);

    await cleanupA0();
    const staleLease = await repository.acquireLease({ ...scope, lease_owner: "mcft-cap-01-s3a-acceptance", lease_duration_seconds: 300 });
    await repository.acquireLease({ ...scope, lease_owner: "mcft-cap-01-s3a-acceptance", lease_duration_seconds: 300 });
    await assert.rejects(repository.commitBootstrapState({ scope, lease: staleLease, expected: { active_lineage_ref: null, checkpoint_ref: null, state_ref: null, forecast_result_ref: null, successful_forecast_ref: null }, record_set: recordSet }), /STALE_FENCING_TOKEN/);
    assert.equal(await a0FactCount(), 0); ok("stale fencing token produces zero A0 writes");

    await cleanupA0();
    const lease = await repository.acquireLease({ ...scope, lease_owner: "mcft-cap-01-s3a-acceptance", lease_duration_seconds: 300 });
    const first = await repository.commitBootstrapState({ scope, lease, expected: { active_lineage_ref: null, checkpoint_ref: null, state_ref: null, forecast_result_ref: null, successful_forecast_ref: null }, record_set: recordSet });
    assert.equal(first.status, "INSERTED"); assert.equal(await a0FactCount(), 9); assert.equal(await projectionCount(), 6); ok("nine facts and six projections committed atomically");
    const second = await repository.commitBootstrapState({ scope, lease, expected: { active_lineage_ref: null, checkpoint_ref: null, state_ref: null, forecast_result_ref: null, successful_forecast_ref: null }, record_set: recordSet });
    assert.equal(second.status, "EXISTING_IDEMPOTENT_SUCCESS"); assert.equal(await a0FactCount(), 9); ok("same-input replay adds no facts after pointers exist");

    const conflict = structuredClone(recordSet);
    const health = conflict.members.find((member) => member.object_type === "twin_runtime_health_v1")!;
    health.payload.operation_status = "CONFLICTING_PERSISTENCE_FIXTURE";
    health.determinism_hash = computeMemberDeterminismHashV1(health as unknown as Record<string, unknown>);
    conflict.a0_record_set_determinism_hash = computeA0RecordSetDeterminismHashV1({ a0_record_set_id: conflict.a0_record_set_id, members: conflict.members as unknown as Record<string, unknown>[] });
    validateA0RecordSetV1(conflict);
    await assert.rejects(repository.commitBootstrapState({ scope, lease, expected: { active_lineage_ref: null, checkpoint_ref: null, state_ref: null, forecast_result_ref: null, successful_forecast_ref: null }, record_set: conflict }), /IDEMPOTENCY_CONFLICT/);
    assert.equal(await a0FactCount(), 9); ok("same key with different aggregate hash rejected");

    const beforeState = await pool.query("SELECT state_object_id,determinism_hash FROM twin_state_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", scopeParams);
    const rebuild = await rebuilder.rebuildA0Projections(recordSet.a0_record_set_id);
    assert.equal(rebuild.rebuilt_projection_count, 6);
    const afterState = await pool.query("SELECT state_object_id,determinism_hash FROM twin_state_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", scopeParams);
    assert.deepEqual(afterState.rows, beforeState.rows);
    const successful = await pool.query("SELECT count(*)::int AS count FROM twin_forecast_success_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6", scopeParams);
    assert.equal(successful.rows[0].count, 0); ok("projection rebuild equivalent and successful Forecast latest remains empty");

    console.log(`MCFT-CAP-01 S3A DB: ${pass} PASS, 0 FAIL`);
  } finally {
    await cleanupA0().catch(() => undefined);
    await pool.query("DELETE FROM twin_object_idempotency_index_v1 WHERE identity_kind='RUNTIME_CONFIG' AND idempotency_key=$1", [runtimeConfig.idempotency_key]).catch(() => undefined);
    await pool.query("DELETE FROM facts WHERE record_json->'payload'->>'object_id'=$1", [runtimeConfig.object_id]).catch(() => undefined);
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
