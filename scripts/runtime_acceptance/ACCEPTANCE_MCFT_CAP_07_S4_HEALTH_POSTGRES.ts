// Purpose: prove all five frozen Runtime Health relationships through the registered S4 production PostgreSQL adapter.
// Boundary: consumes the isolated fixture created by ACCEPTANCE_MCFT_CAP_07_S4_POSTGRES_ADAPTER; no production database or write authority.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import type { FieldTwinScopeV1 } from "../../apps/server/src/domain/field_twin_read_model/index.js";
import { PostgresMcftFieldTwinS4ReadApiV1 } from "../../apps/server/src/services/mcft_field_twin_s4_read_api_v1.js";

const DB = String(process.env.MCFT_S4_POSTGRES_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/postgres");
const OUT = path.resolve("acceptance-output/MCFT_CAP_07_S4_HEALTH_POSTGRES_RESULT.json");
const scope: FieldTwinScopeV1 = {
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "fieldA",
  season_id: "seasonA",
  zone_id: "zoneA",
};
const scopeValues = [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
const checks: Array<{ name: string; status: "PASS" }> = [];
const check = (name: string, fn: () => void): void => { fn(); checks.push({ name, status: "PASS" }); };

async function objectHash(pool: Pool, factId: string): Promise<string> {
  const result = await pool.query<{ hash: string }>(
    "SELECT record_json->'payload'->>'determinism_hash' AS hash FROM public.facts WHERE fact_id=$1",
    [factId],
  );
  const hash = result.rows[0]?.hash;
  assert.match(hash ?? "", /^sha256:/);
  return hash;
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: DB, max: 4 });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.twin_runtime_health_latest_index_v1(
        tenant_id text,
        project_id text,
        group_id text,
        field_id text,
        season_id text,
        zone_id text,
        health_object_id text,
        determinism_hash text
      )
    `);
    await pool.query("DELETE FROM public.twin_active_lineage_index_v1");
    await pool.query("DELETE FROM public.twin_runtime_checkpoint_latest_index_v1");
    await pool.query("DELETE FROM public.twin_runtime_health_latest_index_v1");

    const healthAHash = await objectHash(pool, "fact-health-a");
    const healthFHash = await objectHash(pool, "fact-health-f");
    const checkpointHash = await objectHash(pool, "fact-checkpoint-a");
    const api = new PostgresMcftFieldTwinS4ReadApiV1(pool);

    const bothAbsent = await api.readHealth({ scope }) as any;
    check("BOTH_ABSENT_REACHABLE_WITHOUT_ROOT_OR_OPERATIONAL_POINTER", () => {
      assert.equal(bothAbsent.health_relationship, "BOTH_ABSENT");
      assert.equal(bothAbsent.terminal_record_set_health, null);
      assert.equal(bothAbsent.latest_operational_runtime_health, null);
    });

    await pool.query(
      "INSERT INTO public.twin_runtime_health_latest_index_v1 VALUES($1,$2,$3,$4,$5,$6,'health-f',$7)",
      [...scopeValues, healthFHash],
    );
    const operationalOnly = await api.readHealth({ scope }) as any;
    check("OPERATIONAL_ONLY_REACHABLE_WITHOUT_CURRENT_ROOT", () => {
      assert.equal(operationalOnly.health_relationship, "OPERATIONAL_ONLY");
      assert.equal(operationalOnly.terminal_record_set_health, null);
      assert.equal(operationalOnly.latest_operational_runtime_health.object_ref, "health-f");
      assert.equal(operationalOnly.operational_role_resolution.transaction_family, "F_OPERATIONAL_ATTEMPT_HEALTH");
    });

    await pool.query(
      "UPDATE public.twin_runtime_health_latest_index_v1 SET health_object_id='missing-health', determinism_hash='sha256:missing'",
    );
    let brokenPointer = "";
    try { await api.readHealth({ scope }); } catch (error) { brokenPointer = String((error as Error).message); }
    check("ESTABLISHED_OPERATIONAL_POINTER_WITH_MISSING_TARGET_FAILS_CLOSED", () => {
      assert.match(brokenPointer, /MCFT_OPERATIONAL_POINTER_TARGET_MISSING/);
    });
    await pool.query("DELETE FROM public.twin_runtime_health_latest_index_v1");

    await pool.query(
      "INSERT INTO public.twin_active_lineage_index_v1 VALUES($1,$2,$3,$4,$5,$6,'lineage-object-a','lineage-object-a')",
      scopeValues,
    );
    await pool.query(
      "INSERT INTO public.twin_runtime_checkpoint_latest_index_v1 VALUES($1,$2,$3,$4,$5,$6,'checkpoint-a',$7,'lineage-a')",
      [...scopeValues, checkpointHash],
    );
    const terminalOnly = await api.readHealth({ scope }) as any;
    check("TERMINAL_ONLY_REACHABLE_WITHOUT_OPERATIONAL_POINTER", () => {
      assert.equal(terminalOnly.health_relationship, "TERMINAL_ONLY");
      assert.equal(terminalOnly.terminal_record_set_health.object_ref, "health-a");
      assert.equal(terminalOnly.latest_operational_runtime_health, null);
    });

    await pool.query(
      "INSERT INTO public.twin_runtime_health_latest_index_v1 VALUES($1,$2,$3,$4,$5,$6,'health-a',$7)",
      [...scopeValues, healthAHash],
    );
    const same = await api.readHealth({ scope }) as any;
    check("SAME_OBJECT_REACHABLE_WITH_SHARED_AUTHORITY", () => {
      assert.equal(same.health_relationship, "SAME_OBJECT");
      assert.equal(same.terminal_record_set_health.object_ref, "health-a");
      assert.equal(same.latest_operational_runtime_health.object_ref, "health-a");
    });

    await pool.query(
      "UPDATE public.twin_runtime_health_latest_index_v1 SET health_object_id='health-f', determinism_hash=$1",
      [healthFHash],
    );
    const later = await api.readHealth({ scope }) as any;
    check("LATEST_OPERATIONAL_IS_LATER_REACHABLE", () => {
      assert.equal(later.health_relationship, "LATEST_OPERATIONAL_IS_LATER");
      assert.equal(later.terminal_record_set_health.object_ref, "health-a");
      assert.equal(later.latest_operational_runtime_health.object_ref, "health-f");
    });

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, `${JSON.stringify({
      schema_version: "mcft_cap_07_s4_health_postgres_result_v1",
      status: "PASS",
      check_count: checks.length,
      checks,
      authority_delta: "GET_ONLY_READ_PROOF",
      canonical_write_authority_delta: "ZERO",
      migration_authority_delta: "ZERO",
    }, null, 2)}\n`, "utf8");
    console.log(`MCFT-CAP-07 S4 Health PostgreSQL: ${checks.length} PASS`);
  } catch (error) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, `${JSON.stringify({
      schema_version: "mcft_cap_07_s4_health_postgres_result_v1",
      status: "FAIL",
      check_count: checks.length,
      checks,
      error: String((error as Error)?.stack ?? error),
    }, null, 2)}\n`, "utf8");
    console.error(error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
