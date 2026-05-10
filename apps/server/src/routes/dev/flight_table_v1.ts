import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";

import { requireAoActScopeV0, type AoActAuthContextV0 } from "../../auth/ao_act_authz_v0.js";
import {
  cleanFlightTableRunV1,
  createFlightTableRunV1,
  listFlightTableRunsV1,
  normalizeFlightTableRunIdV1,
  readFlightTableRunV1,
  retryFlightTableStepV1,
  verifyFlightTableRunV1,
} from "../../services/flight_table/flight_table_orchestrator_v1.js";
import { buildFlightVerifyReportV1 } from "../../services/flight_table/flight_table_verify_v1.js";
import { listFlightTableApiSnapshotsV1 } from "../../services/flight_table/flight_table_snapshots_v1.js";

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
  if (message === "FLIGHT_TABLE_RUN_EXISTS") return reply.status(409).send({ ok: false, error: message });
  if (message === "FLIGHT_TABLE_STEP_NOT_FOUND") return reply.status(404).send({ ok: false, error: message });
  return reply.status(500).send({ ok: false, error: "FLIGHT_TABLE_INTERNAL_ERROR", message });
}

export function registerFlightTableV1Routes(app: FastifyInstance, _pool: Pool): void {
  app.post("/api/v1/dev/flight-table/runs", async (req, reply) => {
    const auth = requireFlightTableAdmin(req, reply);
    if (!auth) return;
    try {
      const body: any = req.body ?? {};
      const run = await createFlightTableRunV1({
        run_id: body.run_id,
        tenant_id: body.tenant_id,
        project_id: body.project_id,
        group_id: body.group_id,
        lane: body.lane,
      }, auth);
      return reply.send({ ok: true, run });
    } catch (err) {
      return routeError(reply, err);
    }
  });

  app.get("/api/v1/dev/flight-table/runs", async (req, reply) => {
    const auth = requireFlightTableAdmin(req, reply);
    if (!auth) return;
    const runs = (await listFlightTableRunsV1()).filter((run) => assertRunScope(run, auth));
    return reply.send({ ok: true, runs });
  });

  app.get("/api/v1/dev/flight-table/runs/:runId", async (req, reply) => {
    const auth = requireFlightTableAdmin(req, reply);
    if (!auth) return;
    const runId = normalizeFlightTableRunIdV1((req.params as any)?.runId);
    if (!runId) return badRequest(reply, "FLIGHT_TABLE_INVALID_RUN_ID");
    const run = await readFlightTableRunV1(runId);
    if (!run || !assertRunScope(run, auth)) return notFound(reply);
    return reply.send({ ok: true, run });
  });

  app.post("/api/v1/dev/flight-table/runs/:runId/verify", async (req, reply) => {
    const auth = requireFlightTableAdmin(req, reply);
    if (!auth) return;
    const runId = normalizeFlightTableRunIdV1((req.params as any)?.runId);
    if (!runId) return badRequest(reply, "FLIGHT_TABLE_INVALID_RUN_ID");
    try {
      const existing = await readFlightTableRunV1(runId);
      if (!existing || !assertRunScope(existing, auth)) return notFound(reply);
      const run = await verifyFlightTableRunV1(runId);
      if (!run) return notFound(reply);
      return reply.send({ ok: true, run, verify_report: buildFlightVerifyReportV1(run) });
    } catch (err) {
      return routeError(reply, err);
    }
  });

  app.post("/api/v1/dev/flight-table/runs/:runId/clean", async (req, reply) => {
    const auth = requireFlightTableAdmin(req, reply);
    if (!auth) return;
    const runId = normalizeFlightTableRunIdV1((req.params as any)?.runId);
    if (!runId) return badRequest(reply, "FLIGHT_TABLE_INVALID_RUN_ID");
    try {
      const existing = await readFlightTableRunV1(runId);
      if (!existing || !assertRunScope(existing, auth)) return notFound(reply);
      const run = await cleanFlightTableRunV1(runId);
      if (!run) return notFound(reply);
      return reply.send({ ok: true, run });
    } catch (err) {
      return routeError(reply, err);
    }
  });

  app.post("/api/v1/dev/flight-table/runs/:runId/steps/:stepKey/retry", async (req, reply) => {
    const auth = requireFlightTableAdmin(req, reply);
    if (!auth) return;
    const runId = normalizeFlightTableRunIdV1((req.params as any)?.runId);
    const stepKey = String((req.params as any)?.stepKey ?? "").trim();
    if (!runId) return badRequest(reply, "FLIGHT_TABLE_INVALID_RUN_ID");
    if (!stepKey) return badRequest(reply, "FLIGHT_TABLE_INVALID_STEP_KEY");
    try {
      const existing = await readFlightTableRunV1(runId);
      if (!existing || !assertRunScope(existing, auth)) return notFound(reply);
      const run = await retryFlightTableStepV1(runId, stepKey);
      if (!run) return notFound(reply);
      return reply.send({ ok: true, run });
    } catch (err) {
      return routeError(reply, err);
    }
  });

  app.get("/api/v1/dev/flight-table/runs/:runId/manifest", async (req, reply) => {
    const auth = requireFlightTableAdmin(req, reply);
    if (!auth) return;
    const runId = normalizeFlightTableRunIdV1((req.params as any)?.runId);
    if (!runId) return badRequest(reply, "FLIGHT_TABLE_INVALID_RUN_ID");
    const run = await readFlightTableRunV1(runId);
    if (!run || !assertRunScope(run, auth)) return notFound(reply);
    return reply.send({ ok: true, run_id: run.run_id, manifest: run.manifest });
  });

  app.get("/api/v1/dev/flight-table/runs/:runId/verify-report", async (req, reply) => {
    const auth = requireFlightTableAdmin(req, reply);
    if (!auth) return;
    const runId = normalizeFlightTableRunIdV1((req.params as any)?.runId);
    if (!runId) return badRequest(reply, "FLIGHT_TABLE_INVALID_RUN_ID");
    const run = await readFlightTableRunV1(runId);
    if (!run || !assertRunScope(run, auth)) return notFound(reply);
    return reply.send({ ok: true, verify_report: buildFlightVerifyReportV1(run) });
  });

  app.get("/api/v1/dev/flight-table/runs/:runId/api-snapshots", async (req, reply) => {
    const auth = requireFlightTableAdmin(req, reply);
    if (!auth) return;
    const runId = normalizeFlightTableRunIdV1((req.params as any)?.runId);
    if (!runId) return badRequest(reply, "FLIGHT_TABLE_INVALID_RUN_ID");
    const run = await readFlightTableRunV1(runId);
    if (!run || !assertRunScope(run, auth)) return notFound(reply);
    const snapshots = await listFlightTableApiSnapshotsV1(run.run_id);
    return reply.send({ ok: true, run_id: run.run_id, snapshots });
  });
}
