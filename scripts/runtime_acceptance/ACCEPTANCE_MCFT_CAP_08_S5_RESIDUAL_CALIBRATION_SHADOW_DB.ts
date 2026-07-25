// Fresh-PostgreSQL Residual, Calibration Candidate, Shadow Evaluation, zero-write rerun and corruption proof for MCFT-CAP-08.S5.
// Development preflight only; no formal candidate, effectiveness, S6 closure, Model Activation, production Runtime source or MCFT-CAP-09 authority.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Cap08S5ResidualCalibrationShadowServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s5_residual_calibration_shadow_service_v1.js";
import {
  CAP08_S5_COMPLETION_SCHEMA_VERSION_V1,
  CAP08_S5_EXPECTED_PARAMETER_V1,
  CAP08_S5_RESIDUAL_SET_SCHEMA_VERSION_V1,
} from "../../apps/server/src/domain/twin_runtime/cap08_s5_residual_calibration_shadow_contracts_v1.js";
import { CAP08_S5_RESIDUAL_FACT_SOURCE_V1 } from "../../apps/server/src/persistence/twin_runtime/postgres_cap08_s5_residual_calibration_shadow_repository_v1.js";
import { admin, runner, CAP08_S1_CREATED_AT_V1 as CREATED_AT } from "./mcft_cap08_s2_g3_acceptance_support_v1.js";
import { establishCap08S4FormalPredecessorV1 } from "./mcft_cap08_s5_acceptance_support_v1.js";

if (process.env.MCFT_CAP08_S5_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP08_S5_DESTRUCTIVE_ACCEPTANCE_1");
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_08_S5_RESIDUAL_CALIBRATION_SHADOW_DB_RESULT.json");

function write(value: unknown): void {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
}
async function rows(table: string, orderBy: string): Promise<unknown[]> {
  const result = await admin.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY ${orderBy}`);
  return result.rows.map((row) => row.row);
}
async function pointers(): Promise<Record<string, unknown>> {
  const order = "tenant_id,project_id,group_id,field_id,season_id,zone_id";
  return {
    state: await rows("twin_state_latest_index_v1", order),
    forecast: await rows("twin_forecast_result_latest_index_v1", order),
    forecast_success: await rows("twin_forecast_success_latest_index_v1", order),
    checkpoint: await rows("twin_runtime_checkpoint_latest_index_v1", order),
    scenario: await rows("twin_scenario_latest_index_v1", order),
  };
}
async function snapshot(): Promise<Record<string, unknown>> {
  return {
    facts: await rows("facts", "fact_id"),
    idempotency: await rows("twin_object_idempotency_index_v1", "idempotency_key"),
    authority: await rows("twin_runtime_authority_snapshot_v1", "authority_kind,authority_ref"),
    candidates: await rows("twin_calibration_candidate_projection_v1", "candidate_object_id"),
    evaluations: await rows("twin_shadow_evaluation_projection_v1", "evaluation_object_id"),
    candidate_evaluations: await rows("twin_candidate_evaluation_index_v1", "candidate_ref,evaluation_object_id"),
    evaluation_cases: await rows("twin_shadow_evaluation_case_projection_v1", "evaluation_object_id,case_index"),
    pointers: await pointers(),
  };
}
async function objectCount(type: string): Promise<number> {
  return Number((await admin.query(
    `SELECT count(*)::int AS n FROM facts WHERE record_json->'payload'->>'object_type'=$1`, [type],
  )).rows[0].n);
}
async function expectFailure(action: () => Promise<unknown>, expected: RegExp): Promise<void> {
  try { await action(); }
  catch (error) {
    assert.match(error instanceof Error ? error.message : String(error), expected);
    return;
  }
  throw new Error(`EXPECTED_FAILURE_NOT_RAISED:${expected.source}`);
}
async function factRecord(objectId: string): Promise<{fact_id:string;record_json:unknown}> {
  const result = await admin.query(
    `SELECT fact_id,record_json FROM facts WHERE record_json->'payload'->>'object_id'=$1`, [objectId],
  );
  assert.equal(result.rows.length, 1);
  return result.rows[0];
}
async function authorityRecord(ref: string): Promise<{authority_kind:string;authority_ref:string;determinism_hash:string;semantic_payload:unknown}> {
  const result = await admin.query(
    `SELECT authority_kind,authority_ref,determinism_hash,semantic_payload
       FROM twin_runtime_authority_snapshot_v1 WHERE authority_ref=$1`, [ref],
  );
  assert.equal(result.rows.length, 1);
  return result.rows[0];
}

async function main(): Promise<void> {
  const checks: Array<{name:string;status:"PASS"}> = [];
  const ok = (name: string): void => { checks.push({name,status:"PASS"}); console.log(`PASS ${name}`); };
  try {
    assert.equal((await runner.query("SELECT current_user AS u")).rows[0].u, "geox_mcft_cap08_runner_v1");
    const predecessor = await establishCap08S4FormalPredecessorV1(ROOT);
    const service = new Cap08S5ResidualCalibrationShadowServiceV1(runner, predecessor.fixture.formal_evidence_source);
    const input = {
      formal_run_id: predecessor.fixture.formal_run_id,
      scope: predecessor.fixture.scope,
      created_at: CREATED_AT,
      phase_engine_contract_digest: predecessor.phase_engine_contract_digest,
      phase_engine_source_digest: predecessor.source_manifest.manifest_digest,
    };
    ok("fresh PostgreSQL exact S3 plus S4 predecessor established");

    const before = await snapshot();
    const pointerBefore = await pointers();
    const faultStages = [
      "before_residual_facts",
      "before_residual_guard",
      "before_residual_authority",
      "before_residual_readback",
      "before_residual_commit",
    ];
    for (const target of faultStages) {
      let reached = false;
      await expectFailure(() => service.execute({
        ...input,
        fault_injection(stage) {
          if (stage === target) { reached = true; throw new Error(`S5_FAULT:${target}`); }
        },
      }), new RegExp(`S5_FAULT:${target}`));
      assert.equal(reached, true);
      assert.deepEqual(await snapshot(), before);
    }
    ok("five Residual transaction fault stages roll back all S5 writes");

    const first = await service.execute(input);
    assert.equal(first.status, "COMPLETED");
    assert.equal(first.write_delta, 30);
    assert.equal(first.residual_write_delta, 26);
    assert.equal(first.candidate_write_delta, 1);
    assert.equal(first.shadow_write_delta, 1);
    assert.equal(first.completion_write_delta, 2);
    assert.equal(first.residual_count, 24);
    assert.equal(first.calibration_case_count, 16);
    assert.equal(first.holdout_case_count, 8);
    assert.equal(first.grid_point_count, 21);
    assert.equal(first.candidate_parameter_value, CAP08_S5_EXPECTED_PARAMETER_V1);
    assert.equal(first.model_activation_count, 0);
    assert.equal(first.active_config_switch_count, 0);
    assert.equal(first.state_pointer_delta, 0);
    assert.equal(first.checkpoint_pointer_delta, 0);
    assert.equal(first.residual_authority.schema_version, CAP08_S5_RESIDUAL_SET_SCHEMA_VERSION_V1);
    assert.equal(first.completion_authority.schema_version, CAP08_S5_COMPLETION_SCHEMA_VERSION_V1);
    assert.equal(first.residual_authority.ordered_residuals[0].residual_id, "R-01");
    assert.equal(first.residual_authority.ordered_residuals[23].residual_id, "R-24");
    assert.equal(first.residual_authority.ordered_residuals[16].forecast_id,
      predecessor.s4_result.corrected_set.forecast.object_id);
    assert.equal(first.residual_authority.ordered_residuals[0].observation_id, "FVO-01");
    assert.equal(first.residual_authority.ordered_residuals[23].observation_id, "FVO-24");
    assert.deepEqual(await pointers(), pointerBefore);
    assert.equal(await objectCount("twin_forecast_residual_v1"), 24);
    assert.equal(await objectCount("twin_calibration_candidate_v1"), 1);
    assert.equal(await objectCount("twin_shadow_evaluation_v1"), 1);
    assert.equal(await objectCount("twin_model_activation_v1"), 0);
    assert.equal(Number((await admin.query(
      `SELECT count(*)::int AS n FROM facts WHERE source=$1`, [CAP08_S5_RESIDUAL_FACT_SOURCE_V1],
    )).rows[0].n), 24);
    ok("exact 24 16 8 1 1 0 S5 cardinality and corrected R17 forecast binding");

    const completed = await snapshot();
    const rerun = await service.execute(input);
    assert.equal(rerun.status, "ALREADY_COMPLETE");
    assert.equal(rerun.write_delta, 0);
    assert.equal(rerun.completion_authority.determinism_hash, first.completion_authority.determinism_hash);
    assert.deepEqual(await snapshot(), completed);
    ok("completed rerun is byte-exact zero-write");

    const residualFact = await factRecord(first.residual_authority.ordered_residuals[5].ref);
    const candidateFact = await factRecord(first.candidate_ref);
    const shadowFact = await factRecord(first.shadow_ref);
    const residualAuthorityRow = await authorityRecord(first.residual_authority.authority_ref);
    const completionAuthorityRow = await authorityRecord(first.completion_authority.authority_ref);
    const residualGuard = (await admin.query(
      `SELECT to_jsonb(t) AS row FROM twin_object_idempotency_index_v1 t WHERE idempotency_key=$1`,
      [first.residual_authority.idempotency_key],
    )).rows[0].row;

    const cases: Array<{name:string;corrupt:()=>Promise<void>;restore:()=>Promise<void>;expected:RegExp}> = [
      {
        name:"CR01 residual fact semantic hash corruption",
        corrupt: async () => { await admin.query(
          `UPDATE facts SET record_json=jsonb_set(record_json,'{payload,determinism_hash}','\"sha256:${"1".repeat(64)}\"'::jsonb) WHERE fact_id=$1`,
          [residualFact.fact_id]); },
        restore: async () => { await admin.query("UPDATE facts SET record_json=$2::jsonb WHERE fact_id=$1", [residualFact.fact_id, JSON.stringify(residualFact.record_json)]); },
        expected:/CAP05_RESIDUAL_SEMANTIC_HASH_MISMATCH|CAP08_S5_RESIDUAL_BINDING_CONFLICT/,
      },
      {
        name:"CR02 residual guard corruption",
        corrupt: async () => { await admin.query(
          `UPDATE twin_object_idempotency_index_v1 SET determinism_hash=$2 WHERE idempotency_key=$1`,
          [first.residual_authority.idempotency_key, `sha256:${"2".repeat(64)}`]); },
        restore: async () => { await admin.query(
          `UPDATE twin_object_idempotency_index_v1 SET identity_kind=$2,record_set_id=$3,determinism_hash=$4,identity_basis=$5::jsonb,member_object_ids=$6::jsonb,member_determinism_hashes=$7::jsonb WHERE idempotency_key=$1`,
          [first.residual_authority.idempotency_key,residualGuard.identity_kind,residualGuard.record_set_id,residualGuard.determinism_hash,
            JSON.stringify(residualGuard.identity_basis),JSON.stringify(residualGuard.member_object_ids),JSON.stringify(residualGuard.member_determinism_hashes)]); },
        expected:/CAP08_S5_RESIDUAL_GUARD_CONFLICT/,
      },
      {
        name:"CR03 residual authority corruption",
        corrupt: async () => { await admin.query(
          `UPDATE twin_runtime_authority_snapshot_v1 SET determinism_hash=$2 WHERE authority_ref=$1`,
          [first.residual_authority.authority_ref, `sha256:${"3".repeat(64)}`]); },
        restore: async () => { await admin.query(
          `UPDATE twin_runtime_authority_snapshot_v1 SET authority_kind=$2,determinism_hash=$3,semantic_payload=$4::jsonb WHERE authority_ref=$1`,
          [residualAuthorityRow.authority_ref,residualAuthorityRow.authority_kind,residualAuthorityRow.determinism_hash,JSON.stringify(residualAuthorityRow.semantic_payload)]); },
        expected:/CAP08_S5_RESIDUAL_AUTHORITY_CONFLICT/,
      },
      {
        name:"CR04 Candidate canonical fact corruption",
        corrupt: async () => { await admin.query(
          `UPDATE facts SET record_json=jsonb_set(record_json,'{payload,determinism_hash}','\"sha256:${"4".repeat(64)}\"'::jsonb) WHERE fact_id=$1`,
          [candidateFact.fact_id]); },
        restore: async () => { await admin.query("UPDATE facts SET record_json=$2::jsonb WHERE fact_id=$1", [candidateFact.fact_id,JSON.stringify(candidateFact.record_json)]); },
        expected:/CAP06_CANONICAL_DETERMINISM_HASH_MISMATCH|CAP08_S5_EXISTING_CANDIDATE_CONFLICT/,
      },
      {
        name:"CR05 Shadow canonical fact corruption",
        corrupt: async () => { await admin.query(
          `UPDATE facts SET record_json=jsonb_set(record_json,'{payload,determinism_hash}','\"sha256:${"5".repeat(64)}\"'::jsonb) WHERE fact_id=$1`,
          [shadowFact.fact_id]); },
        restore: async () => { await admin.query("UPDATE facts SET record_json=$2::jsonb WHERE fact_id=$1", [shadowFact.fact_id,JSON.stringify(shadowFact.record_json)]); },
        expected:/CAP06_CANONICAL_DETERMINISM_HASH_MISMATCH|CAP08_S5_EXISTING_SHADOW_CONFLICT/,
      },
      {
        name:"CR06 completion authority corruption",
        corrupt: async () => { await admin.query(
          `UPDATE twin_runtime_authority_snapshot_v1 SET determinism_hash=$2 WHERE authority_ref=$1`,
          [first.completion_authority.authority_ref, `sha256:${"6".repeat(64)}`]); },
        restore: async () => { await admin.query(
          `UPDATE twin_runtime_authority_snapshot_v1 SET authority_kind=$2,determinism_hash=$3,semantic_payload=$4::jsonb WHERE authority_ref=$1`,
          [completionAuthorityRow.authority_ref,completionAuthorityRow.authority_kind,completionAuthorityRow.determinism_hash,JSON.stringify(completionAuthorityRow.semantic_payload)]); },
        expected:/CAP08_S5_COMPLETION_AUTHORITY_CONFLICT/,
      },
    ];
    for (const item of cases) {
      await item.corrupt();
      await expectFailure(() => service.execute(input), item.expected);
      await item.restore();
      assert.deepEqual(await snapshot(), completed);
      ok(item.name);
    }

    const result = {
      schema_version:"geox_mcft_cap08_s5_development_result_v1",
      status:"PASS",
      formal_run_id:input.formal_run_id,
      residual_authority_ref:first.residual_authority.authority_ref,
      residual_authority_hash:first.residual_authority.determinism_hash,
      completion_authority_ref:first.completion_authority.authority_ref,
      completion_authority_hash:first.completion_authority.determinism_hash,
      candidate_ref:first.candidate_ref,
      candidate_hash:first.candidate_hash,
      candidate_parameter_value:first.candidate_parameter_value,
      shadow_ref:first.shadow_ref,
      shadow_hash:first.shadow_hash,
      residual_count:24,calibration_case_count:16,holdout_case_count:8,
      grid_point_count:21,candidate_count:1,shadow_count:1,model_activation_count:0,
      first_write_delta:30,completed_rerun_write_delta:0,
      residual_fault_stage_count:faultStages.length,corruption_case_count:cases.length,
      r17_corrected_forecast_ref:first.residual_authority.ordered_residuals[16].forecast_id,
      checks,
    };
    write(result);
    console.log(JSON.stringify(result));
  } catch (error) {
    write({schema_version:"geox_mcft_cap08_s5_development_result_v1",status:"FAIL",error:error instanceof Error?error.message:String(error),checks});
    throw error;
  } finally {
    await runner.end();
    await admin.end();
  }
}

await main();
