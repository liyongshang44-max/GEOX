import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";

import { readTokenFileV0, requireAoActScopeV0, type AoActAuthContextV0 } from "../../auth/ao_act_authz_v0.js";
import { normalizeFlightTableRunIdV1, readFlightTableRunV1 } from "../../services/flight_table/flight_table_orchestrator_v1.js";
import { updateFlightTableRunAfterSkillsV1 } from "../../services/flight_table/flight_table_skills_run_update_v1.js";
import {
  bindFlightTableSkillsV1,
  failOneFlightTableSkillV1,
  restoreFlightTableSkillsV1,
} from "../../services/flight_table/flight_table_skills_v1.js";

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
  if (message === "INVALID_BODY") return badRequest(reply, message);
  if (message.startsWith("INVALID_BODY:")) return badRequest(reply, "INVALID_BODY");
  return reply.status(500).send({ ok: false, error: "FLIGHT_TABLE_SKILL_INTERNAL_ERROR", message });
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

function registerOperatorSkillTraceFallback(app: FastifyInstance, pool: Pool): void {
  app.addHook("onRequest", async (req, reply) => {
    if (!flightTableEnabled()) return;
    const pathOnly = String(req.url ?? "").split("?")[0];
    if (req.method !== "GET" || (pathOnly !== "/api/v1/operator/skill-traces" && pathOnly !== "/api/v1/operator/skill-performance")) return;
    const auth = silentAdminAuth(req);
    if (!auth) return;
    const url = new URL(String(req.url ?? "/"), "http://localhost");
    const operationId = String(url.searchParams.get("operation_id") ?? "").trim();
    if (!operationId.startsWith("ft_op_")) return;
    if (pathOnly === "/api/v1/operator/skill-traces") {
      const q = await pool.query(
        `SELECT fact_id, occurred_at, record_json::jsonb AS record_json
           FROM facts
          WHERE (record_json::jsonb->>'type') IN ('skill_run_v1','skill_trace_v1')
            AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
            AND (record_json::jsonb#>>'{payload,project_id}') = $2
            AND (record_json::jsonb#>>'{payload,group_id}') = $3
            AND (record_json::jsonb#>>'{payload,operation_id}') = $4
          ORDER BY occurred_at DESC
          LIMIT 200`,
        [auth.tenant_id, auth.project_id, auth.group_id, operationId],
      ).catch(() => ({ rows: [] as any[] }));
      const items = (q.rows ?? []).map((row: any) => {
        const payload = row.record_json?.payload ?? {};
        return {
          skill_trace_id: String(payload.trace_id ?? payload.run_id ?? row.fact_id),
          operation_id: operationId,
          skill_id: String(payload.skill_id ?? ""),
          skill_version: String(payload.skill_version ?? payload.version ?? "v1"),
          classification: String(payload.skill_category ?? payload.category ?? "UNKNOWN"),
          binding_scope: String(payload.binding_scope ?? payload.bind_target ?? "operation"),
          input_summary: String(payload.input_digest ?? ""),
          output_summary: String(payload.output_digest ?? ""),
          last_run_status: String(payload.status ?? payload.result_status ?? "UNKNOWN"),
          failure_reason: payload.failure_reason ?? payload.error_code ?? null,
          evidence_refs: Array.isArray(payload.evidence_refs) ? payload.evidence_refs : [],
          created_at: row.occurred_at,
        };
      });
      return reply.send({ ok: true, source: "operator_skill_traces", dataScope: "OFFICIAL_OPERATOR_API", generated_at: new Date().toISOString(), operation_id: operationId, items });
    }
    const q = await pool.query(
      `SELECT skill_id, field_id, operation_id, confidence, delta_value, learning_excluded_reason, occurred_at
         FROM field_memory_v1
        WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3
          AND operation_id = $4 AND memory_type = 'SKILL_PERFORMANCE_MEMORY'
        ORDER BY occurred_at DESC
        LIMIT 200`,
      [auth.tenant_id, auth.project_id, auth.group_id, operationId],
    ).catch(() => ({ rows: [] as any[] }));
    const items = (q.rows ?? []).map((row: any) => ({
      skill_id: String(row.skill_id ?? ""),
      field_id: row.field_id ?? null,
      operation_id: operationId,
      run_count: 1,
      success_count: Number(row.delta_value ?? 0) >= 0 ? 1 : 0,
      failure_count: Number(row.delta_value ?? 0) < 0 ? 1 : 0,
      success_rate: Number(row.delta_value ?? 0) >= 0 ? 1 : 0,
      last_run_status: Number(row.delta_value ?? 0) >= 0 ? "SUCCESS" : "FAILED",
      last_run_at: row.occurred_at,
      performance_summary: row.learning_excluded_reason ? `失败：${row.learning_excluded_reason}` : "技能表现已记录",
    }));
    return reply.send({ ok: true, source: "operator_skill_performance", dataScope: "OFFICIAL_OPERATOR_API", generated_at: new Date().toISOString(), operation_id: operationId, items });
  });
}

export function registerFlightTableSkillRoutesV1(app: FastifyInstance, pool: Pool): void {
  registerOperatorSkillTraceFallback(app, pool);

  app.post("/api/v1/dev/flight-table/runs/:runId/skills/bind", async (req, reply) => {
    const auth = requireFlightTableAdmin(req, reply);
    if (!auth) return;
    const runId = normalizeFlightTableRunIdV1((req.params as any)?.runId);
    if (!runId) return badRequest(reply, "FLIGHT_TABLE_INVALID_RUN_ID");
    try {
      const run = await readFlightTableRunV1(runId);
      if (!run || !assertRunScope(run, auth)) return notFound(reply);
      const result = await bindFlightTableSkillsV1(pool, run, auth);
      const nextRun = await updateFlightTableRunAfterSkillsV1(run, result, "bind");
      return reply.send({ ...result, run: nextRun });
    } catch (err) {
      return routeError(reply, err);
    }
  });

  app.post("/api/v1/dev/flight-table/runs/:runId/skills/fail-one", async (req, reply) => {
    const auth = requireFlightTableAdmin(req, reply);
    if (!auth) return;
    const runId = normalizeFlightTableRunIdV1((req.params as any)?.runId);
    if (!runId) return badRequest(reply, "FLIGHT_TABLE_INVALID_RUN_ID");
    try {
      const run = await readFlightTableRunV1(runId);
      if (!run || !assertRunScope(run, auth)) return notFound(reply);
      const result = await failOneFlightTableSkillV1(pool, run, auth, (req.body as any)?.failure_type);
      const nextRun = await updateFlightTableRunAfterSkillsV1(run, result, "fail-one");
      return reply.send({ ...result, run: nextRun });
    } catch (err) {
      return routeError(reply, err);
    }
  });

  app.post("/api/v1/dev/flight-table/runs/:runId/skills/restore", async (req, reply) => {
    const auth = requireFlightTableAdmin(req, reply);
    if (!auth) return;
    const runId = normalizeFlightTableRunIdV1((req.params as any)?.runId);
    if (!runId) return badRequest(reply, "FLIGHT_TABLE_INVALID_RUN_ID");
    try {
      const run = await readFlightTableRunV1(runId);
      if (!run || !assertRunScope(run, auth)) return notFound(reply);
      const result = await restoreFlightTableSkillsV1(pool, run, auth);
      const nextRun = await updateFlightTableRunAfterSkillsV1(run, result, "restore");
      return reply.send({ ...result, run: nextRun });
    } catch (err) {
      return routeError(reply, err);
    }
  });
}
