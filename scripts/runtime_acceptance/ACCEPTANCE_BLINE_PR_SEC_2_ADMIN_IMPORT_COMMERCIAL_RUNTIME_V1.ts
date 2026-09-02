import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;
const BASE_URL = String(process.env.BASE_URL ?? "http://127.0.0.1:3001").replace(/\/+$/, "");
const DATABASE_URL = String(process.env.DATABASE_URL ?? "").trim();
if (!DATABASE_URL) throw new Error("DATABASE_URL required");

const ERROR = "ADMIN_IMPORT_MUTATION_COMMERCIAL_AUTHORITY_UNAVAILABLE";
const repoRoot = process.cwd();
const uploadDir = path.join(repoRoot, "_uploads");
const acceptanceDir = path.join(repoRoot, "acceptance");

function listNames(dir: string, prefix?: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => !prefix || name.startsWith(prefix)).sort();
}
async function count(pool: pg.Pool, table: string): Promise<number> {
  const r = await pool.query(`select count(*)::bigint as n from ${table}`);
  return Number(r.rows?.[0]?.n ?? 0);
}
async function postJson(pathname: string, body: any, bearer?: string) {
  const res = await fetch(`${BASE_URL}${pathname}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch {}
  if (res.status !== 403 || json?.error !== ERROR) throw new Error(`${pathname} expected deterministic 403, got ${res.status}: ${text}`);
  return { status: res.status, error: json.error };
}
async function postMultipart(bearer?: string) {
  const fd = new FormData();
  fd.append("file", new Blob(["Location\tDate\tTime\tVWC_30cm\nCAF009\t01/01/2026\t0:00\t0.2\n"], { type: "text/plain" }), "attack.tsv");
  fd.append("projectId", "P_ATTACK");
  fd.append("groupId", "G_ATTACK");
  fd.append("writeRawSamples", "1");
  fd.append("writeMarkers", "1");
  const res = await fetch(`${BASE_URL}/api/admin/import/caf_hourly`, {
    method: "POST",
    headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
    body: fd,
  });
  const text = await res.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch {}
  if (res.status !== 403 || json?.error !== ERROR) throw new Error(`BSEC-022 expected deterministic 403, got ${res.status}: ${text}`);
  return { status: res.status, error: json.error };
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    const before = {
      uploads: listNames(uploadDir),
      acceptance: listNames(acceptanceDir, "caf009_1h_"),
      facts: await count(pool, "facts"),
      raw_samples: await count(pool, "raw_samples"),
    };

    const results = [];
    results.push({ route: "BSEC-022", case: "anonymous_multipart", ...(await postMultipart()) });
    results.push({ route: "BSEC-022", case: "arbitrary_bearer", ...(await postMultipart("arbitrary")) });
    results.push({ route: "BSEC-022", case: "existing_commercial_bearer", ...(await postMultipart(String(process.env.GEOX_TEST_BEARER ?? "commercial-placeholder"))) });
    results.push({ route: "BSEC-023", case: "anonymous", ...(await postJson("/api/admin/acceptance/caf009_1h/run", { projectId: "P_ATTACK", groupId: "G_ATTACK", sensorId: "S_ATTACK" })) });
    results.push({ route: "BSEC-023", case: "arbitrary_bearer", ...(await postJson("/api/admin/acceptance/caf009_1h/run", { projectId: "P_ATTACK", groupId: "G_ATTACK", sensorId: "S_ATTACK" }, "arbitrary")) });
    results.push({ route: "BSEC-023", case: "existing_commercial_bearer", ...(await postJson("/api/admin/acceptance/caf009_1h/run", { projectId: "P_ATTACK", groupId: "G_ATTACK", sensorId: "S_ATTACK" }, String(process.env.GEOX_TEST_BEARER ?? "commercial-placeholder"))) });

    await new Promise((resolve) => setTimeout(resolve, 500));

    const after = {
      uploads: listNames(uploadDir),
      acceptance: listNames(acceptanceDir, "caf009_1h_"),
      facts: await count(pool, "facts"),
      raw_samples: await count(pool, "raw_samples"),
    };

    if (JSON.stringify(after.uploads) !== JSON.stringify(before.uploads)) throw new Error(`_uploads changed: ${before.uploads.length} -> ${after.uploads.length}`);
    if (JSON.stringify(after.acceptance) !== JSON.stringify(before.acceptance)) throw new Error(`acceptance artifacts changed: ${before.acceptance.length} -> ${after.acceptance.length}`);
    if (after.facts !== before.facts) throw new Error(`facts changed: ${before.facts} -> ${after.facts}`);
    if (after.raw_samples !== before.raw_samples) throw new Error(`raw_samples changed: ${before.raw_samples} -> ${after.raw_samples}`);

    console.log(JSON.stringify({
      ok: true,
      results,
      before: { uploads: before.uploads.length, acceptance_dirs: before.acceptance.length, facts: before.facts, raw_samples: before.raw_samples },
      after: { uploads: after.uploads.length, acceptance_dirs: after.acceptance.length, facts: after.facts, raw_samples: after.raw_samples },
      delta: { uploads: 0, acceptance_dirs: 0, facts: 0, raw_samples: 0 },
      deferred_wait_ms: 500,
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
