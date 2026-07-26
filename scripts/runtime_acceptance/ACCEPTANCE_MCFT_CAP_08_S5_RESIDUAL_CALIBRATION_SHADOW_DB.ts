// Fresh-PostgreSQL development proof for MCFT-CAP-08.S5 exact Residual, Calibration Candidate and paired Shadow semantics.
// Development preflight only; no Candidate Declaration, effectiveness, final formal run, production Runtime source, Model Activation, active Config switch, or MCFT-CAP-09 authority.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PostgresCalibrationGovernanceRepositoryV1 } from "../../apps/server/src/persistence/calibration/postgres_calibration_governance_repository_v1.js";
import { PostgresFeedbackPersistenceRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_feedback_persistence_repository_v1.js";
import { PostgresCap08S5ExactSourceV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_cap08_s5_exact_source_v1.js";
import { Cap08S5ResidualCalibrationShadowServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s5_residual_calibration_shadow_service_v1.js";
import {
  CAP08_S5_EXPECTED_CANDIDATE_PARAMETER_V1,
  validateCap08S5ResidualObligationsV1,
} from "../../apps/server/src/domain/twin_runtime/cap08_s5_residual_calibration_shadow_contracts_v1.js";
import {
  admin,
  runner,
} from "./mcft_cap08_s2_g3_acceptance_support_v1.js";
import { establishCap08S5SlicePredecessorV1 } from "./mcft_cap08_s5_acceptance_support_v1.js";

if (process.env.MCFT_CAP08_S5_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP08_S5_DESTRUCTIVE_ACCEPTANCE_1");
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_08_S5_RESIDUAL_CALIBRATION_SHADOW_DB_RESULT.json");

function write(value: unknown): void {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
}

async function rowsV1(table: string, orderBy: string): Promise<unknown[]> {
  const result = await admin.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY ${orderBy}`);
  return result.rows.map((row) => row.row);
}

async function tableExistsV1(table: string): Promise<boolean> {
  return Boolean((await admin.query("SELECT to_regclass($1) AS relation", [`public.${table}`])).rows[0].relation);
}

async function optionalRowsV1(table: string, orderBy = "1"): Promise<unknown[]> {
  return await tableExistsV1(table) ? rowsV1(table, orderBy) : [];
}

async function activeConfigAuditV1(): Promise<Record<string, unknown[]>> {
  const discovered = await admin.query(
    `SELECT tablename FROM pg_tables
      WHERE schemaname='public'
        AND tablename ILIKE '%active%config%'
      ORDER BY tablename`,
  );
  const result: Record<string, unknown[]> = {};
  for (const row of discovered.rows) result[row.tablename] = await optionalRowsV1(row.tablename);
  return result;
}

async function pointersV1(): Promise<Record<string, unknown[]>> {
  return {
    state: await rowsV1(
      "twin_state_latest_index_v1",
      "tenant_id,project_id,group_id,field_id,season_id,zone_id",
    ),
    forecast: await rowsV1(
      "twin_forecast_result_latest_index_v1",
      "tenant_id,project_id,group_id,field_id,season_id,zone_id",
    ),
    forecast_success: await rowsV1(
      "twin_forecast_success_latest_index_v1",
      "tenant_id,project_id,group_id,field_id,season_id,zone_id",
    ),
    checkpoint: await rowsV1(
      "twin_runtime_checkpoint_latest_index_v1",
      "tenant_id,project_id,group_id,field_id,season_id,zone_id",
    ),
    scenario: await rowsV1(
      "twin_scenario_latest_index_v1",
      "tenant_id,project_id,group_id,field_id,season_id,zone_id",
    ),
  };
}

async function objectTypeCountV1(type: string): Promise<number> {
  return Number((await admin.query(
    `SELECT count(*)::int AS n FROM facts WHERE record_json->>'type'=$1`,
    [type],
  )).rows[0].n);
}

async function identityKindCountV1(kind: string): Promise<number> {
  return Number((await admin.query(
    `SELECT count(*)::int AS n FROM twin_object_idempotency_index_v1 WHERE identity_kind=$1`,
    [kind],
  )).rows[0].n);
}

async function s5CountsV1(): Promise<Record<string, number>> {
  return {
    residual_facts: await objectTypeCountV1("twin_forecast_residual_v1"),
    candidate_facts: await objectTypeCountV1("twin_calibration_candidate_v1"),
    shadow_facts: await objectTypeCountV1("twin_shadow_evaluation_v1"),
    model_activation_facts: await objectTypeCountV1("twin_model_activation_v1"),
    residual_guards: await identityKindCountV1("C_FORECAST_RESIDUAL"),
    candidate_guards: await identityKindCountV1("D_CALIBRATION_CANDIDATE"),
    shadow_guards: await identityKindCountV1("D_SHADOW_EVALUATION"),
    residual_projection: Number((await admin.query("SELECT count(*)::int AS n FROM twin_forecast_residual_projection_v1")).rows[0].n),
    candidate_projection: Number((await admin.query("SELECT count(*)::int AS n FROM twin_calibration_candidate_projection_v1")).rows[0].n),
    shadow_projection: Number((await admin.query("SELECT count(*)::int AS n FROM twin_shadow_evaluation_projection_v1")).rows[0].n),
    candidate_evaluation_index: Number((await admin.query("SELECT count(*)::int AS n FROM twin_candidate_evaluation_index_v1")).rows[0].n),
    shadow_case_projection: Number((await admin.query("SELECT count(*)::int AS n FROM twin_shadow_evaluation_case_projection_v1")).rows[0].n),
  };
}

async function canonicalFactSnapshotV1(objectId: string): Promise<Record<string, unknown>> {
  const result = await admin.query(
    `SELECT fact_id,occurred_at::text AS occurred_at,source,record_json,ingested_at::text AS ingested_at
       FROM facts WHERE record_json->'payload'->>'object_id'=$1`,
    [objectId],
  );
  if (result.rows.length !== 1) throw new Error(`CAP08_S5_ACCEPTANCE_FACT_CARDINALITY:${objectId}:${result.rows.length}`);
  return structuredClone(result.rows[0]);
}

async function restoreFactV1(row: Record<string, unknown>): Promise<void> {
  await admin.query(
    `INSERT INTO facts (fact_id,occurred_at,source,record_json,ingested_at)
     VALUES ($1,$2::timestamptz,$3,$4::jsonb,$5::timestamptz)`,
    [row.fact_id, row.occurred_at, row.source, JSON.stringify(row.record_json), row.ingested_at],
  );
}

async function expectFailureV1(action: () => Promise<unknown>, expected: RegExp): Promise<void> {
  try {
    await action();
  } catch (error) {
    assert.match(error instanceof Error ? error.message : String(error), expected);
    return;
  }
  throw new Error(`EXPECTED_FAILURE_NOT_RAISED:${expected.source}`);
}

async function main(): Promise<void> {
  const checks: Array<{ name: string; status: "PASS" }> = [];
  const ok = (name: string): void => {
    checks.push({ name, status: "PASS" });
    console.log(`PASS ${name}`);
  };
  try {
    assert.equal((await runner.query("SELECT current_user AS u")).rows[0].u, "geox_mcft_cap08_runner_v1");
    const established = await establishCap08S5SlicePredecessorV1(ROOT);
    assert.equal(established.obligations.length, 24);
    assert.equal(established.slice_acceptance_only, true);
    assert.equal(established.final_formal_run_id, null);
    ok("exact S3 plus S4 slice predecessor and 24-item ledger established");

    const feedbackRepository = new PostgresFeedbackPersistenceRepositoryV1(runner);
    const governanceRepository = new PostgresCalibrationGovernanceRepositoryV1(runner);
    const source = new PostgresCap08S5ExactSourceV1(runner, feedbackRepository);
    const service = new Cap08S5ResidualCalibrationShadowServiceV1(source, governanceRepository);
    const request = {
      scope: established.predecessor.fixture.scope,
      formal_run_id: established.predecessor.fixture.formal_run_id,
      created_at: "2026-07-26T00:00:00.000Z",
      predecessor: established.predecessor_evidence,
      obligations: established.obligations,
    };

    const pointersBefore = await pointersV1();
    const activeConfigBefore = await activeConfigAuditV1();
    const stateFactCountBefore = await objectTypeCountV1("twin_state_estimate_v1");
    const forecastFactCountBefore = await objectTypeCountV1("twin_forecast_run_v1");

    const candidateFaultStages = ["before_fact", "before_projection", "before_idempotency_guard", "before_commit"];
    for (const target of candidateFaultStages) {
      await expectFailureV1(
        () => service.execute({
          ...request,
          candidate_fault_injection(stage) {
            if (stage === target) throw new Error(`S5_CANDIDATE_FAULT:${target}`);
          },
        }),
        new RegExp(`S5_CANDIDATE_FAULT:${target}`),
      );
      const counts = await s5CountsV1();
      assert.equal(counts.residual_facts, 24);
      assert.equal(counts.residual_guards, 24);
      assert.equal(counts.residual_projection, 24);
      assert.equal(counts.candidate_facts, 0);
      assert.equal(counts.candidate_guards, 0);
      assert.equal(counts.candidate_projection, 0);
      assert.equal(counts.shadow_facts, 0);
    }
    ok("candidate transaction fault stages roll back while complete Residual set remains idempotent");

    const shadowFaultStages = ["before_fact", "before_projection", "before_idempotency_guard", "before_commit"];
    for (const target of shadowFaultStages) {
      await expectFailureV1(
        () => service.execute({
          ...request,
          shadow_fault_injection(stage) {
            if (stage === target) throw new Error(`S5_SHADOW_FAULT:${target}`);
          },
        }),
        new RegExp(`S5_SHADOW_FAULT:${target}`),
      );
      const counts = await s5CountsV1();
      assert.equal(counts.residual_facts, 24);
      assert.equal(counts.candidate_facts, 1);
      assert.equal(counts.candidate_guards, 1);
      assert.equal(counts.candidate_projection, 1);
      assert.equal(counts.shadow_facts, 0);
      assert.equal(counts.shadow_guards, 0);
      assert.equal(counts.shadow_projection, 0);
    }
    ok("shadow transaction fault stages roll back while exact Candidate remains idempotent");

    const first = await service.execute(request);
    assert.equal(first.residual_count, 24);
    assert.equal(first.calibration_case_count, 16);
    assert.equal(first.holdout_case_count, 8);
    assert.equal(first.residual_insert_count, 0);
    assert.equal(first.candidate.payload.candidate_parameter_value, CAP08_S5_EXPECTED_CANDIDATE_PARAMETER_V1);
    assert.equal(first.candidate_append_count, 0);
    assert.equal(first.shadow_append_count, 1);
    assert.equal(first.shadow_evaluation.payload.model_activation_created, false);
    assert.equal(first.shadow_evaluation.payload.active_config_switch_performed, false);
    assert.equal(first.model_activation_count, 0);
    assert.equal(first.active_runtime_config_switch_count, 0);
    assert.equal(first.state_pointer_delta, 0);
    assert.equal(first.checkpoint_pointer_delta, 0);
    assert.deepEqual(first.calibration_residual_refs, first.ordered_residual_refs.slice(0, 16));
    assert.deepEqual(first.holdout_residual_refs, first.ordered_residual_refs.slice(16));
    const counts = await s5CountsV1();
    assert.deepEqual(counts, {
      residual_facts: 24,
      candidate_facts: 1,
      shadow_facts: 1,
      model_activation_facts: 0,
      residual_guards: 24,
      candidate_guards: 1,
      shadow_guards: 1,
      residual_projection: 24,
      candidate_projection: 1,
      shadow_projection: 1,
      candidate_evaluation_index: 1,
      shadow_case_projection: 8,
    });
    assert.deepEqual(await pointersV1(), pointersBefore);
    assert.deepEqual(await activeConfigAuditV1(), activeConfigBefore);
    assert.equal(await objectTypeCountV1("twin_state_estimate_v1"), stateFactCountBefore);
    assert.equal(await objectTypeCountV1("twin_forecast_run_v1"), forecastFactCountBefore);
    ok("24 Residual 16 Calibration 8 Holdout Candidate 0.034000 and one paired Shadow committed without Runtime consumption");

    const completeSnapshot = await s5CountsV1();
    const second = await service.execute(request);
    assert.equal(second.residual_insert_count, 0);
    assert.equal(second.candidate_append_count, 0);
    assert.equal(second.shadow_append_count, 0);
    assert.equal(second.candidate.object_id, first.candidate.object_id);
    assert.equal(second.candidate.determinism_hash, first.candidate.determinism_hash);
    assert.equal(second.shadow_evaluation.object_id, first.shadow_evaluation.object_id);
    assert.equal(second.shadow_evaluation.determinism_hash, first.shadow_evaluation.determinism_hash);
    assert.deepEqual(await s5CountsV1(), completeSnapshot);
    assert.deepEqual(await pointersV1(), pointersBefore);
    assert.deepEqual(await activeConfigAuditV1(), activeConfigBefore);
    ok("completed S5 rerun is exact readback with zero canonical write");

    const mutatedPhase = structuredClone(established.obligations);
    mutatedPhase[16].commit_phase = "T18";
    assert.throws(
      () => validateCap08S5ResidualObligationsV1(mutatedPhase),
      /CAP08_S5_COMMIT_PHASE_MISMATCH:17/,
    );
    const mutatedAssimilation = structuredClone(established.obligations);
    mutatedAssimilation[4].assimilation_update_ref = "forbidden_assimilation";
    mutatedAssimilation[4].assimilation_update_hash = "sha256:forbidden";
    assert.throws(
      () => validateCap08S5ResidualObligationsV1(mutatedAssimilation),
      /CAP08_S5_ASSIMILATION_ROLE_MISMATCH:5/,
    );
    assert.deepEqual(await s5CountsV1(), completeSnapshot);
    ok("phase drift and residual-only Assimilation leakage fail before persistence");

    const residualFact = await canonicalFactSnapshotV1(first.ordered_residual_refs[11]);
    await admin.query("DELETE FROM facts WHERE fact_id=$1", [residualFact.fact_id]);
    await expectFailureV1(() => service.execute(request), /CAP05_IDEMPOTENT_OBJECT_INCOMPLETE/);
    await restoreFactV1(residualFact);
    assert.deepEqual(await s5CountsV1(), completeSnapshot);
    ok("missing Residual canonical fact with retained guard fails closed");

    const candidateFact = await canonicalFactSnapshotV1(first.candidate.object_id);
    await admin.query("DELETE FROM facts WHERE fact_id=$1", [candidateFact.fact_id]);
    await expectFailureV1(() => service.execute(request), /CAP06_IDEMPOTENT_OBJECT_INCOMPLETE/);
    await restoreFactV1(candidateFact);
    assert.deepEqual(await s5CountsV1(), completeSnapshot);
    ok("missing Candidate canonical fact with retained guard fails closed");

    const shadowFact = await canonicalFactSnapshotV1(first.shadow_evaluation.object_id);
    await admin.query("DELETE FROM facts WHERE fact_id=$1", [shadowFact.fact_id]);
    await expectFailureV1(() => service.execute(request), /CAP06_IDEMPOTENT_OBJECT_INCOMPLETE/);
    await restoreFactV1(shadowFact);
    assert.deepEqual(await s5CountsV1(), completeSnapshot);
    assert.deepEqual(await pointersV1(), pointersBefore);
    assert.deepEqual(await activeConfigAuditV1(), activeConfigBefore);
    ok("missing Shadow canonical fact with retained guard fails closed and no pointer moves");

    const result = {
      schema_version: "geox_mcft_cap08_s5_development_db_result_v1",
      status: "PASS",
      formal_run_id: request.formal_run_id,
      slice_acceptance_only: true,
      final_formal_run_id: null,
      checks,
      counts: completeSnapshot,
      candidate_ref: first.candidate.object_id,
      candidate_hash: first.candidate.determinism_hash,
      candidate_parameter_value: first.candidate.payload.candidate_parameter_value,
      shadow_ref: first.shadow_evaluation.object_id,
      shadow_hash: first.shadow_evaluation.determinism_hash,
      shadow_disposition: first.shadow_evaluation.payload.evaluation_disposition,
      ordered_residual_refs: first.ordered_residual_refs,
      ordered_residual_hashes: first.ordered_residual_hashes,
      source_dataset_identity: first.source_dataset_identity,
      semantic_digest: first.semantic_digest,
      model_activation_count: 0,
      active_runtime_config_switch_count: 0,
      state_pointer_delta: 0,
      checkpoint_pointer_delta: 0,
      s5_effective: false,
      s6_authorized: false,
      production_runtime_source_authorized: false,
      mcft_cap_09_authorized: false,
    };
    write(result);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await Promise.allSettled([runner.end(), admin.end()]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
