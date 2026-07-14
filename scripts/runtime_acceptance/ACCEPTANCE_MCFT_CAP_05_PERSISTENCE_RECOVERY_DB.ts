// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_PERSISTENCE_RECOVERY_DB.ts
// Purpose: prove MCFT-CAP-05 G/H/C canonical append, idempotent retry, conflict rollback, projection mutation and facts-based recovery in an isolated PostgreSQL database.
// Boundary: destructive isolated-database acceptance only; no production database, business service, State Tick, Forecast execution, route, scheduler, Recommendation, AO-ACT, calibration or model activation.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { computeMemberDeterminismHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import {
  buildCap05ActionFeedbackV1,
  buildCap05DecisionV1,
  type Cap05DecisionEnvelopeV1,
} from "../../apps/server/src/domain/twin_runtime/feedback_canonical_contracts_v1.js";
import {
  buildCap05ForecastResidualV1,
} from "../../apps/server/src/domain/twin_runtime/forecast_observation_residual_v1.js";
import { buildCap05FeedbackCycleProjectionV1 } from "../../apps/server/src/domain/twin_runtime/feedback_cycle_projection_v1.js";
import type {
  Cap04ForecastPointV1,
  Cap04ScenarioOptionIdV1,
  Cap04ScenarioSetEnvelopeV1,
} from "../../apps/server/src/domain/twin_runtime/forecast_scenario_contracts_v1.js";
import { PostgresFeedbackPersistenceRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_feedback_persistence_repository_v1.js";

if (process.env.MCFT_CAP_05_S3_DESTRUCTIVE_ACCEPTANCE !== "1") throw new Error("SET_MCFT_CAP_05_S3_DESTRUCTIVE_ACCEPTANCE_1");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
if (!/(mcft|cap05|s3|acceptance|test)/.test(databaseName)) throw new Error("ISOLATED_ACCEPTANCE_DATABASE_REQUIRED");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const LOCK = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-PREDECESSOR-LOCK.json"), "utf8"));
const FIXTURE_ROOT = path.join(ROOT, "fixtures/mcft/water_state/feedback_v1");
const pool = new Pool({ connectionString: databaseUrl });
const repository = new PostgresFeedbackPersistenceRepositoryV1(pool);
let pass = 0;

function ok(label: string): void {
  pass += 1;
  console.log(`PASS ${label}`);
}

function readSql(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function readOne(file: string): any {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_ROOT, file), "utf8").trim());
}

function scenarioOptionStub(optionId: Cap04ScenarioOptionIdV1, requestedIrrigation: string): Record<string, unknown> {
  return {
    option_id: optionId,
    option_kind: optionId === "NO_ACTION" ? "NO_ACTION" : "IMMEDIATE_IRRIGATION",
    source_forecast_ref: LOCK.canonical_identity.latest_successful_forecast_ref,
    source_forecast_hash: LOCK.canonical_identity.latest_successful_forecast_hash,
    source_posterior_ref: LOCK.canonical_identity.latest_posterior_state_ref,
    source_posterior_hash: LOCK.canonical_identity.latest_posterior_state_hash,
    runtime_config_ref: LOCK.canonical_identity.predecessor_state_runtime_config_ref,
    runtime_config_hash: LOCK.canonical_identity.predecessor_state_runtime_config_hash,
    requested_irrigation_mm: requestedIrrigation,
    application_efficiency_fraction: "1.000000",
    effective_irrigation_mm: requestedIrrigation,
    application_horizon: optionId === "NO_ACTION" ? null : 1,
    application_interval: optionId === "NO_ACTION" ? null : { interval_start: "2026-06-04T01:00:00.000Z", interval_end: "2026-06-04T02:00:00.000Z" },
    epistemic_status: "ASSUMED",
    execution_status: "NOT_EXECUTED",
    trajectory_points: [],
    minimum_available_water_fraction: "0.500000",
    first_stress_target_time: null,
    stress_hour_count: 0,
    final_storage_mm: "66.000000",
    total_precipitation_mm: "0.000000",
    total_crop_et_mm: "0.000000",
    total_irrigation_mm: requestedIrrigation,
    total_runoff_mm: "0.000000",
    total_drainage_mm: "0.000000",
    total_overflow_mm: "0.000000",
    difference_from_no_action: {
      final_storage_delta_mm: requestedIrrigation,
      minimum_awf_delta: "0.000000",
      stress_hour_count_delta: 0,
      total_irrigation_delta_mm: requestedIrrigation,
      total_drainage_delta_mm: "0.000000",
      total_overflow_delta_mm: "0.000000",
    },
    uncertainty_basis: {},
    assumption_basis: {
      source_forecast_ref: LOCK.canonical_identity.latest_successful_forecast_ref,
      source_forecast_hash: LOCK.canonical_identity.latest_successful_forecast_hash,
      runtime_config_ref: LOCK.canonical_identity.predecessor_state_runtime_config_ref,
      runtime_config_hash: LOCK.canonical_identity.predecessor_state_runtime_config_hash,
      scenario_policy_id: "THREE_OPTION_IRRIGATION_SCENARIO_POLICY_V1",
      option_id: optionId,
    },
    limitations: ["CONTROLLED_REPLAY_ONLY"],
  };
}

function scenarioSetFixture(): Cap04ScenarioSetEnvelopeV1 {
  const scope = LOCK.expected_scope;
  return {
    object_id: LOCK.canonical_identity.latest_scenario_set_ref,
    object_type: "twin_scenario_set_v1",
    schema_version: "v1",
    ...scope,
    logical_time: "2026-06-04T01:00:00.000Z",
    as_of: "2026-06-04T01:00:00.000Z",
    source_refs: [LOCK.canonical_identity.latest_successful_forecast_ref],
    evidence_refs: [],
    runtime_config_ref: LOCK.canonical_identity.predecessor_state_runtime_config_ref,
    runtime_config_hash: LOCK.canonical_identity.predecessor_state_runtime_config_hash,
    idempotency_key: "cap05_s3_scenario_fixture_key",
    determinism_hash: LOCK.canonical_identity.latest_scenario_set_hash,
    limitations: ["CONTROLLED_REPLAY_ONLY"],
    created_at: "2026-06-04T01:00:00.000Z",
    lineage_id: LOCK.canonical_identity.lineage_id,
    revision_id: LOCK.canonical_identity.revision_id,
    payload: {
      record_set_contract_id: "MCFT_CAP_04_THREE_SCENARIO_SET_V1",
      transaction_variant: "B_SCENARIO_COMMIT",
      source_forecast_ref: LOCK.canonical_identity.latest_successful_forecast_ref,
      source_forecast_hash: LOCK.canonical_identity.latest_successful_forecast_hash,
      source_posterior_ref: LOCK.canonical_identity.latest_posterior_state_ref,
      source_posterior_hash: LOCK.canonical_identity.latest_posterior_state_hash,
      scenario_policy_id: "THREE_OPTION_IRRIGATION_SCENARIO_POLICY_V1",
      runtime_config_ref: LOCK.canonical_identity.predecessor_state_runtime_config_ref,
      runtime_config_hash: LOCK.canonical_identity.predecessor_state_runtime_config_hash,
      options: [
        scenarioOptionStub("NO_ACTION", "0.000000"),
        scenarioOptionStub("IRRIGATE_NOW_15MM", "15.000000"),
        scenarioOptionStub("IRRIGATE_NOW_25MM", "25.000000"),
      ] as any,
      limitations: ["CONTROLLED_REPLAY_ONLY"],
    },
  } as unknown as Cap04ScenarioSetEnvelopeV1;
}

function forecastPointFixture(): Cap04ForecastPointV1 {
  return {
    horizon_hour: 1,
    interval_start: "2026-06-04T02:00:00.000Z",
    interval_end: "2026-06-04T03:00:00.000Z",
    target_time: "2026-06-04T03:00:00.000Z",
    previous_storage_mm: "66.000000",
    gross_precipitation_assumption_mm: "0.000000",
    surface_runoff_mm: "0.000000",
    effective_precipitation_mm: "0.000000",
    assumed_irrigation_mm: "0.000000",
    reference_et0_mm: "0.110000",
    crop_stage_code: "CONTROLLED_STAGE",
    kc: "1.000000",
    requested_crop_et_mm: "0.110000",
    actual_crop_et_mm: "0.000000",
    unmet_crop_et_mm: "0.110000",
    drainage_mm: "0.000000",
    saturation_overflow_mm: "0.000000",
    storage_mean_mm: "66.000000",
    storage_variance_mm2: "0.090000",
    storage_interval_unclipped_lower_mm: "65.412000",
    storage_interval_unclipped_upper_mm: "66.588000",
    storage_interval_emitted_lower_mm: "65.412000",
    storage_interval_emitted_upper_mm: "66.588000",
    available_water_fraction: "0.500000",
    depletion_from_field_capacity_mm: "0.000000",
    mass_balance_error_mm: "0.000000",
    determinism_hash: "sha256:cap05-s3-forecast-point-h1",
  };
}

function factRecord(object: Record<string, unknown>, type: string): string {
  return JSON.stringify({ type, payload: object });
}

async function seedSupportingFact(object: Record<string, any>, type: string): Promise<void> {
  await pool.query(
    `INSERT INTO facts (fact_id,occurred_at,source,record_json)
     VALUES ($1,$2::timestamptz,'system',$3::jsonb) ON CONFLICT (fact_id) DO NOTHING`,
    [`fact_${object.object_id}`, object.logical_time, factRecord(object, type)],
  );
}

async function initializeSchema(): Promise<void> {
  await pool.query(readSql("docker/postgres/init/001_schema.sql"));
  await pool.query(readSql("apps/server/db/migrations/2026_07_09_mcft_cap_01_a0_persistence.sql"));
  await pool.query(readSql("apps/server/db/migrations/2026_07_10_mcft_cap_02_continuation_persistence.sql"));
  await pool.query(readSql("apps/server/db/migrations/2026_07_13_mcft_cap_04_forecast_scenario_persistence.sql"));
  await pool.query(readSql("apps/server/db/migrations/2026_07_14_mcft_cap_05_feedback_persistence.sql"));
  ok("one additive CAP-05 migration applies over inherited Runtime persistence");
}

async function count(table: string): Promise<number> {
  const result = await pool.query(`SELECT count(*)::int AS count FROM ${table}`);
  return result.rows[0].count;
}

async function main(): Promise<void> {
  await initializeSchema();
  const scope = LOCK.expected_scope;
  const decisionRequest = readOne("decision_requests.jsonl");
  const approval = readOne("approval_assertions.jsonl");
  const plan = readOne("approved_plans.jsonl");
  const receipt = readOne("execution_receipts.jsonl");
  const observation = readOne("soil_observations.jsonl");

  await pool.query(
    `INSERT INTO facts (fact_id,occurred_at,source,record_json)
     VALUES ($1,$2::timestamptz,'mcft_cap05_replay_evidence_v1',$3::jsonb)`,
    [`fact_${plan.source_record_id}`, plan.available_to_runtime_at, JSON.stringify({ type: plan.record_type, payload: plan })],
  );

  const scenarioSet = scenarioSetFixture();
  const decision = buildCap05DecisionV1({
    scope,
    scenario_set: scenarioSet,
    selected_option_id: "IRRIGATE_NOW_15MM",
    decision_request_evidence_ref: decisionRequest.source_record_id,
    decision_request_evidence_hash: decisionRequest.source_record_hash,
    actor_ref: decisionRequest.canonical_payload.actor_ref,
    decided_at: "2026-06-04T01:10:00.000Z",
    context_lineage_ref: LOCK.canonical_identity.active_lineage_ref,
    context_revision_ref: LOCK.canonical_identity.revision_id,
    created_at: "2026-06-04T01:10:00.000Z",
  });
  const decisionFirst = await repository.commitCanonicalObject({ object: decision });
  assert.equal(decisionFirst.status, "INSERTED");
  assert.equal((await repository.commitCanonicalObject({ object: decision })).status, "EXISTING_IDEMPOTENT_SUCCESS");
  assert.equal((await repository.readCanonicalObject(decision.object_id))?.determinism_hash, decision.determinism_hash);
  ok("G Decision first write, idempotent retry and canonical readback succeed");

  const conflictingDecision = structuredClone(decision) as Cap05DecisionEnvelopeV1;
  conflictingDecision.payload.actor_ref = "human:conflicting-actor";
  conflictingDecision.determinism_hash = computeMemberDeterminismHashV1(conflictingDecision as unknown as Record<string, unknown>);
  await assert.rejects(repository.commitCanonicalObject({ object: conflictingDecision }), /CAP05_IDEMPOTENCY_CONFLICT/);
  assert.equal(await count("twin_decision_record_projection_v1"), 1);
  ok("same Decision idempotency key with different semantic hash is rejected atomically");

  const feedback = buildCap05ActionFeedbackV1({
    scope,
    decision_ref: decision.object_id,
    decision_hash: decision.determinism_hash,
    approved_plan_evidence_ref: plan.source_record_id,
    approved_plan_evidence_hash: plan.source_record_hash,
    origin_kind: "EXTERNAL_EVIDENCE",
    receipt_ref: receipt.source_record_id,
    dispatch_disposition: "NOT_OBSERVED",
    event_id: receipt.canonical_payload.event_id,
    source_record_id: receipt.source_record_id,
    binding_id: receipt.binding_id,
    origin_source_id: receipt.origin_source_id,
    execution_status: receipt.canonical_payload.execution_status,
    validation_status: "VALIDATED_WITH_LIMITATIONS",
    source_quality: receipt.canonical_payload.source_quality,
    eligible_for_state_input: receipt.canonical_payload.eligible_for_state_input,
    actual_amount_mm: "13.600000",
    spatial_coverage_fraction: "0.910000",
    execution_start: receipt.role_time.execution_start,
    execution_end: receipt.role_time.execution_end,
    ingested_at: receipt.role_time.ingested_at,
    available_to_runtime_at: receipt.available_to_runtime_at,
    runtime_config_ref: LOCK.canonical_identity.predecessor_state_runtime_config_ref,
    runtime_config_hash: LOCK.canonical_identity.predecessor_state_runtime_config_hash,
    context_lineage_ref: LOCK.canonical_identity.active_lineage_ref,
    context_revision_ref: LOCK.canonical_identity.revision_id,
    created_at: receipt.available_to_runtime_at,
  });
  assert.equal((await repository.commitCanonicalObject({ object: feedback })).status, "INSERTED");
  assert.equal((await repository.commitCanonicalObject({ object: feedback })).status, "EXISTING_IDEMPOTENT_SUCCESS");
  assert.equal(await count("twin_action_feedback_projection_v1"), 1);
  assert.ok((await count("twin_action_feedback_evidence_index_v1")) >= 3);
  ok("H Action Feedback and Evidence-link projections commit idempotently");

  const forecastRunRef = "twin_forecast_run_cap05_s3_source";
  const forecastRunHash = "sha256:cap05-s3-source-forecast";
  const residual = buildCap05ForecastResidualV1({
    scope,
    forecast_run_ref: forecastRunRef,
    forecast_run_hash: forecastRunHash,
    forecast_point_ref: `${forecastRunRef}#/points/by-horizon/1`,
    forecast_point: forecastPointFixture(),
    root_zone_depth_mm: "300.000000",
    actual_observation_ref: observation.source_record_id,
    actual_observation_hash: observation.source_record_hash,
    actual_observation_value: "0.224000",
    actual_observation_variance: "0.000004000000",
    representativeness_variance: "0.000004000000",
    runtime_config_ref: LOCK.canonical_identity.predecessor_state_runtime_config_ref,
    runtime_config_hash: LOCK.canonical_identity.predecessor_state_runtime_config_hash,
    context_lineage_ref: LOCK.canonical_identity.active_lineage_ref,
    context_revision_ref: LOCK.canonical_identity.revision_id,
    observation_available_to_runtime_at: observation.available_to_runtime_at,
    assimilation_update_ref: "twin_assimilation_update_cap05_s3",
    assimilation_update_hash: "sha256:cap05-s3-assimilation",
    created_at: observation.available_to_runtime_at,
  });
  assert.equal((await repository.commitCanonicalObject({ object: residual })).status, "INSERTED");
  assert.equal((await repository.commitCanonicalObject({ object: residual })).status, "EXISTING_IDEMPOTENT_SUCCESS");
  assert.equal(await count("twin_forecast_residual_projection_v1"), 1);
  ok("C Forecast Residual commits independently from Assimilation authority");

  const faultFeedback = structuredClone(feedback);
  faultFeedback.object_id = `${feedback.object_id}_fault`;
  faultFeedback.idempotency_key = `${feedback.idempotency_key}_fault`;
  faultFeedback.payload.source_record_id = `${feedback.payload.source_record_id}_fault`;
  faultFeedback.payload.event_id = `${feedback.payload.event_id}_fault`;
  faultFeedback.determinism_hash = computeMemberDeterminismHashV1(faultFeedback as unknown as Record<string, unknown>);
  await assert.rejects(
    repository.commitCanonicalObject({
      object: faultFeedback,
      fault_injection: (stage) => { if (stage === "before_idempotency_guard") throw new Error("INJECTED_S3_FAILURE"); },
    }),
    /INJECTED_S3_FAILURE/,
  );
  assert.equal(await repository.readCanonicalObject(faultFeedback.object_id), null);
  ok("fault between projection and guard rolls back fact and projection atomically");

  const evidenceWindowRef = "twin_evidence_window_cap05_s3";
  const sourceStateRef = "twin_state_estimate_cap05_s3_source";
  const updatedStateRef = "twin_state_estimate_cap05_s3_updated";
  await seedSupportingFact({
    object_id: evidenceWindowRef,
    object_type: "twin_evidence_window_v1",
    logical_time: "2026-06-04T02:00:00.000Z",
    determinism_hash: "sha256:cap05-s3-evidence-window",
    payload: { action_feedback_refs: [feedback.object_id] },
  }, "twin_evidence_window_v1");
  await seedSupportingFact({
    object_id: sourceStateRef,
    object_type: "twin_state_estimate_v1",
    logical_time: "2026-06-04T02:00:00.000Z",
    determinism_hash: "sha256:cap05-s3-source-state",
    payload: { evidence_window_ref: evidenceWindowRef },
  }, "twin_state_estimate_v1");
  await seedSupportingFact({
    object_id: forecastRunRef,
    object_type: "twin_forecast_run_v1",
    logical_time: "2026-06-04T02:00:00.000Z",
    determinism_hash: forecastRunHash,
    payload: { source_posterior_ref: sourceStateRef },
  }, "twin_forecast_run_v1");
  await seedSupportingFact({
    object_id: residual.payload.assimilation_update_ref,
    object_type: "twin_assimilation_update_v1",
    logical_time: "2026-06-04T03:00:00.000Z",
    determinism_hash: residual.payload.assimilation_update_hash,
    payload: { posterior_state_ref: updatedStateRef },
  }, "twin_assimilation_update_v1");
  await seedSupportingFact({
    object_id: updatedStateRef,
    object_type: "twin_state_estimate_v1",
    logical_time: "2026-06-04T03:00:00.000Z",
    determinism_hash: "sha256:cap05-s3-updated-state",
    payload: {},
  }, "twin_state_estimate_v1");

  const explicitCycle = buildCap05FeedbackCycleProjectionV1({
    decision,
    approval_assertion_ref: approval.source_record_id,
    approval_assertion_hash: approval.source_record_hash,
    approved_plan_ref: plan.source_record_id,
    approved_plan_hash: plan.source_record_hash,
    dispatch_disposition: "NOT_OBSERVED",
    dispatch_evidence_ref: null,
    dispatch_evidence_hash: null,
    action_feedback: feedback,
    outcome_observation_ref: observation.source_record_id,
    outcome_observation_hash: observation.source_record_hash,
    forecast_residual: residual,
    assimilation_update_ref: residual.payload.assimilation_update_ref!,
    assimilation_update_hash: residual.payload.assimilation_update_hash!,
    updated_state_ref: updatedStateRef,
    updated_state_hash: "sha256:cap05-s3-updated-state",
  });
  await repository.persistFeedbackCycleProjection(explicitCycle, { decision: decisionFirst.fact_id });
  assert.equal(await count("twin_action_feedback_cycle_projection_v1"), 1);
  ok("complete feedback-cycle projection persists without becoming canonical history");

  await pool.query("DELETE FROM twin_action_feedback_cycle_projection_v1");
  await pool.query("DELETE FROM twin_action_feedback_evidence_index_v1");
  await pool.query("DELETE FROM twin_action_feedback_projection_v1");
  await pool.query("DELETE FROM twin_decision_record_projection_v1");
  await pool.query("DELETE FROM twin_forecast_residual_projection_v1");
  await pool.query("DELETE FROM twin_approved_plan_binding_projection_v1");
  await pool.query("DELETE FROM twin_object_idempotency_index_v1 WHERE identity_kind IN ('G_DECISION_RECORD','H_ACTION_FEEDBACK','C_FORECAST_RESIDUAL')");
  const recovery = await repository.rebuildAllSupportState();
  assert.deepEqual(
    {
      canonical: recovery.canonical_objects_scanned,
      guards: recovery.idempotency_guards_rebuilt,
      decisions: recovery.decision_projections_rebuilt,
      feedback: recovery.action_feedback_projections_rebuilt,
      residuals: recovery.forecast_residual_projections_rebuilt,
      plans: recovery.approved_plan_bindings_rebuilt,
      cycles: recovery.feedback_cycles_rebuilt,
    },
    { canonical: 3, guards: 3, decisions: 1, feedback: 1, residuals: 1, plans: 1, cycles: 1 },
  );
  assert.equal(await count("twin_action_feedback_cycle_projection_v1"), 1);
  assert.equal((await repository.lookupByIdempotencyKey(decision.idempotency_key))?.object_id, decision.object_id);
  ok("all CAP-05 guards and projections rebuild from append-only facts and canonical graph refs");

  const canonicalFacts = await pool.query(
    `SELECT count(*)::int AS count FROM facts
     WHERE record_json->>'type' IN ('twin_decision_record_v1','twin_action_feedback_v1','twin_forecast_residual_v1')`,
  );
  assert.equal(canonicalFacts.rows[0].count, 3);
  ok("projection rebuild creates no duplicate canonical facts");

  console.log(`SUMMARY ${pass} PASS / 0 FAIL`);
}

main().finally(async () => pool.end());
