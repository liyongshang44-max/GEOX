import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";

import { readTokenFileV0, requireAoActScopeV0, type AoActAuthContextV0 } from "../../auth/ao_act_authz_v0.js";
import {
  cleanFlightTableRunV1,
  createFlightTableRunV1,
  listFlightTableRunsV1,
  normalizeFlightTableRunIdV1,
  readFlightTableRunV1,
  retryFlightTableStepV1,
  updateFlightTableRunAfterDevicesV1,
  updateFlightTableRunAfterFieldV1,
  updateFlightTableRunAfterGeometryV1,
  verifyFlightTableRunV1,
} from "../../services/flight_table/flight_table_orchestrator_v1.js";
import { buildFlightVerifyReportV1 } from "../../services/flight_table/flight_table_verify_v1.js";
import { listFlightTableApiSnapshotsV1 } from "../../services/flight_table/flight_table_snapshots_v1.js";
import { createFlightTableFieldV1, normalizeFlightTableFieldInputV1 } from "../../services/flight_table/flight_table_field_v1.js";
import { createFlightTableFieldGeometryV1 } from "../../services/flight_table/flight_table_geometry_v1.js";
import { listFlightTableDeviceTemplatesForApiV1, onboardFlightTableDevicesV1 } from "../../services/flight_table/flight_table_devices_v1.js";
import { listFormalScenarioLaneDefinitionsV1 } from "../../services/scenarios/formal_scenario_lanes_v1.js";

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
  if (message === "FLIGHT_TABLE_INVALID_FIELD_ID") return badRequest(reply, message);
  if (message === "FLIGHT_TABLE_INVALID_SEASON_ID") return badRequest(reply, message);
  if (message === "FLIGHT_TABLE_INVALID_GEOMETRY_FORMAT") return badRequest(reply, message);
  if (message === "FLIGHT_TABLE_INVALID_GEOMETRY") return badRequest(reply, message);
  if (message === "FLIGHT_TABLE_EMPTY_GEOMETRY") return badRequest(reply, message);
  if (message === "FLIGHT_TABLE_FIELD_NOT_FOUND") return reply.status(404).send({ ok: false, error: message });
  if (message === "FLIGHT_TABLE_UNKNOWN_DEVICE_TEMPLATE") return badRequest(reply, message);
  if (message === "FLIGHT_TABLE_RUN_EXISTS") return reply.status(409).send({ ok: false, error: message });
  if (message === "FLIGHT_TABLE_STEP_NOT_FOUND") return reply.status(404).send({ ok: false, error: message });
  return reply.status(500).send({ ok: false, error: "FLIGHT_TABLE_INTERNAL_ERROR", message });
}

function silentAdminAuth(req: FastifyRequest): AoActAuthContextV0 | null {
  const header = req.headers.authorization;
  if (typeof header !== "string") return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  const bearer = String(match?.[1] ?? "").trim();
  if (!bearer) return null;
  const tokenFile = readTokenFileV0();
  const rec: any = tokenFile.tokens.find((item: any) => item?.token === bearer) ?? null;
  if (!rec || rec.revoked) return null;
  if (rec.role !== "admin") return null;
  if (!Array.isArray(rec.scopes) || !rec.scopes.includes("security.admin")) return null;
  if (!rec.tenant_id || !rec.project_id || !rec.group_id) return null;
  return {
    actor_id: String(rec.actor_id ?? ""),
    token_id: String(rec.token_id ?? ""),
    tenant_id: String(rec.tenant_id),
    project_id: String(rec.project_id),
    group_id: String(rec.group_id),
    role: "admin",
    scopes: rec.scopes,
    allowed_field_ids: Array.isArray(rec.allowed_field_ids) ? rec.allowed_field_ids.map((x: unknown) => String(x ?? "").trim()).filter(Boolean) : [],
  };
}

function registerCustomerFieldVisibilityFallback(app: FastifyInstance, pool: Pool): void {
  app.addHook("onRequest", async (req, reply) => {
    if (!flightTableEnabled()) return;
    const pathOnly = String(req.url ?? "").split("?")[0];
    if (req.method !== "GET" || pathOnly !== "/api/v1/customer/fields") return;
    const auth = silentAdminAuth(req);
    if (!auth) return;
    const q = await pool.query(
      `SELECT f.field_id, f.name AS field_name, f.updated_ts_ms, s.crop
         FROM field_index_v1 f
         LEFT JOIN LATERAL (
           SELECT crop
             FROM field_season_index_v1
            WHERE tenant_id = f.tenant_id AND field_id = f.field_id
            ORDER BY updated_ts_ms DESC
            LIMIT 1
         ) s ON true
        WHERE f.tenant_id = $1
        ORDER BY f.updated_ts_ms DESC, f.field_id ASC
        LIMIT 200`,
      [auth.tenant_id],
    ).catch(() => ({ rows: [] as any[] }));
    const fields = (q.rows ?? []).map((row: any) => {
      const updatedTs = Number(row.updated_ts_ms ?? 0);
      return {
        field_id: String(row.field_id ?? ""),
        field_name: String(row.field_name ?? "").trim() || null,
        risk_level: "UNKNOWN",
        risk_reasons: [],
        updated_at: updatedTs > 0 ? new Date(updatedTs).toISOString() : null,
        crop_name: String(row.crop ?? "").trim() || null,
        stage_name: null,
        recent_operation_id: null,
        recent_operation_title: null,
        open_alerts_count: 0,
        pending_acceptance_count: 0,
      };
    });
    return reply.send({
      ok: true,
      source: "customer_fields_api",
      dataScope: "OFFICIAL_CUSTOMER_API",
      customer_scope: "FALLBACK_OR_UNCONFIRMED",
      generated_at: new Date().toISOString(),
      fields,
    });
  });
}

export function registerFlightTableV1Routes(app: FastifyInstance, pool: Pool): void {
  registerCustomerFieldVisibilityFallback(app, pool);

  app.get("/api/v1/dev/flight-table/formal-scenarios", async (req, reply) => {
    const auth = requireFlightTableAdmin(req, reply);
    if (!auth) return;
    const scenarios = listFormalScenarioLaneDefinitionsV1().map((item) => ({
      scenario_type: item.scenario_type,
      lane: item.lane,
      label: item.label,
      release_gate: item.release_gate,
      flight_table_visible: item.flight_table_visible,
    }));
    return reply.send({ ok: true, source: "formal_scenario_lanes_v1", scenarios });
  });

  app.get("/api/v1/dev/flight-table/device-templates", async (req, reply) => {
    const auth = requireFlightTableAdmin(req, reply);
    if (!auth) return;
    return reply.send({ ok: true, templates: listFlightTableDeviceTemplatesForApiV1() });
  });

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

  app.post("/api/v1/dev/flight-table/runs/:runId/field", async (req, reply) => {
    const auth = requireFlightTableAdmin(req, reply);
    if (!auth) return;
    const runId = normalizeFlightTableRunIdV1((req.params as any)?.runId);
    if (!runId) return badRequest(reply, "FLIGHT_TABLE_INVALID_RUN_ID");
    try {
      const run = await readFlightTableRunV1(runId);
      if (!run || !assertRunScope(run, auth)) return notFound(reply);
      const input = normalizeFlightTableFieldInputV1(req.body as any);
      const fieldResult = await createFlightTableFieldV1(pool, run, input, auth);
      const nextRun = await updateFlightTableRunAfterFieldV1(runId, {
        field_id: input.field_id,
        field_name: input.field_name,
        season_id: input.season_id,
        crop: input.crop,
        crop_stage: input.crop_stage,
        customer_visible: fieldResult.customer_visible,
        report_visible: fieldResult.report_visible,
        customer_scope: fieldResult.customer_scope,
      });
      return reply.send({
        ok: true,
        field_id: fieldResult.field_id,
        field_name: fieldResult.field_name,
        customer_visible: fieldResult.customer_visible,
        report_visible: fieldResult.report_visible,
        customer_scope: fieldResult.customer_scope,
        run: nextRun,
      });
    } catch (err) {
      return routeError(reply, err);
    }
  });

  app.post("/api/v1/dev/flight-table/runs/:runId/field-geometry", async (req, reply) => {
    const auth = requireFlightTableAdmin(req, reply);
    if (!auth) return;
    const runId = normalizeFlightTableRunIdV1((req.params as any)?.runId);
    if (!runId) return badRequest(reply, "FLIGHT_TABLE_INVALID_RUN_ID");
    try {
      const run = await readFlightTableRunV1(runId);
      if (!run || !assertRunScope(run, auth)) return notFound(reply);
      const geometryResult = await createFlightTableFieldGeometryV1(pool, run, req.body as any, auth);
      const nextRun = await updateFlightTableRunAfterGeometryV1(runId, {
        field_id: geometryResult.field_id,
        geometry_id: geometryResult.geometry_id,
        geometry_status: geometryResult.geometry_status,
        geometry_format: geometryResult.geometry_format,
        centroid: geometryResult.centroid,
        area_m2: geometryResult.area_m2,
        area_mu: geometryResult.area_mu,
        weather_location: geometryResult.weather_location,
        weather_provider_status: geometryResult.weather_provider_status,
        weather_location_status: geometryResult.weather_location_status,
      });
      return reply.send({ ...geometryResult, run: nextRun });
    } catch (err) {
      return routeError(reply, err);
    }
  });

  app.post("/api/v1/dev/flight-table/runs/:runId/devices", async (req, reply) => {
    const auth = requireFlightTableAdmin(req, reply);
    if (!auth) return;
    const runId = normalizeFlightTableRunIdV1((req.params as any)?.runId);
    if (!runId) return badRequest(reply, "FLIGHT_TABLE_INVALID_RUN_ID");
    try {
      const run = await readFlightTableRunV1(runId);
      if (!run || !assertRunScope(run, auth)) return notFound(reply);
      const deviceResult = await onboardFlightTableDevicesV1(pool, run, req.body as any, auth);
      const nextRun = await updateFlightTableRunAfterDevicesV1(runId, deviceResult);
      return reply.send({ ...deviceResult, run: nextRun });
    } catch (err) {
      return routeError(reply, err);
    }
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
