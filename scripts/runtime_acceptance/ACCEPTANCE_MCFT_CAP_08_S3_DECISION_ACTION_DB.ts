// Fresh-PostgreSQL positive proof for MCFT-CAP-08.S3 Decision + Action Feedback.
// Candidate implementation proof only; independent review, merge effectiveness, S4, production Runtime source, and MCFT-CAP-09 remain unauthorized.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CAP08_S3_FORMAL_PROVIDER_CONTRACT_DIGEST_V1 as CONTRACT,
  CAP08_S3_FORMAL_PROVIDER_PROFILE_ID_V1 as PROFILE,
} from "../../apps/server/src/domain/twin_runtime/cap08_s3_formal_provider_contracts_v1.js";
import { DirectCap04ExecutionConfigResolverV1 } from "../../apps/server/src/domain/twin_runtime/runtime_config_execution_view_v1.js";
import { PostgresActionFeedbackTickSourceV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_action_feedback_tick_source_v1.js";
import { Cap08S2QualifiedEvidenceSourceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s2_qualified_evidence_source_v1.js";
import { Cap08S3AuthorityGuardV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s3_authority_guard_v1.js";
import { Cap08S3DecisionActionProviderServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s3_decision_action_provider_service_v1.js";
import { Cap08S3EpisodeInspectorV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s3_episode_inspector_v1.js";
import { Cap08S3FormalRangeServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s3_formal_range_service_v1.js";
import { Cap08S3FormalRuntimeServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s3_formal_runtime_service_v1.js";
import { Cap08S3FormalTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s3_formal_tick_service_v1.js";
import { Cap08S3ReceiptEpisodeGuardV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s3_receipt_episode_guard_v1.js";
import { Cap05ReceiptConsumingForecastScenarioTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/receipt_consuming_forecast_scenario_tick_service_v1.js";
import {
  A0BootstrapRuntimeServiceV1,
  Cap04ForecastScenarioSingleTickServiceV1,
  Cap08CompletionAuthorityServiceV1,
  Cap08DeferredScenarioPersistenceV1,
  Cap08FrozenEvidenceSourceV1,
  PostgresCompletionAuthorityRepositoryV1,
  PostgresForecastScenarioRecoveryRepositoryV1,
  PostgresNextTickRepositoryV1,
  PostgresRuntimeRepositoryV1,
  PrepareNextTickInputServiceV1,
  CAP08_S1_CREATED_AT_V1 as CREATED_AT,
  admin,
  persistenceAdapterV1,
  runner,
} from "./mcft_cap08_s2_g3_acceptance_support_v1.js";
import { buildCap08S2FormalProviderFixtureV1 } from "./mcft_cap08_s2_formal_provider_fixture_v1.js";

if (process.env.MCFT_CAP08_S3_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP08_S3_DESTRUCTIVE_ACCEPTANCE_1");
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_08_S3_DECISION_ACTION_DB_RESULT.json");
const write = (value: unknown): void => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
};

function s3SourceDigestV1(): string {
  const files = [
    "apps/server/src/domain/twin_runtime/cap08_phase_engine_contracts_v1.ts",
    "apps/server/src/domain/twin_runtime/cap08_s3_formal_provider_contracts_v1.ts",
    "apps/server/src/domain/twin_runtime/cap08_s3_phase_contracts_v1.ts",
    "apps/server/src/persistence/twin_runtime/postgres_approval_plan_evidence_repository_v1.ts",
    "apps/server/src/persistence/twin_runtime/postgres_immutable_decision_action_commit_repository_v1.ts",
    "apps/server/src/runtime/twin_runtime/action_feedback_normalization_service_v1.ts",
    "apps/server/src/runtime/twin_runtime/human_decision_service_v1.ts",
    "apps/server/src/runtime/twin_runtime/cap08_deferred_scenario_persistence_v1.ts",
    "apps/server/src/runtime/twin_runtime/cap08_frozen_evidence_source_v1.ts",
    "apps/server/src/runtime/twin_runtime/receipt_consuming_forecast_scenario_tick_service_v1.ts",
    "apps/server/src/runtime/twin_runtime/cap08_s3_authority_guard_v1.ts",
    "apps/server/src/runtime/twin_runtime/cap08_s3_decision_action_provider_service_v1.ts",
    "apps/server/src/runtime/twin_runtime/cap08_s3_episode_inspector_v1.ts",
    "apps/server/src/runtime/twin_runtime/cap08_s3_formal_tick_service_v1.ts",
    "apps/server/src/runtime/twin_runtime/cap08_s3_receipt_episode_guard_v1.ts",
    "apps/server/src/runtime/twin_runtime/cap08_s3_formal_range_service_v1.ts",
    "apps/server/src/runtime/twin_runtime/cap08_s3_formal_runtime_service_v1.ts",
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

async function countObjectV1(type: string): Promise<number> {
  return Number((await runner.query(
    "SELECT count(*)::int AS n FROM facts WHERE record_json->'payload'->>'object_type'=$1",
    [type],
  )).rows[0].n);
}

async function countRecordV1(source: string, type: string): Promise<number> {
  return Number((await runner.query(
    "SELECT count(*)::int AS n FROM facts WHERE source=$1 AND record_json->>'type'=$2",
    [source, type],
  )).rows[0].n);
}

async function rowsV1(table: string, orderBy: string): Promise<unknown[]> {
  const result = await admin.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY ${orderBy}`);
  return result.rows.map((row) => row.row);
}

async function snapshotV1(): Promise<Record<string, unknown>> {
  return {
    facts: await rowsV1("facts", "fact_id"),
    object_idempotency: await rowsV1("twin_object_idempotency_index_v1", "idempotency_key"),
    decisions: await rowsV1("twin_decision_record_projection_v1", "decision_object_id"),
    plans: await rowsV1("twin_approved_plan_binding_projection_v1", "approved_plan_evidence_ref"),
    action_feedback: await rowsV1("twin_action_feedback_projection_v1", "action_feedback_object_id"),
    action_feedback_evidence: await rowsV1("twin_action_feedback_evidence_index_v1", "action_feedback_object_id,evidence_kind,evidence_ref"),
    authority: await rowsV1("twin_runtime_authority_snapshot_v1", "authority_kind,authority_ref"),
    active_lineage: await rowsV1("twin_active_lineage_index_v1", "tenant_id,project_id,group_id,field_id,season_id,zone_id"),
    checkpoint_latest: await rowsV1("twin_runtime_checkpoint_latest_index_v1", "tenant_id,project_id,group_id,field_id,season_id,zone_id"),
    state_latest: await rowsV1("twin_state_latest_index_v1", "tenant_id,project_id,group_id,field_id,season_id,zone_id"),
    forecast_latest: await rowsV1("twin_forecast_result_latest_index_v1", "tenant_id,project_id,group_id,field_id,season_id,zone_id"),
    scenario_latest: await rowsV1("twin_scenario_latest_index_v1", "tenant_id,project_id,group_id,field_id,season_id,zone_id"),
    leases: await rowsV1("twin_runtime_lease_v1", "tenant_id,project_id,group_id,field_id,season_id,zone_id"),
  };
}

async function main(): Promise<void> {
  const checks: Array<{ name: string; status: "PASS" }> = [];
  const ok = (name: string): void => { checks.push({ name, status: "PASS" }); console.log(`PASS ${name}`); };
  try {
    assert.equal((await runner.query("SELECT current_user AS u")).rows[0].u, "geox_mcft_cap08_runner_v1");
    ok("bounded runner identity");

    const fixture = buildCap08S2FormalProviderFixtureV1();
    const runtimeRepository = new PostgresRuntimeRepositoryV1(runner);
    const nextTickRepository = new PostgresNextTickRepositoryV1(runner);
    const forecastRepository = new PostgresForecastScenarioRecoveryRepositoryV1(runner);
    const completionRepository = new PostgresCompletionAuthorityRepositoryV1(runner);
    assert.equal((await nextTickRepository.commitRealityBindingSnapshot(fixture.reality_binding_snapshot)).status, "INSERTED");
    for (const config of fixture.runtime_configs) assert.equal((await runtimeRepository.commitRuntimeConfig(config)).status, "INSERTED");

    const order: string[] = [];
    const persistence = persistenceAdapterV1(runtimeRepository, forecastRepository, order);
    const deferred = new Cap08DeferredScenarioPersistenceV1(persistence);
    const qualifiedEvidence = new Cap08S2QualifiedEvidenceSourceV1(fixture.formal_evidence_source);
    const frozenEvidence = new Cap08FrozenEvidenceSourceV1(qualifiedEvidence);
    const handoff = new PrepareNextTickInputServiceV1(nextTickRepository);
    const normalTick = new Cap04ForecastScenarioSingleTickServiceV1(
      handoff,
      frozenEvidence,
      runtimeRepository,
      deferred,
      new DirectCap04ExecutionConfigResolverV1(),
    );
    const actionFeedbackSource = new PostgresActionFeedbackTickSourceV1(runner);
    const receiptTick = new Cap05ReceiptConsumingForecastScenarioTickServiceV1(
      handoff,
      frozenEvidence,
      actionFeedbackSource,
      runtimeRepository,
      deferred,
      new DirectCap04ExecutionConfigResolverV1(),
    );
    const provider = new Cap08S3DecisionActionProviderServiceV1(runner);
    const inspector = new Cap08S3EpisodeInspectorV1(runner);
    const tick = new Cap08S3FormalTickServiceV1(
      handoff,
      frozenEvidence,
      deferred,
      normalTick,
      receiptTick,
      provider,
      new Cap08S3ReceiptEpisodeGuardV1(runner),
      new Cap08S3AuthorityGuardV1(runner),
    );
    const range = new Cap08S3FormalRangeServiceV1(
      handoff,
      tick,
      inspector,
      s3SourceDigestV1(),
      new Cap08CompletionAuthorityServiceV1(completionRepository),
    );
    const runtime = new Cap08S3FormalRuntimeServiceV1(
      new A0BootstrapRuntimeServiceV1(runtimeRepository, runtimeRepository, fixture.bootstrap_evidence_source),
      range,
    );
    const input = {
      formal_run_id: fixture.formal_run_id,
      scope: fixture.scope,
      created_at: CREATED_AT,
      bootstrap_runtime_config: fixture.bootstrap_runtime_config,
      bootstrap_hydraulic: fixture.hydraulic,
      soil_hydraulic_config_ref: "soil_hydraulic_config_c8_v1",
      runtime_config_refs_by_logical_time: fixture.runtime_config_refs_by_logical_time,
      runtime_config_hashes_by_logical_time: fixture.runtime_config_hashes_by_logical_time,
      authorized_future_forcing_binding_ids: ["binding_weather", "binding_et0"],
      crop_stage_context: fixture.crop_stage_context,
      lease_owner: "mcft-cap08-s3-formal-candidate",
      lease_duration_seconds: 300,
    };

    const first = await runtime.execute(input);
    assert.equal(first.status, "COMPLETED");
    assert.equal(first.range.executed_tick_count, 24);
    assert.equal(order.length, 48);
    assert.equal(first.range.provider_profile_id, PROFILE);
    assert.equal(first.range.provider_contract_digest, CONTRACT);
    assert.deepEqual([
      first.range.posterior_state_count,
      first.range.successful_forecast_count,
      first.range.scenario_set_count,
      first.range.forecast_point_count,
      first.range.scenario_point_count,
    ], [25, 24, 24, 1728, 5184]);
    assert.equal(first.range.tick_traces.length, 24);
    assert.ok(first.range.tick_traces.every((trace) => /^sha256:[0-9a-f]{64}$/.test(trace.trace_digest)));
    assert.equal(new Set(first.range.tick_traces.map((trace) => trace.trace_digest)).size, 24);
    ok("fresh PostgreSQL B00 and T00-T23 S3 formal run");
    ok("canonical persisted totals and semantic Tick traces");

    const episode = first.range.episode_inspection;
    assert.equal(episode.disposition, "EXACT_COMPLETE");
    assert.deepEqual([
      episode.decision_count,
      episode.approval_assertion_count,
      episode.approved_plan_count,
      episode.execution_receipt_count,
      episode.action_feedback_count,
    ], [1, 1, 1, 1, 1]);
    assert.equal(episode.action_feedback?.payload.actual_amount_mm, "13.600000");
    assert.equal(episode.action_feedback?.payload.spatial_coverage_fraction, "0.910000");
    assert.equal(episode.action_feedback?.payload.target_scope_equivalent_irrigation_mm, "12.376000");
    ok("exact canonical Decision Approval Plan Receipt Action Feedback chain");

    const t07 = first.range.tick_results.find((tickResult) => tickResult.phase_plan.tick_id === "T07");
    const t08 = first.range.tick_results.find((tickResult) => tickResult.phase_plan.tick_id === "T08");
    const t09 = first.range.tick_results.find((tickResult) => tickResult.phase_plan.tick_id === "T09");
    const t10 = first.range.tick_results.find((tickResult) => tickResult.phase_plan.tick_id === "T10");
    assert.ok(t07 && t08 && t09 && t10);
    assert.equal(t07.receipt, null);
    assert.equal(t08.action_feedback_consumed_by_a, true);
    assert.equal(t08.action_feedback?.object_id, episode.action_feedback?.object_id);
    assert.ok(t08.a_provider_result.evidence_window?.dynamics_consumed_evidence_refs.includes(episode.action_feedback!.object_id));
    assert.equal(t09.outcome_fvo10_record, null);
    assert.equal(t09.a_provider_result.evidence_window?.observation_selection.selected_observation_ref, null);
    assert.equal(t10.outcome_fvo10_record?.source_record_id, "FVO-10");
    assert.equal(t10.a_provider_result.evidence_window?.observation_selection.selected_observation_ref, "FVO-10");
    assert.deepEqual(t10.a_provider_result.evidence_window?.assimilation_applied_evidence_refs, ["FVO-10"]);
    ok("T07 absence T08 H-before-A T09 absence T10 ordinary assimilation");

    assert.deepEqual(await Promise.all([
      countObjectV1("twin_state_estimate_v1"),
      countObjectV1("twin_forecast_run_v1"),
      countObjectV1("twin_scenario_set_v1"),
      countObjectV1("twin_decision_record_v1"),
      countObjectV1("twin_action_feedback_v1"),
      countObjectV1("twin_forecast_residual_v1"),
      countObjectV1("twin_calibration_candidate_v1"),
      countObjectV1("twin_shadow_evaluation_v1"),
      countObjectV1("twin_model_activation_v1"),
    ]), [25, 25, 24, 1, 1, 0, 0, 0, 0]);
    assert.deepEqual(await Promise.all([
      countRecordV1("mcft_cap08_s3_replay_evidence_v1", "controlled_human_decision_request_v1"),
      countRecordV1("mcft_cap05_replay_evidence_v1", "approval_assertion_evidence_v1"),
      countRecordV1("mcft_cap05_replay_evidence_v1", "approved_irrigation_plan_snapshot_v1"),
      countRecordV1("mcft_cap08_s3_replay_evidence_v1", "irrigation_execution_receipt_evidence_v1"),
      countRecordV1("mcft_cap05_replay_evidence_v1", "external_dispatch_evidence_v1"),
    ]), [1, 1, 1, 1, 0]);
    ok("canonical cardinality and S3 nonclaims");

    const before = await snapshotV1();
    const second = await runtime.execute({ ...input, lease_owner: `${input.lease_owner}-replay` });
    const after = await snapshotV1();
    assert.equal(second.status, "ALREADY_COMPLETE");
    assert.equal(second.range.executed_tick_count, 0);
    assert.equal(second.range.episode_inspection.disposition, "EXACT_COMPLETE");
    assert.deepEqual([
      second.range.posterior_state_count,
      second.range.successful_forecast_count,
      second.range.scenario_set_count,
      second.range.forecast_point_count,
      second.range.scenario_point_count,
    ], [25, 24, 24, 1728, 5184]);
    assert.deepEqual(second.range.tick_traces, []);
    assert.deepEqual(after, before);
    ok("completed replay exact readback and zero mutation");

    const result = {
      schema_version: "geox_mcft_cap08_s3_decision_action_db_result_v1",
      status: "PASS",
      candidate_implementation_proof: true,
      s3_candidate_implemented: false,
      independent_review_required: true,
      independent_review_satisfied: false,
      independent_review_waived: false,
      provider_profile_id: PROFILE,
      provider_contract_digest: CONTRACT,
      phase_engine_source_digest: first.range.phase_engine_source_digest,
      formal_run_id: fixture.formal_run_id,
      successful_tick_count: first.range.successful_tick_count,
      persisted_cardinalities: {
        posterior_state_count: first.range.posterior_state_count,
        successful_forecast_count: first.range.successful_forecast_count,
        scenario_set_count: first.range.scenario_set_count,
        forecast_point_count: first.range.forecast_point_count,
        scenario_point_count: first.range.scenario_point_count,
      },
      tick_trace_digests: first.range.tick_traces.map((trace) => trace.trace_digest),
      decision_count: first.range.decision_count,
      approval_assertion_count: first.range.approval_assertion_count,
      approved_plan_count: first.range.approved_plan_count,
      execution_receipt_count: first.range.execution_receipt_count,
      action_feedback_count: first.range.action_feedback_count,
      outcome_fvo10_identity_count: first.range.outcome_fvo10_identity_count,
      t08_h_before_a: first.range.t08_h_before_a,
      t09_outcome_absence: first.range.t09_outcome_absence,
      t10_ordinary_assimilation: first.range.t10_ordinary_assimilation,
      completed_rerun_write_delta: 0,
      recommendation_count: 0,
      ao_act_count: 0,
      dispatch_count: 0,
      residual_count: 0,
      calibration_candidate_count: 0,
      shadow_evaluation_count: 0,
      model_activation_count: 0,
      production_runtime_source_authorized: false,
      s3_effectiveness_established: false,
      s4_authorized: false,
      mcft_cap_09_authorized: false,
      checks,
    };
    write(result);
    console.log(JSON.stringify(result));
  } catch (error) {
    write({
      schema_version: "geox_mcft_cap08_s3_decision_action_db_result_v1",
      status: "FAIL",
      error: error instanceof Error ? error.message : String(error),
      checks,
    });
    throw error;
  } finally {
    await Promise.all([runner.end(), admin.end()]);
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
