import crypto from "node:crypto";
import { Pool } from "pg";

const BASE_URL = String(process.env.BASE_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
const DATABASE_URL = String(process.env.DATABASE_URL ?? "").trim();
const COMMERCIAL_BEARER = String(process.env.GEOX_TEST_BEARER ?? process.env.GEOX_AO_ACT_TOKEN ?? "").trim();
const ROUTE = "/api/canopy/upload";
const ERROR = "LEGACY_CANOPY_UPLOAD_COMMERCIAL_AUTHORITY_UNAVAILABLE";

if (!DATABASE_URL) throw new Error("DATABASE_URL required");
if (!COMMERCIAL_BEARER) throw new Error("commercial bearer required");
const pool = new Pool({ connectionString: DATABASE_URL });

async function factsPresence(): Promise<boolean> {
  const q = await pool.query("SELECT to_regclass('public.facts') IS NOT NULL AS present");
  return Boolean(q.rows?.[0]?.present);
}

async function sentinelFactExists(sentinel: string): Promise<boolean> {
  const q = await pool.query(
    "SELECT EXISTS(SELECT 1 FROM facts f WHERE row_to_json(f)::text LIKE $1) AS hit",
    [`%${sentinel}%`],
  );
  return Boolean(q.rows?.[0]?.hit);
}

async function reject(name: string, sentinel: string, bearer: string | null) {
  const FormDataCtor: any = (globalThis as any).FormData;
  const BlobCtor: any = (globalThis as any).Blob;
  if (!FormDataCtor || !BlobCtor) throw new Error("Node FormData/Blob unavailable");
  const form = new FormDataCtor();
  form.append("projectId", `${sentinel}_project`);
  form.append("groupId", `${sentinel}_group`);
  form.append("cameraId", `${sentinel}_camera`);
  form.append("spatialUnitId", `${sentinel}_spatial`);
  form.append("source", "device");
  form.append("ts", String(Date.now()));
  form.append("file", new BlobCtor([sentinel], { type: "image/jpeg" }), `${sentinel}.jpg`);

  const res = await fetch(`${BASE_URL}${ROUTE}`, {
    method: "POST",
    headers: bearer ? { authorization: `Bearer ${bearer}` } : undefined,
    body: form,
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (res.status !== 403 || json?.ok !== false || json?.error !== ERROR) {
    throw new Error(`${name} expected 403 ${ERROR}, got ${res.status} ${text}`);
  }
  return { name, status: res.status, error: json.error };
}

async function main() {
  const sentinel = `bsec030_${crypto.randomUUID().replace(/-/g, "")}`;
  const presenceBefore = await factsPresence();
  if (!presenceBefore) throw new Error("facts table missing before Batch007 runtime proof");
  if (await sentinelFactExists(sentinel)) throw new Error("sentinel collision before Batch007 requests");

  const results = [];
  results.push(await reject("no_auth", sentinel, null));
  results.push(await reject("arbitrary_bearer", sentinel, "arbitrary"));
  results.push(await reject("commercial_bearer", sentinel, COMMERCIAL_BEARER));

  if (await sentinelFactExists(sentinel)) throw new Error("BSEC-030 rejection persisted sentinel fact before deferred wait");
  await new Promise((resolve) => setTimeout(resolve, 750));
  const presenceAfter = await factsPresence();
  if (presenceAfter !== presenceBefore) throw new Error(`facts table presence changed: ${presenceBefore}->${presenceAfter}`);
  if (await sentinelFactExists(sentinel)) throw new Error("BSEC-030 rejection persisted sentinel fact after deferred wait");

  console.log(JSON.stringify({
    ok: true,
    route: ROUTE,
    error: ERROR,
    sentinel,
    facts_table_presence_before: presenceBefore,
    facts_table_presence_after: presenceAfter,
    sentinel_fact_before: false,
    sentinel_fact_after: false,
    results,
  }, null, 2));
}

main().finally(() => pool.end()).catch((error) => {
  console.error(error);
  process.exit(1);
});