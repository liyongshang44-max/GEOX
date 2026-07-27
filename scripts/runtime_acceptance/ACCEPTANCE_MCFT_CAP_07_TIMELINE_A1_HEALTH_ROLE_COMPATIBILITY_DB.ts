import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import { Pool } from "pg";

import { registerMcftFieldTwinReadRoutesV1 } from "../../apps/server/src/routes/v1/mcft_field_twin_read_v1.js";

if (process.env.MCFT_CAP07_TIMELINE_A1_HEALTH_RECONCILIATION_DESTRUCTIVE !== "1") {
  throw new Error("SET_MCFT_CAP07_TIMELINE_A1_HEALTH_RECONCILIATION_DESTRUCTIVE_1");
}
const DATABASE_URL = String(process.env.DATABASE_URL ?? "").trim();
const ADMIN_DATABASE_URL = String(process.env.MCFT_CAP08_ADMIN_DATABASE_URL ?? "").trim();
if (!DATABASE_URL) throw new Error("DATABASE_URL_REQUIRED");
if (!ADMIN_DATABASE_URL) throw new Error("MCFT_CAP08_ADMIN_DATABASE_URL_REQUIRED");
const databaseName = new URL(DATABASE_URL).pathname.replace(/^\//, "").toLowerCase();
if (!/^(geox_)?mcft_cap08_.*(timeline|health|a1|reconciliation|compat)/.test(databaseName)) {
  throw new Error(`CAP07_TIMELINE_A1_HEALTH_FRESH_DATABASE_REQUIRED:${databaseName}`);
}
if (new URL(ADMIN_DATABASE_URL).pathname.replace(/^\//, "").toLowerCase() !== databaseName) {
  throw new Error("CAP07_TIMELINE_A1_HEALTH_ADMIN_DATABASE_MISMATCH");
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_07_TIMELINE_A1_HEALTH_ROLE_COMPATIBILITY_DB_RESULT.json");
const runner = new Pool({ connectionString: DATABASE_URL, max: 4 });
const admin = new Pool({ connectionString: ADMIN_DATABASE_URL, max: 2 });

function write(value: unknown): void {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
}

async function tableCardinalitySnapshot(pool: Pool): Promise<Array<{ table: string; count: number }>> {
  const tables = (await pool.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
  )).rows.map((row) => row.tablename);
  const output: Array<{ table: string; count: number }> = [];
  for (const table of tables) {
    const safe = `"${table.replaceAll('"', '""')}"`;
    output.push({ table, count: Number((await pool.query(`SELECT count(*)::int AS n FROM ${safe}`)).rows[0].n) });
  }
  return output;
}

function record(value: unknown, code: string): Record<string, unknown> {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), code);
  return value as Record<string, unknown>;
}

async function main(): Promise<void> {
  process.env.MCFT_CURSOR_SIGNING_KEYS_JSON = JSON.stringify({ reconciliation: "cap07-timeline-a1-health-role-reconciliation-signing-key-0001" });
  process.env.MCFT_CURSOR_PRIMARY_KEY_ID = "reconciliation";

  const scopeResult = await admin.query(
    `SELECT tenant_id,project_id,group_id,field_id,season_id,zone_id
       FROM twin_calibration_candidate_projection_v1
      ORDER BY logical_time DESC,candidate_object_id ASC`,
  );
  assert.equal(scopeResult.rows.length, 1, `CAP07_TIMELINE_A1_HEALTH_SCOPE_CARDINALITY:${scopeResult.rows.length}`);
  const scope = Object.fromEntries(
    ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"].map((key) => [key, String(scopeResult.rows[0][key])]),
  ) as Record<string, string>;

  const a1 = await admin.query(
    `SELECT record_set_id,member_object_ids,
            member_object_ids->>'twin_runtime_health_v1' AS health_ref,
            member_object_ids->>'twin_runtime_checkpoint_v1' AS checkpoint_ref
       FROM twin_object_idempotency_index_v1
      WHERE identity_kind='A1_RECORD_SET'
        AND jsonb_typeof(member_object_ids)='object'
      ORDER BY record_set_id`,
  );
  assert.ok(a1.rows.length > 0, "CAP07_TIMELINE_A1_HEALTH_A1_RECORD_SET_REQUIRED");
  const a1RecordSetIds = new Set<string>();
  const a1HealthRefs = new Set<string>();
  for (const row of a1.rows) {
    const members = record(row.member_object_ids, "CAP07_TIMELINE_A1_HEALTH_MEMBER_OBJECT_REQUIRED");
    assert.ok(Object.keys(members).includes("twin_runtime_health_v1"), "CAP07_TIMELINE_A1_HEALTH_MEMBER_KEY_REQUIRED");
    assert.ok(Object.keys(members).includes("twin_runtime_checkpoint_v1"), "CAP07_TIMELINE_A1_CHECKPOINT_MEMBER_KEY_REQUIRED");
    const values = Object.values(members).map(String);
    assert.ok(values.includes(String(row.health_ref)), "CAP07_TIMELINE_A1_HEALTH_MEMBER_VALUE_REQUIRED");
    assert.ok(values.includes(String(row.checkpoint_ref)), "CAP07_TIMELINE_A1_CHECKPOINT_MEMBER_VALUE_REQUIRED");
    a1RecordSetIds.add(String(row.record_set_id));
    a1HealthRefs.add(String(row.health_ref));
  }
  assert.equal(
    Number((await admin.query("SELECT count(*)::int AS n FROM facts WHERE record_json->>'type'='twin_model_activation_v1'")).rows[0].n),
    0,
    "CAP07_TIMELINE_A1_HEALTH_MODEL_ACTIVATION_FORBIDDEN",
  );

  const before = await tableCardinalitySnapshot(admin);
  const app = Fastify({ logger: false });
  registerMcftFieldTwinReadRoutesV1(app, runner, {
    authorizeScope: (_request, requested) => ({
      tenant_id: requested.tenant_id,
      project_id: requested.project_id,
      group_id: requested.group_id,
      allowed_field_ids: [requested.field_id],
      principal_id: "mcft-cap07-timeline-a1-health-reconciliation",
    } as any),
  });
  await app.ready();
  const query = new URLSearchParams({
    tenant_id: scope.tenant_id,
    project_id: scope.project_id,
    group_id: scope.group_id,
    season_id: scope.season_id,
    zone_id: scope.zone_id,
  }).toString();
  const base = `/api/v1/operator/twin/fields/${encodeURIComponent(scope.field_id)}/runtime/timeline`;
  const pageLimit = 10;
  const pages: Array<{ page: number; status: number; item_count: number; content_hash: string; response_hash: string }> = [];
  const allItems: Array<Record<string, unknown>> = [];
  let cursor: string | null = null;
  try {
    for (let page = 1; page <= 100; page += 1) {
      const cursorPart = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
      const response = await app.inject({ method: "GET", url: `${base}?limit=${pageLimit}${cursorPart}&${query}` });
      assert.equal(response.statusCode, 200, `CAP07_TIMELINE_A1_HEALTH_PAGE_${page}:${response.body}`);
      assert.equal(response.headers["cache-control"], "no-store");
      const contentHash = String(response.headers["x-geox-mcft-content-hash"] ?? "");
      const responseHash = String(response.headers["x-geox-mcft-response-instance-hash"] ?? "");
      assert.ok(contentHash.startsWith("sha256:"), `CAP07_TIMELINE_A1_HEALTH_PAGE_${page}_CONTENT_HASH`);
      assert.ok(responseHash.startsWith("sha256:"), `CAP07_TIMELINE_A1_HEALTH_PAGE_${page}_RESPONSE_HASH`);
      const body = response.json() as Record<string, unknown>;
      assert.ok(Array.isArray(body.items), `CAP07_TIMELINE_A1_HEALTH_PAGE_${page}_ITEMS`);
      const items = body.items.map((item, index) => record(item, `CAP07_TIMELINE_A1_HEALTH_PAGE_${page}_ITEM_${index}`));
      allItems.push(...items);
      pages.push({ page, status: response.statusCode, item_count: items.length, content_hash: contentHash, response_hash: responseHash });
      cursor = typeof body.next_cursor === "string" && body.next_cursor ? body.next_cursor : null;
      if (!cursor) break;
      if (page === 100) throw new Error("CAP07_TIMELINE_A1_HEALTH_CURSOR_PAGE_LIMIT_EXCEEDED");
    }
  } finally {
    await app.close();
  }
  assert.ok(pages.length >= 2, `CAP07_TIMELINE_A1_HEALTH_MINIMUM_PAGE_COUNT:${pages.length}`);
  assert.equal(pages.every((page) => page.status === 200), true, "CAP07_TIMELINE_A1_HEALTH_ALL_PAGES_200");

  const a1HealthItems = allItems.filter((item) => item.event_kind === "RUNTIME_HEALTH" && a1HealthRefs.has(String(item.object_ref)));
  assert.ok(a1HealthItems.length > 0, "CAP07_TIMELINE_A1_HEALTH_EVENT_REQUIRED");
  for (const item of a1HealthItems) {
    assert.equal(item.transaction_family, "A_STATE_TICK_COMMIT", `CAP07_TIMELINE_A1_HEALTH_TRANSACTION_FAMILY:${item.object_ref}`);
    assert.equal(item.health_role, "TERMINAL_RECORD_SET_MEMBER", `CAP07_TIMELINE_A1_HEALTH_ROLE:${item.object_ref}`);
    assert.equal(item.health_resolution_basis, "EXACT_RECORD_SET_MEMBERSHIP", `CAP07_TIMELINE_A1_HEALTH_BASIS:${item.object_ref}`);
    assert.ok(a1RecordSetIds.has(String(item.atomic_group_ref)), `CAP07_TIMELINE_A1_HEALTH_ATOMIC_GROUP:${item.object_ref}`);
    assert.ok(Array.isArray(item.health_resolution_evidence_refs), `CAP07_TIMELINE_A1_HEALTH_EVIDENCE:${item.object_ref}`);
  }

  const after = await tableCardinalitySnapshot(admin);
  assert.deepEqual(after, before, "CAP07_TIMELINE_A1_HEALTH_PRODUCT_READ_WRITE_DELTA");
  const result = {
    schema_version: "geox_mcft_cap07_timeline_a1_health_role_compatibility_db_result_v1",
    status: "PASS",
    database_name: databaseName,
    scope,
    a1_record_set_count: a1.rows.length,
    a1_health_ref_count: a1HealthRefs.size,
    timeline_page_limit: pageLimit,
    timeline_page_count: pages.length,
    timeline_item_count: allItems.length,
    timeline_pages: pages,
    a1_terminal_health_event_count: a1HealthItems.length,
    a1_terminal_health_refs: a1HealthItems.map((item) => item.object_ref),
    transaction_family: "A_STATE_TICK_COMMIT",
    health_role: "TERMINAL_RECORD_SET_MEMBER",
    health_resolution_basis: "EXACT_RECORD_SET_MEMBERSHIP",
    product_read_write_delta: 0,
    model_activation_count: 0,
    runtime_write_authority_delta: 0,
    production_runtime_source_authorized: false,
    mcft_cap_08_complete: false,
    mcft_cap_09_authorized: false,
  };
  write(result);
  console.log(JSON.stringify(result));
}

main()
  .catch((error) => {
    write({ schema_version: "geox_mcft_cap07_timeline_a1_health_role_compatibility_db_result_v1", status: "FAIL", error: error instanceof Error ? error.message : String(error) });
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([runner.end(), admin.end()]);
  });
