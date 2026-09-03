import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerRawRoutes } from "../../routes/raw.js";
import { registerTelemetryV1Routes } from "../../routes/telemetry_v1.js";
import { registerDeviceHeartbeatV1Routes } from "../../routes/device_heartbeat_v1.js";
import { registerDeviceStatusV1Routes } from "../../routes/device_status_v1.js";
import { registerWeatherV1Routes } from "../../routes/weather_v1.js";
import { registerSensingFactEnvelopeV1Routes } from "../../routes/sensing_fact_envelope_v1.js";

export const WEAK_INTERNAL_MUTATION_COMMERCIAL_AUTHORITY_ERROR =
  "WEAK_INTERNAL_MUTATION_COMMERCIAL_AUTHORITY_UNAVAILABLE";

function registerCommercialRawRoutes(app: FastifyInstance, pool: Pool): void {
  const originalPost = app.post.bind(app) as any;
  const guardedApp = new Proxy(app as any, {
    get(target, property) {
      if (property === "post") {
        return (path: unknown, ...args: unknown[]) => {
          if (path === "/api/raw") {
            return originalPost(path, async (_req: unknown, reply: any) =>
              reply.code(403).send({
                ok: false,
                error: WEAK_INTERNAL_MUTATION_COMMERCIAL_AUTHORITY_ERROR,
              }),
            );
          }
          return originalPost(path, ...args);
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as FastifyInstance;

  registerRawRoutes(guardedApp, pool);
}

export function registerSensingModule(app: FastifyInstance, pool: Pool): void {
  registerCommercialRawRoutes(app, pool);
  registerTelemetryV1Routes(app, pool);
  registerDeviceHeartbeatV1Routes(app, pool);
  registerDeviceStatusV1Routes(app, pool);
  registerWeatherV1Routes(app, pool);
  registerSensingFactEnvelopeV1Routes(app, pool);
}