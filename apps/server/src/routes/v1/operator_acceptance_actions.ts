import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAoActAnyScopeV0, type AoActAuthContextV0 } from "../../auth/ao_act_authz_v0.js";
import { projectOperationStateV1, type OperationStateV1 } from "../../projections/operation_state_v1.js";

type OperatorAcceptanceActionType = "ACCEPTANCE_EVALUATE" | "ACCEPTANCE_REQUEST_REVIEW";
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

type OperatorActionResponse = {
  ok: boolean;
  action_id: string;
  audit_id: string;
  action_type: OperatorAcceptanceActionType;
  target_type: "OPERATION";
  target_id: string;
  status_before: string | null;
  status_after: string | null;
  permission: {
    allowed?: boolean;
    role?: string | null;
    reason?: string | null;
  };
  message: string;
  error_code?: OperatorActionErrorCode;
  updated_at: string;
};

type ReviewFact = {
  operation_id: string;
  operation_plan_id: string | null;
  reason?: string | null;
  requested_at: string | null;
};

function safeText(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text || text === "--" || text === "undefined" || text === "null") return "";
  if (/token|secret|credential|private\s*key|password|stack\s*trace|debug\s*json/i.test(text)) return "";
  return text;
}

function nullableText(value: unknown): string | null {
  return safeText(value) || null;
}

function actionId(): string {
  return `act_operator_${randomUUID().replace(/-/g, "")}`;
}

function auditId(): string {
  return `audit_${randomUUID().replace(/-/g, "")}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function roleAllowsAcceptance(role: unknown): boolean {
  const normalized = safeText(role).toLowerCase();
  return normalized === "admin" || normalized === "operator";
}

function buildInternalBaseUrl(req: any): string {
  const proto = String((req.headers as any)?.["x-forwarded-proto"] ?? "http");
  const localPortRaw = Number((req.socket as any)?.localPort ?? 3000);
  const localPort = Number.isFinite(localPortRaw) && localPortRaw > 0 ? localPortRaw : 3000;
  return `${proto}://127.0.0.1:${localPort}`;
}

function statusOf(state: OperationStateV1 | null): string | null {
  if (!state) return null;
  if (state.final_status) return String(state.final_status);
  return String(state.acceptance?.status ?? "").trim() || null;
}

function acceptanceStatus(state: OperationStateV1, review: ReviewFact | null): "PENDING" | "EVIDENCE_INSUFFICIENT" | "FAILED" | "REVIEW_REQUIRED" | "PASSED" | "UNKNOWN" {
  if (review) return "REVIEW_REQUIRED";
  if (hasEvidenceInsufficient(state)) return "EVIDENCE_INSUFFICIENT";
  const acceptance = String(state.acceptance?.status ?? "").toUpperCase();
  if (acceptance === "PASS") return "PASSED";
  if (acceptance === "FAIL") return "FAILED";
  if (String(state.final_status ?? "").toUpperCase() === "PENDING_ACCEPTANCE") return "PENDING";
  return "UNKNOWN";
}

function hasEvidenceInsufficient(state: OperationStateV1): boolean {
  if (String(state.final_status ?? "").toUpperCase() === "INVALID_EXECUTION") return true;
  if (Array.isArray(state.acceptance?.missing) && state.acceptance.missing.length > 0) return true;
  if (!state.receipt_id && state.act_task_id) return true;
  return false;
}

function buildResponse(params: {
  ok: boolean;
  action_id: string;
  audit_id: string;
  action_type: OperatorAcceptanceActionType;
  target_id: string;
  status_before: string | null;
  status_after: string | null;
  role?: string | null;
  allowed?: boolean;
  reason?: string | null;
  message: string;
  error_code?: OperatorActionErrorCode;
  updated_at?: string;
}): OperatorActionResponse {
  return {
    ok: params.ok,
    action_id: params.action_id,
    audit_id: params.audit_id,
    action_type: params.action_type,
    target_type: "OPERATION",
    target_id: params.target_id,
    status_before: params.status_before,
    status_after: params.status_after,
    permission: {
      allowed: params.allowed ?? (params as any).permission?.allowed ?? false,
      role: params.role ?? (params as any).permission?.role ?? null,
      reason: params.reason ?? (params as any).permission?.reason ?? null,
    },
    message: params.message,
    ...(params.error_code ? { error_code: params.error_code } : {}),
    updated_at: params.updated_at ?? nowIso(),
  };
}

async function writeAuditFact(pool: Pool, auth: AoActAuthContextV0, result: OperatorActionResponse): Promise<void> {
  const record = {
    type: "operator_action_audit_v1",
    payload: {
      audit_id: result.audit_id,
      action_id: result.action_id,
      action_type: result.action_type,
      target_type: result.target_type,
      target_id: result.target_id,
      actor_id: auth.actor_id,
      token_id: auth.token_id,
      role: auth.role,
      tenant_id: auth.tenant_id,
      project_id: auth.project_id,
      group_id: auth.group_id,
      status_before: result.status_before,
      status_after: result.status_after,
      result: result.ok ? "SUCCESS" : "FAILED",
      error_code: result.error_code ?? null,
      reason: result.permission.reason ?? result.message,
      created_at: result.updated_at,
    },
  };
  await pool.query(
    "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
    [randomUUID(), "api/v1/operator/acceptance/action", record],
  );
}

function httpStatusFor(code: OperatorActionErrorCode): number {
  if (code === "AUTH_MISSING") return 401;
  if (code === "FORBIDDEN" || code === "SELF_APPROVAL_BLOCKED") return 403;
  if (code === "TARGET_NOT_FOUND") return 404;
  if (code === "INVALID_STATE") return 409;
  if (code === "EVIDENCE_INSUFFICIENT") return 422;
  if (code === "AUDIT_WRITE_FAILED" || code === "STATE_WRITE_FAILED") return 500;
  return 400;
}

async function sendFailure(reply: any, pool: Pool, auth: AoActAuthContextV0, result: OperatorActionResponse): Promise<void> {
  try {
    await writeAuditFact(pool, auth, result);
  } catch {
    const auditFailed = buildResponse({
      ...result,
      ok: false,
      allowed: false,
      reason: "审计写入失败，动作未执行。",
      message: "审计写入失败，动作未执行。",
      error_code: "AUDIT_WRITE_FAILED",
      status_after: result.status_before,
    });
    return reply.status(500).send(auditFailed);
  }
  return reply.status(httpStatusFor(result.error_code ?? "ACTION_NOT_READY")).send(result);
}

async function findOperationState(pool: Pool, auth: AoActAuthContextV0, operationId: string): Promise<OperationStateV1 | null> {
  const states = await projectOperationStateV1(pool, {
    tenant_id: auth.tenant_id,
    project_id: auth.project_id,
    group_id: auth.group_id,
  });
  return states.find((item) => item.operation_id === operationId || item.operation_plan_id === operationId || item.act_task_id === operationId) ?? null;
}

async function readReviewFacts(pool: Pool, auth: AoActAuthContextV0): Promise<Map<string, ReviewFact>> {
  const result = await pool.query(
    `SELECT occurred_at, record_json
       FROM facts
      WHERE (record_json::jsonb->>'type') = 'operator_acceptance_review_request_v1'
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND (record_json::jsonb#>>'{payload,project_id}') = $2
        AND (record_json::jsonb#>>'{payload,group_id}') = $3
      ORDER BY occurred_at DESC`,
    [auth.tenant_id, auth.project_id, auth.group_id],
  );
  const out = new Map<string, ReviewFact>();
  for (const row of result.rows ?? []) {
    const record = typeof row.record_json === "string" ? JSON.parse(row.record_json) : row.record_json;
    const payload = record?.payload ?? {};
    const operationId = safeText(payload.operation_id);
    if (!operationId || out.has(operationId)) continue;
    out.set(operationId, {
      operation_id: operationId,
      operation_plan_id: nullableText(payload.operation_plan_id),
      reason: nullableText(payload.reason),
      requested_at: nullableText(payload.requested_at ?? row.occurred_at),
    });
  }
  return out;
}

function buildPermission(auth: AoActAuthContextV0, state: OperationStateV1, action: OperatorAcceptanceActionType, review: ReviewFact | null): { allowed?: boolean; role?: string | null; reason: string | null } {
  const role = safeText(auth.role) || null;
  if (!roleAllowsAcceptance(auth.role)) return { allowed: false, role, reason: "当前角色无验收操作权限。" };
  if (action === "ACCEPTANCE_EVALUATE") {
    if (!state.act_task_id) return { allowed: false, role, reason: "缺少作业任务，暂不能验收。" };
    if (hasEvidenceInsufficient(state)) return { allowed: false, role, reason: "证据不足，不能直接包装成验收通过。" };
    if (state.acceptance?.status === "PASS") return { allowed: false, role, reason: "该作业已通过验收。" };
    return { allowed: true, role, reason: null };
  }
  if (review) return { allowed: false, role, reason: "该作业已进入复核队列。" };
  if (state.acceptance?.status === "PASS") return { allowed: false, role, reason: "已通过验收的作业无需复核。" };
  return { allowed: true, role, reason: null };
}

async function callMainAcceptanceEvaluate(req: any, auth: AoActAuthContextV0, state: OperationStateV1): Promise<{ ok: boolean; status: number; body: any }> {
  const resp = await fetch(`${buildInternalBaseUrl(req)}/api/v1/acceptance/evaluate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": String((req.headers as any)["authorization"] ?? ""),
    },
    body: JSON.stringify({
      tenant_id: auth.tenant_id,
      project_id: auth.project_id,
      group_id: auth.group_id,
      act_task_id: state.act_task_id,
      ...((req.body ?? {}) as Record<string, unknown>),
    }),
  });
  const body: any = await resp.json().catch(() => null);
  return { ok: resp.ok && Boolean(body?.ok), status: resp.status, body };
}

function mapAcceptanceError(value: unknown): OperatorActionErrorCode {
  const raw = safeText(value).toUpperCase();
  if (raw.includes("RECEIPT") || raw.includes("EVIDENCE")) return "EVIDENCE_INSUFFICIENT";
  if (raw.includes("TASK_NOT_FOUND") || raw.includes("NOT_FOUND")) return "TARGET_NOT_FOUND";
  if (raw.includes("ROLE") || raw.includes("SCOPE") || raw.includes("DENIED")) return "FORBIDDEN";
  if (raw.includes("INVALID")) return "INVALID_STATE";
  return "STATE_WRITE_FAILED";
}

async function writeReviewRequestFact(pool: Pool, auth: AoActAuthContextV0, state: OperationStateV1, reason: string | null): Promise<void> {
  const record = {
    type: "operator_acceptance_review_request_v1",
    payload: {
      tenant_id: auth.tenant_id,
      project_id: auth.project_id,
      group_id: auth.group_id,
      operation_id: state.operation_id,
      operation_plan_id: state.operation_plan_id,
      act_task_id: state.act_task_id,
      field_id: state.field_id,
      status: "REVIEW_REQUIRED",
      reason,
      requested_by_actor_id: auth.actor_id,
      requested_by_token_id: auth.token_id,
      requested_at: nowIso(),
    },
  };
  await pool.query(
    "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
    [randomUUID(), "api/v1/operator/acceptance/request-review", record],
  );
}

async function handleEvaluate(req: any, reply: any, pool: Pool): Promise<void> {
  const auth = requireAoActAnyScopeV0(req, reply, ["acceptance.evaluate"]);
  if (!auth) return;
  const operationId = safeText((req.params as any)?.operationId);
  const aid = actionId();
  const auid = auditId();
  const role = safeText(auth.role) || null;
  const state = operationId ? await findOperationState(pool, auth, operationId) : null;
  const statusBefore = statusOf(state);

  if (!operationId || !state) {
    return sendFailure(reply, pool, auth, buildResponse({
      ok: false,
      action_id: aid,
      audit_id: auid,
      action_type: "ACCEPTANCE_EVALUATE",
      target_id: operationId,
      status_before: null,
      status_after: null,
      role,
      allowed: false,
      reason: "作业不存在或不在当前权限范围内。",
      message: "作业不存在或不在当前权限范围内。",
      error_code: "TARGET_NOT_FOUND",
    }));
  }

  const permission = buildPermission(auth, state, "ACCEPTANCE_EVALUATE", null);
  if (!permission.allowed) {
    const code: OperatorActionErrorCode = hasEvidenceInsufficient(state) ? "EVIDENCE_INSUFFICIENT" : "ACTION_NOT_READY";
    return sendFailure(reply, pool, auth, buildResponse({
      ok: false,
      action_id: aid,
      audit_id: auid,
      action_type: "ACCEPTANCE_EVALUATE",
      target_id: state.operation_id,
      status_before: statusBefore,
      status_after: statusBefore,
      role,
      allowed: false,
      reason: permission.reason,
      message: permission.reason ?? "当前作业暂不能验收。",
      error_code: code,
    }));
  }

  const main = await callMainAcceptanceEvaluate(req, auth, state);
  if (!main.ok) {
    const code = mapAcceptanceError(main.body?.error ?? main.body?.message);
    return sendFailure(reply, pool, auth, buildResponse({
      ok: false,
      action_id: aid,
      audit_id: auid,
      action_type: "ACCEPTANCE_EVALUATE",
      target_id: state.operation_id,
      status_before: statusBefore,
      status_after: statusBefore,
      role,
      allowed: true,
      reason: safeText(main.body?.error ?? main.body?.message) || "主验收链处理失败。",
      message: safeText(main.body?.error ?? main.body?.message) || "主验收链处理失败。",
      error_code: code,
    }));
  }

  const verdict = safeText(main.body?.verdict).toUpperCase();
  const statusAfter = verdict === "PASS" ? "SUCCESS" : verdict === "FAIL" ? "FAILED" : "PENDING_ACCEPTANCE";
  const success = buildResponse({
    ok: true,
    action_id: aid,
    audit_id: auid,
    action_type: "ACCEPTANCE_EVALUATE",
    target_id: state.operation_id,
    status_before: statusBefore,
    status_after: statusAfter,
    role,
    allowed: true,
    reason: null,
    message: "验收已完成，作业报告将按后端验收结果刷新。",
  });
  try {
    await writeAuditFact(pool, auth, success);
  } catch {
    return reply.status(500).send(buildResponse({
      ok: false,
      action_id: aid,
      audit_id: auid,
      action_type: "ACCEPTANCE_EVALUATE",
      target_id: state.operation_id,
      status_before: statusBefore,
      status_after: statusAfter,
      role,
      allowed: false,
      reason: "验收已进入主链，但审计写入失败。",
      message: "验收已进入主链，但审计写入失败。",
      error_code: "AUDIT_WRITE_FAILED",
    }));
  }
  return reply.send(success);
}

async function handleRequestReview(req: any, reply: any, pool: Pool): Promise<void> {
  const auth = requireAoActAnyScopeV0(req, reply, ["acceptance.evaluate", "ao_act.index.read"]);
  if (!auth) return;
  const operationId = safeText((req.params as any)?.operationId);
  const aid = actionId();
  const auid = auditId();
  const role = safeText(auth.role) || null;
  const state = operationId ? await findOperationState(pool, auth, operationId) : null;
  const statusBefore = statusOf(state);
  const reviewFacts = await readReviewFacts(pool, auth);
  const review = state ? reviewFacts.get(state.operation_id) ?? null : null;

  if (!operationId || !state) {
    return sendFailure(reply, pool, auth, buildResponse({
      ok: false,
      action_id: aid,
      audit_id: auid,
      action_type: "ACCEPTANCE_REQUEST_REVIEW",
      target_id: operationId,
      status_before: null,
      status_after: null,
      role,
      allowed: false,
      reason: "作业不存在或不在当前权限范围内。",
      message: "作业不存在或不在当前权限范围内。",
      error_code: "TARGET_NOT_FOUND",
    }));
  }

  const permission = buildPermission(auth, state, "ACCEPTANCE_REQUEST_REVIEW", review);
  if (!permission.allowed) {
    return sendFailure(reply, pool, auth, buildResponse({
      ok: false,
      action_id: aid,
      audit_id: auid,
      action_type: "ACCEPTANCE_REQUEST_REVIEW",
      target_id: state.operation_id,
      status_before: statusBefore,
      status_after: statusBefore,
      role,
      allowed: false,
      reason: permission.reason,
      message: permission.reason ?? "当前作业暂不能进入复核。",
      error_code: "ACTION_NOT_READY",
    }));
  }

  const reason = safeText((req.body as any)?.reason ?? (req.body as any)?.note) || null;
  const success = buildResponse({
    ok: true,
    action_id: aid,
    audit_id: auid,
    action_type: "ACCEPTANCE_REQUEST_REVIEW",
    target_id: state.operation_id,
    status_before: statusBefore,
    status_after: "REVIEW_REQUIRED",
    role,
    allowed: true,
    reason: null,
    message: "已进入复核队列。",
  });
  try {
    await writeAuditFact(pool, auth, success);
    await writeReviewRequestFact(pool, auth, state, reason);
  } catch {
    return reply.status(500).send(buildResponse({
      ok: false,
      action_id: aid,
      audit_id: auid,
      action_type: "ACCEPTANCE_REQUEST_REVIEW",
      target_id: state.operation_id,
      status_before: statusBefore,
      status_after: statusBefore,
      role,
      allowed: true,
      reason: "状态写入失败，请刷新后重试。",
      message: "状态写入失败，请刷新后重试。",
      error_code: "STATE_WRITE_FAILED",
    }));
  }
  return reply.send(success);
}

function buildWorklistItem(auth: AoActAuthContextV0, state: OperationStateV1, review: ReviewFact | null): Record<string, unknown> {
  const status = acceptanceStatus(state, review);
  const evaluatePermission = buildPermission(auth, state, "ACCEPTANCE_EVALUATE", review);
  const reviewPermission = buildPermission(auth, state, "ACCEPTANCE_REQUEST_REVIEW", review);
  return {
    operation_id: state.operation_id,
    operation_plan_id: state.operation_plan_id,
    acceptance_id: null,
    field_id: state.field_id,
    field_name: null,
    operation_name: state.action_type,
    acceptance_status: status,
    operation_state_status: state.final_status,
    evidence_insufficient: hasEvidenceInsufficient(state),
    failure_reason: state.invalid_reason,
    review_reason: review?.reason ?? null,
    acceptance_verdict: state.acceptance?.status ?? null,
    generated_at: null,
    updated_at: new Date(state.last_event_ts || Date.now()).toISOString(),
    can_evaluate: evaluatePermission.allowed,
    can_request_review: reviewPermission.allowed,
    permission_reason: evaluatePermission.reason ?? reviewPermission.reason,
    permissions: {
      can_evaluate: evaluatePermission.allowed,
      can_request_review: reviewPermission.allowed,
      reason: evaluatePermission.reason ?? reviewPermission.reason,
      role: safeText(auth.role) || null,
    },
  };
}

export function registerOperatorAcceptanceActionRoutes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/operator/acceptance/worklist", async (req, reply) => {
    const auth = requireAoActAnyScopeV0(req, reply, ["acceptance.read", "acceptance.evaluate", "ao_act.index.read"]);
    if (!auth) return;
    const states = await projectOperationStateV1(pool, {
      tenant_id: auth.tenant_id,
      project_id: auth.project_id,
      group_id: auth.group_id,
    });
    const reviewFacts = await readReviewFacts(pool, auth);
    const items = states
      .map((state) => buildWorklistItem(auth, state, reviewFacts.get(state.operation_id) ?? null))
      .filter((item) => String(item.acceptance_status ?? "") !== "UNKNOWN");
    return reply.send({
      source: "operator_acceptance_api",
      dataScope: "OFFICIAL_OPERATOR_API",
      generated_at: new Date().toISOString(),
      items,
      writeReady: true,
      message: "Operator acceptance actions are controlled by backend operation_state and evidence readiness.",
    });
  });

  app.post("/api/v1/operator/acceptance/:operationId/evaluate", async (req, reply) => handleEvaluate(req, reply, pool));
  app.post("/api/v1/operator/acceptance/:operationId/request-review", async (req, reply) => handleRequestReview(req, reply, pool));
}
