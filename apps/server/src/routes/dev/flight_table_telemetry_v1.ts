import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";

import { requireAoActScopeV0, type AoActAuthContextV0 } from "../../auth/ao_act_authz_v0.js";
import { normalizeFlightTableRunIdV1, readFlightTableRunV1 } from "../../services/flight_table/flight_table_orchestrator_v1.js";
import {
  listFlightTableTelemetryScenariosV1,
  publishFlightTableTelemetryScenariosV1,
  verifyFlightTableTelemetryV1,
} from "../../services/flight_table/flight_table_telemetry_v1.js";

function flightTableEnabled(): boolean {
  return String(process.env.ENABLE_FLIGHT_TABLE_API ?? "").trim().toLowerCase() === "true";
}

function disabled(reply: FastifyReply) {
  return reply.status(503).send({ ok: false, error: "FLIGHT_TABLE_DISABLED" });
}

function badRequest(reply: FastifyReply, error: string) {
  return reply.status(400).send({ ok: false, error });
}

function notFound(reply: FastifyReply) {
  return reply.status(404).send({ ok: false, error: "FLIGHT_TABLE_RUN_NOT_FOUND" });
}

function requireFlightTableAdmin(req: FastifyRequest, reply: FastifyReply): AoActAuthContextV0 | null {
  if (!flightTableEnabled()) {
    disabled(reply);
    return null;
  }
  return requireAoActScopeV0(req, reply, "security.admin");
}

function assertRunScope(run: { tenant_id: string; project_id: string; group_id: string }, auth: AoActAuthContextV0): boolean {
  return run.tenant_id === auth.tenant_id && run.project_id === auth.project_id && run.group_id === auth.group_id;
}

function routeError(reply: FastifyReply, err: unknown) {
  const message = String((err as any)?.message ?? err ?? "UNKNOWN_ERROR");
  if (message === "FLIGHT_TABLE_SCOPE_MISMATCH") return reply.status(403).send({ ok: false, error: message });
  if (message === "FLIGHT_TABLE_INVALID_RUN_ID") return badRequest(reply, message);
  if (message === "FLIGHT_TABLE_RUN_NOT_FOUND") return notFound(reply);
  return reply.status(500).send({ ok: false, error: "FLIGHT_TABLE_TELEMETRY_INTERNAL_ERROR", message });
}

export function registerFlightTableTelemetryRoutesV1(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/dev/flight-table/telemetry/scenarios", async (req, reply) => {
    const auth = requireFlightTableAdmin(req, reply);
    if (!auth) return;
    return reply.send({ ok: true, scenarios: listFlightTableTelemetryScenariosV1() });
  });

  app.post("/api/v1/dev/flight-table/runs/:runId/telemetry/publish", async (req, reply) => {
    const auth = requireFlightTableAdmin(req, reply);
    if (!auth) return;
    const runId = normalizeFlightTableRunIdV1((req.params as any)?.runId);
    if (!runId) return badRequest(reply, "FLIGHT_TABLE_INVALID_RUN_ID");
    try {
      const run = await readFlightTableRunV1(runId);
      if (!run || !assertRunScope(run, auth)) return notFound(reply);
      const result = await publishFlightTableTelemetryScenariosV1(pool, run, req.body as any, auth);
      return reply.send(result);
    } catch (err) {
      return routeError(reply, err);
    }
  });

  app.post("/api/v1/dev/flight-table/runs/:runId/telemetry/verify", async (req, reply) => {
    const auth = requireFlightTableAdmin(req, reply);
    if (!auth) return;
    const runId = normalizeFlightTableRunIdV1((req.params as any)?.runId);
    if (!runId) return badRequest(reply, "FLIGHT_TABLE_INVALID_RUN_ID");
    try {
      const run = await readFlightTableRunV1(runId);
      if (!run || !assertRunScope(run, auth)) return notFound(reply);
      const body: any = req.body ?? {};
      const device_id = String(body.device_id ?? run.manifest.device_ids[0] ?? "").trim();
      const field_id = String(body.field_id ?? run.manifest.field_id ?? "").trim();
      if (!device_id) return badRequest(reply, "FLIGHT_TABLE_MISSING_DEVICE_ID");
      if (!field_id) return badRequest(reply, "FLIGHT_TABLE_MISSING_FIELD_ID");
      const verify = await verifyFlightTableTelemetryV1(pool, run, { device_id, field_id });
      return reply.send({ ok: true, run_id: run.run_id, device_id, field_id, verify });
    } catch (err) {
      return routeError(reply, err);
    }
  });
}
