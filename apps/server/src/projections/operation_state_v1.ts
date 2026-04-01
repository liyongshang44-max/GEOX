import type { Pool } from "pg";
import { buildAcceptanceResult } from "../domain/acceptance/acceptance_engine_v1";
import { evaluateEvidence } from "../domain/acceptance/evidence_policy";

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
  | "EXECUTING"
  | "SUCCEEDED"
  | "FAILED"
  | "INVALID_EXECUTION";

export type OperationTimelineItemV1 = {
  ts: number;
  type: TimelineType;
  label: string;
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
  action_type: string | null;
  dispatch_status: string;
  receipt_status: string;
  acceptance: {
    status: "PASS" | "FAIL" | "PENDING";
    missing: string[];
  };
  final_status: "SUCCESS" | "FAILED" | "RUNNING" | "PENDING" | "PENDING_ACCEPTANCE" | "INVALID_EXECUTION";
  last_event_ts: number;
  timeline: OperationTimelineItemV1[];
};

export type OperationProjectionFactRow = FactRow;

function parseRecordJson(v: any): any {
  if (v && typeof v === "object") return v;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return null; }
  }
  return null;
}
function toMs(v: string | null | undefined): number {
  const ms = Date.parse(String(v ?? ""));
  return Number.isFinite(ms) ? ms : 0;
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

async function loadFacts(pool: Pool, tenant: TenantTriple): Promise<FactRow[]> {
  const sql = `SELECT fact_id, occurred_at, (record_json::jsonb) AS record_json FROM facts
    WHERE (record_json::jsonb->>'type') IN (
      'decision_recommendation_v1','approval_request_v1','approval_decision_v1',
      'operation_plan_v1','operation_plan_transition_v1','ao_act_task_v0','ao_act_receipt_v1','ao_act_receipt_v0',
      'acceptance_result_v1','work_assignment_upserted_v1','work_assignment_status_changed_v1','work_assignment_submitted_v1',
      'evidence_artifact_v1','field_program_v1'
    )
      AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
      AND (
        (record_json::jsonb#>>'{payload,project_id}') = $2
        OR COALESCE((record_json::jsonb#>>'{payload,project_id}'),'') = ''
      )
      AND (
        (record_json::jsonb#>>'{payload,group_id}') = $3
        OR COALESCE((record_json::jsonb#>>'{payload,group_id}'),'') = ''
      )
    ORDER BY occurred_at ASC, fact_id ASC`;
  const res = await pool.query(sql, [tenant.tenant_id, tenant.project_id, tenant.group_id]);
  return (res.rows ?? []).map((row: any) => ({
    fact_id: String(row.fact_id),
    occurred_at: String(row.occurred_at),
    record_json: parseRecordJson(row.record_json) ?? row.record_json
  }));
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
  if (type === "EXECUTING") return "executing";
  if (type === "SUCCEEDED") return "execution success";
  if (type === "INVALID_EXECUTION") return "执行无效";
  return "execution failed";
}

function finalStatusFromTransition(statusRaw: string): OperationStateV1["final_status"] | null {
  const s = statusRaw.toUpperCase();
  if (["SUCCEEDED", "SUCCESS", "DONE"].includes(s)) return "SUCCESS";
  if (["FAILED", "ERROR", "REJECTED"].includes(s)) return "FAILED";
  if (["EXECUTING", "RUNNING", "IN_PROGRESS", "DISPATCHED", "READY", "APPROVED"].includes(s)) return "RUNNING";
  if (s) return "PENDING";
  return null;
}

function finalStatusFromReceipt(receiptStatusRaw: string): OperationStateV1["final_status"] | null {
  const r = receiptStatusRaw.toUpperCase();
  if (r.includes("FAIL") || r.includes("NOT_EXEC")) return "FAILED";
  if (r.includes("SUCCESS") || r.includes("EXECUTED")) return "SUCCESS";
  return null;
}

function hasExecutedReceiptStatus(statusRaw: unknown): boolean {
  const status = String(statusRaw ?? "").trim().toUpperCase();
  if (!status) return false;
  return ["DONE", "SUCCEEDED", "SUCCESS", "EXECUTED", "ACKED"].includes(status);
}

function normalizeAcceptanceVerdict(verdictRaw: unknown): "PASS" | "FAIL" | "PENDING" | null {
  const verdict = String(verdictRaw ?? "").trim().toUpperCase();
  if (!verdict) return null;
  if (verdict === "PASS") return "PASS";
  if (verdict === "FAIL") return "FAIL";
  if (verdict === "PARTIAL") return "PENDING";
  if (verdict === "PENDING") return "PENDING";
  return null;
}

export function projectOperationStateFromFacts(facts: OperationProjectionFactRow[]): OperationStateV1[] {
  const planFactsByOperationId = new Map<string, FactRow[]>();
  for (const row of facts.filter((r) => r.record_json?.type === "operation_plan_v1")) {
    const operationPlanId = String(row.record_json?.payload?.operation_plan_id ?? "").trim();
    if (!operationPlanId) continue;
    const rows = planFactsByOperationId.get(operationPlanId) ?? [];
    rows.push(row);
    planFactsByOperationId.set(operationPlanId, rows);
  }
  const recById = latestByKey(facts.filter((r) => r.record_json?.type === "decision_recommendation_v1"), (r) => String(r.record_json?.payload?.recommendation_id ?? "").trim());
  const requestById = latestByKey(facts.filter((r) => r.record_json?.type === "approval_request_v1"), (r) => String(r.record_json?.payload?.request_id ?? "").trim());
  const decisionByReq = latestByKey(facts.filter((r) => r.record_json?.type === "approval_decision_v1"), (r) => String(r.record_json?.payload?.request_id ?? "").trim());
  const taskById = latestByKey(facts.filter((r) => r.record_json?.type === "ao_act_task_v0"), (r) => String(r.record_json?.payload?.act_task_id ?? "").trim());
  const receiptByTask = latestByKey(
    facts.filter((r) => ["ao_act_receipt_v0", "ao_act_receipt_v1"].includes(String(r.record_json?.type ?? ""))),
    (r) => String(r.record_json?.payload?.act_task_id ?? r.record_json?.payload?.task_id ?? "").trim()
  );
  const acceptanceFacts = facts.filter((r) => String(r.record_json?.type ?? "") === "acceptance_result_v1");
  const acceptanceByPlan = latestByKey(
    acceptanceFacts,
    (r) => String(r.record_json?.payload?.operation_plan_id ?? "").trim(),
  );
  const acceptanceByTask = latestByKey(
    acceptanceFacts,
    (r) => String(r.record_json?.payload?.act_task_id ?? "").trim(),
  );

  const transitionByPlan = new Map<string, FactRow[]>();
  for (const row of facts.filter((r) => r.record_json?.type === "operation_plan_transition_v1")) {
    const operationPlanId = String(row.record_json?.payload?.operation_plan_id ?? "").trim();
    if (!operationPlanId) continue;
    const arr = transitionByPlan.get(operationPlanId) ?? [];
    arr.push(row);
    transitionByPlan.set(operationPlanId, arr);
  }
  const latestProgramByFieldSeason = latestByKey(
    facts.filter((r) => r.record_json?.type === "field_program_v1"),
    (r) => {
      const fieldId = String(r.record_json?.payload?.field_id ?? "").trim();
      const seasonId = String(r.record_json?.payload?.season_id ?? "").trim();
      if (!fieldId) return "";
      return `${fieldId}::${seasonId}`;
    }
  );
  const latestProgramByField = latestByKey(
    facts.filter((r) => r.record_json?.type === "field_program_v1"),
    (r) => String(r.record_json?.payload?.field_id ?? "").trim()
  );

  const states: OperationStateV1[] = [];
  for (const row of facts.filter((r) => r.record_json?.type === "operation_plan_v1").reverse()) {
    const payload = row.record_json?.payload ?? {};
    const operation_plan_id = String(payload.operation_plan_id ?? "").trim();
    if (!operation_plan_id) continue;
    if (states.some((s) => s.operation_id === operation_plan_id)) continue;
    const allPlanFacts = planFactsByOperationId.get(operation_plan_id) ?? [row];

    const recommendation_id = latestNonEmpty(allPlanFacts, (planFact) => String(planFact.record_json?.payload?.recommendation_id ?? "").trim()) ?? null;
    const approval_request_id = latestNonEmpty(allPlanFacts, (planFact) => String(planFact.record_json?.payload?.approval_request_id ?? "").trim()) ?? null;
    const task_id = latestNonEmpty(allPlanFacts, (planFact) => String(planFact.record_json?.payload?.act_task_id ?? "").trim()) ?? null;

    const rec = recommendation_id ? recById.get(recommendation_id) : undefined;
    const req = approval_request_id ? requestById.get(approval_request_id) : undefined;
    const decision = approval_request_id ? decisionByReq.get(approval_request_id) : undefined;
    const task = task_id ? taskById.get(task_id) : undefined;
    const receipt = task_id ? receiptByTask.get(task_id) : undefined;
    const artifactPayloads = facts
      .filter((f) => String(f.record_json?.type ?? "") === "evidence_artifact_v1")
      .map((f) => f.record_json?.payload ?? {})
      .filter((artifactPayload) => {
        const byPlan = String(artifactPayload?.operation_plan_id ?? "").trim() === operation_plan_id;
        const byTask = task_id ? String(artifactPayload?.act_task_id ?? "").trim() === task_id : false;
        return byPlan || byTask;
      });
    const artifactEvidence = artifactPayloads.map((artifactPayload) => ({ kind: String(artifactPayload?.kind ?? "artifact") }));
    const acceptanceByEvidence = buildAcceptanceResult({
      operation_plan_id,
      hasReceipt: !!receipt,
      evidenceCount: artifactEvidence.length
    });
    const receiptPayload = receipt?.record_json?.payload ?? {};
    const mediaEvidence = artifactPayloads
      .filter((artifactPayload) => {
        const kind = String(artifactPayload?.kind ?? "").toLowerCase();
        return kind.includes("image") || kind.includes("video") || kind.includes("media") || kind.includes("photo") || kind.includes("trajectory");
      })
      .map((artifactPayload) => ({ kind: String(artifactPayload?.kind ?? "media") }));
    const evidenceEvaluation = evaluateEvidence({
      artifacts: artifactEvidence,
      logs: Array.isArray(receiptPayload?.logs_refs) ? receiptPayload.logs_refs : [],
      media: mediaEvidence,
      metrics: Array.isArray(receiptPayload?.metrics) ? receiptPayload.metrics : [],
    });

    const timeline: OperationTimelineItemV1[] = [];
    const transitions = transitionByPlan.get(operation_plan_id) ?? [];
    for (const t of transitions) {
      const status = String(t.record_json?.payload?.status ?? "").trim();
      const type = transitionToTimelineType(status);
      if (!type) continue;
      timeline.push({ ts: toMs(t.occurred_at), type, label: timelineLabel(type) });
    }

    if (rec && !timeline.some((x) => x.type === "RECOMMENDATION_CREATED")) timeline.unshift({ ts: toMs(rec.occurred_at), type: "RECOMMENDATION_CREATED", label: timelineLabel("RECOMMENDATION_CREATED") });
    if (req && !timeline.some((x) => x.type === "APPROVAL_DECIDED")) timeline.push({ ts: toMs(req.occurred_at), type: "APPROVAL_DECIDED", label: timelineLabel("APPROVAL_DECIDED") });
    if (decision && !timeline.some((x) => x.type === "APPROVAL_DECIDED")) timeline.push({ ts: toMs(decision.occurred_at), type: "APPROVAL_DECIDED", label: timelineLabel("APPROVAL_DECIDED") });
    if (task && !timeline.some((x) => x.type === "TASK_CREATED")) timeline.push({ ts: toMs(task.occurred_at), type: "TASK_CREATED", label: timelineLabel("TASK_CREATED") });
    const assignmentFacts = facts.filter((f) => {
      const t = String(f.record_json?.type ?? "");
      if (!["work_assignment_upserted_v1", "work_assignment_status_changed_v1", "work_assignment_submitted_v1"].includes(t)) return false;
      return String(f.record_json?.payload?.act_task_id ?? "").trim() === String(task_id ?? "").trim();
    });
    for (const af of assignmentFacts) {
      const status = String(af.record_json?.payload?.status ?? "").trim().toUpperCase();
      const ts = toMs(af.record_json?.payload?.assigned_at ?? af.record_json?.payload?.changed_at ?? af.occurred_at);
      if (status === "ASSIGNED") timeline.push({ ts, type: "ASSIGNMENT_CREATED", label: timelineLabel("ASSIGNMENT_CREATED") });
      if (status === "ACCEPTED") timeline.push({ ts, type: "ASSIGNMENT_ACCEPTED", label: timelineLabel("ASSIGNMENT_ACCEPTED") });
      if (status === "ARRIVED") timeline.push({ ts, type: "ASSIGNMENT_ARRIVED", label: timelineLabel("ASSIGNMENT_ARRIVED") });
    }
    if (receipt) {
      const ts = toMs(receipt.occurred_at);
      timeline.push({ ts, type: "RECEIPT_SUBMITTED", label: timelineLabel("RECEIPT_SUBMITTED") });
      timeline.push({ ts, type: "DEVICE_ACK", label: timelineLabel("DEVICE_ACK") });
      const r = String(receipt.record_json?.payload?.status ?? "").toUpperCase();
      if (r.includes("FAIL") || r.includes("NOT_EXEC")) timeline.push({ ts, type: "FAILED", label: timelineLabel("FAILED") });
      if (r.includes("SUCCESS") || r.includes("EXECUTED")) timeline.push({ ts, type: "SUCCEEDED", label: timelineLabel("SUCCEEDED") });
    }
    const acceptanceFact = acceptanceByPlan.get(operation_plan_id) ?? (task_id ? acceptanceByTask.get(task_id) : undefined);
    const acceptanceFactPayload = acceptanceFact?.record_json?.payload ?? {};
    const acceptanceStatusFromFact = normalizeAcceptanceVerdict(acceptanceFactPayload?.verdict);
    const acceptance = acceptanceStatusFromFact
      ? {
        status: acceptanceStatusFromFact,
        missing: Array.isArray(acceptanceFactPayload?.missing_evidence)
          ? acceptanceFactPayload.missing_evidence.map((x: unknown) => String(x)).filter(Boolean)
          : []
      }
      : {
        status: acceptanceByEvidence.verdict,
        missing: acceptanceByEvidence.missing_evidence ?? []
      };
    if (acceptanceFact) timeline.push({ ts: toMs(acceptanceFact.occurred_at), type: "ACCEPTANCE_GENERATED", label: timelineLabel("ACCEPTANCE_GENERATED") });
    const dedupedTimeline = new Map<string, OperationTimelineItemV1>();
    for (const item of timeline) {
      dedupedTimeline.set(`${item.type}_${item.ts}`, item);
    }
    const fullTimeline = [...dedupedTimeline.values()].sort((a, b) => a.ts - b.ts);

    const latestTransition = transitions.length ? String(transitions[transitions.length - 1].record_json?.payload?.status ?? "") : "";
    const receiptStatus = String(receipt?.record_json?.payload?.status ?? "PENDING");
    const baseFinalStatus =
      finalStatusFromTransition(latestTransition)
      ?? finalStatusFromReceipt(receiptStatus)
      ?? (acceptance.status === "PASS" ? null : "PENDING_ACCEPTANCE")
      ?? (task_id ? "RUNNING" : "PENDING");
    const acceptanceCompleted = acceptance.status === "PASS";
    const hasReceipt = Boolean(receipt);
    const executedReceipt = hasExecutedReceiptStatus(receiptStatus);
    const invalidExecution = hasReceipt && executedReceipt && !evidenceEvaluation.has_formal_evidence;
    const final_status =
      invalidExecution
        ? "INVALID_EXECUTION"
        : (baseFinalStatus === "SUCCESS" && (!hasReceipt || !evidenceEvaluation.has_formal_evidence || !acceptanceCompleted))
        ? "PENDING_ACCEPTANCE"
        : baseFinalStatus;
    const finalStatusNormalized: OperationStateV1["final_status"] = invalidExecution
      ? "INVALID_EXECUTION"
      : receipt && !acceptanceFact
        ? "PENDING_ACCEPTANCE"
        : final_status;

    if (invalidExecution) {
      const invalidTs = toMs(receipt?.occurred_at ?? row.occurred_at);
      fullTimeline.push({ ts: invalidTs, type: "INVALID_EXECUTION", label: timelineLabel("INVALID_EXECUTION") });
      fullTimeline.sort((a, b) => a.ts - b.ts);
    }

    const approval_decision_id = decision ? String(decision.record_json?.payload?.decision_id ?? "").trim() || null : null;
    const approval_id = approval_decision_id ?? approval_request_id;
    const receipt_id = receipt
      ? String(receipt.record_json?.payload?.receipt_id ?? receipt.fact_id ?? "").trim() || null
      : null;
    const recordProgramId = String(row.record_json?.payload?.program_id ?? "").trim() || null;

    const inferredFieldId = latestNonEmpty(
      allPlanFacts,
      (planFact) => String(planFact.record_json?.payload?.field_id ?? planFact.record_json?.payload?.target?.ref ?? "").trim()
    ) ?? (String(rec?.record_json?.payload?.field_id ?? "").trim() || null);
    const inferredSeasonId = String(payload.season_id ?? rec?.record_json?.payload?.season_id ?? "").trim() || null;
    const inferredProgramFromProgramFact = (() => {
      if (!inferredFieldId) return null;
      const fieldSeasonKey = `${inferredFieldId}::${inferredSeasonId ?? ""}`;
      const seasonMatched = latestProgramByFieldSeason.get(fieldSeasonKey);
      const fieldMatched = latestProgramByField.get(inferredFieldId);
      return String(
        seasonMatched?.record_json?.payload?.program_id
        ?? fieldMatched?.record_json?.payload?.program_id
        ?? ""
      ).trim() || null;
    })();

    states.push({
      operation_id: operation_plan_id,
      operation_plan_id,
      recommendation_id,
      approval_id,
      act_task_id: task_id,
      receipt_id,
      program_id: String(
        recordProgramId
        ?? rec?.record_json?.payload?.program_id
        ?? req?.record_json?.payload?.program_id
        ?? task?.record_json?.payload?.program_id
        ?? task?.record_json?.payload?.meta?.program_id
        ?? inferredProgramFromProgramFact
        ?? ""
      ).trim() || null,
      approval_request_id,
      approval_decision_id,
      task_id,
      device_id: latestNonEmpty(
        allPlanFacts,
        (planFact) => String(planFact.record_json?.payload?.device_id ?? "").trim()
      ) ?? (String(task?.record_json?.payload?.meta?.device_id ?? rec?.record_json?.payload?.device_id ?? "").trim() || null),
      field_id: inferredFieldId,
      season_id: inferredSeasonId,
      action_type: latestNonEmpty(
        allPlanFacts,
        (planFact) => String(planFact.record_json?.payload?.action_type ?? "").trim()
      ) ?? (String(task?.record_json?.payload?.action_type ?? rec?.record_json?.payload?.suggested_action?.action_type ?? "").trim() || null),
      dispatch_status: task_id ? "DISPATCHED" : String(payload.status ?? "CREATED"),
      receipt_status: receiptStatus,
      acceptance: {
        status: invalidExecution ? "PENDING" : acceptance.status,
        missing: invalidExecution ? [evidenceEvaluation.reason === "only_sim_trace" ? "evidence_invalid" : "evidence_missing"] : acceptance.missing
      },
      final_status: finalStatusNormalized,
      last_event_ts: fullTimeline.length ? fullTimeline[fullTimeline.length - 1].ts : toMs(row.occurred_at),
      timeline: fullTimeline
    });
  }

  return states.sort((a, b) => b.last_event_ts - a.last_event_ts);
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

export async function projectOperationStateV1(pool: Pool, tenant: TenantTriple): Promise<OperationStateV1[]> {
  const facts = await loadFacts(pool, tenant);
  return projectOperationStateFromFacts(facts);
}
