import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js";
import { projectOperationStateV1 } from "../projections/operation_state_v1.js";
import { normalizeReceiptEvidence } from "../services/receipt_evidence.js";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };
type SlaSummary = {
  total_operations: number;
  success_rate: number;
  invalid_execution_rate: number;
  avg_execution_time_ms: number;
  avg_acceptance_time_ms: number;
};

function tenantFromReq(req: any, auth: any): TenantTriple {
  const q = req.query ?? {};
  return {
    tenant_id: String(q.tenant_id ?? auth.tenant_id),
    project_id: String(q.project_id ?? auth.project_id),
    group_id: String(q.group_id ?? auth.group_id),
  };
}

function requireTenantMatchOr404(auth: TenantTriple, tenant: TenantTriple, reply: any): boolean {
  if (auth.tenant_id !== tenant.tenant_id || auth.project_id !== tenant.project_id || auth.group_id !== tenant.group_id) {
    reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return false;
  }
  return true;
}

function average(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((acc, v) => acc + v, 0) / nums.length;
}

function parseMs(v: unknown): number | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : null;
}

export function registerSlaV1Routes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/sla/summary", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const states = await projectOperationStateV1(pool, tenant);
    const total = states.length;
    const succeeded = states.filter((x) => String(x.final_status ?? "").toUpperCase() === "SUCCEEDED" || String(x.final_status ?? "").toUpperCase() === "SUCCESS").length;
    const invalidExecutions = states.filter((x) => String(x.final_status ?? "").toUpperCase() === "INVALID_EXECUTION").length;

    const planRows = await pool.query(
      `SELECT (record_json::jsonb#>>'{payload,operation_plan_id}') AS operation_plan_id,
              occurred_at
         FROM facts
        WHERE (record_json::jsonb->>'type') = 'ao_act_task_v0'
          AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
          AND (record_json::jsonb#>>'{payload,project_id}') = $2
          AND (record_json::jsonb#>>'{payload,group_id}') = $3`,
      [tenant.tenant_id, tenant.project_id, tenant.group_id],
    ).catch(() => ({ rows: [] as any[] }));

    const receiptRows = await pool.query(
      `SELECT COALESCE((record_json::jsonb#>>'{payload,operation_plan_id}'), '') AS operation_plan_id,
              record_json::jsonb AS record_json,
              occurred_at
         FROM facts
        WHERE (record_json::jsonb->>'type') IN ('ao_act_receipt_v0','ao_act_receipt_v1')
          AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
          AND (record_json::jsonb#>>'{payload,project_id}') = $2
          AND (record_json::jsonb#>>'{payload,group_id}') = $3`,
      [tenant.tenant_id, tenant.project_id, tenant.group_id],
    ).catch(() => ({ rows: [] as any[] }));

    const acceptanceRows = await pool.query(
      `SELECT (record_json::jsonb#>>'{payload,operation_plan_id}') AS operation_plan_id,
              COALESCE((record_json::jsonb#>>'{payload,generated_at}'), occurred_at::text) AS generated_at
         FROM facts
        WHERE (record_json::jsonb->>'type') = 'acceptance_result_v1'
          AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
          AND (record_json::jsonb#>>'{payload,project_id}') = $2
          AND (record_json::jsonb#>>'{payload,group_id}') = $3`,
      [tenant.tenant_id, tenant.project_id, tenant.group_id],
    ).catch(() => ({ rows: [] as any[] }));

    const dispatchedAtByPlan = new Map<string, number>();
    for (const row of planRows.rows ?? []) {
      const planId = String(row.operation_plan_id ?? "").trim();
      const occurredAtMs = parseMs(row.occurred_at);
      if (!planId || occurredAtMs == null) continue;
      const prev = dispatchedAtByPlan.get(planId);
      if (prev == null || occurredAtMs > prev) dispatchedAtByPlan.set(planId, occurredAtMs);
    }

    const executionFinishedAtByPlan = new Map<string, number>();
    for (const row of receiptRows.rows ?? []) {
      const recordJson = row.record_json;
      const normalized = normalizeReceiptEvidence({ fact_id: "", occurred_at: row.occurred_at, record_json: recordJson }, String(recordJson?.type ?? ""));
      const planId = String(row.operation_plan_id ?? normalized.operation_plan_id ?? "").trim();
      const finishedMs = parseMs(normalized.execution_finished_at ?? row.occurred_at);
      if (!planId || finishedMs == null) continue;
      const prev = executionFinishedAtByPlan.get(planId);
      if (prev == null || finishedMs > prev) executionFinishedAtByPlan.set(planId, finishedMs);
    }

    const acceptanceCompletedAtByPlan = new Map<string, number>();
    for (const row of acceptanceRows.rows ?? []) {
      const planId = String(row.operation_plan_id ?? "").trim();
      const completedMs = parseMs(row.generated_at);
      if (!planId || completedMs == null) continue;
      const prev = acceptanceCompletedAtByPlan.get(planId);
      if (prev == null || completedMs > prev) acceptanceCompletedAtByPlan.set(planId, completedMs);
    }

    const executionDurations: number[] = [];
    const acceptanceDurations: number[] = [];
    for (const state of states) {
      const planId = String(state.operation_plan_id ?? state.operation_id ?? "").trim();
      if (!planId) continue;
      const dispatched = dispatchedAtByPlan.get(planId);
      const finished = executionFinishedAtByPlan.get(planId);
      const accepted = acceptanceCompletedAtByPlan.get(planId);
      if (dispatched != null && finished != null && finished >= dispatched) executionDurations.push(finished - dispatched);
      if (accepted != null && finished != null && accepted >= finished) acceptanceDurations.push(accepted - finished);
    }

    const payload: SlaSummary = {
      total_operations: total,
      success_rate: total > 0 ? succeeded / total : 0,
      invalid_execution_rate: total > 0 ? invalidExecutions / total : 0,
      avg_execution_time_ms: Math.round(average(executionDurations)),
      avg_acceptance_time_ms: Math.round(average(acceptanceDurations)),
    };

    return reply.send({ ok: true, ...payload });
  });
}
