import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAoActAnyScopeV0, type AoActAuthContextV0 } from "../../auth/ao_act_authz_v0.js";
import { projectOperationStateV1, type OperationStateV1 } from "../../projections/operation_state_v1.js";

type OperatorDispatchActionType = "TASK_DISPATCH" | "TASK_RETRY_DISPATCH";
type OperatorActionErrorCode =
  | "AUTH_MISSING"
  | "FORBIDDEN"
  | "ACTION_NOT_READY"
  | "INVALID_STATE"
  | "SELF_APPROVAL_BLOCKED"
  | "TARGET_NOT_FOUND"
  | "EVIDENCE_INSUFFICIENT"
  | "AUDIT_WRITE_FAILED"
  | "STATE_WRITE_FAILED";

type TaskFact = { fact_id: string; occurred_at: string; record_json: any };
type DispatchFact = { fact_id: string; occurred_at: string; status: string; reason: string | null };

type OperatorActionResponse = {
  ok: boolean;
  action_id: string;
  audit_id: string;
  action_type: OperatorDispatchActionType;
  target_type: "TASK";
  target_id: string;
  status_before: string | null;
  status_after: string | null;
  permission: { allowed: boolean; role: string | null; reason: string | null };
  message: string;
  error_code?: OperatorActionErrorCode;
  updated_at: string;
};

function safeText(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text || text === "--" || text === "undefined" || text === "null") return "";
  if (/token|secret|credential|private\s*key|password|stack\s*trace|debug\s*json/i.test(text)) return "";
  return text;
}
function nullableText(value: unknown): string | null { return safeText(value) || null; }
function parseRecordJson(value: unknown): any { if (value && typeof value === "object") return value; if (typeof value === "string") { try { return JSON.parse(value); } catch { return null; } } return null; }
function actionId(): string { return `act_operator_${randomUUID().replace(/-/g, "")}`; }
function auditId(): string { return `audit_${randomUUID().replace(/-/g, "")}`; }
function nowIso(): string { return new Date().toISOString(); }
function roleAllowsDispatch(role: unknown): boolean { const normalized = safeText(role).toLowerCase(); return normalized === "admin" || normalized === "operator"; }

function normalizeStatus(value: unknown): string {
  const raw = safeText(value).toUpperCase();
  if (!raw) return "TASK_CREATED";
  if (raw.includes("RECEIPT")) return "RECEIPT_RECEIVED";
  if (raw.includes("ACK")) return "ACKED";
  if (raw.includes("DISPATCH")) return raw.includes("FAILED") ? "DISPATCH_FAILED" : "DISPATCHED";
  if (raw.includes("FAILED") || raw.includes("INVALID")) return "EXECUTION_FAILED";
  if (raw.includes("SUCCESS") || raw.includes("DONE") || raw.includes("COMPLETED")) return "COMPLETED";
  return raw;
}
function isTerminalStatus(value: unknown): boolean { const status = normalizeStatus(value); return status === "COMPLETED" || status === "SUCCESS" || status === "RECEIPT_RECEIVED" || status === "PENDING_ACCEPTANCE"; }
function isRetryableStatus(value: unknown): boolean { const status = normalizeStatus(value); return status === "DISPATCH_FAILED" || status === "EXECUTION_FAILED" || status === "INVALID_EXECUTION" || status === "STATE_WRITE_FAILED"; }
function statusOfTask(task: TaskFact | null, state: OperationStateV1 | null, dispatch: DispatchFact | null): string | null {
  if (state?.receipt_id) return "RECEIPT_RECEIVED";
  if (state?.final_status) return String(state.final_status);
  if (dispatch?.status) return dispatch.status;
  const payload = task?.record_json?.payload ?? null;
  return safeText(payload?.status ?? payload?.task_status ?? payload?.dispatch_status) || "TASK_CREATED";
}

function buildResponse(params: { ok: boolean; action_id: string; audit_id: string; action_type: OperatorDispatchActionType; target_id: string; status_before: string | null; status_after: string | null; role: string | null; allowed: boolean; reason: string | null; message: string; error_code?: OperatorActionErrorCode; updated_at?: string }): OperatorActionResponse {
  return { ok: params.ok, action_id: params.action_id, audit_id: params.audit_id, action_type: params.action_type, target_type: "TASK", target_id: params.target_id, status_before: params.status_before, status_after: params.status_after, permission: { allowed: params.allowed, role: params.role, reason: params.reason }, message: params.message, ...(params.error_code ? { error_code: params.error_code } : {}), updated_at: params.updated_at ?? nowIso() };
}
async function writeAuditFact(pool: Pool, auth: AoActAuthContextV0, result: OperatorActionResponse): Promise<void> {
  const record = { type: "operator_action_audit_v1", payload: { audit_id: result.audit_id, action_id: result.action_id, action_type: result.action_type, target_type: result.target_type, target_id: result.target_id, actor_id: auth.actor_id, token_id: auth.token_id, role: auth.role, tenant_id: auth.tenant_id, project_id: auth.project_id, group_id: auth.group_id, status_before: result.status_before, status_after: result.status_after, result: result.ok ? "SUCCESS" : "FAILED", error_code: result.error_code ?? null, reason: result.permission.reason ?? result.message, created_at: result.updated_at } };
  await pool.query("INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)", [randomUUID(), "api/v1/operator/dispatch/action", record]);
}
function httpStatusFor(code: OperatorActionErrorCode): number { if (code === "AUTH_MISSING") return 401; if (code === "FORBIDDEN" || code === "SELF_APPROVAL_BLOCKED") return 403; if (code === "TARGET_NOT_FOUND") return 404; if (code === "INVALID_STATE") return 409; if (code === "EVIDENCE_INSUFFICIENT") return 422; if (code === "AUDIT_WRITE_FAILED" || code === "STATE_WRITE_FAILED") return 500; return 400; }
async function sendFailure(reply: any, pool: Pool, auth: AoActAuthContextV0, result: OperatorActionResponse): Promise<void> { try { await writeAuditFact(pool, auth, result); } catch { const auditFailed = buildResponse({ ...result, ok: false, allowed: false, reason: "审计写入失败，动作未执行。", message: "审计写入失败，动作未执行。", error_code: "AUDIT_WRITE_FAILED", status_after: result.status_before }); return reply.status(500).send(auditFailed); } return reply.status(httpStatusFor(result.error_code ?? "ACTION_NOT_READY")).send(result); }

async function findTaskFact(pool: Pool, auth: AoActAuthContextV0, taskId: string): Promise<TaskFact | null> {
  const res = await pool.query(`SELECT fact_id, occurred_at, record_json FROM facts WHERE (record_json::jsonb->>'type') = 'ao_act_task_v0' AND (record_json::jsonb#>>'{payload,act_task_id}') = $1 AND (record_json::jsonb#>>'{payload,tenant_id}') = $2 AND (record_json::jsonb#>>'{payload,project_id}') = $3 AND (record_json::jsonb#>>'{payload,group_id}') = $4 ORDER BY occurred_at DESC, fact_id DESC LIMIT 1`, [taskId, auth.tenant_id, auth.project_id, auth.group_id]);
  const row = res.rows?.[0];
  if (!row) return null;
  return { fact_id: String(row.fact_id ?? ""), occurred_at: String(row.occurred_at ?? ""), record_json: parseRecordJson(row.record_json) };
}
async function readTaskFacts(pool: Pool, auth: AoActAuthContextV0, limit: number): Promise<TaskFact[]> {
  const res = await pool.query(`SELECT fact_id, occurred_at, record_json FROM facts WHERE (record_json::jsonb->>'type') = 'ao_act_task_v0' AND (record_json::jsonb#>>'{payload,tenant_id}') = $1 AND (record_json::jsonb#>>'{payload,project_id}') = $2 AND (record_json::jsonb#>>'{payload,group_id}') = $3 ORDER BY occurred_at DESC, fact_id DESC LIMIT $4`, [auth.tenant_id, auth.project_id, auth.group_id, limit]);
  return (res.rows ?? []).map((row: any) => ({ fact_id: String(row.fact_id ?? ""), occurred_at: String(row.occurred_at ?? ""), record_json: parseRecordJson(row.record_json) }));
}
async function readLatestDispatchFacts(pool: Pool, auth: AoActAuthContextV0, taskIds: string[]): Promise<Map<string, DispatchFact>> {
  if (taskIds.length === 0) return new Map();
  const res = await pool.query(`SELECT DISTINCT ON (record_json::jsonb#>>'{payload,act_task_id}') fact_id, occurred_at, record_json FROM facts WHERE (record_json::jsonb->>'type') = 'ao_act_dispatch_v1' AND (record_json::jsonb#>>'{payload,tenant_id}') = $1 AND (record_json::jsonb#>>'{payload,project_id}') = $2 AND (record_json::jsonb#>>'{payload,group_id}') = $3 AND (record_json::jsonb#>>'{payload,act_task_id}') = ANY($4::text[]) ORDER BY record_json::jsonb#>>'{payload,act_task_id}', occurred_at DESC, fact_id DESC`, [auth.tenant_id, auth.project_id, auth.group_id, taskIds]);
  const out = new Map<string, DispatchFact>();
  for (const row of res.rows ?? []) { const record = parseRecordJson(row.record_json); const taskId = safeText(record?.payload?.act_task_id); if (!taskId) continue; out.set(taskId, { fact_id: String(row.fact_id ?? ""), occurred_at: String(row.occurred_at ?? ""), status: safeText(record?.payload?.status) || "DISPATCHED", reason: nullableText(record?.payload?.reason ?? record?.payload?.failure_reason) }); }
  return out;
}
async function readStatesByTask(pool: Pool, auth: AoActAuthContextV0): Promise<Map<string, OperationStateV1>> { const states = await projectOperationStateV1(pool, { tenant_id: auth.tenant_id, project_id: auth.project_id, group_id: auth.group_id }); const out = new Map<string, OperationStateV1>(); for (const state of states) { if (state.act_task_id) out.set(state.act_task_id, state); } return out; }

function buildPermission(auth: AoActAuthContextV0, task: TaskFact | null, state: OperationStateV1 | null, dispatch: DispatchFact | null, action: OperatorDispatchActionType): { allowed: boolean; role: string | null; reason: string | null } {
  const role = safeText(auth.role) || null;
  if (!roleAllowsDispatch(auth.role)) return { allowed: false, role, reason: "当前角色无派发操作权限。" };
  if (!task) return { allowed: false, role, reason: "AO-ACT task 未生成，不能派发。" };
  const current = statusOfTask(task, state, dispatch);
  if (state?.receipt_id || isTerminalStatus(current)) return { allowed: false, role, reason: "任务已完成或已产生回执，不能再次派发。" };
  if (action === "TASK_DISPATCH") {
    if (normalizeStatus(current) === "DISPATCHED" || normalizeStatus(current) === "ACKED") return { allowed: false, role, reason: "任务已派发，不能重复派发。" };
    return { allowed: true, role, reason: null };
  }
  if (!isRetryableStatus(current)) return { allowed: false, role, reason: "当前任务状态不允许 retry，只有失败状态可重试。" };
  return { allowed: true, role, reason: null };
}
function taskPayload(task: TaskFact | null): any { return task?.record_json?.payload ?? {}; }
async function writeDispatchFact(pool: Pool, auth: AoActAuthContextV0, task: TaskFact, action: OperatorDispatchActionType, status: "DISPATCHED" | "RETRY_DISPATCHED", note: string | null): Promise<void> {
  const payload = taskPayload(task);
  const record = { type: "ao_act_dispatch_v1", payload: { tenant_id: auth.tenant_id, project_id: auth.project_id, group_id: auth.group_id, act_task_id: safeText(payload.act_task_id), task_fact_id: task.fact_id, operation_id: payload.operation_id ?? payload.operation_plan_id ?? null, operation_plan_id: payload.operation_plan_id ?? payload.operation_id ?? null, action_type: payload.action_type ?? null, status, operator_action_type: action, reason: note, actor_id: auth.actor_id, token_id: auth.token_id, role: auth.role, dispatched_at: nowIso() } };
  await pool.query("INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)", [randomUUID(), "api/v1/operator/dispatch/action", record]);
}
function buildWorklistItem(auth: AoActAuthContextV0, task: TaskFact, state: OperationStateV1 | null, dispatch: DispatchFact | null): Record<string, unknown> {
  const payload = taskPayload(task);
  const taskId = safeText(payload.act_task_id);
  const current = statusOfTask(task, state, dispatch);
  const dispatchPermission = buildPermission(auth, task, state, dispatch, "TASK_DISPATCH");
  const retryPermission = buildPermission(auth, task, state, dispatch, "TASK_RETRY_DISPATCH");
  return { task_id: taskId, act_task_id: taskId, receipt_id: state?.receipt_id ?? null, operation_id: state?.operation_id ?? payload.operation_id ?? payload.operation_plan_id ?? null, operation_plan_id: state?.operation_plan_id ?? payload.operation_plan_id ?? payload.operation_id ?? null, field_id: state?.field_id ?? payload.field_id ?? null, field_name: null, operation_name: state?.action_type ?? payload.action_type ?? null, status: normalizeStatus(current), execution_mode: payload.executor_id?.kind ?? payload.executor_kind ?? payload.execution_mode ?? null, task_created_at: task.occurred_at, dispatched_at: dispatch?.occurred_at ?? null, acked_at: null, receipt_received_at: state?.receipt_id ? new Date(state.last_event_ts || Date.now()).toISOString() : null, executor_text: payload.executor_id?.id ?? payload.executor_id ?? payload.device_id ?? null, failure_reason: dispatch?.reason ?? state?.invalid_reason ?? null, can_dispatch: dispatchPermission.allowed, can_retry: retryPermission.allowed, permission_reason: dispatchPermission.reason ?? retryPermission.reason, permissions: { can_dispatch: dispatchPermission.allowed, can_retry: retryPermission.allowed, reason: dispatchPermission.reason ?? retryPermission.reason, role: safeText(auth.role) || null } };
}
async function handleDispatchAction(req: any, reply: any, pool: Pool, action: OperatorDispatchActionType): Promise<void> {
  const auth = requireAoActAnyScopeV0(req, reply, ["action.task.dispatch", "ao_act.task.write"]);
  if (!auth) return;
  const taskId = safeText((req.params as any)?.taskId);
  const aid = actionId();
  const auid = auditId();
  const role = safeText(auth.role) || null;
  const task = taskId ? await findTaskFact(pool, auth, taskId) : null;
  const states = await readStatesByTask(pool, auth);
  const state = taskId ? states.get(taskId) ?? null : null;
  const latestDispatch = taskId ? (await readLatestDispatchFacts(pool, auth, [taskId])).get(taskId) ?? null : null;
  const statusBefore = statusOfTask(task, state, latestDispatch);
  if (!taskId || !task) return sendFailure(reply, pool, auth, buildResponse({ ok: false, action_id: aid, audit_id: auid, action_type: action, target_id: taskId, status_before: null, status_after: null, role, allowed: false, reason: "AO-ACT task 未生成，不能派发。", message: "AO-ACT task 未生成，不能派发。", error_code: "TARGET_NOT_FOUND" }));
  const permission = buildPermission(auth, task, state, latestDispatch, action);
  if (!permission.allowed) return sendFailure(reply, pool, auth, buildResponse({ ok: false, action_id: aid, audit_id: auid, action_type: action, target_id: taskId, status_before: statusBefore, status_after: statusBefore, role, allowed: false, reason: permission.reason, message: permission.reason ?? "当前任务状态不可派发。", error_code: task ? "INVALID_STATE" : "TARGET_NOT_FOUND" }));
  const nextStatus = action === "TASK_DISPATCH" ? "DISPATCHED" : "RETRY_DISPATCHED";
  const success = buildResponse({ ok: true, action_id: aid, audit_id: auid, action_type: action, target_id: taskId, status_before: statusBefore, status_after: nextStatus, role, allowed: true, reason: null, message: action === "TASK_DISPATCH" ? "任务已派发。" : "任务已重新派发。" });
  try { await writeAuditFact(pool, auth, success); await writeDispatchFact(pool, auth, task, action, nextStatus, nullableText((req.body as any)?.note ?? (req.body as any)?.reason)); } catch { return reply.status(500).send(buildResponse({ ok: false, action_id: aid, audit_id: auid, action_type: action, target_id: taskId, status_before: statusBefore, status_after: statusBefore, role, allowed: true, reason: "状态写入失败，请刷新后重试。", message: "状态写入失败，请刷新后重试。", error_code: "STATE_WRITE_FAILED" })); }
  return reply.send(success);
}
function parseLimit(value: unknown): number { const n = Number(value); if (!Number.isFinite(n) || n <= 0) return 100; return Math.min(Math.floor(n), 300); }
export function registerOperatorDispatchActionRoutes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/operator/dispatch/worklist", async (req, reply) => {
    const auth = requireAoActAnyScopeV0(req, reply, ["action.read", "action.task.dispatch", "ao_act.index.read"]);
    if (!auth) return;
    const limit = parseLimit((req.query as any)?.limit);
    const tasks = await readTaskFacts(pool, auth, limit);
    const taskIds = tasks.map((task) => safeText(task.record_json?.payload?.act_task_id)).filter(Boolean);
    const [statesByTask, dispatchByTask] = await Promise.all([readStatesByTask(pool, auth), readLatestDispatchFacts(pool, auth, taskIds)]);
    const items = tasks.map((task) => { const taskId = safeText(task.record_json?.payload?.act_task_id); return buildWorklistItem(auth, task, statesByTask.get(taskId) ?? null, dispatchByTask.get(taskId) ?? null); });
    return reply.send({ source: "operator_dispatch_api", dataScope: "OFFICIAL_OPERATOR_API", generated_at: new Date().toISOString(), items, writeReady: true, message: "Operator dispatch actions are controlled by backend AO-ACT task state and receipt readiness." });
  });
  app.post("/api/v1/operator/dispatch/:taskId/dispatch", async (req, reply) => handleDispatchAction(req, reply, pool, "TASK_DISPATCH"));
  app.post("/api/v1/operator/dispatch/:taskId/retry", async (req, reply) => handleDispatchAction(req, reply, pool, "TASK_RETRY_DISPATCH"));
}
