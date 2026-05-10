import crypto from "node:crypto";
import type { Pool } from "pg";

import type { AoActAuthContextV0 } from "../../auth/ao_act_authz_v0.js";
import type { FlightTableRunV1 } from "./flight_table_manifest_v1.js";

export type FlightTableCreateFieldInputV1 = {
  field_id?: string;
  field_name?: string;
  crop?: string;
  crop_stage?: string;
  season_id?: string;
};

export type FlightTableFieldVisibilityV1 = {
  ok: true;
  field_id: string;
  field_name: string;
  customer_visible: boolean;
  report_visible: boolean;
  customer_scope: "FALLBACK_OR_UNCONFIRMED" | "CONFIRMED";
  field_fact_id: string;
  season_fact_id: string;
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function normalizeId(v: unknown): string | null {
  if (!isNonEmptyString(v)) return null;
  const s = v.trim();
  if (s.length < 1 || s.length > 128) return null;
  if (!/^[A-Za-z0-9_\-:.]+$/.test(s)) return null;
  return s;
}

function normalizeName(v: unknown, fallback: string): string {
  if (!isNonEmptyString(v)) return fallback;
  return v.trim().slice(0, 256);
}

function normalizeText(v: unknown): string | null {
  if (!isNonEmptyString(v)) return null;
  return v.trim().slice(0, 128);
}

function sha256Hex(seed: string): string {
  return crypto.createHash("sha256").update(seed, "utf8").digest("hex");
}

async function ensureFieldSeasonProjectionV1(pool: Pool): Promise<void> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS field_season_index_v1 (
       tenant_id text NOT NULL,
       field_id text NOT NULL,
       season_id text NOT NULL,
       name text NOT NULL,
       crop text NULL,
       start_date text NULL,
       end_date text NULL,
       status text NOT NULL,
       created_ts_ms bigint NOT NULL,
       updated_ts_ms bigint NOT NULL,
       PRIMARY KEY (tenant_id, field_id, season_id)
     )`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS field_season_index_v1_lookup_idx
       ON field_season_index_v1 (tenant_id, field_id, updated_ts_ms DESC)`,
  );
}

export function normalizeFlightTableFieldInputV1(input: FlightTableCreateFieldInputV1): Required<FlightTableCreateFieldInputV1> {
  const field_id = normalizeId(input.field_id);
  const season_id = normalizeId(input.season_id);
  if (!field_id) throw new Error("FLIGHT_TABLE_INVALID_FIELD_ID");
  if (!season_id) throw new Error("FLIGHT_TABLE_INVALID_SEASON_ID");
  const field_name = normalizeName(input.field_name, field_id);
  const crop = normalizeText(input.crop) ?? "unknown";
  const crop_stage = normalizeText(input.crop_stage) ?? "unknown";
  return { field_id, field_name, crop, crop_stage, season_id };
}

export async function createFlightTableFieldV1(
  pool: Pool,
  run: FlightTableRunV1,
  input: FlightTableCreateFieldInputV1,
  auth: AoActAuthContextV0,
): Promise<FlightTableFieldVisibilityV1> {
  if (run.tenant_id !== auth.tenant_id || run.project_id !== auth.project_id || run.group_id !== auth.group_id) {
    throw new Error("FLIGHT_TABLE_SCOPE_MISMATCH");
  }

  const normalized = normalizeFlightTableFieldInputV1(input);
  const now_ms = Date.now();
  const occurredAtIso = new Date(now_ms).toISOString();
  const field_fact_id = `field_${sha256Hex(`field_created_v1|${auth.tenant_id}|${normalized.field_id}`)}`;
  const season_fact_id = `season_${sha256Hex(`field_season_created_v1|${auth.tenant_id}|${normalized.field_id}|${normalized.season_id}`)}`;

  const fieldRecord = {
    type: "field_created_v1",
    entity: { tenant_id: auth.tenant_id, field_id: normalized.field_id },
    payload: {
      name: normalized.field_name,
      area_ha: null,
      status: "ACTIVE",
      created_ts_ms: now_ms,
      actor_id: auth.actor_id,
      token_id: auth.token_id,
      source_run_id: run.run_id,
    },
  };
  const seasonRecord = {
    type: "field_season_created_v1",
    entity: { tenant_id: auth.tenant_id, field_id: normalized.field_id, season_id: normalized.season_id },
    payload: {
      season_id: normalized.season_id,
      name: normalized.season_id,
      crop: normalized.crop,
      crop_stage: normalized.crop_stage,
      status: "ACTIVE",
      created_ts_ms: now_ms,
      updated_ts_ms: now_ms,
      actor_id: auth.actor_id,
      token_id: auth.token_id,
      source_run_id: run.run_id,
    },
  };

  await ensureFieldSeasonProjectionV1(pool);
  const conn = await pool.connect();
  try {
    await conn.query("BEGIN");
    await conn.query(
      `INSERT INTO facts (fact_id, occurred_at, source, record_json)
       VALUES ($1, $2::timestamptz, $3, $4)
       ON CONFLICT (fact_id) DO NOTHING`,
      [field_fact_id, occurredAtIso, "control", JSON.stringify(fieldRecord)],
    );
    await conn.query(
      `INSERT INTO field_index_v1 (tenant_id, field_id, name, area_ha, status, created_ts_ms, updated_ts_ms)
       VALUES ($1, $2, $3, NULL, 'ACTIVE', $4, $4)
       ON CONFLICT (tenant_id, field_id) DO UPDATE SET
         name = EXCLUDED.name,
         status = EXCLUDED.status,
         updated_ts_ms = EXCLUDED.updated_ts_ms`,
      [auth.tenant_id, normalized.field_id, normalized.field_name, now_ms],
    );
    await conn.query(
      `INSERT INTO facts (fact_id, occurred_at, source, record_json)
       VALUES ($1, $2::timestamptz, $3, $4)
       ON CONFLICT (fact_id) DO NOTHING`,
      [season_fact_id, occurredAtIso, "control", JSON.stringify(seasonRecord)],
    );
    await conn.query(
      `INSERT INTO field_season_index_v1 (tenant_id, field_id, season_id, name, crop, start_date, end_date, status, created_ts_ms, updated_ts_ms)
       VALUES ($1, $2, $3, $4, $5, NULL, NULL, 'ACTIVE', $6, $6)
       ON CONFLICT (tenant_id, field_id, season_id) DO UPDATE SET
         name = EXCLUDED.name,
         crop = EXCLUDED.crop,
         status = EXCLUDED.status,
         updated_ts_ms = EXCLUDED.updated_ts_ms`,
      [auth.tenant_id, normalized.field_id, normalized.season_id, normalized.season_id, normalized.crop, now_ms],
    );
    await conn.query("COMMIT");
  } catch (err) {
    try { await conn.query("ROLLBACK"); } catch {}
    throw err;
  } finally {
    conn.release();
  }

  const visibility = await verifyFlightTableFieldVisibilityV1(pool, auth, normalized.field_id);
  return {
    ok: true,
    field_id: normalized.field_id,
    field_name: normalized.field_name,
    customer_visible: visibility.customer_visible,
    report_visible: visibility.report_visible,
    customer_scope: visibility.customer_scope,
    field_fact_id,
    season_fact_id,
  };
}

export async function verifyFlightTableFieldVisibilityV1(
  pool: Pool,
  auth: AoActAuthContextV0,
  field_id: string,
): Promise<{ customer_visible: boolean; report_visible: boolean; customer_scope: "FALLBACK_OR_UNCONFIRMED" | "CONFIRMED" }> {
  const fieldQ = await pool.query(
    `SELECT field_id FROM field_index_v1 WHERE tenant_id = $1 AND field_id = $2 LIMIT 1`,
    [auth.tenant_id, field_id],
  );
  const fieldExists = (fieldQ.rowCount ?? 0) > 0;
  const allowed = Array.isArray(auth.allowed_field_ids) ? auth.allowed_field_ids : [];
  const scopeConfirmed = allowed.length > 0 && allowed.includes(field_id);
  return {
    customer_visible: fieldExists,
    report_visible: fieldExists,
    customer_scope: scopeConfirmed ? "CONFIRMED" : "FALLBACK_OR_UNCONFIRMED",
  };
}
