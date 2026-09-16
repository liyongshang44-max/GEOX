import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { registerAdminModule } from "../../apps/server/src/modules/admin/registerAdminModule.js";

const ERROR = "ADMIN_IMPORT_MUTATION_COMMERCIAL_AUTHORITY_UNAVAILABLE";
const ROUTES = [
  "/api/admin/import/caf_hourly",
  "/api/admin/acceptance/caf009_1h/run",
] as const;

const queryCounter = { count: 0 };
const pool = {
  query: async (..._args: any[]) => {
    queryCounter.count += 1;
    throw new Error("UNEXPECTED_DB_QUERY");
  },
} as any;

async function main() {
  const app: FastifyInstance = Fastify({ logger: false });
  registerAdminModule(app, pool);
  await app.ready();

  const cases = [
    { name: "anonymous", headers: {}, body: {} },
    { name: "arbitrary_bearer", headers: { authorization: "Bearer arbitrary" }, body: {} },
    { name: "existing_commercial_bearer", headers: { authorization: "Bearer commercial-placeholder" }, body: {} },
    { name: "caller_controlled_scope", headers: { authorization: "Bearer commercial-placeholder" }, body: { projectId: "P_ATTACK", groupId: "G_ATTACK", sensorId: "S_ATTACK", writeRawSamples: "1", writeMarkers: "1" } },
  ];

  const before = queryCounter.count;
  const results: any[] = [];
  for (const route of ROUTES) {
    for (const c of cases) {
      const res = await app.inject({ method: "POST", url: route, headers: c.headers as any, payload: c.body });
      const json = res.json();
      if (res.statusCode !== 403 || json?.error !== ERROR) throw new Error(`${route}/${c.name} did not deterministically fail-close`);
      results.push({ route, case: c.name, status: res.statusCode, error: json.error });
    }
  }

  await new Promise((resolve) => setImmediate(resolve));
  if (queryCounter.count !== before) throw new Error(`DB query count changed: ${before} -> ${queryCounter.count}`);
  await app.close();
  console.log(JSON.stringify({ ok: true, db_query_count: queryCounter.count, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
