// MCFT-CAP-09.S6 one-shot Formal Root and 24-config authority bootstrap.
// Boundary: one explicit operator invocation on a clean formal scope. The transaction
// derives authority from checked-in MCFT-00/CAP-08 artifacts and existing governed
// database Evidence only. It never creates Evidence, actions, or a scheduler loop.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool, type PoolClient, type QueryResult } from "pg";

import { PostgresNextTickRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import { PostgresRuntimeRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import { A0BootstrapRuntimeServiceV1 } from "../../apps/server/src/runtime/twin_runtime/a0_bootstrap_runtime_service_v1.js";
import { PostgresEvidenceIngressAdapterV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.js";
import { PostgresFrozenShadowOnlineEvidenceSourceV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_frozen_shadow_online_evidence_source_v1.js";
import type { TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";
import {
  FORMAL_EVIDENCE_TYPES_V1,
  buildFormalAuthorityBundleV1,
  sameScopeV1,
} from "./mcft_cap09_s6_formal_authority_v1.js";

const OUT = path.resolve("acceptance-output/MCFT_CAP_09_S6_FORMAL_BOOTSTRAP_RESULT.json");

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function json<T>(name: string): T {
  try { return JSON.parse(required(name)) as T; } catch { throw new Error(`${name}_JSON_INVALID`); }
}

function write(value: unknown): void {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
  console.log(JSON.stringify(value, null, 2));
}

function transactionBoundPoolV1(client: PoolClient): Pool {
  let savepoint = 0;
  const connect = async () => {
    const name = `mcft_cap09_s6_nested_${++savepoint}`;
    let active = false;
    return {
      async query(text: string, values?: unknown[]): Promise<QueryResult> {
        const command = text.trim().toUpperCase();
        if (command.startsWith("BEGIN")) {
          if (active) throw new Error("FORMAL_BOOTSTRAP_NESTED_TRANSACTION_REENTRY");
          active = true;
          return client.query(`SAVEPOINT ${name}`);
        }
        if (command === "COMMIT") {
          if (!active) throw new Error("FORMAL_BOOTSTRAP_NESTED_COMMIT_WITHOUT_BEGIN");
          active = false;
          return client.query(`RELEASE SAVEPOINT ${name}`);
        }
        if (command === "ROLLBACK") {
          if (active) {
            await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
            active = false;
            return client.query(`RELEASE SAVEPOINT ${name}`);
          }
          return { rows: [], rowCount: 0 } as unknown as QueryResult;
        }
        return client.query(text, values);
      },
      release(): void {
        if (active) throw new Error("FORMAL_BOOTSTRAP_NESTED_TRANSACTION_NOT_TERMINAL");
      },
    };
  };
  return {
    query: client.query.bind(client),
    connect,
  } as unknown as Pool;
}

async function assertCleanScopeV1(client: PoolClient, scope: TwinScopeKeyV1): Promise<void> {
  const values = [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
  const canonical = await client.query(
    `SELECT count(*)::int AS n FROM facts
      WHERE record_json->'payload'->>'tenant_id'=$1
        AND record_json->'payload'->>'project_id'=$2
        AND record_json->'payload'->>'group_id'=$3
        AND record_json->'payload'->>'field_id'=$4
        AND record_json->'payload'->>'season_id'=$5
        AND record_json->'payload'->>'zone_id'=$6
        AND record_json->>'type' LIKE 'twin_%'`,
    values,
  );
  assert.equal(Number(canonical.rows[0].n), 0, "FORMAL_BOOTSTRAP_CANONICAL_SCOPE_NOT_CLEAN");
  for (const table of [
    "twin_active_lineage_index_v1",
    "twin_state_latest_index_v1",
    "twin_runtime_checkpoint_latest_index_v1",
    "twin_forecast_result_latest_index_v1",
  ]) {
    const result = await client.query(
      `SELECT count(*)::int AS n FROM ${table}
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
      values,
    );
    assert.equal(Number(result.rows[0].n), 0, `FORMAL_BOOTSTRAP_POINTER_SCOPE_NOT_CLEAN:${table}`);
  }
}

async function main(): Promise<void> {
  const databaseUrl = required("DATABASE_URL");
  const subjectSha = required("MCFT_CAP09_S6_SUBJECT_SHA");
  assert.match(subjectSha, /^[0-9a-f]{40}$/, "FORMAL_BOOTSTRAP_EXACT_SUBJECT_SHA_REQUIRED");
  const configuredScope = json<TwinScopeKeyV1>("MCFT_CAP09_S6_SCOPE_JSON");
  const bundle = buildFormalAuthorityBundleV1(required("MCFT_CAP09_S6_WINDOW_START_UTC"));
  assert(sameScopeV1(configuredScope, bundle.scope), "FORMAL_BOOTSTRAP_AUTHORITY_SCOPE_MISMATCH");
  const pool = new Pool({ connectionString: databaseUrl, application_name: `mcft-cap09-s6-bootstrap-${subjectSha.slice(0, 12)}` });
  try {
    const systemNow = Date.now();
    const databaseNow = new Date((await pool.query("SELECT transaction_timestamp() AS now")).rows[0].now).getTime();
    assert(Math.abs(databaseNow - systemNow) <= 300_000,
      "FORMAL_BOOTSTRAP_SYSTEM_AND_DATABASE_CLOCK_DRIFT_EXCEEDS_300_SECONDS");
    assert(databaseNow >= Date.parse(bundle.bootstrap_logical_time),
      "FORMAL_BOOTSTRAP_EVIDENCE_BOUNDARY_NOT_REACHED");
    assert(databaseNow < Date.parse(bundle.window_start_utc), "FORMAL_BOOTSTRAP_WINDOW_ALREADY_STARTED");
    const frozen = await new PostgresEvidenceIngressAdapterV1(pool).freezeEligibleEvidence({
      boundary: {
        scope: bundle.scope,
        slot_id: "O00",
        logical_time: bundle.bootstrap_logical_time,
        interval_seconds: 3600,
        scheduler_wall_clock_observed_at: bundle.bootstrap_logical_time,
      },
    });
    const selectedKinds = new Set(frozen.selected.map((item) => item.evidence_kind));
    for (const kind of FORMAL_EVIDENCE_TYPES_V1) {
      assert(selectedKinds.has(kind), `FORMAL_BOOTSTRAP_EVIDENCE_TYPE_MISSING:${kind}`);
    }
    assert(frozen.actual_observation_count > 0, "FORMAL_BOOTSTRAP_ACTUAL_OBSERVATION_REQUIRED");
    assert.equal(frozen.future_evidence_leakage, false, "FORMAL_BOOTSTRAP_FUTURE_EVIDENCE_LEAKAGE");

    const client = await pool.connect();
    try {
      await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        `MCFT-CAP-09.S6|${Object.values(bundle.scope).join("|")}`,
      ]);
      await assertCleanScopeV1(client, bundle.scope);
      const transactionalPool = transactionBoundPoolV1(client);
      const runtime = new PostgresRuntimeRepositoryV1(transactionalPool);
      const nextTick = new PostgresNextTickRepositoryV1(transactionalPool);
      const reality = await nextTick.commitRealityBindingSnapshot(bundle.reality_binding_snapshot);
      const source = new PostgresFrozenShadowOnlineEvidenceSourceV1(transactionalPool, frozen);
      const bootstrap = await new A0BootstrapRuntimeServiceV1(runtime, runtime, source).execute({
        scope: bundle.scope,
        logical_time: bundle.bootstrap_logical_time,
        created_at: bundle.authority_created_at,
        runtime_config: bundle.bootstrap_runtime_config,
        hydraulic: bundle.hydraulic,
        soil_hydraulic_config_ref: bundle.soil_hydraulic_config_ref,
        lease_owner: `mcft-cap09-s6-bootstrap-${subjectSha.slice(0, 12)}`,
        lease_duration_seconds: 900,
      });
      const configResults = [];
      for (const config of bundle.runtime_configs) configResults.push(await runtime.commitRuntimeConfig(config));
      const readback = await nextTick.readPersistedNextTickSnapshot(bundle.scope);
      assert(readback, "FORMAL_BOOTSTRAP_PERSISTED_ROOT_REQUIRED");
      assert.equal(readback.checkpoint.payload.next_tick_logical_time, bundle.window_start_utc,
        "FORMAL_BOOTSTRAP_NEXT_TICK_MISMATCH");
      assert.equal(readback.reality_binding.binding_id, bundle.reality_binding_snapshot.binding_id,
        "FORMAL_BOOTSTRAP_REALITY_BINDING_MISMATCH");
      await client.query("COMMIT");
      write({
        schema_version: "geox_mcft_cap09_s6_formal_bootstrap_result_v1",
        status: "PASS",
        subject_sha: subjectSha,
        scope: bundle.scope,
        cap08_authority: bundle.cap08_authority,
        window_start_utc: bundle.window_start_utc,
        bootstrap_logical_time: bundle.bootstrap_logical_time,
        reality_binding_status: reality.status,
        a0_status: bootstrap.status,
        active_lineage_ref: readback.active_lineage_ref,
        checkpoint_ref: readback.checkpoint.object_id,
        posterior_state_ref: readback.previous_posterior.object_id,
        next_tick_logical_time: readback.checkpoint.payload.next_tick_logical_time,
        runtime_config_count: configResults.length,
        runtime_config_inserted_count: configResults.filter((result) => result.status === "INSERTED").length,
        bootstrap_frozen_evidence_refs: frozen.selected.map((item) => item.evidence_ref).sort(),
        synthetic_sensor_truth_created: false,
        formal_window_started: false,
        formal_effectiveness: false,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  write({
    schema_version: "geox_mcft_cap09_s6_formal_bootstrap_result_v1",
    status: "FAIL",
    error: String(error instanceof Error ? error.message : error),
    formal_window_started: false,
    formal_effectiveness: false,
  });
  process.exitCode = 1;
});
