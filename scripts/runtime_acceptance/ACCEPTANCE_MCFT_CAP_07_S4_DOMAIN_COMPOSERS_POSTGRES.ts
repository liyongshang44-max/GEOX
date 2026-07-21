// Purpose: prove S4 production Action Lifecycle and Model Governance adapter paths execute the S3 domain composers while preserving bounded collection wire contracts.
// Boundary: isolated PostgreSQL read fixture; no product DDL/DML or write authority.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import type { FieldTwinScopeV1 } from "../../apps/server/src/domain/field_twin_read_model/index.js";
import { PostgresMcftFieldTwinReadApiV1 } from "../../apps/server/src/services/mcft_field_twin_read_api_v1.js";

const DB = String(process.env.MCFT_S4_POSTGRES_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/postgres");
const OUT = path.resolve("acceptance-output/MCFT_CAP_07_S4_DOMAIN_COMPOSERS_POSTGRES_RESULT.json");
const scope: FieldTwinScopeV1 = { tenant_id: "tenantA", project_id: "projectA", group_id: "groupA", field_id: "fieldA", season_id: "seasonA", zone_id: "zoneA" };
const checks: Array<{ name: string; status: "PASS" }> = [];
const check = (name: string, action: () => void): void => { action(); checks.push({ name, status: "PASS" }); };

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: DB, max: 2 });
  try {
    await pool.query(`
      DROP TABLE IF EXISTS public.twin_action_feedback_projection_v1 CASCADE;
      DROP TABLE IF EXISTS public.twin_calibration_candidate_projection_v1 CASCADE;
      DROP TABLE IF EXISTS public.twin_shadow_evaluation_projection_v1 CASCADE;
      CREATE TABLE public.twin_action_feedback_projection_v1(
        action_feedback_object_id text PRIMARY KEY,tenant_id text,project_id text,group_id text,field_id text,season_id text,zone_id text,
        logical_time timestamptz,determinism_hash text,canonical_payload jsonb,source_fact_id text
      );
      CREATE TABLE public.twin_calibration_candidate_projection_v1(
        candidate_object_id text PRIMARY KEY,tenant_id text,project_id text,group_id text,field_id text,season_id text,zone_id text,
        logical_time timestamptz,determinism_hash text,canonical_payload jsonb,source_fact_id text
      );
      CREATE TABLE public.twin_shadow_evaluation_projection_v1(
        evaluation_object_id text PRIMARY KEY,tenant_id text,project_id text,group_id text,field_id text,season_id text,zone_id text,
        logical_time timestamptz,determinism_hash text,canonical_payload jsonb,source_fact_id text
      );
    `);
    process.env.MCFT_CURSOR_SIGNING_KEYS_JSON = JSON.stringify({ "s4-key": "0123456789abcdef0123456789abcdef" });
    process.env.MCFT_CURSOR_PRIMARY_KEY_ID = "s4-key";
    const api = new PostgresMcftFieldTwinReadApiV1(pool);
    const action = await api.readActionLifecycle({ scope, limit: 50 }) as any;
    check("ACTION_LIFECYCLE_BOUNDED_PAGE_FROM_DOMAIN_VALIDATED_PATH", () => {
      assert.equal(action.schema_version, "field_twin_collection_page_v1");
      assert.equal(action.collection_kind, "ACTION_FEEDBACK");
      assert.deepEqual(action.items, []);
    });
    const governance = await api.readModelGovernance({ scope, collection_kind: "CALIBRATION_CANDIDATE", limit: 50 }) as any;
    check("MODEL_GOVERNANCE_SELECTED_BOUNDED_PAGE_FROM_DOMAIN_VALIDATED_PATH", () => {
      assert.equal(governance.schema_version, "field_twin_collection_page_v1");
      assert.equal(governance.collection_kind, "CALIBRATION_CANDIDATE");
      assert.deepEqual(governance.items, []);
    });
    const source = fs.readFileSync("apps/server/src/services/mcft_field_twin_read_api_v1.ts", "utf8");
    check("ACTION_LIFECYCLE_COMPOSER_EXECUTED_IN_PRODUCT_ADAPTER", () => assert.match(source, /actionComposer\.compose\(/));
    check("MODEL_GOVERNANCE_COMPOSER_EXECUTED_IN_PRODUCT_ADAPTER", () => assert.match(source, /governanceComposer\.compose\(/));
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify({ schema_version: "mcft_cap_07_s4_domain_composers_postgres_result_v1", status: "PASS", check_count: checks.length, checks }, null, 2) + "\n");
    console.log(`MCFT-CAP-07 S4 domain composers PostgreSQL: ${checks.length} PASS`);
  } catch (error) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify({ schema_version: "mcft_cap_07_s4_domain_composers_postgres_result_v1", status: "FAIL", check_count: checks.length, checks, error: String((error as Error)?.stack ?? error) }, null, 2) + "\n");
    console.error(error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
void main();
