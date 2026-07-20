// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_07_S2_SKILL_REGISTRY_PREPROVISION.ts
// Purpose: prove Skill Registry compatibility is externally preprovisioned, Runtime readiness fails closed when it is absent, and the historical projection DDL becomes a validated no-op under the Runtime credential.
// Boundary: isolated PostgreSQL acceptance only; the bootstrap synthesizes no Skill fact, binding, run, route, or projection row.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { createDatabasePool } from "../../apps/server/src/infra/database.js";
import {
  RUNTIME_SKILL_REGISTRY_READ_COLUMN_CONTRACT_V1,
  RUNTIME_SKILL_REGISTRY_READ_INDEX_V1,
  RUNTIME_SKILL_REGISTRY_READ_RELATION_V1,
  assertRuntimeSkillRegistryCompatibilityV1,
  ensureRuntimeSkillRegistryCompatibilityV1,
} from "../../apps/server/src/infra/runtime_skill_registry_compatibility_bootstrap_v1.js";
import { projectSkillRegistryReadV1 } from "../../apps/server/src/projections/skill_registry_read_v1.js";

const ROOT = process.cwd();
const OUTPUT = path.resolve("acceptance-output/MCFT_CAP_07_S2_SKILL_REGISTRY_PREPROVISION_RESULT.json");
const ADMIN_URL = String(process.env.GEOX_DB_PLATFORM_ADMIN_DATABASE_URL || "").trim();
const RUNTIME_URL = String(process.env.GEOX_RUNTIME_DATABASE_URL || "").trim();
const FACT_ID = "s2_skill_registry_preprovision_fact_001";
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
    distWriter.includes("runRuntimeSkillRegistryCompatibilityBootstrapFromEnvironmentV1") &&
      distWriter.includes("await runRuntimeSkillRegistryCompatibilityBootstrapFromEnvironmentV1()"),
  );
  check(
    "runtime_readiness_preflight_wired",
    serverBootstrap.includes("assertRuntimeSkillRegistryCompatibilityV1") &&
      serverBootstrap.indexOf("assertRuntimeSkillRegistryCompatibilityV1(pool)") < serverBootstrap.indexOf("app.listen"),
  );
  check("skill_registry_column_inventory_exact", RUNTIME_SKILL_REGISTRY_READ_COLUMN_CONTRACT_V1.length === 27);
}

async function main(): Promise<void> {
  let admin: Pool | null = null;
  let runtime: Pool | null = null;
  try {
    staticAudit();
    check("database_urls_present", Boolean(ADMIN_URL && RUNTIME_URL));
    check("database_identities_distinct", ADMIN_URL !== RUNTIME_URL);

    admin = new Pool({ connectionString: ADMIN_URL, max: 1 });
    await admin.query("DROP TABLE IF EXISTS public.skill_registry_read_v1 CASCADE");
    await ensureRuntimeSkillRegistryCompatibilityV1(admin);
    await assertRuntimeSkillRegistryCompatibilityV1(admin);

    const emptyCount = await admin.query<{ count: number }>(
      "SELECT pg_catalog.count(*)::int AS count FROM public.skill_registry_read_v1",
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
    `, [RUNTIME_SKILL_REGISTRY_READ_RELATION_V1, RUNTIME_SKILL_REGISTRY_READ_INDEX_V1]);
    check("skill_registry_27_columns_present", Number(catalog.rows[0]?.column_count ?? 0) === 27, catalog.rows[0]);
    check("skill_registry_lookup_index_present", catalog.rows[0]?.index_exists === true, catalog.rows[0]);
    check("skill_registry_primary_key_exact", catalog.rows[0]?.primary_key_columns?.join(",") === "fact_id", catalog.rows[0]);

    await admin.query(
      `INSERT INTO public.facts (fact_id, occurred_at, source, record_json)
       VALUES ($1, '2026-07-20T12:00:00.000Z', 'mcft-cap07-s2-skill-registry-acceptance', $2::jsonb)`,
      [
        FACT_ID,
        JSON.stringify({
          type: "skill_binding_v1",
          payload: {
            tenant_id: "tenantA",
            project_id: "projectA",
            group_id: "groupA",
            skill_id: "skill_s2_registry_exact",
            version: "1.0.0",
            category: "agronomy",
            status: "ACTIVE",
            scope_type: "FIELD",
            rollout_mode: "CONTROLLED",
            crop_code: "corn",
            device_type: "IRRIGATION_CONTROLLER",
            trigger_stage: "after_recommendation",
            bind_target: "field_c8_demo",
            field_id: "field_c8_demo",
            lifecycle_version: 1,
          },
        }),
      ],
    );

    runtime = createDatabasePool(RUNTIME_URL);
    await assertRuntimeSkillRegistryCompatibilityV1(runtime);
    const privilege = await runtime.query<{ can_create: boolean }>(
      "SELECT pg_catalog.has_schema_privilege(current_user,'public','CREATE') AS can_create",
    );
    check("runtime_schema_create_forbidden", privilege.rows[0]?.can_create === false);

    const projected = await projectSkillRegistryReadV1(runtime, {
      tenant_id: "tenantA",
      project_id: "projectA",
      group_id: "groupA",
    });
    const exact = projected.find((row) => row.fact_id === FACT_ID);
    check("runtime_projection_reads_preprovisioned_relation", exact?.skill_id === "skill_s2_registry_exact", exact);
    check("runtime_projection_preserves_legacy_category", exact?.legacy_category === "agronomy", exact);
    check("runtime_projection_normalizes_public_category", exact?.category === "agronomy", exact);

    await admin.query("DROP TABLE public.skill_registry_read_v1 CASCADE");
    await expectFailure(
      "runtime_readiness_fails_when_skill_registry_missing",
      () => assertRuntimeSkillRegistryCompatibilityV1(runtime as Pool),
      "RUNTIME_SKILL_REGISTRY_COMPATIBILITY_NOT_ESTABLISHED:RELATION",
    );
    await ensureRuntimeSkillRegistryCompatibilityV1(admin);
    await assertRuntimeSkillRegistryCompatibilityV1(runtime);
    check("runtime_readiness_recovers_after_external_bootstrap", true);

    const result = {
      status: "PASS",
      acceptance: "MCFT_CAP_07_S2_SKILL_REGISTRY_PREPROVISION",
      assertion_count: assertions.length,
      failed_assertion_count: assertions.filter((item) => !item.passed).length,
      relation: RUNTIME_SKILL_REGISTRY_READ_RELATION_V1,
      index: RUNTIME_SKILL_REGISTRY_READ_INDEX_V1,
      required_column_count: RUNTIME_SKILL_REGISTRY_READ_COLUMN_CONTRACT_V1.length,
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
      acceptance: "MCFT_CAP_07_S2_SKILL_REGISTRY_PREPROVISION",
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
