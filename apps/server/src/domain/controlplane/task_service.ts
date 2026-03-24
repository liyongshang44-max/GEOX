// GEOX/apps/server/src/routes/controlplane_v1.ts
// Control Plane v1 wrapper routes for Commercial Control-2.
// This layer does three things only:
// 1) exposes stable /api/v1/* REST paths;
// 2) keeps the existing v0 AO-ACT / approval runtime as the execution core;
// 3) adds explicit dispatch/outbox facts so adapters can drain a bounded queue without auto-scheduling.

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"; // Fastify types for route handlers.
import type { Pool } from "pg"; // Postgres pool typing.
import { createHash, randomUUID } from "node:crypto"; // Stable unique ids for wrapper facts + payload hashing.
import { requireAoActScopeV0, requireAoActAdminV0, type AoActAuthContextV0 } from "../../auth/ao_act_authz_v0"; // Reuse existing token/scope auth.

type TenantTriple = { tenant_id: string; project_id: string; group_id: string }; // Hard-isolation tenant triple.

type ParsedFactRow = { fact_id: string; occurred_at: string; source: string; record_json: any }; // Normalized fact row.
type OperationPlanStateReadModelRow = {
  plan_id: string;
  status: string;
  device_id: string | null;
  field_id: string | null;
  last_transition: string | null;
  receipt_status: string | null;
}; // Canonical state-centric read model row for UI/backend convergence.

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
    tenant_id: typeof q.tenant_id === "string" ? q.tenant_id.trim() : "",
    project_id: typeof q.project_id === "string" ? q.project_id.trim() : "",
    group_id: typeof q.group_id === "string" ? q.group_id.trim() : ""
  }; // Require explicit tenant triple in query for anti-enumeration hardening.
}

function parseTenantFromBody(body: any): TenantTriple {
  return {
    tenant_id: String(body?.tenant_id ?? "").trim(),
    project_id: String(body?.project_id ?? "").trim(),
    group_id: String(body?.group_id ?? "").trim()
  }; // Require explicit tenant triple in body for all write endpoints.
}

function requireTenantFieldsPresentOr400(tenant: TenantTriple, reply: FastifyReply): boolean {
  if (!tenant.tenant_id || !tenant.project_id || !tenant.group_id) {
    reply.status(400).send({ ok: false, error: "MISSING_TENANT_SCOPE" }); // Require explicit tenant fields.
    return false;
  }
  return true;
}

async function ensureDeviceBelongsTenantOr404(pool: Pool, tenant: TenantTriple, device_id: string): Promise<boolean> {
  const q = await pool.query(
    `SELECT 1
       FROM device_index_v1
      WHERE tenant_id = $1 AND device_id = $2
      LIMIT 1`,
    [tenant.tenant_id, device_id]
  ); // Object-level validation: device must exist in tenant projection.
  return (q.rowCount ?? 0) > 0;
}

async function insertFact(pool: Pool, source: string, record_json: any): Promise<string> {
  const fact_id = randomUUID(); // Wrapper fact id.
  await pool.query(
    "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
    [fact_id, source, record_json]
  ); // Append-only insert.
  return fact_id; // Return created fact id.
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
          command_id text NOT NULL,
          task_fact_id text NOT NULL,
          outbox_fact_id text NOT NULL,
          device_id text NULL,
          downlink_topic text NULL,
          qos integer NOT NULL DEFAULT 1,
          retain boolean NOT NULL DEFAULT false,
          adapter_hint text NULL,
          state text NOT NULL,
          claim_id text NULL,
          lease_token text NULL,
          leased_by text NULL,
          lease_expires_at timestamptz NULL,
          lease_expire_at bigint NULL,
          claimed_by text NULL,
          claimed_ts bigint NULL,
          lease_until_ts bigint NULL,
          publish_fact_id text NULL,
          ack_fact_id text NULL,
          receipt_fact_id text NULL,
          attempt_no integer NOT NULL DEFAULT 0,
          attempt_count integer NOT NULL DEFAULT 0,
          last_error text NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT dispatch_queue_v1_state_ck CHECK (state IN ('CREATED','READY','DISPATCHED','ACKED','SUCCEEDED','FAILED')),
          CONSTRAINT dispatch_queue_v1_task_unique UNIQUE (tenant_id, project_id, group_id, act_task_id),
          CONSTRAINT dispatch_queue_v1_command_unique UNIQUE (tenant_id, project_id, group_id, command_id)
        )
      `); // Runtime queue state lives outside the append-only ledger.
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_dispatch_queue_v1_ready ON dispatch_queue_v1 (tenant_id, project_id, group_id, state, created_at)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_dispatch_queue_v1_outbox ON dispatch_queue_v1 (outbox_fact_id)`);
      await pool.query(`ALTER TABLE dispatch_queue_v1 ADD COLUMN IF NOT EXISTS command_id text`);
      await pool.query(`ALTER TABLE dispatch_queue_v1 ADD COLUMN IF NOT EXISTS claim_id text`);
      await pool.query(`ALTER TABLE dispatch_queue_v1 ADD COLUMN IF NOT EXISTS claimed_by text`);
      await pool.query(`ALTER TABLE dispatch_queue_v1 ADD COLUMN IF NOT EXISTS claimed_ts bigint`);
      await pool.query(`ALTER TABLE dispatch_queue_v1 ADD COLUMN IF NOT EXISTS lease_until_ts bigint`);
      await pool.query(`ALTER TABLE dispatch_queue_v1 ADD COLUMN IF NOT EXISTS lease_expire_at bigint`);
      await pool.query(`ALTER TABLE dispatch_queue_v1 ADD COLUMN IF NOT EXISTS attempt_no integer NOT NULL DEFAULT 0`);
      await pool.query(`ALTER TABLE dispatch_queue_v1 ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0`);
      await pool.query(`UPDATE dispatch_queue_v1 SET command_id = act_task_id WHERE command_id IS NULL OR command_id = ''`);
      await pool.query(`ALTER TABLE dispatch_queue_v1 ALTER COLUMN command_id SET NOT NULL`);
      await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dispatch_queue_v1_command_unique') THEN ALTER TABLE dispatch_queue_v1 ADD CONSTRAINT dispatch_queue_v1_command_unique UNIQUE (tenant_id, project_id, group_id, command_id); END IF; END $$;`);
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
  command_id: string;
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
       queue_id, tenant_id, project_id, group_id, act_task_id, command_id, task_fact_id, outbox_fact_id,
       device_id, downlink_topic, qos, retain, adapter_hint, state,
       created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'READY',NOW(),NOW())
     ON CONFLICT (tenant_id, project_id, group_id, act_task_id)
     DO UPDATE SET
       command_id = EXCLUDED.command_id,
       task_fact_id = EXCLUDED.task_fact_id,
       outbox_fact_id = EXCLUDED.outbox_fact_id,
       device_id = EXCLUDED.device_id,
       downlink_topic = EXCLUDED.downlink_topic,
       qos = EXCLUDED.qos,
       retain = EXCLUDED.retain,
       adapter_hint = EXCLUDED.adapter_hint,
       state = CASE WHEN dispatch_queue_v1.state IN ('SUCCEEDED','FAILED') THEN dispatch_queue_v1.state ELSE 'READY' END,
       claim_id = NULL,
       lease_token = NULL,
       leased_by = NULL,
       lease_expires_at = NULL,
       lease_expire_at = NULL,
       lease_until_ts = NULL,
       updated_at = NOW()`,
    [
      row.queue_id,
      row.tenant.tenant_id,
      row.tenant.project_id,
      row.tenant.group_id,
      row.act_task_id,
      row.command_id,
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

async function enqueueReadyDispatchForTask(
  pool: Pool,
  auth: AoActAuthContextV0,
  tenant: TenantTriple,
  taskFact: ParsedFactRow,
  operationPlan: ParsedFactRow
): Promise<{
  outbox_fact_id: string;
  device_id: string | null;
  downlink_topic: string | null;
  adapter_hint: string | null;
}> {
  const taskPayload = taskFact.record_json?.payload ?? {};
  const planPayload = operationPlan.record_json?.payload ?? {};

  const act_task_id = String(taskPayload.act_task_id ?? "").trim();
  const command_id = String(taskPayload.command_id ?? act_task_id).trim() || act_task_id;
  if (!act_task_id) throw new Error("MISSING_ACT_TASK_ID_FOR_QUEUE_READY");

  const device_id =
    typeof taskPayload?.meta?.device_id === "string" && taskPayload.meta.device_id.trim()
      ? String(taskPayload.meta.device_id).trim()
      : null;

  const downlink_topic = device_id ? `/device/${device_id}/cmd` : null;

  const planAdapterType =
    typeof planPayload?.adapter_type === "string" && planPayload.adapter_type.trim()
      ? String(planPayload.adapter_type).trim()
      : null;

  const metaAdapterType =
    typeof taskPayload?.meta?.adapter_type === "string" && String(taskPayload.meta.adapter_type).trim()
      ? String(taskPayload.meta.adapter_type).trim()
      : null;

  const adapter_hint = normalizeAdapterHint(planAdapterType ?? metaAdapterType);

  const qos = 1;
  const retain = false;
  const dispatch_mode = "OUTBOX_ONLY";

  const outbox_fact_id = await insertFact(pool, "api/v1/ao-act/tasks/dispatch", {
    type: "ao_act_dispatch_outbox_v1",
    payload: {
      tenant_id: tenant.tenant_id,
      project_id: tenant.project_id,
      group_id: tenant.group_id,
      act_task_id,
      command_id,
      task_fact_id: taskFact.fact_id,
      device_id,
      downlink_topic,
      qos,
      retain,
      actor_id: auth.actor_id,
      token_id: auth.token_id,
      dispatch_mode,
      adapter_hint,
      created_at_ts: Date.now()
    }
  });

  await upsertDispatchQueueReady(pool, {
    tenant,
    queue_id: `dq_${randomUUID().replace(/-/g, "")}`,
    act_task_id,
    command_id,
    task_fact_id: String(taskFact.fact_id),
    outbox_fact_id,
    device_id,
    downlink_topic,
    qos,
    retain,
    adapter_hint
  });

  return {
    outbox_fact_id,
    device_id,
    downlink_topic,
    adapter_hint
  };
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
            OR (
              state = 'DISPATCHED'
              AND lease_until_ts IS NOT NULL
              AND lease_until_ts <= (extract(epoch from now()) * 1000)::bigint
            )
          )
        ORDER BY created_at ASC, queue_id ASC
        FOR UPDATE SKIP LOCKED
        LIMIT $6
      )
      UPDATE dispatch_queue_v1 q
      SET state = 'DISPATCHED',
          claim_id = $7,
          lease_token = $7,
          leased_by = $8,
          claimed_by = $8,
          claimed_ts = (extract(epoch from now()) * 1000)::bigint,
          lease_expire_at = ((extract(epoch from now()) * 1000)::bigint + ($9::bigint * 1000)),
          lease_until_ts = ((extract(epoch from now()) * 1000)::bigint + ($9::bigint * 1000)),
          lease_expires_at = NOW() + make_interval(secs => $9::int),
          attempt_count = q.attempt_count + 1,
          attempt_no = q.attempt_no + 1,
          updated_at = NOW()
      FROM cte
      WHERE q.queue_id = cte.queue_id
      RETURNING q.*
    `;
    const normalizedAdapterHint = normalizeAdapterHint(adapterHint);
    const res = await client.query(sql, [tenant.tenant_id, tenant.project_id, tenant.group_id, actTaskId ?? null, normalizedAdapterHint, limit, leaseToken, executorId, leaseSeconds]);
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
  patch: { state: 'DISPATCHED' | 'ACKED' | 'SUCCEEDED' | 'FAILED'; publish_fact_id?: string | null; ack_fact_id?: string | null; receipt_fact_id?: string | null; leaseToken?: string | null; leasedBy?: string | null }
): Promise<void> {
  await ensureDispatchQueueRuntime(pool);
  const fields = ["state = $2", "updated_at = NOW()"];
  const values: any[] = [outboxFactId, patch.state];
  let idx = 3;
  if (patch.publish_fact_id !== undefined) { fields.push(`publish_fact_id = $${idx++}`); values.push(patch.publish_fact_id); }
  if (patch.ack_fact_id !== undefined) { fields.push(`ack_fact_id = $${idx++}`); values.push(patch.ack_fact_id); }
  if (patch.receipt_fact_id !== undefined) { fields.push(`receipt_fact_id = $${idx++}`); values.push(patch.receipt_fact_id); }
  if (patch.state === 'SUCCEEDED' || patch.state === 'FAILED') {
    fields.push('claim_id = NULL', 'lease_token = NULL', 'leased_by = NULL', 'lease_expires_at = NULL', 'lease_expire_at = NULL', 'lease_until_ts = NULL');
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
  patch: { state: 'ACKED' | 'SUCCEEDED' | 'FAILED'; ack_fact_id?: string | null; receipt_fact_id?: string | null }
): Promise<void> {
  await ensureDispatchQueueRuntime(pool);
  const fields = ["state = $5", "updated_at = NOW()"];
  const values: any[] = [tenant.tenant_id, tenant.project_id, tenant.group_id, actTaskId, patch.state];
  let idx = 6;
  if (patch.ack_fact_id !== undefined) { fields.push(`ack_fact_id = $${idx++}`); values.push(patch.ack_fact_id); }
  if (patch.receipt_fact_id !== undefined) { fields.push(`receipt_fact_id = $${idx++}`); values.push(patch.receipt_fact_id); }
  if (patch.state === 'SUCCEEDED' || patch.state === 'FAILED') {
    fields.push('claim_id = NULL', 'lease_token = NULL', 'leased_by = NULL', 'lease_expires_at = NULL', 'lease_expire_at = NULL', 'lease_until_ts = NULL');
  }
  await pool.query(
    `UPDATE dispatch_queue_v1 SET ${fields.join(', ')} WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND act_task_id = $4`,
    values
  );
}


async function transitionDispatchQueueState(
  pool: Pool,
  tenant: TenantTriple,
  actTaskId: string,
  commandId: string,
  nextState: 'DISPATCHED' | 'ACKED' | 'SUCCEEDED' | 'FAILED'
): Promise<boolean> {
  await ensureDispatchQueueRuntime(pool);
  const allowedCurrentStates =
    nextState === 'DISPATCHED' ? ['READY', 'DISPATCHED'] :
    nextState === 'ACKED' ? ['DISPATCHED'] :
    nextState === 'SUCCEEDED' ? ['ACKED', 'DISPATCHED'] :
    ['READY', 'DISPATCHED', 'ACKED'];
  const result = await pool.query(
    `UPDATE dispatch_queue_v1
     SET state = $6, updated_at = NOW()
     WHERE tenant_id = $1
       AND project_id = $2
       AND group_id = $3
       AND act_task_id = $4
       AND command_id = $5
       AND state = ANY($7::text[])`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, actTaskId, commandId, nextState, allowedCurrentStates]
  );
  return Number(result.rowCount ?? 0) > 0;
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

async function loadLatestReceiptByCommandId(
  pool: Pool,
  commandId: string,
  tenant: TenantTriple
): Promise<ParsedFactRow | null> {
  const sql = `
    SELECT fact_id, occurred_at, source, record_json
    FROM facts
    WHERE (record_json::jsonb->>'type') IN ('ao_act_receipt_v0','ao_act_receipt_v1')
      AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
      AND (record_json::jsonb#>>'{payload,project_id}') = $2
      AND (record_json::jsonb#>>'{payload,group_id}') = $3
      AND (
        (record_json::jsonb#>>'{payload,meta,command_id}') = $4
        OR (record_json::jsonb#>>'{payload,act_task_id}') = $4
      )
    ORDER BY occurred_at DESC, fact_id DESC
    LIMIT 1
  `;
  const res = await pool.query(sql, [tenant.tenant_id, tenant.project_id, tenant.group_id, commandId]);
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
      WHERE (record_json::jsonb->>'type') IN ('ao_act_receipt_v0','ao_act_receipt_v1')
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


async function loadLatestOperationPlanByApprovalRequestId(
  pool: Pool,
  approval_request_id: string,
  tenant: TenantTriple
): Promise<ParsedFactRow | null> {
  return loadLatestFactByTypeAndKey(pool, "operation_plan_v1", "payload,approval_request_id", approval_request_id, tenant);
}

type OperationPlanStatusV1 = "CREATED" | "APPROVED" | "READY" | "DISPATCHED" | "ACKED" | "SUCCEEDED" | "FAILED";

const OPERATION_PLAN_NEXT_STATUS_V1: Record<Exclude<OperationPlanStatusV1, "SUCCEEDED" | "FAILED">, OperationPlanStatusV1> = {
  CREATED: "APPROVED",
  APPROVED: "READY",
  READY: "DISPATCHED",
  DISPATCHED: "ACKED",
  ACKED: "SUCCEEDED"
};

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
  source: string
): Promise<{ transition_fact_id: string; operation_plan_fact_id: string }> {
  const payload = operationPlanFact.record_json?.payload ?? {};
const operation_plan_id = String(payload.operation_plan_id ?? "").trim();
if (!operation_plan_id) throw new Error("MISSING_OPERATION_PLAN_ID");

const currentStatusRaw = String(payload.status ?? "").trim().toUpperCase();
const current_status: OperationPlanStatusV1 = (currentStatusRaw || "CREATED") as OperationPlanStatusV1;
const next_status = transition.next_status;

if (current_status === "SUCCEEDED" || current_status === "FAILED") {
  throw new Error("OPERATION_PLAN_TERMINAL");
}

const allowedNextStatuses: Record<OperationPlanStatusV1, OperationPlanStatusV1[]> = {
  CREATED: ["APPROVED"],
  APPROVED: ["READY"],
  READY: ["DISPATCHED"],
  DISPATCHED: ["ACKED", "FAILED"],
  ACKED: ["SUCCEEDED", "FAILED"],
  SUCCEEDED: [],
  FAILED: []
};

const allowed = allowedNextStatuses[current_status] ?? [];
if (!allowed.includes(next_status)) {
  throw new Error(`INVALID_OPERATION_PLAN_TRANSITION:${current_status}->${next_status}`);
}

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
      from_status: current_status,
      status: next_status,
      trigger: transition.trigger,
      approval_request_id: transition.approval_request_id ?? payload.approval_request_id ?? null,
      decision: transition.decision ?? null,
      decision_fact_id: transition.decision_fact_id ?? null,
      act_task_id: transition.act_task_id ?? payload.act_task_id ?? null,
      receipt_fact_id: transition.receipt_fact_id ?? payload.receipt_fact_id ?? null,
      terminal_reason: transition.terminal_reason ?? null,
      created_ts: Date.now()
    }
  });
  const operation_plan_fact_id = await insertFact(pool, source, {
    type: "operation_plan_v1",
    payload: {
      ...payload,
      tenant_id: tenant.tenant_id,
      project_id: tenant.project_id,
      group_id: tenant.group_id,
      operation_plan_id,
      program_id: payload.program_id ?? null,
      field_id: payload.field_id ?? payload.target?.ref ?? null,
      season_id: payload.season_id ?? null,
      status: next_status,
      approval_request_id: transition.approval_request_id ?? payload.approval_request_id ?? null,
      act_task_id: transition.act_task_id ?? payload.act_task_id ?? null,
      receipt_fact_id: transition.receipt_fact_id ?? payload.receipt_fact_id ?? null,
      updated_ts: Date.now()
    }
  });
  return { transition_fact_id, operation_plan_fact_id };
}

async function ensureOperationPlanAtLeastDispatched(
  pool: Pool,
  tenant: TenantTriple,
  operation_plan_id: string,
  act_task_id: string,
  source: string,
  trigger: string
): Promise<{ transition_fact_id: string; operation_plan_fact_id: string } | null> {
  const latestPlan = await loadLatestFactByTypeAndKey(
    pool,
    "operation_plan_v1",
    "payload,operation_plan_id",
    operation_plan_id,
    tenant
  );
  if (!latestPlan) return null;

  const currentStatus = String(latestPlan.record_json?.payload?.status ?? "").trim().toUpperCase();
  if (currentStatus === "READY") {
    return transitionOperationPlanStateV1(
      pool,
      tenant,
      latestPlan,
      {
        next_status: "DISPATCHED",
        trigger,
        act_task_id
      },
      source
    );
  }
  return null;
}

async function listOperationPlans(pool: Pool, tenant: TenantTriple, limit: number): Promise<any[]> {
  const sql = `
    WITH latest_transition AS (
      SELECT DISTINCT ON ((record_json::jsonb#>>'{payload,operation_plan_id}'))
        (record_json::jsonb#>>'{payload,operation_plan_id}') AS operation_plan_id,
        fact_id AS transition_fact_id,
        occurred_at AS transition_occurred_at,
        (record_json::jsonb) AS transition_json
      FROM facts
      WHERE (record_json::jsonb->>'type') = 'operation_plan_transition_v1'
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND (record_json::jsonb#>>'{payload,project_id}') = $2
        AND (record_json::jsonb#>>'{payload,group_id}') = $3
      ORDER BY (record_json::jsonb#>>'{payload,operation_plan_id}'), occurred_at DESC, fact_id DESC
    ), latest_approval AS (
      SELECT DISTINCT ON ((record_json::jsonb#>>'{payload,request_id}'))
        (record_json::jsonb#>>'{payload,request_id}') AS request_id,
        fact_id AS approval_decision_fact_id,
        occurred_at AS approval_decision_occurred_at,
        (record_json::jsonb) AS approval_decision_json
      FROM facts
      WHERE (record_json::jsonb->>'type') = 'approval_decision_v1'
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND (record_json::jsonb#>>'{payload,project_id}') = $2
        AND (record_json::jsonb#>>'{payload,group_id}') = $3
      ORDER BY (record_json::jsonb#>>'{payload,request_id}'), occurred_at DESC, fact_id DESC
    ), latest_receipt AS (
      SELECT DISTINCT ON ((record_json::jsonb#>>'{payload,act_task_id}'))
        (record_json::jsonb#>>'{payload,act_task_id}') AS act_task_id,
        fact_id AS receipt_fact_id,
        occurred_at AS receipt_occurred_at,
        (record_json::jsonb) AS receipt_json
      FROM facts
      WHERE (record_json::jsonb->>'type') IN ('ao_act_receipt_v0','ao_act_receipt_v1')
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND (record_json::jsonb#>>'{payload,project_id}') = $2
        AND (record_json::jsonb#>>'{payload,group_id}') = $3
      ORDER BY (record_json::jsonb#>>'{payload,act_task_id}'), occurred_at DESC, fact_id DESC
    )
    SELECT p.fact_id AS operation_plan_fact_id,
           p.occurred_at AS operation_plan_occurred_at,
           (p.record_json::jsonb) AS operation_plan_json,
           t.transition_fact_id,
           t.transition_occurred_at,
           t.transition_json,
           a.approval_decision_fact_id,
           a.approval_decision_occurred_at,
           a.approval_decision_json,
           r.receipt_fact_id,
           r.receipt_occurred_at,
           r.receipt_json
    FROM facts p
    LEFT JOIN latest_transition t ON (p.record_json::jsonb#>>'{payload,operation_plan_id}') = t.operation_plan_id
    LEFT JOIN latest_approval a ON (p.record_json::jsonb#>>'{payload,approval_request_id}') = a.request_id
    LEFT JOIN latest_receipt r ON (p.record_json::jsonb#>>'{payload,act_task_id}') = r.act_task_id
    WHERE (p.record_json::jsonb->>'type') = 'operation_plan_v1'
      AND (p.record_json::jsonb#>>'{payload,tenant_id}') = $1
      AND (p.record_json::jsonb#>>'{payload,project_id}') = $2
      AND (p.record_json::jsonb#>>'{payload,group_id}') = $3
    ORDER BY p.occurred_at DESC, p.fact_id DESC
    LIMIT $4
  `;
  const res = await pool.query(sql, [tenant.tenant_id, tenant.project_id, tenant.group_id, limit]);
  return (res.rows ?? []).map((row: any) => ({
    operation_plan_fact_id: String(row.operation_plan_fact_id),
    operation_plan_occurred_at: String(row.operation_plan_occurred_at),
    operation_plan: parseJsonMaybe(row.operation_plan_json) ?? row.operation_plan_json,
    transition_fact_id: row.transition_fact_id ? String(row.transition_fact_id) : null,
    transition_occurred_at: row.transition_occurred_at ? String(row.transition_occurred_at) : null,
    transition: parseJsonMaybe(row.transition_json),
    approval_decision_fact_id: row.approval_decision_fact_id ? String(row.approval_decision_fact_id) : null,
    approval_decision_occurred_at: row.approval_decision_occurred_at ? String(row.approval_decision_occurred_at) : null,
    approval_decision: parseJsonMaybe(row.approval_decision_json),
    receipt_fact_id: row.receipt_fact_id ? String(row.receipt_fact_id) : null,
    receipt_occurred_at: row.receipt_occurred_at ? String(row.receipt_occurred_at) : null,
    receipt: parseJsonMaybe(row.receipt_json)
  }));
}

let ensureOperationPlanStateReadModelRuntimePromise: Promise<void> | null = null; // Process-local guard for one-time read-model table init.

async function ensureOperationPlanStateReadModelRuntime(pool: Pool): Promise<void> {
  if (!ensureOperationPlanStateReadModelRuntimePromise) {
    ensureOperationPlanStateReadModelRuntimePromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS operation_plan_state_v1_rm (
          tenant_id text NOT NULL,
          project_id text NOT NULL,
          group_id text NOT NULL,
          plan_id text NOT NULL,
          status text NOT NULL,
          device_id text NULL,
          field_id text NULL,
          last_transition timestamptz NULL,
          receipt_status text NULL,
          updated_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (tenant_id, project_id, group_id, plan_id)
        )
      `); // State-first read model table derived from immutable facts.
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_operation_plan_state_v1_rm_status ON operation_plan_state_v1_rm (tenant_id, project_id, group_id, status, updated_at DESC)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_operation_plan_state_v1_rm_device ON operation_plan_state_v1_rm (tenant_id, project_id, group_id, device_id, updated_at DESC)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_operation_plan_state_v1_rm_field ON operation_plan_state_v1_rm (tenant_id, project_id, group_id, field_id, updated_at DESC)`);
    })().catch((err) => {
      ensureOperationPlanStateReadModelRuntimePromise = null; // Allow re-init after transient DB failure.
      throw err;
    });
  }
  await ensureOperationPlanStateReadModelRuntimePromise;
}

async function rebuildOperationPlanStateReadModel(pool: Pool, tenant: TenantTriple): Promise<number> {
  await ensureOperationPlanStateReadModelRuntime(pool);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM operation_plan_state_v1_rm
       WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3`,
      [tenant.tenant_id, tenant.project_id, tenant.group_id]
    ); // Truncate tenant partition before replay.
    const replay = await client.query(
      `
      WITH latest_plan AS (
        SELECT DISTINCT ON ((record_json::jsonb#>>'{payload,operation_plan_id}'))
          (record_json::jsonb#>>'{payload,operation_plan_id}') AS plan_id,
          (record_json::jsonb) AS plan_json
        FROM facts
        WHERE (record_json::jsonb->>'type') = 'operation_plan_v1'
          AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
          AND (record_json::jsonb#>>'{payload,project_id}') = $2
          AND (record_json::jsonb#>>'{payload,group_id}') = $3
        ORDER BY (record_json::jsonb#>>'{payload,operation_plan_id}'), occurred_at DESC, fact_id DESC
      ),
      latest_transition AS (
        SELECT DISTINCT ON ((record_json::jsonb#>>'{payload,operation_plan_id}'))
          (record_json::jsonb#>>'{payload,operation_plan_id}') AS plan_id,
          occurred_at AS transition_occurred_at
        FROM facts
        WHERE (record_json::jsonb->>'type') = 'operation_plan_transition_v1'
          AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
          AND (record_json::jsonb#>>'{payload,project_id}') = $2
          AND (record_json::jsonb#>>'{payload,group_id}') = $3
        ORDER BY (record_json::jsonb#>>'{payload,operation_plan_id}'), occurred_at DESC, fact_id DESC
      ),
      latest_task AS (
        SELECT DISTINCT ON ((record_json::jsonb#>>'{payload,act_task_id}'))
          (record_json::jsonb#>>'{payload,act_task_id}') AS act_task_id,
          (record_json::jsonb) AS task_json
        FROM facts
        WHERE (record_json::jsonb->>'type') = 'ao_act_task_v0'
          AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
          AND (record_json::jsonb#>>'{payload,project_id}') = $2
          AND (record_json::jsonb#>>'{payload,group_id}') = $3
        ORDER BY (record_json::jsonb#>>'{payload,act_task_id}'), occurred_at DESC, fact_id DESC
      ),
      latest_receipt AS (
        SELECT DISTINCT ON ((record_json::jsonb#>>'{payload,act_task_id}'))
          (record_json::jsonb#>>'{payload,act_task_id}') AS act_task_id,
          (record_json::jsonb#>>'{payload,status}') AS receipt_status
        FROM facts
        WHERE (record_json::jsonb->>'type') IN ('ao_act_receipt_v0','ao_act_receipt_v1')
          AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
          AND (record_json::jsonb#>>'{payload,project_id}') = $2
          AND (record_json::jsonb#>>'{payload,group_id}') = $3
        ORDER BY (record_json::jsonb#>>'{payload,act_task_id}'), occurred_at DESC, fact_id DESC
      )
      INSERT INTO operation_plan_state_v1_rm (
        tenant_id, project_id, group_id, plan_id, status, device_id, field_id, last_transition, receipt_status, updated_at
      )
      SELECT
        $1, $2, $3,
        lp.plan_id,
        COALESCE(NULLIF(lp.plan_json#>>'{payload,status}', ''), 'UNKNOWN') AS status,
        COALESCE(
          NULLIF(lp.plan_json#>>'{payload,meta,device_id}', ''),
          NULLIF(lt.task_json#>>'{payload,meta,device_id}', '')
        ) AS device_id,
        COALESCE(
          NULLIF(lp.plan_json#>>'{payload,target,field_id}', ''),
          NULLIF(lp.plan_json#>>'{payload,target,ref}', ''),
          NULLIF(lp.plan_json#>>'{payload,target,id}', ''),
          CASE
            WHEN jsonb_typeof(lp.plan_json#>'{payload,target}') = 'string' THEN NULLIF(lp.plan_json#>>'{payload,target}', '')
            ELSE NULL
          END
        ) AS field_id,
        ltr.transition_occurred_at,
        lr.receipt_status,
        NOW()
      FROM latest_plan lp
      LEFT JOIN latest_transition ltr ON ltr.plan_id = lp.plan_id
      LEFT JOIN latest_task lt ON (lp.plan_json#>>'{payload,act_task_id}') = lt.act_task_id
      LEFT JOIN latest_receipt lr ON (lp.plan_json#>>'{payload,act_task_id}') = lr.act_task_id
      `,
      [tenant.tenant_id, tenant.project_id, tenant.group_id]
    ); // Replay facts to regenerate the canonical state projection.
    await client.query("COMMIT");
    return Number(replay.rowCount ?? 0);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function listOperationPlanStateReadModel(
  pool: Pool,
  tenant: TenantTriple,
  q: any
): Promise<OperationPlanStateReadModelRow[]> {
  await ensureOperationPlanStateReadModelRuntime(pool);
  const status = typeof q?.status === "string" && q.status.trim() ? q.status.trim().toUpperCase() : null;
  const device_id = typeof q?.device_id === "string" && q.device_id.trim() ? q.device_id.trim() : null;
  const field_id = typeof q?.field_id === "string" && q.field_id.trim() ? q.field_id.trim() : null;
  const plan_id = typeof q?.plan_id === "string" && q.plan_id.trim() ? q.plan_id.trim() : null;
  const limit = parseLimit(q);
  const sql = `
    SELECT plan_id, status, device_id, field_id, last_transition, receipt_status
    FROM operation_plan_state_v1_rm
    WHERE tenant_id = $1
      AND project_id = $2
      AND group_id = $3
      AND ($4::text IS NULL OR status = $4)
      AND ($5::text IS NULL OR device_id = $5)
      AND ($6::text IS NULL OR field_id = $6)
      AND ($7::text IS NULL OR plan_id = $7)
    ORDER BY updated_at DESC, plan_id DESC
    LIMIT $8
  `;
  const res = await pool.query(sql, [tenant.tenant_id, tenant.project_id, tenant.group_id, status, device_id, field_id, plan_id, limit]);
  return (res.rows ?? []).map((row: any) => ({
    plan_id: String(row.plan_id),
    status: String(row.status ?? "UNKNOWN"),
    device_id: row.device_id ? String(row.device_id) : null,
    field_id: row.field_id ? String(row.field_id) : null,
    last_transition: row.last_transition ? String(row.last_transition) : null,
    receipt_status: row.receipt_status ? String(row.receipt_status) : null
  }));
}

async function listDispatchQueue(pool: Pool, tenant: TenantTriple, limit: number, actTaskId?: string): Promise<any[]> {
  await ensureDispatchQueueRuntime(pool);
  const sql = `
    SELECT q.queue_id,
           q.act_task_id,
           q.command_id,
           q.outbox_fact_id,
           q.task_fact_id,
           q.device_id,
           q.downlink_topic,
           q.qos,
           q.retain,
           q.adapter_hint,
           q.state,
           q.claim_id,
           q.lease_token,
           q.leased_by,
           q.lease_expires_at,
           q.lease_expire_at,
           q.claimed_by,
           q.claimed_ts,
           q.publish_fact_id,
           q.ack_fact_id,
           q.receipt_fact_id,
           q.attempt_no,
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
      AND q.state IN ('READY','DISPATCHED','ACKED')
    ORDER BY q.created_at DESC, q.queue_id DESC
    LIMIT $5
  `; // Runtime queue = mutable dispatch state joined back to immutable outbox/task facts.
  const res = await pool.query(sql, [tenant.tenant_id, tenant.project_id, tenant.group_id, actTaskId ?? null, limit]);
  return (res.rows ?? []).map((row: any) => ({
    queue_id: String(row.queue_id),
    act_task_id: String(row.act_task_id),
    command_id: String(row.command_id),
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
    claim_id: row.claim_id ? String(row.claim_id) : null,
    lease_token: row.lease_token ? String(row.lease_token) : null,
    leased_by: row.leased_by ? String(row.leased_by) : null,
    lease_expires_at: row.lease_expires_at ? String(row.lease_expires_at) : null,
    lease_expire_at: Number.isFinite(Number(row.lease_expire_at)) ? Number(row.lease_expire_at) : null,
    claimed_by: row.claimed_by ? String(row.claimed_by) : null,
    claimed_ts: Number.isFinite(Number(row.claimed_ts)) ? Number(row.claimed_ts) : null,
    publish_fact_id: row.publish_fact_id ? String(row.publish_fact_id) : null,
    ack_fact_id: row.ack_fact_id ? String(row.ack_fact_id) : null,
    receipt_fact_id: row.receipt_fact_id ? String(row.receipt_fact_id) : null,
    attempt_no: Number(row.attempt_no ?? row.attempt_count ?? 0),
    attempt_count: Number(row.attempt_count ?? 0)
  }));
}


async function listDispatchQueueByIds(pool: Pool, tenant: TenantTriple, queueIds: string[]): Promise<any[]> {
  if (!queueIds.length) return [];
  await ensureDispatchQueueRuntime(pool);
  const sql = `
    SELECT q.queue_id,
           q.act_task_id,
           q.command_id,
           q.outbox_fact_id,
           q.task_fact_id,
           q.device_id,
           q.downlink_topic,
           q.qos,
           q.retain,
           q.adapter_hint,
           q.state,
           q.claim_id,
           q.lease_token,
           q.leased_by,
           q.lease_expires_at,
           q.lease_expire_at,
           q.claimed_by,
           q.claimed_ts,
           q.publish_fact_id,
           q.ack_fact_id,
           q.receipt_fact_id,
           q.attempt_no,
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
      AND q.queue_id = ANY($4::text[])
    ORDER BY q.created_at DESC, q.queue_id DESC
  `;
  const res = await pool.query(sql, [tenant.tenant_id, tenant.project_id, tenant.group_id, queueIds]);
  return (res.rows ?? []).map((row: any) => ({
    queue_id: String(row.queue_id),
    act_task_id: String(row.act_task_id),
    command_id: String(row.command_id),
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
    claim_id: row.claim_id ? String(row.claim_id) : null,
    lease_token: row.lease_token ? String(row.lease_token) : null,
    leased_by: row.leased_by ? String(row.leased_by) : null,
    lease_expires_at: row.lease_expires_at ? String(row.lease_expires_at) : null,
    lease_expire_at: Number.isFinite(Number(row.lease_expire_at)) ? Number(row.lease_expire_at) : null,
    claimed_by: row.claimed_by ? String(row.claimed_by) : null,
    claimed_ts: Number.isFinite(Number(row.claimed_ts)) ? Number(row.claimed_ts) : null,
    publish_fact_id: row.publish_fact_id ? String(row.publish_fact_id) : null,
    ack_fact_id: row.ack_fact_id ? String(row.ack_fact_id) : null,
    receipt_fact_id: row.receipt_fact_id ? String(row.receipt_fact_id) : null,
    attempt_no: Number(row.attempt_no ?? row.attempt_count ?? 0),
    attempt_count: Number(row.attempt_count ?? 0)
  }));
}

async function loadReceiptV1ByIdempotencyKey(
  pool: Pool,
  tenant: TenantTriple,
  idempotencyKey: string
): Promise<ParsedFactRow | null> {
  if (!idempotencyKey) return null;
  return loadLatestFactByTypeAndKey(pool, "ao_act_receipt_v1", "payload,idempotency_key", idempotencyKey, tenant);
}

async function listReceipts(pool: Pool, tenant: TenantTriple, limit: number, actTaskId?: string): Promise<any[]> {
  const sql = `
    SELECT fact_id, occurred_at, source, (record_json::jsonb) AS record_json
    FROM facts
    WHERE (record_json::jsonb->>'type') IN ('ao_act_receipt_v0','ao_act_receipt_v1')
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
  return `/device/${deviceId}/cmd`; // Real-device MQTT command topic.
}

function normalizeAdapterHint(raw: any): string | null {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!v) return null;
  if (v === "mqtt") return "mqtt_downlink_once_v1"; // Backward-compatible alias used by some clients.
  return v;
}

function assertTenantFieldDeviceTriple(taskPayload: any): { ok: true } | { ok: false; reason: string } {
  if (!String(taskPayload?.tenant_id ?? "").trim()) return { ok: false, reason: "MISSING_TENANT_ID" };
  if (!String(taskPayload?.project_id ?? "").trim()) return { ok: false, reason: "MISSING_PROJECT_ID" };
  if (!String(taskPayload?.group_id ?? "").trim()) return { ok: false, reason: "MISSING_GROUP_ID" };
  const deviceId = String(taskPayload?.meta?.device_id ?? "").trim();
  if (!deviceId) return { ok: false, reason: "MISSING_DEVICE_ID" };
  return { ok: true };
}

function resolveActionType(input: any): string {
  return String(input?.action_type ?? input?.task_type ?? "").trim();
}

function adapterSupportsAction(adapterType: string, actionType: string): boolean {
  const a = String(adapterType ?? "").trim().toLowerCase();
  const action = String(actionType ?? "").trim().toLowerCase();
  if (!a || !action) return false;
  if (a === "mqtt" && action === "irrigate") return true;
  if (a === "mqtt") return true;
  if (a === "irrigation_real" || a === "irrigation_simulator" || a === "irrigation_http_v1") {
    return action === "irrigation.start" || action === "irrigate";
  }
  return false;
}

function validateAdapterTask(adapterType: string, taskPayload: any): { ok: true } | { ok: false; reason: string } {
  const adapter = String(adapterType ?? "").trim().toLowerCase();
  if (!adapter) return { ok: false, reason: "MISSING_ADAPTER_TYPE" };
  if (adapter === "mqtt" && !String(taskPayload?.meta?.device_id ?? "").trim()) return { ok: false, reason: "MISSING_DEVICE_ID" };
  if ((adapter === "irrigation_real" || adapter === "irrigation_http_v1" || adapter === "irrigation_simulator") && !String(taskPayload?.meta?.device_id ?? "").trim()) {
    return { ok: false, reason: "MISSING_DEVICE_ID" };
  }
  return { ok: true };
}

function deriveReceiptTopic(tenant: TenantTriple, deviceId: string, body: any): string {
  const explicit = typeof body?.uplink_topic === "string" ? body.uplink_topic.trim() : ""; // Allow explicit receipt topic override.
  if (explicit) return explicit; // Use explicit topic when provided.
  return `/device/${deviceId}/ack`; // Real-device MQTT ack topic.
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
  const operationPlansRaw = await listOperationPlans(pool, tenant, 20);
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
    if (item?.receipt_fact_id) {
      const latest = String(receiptPayload?.status ?? '').toUpperCase();
      state = latest === 'FAILED' ? 'FAILED' : 'SUCCEEDED';
    } else if (item?.dispatch_fact_id) state = "DISPATCHED";
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
      operation_plans: operationPlansRaw.length,
      dispatch_queue: dispatches.length,
      receipts: receipts.length,
      retryable_tasks: monitoring.filter((x: any) => x.retry_allowed).length
    },
    approvals,
    operation_plans: operationPlansRaw,
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
    const tenant: TenantTriple = parseTenantFromBody(body);
    if (!requireTenantFieldsPresentOr400(tenant, reply)) return;
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
    if (!requireTenantFieldsPresentOr400(tenant, reply)) return;
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const items = await listApprovals(pool, tenant, parseLimit((req as any).query));
    return reply.send({ ok: true, items });
  });

  // GET /api/v1/approvals/:request_id
  app.get("/api/v1/approvals/:request_id", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = queryTenantFromReq(req, auth);
    if (!requireTenantFieldsPresentOr400(tenant, reply)) return;
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
    const tenant: TenantTriple = parseTenantFromBody(body);
    if (!requireTenantFieldsPresentOr400(tenant, reply)) return;
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

    const operationPlan = await loadLatestOperationPlanByApprovalRequestId(pool, request_id, tenant);
    const operation_plan_id = operationPlan?.record_json?.payload?.operation_plan_id ? String(operationPlan.record_json.payload.operation_plan_id) : null;
    if (!operation_plan_id) return badRequest(reply, "MISSING_OPERATION_PLAN_ID");
    if (!operationPlan) return badRequest(reply, "OPERATION_PLAN_NOT_FOUND");
    if (decision !== "APPROVE") return badRequest(reply, "OPERATION_PLAN_APPROVAL_REQUIRED");

    if (decision === "APPROVE") {
      const proposal = requestPayload.proposal; // Reuse request proposal as AO-ACT task input.
      const planAdapterType = typeof operationPlan?.record_json?.payload?.adapter_type === "string"
        ? String(operationPlan.record_json.payload.adapter_type)
        : String(proposal?.meta?.adapter_type ?? "");
      const tripleValidation = assertTenantFieldDeviceTriple({
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        meta: { device_id: proposal?.target?.id ?? proposal?.meta?.device_id ?? proposal?.target ?? "" }
      });
      if (!tripleValidation.ok) return badRequest(reply, tripleValidation.reason);
      if (!adapterSupportsAction(planAdapterType, resolveActionType(proposal))) return badRequest(reply, "ADAPTER_UNSUPPORTED_ACTION");
      const adapterValidation = validateAdapterTask(planAdapterType, { meta: { device_id: proposal?.target?.id ?? proposal?.meta?.device_id ?? "" } });
      if (!adapterValidation.ok) return badRequest(reply, adapterValidation.reason);
      await insertFact(pool, "api/v1/approvals", {
        type: "approval_request_v1",
        payload: {
          ...requestPayload,
          tenant_id: tenant.tenant_id,
          project_id: tenant.project_id,
          group_id: tenant.group_id,
          program_id: requestPayload?.program_id ?? requestPayload?.proposal?.meta?.program_id ?? null,
          field_id: requestPayload?.field_id ?? requestPayload?.proposal?.meta?.field_id ?? requestPayload?.proposal?.target?.ref ?? null,
          season_id: requestPayload?.season_id ?? requestPayload?.proposal?.meta?.season_id ?? null,
          request_id,
          status: "APPROVED",
          approved_at_ts: Date.now(),
          approved_by_actor_id: auth.actor_id,
          approved_by_token_id: auth.token_id
        }
      });
      const delegated = await fetchJson(`${hostBaseUrl(req)}/api/control/ao_act/task`, String((req.headers as any).authorization ?? ""), {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        operation_plan_id,
        approval_request_id: request_id,
        issuer: proposal.issuer,
        action_type: proposal.action_type,
        target: proposal.target,
        time_window: proposal.time_window,
        parameter_schema: proposal.parameter_schema,
        parameters: proposal.parameters,
        constraints: proposal.constraints,
        meta: {
          ...(proposal.meta ?? {}),
          adapter_type: typeof operationPlan?.record_json?.payload?.adapter_type === "string"
            ? String(operationPlan.record_json.payload.adapter_type)
            : (proposal?.meta?.adapter_type ?? null)
        }
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
          program_id: requestPayload?.program_id ?? requestPayload?.proposal?.meta?.program_id ?? null,
          field_id: requestPayload?.field_id ?? requestPayload?.proposal?.meta?.field_id ?? requestPayload?.proposal?.target?.ref ?? null,
          season_id: requestPayload?.season_id ?? requestPayload?.proposal?.meta?.season_id ?? null,
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

    const approvedTransition = await transitionOperationPlanStateV1(pool, tenant, operationPlan, {
      next_status: "APPROVED",
      trigger: "approval_decision",
      approval_request_id: request_id,
      decision,
      decision_fact_id,
      act_task_id
    }, "api/v1/approvals");
    const approvedPlan = await loadLatestFactByTypeAndKey(pool, "operation_plan_v1", "payload,operation_plan_id", operation_plan_id, tenant);
    if (!approvedPlan) return reply.status(500).send({ ok: false, error: "OPERATION_PLAN_UPDATE_FAILED" });

    const readyTransition = await transitionOperationPlanStateV1(pool, tenant, approvedPlan, {
      next_status: "READY",
      trigger: "task_created",
      approval_request_id: request_id,
      decision,
      decision_fact_id,
      act_task_id
    }, "api/v1/approvals");

    const createdTaskFact = await loadLatestFactByTypeAndKey(
      pool,
      "ao_act_task_v0",
      "payload,act_task_id",
      String(act_task_id ?? "").trim(),
      tenant
    );
    if (!createdTaskFact) {
      return reply.status(500).send({ ok: false, error: "TASK_FACT_NOT_FOUND_AFTER_APPROVE" });
    }

    const readyPlan = await loadLatestFactByTypeAndKey(
      pool,
      "operation_plan_v1",
      "payload,operation_plan_id",
      operation_plan_id,
      tenant
    );
    if (!readyPlan) {
      return reply.status(500).send({ ok: false, error: "OPERATION_PLAN_NOT_FOUND_AFTER_READY" });
    }

    const readyQueue = await enqueueReadyDispatchForTask(
      pool,
      auth,
      tenant,
      createdTaskFact,
      readyPlan
    );

    return reply.send({
      ok: true,
      request_id,
      decision_id,
      decision_fact_id,
      act_task_id,
      ao_act_fact_id,
      wrapper_task_created_fact_id,
      operation_plan_id,
      outbox_fact_id: readyQueue.outbox_fact_id,
      queue_ready: true,
      device_id: readyQueue.device_id,
      downlink_topic: readyQueue.downlink_topic,
      adapter_hint: readyQueue.adapter_hint,
      operation_plan_transition_fact_id: readyTransition.transition_fact_id,
      operation_plan_update_fact_id: readyTransition.operation_plan_fact_id,
      operation_plan_approved_transition_fact_id: approvedTransition.transition_fact_id
    });
  });

  // POST /api/v1/ao-act/tasks
  // Explicit task create path for already-approved / low-level integrator flows.
  app.post("/api/v1/ao-act/tasks", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
    if (!auth) return;
    const body: any = req.body ?? {};
    const tenant: TenantTriple = parseTenantFromBody(body);
    if (!requireTenantFieldsPresentOr400(tenant, reply)) return;
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const requestedDeviceId = String((body?.meta as any)?.device_id ?? "").trim();
    if (requestedDeviceId && !(await ensureDeviceBelongsTenantOr404(pool, tenant, requestedDeviceId))) {
      return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    }
    const operation_plan_id = String(body.operation_plan_id ?? "").trim();
    if (!operation_plan_id) return badRequest(reply, "MISSING_OPERATION_PLAN_ID");
    const operationPlan = await loadLatestFactByTypeAndKey(pool, "operation_plan_v1", "payload,operation_plan_id", operation_plan_id, tenant);
    if (!operationPlan) return reply.status(404).send({ ok: false, error: "OPERATION_PLAN_NOT_FOUND" });
    const adapterType = String(body?.adapter_type ?? operationPlan?.record_json?.payload?.adapter_type ?? body?.meta?.adapter_type ?? "").trim();
    const requestedActionType = resolveActionType(body);
    const tripleValidation = assertTenantFieldDeviceTriple({ ...body, tenant_id: tenant.tenant_id, project_id: tenant.project_id, group_id: tenant.group_id });
    if (!tripleValidation.ok) return badRequest(reply, tripleValidation.reason);
    if (!adapterSupportsAction(adapterType, requestedActionType)) return badRequest(reply, "ADAPTER_UNSUPPORTED_ACTION");
    const adapterValidation = validateAdapterTask(adapterType, body);
    if (!adapterValidation.ok) return badRequest(reply, adapterValidation.reason);
    const delegated = await fetchJson(`${hostBaseUrl(req)}/api/control/ao_act/task`, String((req.headers as any).authorization ?? ""), {
      ...body,
      action_type: requestedActionType,
      tenant_id: tenant.tenant_id,
      project_id: tenant.project_id,
      group_id: tenant.group_id,
      operation_plan_id,
      approval_request_id: String(body.approval_request_id ?? "").trim()
    });
    if (!delegated.ok || !delegated.json?.ok) return reply.status(delegated.status || 400).send(delegated.json ?? { ok: false, error: "TASK_CREATE_FAILED" });

    const wrapper_fact_id = await insertFact(pool, "api/v1/ao-act/tasks", {
      type: "ao_act_task_created_v1",
      payload: {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        operation_plan_id,
        act_task_id: delegated.json.act_task_id,
        ao_act_fact_id: delegated.json.fact_id,
        actor_id: auth.actor_id,
        token_id: auth.token_id,
        created_at_ts: Date.now()
      }
    });

    const readyTransition = await transitionOperationPlanStateV1(pool, tenant, operationPlan, {
      next_status: "READY",
      trigger: "task_created",
      approval_request_id: String(body.approval_request_id ?? "").trim() || null,
      act_task_id: String(delegated.json.act_task_id ?? "")
    }, "api/v1/ao-act/tasks");

    const createdTaskFact = await loadLatestFactByTypeAndKey(
      pool,
      "ao_act_task_v0",
      "payload,act_task_id",
      String(delegated.json.act_task_id ?? "").trim(),
      tenant
    );
    if (!createdTaskFact) {
      return reply.status(500).send({ ok: false, error: "TASK_FACT_NOT_FOUND_AFTER_CREATE" });
    }

    const latestPlan = await loadLatestFactByTypeAndKey(
      pool,
      "operation_plan_v1",
      "payload,operation_plan_id",
      operation_plan_id,
      tenant
    );
    if (!latestPlan) {
      return reply.status(500).send({ ok: false, error: "OPERATION_PLAN_NOT_FOUND_AFTER_READY" });
    }

    const readyQueue = await enqueueReadyDispatchForTask(
      pool,
      auth,
      tenant,
      createdTaskFact,
      latestPlan
    );

    return reply.send({
      ok: true,
      act_task_id: delegated.json.act_task_id,
      ao_act_fact_id: delegated.json.fact_id,
      wrapper_fact_id,
      operation_plan_id,
      outbox_fact_id: readyQueue.outbox_fact_id,
      queue_ready: true,
      device_id: readyQueue.device_id,
      downlink_topic: readyQueue.downlink_topic,
      adapter_hint: readyQueue.adapter_hint,
      operation_plan_transition_fact_id: readyTransition.transition_fact_id,
      operation_plan_update_fact_id: readyTransition.operation_plan_fact_id
    });
  });

  // GET /api/v1/ao-act/tasks
  app.get("/api/v1/ao-act/tasks", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = queryTenantFromReq(req, auth);
    if (!requireTenantFieldsPresentOr400(tenant, reply)) return;
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const items = await listTasks(pool, tenant, parseLimit((req as any).query));
    return reply.send({ ok: true, items });
  });

  // GET /api/v1/ao-act/tasks/:act_task_id
  app.get("/api/v1/ao-act/tasks/:act_task_id", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = queryTenantFromReq(req, auth);
    if (!requireTenantFieldsPresentOr400(tenant, reply)) return;
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
    const command_id = String(body.command_id ?? act_task_id).trim();
    if (!act_task_id) return badRequest(reply, "MISSING_ACT_TASK_ID");
    if (!command_id) return badRequest(reply, "MISSING_COMMAND_ID");
    if (command_id !== act_task_id) return badRequest(reply, "COMMAND_ID_MUST_MATCH_ACT_TASK_ID");
    const tenant: TenantTriple = parseTenantFromBody(body);
    if (!requireTenantFieldsPresentOr400(tenant, reply)) return;
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const taskFact = await loadLatestFactByTypeAndKey(pool, "ao_act_task_v0", "payload,act_task_id", act_task_id, tenant);
    if (!taskFact) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    const taskPayload = taskFact.record_json?.payload ?? {};
    const adapterType = String(taskPayload?.adapter_type ?? body.adapter_hint ?? "").trim();
    const tripleValidation = assertTenantFieldDeviceTriple(taskPayload);
    if (!tripleValidation.ok) return badRequest(reply, tripleValidation.reason);
    if (!adapterSupportsAction(adapterType, resolveActionType(taskPayload))) return badRequest(reply, "ADAPTER_UNSUPPORTED_ACTION");
    const adapterValidation = validateAdapterTask(adapterType, taskPayload);
    if (!adapterValidation.ok) return badRequest(reply, adapterValidation.reason);
    const operation_plan_id = String(taskFact.record_json?.payload?.operation_plan_id ?? "").trim();
    if (!operation_plan_id) return badRequest(reply, "MISSING_OPERATION_PLAN_ID");
    const operationPlan = await loadLatestFactByTypeAndKey(pool, "operation_plan_v1", "payload,operation_plan_id", operation_plan_id, tenant);
    if (!operationPlan) return reply.status(404).send({ ok: false, error: "OPERATION_PLAN_NOT_FOUND" });
    const latestReceipt = await loadLatestReceiptByCommandId(pool, command_id, tenant);
    if (latestReceipt) return badRequest(reply, "TASK_ALREADY_HAS_RECEIPT");

    const existingOutbox = await loadLatestFactByTypeAndKey(pool, "ao_act_dispatch_outbox_v1", "payload,act_task_id", act_task_id, tenant);
    if (existingOutbox) {
      const existingPayload = existingOutbox.record_json?.payload ?? {};
      await upsertDispatchQueueReady(pool, {
        tenant,
        queue_id: `dq_${randomUUID().replace(/-/g, "")}`,
        act_task_id,
        command_id,
        task_fact_id: String(existingPayload.task_fact_id ?? taskFact.fact_id),
        outbox_fact_id: existingOutbox.fact_id,
        device_id: typeof existingPayload.device_id === "string" ? existingPayload.device_id : null,
        downlink_topic: typeof existingPayload.downlink_topic === "string" ? existingPayload.downlink_topic : null,
        qos: Math.max(0, Math.min(2, Number.parseInt(String(existingPayload.qos ?? body.qos ?? "1"), 10) || 1)),
        retain: Boolean(existingPayload.retain ?? body.retain ?? false),
        adapter_hint: typeof existingPayload.adapter_hint === "string" ? normalizeAdapterHint(existingPayload.adapter_hint) : normalizeAdapterHint(body.adapter_hint)
      });
      const dispatchedTransition = await ensureOperationPlanAtLeastDispatched(
        pool,
        tenant,
        operation_plan_id,
        act_task_id,
        "api/v1/ao-act/tasks/dispatch",
        "task_dispatch_existing_outbox"
      );
      return reply.send({
        ok: true,
        act_task_id,
        command_id,
        dispatch_fact_id: null,
        outbox_fact_id: existingOutbox.fact_id,
        already_queued: true,
        operation_plan_id,
        operation_plan_transition_fact_id: dispatchedTransition?.transition_fact_id ?? null,
        operation_plan_update_fact_id: dispatchedTransition?.operation_plan_fact_id ?? null
      });
    } // Explicit idempotency: one open outbox item per task until receipt exists.

    const taskRecord = taskFact.record_json ?? {}; // Joined AO-ACT task record used to derive adapter hints.
    const device_id = deriveDispatchDeviceId(body, taskRecord); // Prefer explicit device id; fallback to task meta.
    const downlink_topic = deriveDispatchTopic(tenant, device_id, body); // Resolve MQTT topic once at queue time.
    const dispatch_mode = String(body.dispatch_mode ?? "OUTBOX_ONLY").trim() || "OUTBOX_ONLY"; // Stable dispatch mode marker.
    const planAdapterType = typeof operationPlan?.record_json?.payload?.adapter_type === "string"
      ? String(operationPlan.record_json.payload.adapter_type)
      : null;
    const adapter_hint = normalizeAdapterHint(body.adapter_hint ?? planAdapterType); // Normalize aliases so queue consumers can match.
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
        adapter_hint,
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
        command_id,
        task_fact_id: taskFact.fact_id,
        dispatch_fact_id,
        device_id,
        downlink_topic,
        qos,
        retain,
        adapter_hint,
        created_at_ts: Date.now()
      }
    });
    await upsertDispatchQueueReady(pool, {
      tenant,
      queue_id: `dq_${randomUUID().replace(/-/g, "")}`,
      act_task_id,
      command_id,
      task_fact_id: String(taskFact.fact_id),
      outbox_fact_id,
      device_id,
      downlink_topic,
      qos,
      retain,
      adapter_hint
    });
    const dispatchedTransition = await transitionOperationPlanStateV1(pool, tenant, operationPlan, {
      next_status: "DISPATCHED",
      trigger: "task_dispatch",
      act_task_id
    }, "api/v1/ao-act/tasks/dispatch");
    return reply.send({
      ok: true, act_task_id, command_id, dispatch_fact_id, outbox_fact_id, device_id, downlink_topic, qos, retain, already_queued: false,
      operation_plan_id, operation_plan_transition_fact_id: dispatchedTransition.transition_fact_id, operation_plan_update_fact_id: dispatchedTransition.operation_plan_fact_id
    });
  });


  // POST /api/v1/ao-act/dispatches/claim
  // Industrial runtime queue claim: atomically leases READY items to a single executor.
  app.post("/api/v1/ao-act/dispatches/claim", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
    if (!auth) return;
    const body: any = req.body ?? {};
    const tenant: TenantTriple = parseTenantFromBody(body);
    if (!requireTenantFieldsPresentOr400(tenant, reply)) return;
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const limit = Math.max(1, Math.min(50, Number.parseInt(String(body.limit ?? 1), 10) || 1));
    const lease_seconds = Math.max(5, Math.min(300, Number.parseInt(String(body.lease_seconds ?? 30), 10) || 30));
    const executor_id = String(body.executor_id ?? auth.actor_id ?? "executor").trim() || "executor";
    const lease_token = String(body.lease_token ?? `lease_${randomUUID().replace(/-/g, "")}`).trim();
    const actTaskId = typeof body.act_task_id === "string" && body.act_task_id.trim() ? body.act_task_id.trim() : undefined;
    const adapterHint = typeof body.adapter_hint === "string" && body.adapter_hint.trim() ? body.adapter_hint.trim() : undefined;
    const rows = await claimDispatchQueueRows(pool, tenant, limit, lease_seconds, executor_id, lease_token, actTaskId, adapterHint);
    const claimedIds = rows.map((r: any) => String(r.queue_id)).filter(Boolean);
    const items = await listDispatchQueueByIds(pool, tenant, claimedIds);
    return reply.send({ ok: true, claim_id: lease_token, lease_token, items });
  });



  // POST /api/v1/ao-act/dispatches/state
  // Explicit runtime state transition endpoint used by executor adapters.
  app.post("/api/v1/ao-act/dispatches/state", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
    if (!auth) return;
    const body: any = req.body ?? {};
    const tenant: TenantTriple = parseTenantFromBody(body);
    if (!requireTenantFieldsPresentOr400(tenant, reply)) return;
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const act_task_id = String(body.act_task_id ?? "").trim();
    const command_id = String(body.command_id ?? act_task_id).trim();
    const state = String(body.state ?? "").trim().toUpperCase();
    if (!act_task_id) return badRequest(reply, "MISSING_ACT_TASK_ID");
    if (!command_id) return badRequest(reply, "MISSING_COMMAND_ID");
    if (!["DISPATCHED", "ACKED", "SUCCEEDED", "FAILED"].includes(state)) return badRequest(reply, "INVALID_STATE");
     const changed = await transitionDispatchQueueState(pool, tenant, act_task_id, command_id, state as any);

    // 关键：DISPATCHED 允许幂等重放。
    // claim 阶段已经可能把 queue 置为 DISPATCHED，但此时 operation_plan 仍可能停在 READY，
    // 所以这里不能因为 queue 未变化就直接 409，需要继续尝试推进 operation_plan。
    if (!changed && state !== "DISPATCHED") {
      return reply.status(409).send({ ok: false, error: "STATE_TRANSITION_DENIED" });
    }

    const taskFact = await loadLatestFactByTypeAndKey(
      pool,
      "ao_act_task_v0",
      "payload,act_task_id",
      act_task_id,
      tenant
    );
    const operation_plan_id = String(taskFact?.record_json?.payload?.operation_plan_id ?? "").trim();

    let operation_plan_transition_fact_id: string | null = null;
    let operation_plan_update_fact_id: string | null = null;

    if (operation_plan_id) {
      const operationPlan = await loadLatestFactByTypeAndKey(
        pool,
        "operation_plan_v1",
        "payload,operation_plan_id",
        operation_plan_id,
        tenant
      );

      if (operationPlan) {
        const currentPlanStatus = String(operationPlan.record_json?.payload?.status ?? "").trim().toUpperCase();
        const targetPlanStatus = String(state ?? "").trim().toUpperCase();

        // 如果 plan 已经在目标状态，则视为幂等成功，不重复写 transition
        if (currentPlanStatus !== targetPlanStatus) {
          const transitioned = await transitionOperationPlanStateV1(
            pool,
            tenant,
            operationPlan,
            {
              next_status: state as OperationPlanStatusV1,
              trigger: "dispatch_state_update",
              act_task_id
            },
            "api/v1/ao-act/dispatches/state"
          );
          operation_plan_transition_fact_id = transitioned.transition_fact_id;
          operation_plan_update_fact_id = transitioned.operation_plan_fact_id;
        }
      }
    }

    return reply.send({
      ok: true,
      act_task_id,
      command_id,
      state,
      operation_plan_id: operation_plan_id || null,
      operation_plan_transition_fact_id,
      operation_plan_update_fact_id
    });
  });
  // GET /api/v1/ao-act/dispatches
  // Explicit adapter queue: outbox facts with no receipt yet.
  app.get("/api/v1/ao-act/dispatches", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = queryTenantFromReq(req, auth);
    if (!requireTenantFieldsPresentOr400(tenant, reply)) return;
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
    const tenant: TenantTriple = parseTenantFromBody(body);
    if (!requireTenantFieldsPresentOr400(tenant, reply)) return;
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const act_task_id = String(body.act_task_id ?? "").trim();
    const outbox_fact_id = String(body.outbox_fact_id ?? "").trim();
    const device_id = String(body.device_id ?? "").trim();
    const topic = String(body.topic ?? "").trim();
    if (!act_task_id) return badRequest(reply, "MISSING_ACT_TASK_ID");
    if (!outbox_fact_id) return badRequest(reply, "MISSING_OUTBOX_FACT_ID");
    if (!device_id) return badRequest(reply, "MISSING_DEVICE_ID");
    if (!(await ensureDeviceBelongsTenantOr404(pool, tenant, device_id))) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    if (!topic) return badRequest(reply, "MISSING_TOPIC");
    const queueItem = await loadLatestFactByTypeAndKey(pool, "ao_act_dispatch_outbox_v1", "payload,act_task_id", act_task_id, tenant);
    if (!queueItem) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    if (String(queueItem.fact_id) !== outbox_fact_id) return badRequest(reply, "OUTBOX_FACT_MISMATCH");
    const taskFact = await loadLatestFactByTypeAndKey(pool, "ao_act_task_v0", "payload,act_task_id", act_task_id, tenant);
    const operation_plan_id = String(taskFact?.record_json?.payload?.operation_plan_id ?? "").trim();
    const existingPublished = await loadLatestDownlinkPublishedByOutboxFactId(pool, outbox_fact_id, tenant);
    if (existingPublished) {
      await updateDispatchQueueStateByOutbox(pool, outbox_fact_id, {
        state: "DISPATCHED",
        publish_fact_id: existingPublished.fact_id,
        leaseToken: typeof body.lease_token === "string" && body.lease_token.trim() ? body.lease_token.trim() : null,
        leasedBy: typeof body.executor_id === "string" && body.executor_id.trim() ? body.executor_id.trim() : null
      });
      const dispatchedTransition = operation_plan_id
        ? await ensureOperationPlanAtLeastDispatched(
          pool,
          tenant,
          operation_plan_id,
          act_task_id,
          "api/v1/ao-act/downlinks/published",
          "downlink_published"
        )
        : null;
      return reply.send({
        ok: true,
        published_fact_id: existingPublished.fact_id,
        already_published: true,
        operation_plan_id: operation_plan_id || null,
        operation_plan_transition_fact_id: dispatchedTransition?.transition_fact_id ?? null,
        operation_plan_update_fact_id: dispatchedTransition?.operation_plan_fact_id ?? null
      });
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
      state: "DISPATCHED",
      publish_fact_id: published_fact_id,
      leaseToken: typeof body.lease_token === "string" && body.lease_token.trim() ? body.lease_token.trim() : null,
      leasedBy: typeof body.executor_id === "string" && body.executor_id.trim() ? body.executor_id.trim() : null
    });
    const dispatchedTransition = operation_plan_id
      ? await ensureOperationPlanAtLeastDispatched(
        pool,
        tenant,
        operation_plan_id,
        act_task_id,
        "api/v1/ao-act/downlinks/published",
        "downlink_published"
      )
      : null;
    return reply.send({
      ok: true,
      published_fact_id,
      operation_plan_id: operation_plan_id || null,
      operation_plan_transition_fact_id: dispatchedTransition?.transition_fact_id ?? null,
      operation_plan_update_fact_id: dispatchedTransition?.operation_plan_fact_id ?? null
    });
  });

  // GET /api/v1/ao-act/downlinks
  // Read-only list of published downlink audit facts.
  app.get("/api/v1/ao-act/downlinks", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = queryTenantFromReq(req, auth);
    if (!requireTenantFieldsPresentOr400(tenant, reply)) return;
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
    const tenant: TenantTriple = parseTenantFromBody(body);
    if (!requireTenantFieldsPresentOr400(tenant, reply)) return;
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const task_id = String(body.task_id ?? body.act_task_id ?? "").trim();
    const command_id = String(body.command_id ?? "").trim();
    const act_task_id = task_id;
    const device_id = String(body.device_id ?? "").trim();
    if (!task_id) return badRequest(reply, "MISSING_TASK_ID");
    if (!command_id) return badRequest(reply, "MISSING_COMMAND_ID");
    if (command_id !== task_id) return badRequest(reply, "COMMAND_TASK_ID_MISMATCH");
    if (!device_id) return badRequest(reply, "MISSING_DEVICE_ID");
    if (!(await ensureDeviceBelongsTenantOr404(pool, tenant, device_id))) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    const taskFact = await loadLatestFactByTypeAndKey(pool, "ao_act_task_v0", "payload,act_task_id", act_task_id, tenant);
    if (!taskFact) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    const operation_plan_id = String(taskFact.record_json?.payload?.operation_plan_id ?? "").trim();
    if (!operation_plan_id) return badRequest(reply, "MISSING_OPERATION_PLAN_ID");
    const publishedFact = await loadLatestFactByTypeAndKey(pool, "ao_act_downlink_published_v1", "payload,act_task_id", act_task_id, tenant);
    if (!publishedFact) return badRequest(reply, "RECEIPT_BEFORE_PUBLISH");
    const publishedPayload = publishedFact.record_json?.payload ?? {};
    const expectedDeviceId = String(publishedPayload.device_id ?? "").trim();
    if (expectedDeviceId && expectedDeviceId !== device_id) return badRequest(reply, "DEVICE_ID_MISMATCH");
    const idempotencyKey = String(body?.meta?.idempotency_key ?? `${act_task_id}:1:${String(body?.meta?.receipt_code ?? body?.status ?? "SUCCEEDED")}`).trim();
    const existingReceipt = await loadReceiptV1ByIdempotencyKey(pool, tenant, idempotencyKey)
      ?? await loadLatestFactByTypeAndKey(pool, "ao_act_receipt_v0", "payload,act_task_id", act_task_id, tenant);
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
    await updateDispatchQueueStateByActTask(pool, tenant, act_task_id, { state: "ACKED", ack_fact_id });
    await ensureOperationPlanAtLeastDispatched(
      pool,
      tenant,
      operation_plan_id,
      act_task_id,
      "api/v1/ao-act/receipts/uplink",
      "receipt_uplink_pre_ack"
    );
    const latestPlanForAck = await loadLatestFactByTypeAndKey(pool, "operation_plan_v1", "payload,operation_plan_id", operation_plan_id, tenant);
    if (!latestPlanForAck) return reply.status(404).send({ ok: false, error: "OPERATION_PLAN_NOT_FOUND" });
    const ackedTransition = await transitionOperationPlanStateV1(pool, tenant, latestPlanForAck, {
      next_status: "ACKED",
      trigger: "receipt_uplink_ack",
      act_task_id
    }, "api/v1/ao-act/receipts/uplink");
    const delegated = await fetchJson(`${hostBaseUrl(req)}/api/v1/ao-act/receipts`, String((req.headers as any).authorization ?? ""), {
      tenant_id: tenant.tenant_id,
      project_id: tenant.project_id,
      group_id: tenant.group_id,
      operation_plan_id,
      task_id: act_task_id,
      act_task_id,
      command_id,
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
        command_id,
        receipt_message_id: body.receipt_message_id ?? null,
        device_id,
        uplink_topic: deriveReceiptTopic(tenant, device_id, body),
        runtime: String(body.adapter_runtime ?? "mqtt_receipt_uplink_once_v1")
      }
    });
    if (!delegated.ok || !delegated.json?.ok) return reply.status(delegated.status || 400).send(delegated.json ?? { ok: false, error: "RECEIPT_UPLINK_WRITE_FAILED" });
    const receipt_v1_fact_id = await insertFact(pool, "api/v1/ao-act/receipts/uplink", {
      type: "ao_act_receipt_v1",
      payload: {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        idempotency_key: idempotencyKey,
        task_id: act_task_id,
        command_id,
        device_id,
        adapter_type: String(body?.meta?.adapter_type ?? "mqtt"),
        attempt_no: Number(body?.meta?.attempt_no ?? 1),
        receipt_status: String(body?.meta?.receipt_status ?? body?.status ?? "SUCCEEDED").toUpperCase(),
        receipt_code: String(body?.meta?.receipt_code ?? body?.status ?? "SUCCEEDED"),
        receipt_message: body?.meta?.receipt_message ?? null,
        raw_receipt_ref: body?.meta?.raw_receipt_ref ?? null,
        received_ts: Number(body?.meta?.received_ts ?? Date.now())
      }
    });
    return reply.send({
      ok: true,
      ack_fact_id,
      receipt_v1_fact_id,
      fact_id: delegated.json.fact_id,
      wrapper_fact_id: delegated.json.wrapper_fact_id,
      operation_plan_id,
      operation_plan_acked_transition_fact_id: ackedTransition.transition_fact_id,
      operation_plan_transition_fact_id: delegated.json.operation_plan_transition_fact_id ?? null,
      operation_plan_update_fact_id: delegated.json.operation_plan_update_fact_id ?? null
    });
  });


  // GET /api/v1/operations/plans
  // OperationPlan read model: recommendation -> approval -> task -> receipt evidence chain.
  app.get("/api/v1/operations/plans", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = queryTenantFromReq(req, auth);
    if (!requireTenantFieldsPresentOr400(tenant, reply)) return;
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const items = await listOperationPlans(pool, tenant, parseLimit((req as any).query));
    return reply.send({ ok: true, items });
  });

  // GET /api/v1/operations/plans/:operation_plan_id
  app.get("/api/v1/operations/plans/:operation_plan_id", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = queryTenantFromReq(req, auth);
    if (!requireTenantFieldsPresentOr400(tenant, reply)) return;
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const params: any = (req as any).params ?? {};
    const operation_plan_id = String(params.operation_plan_id ?? "").trim();
    if (!operation_plan_id) return badRequest(reply, "MISSING_OPERATION_PLAN_ID");
    const planFact = await loadLatestFactByTypeAndKey(pool, "operation_plan_v1", "payload,operation_plan_id", operation_plan_id, tenant);
    if (!planFact) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    const approvalRequestId = String(planFact.record_json?.payload?.approval_request_id ?? "").trim();
    const actTaskId = String(planFact.record_json?.payload?.act_task_id ?? "").trim();
    const transition = await loadLatestFactByTypeAndKey(pool, "operation_plan_transition_v1", "payload,operation_plan_id", operation_plan_id, tenant);
    const approval = approvalRequestId ? await loadLatestFactByTypeAndKey(pool, "approval_decision_v1", "payload,request_id", approvalRequestId, tenant) : null;
    const task = actTaskId
      ? await loadLatestFactByTypeAndKey(pool, "ao_act_task_v0", "payload,act_task_id", actTaskId, tenant)
      : await loadLatestFactByTypeAndKey(pool, "ao_act_task_v0", "payload,operation_plan_id", operation_plan_id, tenant);
    const receipt = actTaskId
      ? await loadLatestFactByTypeAndKey(pool, "ao_act_receipt_v0", "payload,act_task_id", actTaskId, tenant)
      : await loadLatestFactByTypeAndKey(pool, "ao_act_receipt_v0", "payload,operation_plan_id", operation_plan_id, tenant);
    return reply.send({ ok: true, item: { plan: planFact, transition, approval, task, receipt } });
  });



  // GET /api/v1/operations/console
  // Operations workbench aggregate for approvals, monitoring, queue and receipts.
  app.get("/api/v1/operations/console", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = queryTenantFromReq(req, auth);
    if (!requireTenantFieldsPresentOr400(tenant, reply)) return;
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const payload = await buildOperationsConsole(pool, tenant);
    return reply.send({ ok: true, ...payload });
  });

  // GET /api/v1/operations/console/read-model
  // Canonical state projection for operations console (supports plan/field/device/status filters).
  app.get("/api/v1/operations/console/read-model", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = queryTenantFromReq(req, auth);
    if (!requireTenantFieldsPresentOr400(tenant, reply)) return;
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const q: any = (req as any).query ?? {};
    const items = await listOperationPlanStateReadModel(pool, tenant, q);
    return reply.send({ ok: true, items });
  });

  // POST /api/v1/operations/console/read-model/rebuild
  // Rebuild sequence: truncate tenant projection -> replay facts -> regenerate state rows.
  app.post("/api/v1/operations/console/read-model/rebuild", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
    if (!auth) return;
    if (!requireAoActAdminV0(req, reply, { deniedError: "ROLE_APPROVAL_ADMIN_REQUIRED" })) return;
    const body: any = req.body ?? {};
    const tenant: TenantTriple = parseTenantFromBody(body);
    if (!requireTenantFieldsPresentOr400(tenant, reply)) return;
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const rebuilt = await rebuildOperationPlanStateReadModel(pool, tenant);
    return reply.send({
      ok: true,
      rebuilt,
      mode: "truncate_replay_rebuild",
      tenant
    });
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
    const command_id = String(body.command_id ?? act_task_id).trim();
    if (!act_task_id) return badRequest(reply, "MISSING_ACT_TASK_ID");
    if (!command_id) return badRequest(reply, "MISSING_COMMAND_ID");
    if (command_id !== act_task_id) return badRequest(reply, "COMMAND_ID_MUST_MATCH_ACT_TASK_ID");
    const tenant: TenantTriple = parseTenantFromBody(body);
    if (!requireTenantFieldsPresentOr400(tenant, reply)) return;
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
    if (!requireTenantFieldsPresentOr400(tenant, reply)) return;
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
    const tenant: TenantTriple = parseTenantFromBody(body);
    if (!requireTenantFieldsPresentOr400(tenant, reply)) return;
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const task_id = String(body.task_id ?? body.act_task_id ?? "").trim();
    const command_id = String(body.command_id ?? "").trim();
    if (!task_id) return badRequest(reply, "MISSING_TASK_ID");
    if (!command_id) return badRequest(reply, "MISSING_COMMAND_ID");
    if (command_id !== task_id) return badRequest(reply, "COMMAND_TASK_ID_MISMATCH");
    const idempotencyKey = String(body?.meta?.idempotency_key ?? `${task_id}:1:${String(body?.meta?.receipt_code ?? body?.status ?? "SUCCEEDED")}`).trim();
    const receiptV1Dup = await loadReceiptV1ByIdempotencyKey(pool, tenant, idempotencyKey);
    if (receiptV1Dup) return reply.status(409).send({ ok: false, error: "DUPLICATE_RECEIPT" });
    const taskFact = await loadLatestFactByTypeAndKey(pool, "ao_act_task_v0", "payload,act_task_id", task_id, tenant);
    if (!taskFact) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    const operation_plan_id = String(taskFact.record_json?.payload?.operation_plan_id ?? "").trim();
    if (!operation_plan_id) return badRequest(reply, "MISSING_OPERATION_PLAN_ID");
    const operationPlan = await loadLatestFactByTypeAndKey(pool, "operation_plan_v1", "payload,operation_plan_id", operation_plan_id, tenant);
    if (!operationPlan) return reply.status(404).send({ ok: false, error: "OPERATION_PLAN_NOT_FOUND" });
    const delegated = await fetchJson(`${hostBaseUrl(req)}/api/control/ao_act/receipt`, String((req.headers as any).authorization ?? ""), {
      ...body,
      act_task_id: task_id,
      operation_plan_id,
      tenant_id: tenant.tenant_id,
      project_id: tenant.project_id,
      group_id: tenant.group_id
    });
    if (!delegated.ok || !delegated.json?.ok) return reply.status(delegated.status || 400).send(delegated.json ?? { ok: false, error: "RECEIPT_WRITE_FAILED" });
    const receipt_v1_fact_id = await insertFact(pool, "api/v1/ao-act/receipts", {
      type: "ao_act_receipt_v1",
      payload: {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        idempotency_key: idempotencyKey,
        task_id,
        command_id,
        device_id: String(body?.meta?.device_id ?? body?.device_id ?? ""),
        adapter_type: String(body?.meta?.adapter_type ?? "mqtt"),
        attempt_no: Number(body?.meta?.attempt_no ?? 1),
        receipt_status: String(body?.meta?.receipt_status ?? body?.status ?? "SUCCEEDED").toUpperCase(),
        receipt_code: String(body?.meta?.receipt_code ?? body?.status ?? "SUCCEEDED"),
        receipt_message: body?.meta?.receipt_message ?? null,
        raw_receipt_ref: body?.meta?.raw_receipt_ref ?? null,
        received_ts: Number(body?.meta?.received_ts ?? Date.now())
      }
    });
    const wrapper_fact_id = await insertFact(pool, "api/v1/ao-act/receipts", {
      type: "ao_act_receipt_recorded_v1",
      payload: {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        act_task_id: task_id,
        ao_act_receipt_fact_id: delegated.json.fact_id,
        actor_id: auth.actor_id,
        token_id: auth.token_id,
        created_at_ts: Date.now()
      }
    });
    const receiptStatus = String(body.status ?? '').toUpperCase();
    const terminalState = receiptStatus === 'FAILED' ? 'FAILED' : 'SUCCEEDED';
    await updateDispatchQueueStateByActTask(pool, tenant, task_id, { state: terminalState, receipt_fact_id: delegated.json.fact_id });

    // Reload the latest plan before terminal transition because a receipt may arrive via
    // the uplink path immediately after dispatch, and the ACKED transition can be written
    // in the caller request just before this wrapper route executes. Using the earlier
    // operationPlan snapshot can therefore race and try DISPATCHED -> SUCCEEDED.
    let latestPlanForTerminal = await loadLatestFactByTypeAndKey(pool, "operation_plan_v1", "payload,operation_plan_id", operation_plan_id, tenant);
    if (!latestPlanForTerminal) return reply.status(404).send({ ok: false, error: "OPERATION_PLAN_NOT_FOUND" });

    const latestStatus = String(latestPlanForTerminal.record_json?.payload?.status ?? "").trim().toUpperCase();

    // A success receipt can legitimately race ahead of explicit queue state writes.
    // Normalize the plan state forward before applying the terminal transition.
    if (terminalState === "SUCCEEDED") {
      if (latestStatus === "READY") {
        await transitionOperationPlanStateV1(pool, tenant, latestPlanForTerminal, {
          next_status: "DISPATCHED",
          trigger: "receipt_recorded_pre_dispatch",
          act_task_id: task_id,
          receipt_fact_id: delegated.json.fact_id
        }, "api/v1/ao-act/receipts");
        latestPlanForTerminal = await loadLatestFactByTypeAndKey(pool, "operation_plan_v1", "payload,operation_plan_id", operation_plan_id, tenant);
        if (!latestPlanForTerminal) return reply.status(404).send({ ok: false, error: "OPERATION_PLAN_NOT_FOUND" });
      }

      const afterDispatchStatus = String(latestPlanForTerminal.record_json?.payload?.status ?? "").trim().toUpperCase();
      if (afterDispatchStatus === "DISPATCHED") {
        await transitionOperationPlanStateV1(pool, tenant, latestPlanForTerminal, {
          next_status: "ACKED",
          trigger: "receipt_recorded_pre_ack",
          act_task_id: task_id,
          receipt_fact_id: delegated.json.fact_id
        }, "api/v1/ao-act/receipts");
        latestPlanForTerminal = await loadLatestFactByTypeAndKey(pool, "operation_plan_v1", "payload,operation_plan_id", operation_plan_id, tenant);
        if (!latestPlanForTerminal) return reply.status(404).send({ ok: false, error: "OPERATION_PLAN_NOT_FOUND" });
      }
    }

    const currentStatusBeforeTerminal = String(latestPlanForTerminal.record_json?.payload?.status ?? "").trim().toUpperCase();
    if (currentStatusBeforeTerminal === "SUCCEEDED" || currentStatusBeforeTerminal === "FAILED") {
      return reply.send({
        ok: true,
        deduped: true,
        fact_id: delegated.json.fact_id,
        wrapper_fact_id,
        operation_plan_id,
        operation_plan_transition_fact_id: null,
        operation_plan_update_fact_id: null
      });
    }

    const terminalTransition = await transitionOperationPlanStateV1(pool, tenant, latestPlanForTerminal, {
      next_status: terminalState,
      trigger: "receipt_recorded",
      act_task_id: task_id,
      receipt_fact_id: delegated.json.fact_id,
      terminal_reason: terminalState === "FAILED" ? "receipt_status_failed" : "receipt_status_executed"
    }, "api/v1/ao-act/receipts");
    return reply.send({
      ok: true,
      deduped: false,
      fact_id: delegated.json.fact_id,
      wrapper_fact_id,
      operation_plan_id,
      operation_plan_transition_fact_id: terminalTransition.transition_fact_id,
      operation_plan_update_fact_id: terminalTransition.operation_plan_fact_id
    });
  });

  // GET /api/v1/ao-act/receipts
  app.get("/api/v1/ao-act/receipts", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = queryTenantFromReq(req, auth);
    if (!requireTenantFieldsPresentOr400(tenant, reply)) return;
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const q: any = (req as any).query ?? {};
    const items = await listReceipts(pool, tenant, parseLimit(q), typeof q.act_task_id === "string" ? q.act_task_id : undefined);
    return reply.send({ ok: true, items });
  });
}
