// GEOX/apps/server/src/routes/control_approval_request_v1.ts

import type { FastifyInstance } from "fastify"; // Fastify instance typing.
import type { Pool } from "pg"; // Postgres pool typing.
import { randomUUID } from "node:crypto"; // Generate UUIDs for request/decision ids.

import { requireAoActAnyScopeV0, requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js"; // Reuse AO-ACT token/scope auth for Sprint 25 approval runtime.
import {
  assertTenantTriple,
  createApprovalRequestV1,
  requireTenantMatchOr404,
} from "../domain/approval/approval_request_service_v1.js";

type TenantTriple = {
  tenant_id: string; // Tenant isolation SSOT field.
  project_id: string; // Project isolation SSOT field.
  group_id: string; // Group isolation SSOT field.
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0; // Non-empty string guard.
}

function badRequest(reply: any, error: string) {
  return reply.status(400).send({ ok: false, error }); // Deterministic 400 shape.
}
function requireApprovalDeciderRoleV1(reply: any, auth: any): boolean {
  const role = String(auth?.role ?? "").trim();
  if (role === "approver" || role === "admin") return true;
  reply.status(403).send({ ok: false, error: "ROLE_APPROVER_REQUIRED" });
  return false;
}

function parseLimit(v: any, def: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n) || Math.floor(n) !== n) return def;
  if (n <= 0) return def;
  return Math.min(n, max);
}

function normalizeAoActIssuer(auth: any, proposalIssuer: any): any {
  // AO-ACT contract requires issuer as an object {kind:'human', id, namespace}.
  // We bind issuer.id to the authenticated actor_id for auditability; proposalIssuer is kept only as proposal text.
  const id = String(auth?.actor_id ?? auth?.token_id ?? "unknown").trim() || "unknown";
  return { kind: "human", id, namespace: "approval_request_v1" };
}

function normalizeAoActTarget(proposalTarget: any): any {
  // Accept "field:XYZ" / "area:XYZ" / "path:XYZ" strings; fallback to kind='field'.
  const s = String(proposalTarget ?? "").trim();
  const m = /^([a-zA-Z]+)\:(.+)$/.exec(s);
  if (m) {
    const k = m[1].toLowerCase();
    const ref = String(m[2]).trim();
    const kind = (k === "field" || k === "area" || k === "path") ? k : "field";
    return { kind, ref: ref || s };
  }
  // If already object-like, try to preserve.
  if (proposalTarget && typeof proposalTarget === "object") {
    const kind = String((proposalTarget as any).kind ?? "field");
    const ref = String((proposalTarget as any).ref ?? "");
    if (ref.trim()) return { kind, ref: ref.trim() };
  }
  return { kind: "field", ref: s || "unknown" };
}

function normalizeAoActParameterSchema(parameters: any, proposalSchema: any): any {
  // AO-ACT contract requires parameter_schema.keys as array of {name,type,...}.
  // We derive from parameters when possible; if proposalSchema already matches, pass through.
  const keysFromProposal = proposalSchema?.keys;
  if (Array.isArray(keysFromProposal) && keysFromProposal.length > 0 && typeof keysFromProposal[0] === "object") {
    return { keys: keysFromProposal };
  }
  const paramsObj = (parameters && typeof parameters === "object") ? parameters : {};
  const keys: any[] = [];
  for (const [name, v] of Object.entries(paramsObj)) {
    if (!String(name).trim()) continue;
    const t = typeof v;
    if (t === "number") keys.push({ name, type: "number" });
    else if (t === "boolean") keys.push({ name, type: "boolean" });
    else keys.push({ name, type: "enum", enum: [String(v)] });
  }
  if (keys.length < 1) {
    // Minimal fallback to satisfy schema; parameters should have been non-empty upstream.
    keys.push({ name: "dry_run", type: "boolean" });
  }
  return { keys };
}

function normalizeAoActConstraints(c: any): any {
  // AO-ACT contract expects constraints as object map; approval_request may store array.
  if (c && typeof c === "object" && !Array.isArray(c)) return c;
  return {};
}

function normalizeAoActMeta(m: any): any {
  // AO-ACT contract expects meta as object when provided.
  if (m && typeof m === "object" && !Array.isArray(m)) return m;
  return {};
}


function normalizePrimitiveParameters(input: any): Record<string, number | boolean | string> {
  const out: Record<string, number | boolean | string> = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  for (const [k, v] of Object.entries(input)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "boolean") out[k] = v;
    else if (typeof v === "string") out[k] = v;
  }
  return out;
}

function parseRecordJsonMaybe(v: any): any {
  // pg may return jsonb as string depending on type parser configuration; accept both.
  if (v && typeof v === "object") return v;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return null; }
  }
  return null;
}

function buildInternalBaseUrl(req: any): string {
  const proto = String((req.headers as any)?.["x-forwarded-proto"] ?? "http"); // Prefer forwarded proto when present.
  const localPortRaw = Number((req.socket as any)?.localPort ?? 3000); // Actual listener port on this process/container.
  const localPort = Number.isFinite(localPortRaw) && localPortRaw > 0 ? localPortRaw : 3000; // Safe fallback.
  return `${proto}://127.0.0.1:${localPort}`; // Loop back into the same server instance.
}


function logLegacyApprovalWarning(req: any, legacyPath: string): void {
  try {
    req.log?.warn?.({
      path: legacyPath,
      method: String(req?.method ?? ""),
      actor_id: String((req as any)?.auth?.actor_id ?? ""),
      token_id: String((req as any)?.auth?.token_id ?? ""),
      warning: "deprecated legacy approval API used"
    }, "deprecated legacy approval API used");
  } catch {
    // ignore logging failures on compatibility path
  }
}

async function handleApprovalRequest(req: any, reply: any, pool: Pool) {
  try {
    const auth = requireAoActAnyScopeV0(req, reply, ["approval.request", "prescription.submit_approval", "ao_act.task.write"]);
    if (!auth) return;
    (req as any).auth = auth;

    const body: any = req.body ?? {};
    const tenant = assertTenantTriple(body);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const created = await createApprovalRequestV1(pool, auth, body);
    return reply.send(created);
  } catch (e: any) {
    return reply.status(400).send({ ok: false, error: e?.message ?? "BAD_REQUEST" });
  }
}

async function handleApprovalRequestsList(req: any, reply: any, pool: Pool) {
  const auth = requireAoActAnyScopeV0(req, reply, ["approval.read", "ao_act.index.read"]);
  if (!auth) return;
  (req as any).auth = auth;

  const q: any = (req as any).query ?? {};
  const tenant: TenantTriple = {
    tenant_id: isNonEmptyString(q.tenant_id) ? q.tenant_id : "",
    project_id: isNonEmptyString(q.project_id) ? q.project_id : "",
    group_id: isNonEmptyString(q.group_id) ? q.group_id : ""
  };
  if (!tenant.tenant_id || !tenant.project_id || !tenant.group_id) return badRequest(reply, "MISSING_TENANT_TRIPLE");
  if (!requireTenantMatchOr404(auth, tenant, reply)) return;

  const limit = parseLimit(q.limit, 20, 200);
  const sql = `
    SELECT fact_id, occurred_at, source, record_json
    FROM facts
    WHERE (record_json::jsonb->>'type') = 'approval_request_v1'
      AND (record_json::jsonb->'payload'->>'tenant_id') = $1
      AND (record_json::jsonb->'payload'->>'project_id') = $2
      AND (record_json::jsonb->'payload'->>'group_id') = $3
    ORDER BY occurred_at DESC
    LIMIT $4
  `;
  const res = await pool.query(sql, [tenant.tenant_id, tenant.project_id, tenant.group_id, limit]);
  const items = (res.rows ?? []).map((r: any) => ({
    fact_id: r.fact_id,
    occurred_at: r.occurred_at,
    source: r.source,
    record_json: parseRecordJsonMaybe(r.record_json) ?? r.record_json
  }));

  return reply.send({ ok: true, items });
}

async function handleApprovalApprove(req: any, reply: any, pool: Pool) {
  try {
    const auth = requireAoActAnyScopeV0(req, reply, ["approval.decide", "ao_act.task.write"]);
    if (!auth) return;
    (req as any).auth = auth;
    if (!requireApprovalDeciderRoleV1(reply, auth)) return;

    const body: any = req.body ?? {};
    if (!isNonEmptyString(body.request_id)) return badRequest(reply, "MISSING_OR_INVALID:request_id");
    const request_id = body.request_id;

    const res = await pool.query(`
      SELECT fact_id, record_json
      FROM facts
      WHERE (record_json::jsonb->>'type') = 'approval_request_v1'
        AND (record_json::jsonb->'payload'->>'request_id') = $1
        AND (record_json::jsonb->'payload'->>'tenant_id') = $2
        AND (record_json::jsonb->'payload'->>'project_id') = $3
        AND (record_json::jsonb->'payload'->>'group_id') = $4
      ORDER BY occurred_at DESC
      LIMIT 1
    `, [request_id, auth.tenant_id, auth.project_id, auth.group_id]);
    if (!res.rows || res.rows.length < 1) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });

    const rec = parseRecordJsonMaybe(res.rows[0].record_json);
    const payload = rec?.payload ?? null;
    if (!payload) return reply.status(500).send({ ok: false, error: "REQUEST_RECORD_INVALID" });

    const tenant: TenantTriple = {
      tenant_id: String(payload.tenant_id ?? ""),
      project_id: String(payload.project_id ?? ""),
      group_id: String(payload.group_id ?? "")
    };
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    if (String(payload.status ?? "") !== "PENDING") return badRequest(reply, "REQUEST_NOT_PENDING");
    const requesterActorId = String(payload?.requested_by_actor_id ?? payload?.issuer?.id ?? payload?.created_by_actor_id ?? payload?.actor_id ?? "").trim();
    const requesterTokenId = String(payload?.requested_by_token_id ?? payload?.created_by_token_id ?? "").trim();
    if ((requesterActorId && requesterActorId === auth.actor_id) || (requesterTokenId && requesterTokenId === auth.token_id)) {
      return reply.status(403).send({ ok: false, error: "APPROVAL_SELF_APPROVAL_DENIED" });
    }

    const proposal = payload.proposal ?? null;
    if (!proposal) return reply.status(500).send({ ok: false, error: "REQUEST_RECORD_INVALID" });

    const approvedRequestRecord = {
      type: "approval_request_v1",
      payload: {
        ...payload,
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        program_id: String(body.program_id ?? body.meta?.program_id ?? payload.program_id ?? "").trim() || null,
        field_id: body.field_id ?? body.meta?.field_id ?? body.target?.ref ?? null,
        season_id: body.season_id ?? body.meta?.season_id ?? null,
        request_id,
        status: "APPROVED",
        approved_at_ts: Date.now(),
        approved_by_actor_id: auth.actor_id,
        approved_by_token_id: auth.token_id
      }
    };
    await pool.query(
      "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
      [randomUUID(), "api/v1/approvals/approve", approvedRequestRecord]
    );

    const decision_id = `apd_${randomUUID().replace(/-/g, "")}`;
    const allowAutoTaskIssue = Boolean(proposal?.meta?.allow_auto_task_issue === true);
    const skipAutoTaskIssue = Boolean(proposal?.meta?.skip_auto_task_issue === true);
    if (!skipAutoTaskIssue && !allowAutoTaskIssue) {
      return reply.status(403).send({ ok: false, error: "AUTO_TASK_ISSUE_NOT_ALLOWED" });
    }
    if (skipAutoTaskIssue) {
      const decision_fact_id = randomUUID();
      const decision_record = {
        type: "approval_decision_v1",
        payload: {
          tenant_id: tenant.tenant_id,
          project_id: tenant.project_id,
          group_id: tenant.group_id,
          decision_id,
          request_id,
          approval_request_id: request_id,
          approval_id: request_id,
          decision: "APPROVED",
          act_task_id: null,
          ao_act_fact_id: null,
          actor_id: auth.actor_id,
          token_id: auth.token_id,
          created_at_ts: Date.now(),
          auto_task_issued: false,
        }
      };
      await pool.query(
        "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
        [decision_fact_id, "api/v1/approvals/approve", decision_record]
      );
      return reply.send({ ok: true, request_id, decision_id, decision: "APPROVED", auto_task_issue_skipped: true, act_task_id: null, ao_act_fact_id: null });
    }

    const operationPlanId =
      String(payload.operation_plan_id ?? proposal?.meta?.operation_plan_id ?? proposal?.parameters?.operation_plan_id ?? "").trim()
      || `opl_${request_id}`;
    const programId = String(body.program_id ?? proposal?.meta?.program_id ?? "").trim();
    const primitiveParameters = normalizePrimitiveParameters(proposal?.parameters);
    const parameterSchema = normalizeAoActParameterSchema(primitiveParameters, null);
    const aoActBody = {
      tenant_id: tenant.tenant_id,
      project_id: tenant.project_id,
      group_id: tenant.group_id,
      operation_plan_id: operationPlanId,
      approval_request_id: request_id,
      ...(programId ? { program_id: programId } : {}),
      field_id: payload.field_id ?? proposal?.meta?.field_id ?? proposal?.target?.ref ?? null,
      season_id: payload.season_id ?? proposal?.meta?.season_id ?? null,
      issuer: normalizeAoActIssuer(auth, proposal.issuer),
      action_type: proposal.action_type,
      target: normalizeAoActTarget(proposal.target),
      time_window: proposal.time_window,
      parameter_schema: parameterSchema,
      parameters: primitiveParameters,
      constraints: normalizeAoActConstraints(proposal.constraints),
      meta: normalizeAoActMeta(proposal.meta)
    };

    const aoResp = await fetch(`${buildInternalBaseUrl(req)}/api/v1/actions/task`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": String((req.headers as any)["authorization"] ?? "")
      },
      body: JSON.stringify(aoActBody)
    });
    const aoJson: any = await aoResp.json().catch(() => null);
    if (!aoResp.ok || !aoJson?.ok) {
      return reply.status(400).send({ ok: false, error: "AO_ACT_TASK_ISSUE_FAILED", detail: aoJson ?? null });
    }

    const act_task_id = String(aoJson.act_task_id ?? "");
    const ao_fact_id = String(aoJson.fact_id ?? "");
    const created_at_ts = Date.now();
    const decision_record = {
      type: "approval_decision_v1",
      payload: {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        decision_id,
        request_id,
        approval_request_id: request_id,
        approval_id: request_id,
        decision: "APPROVED",
        act_task_id,
        ao_act_fact_id: ao_fact_id,
        actor_id: auth.actor_id,
        token_id: auth.token_id,
        created_at_ts,
        auto_task_issued: true
      }
    };

    const decision_fact_id = randomUUID();
    await pool.query(
      "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
      [decision_fact_id, "api/v1/approvals/approve", decision_record]
    );

    return reply.send({ ok: true, request_id, decision_id, act_task_id, ao_act_fact_id: ao_fact_id, decision_fact_id });
  } catch (e: any) {
    return reply.status(400).send({ ok: false, error: e?.message ?? "BAD_REQUEST" });
  }
}

export function registerApprovalRequestV1Routes(app: FastifyInstance, pool: Pool) {
  app.post("/api/v1/approvals/request", async (req, reply) => handleApprovalRequest(req, reply, pool));
  app.get("/api/v1/approvals/requests", async (req, reply) => handleApprovalRequestsList(req, reply, pool));
  app.post("/api/v1/approvals/approve", async (req, reply) => {
    const request_id = String(((req as any).body ?? {}).request_id ?? "").trim();
    if (!request_id) return badRequest(reply, "MISSING_OR_INVALID:request_id");
    return handleApprovalApprove(req, reply, pool);
  });
  registerDeprecatedApprovalRequestAliases(app, pool);
}

export function registerApprovalRequestLegacyRoutes(app: FastifyInstance, pool: Pool) {
  // POST /api/control/approval_request/v1/request
  // @deprecated - use /api/v1/approvals/*
  app.post("/api/control/approval_request/v1/request", async (req, reply) => {
    reply.header("X-Deprecated", "true");
    logLegacyApprovalWarning(req, "/api/control/approval_request/v1/request");
    return handleApprovalRequest(req, reply, pool);
  });

  // GET /api/control/approval_request/v1/requests
  // @deprecated - use /api/v1/approvals/*
  app.get("/api/control/approval_request/v1/requests", async (req, reply) => {
    reply.header("X-Deprecated", "true");
    logLegacyApprovalWarning(req, "/api/control/approval_request/v1/requests");
    return handleApprovalRequestsList(req, reply, pool);
  });

  // POST /api/control/approval_request/v1/approve
  // @deprecated - use /api/v1/approvals/*
  app.post("/api/control/approval_request/v1/approve", async (req, reply) => {
    reply.header("X-Deprecated", "true");
    logLegacyApprovalWarning(req, "/api/control/approval_request/v1/approve");
    return handleApprovalApprove(req, reply, pool);
  });
}

export function registerControlApprovalRequestV1Routes(app: FastifyInstance, pool: Pool) {
  registerApprovalRequestV1Routes(app, pool);
  registerApprovalRequestLegacyRoutes(app, pool);
}

// @deprecated - use /api/v1/approvals/*
export function registerDeprecatedApprovalRequestAliases(app: FastifyInstance, pool: Pool) {
  app.post("/api/v1/approval-requests", async (req, reply) => {
    reply.header("X-Deprecated", "true");
    return handleApprovalRequest(req, reply, pool);
  });
  app.get("/api/v1/approval-requests", async (req, reply) => {
    reply.header("X-Deprecated", "true");
    return handleApprovalRequestsList(req, reply, pool);
  });
  app.post("/api/v1/approval-requests/:request_id/approve", async (req, reply) => {
    reply.header("X-Deprecated", "true");
    const request_id = String((req.params as any)?.request_id ?? "").trim();
    if (!request_id) return badRequest(reply, "MISSING_OR_INVALID:request_id");
    (req as any).body = { ...((req as any).body ?? {}), request_id };
    return handleApprovalApprove(req, reply, pool);
  });
}
