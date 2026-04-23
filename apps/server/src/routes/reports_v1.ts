import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js";
import { enforceFieldScopeOrDeny, enforceOperationFieldScope, hasFieldAccess } from "../auth/route_role_authz.js";
import { projectOperationStateV1, type OperationStateV1 } from "../projections/operation_state_v1.js";
import {
  projectOperationReportV1,
  type OperationReportFieldListResponseV1,
  type OperationReportSingleResponseV1,
  type OperationReportV1,
} from "../projections/report_v1.js";
import { normalizeReceiptEvidence } from "../services/receipt_evidence.js";
import { computeOperationCostV1 } from "../domain/cost_model.js";
import { toCustomerFacingActionLabel } from "../domain/controlplane/irrigation_action_mapping_v1.js";
import { listAlertOperationRelationV1ByOperation, listOperationWorkflowV1 } from "./alert_workflow_v1.js";

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

async function queryFactsByTypeAndPayloadKey(
  pool: Pool,
  tenant: TenantTriple,
  type: string,
  keyPath: string,
  keyValue: string,
): Promise<FactRow[]> {
  const q = await pool.query(
    `SELECT fact_id, occurred_at, record_json::jsonb AS record_json
       FROM facts
      WHERE (record_json::jsonb->>'type') = $1
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $2
        AND (record_json::jsonb#>>'{payload,project_id}') = $3
        AND (record_json::jsonb#>>'{payload,group_id}') = $4
        AND (record_json::jsonb#>>'{payload,${keyPath}}') = $5
      ORDER BY occurred_at ASC, fact_id ASC`,
    [type, tenant.tenant_id, tenant.project_id, tenant.group_id, keyValue],
  );
  return (q.rows ?? []).map((row: any) => ({
    fact_id: String(row.fact_id ?? ""),
    occurred_at: String(row.occurred_at ?? ""),
    record_json: parseRecordJson(row.record_json) ?? row.record_json,
  }));
}

function latestByType(facts: FactRow[], type: string): FactRow | null {
  return [...facts].reverse().find((item) => String(item.record_json?.type ?? "") === type) ?? null;
}

function normalizeApprovalStatus(rawDecision: unknown, hasRequest: boolean): string {
  const decision = String(rawDecision ?? "").trim().toUpperCase();
  if (decision === "APPROVE" || decision === "APPROVED" || decision === "PASS") return "APPROVED";
  if (decision === "REJECT" || decision === "REJECTED" || decision === "FAIL") return "REJECTED";
  return hasRequest ? "PENDING" : "NOT_REQUIRED";
}

function deriveOperationTitle(actionType: unknown): string | null {
  const raw = String(actionType ?? "").trim();
  if (!raw) return null;
  const actionLabel = toCustomerFacingActionLabel(raw);
  return actionLabel === "执行" ? "田间作业" : `${actionLabel}作业`;
}

function ensureReportV1ExtendedFields(report: OperationReportV1): OperationReportV1 {
  return {
    ...report,
    approval: report.approval ?? {
      status: null,
      actor_id: null,
      actor_name: null,
      generated_at: null,
      approved_at: null,
      note: null,
    },
    why: report.why ?? {
      explain_human: null,
      objective_text: null,
    },
    operation_title: report.operation_title ?? null,
    customer_title: report.customer_title ?? report.operation_title ?? null,
  };
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
  operationWorkflow?: {
    owner_actor_id: string | null;
    owner_name: string | null;
    last_note: string | null;
    updated_at: number;
    updated_by: string;
    linked_alert_ids?: string[];
  } | null;
}): Promise<OperationReportV1> {
  const { pool, tenant, operationState, operationWorkflow } = params;
  const operationPlanId = operationState.operation_plan_id || operationState.operation_id;
  const facts = await queryFactsForOperation(pool, tenant, operationPlanId);
  const recommendationFacts = operationState.recommendation_id
    ? await queryFactsByTypeAndPayloadKey(pool, tenant, "decision_recommendation_v1", "recommendation_id", operationState.recommendation_id)
    : [];
  const approvalRequestFacts = operationState.approval_request_id
    ? await queryFactsByTypeAndPayloadKey(pool, tenant, "approval_request_v1", "request_id", operationState.approval_request_id)
    : [];
  const approvalDecisionFacts = operationState.approval_request_id
    ? await queryFactsByTypeAndPayloadKey(pool, tenant, "approval_decision_v1", "request_id", operationState.approval_request_id)
    : [];
  const allFacts = [...facts, ...recommendationFacts, ...approvalRequestFacts, ...approvalDecisionFacts];

  const acceptanceFact = latestByType(allFacts, "acceptance_result_v1");
  const receiptFact = [...allFacts].reverse().find((x) => ["ao_act_receipt_v0", "ao_act_receipt_v1"].includes(String(x.record_json?.type ?? ""))) ?? null;
  const recommendationFact = latestByType(allFacts, "decision_recommendation_v1");
  const approvalRequestFact = latestByType(allFacts, "approval_request_v1");
  const approvalDecisionFact = latestByType(allFacts, "approval_decision_v1");
  const normalizedReceipt = receiptFact
    ? normalizeReceiptEvidence(receiptFact, String(receiptFact.record_json?.type ?? ""))
    : null;

  const receiptPayload = receiptFact?.record_json?.payload ?? {};
  const logs = Array.isArray(receiptPayload?.logs_refs) ? receiptPayload.logs_refs : [];
  const metrics = Array.isArray(receiptPayload?.metrics) ? receiptPayload.metrics : [];
  const photos = Array.isArray(receiptPayload?.photo_refs) ? receiptPayload.photo_refs : [];
  const media = photos.map((ref: unknown) => ({ kind: "photo", ref }));

  const estimatedCost = computeOperationCostV1(operationState.action_type, {
    water_l: normalizedReceipt?.water_l,
    chemical_ml: normalizedReceipt?.chemical_ml,
  });
  const executionSuccess = ["SUCCESS", "SUCCEEDED"].includes(String(operationState.final_status ?? "").toUpperCase());
  const acceptancePass = String(acceptanceFact?.record_json?.payload?.verdict ?? "").toUpperCase().includes("PASS");
  const responseTimeMs = buildResponseTimeMs(operationState, normalizedReceipt?.execution_started_at ?? null);
  const recommendationPayload = recommendationFact?.record_json?.payload ?? {};
  const explainHuman = toText(recommendationPayload?.summary ?? recommendationPayload?.action_summary ?? recommendationPayload?.reason);
  const objectiveText = toText(
    recommendationPayload?.objective_text
    ?? recommendationPayload?.expected_effect?.[0]?.description
    ?? recommendationPayload?.expected_effect?.[0]?.metric
  );
  const approvalStatus = normalizeApprovalStatus(approvalDecisionFact?.record_json?.payload?.decision, Boolean(approvalRequestFact));
  const operationTitle = deriveOperationTitle(operationState.action_type ?? recommendationPayload?.suggested_action?.action_type);

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
      estimated_total: estimatedCost.estimated_total,
      estimated_water_cost: estimatedCost.estimated_water_cost,
      estimated_electric_cost: estimatedCost.estimated_electric_cost,
      estimated_chemical_cost: estimatedCost.estimated_chemical_cost,
    },
    sla: {
      execution_success: executionSuccess,
      acceptance_pass: acceptancePass,
      response_time_ms: responseTimeMs,
    },
    operation_workflow: operationWorkflow ? {
      owner_actor_id: operationWorkflow.owner_actor_id,
      owner_name: operationWorkflow.owner_name,
      last_note: operationWorkflow.last_note,
      updated_at: operationWorkflow.updated_at,
      updated_by: operationWorkflow.updated_by,
      linked_alert_ids: operationWorkflow.linked_alert_ids ?? [],
    } : null,
    approval: {
      status: approvalStatus,
      actor_id: toText(approvalDecisionFact?.record_json?.payload?.actor_id ?? approvalDecisionFact?.record_json?.payload?.decider),
      actor_name: toText(approvalDecisionFact?.record_json?.payload?.actor_name ?? approvalDecisionFact?.record_json?.payload?.actor_label),
      generated_at: approvalRequestFact?.occurred_at ?? null,
      approved_at: approvalStatus === "APPROVED" ? (approvalDecisionFact?.occurred_at ?? null) : null,
      note: toText(approvalDecisionFact?.record_json?.payload?.note ?? approvalDecisionFact?.record_json?.payload?.reason),
    },
    why: {
      explain_human: explainHuman,
      objective_text: objectiveText,
    },
    operation_title: operationTitle,
    customer_title: operationTitle,
  });
}

export function registerReportsV1Routes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/reports/operation/:operation_id", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
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

    const workflowMap = await listOperationWorkflowV1(pool, {
      tenant_id: tenant.tenant_id,
      operation_ids: [state.operation_id, state.operation_plan_id].filter(Boolean),
    });
    const relationMapByOperation = await listAlertOperationRelationV1ByOperation(pool, {
      tenant_id: tenant.tenant_id,
      operation_ids: [state.operation_id, state.operation_plan_id].filter(Boolean),
    });
    const workflow = workflowMap.get(state.operation_id) ?? workflowMap.get(state.operation_plan_id) ?? null;
    const linkedAlerts = relationMapByOperation.get(state.operation_id) ?? relationMapByOperation.get(state.operation_plan_id) ?? [];
    const operation_report_v1 = await projectReportV1({
      pool,
      tenant,
      operationState: state,
      operationWorkflow: workflow ? {
        ...workflow,
        linked_alert_ids: linkedAlerts.map((row) => row.alert_id).filter(Boolean),
      } : (linkedAlerts.length > 0
        ? {
          owner_actor_id: null,
          owner_name: null,
          last_note: null,
          updated_at: 0,
          updated_by: "",
          linked_alert_ids: linkedAlerts.map((row) => row.alert_id).filter(Boolean),
        }
        : null),
    });
    const payload: OperationReportSingleResponseV1 = {
      ok: true,
      operation_report_v1: ensureReportV1ExtendedFields(operation_report_v1),
    };
    return reply.send(payload);
  });

  app.get("/api/v1/reports/field/:field_id", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
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

    const workflowMap = await listOperationWorkflowV1(pool, {
      tenant_id: tenant.tenant_id,
      operation_ids: fieldStates.flatMap((state) => [state.operation_id, state.operation_plan_id]).filter(Boolean),
    });
    const relationMapByOperation = await listAlertOperationRelationV1ByOperation(pool, {
      tenant_id: tenant.tenant_id,
      operation_ids: fieldStates.flatMap((state) => [state.operation_id, state.operation_plan_id]).filter(Boolean),
    });
    const items = await Promise.all(fieldStates.map(async (state) => ensureReportV1ExtendedFields(await projectReportV1({
      pool,
      tenant,
      operationState: state,
      operationWorkflow: (() => {
        const workflow = workflowMap.get(state.operation_id) ?? workflowMap.get(state.operation_plan_id) ?? null;
        const linkedAlerts = relationMapByOperation.get(state.operation_id) ?? relationMapByOperation.get(state.operation_plan_id) ?? [];
        if (!workflow && linkedAlerts.length === 0) return null;
        return {
          owner_actor_id: workflow?.owner_actor_id ?? null,
          owner_name: workflow?.owner_name ?? null,
          last_note: workflow?.last_note ?? null,
          updated_at: workflow?.updated_at ?? 0,
          updated_by: workflow?.updated_by ?? "",
          linked_alert_ids: linkedAlerts.map((row) => row.alert_id).filter(Boolean),
        };
      })(),
    }))));

    const payload: OperationReportFieldListResponseV1 = { ok: true, items };
    return reply.send(payload);
  });
}
