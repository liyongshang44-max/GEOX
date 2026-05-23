import type { Pool } from "pg";
import { buildAcceptanceResult } from "../domain/acceptance/acceptance_engine_v1.js";
import { evaluateEvidence } from "../domain/acceptance/evidence_policy.js";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };
type FactRow = { fact_id: string; occurred_at: string; record_json: any };

type TimelineType =
  | "ASSIGNMENT_CREATED"
  | "ASSIGNMENT_ACCEPTED"
  | "ASSIGNMENT_ARRIVED"
  | "RECEIPT_SUBMITTED"
  | "ACCEPTANCE_GENERATED"
  | "RECOMMENDATION_CREATED"
  | "APPROVAL_DECIDED"
  | "TASK_CREATED"
  | "DEVICE_ACK"
  | "DEVICE_FAILED_TO_HUMAN"
  | "EXECUTING"
  | "SUCCEEDED"
  | "FAILED"
  | "INVALID_EXECUTION"
  | "MANUAL_FALLBACK";

export type OperationTimelineItemV1 = {
  ts: number;
  type: TimelineType;
  label: string;
};

export type OperationStateSourceV1 = "TECHNICAL_PROJECTION" | "FORMAL_ACCEPTANCE" | "FALLBACK_LIMITED";
export type OperationFormalStatusV1 = "FORMAL_PASS" | "FORMAL_FAIL" | "NOT_FORMAL";
export type OperationAcceptanceStatusV1 = "PASS" | "FAIL" | "PENDING" | "NOT_AVAILABLE";
type OperationAcceptanceRawStatusV1 = OperationAcceptanceStatusV1 | "NEEDS_FORMAL_ACCEPTANCE" | "INSUFFICIENT_EVIDENCE";

type TechnicalAcceptanceHintV1 = {
  verdict: string;
  missing_evidence: string[];
  reason: "TECHNICAL_HINT_NOT_FORMAL_ACCEPTANCE";
};

export type OperationStateV1 = {
  operation_id: string;
  operation_plan_id: string;
  recommendation_id: string | null;
  approval_id: string | null;
  act_task_id: string | null;
  receipt_id: string | null;
  program_id: string | null;
  approval_request_id: string | null;
  approval_decision_id: string | null;
  task_id: string | null;
  device_id: string | null;
  field_id: string | null;
  season_id: string | null;
  crop_code: string | null;
  crop_stage: string | null;
  rule_id: string | null;
  skill_id: string | null;
  rule_hit: Array<{ rule_id: string; matched: boolean; threshold?: number | null; actual?: number | null }>;
  reason_codes: string[];
  action_type: string | null;
  before_metrics: { soil_moisture?: number | null; temperature?: number; humidity?: number };
  after_metrics: { soil_moisture?: number | null; temperature?: number; humidity?: number };
  expected_effect: { type: "moisture_increase" | "growth_boost"; value: number } | null;
  risk_if_not_execute: string | null;
  actual_effect: { type: string; value: number } | null;
  dispatch_status: string;
  receipt_status: string;
  acceptance: { status: OperationAcceptanceStatusV1; missing: string[]; raw_status?: OperationAcceptanceRawStatusV1 };
  technical_acceptance_hint?: TechnicalAcceptanceHintV1;
  formal_acceptance_status?: OperationFormalStatusV1;
  final_status: "SUCCESS" | "FAILED" | "RUNNING" | "PENDING" | "PENDING_ACCEPTANCE" | "INVALID_EXECUTION";
  invalid_reason: "evidence_missing" | "evidence_invalid" | null;
  last_event_ts: number;
  timeline: OperationTimelineItemV1[];
  state_source: OperationStateSourceV1;
  formal_status: OperationFormalStatusV1;
  source_facts: string[];
  projection_rule: string;
  freshness: { updated_at: string; stale: boolean };
  blocking_reasons: string[];
  fallback_limited: boolean;
  customer_visible_eligible: boolean;
  manual_fallback?: {
    reason_code: string | null;
    reason: string | null;
    message: string | null;
    assignment_id: string | null;
    created_at: string | null;
    device_context: { device_id: string | null; adapter_type: string | null; attempt_no: number | null; max_retries: number | null };
  } | null;
  skill_trace: {
    crop_skill: { skill_id: string | null; version: string | null; run_id: string | null; result_status: string | null; error_code: string | null };
    agronomy_skill: { skill_id: string | null; version: string | null; run_id: string | null; result_status: string | null; error_code: string | null };
    device_skill: { skill_id: string | null; version: string | null; run_id: string | null; result_status: string | null; error_code: string | null };
    acceptance_skill: { skill_id: string | null; version: string | null; run_id: string | null; result_status: string | null; error_code: string | null };
  };
  as_applied?: { as_applied_id?: string | null; zone_id?: string | null; application?: any } | null;
};

export type OperationProjectionFactRow = FactRow;

function parseRecordJson(v: any): any {
  if (v && typeof v === "object") return v;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return null; }
  }
  return null;
}
function toMs(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const ms = Date.parse(String(v ?? ""));
  return Number.isFinite(ms) ? ms : 0;
}
function toText(v: unknown): string | null {
  const text = String(v ?? "").trim();
  return text ? text : null;
}
function toNumOrUndef(v: unknown): number | undefined {
  const n = Number(v ?? NaN);
  return Number.isFinite(n) ? n : undefined;
}
function latestByKey(rows: FactRow[], keyFn: (row: FactRow) => string): Map<string, FactRow> {
  const out = new Map<string, FactRow>();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    const prev = out.get(key);
    if (!prev || toMs(row.occurred_at) >= toMs(prev.occurred_at)) out.set(key, row);
  }
  return out;
}
function latestNonEmpty<T>(rows: FactRow[], pick: (row: FactRow) => T | null | undefined): T | null {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const value = pick(rows[i]);
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed as T;
      continue;
    }
    if (value !== null && value !== undefined) return value;
  }
  return null;
}
function toMetricsSnapshot(v: any): { soil_moisture?: number; temperature?: number; humidity?: number } {
  const raw = (v && typeof v === "object") ? v : {};
  const out: { soil_moisture?: number; temperature?: number; humidity?: number } = {};
  const sm = toNumOrUndef(raw.soil_moisture);
  const temp = toNumOrUndef(raw.temperature);
  const hum = toNumOrUndef(raw.humidity);
  if (sm !== undefined) out.soil_moisture = sm;
  if (temp !== undefined) out.temperature = temp;
  if (hum !== undefined) out.humidity = hum;
  return out;
}
function normalizeAcceptanceVerdict(verdictRaw: unknown): OperationAcceptanceRawStatusV1 | null {
  const verdict = String(verdictRaw ?? "").trim().toUpperCase();
  if (!verdict) return null;
  if (verdict === "PASS") return "PASS";
  if (verdict === "FAIL") return "FAIL";
  if (verdict === "PARTIAL" || verdict === "PENDING") return "PENDING";
  if (verdict === "NEEDS_FORMAL_ACCEPTANCE") return "NEEDS_FORMAL_ACCEPTANCE";
  if (verdict === "INSUFFICIENT_EVIDENCE") return "INSUFFICIENT_EVIDENCE";
  return null;
}
function toProjectionAcceptanceStatus(status: unknown): OperationAcceptanceStatusV1 {
  const s = String(status ?? "").trim().toUpperCase();
  if (s === "PASS") return "PASS";
  if (s === "FAIL") return "FAIL";
  if (s === "PENDING") return "PENDING";
  if (s === "NEEDS_FORMAL_ACCEPTANCE") return "PENDING";
  if (s === "INSUFFICIENT_EVIDENCE") return "PENDING";
  return "NOT_AVAILABLE";
}
function toNonFormalAcceptanceRawStatus(status: unknown, hasFormalEvidence: boolean): "NEEDS_FORMAL_ACCEPTANCE" | "INSUFFICIENT_EVIDENCE" {
  const s = String(status ?? "").trim().toUpperCase();
  if (s === "NEEDS_FORMAL_ACCEPTANCE") return "NEEDS_FORMAL_ACCEPTANCE";
  if (s === "INSUFFICIENT_EVIDENCE") return "INSUFFICIENT_EVIDENCE";
  return hasFormalEvidence ? "NEEDS_FORMAL_ACCEPTANCE" : "INSUFFICIENT_EVIDENCE";
}
function isFormalAcceptancePayload(payload: any): boolean {
  if (!payload || typeof payload !== "object") return false;
  if (payload.formal_acceptance === true) return true;
  if (payload.formal_evidence_passed === true && payload.is_simulated !== true) return true;
  if (payload.source_lane === "FORMAL_OPERATION" && payload.customer_visible_eligible === true) return true;
  return false;
}
function hasExecutedReceiptStatus(statusRaw: unknown): boolean {
  const status = String(statusRaw ?? "").trim().toUpperCase();
  if (!status) return false;
  return ["DONE", "SUCCEEDED", "SUCCESS", "EXECUTED", "ACKED"].includes(status);
}
function transitionToTimelineType(statusRaw: string): TimelineType | null {
  const status = statusRaw.toUpperCase();
  if (["CREATED", "PROPOSED"].includes(status)) return "RECOMMENDATION_CREATED";
  if (["PENDING_APPROVAL", "APPROVED", "REJECTED"].includes(status)) return "APPROVAL_DECIDED";
  if (["READY", "DISPATCHED"].includes(status)) return "TASK_CREATED";
  if (["EXECUTING", "IN_PROGRESS", "RUNNING"].includes(status)) return "EXECUTING";
  if (["SUCCEEDED", "SUCCESS", "DONE"].includes(status)) return "SUCCEEDED";
  if (["FAILED", "ERROR"].includes(status)) return "FAILED";
  return null;
}
function timelineLabel(type: TimelineType): string {
  if (type === "ASSIGNMENT_CREATED") return "assignment created";
  if (type === "ASSIGNMENT_ACCEPTED") return "assignment accepted";
  if (type === "ASSIGNMENT_ARRIVED") return "assignment arrived";
  if (type === "RECEIPT_SUBMITTED") return "receipt submitted";
  if (type === "ACCEPTANCE_GENERATED") return "acceptance generated";
  if (type === "RECOMMENDATION_CREATED") return "recommendation created";
  if (type === "APPROVAL_DECIDED") return "approval decided";
  if (type === "TASK_CREATED") return "task created";
  if (type === "DEVICE_ACK") return "device ack";
  if (type === "DEVICE_FAILED_TO_HUMAN") return "设备失败→人工接管";
  if (type === "EXECUTING") return "executing";
  if (type === "SUCCEEDED") return "execution success";
  if (type === "INVALID_EXECUTION") return "执行无效";
  if (type === "MANUAL_FALLBACK") return "转人工处理";
  return "execution failed";
}
function statusFromTransitionForTechnicalProjection(statusRaw: string): OperationStateV1["final_status"] | null {
  const s = statusRaw.toUpperCase();
  if (["EXECUTING", "RUNNING", "IN_PROGRESS", "DISPATCHED", "READY", "APPROVED"].includes(s)) return "RUNNING";
  if (["FAILED", "ERROR", "REJECTED", "SUCCEEDED", "SUCCESS", "DONE"].includes(s)) return "PENDING_ACCEPTANCE";
  if (s) return "PENDING";
  return null;
}
function emptySkillTraceNode() {
  return { skill_id: null as string | null, version: null as string | null, run_id: null as string | null, result_status: null as string | null, error_code: null as string | null };
}
function mapSkillRun(row: FactRow | null | undefined) {
  const payload = row?.record_json?.payload ?? {};
  return { skill_id: toText(payload.skill_id), version: toText(payload.version), run_id: toText(payload.run_id), result_status: toText(payload.result_status), error_code: toText(payload.error_code) };
}
async function loadFacts(pool: Pool, tenant: TenantTriple): Promise<FactRow[]> {
  const sql = `SELECT fact_id, occurred_at, (record_json::jsonb) AS record_json FROM facts
    WHERE (record_json::jsonb->>'type') IN (
      'decision_recommendation_v1','approval_request_v1','approval_decision_v1',
      'operation_plan_v1','operation_plan_transition_v1','ao_act_task_v0','ao_act_receipt_v1','ao_act_receipt_v0',
      'acceptance_result_v1','work_assignment_upserted_v1','work_assignment_status_changed_v1','work_assignment_submitted_v1',
      'ao_act_manual_fallback_v1','evidence_artifact_v1','field_program_v1','skill_run_v1'
    )
      AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
      AND ((record_json::jsonb#>>'{payload,project_id}') = $2 OR COALESCE((record_json::jsonb#>>'{payload,project_id}'),'') = '')
      AND ((record_json::jsonb#>>'{payload,group_id}') = $3 OR COALESCE((record_json::jsonb#>>'{payload,group_id}'),'') = '')
    ORDER BY occurred_at ASC, fact_id ASC`;
  const res = await pool.query(sql, [tenant.tenant_id, tenant.project_id, tenant.group_id]);
  return (res.rows ?? []).map((row: any) => ({ fact_id: String(row.fact_id), occurred_at: String(row.occurred_at), record_json: parseRecordJson(row.record_json) ?? row.record_json }));
}
async function loadAsAppliedMapRows(pool: Pool, tenant: TenantTriple): Promise<any[]> {
  try {
    const q = await pool.query(
      `SELECT as_applied_id, as_executed_id, task_id, receipt_id, prescription_id, zone_id, application, updated_at, created_at
         FROM as_applied_map_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
        ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, as_applied_id DESC`,
      [tenant.tenant_id, tenant.project_id, tenant.group_id],
    );
    return q.rows ?? [];
  } catch {
    return [];
  }
}
export function projectOperationStateFromFacts(facts: OperationProjectionFactRow[]): OperationStateV1[] {
  const planFactsByOperationId = new Map<string, FactRow[]>();
  for (const row of facts.filter((r) => r.record_json?.type === "operation_plan_v1")) {
    const operationPlanId = toText(row.record_json?.payload?.operation_plan_id);
    if (!operationPlanId) continue;
    const rows = planFactsByOperationId.get(operationPlanId) ?? [];
    rows.push(row);
    planFactsByOperationId.set(operationPlanId, rows);
  }
  const recById = latestByKey(facts.filter((r) => r.record_json?.type === "decision_recommendation_v1"), (r) => String(r.record_json?.payload?.recommendation_id ?? "").trim());
  const requestById = latestByKey(facts.filter((r) => r.record_json?.type === "approval_request_v1"), (r) => String(r.record_json?.payload?.request_id ?? "").trim());
  const decisionByReq = latestByKey(facts.filter((r) => r.record_json?.type === "approval_decision_v1"), (r) => String(r.record_json?.payload?.request_id ?? "").trim());
  const taskById = latestByKey(facts.filter((r) => r.record_json?.type === "ao_act_task_v0"), (r) => String(r.record_json?.payload?.act_task_id ?? "").trim());
  const receiptByTask = latestByKey(facts.filter((r) => ["ao_act_receipt_v0", "ao_act_receipt_v1"].includes(String(r.record_json?.type ?? ""))), (r) => String(r.record_json?.payload?.act_task_id ?? r.record_json?.payload?.task_id ?? "").trim());
  const acceptanceFacts = facts.filter((r) => String(r.record_json?.type ?? "") === "acceptance_result_v1");
  const acceptanceByPlan = latestByKey(acceptanceFacts, (r) => String(r.record_json?.payload?.operation_plan_id ?? "").trim());
  const acceptanceByTask = latestByKey(acceptanceFacts, (r) => String(r.record_json?.payload?.act_task_id ?? "").trim());
  const manualFallbackByTask = latestByKey(facts.filter((r) => r.record_json?.type === "ao_act_manual_fallback_v1"), (r) => String(r.record_json?.payload?.act_task_id ?? "").trim());
  const skillRuns = facts.filter((r) => String(r.record_json?.type ?? "") === "skill_run_v1");
  const transitionByPlan = new Map<string, FactRow[]>();
  for (const row of facts.filter((r) => r.record_json?.type === "operation_plan_transition_v1")) {
    const operationPlanId = toText(row.record_json?.payload?.operation_plan_id);
    if (!operationPlanId) continue;
    const arr = transitionByPlan.get(operationPlanId) ?? [];
    arr.push(row);
    transitionByPlan.set(operationPlanId, arr);
  }
  const states: OperationStateV1[] = [];
  for (const row of facts.filter((r) => r.record_json?.type === "operation_plan_v1").reverse()) {
    const payload = row.record_json?.payload ?? {};
    const operation_plan_id = toText(payload.operation_plan_id);
    if (!operation_plan_id) continue;
    if (states.some((s) => s.operation_id === operation_plan_id)) continue;
    const allPlanFacts = planFactsByOperationId.get(operation_plan_id) ?? [row];
    const recommendation_id = latestNonEmpty(allPlanFacts, (planFact) => toText(planFact.record_json?.payload?.recommendation_id)) ?? null;
    const approval_request_id = latestNonEmpty(allPlanFacts, (planFact) => toText(planFact.record_json?.payload?.approval_request_id)) ?? null;
    const task_id = latestNonEmpty(allPlanFacts, (planFact) => toText(planFact.record_json?.payload?.act_task_id)) ?? null;
    const rec = recommendation_id ? recById.get(recommendation_id) : undefined;
    const req = approval_request_id ? requestById.get(approval_request_id) : undefined;
    const decision = approval_request_id ? decisionByReq.get(approval_request_id) : undefined;
    const task = task_id ? taskById.get(task_id) : undefined;
    const receipt = task_id ? receiptByTask.get(task_id) : undefined;
    const manualFallbackFact = task_id ? manualFallbackByTask.get(task_id) : undefined;
    const acceptanceFact = acceptanceByPlan.get(operation_plan_id) ?? (task_id ? acceptanceByTask.get(task_id) : undefined);
    const sourceFacts = Array.from(new Set([row.fact_id, rec?.fact_id, req?.fact_id, decision?.fact_id, task?.fact_id, receipt?.fact_id, acceptanceFact?.fact_id, manualFallbackFact?.fact_id].filter((x): x is string => Boolean(x))));
    const artifactPayloads = facts.filter((f) => String(f.record_json?.type ?? "") === "evidence_artifact_v1").map((f) => ({ fact_id: f.fact_id, payload: f.record_json?.payload ?? {} })).filter((artifact) => {
      const byPlan = String(artifact.payload?.operation_plan_id ?? "").trim() === operation_plan_id;
      const byTask = task_id ? String(artifact.payload?.act_task_id ?? "").trim() === task_id : false;
      return byPlan || byTask;
    });
    for (const artifact of artifactPayloads) sourceFacts.push(artifact.fact_id);
    const artifactEvidence = artifactPayloads.map((artifact) => ({ kind: String(artifact.payload?.kind ?? "artifact") }));
    const receiptPayload = receipt?.record_json?.payload ?? {};
    const mediaEvidence = artifactPayloads.filter((artifact) => {
      const kind = String(artifact.payload?.kind ?? "").toLowerCase();
      return kind.includes("image") || kind.includes("video") || kind.includes("media") || kind.includes("photo") || kind.includes("trajectory");
    }).map((artifact) => ({ kind: String(artifact.payload?.kind ?? "media") }));
    const evidenceEvaluation = evaluateEvidence({ artifacts: artifactEvidence, logs: Array.isArray(receiptPayload?.logs_refs) ? receiptPayload.logs_refs : [], media: mediaEvidence, metrics: Array.isArray(receiptPayload?.metrics) ? receiptPayload.metrics : [] });
    const fallbackAcceptance = buildAcceptanceResult({ operation_plan_id, hasReceipt: Boolean(receipt), evidenceCount: artifactEvidence.length, hasFormalEvidence: evidenceEvaluation.has_formal_evidence });
    const acceptanceFactPayload = acceptanceFact?.record_json?.payload ?? {};
    const acceptanceStatusFromFact = normalizeAcceptanceVerdict(acceptanceFactPayload?.verdict);
    const hasFormalAcceptance = Boolean(acceptanceFact && acceptanceStatusFromFact) && isFormalAcceptancePayload(acceptanceFactPayload);
    const nonFormalRawAcceptanceStatus = toNonFormalAcceptanceRawStatus(fallbackAcceptance.verdict, evidenceEvaluation.has_formal_evidence);
    const rawAcceptanceStatus = hasFormalAcceptance ? acceptanceStatusFromFact : nonFormalRawAcceptanceStatus;
    const fallbackMissingEvidence = Array.isArray(fallbackAcceptance.missing_evidence) ? fallbackAcceptance.missing_evidence.map((x: unknown) => String(x)).filter(Boolean) : [];
    const technicalAcceptanceHint: TechnicalAcceptanceHintV1 | undefined = hasFormalAcceptance ? undefined : {
      verdict: String(fallbackAcceptance.verdict ?? nonFormalRawAcceptanceStatus),
      missing_evidence: fallbackMissingEvidence,
      reason: "TECHNICAL_HINT_NOT_FORMAL_ACCEPTANCE"
    };
    const acceptance = hasFormalAcceptance ? {
      status: toProjectionAcceptanceStatus(acceptanceStatusFromFact),
      raw_status: acceptanceStatusFromFact as OperationAcceptanceRawStatusV1,
      missing: Array.isArray(acceptanceFactPayload?.missing_evidence) ? acceptanceFactPayload.missing_evidence.map((x: unknown) => String(x)).filter(Boolean) : []
    } : { status: receipt ? "PENDING" as OperationAcceptanceStatusV1 : "NOT_AVAILABLE" as OperationAcceptanceStatusV1, raw_status: nonFormalRawAcceptanceStatus, missing: fallbackMissingEvidence };
    const transitions = transitionByPlan.get(operation_plan_id) ?? [];
    const timeline: OperationTimelineItemV1[] = [];
    for (const t of transitions) {
      const type = transitionToTimelineType(String(t.record_json?.payload?.status ?? "").trim());
      if (type) timeline.push({ ts: toMs(t.occurred_at), type, label: timelineLabel(type) });
    }
    if (rec) timeline.push({ ts: toMs(rec.occurred_at), type: "RECOMMENDATION_CREATED", label: timelineLabel("RECOMMENDATION_CREATED") });
    if (req || decision) timeline.push({ ts: toMs((decision ?? req)?.occurred_at), type: "APPROVAL_DECIDED", label: timelineLabel("APPROVAL_DECIDED") });
    if (task) timeline.push({ ts: toMs(task.occurred_at), type: "TASK_CREATED", label: timelineLabel("TASK_CREATED") });
    if (receipt) {
      const ts = toMs(receipt.occurred_at);
      timeline.push({ ts, type: "RECEIPT_SUBMITTED", label: timelineLabel("RECEIPT_SUBMITTED") });
      timeline.push({ ts, type: "DEVICE_ACK", label: timelineLabel("DEVICE_ACK") });
    }
    if (manualFallbackFact) timeline.push({ ts: toMs(manualFallbackFact.occurred_at), type: "MANUAL_FALLBACK", label: timelineLabel("MANUAL_FALLBACK") });
    if (acceptanceFact) timeline.push({ ts: toMs(acceptanceFact.occurred_at), type: "ACCEPTANCE_GENERATED", label: timelineLabel("ACCEPTANCE_GENERATED") });
    const fullTimeline = [...new Map(timeline.map((item) => [`${item.type}_${item.ts}`, item])).values()].sort((a, b) => a.ts - b.ts);
    const receiptStatus = String(receipt?.record_json?.payload?.status ?? "PENDING");
    const latestTransition = transitions.length ? String(transitions[transitions.length - 1].record_json?.payload?.status ?? "") : "";
    const executedReceipt = hasExecutedReceiptStatus(receiptStatus);
    const stateSource: OperationStateSourceV1 = hasFormalAcceptance ? "FORMAL_ACCEPTANCE" : "FALLBACK_LIMITED";
    const formalStatus: OperationFormalStatusV1 = hasFormalAcceptance && rawAcceptanceStatus === "PASS" ? "FORMAL_PASS" : hasFormalAcceptance && rawAcceptanceStatus === "FAIL" ? "FORMAL_FAIL" : "NOT_FORMAL";
    const fallbackLimited = !hasFormalAcceptance;
    const blockingReasons = new Set<string>(fallbackLimited ? ["formal_acceptance_required"] : []);
    if (!receipt) blockingReasons.add("receipt_missing");
    if (receipt && !evidenceEvaluation.has_formal_evidence) blockingReasons.add(evidenceEvaluation.reason === "only_sim_trace" ? "formal_evidence_invalid" : "formal_evidence_missing");
    for (const reason of evidenceEvaluation.blocking_reasons ?? []) blockingReasons.add(String(reason));
    for (const reason of acceptance.missing ?? []) blockingReasons.add(String(reason));
    if (manualFallbackFact) blockingReasons.add("manual_fallback_present");
    const finalStatusNormalized: OperationStateV1["final_status"] = formalStatus === "FORMAL_PASS" ? "SUCCESS" : formalStatus === "FORMAL_FAIL" ? "FAILED" : receipt && executedReceipt ? "PENDING_ACCEPTANCE" : statusFromTransitionForTechnicalProjection(latestTransition) ?? (task_id ? "RUNNING" : "PENDING");
    const latestPlanPayload = allPlanFacts[allPlanFacts.length - 1]?.record_json?.payload ?? payload;
    const inferredFieldId = latestNonEmpty(allPlanFacts, (planFact) => toText(planFact.record_json?.payload?.field_id ?? planFact.record_json?.payload?.target?.ref)) ?? toText(rec?.record_json?.payload?.field_id);
    const inferredSeasonId = toText(latestPlanPayload.season_id ?? rec?.record_json?.payload?.season_id);
    const inferredCropCode = toText(rec?.record_json?.payload?.crop_code) ?? latestNonEmpty(allPlanFacts, (planFact) => toText(planFact.record_json?.payload?.crop_code));
    const inferredCropStage = toText(rec?.record_json?.payload?.crop_stage) ?? latestNonEmpty(allPlanFacts, (planFact) => toText(planFact.record_json?.payload?.crop_stage));
    const inferredRuleId = toText(rec?.record_json?.payload?.rule_id) ?? latestNonEmpty(allPlanFacts, (planFact) => toText(planFact.record_json?.payload?.rule_id)) ?? toText(rec?.record_json?.payload?.rule_hit?.[0]?.rule_id);
    const inferredSkillId = toText(rec?.record_json?.payload?.skill_id) ?? latestNonEmpty(allPlanFacts, (planFact) => toText(planFact.record_json?.payload?.skill_id)) ?? inferredRuleId;
    const ruleHit = (Array.isArray(rec?.record_json?.payload?.rule_hit) ? rec?.record_json?.payload?.rule_hit : Array.isArray(latestPlanPayload?.rule_hit) ? latestPlanPayload.rule_hit : []).map((hit: any) => ({ rule_id: String(hit?.rule_id ?? "").trim(), matched: Boolean(hit?.matched), threshold: Number.isFinite(Number(hit?.threshold)) ? Number(hit.threshold) : null, actual: Number.isFinite(Number(hit?.actual)) ? Number(hit.actual) : null })).filter((hit: any) => Boolean(hit.rule_id));
    const reasonCodes = (Array.isArray(rec?.record_json?.payload?.reason_codes) ? rec?.record_json?.payload?.reason_codes : Array.isArray(latestPlanPayload?.reason_codes) ? latestPlanPayload.reason_codes : []).map((x: unknown) => String(x ?? "").trim()).filter(Boolean);
    const skillRunsForOperation = skillRuns.filter((runFact) => {
      const p = runFact.record_json?.payload ?? {};
      return toText(p.operation_id) === operation_plan_id || toText(p.operation_plan_id) === operation_plan_id;
    });
    const latestSkillRun = (predicate: (runFact: FactRow) => boolean): FactRow | null => {
      const matched = skillRunsForOperation.filter(predicate).sort((a, b) => toMs(a.occurred_at) - toMs(b.occurred_at));
      return matched[matched.length - 1] ?? null;
    };
    states.push({
      operation_id: operation_plan_id,
      operation_plan_id,
      recommendation_id,
      approval_id: toText(decision?.record_json?.payload?.decision_id) ?? approval_request_id,
      act_task_id: task_id,
      receipt_id: receipt ? toText(receipt.record_json?.payload?.receipt_id) ?? receipt.fact_id : null,
      program_id: toText(latestPlanPayload.program_id ?? rec?.record_json?.payload?.program_id ?? req?.record_json?.payload?.program_id ?? task?.record_json?.payload?.program_id ?? task?.record_json?.payload?.meta?.program_id),
      approval_request_id,
      approval_decision_id: toText(decision?.record_json?.payload?.decision_id),
      task_id,
      device_id: latestNonEmpty(allPlanFacts, (planFact) => toText(planFact.record_json?.payload?.device_id)) ?? toText(task?.record_json?.payload?.meta?.device_id ?? rec?.record_json?.payload?.device_id),
      field_id: inferredFieldId,
      season_id: inferredSeasonId,
      crop_code: inferredCropCode,
      crop_stage: inferredCropStage,
      rule_id: inferredRuleId,
      skill_id: inferredSkillId,
      rule_hit: ruleHit,
      reason_codes: reasonCodes,
      action_type: latestNonEmpty(allPlanFacts, (planFact) => toText(planFact.record_json?.payload?.action_type)) ?? toText(task?.record_json?.payload?.action_type ?? rec?.record_json?.payload?.suggested_action?.action_type),
      before_metrics: toMetricsSnapshot(latestPlanPayload?.before_metrics),
      after_metrics: toMetricsSnapshot(latestPlanPayload?.after_metrics),
      expected_effect: null,
      risk_if_not_execute: toText(rec?.record_json?.payload?.risk_if_not_execute ?? latestPlanPayload?.risk_if_not_execute),
      actual_effect: null,
      dispatch_status: task_id ? "DISPATCHED" : String(payload.status ?? "CREATED"),
      receipt_status: receiptStatus,
      acceptance,
      technical_acceptance_hint: technicalAcceptanceHint,
      formal_acceptance_status: formalStatus,
      final_status: finalStatusNormalized,
      invalid_reason: null,
      last_event_ts: fullTimeline.length ? fullTimeline[fullTimeline.length - 1].ts : toMs(row.occurred_at),
      timeline: fullTimeline,
      state_source: stateSource,
      formal_status: formalStatus,
      source_facts: Array.from(new Set(sourceFacts)),
      projection_rule: "operation_state_trust_gate_v1: explicit formal acceptance facts are the only source of formal SUCCESS/FAILED; receipts remain technical signals until formal acceptance.",
      freshness: { updated_at: new Date(fullTimeline.length ? fullTimeline[fullTimeline.length - 1].ts : toMs(row.occurred_at)).toISOString(), stale: false },
      blocking_reasons: Array.from(blockingReasons).filter(Boolean),
      fallback_limited: fallbackLimited,
      customer_visible_eligible: formalStatus === "FORMAL_PASS" && !fallbackLimited,
      manual_fallback: manualFallbackFact ? {
        reason_code: toText(manualFallbackFact.record_json?.payload?.reason_code),
        reason: toText(manualFallbackFact.record_json?.payload?.reason),
        message: toText(manualFallbackFact.record_json?.payload?.message),
        assignment_id: toText(manualFallbackFact.record_json?.payload?.assignment_id),
        created_at: manualFallbackFact.occurred_at,
        device_context: {
          device_id: toText(manualFallbackFact.record_json?.payload?.device_context?.device_id),
          adapter_type: toText(manualFallbackFact.record_json?.payload?.device_context?.adapter_type),
          attempt_no: Number.isFinite(Number(manualFallbackFact.record_json?.payload?.device_context?.attempt_no)) ? Number(manualFallbackFact.record_json?.payload?.device_context?.attempt_no) : null,
          max_retries: Number.isFinite(Number(manualFallbackFact.record_json?.payload?.device_context?.max_retries)) ? Number(manualFallbackFact.record_json?.payload?.device_context?.max_retries) : null,
        }
      } : null,
      skill_trace: {
        crop_skill: mapSkillRun(latestSkillRun((runFact) => String(runFact.record_json?.payload?.trigger_stage ?? "").trim().toLowerCase() === "before_recommendation")) ?? emptySkillTraceNode(),
        agronomy_skill: mapSkillRun(latestSkillRun((runFact) => ["after_recommendation", "before_approval"].includes(String(runFact.record_json?.payload?.trigger_stage ?? "").trim().toLowerCase()))) ?? emptySkillTraceNode(),
        device_skill: mapSkillRun(latestSkillRun((runFact) => String(runFact.record_json?.payload?.trigger_stage ?? "").trim().toLowerCase() === "before_dispatch")) ?? emptySkillTraceNode(),
        acceptance_skill: mapSkillRun(latestSkillRun((runFact) => ["before_acceptance", "after_acceptance"].includes(String(runFact.record_json?.payload?.trigger_stage ?? "").trim().toLowerCase()))) ?? emptySkillTraceNode(),
      }
    });
  }
  return states.sort((a, b) => b.last_event_ts - a.last_event_ts);
}
export async function projectOperationStateV1(pool: Pool, tenant: TenantTriple): Promise<OperationStateV1[]> {
  const facts = await loadFacts(pool, tenant);
  const states = projectOperationStateFromFacts(facts);
  const asAppliedRows = await loadAsAppliedMapRows(pool, tenant);
  const normalizeAsApplied = (row: any) => ({ as_applied_id: String(row.as_applied_id ?? "").trim() || null, zone_id: String(row.zone_id ?? "").trim() || null, application: parseRecordJson(row.application) ?? row.application ?? null });
  const findBy = (matcher: (row: any) => boolean) => {
    const found = asAppliedRows.find(matcher);
    return found ? normalizeAsApplied(found) : null;
  };
  return states.map((s) => {
    const byTaskId = s.task_id ? findBy((row) => String(row.task_id ?? "").trim() === s.task_id) : null;
    if (byTaskId) return { ...s, as_applied: byTaskId };
    const byActTaskId = s.act_task_id ? findBy((row) => String(row.task_id ?? "").trim() === s.act_task_id) : null;
    if (byActTaskId) return { ...s, as_applied: byActTaskId };
    const byReceiptId = s.receipt_id ? findBy((row) => String(row.receipt_id ?? "").trim() === s.receipt_id) : null;
    if (byReceiptId) return { ...s, as_applied: byReceiptId };
    const byPrescriptionId = (s as any).prescription_id ? findBy((row) => String(row.prescription_id ?? "").trim() === String((s as any).prescription_id ?? "").trim()) : null;
    if (byPrescriptionId) return { ...s, as_applied: byPrescriptionId };
    return { ...s, as_applied: null };
  });
}
