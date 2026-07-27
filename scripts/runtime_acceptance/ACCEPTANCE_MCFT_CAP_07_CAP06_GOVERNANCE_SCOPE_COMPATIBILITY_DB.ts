import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import { Pool } from "pg";

import { registerMcftFieldTwinReadRoutesV1 } from "../../apps/server/src/routes/v1/mcft_field_twin_read_v1.js";
import { PostgresMcftFieldTwinReadApiV1 } from "../../apps/server/src/services/mcft_field_twin_read_api_v1.js";

if (process.env.MCFT_CAP07_CAP06_SCOPE_RECONCILIATION_DESTRUCTIVE !== "1") {
  throw new Error("SET_MCFT_CAP07_CAP06_SCOPE_RECONCILIATION_DESTRUCTIVE_1");
}
const DATABASE_URL = String(process.env.DATABASE_URL ?? "").trim();
const ADMIN_DATABASE_URL = String(process.env.MCFT_CAP08_ADMIN_DATABASE_URL ?? "").trim();
if (!DATABASE_URL) throw new Error("DATABASE_URL_REQUIRED");
if (!ADMIN_DATABASE_URL) throw new Error("MCFT_CAP08_ADMIN_DATABASE_URL_REQUIRED");
const databaseName = new URL(DATABASE_URL).pathname.replace(/^\//, "").toLowerCase();
if (!/^(geox_)?mcft_cap08_.*(scope|reconciliation|compat)/.test(databaseName)) {
  throw new Error(`CAP07_CAP06_SCOPE_RECONCILIATION_FRESH_DATABASE_REQUIRED:${databaseName}`);
}
if (new URL(ADMIN_DATABASE_URL).pathname.replace(/^\//, "").toLowerCase() !== databaseName) {
  throw new Error("CAP07_CAP06_SCOPE_RECONCILIATION_ADMIN_DATABASE_MISMATCH");
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_07_CAP06_GOVERNANCE_SCOPE_COMPATIBILITY_DB_RESULT.json");
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

function exactScope(value: Record<string, unknown>, code: string): Record<string, string> {
  const scope: Record<string, string> = {};
  for (const key of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"]) {
    const item = value[key];
    assert.equal(typeof item, "string", `${code}:${key}:TYPE`);
    assert.ok(String(item).length > 0, `${code}:${key}:EMPTY`);
    scope[key] = String(item);
  }
  return scope;
}

async function readGovernanceBinding(table: string, objectColumn: string): Promise<{
  projection: Record<string, unknown>;
  fact_id: string;
  envelope: Record<string, unknown>;
  object: Record<string, unknown>;
  scope: Record<string, string>;
}> {
  const safeTable = `"${table.replaceAll('"', '""')}"`;
  const safeColumn = `"${objectColumn.replaceAll('"', '""')}"`;
  const result = await admin.query(
    `SELECT to_jsonb(p) AS projection,p.source_fact_id,f.record_json
       FROM ${safeTable} AS p
       JOIN facts AS f ON f.fact_id=p.source_fact_id
      ORDER BY p.logical_time DESC,p.${safeColumn} ASC`,
  );
  assert.equal(result.rows.length, 1, `CAP07_CAP06_BINDING_CARDINALITY:${table}:${result.rows.length}`);
  const projection = result.rows[0].projection as Record<string, unknown>;
  const envelope = result.rows[0].record_json as Record<string, unknown>;
  const object = envelope.payload as Record<string, unknown>;
  const nested = object.scope as Record<string, unknown>;
  assert.ok(nested && typeof nested === "object" && !Array.isArray(nested), `CAP07_CAP06_NESTED_SCOPE_REQUIRED:${table}`);
  const scope = exactScope(nested, `CAP07_CAP06_NESTED_SCOPE:${table}`);
  for (const key of Object.keys(scope)) {
    assert.equal(object[key] ?? null, null, `CAP07_CAP06_TOP_LEVEL_SCOPE_MUST_REMAIN_ABSENT:${table}:${key}`);
    assert.equal(String(projection[key]), scope[key], `CAP07_CAP06_PROJECTION_SCOPE_BINDING:${table}:${key}`);
  }
  assert.equal(String(projection[objectColumn]), String(object.object_id), `CAP07_CAP06_OBJECT_ID_BINDING:${table}`);
  assert.equal(String(projection.determinism_hash), String(object.determinism_hash), `CAP07_CAP06_HASH_BINDING:${table}`);
  assert.equal(String(result.rows[0].source_fact_id), String(envelope.fact_id ?? result.rows[0].source_fact_id));
  return { projection, fact_id: String(result.rows[0].source_fact_id), envelope, object, scope };
}

function queryString(scope: Record<string, string>): string {
  return new URLSearchParams({
    tenant_id: scope.tenant_id,
    project_id: scope.project_id,
    group_id: scope.group_id,
    season_id: scope.season_id,
    zone_id: scope.zone_id,
  }).toString();
}

async function main(): Promise<void> {
  process.env.MCFT_CURSOR_SIGNING_KEYS_JSON = JSON.stringify({ reconciliation: "cap07-cap06-governance-scope-reconciliation-signing-key-0001" });
  process.env.MCFT_CURSOR_PRIMARY_KEY_ID = "reconciliation";

  const candidate = await readGovernanceBinding("twin_calibration_candidate_projection_v1", "candidate_object_id");
  const shadow = await readGovernanceBinding("twin_shadow_evaluation_projection_v1", "evaluation_object_id");
  assert.deepEqual(shadow.scope, candidate.scope, "CAP07_CAP06_CANDIDATE_SHADOW_SCOPE_DIVERGENCE");
  const scope = candidate.scope;
  assert.equal(
    Number((await admin.query("SELECT count(*)::int AS n FROM facts WHERE record_json->>'type'='twin_model_activation_v1'")).rows[0].n),
    0,
    "CAP07_CAP06_MODEL_ACTIVATION_FORBIDDEN",
  );

  const before = await tableCardinalitySnapshot(admin);
  const api = new PostgresMcftFieldTwinReadApiV1(runner);
  const candidatePage = await api.readModelGovernance({ scope: scope as any, collection_kind: "CALIBRATION_CANDIDATE", limit: 10 });
  const shadowPage = await api.readModelGovernance({ scope: scope as any, collection_kind: "SHADOW_EVALUATION", limit: 10 });
  const candidateText = JSON.stringify(candidatePage);
  const shadowText = JSON.stringify(shadowPage);
  assert.equal(candidateText.includes(String(candidate.object.object_id)), true, "CAP07_CAP06_CANDIDATE_PAGE_MISSING");
  assert.equal(shadowText.includes(String(shadow.object.object_id)), true, "CAP07_CAP06_SHADOW_PAGE_MISSING");

  const app = Fastify({ logger: false });
  registerMcftFieldTwinReadRoutesV1(app, runner, {
    authorizeScope: (_request, requested) => ({
      tenant_id: requested.tenant_id,
      project_id: requested.project_id,
      group_id: requested.group_id,
      allowed_field_ids: [requested.field_id],
      principal_id: "mcft-cap07-cap06-scope-reconciliation",
    } as any),
  });
  await app.ready();
  const base = `/api/v1/operator/twin/fields/${encodeURIComponent(scope.field_id)}/runtime`;
  const query = queryString(scope);
  const checked: Array<{ endpoint: string; status: number; content_hash: string; response_hash: string }> = [];
  try {
    for (const [name, suffix, expectedRef] of [
      ["candidate", "/model-governance?collection_kind=CALIBRATION_CANDIDATE&limit=10", String(candidate.object.object_id)],
      ["shadow", "/model-governance?collection_kind=SHADOW_EVALUATION&limit=10", String(shadow.object.object_id)],
    ] as const) {
      const response = await app.inject({ method: "GET", url: `${base}${suffix}&${query}` });
      assert.equal(response.statusCode, 200, `CAP07_CAP06_HTTP_${name.toUpperCase()}:${response.body}`);
      assert.equal(response.headers["cache-control"], "no-store");
      assert.equal(response.body.includes(expectedRef), true, `CAP07_CAP06_HTTP_${name.toUpperCase()}_REF_MISSING`);
      const contentHash = String(response.headers["x-geox-mcft-content-hash"] ?? "");
      const responseHash = String(response.headers["x-geox-mcft-response-instance-hash"] ?? "");
      assert.ok(contentHash.startsWith("sha256:"), `CAP07_CAP06_HTTP_${name.toUpperCase()}_CONTENT_HASH`);
      assert.ok(responseHash.startsWith("sha256:"), `CAP07_CAP06_HTTP_${name.toUpperCase()}_RESPONSE_HASH`);
      checked.push({ endpoint: name, status: response.statusCode, content_hash: contentHash, response_hash: responseHash });
    }
  } finally {
    await app.close();
  }

  const after = await tableCardinalitySnapshot(admin);
  assert.deepEqual(after, before, "CAP07_CAP06_PRODUCT_READ_WRITE_DELTA");
  const result = {
    schema_version: "geox_mcft_cap07_cap06_governance_scope_compatibility_db_result_v1",
    status: "PASS",
    database_name: databaseName,
    scope,
    candidate_ref: candidate.object.object_id,
    candidate_hash: candidate.object.determinism_hash,
    candidate_source_fact_id: candidate.fact_id,
    shadow_ref: shadow.object.object_id,
    shadow_hash: shadow.object.determinism_hash,
    shadow_source_fact_id: shadow.fact_id,
    canonical_scope_profile: "NON_LINEAGE_CONTEXT_NESTED_SCOPE",
    canonical_hash_profile: "CAP06_NON_LINEAGE_CONTEXT_BLANK_DETERMINISM_HASH",
    top_level_scope_rewrite: false,
    canonical_hash_rewrite: false,
    runtime_readback: "OUT_OF_SCOPE_BLOCKED_BY_CAP04_CAP07_FORECAST_PAYLOAD_REMEDIATION",
    timeline_candidate_shadow_readback: "OUT_OF_SCOPE_BLOCKED_BY_CAP04_CAP07_FORECAST_PAYLOAD_REMEDIATION",
    model_governance_candidate_readback: "PASS",
    model_governance_shadow_readback: "PASS",
    model_governance_internal_chain_validation: "PASS",
    http_surface_count: checked.length,
    http_surfaces: checked,
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
    write({ schema_version: "geox_mcft_cap07_cap06_governance_scope_compatibility_db_result_v1", status: "FAIL", error: error instanceof Error ? error.message : String(error) });
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([runner.end(), admin.end()]);
  });
