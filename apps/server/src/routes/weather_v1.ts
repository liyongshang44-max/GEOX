import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { createWeatherProviderV1 } from "../services/weather_provider_v1.js";

function isIsoDatetime(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

export function registerWeatherV1Routes(app: FastifyInstance, _pool: Pool): void {
  const provider = createWeatherProviderV1();

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

    const weather = await provider.getHistory({ field_id, from, to });
    return reply.code(200).send(weather);
  });

  app.get("/api/v1/weather/forecast", async (req, reply) => {
    const query = (req as any).query ?? {};
    const field_id = String(query.field_id ?? "").trim();
    if (!field_id) {
      return reply.code(400).send({ ok: false, error: "BAD_REQUEST", message: "field_id is required" });
    }

    const weather = await provider.getForecast({ field_id });
    return reply.code(200).send(weather);
  });
}
