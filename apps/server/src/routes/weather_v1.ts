import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

type WeatherEventType = "RAIN" | "FORECAST_RAIN" | "UNKNOWN";

type WeatherEvent = {
  event_type: WeatherEventType;
  started_at: string;
  ended_at: string | null;
  rainfall_mm: number | null;
};

type WeatherEnvelope = {
  source: string;
  field_id: string;
  from: string;
  to: string;
  rainfall_mm: number | null;
  confidence: number | null;
  events: WeatherEvent[];
};

function isIsoDatetime(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function buildWeatherEnvelope(input: { field_id: string; from: string; to: string; source: string; event_type: WeatherEventType }): WeatherEnvelope {
  return {
    source: input.source,
    field_id: input.field_id,
    from: input.from,
    to: input.to,
    rainfall_mm: null,
    confidence: null,
    events: [
      {
        event_type: input.event_type,
        started_at: input.from,
        ended_at: input.to,
        rainfall_mm: null,
      },
    ],
  };
}

export function registerWeatherV1Routes(app: FastifyInstance, _pool: Pool): void {
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

    return reply.code(200).send(buildWeatherEnvelope({ field_id, from, to, source: "weather_history_stub_v1", event_type: "RAIN" }));
  });

  app.get("/api/v1/weather/forecast", async (req, reply) => {
    const query = (req as any).query ?? {};
    const field_id = String(query.field_id ?? "").trim();
    if (!field_id) {
      return reply.code(400).send({ ok: false, error: "BAD_REQUEST", message: "field_id is required" });
    }

    const now = new Date();
    const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return reply.code(200).send(
      buildWeatherEnvelope({
        field_id,
        from: now.toISOString(),
        to: horizon.toISOString(),
        source: "weather_forecast_stub_v1",
        event_type: "FORECAST_RAIN",
      }),
    );
  });
}
