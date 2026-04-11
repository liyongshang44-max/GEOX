import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0";
import { enforceFieldScopeOrDeny, enforceOperationFieldScope, hasFieldAccess } from "../auth/route_role_authz";
import { projectOperationStateV1, type OperationStateV1 } from "../projections/operation_state_v1";
import {
  projectOperationReportV1,
  type OperationReportFieldListResponseV1,
  type OperationReportSingleResponseV1,
  type OperationReportV1,
} from "../projections/report_v1";
import { normalizeReceiptEvidence } from "../services/receipt_evidence";
import { computeCostBreakdown } from "../domain/agronomy/cost_model";
import { computeOperationCostV1 } from "../domain/cost_model";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };
type FactRow = { fact_id: string; occurred_at: string; record_json: any };

function toText(v: unknown): string | null {
  if (typeof v === "string") {
    const t = v.trim();
    return t || null;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function parseRecordJson(v: unknown): any {
  if (v && typeof v === "object") return v;
  if (typeof v !== "string" || !v.trim()) return null;
  try { return JSON.parse(v); } catch { return null; }
}

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

async function queryFactsForOperation(pool: Pool, tenant: TenantTriple, operationPlanId: string): Promise<FactRow[]> {
  const q = await pool.query(
    `SELECT fact_id, occurred_at, record_json::jsonb AS record_json
       FROM facts
      WHERE (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND (record_json::jsonb#>>'{payload,project_id}') = $2
        AND (record_json::jsonb#>>'{payload,group_id}') = $3
        AND (
          (record_json::jsonb#>>'{payload,operation_plan_id}') = $4
          OR (record_json::jsonb#>>'{payload,operation_id}') = $4
        )
      ORDER BY occurred_at ASC, fact_id ASC`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, operationPlanId]
  );
  return (q.rows ?? []).map((row: any) => ({
    fact_id: String(row.fact_id ?? ""),
    occurred_at: String(row.occurred_at ?? ""),
    record_json: parseRecordJson(row.record_json) ?? row.record_json,
  }));
}

function buildResponseTimeMs(state: OperationStateV1, executionStartedAt: string | null): number | null {
  const dispatchedTs = state.timeline.find((item) => item.type === "TASK_CREATED")?.ts ?? null;
  const executionStartedTs = executionStartedAt ? Date.parse(executionStartedAt) : NaN;
  if (dispatchedTs == null || !Number.isFinite(executionStartedTs)) return null;
  return Math.max(0, executionStartedTs - dispatchedTs);
}

export async function projectReportV1(params: {
  pool: Pool;
  tenant: TenantTriple;
  operationState: OperationStateV1;
}): Promise<OperationReportV1> {
  const { pool, tenant, operationState } = params;
  const operationPlanId = operationState.operation_plan_id || operationState.operation_id;
  const facts = await queryFactsForOperation(pool, tenant, operationPlanId);

  const acceptanceFact = [...facts].reverse().find((x) => String(x.record_json?.type ?? "") === "acceptance_result_v1") ?? null;
  const receiptFact = [...facts].reverse().find((x) => ["ao_act_receipt_v0", "ao_act_receipt_v1"].includes(String(x.record_json?.type ?? ""))) ?? null;
  const normalizedReceipt = receiptFact
    ? normalizeReceiptEvidence(receiptFact, String(receiptFact.record_json?.type ?? ""))
    : null;

  const receiptPayload = receiptFact?.record_json?.payload ?? {};
  const logs = Array.isArray(receiptPayload?.logs_refs) ? receiptPayload.logs_refs : [];
  const metrics = Array.isArray(receiptPayload?.metrics) ? receiptPayload.metrics : [];
  const photos = Array.isArray(receiptPayload?.photo_refs) ? receiptPayload.photo_refs : [];
  const media = photos.map((ref: unknown) => ({ kind: "photo", ref }));

  const cost = computeCostBreakdown({
    water_l: normalizedReceipt?.water_l,
    electric_kwh: normalizedReceipt?.electric_kwh,
    chemical_ml: normalizedReceipt?.chemical_ml,
  });
  const estimatedCost = computeOperationCostV1(operationState.action_type, {
    water_l: normalizedReceipt?.water_l,
    chemical_ml: normalizedReceipt?.chemical_ml,
  });
  const hasActualCostInput = [
    normalizedReceipt?.water_l,
    normalizedReceipt?.electric_kwh,
    normalizedReceipt?.chemical_ml,
  ].some((x) => typeof x === "number" && Number.isFinite(x));
  const costNotes = [
    "estimated_cost_source:computeOperationCostV1",
    "actual_cost_source:computeCostBreakdown",
  ];
  if (!hasActualCostInput) costNotes.push("actual_cost_missing_usage_fallback_to_zero");
  if (estimatedCost.normalization_note) costNotes.push(estimatedCost.normalization_note);

  const executionSuccess = ["SUCCESS", "SUCCEEDED"].includes(String(operationState.final_status ?? "").toUpperCase());
  const acceptancePass = String(acceptanceFact?.record_json?.payload?.verdict ?? "").toUpperCase().includes("PASS");
  const responseTimeMs = buildResponseTimeMs(operationState, normalizedReceipt?.execution_started_at ?? null);

  return projectOperationReportV1({
    tenant,
    operation_plan_id: operationPlanId,
    operation_state: operationState,
    evidence_bundle: {
      artifacts: [],
      logs,
      media,
      metrics,
    },
    acceptance: acceptanceFact ? {
      verdict: acceptanceFact.record_json?.payload?.verdict,
      missing_evidence: acceptanceFact.record_json?.payload?.missing_evidence,
      generated_at: acceptanceFact.record_json?.payload?.generated_at ?? acceptanceFact.occurred_at,
      status: operationState.acceptance?.status,
    } : null,
    receipt: normalizedReceipt ? {
      execution_started_at: normalizedReceipt.execution_started_at,
      execution_finished_at: normalizedReceipt.execution_finished_at,
    } : null,
    cost: {
      actual_total: hasActualCostInput ? cost.total_cost : 0,
      actual_water_cost: hasActualCostInput ? cost.water_cost : 0,
      actual_electric_cost: hasActualCostInput ? cost.electric_cost : 0,
      actual_chemical_cost: hasActualCostInput ? cost.chemical_cost : 0,
      estimated_total: estimatedCost.estimated_total,
      estimated_water_cost: estimatedCost.estimated_water_cost,
      estimated_chemical_cost: estimatedCost.estimated_chemical_cost,
      estimated_device_cost: estimatedCost.estimated_device_cost,
      estimated_labor_cost: estimatedCost.estimated_labor_cost,
      action_type: estimatedCost.action_type,
      action_resolution: estimatedCost.action_resolution,
      requested_action_type: estimatedCost.requested_action_type,
      cost_quality: hasActualCostInput ? "ESTIMATED_WITH_ACTUAL" : "ESTIMATED_ONLY",
      cost_notes: costNotes,
    },
    sla: {
      execution_success: executionSuccess,
      acceptance_pass: acceptancePass,
      response_time_ms: responseTimeMs,
    },
  });
}

export function registerReportsV1Routes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/reports/operation/:operation_id", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "operations.read");
    if (!auth) return;

    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const operationId = toText((req.params as any)?.operation_id);
    if (!operationId) return reply.status(400).send({ ok: false, error: "MISSING_OPERATION_ID" });

    const states = await projectOperationStateV1(pool, tenant);
    const state = states.find((x) => x.operation_id === operationId || x.operation_plan_id === operationId) ?? null;
    if (!state) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    const scopedFieldId = await enforceOperationFieldScope(
      auth,
      operationId,
      reply,
      async (opId) => {
        const matched = states.find((x) => x.operation_id === opId || x.operation_plan_id === opId) ?? null;
        return matched ? String(matched.field_id ?? "").trim() || null : null;
      },
      { asNotFound: true }
    );
    if (!scopedFieldId) return;

    const operation_report_v1 = await projectReportV1({ pool, tenant, operationState: state });
    const payload: OperationReportSingleResponseV1 = { ok: true, operation_report_v1 };
    return reply.send(payload);
  });

  app.get("/api/v1/reports/field/:field_id", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "operations.read");
    if (!auth) return;

    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const fieldId = toText((req.params as any)?.field_id);
    if (!fieldId) return reply.status(400).send({ ok: false, error: "MISSING_FIELD_ID" });

    const states = await projectOperationStateV1(pool, tenant);
    if (!enforceFieldScopeOrDeny(auth, fieldId, reply, { asNotFound: true })) return;
    const fieldStates = states
      .filter((x) => String(x.field_id ?? "") === fieldId)
      .filter((x) => hasFieldAccess(auth, String(x.field_id ?? "")));

    const items = await Promise.all(fieldStates.map((state) => projectReportV1({
      pool,
      tenant,
      operationState: state,
    })));

    const payload: OperationReportFieldListResponseV1 = { ok: true, items };
    return reply.send(payload);
  });
}
