import pg from "pg";

const { Pool } = pg;
const BASE_URL = String(process.env.BASE_URL ?? "http://127.0.0.1:3001").replace(/\/+$/, "");
const DATABASE_URL = String(process.env.DATABASE_URL ?? "").trim();
if (!DATABASE_URL) throw new Error("DATABASE_URL required");

const ERROR = "ADMIN_IMPORT_MUTATION_COMMERCIAL_AUTHORITY_UNAVAILABLE";

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
      facts: await count(pool, "facts"),
      raw_samples: await count(pool, "raw_samples"),
    };
    if (after.facts !== before.facts) throw new Error(`facts changed: ${before.facts} -> ${after.facts}`);
    if (after.raw_samples !== before.raw_samples) throw new Error(`raw_samples changed: ${before.raw_samples} -> ${after.raw_samples}`);

    console.log(JSON.stringify({
      ok: true,
      results,
      before,
      after,
      delta: { facts: 0, raw_samples: 0 },
      deferred_wait_ms: 500,
      filesystem_proof: "PERFORMED_INSIDE_COMMERCIAL_SERVER_CONTAINER_BY_WORKFLOW",
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
