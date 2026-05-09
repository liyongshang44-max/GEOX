import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { buildUnavailableWeatherV1, computeGeometryCentroidV1, createWeatherProviderV1, type WeatherLocationV1 } from "../services/weather_provider_v1.js";

function isIsoDatetime(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

export function registerWeatherV1Routes(app: FastifyInstance, _pool: Pool): void {
  const provider = createWeatherProviderV1();
  const pool = _pool;

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
