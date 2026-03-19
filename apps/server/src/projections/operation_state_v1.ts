import type { Pool } from "pg";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };
type FactRow = { fact_id: string; occurred_at: string; record_json: any };

type TimelineType =
  | "RECOMMENDATION_CREATED"
  | "APPROVAL_REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "TASK_DISPATCHED"
  | "DEVICE_ACK"
  | "EXECUTING"
  | "SUCCEEDED"
  | "FAILED";

export type OperationTimelineItemV1 = {
  ts: number;
  type: TimelineType;
  label: string;
};

export type OperationStateV1 = {
  operation_id: string;
  recommendation_id: string | null;
  approval_request_id: string | null;
  approval_decision_id: string | null;
  operation_plan_id: string | null;
  task_id: string | null;
  device_id: string | null;
  field_id: string | null;
  action_type: string | null;
  dispatch_status: string;
  receipt_status: string;
  final_status: "SUCCESS" | "FAILED" | "RUNNING" | "PENDING";
  last_event_ts: number;
  timeline: OperationTimelineItemV1[];
};

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
      'operation_plan_v1','operation_plan_transition_v1','ao_act_task_v0','ao_act_receipt_v1','ao_act_receipt_v0'
    )
      AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
      AND (record_json::jsonb#>>'{payload,project_id}') = $2
      AND (record_json::jsonb#>>'{payload,group_id}') = $3
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
  if (status === "PENDING_APPROVAL") return "APPROVAL_REQUESTED";
  if (status === "APPROVED") return "APPROVED";
  if (status === "REJECTED") return "REJECTED";
  if (["READY", "DISPATCHED"].includes(status)) return "TASK_DISPATCHED";
  if (["EXECUTING", "IN_PROGRESS", "RUNNING"].includes(status)) return "EXECUTING";
  if (["SUCCEEDED", "SUCCESS", "DONE"].includes(status)) return "SUCCEEDED";
  if (["FAILED", "ERROR"].includes(status)) return "FAILED";
  return null;
}

function timelineLabel(type: TimelineType): string {
  if (type === "RECOMMENDATION_CREATED") return "recommendation created";
  if (type === "APPROVAL_REQUESTED") return "approval requested";
  if (type === "APPROVED") return "approved";
  if (type === "REJECTED") return "rejected";
  if (type === "TASK_DISPATCHED") return "task dispatched";
  if (type === "DEVICE_ACK") return "device ack";
  if (type === "EXECUTING") return "executing";
  if (type === "SUCCEEDED") return "execution success";
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

export async function projectOperationStateV1(pool: Pool, tenant: TenantTriple): Promise<OperationStateV1[]> {
  const facts = await loadFacts(pool, tenant);
  const recById = latestByKey(facts.filter((r) => r.record_json?.type === "decision_recommendation_v1"), (r) => String(r.record_json?.payload?.recommendation_id ?? "").trim());
  const requestById = latestByKey(facts.filter((r) => r.record_json?.type === "approval_request_v1"), (r) => String(r.record_json?.payload?.request_id ?? "").trim());
  const decisionByReq = latestByKey(facts.filter((r) => r.record_json?.type === "approval_decision_v1"), (r) => String(r.record_json?.payload?.request_id ?? "").trim());
  const taskById = latestByKey(facts.filter((r) => r.record_json?.type === "ao_act_task_v0"), (r) => String(r.record_json?.payload?.act_task_id ?? "").trim());
  const receiptByTask = latestByKey(facts.filter((r) => ["ao_act_receipt_v0", "ao_act_receipt_v1"].includes(String(r.record_json?.type ?? ""))), (r) => String(r.record_json?.payload?.act_task_id ?? "").trim());

  const transitionByPlan = new Map<string, FactRow[]>();
  for (const row of facts.filter((r) => r.record_json?.type === "operation_plan_transition_v1")) {
    const operationPlanId = String(row.record_json?.payload?.operation_plan_id ?? "").trim();
    if (!operationPlanId) continue;
    const arr = transitionByPlan.get(operationPlanId) ?? [];
    arr.push(row);
    transitionByPlan.set(operationPlanId, arr);
  }

  const states: OperationStateV1[] = [];
  for (const row of facts.filter((r) => r.record_json?.type === "operation_plan_v1").reverse()) {
    const payload = row.record_json?.payload ?? {};
    const operation_plan_id = String(payload.operation_plan_id ?? "").trim();
    if (!operation_plan_id) continue;
    if (states.some((s) => s.operation_id === operation_plan_id)) continue;

    const recommendation_id = String(payload.recommendation_id ?? "").trim() || null;
    const approval_request_id = String(payload.approval_request_id ?? "").trim() || null;
    const task_id = String(payload.act_task_id ?? "").trim() || null;

    const rec = recommendation_id ? recById.get(recommendation_id) : undefined;
    const req = approval_request_id ? requestById.get(approval_request_id) : undefined;
    const decision = approval_request_id ? decisionByReq.get(approval_request_id) : undefined;
    const task = task_id ? taskById.get(task_id) : undefined;
    const receipt = task_id ? receiptByTask.get(task_id) : undefined;

    const timeline: OperationTimelineItemV1[] = [];
    const transitions = transitionByPlan.get(operation_plan_id) ?? [];
    for (const t of transitions) {
      const status = String(t.record_json?.payload?.status ?? "").trim();
      const type = transitionToTimelineType(status);
      if (!type) continue;
      timeline.push({ ts: toMs(t.occurred_at), type, label: timelineLabel(type) });
    }

    if (rec && !timeline.some((x) => x.type === "RECOMMENDATION_CREATED")) timeline.unshift({ ts: toMs(rec.occurred_at), type: "RECOMMENDATION_CREATED", label: timelineLabel("RECOMMENDATION_CREATED") });
    if (req && !timeline.some((x) => x.type === "APPROVAL_REQUESTED")) timeline.push({ ts: toMs(req.occurred_at), type: "APPROVAL_REQUESTED", label: timelineLabel("APPROVAL_REQUESTED") });
    if (decision) {
      const dec = String(decision.record_json?.payload?.decision ?? "").toUpperCase();
      if (dec === "APPROVE" && !timeline.some((x) => x.type === "APPROVED")) timeline.push({ ts: toMs(decision.occurred_at), type: "APPROVED", label: timelineLabel("APPROVED") });
      if (dec === "REJECT" && !timeline.some((x) => x.type === "REJECTED")) timeline.push({ ts: toMs(decision.occurred_at), type: "REJECTED", label: timelineLabel("REJECTED") });
    }
    if (task && !timeline.some((x) => x.type === "TASK_DISPATCHED")) timeline.push({ ts: toMs(task.occurred_at), type: "TASK_DISPATCHED", label: timelineLabel("TASK_DISPATCHED") });
    if (receipt) {
      const ts = toMs(receipt.occurred_at);
      timeline.push({ ts, type: "DEVICE_ACK", label: timelineLabel("DEVICE_ACK") });
      const r = String(receipt.record_json?.payload?.status ?? "").toUpperCase();
      if (r.includes("FAIL") || r.includes("NOT_EXEC")) timeline.push({ ts, type: "FAILED", label: timelineLabel("FAILED") });
      if (r.includes("SUCCESS") || r.includes("EXECUTED")) timeline.push({ ts, type: "SUCCEEDED", label: timelineLabel("SUCCEEDED") });
    }
    timeline.sort((a, b) => a.ts - b.ts);

    const latestTransition = transitions.length ? String(transitions[transitions.length - 1].record_json?.payload?.status ?? "") : "";
    const receiptStatus = String(receipt?.record_json?.payload?.status ?? "PENDING");
    const final_status =
      finalStatusFromTransition(latestTransition)
      ?? finalStatusFromReceipt(receiptStatus)
      ?? (task_id ? "RUNNING" : "PENDING");

    states.push({
      operation_id: operation_plan_id,
      recommendation_id,
      approval_request_id,
      approval_decision_id: decision ? String(decision.record_json?.payload?.decision_id ?? "").trim() || null : null,
      operation_plan_id,
      task_id,
      device_id: String(payload.device_id ?? task?.record_json?.payload?.meta?.device_id ?? rec?.record_json?.payload?.device_id ?? "").trim() || null,
      field_id: String(payload?.target?.ref ?? rec?.record_json?.payload?.field_id ?? "").trim() || null,
      action_type: String(payload.action_type ?? task?.record_json?.payload?.action_type ?? rec?.record_json?.payload?.suggested_action?.action_type ?? "").trim() || null,
      dispatch_status: task_id ? "DISPATCHED" : String(payload.status ?? "CREATED"),
      receipt_status: receiptStatus,
      final_status,
      last_event_ts: timeline.length ? timeline[timeline.length - 1].ts : toMs(row.occurred_at),
      timeline
    });
  }

  return states.sort((a, b) => b.last_event_ts - a.last_event_ts);
}
