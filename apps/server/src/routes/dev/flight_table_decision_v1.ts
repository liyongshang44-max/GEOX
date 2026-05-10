import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";

import { requireAoActScopeV0, type AoActAuthContextV0 } from "../../auth/ao_act_authz_v0.js";
import { normalizeFlightTableRunIdV1, readFlightTableRunV1 } from "../../services/flight_table/flight_table_orchestrator_v1.js";
import { runFlightTableDecisionPrescriptionApprovalV1 } from "../../services/flight_table/flight_table_decision_v1.js";

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
  if (message === "FLIGHT_TABLE_FIELD_NOT_FOUND" || message === "FLIGHT_TABLE_SEASON_NOT_FOUND") return badRequest(reply, message);
  if (message === "FLIGHT_TABLE_NO_RECOMMENDATION_TRIGGERED") return reply.status(422).send({ ok: false, error: message });
  if (message.startsWith("FLIGHT_TABLE_PRESCRIPTION_CREATE_FAILED")) return reply.status(502).send({ ok: false, error: "FLIGHT_TABLE_PRESCRIPTION_CREATE_FAILED", message });
  if (message.startsWith("FLIGHT_TABLE_SUBMIT_APPROVAL_FAILED")) return reply.status(502).send({ ok: false, error: "FLIGHT_TABLE_SUBMIT_APPROVAL_FAILED", message });
  return reply.status(500).send({ ok: false, error: "FLIGHT_TABLE_DECISION_INTERNAL_ERROR", message });
}

function baseUrl(req: FastifyRequest): string {
  const envBase = String(process.env.GEOX_INTERNAL_BASE_URL ?? "").trim();
  if (envBase) return envBase.replace(/\/+$/, "");
  const host = String((req.headers as any)?.host ?? "127.0.0.1:3001");
  return `http://${host}`;
}

function bearerToken(req: FastifyRequest): string {
  const header = String(req.headers.authorization ?? "");
  const m = header.match(/^Bearer\s+(.+)$/i);
  return String(m?.[1] ?? "").trim();
}

export function registerFlightTableDecisionRoutesV1(app: FastifyInstance, pool: Pool): void {
  app.post("/api/v1/dev/flight-table/runs/:runId/decision/run", async (req, reply) => {
    const auth = requireFlightTableAdmin(req, reply);
    if (!auth) return;
    const runId = normalizeFlightTableRunIdV1((req.params as any)?.runId);
    if (!runId) return badRequest(reply, "FLIGHT_TABLE_INVALID_RUN_ID");
    try {
      const run = await readFlightTableRunV1(runId);
      if (!run || !assertRunScope(run, auth)) return notFound(reply);
      const result = await runFlightTableDecisionPrescriptionApprovalV1({
        pool,
        run,
        input: req.body as any,
        auth,
        baseUrl: baseUrl(req),
        bearerToken: bearerToken(req),
      });
      return reply.send(result);
    } catch (err) {
      return routeError(reply, err);
    }
  });
}
