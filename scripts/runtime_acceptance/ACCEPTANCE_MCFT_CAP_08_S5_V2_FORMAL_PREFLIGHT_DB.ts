// Fresh-PostgreSQL preflight for formal MCFT-CAP-08.S5 over the externally effective replay-dataset v2 predecessor.
// No Candidate Declaration or effectiveness claim is created by this preflight.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PoolClient } from "pg";

import { PostgresCalibrationGovernanceRepositoryV1 } from "../../apps/server/src/persistence/calibration/postgres_calibration_governance_repository_v1.js";
import { PostgresFeedbackPersistenceRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_feedback_persistence_repository_v1.js";
import { PostgresCap08S5ExactSourceV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_cap08_s5_exact_source_v1.js";
import { Cap08S5ResidualCalibrationShadowServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s5_residual_calibration_shadow_service_v1.js";
import { validateCap08S5ResidualObligationsV1 } from "../../apps/server/src/domain/twin_runtime/cap08_s5_residual_calibration_shadow_contracts_v1.js";
import {
  admin,
  runner,
} from "./mcft_cap08_s2_g3_acceptance_support_v1.js";
import {
  establishCap08S5V2FormalPredecessorV1,
} from "./mcft_cap08_s5_v2_formal_acceptance_support_v1.js";

if (process.env.MCFT_CAP08_S5_V2_FORMAL_PREFLIGHT_DESTRUCTIVE !== "1") {
  throw new Error("SET_MCFT_CAP08_S5_V2_FORMAL_PREFLIGHT_DESTRUCTIVE_1");
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_08_S5_V2_FORMAL_PREFLIGHT_RESULT.json");

function write(value: unknown): void {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
}

async function rowsV1(table: string, orderBy = "1"): Promise<unknown[]> {
  return (await admin.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY ${orderBy}`))
    .rows.map((row) => row.row);
}

async function tableExistsV1(table: string): Promise<boolean> {
  return Boolean((await admin.query("SELECT to_regclass($1) AS relation", [`public.${table}`])).rows[0].relation);
}

async function optionalRowsV1(table: string): Promise<unknown[]> {
  return await tableExistsV1(table) ? rowsV1(table) : [];
}

async function pointersV1(): Promise<Record<string, unknown[]>> {
  return {
    state: await rowsV1("twin_state_latest_index_v1"),
    forecast: await rowsV1("twin_forecast_result_latest_index_v1"),
    forecast_success: await rowsV1("twin_forecast_success_latest_index_v1"),
    checkpoint: await rowsV1("twin_runtime_checkpoint_latest_index_v1"),
    scenario: await rowsV1("twin_scenario_latest_index_v1"),
  };
}

async function activeConfigAuditV1(): Promise<Record<string, unknown[]>> {
  const discovered = await admin.query(
    `SELECT tablename FROM pg_tables
      WHERE schemaname='public' AND tablename ILIKE '%active%config%'
      ORDER BY tablename`,
  );
  const result: Record<string, unknown[]> = {};
  for (const row of discovered.rows) result[row.tablename] = await optionalRowsV1(row.tablename);
  return result;
}

async function objectCountV1(type: string): Promise<number> {
  return Number((await admin.query(
    `SELECT count(*)::int AS n FROM facts WHERE record_json->>'type'=$1`,
    [type],
  )).rows[0].n);
}

async function guardCountV1(kind: string): Promise<number> {
  return Number((await admin.query(
    "SELECT count(*)::int AS n FROM twin_object_idempotency_index_v1 WHERE identity_kind=$1",
    [kind],
  )).rows[0].n);
}

async function s5CountsV1(): Promise<Record<string, number>> {
  return {
    residual_facts: await objectCountV1("twin_forecast_residual_v1"),
    candidate_facts: await objectCountV1("twin_calibration_candidate_v1"),
    shadow_facts: await objectCountV1("twin_shadow_evaluation_v1"),
    model_activation_facts: await objectCountV1("twin_model_activation_v1"),
    residual_guards: await guardCountV1("C_FORECAST_RESIDUAL"),
    candidate_guards: await guardCountV1("D_CALIBRATION_CANDIDATE"),
    shadow_guards: await guardCountV1("D_SHADOW_EVALUATION"),
    residual_projection: Number((await admin.query(
      "SELECT count(*)::int AS n FROM twin_forecast_residual_projection_v1",
    )).rows[0].n),
    candidate_projection: Number((await admin.query(
      "SELECT count(*)::int AS n FROM twin_calibration_candidate_projection_v1",
    )).rows[0].n),
    shadow_projection: Number((await admin.query(
      "SELECT count(*)::int AS n FROM twin_shadow_evaluation_projection_v1",
    )).rows[0].n),
    candidate_evaluation_index: Number((await admin.query(
      "SELECT count(*)::int AS n FROM twin_candidate_evaluation_index_v1",
    )).rows[0].n),
    shadow_case_projection: Number((await admin.query(
      "SELECT count(*)::int AS n FROM twin_shadow_evaluation_case_projection_v1",
    )).rows[0].n),
  };
}

type FactBackupV1 = {
  client: PoolClient;
  factTable: string;
  visibilityTable: string;
};

async function removeFactWithBackupV1(objectId: string, label: string): Promise<FactBackupV1> {
  if (!/^[a-z0-9_]+$/.test(label)) throw new Error("CAP08_S5_PREFLIGHT_BACKUP_LABEL_INVALID");
  const factTable = `s5_fact_backup_${label}`;
  const visibilityTable = `s5_visibility_backup_${label}`;
  const client = await admin.connect();
  let visibilityTriggersDisabled = false;
  try {
    await client.query("ALTER TABLE twin_fact_visibility_index_v1 DISABLE TRIGGER USER");
    visibilityTriggersDisabled = true;
    await client.query(`CREATE TEMP TABLE ${factTable} ON COMMIT PRESERVE ROWS AS
      SELECT * FROM facts WHERE record_json->'payload'->>'object_id'=$1`, [objectId]);
    const count = Number((await client.query(`SELECT count(*)::int AS n FROM ${factTable}`)).rows[0].n);
    if (count !== 1) throw new Error(`CAP08_S5_PREFLIGHT_FACT_CARDINALITY:${objectId}:${count}`);
    const factId = String((await client.query(`SELECT fact_id FROM ${factTable}`)).rows[0].fact_id);
    await client.query(`CREATE TEMP TABLE ${visibilityTable} ON COMMIT PRESERVE ROWS AS
      SELECT * FROM twin_fact_visibility_index_v1 WHERE fact_id=$1`, [factId]);
    await client.query("DELETE FROM twin_fact_visibility_index_v1 WHERE fact_id=$1", [factId]);
    await client.query(
      "DELETE FROM facts WHERE record_json->'payload'->>'object_id'=$1",
      [objectId],
    );
    return { client, factTable, visibilityTable };
  } catch (error) {
    if (visibilityTriggersDisabled) {
      await client.query("ALTER TABLE twin_fact_visibility_index_v1 ENABLE TRIGGER USER").catch(() => undefined);
    }
    client.release();
    throw error;
  }
}

async function restoreFactV1(backup: FactBackupV1): Promise<void> {
  try {
    await backup.client.query(`INSERT INTO facts SELECT * FROM ${backup.factTable}`);
    const visibilityRows = Number((await backup.client.query(
      `SELECT count(*)::int AS n FROM ${backup.visibilityTable}`,
    )).rows[0].n);
    await backup.client.query(
      `INSERT INTO twin_fact_visibility_index_v1 SELECT * FROM ${backup.visibilityTable} ON CONFLICT DO NOTHING`,
    );
    if (visibilityRows > 0) {
      const factId = String((await backup.client.query(
        `SELECT fact_id FROM ${backup.visibilityTable} LIMIT 1`,
      )).rows[0].fact_id);
      const restored = Number((await backup.client.query(
        "SELECT count(*)::int AS n FROM twin_fact_visibility_index_v1 WHERE fact_id=$1",
        [factId],
      )).rows[0].n);
      if (restored !== visibilityRows) throw new Error(`CAP08_S5_PREFLIGHT_VISIBILITY_RESTORE:${factId}:${restored}`);
    }
    await backup.client.query(`DROP TABLE ${backup.visibilityTable}`);
    await backup.client.query(`DROP TABLE ${backup.factTable}`);
  } finally {
    await backup.client.query("ALTER TABLE twin_fact_visibility_index_v1 ENABLE TRIGGER USER").catch(() => undefined);
    backup.client.release();
  }
}

async function withMissingFactV1(
  objectId: string,
  label: string,
  action: () => Promise<unknown>,
  expected: RegExp,
): Promise<void> {
  const backup = await removeFactWithBackupV1(objectId, label);
  try {
    await expectFailureV1(action, expected);
  } finally {
    await restoreFactV1(backup);
  }
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
  const pass = (name: string): void => {
    checks.push({ name, status: "PASS" });
    console.log(`PASS ${name}`);
  };
  try {
    assert.equal((await runner.query("SELECT current_user AS u")).rows[0].u, "geox_mcft_cap08_runner_v1");
    const established = await establishCap08S5V2FormalPredecessorV1(ROOT);
    assert.equal(established.obligations.length, 24);
    assert.equal(established.prequalification_evidence.selected_parameter_value, "0.034000");
    assert.equal(established.prequalification_evidence.readback_verified, true);
    pass("exact replay-dataset v2 S1-S4 predecessor and immutable R1 authority consumed");

    const service = new Cap08S5ResidualCalibrationShadowServiceV1(
      new PostgresCap08S5ExactSourceV1(
        runner,
        new PostgresFeedbackPersistenceRepositoryV1(runner),
      ),
      new PostgresCalibrationGovernanceRepositoryV1(runner),
    );
    const request = {
      scope: established.predecessor.fixture.scope,
      formal_run_id: established.predecessor.fixture.formal_run_id,
      created_at: "2026-07-26T00:00:00.000Z",
      predecessor: established.predecessor_evidence,
      prequalification: established.prequalification_evidence,
      obligations: established.obligations,
    };

    const pointersBefore = await pointersV1();
    const activeConfigBefore = await activeConfigAuditV1();
    const stateBefore = await objectCountV1("twin_state_estimate_v1");
    const forecastBefore = await objectCountV1("twin_forecast_run_v1");

    for (const target of ["before_fact", "before_projection", "before_idempotency_guard", "before_commit"]) {
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
      assert.equal(counts.candidate_facts, 0);
      assert.equal(counts.shadow_facts, 0);
    }
    pass("Candidate transaction fault stages roll back after exact 24 Residual set");

    for (const target of ["before_fact", "before_projection", "before_idempotency_guard", "before_commit"]) {
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
      assert.equal(counts.shadow_facts, 0);
    }
    pass("Shadow transaction fault stages roll back while exact Candidate remains idempotent");

    const first = await service.execute(request);
    assert.equal(first.residual_count, 24);
    assert.equal(first.calibration_case_count, 16);
    assert.equal(first.objective_case_count, 15);
    assert.equal(first.diagnostic_only_case_count, 1);
    assert.equal(first.holdout_case_count, 8);
    assert.deepEqual(first.diagnostic_only_observation_refs, ["FVO-10"]);
    assert.equal(first.objective_attempt.selected_parameter_value, "0.034000");
    assert.equal(first.objective_attempt.status, "BOUNDED_PARAMETER_DELTA_CANDIDATE");
    assert.equal(first.objective_attempt.excitation_summary?.sensitive_case_count, 7);
    assert.deepEqual(
      first.objective_attempt.excitation_summary?.represented_sensitive_wetness_regimes,
      ["HIGH_EXCESS", "MID_EXCESS"],
    );
    assert.equal(first.candidate.payload.candidate_parameter_value, "0.034000");
    assert.equal(first.candidate.payload.objective_case_count, 15);
    assert.deepEqual(first.candidate.payload.diagnostic_only_observation_refs, ["FVO-10"]);
    assert.equal(first.shadow_evaluation.payload.model_activation_created, false);
    assert.equal(first.shadow_evaluation.payload.active_config_switch_performed, false);
    const completeCounts = await s5CountsV1();
    assert.deepEqual(completeCounts, {
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
    assert.equal(await objectCountV1("twin_state_estimate_v1"), stateBefore);
    assert.equal(await objectCountV1("twin_forecast_run_v1"), forecastBefore);
    pass("24 Residual, 15-of-16 objective, Candidate 0.034000 and one paired Shadow committed without consumption");

    const second = await service.execute(request);
    assert.equal(second.residual_insert_count, 0);
    assert.equal(second.candidate_append_count, 0);
    assert.equal(second.shadow_append_count, 0);
    assert.equal(second.candidate.object_id, first.candidate.object_id);
    assert.equal(second.candidate.determinism_hash, first.candidate.determinism_hash);
    assert.equal(second.shadow_evaluation.object_id, first.shadow_evaluation.object_id);
    assert.equal(second.shadow_evaluation.determinism_hash, first.shadow_evaluation.determinism_hash);
    assert.deepEqual(await s5CountsV1(), completeCounts);
    pass("completed S5 rerun performs zero canonical write");

    const badPhase = structuredClone(established.obligations);
    badPhase[16].commit_phase = "T18";
    assert.throws(() => validateCap08S5ResidualObligationsV1(badPhase), /CAP08_S5_COMMIT_PHASE_MISMATCH:17/);
    const badAuthority = {
      ...structuredClone(established.prequalification_evidence),
      subject_sha: "0000000000000000000000000000000000000000",
    } as unknown as typeof established.prequalification_evidence;
    await expectFailureV1(
      () => service.execute({ ...request, prequalification: badAuthority }),
      /CAP08_S5_V2_PREQUALIFICATION_EFFECTIVENESS_REQUIRED/,
    );
    pass("phase drift and substituted prequalification authority fail closed");

    await withMissingFactV1(
      first.ordered_residual_refs[11],
      "residual",
      () => service.execute(request),
      /CAP05_IDEMPOTENT_OBJECT_INCOMPLETE/,
    );
    await withMissingFactV1(
      first.candidate.object_id,
      "candidate",
      () => service.execute(request),
      /CAP06_IDEMPOTENT_OBJECT_INCOMPLETE/,
    );
    await withMissingFactV1(
      first.shadow_evaluation.object_id,
      "shadow",
      () => service.execute(request),
      /CAP06_IDEMPOTENT_OBJECT_INCOMPLETE/,
    );
    assert.deepEqual(await s5CountsV1(), completeCounts);
    pass("partial Residual Candidate or Shadow canonical graph fails closed");

    const semantic = {
      schema_version: "geox_mcft_cap08_s5_v2_formal_preflight_result_v1" as const,
      status: "PASS" as const,
      formal_run_id: request.formal_run_id,
      prequalification_subject_sha: request.prequalification.subject_sha,
      prequalification_artifact_id: request.prequalification.artifact_id,
      checks,
      counts: completeCounts,
      residual_count: 24,
      calibration_case_count: 16,
      objective_case_count: 15,
      diagnostic_only_case_count: 1,
      holdout_case_count: 8,
      candidate_parameter_value: "0.034000",
      candidate_ref: first.candidate.object_id,
      candidate_hash: first.candidate.determinism_hash,
      shadow_ref: first.shadow_evaluation.object_id,
      shadow_hash: first.shadow_evaluation.determinism_hash,
      residual_refs: first.ordered_residual_refs,
      residual_hashes: first.ordered_residual_hashes,
      model_activation_count: 0,
      active_runtime_config_switch_count: 0,
      state_pointer_delta: 0,
      checkpoint_pointer_delta: 0,
      candidate_declaration_present: false,
      s5_effective: false,
      s6_authorized: false,
      production_runtime_source_authorized: false,
      mcft_cap_09_authorized: false,
    };
    write(semantic);
    console.log(JSON.stringify(semantic, null, 2));
  } finally {
    await Promise.allSettled([runner.end(), admin.end()]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
