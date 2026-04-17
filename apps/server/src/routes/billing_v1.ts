import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js";
import { projectOperationStateV1 } from "../projections/operation_state_v1.js";
import { normalizeReceiptEvidence } from "../services/receipt_evidence.js";
import { computeBillingV1 } from "../domain/billing/billing_v1.js";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };

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

export function registerBillingV1Routes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/billing/operation/:id", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const id = String((req.params as any)?.id ?? "").trim();
    if (!id) return reply.status(400).send({ ok: false, error: "MISSING_OPERATION_ID" });

    const states = await projectOperationStateV1(pool, tenant);
    const state = states.find((x) => x.operation_id === id || x.operation_plan_id === id);
    if (!state) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });

    const receiptQ = await pool.query(
      `SELECT fact_id, occurred_at, record_json::jsonb AS record_json
         FROM facts
        WHERE (record_json::jsonb->>'type') IN ('ao_act_receipt_v0','ao_act_receipt_v1')
          AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
          AND (record_json::jsonb#>>'{payload,project_id}') = $2
          AND (record_json::jsonb#>>'{payload,group_id}') = $3
          AND (
            (record_json::jsonb#>>'{payload,operation_plan_id}') = $4
            OR ((record_json::jsonb#>>'{payload,act_task_id}') = $5 OR (record_json::jsonb#>>'{payload,task_id}') = $5)
          )
        ORDER BY occurred_at DESC, fact_id DESC
        LIMIT 1`,
      [tenant.tenant_id, tenant.project_id, tenant.group_id, state.operation_plan_id, state.task_id]
    ).catch(() => ({ rows: [] as any[] }));

    const receiptRow = receiptQ.rows?.[0];
    const normalized = receiptRow
      ? normalizeReceiptEvidence({ fact_id: receiptRow.fact_id, occurred_at: receiptRow.occurred_at, record_json: receiptRow.record_json }, String(receiptRow.record_json?.type ?? ""))
      : null;

    const billing = computeBillingV1({
      final_status: state.final_status,
      water_l: normalized?.water_l,
      electric_kwh: normalized?.electric_kwh,
      chemical_ml: normalized?.chemical_ml,
    });

    return reply.send(billing);
  });
}
