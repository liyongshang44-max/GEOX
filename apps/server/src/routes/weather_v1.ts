import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import {
  getLatestWeatherForecastIndexV1,
  ingestWeatherForecastFactV1,
} from "../projections/weather_forecast_v1.js";
import { buildUnavailableWeatherV1, computeGeometryCentroidV1, createWeatherProviderV1, type WeatherLocationV1 } from "../services/weather_provider_v1.js";

function isIsoDatetime(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

type OperationWeatherContextSeedV1 = {
  field_id: string | null;
  started_at?: unknown;
  finished_at?: unknown;
  planned_start_at?: unknown;
  planned_end_at?: unknown;
  updated_at?: unknown;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function parseJsonRecord(value: unknown): any {
  if (value && typeof value === "object") return value;
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return null; }
  }
  return null;
}

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    const raw = text(value);
    if (raw) return raw;
  }
  return null;
}

function isoOrNull(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return new Date(ms).toISOString();
}

function operationWeatherWindow(op: OperationWeatherContextSeedV1 | null): { from: string; to: string } {
  const now = Date.now();
  const fallbackFrom = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const fallbackTo = new Date(now).toISOString();
  const from = isoOrNull(op?.started_at) ?? isoOrNull(op?.planned_start_at) ?? isoOrNull(op?.updated_at) ?? fallbackFrom;
  const to = isoOrNull(op?.finished_at) ?? isoOrNull(op?.planned_end_at) ?? fallbackTo;
  return Date.parse(to) > Date.parse(from) ? { from, to } : { from, to: fallbackTo };
}

function rainfallTotal(...values: Array<number | null | undefined>): number | null {
  const nums = values.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0);
}

export function registerWeatherV1Routes(app: FastifyInstance, _pool: Pool): void {
  const provider = createWeatherProviderV1();
  const pool = _pool;

  app.post("/api/v1/weather/forecast/ingest", async (req, reply) => {
    const body = ((req as any).body ?? {}) as any;
    const q = ((req as any).query ?? {}) as any;

    const tenant = {
      tenant_id: String(body.tenant_id ?? q.tenant_id ?? "tenantA"),
      project_id: String(body.project_id ?? q.project_id ?? "projectA"),
      group_id: String(body.group_id ?? q.group_id ?? "groupA"),
    };

    const fieldId = String(body.field_id ?? q.field_id ?? "").trim();
    if (!fieldId) return reply.code(400).send({ ok: false, error: "MISSING_FIELD_ID" });

    const nowIso = new Date().toISOString();
    const horizonHours = Number.isFinite(Number(body.horizon_hours)) ? Number(body.horizon_hours) : 72;
    const validTo = new Date(Date.parse(nowIso) + horizonHours * 60 * 60 * 1000).toISOString();

    const forecast = await ingestWeatherForecastFactV1(pool, {
      forecast_id: String(body.forecast_id ?? "").trim() || undefined,
      tenant_id: tenant.tenant_id,
      project_id: tenant.project_id,
      group_id: tenant.group_id,
      field_id: fieldId,
      provider: String(body.provider ?? "MOCK"),
      source_type: body.source_type ?? "MOCK",
      source_id: String(body.source_id ?? "weather_forecast_ingest_mock"),
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      generated_at: body.generated_at ?? nowIso,
      valid_from: body.valid_from ?? nowIso,
      valid_to: body.valid_to ?? validTo,
      horizon_hours: horizonHours,
      rainfall_forecast_mm_72h: body.rainfall_forecast_mm_72h ?? null,
      temperature_max_c_72h: body.temperature_max_c_72h ?? null,
      et0_mm_72h: body.et0_mm_72h ?? null,
      hourly: Array.isArray(body.hourly) ? body.hourly : [],
      quality: body.quality ?? { stale: false, missing_fields: [], provider_status: "OK" },
      raw_payload: body.raw_payload ?? null,
    });

    return reply.code(200).send({ ok: true, weather_forecast_fact_v1: forecast });
  });

  app.get("/api/v1/weather/forecast/latest", async (req, reply) => {
    const q = ((req as any).query ?? {}) as any;
    const tenant = {
      tenant_id: String(q.tenant_id ?? "tenantA"),
      project_id: String(q.project_id ?? "projectA"),
      group_id: String(q.group_id ?? "groupA"),
    };

    const fieldId = String(q.field_id ?? "").trim();
    if (!fieldId) return reply.code(400).send({ ok: false, error: "MISSING_FIELD_ID" });

    const latest = await getLatestWeatherForecastIndexV1(pool, tenant, fieldId);
    if (!latest) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });

    return reply.code(200).send({ ok: true, weather_forecast_v1: latest });
  });


  async function resolveFieldLocation(field_id: string): Promise<WeatherLocationV1 | null> {
    let raw: unknown = null;
    try {
      const q = await pool.query(`SELECT polygon_geojson_json AS geojson FROM field_polygon_v1 WHERE field_id = $1 ORDER BY updated_ts_ms DESC LIMIT 1`, [field_id]);
      raw = q.rows?.[0]?.geojson ?? null;
    } catch {
      raw = null;
    }
    let parsed: unknown = raw;
    if (typeof raw === "string") {
      try { parsed = JSON.parse(raw); } catch { parsed = raw; }
    }
    const centroid = computeGeometryCentroidV1(parsed);
    if (centroid) return centroid;

    const policy = (process.env.WEATHER_DEFAULT_LOCATION_POLICY ?? "").trim();
    const [latText, lonText] = policy.split(",").map((v) => v.trim());
    const latitude = Number(latText);
    const longitude = Number(lonText);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }
    return null;
  }

  app.get("/api/v1/weather/history", async (req, reply) => {
    const query = (req as any).query ?? {};
    const field_id = String(query.field_id ?? "").trim();
    const from = String(query.from ?? "").trim();
    const to = String(query.to ?? "").trim();

    if (!field_id || !from || !to) {
      return reply.code(400).send({ ok: false, error: "BAD_REQUEST", message: "field_id, from, to are required" });
    }
    if (!isIsoDatetime(from) || !isIsoDatetime(to)) {
      return reply.code(400).send({ ok: false, error: "BAD_REQUEST", message: "from and to must be valid datetime strings" });
    }

    const location = await resolveFieldLocation(field_id);
    if (!location) return reply.code(200).send(buildUnavailableWeatherV1({ field_id, from, to, reason: "location_unavailable" }));
    try {
      const weather = await provider.getHistory({ field_id, from, to, location });
      return reply.code(200).send(weather);
    } catch {
      return reply.code(200).send(buildUnavailableWeatherV1({ field_id, from, to, reason: "provider_error" }));
    }
  });

  app.get("/api/v1/weather/operation-environment-context", async (req, reply) => {
    const query = (req as any).query ?? {};
    const operation_id = String(query.operation_id ?? "").trim();

    if (!operation_id) {
      return reply.code(400).send({ ok: false, error: "BAD_REQUEST", message: "operation_id is required" });
    }

    const unavailable = (reason: string, field_id: string | null = null, explanation?: string) => reply.code(200).send({
      status: "unavailable",
      unavailable_reason: reason,
      source: `weather_operation_environment_context_v1:${reason}`,
      operation_id,
      field_id,
      history: null,
      forecast: null,
      rainfall_may_explain_soil_moisture_change: null,
      learning_weather_interference_excluded: null,
      explanation: explanation ?? "天气环境上下文暂不可用；页面应显示空态，不作为错误处理。",
    });

    let op: OperationWeatherContextSeedV1 | null = null;

    try {
      const q = await pool.query(
        `SELECT *
           FROM operation_state_v1
          WHERE operation_id = $1 OR operation_plan_id = $1
          LIMIT 1`,
        [operation_id],
      );
      const row = q.rows?.[0] ?? null;
      if (row) {
        op = {
          field_id: firstText(row.field_id, row.fieldId),
          started_at: row.started_at ?? row.execution_started_at ?? row.dispatched_at,
          finished_at: row.finished_at ?? row.execution_finished_at ?? row.completed_at,
          planned_start_at: row.planned_start_at ?? row.plan_start_at,
          planned_end_at: row.planned_end_at ?? row.plan_end_at,
          updated_at: row.updated_at ?? row.freshness?.updated_at,
        };
      }
    } catch {
      op = null;
    }

    if (!op?.field_id) {
      try {
        const q = await pool.query(
          `SELECT record_json
             FROM facts
            WHERE record_json::jsonb->>'type' = 'operation_plan_v1'
              AND (
                record_json::jsonb#>>'{payload,operation_plan_id}' = $1
                OR record_json::jsonb#>>'{payload,operation_id}' = $1
                OR record_json::jsonb#>>'{payload,id}' = $1
              )
            ORDER BY occurred_at DESC NULLS LAST, ingested_at DESC NULLS LAST
            LIMIT 1`,
          [operation_id],
        );
        const parsed = parseJsonRecord(q.rows?.[0]?.record_json);
        const payload = parsed?.payload ?? {};
        op = {
          field_id: firstText(payload.field_id, payload.field_ref?.field_id, payload.target?.field_id),
          planned_start_at: payload.time_window?.start_ts ?? payload.time_window?.from ?? payload.planned_start_at,
          planned_end_at: payload.time_window?.end_ts ?? payload.time_window?.to ?? payload.planned_end_at,
          updated_at: parsed?.occurred_at ?? payload.updated_at,
        };
      } catch {
        op = null;
      }
    }

    const field_id = String(op?.field_id ?? "").trim();
    if (!field_id) return unavailable("operation_field_unavailable", null, "作业未绑定地块，天气环境上下文不可用。");

    const { from, to } = operationWeatherWindow(op);
    const location = await resolveFieldLocation(field_id);
    if (!location) return unavailable("location_unavailable", field_id, "作业地块位置不可用，天气环境上下文不可用。");

    try {
      const [history, forecast] = await Promise.all([
        provider.getHistory({ field_id, from, to, location }),
        provider.getForecast({ field_id, location }),
      ]);
      const rainfall = rainfallTotal(history.rainfall_mm, forecast.rainfall_mm);
      const hasRain = rainfall != null ? rainfall > 0 : null;
      return reply.code(200).send({
        status: "ok",
        unavailable_reason: null,
        source: "weather_operation_environment_context_v1",
        operation_id,
        field_id,
        history,
        forecast,
        rainfall_may_explain_soil_moisture_change: hasRain,
        learning_weather_interference_excluded: hasRain,
        explanation: hasRain
          ? "作业影响窗口内存在降雨信号，学习结论应排除或降低天气干扰置信度。"
          : "作业影响窗口内未发现明显降雨信号，天气仅作为验收背景参考。",
      });
    } catch {
      return unavailable("provider_error", field_id, "天气服务暂不可用，页面应显示天气空态。");
    }
  });

  app.get("/api/v1/weather/forecast", async (req, reply) => {
    const query = (req as any).query ?? {};
    const field_id = String(query.field_id ?? "").trim();
    if (!field_id) {
      return reply.code(400).send({ ok: false, error: "BAD_REQUEST", message: "field_id is required" });
    }

    const now = new Date().toISOString();
    const to = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const location = await resolveFieldLocation(field_id);
    if (!location) return reply.code(200).send(buildUnavailableWeatherV1({ field_id, from: now, to, reason: "location_unavailable" }));
    try {
      const weather = await provider.getForecast({ field_id, location });
      return reply.code(200).send(weather);
    } catch {
      return reply.code(200).send(buildUnavailableWeatherV1({ field_id, from: now, to, reason: "provider_error" }));
    }
  });
}
