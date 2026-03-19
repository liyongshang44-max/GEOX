import type { Pool } from "pg";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };
type FactRow = { fact_id: string; occurred_at: string; record_json: any };

export type OperationTimelineItemV1 = { event: string; label: string; ts: number; occurred_at: string; fact_id?: string | null };
export type OperationStateV1 = {
  operation_id: string;
  recommendation_id: string | null;
  approval_request_id: string | null;
  approval_decision_id: string | null;
  operation_plan_id: string | null;
  task_id: string | null;
  device_id: string | null;
  field_id: string | null;
  dispatch_status: string;
  receipt_status: string;
  final_status: string;
  last_event_ts: number;
  timeline: OperationTimelineItemV1[];
};

function parseRecordJson(v: any): any { if (v && typeof v === "object") return v; if (typeof v === "string") { try { return JSON.parse(v); } catch { return null; } } return null; }
function toMs(v: string | null | undefined): number { const ms = Date.parse(String(v ?? "")); return Number.isFinite(ms) ? ms : 0; }
function latestByKey(rows: FactRow[], keyFn: (row: FactRow) => string): Map<string, FactRow> {
  const out = new Map<string, FactRow>();
  for (const row of rows) { const key = keyFn(row); if (!key) continue; const prev = out.get(key); if (!prev || toMs(row.occurred_at) >= toMs(prev.occurred_at)) out.set(key, row); }
  return out;
}

async function loadFacts(pool: Pool, tenant: TenantTriple): Promise<FactRow[]> {
  const sql = `SELECT fact_id, occurred_at, (record_json::jsonb) AS record_json FROM facts
    WHERE (record_json::jsonb->>'type') IN ('decision_recommendation_v1','approval_request_v1','approval_decision_v1','operation_plan_v1','ao_act_task_v0','ao_act_receipt_v1','ao_act_receipt_v0')
      AND (record_json::jsonb#>>'{payload,tenant_id}') = $1 AND (record_json::jsonb#>>'{payload,project_id}') = $2 AND (record_json::jsonb#>>'{payload,group_id}') = $3
    ORDER BY occurred_at DESC, fact_id DESC`;
  const res = await pool.query(sql, [tenant.tenant_id, tenant.project_id, tenant.group_id]);
  return (res.rows ?? []).map((row: any) => ({ fact_id: String(row.fact_id), occurred_at: String(row.occurred_at), record_json: parseRecordJson(row.record_json) ?? row.record_json }));
}

function inferFinalStatus(planStatus: string, receiptStatus: string, hasTask: boolean): string {
  const r = receiptStatus.toUpperCase();
  if (r.includes("FAIL") || r.includes("NOT_EXEC")) return "failed";
  if (r.includes("SUCCESS") || r.includes("EXECUTED")) return "success";
  if (hasTask) return "running";
  const p = planStatus.toUpperCase();
  if (p === "REJECTED") return "rejected";
  if (["READY", "APPROVED", "DISPATCHED"].includes(p)) return "pending_execution";
  return "pending";
}

export async function projectOperationStateV1(pool: Pool, tenant: TenantTriple): Promise<OperationStateV1[]> {
  const facts = await loadFacts(pool, tenant);
  const recById = latestByKey(facts.filter((r) => r.record_json?.type === "decision_recommendation_v1"), (r) => String(r.record_json?.payload?.recommendation_id ?? "").trim());
  const reqById = latestByKey(facts.filter((r) => r.record_json?.type === "approval_request_v1"), (r) => String(r.record_json?.payload?.request_id ?? "").trim());
  const decisionByReq = latestByKey(facts.filter((r) => r.record_json?.type === "approval_decision_v1"), (r) => String(r.record_json?.payload?.request_id ?? "").trim());
  const taskById = latestByKey(facts.filter((r) => r.record_json?.type === "ao_act_task_v0"), (r) => String(r.record_json?.payload?.act_task_id ?? "").trim());
  const receiptByTaskId = latestByKey(facts.filter((r) => r.record_json?.type === "ao_act_receipt_v1" || r.record_json?.type === "ao_act_receipt_v0"), (r) => String(r.record_json?.payload?.act_task_id ?? "").trim());

  const states: OperationStateV1[] = [];
  for (const row of facts.filter((r) => r.record_json?.type === "operation_plan_v1")) {
    const p = row.record_json?.payload ?? {};
    const operation_plan_id = String(p.operation_plan_id ?? "").trim();
    if (!operation_plan_id) continue;
    if (states.some((s) => s.operation_id === operation_plan_id)) continue;
    const recommendation_id = String(p.recommendation_id ?? "").trim() || null;
    const approval_request_id = String(p.approval_request_id ?? "").trim() || null;
    const task_id = String(p.act_task_id ?? "").trim() || null;
    const rec = recommendation_id ? recById.get(recommendation_id) : undefined;
    const req = approval_request_id ? reqById.get(approval_request_id) : undefined;
    const decision = approval_request_id ? decisionByReq.get(approval_request_id) : undefined;
    const task = task_id ? taskById.get(task_id) : undefined;
    const receipt = task_id ? receiptByTaskId.get(task_id) : undefined;
    const receiptStatus = String(receipt?.record_json?.payload?.status ?? "PENDING");

    const timeline: OperationTimelineItemV1[] = [];
    if (rec) timeline.push({ event: "recommendation_created", label: "recommendation created", ts: toMs(rec.occurred_at), occurred_at: rec.occurred_at, fact_id: rec.fact_id });
    if (req) timeline.push({ event: "approval_requested", label: "approval requested", ts: toMs(req.occurred_at), occurred_at: req.occurred_at, fact_id: req.fact_id });
    if (decision && String(decision.record_json?.payload?.decision ?? "").toUpperCase() === "APPROVE") timeline.push({ event: "approved", label: "approved", ts: toMs(decision.occurred_at), occurred_at: decision.occurred_at, fact_id: decision.fact_id });
    if (task) timeline.push({ event: "task_dispatched", label: "task dispatched", ts: toMs(task.occurred_at), occurred_at: task.occurred_at, fact_id: task.fact_id });
    if (receipt) {
      timeline.push({ event: "device_ack", label: "device ack", ts: toMs(receipt.occurred_at), occurred_at: receipt.occurred_at, fact_id: receipt.fact_id });
      const ru = receiptStatus.toUpperCase();
      if (ru.includes("SUCCESS") || ru.includes("EXECUTED")) timeline.push({ event: "execution_success", label: "execution success", ts: toMs(receipt.occurred_at), occurred_at: receipt.occurred_at, fact_id: receipt.fact_id });
      if (ru.includes("FAIL") || ru.includes("NOT_EXEC")) timeline.push({ event: "execution_failed", label: "execution failed", ts: toMs(receipt.occurred_at), occurred_at: receipt.occurred_at, fact_id: receipt.fact_id });
    }
    timeline.sort((a, b) => a.ts - b.ts);

    states.push({
      operation_id: operation_plan_id,
      recommendation_id,
      approval_request_id,
      approval_decision_id: decision ? String(decision.record_json?.payload?.decision_id ?? "").trim() || null : null,
      operation_plan_id,
      task_id,
      device_id: String(p.device_id ?? task?.record_json?.payload?.meta?.device_id ?? rec?.record_json?.payload?.device_id ?? "").trim() || null,
      field_id: String(p?.target?.ref ?? rec?.record_json?.payload?.field_id ?? "").trim() || null,
      dispatch_status: task ? "DISPATCHED" : String(p.status ?? "CREATED"),
      receipt_status: receiptStatus,
      final_status: inferFinalStatus(String(p.status ?? ""), receiptStatus, Boolean(task)),
      last_event_ts: timeline.length ? timeline[timeline.length - 1].ts : toMs(row.occurred_at),
      timeline
    });
  }
  return states.sort((a, b) => b.last_event_ts - a.last_event_ts);
}
