// apps/server/src/routes/v1/twin_kernel.ts
// Purpose: expose minimal Twin Kernel write/read routes for field_state_snapshot_v1 and forecast_run_v1.
// Boundary: these routes do not write scenarios, recommendations, approvals, tasks, receipts, ROI, Field Memory, calibration, learning, or decision-cycle records.

import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { buildFieldStateSnapshotV1, type FieldStateSnapshotScopeV1 } from "../../domain/twin_kernel/field_state_snapshot_v1.js";
import { buildForecastRunV1, type ForecastRunSnapshotRowV1 } from "../../domain/twin_kernel/forecast_run_v1.js";

type Row = Record<string, unknown>;

type SnapshotRequestBody = {
  tenant_id?: unknown;
  tenantId?: unknown;
  project_id?: unknown;
  projectId?: unknown;
  group_id?: unknown;
  groupId?: unknown;
  field_id?: unknown;
  fieldId?: unknown;
  season_id?: unknown;
  seasonId?: unknown;
  as_of_ts?: unknown;
  asOfTs?: unknown;
};

type ForecastRequestBody = {
  snapshot_id?: unknown;
  snapshotId?: unknown;
  model_version?: unknown;
  modelVersion?: unknown;
};

type TwinKernelRequestBody = SnapshotRequestBody & ForecastRequestBody;

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const raw = text(value);
    if (raw) return raw;
  }
  return "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function evidenceArray(value: unknown): Array<Record<string, string>> {
  return Array.isArray(value) ? (value.filter((item) => item && typeof item === "object") as Array<Record<string, string>>) : [];
}

function queryValue(req: any, key: string): unknown {
  return req?.query?.[key] ?? req?.query?.[key.replace(/_([a-z])/g, (_match: string, letter: string) => letter.toUpperCase())];
}

function headerValue(req: any, key: string): unknown {
  return req?.headers?.[key] ?? req?.headers?.[key.toLowerCase()];
}

function bodyValue(body: SnapshotRequestBody, snakeKey: keyof SnapshotRequestBody, camelKey: keyof SnapshotRequestBody): unknown {
  return body[snakeKey] ?? body[camelKey];
}

function extractBody(req: any): TwinKernelRequestBody {
  return req?.body && typeof req.body === "object" ? (req.body as TwinKernelRequestBody) : {};
}

function extractScope(req: any): FieldStateSnapshotScopeV1 | null {
  const body = extractBody(req);
  const tenant_id = firstText(bodyValue(body, "tenant_id", "tenantId"), queryValue(req, "tenant_id"), headerValue(req, "x-tenant-id"));
  const project_id = firstText(bodyValue(body, "project_id", "projectId"), queryValue(req, "project_id"), headerValue(req, "x-project-id"));
  const group_id = firstText(bodyValue(body, "group_id", "groupId"), queryValue(req, "group_id"), headerValue(req, "x-group-id"));
  const field_id = firstText(bodyValue(body, "field_id", "fieldId"), queryValue(req, "field_id"));
  if (!tenant_id || !project_id || !group_id || !field_id) return null;
  return { tenant_id, project_id, group_id, field_id };
}

function extractAsOfTs(req: any): string {
  const body = extractBody(req);
  const raw = firstText(bodyValue(body, "as_of_ts", "asOfTs"), queryValue(req, "as_of_ts"));
  const date = raw ? new Date(raw) : new Date();
  if (!Number.isFinite(date.getTime())) throw new Error("INVALID_AS_OF_TS");
  return date.toISOString();
}

function extractSeasonId(req: any): string | null {
  const body = extractBody(req);
  return firstText(bodyValue(body, "season_id", "seasonId"), queryValue(req, "season_id")) || null;
}

function extractSnapshotId(req: any): string {
  const body = extractBody(req);
  return firstText(body.snapshot_id, body.snapshotId, queryValue(req, "snapshot_id"));
}

function extractModelVersion(req: any): string | null {
  const body = extractBody(req);
  return firstText(body.model_version, body.modelVersion, queryValue(req, "model_version")) || null;
}

async function queryOne(pool: Pool, sql: string, values: unknown[]): Promise<Row | null> {
  const result = await pool.query(sql, values).catch(() => ({ rows: [] as Row[] }));
  return result.rows[0] ?? null;
}

async function readFieldRow(pool: Pool, scope: FieldStateSnapshotScopeV1): Promise<Row | null> {
  return queryOne(pool, `SELECT * FROM field_index_v1 WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND field_id = $4 LIMIT 1`, [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id]);
}

async function readWaterRow(pool: Pool, scope: FieldStateSnapshotScopeV1): Promise<Row | null> {
  return queryOne(pool, `SELECT * FROM water_state_estimate_index_v1 WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND field_id = $4 ORDER BY computed_at DESC NULLS LAST LIMIT 1`, [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id]);
}

async function readSensingRow(pool: Pool, scope: FieldStateSnapshotScopeV1): Promise<Row | null> {
  return queryOne(pool, `SELECT * FROM soil_moisture_sensing_window_index_v1 WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND field_id = $4 ORDER BY updated_at DESC NULLS LAST, window_end DESC NULLS LAST, created_at DESC NULLS LAST LIMIT 1`, [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id]);
}

async function readWeatherRow(pool: Pool, scope: FieldStateSnapshotScopeV1): Promise<Row | null> {
  return queryOne(pool, `SELECT * FROM weather_forecast_index_v1 WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND field_id = $4 ORDER BY generated_at DESC NULLS LAST LIMIT 1`, [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id]);
}

async function readSnapshotRow(pool: Pool, snapshotId: string): Promise<Row | null> {
  return queryOne(pool, "SELECT * FROM field_state_snapshot_v1 WHERE snapshot_id = $1 LIMIT 1", [snapshotId]);
}

function toForecastRunSnapshotRow(row: Row): ForecastRunSnapshotRowV1 {
  return {
    snapshot_id: firstText(row.snapshot_id),
    tenant_id: firstText(row.tenant_id),
    project_id: firstText(row.project_id),
    group_id: firstText(row.group_id),
    field_id: firstText(row.field_id),
    as_of_ts: row.as_of_ts instanceof Date ? row.as_of_ts.toISOString() : firstText(row.as_of_ts),
    status: firstText(row.status),
    state_vector_json: record(row.state_vector_json),
    confidence_json: record(row.confidence_json),
    evidence_refs_json: evidenceArray(row.evidence_refs_json),
    determinism_hash: firstText(row.determinism_hash),
  };
}

async function insertSnapshot(pool: Pool, snapshot: ReturnType<typeof buildFieldStateSnapshotV1>): Promise<Row> {
  const result = await pool.query(
    `INSERT INTO field_state_snapshot_v1 (snapshot_id,tenant_id,project_id,group_id,field_id,season_id,as_of_ts,status,state_vector_json,confidence_json,evidence_refs_json,source_indexes_json,blocking_reasons_json,determinism_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14)
     ON CONFLICT (snapshot_id) DO NOTHING
     RETURNING *`,
    [snapshot.snapshot_id, snapshot.tenant_id, snapshot.project_id, snapshot.group_id, snapshot.field_id, snapshot.season_id, snapshot.as_of_ts, snapshot.status, JSON.stringify(snapshot.state_vector_json), JSON.stringify(snapshot.confidence_json), JSON.stringify(snapshot.evidence_refs_json), JSON.stringify(snapshot.source_indexes_json), JSON.stringify(snapshot.blocking_reasons_json), snapshot.determinism_hash],
  );
  if (result.rows[0]) return result.rows[0] as Row;
  const existing = await queryOne(pool, "SELECT * FROM field_state_snapshot_v1 WHERE snapshot_id = $1 LIMIT 1", [snapshot.snapshot_id]);
  if (!existing) throw new Error("FIELD_STATE_SNAPSHOT_INSERT_FAILED");
  return existing;
}

async function insertForecastRun(pool: Pool, forecast: ReturnType<typeof buildForecastRunV1>): Promise<Row> {
  const result = await pool.query(
    `INSERT INTO forecast_run_v1 (forecast_run_id,snapshot_id,tenant_id,project_id,group_id,field_id,as_of_ts,horizon_days,model_version,status,input_refs_json,forecast_points_json,risk_timeline_json,uncertainty_json,assumptions_json,blocking_reasons_json,determinism_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,$17)
     ON CONFLICT (forecast_run_id) DO NOTHING
     RETURNING *`,
    [forecast.forecast_run_id, forecast.snapshot_id, forecast.tenant_id, forecast.project_id, forecast.group_id, forecast.field_id, forecast.as_of_ts, forecast.horizon_days, forecast.model_version, forecast.status, JSON.stringify(forecast.input_refs_json), JSON.stringify(forecast.forecast_points_json), JSON.stringify(forecast.risk_timeline_json), JSON.stringify(forecast.uncertainty_json), JSON.stringify(forecast.assumptions_json), JSON.stringify(forecast.blocking_reasons_json), forecast.determinism_hash],
  );
  if (result.rows[0]) return result.rows[0] as Row;
  const existing = await queryOne(pool, "SELECT * FROM forecast_run_v1 WHERE forecast_run_id = $1 LIMIT 1", [forecast.forecast_run_id]);
  if (!existing) throw new Error("FORECAST_RUN_INSERT_FAILED");
  return existing;
}

function exposeSnapshotRow(row: Row): Row {
  return {
    snapshot_id: row.snapshot_id,
    tenant_id: row.tenant_id,
    project_id: row.project_id,
    group_id: row.group_id,
    field_id: row.field_id,
    season_id: row.season_id ?? null,
    as_of_ts: row.as_of_ts instanceof Date ? row.as_of_ts.toISOString() : row.as_of_ts,
    status: row.status,
    state_vector_json: row.state_vector_json,
    confidence_json: row.confidence_json,
    evidence_refs_json: row.evidence_refs_json,
    source_indexes_json: row.source_indexes_json,
    blocking_reasons_json: row.blocking_reasons_json,
    determinism_hash: row.determinism_hash,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}

function exposeForecastRunRow(row: Row): Row {
  return {
    forecast_run_id: row.forecast_run_id,
    snapshot_id: row.snapshot_id,
    tenant_id: row.tenant_id,
    project_id: row.project_id,
    group_id: row.group_id,
    field_id: row.field_id,
    as_of_ts: row.as_of_ts instanceof Date ? row.as_of_ts.toISOString() : row.as_of_ts,
    horizon_days: row.horizon_days,
    model_version: row.model_version,
    status: row.status,
    input_refs_json: row.input_refs_json,
    forecast_points_json: row.forecast_points_json,
    risk_timeline_json: row.risk_timeline_json,
    uncertainty_json: row.uncertainty_json,
    assumptions_json: row.assumptions_json,
    blocking_reasons_json: row.blocking_reasons_json,
    determinism_hash: row.determinism_hash,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}

export function registerTwinKernelV1Routes(app: FastifyInstance, pool: Pool): void {
  app.post("/api/v1/twin-kernel/field-state-snapshots", async (req, reply) => {
    const scope = extractScope(req);
    if (!scope) return reply.code(400).send({ ok: false, error: "TENANT_PROJECT_GROUP_FIELD_SCOPE_REQUIRED" });
    let asOfTs: string;
    try {
      asOfTs = extractAsOfTs(req);
    } catch {
      return reply.code(400).send({ ok: false, error: "INVALID_AS_OF_TS" });
    }
    const seasonId = extractSeasonId(req);
    const sources = { field: await readFieldRow(pool, scope), water: await readWaterRow(pool, scope), sensing: await readSensingRow(pool, scope), weather: await readWeatherRow(pool, scope) };
    const snapshot = buildFieldStateSnapshotV1({ scope, season_id: seasonId, as_of_ts: asOfTs, sources });
    const row = await insertSnapshot(pool, snapshot);
    return reply.send({ ok: true, object_type: "field_state_snapshot_v1", write_ready: true, downstream_write_ready: false, snapshot: exposeSnapshotRow(row) });
  });

  app.get("/api/v1/twin-kernel/field-state-snapshots/:snapshot_id", async (req: any, reply) => {
    const snapshotId = firstText(req?.params?.snapshot_id);
    if (!snapshotId) return reply.code(400).send({ ok: false, error: "SNAPSHOT_ID_REQUIRED" });
    const row = await readSnapshotRow(pool, snapshotId);
    if (!row) return reply.code(404).send({ ok: false, error: "FIELD_STATE_SNAPSHOT_NOT_FOUND" });
    return reply.send({ ok: true, object_type: "field_state_snapshot_v1", snapshot: exposeSnapshotRow(row) });
  });

  app.post("/api/v1/twin-kernel/forecast-runs", async (req, reply) => {
    const snapshotId = extractSnapshotId(req);
    if (!snapshotId) return reply.code(400).send({ ok: false, error: "SNAPSHOT_ID_REQUIRED" });
    const snapshotRow = await readSnapshotRow(pool, snapshotId);
    if (!snapshotRow) return reply.code(404).send({ ok: false, error: "FIELD_STATE_SNAPSHOT_NOT_FOUND" });
    const modelVersion = extractModelVersion(req) || undefined;
    const forecast = buildForecastRunV1({ snapshot: toForecastRunSnapshotRow(snapshotRow), model_version: modelVersion });
    const row = await insertForecastRun(pool, forecast);
    return reply.send({ ok: true, object_type: "forecast_run_v1", write_ready: true, downstream_write_ready: false, forecast_run: exposeForecastRunRow(row) });
  });

  app.get("/api/v1/twin-kernel/forecast-runs/:forecast_run_id", async (req: any, reply) => {
    const forecastRunId = firstText(req?.params?.forecast_run_id);
    if (!forecastRunId) return reply.code(400).send({ ok: false, error: "FORECAST_RUN_ID_REQUIRED" });
    const row = await queryOne(pool, "SELECT * FROM forecast_run_v1 WHERE forecast_run_id = $1 LIMIT 1", [forecastRunId]);
    if (!row) return reply.code(404).send({ ok: false, error: "FORECAST_RUN_NOT_FOUND" });
    return reply.send({ ok: true, object_type: "forecast_run_v1", forecast_run: exposeForecastRunRow(row) });
  });
}
