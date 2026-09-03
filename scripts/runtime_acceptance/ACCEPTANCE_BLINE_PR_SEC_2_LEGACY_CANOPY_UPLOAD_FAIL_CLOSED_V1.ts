import Fastify from "fastify";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { registerLegacyRoutes } from "../../apps/server/src/routes/registerLegacyRoutes.js";

const ROUTE = "/api/canopy/upload";
const ERROR = "LEGACY_CANOPY_UPLOAD_COMMERCIAL_AUTHORITY_UNAVAILABLE";
let phase: "registration" | "requests" = "registration";
const queries = { total: 0, request: 0 };
const pool = {
  query: async (..._args: any[]) => {
    queries.total += 1;
    if (phase === "requests") {
      queries.request += 1;
      throw new Error("UNEXPECTED_BSEC030_DB_QUERY");
    }
    return { rows: [], rowCount: 0 };
  },
} as any;

function tree(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else out.push(path.relative(root, p));
    }
  };
  walk(root);
  return out.sort();
}

async function main() {
  const mediaDir = fs.mkdtempSync(path.join(os.tmpdir(), "bsec030-media-"));
  const app: FastifyInstance = Fastify({ logger: false });
  registerLegacyRoutes(app, pool, { mediaDir });
  await app.ready();

  const routes = app.printRoutes();
  if (!routes.includes("/api/canopy/upload")) throw new Error("BSEC-030 route not registered");
  if (!routes.includes("/api/canopy/frame")) throw new Error("BSEC-029 sibling route not registered");

  const registrationQueries = queries.total;
  const mediaBefore = tree(mediaDir);
  phase = "requests";

  const cases = [
    { name: "no_auth", headers: {} },
    { name: "arbitrary_bearer", headers: { authorization: "Bearer arbitrary" } },
    { name: "commercial_bearer", headers: { authorization: "Bearer tenant_a_admin_token" } },
  ] as const;
  const results: any[] = [];

  for (const c of cases) {
    const beforeTotal = queries.total;
    const beforeRequest = queries.request;
    const response = await app.inject({
      method: "POST",
      url: ROUTE,
      headers: { "content-type": "application/json", ...c.headers },
      payload: {
        project_id: "bsec030_project",
        group_id: "bsec030_group",
        camera_id: "bsec030_camera",
        source: "device",
        sentinel: "bsec030_should_never_be_consumed",
      },
    });
    const body = response.json();
    if (response.statusCode !== 403 || body?.ok !== false || body?.error !== ERROR) {
      throw new Error(`${c.name} did not deterministically fail-close: ${response.statusCode} ${response.body}`);
    }
    if (queries.total !== beforeTotal || queries.request !== beforeRequest) {
      throw new Error(`${c.name} reached DB: total ${beforeTotal}->${queries.total}, request ${beforeRequest}->${queries.request}`);
    }
    if (JSON.stringify(tree(mediaDir)) !== JSON.stringify(mediaBefore)) {
      throw new Error(`${c.name} changed media tree`);
    }
    results.push({ case: c.name, status: response.statusCode, error: body.error, db_query_delta: 0, media_delta: 0 });
  }

  await new Promise((resolve) => setImmediate(resolve));
  if (queries.total !== registrationQueries || queries.request !== 0) {
    throw new Error(`post-response DB delta=${queries.total-registrationQueries}, request=${queries.request}`);
  }
  if (JSON.stringify(tree(mediaDir)) !== JSON.stringify(mediaBefore)) {
    throw new Error("post-response media tree changed");
  }

  await app.close();
  fs.rmSync(mediaDir, { recursive: true, force: true });
  console.log(JSON.stringify({
    ok: true,
    route: ROUTE,
    error: ERROR,
    registration_query_count: registrationQueries,
    request_phase_db_query_delta: 0,
    post_response_db_query_delta: 0,
    media_delta: 0,
    sibling_bsec029_registered: true,
    results,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});