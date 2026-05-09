import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAoActAnyScopeV0, type AoActAuthContextV0 } from "../../auth/ao_act_authz_v0.js";

type OperatorApprovalActionType = "APPROVAL_APPROVE" | "APPROVAL_REJECT" | "APPROVAL_RETURN";
type OperatorApprovalDecision = "APPROVED" | "REJECTED" | "RETURNED";
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

type FactRow = {
  fact_id: string;
  occurred_at: string;
  record_json: any;
};

type ApprovalActionResult = {
  ok: boolean;
  action_id: string;
  audit_id: string;
  action_type: OperatorApprovalActionType;
  target_type: "APPROVAL_REQUEST";
  target_id: string;
  status_before: string | null;
  status_after: string | null;
  permission: {
    allowed: boolean;
    role: string | null;
    reason: string | null;
  };
  message: string;
  error_code?: OperatorActionErrorCode;
  updated_at: string;
};

function parseRecordJson(value: unknown): any {
  if (value && typeof value === "object") return value;
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return null; }
  }
  return null;
}

function safeText(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text || text === "--" || text === "undefined" || text === "null") return "";
  if (/token|secret|credential|private\s*key|password|stack\s*trace|debug\s*json/i.test(text)) return "";
  return text;
}

function actionId(): string {
  return `act_operator_${randomUUID().replace(/-/g, "")}`;
}

function auditId(): string {
  return `audit_${randomUUID().replace(/-/g, "")}`;
}

function decisionId(): string {
  return `apd_${randomUUID().replace(/-/g, "")}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeStatus(value: unknown): string {
  const raw = safeText(value).toUpperCase();
  if (raw === "APPROVE") return "APPROVED";
  if (raw === "REJECT") return "REJECTED";
  if (raw === "RETURN") return "RETURNED";
  if (raw) return raw;
  return "PENDING";
}

function isPendingStatus(value: unknown): boolean {
  const status = normalizeStatus(value);
  return status === "PENDING" || status === "OPEN" || status === "WAITING" || status === "REQUESTED";
}

function roleAllowsApproval(role: unknown): boolean {
  const normalized = safeText(role).toLowerCase();
  return normalized === "admin" || normalized === "approver";
}

function buildResponse(params: {
  ok: boolean;
  action_id: string;
  audit_id: string;
  action_type: OperatorApprovalActionType;
  target_id: string;
  status_before: string | null;
  status_after: string | null;
  role: string | null;
  allowed: boolean;
  reason: string | null;
  message: string;
  error_code?: OperatorActionErrorCode;
  updated_at?: string;
}): ApprovalActionResult {
  return {
    ok: params.ok,
    action_id: params.action_id,
    audit_id: params.audit_id,
    action_type: params.action_type,
    target_type: "APPROVAL_REQUEST",
    target_id: params.target_id,
    status_before: params.status_before,
    status_after: params.status_after,
    permission: {
      allowed: params.allowed,
      role: params.role,
      reason: params.reason,
    },
    message: params.message,
    ...(params.error_code ? { error_code: params.error_code } : {}),
    updated_at: params.updated_at ?? nowIso(),
  };
}

function buildInternalBaseUrl(req: any): string {
  const proto = String((req.headers as any)?.["x-forwarded-proto"] ?? "http");
  const localPortRaw = Number((req.socket as any)?.localPort ?? 3000);
  const localPort = Number.isFinite(localPortRaw) && localPortRaw > 0 ? localPortRaw : 3000;
  return `${proto}://127.0.0.1:${localPort}`;
}

async function findApprovalRequest(pool: Pool, auth: AoActAuthContextV0, requestId: string): Promise<FactRow | null> {
  const res = await pool.query(
    `SELECT fact_id, occurred_at, record_json
       FROM facts
      WHERE (record_json::jsonb->>'type') = 'approval_request_v1'
        AND (record_json::jsonb->'payload'->>'request_id') = $1
        AND (record_json::jsonb->'payload'->>'tenant_id') = $2
        AND (record_json::jsonb->'payload'->>'project_id') = $3
        AND (record_json::jsonb->'payload'->>'group_id') = $4
      ORDER BY occurred_at DESC
      LIMIT 1`,
    [requestId, auth.tenant_id, auth.project_id, auth.group_id],
  );
  const row = res.rows?.[0];
  if (!row) return null;
  return {
    fact_id: String(row.fact_id ?? ""),
    occurred_at: String(row.occurred_at ?? ""),
    record_json: parseRecordJson(row.record_json),
  };
}

async function findLatestApprovalDecision(pool: Pool, auth: AoActAuthContextV0, requestId: string): Promise<FactRow | null> {
  const res = await pool.query(
    `SELECT fact_id, occurred_at, record_json
       FROM facts
      WHERE (record_json::jsonb->>'type') = 'approval_decision_v1'
        AND (record_json::jsonb->'payload'->>'request_id') = $1
        AND (record_json::jsonb->'payload'->>'tenant_id') = $2
        AND (record_json::jsonb->'payload'->>'project_id') = $3
        AND (record_json::jsonb->'payload'->>'group_id') = $4
      ORDER BY occurred_at DESC
      LIMIT 1`,
    [requestId, auth.tenant_id, auth.project_id, auth.group_id],
  );
  const row = res.rows?.[0];
  if (!row) return null;
  return {
    fact_id: String(row.fact_id ?? ""),
    occurred_at: String(row.occurred_at ?? ""),
    record_json: parseRecordJson(row.record_json),
  };
}

function isSelfApproval(auth: AoActAuthContextV0, payload: any): boolean {
  const requesterActorId = safeText(payload?.requested_by_actor_id ?? payload?.issuer?.id ?? payload?.created_by_actor_id ?? payload?.actor_id);
  const requesterTokenId = safeText(payload?.requested_by_token_id ?? payload?.created_by_token_id);
  return Boolean(
    (requesterActorId && requesterActorId === auth.actor_id)
    || (requesterTokenId && requesterTokenId === auth.token_id),
  );
}

async function writeAuditFact(pool: Pool, auth: AoActAuthContextV0, result: ApprovalActionResult): Promise<void> {
  const auditRecord = {
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
    [randomUUID(), "api/v1/operator/approvals/action", auditRecord],
  );
}

async function writeNonApproveDecisionFacts(params: {
  pool: Pool;
  auth: AoActAuthContextV0;
  requestPayload: any;
  requestId: string;
  decision: Exclude<OperatorApprovalDecision, "APPROVED">;
  actionType: Exclude<OperatorApprovalActionType, "APPROVAL_APPROVE">;
  note: string | null;
}): Promise<void> {
  const { pool, auth, requestPayload, requestId, decision, actionType, note } = params;
  const ts = Date.now();
  const updatedRequestRecord = {
    type: "approval_request_v1",
    payload: {
      ...requestPayload,
      tenant_id: auth.tenant_id,
      project_id: auth.project_id,
      group_id: auth.group_id,
      request_id: requestId,
      status: decision,
      operator_action_type: actionType,
      decided_at_ts: ts,
      decided_by_actor_id: auth.actor_id,
      decided_by_token_id: auth.token_id,
      operator_decision_note: note,
    },
  };
  const decisionRecord = {
    type: "approval_decision_v1",
    payload: {
      tenant_id: auth.tenant_id,
      project_id: auth.project_id,
      group_id: auth.group_id,
      decision_id: decisionId(),
      request_id: requestId,
      approval_request_id: requestId,
      approval_id: requestId,
      decision,
      act_task_id: null,
      ao_act_fact_id: null,
      actor_id: auth.actor_id,
      token_id: auth.token_id,
      role: auth.role,
      note,
      created_at_ts: ts,
      auto_task_issued: false,
      source: "operator_approval_action_v1",
    },
  };

  await pool.query("BEGIN");
  try {
    await pool.query(
      "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
      [randomUUID(), "api/v1/operator/approvals/action", updatedRequestRecord],
    );
    await pool.query(
      "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
      [randomUUID(), "api/v1/operator/approvals/action", decisionRecord],
    );
    await pool.query("COMMIT");
  } catch (err) {
    await pool.query("ROLLBACK");
    throw err;
  }
}

async function callMainApprovalApprove(req: any, requestId: string): Promise<{ ok: boolean; status: number; body: any }> {
  const resp = await fetch(`${buildInternalBaseUrl(req)}/api/v1/approvals/approve`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": String((req.headers as any)["authorization"] ?? ""),
    },
    body: JSON.stringify({
      ...((req.body ?? {}) as Record<string, unknown>),
      request_id: requestId,
    }),
  });
  const body = await resp.json().catch(() => null);
  return { ok: resp.ok && Boolean(body?.ok), status: resp.status, body };
}

function mapMainApprovalError(value: unknown): OperatorActionErrorCode {
  const raw = safeText(value).toUpperCase();
  if (raw.includes("SELF")) return "SELF_APPROVAL_BLOCKED";
  if (raw.includes("NOT_FOUND")) return "TARGET_NOT_FOUND";
  if (raw.includes("ROLE") || raw.includes("SCOPE") || raw.includes("FORBIDDEN") || raw.includes("DENIED")) return "FORBIDDEN";
  if (raw.includes("NOT_PENDING") || raw.includes("INVALID")) return "INVALID_STATE";
  return "STATE_WRITE_FAILED";
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

async function sendFailure(reply: any, pool: Pool, auth: AoActAuthContextV0, result: ApprovalActionResult): Promise<void> {
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

async function handleOperatorApprovalAction(req: any, reply: any, pool: Pool, config: {
  actionType: OperatorApprovalActionType;
  decision: OperatorApprovalDecision;
  successMessage: string;
}): Promise<void> {
  const auth = requireAoActAnyScopeV0(req, reply, ["approval.decide"]);
  if (!auth) return;

  const requestId = safeText((req.params as any)?.approvalRequestId);
  const aid = actionId();
  const auid = auditId();
  const role = safeText(auth.role) || null;
  const note = safeText((req.body as any)?.note) || null;

  if (!requestId) {
    const result = buildResponse({
      ok: false,
      action_id: aid,
      audit_id: auid,
      action_type: config.actionType,
      target_id: "",
      status_before: null,
      status_after: null,
      role,
      allowed: false,
      reason: "缺少审批请求标识。",
      message: "缺少审批请求标识。",
      error_code: "TARGET_NOT_FOUND",
    });
    return sendFailure(reply, pool, auth, result);
  }

  const requestFact = await findApprovalRequest(pool, auth, requestId);
  if (!requestFact?.record_json?.payload) {
    const result = buildResponse({
      ok: false,
      action_id: aid,
      audit_id: auid,
      action_type: config.actionType,
      target_id: requestId,
      status_before: null,
      status_after: null,
      role,
      allowed: false,
      reason: "审批请求不存在或不在当前权限范围内。",
      message: "审批请求不存在或不在当前权限范围内。",
      error_code: "TARGET_NOT_FOUND",
    });
    return sendFailure(reply, pool, auth, result);
  }

  const payload = requestFact.record_json.payload;
  const latestDecision = await findLatestApprovalDecision(pool, auth, requestId);
  const statusBefore = normalizeStatus(latestDecision?.record_json?.payload?.decision ?? payload.status);

  if (!roleAllowsApproval(auth.role)) {
    const result = buildResponse({
      ok: false,
      action_id: aid,
      audit_id: auid,
      action_type: config.actionType,
      target_id: requestId,
      status_before: statusBefore,
      status_after: statusBefore,
      role,
      allowed: false,
      reason: "当前角色无审批权限。",
      message: "当前角色无审批权限。",
      error_code: "FORBIDDEN",
    });
    return sendFailure(reply, pool, auth, result);
  }

  if (isSelfApproval(auth, payload)) {
    const result = buildResponse({
      ok: false,
      action_id: aid,
      audit_id: auid,
      action_type: config.actionType,
      target_id: requestId,
      status_before: statusBefore,
      status_after: statusBefore,
      role,
      allowed: false,
      reason: "存在自审批风险，审批动作已阻断。",
      message: "存在自审批风险，审批动作已阻断。",
      error_code: "SELF_APPROVAL_BLOCKED",
    });
    return sendFailure(reply, pool, auth, result);
  }

  if (!isPendingStatus(statusBefore)) {
    const result = buildResponse({
      ok: false,
      action_id: aid,
      audit_id: auid,
      action_type: config.actionType,
      target_id: requestId,
      status_before: statusBefore,
      status_after: statusBefore,
      role,
      allowed: false,
      reason: "审批请求当前状态不可再次处理。",
      message: "审批请求当前状态不可再次处理。",
      error_code: "INVALID_STATE",
    });
    return sendFailure(reply, pool, auth, result);
  }

  if (config.actionType === "APPROVAL_APPROVE") {
    const main = await callMainApprovalApprove(req, requestId);
    if (!main.ok) {
      const errorCode = mapMainApprovalError(main.body?.error ?? main.body?.message);
      const failure = buildResponse({
        ok: false,
        action_id: aid,
        audit_id: auid,
        action_type: config.actionType,
        target_id: requestId,
        status_before: statusBefore,
        status_after: statusBefore,
        role,
        allowed: errorCode !== "FORBIDDEN" && errorCode !== "SELF_APPROVAL_BLOCKED",
        reason: safeText(main.body?.error ?? main.body?.message) || "主审批链处理失败。",
        message: safeText(main.body?.error ?? main.body?.message) || "主审批链处理失败。",
        error_code: errorCode,
      });
      return sendFailure(reply, pool, auth, failure);
    }

    const success = buildResponse({
      ok: true,
      action_id: aid,
      audit_id: auid,
      action_type: config.actionType,
      target_id: requestId,
      status_before: statusBefore,
      status_after: "APPROVED",
      role,
      allowed: true,
      reason: null,
      message: config.successMessage,
    });
    try {
      await writeAuditFact(pool, auth, success);
    } catch {
      const auditFailed = buildResponse({
        ok: false,
        action_id: aid,
        audit_id: auid,
        action_type: config.actionType,
        target_id: requestId,
        status_before: statusBefore,
        status_after: "APPROVED",
        role,
        allowed: false,
        reason: "审批已进入主链，但审计写入失败。",
        message: "审批已进入主链，但审计写入失败。",
        error_code: "AUDIT_WRITE_FAILED",
      });
      return reply.status(500).send(auditFailed);
    }
    return reply.send(success);
  }

  const success = buildResponse({
    ok: true,
    action_id: aid,
    audit_id: auid,
    action_type: config.actionType,
    target_id: requestId,
    status_before: statusBefore,
    status_after: config.decision,
    role,
    allowed: true,
    reason: null,
    message: config.successMessage,
  });

  try {
    await writeAuditFact(pool, auth, success);
  } catch {
    const result = buildResponse({
      ok: false,
      action_id: aid,
      audit_id: auid,
      action_type: config.actionType,
      target_id: requestId,
      status_before: statusBefore,
      status_after: statusBefore,
      role,
      allowed: false,
      reason: "审计写入失败，动作未执行。",
      message: "审计写入失败，动作未执行。",
      error_code: "AUDIT_WRITE_FAILED",
    });
    return reply.status(500).send(result);
  }

  try {
    await writeNonApproveDecisionFacts({
      pool,
      auth,
      requestPayload: payload,
      requestId,
      decision: config.decision as Exclude<OperatorApprovalDecision, "APPROVED">,
      actionType: config.actionType as Exclude<OperatorApprovalActionType, "APPROVAL_APPROVE">,
      note,
    });
  } catch {
    const result = buildResponse({
      ok: false,
      action_id: aid,
      audit_id: auid,
      action_type: config.actionType,
      target_id: requestId,
      status_before: statusBefore,
      status_after: statusBefore,
      role,
      allowed: true,
      reason: "状态写入失败，请刷新后重试。",
      message: "状态写入失败，请刷新后重试。",
      error_code: "STATE_WRITE_FAILED",
    });
    return reply.status(500).send(result);
  }

  return reply.send(success);
}

export function registerOperatorApprovalActionRoutes(app: FastifyInstance, pool: Pool): void {
  app.post("/api/v1/operator/approvals/:approvalRequestId/approve", async (req, reply) => handleOperatorApprovalAction(req, reply, pool, {
    actionType: "APPROVAL_APPROVE",
    decision: "APPROVED",
    successMessage: "审批已通过。",
  }));

  app.post("/api/v1/operator/approvals/:approvalRequestId/reject", async (req, reply) => handleOperatorApprovalAction(req, reply, pool, {
    actionType: "APPROVAL_REJECT",
    decision: "REJECTED",
    successMessage: "审批已拒绝。",
  }));

  app.post("/api/v1/operator/approvals/:approvalRequestId/return", async (req, reply) => handleOperatorApprovalAction(req, reply, pool, {
    actionType: "APPROVAL_RETURN",
    decision: "RETURNED",
    successMessage: "审批已退回补充。",
  }));
}
