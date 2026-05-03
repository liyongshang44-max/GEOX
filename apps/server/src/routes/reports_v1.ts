import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js";
import { enforceFieldScopeOrDeny, enforceOperationFieldScope, hasFieldAccess } from "../auth/route_role_authz.js";
import { projectOperationStateV1, type OperationStateV1 } from "../projections/operation_state_v1.js";
import {
  projectOperationReportV1,
  type OperationReportSingleResponseV1,
  type OperationReportV1,
} from "../projections/report_v1.js";
import { projectFieldReportDetailV1, type FieldReportDetailV1 } from "../projections/report_dashboard_v1.js";
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
    field_memory: (report as any).field_memory ?? {
      field_response_memory: [],
      device_reliability_memory: [],
      skill_performance_memory: [],
    },
    roi_ledger: (report as any).roi_ledger ?? {
      water_saved: [],
      labor_saved: [],
      early_warning_lead_time: [],
      first_pass_acceptance_rate: [],
      low_confidence_items: [],
    },
  };
}

function toFiniteNumberOrNull(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function buildFieldResponseSummaryText(row: any): string {
  const before = toFiniteNumberOrNull(row?.before_value);
  const after = toFiniteNumberOrNull(row?.after_value);
  const delta = toFiniteNumberOrNull(row?.delta_value) ?? (before != null && after != null ? Number((after - before).toFixed(2)) : null);
  if (before == null || after == null || delta == null) return String(row?.summary_text ?? "").trim() || "灌后响应已记录";
  const deltaText = `${delta >= 0 ? "+" : ""}${Number(delta.toFixed(2)).toString()}`;
  return `土壤湿度从 ${before}% 回升到 ${after}%，变化 ${deltaText} 个百分点`;
}

function normalizeFieldMemoryRow(row: any): any {
  const before = toFiniteNumberOrNull(row?.before_value);
  const after = toFiniteNumberOrNull(row?.after_value);
  const delta = toFiniteNumberOrNull(row?.delta_value)
    ?? (before != null && after != null ? Number((after - before).toFixed(2)) : null);
  return {
    ...row,
    before_value: before,
    after_value: after,
    delta_value: delta,
    summary_text: String(row?.summary_text ?? "").trim() || (row?.memory_type === "FIELD_RESPONSE_MEMORY" ? buildFieldResponseSummaryText(row) : "田间记忆已记录"),
    customer_text: row?.memory_type === "FIELD_RESPONSE_MEMORY" ? buildFieldResponseSummaryText({ ...row, delta_value: delta }) : undefined,
  };
}

function buildResponseTimeMs(state: OperationStateV1, executionStartedAt: string | null): number | null {
  const dispatchedTs = state.timeline.find((item) => item.type === "TASK_CREATED")?.ts ?? null;
  const executionStartedTs = executionStartedAt ? Date.parse(executionStartedAt) : NaN;
  if (dispatchedTs == null || !Number.isFinite(executionStartedTs)) return null;
  return Math.max(0, executionStartedTs - dispatchedTs);
}

function toIsoFromEpochMs(v: unknown): string | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return new Date(n).toISOString();
}

type FieldReportDetailResponseV1 = {
  ok: true;
  field_report_v1: FieldReportDetailV1;
};
const FIELD_REPORT_OPERATION_LIMIT = 20;

async function queryRoiLedgerForReport(pool: Pool, tenant: TenantTriple, s: OperationStateV1): Promise<any[]> {
  const q = await pool.query(
    `SELECT * FROM roi_ledger_v1
      WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
        AND (operation_id=$4 OR task_id=$5 OR prescription_id=$6)
      ORDER BY created_at DESC`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, s.operation_id, s.task_id ?? s.act_task_id ?? null, (s as any).prescription_id ?? null]
  );
  return q.rows ?? [];
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
    roi_ledger: await queryRoiLedgerForReport(pool, tenant, operationState),
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
    const candidateIds = Array.from(new Set([
      state.operation_id,
      state.operation_plan_id,
      state.recommendation_id,
      state.act_task_id,
      (state.acceptance as any)?.acceptance_id,
    ].map((x) => String(x ?? "").trim()).filter(Boolean)));
    const fm = await pool.query(
      `SELECT memory_id,memory_type,metric_key,before_value,after_value,delta_value,target_range,confidence,summary_text,evidence_refs,skill_id,skill_trace_ref,occurred_at
       FROM field_memory_v1
       WHERE tenant_id = $1
         AND project_id = $2
         AND group_id = $3
         AND (
          operation_id = ANY($4::text[])
          OR task_id = ANY($4::text[])
          OR recommendation_id = ANY($4::text[])
          OR prescription_id = ANY($4::text[])
          OR acceptance_id = ANY($4::text[])
         )
       ORDER BY occurred_at DESC LIMIT 50`,
      [tenant.tenant_id, tenant.project_id, tenant.group_id, candidateIds],
    );
    const enrichedReport = ensureReportV1ExtendedFields(operation_report_v1);
    const normalizedMemoryRows = (fm.rows ?? []).map((x: any) => normalizeFieldMemoryRow(x));
    enrichedReport.field_memory = {
      field_response_memory: normalizedMemoryRows.filter((x:any)=>x.memory_type==="FIELD_RESPONSE_MEMORY"),
      device_reliability_memory: normalizedMemoryRows.filter((x:any)=>x.memory_type==="DEVICE_RELIABILITY_MEMORY"),
      skill_performance_memory: normalizedMemoryRows.filter((x:any)=>x.memory_type==="SKILL_PERFORMANCE_MEMORY"),
    };
    const roiRows = Array.isArray(enrichedReport.roi_ledger?.water_saved)
      ? [
        ...(enrichedReport.roi_ledger.water_saved ?? []),
        ...(enrichedReport.roi_ledger.labor_saved ?? []),
        ...(enrichedReport.roi_ledger.early_warning_lead_time ?? []),
        ...(enrichedReport.roi_ledger.first_pass_acceptance_rate ?? []),
        ...(enrichedReport.roi_ledger.low_confidence_items ?? []),
      ]
      : [];
    const skillTraceFromMemory = (fm.rows ?? []).map((x: any) => toText(x.skill_trace_ref)).find(Boolean) ?? null;
    const skillRunFromFacts = toText((state as any).skill_run_id);
    const asExecutedFromFacts = toText((state as any).as_executed_id);
    enrichedReport.identifiers = {
      ...enrichedReport.identifiers,
      prescription_id: enrichedReport.identifiers.prescription_id ?? toText((state as any).prescription_id),
      approval_id: enrichedReport.identifiers.approval_id ?? toText(state.approval_request_id),
      skill_trace_id: enrichedReport.identifiers.skill_trace_id ?? skillTraceFromMemory ?? toText((roiRows[0] as any)?.skill_trace_ref),
      skill_run_id: enrichedReport.identifiers.skill_run_id ?? skillRunFromFacts,
      as_executed_id: enrichedReport.identifiers.as_executed_id ?? asExecutedFromFacts,
    } as any;
    const payload: OperationReportSingleResponseV1 = {
      ok: true,
      operation_report_v1: enrichedReport,
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
      .filter((x) => hasFieldAccess(auth, String(x.field_id ?? "")))
      .sort((a, b) => Number(b.last_event_ts ?? 0) - Number(a.last_event_ts ?? 0))
      .slice(0, FIELD_REPORT_OPERATION_LIMIT);

    const items = fieldStates.slice(0, FIELD_REPORT_OPERATION_LIMIT).map((state) => ensureReportV1ExtendedFields(projectOperationReportV1({
      tenant,
      operation_plan_id: state.operation_plan_id || state.operation_id,
      operation_state: state,
      evidence_bundle: {
        artifacts: [],
        logs: [],
        media: [],
        metrics: [],
      },
      acceptance: state.acceptance ? {
        status: state.acceptance.status,
        verdict: null,
        missing_evidence: false,
        generated_at: null,
      } : null,
      receipt: null,
      cost: {
        estimated_total: 0,
        estimated_water_cost: 0,
        estimated_electric_cost: 0,
        estimated_chemical_cost: 0,
      },
      sla: {
        execution_success: ["SUCCESS", "SUCCEEDED"].includes(String(state.final_status ?? "").toUpperCase()),
        acceptance_pass: String(state.acceptance?.status ?? "").toUpperCase() === "PASS",
        response_time_ms: null,
      },
      operation_workflow: null,
      approval: {
        status: null,
        actor_id: null,
        actor_name: null,
        generated_at: null,
        approved_at: null,
        note: null,
      },
      why: {
        explain_human: null,
        objective_text: null,
      },
      operation_title: deriveOperationTitle(state.action_type),
      customer_title: deriveOperationTitle(state.action_type),
    })));
    const fieldNameQ = await pool.query(
      `SELECT name
         FROM field_index_v1
        WHERE tenant_id = $1
          AND field_id = $2
        LIMIT 1`,
      [tenant.tenant_id, fieldId],
    );
    const fieldName = toText(fieldNameQ.rows?.[0]?.name);

    const boundDevicesQ = await pool.query(
      `SELECT b.device_id, s.last_telemetry_ts_ms
         FROM device_binding_index_v1 b
         LEFT JOIN device_status_index_v1 s
           ON s.tenant_id = b.tenant_id AND s.device_id = b.device_id
        WHERE b.tenant_id = $1
          AND b.field_id = $2`,
      [tenant.tenant_id, fieldId],
    );
    const boundDeviceIds = (boundDevicesQ.rows ?? []).map((row: any) => String(row.device_id ?? "")).filter(Boolean);
    const onlineThresholdMs = Date.now() - 15 * 60 * 1000;
    let onlineDevices = 0;
    let lastTelemetryMs: number | null = null;
    for (const row of boundDevicesQ.rows ?? []) {
      const lastTelemetryTsMs = typeof row.last_telemetry_ts_ms === "number" ? row.last_telemetry_ts_ms : Number(row.last_telemetry_ts_ms);
      if (Number.isFinite(lastTelemetryTsMs)) {
        if (lastTelemetryMs == null || lastTelemetryTsMs > lastTelemetryMs) lastTelemetryMs = lastTelemetryTsMs;
        if (lastTelemetryTsMs >= onlineThresholdMs) onlineDevices += 1;
      }
    }

    const alertQ = await pool.query(
      `SELECT COUNT(*)::bigint AS active_alerts
         FROM alert_event_index_v1
        WHERE tenant_id = $1
          AND status IN ('OPEN', 'ACKED')
          AND (
            (object_type = 'FIELD' AND object_id = $2)
            OR (object_type = 'DEVICE' AND object_id = ANY($3::text[]))
          )`,
      [tenant.tenant_id, fieldId, boundDeviceIds.length > 0 ? boundDeviceIds : ["__none__"]],
    );
    const openAlertsCount = Number(alertQ.rows?.[0]?.active_alerts ?? 0);

    const fieldReport = projectFieldReportDetailV1({
      field_id: fieldId,
      field_name: fieldName,
      reports: items,
      open_alerts_count: openAlertsCount,
      device_summary: {
        total_devices: boundDeviceIds.length,
        online_devices: onlineDevices,
        offline_devices: Math.max(0, boundDeviceIds.length - onlineDevices),
        last_telemetry_at: toIsoFromEpochMs(lastTelemetryMs),
      },
    });

    const payload: FieldReportDetailResponseV1 = { ok: true, field_report_v1: fieldReport };
    return reply.send(payload);
  });
}
