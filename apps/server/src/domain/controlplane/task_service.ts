// GEOX/apps/server/src/routes/controlplane_v1.ts
// Control Plane v1 wrapper routes for Commercial Control-2.
// This layer does three things only:
// 1) exposes stable /api/v1/* REST paths;
// 2) keeps the existing v0 AO-ACT / approval runtime as the execution core;
// 3) adds explicit dispatch/outbox facts so adapters can drain a bounded queue without auto-scheduling.

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { createHash, randomUUID } from "node:crypto";
import { requireAoActScopeV0, requireAoActAdminV0, type AoActAuthContextV0 } from "../../auth/ao_act_authz_v0.js";
import { decideDispatchCandidates, type DispatchExecutorResource } from "./dispatch_decision_strategy.js";
import { resolveApprovalExecutionContextV1 } from "./approval_execution_context_v1.js";
import {
  checkCapabilityCompatibilityMatrix,
  resolveTaskCapabilityViaDeviceSkillsResult,
} from "@geox/device-skills";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };
type ParsedFactRow = { fact_id: string; occurred_at: string; source: string; record_json: any };
type OperationPlanStateReadModelRow = {
  plan_id: string;
  status: string;
  device_id: string | null;
  field_id: string | null;
  last_transition: string | null;
  receipt_status: string | null;
};
type DispatchSlaInput = { accept_minutes?: number | null; arrive_minutes?: number | null };

function badRequest(reply: FastifyReply, error: string) {
  return reply.status(400).send({ ok: false, error });
}

function requireExecutorServicePrincipalV1(auth: AoActAuthContextV0, reply: FastifyReply): boolean {
  if (String(auth.role ?? "") !== "executor") {
    reply.status(403).send({ ok: false, error: "EXECUTOR_PRINCIPAL_REQUIRED" });
    return false;
  }
  return true;
}

function canonicalReceiptExecutorV1(auth: AoActAuthContextV0): { kind: "human" | "script"; id: string; namespace: string } | null {
  const role = String(auth.role ?? "");
  if (role === "executor") return { kind: "script", id: String(auth.actor_id), namespace: "executor_runtime_v1" };
  if (role === "operator") return { kind: "human", id: String(auth.actor_id), namespace: "operator_auth_v1" };
  return null;
}

function requireReceiptPrincipalV1(auth: AoActAuthContextV0, reply: FastifyReply, executorOnly = false) {
  if (executorOnly && String(auth.role ?? "") !== "executor") {
    reply.status(403).send({ ok: false, error: "EXECUTOR_PRINCIPAL_REQUIRED" });
    return null;
  }
  const principal = canonicalReceiptExecutorV1(auth);
  if (!principal) {
    reply.status(403).send({ ok: false, error: "EXECUTION_PRINCIPAL_REQUIRED" });
    return null;
  }
  return principal;
}

function claimedReceiptExecutorMatchesV1(claimed: any, principal: { id: string }): boolean {
  if (claimed == null || claimed === "") return true;
  if (typeof claimed === "string") return claimed.trim() === principal.id;
  return String(claimed?.id ?? "").trim() === principal.id;
}

function capabilityError(reply: FastifyReply, input: {
  stage: "approval" | "task_create" | "dispatch";
  act_task_id?: string | null;
  operation_plan_id?: string | null;
  adapter_type?: string | null;
  device_type?: string | null;
  error: { code: string; message: string; reasons?: string[]; compatibility?: unknown };
}) {
  return reply.status(422).send({
    ok: false,
    error: "CAPABILITY_RESOLUTION_FAILED",
    detail: {
      stage: input.stage,
      act_task_id: input.act_task_id ?? null,
      operation_plan_id: input.operation_plan_id ?? null,
      adapter_type: input.adapter_type ?? null,
      device_type: input.device_type ?? null,
      code: input.error.code,
      message: input.error.message,
      reasons: input.error.reasons ?? [],
      compatibility: input.error.compatibility ?? null,
    },
  });
}

function parseJsonMaybe(v: any): any {
  if (v && typeof v === "object") return v;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return null; }
  }
  return null;
}

function normalizeCapabilities(input: any): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input.map((x) => String(x ?? "").trim()).filter(Boolean))).slice(0, 64);
}

function parseFiniteNumber(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function sanitizeParametersBySchema(parameterSchema: any, rawParameters: any): Record<string, unknown> {
  const allowedKeys = new Set(
    Array.isArray(parameterSchema?.keys)
      ? parameterSchema.keys.map((x: any) => String(x?.name ?? "").trim()).filter(Boolean)
      : [],
  );
  const source = rawParameters && typeof rawParameters === "object" ? rawParameters : {};
  return Object.fromEntries(Object.entries(source).filter(([k]) => allowedKeys.has(k)));
}

function parseTaskLocation(taskPayload: any): { lat: number; lon: number } | null {
  const sources = [taskPayload?.meta?.location, taskPayload?.location, taskPayload?.meta?.geo_point, taskPayload?.geo_point];
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    const lat = parseFiniteNumber((source as any).lat ?? (source as any).latitude);
    const lon = parseFiniteNumber((source as any).lon ?? (source as any).lng ?? (source as any).longitude);
    if (lat == null || lon == null) continue;
    return { lat, lon };
  }
  return null;
}

function extractFirstInvalidField(input: any): string | null {
  if (!input) return null;
  const directField = typeof input?.first_invalid_field === "string" ? input.first_invalid_field.trim() : "";
  if (directField) return directField;
  const candidateStrings = [
    typeof input?.field === "string" ? input.field : "",
    typeof input?.path === "string" ? input.path : "",
    typeof input?.message === "string" ? input.message : "",
    typeof input?.error === "string" ? input.error : "",
    typeof input?.detail?.message === "string" ? input.detail.message : "",
  ].filter(Boolean);
  for (const item of candidateStrings) {
    const match = String(item).match(/(?:parameter_schema|parameters|constraints|meta|target|time_window|issuer)\.?([a-zA-Z0-9_.-]+)?/);
    if (match?.[0]) return match[0];
  }
  const issues = Array.isArray(input?.issues) ? input.issues : [];
  const firstIssue = issues[0];
  if (firstIssue && Array.isArray(firstIssue.path) && firstIssue.path.length > 0) {
    return firstIssue.path.map((x: any) => String(x)).join(".");
  }
  return null;
}

async function listHumanExecutorResources(pool: Pool, tenant: TenantTriple): Promise<DispatchExecutorResource[]> {
  try {
    const q = await pool.query(
      `SELECT
         h.executor_id,
         h.capabilities,
         h.status,
         h.updated_ts_ms,
         COALESCE(active.active_count, 0) AS active_load,
         kpi.avg_accept_duration_ms,
         kpi.on_time_rate,
         kpi.first_pass_rate,
         kpi.abnormal_recurrence_rate
       FROM human_executor_index_v1 h
       LEFT JOIN (
         SELECT executor_id, COUNT(*)::int AS active_count
         FROM work_assignment_index_v1
         WHERE tenant_id = $1
           AND status IN ('ASSIGNED','ACCEPTED','ARRIVED')
         GROUP BY executor_id
       ) active ON active.executor_id = h.executor_id
       LEFT JOIN LATERAL (
         SELECT avg_accept_duration_ms, on_time_rate, first_pass_rate, abnormal_recurrence_rate
         FROM manual_execution_quality_projection_v1 m
         WHERE m.tenant_id = h.tenant_id
           AND m.project_id = $2
           AND m.group_id = $3
           AND m.dimension = 'executor'
           AND m.dimension_id = h.executor_id
         ORDER BY m.updated_ts_ms DESC
         LIMIT 1
       ) kpi ON TRUE
       WHERE h.tenant_id = $1
         AND h.status = 'ACTIVE'
       ORDER BY h.updated_ts_ms DESC, h.executor_id ASC
       LIMIT 500`,
      [tenant.tenant_id, tenant.project_id, tenant.group_id],
    );
    return (q.rows ?? []).map((row: any) => ({
      executor_id: String(row.executor_id ?? ""),
      capabilities: normalizeCapabilities(parseJsonMaybe(row.capabilities)),
      current_load: Number(row.active_load ?? 0),
      status: String(row.status ?? "ACTIVE"),
      performance_kpi: {
        avg_accept_duration_ms: Number.isFinite(Number(row.avg_accept_duration_ms)) ? Number(row.avg_accept_duration_ms) : null,
        on_time_rate: Number.isFinite(Number(row.on_time_rate)) ? Number(row.on_time_rate) : null,
        first_pass_rate: Number.isFinite(Number(row.first_pass_rate)) ? Number(row.first_pass_rate) : null,
        abnormal_recurrence_rate: Number.isFinite(Number(row.abnormal_recurrence_rate)) ? Number(row.abnormal_recurrence_rate) : null,
        score: (() => {
          const onTime = Number(row.on_time_rate ?? 0);
          const firstPass = Number(row.first_pass_rate ?? 0);
          const recurrence = Number(row.abnormal_recurrence_rate ?? 0);
          const acceptMs = Number(row.avg_accept_duration_ms ?? 0);
          const acceptScore = Number.isFinite(acceptMs) && acceptMs > 0 ? Math.max(0, 1 - Math.min(acceptMs, 3_600_000) / 3_600_000) : 0;
          return Number((((onTime * 0.4) + (firstPass * 0.3) + (acceptScore * 0.2) + ((1 - recurrence) * 0.1)) * 30).toFixed(2));
        })(),
      },
      location: null,
    })).filter((row) => row.executor_id);
  } catch {
    return [];
  }
}

function parseDispatchSla(body: any): DispatchSlaInput {
  const accept = parseFiniteNumber(body?.sla?.accept_minutes ?? body?.accept_minutes);
  const arrive = parseFiniteNumber(body?.sla?.arrive_minutes ?? body?.arrive_minutes);
  return { accept_minutes: accept, arrive_minutes: arrive };
}

function hostBaseUrl(req: FastifyRequest): string {
  const envBase = String(process.env.GEOX_INTERNAL_BASE_URL ?? "").trim();
  if (envBase) return envBase;
  const host = String((req.headers as any).host ?? "127.0.0.1:3001");
  return `http://${host}`;
}

function requireTenantMatchOr404(auth: AoActAuthContextV0, tenant: TenantTriple, reply: FastifyReply): boolean {
  if (auth.tenant_id !== tenant.tenant_id || auth.project_id !== tenant.project_id || auth.group_id !== tenant.group_id) {
    reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return false;
  }
  return true;
}

function queryTenantFromReq(req: FastifyRequest, auth: AoActAuthContextV0): TenantTriple {
  const q: any = (req as any).query ?? {};
  return {
    tenant_id: typeof q.tenant_id === "string" ? q.tenant_id.trim() : "",
    project_id: typeof q.project_id === "string" ? q.project_id.trim() : "",
    group_id: typeof q.group_id === "string" ? q.group_id.trim() : "",
  };
}

function parseTenantFromBody(body: any): TenantTriple {
  return {
    tenant_id: String(body?.tenant_id ?? "").trim(),
    project_id: String(body?.project_id ?? "").trim(),
    group_id: String(body?.group_id ?? "").trim(),
  };
}

function requireTenantFieldsPresentOr400(tenant: TenantTriple, reply: FastifyReply): boolean {
  if (!tenant.tenant_id || !tenant.project_id || !tenant.group_id) {
    reply.status(400).send({ ok: false, error: "MISSING_TENANT_SCOPE" });
    return false;
  }
  return true;
}

async function ensureDeviceBelongsTenantOr404(pool: Pool, tenant: TenantTriple, device_id: string): Promise<boolean> {
  const q = await pool.query(
    `SELECT 1 FROM device_index_v1 WHERE tenant_id = $1 AND device_id = $2 LIMIT 1`,
    [tenant.tenant_id, device_id],
  );
  return (q.rowCount ?? 0) > 0;
}

async function insertFact(pool: Pool, source: string, record_json: any): Promise<string> {
  const fact_id = randomUUID();
  await pool.query(
    "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
    [fact_id, source, record_json],
  );
  return fact_id;
}

async function loadLatestFactByTypeAndKey(
  pool: Pool,
  factType: string,
  keyPath: string,
  keyValue: string,
  tenant: TenantTriple,
): Promise<ParsedFactRow | null> {
  const sql = `
    SELECT fact_id, occurred_at, source, record_json
    FROM facts
    WHERE (record_json::jsonb->>'type') = $1
      AND (record_json::jsonb#>>string_to_array($2, ',')) = $3
      AND (record_json::jsonb#>>'{payload,tenant_id}') = $4
      AND (record_json::jsonb#>>'{payload,project_id}') = $5
      AND (record_json::jsonb#>>'{payload,group_id}') = $6
    ORDER BY occurred_at DESC, fact_id DESC
    LIMIT 1
  `;
  const res = await pool.query(sql, [factType, keyPath, keyValue, tenant.tenant_id, tenant.project_id, tenant.group_id]);
  if (!res.rows?.length) return null;
  const row: any = res.rows[0];
  return {
    fact_id: String(row.fact_id),
    occurred_at: String(row.occurred_at),
    source: String(row.source),
    record_json: parseJsonMaybe(row.record_json) ?? row.record_json,
  };
}

async function loadLatestOperationPlanByApprovalRequestId(pool: Pool, approval_request_id: string, tenant: TenantTriple): Promise<ParsedFactRow | null> {
  return loadLatestFactByTypeAndKey(pool, "operation_plan_v1", "payload,approval_request_id", approval_request_id, tenant);
}

export async function loadManualOperationByCommandId(
  pool: Pool,
  tenant: TenantTriple,
  command_id: string,
): Promise<{ operation_id: string; operation_plan_id: string; command_id: string; act_task_id: string } | null> {
  const normalizedCommandId = String(command_id ?? "").trim();
  if (!normalizedCommandId) return null;
  const sql = `
    SELECT fact_id, occurred_at, source, (record_json::jsonb) AS record_json,
      COALESCE((record_json::jsonb#>>'{payload,command_id}'), (record_json::jsonb#>>'{payload,meta,command_id}')) AS resolved_command_id
    FROM facts
    WHERE (record_json::jsonb->>'type') = 'operation_plan_v1'
      AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
      AND (record_json::jsonb#>>'{payload,project_id}') = $2
      AND (record_json::jsonb#>>'{payload,group_id}') = $3
      AND COALESCE((record_json::jsonb#>>'{payload,command_id}'), (record_json::jsonb#>>'{payload,meta,command_id}')) = $4
    ORDER BY occurred_at DESC, fact_id DESC LIMIT 1
  `;
  const res = await pool.query(sql, [tenant.tenant_id, tenant.project_id, tenant.group_id, normalizedCommandId]);
  const row: any = res.rows?.[0];
  if (!row) return null;
  const record = parseJsonMaybe(row.record_json) ?? row.record_json;
  const payload = record?.payload ?? {};
  const operation_plan_id = String(payload.operation_plan_id ?? "").trim();
  if (!operation_plan_id) return null;
  const operation_id = String(payload.operation_id ?? operation_plan_id).trim() || operation_plan_id;
  const resolvedCommandId = String(row.resolved_command_id ?? "").trim();
  if (!resolvedCommandId) return null;
  const taskRes = await pool.query(
    `SELECT fact_id, record_json::jsonb AS record_json FROM facts
      WHERE (record_json::jsonb->>'type') = 'ao_act_task_v0'
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND (record_json::jsonb#>>'{payload,project_id}') = $2
        AND (record_json::jsonb#>>'{payload,group_id}') = $3
        AND (record_json::jsonb#>>'{payload,operation_plan_id}') = $4
      ORDER BY occurred_at DESC, fact_id DESC LIMIT 2`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, operation_plan_id],
  );
  if ((taskRes.rowCount ?? 0) !== 1) {
    if ((taskRes.rowCount ?? 0) > 1) throw new Error("MANUAL_OPERATION_TASK_LINKAGE_AMBIGUOUS");
    return null;
  }
  const taskRecord = parseJsonMaybe(taskRes.rows[0].record_json) ?? taskRes.rows[0].record_json;
  const act_task_id = String(taskRecord?.payload?.act_task_id ?? "").trim();
  if (!act_task_id) return null;
  return { operation_id, operation_plan_id, command_id: resolvedCommandId, act_task_id };
}

async function createOperationPlanForApproval(
  pool: Pool,
  tenant: TenantTriple,
  request_id: string,
  requestPayload: any,
  requestBody: any,
  source: string,
  operationPlanId?: string,
): Promise<{ operation_plan_id: string; operation_plan_fact_id: string; transition_fact_id: string }> {
  const proposal = requestPayload?.proposal ?? {};
  const executionContext = resolveApprovalExecutionContextV1({ requestPayload, requestBody });
  const operation_plan_id = String(operationPlanId ?? "").trim() || `opl_${randomUUID().replace(/-/g, "")}`;
  const operation_plan_fact_id = await insertFact(pool, source, {
    type: "operation_plan_v1",
    payload: {
      tenant_id: tenant.tenant_id,
      project_id: tenant.project_id,
      group_id: tenant.group_id,
      operation_id: requestPayload?.meta?.operation_id ?? null,
      command_id: requestPayload?.meta?.command_id ?? null,
      operation_plan_id,
      recommendation_id: requestPayload?.meta?.recommendation_id ?? proposal?.meta?.recommendation_id ?? null,
      program_id: requestPayload?.program_id ?? requestPayload?.meta?.program_id ?? proposal?.meta?.program_id ?? null,
      field_id: requestPayload?.field_id ?? requestPayload?.meta?.field_id ?? proposal?.target?.ref ?? null,
      season_id: requestPayload?.season_id ?? requestPayload?.meta?.season_id ?? proposal?.meta?.season_id ?? null,
      device_id: executionContext.device_id,
      approval_request_id: request_id,
      action_type: proposal?.action_type ?? null,
      adapter_type: executionContext.adapter_type,
      device_type: executionContext.device_type,
      required_capabilities: executionContext.required_capabilities,
      target: proposal?.target ?? null,
      parameters: proposal?.parameters ?? {},
      status: "CREATED",
      created_ts: Date.now(),
      updated_ts: Date.now(),
    },
  });
  const transition_fact_id = await insertFact(pool, source, {
    type: "operation_plan_transition_v1",
    payload: {
      tenant_id: tenant.tenant_id,
      project_id: tenant.project_id,
      group_id: tenant.group_id,
      operation_plan_id,
      status: "CREATED",
      trigger: "approval_operation_plan_auto_create",
      approval_request_id: request_id,
      created_ts: Date.now(),
    },
  });
  return { operation_plan_id, operation_plan_fact_id, transition_fact_id };
}

type OperationPlanStatusV1 = "CREATED" | "APPROVED" | "READY" | "DISPATCHED" | "ACKED" | "SUCCEEDED" | "FAILED" | "INVALID_EXECUTION" | "PENDING_ACCEPTANCE";

export function isAckConvergedOperationPlanStatus(status: string): boolean {
  return ["ACKED", "SUCCEEDED", "FAILED", "PENDING_ACCEPTANCE", "INVALID_EXECUTION"].includes(String(status ?? "").trim().toUpperCase());
}

export function isAckConvergedDispatchQueueState(state: string): boolean {
  return ["ACKED", "SUCCEEDED", "FAILED"].includes(String(state ?? "").trim().toUpperCase());
}

function isTerminalOperationPlanStatus(status: string): boolean {
  return ["SUCCEEDED", "FAILED", "INVALID_EXECUTION", "PENDING_ACCEPTANCE"].includes(String(status ?? "").trim().toUpperCase());
}

export function shouldTreatAckAsIdempotent(input: { requestedState: string; queueState?: string | null; operationPlanStatus?: string | null }): boolean {
  if (String(input.requestedState ?? "").trim().toUpperCase() !== "ACKED") return false;
  return isAckConvergedDispatchQueueState(input.queueState ?? "") || isAckConvergedOperationPlanStatus(input.operationPlanStatus ?? "");
}

async function transitionOperationPlanStateV1(
  pool: Pool,
  tenant: TenantTriple,
  operationPlanFact: ParsedFactRow,
  transition: {
    next_status: OperationPlanStatusV1;
    trigger: string;
    approval_request_id?: string | null;
    decision?: string | null;
    decision_fact_id?: string | null;
    act_task_id?: string | null;
    receipt_fact_id?: string | null;
    terminal_reason?: string | null;
  },
  source: string,
): Promise<{ transition_fact_id: string; operation_plan_fact_id: string }> {
  const payload = operationPlanFact.record_json?.payload ?? {};
  const operation_plan_id = String(payload.operation_plan_id ?? "").trim();
  if (!operation_plan_id) throw new Error("MISSING_OPERATION_PLAN_ID");
  const current_status = String(payload.status ?? "CREATED").trim().toUpperCase() as OperationPlanStatusV1;
  const allowedNextStatuses: Record<OperationPlanStatusV1, OperationPlanStatusV1[]> = {
    CREATED: ["APPROVED"], APPROVED: ["READY"], READY: ["DISPATCHED"], DISPATCHED: ["ACKED", "FAILED", "INVALID_EXECUTION"],
    ACKED: ["SUCCEEDED", "FAILED", "INVALID_EXECUTION", "PENDING_ACCEPTANCE"], SUCCEEDED: [], FAILED: [], INVALID_EXECUTION: [], PENDING_ACCEPTANCE: [],
  };
  if (["SUCCEEDED", "FAILED", "INVALID_EXECUTION", "PENDING_ACCEPTANCE"].includes(current_status)) throw new Error("OPERATION_PLAN_TERMINAL");
  if (!(allowedNextStatuses[current_status] ?? []).includes(transition.next_status)) throw new Error(`INVALID_OPERATION_PLAN_TRANSITION:${current_status}->${transition.next_status}`);
  const transition_fact_id = await insertFact(pool, source, {
    type: "operation_plan_transition_v1",
    payload: {
      tenant_id: tenant.tenant_id,
      project_id: tenant.project_id,
      group_id: tenant.group_id,
      operation_plan_id,
      program_id: payload.program_id ?? null,
      field_id: payload.field_id ?? payload.target?.ref ?? null,
      season_id: payload.season_id ?? null,
      adapter_type: payload.adapter_type ?? null,
      device_id: payload.device_id ?? payload.meta?.device_id ?? null,
      device_type: payload.device_type ?? null,
      required_capabilities: Array.isArray(payload.required_capabilities) ? payload.required_capabilities : [],
      from_status: current_status,
      status: transition.next_status,
      trigger: transition.trigger,
      approval_request_id: transition.approval_request_id ?? payload.approval_request_id ?? null,
      decision: transition.decision ?? null,
      decision_fact_id: transition.decision_fact_id ?? null,
      act_task_id: transition.act_task_id ?? payload.act_task_id ?? null,
      receipt_fact_id: transition.receipt_fact_id ?? payload.receipt_fact_id ?? null,
      terminal_reason: transition.terminal_reason ?? null,
      created_ts: Date.now(),
    },
  });
  const operation_plan_fact_id = await insertFact(pool, source, {
    type: "operation_plan_v1",
    payload: {
      ...payload,
      tenant_id: tenant.tenant_id,
      project_id: tenant.project_id,
      group_id: tenant.group_id,
      operation_plan_id,
      status: transition.next_status,
      approval_request_id: transition.approval_request_id ?? payload.approval_request_id ?? null,
      approval_decision: transition.decision ?? payload.approval_decision ?? null,
      approval_decision_fact_id: transition.decision_fact_id ?? payload.approval_decision_fact_id ?? null,
      act_task_id: transition.act_task_id ?? payload.act_task_id ?? null,
      receipt_fact_id: transition.receipt_fact_id ?? payload.receipt_fact_id ?? null,
      updated_ts: Date.now(),
    },
  });
  return { transition_fact_id, operation_plan_fact_id };
}

function resolveActionType(input: any): string {
  const taskType = typeof input?.task_type === "string" ? input.task_type.trim() : "";
  if (taskType) return taskType;
  const suggestedTaskType = typeof input?.meta?.task_type === "string" ? input.meta.task_type.trim() : "";
  if (suggestedTaskType) return suggestedTaskType;
  const suggestedActionType = typeof input?.meta?.suggested_action?.action_type === "string" ? input.meta.suggested_action.action_type.trim() : "";
  if (suggestedActionType) return suggestedActionType;
  const actionType = typeof input?.action_type === "string" ? input.action_type.trim() : "";
  return actionType;
}

function normalizeActionType(raw: any): string {
  const normalized = String(raw ?? "").trim().toLowerCase();
  if (!normalized) return "";
  const compact = normalized.replace(/[\s_-]+/g, ".");
  if (compact === "irrigate" || compact === "irrigation.start" || compact === "start.irrigation") return "irrigation.start";
  return normalized;
}

function resolveDeviceTypeMetadata(input: any): string | null {
  const candidates = [input?.device_type, input?.meta?.device_type, input?.target?.device_type, input?.target?.type];
  for (const candidate of candidates) {
    const value = String(candidate ?? "").trim();
    if (value) return value.toUpperCase();
  }
  return null;
}

function toAoActAllowlistAction(actionType: string): string {
  const canonical = normalizeActionType(actionType);
  if (canonical === "irrigation.start") return "IRRIGATE";
  return canonical.toUpperCase();
}

type ParsedTaskCapability = {
  capability: string;
  parameters: Record<string, unknown>;
  evidence_requirements: string[];
  explain: string | null;
  compatibility: { adapters: string[]; capabilities: string[]; protocols: string[]; hints?: { device_types?: string[] } };
};
type ParsedTaskCapabilityResult = { ok: true; value: ParsedTaskCapability } | { ok: false; error: { code: "CAPABILITY_NOT_RESOLVED"; message: string; reasons: string[] } };

function parseTaskCapability(taskPayload: any): ParsedTaskCapabilityResult {
  const metaAdapterType = typeof taskPayload?.meta?.adapter_type === "string" ? taskPayload.meta.adapter_type.trim() : "";
  const metaAdapterHint = typeof taskPayload?.meta?.adapter_hint === "string" ? taskPayload.meta.adapter_hint.trim() : "";
  const topLevelAdapterType = typeof taskPayload?.adapter_type === "string" ? taskPayload.adapter_type.trim() : "";
  const topLevelAdapterHint = typeof taskPayload?.adapter_hint === "string" ? taskPayload.adapter_hint.trim() : "";
  const resolvedAdapterHint = topLevelAdapterType || topLevelAdapterHint || metaAdapterType || metaAdapterHint;
  const resolved = resolveTaskCapabilityViaDeviceSkillsResult({
    ...(taskPayload ?? {}),
    ...(resolvedAdapterHint ? { adapter_type: resolvedAdapterHint, adapter_hint: resolvedAdapterHint } : {}),
    meta: { ...(taskPayload?.meta ?? {}), ...(resolvedAdapterHint ? { adapter_type: resolvedAdapterHint, adapter_hint: resolvedAdapterHint } : {}) },
  });
  if (!resolved.ok) return { ok: false, error: { code: resolved.error.code, message: resolved.error.message, reasons: resolved.error.reasons } };
  return {
    ok: true,
    value: {
      capability: resolved.resolution.capability,
      parameters: resolved.resolution.parameters ?? {},
      evidence_requirements: Array.isArray(resolved.resolution.evidence_requirements) ? resolved.resolution.evidence_requirements.map((x) => String(x)) : [],
      explain: resolved.resolution.explain ?? null,
      compatibility: resolved.resolution.compatibility,
    },
  };
}

function validateAdapterTask(adapterType: string, taskPayload: any): { ok: true } | { ok: false; reason: string } {
  const adapter = String(adapterType ?? "").trim().toLowerCase();
  if (!adapter) return { ok: false, reason: "MISSING_ADAPTER_TYPE" };
  if (["mqtt", "irrigation_real", "irrigation_http_v1", "irrigation_simulator"].includes(adapter) && !String(taskPayload?.meta?.device_id ?? "").trim()) {
    return { ok: false, reason: "MISSING_DEVICE_ID" };
  }
  return { ok: true };
}

function assertTenantFieldDeviceTriple(taskPayload: any): { ok: true } | { ok: false; reason: string } {
  if (!String(taskPayload?.tenant_id ?? "").trim()) return { ok: false, reason: "MISSING_TENANT_ID" };
  if (!String(taskPayload?.project_id ?? "").trim()) return { ok: false, reason: "MISSING_PROJECT_ID" };
  if (!String(taskPayload?.group_id ?? "").trim()) return { ok: false, reason: "MISSING_GROUP_ID" };
  if (!String(taskPayload?.meta?.device_id ?? "").trim()) return { ok: false, reason: "MISSING_DEVICE_ID" };
  return { ok: true };
}

function parseLimit(q: any, fallback = 20, max = 200): number {
  const raw = Number(q?.limit ?? fallback);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(1, Math.min(max, Math.trunc(raw)));
}

function sha256Json(value: any): string {
  return createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex");
}

async function fetchJson(url: string, authz: string, body?: any): Promise<{ ok: boolean; status: number; json: any }> {
  const res = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: { accept: "application/json", authorization: authz, ...(body === undefined ? {} : { "content-type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, json };
}

async function enqueueReadyDispatchForTask(pool: Pool, auth: AoActAuthContextV0, tenant: TenantTriple, taskFact: ParsedFactRow, operationPlan: ParsedFactRow) {
  const taskPayload = taskFact.record_json?.payload ?? {};
  const planPayload = operationPlan.record_json?.payload ?? {};
  const act_task_id = String(taskPayload.act_task_id ?? "").trim();
  const command_id = String(taskPayload.command_id ?? act_task_id).trim() || act_task_id;
  if (!act_task_id) throw new Error("MISSING_ACT_TASK_ID_FOR_QUEUE_READY");
  const device_id = typeof taskPayload?.meta?.device_id === "string" ? String(taskPayload.meta.device_id).trim() || null : null;
  const downlink_topic = device_id ? `/device/${device_id}/cmd` : null;
  const adapter_hint = typeof planPayload?.adapter_type === "string" ? String(planPayload.adapter_type).trim() || null : null;
  const outbox_fact_id = await insertFact(pool, "api/v1/ao-act/tasks/dispatch", {
    type: "ao_act_dispatch_outbox_v1",
    payload: { tenant_id: tenant.tenant_id, project_id: tenant.project_id, group_id: tenant.group_id, act_task_id, command_id, task_fact_id: taskFact.fact_id, device_id, downlink_topic, qos: 1, retain: false, actor_id: auth.actor_id, token_id: auth.token_id, dispatch_mode: "OUTBOX_ONLY", adapter_hint, created_at_ts: Date.now() },
  });
  return { outbox_fact_id, device_id, downlink_topic, adapter_hint };
}

export function registerControlPlaneV1Routes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/approvals/:request_id", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = queryTenantFromReq(req, auth);
    if (!requireTenantFieldsPresentOr400(tenant, reply)) return;
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const request_id = String(((req as any).params ?? {}).request_id ?? "").trim();
    if (!request_id) return badRequest(reply, "MISSING_REQUEST_ID");
    const request = await loadLatestFactByTypeAndKey(pool, "approval_request_v1", "payload,request_id", request_id, tenant);
    if (!request) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    const decision = await loadLatestFactByTypeAndKey(pool, "approval_decision_v1", "payload,request_id", request_id, tenant);
    return reply.send({ ok: true, request, decision });
  });

  app.post("/api/v1/approvals/:request_id/decide", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "approval.decide");
    if (!auth) return reply;
    if (!requireAoActAdminV0(req, reply, { deniedError: "ROLE_APPROVAL_ADMIN_REQUIRED" })) return reply;
    const params: any = (req as any).params ?? {};
    const body: any = req.body ?? {};
    const request_id = String(params.request_id ?? "").trim();
    if (!request_id) return badRequest(reply, "MISSING_REQUEST_ID");
    const decision = String(body.decision ?? "").trim().toUpperCase();
    if (decision !== "APPROVE" && decision !== "REJECT") return badRequest(reply, "INVALID_DECISION");
    const tenant: TenantTriple = parseTenantFromBody(body);
    if (!requireTenantFieldsPresentOr400(tenant, reply)) return reply;
    if (!requireTenantMatchOr404(auth, tenant, reply)) return reply;

    const requestFact = await loadLatestFactByTypeAndKey(pool, "approval_request_v1", "payload,request_id", request_id, tenant);
    if (!requestFact) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    const requestPayload = requestFact.record_json?.payload ?? null;
    if (!requestPayload?.proposal) return reply.status(500).send({ ok: false, error: "REQUEST_RECORD_INVALID" });
    const existingDecision = await loadLatestFactByTypeAndKey(pool, "approval_decision_v1", "payload,request_id", request_id, tenant);
    if (existingDecision) return badRequest(reply, "REQUEST_ALREADY_DECIDED");

    let operationPlan = await loadLatestOperationPlanByApprovalRequestId(pool, request_id, tenant);
    const operation_plan_id = operationPlan?.record_json?.payload?.operation_plan_id ? String(operationPlan.record_json.payload.operation_plan_id) : `opl_${randomUUID().replace(/-/g, "")}`;
    if (decision !== "APPROVE") return badRequest(reply, "OPERATION_PLAN_APPROVAL_REQUIRED");

    const proposal = requestPayload.proposal;
    const preDecisionPlanPayload = operationPlan?.record_json?.payload ?? {};
    const approvalExecutionContext = resolveApprovalExecutionContextV1({
      requestPayload,
      requestBody: body,
      operationPlanPayload: preDecisionPlanPayload,
    });
    const approvalDeviceId = approvalExecutionContext.device_id ?? "";
    const planAdapterType = approvalExecutionContext.adapter_type ?? "";
    const approvalDeviceType = approvalExecutionContext.device_type ?? resolveDeviceTypeMetadata(proposal);
    const resolvedProposalActionType = resolveActionType(proposal);
    const parsedCapabilityResult = parseTaskCapability(proposal);
    if (!parsedCapabilityResult.ok) {
      return capabilityError(reply, { stage: "approval", operation_plan_id, adapter_type: planAdapterType || null, device_type: approvalDeviceType, error: parsedCapabilityResult.error });
    }
    const parsedCapability = parsedCapabilityResult.value;
    const aoActActionType = toAoActAllowlistAction(resolvedProposalActionType);
    const tripleValidation = assertTenantFieldDeviceTriple({ tenant_id: tenant.tenant_id, project_id: tenant.project_id, group_id: tenant.group_id, meta: { device_id: approvalDeviceId } });
    if (!tripleValidation.ok) return badRequest(reply, tripleValidation.reason);
    const compatibilityCheck = checkCapabilityCompatibilityMatrix({
      capability: { capability: parsedCapability.capability, parameters: parsedCapability.parameters, evidence_requirements: parsedCapability.evidence_requirements, explain: parsedCapability.explain ?? "", compatibility: parsedCapability.compatibility },
      adapter_type: planAdapterType,
    });
    if (!compatibilityCheck.ok) {
      return capabilityError(reply, { stage: "approval", operation_plan_id, adapter_type: planAdapterType || null, device_type: approvalDeviceType, error: compatibilityCheck.error });
    }
    const adapterValidation = validateAdapterTask(planAdapterType, { meta: { device_id: approvalDeviceId } });
    if (!adapterValidation.ok) return badRequest(reply, adapterValidation.reason);

    const decision_id = `apd_${randomUUID().replace(/-/g, "")}`;
    const decision_fact_id = await insertFact(pool, "api/v1/approvals", {
      type: "approval_decision_v1",
      payload: { tenant_id: tenant.tenant_id, project_id: tenant.project_id, group_id: tenant.group_id, decision_id, request_id, decision, act_task_id: null, ao_act_fact_id: null, auto_task_issued: false, task_issue_intent: true, actor_id: auth.actor_id, token_id: auth.token_id, created_at_ts: Date.now(), reason: body.reason ?? null },
    });

    if (!operationPlan) {
      await createOperationPlanForApproval(pool, tenant, request_id, requestPayload, body, "api/v1/approvals", operation_plan_id);
      operationPlan = await loadLatestOperationPlanByApprovalRequestId(pool, request_id, tenant);
    }
    if (!operationPlan) return reply.status(500).send({ ok: false, error: "OPERATION_PLAN_CREATE_FAILED" });
    const approvedTransition = await transitionOperationPlanStateV1(pool, tenant, operationPlan, { next_status: "APPROVED", trigger: "approval_decision", approval_request_id: request_id, decision, decision_fact_id }, "api/v1/approvals");
    const approvedPlan = await loadLatestFactByTypeAndKey(pool, "operation_plan_v1", "payload,operation_plan_id", operation_plan_id, tenant);
    if (!approvedPlan) return reply.status(500).send({ ok: false, error: "OPERATION_PLAN_UPDATE_FAILED" });
    const readyTransition = await transitionOperationPlanStateV1(pool, tenant, approvedPlan, { next_status: "READY", trigger: "approval_ready_for_task", approval_request_id: request_id, decision, decision_fact_id }, "api/v1/approvals");
    const readyPlan = await loadLatestFactByTypeAndKey(pool, "operation_plan_v1", "payload,operation_plan_id", operation_plan_id, tenant);
    if (!readyPlan) return reply.status(500).send({ ok: false, error: "OPERATION_PLAN_NOT_FOUND_AFTER_READY" });

    const sanitizedParameters = sanitizeParametersBySchema(proposal.parameter_schema, proposal.parameters);
    const taskCreatePayload = {
      tenant_id: tenant.tenant_id,
      project_id: tenant.project_id,
      group_id: tenant.group_id,
      operation_plan_id,
      approval_request_id: request_id,
      issuer: proposal.issuer,
      action_type: aoActActionType,
      target: proposal.target,
      time_window: proposal.time_window,
      parameter_schema: proposal.parameter_schema,
      parameters: sanitizedParameters,
      constraints: proposal.constraints,
      meta: {
        ...(proposal.meta ?? {}),
        task_type: String(proposal?.task_type ?? resolvedProposalActionType ?? aoActActionType).trim() || aoActActionType,
        capability: parsedCapability.capability,
        capability_parameters: parsedCapability.parameters,
        evidence_requirements: parsedCapability.evidence_requirements,
        device_id: approvalDeviceId || null,
        adapter_type: readyPlan.record_json?.payload?.adapter_type ?? planAdapterType || null,
        device_type: readyPlan.record_json?.payload?.device_type ?? approvalDeviceType,
        required_capabilities: Array.isArray(readyPlan.record_json?.payload?.required_capabilities) ? readyPlan.record_json.payload.required_capabilities : approvalExecutionContext.required_capabilities,
      },
    };
    const delegated = await fetchJson(`${hostBaseUrl(req)}/api/v1/actions/task`, String((req.headers as any).authorization ?? ""), taskCreatePayload);
    if (!delegated.ok || !delegated.json?.ok) return reply.status(delegated.status || 400).send(delegated.json ?? { ok: false, error: "AO_ACT_TASK_CREATE_FAILED" });
    const act_task_id = String(delegated.json.act_task_id ?? "");
    const createdTaskFact = await loadLatestFactByTypeAndKey(pool, "ao_act_task_v0", "payload,act_task_id", act_task_id, tenant);
    if (!createdTaskFact) return reply.status(500).send({ ok: false, error: "TASK_FACT_NOT_FOUND_AFTER_APPROVE" });
    const readyQueue = await enqueueReadyDispatchForTask(pool, auth, tenant, createdTaskFact, readyPlan);

    return reply.send({
      ok: true,
      request_id,
      decision_id,
      decision_fact_id,
      act_task_id,
      ao_act_fact_id: String(delegated.json.fact_id ?? ""),
      operation_plan_id,
      outbox_fact_id: readyQueue.outbox_fact_id,
      queue_ready: true,
      device_id: readyQueue.device_id,
      downlink_topic: readyQueue.downlink_topic,
      adapter_hint: readyQueue.adapter_hint,
      operation_plan_transition_fact_id: readyTransition.transition_fact_id,
      operation_plan_update_fact_id: readyTransition.operation_plan_fact_id,
      operation_plan_approved_transition_fact_id: approvedTransition.transition_fact_id,
    });
  });

  app.get("/api/v1/operations/plans/:operation_plan_id", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = queryTenantFromReq(req, auth);
    if (!requireTenantFieldsPresentOr400(tenant, reply)) return;
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const operation_plan_id = String(((req as any).params ?? {}).operation_plan_id ?? "").trim();
    if (!operation_plan_id) return badRequest(reply, "MISSING_OPERATION_PLAN_ID");
    const planFact = await loadLatestFactByTypeAndKey(pool, "operation_plan_v1", "payload,operation_plan_id", operation_plan_id, tenant);
    if (!planFact) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return reply.send({ ok: true, item: { plan: planFact } });
  });
}
