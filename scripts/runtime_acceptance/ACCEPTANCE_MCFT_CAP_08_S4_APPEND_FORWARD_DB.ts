// Fresh-PostgreSQL positive, rollback, rerun, pointer-immutability and corruption proof for MCFT-CAP-08.S4 late Evidence append-forward.
// Development preflight only; formal candidate declaration, merge effectiveness, S5, production Runtime source, and MCFT-CAP-09 remain unauthorized.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Cap08S4AppendForwardServiceV1 } from "../../apps/server/src/runtime/twin_runtime/cap08_s4_append_forward_service_v1.js";
import {
  CAP08_S4_FACT_SOURCE_V1,
  CAP08_S4_IDENTITY_KIND_V1,
} from "../../apps/server/src/persistence/twin_runtime/postgres_cap08_s4_append_forward_repository_v1.js";
import { CAP08_S4_AUTHORITY_SCHEMA_VERSION_V1 } from "../../apps/server/src/domain/twin_runtime/cap08_s4_append_forward_contracts_v1.js";
import {
  CAP08_S1_CREATED_AT_V1 as CREATED_AT,
  admin,
  runner,
} from "./mcft_cap08_s2_g3_acceptance_support_v1.js";
import { establishCap08S3FormalPredecessorV1 } from "./mcft_cap08_s4_acceptance_support_v1.js";

if (process.env.MCFT_CAP08_S4_DESTRUCTIVE_ACCEPTANCE !== "1") {
  throw new Error("SET_MCFT_CAP08_S4_DESTRUCTIVE_ACCEPTANCE_1");
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_08_S4_APPEND_FORWARD_DB_RESULT.json");

function write(value: unknown): void {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
}

async function rowsV1(table: string, orderBy: string): Promise<unknown[]> {
  const result = await admin.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY ${orderBy}`);
  return result.rows.map((row) => row.row);
}

async function pointersV1(): Promise<Record<string, unknown>> {
  const order = "tenant_id,project_id,group_id,field_id,season_id,zone_id";
  return {
    state: await rowsV1("twin_state_latest_index_v1", order),
    forecast: await rowsV1("twin_forecast_result_latest_index_v1", order),
    forecast_success: await rowsV1("twin_forecast_success_latest_index_v1", order),
    checkpoint: await rowsV1("twin_runtime_checkpoint_latest_index_v1", order),
    scenario: await rowsV1("twin_scenario_latest_index_v1", order),
  };
}

async function snapshotV1(): Promise<Record<string, unknown>> {
  return {
    facts: await rowsV1("facts", "fact_id"),
    visibility: await rowsV1("twin_fact_visibility_index_v1", "visibility_epoch_id,fact_id"),
    idempotency: await rowsV1("twin_object_idempotency_index_v1", "idempotency_key"),
    authority: await rowsV1("twin_runtime_authority_snapshot_v1", "authority_kind,authority_ref"),
    state_history: await rowsV1("twin_state_history_projection_v1", "state_object_id"),
    scenario_projection: await rowsV1("twin_scenario_set_projection_v1", "scenario_set_id"),
    pointers: await pointersV1(),
    leases: await rowsV1(
      "twin_runtime_lease_v1",
      "tenant_id,project_id,group_id,field_id,season_id,zone_id",
    ),
  };
}

async function originalHistoryV1(): Promise<Array<{ object_id: string; determinism_hash: string }>> {
  const result = await admin.query(
    `SELECT record_json->'payload'->>'object_id' AS object_id,
            record_json->'payload'->>'determinism_hash' AS determinism_hash
       FROM facts
      WHERE record_json->'payload'->>'object_type' IN ('twin_state_estimate_v1','twin_forecast_run_v1')
        AND source<>$1
      ORDER BY object_id`,
    [CAP08_S4_FACT_SOURCE_V1],
  );
  return result.rows;
}

async function bindingsByIdsV1(
  bindings: readonly { object_id: string; determinism_hash: string }[],
): Promise<Array<{ object_id: string; determinism_hash: string }>> {
  const result = await admin.query(
    `SELECT record_json->'payload'->>'object_id' AS object_id,
            record_json->'payload'->>'determinism_hash' AS determinism_hash
       FROM facts
      WHERE record_json->'payload'->>'object_id'=ANY($1::text[])
      ORDER BY object_id`,
    [bindings.map((binding) => binding.object_id)],
  );
  return result.rows;
}

async function objectTypeCountV1(type: string): Promise<number> {
  return Number((await admin.query(
    `SELECT count(*)::int AS n FROM facts
      WHERE record_json->'payload'->>'object_type'=$1`,
    [type],
  )).rows[0].n);
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
    const predecessor = await establishCap08S3FormalPredecessorV1(ROOT);
    const { fixture } = predecessor;
    const service = new Cap08S4AppendForwardServiceV1(runner, fixture.formal_evidence_source);
    const input = {
      formal_run_id: fixture.formal_run_id,
      scope: fixture.scope,
      created_at: CREATED_AT,
      phase_engine_source_digest: predecessor.source_manifest.manifest_digest,
    };
    ok("fresh PostgreSQL exact S3 predecessor established");

    const pointersBefore = await pointersV1();
    const historyBefore = await originalHistoryV1();
    assert.equal(historyBefore.length, 50);
    const before = await snapshotV1();
    const faultStages = [
      "before_facts",
      "before_idempotency_guard",
      "before_authority",
      "before_final_readback",
      "before_commit",
    ];
    for (const target of faultStages) {
      let reached = false;
      await expectFailureV1(
        () => service.execute({
          ...input,
          fault_injection(stage) {
            if (stage === target) {
              reached = true;
              throw new Error(`S4_FAULT:${target}`);
            }
          },
        }),
        new RegExp(`S4_FAULT:${target}`),
      );
      assert.equal(reached, true);
      assert.deepEqual(await snapshotV1(), before);
    }
    ok("five transaction fault stages roll back facts visibility guard authority projections pointers and lease");

    const first = await service.execute(input);
    assert.equal(first.status, "COMPLETED");
    assert.equal(first.write_status, "INSERTED_ATOMIC_SET");
    assert.equal(first.write_delta, 7);
    assert.equal(first.transport_transition_count, 15);
    assert.deepEqual(first.residual_obligations, ["R-01", "R-16"]);
    assert.equal(first.residual_count, 0);
    assert.equal(first.authority.schema_version, CAP08_S4_AUTHORITY_SCHEMA_VERSION_V1);
    assert.equal(first.authority.ordinary_state_assimilation_for_fvo16, false);
    assert.equal(first.authority.historical_rewrite, false);
    assert.equal(first.authority.historical_revision_created, false);
    assert.equal(first.authority.latest_pointer_regression_authorized, false);
    assert.equal(first.t17_predecessor.previous_posterior_ref, first.corrected_set.state.object_id);
    assert.equal(first.t17_predecessor.previous_checkpoint_ref, first.corrected_set.checkpoint.object_id);
    assert.equal(first.t17_predecessor.previous_forecast_result_ref, first.corrected_set.forecast.object_id);
    assert.equal(first.t17_predecessor.previous_scenario_set_ref, first.corrected_set.scenario.object_id);
    ok("atomic corrected T16 set and exact T17 predecessor");

    assert.deepEqual(await bindingsByIdsV1(historyBefore), historyBefore);
    assert.deepEqual(await pointersV1(), pointersBefore);
    assert.equal(Number((await admin.query(
      "SELECT count(*)::int AS n FROM facts WHERE source=$1",
      [CAP08_S4_FACT_SOURCE_V1],
    )).rows[0].n), 5);
    assert.equal(Number((await admin.query(
      `SELECT count(*)::int AS n
         FROM twin_fact_visibility_index_v1 v
         JOIN facts f USING (fact_id)
        WHERE f.source=$1 AND v.visibility_anchor_kind='FACT_INSERT_TRANSACTION'`,
      [CAP08_S4_FACT_SOURCE_V1],
    )).rows[0].n), 5);
    assert.equal(Number((await admin.query(
      `SELECT count(*)::int AS n FROM twin_object_idempotency_index_v1
        WHERE identity_kind=$1 AND idempotency_key=$2`,
      [CAP08_S4_IDENTITY_KIND_V1, first.authority.idempotency_key],
    )).rows[0].n), 1);
    assert.equal(Number((await admin.query(
      "SELECT count(*)::int AS n FROM twin_runtime_authority_snapshot_v1 WHERE authority_ref=$1",
      [first.authority.authority_ref],
    )).rows[0].n), 1);
    assert.equal(Number((await admin.query(
      "SELECT count(*)::int AS n FROM twin_state_history_projection_v1 WHERE state_object_id=$1",
      [first.corrected_set.state.object_id],
    )).rows[0].n), 0);
    assert.equal(Number((await admin.query(
      "SELECT count(*)::int AS n FROM twin_scenario_set_projection_v1 WHERE scenario_set_id=$1",
      [first.corrected_set.scenario.object_id],
    )).rows[0].n), 0);
    assert.equal(await objectTypeCountV1("twin_forecast_residual_v1"), 0);
    ok("all 50 S3 State and Forecast hashes and T23 current pointers unchanged; visibility rows are atomic");

    const completed = await snapshotV1();
    const second = await service.execute(input);
    assert.equal(second.status, "ALREADY_COMPLETE");
    assert.equal(second.write_status, "EXISTING_IDEMPOTENT_SET");
    assert.equal(second.write_delta, 0);
    assert.deepEqual(second.authority, first.authority);
    assert.deepEqual(second.corrected_set, first.corrected_set);
    assert.deepEqual(second.t17_predecessor, first.t17_predecessor);
    assert.deepEqual(await snapshotV1(), completed);
    ok("completed S4 rerun exact readback with zero write including visibility metadata");

    const correctedFactId = `fact_${first.corrected_set.state.object_id}`;
    const correctedRecord = (await admin.query(
      "SELECT record_json FROM facts WHERE fact_id=$1",
      [correctedFactId],
    )).rows[0].record_json;
    const guard = (await admin.query(
      "SELECT * FROM twin_object_idempotency_index_v1 WHERE idempotency_key=$1",
      [first.authority.idempotency_key],
    )).rows[0];
    const authority = (await admin.query(
      "SELECT * FROM twin_runtime_authority_snapshot_v1 WHERE authority_ref=$1",
      [first.authority.authority_ref],
    )).rows[0];
    const historicalFactId = `fact_${first.authority.historical_hash_manifest.state_bindings[16].ref}`;
    const historicalRecord = (await admin.query(
      "SELECT record_json FROM facts WHERE fact_id=$1",
      [historicalFactId],
    )).rows[0].record_json;

    const corruptions: Array<{
      id: string;
      corrupt: () => Promise<void>;
      restore: () => Promise<void>;
      expected: RegExp;
    }> = [
      {
        id: "S4-CR01_CORRECTED_FACT_IDENTITY_MISSING",
        corrupt: async () => {
          await admin.query(
            `UPDATE facts SET record_json=jsonb_set(record_json,'{payload,object_id}',to_jsonb('corrupted_s4_state'::text))
              WHERE fact_id=$1`,
            [correctedFactId],
          );
        },
        restore: async () => {
          await admin.query("UPDATE facts SET record_json=$2::jsonb WHERE fact_id=$1", [correctedFactId, JSON.stringify(correctedRecord)]);
        },
        expected: /CAP08_S4_APPEND_FORWARD_PARTIAL_SET/,
      },
      {
        id: "S4-CR02_GUARD_MISSING",
        corrupt: async () => {
          await admin.query("DELETE FROM twin_object_idempotency_index_v1 WHERE idempotency_key=$1", [first.authority.idempotency_key]);
        },
        restore: async () => {
          await admin.query(
            `INSERT INTO twin_object_idempotency_index_v1
             (identity_kind,idempotency_key,semantic_object_id,record_set_id,determinism_hash,
              identity_basis,member_object_ids,member_determinism_hashes,created_at)
             VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9)`,
            [guard.identity_kind, guard.idempotency_key, guard.semantic_object_id, guard.record_set_id,
              guard.determinism_hash, JSON.stringify(guard.identity_basis), JSON.stringify(guard.member_object_ids),
              JSON.stringify(guard.member_determinism_hashes), guard.created_at],
          );
        },
        expected: /CAP08_S4_APPEND_FORWARD_PARTIAL_SET/,
      },
      {
        id: "S4-CR03_AUTHORITY_MISSING",
        corrupt: async () => {
          await admin.query("DELETE FROM twin_runtime_authority_snapshot_v1 WHERE authority_ref=$1", [first.authority.authority_ref]);
        },
        restore: async () => {
          await admin.query(
            `INSERT INTO twin_runtime_authority_snapshot_v1
             (authority_kind,authority_ref,determinism_hash,semantic_payload,created_at)
             VALUES ($1,$2,$3,$4::jsonb,$5)`,
            [authority.authority_kind, authority.authority_ref, authority.determinism_hash,
              JSON.stringify(authority.semantic_payload), authority.created_at],
          );
        },
        expected: /CAP08_S4_APPEND_FORWARD_PARTIAL_SET/,
      },
      {
        id: "S4-CR04_AUTHORITY_HASH_MUTATED",
        corrupt: async () => {
          await admin.query(
            "UPDATE twin_runtime_authority_snapshot_v1 SET determinism_hash=$2 WHERE authority_ref=$1",
            [first.authority.authority_ref, `sha256:${"0".repeat(64)}`],
          );
        },
        restore: async () => {
          await admin.query(
            "UPDATE twin_runtime_authority_snapshot_v1 SET determinism_hash=$2 WHERE authority_ref=$1",
            [first.authority.authority_ref, authority.determinism_hash],
          );
        },
        expected: /CAP08_S4_EXISTING_AUTHORITY_CONFLICT/,
      },
      {
        id: "S4-CR05_HISTORICAL_HASH_MUTATED",
        corrupt: async () => {
          await admin.query(
            `UPDATE facts SET record_json=jsonb_set(record_json,'{payload,determinism_hash}',to_jsonb($2::text))
              WHERE fact_id=$1`,
            [historicalFactId, `sha256:${"f".repeat(64)}`],
          );
        },
        restore: async () => {
          await admin.query("UPDATE facts SET record_json=$2::jsonb WHERE fact_id=$1", [historicalFactId, JSON.stringify(historicalRecord)]);
        },
        expected: /(CAP04_MEMBER_SEMANTIC_HASH_MISMATCH|CAP08_S4_(BASE_BINDING_HASH_MISMATCH|HISTORICAL_HASH_MUTATION_DETECTED))/,
      },
    ];

    for (const corruption of corruptions) {
      await corruption.corrupt();
      await expectFailureV1(() => service.execute(input), corruption.expected);
      await corruption.restore();
      const recovered = await service.execute(input);
      assert.equal(recovered.status, "ALREADY_COMPLETE");
      assert.deepEqual(recovered.authority, first.authority);
      assert.deepEqual(await snapshotV1(), completed);
      ok(corruption.id);
    }

    const result = {
      schema_version: "geox_mcft_cap08_s4_append_forward_db_result_v1",
      status: "PASS",
      development_preflight_proof: true,
      formal_candidate: false,
      formal_run_id: fixture.formal_run_id,
      authority_ref: first.authority.authority_ref,
      authority_hash: first.authority.determinism_hash,
      corrected_state_ref: first.corrected_set.state.object_id,
      corrected_forecast_ref: first.corrected_set.forecast.object_id,
      corrected_scenario_ref: first.corrected_set.scenario.object_id,
      corrected_tick_ref: first.corrected_set.tick.object_id,
      corrected_checkpoint_ref: first.corrected_set.checkpoint.object_id,
      t17_previous_posterior_ref: first.t17_predecessor.previous_posterior_ref,
      transport_transition_count: first.transport_transition_count,
      historical_state_hash_count: first.historical_state_hash_count,
      historical_forecast_hash_count: first.historical_forecast_hash_count,
      all_s3_state_forecast_hash_count: historyBefore.length,
      explicit_first_write_delta: first.write_delta,
      visibility_first_write_delta: 5,
      completed_rerun_write_delta: second.write_delta,
      latest_pointer_delta: 0,
      residual_count: 0,
      residual_obligations: first.residual_obligations,
      fault_stage_count: faultStages.length,
      corruption_case_count: corruptions.length,
      phase_engine_contract_digest: first.phase_engine_contract_digest,
      phase_engine_source_digest: first.phase_engine_source_digest,
      production_runtime_source_authorized: false,
      s4_effectiveness_established: false,
      s5_authorized: false,
      mcft_cap_09_authorized: false,
      checks,
    };
    write(result);
    console.log(JSON.stringify(result));
  } catch (error) {
    write({
      schema_version: "geox_mcft_cap08_s4_append_forward_db_result_v1",
      status: "FAIL",
      error: error instanceof Error ? error.message : String(error),
      checks,
    });
    throw error;
  } finally {
    await Promise.all([runner.end(), admin.end()]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
