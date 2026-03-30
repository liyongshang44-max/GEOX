import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { requireAoActScopeV0, type AoActAuthContextV0 } from "../auth/ao_act_authz_v0";

type AssignmentStatus = "ASSIGNED" | "ACCEPTED" | "ARRIVED" | "SUBMITTED" | "CANCELLED";
type ExecutorStatus = "ACTIVE" | "DISABLED";

const ASSIGNMENT_STATUS = new Set<AssignmentStatus>(["ASSIGNED", "ACCEPTED", "ARRIVED", "SUBMITTED", "CANCELLED"]);
const EXECUTOR_STATUS = new Set<ExecutorStatus>(["ACTIVE", "DISABLED"]);

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
          created_ts_ms BIGINT NOT NULL,
          updated_ts_ms BIGINT NOT NULL,
          PRIMARY KEY (tenant_id, assignment_id),
          CONSTRAINT work_assignment_status_ck CHECK (status IN ('ASSIGNED','ACCEPTED','ARRIVED','SUBMITTED','CANCELLED'))
        )
      `);
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
          CONSTRAINT work_assignment_audit_status_ck CHECK (status IN ('ASSIGNED','ACCEPTED','ARRIVED','SUBMITTED','CANCELLED'))
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS work_assignment_audit_v1_lookup_idx ON work_assignment_audit_v1 (tenant_id, assignment_id, occurred_at DESC)`);
    })().catch((err) => {
      ensureHumanExecutorRuntimePromise = null;
      throw err;
    });
  }
  await ensureHumanExecutorRuntimePromise;
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

    const executorExistsQ = await pool.query(
      `SELECT 1 AS ok FROM human_executor_index_v1 WHERE tenant_id = $1 AND executor_id = $2
       UNION ALL
       SELECT 1 AS ok FROM device_index_v1 WHERE tenant_id = $1 AND device_id = $2
       LIMIT 1`,
      [auth.tenant_id, executor_id]
    );
    if ((executorExistsQ.rowCount ?? 0) < 1) return badRequest(reply, "EXECUTOR_NOT_FOUND_IN_TENANT");

    const now = Date.now();
    await pool.query(
      `INSERT INTO work_assignment_index_v1
      (tenant_id, assignment_id, act_task_id, executor_id, assigned_at, status, created_ts_ms, updated_ts_ms)
       VALUES ($1,$2,$3,$4,$5::timestamptz,$6,$7,$8)
       ON CONFLICT (tenant_id, assignment_id)
       DO UPDATE SET act_task_id=EXCLUDED.act_task_id, executor_id=EXCLUDED.executor_id, assigned_at=EXCLUDED.assigned_at, status=EXCLUDED.status, updated_ts_ms=EXCLUDED.updated_ts_ms`,
      [auth.tenant_id, assignment_id, act_task_id, executor_id, assigned_at, status, now, now]
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
      assigned_at,
      status,
      audit_id,
    });

    return reply.send({ ok: true, fact_id, assignment: { assignment_id, act_task_id, executor_id, assigned_at, status } });
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
      `UPDATE work_assignment_index_v1 SET status = $3, updated_ts_ms = $4 WHERE tenant_id = $1 AND assignment_id = $2`,
      [auth.tenant_id, assignment_id, status, Date.now()]
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
