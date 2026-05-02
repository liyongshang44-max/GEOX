import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js";
import {
  cancelSkillRuntimeV1,
  executeSkillRuntimeV1,
  getSkillRunRuntimeResultV1,
  getSkillRunRuntimeStatusV1,
  getSkillRunRuntimeV1,
  getSkillRuntimeHealthV1,
  type TenantTriple,
} from "../services/skills/runtime_v1.js";
import { getSkillTraceByIdV1 } from "../services/skills/trace_store_v1.js";

function requireTenantMatchOr404(auth: TenantTriple, tenant: TenantTriple, reply: any): boolean {
  if (auth.tenant_id !== tenant.tenant_id || auth.project_id !== tenant.project_id || auth.group_id !== tenant.group_id) {
    reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return false;
  }
  return true;
}

function tenantFromAuthAndQuery(auth: TenantTriple, req: any): TenantTriple {
  const q = (req.query ?? {}) as any;
  return {
    tenant_id: String(q.tenant_id ?? auth.tenant_id).trim(),
    project_id: String(q.project_id ?? auth.project_id).trim(),
    group_id: String(q.group_id ?? auth.group_id).trim(),
  };
}

export function registerSkillRuntimeV1Routes(app: FastifyInstance, pool: Pool): void {
  app.post("/api/v1/skill/execute", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
    if (!auth) return;
    const body = (req.body ?? {}) as any;
    const tenant: TenantTriple = {
      tenant_id: String(body.tenant_id ?? auth.tenant_id).trim(),
      project_id: String(body.project_id ?? auth.project_id).trim(),
      group_id: String(body.group_id ?? auth.group_id).trim(),
    };
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const skill_id = String(body.skill_id ?? "").trim();
    const version = String(body.version ?? "").trim();
    if (!skill_id || !version) {
      return reply.code(400).send({ ok: false, error: "INVALID_BODY", message: "skill_id and version are required" });
    }
    const category = String(body.category ?? "").trim().toUpperCase();
    const approvalId = String(body?.input?.approval_id ?? "").trim();
    if (category === "DEVICE" || skill_id === "mock_valve_control_skill_v1") {
      if (!approvalId) return reply.code(403).send({ ok: false, error: "APPROVAL_REQUIRED" });
      const approvalQ = await pool.query(
        `SELECT record_json::jsonb AS record_json
           FROM facts
          WHERE (record_json::jsonb->>'type') IN ('approval_decision_v1','approval_decision_made_v1')
            AND ((record_json::jsonb#>>'{payload,approval_request_id}') = $1 OR (record_json::jsonb#>>'{payload,approval_id}') = $1)
            AND (record_json::jsonb#>>'{payload,tenant_id}') = $2
            AND (record_json::jsonb#>>'{payload,project_id}') = $3
            AND (record_json::jsonb#>>'{payload,group_id}') = $4
          ORDER BY occurred_at DESC
          LIMIT 1`,
        [approvalId, tenant.tenant_id, tenant.project_id, tenant.group_id]
      );
      const decision = String(approvalQ.rows?.[0]?.record_json?.payload?.decision ?? "").toUpperCase();
      if (!["APPROVE", "APPROVED"].includes(decision)) return reply.code(403).send({ ok: false, error: "DEVICE_SKILL_EXECUTION_BLOCKED" });
    }

    const created = await executeSkillRuntimeV1(pool, {
      ...tenant,
      skill_id,
      version,
      category: body.category,
      bind_target: body.bind_target,
      field_id: typeof body.field_id === "string" ? body.field_id : null,
      device_id: typeof body.device_id === "string" ? body.device_id : null,
      operation_id: typeof body.operation_id === "string" ? body.operation_id : null,
      operation_plan_id: typeof body.operation_plan_id === "string" ? body.operation_plan_id : null,
      input: body.input,
    });

    return reply.code(202).send({ ok: true, skill_run_id: created.run_id, fact_id: created.fact_id, occurred_at: created.occurred_at });
  });

  app.post("/api/v1/skill/cancel/:skill_run_id", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
    if (!auth) return;
    const tenant = tenantFromAuthAndQuery(auth, req);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const skillRunId = String((req.params as any)?.skill_run_id ?? "").trim();
    if (!skillRunId) return reply.code(400).send({ ok: false, error: "INVALID_SKILL_RUN_ID" });

    const cancelled = await cancelSkillRuntimeV1(pool, tenant, skillRunId);
    if (!cancelled) return reply.code(404).send({ ok: false, error: "SKILL_RUN_NOT_FOUND" });
    return reply.send({ ok: true, skill_run_id: cancelled.run_id, fact_id: cancelled.fact_id, occurred_at: cancelled.occurred_at });
  });

  app.get("/api/v1/skill/status/:skill_run_id", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromAuthAndQuery(auth, req);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const skillRunId = String((req.params as any)?.skill_run_id ?? "").trim();
    if (!skillRunId) return reply.code(400).send({ ok: false, error: "INVALID_SKILL_RUN_ID" });

    const status = await getSkillRunRuntimeStatusV1(pool, tenant, skillRunId);
    if (!status) return reply.code(404).send({ ok: false, error: "SKILL_RUN_NOT_FOUND" });
    return reply.send({ ok: true, item: status });
  });

  app.get("/api/v1/skill/results/:skill_run_id", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromAuthAndQuery(auth, req);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const skillRunId = String((req.params as any)?.skill_run_id ?? "").trim();
    if (!skillRunId) return reply.code(400).send({ ok: false, error: "INVALID_SKILL_RUN_ID" });

    const result = await getSkillRunRuntimeResultV1(pool, tenant, skillRunId);
    if (!result) return reply.code(404).send({ ok: false, error: "SKILL_RUN_NOT_FOUND" });
    return reply.send({ ok: true, item: result, source: "skill_registry_read_v1" });
  });

  app.get("/api/v1/skill/trace/:trace_id", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromAuthAndQuery(auth, req);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const traceId = String((req.params as any)?.trace_id ?? "").trim();
    if (!traceId) return reply.code(400).send({ ok: false, error: "INVALID_TRACE_ID" });

    const trace = await getSkillTraceByIdV1(pool, tenant, traceId);
    if (!trace) return reply.code(404).send({ ok: false, error: "TRACE_NOT_FOUND" });
    return reply.send({ ok: true, item: trace, source: "facts.skill_trace_storage" });
  });

  app.get("/api/v1/skill/runs/:skill_run_id", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromAuthAndQuery(auth, req);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const skillRunId = String((req.params as any)?.skill_run_id ?? "").trim();
    if (!skillRunId) return reply.code(400).send({ ok: false, error: "INVALID_SKILL_RUN_ID" });

    const run = await getSkillRunRuntimeV1(pool, tenant, skillRunId);
    if (!run) return reply.code(404).send({ ok: false, error: "SKILL_RUN_NOT_FOUND" });
    return reply.send({ ok: true, item: run });
  });

  app.get("/api/v1/skill/health", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const health = await getSkillRuntimeHealthV1(pool);
    return reply.send(health);
  });
}
