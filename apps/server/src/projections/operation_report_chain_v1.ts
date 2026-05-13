import type { Pool } from "pg";
import { validateOperationChainV1 } from "./operation_chain_validator_v1.js";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };
type FactRow = { fact_id: string; occurred_at: string; record_json: any };

export type OperationReportChainItemV1 = {
  key: string;
  label: string;
  status: string;
  reason: string;
  source: string;
};

function parseRecordJson(value: unknown): any {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string" || !value.trim()) return null;
  try { return JSON.parse(value); } catch { return null; }
}

function text(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function num(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function firstNum(...values: unknown[]): number | null {
  for (const value of values) {
    const n = num(value);
    if (n != null) return n;
  }
  return null;
}

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    const v = text(value);
    if (v) return v;
  }
  return null;
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
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
  return Array.from(new Set([
    report?.identifiers?.operation_id,
    report?.identifiers?.operation_plan_id,
    report?.identifiers?.recommendation_id,
    report?.identifiers?.prescription_id,
    report?.identifiers?.approval_id,
    report?.identifiers?.act_task_id,
    report?.identifiers?.receipt_id,
  ].map((value) => String(value ?? "").trim()).filter(Boolean)));
}

async function queryChainFacts(pool: Pool, tenant: TenantTriple, report: any): Promise<FactRow[]> {
  const ids = idList(report);
  if (!ids.length) return [];
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

function approvalStatus(raw: unknown, fallback: unknown): string | null {
  const value = String(raw ?? fallback ?? "").trim().toUpperCase();
  if (!value) return null;
  if (["APPROVE", "APPROVED", "PASS"].includes(value)) return "APPROVED";
  if (["REJECT", "REJECTED", "FAIL"].includes(value)) return "REJECTED";
  return value;
}

function evidenceIds(facts: FactRow[]): string[] {
  return facts
    .filter((fact) => String(fact.record_json?.type ?? "") === "evidence_artifact_v1")
    .map((fact) => text(fact.record_json?.payload?.evidence_id ?? fact.record_json?.payload?.artifact_id ?? fact.fact_id))
    .filter((value): value is string => Boolean(value));
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
  const receiptRaw = payloadOf(receiptFact);
  const acceptancePayload = payloadOf(acceptanceFact);
  const prescriptionPayload = payloadOf(prescriptionFact);

  const recommendationId = text(report?.identifiers?.recommendation_id ?? rec.recommendation_id);
  const prescriptionId = text(report?.identifiers?.prescription_id ?? prescriptionPayload.prescription_id ?? plan.prescription_id ?? approvalReq.prescription_id ?? plan.operation_plan_id);
  const approvalRequestId = text(report?.identifiers?.approval_id ?? approvalReq.request_id ?? plan.approval_request_id);
  const actTaskId = text(report?.identifiers?.act_task_id ?? task.act_task_id ?? plan.act_task_id);
  const receiptId = text(report?.identifiers?.receipt_id ?? receiptRaw.receipt_id ?? receiptFact?.fact_id);
  const acceptanceId = text(report?.acceptance?.acceptance_id ?? acceptancePayload.acceptance_id ?? acceptanceFact?.fact_id);
  const operationType = text(prescriptionPayload.operation_type ?? prescriptionPayload.action_type ?? plan.operation_type ?? plan.action_type ?? rec.suggested_action?.action_type ?? report.operation_title);

  const soilMoisture = firstNum(rec.skill_trace?.inputs?.soil_moisture, rec.diagnosis?.soil_moisture, rec.soil_moisture);
  const threshold = firstNum(rec.skill_trace?.outputs?.threshold, rec.skill_trace?.outputs?.soil_moisture_threshold, rec.skill_trace?.params?.threshold, rec.diagnosis?.threshold, rec.diagnosis?.soil_moisture_threshold, rec.soil_moisture_threshold);
  const deficitDetected = rec.skill_trace?.outputs?.deficit_detected ?? rec.diagnosis?.deficit_detected ?? rec.diagnosis?.water_deficit;

  const recommendation = recommendationId ? {
    recommendation_id: recommendationId,
    diagnosis_basis: rec.diagnosis_basis ?? rec.data_summary ?? rec.summary ?? report?.why?.objective_text ?? null,
    agronomy_explain: rec.agronomy_explain ?? rec.explain?.human ?? rec.explain_human ?? rec.summary ?? report?.why?.explain_human ?? null,
    reason_codes: arr(rec.reason_codes ?? report?.risk?.reasons).map(String).filter(Boolean),
    evidence_refs: arr(rec.evidence_refs ?? rec.evidence_ids),
    confidence: rec.confidence ?? rec.confidence_level ?? null,
    status: text(rec.status ?? "AVAILABLE"),
    soil_moisture: soilMoisture,
    soil_moisture_threshold: threshold,
    threshold,
    deficit_detected: deficitDetected,
    water_deficit: deficitDetected,
    observation_window: firstText(rec.observation_window, rec.window, rec.skill_trace?.inputs?.observation_window),
    rainfall_24h_mm: firstNum(rec.rainfall_24h_mm, rec.weather?.rainfall_24h_mm),
    forecast_rainfall_24h_mm: firstNum(rec.forecast_rainfall_24h_mm, rec.weather?.forecast_rainfall_24h_mm),
    source_summary: firstText(rec.source_summary, rec.data_summary, rec.summary),
    missing_inputs: rec.missing_inputs ?? [],
    skill_trace: rec.skill_trace ?? null,
  } : null;

  const prescription = prescriptionId ? {
    prescription_id: prescriptionId,
    recommendation_id: recommendationId,
    operation_type: operationType,
    amount: prescriptionPayload.amount ?? prescriptionPayload.planned_amount ?? plan.amount ?? plan.planned_amount ?? rec.suggested_action?.parameters?.amount ?? null,
    unit: prescriptionPayload.unit ?? plan.unit ?? rec.suggested_action?.parameters?.unit ?? null,
    time_window: prescriptionPayload.time_window ?? prescriptionPayload.timing_window ?? plan.time_window ?? plan.timing_window ?? null,
    acceptance_conditions: prescriptionPayload.acceptance_conditions ?? plan.acceptance_conditions ?? rec.acceptance_conditions ?? null,
    device_requirements: prescriptionPayload.device_requirements ?? plan.device_requirements ?? rec.suggested_action?.device_requirements ?? null,
    status: text(prescriptionPayload.status ?? plan.status ?? "AVAILABLE"),
  } : null;

  const approval = approvalRequestId ? {
    approval_request_id: approvalRequestId,
    status: approvalStatus(approvalDecision.decision, report?.approval?.status) ?? "PENDING",
    actor_id: text(approvalDecision.actor_id ?? approvalDecision.decider ?? report?.approval?.actor_id),
    actor_name: text(approvalDecision.actor_name ?? approvalDecision.actor_label ?? report?.approval?.actor_name),
    approved_at: text(approvalDecision.approved_at ?? approvalDecision.decided_at ?? report?.approval?.approved_at),
    note: text(approvalDecision.note ?? approvalDecision.reason ?? report?.approval?.note),
  } : null;

  const asExecuted = report.as_executed ?? null;
  const deviceId = text(asExecuted?.device_id ?? task.device_id ?? task.executor?.device_id ?? receiptRaw.device_id);
  const execution = actTaskId ? {
    act_task_id: actTaskId,
    dispatch_status: text(task.status ?? report?.execution?.final_status ?? "PENDING"),
    executor: { kind: deviceId ? "device" : "human", id: deviceId ?? text(asExecuted?.operator_id ?? task.executor_id) },
    device_id: deviceId,
    execution_mode: deviceId ? "DEVICE" : "HUMAN",
    receipt_id: receiptId,
    receipt_status: text(receiptRaw.status ?? (receiptId ? "RECEIVED" : null)),
    as_executed: asExecuted,
    execution_started_at: text(receiptRaw.execution_started_at ?? asExecuted?.execution_started_at ?? asExecuted?.started_at),
    execution_finished_at: text(receiptRaw.execution_finished_at ?? asExecuted?.execution_finished_at ?? asExecuted?.finished_at),
  } : null;

  const evidenceIdList = evidenceIds(facts);
  const evidenceComplete = Boolean((report?.evidence?.receipt_present && report?.evidence?.acceptance_present) || evidenceIdList.length > 0 || evidenceSummaryFact);
  const evidence = {
    evidence_status: evidenceComplete ? "COMPLETE" : "INCOMPLETE",
    evidence_ids: evidenceIdList,
    trusted: evidenceComplete && report?.acceptance?.missing_evidence !== true,
  };

  const acceptance = acceptanceId || acceptancePayload.verdict || report?.acceptance?.status ? {
    acceptance_id: acceptanceId,
    verdict: text(acceptancePayload.verdict ?? report?.acceptance?.verdict ?? report?.acceptance?.status),
    evidence_sufficient: report?.acceptance?.missing_evidence !== true,
    accepted_at: text(acceptancePayload.accepted_at ?? acceptancePayload.generated_at ?? report?.acceptance?.generated_at ?? acceptanceFact?.occurred_at),
    failure_reason: text(acceptancePayload.failure_reason ?? report?.execution?.invalid_reason),
  } : null;

  const diagnosis = {
    field_id: text(report?.identifiers?.field_id),
    diagnosis_basis: recommendation?.diagnosis_basis ?? report?.why?.objective_text ?? null,
    risk_level: report?.risk?.level ?? null,
    reason_codes: recommendation?.reason_codes ?? [],
    soil_moisture: soilMoisture,
    soil_moisture_threshold: threshold,
    threshold,
    deficit_detected: deficitDetected,
    water_deficit: deficitDetected,
    observation_window: recommendation?.observation_window ?? null,
    rainfall_24h_mm: recommendation?.rainfall_24h_mm ?? null,
    forecast_rainfall_24h_mm: recommendation?.forecast_rainfall_24h_mm ?? null,
    source_summary: recommendation?.source_summary ?? null,
    confidence: rec.confidence ?? rec.confidence_level ?? null,
    missing_inputs: rec.missing_inputs ?? [],
  };

  const operationPlan = text(report?.identifiers?.operation_plan_id ?? plan.operation_plan_id) ? {
    operation_plan_id: text(report?.identifiers?.operation_plan_id ?? plan.operation_plan_id),
    recommendation_id: recommendationId,
    prescription_id: prescriptionId,
    approval_request_id: approvalRequestId,
    field_id: text(report?.identifiers?.field_id ?? plan.field_id),
    status: text(plan.status ?? "AVAILABLE"),
    source: text(plan.source),
    meta: plan.meta ?? null,
  } : null;

  const validation = validateOperationChainV1({ facts, report, rec, prescriptionPayload, approvalDecision, task, receipt: receiptRaw, acceptancePayload, recommendation, prescription, approval, operationPlan, execution, evidence, acceptance });

  return {
    ...report,
    operation_id: text(report?.identifiers?.operation_id ?? report?.identifiers?.operation_plan_id),
    field: { field_id: text(report?.identifiers?.field_id), field_name: text(report?.field_name) },
    diagnosis,
    recommendation,
    prescription,
    approval,
    operation_plan: operationPlan,
    execution,
    receipt: receiptId ? { receipt_id: receiptId, status: text(receiptRaw.status ?? "RECEIVED"), submitted_at: text(receiptRaw.submitted_at ?? receiptFact?.occurred_at), metrics: receiptRaw.metrics ?? null, execution_time: receiptRaw.execution_time ?? null, meta: receiptRaw.meta ?? null } : null,
    evidence,
    acceptance,
    roi: report?.roi_ledger ?? null,
    field_memory: report?.field_memory ?? null,
    chain_integrity: validation.chain_integrity,
    chain_flags: validation.chain_flags,
    missing_links: validation.missing_links,
    legacy_warning: validation.legacy_warning,
    status_chain: validation.status_chain,
    chain_validation: validation.validation,
  };
}
