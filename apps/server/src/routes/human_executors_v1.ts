import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { requireAoActScopeV0, type AoActAuthContextV0 } from "../auth/ao_act_authz_v0";

type AssignmentStatus = "ASSIGNED" | "ACCEPTED" | "ARRIVED" | "SUBMITTED" | "CANCELLED" | "EXPIRED";
type ExecutorStatus = "ACTIVE" | "DISABLED";

const ASSIGNMENT_STATUS = new Set<AssignmentStatus>(["ASSIGNED", "ACCEPTED", "ARRIVED", "SUBMITTED", "CANCELLED", "EXPIRED"]);
const EXECUTOR_STATUS = new Set<ExecutorStatus>(["ACTIVE", "DISABLED"]);
const SLA_DEFAULTS_FALLBACK = { accept_minutes: 30, arrive_minutes: 120 };
const SLA_DEFAULTS_BY_CROP_JOB: Record<string, { accept_minutes: number; arrive_minutes: number }> = {
  "RICE:IRRIGATION": { accept_minutes: 20, arrive_minutes: 60 },
  "WHEAT:SPRAYING": { accept_minutes: 30, arrive_minutes: 90 },
  "CORN:FERTILIZATION": { accept_minutes: 30, arrive_minutes: 120 },
  "DEFAULT:HARVEST": { accept_minutes: 60, arrive_minutes: 240 },
};


function canTransitionAssignmentStatus(fromStatus: AssignmentStatus, toStatus: AssignmentStatus): boolean {
  if (fromStatus === "SUBMITTED" || fromStatus === "CANCELLED" || fromStatus === "EXPIRED") return false;
  if (toStatus === "CANCELLED") return true;
  if (fromStatus === "ASSIGNED" && toStatus === "ACCEPTED") return true;
  if (fromStatus === "ACCEPTED" && toStatus === "ARRIVED") return true;
  if (fromStatus === "ARRIVED" && toStatus === "SUBMITTED") return true;
  return false;
}

function isNonEmptyString(v: any): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function normalizeId(v: any): string | null {
  if (!isNonEmptyString(v)) return null;
  const s = String(v).trim();
  if (s.length < 1 || s.length > 128) return null;
  if (!/^[A-Za-z0-9_\-:.]+$/.test(s)) return null;
  return s;
}

function badRequest(reply: any, error: string) {
  return reply.status(400).send({ ok: false, error });
}

function normalizeCapabilities(input: any): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input.map((x) => String(x ?? "").trim()).filter(Boolean))).slice(0, 64);
}

function hasAllCapabilities(actual: string[], required: string[]): boolean {
  if (!required.length) return true;
  const set = new Set(actual.map((x) => String(x ?? "").trim()).filter(Boolean));
  return required.every((cap) => set.has(cap));
}

async function resolveTaskRequiredCapabilities(
  pool: Pool,
  auth: AoActAuthContextV0,
  act_task_id: string,
  fallbackInput: any
): Promise<string[]> {
  const fallback = normalizeCapabilities(fallbackInput);
  const taskQ = await pool.query(
    `SELECT (record_json::jsonb) AS record_json
     FROM facts
     WHERE (record_json::jsonb->>'type') = 'ao_act_task_v0'
       AND (record_json::jsonb#>>'{payload,act_task_id}') = $1
       AND (record_json::jsonb#>>'{payload,tenant_id}') = $2
       AND (record_json::jsonb#>>'{payload,project_id}') = $3
       AND (record_json::jsonb#>>'{payload,group_id}') = $4
     ORDER BY occurred_at DESC, fact_id DESC
     LIMIT 1`,
    [act_task_id, auth.tenant_id, auth.project_id, auth.group_id]
  ).catch(() => ({ rows: [] as any[] }));
  const payload: any = taskQ.rows?.[0]?.record_json?.payload ?? {};
  const merged = [
    ...fallback,
    ...normalizeCapabilities(payload.required_capabilities),
    ...normalizeCapabilities(payload.capabilities),
    ...(isNonEmptyString(payload.skill_id) ? [String(payload.skill_id).trim()] : []),
  ];
  return normalizeCapabilities(merged);
}

function parsePgJson(v: any): any {
  if (v == null) return null;
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  }
  return v;
}

function toPositiveInt(raw: any, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.trunc(n);
  if (i < min) return min;
  if (i > max) return max;
  return i;
}

function normalizeAssignmentResponse(row: any) {
  return {
    assignment_id: String(row.assignment_id ?? ""),
    act_task_id: String(row.act_task_id ?? ""),
    executor_id: String(row.executor_id ?? ""),
    assigned_at: row.assigned_at instanceof Date ? row.assigned_at.toISOString() : String(row.assigned_at ?? ""),
    status: String(row.status ?? "") as AssignmentStatus,
    accept_deadline_ts: row.accept_deadline_ts instanceof Date ? row.accept_deadline_ts.toISOString() : (row.accept_deadline_ts ? String(row.accept_deadline_ts) : null),
    arrive_deadline_ts: row.arrive_deadline_ts instanceof Date ? row.arrive_deadline_ts.toISOString() : (row.arrive_deadline_ts ? String(row.arrive_deadline_ts) : null),
    expired_reason: row.expired_reason ? String(row.expired_reason) : null,
    created_ts_ms: Number(row.created_ts_ms ?? 0),
    updated_ts_ms: Number(row.updated_ts_ms ?? 0),
  };
}

function normalizeSlaMinutes(raw: any, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(7 * 24 * 60, Math.trunc(n)));
}

function chooseSlaDefaults(cropCode: string, jobType: string): { accept_minutes: number; arrive_minutes: number } {
  const crop = String(cropCode ?? "").trim().toUpperCase();
  const job = String(jobType ?? "").trim().toUpperCase();
  return SLA_DEFAULTS_BY_CROP_JOB[`${crop}:${job}`]
    ?? SLA_DEFAULTS_BY_CROP_JOB[`DEFAULT:${job}`]
    ?? SLA_DEFAULTS_FALLBACK;
}

async function insertAuditFact(pool: Pool, type: string, auth: AoActAuthContextV0, payload: any): Promise<string> {
  const fact_id = randomUUID();
  await pool.query("INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)", [
    fact_id,
    "api/human_executor_v1",
    {
      type,
      entity: { tenant_id: auth.tenant_id },
      payload: {
        ...payload,
        actor_id: auth.actor_id,
        token_id: auth.token_id,
      },
    },
  ]);
  return fact_id;
}

let ensureHumanExecutorRuntimePromise: Promise<void> | null = null;

async function ensureHumanExecutorRuntime(pool: Pool): Promise<void> {
  if (!ensureHumanExecutorRuntimePromise) {
    ensureHumanExecutorRuntimePromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS service_team_index_v1 (
          tenant_id TEXT NOT NULL,
          team_id TEXT NOT NULL,
          display_name TEXT NOT NULL,
          status TEXT NOT NULL,
          created_ts_ms BIGINT NOT NULL,
          updated_ts_ms BIGINT NOT NULL,
          PRIMARY KEY (tenant_id, team_id),
          CONSTRAINT service_team_status_ck CHECK (status IN ('ACTIVE','DISABLED'))
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS service_team_index_v1_lookup_idx ON service_team_index_v1 (tenant_id, status, updated_ts_ms DESC)`);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS human_executor_index_v1 (
          tenant_id TEXT NOT NULL,
          executor_id TEXT NOT NULL,
          executor_type TEXT NOT NULL DEFAULT 'human',
          display_name TEXT NOT NULL,
          phone TEXT NULL,
          team_id TEXT NULL,
          status TEXT NOT NULL,
          capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_ts_ms BIGINT NOT NULL,
          updated_ts_ms BIGINT NOT NULL,
          PRIMARY KEY (tenant_id, executor_id),
          CONSTRAINT human_executor_type_ck CHECK (executor_type = 'human'),
          CONSTRAINT human_executor_status_ck CHECK (status IN ('ACTIVE','DISABLED'))
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS human_executor_index_v1_lookup_idx ON human_executor_index_v1 (tenant_id, status, updated_ts_ms DESC)`);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS work_assignment_index_v1 (
          tenant_id TEXT NOT NULL,
          assignment_id TEXT NOT NULL,
          act_task_id TEXT NOT NULL,
          executor_id TEXT NOT NULL,
          assigned_at TIMESTAMPTZ NOT NULL,
          status TEXT NOT NULL,
          accept_deadline_ts TIMESTAMPTZ NULL,
          arrive_deadline_ts TIMESTAMPTZ NULL,
          expired_reason TEXT NULL,
          created_ts_ms BIGINT NOT NULL,
          updated_ts_ms BIGINT NOT NULL,
          PRIMARY KEY (tenant_id, assignment_id),
          CONSTRAINT work_assignment_status_ck CHECK (status IN ('ASSIGNED','ACCEPTED','ARRIVED','SUBMITTED','CANCELLED','EXPIRED'))
        )
      `);
      await pool.query(`ALTER TABLE work_assignment_index_v1 ADD COLUMN IF NOT EXISTS accept_deadline_ts TIMESTAMPTZ NULL`);
      await pool.query(`ALTER TABLE work_assignment_index_v1 ADD COLUMN IF NOT EXISTS arrive_deadline_ts TIMESTAMPTZ NULL`);
      await pool.query(`ALTER TABLE work_assignment_index_v1 ADD COLUMN IF NOT EXISTS expired_reason TEXT NULL`);
      await pool.query(`ALTER TABLE work_assignment_index_v1 DROP CONSTRAINT IF EXISTS work_assignment_status_ck`);
      await pool.query(`ALTER TABLE work_assignment_index_v1 ADD CONSTRAINT work_assignment_status_ck CHECK (status IN ('ASSIGNED','ACCEPTED','ARRIVED','SUBMITTED','CANCELLED','EXPIRED'))`);
      await pool.query(`CREATE INDEX IF NOT EXISTS work_assignment_index_v1_lookup_idx ON work_assignment_index_v1 (tenant_id, act_task_id, updated_ts_ms DESC)`);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS work_assignment_audit_v1 (
          tenant_id TEXT NOT NULL,
          audit_id TEXT NOT NULL,
          assignment_id TEXT NOT NULL,
          act_task_id TEXT NOT NULL,
          executor_id TEXT NOT NULL,
          status TEXT NOT NULL,
          occurred_at TIMESTAMPTZ NOT NULL,
          actor_id TEXT NULL,
          token_id TEXT NULL,
          note TEXT NULL,
          PRIMARY KEY (tenant_id, audit_id),
          CONSTRAINT work_assignment_audit_status_ck CHECK (status IN ('ASSIGNED','ACCEPTED','ARRIVED','SUBMITTED','CANCELLED','EXPIRED'))
        )
      `);
      await pool.query(`ALTER TABLE work_assignment_audit_v1 DROP CONSTRAINT IF EXISTS work_assignment_audit_status_ck`);
      await pool.query(`ALTER TABLE work_assignment_audit_v1 ADD CONSTRAINT work_assignment_audit_status_ck CHECK (status IN ('ASSIGNED','ACCEPTED','ARRIVED','SUBMITTED','CANCELLED','EXPIRED'))`);
      await pool.query(`CREATE INDEX IF NOT EXISTS work_assignment_audit_v1_lookup_idx ON work_assignment_audit_v1 (tenant_id, assignment_id, occurred_at DESC)`);
    })().catch((err) => {
      ensureHumanExecutorRuntimePromise = null;
      throw err;
    });
  }
  await ensureHumanExecutorRuntimePromise;
}

async function validateExecutorCapabilityMatch(
  pool: Pool,
  auth: AoActAuthContextV0,
  executor_id: string,
  requiredCapabilities: string[]
): Promise<{ ok: true } | { ok: false; error: string; missing?: string[] }> {
  const executorHumanQ = await pool.query(
    `SELECT capabilities
     FROM human_executor_index_v1
     WHERE tenant_id = $1 AND executor_id = $2
     LIMIT 1`,
    [auth.tenant_id, executor_id]
  );
  if ((executorHumanQ.rowCount ?? 0) > 0) {
    const capabilities = normalizeCapabilities(parsePgJson(executorHumanQ.rows?.[0]?.capabilities));
    if (!hasAllCapabilities(capabilities, requiredCapabilities)) {
      return { ok: false, error: "EXECUTOR_CAPABILITY_MISMATCH", missing: requiredCapabilities.filter((c) => !capabilities.includes(c)) };
    }
    return { ok: true };
  }
  const executorExistsQ = await pool.query(
    `SELECT 1 AS ok FROM device_index_v1 WHERE tenant_id = $1 AND device_id = $2 LIMIT 1`,
    [auth.tenant_id, executor_id]
  );
  if ((executorExistsQ.rowCount ?? 0) < 1) return { ok: false, error: "EXECUTOR_NOT_FOUND_IN_TENANT" };
  return { ok: true };
}

export function registerHumanExecutorV1Routes(app: FastifyInstance, pool: Pool) {
  app.post("/api/v1/service-teams", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "devices.write");
    if (!auth) return;
    await ensureHumanExecutorRuntime(pool);

    const body: any = (req as any).body ?? {};
    const team_id = normalizeId(body.team_id);
    if (!team_id) return badRequest(reply, "MISSING_OR_INVALID:team_id");
    const display_name = isNonEmptyString(body.display_name) ? String(body.display_name).trim().slice(0, 256) : null;
    if (!display_name) return badRequest(reply, "MISSING_OR_INVALID:display_name");
    const status = String(body.status ?? "ACTIVE").trim().toUpperCase();
    if (!EXECUTOR_STATUS.has(status as ExecutorStatus)) return badRequest(reply, "MISSING_OR_INVALID:status");

    const now = Date.now();
    await pool.query(
      `INSERT INTO service_team_index_v1 (tenant_id, team_id, display_name, status, created_ts_ms, updated_ts_ms)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (tenant_id, team_id)
       DO UPDATE SET display_name=EXCLUDED.display_name, status=EXCLUDED.status, updated_ts_ms=EXCLUDED.updated_ts_ms`,
      [auth.tenant_id, team_id, display_name, status, now, now]
    );
    const fact_id = await insertAuditFact(pool, "service_team_upserted_v1", auth, { team_id, display_name, status });
    return reply.send({ ok: true, fact_id, team: { team_id, display_name, status } });
  });

  app.post("/api/v1/human-executors", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "devices.write");
    if (!auth) return;
    await ensureHumanExecutorRuntime(pool);

    const body: any = (req as any).body ?? {};
    const executor_id = normalizeId(body.executor_id);
    if (!executor_id) return badRequest(reply, "MISSING_OR_INVALID:executor_id");
    const display_name = isNonEmptyString(body.display_name) ? String(body.display_name).trim().slice(0, 256) : null;
    if (!display_name) return badRequest(reply, "MISSING_OR_INVALID:display_name");
    const phone = isNonEmptyString(body.phone) ? String(body.phone).trim().slice(0, 64) : null;
    const team_id = normalizeId(body.team_id);
    const status = String(body.status ?? "ACTIVE").trim().toUpperCase();
    if (!EXECUTOR_STATUS.has(status as ExecutorStatus)) return badRequest(reply, "MISSING_OR_INVALID:status");
    const capabilities = normalizeCapabilities(body.capabilities);
    const now = Date.now();

    await pool.query(
      `INSERT INTO human_executor_index_v1
      (tenant_id, executor_id, executor_type, display_name, phone, team_id, status, capabilities, created_ts_ms, updated_ts_ms)
       VALUES ($1,$2,'human',$3,$4,$5,$6,$7::jsonb,$8,$9)
       ON CONFLICT (tenant_id, executor_id)
       DO UPDATE SET display_name=EXCLUDED.display_name, phone=EXCLUDED.phone, team_id=EXCLUDED.team_id, status=EXCLUDED.status, capabilities=EXCLUDED.capabilities, updated_ts_ms=EXCLUDED.updated_ts_ms`,
      [auth.tenant_id, executor_id, display_name, phone, team_id, status, JSON.stringify(capabilities), now, now]
    );

    const fact_id = await insertAuditFact(pool, "human_executor_upserted_v1", auth, {
      executor_id,
      executor_type: "human",
      display_name,
      phone,
      team_id,
      status,
      capabilities,
    });

    return reply.send({
      ok: true,
      fact_id,
      executor: {
        executor_id,
        executor_type: "human",
        display_name,
        phone,
        team_id,
        status,
        capabilities,
      },
    });
  });

  app.get("/api/v1/human-executors", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    await ensureHumanExecutorRuntime(pool);

    const q: any = (req as any).query ?? {};
    const limit = toPositiveInt(q.limit, 50, 1, 200);
    const offset = toPositiveInt(q.offset, 0, 0, 10_000);
    const status = isNonEmptyString(q.status) ? String(q.status).trim().toUpperCase() : null;
    if (status && !EXECUTOR_STATUS.has(status as ExecutorStatus)) return badRequest(reply, "MISSING_OR_INVALID:status");

    const values: any[] = [auth.tenant_id];
    const filters: string[] = ["tenant_id = $1"];
    if (status) {
      values.push(status);
      filters.push(`status = $${values.length}`);
    }
    values.push(limit, offset);
    const listQ = await pool.query(
      `SELECT executor_id, executor_type, display_name, phone, team_id, status, capabilities, created_ts_ms, updated_ts_ms
       FROM human_executor_index_v1
       WHERE ${filters.join(" AND ")}
       ORDER BY updated_ts_ms DESC, executor_id ASC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    return reply.send({
      ok: true,
      items: (listQ.rows ?? []).map((row: any) => ({
        executor_id: String(row.executor_id ?? ""),
        executor_type: "human",
        display_name: String(row.display_name ?? ""),
        phone: row.phone ? String(row.phone) : null,
        team_id: row.team_id ? String(row.team_id) : null,
        status: String(row.status ?? "") as ExecutorStatus,
        capabilities: Array.isArray(parsePgJson(row.capabilities)) ? parsePgJson(row.capabilities) : [],
        created_ts_ms: Number(row.created_ts_ms ?? 0),
        updated_ts_ms: Number(row.updated_ts_ms ?? 0),
      })),
      paging: { limit, offset },
    });
  });

  app.get("/api/v1/human-executors/:executorId", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    await ensureHumanExecutorRuntime(pool);

    const params: any = (req as any).params ?? {};
    const executor_id = normalizeId(params.executorId ?? params.executor_id);
    if (!executor_id) return badRequest(reply, "MISSING_OR_INVALID:executor_id");

    const itemQ = await pool.query(
      `SELECT executor_id, executor_type, display_name, phone, team_id, status, capabilities, created_ts_ms, updated_ts_ms
       FROM human_executor_index_v1
       WHERE tenant_id = $1 AND executor_id = $2
       LIMIT 1`,
      [auth.tenant_id, executor_id]
    );
    if ((itemQ.rowCount ?? 0) < 1) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });

    const row: any = itemQ.rows[0];
    return reply.send({
      ok: true,
      executor: {
        executor_id: String(row.executor_id ?? ""),
        executor_type: "human",
        display_name: String(row.display_name ?? ""),
        phone: row.phone ? String(row.phone) : null,
        team_id: row.team_id ? String(row.team_id) : null,
        status: String(row.status ?? "") as ExecutorStatus,
        capabilities: Array.isArray(parsePgJson(row.capabilities)) ? parsePgJson(row.capabilities) : [],
        created_ts_ms: Number(row.created_ts_ms ?? 0),
        updated_ts_ms: Number(row.updated_ts_ms ?? 0),
      },
    });
  });

  app.post("/api/v1/work-assignments", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
    if (!auth) return;
    await ensureHumanExecutorRuntime(pool);

    const body: any = (req as any).body ?? {};
    const assignment_id = normalizeId(body.assignment_id);
    const act_task_id = normalizeId(body.act_task_id);
    const executor_id = normalizeId(body.executor_id);
    const status = String(body.status ?? "ASSIGNED").trim().toUpperCase();
    const assigned_at = isNonEmptyString(body.assigned_at) ? String(body.assigned_at).trim() : new Date().toISOString();

    if (!assignment_id) return badRequest(reply, "MISSING_OR_INVALID:assignment_id");
    if (!act_task_id) return badRequest(reply, "MISSING_OR_INVALID:act_task_id");
    if (!executor_id) return badRequest(reply, "MISSING_OR_INVALID:executor_id");
    if (!ASSIGNMENT_STATUS.has(status as AssignmentStatus)) return badRequest(reply, "MISSING_OR_INVALID:status");
    if (Number.isNaN(Date.parse(assigned_at))) return badRequest(reply, "MISSING_OR_INVALID:assigned_at");

    const requiredCapabilities = await resolveTaskRequiredCapabilities(pool, auth, act_task_id, body.required_capabilities);
    const capabilityCheck = await validateExecutorCapabilityMatch(pool, auth, executor_id, requiredCapabilities);
    if (!capabilityCheck.ok) return badRequest(reply, capabilityCheck.error);

    const taskMetaQ = await pool.query(
      `SELECT (record_json::jsonb#>>'{payload,crop_code}') AS crop_code,
              COALESCE((record_json::jsonb#>>'{payload,job_type}'), (record_json::jsonb#>>'{payload,action_type}'), '') AS job_type
         FROM facts
        WHERE (record_json::jsonb->>'type') = 'ao_act_task_v0'
          AND (record_json::jsonb#>>'{payload,act_task_id}') = $1
          AND (record_json::jsonb#>>'{payload,tenant_id}') = $2
          AND (record_json::jsonb#>>'{payload,project_id}') = $3
          AND (record_json::jsonb#>>'{payload,group_id}') = $4
        ORDER BY occurred_at DESC, fact_id DESC
        LIMIT 1`,
      [act_task_id, auth.tenant_id, auth.project_id, auth.group_id]
    ).catch(() => ({ rows: [] as any[] }));
    const taskMeta = taskMetaQ.rows?.[0] ?? {};
    const fallbackSla = chooseSlaDefaults(String(taskMeta.crop_code ?? ""), String(taskMeta.job_type ?? ""));
    const assignedAtMs = Date.parse(assigned_at);
    const acceptDeadlineIso = isNonEmptyString(body?.sla?.accept_deadline_ts)
      ? String(body.sla.accept_deadline_ts).trim()
      : new Date(assignedAtMs + normalizeSlaMinutes(body?.sla?.accept_minutes, fallbackSla.accept_minutes) * 60_000).toISOString();
    const arriveDeadlineIso = isNonEmptyString(body?.sla?.arrive_deadline_ts)
      ? String(body.sla.arrive_deadline_ts).trim()
      : new Date(assignedAtMs + normalizeSlaMinutes(body?.sla?.arrive_minutes, fallbackSla.arrive_minutes) * 60_000).toISOString();
    if (Number.isNaN(Date.parse(acceptDeadlineIso))) return badRequest(reply, "MISSING_OR_INVALID:accept_deadline_ts");
    if (Number.isNaN(Date.parse(arriveDeadlineIso))) return badRequest(reply, "MISSING_OR_INVALID:arrive_deadline_ts");
    const now = Date.now();
    await pool.query(
      `INSERT INTO work_assignment_index_v1
      (tenant_id, assignment_id, act_task_id, executor_id, assigned_at, status, accept_deadline_ts, arrive_deadline_ts, expired_reason, created_ts_ms, updated_ts_ms)
       VALUES ($1,$2,$3,$4,$5::timestamptz,$6,$7::timestamptz,$8::timestamptz,NULL,$9,$10)
       ON CONFLICT (tenant_id, assignment_id)
       DO UPDATE SET act_task_id=EXCLUDED.act_task_id, executor_id=EXCLUDED.executor_id, assigned_at=EXCLUDED.assigned_at, status=EXCLUDED.status, accept_deadline_ts=EXCLUDED.accept_deadline_ts, arrive_deadline_ts=EXCLUDED.arrive_deadline_ts, expired_reason=EXCLUDED.expired_reason, updated_ts_ms=EXCLUDED.updated_ts_ms`,
      [auth.tenant_id, assignment_id, act_task_id, executor_id, assigned_at, status, acceptDeadlineIso, arriveDeadlineIso, now, now]
    );

    const audit_id = randomUUID();
    await pool.query(
      `INSERT INTO work_assignment_audit_v1
       (tenant_id, audit_id, assignment_id, act_task_id, executor_id, status, occurred_at, actor_id, token_id, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9,$10)`,
      [auth.tenant_id, audit_id, assignment_id, act_task_id, executor_id, status, assigned_at, auth.actor_id, auth.token_id, "CREATE_OR_UPSERT"]
    );

    const fact_id = await insertAuditFact(pool, "work_assignment_upserted_v1", auth, {
      assignment_id,
      act_task_id,
      executor_id,
      required_capabilities: requiredCapabilities,
      assigned_at,
      status,
      accept_deadline_ts: acceptDeadlineIso,
      arrive_deadline_ts: arriveDeadlineIso,
      audit_id,
    });

    return reply.send({ ok: true, fact_id, assignment: { assignment_id, act_task_id, executor_id, assigned_at, status, accept_deadline_ts: acceptDeadlineIso, arrive_deadline_ts: arriveDeadlineIso, expired_reason: null } });
  });

  app.get("/api/v1/human-executors/dispatch-workbench", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    await ensureHumanExecutorRuntime(pool);

    const q: any = (req as any).query ?? {};
    const limit = toPositiveInt(q.limit, 100, 1, 500);
    const field_id = normalizeId(q.field_id);
    const required_capability = isNonEmptyString(q.required_capability) ? String(q.required_capability).trim() : null;
    const window_start_ts = Number(q.window_start_ts);
    const window_end_ts = Number(q.window_end_ts);

    const values: any[] = [auth.tenant_id, auth.project_id, auth.group_id];
    const filters: string[] = [
      "(f.record_json::jsonb#>>'{payload,tenant_id}') = $1",
      "(f.record_json::jsonb#>>'{payload,project_id}') = $2",
      "(f.record_json::jsonb#>>'{payload,group_id}') = $3",
      "(f.record_json::jsonb->>'type') = 'ao_act_task_v0'",
    ];
    if (field_id) {
      values.push(field_id);
      filters.push(`(f.record_json::jsonb#>>'{payload,field_id}') = $${values.length}`);
    }
    if (required_capability) {
      values.push(required_capability);
      filters.push(`(
        (f.record_json::jsonb#>>'{payload,skill_id}') = $${values.length}
        OR (f.record_json::jsonb#>>'{payload,required_capabilities}') ILIKE '%' || $${values.length} || '%'
        OR (f.record_json::jsonb#>>'{payload,capabilities}') ILIKE '%' || $${values.length} || '%'
      )`);
    }
    if (Number.isFinite(window_start_ts)) {
      values.push(Math.trunc(window_start_ts));
      filters.push(`COALESCE((f.record_json::jsonb#>>'{payload,time_window,end_ts}')::bigint, 0) >= $${values.length}`);
    }
    if (Number.isFinite(window_end_ts)) {
      values.push(Math.trunc(window_end_ts));
      filters.push(`COALESCE((f.record_json::jsonb#>>'{payload,time_window,start_ts}')::bigint, 0) <= $${values.length}`);
    }
    values.push(limit);

    const listQ = await pool.query(
      `WITH latest_task AS (
         SELECT DISTINCT ON ((f.record_json::jsonb#>>'{payload,act_task_id}'))
           (f.record_json::jsonb#>>'{payload,act_task_id}') AS act_task_id,
           (f.record_json::jsonb#>>'{payload,field_id}') AS field_id,
           COALESCE((f.record_json::jsonb#>>'{payload,action_type}'), '') AS action_type,
           (f.record_json::jsonb#>>'{payload,skill_id}') AS skill_id,
           (f.record_json::jsonb#>'{payload,required_capabilities}') AS required_capabilities,
           (f.record_json::jsonb#>'{payload,capabilities}') AS capabilities,
           (f.record_json::jsonb#>>'{payload,time_window,start_ts}')::bigint AS time_window_start_ts,
           (f.record_json::jsonb#>>'{payload,time_window,end_ts}')::bigint AS time_window_end_ts,
           f.occurred_at
         FROM facts f
         WHERE ${filters.join(" AND ")}
         ORDER BY (f.record_json::jsonb#>>'{payload,act_task_id}') ASC, f.occurred_at DESC, f.fact_id DESC
       )
       SELECT t.act_task_id, t.field_id, t.action_type, t.skill_id, t.required_capabilities, t.capabilities, t.time_window_start_ts, t.time_window_end_ts, t.occurred_at AS task_created_at
       FROM latest_task t
       LEFT JOIN work_assignment_index_v1 wa
         ON wa.tenant_id = $1 AND wa.act_task_id = t.act_task_id AND wa.status IN ('ASSIGNED','ACCEPTED','ARRIVED')
       WHERE wa.assignment_id IS NULL
       ORDER BY t.occurred_at DESC, t.act_task_id ASC
       LIMIT $${values.length}`,
      values
    );

    return reply.send({
      ok: true,
      items: (listQ.rows ?? []).map((row: any) => {
        const required = normalizeCapabilities(parsePgJson(row.required_capabilities));
        const fallback = normalizeCapabilities(parsePgJson(row.capabilities));
        const skill = isNonEmptyString(row.skill_id) ? [String(row.skill_id).trim()] : [];
        return {
          act_task_id: String(row.act_task_id ?? ""),
          field_id: row.field_id ? String(row.field_id) : null,
          action_type: row.action_type ? String(row.action_type) : null,
          skill_id: row.skill_id ? String(row.skill_id) : null,
          required_capabilities: normalizeCapabilities([...required, ...fallback, ...skill]),
          time_window_start_ts: Number.isFinite(Number(row.time_window_start_ts)) ? Number(row.time_window_start_ts) : null,
          time_window_end_ts: Number.isFinite(Number(row.time_window_end_ts)) ? Number(row.time_window_end_ts) : null,
          task_created_at: row.task_created_at instanceof Date ? row.task_created_at.toISOString() : String(row.task_created_at ?? ""),
        };
      }),
    });
  });

  app.post("/api/v1/work-assignments/batch-create", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
    if (!auth) return;
    await ensureHumanExecutorRuntime(pool);
    const body: any = (req as any).body ?? {};
    const items = Array.isArray(body.items) ? body.items.slice(0, 200) : [];
    if (!items.length) return badRequest(reply, "MISSING_OR_INVALID:items");

    const created: any[] = [];
    const errors: any[] = [];
    for (const item of items) {
      const assignment_id = normalizeId(item?.assignment_id);
      const act_task_id = normalizeId(item?.act_task_id);
      const executor_id = normalizeId(item?.executor_id);
      const status = String(item?.status ?? "ASSIGNED").trim().toUpperCase();
      const assigned_at = isNonEmptyString(item?.assigned_at) ? String(item.assigned_at).trim() : new Date().toISOString();
      if (!assignment_id || !act_task_id || !executor_id || !ASSIGNMENT_STATUS.has(status as AssignmentStatus) || Number.isNaN(Date.parse(assigned_at))) {
        errors.push({ assignment_id: assignment_id ?? null, error: "MISSING_OR_INVALID:assignment_item" });
        continue;
      }
      const requiredCapabilities = await resolveTaskRequiredCapabilities(pool, auth, act_task_id, item.required_capabilities);
      const capabilityCheck = await validateExecutorCapabilityMatch(pool, auth, executor_id, requiredCapabilities);
      if (!capabilityCheck.ok) {
        errors.push({ assignment_id, executor_id, error: capabilityCheck.error, missing: capabilityCheck.missing ?? [] });
        continue;
      }
      const fallbackSla = chooseSlaDefaults("", "");
      const assignedAtMs = Date.parse(assigned_at);
      const acceptDeadlineIso = isNonEmptyString(item?.sla?.accept_deadline_ts)
        ? String(item.sla.accept_deadline_ts).trim()
        : new Date(assignedAtMs + normalizeSlaMinutes(item?.sla?.accept_minutes, fallbackSla.accept_minutes) * 60_000).toISOString();
      const arriveDeadlineIso = isNonEmptyString(item?.sla?.arrive_deadline_ts)
        ? String(item.sla.arrive_deadline_ts).trim()
        : new Date(assignedAtMs + normalizeSlaMinutes(item?.sla?.arrive_minutes, fallbackSla.arrive_minutes) * 60_000).toISOString();
      if (Number.isNaN(Date.parse(acceptDeadlineIso)) || Number.isNaN(Date.parse(arriveDeadlineIso))) {
        errors.push({ assignment_id, error: "MISSING_OR_INVALID:sla" });
        continue;
      }
      const now = Date.now();
      await pool.query(
        `INSERT INTO work_assignment_index_v1
         (tenant_id, assignment_id, act_task_id, executor_id, assigned_at, status, accept_deadline_ts, arrive_deadline_ts, expired_reason, created_ts_ms, updated_ts_ms)
         VALUES ($1,$2,$3,$4,$5::timestamptz,$6,$7::timestamptz,$8::timestamptz,NULL,$9,$10)
         ON CONFLICT (tenant_id, assignment_id)
         DO UPDATE SET act_task_id=EXCLUDED.act_task_id, executor_id=EXCLUDED.executor_id, assigned_at=EXCLUDED.assigned_at, status=EXCLUDED.status, accept_deadline_ts=EXCLUDED.accept_deadline_ts, arrive_deadline_ts=EXCLUDED.arrive_deadline_ts, expired_reason=EXCLUDED.expired_reason, updated_ts_ms=EXCLUDED.updated_ts_ms`,
        [auth.tenant_id, assignment_id, act_task_id, executor_id, assigned_at, status, acceptDeadlineIso, arriveDeadlineIso, now, now]
      );
      const audit_id = randomUUID();
      await pool.query(
        `INSERT INTO work_assignment_audit_v1
         (tenant_id, audit_id, assignment_id, act_task_id, executor_id, status, occurred_at, actor_id, token_id, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9,$10)`,
        [auth.tenant_id, audit_id, assignment_id, act_task_id, executor_id, status, assigned_at, auth.actor_id, auth.token_id, "BATCH_CREATE"]
      );
      const fact_id = await insertAuditFact(pool, "work_assignment_upserted_v1", auth, {
        assignment_id, act_task_id, executor_id, required_capabilities: requiredCapabilities, assigned_at, status, accept_deadline_ts: acceptDeadlineIso, arrive_deadline_ts: arriveDeadlineIso, audit_id,
      });
      created.push({ assignment_id, fact_id });
    }
    return reply.send({ ok: errors.length < items.length, created, errors });
  });

  app.post("/api/v1/work-assignments/batch-reassign", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
    if (!auth) return;
    await ensureHumanExecutorRuntime(pool);
    const body: any = (req as any).body ?? {};
    const items = Array.isArray(body.items) ? body.items.slice(0, 200) : [];
    if (!items.length) return badRequest(reply, "MISSING_OR_INVALID:items");

    const updated: any[] = [];
    const errors: any[] = [];
    for (const item of items) {
      const assignment_id = normalizeId(item?.assignment_id);
      const executor_id = normalizeId(item?.executor_id);
      const note = isNonEmptyString(item?.note) ? String(item.note).trim().slice(0, 512) : "BATCH_REASSIGN";
      if (!assignment_id || !executor_id) {
        errors.push({ assignment_id: assignment_id ?? null, error: "MISSING_OR_INVALID:assignment_id_or_executor_id" });
        continue;
      }
      const existingQ = await pool.query(
        `SELECT assignment_id, act_task_id, executor_id, status
         FROM work_assignment_index_v1
         WHERE tenant_id = $1 AND assignment_id = $2
         LIMIT 1`,
        [auth.tenant_id, assignment_id]
      );
      const row = existingQ.rows?.[0];
      if (!row) {
        errors.push({ assignment_id, error: "NOT_FOUND" });
        continue;
      }
      const fromStatus = String(row.status ?? "") as AssignmentStatus;
      if (["SUBMITTED", "CANCELLED", "EXPIRED"].includes(fromStatus)) {
        errors.push({ assignment_id, error: "REASSIGN_NOT_ALLOWED_FOR_FINAL_STATUS", status: fromStatus });
        continue;
      }
      const act_task_id = String(row.act_task_id ?? "");
      const requiredCapabilities = await resolveTaskRequiredCapabilities(pool, auth, act_task_id, item.required_capabilities);
      const capabilityCheck = await validateExecutorCapabilityMatch(pool, auth, executor_id, requiredCapabilities);
      if (!capabilityCheck.ok) {
        errors.push({ assignment_id, executor_id, error: capabilityCheck.error, missing: capabilityCheck.missing ?? [] });
        continue;
      }
      await pool.query(
        `UPDATE work_assignment_index_v1
         SET executor_id = $3, updated_ts_ms = $4
         WHERE tenant_id = $1 AND assignment_id = $2`,
        [auth.tenant_id, assignment_id, executor_id, Date.now()]
      );
      const nowIso = new Date().toISOString();
      const audit_id = randomUUID();
      await pool.query(
        `INSERT INTO work_assignment_audit_v1
         (tenant_id, audit_id, assignment_id, act_task_id, executor_id, status, occurred_at, actor_id, token_id, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9,$10)`,
        [auth.tenant_id, audit_id, assignment_id, act_task_id, executor_id, fromStatus, nowIso, auth.actor_id, auth.token_id, note]
      );
      const fact_id = await insertAuditFact(pool, "work_assignment_upserted_v1", auth, {
        assignment_id, act_task_id, executor_id, from_executor_id: String(row.executor_id ?? ""), required_capabilities: requiredCapabilities, status: fromStatus, changed_at: nowIso, note, audit_id,
      });
      updated.push({ assignment_id, executor_id, fact_id });
    }
    return reply.send({ ok: errors.length < items.length, updated, errors });
  });

  app.post("/api/v1/work-assignments/batch-cancel", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
    if (!auth) return;
    await ensureHumanExecutorRuntime(pool);
    const body: any = (req as any).body ?? {};
    const items = Array.isArray(body.items) ? body.items.slice(0, 200) : [];
    if (!items.length) return badRequest(reply, "MISSING_OR_INVALID:items");

    const updated: any[] = [];
    const errors: any[] = [];
    for (const item of items) {
      const assignment_id = normalizeId(item?.assignment_id);
      const note = isNonEmptyString(item?.note) ? String(item.note).trim().slice(0, 512) : "BATCH_CANCEL";
      if (!assignment_id) {
        errors.push({ assignment_id: null, error: "MISSING_OR_INVALID:assignment_id" });
        continue;
      }
      const existingQ = await pool.query(
        `SELECT assignment_id, act_task_id, executor_id, status
         FROM work_assignment_index_v1
         WHERE tenant_id = $1 AND assignment_id = $2
         LIMIT 1`,
        [auth.tenant_id, assignment_id]
      );
      const row = existingQ.rows?.[0];
      if (!row) {
        errors.push({ assignment_id, error: "NOT_FOUND" });
        continue;
      }
      const fromStatus = String(row.status ?? "") as AssignmentStatus;
      if (!canTransitionAssignmentStatus(fromStatus, "CANCELLED")) {
        errors.push({ assignment_id, error: "INVALID_STATUS_TRANSITION", from_status: fromStatus, to_status: "CANCELLED" });
        continue;
      }
      const updateQ = await pool.query(
        `UPDATE work_assignment_index_v1
         SET status = 'CANCELLED', expired_reason = COALESCE(expired_reason, $4), updated_ts_ms = $3
         WHERE tenant_id = $1 AND assignment_id = $2 AND status = $5`,
        [auth.tenant_id, assignment_id, Date.now(), note, fromStatus]
      );
      if ((updateQ.rowCount ?? 0) < 1) {
        errors.push({ assignment_id, error: "CONFLICT" });
        continue;
      }
      const nowIso = new Date().toISOString();
      const audit_id = randomUUID();
      await pool.query(
        `INSERT INTO work_assignment_audit_v1
         (tenant_id, audit_id, assignment_id, act_task_id, executor_id, status, occurred_at, actor_id, token_id, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9,$10)`,
        [auth.tenant_id, audit_id, assignment_id, String(row.act_task_id ?? ""), String(row.executor_id ?? ""), "CANCELLED", nowIso, auth.actor_id, auth.token_id, note]
      );
      const fact_id = await insertAuditFact(pool, "work_assignment_status_changed_v1", auth, {
        assignment_id, act_task_id: String(row.act_task_id ?? ""), executor_id: String(row.executor_id ?? ""), from_status: fromStatus, status: "CANCELLED", changed_at: nowIso, note, audit_id,
      });
      updated.push({ assignment_id, fact_id, status: "CANCELLED" });
    }
    return reply.send({ ok: errors.length < items.length, updated, errors });
  });

  app.get("/api/v1/work-assignments", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    await ensureHumanExecutorRuntime(pool);

    const q: any = (req as any).query ?? {};
    const limit = toPositiveInt(q.limit, 50, 1, 200);
    const offset = toPositiveInt(q.offset, 0, 0, 10_000);
    const status = isNonEmptyString(q.status) ? String(q.status).trim().toUpperCase() : null;
    const executor_id = normalizeId(q.executor_id);
    const act_task_id = normalizeId(q.act_task_id);
    if (status && !ASSIGNMENT_STATUS.has(status as AssignmentStatus)) return badRequest(reply, "MISSING_OR_INVALID:status");

    const values: any[] = [auth.tenant_id];
    const filters: string[] = ["tenant_id = $1"];
    if (status) {
      values.push(status);
      filters.push(`status = $${values.length}`);
    }
    if (executor_id) {
      values.push(executor_id);
      filters.push(`executor_id = $${values.length}`);
    }
    if (act_task_id) {
      values.push(act_task_id);
      filters.push(`act_task_id = $${values.length}`);
    }
    values.push(limit, offset);

    const listQ = await pool.query(
      `SELECT assignment_id, act_task_id, executor_id, assigned_at, status, accept_deadline_ts, arrive_deadline_ts, expired_reason, created_ts_ms, updated_ts_ms
       FROM work_assignment_index_v1
       WHERE ${filters.join(" AND ")}
       ORDER BY updated_ts_ms DESC, assignment_id ASC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    return reply.send({
      ok: true,
      items: (listQ.rows ?? []).map((row: any) => normalizeAssignmentResponse(row)),
      paging: { limit, offset },
    });
  });

  app.get("/api/v1/work-assignments/:assignmentId", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    await ensureHumanExecutorRuntime(pool);

    const params: any = (req as any).params ?? {};
    const assignment_id = normalizeId(params.assignmentId ?? params.assignment_id);
    if (!assignment_id) return badRequest(reply, "MISSING_OR_INVALID:assignment_id");

    const itemQ = await pool.query(
      `SELECT assignment_id, act_task_id, executor_id, assigned_at, status, accept_deadline_ts, arrive_deadline_ts, expired_reason, created_ts_ms, updated_ts_ms
       FROM work_assignment_index_v1
       WHERE tenant_id = $1 AND assignment_id = $2
       LIMIT 1`,
      [auth.tenant_id, assignment_id]
    );
    if ((itemQ.rowCount ?? 0) < 1) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });

    return reply.send({ ok: true, assignment: normalizeAssignmentResponse(itemQ.rows[0]) });
  });

  app.patch("/api/v1/work-assignments/:assignment_id/status", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
    if (!auth) return;
    await ensureHumanExecutorRuntime(pool);

    const params: any = (req as any).params ?? {};
    const body: any = (req as any).body ?? {};
    const assignment_id = normalizeId(params.assignment_id);
    if (!assignment_id) return badRequest(reply, "MISSING_OR_INVALID:assignment_id");

    const status = String(body.status ?? "").trim().toUpperCase();
    if (!ASSIGNMENT_STATUS.has(status as AssignmentStatus)) return badRequest(reply, "MISSING_OR_INVALID:status");
    const note = isNonEmptyString(body.note) ? String(body.note).trim().slice(0, 512) : null;

    const existingQ = await pool.query(
      `SELECT assignment_id, act_task_id, executor_id, assigned_at FROM work_assignment_index_v1 WHERE tenant_id = $1 AND assignment_id = $2 LIMIT 1`,
      [auth.tenant_id, assignment_id]
    );
    const row = existingQ.rows?.[0];
    if (!row) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });

    const nowIso = new Date().toISOString();
    await pool.query(
      `UPDATE work_assignment_index_v1 SET status = $3, expired_reason = CASE WHEN $3 IN ('CANCELLED','EXPIRED') THEN COALESCE(expired_reason, $5) ELSE NULL END, updated_ts_ms = $4 WHERE tenant_id = $1 AND assignment_id = $2`,
      [auth.tenant_id, assignment_id, status, Date.now(), note]
    );

    const audit_id = randomUUID();
    await pool.query(
      `INSERT INTO work_assignment_audit_v1
       (tenant_id, audit_id, assignment_id, act_task_id, executor_id, status, occurred_at, actor_id, token_id, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9,$10)`,
      [auth.tenant_id, audit_id, assignment_id, String(row.act_task_id), String(row.executor_id), status, nowIso, auth.actor_id, auth.token_id, note]
    );

    const fact_id = await insertAuditFact(pool, "work_assignment_status_changed_v1", auth, {
      assignment_id,
      act_task_id: String(row.act_task_id),
      executor_id: String(row.executor_id),
      status,
      changed_at: nowIso,
      note,
      audit_id,
    });

    return reply.send({ ok: true, fact_id, assignment_id, status, changed_at: nowIso });
  });

  async function transitionAssignmentStatus(
    req: any,
    reply: any,
    targetStatus: AssignmentStatus,
    scope: "ao_act.task.write" | "ao_act.receipt.write",
    note: string
  ): Promise<any> {
    const auth = requireAoActScopeV0(req, reply, scope);
    if (!auth) return;
    await ensureHumanExecutorRuntime(pool);

    const params: any = req.params ?? {};
    const assignment_id = normalizeId(params.assignmentId ?? params.assignment_id);
    if (!assignment_id) return badRequest(reply, "MISSING_OR_INVALID:assignment_id");

    const existingQ = await pool.query(
      `SELECT assignment_id, act_task_id, executor_id, status
       FROM work_assignment_index_v1
       WHERE tenant_id = $1 AND assignment_id = $2
       LIMIT 1`,
      [auth.tenant_id, assignment_id]
    );
    const row = existingQ.rows?.[0];
    if (!row) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });

    const fromStatus = String(row.status ?? "") as AssignmentStatus;
    if (!canTransitionAssignmentStatus(fromStatus, targetStatus)) {
      return reply.status(409).send({
        ok: false,
        error: "INVALID_STATUS_TRANSITION",
        from_status: fromStatus,
        to_status: targetStatus,
      });
    }

    const act_task_id = String(row.act_task_id ?? "");
    const executor_id = String(row.executor_id ?? "");
    const nowIso = new Date().toISOString();

    const updateQ = await pool.query(
      `UPDATE work_assignment_index_v1
       SET status = $3, expired_reason = CASE WHEN $3 IN ('CANCELLED','EXPIRED') THEN COALESCE(expired_reason, $6) ELSE NULL END, updated_ts_ms = $5
       WHERE tenant_id = $1 AND assignment_id = $2 AND status = $4`,
      [auth.tenant_id, assignment_id, targetStatus, fromStatus, Date.now(), note]
    );
    if ((updateQ.rowCount ?? 0) < 1) {
      return reply.status(409).send({
        ok: false,
        error: "CONFLICT",
        message: "ASSIGNMENT_STATUS_CONCURRENTLY_UPDATED",
      });
    }

    const audit_id = randomUUID();
    await pool.query(
      `INSERT INTO work_assignment_audit_v1
       (tenant_id, audit_id, assignment_id, act_task_id, executor_id, status, occurred_at, actor_id, token_id, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9,$10)`,
      [auth.tenant_id, audit_id, assignment_id, act_task_id, executor_id, targetStatus, nowIso, auth.actor_id, auth.token_id, note]
    );

    const fact_id = await insertAuditFact(pool, "work_assignment_status_changed_v1", auth, {
      assignment_id,
      act_task_id,
      executor_id,
      from_status: fromStatus,
      status: targetStatus,
      changed_at: nowIso,
      note,
      audit_id,
    });

    return reply.send({ ok: true, fact_id, assignment_id, act_task_id, executor_id, status: targetStatus, changed_at: nowIso });
  }

  app.post("/api/v1/work-assignments/:assignmentId/accept", async (req, reply) => {
    return transitionAssignmentStatus(req, reply, "ACCEPTED", "ao_act.task.write", "ASSIGNMENT_ACCEPTED_V1");
  });

  app.post("/api/v1/work-assignments/:assignmentId/arrive", async (req, reply) => {
    return transitionAssignmentStatus(req, reply, "ARRIVED", "ao_act.task.write", "ASSIGNMENT_ARRIVED_V1");
  });

  app.post("/api/v1/work-assignments/:assignmentId/submit", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.receipt.write");
    if (!auth) return;
    await ensureHumanExecutorRuntime(pool);

    const params: any = (req as any).params ?? {};
    const body: any = (req as any).body ?? {};
    const assignment_id = normalizeId(params.assignmentId ?? params.assignment_id);
    if (!assignment_id) return badRequest(reply, "MISSING_OR_INVALID:assignment_id");

    const existingQ = await pool.query(
      `SELECT assignment_id, act_task_id, executor_id, status
       FROM work_assignment_index_v1
       WHERE tenant_id = $1 AND assignment_id = $2
       LIMIT 1`,
      [auth.tenant_id, assignment_id]
    );
    const assignment = existingQ.rows?.[0];
    if (!assignment) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });

    const fromStatus = String(assignment.status ?? "") as AssignmentStatus;
    if (!canTransitionAssignmentStatus(fromStatus, "SUBMITTED")) {
      return reply.status(409).send({
        ok: false,
        error: "INVALID_STATUS_TRANSITION",
        from_status: fromStatus,
        to_status: "SUBMITTED",
      });
    }

    const act_task_id = String(assignment.act_task_id ?? "");
    const taskQ = await pool.query(
      `SELECT (record_json::jsonb) AS record_json
       FROM facts
       WHERE (record_json::jsonb->>'type') = 'ao_act_task_v0'
         AND (record_json::jsonb#>>'{payload,act_task_id}') = $1
         AND (record_json::jsonb#>>'{payload,tenant_id}') = $2
         AND (record_json::jsonb#>>'{payload,project_id}') = $3
         AND (record_json::jsonb#>>'{payload,group_id}') = $4
       ORDER BY occurred_at DESC, fact_id DESC
       LIMIT 1`,
      [act_task_id, auth.tenant_id, auth.project_id, auth.group_id]
    );
    if ((taskQ.rowCount ?? 0) < 1) return reply.status(404).send({ ok: false, error: "TASK_NOT_FOUND" });

    const taskPayload: any = taskQ.rows[0]?.record_json?.payload ?? {};
    const operation_plan_id = normalizeId(taskPayload.operation_plan_id);
    if (!operation_plan_id) return badRequest(reply, "TASK_OPERATION_PLAN_ID_MISSING");

    const now = Date.now();
    const start_ts = Number(body.execution_time?.start_ts ?? body.start_ts ?? now);
    const end_ts = Number(body.execution_time?.end_ts ?? body.end_ts ?? now);
    if (!Number.isFinite(start_ts) || !Number.isFinite(end_ts) || start_ts > end_ts) return badRequest(reply, "EXECUTION_TIME_INVALID");

    const delegatedPayload = {
      tenant_id: auth.tenant_id,
      project_id: auth.project_id,
      group_id: auth.group_id,
      operation_plan_id,
      act_task_id,
      executor_id: {
        kind: "human",
        id: String(assignment.executor_id ?? ""),
        namespace: "human_executor_v1",
      },
      execution_time: { start_ts, end_ts },
      execution_coverage: {
        kind: String(body.execution_coverage?.kind ?? "field"),
        ref: String(body.execution_coverage?.ref ?? body.coverage_ref ?? "field_unknown"),
      },
      resource_usage: {
        fuel_l: body.resource_usage?.fuel_l ?? null,
        electric_kwh: body.resource_usage?.electric_kwh ?? null,
        water_l: body.resource_usage?.water_l ?? null,
        chemical_ml: body.resource_usage?.chemical_ml ?? null,
      },
      logs_refs: Array.isArray(body.logs_refs) && body.logs_refs.length > 0
        ? body.logs_refs
        : [{ kind: "human_submission", ref: `work-assignment://${assignment_id}/${now}` }],
      status: String(body.status ?? "executed").trim().toLowerCase() === "not_executed" ? "not_executed" : "executed",
      constraint_check: {
        violated: Boolean(body.constraint_check?.violated ?? false),
        violations: Array.isArray(body.constraint_check?.violations) ? body.constraint_check.violations.map((x: any) => String(x)) : [],
      },
      observed_parameters: body.observed_parameters && typeof body.observed_parameters === "object" ? body.observed_parameters : {},
      meta: {
        ...(body.meta && typeof body.meta === "object" ? body.meta : {}),
        assignment_id,
        idempotency_key: String(body.meta?.idempotency_key ?? `assignment_submit_${assignment_id}_${now}`),
        command_id: act_task_id,
        submit_source: "api/v1/work-assignments/:assignmentId/submit",
      },
    };

    const delegated = await app.inject({
      method: "POST",
      url: "/api/control/ao_act/receipt",
      headers: {
        authorization: String((req.headers as any)?.authorization ?? ""),
      },
      payload: delegatedPayload,
    });

    const delegatedJson = delegated.json();
    if (delegated.statusCode >= 400 || !delegatedJson?.ok) {
      return reply.status(delegated.statusCode >= 400 ? delegated.statusCode : 400).send({
        ok: false,
        error: "RECEIPT_WRITE_FAILED",
        detail: delegatedJson ?? null,
      });
    }

    const nowIso = new Date().toISOString();
    const updateQ = await pool.query(
      `UPDATE work_assignment_index_v1
       SET status = 'SUBMITTED', expired_reason = NULL, updated_ts_ms = $4
       WHERE tenant_id = $1 AND assignment_id = $2 AND status = $3`,
      [auth.tenant_id, assignment_id, fromStatus, Date.now()]
    );
    if ((updateQ.rowCount ?? 0) < 1) {
      return reply.status(409).send({
        ok: false,
        error: "CONFLICT",
        message: "ASSIGNMENT_STATUS_CONCURRENTLY_UPDATED",
      });
    }

    const audit_id = randomUUID();
    await pool.query(
      `INSERT INTO work_assignment_audit_v1
       (tenant_id, audit_id, assignment_id, act_task_id, executor_id, status, occurred_at, actor_id, token_id, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9,$10)`,
      [auth.tenant_id, audit_id, assignment_id, act_task_id, String(assignment.executor_id ?? ""), "SUBMITTED", nowIso, auth.actor_id, auth.token_id, `RECEIPT_FACT:${String(delegatedJson.fact_id ?? "")}`]
    );

    const fact_id = await insertAuditFact(pool, "work_assignment_submitted_v1", auth, {
      assignment_id,
      act_task_id,
      executor_id: String(assignment.executor_id ?? ""),
      from_status: fromStatus,
      status: "SUBMITTED",
      changed_at: nowIso,
      receipt_fact_id: String(delegatedJson.fact_id ?? ""),
      audit_id,
    });

    return reply.send({
      ok: true,
      fact_id,
      assignment_id,
      status: "SUBMITTED",
      changed_at: nowIso,
      receipt_fact_id: String(delegatedJson.fact_id ?? ""),
      receipt: delegatedJson,
    });
  });

  app.get("/api/v1/work-assignments/:assignment_id/audit", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    await ensureHumanExecutorRuntime(pool);

    const params: any = (req as any).params ?? {};
    const assignment_id = normalizeId(params.assignment_id);
    if (!assignment_id) return badRequest(reply, "MISSING_OR_INVALID:assignment_id");

    const q = await pool.query(
      `SELECT audit_id, assignment_id, act_task_id, executor_id, status, occurred_at, actor_id, token_id, note
       FROM work_assignment_audit_v1
       WHERE tenant_id = $1 AND assignment_id = $2
       ORDER BY occurred_at ASC, audit_id ASC`,
      [auth.tenant_id, assignment_id]
    );

    return reply.send({ ok: true, assignment_id, items: q.rows ?? [] });
  });
}

type AssignmentExpiryWorkerOptions = {
  interval_ms: number;
  batch_size: number;
};

export function startAssignmentExpiryWorker(pool: Pool, opts?: Partial<AssignmentExpiryWorkerOptions>): void {
  const interval_ms = opts?.interval_ms ?? 30_000;
  const batch_size = opts?.batch_size ?? 100;

  async function tick(): Promise<void> {
    await ensureHumanExecutorRuntime(pool);
    const nowIso = new Date().toISOString();
    const q = await pool.query(
      `SELECT tenant_id, assignment_id, act_task_id, executor_id, status
       FROM work_assignment_index_v1
       WHERE (
         status = 'ASSIGNED' AND accept_deadline_ts IS NOT NULL AND accept_deadline_ts < NOW()
       ) OR (
         status = 'ACCEPTED' AND arrive_deadline_ts IS NOT NULL AND arrive_deadline_ts < NOW()
       )
       ORDER BY updated_ts_ms ASC
       LIMIT $1`,
      [batch_size]
    );
    for (const row of q.rows ?? []) {
      const fromStatus = String(row.status ?? "") as AssignmentStatus;
      const toStatus: AssignmentStatus = fromStatus === "ASSIGNED" ? "EXPIRED" : "CANCELLED";
      const reason = fromStatus === "ASSIGNED" ? "ACCEPT_TIMEOUT" : "ARRIVE_TIMEOUT";
      const updateQ = await pool.query(
        `UPDATE work_assignment_index_v1
         SET status = $3, expired_reason = $4, updated_ts_ms = $5
         WHERE tenant_id = $1 AND assignment_id = $2 AND status = $6`,
        [String(row.tenant_id), String(row.assignment_id), toStatus, reason, Date.now(), fromStatus]
      );
      if ((updateQ.rowCount ?? 0) < 1) continue;
      const audit_id = randomUUID();
      await pool.query(
        `INSERT INTO work_assignment_audit_v1
         (tenant_id, audit_id, assignment_id, act_task_id, executor_id, status, occurred_at, actor_id, token_id, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9,$10)`,
        [String(row.tenant_id), audit_id, String(row.assignment_id), String(row.act_task_id), String(row.executor_id), toStatus, nowIso, "system/assignment_expiry_worker", "system", reason]
      );
      await pool.query("INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)", [
        randomUUID(),
        "worker/assignment_expiry_v1",
        {
          type: "work_assignment_status_changed_v1",
          entity: { tenant_id: String(row.tenant_id) },
          payload: {
            assignment_id: String(row.assignment_id),
            act_task_id: String(row.act_task_id),
            executor_id: String(row.executor_id),
            from_status: fromStatus,
            status: toStatus,
            changed_at: nowIso,
            note: reason,
            audit_id,
            actor_id: "system/assignment_expiry_worker",
            token_id: "system",
          },
        },
      ]);
    }
  }
  const handle = setInterval(() => { tick().catch(() => void 0); }, interval_ms);
  (handle as any).unref?.();
}
