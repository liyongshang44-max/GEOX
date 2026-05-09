import type { FastifyInstance } from "fastify";

const DATA_SCOPE = "OFFICIAL_OPERATOR_API";

function basePayload(source: string) {
  return {
    source,
    dataScope: DATA_SCOPE,
    generated_at: new Date().toISOString(),
  };
}

export function registerOperatorV1FacadeRoutes(app: FastifyInstance): void {
  app.get("/api/v1/operator/devices-alerts", async (_req, reply) => {
    return reply.send({
      ...basePayload("operator_devices_alerts_api"),
      devices: [],
      alerts: [],
      ackCloseReady: false,
      revokeVisible: false,
      message: "operator devices-alerts read-only facade",
    });
  });

  app.get("/api/v1/operator/field-memory", async (_req, reply) => {
    return reply.send({
      ...basePayload("operator_field_memory_api"),
      items: [],
    });
  });

  app.get("/api/v1/operator/roi-ledger", async (_req, reply) => {
    return reply.send({
      ...basePayload("operator_roi_ledger_api"),
      items: [],
    });
  });
}
