// GEOX/apps/server/src/routes/controlplane_v1.ts
// Control Plane v1 wrapper routes for Commercial Control-2.
// This layer does three things only:
// 1) exposes stable /api/v1/* REST paths;
// 2) keeps the existing v0 AO-ACT / approval runtime as the execution core;
// 3) adds explicit dispatch/outbox facts so adapters can drain a bounded queue without auto-scheduling.

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"; // Fastify types for route handlers.
import type { Pool } from "pg"; // Postgres pool typing.
import { createHash, randomUUID } from "node:crypto"; // Stable unique ids for wrapper facts + payload hashing.
import { requireAoActScopeV0, requireAoActAdminV0, type AoActAuthContextV0 } from "../auth/ao_act_authz_v0"; // Reuse existing token/scope auth.

type TenantTriple = { tenant_id: string; project_id: string; group_id: string }; // Hard-isolation tenant triple.

type ParsedFactRow = { fact_id: string; occurred_at: string; source: string; record_json: any }; // Normalized fact row.

function badRequest(reply: FastifyReply, error: string) {
  return reply.status(400).send({ ok: false, error }); // Deterministic 400 helper.
}

function parseJsonMaybe(v: any): any {
  if (v && typeof v === "object") return v; // json/jsonb may already be parsed.
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return null; } // Best-effort parse.
  }
  return null; // Unknown shape => null.
}

function hostBaseUrl(req: FastifyRequest): string {
  const envBase = String(process.env.GEOX_INTERNAL_BASE_URL ?? "").trim(); // Optional explicit internal base.
  if (envBase) return envBase; // Prefer explicit internal URL when present.
  const host = String((req.headers as any).host ?? "127.0.0.1:3000"); // Fallback to request Host header.
  return `http://${host}`; // Same-process HTTP delegation target.
}

function requireTenantMatchOr404(auth: AoActAuthContextV0, tenant: TenantTriple, reply: FastifyReply): boolean {
  if (auth.tenant_id !== tenant.tenant_id || auth.project_id !== tenant.project_id || auth.group_id !== tenant.group_id) {
    reply.status(404).send({ ok: false, error: "NOT_FOUND" }); // Cross-tenant requests stay non-enumerable.
    return false; // Halt caller.
  }
  return true; // Tenant matches token scope.
}

function queryTenantFromReq(req: FastifyRequest, auth: AoActAuthContextV0): TenantTriple {
  const q: any = (req as any).query ?? {}; // Read query object.
  return {
    tenant_id: typeof q.tenant_id === "string" && q.tenant_id.trim() ? q.tenant_id.trim() : auth.tenant_id,
    project_id: typeof q.project_id === "string" && q.project_id.trim() ? q.project_id.trim() : auth.project_id,
    group_id: typeof q.group_id === "string" && q.group_id.trim() ? q.group_id.trim() : auth.group_id
  }; // Default to token triple when query is omitted.
}

async function insertFact(pool: Pool, source: string, record_json: any): Promise<string> {
  const fact_id = randomUUID(); // Wrapper fact id.
  await pool.query(
    "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
    [fact_id, source, record_json]
  ); // Append-only insert.
  return fact_id; // Return created fact id.
}

async function bridgePlanDecisionToExecution(
  pool: Pool,
  tenant: TenantTriple,
  request_id: string,
  decision: "APPROVE" | "REJECT",
  act_task_id: string | null,
  auth: AoActAuthContextV0,
): Promise<{ plan_id: string; bridged_status: string } | null> {
  const planQ = await pool.query(
    `SELECT plan_id, status
       FROM operation_plan_index_v1
      WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND approval_request_id = $4
      ORDER BY updated_ts_ms DESC, plan_id DESC
      LIMIT 1`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, request_id]
  ).catch(() => ({ rowCount: 0, rows: [] as any[] }));
  if (((planQ as any).rowCount ?? 0) < 1) return null;
  const plan_id = String((planQ as any).rows[0]?.plan_id ?? "").trim();
  if (!plan_id) return null;
  const now_ms = Date.now();
  const bridged_status = decision === "APPROVE" ? "TASK_CREATED" : "REJECTED";
  const factType = decision === "APPROVE" ? "operation_plan_task_linked_v1" : "operation_plan_rejected_v1";
  await insertFact(pool, "api/v1/approvals/decide/bridge-plan", {
    type: factType,
    payload: {
      tenant_id: tenant.tenant_id,
      project_id: tenant.project_id,
      group_id: tenant.group_id,
      plan_id,
      approval_request_id: request_id,
      act_task_id,
      decision,
      bridged_status,
      actor_id: auth.actor_id,
      token_id: auth.token_id,
      updated_ts_ms: now_ms,
    }
  });
  await pool.query(
    `UPDATE operation_plan_index_v1
        SET status = $5,
            updated_ts_ms = $6
      WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND plan_id = $4`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, plan_id, bridged_status, now_ms]
  );
  return { plan_id, bridged_status };
}

let ensureDispatchQueueRuntimePromise: Promise<void> | null = null; // Process-local one-time runtime table init.

async function ensureDispatchQueueRuntime(pool: Pool): Promise<void> {
  if (!ensureDispatchQueueRuntimePromise) {
    ensureDispatchQueueRuntimePromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS dispatch_queue_v1 (
          queue_id text PRIMARY KEY,
          tenant_id text NOT NULL,
          project_id text NOT NULL,
          group_id text NOT NULL,
          act_task_id text NOT NULL,
          task_fact_id text NOT NULL,
          outbox_fact_id text NOT NULL,
          device_id text NULL,
          downlink_topic text NULL,
          qos integer NOT NULL DEFAULT 1,
          retain boolean NOT NULL DEFAULT false,
          adapter_hint text NULL,
          state text NOT NULL,
          lease_token text NULL,
          leased_by text NULL,
          lease_expires_at timestamptz NULL,
          publish_fact_id text NULL,
          ack_fact_id text NULL,
          receipt_fact_id text NULL,
          attempt_count integer NOT NULL DEFAULT 0,
          last_error text NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT dispatch_queue_v1_state_ck CHECK (state IN ('READY','LEASED','PUBLISHED','ACKED','RECEIPTED','DEAD')),
          CONSTRAINT dispatch_queue_v1_task_unique UNIQUE (tenant_id, project_id, group_id, act_task_id)
        )
      `); // Runtime queue state lives outside the append-only ledger.
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_dispatch_queue_v1_ready ON dispatch_queue_v1 (tenant_id, project_id, group_id, state, created_at)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_dispatch_queue_v1_outbox ON dispatch_queue_v1 (outbox_fact_id)`);
    })().catch((err) => {
      ensureDispatchQueueRuntimePromise = null; // Allow retry on startup race or transient DB error.
      throw err;
    });
  }
  await ensureDispatchQueueRuntimePromise;
}

async function upsertDispatchQueueReady(pool: Pool, row: {
  tenant: TenantTriple;
  queue_id: string;
  act_task_id: string;
  task_fact_id: string;
  outbox_fact_id: string;
  device_id: string | null;
  downlink_topic: string | null;
  qos: number;
  retain: boolean;
  adapter_hint: string | null;
}): Promise<void> {
  await ensureDispatchQueueRuntime(pool);
  await pool.query(
    `INSERT INTO dispatch_queue_v1 (
       queue_id, tenant_id, project_id, group_id, act_task_id, task_fact_id, outbox_fact_id,
       device_id, downlink_topic, qos, retain, adapter_hint, state,
       created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'READY',NOW(),NOW())
     ON CONFLICT (tenant_id, project_id, group_id, act_task_id)
     DO UPDATE SET
       task_fact_id = EXCLUDED.task_fact_id,
       outbox_fact_id = EXCLUDED.outbox_fact_id,
       device_id = EXCLUDED.device_id,
       downlink_topic = EXCLUDED.downlink_topic,
       qos = EXCLUDED.qos,
       retain = EXCLUDED.retain,
       adapter_hint = EXCLUDED.adapter_hint,
       state = CASE WHEN dispatch_queue_v1.state = 'RECEIPTED' THEN 'READY' ELSE dispatch_queue_v1.state END,
       updated_at = NOW()`,
    [
      row.queue_id,
      row.tenant.tenant_id,
      row.tenant.project_id,
      row.tenant.group_id,
      row.act_task_id,
      row.task_fact_id,
      row.outbox_fact_id,
      row.device_id,
      row.downlink_topic,
      row.qos,
      row.retain,
      row.adapter_hint
    ]
  ); // READY rows are mutable runtime state derived from immutable facts.
}

async function claimDispatchQueueRows(
  pool: Pool,
  tenant: TenantTriple,
  limit: number,
  leaseSeconds: number,
  executorId: string,
  leaseToken: string,
  actTaskId?: string,
  adapterHint?: string
): Promise<any[]> {
  await ensureDispatchQueueRuntime(pool);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sql = `
      WITH cte AS (
        SELECT queue_id
        FROM dispatch_queue_v1
        WHERE tenant_id = $1
          AND project_id = $2
          AND group_id = $3
          AND ($4::text IS NULL OR act_task_id = $4)
          AND ($5::text IS NULL OR adapter_hint IS NULL OR adapter_hint = $5)
          AND (
            state = 'READY'
            OR (state = 'LEASED' AND lease_expires_at IS NOT NULL AND lease_expires_at < NOW())
          )
        ORDER BY created_at ASC, queue_id ASC
        FOR UPDATE SKIP LOCKED
        LIMIT $6
      )
      UPDATE dispatch_queue_v1 q
      SET state = 'LEASED',
          lease_token = $7,
          leased_by = $8,
          lease_expires_at = NOW() + make_interval(secs => $9::int),
          attempt_count = q.attempt_count + 1,
          updated_at = NOW()
      FROM cte
      WHERE q.queue_id = cte.queue_id
      RETURNING q.*
    `;
    const res = await client.query(sql, [tenant.tenant_id, tenant.project_id, tenant.group_id, actTaskId ?? null, adapterHint ?? null, limit, leaseToken, executorId, leaseSeconds]);
    await client.query('COMMIT');
    return res.rows ?? [];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function updateDispatchQueueStateByOutbox(
  pool: Pool,
  outboxFactId: string,
  patch: { state: 'PUBLISHED' | 'ACKED' | 'RECEIPTED'; publish_fact_id?: string | null; ack_fact_id?: string | null; receipt_fact_id?: string | null; leaseToken?: string | null; leasedBy?: string | null }
): Promise<void> {
  await ensureDispatchQueueRuntime(pool);
  const fields = ["state = $2", "updated_at = NOW()"];
  const values: any[] = [outboxFactId, patch.state];
  let idx = 3;
  if (patch.publish_fact_id !== undefined) { fields.push(`publish_fact_id = $${idx++}`); values.push(patch.publish_fact_id); }
  if (patch.ack_fact_id !== undefined) { fields.push(`ack_fact_id = $${idx++}`); values.push(patch.ack_fact_id); }
  if (patch.receipt_fact_id !== undefined) { fields.push(`receipt_fact_id = $${idx++}`); values.push(patch.receipt_fact_id); }
  if (patch.state === 'RECEIPTED') {
    fields.push('lease_token = NULL', 'leased_by = NULL', 'lease_expires_at = NULL');
  }
  let where = 'WHERE outbox_fact_id = $1';
  if (patch.leaseToken) { where += ` AND lease_token = $${idx++}`; values.push(patch.leaseToken); }
  if (patch.leasedBy) { where += ` AND leased_by = $${idx++}`; values.push(patch.leasedBy); }
  await pool.query(`UPDATE dispatch_queue_v1 SET ${fields.join(', ')} ${where}`, values);
}

async function updateDispatchQueueStateByActTask(
  pool: Pool,
  tenant: TenantTriple,
  actTaskId: string,
  patch: { state: 'ACKED' | 'RECEIPTED'; ack_fact_id?: string | null; receipt_fact_id?: string | null }
): Promise<void> {
  await ensureDispatchQueueRuntime(pool);
  const fields = ["state = $5", "updated_at = NOW()"];
  const values: any[] = [tenant.tenant_id, tenant.project_id, tenant.group_id, actTaskId, patch.state];
  let idx = 6;
  if (patch.ack_fact_id !== undefined) { fields.push(`ack_fact_id = $${idx++}`); values.push(patch.ack_fact_id); }
  if (patch.receipt_fact_id !== undefined) { fields.push(`receipt_fact_id = $${idx++}`); values.push(patch.receipt_fact_id); }
  if (patch.state === 'RECEIPTED') {
    fields.push('lease_token = NULL', 'leased_by = NULL', 'lease_expires_at = NULL');
  }
  await pool.query(
    `UPDATE dispatch_queue_v1 SET ${fields.join(', ')} WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND act_task_id = $4`,
    values
  );
}

async function loadLatestFactByTypeAndKey(
  pool: Pool,
  factType: string,
  keyPath: string,
  keyValue: string,
  tenant: TenantTriple
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
  `; // Generic fact lookup scoped by tenant triple.
  const res = await pool.query(sql, [factType, keyPath, keyValue, tenant.tenant_id, tenant.project_id, tenant.group_id]);
  if (!res.rows?.length) return null; // Not found within this tenant scope.
  const row: any = res.rows[0];
  return {
    fact_id: String(row.fact_id),
    occurred_at: String(row.occurred_at),
    source: String(row.source),
    record_json: parseJsonMaybe(row.record_json) ?? row.record_json
  }; // Return normalized row.
}

async function loadLatestDownlinkPublishedByOutboxFactId(
  pool: Pool,
  outboxFactId: string,
  tenant: TenantTriple
): Promise<ParsedFactRow | null> {
  const sql = `
    SELECT fact_id, occurred_at, source, record_json
    FROM facts
    WHERE (record_json::jsonb->>'type') = 'ao_act_downlink_published_v1'
      AND (record_json::jsonb#>>'{payload,outbox_fact_id}') = $1
      AND (record_json::jsonb#>>'{payload,tenant_id}') = $2
      AND (record_json::jsonb#>>'{payload,project_id}') = $3
      AND (record_json::jsonb#>>'{payload,group_id}') = $4
    ORDER BY occurred_at DESC, fact_id DESC
    LIMIT 1
  `; // Idempotency lookup for published downlink audit by outbox fact id.
  const res = await pool.query(sql, [outboxFactId, tenant.tenant_id, tenant.project_id, tenant.group_id]);
  if (!res.rows?.length) return null;
  const row: any = res.rows[0];
  return {
    fact_id: String(row.fact_id),
    occurred_at: String(row.occurred_at),
    source: String(row.source),
    record_json: parseJsonMaybe(row.record_json) ?? row.record_json
  };
}

async function fetchJson(url: string, authz: string, body?: any): Promise<{ ok: boolean; status: number; json: any }> {
  const res = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      accept: "application/json",
      authorization: authz,
      ...(body === undefined ? {} : { "content-type": "application/json" })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  }); // Delegate to existing route over same-process HTTP.
  const json = await res.json().catch(() => null); // Read JSON body if any.
  return { ok: res.ok, status: res.status, json }; // Normalize fetch result.
}

async function listApprovals(pool: Pool, tenant: TenantTriple, limit: number): Promise<any[]> {
  const sql = `
    WITH reqs AS (
      SELECT occurred_at, fact_id, source, (record_json::jsonb) AS record_json
      FROM facts
      WHERE (record_json::jsonb->>'type') = 'approval_request_v1'
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND (record_json::jsonb#>>'{payload,project_id}') = $2
        AND (record_json::jsonb#>>'{payload,group_id}') = $3
    ), latest_decision AS (
      SELECT DISTINCT ON ((record_json::jsonb#>>'{payload,request_id}'))
        (record_json::jsonb#>>'{payload,request_id}') AS request_id,
        occurred_at,
        fact_id,
        (record_json::jsonb) AS record_json
      FROM facts
      WHERE (record_json::jsonb->>'type') = 'approval_decision_v1'
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND (record_json::jsonb#>>'{payload,project_id}') = $2
        AND (record_json::jsonb#>>'{payload,group_id}') = $3
      ORDER BY (record_json::jsonb#>>'{payload,request_id}'), occurred_at DESC, fact_id DESC
    )
    SELECT r.fact_id, r.occurred_at, r.source, r.record_json, d.record_json AS decision_json
    FROM reqs r
    LEFT JOIN latest_decision d
      ON (r.record_json#>>'{payload,request_id}') = d.request_id
    ORDER BY r.occurred_at DESC, r.fact_id DESC
    LIMIT $4
  `; // Request facts with latest decision side-loaded.
  const res = await pool.query(sql, [tenant.tenant_id, tenant.project_id, tenant.group_id, limit]);
  return (res.rows ?? []).map((row: any) => {
    const request = parseJsonMaybe(row.record_json) ?? row.record_json;
    const decision = parseJsonMaybe(row.decision_json);
    return {
      request_id: request?.payload?.request_id ?? null,
      status: decision?.payload?.decision ?? request?.payload?.status ?? "PENDING",
      occurred_at: row.occurred_at,
      request_fact_id: row.fact_id,
      decision_fact_id: decision ? String(decision?.payload?.decision_id ?? "") : null,
      act_task_id: decision?.payload?.act_task_id ?? null,
      request,
      decision
    };
  });
}

async function listTasks(pool: Pool, tenant: TenantTriple, limit: number): Promise<any[]> {
  const sql = `
    WITH latest_receipt AS (
      SELECT DISTINCT ON ((record_json::jsonb#>>'{payload,act_task_id}'))
        (record_json::jsonb#>>'{payload,act_task_id}') AS act_task_id,
        fact_id AS receipt_fact_id,
        occurred_at AS receipt_occurred_at,
        (record_json::jsonb) AS receipt_json
      FROM facts
      WHERE (record_json::jsonb->>'type') = 'ao_act_receipt_v0'
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND (record_json::jsonb#>>'{payload,project_id}') = $2
        AND (record_json::jsonb#>>'{payload,group_id}') = $3
      ORDER BY (record_json::jsonb#>>'{payload,act_task_id}'), occurred_at DESC, fact_id DESC
    ), latest_dispatch AS (
      SELECT DISTINCT ON ((record_json::jsonb#>>'{payload,act_task_id}'))
        (record_json::jsonb#>>'{payload,act_task_id}') AS act_task_id,
        fact_id AS dispatch_fact_id,
        occurred_at AS dispatch_occurred_at,
        (record_json::jsonb) AS dispatch_json
      FROM facts
      WHERE (record_json::jsonb->>'type') = 'ao_act_task_dispatched_v1'
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND (record_json::jsonb#>>'{payload,project_id}') = $2
        AND (record_json::jsonb#>>'{payload,group_id}') = $3
      ORDER BY (record_json::jsonb#>>'{payload,act_task_id}'), occurred_at DESC, fact_id DESC
    )
    SELECT t.fact_id, t.occurred_at, t.source, (t.record_json::jsonb) AS task_json,
           r.receipt_fact_id, r.receipt_occurred_at, r.receipt_json,
           d.dispatch_fact_id, d.dispatch_occurred_at, d.dispatch_json
    FROM facts t
    LEFT JOIN latest_receipt r ON (t.record_json::jsonb#>>'{payload,act_task_id}') = r.act_task_id
    LEFT JOIN latest_dispatch d ON (t.record_json::jsonb#>>'{payload,act_task_id}') = d.act_task_id
    WHERE (t.record_json::jsonb->>'type') = 'ao_act_task_v0'
      AND (t.record_json::jsonb#>>'{payload,tenant_id}') = $1
      AND (t.record_json::jsonb#>>'{payload,project_id}') = $2
      AND (t.record_json::jsonb#>>'{payload,group_id}') = $3
    ORDER BY t.occurred_at DESC, t.fact_id DESC
    LIMIT $4
  `; // Task list with latest dispatch + latest receipt side-loaded.
  const res = await pool.query(sql, [tenant.tenant_id, tenant.project_id, tenant.group_id, limit]);
  return (res.rows ?? []).map((row: any) => ({
    task_fact_id: String(row.fact_id),
    occurred_at: String(row.occurred_at),
    task: parseJsonMaybe(row.task_json) ?? row.task_json,
    dispatch_fact_id: row.dispatch_fact_id ? String(row.dispatch_fact_id) : null,
    dispatch_occurred_at: row.dispatch_occurred_at ? String(row.dispatch_occurred_at) : null,
    dispatch: parseJsonMaybe(row.dispatch_json),
    receipt_fact_id: row.receipt_fact_id ? String(row.receipt_fact_id) : null,
    receipt_occurred_at: row.receipt_occurred_at ? String(row.receipt_occurred_at) : null,
    receipt: parseJsonMaybe(row.receipt_json)
  }));
}

async function listDispatchQueue(pool: Pool, tenant: TenantTriple, limit: number, actTaskId?: string): Promise<any[]> {
  await ensureDispatchQueueRuntime(pool);
  const sql = `
    SELECT q.queue_id,
           q.act_task_id,
           q.outbox_fact_id,
           q.task_fact_id,
           q.device_id,
           q.downlink_topic,
           q.qos,
           q.retain,
           q.adapter_hint,
           q.state,
           q.lease_token,
           q.leased_by,
           q.lease_expires_at,
           q.publish_fact_id,
           q.ack_fact_id,
           q.receipt_fact_id,
           q.attempt_count,
           q.created_at,
           q.updated_at,
           o.occurred_at AS outbox_occurred_at,
           (o.record_json::jsonb) AS outbox_json,
           t.occurred_at AS task_occurred_at,
           (t.record_json::jsonb) AS task_json
    FROM dispatch_queue_v1 q
    JOIN facts o ON o.fact_id = q.outbox_fact_id
    JOIN facts t ON t.fact_id = q.task_fact_id
    WHERE q.tenant_id = $1
      AND q.project_id = $2
      AND q.group_id = $3
      AND ($4::text IS NULL OR q.act_task_id = $4)
      AND q.state IN ('READY','LEASED','PUBLISHED','ACKED')
    ORDER BY q.created_at ASC, q.queue_id ASC
    LIMIT $5
  `; // Runtime queue = mutable dispatch state joined back to immutable outbox/task facts.
  const res = await pool.query(sql, [tenant.tenant_id, tenant.project_id, tenant.group_id, actTaskId ?? null, limit]);
  return (res.rows ?? []).map((row: any) => ({
    queue_id: String(row.queue_id),
    act_task_id: String(row.act_task_id),
    outbox_fact_id: String(row.outbox_fact_id),
    outbox_occurred_at: String(row.outbox_occurred_at),
    outbox: parseJsonMaybe(row.outbox_json) ?? row.outbox_json,
    task_fact_id: String(row.task_fact_id),
    task_occurred_at: String(row.task_occurred_at),
    task: parseJsonMaybe(row.task_json) ?? row.task_json,
    device_id: row.device_id ? String(row.device_id) : null,
    downlink_topic: row.downlink_topic ? String(row.downlink_topic) : null,
    qos: Number(row.qos),
    retain: Boolean(row.retain),
    adapter_hint: row.adapter_hint ? String(row.adapter_hint) : null,
    state: String(row.state),
    lease_token: row.lease_token ? String(row.lease_token) : null,
    leased_by: row.leased_by ? String(row.leased_by) : null,
    lease_expires_at: row.lease_expires_at ? String(row.lease_expires_at) : null,
    publish_fact_id: row.publish_fact_id ? String(row.publish_fact_id) : null,
    ack_fact_id: row.ack_fact_id ? String(row.ack_fact_id) : null,
    receipt_fact_id: row.receipt_fact_id ? String(row.receipt_fact_id) : null,
    attempt_count: Number(row.attempt_count ?? 0)
  }));
}

async function listReceipts(pool: Pool, tenant: TenantTriple, limit: number, actTaskId?: string): Promise<any[]> {
  const sql = `
    SELECT fact_id, occurred_at, source, (record_json::jsonb) AS record_json
    FROM facts
    WHERE (record_json::jsonb->>'type') = 'ao_act_receipt_v0'
      AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
      AND (record_json::jsonb#>>'{payload,project_id}') = $2
      AND (record_json::jsonb#>>'{payload,group_id}') = $3
      AND ($4::text IS NULL OR (record_json::jsonb#>>'{payload,act_task_id}') = $4)
    ORDER BY occurred_at DESC, fact_id DESC
    LIMIT $5
  `; // Read-only receipt list scoped by tenant triple.
  const res = await pool.query(sql, [tenant.tenant_id, tenant.project_id, tenant.group_id, actTaskId ?? null, limit]);
  return (res.rows ?? []).map((row: any) => ({
    fact_id: String(row.fact_id),
    occurred_at: String(row.occurred_at),
    source: String(row.source),
    receipt: parseJsonMaybe(row.record_json) ?? row.record_json
  }));
}

function parseLimit(q: any, fallback = 20, max = 200): number {
  const raw = Number(q?.limit ?? fallback); // Read limit from query.
  if (!Number.isFinite(raw)) return fallback; // Invalid => fallback.
  return Math.max(1, Math.min(max, Math.trunc(raw))); // Clamp to safe bounds.
}

function deriveDispatchDeviceId(body: any, taskRecord: any): string | null {
  const bodyDeviceId = typeof body?.device_id === "string" ? body.device_id.trim() : ""; // Prefer explicit dispatch-time device id.
  if (bodyDeviceId) return bodyDeviceId; // Use request device id when present.
  const metaDeviceId = typeof taskRecord?.payload?.meta?.device_id === "string" ? String(taskRecord.payload.meta.device_id).trim() : ""; // Fallback to task meta hint.
  if (metaDeviceId) return metaDeviceId; // Use task meta hint when available.
  return null; // Unknown device binding at dispatch time.
}

function deriveDispatchTopic(tenant: TenantTriple, deviceId: string | null, body: any): string | null {
  const explicit = typeof body?.downlink_topic === "string" ? body.downlink_topic.trim() : ""; // Allow explicit topic override.
  if (explicit) return explicit; // Use explicit topic when provided.
  if (!deviceId) return null; // Cannot derive default topic without device id.
  return `downlink/${tenant.tenant_id}/${deviceId}`; // Default Commercial v1 MQTT downlink topic.
}

function deriveReceiptTopic(tenant: TenantTriple, deviceId: string, body: any): string {
  const explicit = typeof body?.uplink_topic === "string" ? body.uplink_topic.trim() : ""; // Allow explicit receipt topic override.
  if (explicit) return explicit; // Use explicit topic when provided.
  return `receipt/${tenant.tenant_id}/${deviceId}`; // Default Commercial v1 MQTT receipt uplink topic.
}

function sha256Json(value: any): string {
  return createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex"); // Stable hash for published downlink payload audit.
}



function approvalRiskHintFromProposal(proposal: any): string {
  const actionType = String(proposal?.action_type ?? "ACTION").toUpperCase();
  const target = proposal?.target;
  const targetRef = typeof target === "string" ? target : String(target?.ref ?? target?.field_id ?? target?.id ?? "");
  if (actionType === "PLOW") return `Mechanical operation risk: confirm device idle state, field boundary, and depth settings.`;
  if (actionType === "SPRAY") return `Spray operation risk: confirm dosage, weather window, and target scope ${targetRef || "target"}.`;
  if (actionType === "IRRIGATE") return `Irrigation operation risk: confirm valve/flow settings and target scope ${targetRef || "target"}.`;
  return `Operation risk: confirm target scope and critical parameters before execution.`;
}

function approvalImpactScopeFromProposal(proposal: any): any {
  const target = proposal?.target;
  if (typeof target === "string") return { target_kind: "field", target_ref: target };
  return {
    target_kind: String(target?.kind ?? "field"),
    target_ref: String(target?.ref ?? target?.field_id ?? target?.id ?? "")
  };
}

async function buildOperationsConsole(pool: Pool, tenant: TenantTriple): Promise<any> {
  const approvalsRaw = await listApprovals(pool, tenant, 20);
  const monitoringRaw = await listTasks(pool, tenant, 20);
  const dispatches = await listDispatchQueue(pool, tenant, 10);
  const receipts = await listReceipts(pool, tenant, 10);

  const approvals = approvalsRaw.map((item: any) => {
    const proposal = item?.request?.payload?.proposal ?? {};
    return {
      request_id: item.request_id ?? null,
      status: String(item.status ?? "PENDING"),
      occurred_at: String(item.occurred_at ?? ""),
      action_type: String(proposal?.action_type ?? ""),
      target: proposal?.target ?? null,
      device_id: typeof proposal?.meta?.device_id === "string" ? proposal.meta.device_id : null,
      risk_hint: approvalRiskHintFromProposal(proposal),
      impact_scope: approvalImpactScopeFromProposal(proposal),
      parameter_snapshot: proposal?.parameters ?? null,
      proposal_hash: sha256Json(proposal),
      decision_present: Boolean(item?.decision),
      act_task_id: item?.act_task_id ?? null
    };
  });

  const monitoring = monitoringRaw.map((item: any) => {
    const taskPayload = item?.task?.payload ?? {};
    const receiptPayload = item?.receipt?.payload ?? {};
    const parameters = taskPayload?.parameters ?? null;
    let state = "CREATED";
    if (item?.receipt_fact_id) state = "RECEIPTED";
    else if (item?.dispatch_fact_id) state = "DISPATCHED";
    return {
      act_task_id: String(taskPayload?.act_task_id ?? ""),
      state,
      action_type: String(taskPayload?.action_type ?? ""),
      target: taskPayload?.target ?? null,
      device_id: typeof taskPayload?.meta?.device_id === "string" ? taskPayload.meta.device_id : (typeof item?.dispatch?.payload?.device_id === "string" ? item.dispatch.payload.device_id : null),
      parameters,
      parameters_hash: sha256Json(parameters),
      dispatch_fact_id: item?.dispatch_fact_id ?? null,
      dispatch_occurred_at: item?.dispatch_occurred_at ?? null,
      receipt_fact_id: item?.receipt_fact_id ?? null,
      receipt_occurred_at: item?.receipt_occurred_at ?? null,
      latest_receipt_status: receiptPayload?.status ?? null,
      retry_allowed: !item?.receipt_fact_id
    };
  });

  return {
    summary: {
      approvals_pending: approvals.filter((x: any) => x.status === "PENDING").length,
      approvals_decided: approvals.filter((x: any) => x.status !== "PENDING").length,
      dispatch_queue: dispatches.length,
      receipts: receipts.length,
      retryable_tasks: monitoring.filter((x: any) => x.retry_allowed).length
    },
    approvals,
    monitoring,
    dispatches,
    receipts
  };
}

export function registerControlPlaneV1Routes(app: FastifyInstance, pool: Pool): void {
  // POST /api/v1/approvals
  // Stable REST wrapper around Sprint25 approval_request runtime.
  app.post("/api/v1/approvals", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.task.write"); // Approval creation implies later task issuance authority.
    if (!auth) return;
    if (!requireAoActAdminV0(req, reply, { deniedError: "ROLE_APPROVAL_ADMIN_REQUIRED" })) return;
    const body: any = req.body ?? {};
    const tenant: TenantTriple = {
      tenant_id: String(body.tenant_id ?? auth.tenant_id),
      project_id: String(body.project_id ?? auth.project_id),
      group_id: String(body.group_id ?? auth.group_id)
    };
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const delegated = await fetchJson(`${hostBaseUrl(req)}/api/control/approval_request/v1/request`, String((req.headers as any).authorization ?? ""), {
      ...body,
      tenant_id: tenant.tenant_id,
      project_id: tenant.project_id,
      group_id: tenant.group_id
    });
    if (!delegated.ok) return reply.status(delegated.status).send(delegated.json ?? { ok: false, error: "REQUEST_FAILED" });
    return reply.send({ ok: true, request_id: delegated.json?.request_id, fact_id: delegated.json?.fact_id });
  });

  // GET /api/v1/approvals
  // Read-model-lite for dashboard / operations pages.
  app.get("/api/v1/approvals", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read"); // Reuse read-only control scope.
    if (!auth) return;
    const tenant = queryTenantFromReq(req, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const items = await listApprovals(pool, tenant, parseLimit((req as any).query));
    return reply.send({ ok: true, items });
  });

  // GET /api/v1/approvals/:request_id
  app.get("/api/v1/approvals/:request_id", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = queryTenantFromReq(req, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const params: any = (req as any).params ?? {};
    const request_id = String(params.request_id ?? "").trim();
    if (!request_id) return badRequest(reply, "MISSING_REQUEST_ID");
    const request = await loadLatestFactByTypeAndKey(pool, "approval_request_v1", "payload,request_id", request_id, tenant);
    if (!request) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    const decision = await loadLatestFactByTypeAndKey(pool, "approval_decision_v1", "payload,request_id", request_id, tenant);
    return reply.send({ ok: true, request, decision });
  });

  // POST /api/v1/approvals/:request_id/decide
  // approve => writes approval_decision_v1 + wrapper task_created fact via existing AO-ACT core.
  // reject  => writes approval_decision_v1 only.
  app.post("/api/v1/approvals/:request_id/decide", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
    if (!auth) return;
    if (!requireAoActAdminV0(req, reply, { deniedError: "ROLE_APPROVAL_ADMIN_REQUIRED" })) return;
    const params: any = (req as any).params ?? {};
    const body: any = req.body ?? {};
    const request_id = String(params.request_id ?? "").trim();
    if (!request_id) return badRequest(reply, "MISSING_REQUEST_ID");
    const decision = String(body.decision ?? "").trim().toUpperCase();
    if (decision !== "APPROVE" && decision !== "REJECT") return badRequest(reply, "INVALID_DECISION");
    const tenant: TenantTriple = {
      tenant_id: String(body.tenant_id ?? auth.tenant_id),
      project_id: String(body.project_id ?? auth.project_id),
      group_id: String(body.group_id ?? auth.group_id)
    };
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const requestFact = await loadLatestFactByTypeAndKey(pool, "approval_request_v1", "payload,request_id", request_id, tenant);
    if (!requestFact) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    const requestPayload = requestFact.record_json?.payload ?? null;
    if (!requestPayload?.proposal) return reply.status(500).send({ ok: false, error: "REQUEST_RECORD_INVALID" });

    const existingDecision = await loadLatestFactByTypeAndKey(pool, "approval_decision_v1", "payload,request_id", request_id, tenant);
    if (existingDecision) return badRequest(reply, "REQUEST_ALREADY_DECIDED");

    let act_task_id: string | null = null; // Will remain null for REJECT.
    let ao_act_fact_id: string | null = null; // Will remain null for REJECT.
    let wrapper_task_created_fact_id: string | null = null; // Wrapper fact id for Commercial v1 paths.

    if (decision === "APPROVE") {
      const proposal = requestPayload.proposal; // Reuse request proposal as AO-ACT task input.
      const normalizedIssuer = (() => {
  if (proposal?.issuer && typeof proposal.issuer === "object") {
    const kind = String((proposal.issuer as any).kind ?? "human").trim() || "human";
    const id = String((proposal.issuer as any).id ?? auth.actor_id ?? auth.token_id ?? "unknown").trim() || "unknown";
    const namespace = String((proposal.issuer as any).namespace ?? "approval_decision_v1").trim() || "approval_decision_v1";
    return { kind, id, namespace };
  }
  return {
    kind: "human",
    id: String(auth.actor_id ?? auth.token_id ?? "unknown").trim() || "unknown",
    namespace: "approval_decision_v1"
  };
})();

const normalizedTarget = (() => {
  if (proposal?.target && typeof proposal.target === "object") {
    const kind = String((proposal.target as any).kind ?? "field").trim() || "field";
    const ref = String((proposal.target as any).ref ?? "").trim();
    if (ref) return { kind, ref };
  }
  const raw = String(proposal?.target ?? "").trim();
  const m = /^([a-zA-Z]+)\:(.+)$/.exec(raw);
  if (m) {
    const kindRaw = String(m[1]).toLowerCase();
    const ref = String(m[2]).trim() || raw;
    const kind = (kindRaw === "field" || kindRaw === "area" || kindRaw === "path") ? kindRaw : "field";
    return { kind, ref };
  }
  return { kind: "field", ref: raw || "unknown" };
})();

const delegated = await fetchJson(`${hostBaseUrl(req)}/api/control/ao_act/task`, String((req.headers as any).authorization ?? ""), {
  tenant_id: tenant.tenant_id,
  project_id: tenant.project_id,
  group_id: tenant.group_id,
  issuer: normalizedIssuer,
  action_type: proposal.action_type,
  target: normalizedTarget,
  time_window: proposal.time_window,
  parameter_schema: proposal.parameter_schema,
  parameters: proposal.parameters,
  constraints: proposal.constraints,
  meta: proposal.meta ?? {}
});
      if (!delegated.ok || !delegated.json?.ok) {
        return reply.status(400).send({ ok: false, error: "AO_ACT_TASK_CREATE_FAILED", detail: delegated.json ?? null });
      }
      act_task_id = String(delegated.json.act_task_id ?? "");
      ao_act_fact_id = String(delegated.json.fact_id ?? "");
      wrapper_task_created_fact_id = await insertFact(pool, "api/v1/ao-act/tasks", {
        type: "ao_act_task_created_v1",
        payload: {
          tenant_id: tenant.tenant_id,
          project_id: tenant.project_id,
          group_id: tenant.group_id,
          request_id,
          act_task_id,
          ao_act_fact_id,
          actor_id: auth.actor_id,
          token_id: auth.token_id,
          created_at_ts: Date.now()
        }
      }); // Wrapper fact gives Commercial v1 stable semantics without changing v0 core.
    }

    const decision_id = `apd_${randomUUID().replace(/-/g, "")}`; // Decision identifier exposed to clients.
    const decision_fact_id = await insertFact(pool, "api/v1/approvals", {
      type: "approval_decision_v1",
      payload: {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        decision_id,
        request_id,
        decision,
        act_task_id,
        ao_act_fact_id,
        actor_id: auth.actor_id,
        token_id: auth.token_id,
        created_at_ts: Date.now(),
        reason: body.reason ?? null
      }
    });

    const bridgedPlan = await bridgePlanDecisionToExecution(pool, tenant, request_id, decision as any, act_task_id, auth);

    return reply.send({ ok: true, request_id, decision_id, decision_fact_id, act_task_id, ao_act_fact_id, wrapper_task_created_fact_id, bridged_plan: bridgedPlan });
  });

  // POST /api/v1/ao-act/tasks
  // Explicit task create path for already-approved / low-level integrator flows.
  app.post("/api/v1/ao-act/tasks", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
    if (!auth) return;
    const body: any = req.body ?? {};
    const tenant: TenantTriple = {
      tenant_id: String(body.tenant_id ?? auth.tenant_id),
      project_id: String(body.project_id ?? auth.project_id),
      group_id: String(body.group_id ?? auth.group_id)
    };
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const delegated = await fetchJson(`${hostBaseUrl(req)}/api/control/ao_act/task`, String((req.headers as any).authorization ?? ""), {
      ...body,
      tenant_id: tenant.tenant_id,
      project_id: tenant.project_id,
      group_id: tenant.group_id
    });
    if (!delegated.ok || !delegated.json?.ok) return reply.status(delegated.status || 400).send(delegated.json ?? { ok: false, error: "TASK_CREATE_FAILED" });
    const wrapper_fact_id = await insertFact(pool, "api/v1/ao-act/tasks", {
      type: "ao_act_task_created_v1",
      payload: {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        act_task_id: delegated.json.act_task_id,
        ao_act_fact_id: delegated.json.fact_id,
        actor_id: auth.actor_id,
        token_id: auth.token_id,
        created_at_ts: Date.now()
      }
    });
    return reply.send({ ok: true, act_task_id: delegated.json.act_task_id, ao_act_fact_id: delegated.json.fact_id, wrapper_fact_id });
  });

  // GET /api/v1/ao-act/tasks
  app.get("/api/v1/ao-act/tasks", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = queryTenantFromReq(req, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const items = await listTasks(pool, tenant, parseLimit((req as any).query));
    return reply.send({ ok: true, items });
  });

  // GET /api/v1/ao-act/tasks/:act_task_id
  app.get("/api/v1/ao-act/tasks/:act_task_id", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = queryTenantFromReq(req, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const params: any = (req as any).params ?? {};
    const act_task_id = String(params.act_task_id ?? "").trim();
    if (!act_task_id) return badRequest(reply, "MISSING_ACT_TASK_ID");
    const items = await listTasks(pool, tenant, 200);
    const hit = items.find((x) => String(x?.task?.payload?.act_task_id ?? "") === act_task_id) ?? null;
    if (!hit) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return reply.send({ ok: true, item: hit });
  });

  // POST /api/v1/ao-act/tasks/:act_task_id/dispatch
  // Control-2 key behavior: explicit dispatch writes two facts:
  // - ao_act_task_dispatched_v1 (audit trail)
  // - ao_act_dispatch_outbox_v1 (adapter-readable queue item)
  // No automatic execution happens here.
  app.post("/api/v1/ao-act/tasks/:act_task_id/dispatch", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
    if (!auth) return;
    const params: any = (req as any).params ?? {};
    const body: any = req.body ?? {};
    const act_task_id = String(params.act_task_id ?? "").trim();
    if (!act_task_id) return badRequest(reply, "MISSING_ACT_TASK_ID");
    const tenant: TenantTriple = {
      tenant_id: String(body.tenant_id ?? auth.tenant_id),
      project_id: String(body.project_id ?? auth.project_id),
      group_id: String(body.group_id ?? auth.group_id)
    };
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const taskFact = await loadLatestFactByTypeAndKey(pool, "ao_act_task_v0", "payload,act_task_id", act_task_id, tenant);
    if (!taskFact) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    const latestReceipt = await loadLatestFactByTypeAndKey(pool, "ao_act_receipt_v0", "payload,act_task_id", act_task_id, tenant);
    if (latestReceipt) return badRequest(reply, "TASK_ALREADY_HAS_RECEIPT");

    const existingOutbox = await loadLatestFactByTypeAndKey(pool, "ao_act_dispatch_outbox_v1", "payload,act_task_id", act_task_id, tenant);
    if (existingOutbox) {
      const existingPayload = existingOutbox.record_json?.payload ?? {};
      await upsertDispatchQueueReady(pool, {
        tenant,
        queue_id: `dq_${randomUUID().replace(/-/g, "")}`,
        act_task_id,
        task_fact_id: String(existingPayload.task_fact_id ?? taskFact.fact_id),
        outbox_fact_id: existingOutbox.fact_id,
        device_id: typeof existingPayload.device_id === "string" ? existingPayload.device_id : null,
        downlink_topic: typeof existingPayload.downlink_topic === "string" ? existingPayload.downlink_topic : null,
        qos: Math.max(0, Math.min(2, Number.parseInt(String(existingPayload.qos ?? body.qos ?? "1"), 10) || 1)),
        retain: Boolean(existingPayload.retain ?? body.retain ?? false),
        adapter_hint: typeof existingPayload.adapter_hint === "string" ? existingPayload.adapter_hint : (body.adapter_hint ?? null)
      });
      return reply.send({ ok: true, act_task_id, dispatch_fact_id: null, outbox_fact_id: existingOutbox.fact_id, already_queued: true });
    } // Explicit idempotency: one open outbox item per task until receipt exists.

    const taskRecord = taskFact.record_json ?? {}; // Joined AO-ACT task record used to derive adapter hints.
    const device_id = deriveDispatchDeviceId(body, taskRecord); // Prefer explicit device id; fallback to task meta.
    const downlink_topic = deriveDispatchTopic(tenant, device_id, body); // Resolve MQTT topic once at queue time.
    const dispatch_mode = String(body.dispatch_mode ?? "OUTBOX_ONLY").trim() || "OUTBOX_ONLY"; // Stable dispatch mode marker.
    const qos = Math.max(0, Math.min(2, Number.parseInt(String(body.qos ?? "1"), 10) || 1)); // MQTT QoS clamp.
    const retain = Boolean(body.retain ?? false); // MQTT retain flag.

    const dispatch_fact_id = await insertFact(pool, "api/v1/ao-act/tasks/dispatch", {
      type: "ao_act_task_dispatched_v1",
      payload: {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        act_task_id,
        device_id,
        downlink_topic,
        qos,
        retain,
        actor_id: auth.actor_id,
        token_id: auth.token_id,
        dispatch_mode,
        adapter_hint: body.adapter_hint ?? null,
        created_at_ts: Date.now()
      }
    });
    const outbox_fact_id = await insertFact(pool, "api/v1/ao-act/dispatches", {
      type: "ao_act_dispatch_outbox_v1",
      payload: {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        act_task_id,
        task_fact_id: taskFact.fact_id,
        dispatch_fact_id,
        device_id,
        downlink_topic,
        qos,
        retain,
        adapter_hint: body.adapter_hint ?? null,
        created_at_ts: Date.now()
      }
    });
    await upsertDispatchQueueReady(pool, {
      tenant,
      queue_id: `dq_${randomUUID().replace(/-/g, "")}`,
      act_task_id,
      task_fact_id: String(taskFact.fact_id),
      outbox_fact_id,
      device_id,
      downlink_topic,
      qos,
      retain,
      adapter_hint: body.adapter_hint ?? null
    });
    return reply.send({ ok: true, act_task_id, dispatch_fact_id, outbox_fact_id, device_id, downlink_topic, qos, retain, already_queued: false });
  });


  // POST /api/v1/ao-act/dispatches/claim
  // Industrial runtime queue claim: atomically leases READY items to a single executor.
  app.post("/api/v1/ao-act/dispatches/claim", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
    if (!auth) return;
    const body: any = req.body ?? {};
    const tenant: TenantTriple = {
      tenant_id: String(body.tenant_id ?? auth.tenant_id),
      project_id: String(body.project_id ?? auth.project_id),
      group_id: String(body.group_id ?? auth.group_id)
    };
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const limit = Math.max(1, Math.min(50, Number.parseInt(String(body.limit ?? 1), 10) || 1));
    const lease_seconds = Math.max(5, Math.min(300, Number.parseInt(String(body.lease_seconds ?? 30), 10) || 30));
    const executor_id = String(body.executor_id ?? auth.actor_id ?? "executor").trim() || "executor";
    const lease_token = String(body.lease_token ?? `lease_${randomUUID().replace(/-/g, "")}`).trim();
    const actTaskId = typeof body.act_task_id === "string" && body.act_task_id.trim() ? body.act_task_id.trim() : undefined;
    const adapterHint = typeof body.adapter_hint === "string" && body.adapter_hint.trim() ? body.adapter_hint.trim() : undefined;
    const rows = await claimDispatchQueueRows(pool, tenant, limit, lease_seconds, executor_id, lease_token, actTaskId, adapterHint);
    const items = await listDispatchQueue(pool, tenant, limit * 5, actTaskId);
    const claimedIds = new Set(rows.map((r: any) => String(r.queue_id)));
    return reply.send({ ok: true, lease_token, items: items.filter((x: any) => claimedIds.has(String(x.queue_id))) });
  });

  // GET /api/v1/ao-act/dispatches
  // Explicit adapter queue: outbox facts with no receipt yet.
  app.get("/api/v1/ao-act/dispatches", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = queryTenantFromReq(req, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const q: any = (req as any).query ?? {};
    const actTaskId = typeof q.act_task_id === "string" && q.act_task_id.trim() ? q.act_task_id.trim() : undefined; // Optional server-side task filter for one-shot adapters.
    const items = await listDispatchQueue(pool, tenant, parseLimit(q), actTaskId);
    return reply.send({ ok: true, items });
  });

  // POST /api/v1/ao-act/downlinks/published
  // Adapter runtime writes one audit fact after a successful MQTT publish and before appending receipt.
  app.post("/api/v1/ao-act/downlinks/published", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
    if (!auth) return;
    const body: any = req.body ?? {};
    const tenant: TenantTriple = {
      tenant_id: String(body.tenant_id ?? auth.tenant_id),
      project_id: String(body.project_id ?? auth.project_id),
      group_id: String(body.group_id ?? auth.group_id)
    };
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const act_task_id = String(body.act_task_id ?? "").trim();
    const outbox_fact_id = String(body.outbox_fact_id ?? "").trim();
    const device_id = String(body.device_id ?? "").trim();
    const topic = String(body.topic ?? "").trim();
    if (!act_task_id) return badRequest(reply, "MISSING_ACT_TASK_ID");
    if (!outbox_fact_id) return badRequest(reply, "MISSING_OUTBOX_FACT_ID");
    if (!device_id) return badRequest(reply, "MISSING_DEVICE_ID");
    if (!topic) return badRequest(reply, "MISSING_TOPIC");
    const queueItem = await loadLatestFactByTypeAndKey(pool, "ao_act_dispatch_outbox_v1", "payload,act_task_id", act_task_id, tenant);
    if (!queueItem) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    if (String(queueItem.fact_id) !== outbox_fact_id) return badRequest(reply, "OUTBOX_FACT_MISMATCH");
    const existingPublished = await loadLatestDownlinkPublishedByOutboxFactId(pool, outbox_fact_id, tenant);
    if (existingPublished) {
      await updateDispatchQueueStateByOutbox(pool, outbox_fact_id, {
        state: "PUBLISHED",
        publish_fact_id: existingPublished.fact_id,
        leaseToken: typeof body.lease_token === "string" && body.lease_token.trim() ? body.lease_token.trim() : null,
        leasedBy: typeof body.executor_id === "string" && body.executor_id.trim() ? body.executor_id.trim() : null
      });
      return reply.send({ ok: true, published_fact_id: existingPublished.fact_id, already_published: true });
    } // Idempotent publish audit: same outbox fact maps to one published fact.
    const latestReceipt = await loadLatestFactByTypeAndKey(pool, "ao_act_receipt_v0", "payload,act_task_id", act_task_id, tenant);
    if (latestReceipt) return badRequest(reply, "TASK_ALREADY_HAS_RECEIPT");
    const published_fact_id = await insertFact(pool, "api/v1/ao-act/downlinks/published", {
      type: "ao_act_downlink_published_v1",
      payload: {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        act_task_id,
        outbox_fact_id,
        device_id,
        topic,
        qos: Number(body.qos ?? 1),
        retain: Boolean(body.retain ?? false),
        adapter_runtime: String(body.adapter_runtime ?? "mqtt_downlink_once_v1"),
        adapter_message_id: body.adapter_message_id ?? null,
        command_payload_sha256: String(body.command_payload_sha256 ?? sha256Json(body.command_payload ?? null)),
        actor_id: auth.actor_id,
        token_id: auth.token_id,
        created_at_ts: Date.now()
      }
    });
    await updateDispatchQueueStateByOutbox(pool, outbox_fact_id, {
      state: "PUBLISHED",
      publish_fact_id: published_fact_id,
      leaseToken: typeof body.lease_token === "string" && body.lease_token.trim() ? body.lease_token.trim() : null,
      leasedBy: typeof body.executor_id === "string" && body.executor_id.trim() ? body.executor_id.trim() : null
    });
    return reply.send({ ok: true, published_fact_id });
  });

  // GET /api/v1/ao-act/downlinks
  // Read-only list of published downlink audit facts.
  app.get("/api/v1/ao-act/downlinks", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = queryTenantFromReq(req, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const q: any = (req as any).query ?? {};
    const sql = `
      SELECT fact_id, occurred_at, source, (record_json::jsonb) AS record_json
      FROM facts
      WHERE (record_json::jsonb->>'type') = 'ao_act_downlink_published_v1'
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND (record_json::jsonb#>>'{payload,project_id}') = $2
        AND (record_json::jsonb#>>'{payload,group_id}') = $3
        AND ($4::text IS NULL OR (record_json::jsonb#>>'{payload,act_task_id}') = $4)
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT $5
    `;
    const res = await pool.query(sql, [tenant.tenant_id, tenant.project_id, tenant.group_id, typeof q.act_task_id === "string" ? q.act_task_id : null, parseLimit(q)]);
    const items = (res.rows ?? []).map((row: any) => ({
      fact_id: String(row.fact_id),
      occurred_at: String(row.occurred_at),
      source: String(row.source),
      downlink: parseJsonMaybe(row.record_json) ?? row.record_json
    }));
    return reply.send({ ok: true, items });
  });


  // POST /api/v1/ao-act/receipts/uplink
  // MQTT receipt uplink ingestion path: append device-ack audit fact, then delegate into stable receipt runtime.
  app.post("/api/v1/ao-act/receipts/uplink", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.receipt.write");
    if (!auth) return;
    const body: any = req.body ?? {};
    const tenant: TenantTriple = {
      tenant_id: String(body.tenant_id ?? auth.tenant_id),
      project_id: String(body.project_id ?? auth.project_id),
      group_id: String(body.group_id ?? auth.group_id)
    };
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const act_task_id = String(body.act_task_id ?? body.command_id ?? "").trim();
    const device_id = String(body.device_id ?? "").trim();
    if (!act_task_id) return badRequest(reply, "MISSING_ACT_TASK_ID");
    if (!device_id) return badRequest(reply, "MISSING_DEVICE_ID");
    const taskFact = await loadLatestFactByTypeAndKey(pool, "ao_act_task_v0", "payload,act_task_id", act_task_id, tenant);
    if (!taskFact) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    const publishedFact = await loadLatestFactByTypeAndKey(pool, "ao_act_downlink_published_v1", "payload,act_task_id", act_task_id, tenant);
    if (!publishedFact) return badRequest(reply, "RECEIPT_BEFORE_PUBLISH");
    const publishedPayload = publishedFact.record_json?.payload ?? {};
    const expectedDeviceId = String(publishedPayload.device_id ?? "").trim();
    if (expectedDeviceId && expectedDeviceId !== device_id) return badRequest(reply, "DEVICE_ID_MISMATCH");
    const existingReceipt = await loadLatestFactByTypeAndKey(pool, "ao_act_receipt_v0", "payload,act_task_id", act_task_id, tenant);
    if (existingReceipt) return reply.status(409).send({ ok: false, error: "DUPLICATE_RECEIPT" });
    const ack_fact_id = await insertFact(pool, "api/v1/ao-act/receipts/uplink", {
      type: "ao_act_device_ack_received_v1",
      payload: {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        act_task_id,
        device_id,
        uplink_topic: deriveReceiptTopic(tenant, device_id, body),
        receipt_message_id: body.receipt_message_id ?? null,
        command_payload_sha256: String(body.command_payload_sha256 ?? sha256Json(body.raw_payload ?? body)),
        status: String(body.status ?? "executed"),
        adapter_runtime: String(body.adapter_runtime ?? "mqtt_receipt_uplink_once_v1"),
        actor_id: auth.actor_id,
        token_id: auth.token_id,
        created_at_ts: Date.now()
      }
    });
    const delegated = await fetchJson(`${hostBaseUrl(req)}/api/v1/ao-act/receipts`, String((req.headers as any).authorization ?? ""), {
      tenant_id: tenant.tenant_id,
      project_id: tenant.project_id,
      group_id: tenant.group_id,
      act_task_id,
      executor_id: body.executor_id ?? { kind: "device", id: device_id, namespace: "mqtt_device_v1" },
      execution_time: body.execution_time ?? { start_ts: Number(body.start_ts ?? Date.now() - 50), end_ts: Number(body.end_ts ?? Date.now()) },
      execution_coverage: body.execution_coverage ?? { kind: "field", ref: "device_uplink" },
      resource_usage: body.resource_usage ?? { fuel_l: 0, electric_kwh: 0, water_l: 0, chemical_ml: 0 },
      logs_refs: body.logs_refs ?? [{ kind: "mqtt", ref: deriveReceiptTopic(tenant, device_id, body) }],
      status: String(body.status ?? "executed"),
      constraint_check: body.constraint_check ?? { violated: false, violations: [] },
      observed_parameters: body.observed_parameters ?? {},
      meta: {
        ...(body.meta && typeof body.meta === "object" ? body.meta : {}),
        receipt_message_id: body.receipt_message_id ?? null,
        device_id,
        uplink_topic: deriveReceiptTopic(tenant, device_id, body),
        runtime: String(body.adapter_runtime ?? "mqtt_receipt_uplink_once_v1")
      }
    });
    if (!delegated.ok || !delegated.json?.ok) return reply.status(delegated.status || 400).send(delegated.json ?? { ok: false, error: "RECEIPT_UPLINK_WRITE_FAILED" });
    await updateDispatchQueueStateByActTask(pool, tenant, act_task_id, { state: "ACKED", ack_fact_id });
    return reply.send({ ok: true, ack_fact_id, fact_id: delegated.json.fact_id, wrapper_fact_id: delegated.json.wrapper_fact_id });
  });


  // GET /api/v1/operations/console
  // Operations workbench aggregate for approvals, monitoring, queue and receipts.
  app.get("/api/v1/operations/console", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = queryTenantFromReq(req, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const payload = await buildOperationsConsole(pool, tenant);
    return reply.send({ ok: true, ...payload });
  });

  // POST /api/v1/ao-act/tasks/:act_task_id/retry
  // Restricted retry helper: re-queue a task only while it has no receipt yet.
  app.post("/api/v1/ao-act/tasks/:act_task_id/retry", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
    if (!auth) return;
    if (!requireAoActAdminV0(req, reply, { deniedError: "ROLE_APPROVAL_ADMIN_REQUIRED" })) return;
    const params: any = (req as any).params ?? {};
    const body: any = req.body ?? {};
    const act_task_id = String(params.act_task_id ?? "").trim();
    if (!act_task_id) return badRequest(reply, "MISSING_ACT_TASK_ID");
    const tenant: TenantTriple = {
      tenant_id: String(body.tenant_id ?? auth.tenant_id),
      project_id: String(body.project_id ?? auth.project_id),
      group_id: String(body.group_id ?? auth.group_id)
    };
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const existingTask = await loadLatestFactByTypeAndKey(pool, "ao_act_task_v0", "payload,act_task_id", act_task_id, tenant);
    if (!existingTask) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    const existingReceipt = await loadLatestFactByTypeAndKey(pool, "ao_act_receipt_v0", "payload,act_task_id", act_task_id, tenant);
    if (existingReceipt) return badRequest(reply, "TASK_ALREADY_HAS_RECEIPT");

    const delegated = await fetchJson(`${hostBaseUrl(req)}/api/v1/ao-act/tasks/${encodeURIComponent(act_task_id)}/dispatch`, String((req.headers as any).authorization ?? ""), {
      tenant_id: tenant.tenant_id,
      project_id: tenant.project_id,
      group_id: tenant.group_id,
      device_id: body.device_id ?? null,
      downlink_topic: body.downlink_topic ?? null,
      adapter_hint: body.adapter_hint ?? null,
      retry_reason: body.retry_reason ?? null
    });
    if (!delegated.ok || !delegated.json?.ok) return reply.status(delegated.status || 400).send(delegated.json ?? { ok: false, error: "RETRY_FAILED" });
    return reply.send({ ok: true, retry_allowed: true, act_task_id, dispatch: delegated.json });
  });

  // GET /api/v1/ao-act/device-acks
  // Read-only list of MQTT/device-side acknowledgement audit facts.
  app.get("/api/v1/ao-act/device-acks", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = queryTenantFromReq(req, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const q: any = (req as any).query ?? {};
    const sql = `
      SELECT fact_id, occurred_at, source, (record_json::jsonb) AS record_json
      FROM facts
      WHERE (record_json::jsonb->>'type') = 'ao_act_device_ack_received_v1'
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND (record_json::jsonb#>>'{payload,project_id}') = $2
        AND (record_json::jsonb#>>'{payload,group_id}') = $3
        AND ($4::text IS NULL OR (record_json::jsonb#>>'{payload,act_task_id}') = $4)
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT $5
    `;
    const res = await pool.query(sql, [tenant.tenant_id, tenant.project_id, tenant.group_id, typeof q.act_task_id === "string" ? q.act_task_id : null, parseLimit(q)]);
    const items = (res.rows ?? []).map((row: any) => ({
      fact_id: String(row.fact_id),
      occurred_at: String(row.occurred_at),
      source: String(row.source),
      ack: parseJsonMaybe(row.record_json) ?? row.record_json
    }));
    return reply.send({ ok: true, items });
  });

  // POST /api/v1/ao-act/receipts
  // Delegates to existing receipt runtime and adds a stable wrapper fact for Commercial v1 REST.
  app.post("/api/v1/ao-act/receipts", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.receipt.write");
    if (!auth) return;
    const body: any = req.body ?? {};
    const tenant: TenantTriple = {
      tenant_id: String(body.tenant_id ?? auth.tenant_id),
      project_id: String(body.project_id ?? auth.project_id),
      group_id: String(body.group_id ?? auth.group_id)
    };
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const delegated = await fetchJson(`${hostBaseUrl(req)}/api/control/ao_act/receipt`, String((req.headers as any).authorization ?? ""), {
      ...body,
      tenant_id: tenant.tenant_id,
      project_id: tenant.project_id,
      group_id: tenant.group_id
    });
    if (!delegated.ok || !delegated.json?.ok) return reply.status(delegated.status || 400).send(delegated.json ?? { ok: false, error: "RECEIPT_WRITE_FAILED" });
    const wrapper_fact_id = await insertFact(pool, "api/v1/ao-act/receipts", {
      type: "ao_act_receipt_recorded_v1",
      payload: {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        act_task_id: body.act_task_id,
        ao_act_receipt_fact_id: delegated.json.fact_id,
        actor_id: auth.actor_id,
        token_id: auth.token_id,
        created_at_ts: Date.now()
      }
    });
    await updateDispatchQueueStateByActTask(pool, tenant, String(body.act_task_id ?? ""), { state: "RECEIPTED", receipt_fact_id: delegated.json.fact_id });
    return reply.send({ ok: true, fact_id: delegated.json.fact_id, wrapper_fact_id });
  });

  // GET /api/v1/ao-act/receipts
  app.get("/api/v1/ao-act/receipts", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = queryTenantFromReq(req, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const q: any = (req as any).query ?? {};
    const items = await listReceipts(pool, tenant, parseLimit(q), typeof q.act_task_id === "string" ? q.act_task_id : undefined);
    return reply.send({ ok: true, items });
  });
}
