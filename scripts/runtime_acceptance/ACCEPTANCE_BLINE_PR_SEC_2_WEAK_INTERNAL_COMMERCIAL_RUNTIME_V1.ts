import assert from "node:assert/strict";
import { Pool } from "pg";

const BASE_URL = String(process.env.BASE_URL ?? process.env.API_BASE_URL ?? "").replace(/\/$/, "");
const DATABASE_URL = String(process.env.DATABASE_URL ?? "").trim();
const BEARER = String(process.env.GEOX_TEST_BEARER ?? "commercial-placeholder");
const ERROR = "WEAK_INTERNAL_MUTATION_COMMERCIAL_AUTHORITY_UNAVAILABLE";

if (!BASE_URL) throw new Error("BLINE_PR_SEC_2_WEAK_INTERNAL_BASE_URL_REQUIRED");
if (!DATABASE_URL) throw new Error("BLINE_PR_SEC_2_WEAK_INTERNAL_DATABASE_URL_REQUIRED");

const routes = [
  { path: "/api/raw", body: { source: "system", record_json: { type: "attacker_fact_v1", payload: { project_id: "P_ATTACK", group_id: "G_ATTACK" } } } },
  { path: "/api/agronomy/v0/ao_act/interpretation", body: { receipt_fact_id: "fact_attacker", meta: { project_id: "P_ATTACK", group_id: "G_ATTACK" } } },
  { path: "/api/agronomy/interpretation_v1/append", body: { subject_ref: { groupId: "G_ATTACK" }, dimension: "attack", description: "attack", evidence_refs: [{ kind: "fact", ref: "fact_attacker" }], confidence: 1 } },
] as const;

const cases = [
  { name: "anonymous", query: "", bearer: "" },
  { name: "internal_true", query: "?__internal__=true", bearer: "" },
  { name: "internal_false", query: "?__internal__=false", bearer: "" },
  { name: "arbitrary_bearer", query: "", bearer: "arbitrary" },
  { name: "arbitrary_bearer_internal_true", query: "?__internal__=true", bearer: "arbitrary" },
  { name: "existing_commercial_bearer", query: "", bearer: BEARER },
  { name: "existing_commercial_bearer_internal_true", query: "?__internal__=true", bearer: BEARER },
  { name: "caller_controlled_body", query: "?__internal__=true", bearer: BEARER },
] as const;

async function factCount(pool: Pool): Promise<number> {
  const r = await pool.query<{ n: string }>("SELECT count(*)::text AS n FROM facts");
  return Number(r.rows[0]?.n ?? "0");
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL, max: 1 });
  try {
    const before = await factCount(pool);
    const results: any[] = [];
    for (const route of routes) {
      for (const c of cases) {
        const headers: Record<string, string> = { "content-type": "application/json" };
        if (c.bearer) headers.authorization = `Bearer ${c.bearer}`;
        const response = await fetch(`${BASE_URL}${route.path}${c.query}`, { method: "POST", headers, body: JSON.stringify(route.body), redirect: "manual" });
        const body = await response.json() as { error?: unknown };
        assert.equal(response.status, 403, `${route.path}/${c.name} status`);
        assert.equal(body.error, ERROR, `${route.path}/${c.name} error`);
        results.push({ route: route.path, case: c.name, status: response.status, error: body.error });
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
    const after = await factCount(pool);
    assert.equal(after, before, "facts delta must be zero after rejected weak-internal mutation matrix");
    console.log(JSON.stringify({ result: "PASS", error: ERROR, before: { facts: before }, after: { facts: after }, facts_delta: after - before, post_response_flush_ms: 150, results }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
