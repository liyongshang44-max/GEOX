import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAoActAnyScopeV0, type AoActAuthContextV0 } from "../../auth/ao_act_authz_v0.js";

type ApprovalReadRow = {
  approval_request_id: string;
  request_id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "RETURNED" | "UNKNOWN";
  title: string;
  description: string;
  field_name: string | null;
  operation_name: string | null;
  operation_id: string | null;
  operation_plan_id: string | null;
  prescription_id: string | null;
  recommendation_id: string | null;
  risk_level: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  requested_by: string | null;
  requested_by_actor_id: string | null;
  approver_id: string | null;
  updated_at: string | null;
  created_at: string | null;
  self_approval_risk: boolean;
  permission: {
    allowed: boolean;
    role: string | null;
    reason: string | null;
  };
  can_approve: boolean;
  permission_reason: string | null;
};

type FactRow = {
  fact_id: string;
  occurred_at: string;
  record_json: any;
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

function nullableText(value: unknown): string | null {
  return safeText(value) || null;
}

function normalizeStatus(value: unknown): ApprovalReadRow["status"] {
  const raw = safeText(value).toUpperCase();
  if (raw === "APPROVE") return "APPROVED";
  if (raw === "APPROVED") return "APPROVED";
  if (raw === "REJECT") return "REJECTED";
  if (raw === "REJECTED" || raw === "DENIED") return "REJECTED";
  if (raw === "RETURN" || raw === "RETURNED" || raw === "NEEDS_CHANGES") return "RETURNED";
  if (raw === "PENDING" || raw === "OPEN" || raw === "WAITING" || raw === "REQUESTED") return "PENDING";
  return "UNKNOWN";
}

function normalizeRisk(value: unknown): ApprovalReadRow["risk_level"] {
  const raw = safeText(value).toUpperCase();
  if (raw === "HIGH" || raw.includes("高")) return "HIGH";
  if (raw === "MEDIUM" || raw.includes("中")) return "MEDIUM";
  if (raw === "LOW" || raw.includes("低")) return "LOW";
  return "UNKNOWN";
}

function roleAllowsApproval(role: unknown): boolean {
  const normalized = safeText(role).toLowerCase();
  return normalized === "admin" || normalized === "approver";
}

function toIso(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return new Date(value).toISOString();
  const text = safeText(value);
  if (!text) return null;
  const ms = Date.parse(text);
  if (Number.isFinite(ms) && ms > 0) return new Date(ms).toISOString();
  return null;
}

async function readApprovalRequestFacts(pool: Pool, auth: AoActAuthContextV0, limit: number): Promise<FactRow[]> {
  const result = await pool.query(
    `SELECT fact_id, occurred_at, record_json
       FROM facts
      WHERE (record_json::jsonb->>'type') = 'approval_request_v1'
        AND (record_json::jsonb->'payload'->>'tenant_id') = $1
        AND (record_json::jsonb->'payload'->>'project_id') = $2
        AND (record_json::jsonb->'payload'->>'group_id') = $3
      ORDER BY occurred_at DESC
      LIMIT $4`,
    [auth.tenant_id, auth.project_id, auth.group_id, limit],
  );
  return (result.rows ?? []).map((row: any) => ({
    fact_id: String(row.fact_id ?? ""),
    occurred_at: String(row.occurred_at ?? ""),
    record_json: parseRecordJson(row.record_json),
  }));
}

async function readLatestDecisionByRequest(pool: Pool, auth: AoActAuthContextV0, requestIds: string[]): Promise<Map<string, FactRow>> {
  if (requestIds.length < 1) return new Map();
  const result = await pool.query(
    `SELECT DISTINCT ON (record_json::jsonb->'payload'->>'request_id') fact_id, occurred_at, record_json
       FROM facts
      WHERE (record_json::jsonb->>'type') = 'approval_decision_v1'
        AND (record_json::jsonb->'payload'->>'tenant_id') = $1
        AND (record_json::jsonb->'payload'->>'project_id') = $2
        AND (record_json::jsonb->'payload'->>'group_id') = $3
        AND (record_json::jsonb->'payload'->>'request_id') = ANY($4::text[])
      ORDER BY record_json::jsonb->'payload'->>'request_id', occurred_at DESC`,
    [auth.tenant_id, auth.project_id, auth.group_id, requestIds],
  );
  const out = new Map<string, FactRow>();
  for (const row of result.rows ?? []) {
    const parsed = parseRecordJson(row.record_json);
    const requestId = safeText(parsed?.payload?.request_id);
    if (!requestId) continue;
    out.set(requestId, {
      fact_id: String(row.fact_id ?? ""),
      occurred_at: String(row.occurred_at ?? ""),
      record_json: parsed,
    });
  }
  return out;
}

function isSelfApproval(auth: AoActAuthContextV0, payload: any): boolean {
  const requesterActorId = safeText(payload?.requested_by_actor_id ?? payload?.issuer?.id ?? payload?.created_by_actor_id ?? payload?.actor_id);
  const requesterTokenId = safeText(payload?.requested_by_token_id ?? payload?.created_by_token_id);
  return Boolean(
    (requesterActorId && requesterActorId === auth.actor_id)
    || (requesterTokenId && requesterTokenId === auth.token_id),
  );
}

function buildPermission(auth: AoActAuthContextV0, status: ApprovalReadRow["status"], selfApprovalRisk: boolean): ApprovalReadRow["permission"] {
  if (!roleAllowsApproval(auth.role)) {
    return { allowed: false, role: safeText(auth.role) || null, reason: "当前角色无审批权限。" };
  }
  if (selfApprovalRisk) {
    return { allowed: false, role: safeText(auth.role) || null, reason: "存在自审批风险，审批动作已阻断。" };
  }
  if (status !== "PENDING") {
    return { allowed: false, role: safeText(auth.role) || null, reason: "审批请求当前状态不可再次处理。" };
  }
  return { allowed: true, role: safeText(auth.role) || null, reason: null };
}

function buildApprovalRow(auth: AoActAuthContextV0, requestFact: FactRow, decisionFact: FactRow | null): ApprovalReadRow | null {
  const payload = requestFact.record_json?.payload ?? null;
  if (!payload) return null;
  const requestId = safeText(payload.request_id ?? payload.approval_request_id);
  if (!requestId) return null;
  const proposal = payload.proposal ?? {};
  const decisionPayload = decisionFact?.record_json?.payload ?? null;
  const status = normalizeStatus(decisionPayload?.decision ?? payload.status);
  const selfApprovalRisk = isSelfApproval(auth, payload);
  const permission = buildPermission(auth, status, selfApprovalRisk);
  const title = safeText(payload.title ?? proposal.title ?? proposal.action_type ?? "审批事项") || "审批事项";
  const description = safeText(payload.description ?? payload.reason ?? proposal.reason ?? proposal.summary ?? "建议或处方等待运营审批。") || "建议或处方等待运营审批。";
  const requestedByActorId = nullableText(payload.requested_by_actor_id ?? payload.issuer?.id ?? payload.actor_id);

  return {
    approval_request_id: requestId,
    request_id: requestId,
    status,
    title,
    description,
    field_name: nullableText(payload.field_name ?? proposal.field_name),
    operation_name: nullableText(payload.operation_name ?? proposal.operation_name ?? proposal.action_type),
    operation_id: nullableText(payload.operation_id ?? proposal.operation_id),
    operation_plan_id: nullableText(payload.operation_plan_id ?? proposal.operation_plan_id ?? proposal.meta?.operation_plan_id),
    prescription_id: nullableText(payload.prescription_id ?? proposal.prescription_id ?? proposal.meta?.prescription_id),
    recommendation_id: nullableText(payload.recommendation_id ?? proposal.recommendation_id ?? proposal.meta?.recommendation_id),
    risk_level: normalizeRisk(payload.risk_level ?? proposal.risk_level ?? proposal.risk?.level ?? payload.priority),
    requested_by: nullableText(payload.requested_by_name ?? payload.requester_name ?? requestedByActorId),
    requested_by_actor_id: requestedByActorId,
    approver_id: nullableText(decisionPayload?.actor_id ?? payload.approved_by_actor_id ?? payload.decided_by_actor_id),
    updated_at: toIso(decisionFact?.occurred_at ?? payload.decided_at_ts ?? payload.approved_at_ts ?? requestFact.occurred_at),
    created_at: toIso(payload.created_at ?? payload.created_at_ts ?? requestFact.occurred_at),
    self_approval_risk: selfApprovalRisk,
    permission,
    can_approve: permission.allowed,
    permission_reason: permission.reason,
  };
}

function parseLimit(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 100;
  return Math.min(Math.floor(n), 300);
}

export function registerOperatorApprovalReadRoutes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/operator/approvals", async (req, reply) => {
    const auth = requireAoActAnyScopeV0(req, reply, ["approval.read", "approval.decide", "ao_act.index.read"]);
    if (!auth) return;
    const limit = parseLimit((req.query as any)?.limit);
    const requestFacts = await readApprovalRequestFacts(pool, auth, limit);
    const requestIds = Array.from(new Set(requestFacts.map((fact) => safeText(fact.record_json?.payload?.request_id)).filter(Boolean)));
    const decisions = await readLatestDecisionByRequest(pool, auth, requestIds);
    const items = requestFacts
      .map((fact) => buildApprovalRow(auth, fact, decisions.get(safeText(fact.record_json?.payload?.request_id)) ?? null))
      .filter((item): item is ApprovalReadRow => Boolean(item));

    return reply.send({
      source: "operator_approvals_api",
      dataScope: "OFFICIAL_OPERATOR_API",
      generated_at: new Date().toISOString(),
      items,
      writeReady: true,
      message: "Operator approval actions are controlled by backend permission.allowed.",
    });
  });
}
