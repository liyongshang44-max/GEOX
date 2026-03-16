import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";

import { requireAoActAdminV0, requireAoActScopeV0, type AoActAuthContextV0 } from "../auth/ao_act_authz_v0";

type TenantTriple = {
  tenant_id: string;
  project_id: string;
  group_id: string;
};

type OperationPlanStatus = "DRAFT" | "READY" | "APPROVAL_PENDING" | "TASK_CREATED" | "REJECTED" | "ARCHIVED";

let ensureOperationPlanPromise: Promise<void> | null = null;

function hostBaseUrl(req: FastifyRequest): string {
  const proto = String((req.headers as any)?.["x-forwarded-proto"] ?? "http");
  const localPortRaw = Number((req.socket as any)?.localPort ?? 3000);
  const localPort = Number.isFinite(localPortRaw) && localPortRaw > 0 ? localPortRaw : 3000;
  return `${proto}://127.0.0.1:${localPort}`;
}

function parseJsonMaybe(v: any): any {
  if (v && typeof v === "object") return v;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return null; }
  }
  return null;
}

function badRequest(reply: FastifyReply, error: string) {
  return reply.status(400).send({ ok: false, error });
}

function notFound(reply: FastifyReply) {
  return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
}

function parseLimit(v: any, def = 20, max = 200): number {
  const n = Number(v);
  if (!Number.isFinite(n) || Math.floor(n) !== n) return def;
  return Math.max(1, Math.min(max, n));
}

function tenantFromAuth(auth: AoActAuthContextV0): TenantTriple {
  return {
    tenant_id: auth.tenant_id,
    project_id: auth.project_id,
    group_id: auth.group_id,
  };
}

function requireTenantMatchOr404(auth: AoActAuthContextV0, tenant: TenantTriple, reply: FastifyReply): boolean {
  if (auth.tenant_id !== tenant.tenant_id || auth.project_id !== tenant.project_id || auth.group_id !== tenant.group_id) {
    reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return false;
  }
  return true;
}

async function ensureOperationPlanProjection(pool: Pool): Promise<void> {
  if (!ensureOperationPlanPromise) {
    ensureOperationPlanPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS operation_plan_index_v1 (
          tenant_id text NOT NULL,
          project_id text NOT NULL,
          group_id text NOT NULL,
          plan_id text PRIMARY KEY,
          field_id text NOT NULL,
          template_code text NOT NULL,
          title text NOT NULL,
          status text NOT NULL,
          requested_by text NOT NULL,
          scheduled_start_ts_ms bigint NOT NULL,
          scheduled_end_ts_ms bigint NOT NULL,
          approval_request_id text NULL,
          created_ts_ms bigint NOT NULL,
          updated_ts_ms bigint NOT NULL,
          plan_payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
          CONSTRAINT operation_plan_index_v1_status_ck CHECK (status IN ('DRAFT','READY','APPROVAL_PENDING','TASK_CREATED','REJECTED','ARCHIVED'))
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_operation_plan_index_v1_tenant ON operation_plan_index_v1 (tenant_id, project_id, group_id, created_ts_ms DESC)`);
      await pool.query(`ALTER TABLE operation_plan_index_v1 ADD COLUMN IF NOT EXISTS approval_request_id text NULL`);
      await pool.query(`ALTER TABLE operation_plan_index_v1 ADD COLUMN IF NOT EXISTS plan_payload_json jsonb NOT NULL DEFAULT '{}'::jsonb`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_operation_plan_index_v1_field ON operation_plan_index_v1 (tenant_id, project_id, group_id, field_id, created_ts_ms DESC)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_operation_plan_index_v1_status ON operation_plan_index_v1 (tenant_id, project_id, group_id, status, created_ts_ms DESC)`);
      await pool.query(`ALTER TABLE operation_plan_index_v1 DROP CONSTRAINT IF EXISTS operation_plan_index_v1_status_ck`);
      await pool.query(`ALTER TABLE operation_plan_index_v1 ADD CONSTRAINT operation_plan_index_v1_status_ck CHECK (status IN ('DRAFT','READY','APPROVAL_PENDING','TASK_CREATED','REJECTED','ARCHIVED'))`);
    })().catch((err) => {
      ensureOperationPlanPromise = null;
      throw err;
    });
  }
  await ensureOperationPlanPromise;
}

async function insertFact(pool: Pool, source: string, record_json: any): Promise<string> {
  const fact_id = `opfact_${randomUUID().replace(/-/g, "")}`;
  await pool.query(
    "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
    [fact_id, source, record_json]
  );
  return fact_id;
}

async function fetchJson(url: string, authorizationHeader: string, body: any): Promise<{ ok: boolean; status: number; json: any }> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authorizationHeader ? { authorization: authorizationHeader } : {})
    },
    body: JSON.stringify(body ?? {})
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, json };
}

async function fetchLatestApprovalDecision(pool: Pool, tenant: TenantTriple, requestId: string): Promise<any | null> {
  const q = await pool.query(
    `SELECT fact_id, occurred_at, record_json
       FROM facts
      WHERE (record_json::jsonb->>'type') = 'approval_decision_v1'
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND (record_json::jsonb#>>'{payload,project_id}') = $2
        AND (record_json::jsonb#>>'{payload,group_id}') = $3
        AND (record_json::jsonb#>>'{payload,request_id}') = $4
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 1`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, requestId]
  );
  if ((q.rowCount ?? 0) < 1) return null;
  return parseJsonMaybe(q.rows[0]?.record_json);
}

async function fetchLatestReceiptStatus(pool: Pool, tenant: TenantTriple, actTaskId: string): Promise<string | null> {
  const q = await pool.query(
    `SELECT record_json
       FROM facts
      WHERE (record_json::jsonb->>'type') = 'ao_act_receipt_v0'
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND (record_json::jsonb#>>'{payload,project_id}') = $2
        AND (record_json::jsonb#>>'{payload,group_id}') = $3
        AND (record_json::jsonb#>>'{payload,act_task_id}') = $4
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 1`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, actTaskId]
  );
  if ((q.rowCount ?? 0) < 1) return null;
  const parsed = parseJsonMaybe(q.rows[0]?.record_json);
  return parsed?.payload?.status ? String(parsed.payload.status) : null;
}

async function fetchDispatchQueueState(pool: Pool, tenant: TenantTriple, actTaskId: string): Promise<string | null> {
  const q = await pool.query(
    `SELECT state
       FROM dispatch_queue_v1
      WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND act_task_id = $4
      ORDER BY created_at DESC, queue_id DESC
      LIMIT 1`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, actTaskId]
  ).catch(() => ({ rowCount: 0, rows: [] as any[] }));
  if (((q as any).rowCount ?? 0) < 1) return null;
  return (q as any).rows?.[0]?.state ? String((q as any).rows[0].state) : null;
}

async function enrichPlanRow(pool: Pool, row: any): Promise<any> {
  const tenant: TenantTriple = {
    tenant_id: String(row.tenant_id ?? ""),
    project_id: String(row.project_id ?? ""),
    group_id: String(row.group_id ?? ""),
  };
  const base = {
    tenant_id: tenant.tenant_id,
    project_id: tenant.project_id,
    group_id: tenant.group_id,
    plan_id: String(row.plan_id ?? ""),
    field_id: String(row.field_id ?? ""),
    template_code: String(row.template_code ?? ""),
    title: String(row.title ?? ""),
    status: String(row.status ?? "DRAFT"),
    requested_by: String(row.requested_by ?? ""),
    scheduled_start_ts_ms: Number(row.scheduled_start_ts_ms ?? 0),
    scheduled_end_ts_ms: Number(row.scheduled_end_ts_ms ?? 0),
    approval_request_id: row.approval_request_id ? String(row.approval_request_id) : null,
    created_ts_ms: Number(row.created_ts_ms ?? 0),
    updated_ts_ms: Number(row.updated_ts_ms ?? 0),
    plan_payload: parseJsonMaybe(row.plan_payload_json) ?? {},
  };
  if (!base.approval_request_id) {
    return { ...base, approval_status: null, act_task_id: null, linked_task_count: 0, latest_receipt_status: null };
  }
  const decision = await fetchLatestApprovalDecision(pool, tenant, base.approval_request_id);
  const decisionPayload = decision?.payload ?? null;
  const actTaskId = decisionPayload?.act_task_id ? String(decisionPayload.act_task_id) : null;
  const latestReceiptStatus = actTaskId ? await fetchLatestReceiptStatus(pool, tenant, actTaskId) : null;
  const queue_state = actTaskId ? await fetchDispatchQueueState(pool, tenant, actTaskId) : null;
  return {
    ...base,
    approval_status: decisionPayload?.decision ? String(decisionPayload.decision) : "PENDING",
    act_task_id: actTaskId,
    linked_task_count: actTaskId ? 1 : 0,
    latest_receipt_status: latestReceiptStatus,
    queue_state,
  };
}

export function registerOperationsPlansV1Routes(app: FastifyInstance, pool: Pool): void {
  app.post("/api/v1/operations/plans", async (req, reply) => {
    try {
      const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
      if (!auth) return;
      if (!requireAoActAdminV0(req, reply, { deniedError: "ROLE_APPROVAL_ADMIN_REQUIRED" })) return;
      await ensureOperationPlanProjection(pool);

      const body: any = req.body ?? {};
      const field_id = String(body.field_id ?? "").trim();
      const template_code = String(body.template_code ?? "").trim().toUpperCase();
      const title = String(body.title ?? "").trim();
      const scheduled_start_ts_ms = Number(body.scheduled_start_ts_ms);
      const scheduled_end_ts_ms = Number(body.scheduled_end_ts_ms);
      const parameters = body.parameters && typeof body.parameters === "object" && !Array.isArray(body.parameters) ? body.parameters : {};
      const meta = body.meta && typeof body.meta === "object" && !Array.isArray(body.meta) ? body.meta : {};
      const note = body.note == null ? null : String(body.note);
      if (!field_id) return badRequest(reply, "MISSING_OR_INVALID:field_id");
      if (!template_code) return badRequest(reply, "MISSING_OR_INVALID:template_code");
      if (!title) return badRequest(reply, "MISSING_OR_INVALID:title");
      if (!Number.isFinite(scheduled_start_ts_ms) || !Number.isFinite(scheduled_end_ts_ms)) return badRequest(reply, "MISSING_OR_INVALID:scheduled_window");
      if (scheduled_start_ts_ms > scheduled_end_ts_ms) return badRequest(reply, "SCHEDULE_WINDOW_INVALID");

      const tenant = tenantFromAuth(auth);
      const plan_id = `opn_${randomUUID().replace(/-/g, "")}`;
      const now_ms = Date.now();
      const plan_payload = {
        template_code,
        parameters,
        meta,
        note,
        source_plan_id: body.source_plan_id ? String(body.source_plan_id) : null,
      };
      const fact_id = await insertFact(pool, "api/v1/operations/plans", {
        type: "operation_plan_created_v1",
        payload: {
          ...tenant,
          plan_id,
          field_id,
          template_code,
          title,
          status: "DRAFT",
          requested_by: auth.actor_id,
          scheduled_start_ts_ms,
          scheduled_end_ts_ms,
          created_ts_ms: now_ms,
          updated_ts_ms: now_ms,
          approval_request_id: null,
          plan_payload,
          actor_id: auth.actor_id,
          token_id: auth.token_id,
        }
      });
      await pool.query(
        `INSERT INTO operation_plan_index_v1 (
           tenant_id, project_id, group_id, plan_id, field_id, template_code, title, status,
           requested_by, scheduled_start_ts_ms, scheduled_end_ts_ms, approval_request_id,
           created_ts_ms, updated_ts_ms, plan_payload_json
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)`,
        [
          tenant.tenant_id,
          tenant.project_id,
          tenant.group_id,
          plan_id,
          field_id,
          template_code,
          title,
          "DRAFT",
          auth.actor_id,
          scheduled_start_ts_ms,
          scheduled_end_ts_ms,
          null,
          now_ms,
          now_ms,
          JSON.stringify(plan_payload)
        ]
      );
      return reply.send({ ok: true, plan_id, fact_id, status: "DRAFT" });
    } catch (e: any) {
      return reply.status(400).send({ ok: false, error: e?.message ?? "BAD_REQUEST" });
    }
  });

  app.get("/api/v1/operations/plans", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    await ensureOperationPlanProjection(pool);
    const q: any = (req as any).query ?? {};
    const tenant = tenantFromAuth(auth);
    const field_id = typeof q.field_id === "string" && q.field_id.trim() ? q.field_id.trim() : null;
    const status = typeof q.status === "string" && q.status.trim() ? q.status.trim().toUpperCase() : null;
    const limit = parseLimit(q.limit, 20, 100);
    const res = await pool.query(
      `SELECT *
         FROM operation_plan_index_v1
        WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3
          AND ($4::text IS NULL OR field_id = $4)
          AND ($5::text IS NULL OR status = $5)
        ORDER BY created_ts_ms DESC, plan_id DESC
        LIMIT $6`,
      [tenant.tenant_id, tenant.project_id, tenant.group_id, field_id, status, limit]
    );
    const items = await Promise.all((res.rows ?? []).map((row: any) => enrichPlanRow(pool, row)));
    return reply.send({ ok: true, items });
  });

  app.get("/api/v1/operations/plans/:plan_id", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    await ensureOperationPlanProjection(pool);
    const plan_id = String((req.params as any)?.plan_id ?? "").trim();
    if (!plan_id) return badRequest(reply, "MISSING_PLAN_ID");
    const tenant = tenantFromAuth(auth);
    const detailQ = await pool.query(
      `SELECT * FROM operation_plan_index_v1 WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND plan_id = $4 LIMIT 1`,
      [tenant.tenant_id, tenant.project_id, tenant.group_id, plan_id]
    );
    if ((detailQ.rowCount ?? 0) < 1) return notFound(reply);
    const item = await enrichPlanRow(pool, detailQ.rows[0]);
    return reply.send({ ok: true, item });
  });

  app.post("/api/v1/operations/plans/:plan_id/status", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
    if (!auth) return;
    if (!requireAoActAdminV0(req, reply, { deniedError: "ROLE_APPROVAL_ADMIN_REQUIRED" })) return;
    await ensureOperationPlanProjection(pool);
    const plan_id = String((req.params as any)?.plan_id ?? "").trim();
    if (!plan_id) return badRequest(reply, "MISSING_PLAN_ID");
    const body: any = req.body ?? {};
    const next_status = String(body.status ?? "").trim().toUpperCase() as OperationPlanStatus;
    if (!["DRAFT","READY","APPROVAL_PENDING","ARCHIVED"].includes(next_status)) return badRequest(reply, "INVALID_STATUS");
    const tenant = tenantFromAuth(auth);
    const detailQ = await pool.query(`SELECT * FROM operation_plan_index_v1 WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND plan_id = $4 LIMIT 1`, [tenant.tenant_id, tenant.project_id, tenant.group_id, plan_id]);
    if ((detailQ.rowCount ?? 0) < 1) return notFound(reply);
    const current = String(detailQ.rows[0]?.status ?? "DRAFT");
    const allowed: Record<string, OperationPlanStatus[]> = {
      DRAFT: ["READY", "ARCHIVED"],
      READY: ["ARCHIVED", "READY"],
      APPROVAL_PENDING: ["ARCHIVED", "APPROVAL_PENDING"],
      TASK_CREATED: ["ARCHIVED"],
      REJECTED: ["ARCHIVED"],
      ARCHIVED: ["ARCHIVED"],
    };
    if (!(allowed[current] ?? []).includes(next_status)) return badRequest(reply, `STATUS_TRANSITION_DENIED:${current}->${next_status}`);
    const now_ms = Date.now();
    const fact_id = await insertFact(pool, "api/v1/operations/plans/status", {
      type: "operation_plan_status_changed_v1",
      payload: {
        ...tenant,
        plan_id,
        prev_status: current,
        next_status,
        actor_id: auth.actor_id,
        token_id: auth.token_id,
        updated_ts_ms: now_ms,
      }
    });
    await pool.query(`UPDATE operation_plan_index_v1 SET status = $5, updated_ts_ms = $6 WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND plan_id = $4`, [tenant.tenant_id, tenant.project_id, tenant.group_id, plan_id, next_status, now_ms]);
    return reply.send({ ok: true, plan_id, status: next_status, fact_id });
  });

  app.post("/api/v1/operations/plans/:plan_id/submit-approval", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
    if (!auth) return;
    if (!requireAoActAdminV0(req, reply, { deniedError: "ROLE_APPROVAL_ADMIN_REQUIRED" })) return;
    await ensureOperationPlanProjection(pool);
    const plan_id = String((req.params as any)?.plan_id ?? "").trim();
    if (!plan_id) return badRequest(reply, "MISSING_PLAN_ID");
    const tenant = tenantFromAuth(auth);
    const planQ = await pool.query(`SELECT * FROM operation_plan_index_v1 WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND plan_id = $4 LIMIT 1`, [tenant.tenant_id, tenant.project_id, tenant.group_id, plan_id]);
    if ((planQ.rowCount ?? 0) < 1) return notFound(reply);
    const planRow = planQ.rows[0];
    if (planRow.approval_request_id) return badRequest(reply, "PLAN_ALREADY_LINKED");
    if (String(planRow.status ?? "DRAFT") === "ARCHIVED") return badRequest(reply, "PLAN_ALREADY_ARCHIVED");
    const planPayload = parseJsonMaybe(planRow.plan_payload_json) ?? {};
    const parameters = planPayload.parameters && typeof planPayload.parameters === "object" ? planPayload.parameters : {};
    const approvalBody = {
      ...tenant,
      issuer: { kind: "human", id: auth.actor_id },
      action_type: String(planRow.template_code ?? "IRRIGATE"),
      target: String(planRow.field_id ?? ""),
      time_window: {
        start_ts: Number(planRow.scheduled_start_ts_ms ?? Date.now()),
        end_ts: Number(planRow.scheduled_end_ts_ms ?? Date.now()),
      },
      parameter_schema: { keys: Object.keys(parameters).map((name) => ({ name, type: typeof (parameters as any)[name] === "number" ? "number" : typeof (parameters as any)[name] === "boolean" ? "boolean" : "string" })) },
      parameters,
      constraints: {},
      meta: {
        ...(planPayload.meta && typeof planPayload.meta === "object" ? planPayload.meta : {}),
        plan_id,
        plan_title: String(planRow.title ?? ""),
      }
    };
    const delegated = await fetchJson(`${hostBaseUrl(req)}/api/v1/approvals`, String((req.headers as any).authorization ?? ""), approvalBody);
    if (!delegated.ok || !delegated.json?.request_id) {
      return reply.status(delegated.status || 400).send(delegated.json ?? { ok: false, error: "APPROVAL_CREATE_FAILED" });
    }
    const request_id = String(delegated.json.request_id);
    const now_ms = Date.now();
    const fact_id = await insertFact(pool, "api/v1/operations/plans/submit-approval", {
      type: "operation_plan_approval_linked_v1",
      payload: {
        ...tenant,
        plan_id,
        approval_request_id: request_id,
        actor_id: auth.actor_id,
        token_id: auth.token_id,
        updated_ts_ms: now_ms,
      }
    });
    await pool.query(`UPDATE operation_plan_index_v1 SET approval_request_id = $5, status = 'APPROVAL_PENDING', updated_ts_ms = $6 WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND plan_id = $4`, [tenant.tenant_id, tenant.project_id, tenant.group_id, plan_id, request_id, now_ms]);
    return reply.send({ ok: true, plan_id, approval_request_id: request_id, status: "APPROVAL_PENDING", fact_id });
  });
}
