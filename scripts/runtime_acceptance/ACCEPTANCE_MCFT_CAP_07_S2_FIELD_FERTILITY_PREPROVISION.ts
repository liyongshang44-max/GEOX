// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_07_S2_FIELD_FERTILITY_PREPROVISION.ts
// Purpose: prove field-fertility compatibility is externally preprovisioned, Runtime readiness fails closed when it is absent, and historical projection DDL becomes a validated no-op under the Runtime credential.
// Boundary: isolated PostgreSQL acceptance only; the bootstrap synthesizes no fertility state, sensing fact, recommendation, operation, or action.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { createDatabasePool } from "../../apps/server/src/infra/database.js";
import {
  RUNTIME_FIELD_FERTILITY_COLUMN_CONTRACT_V1,
  RUNTIME_FIELD_FERTILITY_INDEX_V1,
  RUNTIME_FIELD_FERTILITY_RELATION_V1,
  assertRuntimeFieldFertilityCompatibilityV1,
  ensureRuntimeFieldFertilityCompatibilityV1,
} from "../../apps/server/src/infra/runtime_field_fertility_compatibility_bootstrap_v1.js";
import { refreshFieldFertilityStateV1 } from "../../apps/server/src/projections/field_fertility_state_v1.js";

const ROOT = process.cwd();
const OUTPUT = path.resolve("acceptance-output/MCFT_CAP_07_S2_FIELD_FERTILITY_PREPROVISION_RESULT.json");
const ADMIN_URL = String(process.env.GEOX_DB_PLATFORM_ADMIN_DATABASE_URL || "").trim();
const RUNTIME_URL = String(process.env.GEOX_RUNTIME_DATABASE_URL || "").trim();
const FIELD_ID = "field_s2_fertility_preprovision_001";
const assertions: Array<{ name: string; passed: boolean; details?: unknown }> = [];

function check(name: string, condition: unknown, details?: unknown): void {
  const passed = condition === true;
  assertions.push({ name, passed, details });
  assert.equal(passed, true, name);
}

async function expectFailure(name: string, operation: () => Promise<unknown>, token: string): Promise<void> {
  let observed = "";
  try {
    await operation();
  } catch (error) {
    observed = String(error instanceof Error ? error.message : error);
  }
  check(name, observed.includes(token), { observed, token });
}

function staticAudit(): void {
  const distWriter = fs.readFileSync(path.join(ROOT, "apps/server/scripts/write_dist_entries.cjs"), "utf8");
  const serverBootstrap = fs.readFileSync(path.join(ROOT, "apps/server/src/bootstrap/server.ts"), "utf8");
  check(
    "database_platform_bootstrap_wired",
    distWriter.includes("runRuntimeFieldFertilityCompatibilityBootstrapFromEnvironmentV1") &&
      distWriter.includes("await runRuntimeFieldFertilityCompatibilityBootstrapFromEnvironmentV1()"),
  );
  check(
    "runtime_readiness_preflight_wired",
    serverBootstrap.includes("assertRuntimeFieldFertilityCompatibilityV1") &&
      serverBootstrap.indexOf("assertRuntimeFieldFertilityCompatibilityV1(pool)") < serverBootstrap.indexOf("app.listen"),
  );
  check("field_fertility_column_inventory_exact", RUNTIME_FIELD_FERTILITY_COLUMN_CONTRACT_V1.length === 14);
}

async function main(): Promise<void> {
  let admin: Pool | null = null;
  let runtime: Pool | null = null;
  try {
    staticAudit();
    check("database_urls_present", Boolean(ADMIN_URL && RUNTIME_URL));
    check("database_identities_distinct", ADMIN_URL !== RUNTIME_URL);

    admin = new Pool({ connectionString: ADMIN_URL, max: 1 });
    await admin.query("DROP TABLE IF EXISTS public.field_fertility_state_v1 CASCADE");
    await ensureRuntimeFieldFertilityCompatibilityV1(admin);
    await assertRuntimeFieldFertilityCompatibilityV1(admin);

    const emptyCount = await admin.query<{ count: number }>(
      "SELECT pg_catalog.count(*)::int AS count FROM public.field_fertility_state_v1",
    );
    check("bootstrap_synthesizes_no_projection_row", Number(emptyCount.rows[0]?.count ?? -1) === 0);

    const catalog = await admin.query<{
      column_count: number;
      index_exists: boolean;
      primary_key_columns: string[];
    }>(`
      SELECT
        (SELECT pg_catalog.count(*)::int
           FROM pg_catalog.pg_attribute AS attribute
          WHERE attribute.attrelid = pg_catalog.to_regclass($1)
            AND attribute.attnum > 0
            AND NOT attribute.attisdropped) AS column_count,
        pg_catalog.to_regclass($2) IS NOT NULL AS index_exists,
        (SELECT pg_catalog.array_agg(attribute.attname::text ORDER BY key_column.ordinality)
           FROM pg_catalog.pg_constraint AS constraint_row
           CROSS JOIN LATERAL pg_catalog.unnest(constraint_row.conkey)
             WITH ORDINALITY AS key_column(attnum, ordinality)
           JOIN pg_catalog.pg_attribute AS attribute
             ON attribute.attrelid = constraint_row.conrelid
            AND attribute.attnum = key_column.attnum
          WHERE constraint_row.conrelid = pg_catalog.to_regclass($1)
            AND constraint_row.contype = 'p') AS primary_key_columns
    `, [RUNTIME_FIELD_FERTILITY_RELATION_V1, RUNTIME_FIELD_FERTILITY_INDEX_V1]);
    check("field_fertility_14_columns_present", Number(catalog.rows[0]?.column_count ?? 0) === 14, catalog.rows[0]);
    check("field_fertility_scope_index_present", catalog.rows[0]?.index_exists === true, catalog.rows[0]);
    check("field_fertility_primary_key_exact", catalog.rows[0]?.primary_key_columns?.join(",") === "tenant_id,field_id", catalog.rows[0]);

    await admin.query(
      `DELETE FROM public.derived_sensing_state_index_v1
        WHERE tenant_id='tenantA' AND field_id=$1`,
      [FIELD_ID],
    );
    await admin.query(
      `INSERT INTO public.derived_sensing_state_index_v1 (
         tenant_id, project_id, group_id, field_id, state_type, payload_json, confidence,
         explanation_codes_json, source_observation_ids_json, source_device_ids_json,
         computed_at, computed_at_ts_ms, fact_id
       ) VALUES (
         'tenantA','projectA','groupA',$1,'fertility_state',
         '{"fertility_level":"MEDIUM","salinity_risk":"LOW","recommendation_bias":"NEUTRAL","source_observed_at_ts_ms":1784563200000}'::jsonb,
         0.75,'["s2_fertility_exact"]'::jsonb,'["obs_s2_fertility_001"]'::jsonb,
         '["dev_s2_fertility_001"]'::jsonb,'2026-07-20T16:00:00.000Z',1784563200000,
         'fact_s2_fertility_preprovision_001'
       )`,
      [FIELD_ID],
    );

    runtime = createDatabasePool(RUNTIME_URL);
    await assertRuntimeFieldFertilityCompatibilityV1(runtime);
    const privilege = await runtime.query<{ can_create: boolean }>(
      "SELECT pg_catalog.has_schema_privilege(current_user,'public','CREATE') AS can_create",
    );
    check("runtime_schema_create_forbidden", privilege.rows[0]?.can_create === false);

    const state = await refreshFieldFertilityStateV1(runtime, {
      tenant_id: "tenantA",
      project_id: "projectA",
      group_id: "groupA",
      field_id: FIELD_ID,
      now_ms: 1784563201000,
    });
    check("runtime_projection_reads_preprovisioned_relation", state.field_id === FIELD_ID, state);
    check("fertility_state_exact", state.fertility_level === "MEDIUM" && state.salinity_risk === "LOW", state);
    check("fertility_provenance_exact", state.source_observation_ids_json.includes("obs_s2_fertility_001"), state);
    check("fertility_projection_row_persisted", Number((await runtime.query(
      "SELECT pg_catalog.count(*)::int AS count FROM public.field_fertility_state_v1 WHERE tenant_id='tenantA' AND field_id=$1",
      [FIELD_ID],
    )).rows[0]?.count ?? 0) === 1);

    await admin.query("DROP TABLE public.field_fertility_state_v1 CASCADE");
    await expectFailure(
      "runtime_readiness_fails_when_field_fertility_missing",
      () => assertRuntimeFieldFertilityCompatibilityV1(runtime as Pool),
      "RUNTIME_FIELD_FERTILITY_COMPATIBILITY_NOT_ESTABLISHED:RELATION",
    );
    await ensureRuntimeFieldFertilityCompatibilityV1(admin);
    await assertRuntimeFieldFertilityCompatibilityV1(runtime);
    check("runtime_readiness_recovers_after_external_bootstrap", true);

    const result = {
      status: "PASS",
      acceptance: "MCFT_CAP_07_S2_FIELD_FERTILITY_PREPROVISION",
      assertion_count: assertions.length,
      failed_assertion_count: assertions.filter((item) => !item.passed).length,
      relation: RUNTIME_FIELD_FERTILITY_RELATION_V1,
      index: RUNTIME_FIELD_FERTILITY_INDEX_V1,
      required_column_count: RUNTIME_FIELD_FERTILITY_COLUMN_CONTRACT_V1.length,
      runtime_ddl_performed: false,
      bootstrap_projection_row_synthesized: false,
      canonical_write_authority_delta: "ZERO",
      assertions,
    };
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    fs.writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const result = {
      status: "FAIL",
      acceptance: "MCFT_CAP_07_S2_FIELD_FERTILITY_PREPROVISION",
      error: String(error instanceof Error ? error.stack || error.message : error),
      assertions,
    };
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    fs.writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = 1;
  } finally {
    if (runtime) await runtime.end().catch(() => undefined);
    if (admin) await admin.end().catch(() => undefined);
  }
}

void main();
