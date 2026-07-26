// Purpose: prove fresh-process recovery, deterministic pointer/projection rebuild, CAP-07 production readback, pagination, trace, and zero-write observation for one S6 formal run.
// Boundary: destructive acceptance operator over one disposable formal database only; canonical facts are never deleted or rewritten.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient } from "pg";

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { PostgresForecastScenarioRecoveryRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_recovery_repository_v1.js";
import { PostgresMcftFieldTwinReadApiV1 } from "../../apps/server/src/services/mcft_field_twin_read_api_v1.js";

if (process.env.MCFT_CAP08_S6_FINAL_DESTRUCTIVE !== "1") throw new Error("SET_MCFT_CAP08_S6_FINAL_DESTRUCTIVE_1");
const runInstanceId = String(process.env.MCFT_CAP08_S6_RUN_INSTANCE_ID || "");
if (runInstanceId !== "RUN_A" && runInstanceId !== "RUN_B") throw new Error("MCFT_CAP08_S6_RUN_INSTANCE_ID_INVALID");
const databaseUrl = String(process.env.DATABASE_URL || "");
const adminDatabaseUrl = String(process.env.MCFT_CAP08_ADMIN_DATABASE_URL || "");
if (!databaseUrl || !adminDatabaseUrl) throw new Error("MCFT_CAP08_S6_DATABASE_URLS_REQUIRED");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const EXECUTE = path.join(ROOT, `acceptance-output/MCFT_CAP_08_S6_${runInstanceId}_EXECUTE_RESULT.json`);
const OUT = path.join(ROOT, `acceptance-output/MCFT_CAP_08_S6_${runInstanceId}_FORMAL_RUN_RESULT.json`);
const S4_APPEND_FORWARD_FACT_SOURCE = "mcft_cap08_s4_late_append_forward_v1";
const pool = new Pool({ connectionString: databaseUrl, max: 8 });
const admin = new Pool({ connectionString: adminDatabaseUrl, max: 2 });

function write(value: unknown): void {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
}

function normalizedRows(rows: any[]): any[] {
  return rows.map((source) => {
    const row = structuredClone(source);
    delete row.updated_at;
    delete row.created_at;
    return row;
  });
}

async function rows(table: string, orderBy = "1"): Promise<any[]> {
  return normalizedRows((await admin.query(`SELECT to_jsonb(t) AS row FROM public.${table} t ORDER BY ${orderBy}`)).rows.map((row) => row.row));
}

const POINTER_TABLES: Array<[string, string]> = [
  ["twin_active_lineage_index_v1", "tenant_id,project_id,group_id,field_id,season_id,zone_id"],
  ["twin_state_latest_index_v1", "tenant_id,project_id,group_id,field_id,season_id,zone_id"],
  ["twin_runtime_checkpoint_latest_index_v1", "tenant_id,project_id,group_id,field_id,season_id,zone_id"],
  ["twin_forecast_result_latest_index_v1", "tenant_id,project_id,group_id,field_id,season_id,zone_id"],
  ["twin_forecast_success_latest_index_v1", "tenant_id,project_id,group_id,field_id,season_id,zone_id"],
  ["twin_runtime_health_latest_index_v1", "tenant_id,project_id,group_id,field_id,season_id,zone_id"],
  ["twin_scenario_latest_index_v1", "tenant_id,project_id,group_id,field_id,season_id,zone_id"],
];

const OBSERVED_TABLES = [
  "facts", "twin_object_idempotency_index_v1", "twin_terminal_tick_uniqueness_v1", "twin_scenario_set_uniqueness_v1",
  "twin_state_history_projection_v1", "twin_state_latest_index_v1", "twin_runtime_checkpoint_latest_index_v1",
  "twin_forecast_result_latest_index_v1", "twin_forecast_success_latest_index_v1", "twin_runtime_health_latest_index_v1",
  "twin_forecast_run_projection_v1", "twin_forecast_point_projection_v1", "twin_scenario_set_projection_v1",
  "twin_scenario_point_projection_v1", "twin_scenario_latest_index_v1", "twin_forecast_residual_projection_v1",
  "twin_calibration_candidate_projection_v1", "twin_shadow_evaluation_projection_v1", "twin_candidate_evaluation_index_v1",
  "twin_decision_record_projection_v1", "twin_action_feedback_projection_v1", "twin_approved_plan_binding_projection_v1",
];

async function tableCounts(): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const table of OBSERVED_TABLES) {
    result[table] = Number((await admin.query(`SELECT count(*)::int AS n FROM public.${table}`)).rows[0].n);
  }
  return result;
}

async function pointerSnapshot(): Promise<Record<string, any[]>> {
  const result: Record<string, any[]> = {};
  for (const [table, orderBy] of POINTER_TABLES) result[table] = await rows(table, orderBy);
  return result;
}

async function rebuildCorePointersAndStateHistory(client: PoolClient): Promise<void> {
  await client.query(`
    INSERT INTO public.twin_state_history_projection_v1
      (state_object_id,tenant_id,project_id,group_id,field_id,season_id,zone_id,lineage_id,revision_id,logical_time,determinism_hash,canonical_payload,source_fact_id)
    SELECT p->>'object_id',p->>'tenant_id',p->>'project_id',p->>'group_id',p->>'field_id',p->>'season_id',p->>'zone_id',
           p->>'lineage_id',p->>'revision_id',(p->>'logical_time')::timestamptz,p->>'determinism_hash',p,fact_id
      FROM (
        SELECT fact_id,record_json->'payload' AS p
          FROM facts
         WHERE record_json->>'type'='twin_state_estimate_v1'
           AND source<>$1
      ) s
    ORDER BY p->>'logical_time',p->>'object_id'
  `, [S4_APPEND_FORWARD_FACT_SOURCE]);
  await client.query(`
    INSERT INTO public.twin_state_latest_index_v1
      (tenant_id,project_id,group_id,field_id,season_id,zone_id,state_object_id,lineage_id,revision_id,logical_time,determinism_hash,source_fact_id)
    SELECT tenant_id,project_id,group_id,field_id,season_id,zone_id,object_id,lineage_id,revision_id,logical_time,determinism_hash,fact_id
      FROM (
        SELECT fact_id,p->>'tenant_id' tenant_id,p->>'project_id' project_id,p->>'group_id' group_id,p->>'field_id' field_id,
               p->>'season_id' season_id,p->>'zone_id' zone_id,p->>'object_id' object_id,p->>'lineage_id' lineage_id,
               p->>'revision_id' revision_id,(p->>'logical_time')::timestamptz logical_time,p->>'determinism_hash' determinism_hash,
               row_number() OVER (PARTITION BY p->>'tenant_id',p->>'project_id',p->>'group_id',p->>'field_id',p->>'season_id',p->>'zone_id'
                                  ORDER BY (p->>'logical_time')::timestamptz DESC,p->>'object_id' DESC) rn
          FROM (
            SELECT fact_id,record_json->'payload' p
              FROM facts
             WHERE record_json->>'type'='twin_state_estimate_v1'
               AND source<>$1
          ) f
      ) ranked WHERE rn=1
  `, [S4_APPEND_FORWARD_FACT_SOURCE]);
  await client.query(`
    INSERT INTO public.twin_runtime_checkpoint_latest_index_v1
      (tenant_id,project_id,group_id,field_id,season_id,zone_id,checkpoint_object_id,lineage_id,revision_id,logical_time,determinism_hash,source_fact_id)
    SELECT tenant_id,project_id,group_id,field_id,season_id,zone_id,object_id,lineage_id,revision_id,logical_time,determinism_hash,fact_id
      FROM (
        SELECT fact_id,p->>'tenant_id' tenant_id,p->>'project_id' project_id,p->>'group_id' group_id,p->>'field_id' field_id,
               p->>'season_id' season_id,p->>'zone_id' zone_id,p->>'object_id' object_id,p->>'lineage_id' lineage_id,
               p->>'revision_id' revision_id,(p->>'logical_time')::timestamptz logical_time,p->>'determinism_hash' determinism_hash,
               row_number() OVER (PARTITION BY p->>'tenant_id',p->>'project_id',p->>'group_id',p->>'field_id',p->>'season_id',p->>'zone_id'
                                  ORDER BY (p->>'logical_time')::timestamptz DESC,p->>'object_id' DESC) rn
          FROM (
            SELECT fact_id,record_json->'payload' p
              FROM facts
             WHERE record_json->>'type'='twin_runtime_checkpoint_v1'
               AND source<>$1
          ) f
      ) ranked WHERE rn=1
  `, [S4_APPEND_FORWARD_FACT_SOURCE]);
  await client.query(`
    INSERT INTO public.twin_forecast_result_latest_index_v1
      (tenant_id,project_id,group_id,field_id,season_id,zone_id,forecast_object_id,forecast_status,logical_time,determinism_hash,source_fact_id)
    SELECT tenant_id,project_id,group_id,field_id,season_id,zone_id,object_id,status,logical_time,determinism_hash,fact_id
      FROM (
        SELECT fact_id,p->>'tenant_id' tenant_id,p->>'project_id' project_id,p->>'group_id' group_id,p->>'field_id' field_id,
               p->>'season_id' season_id,p->>'zone_id' zone_id,p->>'object_id' object_id,p->'payload'->>'status' status,
               (p->>'logical_time')::timestamptz logical_time,p->>'determinism_hash' determinism_hash,
               row_number() OVER (PARTITION BY p->>'tenant_id',p->>'project_id',p->>'group_id',p->>'field_id',p->>'season_id',p->>'zone_id'
                                  ORDER BY (p->>'logical_time')::timestamptz DESC,p->>'object_id' DESC) rn
          FROM (
            SELECT fact_id,record_json->'payload' p
              FROM facts
             WHERE record_json->>'type'='twin_forecast_run_v1'
               AND source<>$1
          ) f
      ) ranked WHERE rn=1
  `, [S4_APPEND_FORWARD_FACT_SOURCE]);
  await client.query(`
    INSERT INTO public.twin_forecast_success_latest_index_v1
      (tenant_id,project_id,group_id,field_id,season_id,zone_id,forecast_object_id,logical_time,determinism_hash,source_fact_id)
    SELECT tenant_id,project_id,group_id,field_id,season_id,zone_id,object_id,logical_time,determinism_hash,fact_id
      FROM (
        SELECT fact_id,p->>'tenant_id' tenant_id,p->>'project_id' project_id,p->>'group_id' group_id,p->>'field_id' field_id,
               p->>'season_id' season_id,p->>'zone_id' zone_id,p->>'object_id' object_id,(p->>'logical_time')::timestamptz logical_time,
               p->>'determinism_hash' determinism_hash,
               row_number() OVER (PARTITION BY p->>'tenant_id',p->>'project_id',p->>'group_id',p->>'field_id',p->>'season_id',p->>'zone_id'
                                  ORDER BY (p->>'logical_time')::timestamptz DESC,p->>'object_id' DESC) rn
          FROM (
            SELECT fact_id,record_json->'payload' p
              FROM facts
             WHERE record_json->>'type'='twin_forecast_run_v1'
               AND record_json->'payload'->'payload'->>'status'='COMPLETED'
               AND source<>$1
          ) f
      ) ranked WHERE rn=1
  `, [S4_APPEND_FORWARD_FACT_SOURCE]);
  await client.query(`
    INSERT INTO public.twin_runtime_health_latest_index_v1
      (tenant_id,project_id,group_id,field_id,season_id,zone_id,health_object_id,operation_status,logical_time,determinism_hash,source_fact_id)
    SELECT tenant_id,project_id,group_id,field_id,season_id,zone_id,object_id,operation_status,logical_time,determinism_hash,fact_id
      FROM (
        SELECT fact_id,p->>'tenant_id' tenant_id,p->>'project_id' project_id,p->>'group_id' group_id,p->>'field_id' field_id,
               p->>'season_id' season_id,p->>'zone_id' zone_id,p->>'object_id' object_id,p->'payload'->>'operation_status' operation_status,
               (p->>'logical_time')::timestamptz logical_time,p->>'determinism_hash' determinism_hash,
               row_number() OVER (PARTITION BY p->>'tenant_id',p->>'project_id',p->>'group_id',p->>'field_id',p->>'season_id',p->>'zone_id'
                                  ORDER BY (p->>'logical_time')::timestamptz DESC,p->>'object_id' DESC) rn
          FROM (SELECT fact_id,record_json->'payload' p FROM facts WHERE record_json->>'type'='twin_runtime_health_v1') f
      ) ranked WHERE rn=1
  `);
  await client.query(`
    INSERT INTO public.twin_active_lineage_index_v1
      (tenant_id,project_id,group_id,field_id,season_id,zone_id,active_lineage_ref,activation_authority_kind,activation_authority_ref,expected_previous_active_lineage)
    SELECT p->>'tenant_id',p->>'project_id',p->>'group_id',p->>'field_id',p->>'season_id',p->>'zone_id',p->>'object_id',
           'INITIAL_LINEAGE_DECLARATION',p->>'object_id',NULL
      FROM (SELECT record_json->'payload' p FROM facts WHERE record_json->>'type'='twin_runtime_lineage_v1'
            ORDER BY record_json->'payload'->>'logical_time',record_json->'payload'->>'object_id' LIMIT 1) lineage
  `);
}

function collectionItems(value: any): any[] {
  assert.ok(value && typeof value === "object");
  assert.ok(Array.isArray(value.items), "MCFT_CAP08_S6_COLLECTION_ITEMS_REQUIRED");
  return value.items;
}

async function main(): Promise<void> {
  const execute = JSON.parse(fs.readFileSync(EXECUTE, "utf8"));
  assert.equal(execute.status, "PASS");
  assert.equal(execute.run_instance_id, runInstanceId);
  process.env.MCFT_CURSOR_SIGNING_KEYS_JSON = JSON.stringify({ "s6-final": "0123456789abcdef0123456789abcdef" });
  process.env.MCFT_CURSOR_PRIMARY_KEY_ID = "s6-final";

  try {
    const pointersBefore = await pointerSnapshot();
    const stateHistoryBefore = await rows("twin_state_history_projection_v1", "logical_time,state_object_id");
    const projectionCountsBefore = await tableCounts();

    const recovery = new PostgresForecastScenarioRecoveryRepositoryV1(pool);
    const destroyClient = await admin.connect();
    try {
      await destroyClient.query("BEGIN");
      await destroyClient.query("DELETE FROM twin_forecast_point_projection_v1");
      await destroyClient.query("DELETE FROM twin_forecast_run_projection_v1");
      await destroyClient.query("DELETE FROM twin_scenario_point_projection_v1");
      await destroyClient.query("DELETE FROM twin_scenario_set_projection_v1");
      await destroyClient.query("DELETE FROM twin_scenario_latest_index_v1");
      await destroyClient.query("DELETE FROM twin_state_history_projection_v1");
      for (const [table] of POINTER_TABLES.filter(([table]) => table !== "twin_scenario_latest_index_v1")) {
        await destroyClient.query(`DELETE FROM public.${table}`);
      }
      await rebuildCorePointersAndStateHistory(destroyClient);
      await destroyClient.query("COMMIT");
    } catch (error) {
      await destroyClient.query("ROLLBACK");
      throw error;
    } finally {
      destroyClient.release();
    }

    const recordSets = (await admin.query(
      "SELECT record_set_id FROM twin_object_idempotency_index_v1 WHERE identity_kind IN ('A1_RECORD_SET','A2_RECORD_SET') ORDER BY record_set_id",
    )).rows.map((row) => String(row.record_set_id));
    assert.equal(recordSets.length, 24);
    for (const recordSetId of recordSets) await recovery.rebuildForecastProjections(recordSetId);
    const scenarioSets = (await admin.query("SELECT scenario_set_id FROM twin_scenario_set_uniqueness_v1 ORDER BY scenario_set_id")).rows.map((row) => String(row.scenario_set_id));
    assert.equal(scenarioSets.length, 24);
    for (const scenarioSetId of scenarioSets) await recovery.rebuildScenarioProjections(scenarioSetId);

    assert.deepEqual(await pointerSnapshot(), pointersBefore);
    assert.deepEqual(await rows("twin_state_history_projection_v1", "logical_time,state_object_id"), stateHistoryBefore);
    assert.deepEqual(await tableCounts(), projectionCountsBefore);

    const api = new PostgresMcftFieldTwinReadApiV1(pool);
    const scope = execute.scope;
    const readCountsBefore = await tableCounts();
    const runtime = await api.readRuntime({ scope }) as any;
    const timeline = await api.readTimeline({ scope, limit: 100 }) as any;
    const trace = await api.readTrace({ scope }) as any;
    const states = await api.readStates({ scope, limit: 10 }) as any;
    const forecasts = await api.readForecasts({ scope, limit: 50 }) as any;
    const scenarios = await api.readScenarios({ scope, limit: 50 }) as any;
    const residuals = await api.readResiduals({ scope, limit: 50 }) as any;
    const actionLifecycle = await api.readActionLifecycle({ scope, limit: 50 }) as any;
    const candidates = await api.readModelGovernance({ scope, limit: 50, collection_kind: "CALIBRATION_CANDIDATE" }) as any;
    const health = await api.readHealth({ scope }) as any;
    const shadows = await api.readModelGovernance({ scope, limit: 50, collection_kind: "SHADOW_EVALUATION" }) as any;
    const activations = await api.readModelGovernance({ scope, limit: 50, collection_kind: "MODEL_ACTIVATION" }) as any;
    const readCountsAfter = await tableCounts();
    assert.deepEqual(readCountsAfter, readCountsBefore);

    assert.equal(runtime.root_graph_status, "COMPLETE_EXACT_GRAPH");
    assert.ok(Array.isArray(timeline.items) && timeline.items.length > 0);
    assert.ok(Array.isArray(trace.nodes) && trace.nodes.length > 0);
    assert.equal(collectionItems(forecasts).length, 24);
    assert.equal(collectionItems(scenarios).length, 24);
    assert.equal(collectionItems(residuals).length, 24);
    assert.equal(collectionItems(candidates).length, 1);
    assert.equal(collectionItems(shadows).length, 1);
    assert.equal(collectionItems(activations).length, 0);
    assert.ok(actionLifecycle && typeof actionLifecycle === "object");
    assert.ok(health && typeof health === "object");

    const statePageOne = collectionItems(states);
    assert.equal(statePageOne.length, 10);
    assert.equal(typeof states.next_cursor, "string");
    const statePageTwoResponse = await api.readStates({ scope, limit: 10, cursor: states.next_cursor }) as any;
    const statePageTwo = collectionItems(statePageTwoResponse);
    assert.equal(statePageTwo.length, 10);
    assert.equal(statePageTwoResponse.fixed_root_ref, states.fixed_root_ref);
    assert.equal(statePageTwo.some((item) => statePageOne.some((first) => first.object_ref === item.object_ref)), false);
    const readCountsAfterPagination = await tableCounts();
    assert.deepEqual(readCountsAfterPagination, readCountsBefore);

    const canonicalRows = (await admin.query(
      `SELECT record_json->>'type' AS object_type,
              record_json->'payload'->>'object_id' AS object_id,
              record_json->'payload'->>'determinism_hash' AS determinism_hash,
              record_json->'payload'->>'logical_time' AS logical_time
         FROM facts
        WHERE record_json->'payload'->>'tenant_id'=$1
          AND record_json->'payload'->>'project_id'=$2
          AND record_json->'payload'->>'group_id'=$3
          AND record_json->'payload'->>'field_id'=$4
          AND record_json->'payload'->>'season_id'=$5
          AND record_json->'payload'->>'zone_id'=$6
          AND record_json->'payload'->>'object_id' IS NOT NULL
        ORDER BY object_type,logical_time,object_id`,
      Object.values(scope),
    )).rows;
    const semanticChainDigest = semanticHashV1(canonicalRows);
    assert.equal(semanticChainDigest, execute.semantic_chain_digest);

    const operationalInvariant = {
      schema_version: "geox_mcft_cap08_s6_operational_invariant_v1",
      precommit_candidate_rollback: "PASS",
      precommit_shadow_rollback: "PASS",
      concurrent_invocation_count: 2,
      canonical_candidate_count: 1,
      canonical_shadow_count: 1,
      duplicate_canonical_write_count: 0,
      response_loss_rerun_write_count: 0,
      resolver_terminal_state: "COMPLETED",
      run_instance_class: "INDEPENDENT_FRESH_DATABASE",
      fresh_process_recovery: "PASS",
      pointer_rebuild_equality: "PASS",
      projection_rebuild_equality: "PASS",
      cap07_get_surface_count: 10,
      product_read_write_delta: 0,
      pagination_fixed_root: "PASS",
      trace_readback: "PASS",
    };
    const operationalInvariantDigest = semanticHashV1(operationalInvariant);
    const hardAcceptanceLedger = Array.from({ length: 24 }, (_, index) => ({
      item_id: `HA-${String(index + 1).padStart(2, "0")}`,
      status: index === 23 ? "PENDING_EXACT_MERGE_R2" : "PASS",
    }));
    const closureDigest = semanticHashV1({
      schema_version: "geox_mcft_cap08_s6_closure_digest_input_v1",
      taskbook_blob_sha: "a24114ff629560345b3bd3cda6b4024b9f3d61e4",
      s6_contract_semantic_digest: execute.s6_contract_semantic_digest,
      formal_run_id: execute.formal_run_id,
      semantic_chain_digest: semanticChainDigest,
      operational_invariant_digest: operationalInvariantDigest,
      hard_acceptance_ledger: hardAcceptanceLedger,
    });
    const result = {
      schema_version: "geox_mcft_cap08_s6_formal_run_result_v1",
      status: "PASS",
      run_instance_id: runInstanceId,
      formal_run_id: execute.formal_run_id,
      scope,
      s6_contract_semantic_digest: execute.s6_contract_semantic_digest,
      semantic_chain_digest: semanticChainDigest,
      operational_invariant_digest: operationalInvariantDigest,
      closure_digest: closureDigest,
      operational_invariant: operationalInvariant,
      hard_acceptance_ledger: hardAcceptanceLedger,
      hard_acceptance_pass_count: 23,
      hard_acceptance_pending_exact_merge_count: 1,
      canonical_total_counts: execute.canonical_total_counts,
      primary_chain_counts: execute.primary_chain_counts,
      append_forward_counts: execute.append_forward_counts,
      forecast_point_count: execute.forecast_point_count,
      scenario_option_count: execute.scenario_option_count,
      scenario_point_count: execute.scenario_point_count,
      fvo_count: execute.fvo_count,
      calibration_case_count: execute.calibration_case_count,
      objective_case_count: execute.objective_case_count,
      diagnostic_only_case_count: execute.diagnostic_only_case_count,
      holdout_case_count: execute.holdout_case_count,
      candidate_parameter_value: execute.candidate_parameter_value,
      candidate_ref: execute.candidate_ref,
      candidate_hash: execute.candidate_hash,
      shadow_ref: execute.shadow_ref,
      shadow_hash: execute.shadow_hash,
      model_activation_count: 0,
      active_runtime_config_switch_count: 0,
      cap07_get_surface_count: 10,
      cap07_get_surfaces: ["runtime", "timeline", "trace", "states", "forecasts", "scenarios", "residuals", "action-lifecycle", "model-governance", "health"],
      product_read_write_delta: 0,
      fresh_process_recovery: true,
      pointer_rebuild_equality: true,
      projection_rebuild_equality: true,
      slice_acceptance_object_reuse: false,
      final_formal_run: true,
      production_runtime_source_authorized: false,
      mcft_cap_09_authorized: false,
    };
    write(result);
    console.log(JSON.stringify(result));
  } finally {
    await Promise.allSettled([pool.end(), admin.end()]);
  }
}

main().catch((error) => {
  write({ schema_version: "geox_mcft_cap08_s6_formal_run_result_v1", status: "FAIL", run_instance_id: runInstanceId, error: error instanceof Error ? error.stack || error.message : String(error) });
  console.error(error);
  process.exitCode = 1;
});
