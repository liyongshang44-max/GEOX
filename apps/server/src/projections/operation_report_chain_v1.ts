import type { Pool } from "pg";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };
type FactRow = { fact_id: string; occurred_at: string; record_json: any };

type ChainStatus = "DONE" | "AVAILABLE" | "PENDING" | "MISSING" | "NOT_APPLICABLE";

export type OperationReportChainItemV1 = {
  key: string;
  label: string;
  status: ChainStatus | string;
  reason: string;
  source: string;
};

function parseRecordJson(value: unknown): any {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string" || !value.trim()) return null;
  try { return JSON.parse(value); } catch { return null; }
}

function toText(value: unknown): string | null {
  if (typeof value === "string") {
    const text = value.trim();
    return text || null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function latestByType(facts: FactRow[], type: string): FactRow | null {
  return [...facts].reverse().find((fact) => String(fact.record_json?.type ?? "") === type) ?? null;
}

function latestByTypes(facts: FactRow[], types: string[]): FactRow | null {
  const allow = new Set(types);
  return [...facts].reverse().find((fact) => allow.has(String(fact.record_json?.type ?? ""))) ?? null;
}

function payloadOf(fact: FactRow | null): any {
  return fact?.record_json?.payload ?? {};
}

function idList(report: any): string[] {
  const ids = [
    report?.identifiers?.operation_id,
    report?.identifiers?.operation_plan_id,
    report?.identifiers?.recommendation_id,
    report?.identifiers?.prescription_id,
    report?.identifiers?.approval_id,
    report?.identifiers?.act_task_id,
    report?.identifiers?.receipt_id,
  ].map((value) => String(value ?? "").trim()).filter(Boolean);
  return Array.from(new Set(ids));
}

async function queryChainFacts(pool: Pool, tenant: TenantTriple, report: any): Promise<FactRow[]> {
  const ids = idList(report);
  if (ids.length === 0) return [];
  const q = await pool.query(
    `SELECT fact_id, occurred_at, record_json::jsonb AS record_json
       FROM facts
      WHERE (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND ((record_json::jsonb#>>'{payload,project_id}') = $2 OR COALESCE(record_json::jsonb#>>'{payload,project_id}', '') = '')
        AND ((record_json::jsonb#>>'{payload,group_id}') = $3 OR COALESCE(record_json::jsonb#>>'{payload,group_id}', '') = '')
        AND (
          (record_json::jsonb#>>'{payload,operation_id}') = ANY($4::text[])
          OR (record_json::jsonb#>>'{payload,operation_plan_id}') = ANY($4::text[])
          OR (record_json::jsonb#>>'{payload,recommendation_id}') = ANY($4::text[])
          OR (record_json::jsonb#>>'{payload,prescription_id}') = ANY($4::text[])
          OR (record_json::jsonb#>>'{payload,approval_request_id}') = ANY($4::text[])
          OR (record_json::jsonb#>>'{payload,request_id}') = ANY($4::text[])
          OR (record_json::jsonb#>>'{payload,act_task_id}') = ANY($4::text[])
          OR (record_json::jsonb#>>'{payload,task_id}') = ANY($4::text[])
          OR (record_json::jsonb#>>'{payload,receipt_id}') = ANY($4::text[])
        )
      ORDER BY occurred_at ASC, fact_id ASC`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, ids]
  );
  return (q.rows ?? []).map((row: any) => ({
    fact_id: String(row.fact_id ?? ""),
    occurred_at: String(row.occurred_at ?? ""),
    record_json: parseRecordJson(row.record_json) ?? row.record_json,
  }));
}

function normalizeApprovalStatus(raw: unknown, fallback: unknown): string | null {
  const value = String(raw ?? fallback ?? "").trim().toUpperCase();
  if (!value) return null;
  if (["APPROVE", "APPROVED", "PASS"].includes(value)) return "APPROVED";
  if (["REJECT", "REJECTED", "FAIL"].includes(value)) return "REJECTED";
  return value;
}

function evidenceIds(facts: FactRow[]): string[] {
  return facts
    .filter((fact) => String(fact.record_json?.type ?? "") === "evidence_artifact_v1")
    .map((fact) => toText(fact.record_json?.payload?.evidence_id ?? fact.record_json?.payload?.artifact_id ?? fact.fact_id))
    .filter((value): value is string => Boolean(value));
}

function buildStatusItem(key: string, label: string, present: boolean, reason: string, source: string, status: ChainStatus = "DONE"): OperationReportChainItemV1 {
  return { key, label, status: present ? status : "MISSING", reason, source };
}

export async function enrichOperationReportChainV1(params: { pool: Pool; report: any }): Promise<any> {
  const report = params.report ?? {};
  const tenant: TenantTriple = {
    tenant_id: String(report?.identifiers?.tenant_id ?? ""),
    project_id: String(report?.identifiers?.project_id ?? ""),
    group_id: String(report?.identifiers?.group_id ?? ""),
  };
  if (!tenant.tenant_id || !tenant.project_id || !tenant.group_id) return report;

  const facts = await queryChainFacts(params.pool, tenant, report).catch(() => [] as FactRow[]);
  const recFact = latestByType(facts, "decision_recommendation_v1");
  const planFact = latestByType(facts, "operation_plan_v1");
  const approvalRequestFact = latestByType(facts, "approval_request_v1");
  const approvalDecisionFact = latestByType(facts, "approval_decision_v1");
  const taskFact = latestByType(facts, "ao_act_task_v0");
  const receiptFact = latestByTypes(facts, ["ao_act_receipt_v0", "ao_act_receipt_v1"]);
  const acceptanceFact = latestByType(facts, "acceptance_result_v1");
  const evidenceSummaryFact = latestByTypes(facts, ["operation_evidence_summary_v1", "evidence_pack_summary_v1"]);
  const prescriptionFact = latestByTypes(facts, ["prescription_v1", "operation_prescription_v1", "decision_prescription_v1"]);

  const rec = payloadOf(recFact);
  const plan = payloadOf(planFact);
  const approvalReq = payloadOf(approvalRequestFact);
  const approvalDecision = payloadOf(approvalDecisionFact);
  const task = payloadOf(taskFact);
  const receipt = payloadOf(receiptFact);
  const acceptancePayload = payloadOf(acceptanceFact);
  const prescriptionPayload = payloadOf(prescriptionFact);

  const recommendationId = toText(report?.identifiers?.recommendation_id ?? rec.recommendation_id);
  const prescriptionId = toText(report?.identifiers?.prescription_id ?? prescriptionPayload.prescription_id ?? plan.prescription_id ?? approvalReq.prescription_id ?? plan.operation_plan_id);
  const approvalRequestId = toText(report?.identifiers?.approval_id ?? approvalReq.request_id ?? plan.approval_request_id);
  const actTaskId = toText(report?.identifiers?.act_task_id ?? task.act_task_id ?? plan.act_task_id);
  const receiptId = toText(report?.identifiers?.receipt_id ?? receipt.receipt_id ?? receiptFact?.fact_id);
  const acceptanceId = toText((report?.acceptance as any)?.acceptance_id ?? acceptancePayload.acceptance_id ?? acceptanceFact?.fact_id);

  const operationType = toText(prescriptionPayload.operation_type ?? prescriptionPayload.action_type ?? plan.operation_type ?? plan.action_type ?? rec.suggested_action?.action_type ?? report.operation_title);
  const recommendation = recommendationId ? {
    recommendation_id: recommendationId,
    diagnosis_basis: rec.diagnosis_basis ?? rec.data_summary ?? rec.summary ?? report?.why?.objective_text ?? null,
    agronomy_explain: rec.agronomy_explain ?? rec.explain?.human ?? rec.explain_human ?? rec.summary ?? report?.why?.explain_human ?? null,
    reason_codes: toArray(rec.reason_codes ?? report?.risk?.reasons).map((value) => String(value)).filter(Boolean),
    evidence_refs: toArray(rec.evidence_refs ?? rec.evidence_ids),
    confidence: rec.confidence ?? rec.confidence_level ?? null,
    status: toText(rec.status ?? "AVAILABLE"),
  } : null;

  const prescription = prescriptionId ? {
    prescription_id: prescriptionId,
    recommendation_id: recommendationId,
    operation_type: operationType,
    target_area: prescriptionPayload.target_area ?? prescriptionPayload.spatial_scope ?? plan.target_area ?? plan.spatial_scope ?? plan.target ?? null,
    amount: prescriptionPayload.amount ?? prescriptionPayload.planned_amount ?? plan.amount ?? plan.planned_amount ?? rec.suggested_action?.parameters?.amount ?? null,
    unit: prescriptionPayload.unit ?? plan.unit ?? rec.suggested_action?.parameters?.unit ?? null,
    duration: prescriptionPayload.duration ?? plan.duration ?? rec.suggested_action?.parameters?.duration ?? null,
    time_window: prescriptionPayload.time_window ?? prescriptionPayload.timing_window ?? plan.time_window ?? plan.timing_window ?? null,
    acceptance_conditions: prescriptionPayload.acceptance_conditions ?? plan.acceptance_conditions ?? rec.acceptance_conditions ?? null,
    device_requirements: prescriptionPayload.device_requirements ?? plan.device_requirements ?? rec.suggested_action?.device_requirements ?? null,
    status: toText(prescriptionPayload.status ?? plan.status ?? "AVAILABLE"),
  } : null;

  const approval = approvalRequestId ? {
    approval_request_id: approvalRequestId,
    status: normalizeApprovalStatus(approvalDecision.decision, report?.approval?.status) ?? "PENDING",
    approver: toObject({
      actor_id: toText(approvalDecision.actor_id ?? approvalDecision.decider ?? report?.approval?.actor_id),
      name: toText(approvalDecision.actor_name ?? approvalDecision.actor_label ?? report?.approval?.actor_name),
    }),
    approved_at: toText(approvalDecision.approved_at ?? approvalDecision.decided_at ?? (normalizeApprovalStatus(approvalDecision.decision, report?.approval?.status) === "APPROVED" ? approvalDecisionFact?.occurred_at : report?.approval?.approved_at)),
    decision_note: toText(approvalDecision.note ?? approvalDecision.reason ?? report?.approval?.note),
    approval_scope: approvalReq.scope ?? approvalReq.approval_scope ?? null,
  } : null;

  const asExecuted = report.as_executed ?? null;
  const executionMode = String(asExecuted?.execution_mode ?? task.execution_mode ?? task.executor?.kind ?? "").toUpperCase();
  const deviceId = toText(asExecuted?.device_id ?? task.device_id ?? task.executor?.device_id ?? receipt.device_id);
  const execution = actTaskId ? {
    act_task_id: actTaskId,
    dispatch_status: toText(task.status ?? report?.execution?.final_status ?? "PENDING"),
    executor: { kind: deviceId || executionMode === "DEVICE" ? "device" : "human", id: deviceId ?? toText(asExecuted?.operator_id ?? task.executor_id) },
    device_id: deviceId,
    execution_mode: deviceId || executionMode === "DEVICE" ? "DEVICE" : "HUMAN",
    receipt_id: receiptId,
    receipt_status: toText(receipt.status ?? (receiptId ? "RECEIVED" : null)),
    as_executed: asExecuted,
  } : null;

  const evidenceIdList = evidenceIds(facts);
  const evidenceComplete = Boolean((report?.evidence?.receipt_present && report?.evidence?.acceptance_present) || evidenceIdList.length > 0 || evidenceSummaryFact);
  const evidence = {
    evidence_status: evidenceComplete ? "COMPLETE" : "INCOMPLETE",
    evidence_ids: evidenceIdList,
    export_job_id: toText((report as any).evidence_pack_summary?.export_job_id ?? (report as any).evidence_pack_summary?.job_id),
    sha256: toText((report as any).evidence_pack_summary?.sha256),
    trusted: evidenceComplete && report?.acceptance?.missing_evidence !== true,
  };

  const verdict = toText(acceptancePayload.verdict ?? report?.acceptance?.verdict ?? report?.acceptance?.status);
  const acceptance = acceptanceId || verdict ? {
    acceptance_id: acceptanceId,
    verdict,
    evidence_sufficient: report?.acceptance?.missing_evidence !== true,
    accepted_at: toText(acceptancePayload.accepted_at ?? acceptancePayload.generated_at ?? report?.acceptance?.generated_at ?? acceptanceFact?.occurred_at),
    failure_reason: toText(acceptancePayload.failure_reason ?? report?.execution?.invalid_reason),
  } : null;

  const diagnosis = {
    field_id: toText(report?.identifiers?.field_id),
    diagnosis_basis: recommendation?.diagnosis_basis ?? report?.why?.objective_text ?? null,
    risk_level: report?.risk?.level ?? null,
    reason_codes: recommendation?.reason_codes ?? [],
    before_metrics: plan.before_metrics ?? rec.before_metrics ?? null,
  };

  const operationPlan = toText(report?.identifiers?.operation_plan_id ?? plan.operation_plan_id) ? {
    operation_plan_id: toText(report?.identifiers?.operation_plan_id ?? plan.operation_plan_id),
    recommendation_id: recommendationId,
    prescription_id: prescriptionId,
    approval_request_id: approvalRequestId,
    field_id: toText(report?.identifiers?.field_id ?? plan.field_id),
    status: toText(plan.status ?? "AVAILABLE"),
  } : null;

  const missingLinks: string[] = [];
  if (!recommendation) missingLinks.push("recommendation");
  if (!prescription) missingLinks.push("prescription");
  if (!approval) missingLinks.push("approval");
  if (!operationPlan) missingLinks.push("operation_plan");
  if (!execution?.act_task_id) missingLinks.push("execution");
  if (!receiptId) missingLinks.push("receipt");
  if (!evidenceComplete) missingLinks.push("evidence");
  if (!acceptance) missingLinks.push("acceptance");

  const chainFlags: string[] = [];
  if (execution?.act_task_id && !prescription) chainFlags.push("manual_operation", "legacy_operation");
  if (prescription && !recommendation) chainFlags.push("manual_override");
  const chainIntegrity = missingLinks.length === 0 ? "COMPLETE" : "LEGACY_OR_MANUAL";
  const legacyWarning = chainIntegrity === "LEGACY_OR_MANUAL" ? "该作业为历史/人工链路，缺少正式建议或处方记录。" : null;

  const statusChain: OperationReportChainItemV1[] = [
    buildStatusItem("diagnosis", "诊断", true, "诊断上下文已汇总", "operation_report_chain_v1"),
    buildStatusItem("recommendation", "建议", Boolean(recommendation), recommendation ? "正式建议已关联" : "缺少正式建议记录", recommendation ? "decision_recommendation_v1" : "operation_report_chain_v1"),
    buildStatusItem("prescription", "处方", Boolean(prescription), prescription ? "正式处方已关联" : "缺少正式处方记录", prescriptionFact ? String(prescriptionFact.record_json?.type) : (prescription ? "operation_plan_v1" : "operation_report_chain_v1")),
    buildStatusItem("approval", "审批", Boolean(approval), approval ? "审批记录已关联" : "缺少审批记录", approval ? "approval_request_v1" : "operation_report_chain_v1"),
    buildStatusItem("operation_plan", "作业计划", Boolean(operationPlan), operationPlan ? "作业计划已关联" : "缺少作业计划", operationPlan ? "operation_plan_v1" : "operation_report_chain_v1"),
    buildStatusItem("execution", "执行", Boolean(execution?.act_task_id), execution?.act_task_id ? "执行任务已派发" : "缺少执行任务", execution?.act_task_id ? "ao_act_task_v0" : "operation_report_chain_v1"),
    buildStatusItem("receipt", "回执", Boolean(receiptId), receiptId ? "执行回执已记录" : "缺少执行回执", receiptId ? String(receiptFact?.record_json?.type ?? "receipt") : "operation_report_chain_v1"),
    buildStatusItem("evidence", "证据", evidenceComplete, evidenceComplete ? "证据链完整" : "证据不足", evidenceSummaryFact ? String(evidenceSummaryFact.record_json?.type) : "operation_report_chain_v1", evidenceComplete ? "DONE" : "MISSING"),
    buildStatusItem("acceptance", "验收", Boolean(acceptance), acceptance ? "验收结论已形成" : "缺少验收结论", acceptance ? "acceptance_result_v1" : "operation_report_chain_v1"),
    buildStatusItem("roi", "价值", Boolean(report?.roi_ledger?.summary?.total_items || toArray(report?.roi_ledger?.items).length), "价值记录状态", "roi_ledger_v1", "AVAILABLE"),
    buildStatusItem("field_memory", "田块记忆", Boolean(toArray(report?.field_memory?.field_response_memory).length || toArray(report?.field_memory?.device_reliability_memory).length || toArray(report?.field_memory?.skill_performance_memory).length), "田块记忆状态", "field_memory_v1", "AVAILABLE"),
  ];

  return {
    ...report,
    operation_id: toText(report?.identifiers?.operation_id ?? report?.identifiers?.operation_plan_id),
    field: { field_id: toText(report?.identifiers?.field_id), field_name: toText(report?.field_name) },
    crop_context: {
      crop_code: toText(plan.crop_code ?? rec.crop_code),
      crop_stage: toText(plan.crop_stage ?? rec.crop_stage),
      season_id: toText(plan.season_id ?? rec.season_id),
    },
    diagnosis,
    recommendation,
    prescription,
    approval,
    operation_plan: operationPlan,
    execution,
    receipt: receiptId ? { receipt_id: receiptId, status: toText(receipt.status ?? "RECEIVED"), submitted_at: toText(receipt.submitted_at ?? receiptFact?.occurred_at), metrics: receipt.metrics ?? null } : null,
    evidence,
    acceptance,
    roi: report?.roi_ledger ?? null,
    field_memory: report?.field_memory ?? null,
    chain_integrity: chainIntegrity,
    chain_flags: chainFlags,
    missing_links: missingLinks,
    legacy_warning: legacyWarning,
    status_chain: statusChain,
  };
}
