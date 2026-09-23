#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { Pool } = require("pg");

const TARGET_DB = "geox_mcft_cap09_production_runtime_v1";
const EXPECTED_TENANT = "tenant_mcft_external";
const EXPECTED_PROJECT = "project_mcft_cap09";
const EXPECTED_GROUP = "group_public_research";
const EXPECTED_FIELD = "field_kbs_mcse_t4r1";

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`PRODUCT_RECONCILIATION_REQUIRED_ENV:${name}`);
  return value;
}

async function main() {
  assert.equal(
    String(process.env.GEOX_PRODUCT_FIELD_SCOPE_RECONCILIATION_ARM || ""),
    "true",
    "PRODUCT_RECONCILIATION_NOT_ARMED",
  );

  const pool = new Pool({
    connectionString: requiredEnv("GEOX_PRODUCT_PRODUCTION_DATABASE_URL"),
    max: 1,
  });

  try {
    const db = (await pool.query("SELECT current_database()::text AS name")).rows[0]?.name;
    assert.equal(db, TARGET_DB, "PRODUCT_RECONCILIATION_DATABASE_IDENTITY_MISMATCH");

    const columns = new Set(
      (await pool.query(`
        SELECT column_name
          FROM information_schema.columns
         WHERE table_schema='public'
           AND table_name='field_index_v1'
           AND column_name IN ('project_id','group_id')
      `)).rows.map((row) => String(row.column_name)),
    );
    assert.deepEqual([...columns].sort(), ["group_id", "project_id"]);

    const scopes = (await pool.query(`
      WITH fact_scopes AS (
        SELECT DISTINCT
               record_json->'payload'->>'tenant_id' AS tenant_id,
               record_json->'payload'->>'project_id' AS project_id,
               record_json->'payload'->>'group_id' AS group_id,
               record_json->'payload'->>'field_id' AS field_id
          FROM public.facts
         WHERE COALESCE(record_json->'payload'->>'tenant_id','') <> ''
           AND COALESCE(record_json->'payload'->>'project_id','') <> ''
           AND COALESCE(record_json->'payload'->>'group_id','') <> ''
           AND COALESCE(record_json->'payload'->>'field_id','') <> ''
      )
      SELECT tenant_id, field_id,
             count(*)::int AS scope_count,
             min(project_id) AS project_id,
             min(group_id) AS group_id
        FROM fact_scopes
       GROUP BY tenant_id, field_id
       ORDER BY tenant_id, field_id
    `)).rows;

    const target = scopes.find(
      (row) => row.tenant_id === EXPECTED_TENANT && row.field_id === EXPECTED_FIELD,
    );
    assert.ok(target, "PRODUCT_RECONCILIATION_TARGET_SCOPE_MISSING");
    assert.equal(target.scope_count, 1, "PRODUCT_RECONCILIATION_TARGET_SCOPE_AMBIGUOUS");
    assert.equal(target.project_id, EXPECTED_PROJECT, "PRODUCT_RECONCILIATION_PROJECT_MISMATCH");
    assert.equal(target.group_id, EXPECTED_GROUP, "PRODUCT_RECONCILIATION_GROUP_MISMATCH");

    const ambiguous = scopes.filter((row) => Number(row.scope_count) !== 1);
    assert.equal(ambiguous.length, 0, "PRODUCT_RECONCILIATION_AMBIGUOUS_FIELD_SCOPE_FORBIDDEN");

    await pool.query("BEGIN");
    try {
      await pool.query(`
        WITH fact_scopes AS (
          SELECT DISTINCT
                 record_json->'payload'->>'tenant_id' AS tenant_id,
                 record_json->'payload'->>'project_id' AS project_id,
                 record_json->'payload'->>'group_id' AS group_id,
                 record_json->'payload'->>'field_id' AS field_id
            FROM public.facts
           WHERE COALESCE(record_json->'payload'->>'tenant_id','') <> ''
             AND COALESCE(record_json->'payload'->>'project_id','') <> ''
             AND COALESCE(record_json->'payload'->>'group_id','') <> ''
             AND COALESCE(record_json->'payload'->>'field_id','') <> ''
        ),
        unambiguous AS (
          SELECT tenant_id,
                 field_id,
                 min(project_id) AS project_id,
                 min(group_id) AS group_id
            FROM fact_scopes
           GROUP BY tenant_id, field_id
          HAVING count(*) = 1
        )
        INSERT INTO public.field_index_v1 (
          tenant_id,
          field_id,
          project_id,
          group_id
        )
        SELECT tenant_id, field_id, project_id, group_id
          FROM unambiguous
        ON CONFLICT (tenant_id, field_id)
        DO UPDATE SET
          project_id = COALESCE(public.field_index_v1.project_id, EXCLUDED.project_id),
          group_id = COALESCE(public.field_index_v1.group_id, EXCLUDED.group_id)
      `);

      const fieldRows = (await pool.query(`
        SELECT tenant_id, field_id, project_id, group_id
          FROM public.field_index_v1
         WHERE tenant_id=$1 AND field_id=$2
         LIMIT 2
      `, [EXPECTED_TENANT, EXPECTED_FIELD])).rows;

      assert.equal(fieldRows.length, 1, "PRODUCT_RECONCILIATION_FIELD_CARDINALITY_INVALID");
      assert.equal(fieldRows[0].project_id, EXPECTED_PROJECT);
      assert.equal(fieldRows[0].group_id, EXPECTED_GROUP);

      const twinCounts = (await pool.query(`
        SELECT
          (SELECT count(*)::int FROM public.twin_active_lineage_index_v1) AS active_lineages,
          (SELECT count(*)::int FROM public.twin_state_history_projection_v1) AS states
      `)).rows[0];

      await pool.query("COMMIT");

      console.log(JSON.stringify({
        schema_version: "geox_product_api_production_field_scope_reconciliation_v1",
        status: "PASS",
        database_name: TARGET_DB,
        field_identity_materialized: true,
        tenant_id: EXPECTED_TENANT,
        project_id: EXPECTED_PROJECT,
        group_id: EXPECTED_GROUP,
        field_id: EXPECTED_FIELD,
        active_lineage_count: Number(twinCounts.active_lineages),
        twin_state_count: Number(twinCounts.states),
        twin_state_created_by_reconciliation: false,
        authority_mutation: false,
      }, null, 2));
    } catch (error) {
      await pool.query("ROLLBACK").catch(() => undefined);
      throw error;
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
