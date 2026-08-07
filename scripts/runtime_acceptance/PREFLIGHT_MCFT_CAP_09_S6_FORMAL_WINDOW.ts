// MCFT-CAP-09.S6 fail-closed preflight before formal-window enablement.
// Read-only: proves the exact Formal Root, 24 hourly Runtime Configs, clean scheduler,
// and five recent externally written governed Evidence types. It starts no slot.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool, type PoolClient, type QueryResult } from "pg";

import { validateCanonicalObjectV1, type CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { PostgresNextTickRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import { PostgresEvidenceIngressAdapterV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.js";
import type { TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";
import {
  FORMAL_EVIDENCE_TYPES_V1,
  buildFormalAuthorityBundleV1,
  sameScopeV1,
} from "./mcft_cap09_s6_formal_authority_v1.js";

const OUT = path.resolve("acceptance-output/MCFT_CAP_09_S6_FORMAL_PREFLIGHT_RESULT.json");
const FORBIDDEN = ["twin_decision_record_v1", "twin_recommendation_v1", "decision_recommendation_v1", "approval_request_v1", "ao_act_task_v1", "ao_act_receipt_v1", "dispatch_request_v1", "model_activation_v1"];

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

function parseConfigV1(value: unknown): CanonicalObjectEnvelopeV1 {
  const wrapper = value as { payload?: CanonicalObjectEnvelopeV1 };
  if (!wrapper?.payload) throw new Error("FORMAL_PREFLIGHT_RUNTIME_CONFIG_WRAPPER_INVALID");
  validateCanonicalObjectV1(wrapper.payload);
  return wrapper.payload;
}

function readOnlyBoundPoolV1(client: PoolClient): Pool {
  return {
    query: client.query.bind(client),
    connect: async () => ({
      async query(text: string, values?: unknown[]): Promise<QueryResult> {
        const command = text.trim().toUpperCase();
        if (command.startsWith("BEGIN") || command === "COMMIT" || command === "ROLLBACK") {
          return { rows: [], rowCount: 0 } as unknown as QueryResult;
        }
        return client.query(text, values);
      },
      release(): void {},
    }),
  } as unknown as Pool;
}

async function main(): Promise<void> {
  const databaseUrl = required("DATABASE_URL");
  const subjectSha = required("MCFT_CAP09_S6_SUBJECT_SHA");
  assert.match(subjectSha, /^[0-9a-f]{40}$/, "FORMAL_PREFLIGHT_EXACT_SUBJECT_SHA_REQUIRED");
  const scope = json<TwinScopeKeyV1>("MCFT_CAP09_S6_SCOPE_JSON");
  const bundle = buildFormalAuthorityBundleV1(required("MCFT_CAP09_S6_WINDOW_START_UTC"));
  assert(sameScopeV1(scope, bundle.scope), "FORMAL_PREFLIGHT_AUTHORITY_SCOPE_MISMATCH");
  const pool = new Pool({ connectionString: databaseUrl, application_name: `mcft-cap09-s6-preflight-${subjectSha.slice(0, 12)}` });
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const readPool = readOnlyBoundPoolV1(client);
      const dbNow = new Date((await client.query("SELECT transaction_timestamp() AS now")).rows[0].now).getTime();
      assert(dbNow >= Date.parse(bundle.bootstrap_logical_time), "FORMAL_PREFLIGHT_EVIDENCE_BOUNDARY_NOT_REACHED");
      assert(dbNow < Date.parse(bundle.window_start_utc), "FORMAL_PREFLIGHT_WINDOW_ALREADY_STARTED");
      const nextTick = await new PostgresNextTickRepositoryV1(readPool).readPersistedNextTickSnapshot(scope);
      assert(nextTick, "FORMAL_PREFLIGHT_PERSISTED_ROOT_REQUIRED");
      assert.equal(nextTick.checkpoint.payload.next_tick_logical_time, bundle.window_start_utc,
        "FORMAL_PREFLIGHT_NEXT_TICK_MISMATCH");
      assert.equal(nextTick.reality_binding.binding_id, bundle.reality_binding_snapshot.binding_id,
        "FORMAL_PREFLIGHT_REALITY_BINDING_REF_MISMATCH");
      assert.equal(nextTick.reality_binding.determinism_hash, bundle.reality_binding_snapshot.determinism_hash,
        "FORMAL_PREFLIGHT_REALITY_BINDING_HASH_MISMATCH");
      assert.equal(nextTick.runtime_config.object_id, bundle.bootstrap_runtime_config.object_id,
        "FORMAL_PREFLIGHT_BOOTSTRAP_CONFIG_REF_MISMATCH");
      assert.equal(nextTick.runtime_config.determinism_hash, bundle.bootstrap_runtime_config.determinism_hash,
        "FORMAL_PREFLIGHT_BOOTSTRAP_CONFIG_HASH_MISMATCH");

      const expectedIds = bundle.runtime_configs.map((config) => config.object_id);
      const configRows = await client.query(
        `SELECT record_json FROM facts
          WHERE record_json->>'type'='twin_runtime_config_v1'
            AND record_json->'payload'->>'object_id'=ANY($1::text[])`,
        [expectedIds],
      );
      assert.equal(configRows.rows.length, 24, "FORMAL_PREFLIGHT_EXACT_24_RUNTIME_CONFIGS_REQUIRED");
      const persistedById = new Map(configRows.rows.map((row) => {
        const config = parseConfigV1(row.record_json);
        return [config.object_id, config] as const;
      }));
      for (const expected of bundle.runtime_configs) {
        const persisted = persistedById.get(expected.object_id);
        assert(persisted, `FORMAL_PREFLIGHT_RUNTIME_CONFIG_MISSING:${expected.logical_time}`);
        assert.equal(persisted.determinism_hash, expected.determinism_hash,
          `FORMAL_PREFLIGHT_RUNTIME_CONFIG_HASH_MISMATCH:${expected.logical_time}`);
      }

      const scopeValues = [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
      const scheduler = await client.query(
        `SELECT count(*)::int AS n FROM twin_shadow_online_scheduler_slot_v1
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
        scopeValues,
      );
      assert.equal(Number(scheduler.rows[0].n), 0, "FORMAL_PREFLIGHT_SCHEDULER_ALREADY_STARTED");
      const forbidden = await client.query(
        "SELECT count(*)::int AS n FROM facts WHERE record_json->>'type'=ANY($1::text[])",
        [FORBIDDEN],
      );
      assert.equal(Number(forbidden.rows[0].n), 0, "FORMAL_PREFLIGHT_FORBIDDEN_ACTION_FACT_PRESENT");

      const frozen = await new PostgresEvidenceIngressAdapterV1(readPool).freezeEligibleEvidence({
        boundary: {
          scope,
          slot_id: "O00",
          logical_time: bundle.bootstrap_logical_time,
          interval_seconds: 3600,
          scheduler_wall_clock_observed_at: bundle.bootstrap_logical_time,
        },
      });
      const selectedKinds = new Set(frozen.selected.map((item) => item.evidence_kind));
      for (const kind of FORMAL_EVIDENCE_TYPES_V1) {
        assert(selectedKinds.has(kind), `FORMAL_PREFLIGHT_EVIDENCE_TYPE_MISSING:${kind}`);
      }
      assert(frozen.actual_observation_count > 0, "FORMAL_PREFLIGHT_ACTUAL_OBSERVATION_REQUIRED");
      assert.equal(frozen.future_evidence_leakage, false, "FORMAL_PREFLIGHT_FUTURE_EVIDENCE_LEAKAGE");
      const selectedRefs = frozen.selected.map((item) => item.evidence_ref);
      const provenance = await client.query(
        `SELECT source,ingested_at AS database_ingested_at,record_json->'payload' AS payload FROM facts
          WHERE record_json->'payload'->>'source_record_id'=ANY($1::text[])`,
        [selectedRefs],
      );
      assert.equal(provenance.rows.length, selectedRefs.length, "FORMAL_PREFLIGHT_EVIDENCE_PROVENANCE_CARDINALITY");
      for (const row of provenance.rows) {
        assert.equal(row.source, "mcft_cap09_formal_external_evidence_v1",
          "FORMAL_PREFLIGHT_EVIDENCE_WRITER_PROVENANCE_REQUIRED");
        assert.equal(row.payload.formal_eligible, true, "FORMAL_PREFLIGHT_EVIDENCE_FORMAL_ELIGIBILITY_REQUIRED");
        assert.equal(row.payload.is_simulated, false, "FORMAL_PREFLIGHT_SIMULATED_EVIDENCE_FORBIDDEN");
        assert.equal(row.payload.evidence_level, "FORMAL", "FORMAL_PREFLIGHT_FORMAL_EVIDENCE_LEVEL_REQUIRED");
        assert.equal(row.payload.source_lane, "FORMAL_EXTERNAL_EVIDENCE",
          "FORMAL_PREFLIGHT_EXTERNAL_EVIDENCE_LANE_REQUIRED");
        const databaseIngestedAt = new Date(row.database_ingested_at).getTime();
        const declaredIngestedAt = Date.parse(String(row.payload.role_time?.ingested_at));
        assert(Number.isFinite(declaredIngestedAt)
          && Math.abs(databaseIngestedAt - declaredIngestedAt) <= 900_000,
        "FORMAL_PREFLIGHT_EVIDENCE_DATABASE_INGRESS_TIME_MISMATCH");
      }
      await client.query("COMMIT");
      write({
        schema_version: "geox_mcft_cap09_s6_formal_preflight_result_v1",
        status: "PASS",
        subject_sha: subjectSha,
        database_clock_at: new Date(dbNow).toISOString(),
        window_start_utc: bundle.window_start_utc,
        scope,
        cap08_authority: bundle.cap08_authority,
        active_lineage_ref: nextTick.active_lineage_ref,
        checkpoint_ref: nextTick.checkpoint.object_id,
        next_tick_logical_time: nextTick.checkpoint.payload.next_tick_logical_time,
        exact_runtime_config_count: persistedById.size,
        selected_evidence_count: frozen.selected.length,
        selected_evidence_types: [...selectedKinds].sort(),
        scheduler_slot_count: 0,
        forbidden_action_fact_count: 0,
        formal_window_ready: true,
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
    schema_version: "geox_mcft_cap09_s6_formal_preflight_result_v1",
    status: "FAIL",
    error: String(error instanceof Error ? error.message : error),
    formal_window_ready: false,
    formal_window_started: false,
    formal_effectiveness: false,
  });
  process.exitCode = 1;
});
