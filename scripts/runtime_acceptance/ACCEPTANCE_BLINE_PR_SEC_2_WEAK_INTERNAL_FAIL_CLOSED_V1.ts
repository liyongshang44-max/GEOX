import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { registerSensingModule } from "../../apps/server/src/modules/sensing/registerSensingModule.js";
import { registerAgronomyModule } from "../../apps/server/src/modules/agronomy/registerAgronomyModule.js";

const ERROR = "WEAK_INTERNAL_MUTATION_COMMERCIAL_AUTHORITY_UNAVAILABLE";
const ROUTES = [
  "/api/raw",
  "/api/agronomy/v0/ao_act/interpretation",
  "/api/agronomy/interpretation_v1/append",
] as const;

const queryCounter = { count: 0 };
const pool = {
  query: async (..._args: any[]) => {
    queryCounter.count += 1;
    throw new Error("UNEXPECTED_DB_QUERY");
  },
} as any;

const cases = [
  { name: "no_query", query: "", headers: {} },
  { name: "internal_true", query: "?__internal__=true", headers: {} },
  { name: "internal_false", query: "?__internal__=false", headers: {} },
  { name: "arbitrary_bearer", query: "", headers: { authorization: "Bearer arbitrary" } },
  { name: "arbitrary_bearer_internal_true", query: "?__internal__=true", headers: { authorization: "Bearer arbitrary" } },
  { name: "existing_commercial_bearer", query: "", headers: { authorization: "Bearer commercial-placeholder" } },
  { name: "existing_commercial_bearer_internal_true", query: "?__internal__=true", headers: { authorization: "Bearer commercial-placeholder" } },
  { name: "caller_controlled_body", query: "?__internal__=true", headers: { authorization: "Bearer commercial-placeholder" } },
] as const;

function bodyFor(route: string) {
  if (route === "/api/raw") return { source: "system", record_json: { type: "attacker_fact_v1", payload: { project_id: "P_ATTACK", group_id: "G_ATTACK" } } };
  if (route.includes("ao_act")) return { receipt_fact_id: "fact_attacker", meta: { project_id: "P_ATTACK", group_id: "G_ATTACK" } };
  return { subject_ref: { groupId: "G_ATTACK" }, dimension: "attack", description: "attack", evidence_refs: [{ kind: "fact", ref: "fact_attacker" }], confidence: 1 };
}

async function main() {
  const app: FastifyInstance = Fastify({ logger: false });
  registerSensingModule(app, pool);
  registerAgronomyModule(app, pool, { mediaDir: "/tmp/geox-bline-weak-internal-media" });
  await app.ready();

  const results: any[] = [];
  for (const route of ROUTES) {
    for (const c of cases) {
      const before = queryCounter.count;
      const res = await app.inject({ method: "POST", url: `${route}${c.query}`, headers: { "content-type": "application/json", ...c.headers } as any, payload: bodyFor(route) });
      const json = res.json();
      if (res.statusCode !== 403 || json?.error !== ERROR) throw new Error(`${route}/${c.name} did not deterministically fail-close: ${res.statusCode} ${res.body}`);
      if (queryCounter.count !== before) throw new Error(`${route}/${c.name} reached DB: ${before} -> ${queryCounter.count}`);
      results.push({ route, case: c.name, status: res.statusCode, error: json.error, db_query_delta: 0 });
    }
  }

  await new Promise((resolve) => setImmediate(resolve));
  if (queryCounter.count !== 0) throw new Error(`post-response DB query count=${queryCounter.count}`);
  await app.close();
  console.log(JSON.stringify({ ok: true, error: ERROR, db_query_count: 0, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
