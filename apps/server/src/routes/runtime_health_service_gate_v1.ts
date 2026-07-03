// apps/server/src/routes/runtime_health_service_gate_v1.ts

import type { FastifyInstance } from "fastify";
import { buildP55RuntimeHealthServiceGateReportV1 } from "../runtime_health/p55_runtime_health_service_gate_v1.js";

export function registerRuntimeHealthServiceGateV1Routes(app: FastifyInstance): void {
  app.route({
    method: "GET",
    url: "/api/v1/runtime-health/service-gate",
    handler: async (_req, reply) => {
      return reply.code(200).send(buildP55RuntimeHealthServiceGateReportV1());
    }
  });
}
