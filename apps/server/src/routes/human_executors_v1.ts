import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { requireAoActScopeV0, type AoActAuthContextV0 } from "../auth/ao_act_authz_v0";

type AssignmentStatus = "ASSIGNED" | "ACCEPTED" | "ARRIVED" | "SUBMITTED" | "CANCELLED" | "EXPIRED";
type AssignmentTimeoutStatus = "ON_TRACK" | "AT_RISK" | "OVERDUE" | "NONE";
type ExecutorStatus = "ACTIVE" | "DISABLED";
type AssignmentOriginType = "manual" | "auto_fallback";

const ASSIGNMENT_STATUS = new Set<AssignmentStatus>(["ASSIGNED", "ACCEPTED", "ARRIVED", "SUBMITTED", "CANCELLED", "EXPIRED"]);
const EXECUTOR_STATUS = new Set<ExecutorStatus>(["ACTIVE", "DISABLED"]);
const ASSIGNMENT_ORIGIN_TYPES = new Set<AssignmentOriginType>(["manual", "auto_fallback"]);
const ALLOW_SUBMIT_FROM_ACCEPTED = /^(1|true|yes|on)$/i.test(String(process.env.WORK_ASSIGNMENT_ALLOW_SUBMIT_FROM_ACCEPTED ?? ""));
const SLA_DEFAULTS_FALLBACK = { accept_minutes: 30, arrive_minutes: 120 };
const SLA_DEFAULTS_BY_CROP_JOB: Record<string, { accept_minutes: number; arrive_minutes: number }> = {
  "RICE:IRRIGATION": { accept_minutes: 20, arrive_minutes: 60 },
  "WHEAT:SPRAYING": { accept_minutes: 30, arrive_minutes: 90 },
  "CORN:FERTILIZATION": { accept_minutes: 30, arrive_minutes: 120 },
  "DEFAULT:HARVEST": { accept_minutes: 60, arrive_minutes: 240 },
};
const ACCEPTED_ASSIGNMENT_TRANSITIONS: AssignmentStatus[] = ALLOW_SUBMIT_FROM_ACCEPTED
  ? ["ARRIVED", "CANCELLED", "SUBMITTED"]
  : ["ARRIVED", "CANCELLED"];

const ASSIGNMENT_TRANSITIONS: Record<AssignmentStatus, Set<AssignmentStatus>> = {
  ASSIGNED: new Set<AssignmentStatus>(["ACCEPTED", "CANCELLED"]),
  ACCEPTED: new Set<AssignmentStatus>(ACCEPTED_ASSIGNMENT_TRANSITIONS),
  ARRIVED: new Set<AssignmentStatus>(["SUBMITTED", "CANCELLED"]),
  SUBMITTED: new Set<AssignmentStatus>([]),
  CANCELLED: new Set<AssignmentStatus>([]),
  EXPIRED: new Set<AssignmentStatus>([]),
};

function canTransitionAssignmentStatus(fromStatus: AssignmentStatus, toStatus: AssignmentStatus): boolean {
  return ASSIGNMENT_TRANSITIONS[fromStatus]?.has(toStatus) ?? false;
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

function statusTransitionError(reply: any, httpStatus: number, error: "INVALID_STATUS_TRANSITION" | "CONFLICT", detail: { from: string; to: string; current: string }) {
  return reply.status(httpStatus).send({ ok: false, error, detail });
}

type FieldValidationIssue = { field: string; code: string; message: string };

function badFieldRequest(reply: any, issues: FieldValidationIssue[]) {
  return reply.status(400).send({
    ok: false,
    error: "INVALID_RECEIPT_FIELDS",
    field_errors: issues,
  });
}

function asFiniteNumber(raw: any): number | null {
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function readNonNegativeNumber(raw: any, field: string, issues: FieldValidationIssue[], opts?: { max?: number }): number | null | undefined {
  if (raw == null || raw === "") return undefined;
  const n = asFiniteNumber(raw);
  if (n == null) {
    issues.push({ field, code: "INVALID_NUMBER", message: `${field} must be a finite number` });
    return null;
  }
  if (n < 0) {
    issues.push({ field, code: "OUT_OF_RANGE", message: `${field} must be >= 0` });
    return null;
  }
  if (opts?.max != null && n > opts.max) {
    issues.push({ field, code: "OUT_OF_RANGE", message: `${field} must be <= ${opts.max}` });
    return null;
  }
  return n;
}

function readNormalizedString(raw: any, field: string, issues: FieldValidationIssue[], opts?: { maxLength?: number; allowEmpty?: boolean }): string | null {
  if (raw == null) return null;
  const value = String(raw).trim();
  if (!value.length) {
    if (opts?.allowEmpty) return "";
    issues.push({ field, code: "REQUIRED", message: `${field} is required` });
    return null;
  }
  if (opts?.maxLength && value.length > opts.maxLength) {
    issues.push({ field, code: "TOO_LONG", message: `${field} length must be <= ${opts.maxLength}` });
    return null;
  }
  return value;
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
  const now = Date.now();
  const acceptDeadline = Number(row.accept_deadline_ts ?? NaN);
  const arriveDeadline = Number(row.arrive_deadline_ts ?? NaN);
  const expiredTs = Number(row.expired_ts ?? NaN);
  const status = String(row.status ?? "") as AssignmentStatus;
  const activeDeadline = status === "ASSIGNED"
    ? acceptDeadline
    : (status === "ACCEPTED" || status === "ARRIVED")
      ? arriveDeadline
      : Number.NaN;
  const timeout_remaining_ms = Number.isFinite(activeDeadline) ? Math.trunc(activeDeadline - now) : null;
  const timeout_status: AssignmentTimeoutStatus = status === "EXPIRED" || (status === "CANCELLED" && (String(row.expired_reason ?? "") === "ACCEPT_TIMEOUT" || String(row.expired_reason ?? "") === "ARRIVE_TIMEOUT"))
    ? "OVERDUE"
    : !Number.isFinite(activeDeadline)
      ? "NONE"
    : timeout_remaining_ms == null || timeout_remaining_ms < 0
      ? "OVERDUE"
      : timeout_remaining_ms <= 15 * 60_000
        ? "AT_RISK"
        : "ON_TRACK";
  const sla_stage = status === "ASSIGNED"
    ? "ACCEPT"
    : (status === "ACCEPTED" || status === "ARRIVED")
      ? "ARRIVE"
      : "NONE";
  const sla_indicator = status === "EXPIRED" || (status === "CANCELLED" && (String(row.expired_reason ?? "") === "ACCEPT_TIMEOUT" || String(row.expired_reason ?? "") === "ARRIVE_TIMEOUT"))
    ? "BREACHED"
    : timeout_status === "AT_RISK"
      ? "AT_RISK"
      : timeout_status === "ON_TRACK"
        ? "ON_TRACK"
        : "NONE";
  return {
    assignment_id: String(row.assignment_id ?? ""),
    act_task_id: String(row.act_task_id ?? ""),
    executor_id: String(row.executor_id ?? ""),
    assigned_at: row.assigned_at instanceof Date ? row.assigned_at.toISOString() : String(row.assigned_at ?? ""),
    status,
    accept_deadline_ts: Number.isFinite(acceptDeadline) ? acceptDeadline : null,
    arrive_deadline_ts: Number.isFinite(arriveDeadline) ? arriveDeadline : null,
    expired_ts: Number.isFinite(expiredTs) ? expiredTs : null,
    expired_reason: row.expired_reason ? String(row.expired_reason) : null,
    timeout_status,
    timeout_remaining_ms,
    sla_stage,
    sla_indicator,
    dispatch_note: row.dispatch_note ? String(row.dispatch_note) : null,
    origin_type: String(row.origin_type ?? "manual"),
    origin_ref_id: row.origin_ref_id ? String(row.origin_ref_id) : null,
    fallback_context: parsePgJson(row.fallback_context),
    priority: Number(row.priority ?? 5),
    created_ts_ms: Number(row.created_ts_ms ?? 0),
    updated_ts_ms: Number(row.updated_ts_ms ?? 0),
  };
}

function sanitizeFallbackContext(input: any): Record<string, any> | null {
  if (input == null) return null;
  if (typeof input !== "object" || Array.isArray(input)) return null;
  const reason_code = isNonEmptyString((input as any).reason_code) ? String((input as any).reason_code).trim().slice(0, 128) : null;
  const reason_message = isNonEmptyString((input as any).reason_message) ? String((input as any).reason_message).trim().slice(0, 1024) : null;
  const dispatch_id = isNonEmptyString((input as any).dispatch_id) ? String((input as any).dispatch_id).trim().slice(0, 128) : null;
  const retry_count = Number.isFinite(Number((input as any).retry_count)) ? Math.max(0, Math.trunc(Number((input as any).retry_count))) : null;
  const max_retries = Number.isFinite(Number((input as any).max_retries)) ? Math.max(0, Math.trunc(Number((input as any).max_retries))) : null;
  const failed_at = isNonEmptyString((input as any).failed_at) ? String((input as any).failed_at).trim().slice(0, 64) : null;
  const takeover_conditions = Array.isArray((input as any).takeover_conditions)
    ? Array.from(new Set((input as any).takeover_conditions.map((x: any) => String(x ?? "").trim().toUpperCase()).filter(Boolean))).slice(0, 8)
    : null;
  const device = (input as any).device && typeof (input as any).device === "object" && !Array.isArray((input as any).device)
    ? {
      device_id: isNonEmptyString((input as any).device.device_id) ? String((input as any).device.device_id).trim().slice(0, 128) : null,
      device_name: isNonEmptyString((input as any).device.device_name) ? String((input as any).device.device_name).trim().slice(0, 256) : null,
      status: isNonEmptyString((input as any).device.status) ? String((input as any).device.status).trim().slice(0, 64) : null,
      last_heartbeat_ts: Number.isFinite(Number((input as any).device.last_heartbeat_ts)) ? Math.trunc(Number((input as any).device.last_heartbeat_ts)) : null,
      adapter_type: isNonEmptyString((input as any).device.adapter_type) ? String((input as any).device.adapter_type).trim().slice(0, 64) : null,
    }
    : null;
  const payload = { reason_code, reason_message, dispatch_id, retry_count, max_retries, failed_at, takeover_conditions, device };
  return Object.values(payload).some((x) => x != null) ? payload : null;
}

function parseDeadlineTs(raw: any): number | null {
  if (raw == null || raw === "") return null;
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) return Math.trunc(numeric);
  const parsed = Date.parse(String(raw));
  if (!Number.isFinite(parsed)) return null;
  return parsed;
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
          accept_deadline_ts BIGINT NULL,
          arrive_deadline_ts BIGINT NULL,
          expired_ts BIGINT NULL,
          expired_reason TEXT NULL,
          dispatch_note TEXT NULL,
          priority SMALLINT NOT NULL DEFAULT 5,
          version_no BIGINT NOT NULL DEFAULT 0,
          created_ts_ms BIGINT NOT NULL,
          updated_ts_ms BIGINT NOT NULL,
          PRIMARY KEY (tenant_id, assignment_id),
          CONSTRAINT work_assignment_status_ck CHECK (status IN ('ASSIGNED','ACCEPTED','ARRIVED','SUBMITTED','CANCELLED','EXPIRED'))
        )
      `);
      await pool.query(`ALTER TABLE work_assignment_index_v1 ADD COLUMN IF NOT EXISTS accept_deadline_ts BIGINT NULL`);
      await pool.query(`ALTER TABLE work_assignment_index_v1 ADD COLUMN IF NOT EXISTS arrive_deadline_ts BIGINT NULL`);
      await pool.query(`ALTER TABLE work_assignment_index_v1 ADD COLUMN IF NOT EXISTS expired_ts BIGINT NULL`);
      await pool.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name='work_assignment_index_v1'
              AND column_name='accept_deadline_ts'
              AND data_type='timestamp with time zone'
          ) THEN
            ALTER TABLE work_assignment_index_v1
              ALTER COLUMN accept_deadline_ts TYPE BIGINT
              USING CASE WHEN accept_deadline_ts IS NULL THEN NULL ELSE (EXTRACT(EPOCH FROM accept_deadline_ts) * 1000)::bigint END;
          END IF;
          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name='work_assignment_index_v1'
              AND column_name='arrive_deadline_ts'
              AND data_type='timestamp with time zone'
          ) THEN
            ALTER TABLE work_assignment_index_v1
              ALTER COLUMN arrive_deadline_ts TYPE BIGINT
              USING CASE WHEN arrive_deadline_ts IS NULL THEN NULL ELSE (EXTRACT(EPOCH FROM arrive_deadline_ts) * 1000)::bigint END;
          END IF;
        END
        $$;
      `);
      await pool.query(`ALTER TABLE work_assignment_index_v1 ADD COLUMN IF NOT EXISTS expired_reason TEXT NULL`);
      await pool.query(`ALTER TABLE work_assignment_index_v1 ADD COLUMN IF NOT EXISTS dispatch_note TEXT NULL`);
      await pool.query(`ALTER TABLE work_assignment_index_v1 ADD COLUMN IF NOT EXISTS priority SMALLINT NOT NULL DEFAULT 5`);
      await pool.query(`ALTER TABLE work_assignment_index_v1 ADD COLUMN IF NOT EXISTS version_no BIGINT NOT NULL DEFAULT 0`);
      await pool.query(`ALTER TABLE work_assignment_index_v1 ADD COLUMN IF NOT EXISTS origin_type TEXT NOT NULL DEFAULT 'manual'`);
      await pool.query(`ALTER TABLE work_assignment_index_v1 ADD COLUMN IF NOT EXISTS origin_ref_id TEXT NULL`);
      await pool.query(`ALTER TABLE work_assignment_index_v1 ADD COLUMN IF NOT EXISTS fallback_context JSONB NULL`);
      await pool.query(`ALTER TABLE work_assignment_index_v1 DROP CONSTRAINT IF EXISTS work_assignment_status_ck`);
      await pool.query(`ALTER TABLE work_assignment_index_v1 ADD CONSTRAINT work_assignment_status_ck CHECK (status IN ('ASSIGNED','ACCEPTED','ARRIVED','SUBMITTED','CANCELLED','EXPIRED'))`);
      await pool.query(`ALTER TABLE work_assignment_index_v1 DROP CONSTRAINT IF EXISTS work_assignment_origin_type_ck`);
      await pool.query(`ALTER TABLE work_assignment_index_v1 ADD CONSTRAINT work_assignment_origin_type_ck CHECK (origin_type IN ('manual','auto_fallback'))`);
      await pool.query(`CREATE INDEX IF NOT EXISTS work_assignment_index_v1_lookup_idx ON work_assignment_index_v1 (tenant_id, act_task_id, updated_ts_ms DESC)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS work_assignment_index_v1_transition_idx ON work_assignment_index_v1 (tenant_id, assignment_id, status)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS work_assignment_index_v1_dispatch_idx ON work_assignment_index_v1 (tenant_id, status, priority, updated_ts_ms DESC)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS work_assignment_index_v1_origin_idx ON work_assignment_index_v1 (tenant_id, origin_type, created_ts_ms DESC)`);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS operation_handoff_v1 (
          tenant_id TEXT NOT NULL,
          operation_plan_id TEXT NOT NULL,
          act_task_id TEXT NOT NULL,
          source_dispatch_id TEXT NULL,
          assignment_id TEXT NOT NULL,
          created_ts_ms BIGINT NOT NULL,
          updated_ts_ms BIGINT NOT NULL,
          PRIMARY KEY (tenant_id, operation_plan_id, assignment_id)
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS operation_handoff_v1_lookup_idx ON operation_handoff_v1 (tenant_id, operation_plan_id, created_ts_ms DESC)`);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS work_assignment_reassign_log_v1 (
          tenant_id TEXT NOT NULL,
          log_id TEXT NOT NULL,
          assignment_id TEXT NOT NULL,
          act_task_id TEXT NOT NULL,
          old_executor_id TEXT NOT NULL,
          new_executor_id TEXT NOT NULL,
          reason TEXT NULL,
          actor_id TEXT NULL,
          token_id TEXT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_ts_ms BIGINT NOT NULL,
          PRIMARY KEY (tenant_id, log_id)
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS work_assignment_reassign_log_v1_lookup_idx ON work_assignment_reassign_log_v1 (tenant_id, assignment_id, created_at DESC)`);

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
          from_status TEXT NULL,
          to_status TEXT NULL,
          note TEXT NULL,
          PRIMARY KEY (tenant_id, audit_id),
          CONSTRAINT work_assignment_audit_status_ck CHECK (status IN ('ASSIGNED','ACCEPTED','ARRIVED','SUBMITTED','CANCELLED','EXPIRED'))
        )
      `);
      await pool.query(`ALTER TABLE work_assignment_audit_v1 DROP CONSTRAINT IF EXISTS work_assignment_audit_status_ck`);
      await pool.query(`ALTER TABLE work_assignment_audit_v1 ADD CONSTRAINT work_assignment_audit_status_ck CHECK (status IN ('ASSIGNED','ACCEPTED','ARRIVED','SUBMITTED','CANCELLED','EXPIRED'))`);
      await pool.query(`ALTER TABLE work_assignment_audit_v1 ADD COLUMN IF NOT EXISTS from_status TEXT NULL`);
      await pool.query(`ALTER TABLE work_assignment_audit_v1 ADD COLUMN IF NOT EXISTS to_status TEXT NULL`);
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
    const origin_type = String(body.origin_type ?? "manual").trim().toLowerCase();
    const origin_ref_id = isNonEmptyString(body.origin_ref_id) ? String(body.origin_ref_id).trim().slice(0, 128) : null;
    const fallback_context = sanitizeFallbackContext(body.fallback_context);

    if (!assignment_id) return badRequest(reply, "MISSING_OR_INVALID:assignment_id");
    if (!act_task_id) return badRequest(reply, "MISSING_OR_INVALID:act_task_id");
    if (!executor_id) return badRequest(reply, "MISSING_OR_INVALID:executor_id");
    if (!ASSIGNMENT_STATUS.has(status as AssignmentStatus)) return badRequest(reply, "MISSING_OR_INVALID:status");
    if (!ASSIGNMENT_ORIGIN_TYPES.has(origin_type as AssignmentOriginType)) return badRequest(reply, "MISSING_OR_INVALID:origin_type");
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
    const acceptDeadlineTs = parseDeadlineTs(body.accept_deadline_ts ?? body?.sla?.accept_deadline_ts)
      ?? (assignedAtMs + normalizeSlaMinutes(body?.sla?.accept_minutes, fallbackSla.accept_minutes) * 60_000);
    const arriveDeadlineTs = parseDeadlineTs(body.arrive_deadline_ts ?? body?.sla?.arrive_deadline_ts)
      ?? (assignedAtMs + normalizeSlaMinutes(body?.sla?.arrive_minutes, fallbackSla.arrive_minutes) * 60_000);
    if (!Number.isFinite(acceptDeadlineTs)) return badRequest(reply, "MISSING_OR_INVALID:accept_deadline_ts");
    if (!Number.isFinite(arriveDeadlineTs)) return badRequest(reply, "MISSING_OR_INVALID:arrive_deadline_ts");
    const now = Date.now();
    await pool.query(
      `INSERT INTO work_assignment_index_v1
      (tenant_id, assignment_id, act_task_id, executor_id, assigned_at, status, accept_deadline_ts, arrive_deadline_ts, expired_ts, expired_reason, origin_type, origin_ref_id, fallback_context, created_ts_ms, updated_ts_ms)
       VALUES ($1,$2,$3,$4,$5::timestamptz,$6,$7,$8,NULL,NULL,$9,$10,$11::jsonb,$12,$13)
       ON CONFLICT (tenant_id, assignment_id)
       DO UPDATE SET act_task_id=EXCLUDED.act_task_id, executor_id=EXCLUDED.executor_id, assigned_at=EXCLUDED.assigned_at, status=EXCLUDED.status, accept_deadline_ts=EXCLUDED.accept_deadline_ts, arrive_deadline_ts=EXCLUDED.arrive_deadline_ts, expired_ts=NULL, expired_reason=NULL, origin_type=EXCLUDED.origin_type, origin_ref_id=EXCLUDED.origin_ref_id, fallback_context=EXCLUDED.fallback_context, updated_ts_ms=EXCLUDED.updated_ts_ms`,
      [auth.tenant_id, assignment_id, act_task_id, executor_id, assigned_at, status, acceptDeadlineTs, arriveDeadlineTs, origin_type, origin_ref_id, JSON.stringify(fallback_context), now, now]
    );

    const audit_id = randomUUID();
    await pool.query(
      `INSERT INTO work_assignment_audit_v1
       (tenant_id, audit_id, assignment_id, act_task_id, executor_id, status, occurred_at, actor_id, token_id, from_status, to_status, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9,$10,$11,$12)`,
      [auth.tenant_id, audit_id, assignment_id, act_task_id, executor_id, status, assigned_at, auth.actor_id, auth.token_id, null, status, "CREATE_OR_UPSERT"]
    );

    const fact_id = await insertAuditFact(pool, "work_assignment_upserted_v1", auth, {
      assignment_id,
      act_task_id,
      executor_id,
      required_capabilities: requiredCapabilities,
      assigned_at,
      from_status: null,
      to_status: status,
      status,
      accept_deadline_ts: acceptDeadlineTs,
      arrive_deadline_ts: arriveDeadlineTs,
      origin_type,
      origin_ref_id,
      fallback_context,
      audit_id,
    });

    return reply.send({ ok: true, fact_id, assignment: { assignment_id, act_task_id, executor_id, assigned_at, status, accept_deadline_ts: acceptDeadlineTs, arrive_deadline_ts: arriveDeadlineTs, expired_ts: null, expired_reason: null, origin_type, origin_ref_id, fallback_context } });
  });

  app.post("/api/internal/work-assignments/auto-fallback", async (req, reply) => {
    if ((req.query as any)?.__internal__ !== "true") return reply.status(403).send({ ok: false, error: "FORBIDDEN" });
    await ensureHumanExecutorRuntime(pool);

    const body: any = (req as any).body ?? {};
    const tenant_id = normalizeId(body.tenant_id);
    const project_id = normalizeId(body.project_id);
    const group_id = normalizeId(body.group_id);
    const actor_id = normalizeId(body.actor_id) ?? "system:auto_fallback";
    if (!tenant_id || !project_id || !group_id) return badRequest(reply, "MISSING_OR_INVALID:tenant_scope");

    const assignment_id = normalizeId(body.assignment_id) ?? `wa_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
    const act_task_id = normalizeId(body.act_task_id);
    const executor_id = normalizeId(body.executor_id);
    const operation_plan_id = normalizeId(body.operation_plan_id ?? body.operation_id);
    if (!act_task_id || !executor_id) return badRequest(reply, "MISSING_OR_INVALID:act_task_id_or_executor_id");
    if (!operation_plan_id) return badRequest(reply, "MISSING_OR_INVALID:operation_plan_id");
    const assigned_at = isNonEmptyString(body.assigned_at) ? String(body.assigned_at).trim() : new Date().toISOString();
    if (Number.isNaN(Date.parse(assigned_at))) return badRequest(reply, "MISSING_OR_INVALID:assigned_at");
    const fallback_context = sanitizeFallbackContext(body.fallback_context ?? body.context ?? {});
    const source_dispatch_id = normalizeId(body.source_dispatch_id ?? fallback_context?.dispatch_id);
    const origin_ref_id = normalizeId(body.origin_ref_id ?? source_dispatch_id ?? operation_plan_id);
    const requiredCapabilities = normalizeCapabilities(body.required_capabilities);

    const fallbackSla = chooseSlaDefaults(String(body.crop_code ?? ""), String(body.job_type ?? body.action_type ?? ""));
    const assignedAtMs = Date.parse(assigned_at);
    const acceptDeadlineTs = parseDeadlineTs(body.accept_deadline_ts ?? body?.sla?.accept_deadline_ts)
      ?? (assignedAtMs + normalizeSlaMinutes(body?.sla?.accept_minutes, fallbackSla.accept_minutes) * 60_000);
    const arriveDeadlineTs = parseDeadlineTs(body.arrive_deadline_ts ?? body?.sla?.arrive_deadline_ts)
      ?? (assignedAtMs + normalizeSlaMinutes(body?.sla?.arrive_minutes, fallbackSla.arrive_minutes) * 60_000);
    if (!Number.isFinite(acceptDeadlineTs) || !Number.isFinite(arriveDeadlineTs)) return badRequest(reply, "MISSING_OR_INVALID:sla");

    const now = Date.now();
    await pool.query(
      `INSERT INTO work_assignment_index_v1
      (tenant_id, assignment_id, act_task_id, executor_id, assigned_at, status, accept_deadline_ts, arrive_deadline_ts, expired_ts, expired_reason, origin_type, origin_ref_id, fallback_context, created_ts_ms, updated_ts_ms)
       VALUES ($1,$2,$3,$4,$5::timestamptz,'ASSIGNED',$6,$7,NULL,NULL,'auto_fallback',$8,$9::jsonb,$10,$11)
       ON CONFLICT (tenant_id, assignment_id)
       DO UPDATE SET act_task_id=EXCLUDED.act_task_id, executor_id=EXCLUDED.executor_id, assigned_at=EXCLUDED.assigned_at, status=EXCLUDED.status, accept_deadline_ts=EXCLUDED.accept_deadline_ts, arrive_deadline_ts=EXCLUDED.arrive_deadline_ts, expired_ts=NULL, expired_reason=NULL, origin_type=EXCLUDED.origin_type, origin_ref_id=EXCLUDED.origin_ref_id, fallback_context=EXCLUDED.fallback_context, updated_ts_ms=EXCLUDED.updated_ts_ms`,
      [tenant_id, assignment_id, act_task_id, executor_id, assigned_at, acceptDeadlineTs, arriveDeadlineTs, origin_ref_id, JSON.stringify(fallback_context), now, now]
    );

    await pool.query(
      `INSERT INTO operation_handoff_v1
       (tenant_id, operation_plan_id, act_task_id, source_dispatch_id, assignment_id, created_ts_ms, updated_ts_ms)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (tenant_id, operation_plan_id, assignment_id)
       DO UPDATE SET act_task_id=EXCLUDED.act_task_id, source_dispatch_id=EXCLUDED.source_dispatch_id, updated_ts_ms=EXCLUDED.updated_ts_ms`,
      [tenant_id, operation_plan_id, act_task_id, source_dispatch_id, assignment_id, now, now]
    );

    const authLike: AoActAuthContextV0 = {
      tenant_id,
      project_id,
      group_id,
      actor_id,
      token_id: "internal_auto_fallback",
      role: "admin",
      scopes: ["ao_act.task.write", "ao_act.index.read"],
    };
    const audit_id = randomUUID();
    await pool.query(
      `INSERT INTO work_assignment_audit_v1
       (tenant_id, audit_id, assignment_id, act_task_id, executor_id, status, occurred_at, actor_id, token_id, from_status, to_status, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9,$10,$11,$12)`,
      [tenant_id, audit_id, assignment_id, act_task_id, executor_id, "ASSIGNED", assigned_at, actor_id, "internal_auto_fallback", null, "ASSIGNED", "AUTO_FALLBACK_CREATE"]
    );
    const fact_id = await insertAuditFact(pool, "work_assignment_auto_fallback_created_v1", authLike, {
      assignment_id,
      act_task_id,
      executor_id,
      operation_plan_id,
      source_dispatch_id,
      required_capabilities: requiredCapabilities,
      assigned_at,
      from_status: null,
      to_status: "ASSIGNED",
      status: "ASSIGNED",
      origin_type: "auto_fallback",
      origin_ref_id,
      fallback_context,
      accept_deadline_ts: acceptDeadlineTs,
      arrive_deadline_ts: arriveDeadlineTs,
      audit_id,
    });

    return reply.send({
      ok: true,
      fact_id,
      assignment: {
        assignment_id,
        act_task_id,
        executor_id,
        status: "ASSIGNED",
        origin_type: "auto_fallback",
        origin_ref_id,
        fallback_context,
        accept_deadline_ts: acceptDeadlineTs,
        arrive_deadline_ts: arriveDeadlineTs,
      },
      handoff: { operation_plan_id, source_dispatch_id, assignment_id },
    });
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

  app.get("/api/v1/human-executors/availability", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    await ensureHumanExecutorRuntime(pool);

    const q: any = (req as any).query ?? {};
    const limit = toPositiveInt(q.limit, 100, 1, 500);
    const team_id = normalizeId(q.team_id);
    const capability = isNonEmptyString(q.capability) ? String(q.capability).trim() : null;

    const values: any[] = [auth.tenant_id];
    const filters: string[] = ["e.tenant_id = $1", "e.status = 'ACTIVE'"];
    if (team_id) {
      values.push(team_id);
      filters.push(`e.team_id = $${values.length}`);
    }
    if (capability) {
      values.push(capability);
      filters.push(`e.capabilities @> to_jsonb(ARRAY[$${values.length}]::text[])`);
    }
    values.push(limit);

    const listQ = await pool.query(
      `SELECT e.executor_id, e.display_name, e.team_id, e.capabilities, e.updated_ts_ms,
              COALESCE(active.active_count, 0)::int AS active_count
         FROM human_executor_index_v1 e
         LEFT JOIN (
           SELECT tenant_id, executor_id, COUNT(*)::bigint AS active_count
             FROM work_assignment_index_v1
            WHERE tenant_id = $1
              AND status IN ('ASSIGNED','ACCEPTED','ARRIVED')
            GROUP BY tenant_id, executor_id
         ) active
           ON active.tenant_id = e.tenant_id AND active.executor_id = e.executor_id
        WHERE ${filters.join(" AND ")}
        ORDER BY active_count ASC, e.updated_ts_ms DESC, e.executor_id ASC
        LIMIT $${values.length}`,
      values
    );

    return reply.send({
      ok: true,
      items: (listQ.rows ?? []).map((row: any) => ({
        executor_id: String(row.executor_id ?? ""),
        display_name: String(row.display_name ?? ""),
        team_id: row.team_id ? String(row.team_id) : null,
        capabilities: normalizeCapabilities(parsePgJson(row.capabilities)),
        active_assignment_count: Number(row.active_count ?? 0),
        available: Number(row.active_count ?? 0) < 5,
      })),
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
      const dispatch_note = isNonEmptyString(item?.dispatch_note) ? String(item.dispatch_note).trim().slice(0, 1024) : null;
      const priority = Math.max(1, Math.min(9, Math.trunc(Number(item?.priority ?? 5) || 5)));
      const origin_type = String(item?.origin_type ?? "manual").trim().toLowerCase();
      const origin_ref_id = isNonEmptyString(item?.origin_ref_id) ? String(item.origin_ref_id).trim().slice(0, 128) : null;
      const fallback_context = sanitizeFallbackContext(item?.fallback_context);
      if (!assignment_id || !act_task_id || !executor_id || !ASSIGNMENT_STATUS.has(status as AssignmentStatus) || Number.isNaN(Date.parse(assigned_at))) {
        errors.push({ assignment_id: assignment_id ?? null, error: "MISSING_OR_INVALID:assignment_item" });
        continue;
      }
      if (!ASSIGNMENT_ORIGIN_TYPES.has(origin_type as AssignmentOriginType)) {
        errors.push({ assignment_id: assignment_id ?? null, error: "MISSING_OR_INVALID:origin_type" });
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
      const acceptDeadlineTs = parseDeadlineTs(item?.accept_deadline_ts ?? item?.sla?.accept_deadline_ts)
        ?? (assignedAtMs + normalizeSlaMinutes(item?.sla?.accept_minutes, fallbackSla.accept_minutes) * 60_000);
      const arriveDeadlineTs = parseDeadlineTs(item?.arrive_deadline_ts ?? item?.sla?.arrive_deadline_ts)
        ?? (assignedAtMs + normalizeSlaMinutes(item?.sla?.arrive_minutes, fallbackSla.arrive_minutes) * 60_000);
      if (!Number.isFinite(acceptDeadlineTs) || !Number.isFinite(arriveDeadlineTs)) {
        errors.push({ assignment_id, error: "MISSING_OR_INVALID:sla" });
        continue;
      }
      const now = Date.now();
      await pool.query(
        `INSERT INTO work_assignment_index_v1
         (tenant_id, assignment_id, act_task_id, executor_id, assigned_at, status, accept_deadline_ts, arrive_deadline_ts, expired_reason, dispatch_note, priority, origin_type, origin_ref_id, fallback_context, created_ts_ms, updated_ts_ms)
         VALUES ($1,$2,$3,$4,$5::timestamptz,$6,$7,$8,NULL,$9,$10,$11,$12,$13::jsonb,$14,$15)
         ON CONFLICT (tenant_id, assignment_id)
         DO UPDATE SET act_task_id=EXCLUDED.act_task_id, executor_id=EXCLUDED.executor_id, assigned_at=EXCLUDED.assigned_at, status=EXCLUDED.status, accept_deadline_ts=EXCLUDED.accept_deadline_ts, arrive_deadline_ts=EXCLUDED.arrive_deadline_ts, expired_reason=EXCLUDED.expired_reason, dispatch_note=EXCLUDED.dispatch_note, priority=EXCLUDED.priority, origin_type=EXCLUDED.origin_type, origin_ref_id=EXCLUDED.origin_ref_id, fallback_context=EXCLUDED.fallback_context, updated_ts_ms=EXCLUDED.updated_ts_ms`,
        [auth.tenant_id, assignment_id, act_task_id, executor_id, assigned_at, status, acceptDeadlineTs, arriveDeadlineTs, dispatch_note, priority, origin_type, origin_ref_id, JSON.stringify(fallback_context), now, now]
      );
      const audit_id = randomUUID();
      await pool.query(
        `INSERT INTO work_assignment_audit_v1
         (tenant_id, audit_id, assignment_id, act_task_id, executor_id, status, occurred_at, actor_id, token_id, from_status, to_status, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9,$10,$11,$12)`,
        [auth.tenant_id, audit_id, assignment_id, act_task_id, executor_id, status, assigned_at, auth.actor_id, auth.token_id, null, status, "BATCH_CREATE"]
      );
      const fact_id = await insertAuditFact(pool, "work_assignment_upserted_v1", auth, {
        assignment_id, act_task_id, executor_id, required_capabilities: requiredCapabilities, assigned_at, from_status: null, to_status: status, status, accept_deadline_ts: acceptDeadlineTs, arrive_deadline_ts: arriveDeadlineTs, dispatch_note, priority, origin_type, origin_ref_id, fallback_context, audit_id,
      });
      created.push({ assignment_id, fact_id });
    }
    return reply.send({ ok: errors.length < items.length, created, errors });
  });

  app.post("/api/v1/work-assignments/:assignmentId/reassign", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
    if (!auth) return;
    await ensureHumanExecutorRuntime(pool);
    const params: any = (req as any).params ?? {};
    const body: any = (req as any).body ?? {};
    const assignment_id = normalizeId(params.assignmentId ?? params.assignment_id);
    const executor_id = normalizeId(body.executor_id);
    const reason = isNonEmptyString(body.reason) ? String(body.reason).trim().slice(0, 512) : "REASSIGN";
    if (!assignment_id || !executor_id) return badRequest(reply, "MISSING_OR_INVALID:assignment_id_or_executor_id");

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
    if (["SUBMITTED", "CANCELLED", "EXPIRED"].includes(fromStatus)) return badRequest(reply, "REASSIGN_NOT_ALLOWED_FOR_FINAL_STATUS");

    const act_task_id = String(row.act_task_id ?? "");
    const requiredCapabilities = await resolveTaskRequiredCapabilities(pool, auth, act_task_id, body.required_capabilities);
    const capabilityCheck = await validateExecutorCapabilityMatch(pool, auth, executor_id, requiredCapabilities);
    if (!capabilityCheck.ok) return badRequest(reply, capabilityCheck.error);

    await pool.query(
      `UPDATE work_assignment_index_v1
          SET executor_id = $3, updated_ts_ms = $4
        WHERE tenant_id = $1 AND assignment_id = $2`,
      [auth.tenant_id, assignment_id, executor_id, Date.now()]
    );
    const nowIso = new Date().toISOString();
    const log_id = randomUUID();
    await pool.query(
      `INSERT INTO work_assignment_reassign_log_v1
       (tenant_id, log_id, assignment_id, act_task_id, old_executor_id, new_executor_id, reason, actor_id, token_id, created_ts_ms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [auth.tenant_id, log_id, assignment_id, act_task_id, String(row.executor_id ?? ""), executor_id, reason, auth.actor_id, auth.token_id, Date.now()]
    );
    const audit_id = randomUUID();
    await pool.query(
      `INSERT INTO work_assignment_audit_v1
       (tenant_id, audit_id, assignment_id, act_task_id, executor_id, status, occurred_at, actor_id, token_id, from_status, to_status, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9,$10,$11,$12)`,
      [auth.tenant_id, audit_id, assignment_id, act_task_id, executor_id, fromStatus, nowIso, auth.actor_id, auth.token_id, fromStatus, fromStatus, reason]
    );
    const fact_id = await insertAuditFact(pool, "work_assignment_upserted_v1", auth, {
      assignment_id, act_task_id, executor_id, from_executor_id: String(row.executor_id ?? ""), required_capabilities: requiredCapabilities, from_status: fromStatus, to_status: fromStatus, status: fromStatus, changed_at: nowIso, note: reason, audit_id,
    });
    return reply.send({ ok: true, updated: { assignment_id, executor_id, fact_id, reassign_log_id: log_id } });
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
        `SELECT assignment_id, act_task_id, executor_id, status, version_no
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
         (tenant_id, audit_id, assignment_id, act_task_id, executor_id, status, occurred_at, actor_id, token_id, from_status, to_status, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9,$10,$11,$12)`,
        [auth.tenant_id, audit_id, assignment_id, act_task_id, executor_id, fromStatus, nowIso, auth.actor_id, auth.token_id, fromStatus, fromStatus, note]
      );
      const fact_id = await insertAuditFact(pool, "work_assignment_upserted_v1", auth, {
        assignment_id, act_task_id, executor_id, from_executor_id: String(row.executor_id ?? ""), required_capabilities: requiredCapabilities, from_status: fromStatus, to_status: fromStatus, status: fromStatus, changed_at: nowIso, note, audit_id,
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
         SET status = 'CANCELLED', expired_reason = COALESCE(expired_reason, $4), expired_ts = COALESCE(expired_ts, $3), updated_ts_ms = $3, version_no = version_no + 1
         WHERE tenant_id = $1 AND assignment_id = $2 AND status = $5 AND version_no = $6`,
        [auth.tenant_id, assignment_id, Date.now(), note, fromStatus, Number(row.version_no ?? 0)]
      );
      if ((updateQ.rowCount ?? 0) < 1) {
        errors.push({ assignment_id, error: "CONFLICT" });
        continue;
      }
      const nowIso = new Date().toISOString();
      const audit_id = randomUUID();
      await pool.query(
        `INSERT INTO work_assignment_audit_v1
         (tenant_id, audit_id, assignment_id, act_task_id, executor_id, status, occurred_at, actor_id, token_id, from_status, to_status, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9,$10,$11,$12)`,
        [auth.tenant_id, audit_id, assignment_id, String(row.act_task_id ?? ""), String(row.executor_id ?? ""), "CANCELLED", nowIso, auth.actor_id, auth.token_id, fromStatus, "CANCELLED", note]
      );
      const fact_id = await insertAuditFact(pool, "work_assignment_status_changed_v1", auth, {
        assignment_id, act_task_id: String(row.act_task_id ?? ""), executor_id: String(row.executor_id ?? ""), from_status: fromStatus, to_status: "CANCELLED", status: "CANCELLED", changed_at: nowIso, note, audit_id,
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
    const timeout_status = isNonEmptyString(q.timeout_status) ? String(q.timeout_status).trim().toUpperCase() : null;
    const executor_id = normalizeId(q.executor_id);
    const act_task_id = normalizeId(q.act_task_id);
    if (status && !ASSIGNMENT_STATUS.has(status as AssignmentStatus)) return badRequest(reply, "MISSING_OR_INVALID:status");
    if (timeout_status && !new Set<AssignmentTimeoutStatus>(["ON_TRACK", "AT_RISK", "OVERDUE", "NONE"]).has(timeout_status as AssignmentTimeoutStatus)) {
      return badRequest(reply, "MISSING_OR_INVALID:timeout_status");
    }

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
    if (timeout_status === "ON_TRACK") {
      filters.push(`(
        (status = 'ASSIGNED' AND accept_deadline_ts IS NOT NULL AND accept_deadline_ts >= $${values.length + 1} + 900000)
        OR
        ((status = 'ACCEPTED' OR status = 'ARRIVED') AND arrive_deadline_ts IS NOT NULL AND arrive_deadline_ts >= $${values.length + 1} + 900000)
      )`);
      values.push(Date.now());
    } else if (timeout_status === "AT_RISK") {
      filters.push(`(
        (status = 'ASSIGNED' AND accept_deadline_ts IS NOT NULL AND accept_deadline_ts >= $${values.length + 1} AND accept_deadline_ts < $${values.length + 1} + 900000)
        OR
        ((status = 'ACCEPTED' OR status = 'ARRIVED') AND arrive_deadline_ts IS NOT NULL AND arrive_deadline_ts >= $${values.length + 1} AND arrive_deadline_ts < $${values.length + 1} + 900000)
      )`);
      values.push(Date.now());
    } else if (timeout_status === "OVERDUE") {
      filters.push(`(
        (status = 'ASSIGNED' AND accept_deadline_ts IS NOT NULL AND accept_deadline_ts < $${values.length + 1})
        OR
        ((status = 'ACCEPTED' OR status = 'ARRIVED') AND arrive_deadline_ts IS NOT NULL AND arrive_deadline_ts < $${values.length + 1})
        OR
        (status = 'EXPIRED')
        OR
        (status = 'CANCELLED' AND COALESCE(expired_reason, '') IN ('ACCEPT_TIMEOUT','ARRIVE_TIMEOUT'))
      )`);
      values.push(Date.now());
    } else if (timeout_status === "NONE") {
      filters.push(`(
        status IN ('SUBMITTED','CANCELLED','EXPIRED')
        OR (status = 'ASSIGNED' AND accept_deadline_ts IS NULL)
        OR ((status = 'ACCEPTED' OR status = 'ARRIVED') AND arrive_deadline_ts IS NULL)
      )`);
    }
    values.push(limit, offset);

    const listQ = await pool.query(
      `SELECT assignment_id, act_task_id, executor_id, assigned_at, status, accept_deadline_ts, arrive_deadline_ts, expired_ts, expired_reason, created_ts_ms, updated_ts_ms
       , dispatch_note, priority, origin_type, origin_ref_id, fallback_context
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

  app.get("/api/v1/work-assignments/sla-summary", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    await ensureHumanExecutorRuntime(pool);

    const q: any = (req as any).query ?? {};
    const from_ts_ms = Number(q.from_ts_ms);
    const to_ts_ms = Number(q.to_ts_ms);
    const values: any[] = [auth.tenant_id];
    const filters: string[] = ["tenant_id = $1"];
    if (Number.isFinite(from_ts_ms)) {
      values.push(Math.trunc(from_ts_ms));
      filters.push(`created_ts_ms >= $${values.length}`);
    }
    if (Number.isFinite(to_ts_ms)) {
      values.push(Math.trunc(to_ts_ms));
      filters.push(`created_ts_ms <= $${values.length}`);
    }

    const summaryQ = await pool.query(
      `SELECT
          COUNT(*)::bigint AS total_count,
          COUNT(*) FILTER (WHERE status = 'ASSIGNED')::bigint AS assigned_count,
          COUNT(*) FILTER (WHERE status = 'ACCEPTED')::bigint AS accepted_count,
          COUNT(*) FILTER (WHERE status = 'ARRIVED')::bigint AS arrived_count,
          COUNT(*) FILTER (WHERE status = 'SUBMITTED')::bigint AS submitted_count,
          COUNT(*) FILTER (WHERE status = 'EXPIRED')::bigint AS expired_count,
          COUNT(*) FILTER (WHERE status = 'CANCELLED')::bigint AS cancelled_count,
          COUNT(*) FILTER (WHERE expired_reason = 'ACCEPT_TIMEOUT')::bigint AS accept_timeout_count,
          COUNT(*) FILTER (WHERE expired_reason = 'ARRIVE_TIMEOUT')::bigint AS arrive_timeout_count
       FROM work_assignment_index_v1
       WHERE ${filters.join(" AND ")}`,
      values
    );
    const row: any = summaryQ.rows?.[0] ?? {};
    return reply.send({
      ok: true,
      summary: {
        total_count: Number(row.total_count ?? 0),
        assigned_count: Number(row.assigned_count ?? 0),
        accepted_count: Number(row.accepted_count ?? 0),
        arrived_count: Number(row.arrived_count ?? 0),
        submitted_count: Number(row.submitted_count ?? 0),
        expired_count: Number(row.expired_count ?? 0),
        cancelled_count: Number(row.cancelled_count ?? 0),
        accept_timeout_count: Number(row.accept_timeout_count ?? 0),
        arrive_timeout_count: Number(row.arrive_timeout_count ?? 0),
      },
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
      `SELECT assignment_id, act_task_id, executor_id, assigned_at, status, accept_deadline_ts, arrive_deadline_ts, expired_ts, expired_reason, created_ts_ms, updated_ts_ms
       , dispatch_note, priority, origin_type, origin_ref_id, fallback_context
       FROM work_assignment_index_v1
       WHERE tenant_id = $1 AND assignment_id = $2
       LIMIT 1`,
      [auth.tenant_id, assignment_id]
    );
    if ((itemQ.rowCount ?? 0) < 1) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });

    return reply.send({ ok: true, assignment: normalizeAssignmentResponse(itemQ.rows[0]) });
  });

  app.get("/api/v1/operations/:id/handoff", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    await ensureHumanExecutorRuntime(pool);
    const operation_plan_id = normalizeId((req.params as any)?.id);
    if (!operation_plan_id) return badRequest(reply, "MISSING_OR_INVALID:operation_plan_id");

    const listQ = await pool.query(
      `SELECT h.operation_plan_id, h.act_task_id, h.source_dispatch_id, h.assignment_id, h.created_ts_ms,
              a.origin_type, a.origin_ref_id, a.fallback_context, a.status, a.executor_id, a.updated_ts_ms
       FROM operation_handoff_v1 h
       LEFT JOIN work_assignment_index_v1 a
         ON a.tenant_id = h.tenant_id AND a.assignment_id = h.assignment_id
       WHERE h.tenant_id = $1 AND h.operation_plan_id = $2
       ORDER BY h.created_ts_ms ASC, h.assignment_id ASC`,
      [auth.tenant_id, operation_plan_id]
    );

    return reply.send({
      ok: true,
      operation_plan_id,
      items: (listQ.rows ?? []).map((row: any) => ({
        operation_plan_id: String(row.operation_plan_id ?? operation_plan_id),
        act_task_id: String(row.act_task_id ?? ""),
        source_dispatch_id: row.source_dispatch_id ? String(row.source_dispatch_id) : null,
        assignment_id: String(row.assignment_id ?? ""),
        assignment_status: row.status ? String(row.status) : null,
        executor_id: row.executor_id ? String(row.executor_id) : null,
        origin_type: row.origin_type ? String(row.origin_type) : "auto_fallback",
        origin_ref_id: row.origin_ref_id ? String(row.origin_ref_id) : null,
        fallback_context: parsePgJson(row.fallback_context),
        created_ts_ms: Number(row.created_ts_ms ?? 0),
        updated_ts_ms: Number(row.updated_ts_ms ?? row.created_ts_ms ?? 0),
      })),
    });
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
      `SELECT assignment_id, act_task_id, executor_id, assigned_at, status, version_no FROM work_assignment_index_v1 WHERE tenant_id = $1 AND assignment_id = $2 LIMIT 1`,
      [auth.tenant_id, assignment_id]
    );
    const row = existingQ.rows?.[0];
    if (!row) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });

    const currentStatus = String(row.status ?? "") as AssignmentStatus;
    if (!canTransitionAssignmentStatus(currentStatus, status as AssignmentStatus)) {
      return statusTransitionError(reply, 400, "INVALID_STATUS_TRANSITION", { from: currentStatus, to: status, current: currentStatus });
    }

    const nowIso = new Date().toISOString();
    const updateQ = await pool.query(
      `UPDATE work_assignment_index_v1
       SET status = $3,
           expired_reason = CASE WHEN $3 IN ('CANCELLED','EXPIRED') THEN COALESCE(expired_reason, $5) ELSE NULL END,
           expired_ts = CASE WHEN $3 IN ('CANCELLED','EXPIRED') THEN COALESCE(expired_ts, $4) ELSE NULL END,
           updated_ts_ms = $4,
           version_no = version_no + 1
       WHERE tenant_id = $1 AND assignment_id = $2 AND status = $6 AND version_no = $7`,
      [auth.tenant_id, assignment_id, status, Date.now(), note, currentStatus, Number(row.version_no ?? 0)]
    );
    if ((updateQ.rowCount ?? 0) < 1) {
      return statusTransitionError(reply, 409, "CONFLICT", { from: currentStatus, to: status, current: currentStatus });
    }

    const audit_id = randomUUID();
    await pool.query(
      `INSERT INTO work_assignment_audit_v1
       (tenant_id, audit_id, assignment_id, act_task_id, executor_id, status, occurred_at, actor_id, token_id, from_status, to_status, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9,$10,$11,$12)`,
      [auth.tenant_id, audit_id, assignment_id, String(row.act_task_id), String(row.executor_id), status, nowIso, auth.actor_id, auth.token_id, currentStatus, status, note]
    );

    const fact_id = await insertAuditFact(pool, "work_assignment_status_changed_v1", auth, {
      assignment_id,
      act_task_id: String(row.act_task_id),
      executor_id: String(row.executor_id),
      from_status: currentStatus,
      to_status: status,
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
    defaultNote: string
  ): Promise<any> {
    const auth = requireAoActScopeV0(req, reply, scope);
    if (!auth) return;
    await ensureHumanExecutorRuntime(pool);

    const params: any = req.params ?? {};
    const assignment_id = normalizeId(params.assignmentId ?? params.assignment_id);
    if (!assignment_id) return badRequest(reply, "MISSING_OR_INVALID:assignment_id");

    const existingQ = await pool.query(
      `SELECT assignment_id, act_task_id, executor_id, status, accept_deadline_ts, arrive_deadline_ts, version_no
       FROM work_assignment_index_v1
       WHERE tenant_id = $1 AND assignment_id = $2
       LIMIT 1`,
      [auth.tenant_id, assignment_id]
    );
    const row = existingQ.rows?.[0];
    if (!row) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });

    const fromStatus = String(row.status ?? "") as AssignmentStatus;
    if (!canTransitionAssignmentStatus(fromStatus, targetStatus)) {
      return statusTransitionError(reply, 400, "INVALID_STATUS_TRANSITION", { from: fromStatus, to: targetStatus, current: fromStatus });
    }
    const now = Date.now();
    const acceptDeadlineTs = Number(row.accept_deadline_ts ?? NaN);
    const arriveDeadlineTs = Number(row.arrive_deadline_ts ?? NaN);
    if (targetStatus === "ACCEPTED" && Number.isFinite(acceptDeadlineTs) && now > acceptDeadlineTs) {
      return reply.status(400).send({
        ok: false,
        error: "ASSIGNMENT_EXPIRED",
        detail: { stage: "accept", deadline_ts: acceptDeadlineTs, now_ts: now },
      });
    }
    if (targetStatus === "ARRIVED" && Number.isFinite(arriveDeadlineTs) && now > arriveDeadlineTs) {
      return reply.status(400).send({
        ok: false,
        error: "ASSIGNMENT_EXPIRED",
        detail: { stage: "arrive", deadline_ts: arriveDeadlineTs, now_ts: now },
      });
    }

    const act_task_id = String(row.act_task_id ?? "");
    const executor_id = String(row.executor_id ?? "");
    const noteFromBody = isNonEmptyString(req?.body?.note) ? String(req.body.note).trim().slice(0, 512) : null;
    const note = noteFromBody || defaultNote;
    const nowIso = new Date().toISOString();

    const updateQ = await pool.query(
      `UPDATE work_assignment_index_v1
       SET status = $3,
           expired_reason = CASE WHEN $3 IN ('CANCELLED','EXPIRED') THEN COALESCE(expired_reason, $6) ELSE NULL END,
           expired_ts = CASE WHEN $3 IN ('CANCELLED','EXPIRED') THEN COALESCE(expired_ts, $5) ELSE NULL END,
           updated_ts_ms = $5,
           version_no = version_no + 1
       WHERE tenant_id = $1 AND assignment_id = $2 AND status = $4 AND version_no = $7`,
      [auth.tenant_id, assignment_id, targetStatus, fromStatus, now, note, Number(row.version_no ?? 0)]
    );
    if ((updateQ.rowCount ?? 0) < 1) {
      return statusTransitionError(reply, 409, "CONFLICT", { from: fromStatus, to: targetStatus, current: fromStatus });
    }

    const audit_id = randomUUID();
    await pool.query(
      `INSERT INTO work_assignment_audit_v1
       (tenant_id, audit_id, assignment_id, act_task_id, executor_id, status, occurred_at, actor_id, token_id, from_status, to_status, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9,$10,$11,$12)`,
      [auth.tenant_id, audit_id, assignment_id, act_task_id, executor_id, targetStatus, nowIso, auth.actor_id, auth.token_id, fromStatus, targetStatus, note]
    );

    const fact_id = await insertAuditFact(pool, "work_assignment_status_changed_v1", auth, {
      assignment_id,
      act_task_id,
      executor_id,
      from_status: fromStatus,
      to_status: targetStatus,
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

  app.post("/api/v1/work-assignments/:assignmentId/cancel", async (req, reply) => {
    return transitionAssignmentStatus(req, reply, "CANCELLED", "ao_act.task.write", "DISPATCHER_CANCELLED_V1");
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
      `SELECT assignment_id, act_task_id, executor_id, status, version_no
       FROM work_assignment_index_v1
       WHERE tenant_id = $1 AND assignment_id = $2
       LIMIT 1`,
      [auth.tenant_id, assignment_id]
    );
    const assignment = existingQ.rows?.[0];
    if (!assignment) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });

    const fromStatus = String(assignment.status ?? "") as AssignmentStatus;
    if (!canTransitionAssignmentStatus(fromStatus, "SUBMITTED")) {
      return statusTransitionError(reply, 400, "INVALID_STATUS_TRANSITION", { from: fromStatus, to: "SUBMITTED", current: fromStatus });
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

    const issues: FieldValidationIssue[] = [];
    const worker_count = readNonNegativeNumber(body.labor?.worker_count, "labor.worker_count", issues, { max: 2000 });
    const duration_minutes_input = readNonNegativeNumber(body.labor?.duration_minutes, "labor.duration_minutes", issues, { max: 24 * 60 });
    const duration_minutes = duration_minutes_input == null
      ? null
      : Math.trunc(duration_minutes_input ?? Math.max(1, Math.round((end_ts - start_ts) / 60000)));

    const resource_usage = {
      fuel_l: readNonNegativeNumber(body.resource_usage?.fuel_l, "resource_usage.fuel_l", issues, { max: 1_000_000 }),
      electric_kwh: readNonNegativeNumber(body.resource_usage?.electric_kwh, "resource_usage.electric_kwh", issues, { max: 1_000_000 }),
      water_l: readNonNegativeNumber(body.resource_usage?.water_l, "resource_usage.water_l", issues, { max: 1_000_000 }),
      chemical_ml: readNonNegativeNumber(body.resource_usage?.chemical_ml, "resource_usage.chemical_ml", issues, { max: 1_000_000 }),
      consumables: Array.isArray(body.resource_usage?.consumables)
        ? body.resource_usage.consumables.slice(0, 32).map((item: any, idx: number) => {
          const name = readNormalizedString(item?.name, `resource_usage.consumables[${idx}].name`, issues, { maxLength: 64 });
          const amount = readNonNegativeNumber(item?.amount, `resource_usage.consumables[${idx}].amount`, issues, { max: 1_000_000 });
          const unit = item?.unit == null ? undefined : String(item.unit).trim().slice(0, 16);
          return { name, amount, unit };
        }).filter((x: any) => x.name && x.amount != null).map((x: any) => ({ name: x.name as string, amount: Number(x.amount), unit: x.unit }))
        : [],
    };

    const exception_type_raw = readNormalizedString(body.exception?.type ?? "NONE", "exception.type", issues, { maxLength: 32 });
    const exception_type = (exception_type_raw ?? "NONE").toUpperCase();
    const allowedExceptionTypes = new Set(["NONE", "WEATHER", "MACHINE", "MATERIAL_SHORTAGE", "SAFETY", "FIELD_BLOCKED", "OTHER"]);
    if (!allowedExceptionTypes.has(exception_type)) {
      issues.push({
        field: "exception.type",
        code: "INVALID_ENUM",
        message: "exception.type must be one of NONE|WEATHER|MACHINE|MATERIAL_SHORTAGE|SAFETY|FIELD_BLOCKED|OTHER",
      });
    }
    const exception_code = body.exception?.code == null ? undefined : readNormalizedString(body.exception?.code, "exception.code", issues, { maxLength: 64 });
    const exception_detail = body.exception?.detail == null ? undefined : String(body.exception?.detail).slice(0, 2000);

    const location_summary_raw: any = body.location_summary && typeof body.location_summary === "object" ? body.location_summary : {};
    const center_lat_raw = location_summary_raw.center?.lat;
    const center_lon_raw = location_summary_raw.center?.lon;
    const center_lat_num = center_lat_raw == null || center_lat_raw === "" ? undefined : asFiniteNumber(center_lat_raw);
    const center_lon_num = center_lon_raw == null || center_lon_raw === "" ? undefined : asFiniteNumber(center_lon_raw);
    if (center_lat_num == null && center_lat_raw != null && center_lat_raw !== "") issues.push({ field: "location_summary.center.lat", code: "INVALID_NUMBER", message: "location_summary.center.lat must be a finite number" });
    if (center_lon_num == null && center_lon_raw != null && center_lon_raw !== "") issues.push({ field: "location_summary.center.lon", code: "INVALID_NUMBER", message: "location_summary.center.lon must be a finite number" });
    if (center_lat_num != null && (center_lat_num < -90 || center_lat_num > 90)) issues.push({ field: "location_summary.center.lat", code: "OUT_OF_RANGE", message: "location_summary.center.lat must be between -90 and 90" });
    if (center_lon_num != null && (center_lon_num < -180 || center_lon_num > 180)) issues.push({ field: "location_summary.center.lon", code: "OUT_OF_RANGE", message: "location_summary.center.lon must be between -180 and 180" });
    const path_points = readNonNegativeNumber(location_summary_raw.path_points, "location_summary.path_points", issues, { max: 1_000_000 });
    const distance_m = readNonNegativeNumber(location_summary_raw.distance_m, "location_summary.distance_m", issues, { max: 10_000_000 });
    const geohash = location_summary_raw.geohash == null ? undefined : readNormalizedString(location_summary_raw.geohash, "location_summary.geohash", issues, { maxLength: 32 });
    const location_remark = location_summary_raw.remark == null ? undefined : String(location_summary_raw.remark).slice(0, 512);

    const evidence_meta = Array.isArray(body.evidence_meta)
      ? body.evidence_meta.slice(0, 50).map((item: any, idx: number) => {
        const artifact_id = item?.artifact_id == null ? undefined : readNormalizedString(item.artifact_id, `evidence_meta[${idx}].artifact_id`, issues, { maxLength: 128 });
        const object_key = item?.object_key == null ? undefined : readNormalizedString(item.object_key, `evidence_meta[${idx}].object_key`, issues, { maxLength: 512 });
        const filename = item?.filename == null ? undefined : String(item.filename).slice(0, 255);
        const category = item?.category == null ? undefined : String(item.category).trim().toLowerCase();
        const mime_type = item?.mime_type == null ? undefined : String(item.mime_type).slice(0, 128);
        const size_bytes = readNonNegativeNumber(item?.size_bytes, `evidence_meta[${idx}].size_bytes`, issues, { max: 1024 * 1024 * 1024 });
        const captured_at_ts = readNonNegativeNumber(item?.captured_at_ts, `evidence_meta[${idx}].captured_at_ts`, issues, { max: 99_999_999_999_999 });
        if (!artifact_id && !object_key) {
          issues.push({
            field: `evidence_meta[${idx}]`,
            code: "MISSING_REFERENCE",
            message: "artifact_id or object_key is required",
          });
        }
        return { artifact_id, object_key, filename, category, mime_type, size_bytes: size_bytes ?? undefined, captured_at_ts: captured_at_ts ?? undefined };
      })
      : [];
    if (body.evidence_meta != null && !Array.isArray(body.evidence_meta)) {
      issues.push({ field: "evidence_meta", code: "INVALID_TYPE", message: "evidence_meta must be an array" });
    }

    if (issues.length > 0) return badFieldRequest(reply, issues);

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
      labor: {
        duration_minutes: duration_minutes ?? Math.max(1, Math.round((end_ts - start_ts) / 60000)),
        worker_count: worker_count ?? 1,
      },
      resource_usage,
      exception: {
        type: exception_type,
        code: exception_code ?? undefined,
        detail: exception_detail,
      },
      location_summary: {
        center: center_lat_num != null && center_lon_num != null
          ? { lat: center_lat_num, lon: center_lon_num }
          : undefined,
        path_points: path_points ?? undefined,
        distance_m: distance_m ?? undefined,
        geohash: geohash ?? undefined,
        remark: location_remark,
      },
      evidence_meta,
      logs_refs: Array.isArray(body.logs_refs) && body.logs_refs.length > 0
        ? body.logs_refs
        : evidence_meta
          .map((item: { object_key?: string; artifact_id?: string }) => item.object_key ?? item.artifact_id ?? null)
          .filter((v: string | null): v is string => Boolean(v))
          .map((ref: string) => ({ kind: "artifact_object", ref })),
      status: String(body.status ?? "executed").trim().toLowerCase() === "not_executed" ? "not_executed" : "executed",
      constraint_check: {
        violated: exception_type !== "NONE" || Boolean(body.constraint_check?.violated ?? false),
        violations: Array.isArray(body.constraint_check?.violations) ? body.constraint_check.violations.map((x: any) => String(x)) : (exception_code ? [exception_code] : []),
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
    if (!Array.isArray(delegatedPayload.logs_refs) || delegatedPayload.logs_refs.length < 1) {
      delegatedPayload.logs_refs = [{ kind: "human_submission", ref: `work-assignment://${assignment_id}/${now}` }];
    }

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
       SET status = 'SUBMITTED', expired_reason = NULL, expired_ts = NULL, updated_ts_ms = $4, version_no = version_no + 1
       WHERE tenant_id = $1 AND assignment_id = $2 AND status = $3 AND version_no = $5`,
      [auth.tenant_id, assignment_id, fromStatus, Date.now(), Number(assignment.version_no ?? 0)]
    );
    if ((updateQ.rowCount ?? 0) < 1) {
      return statusTransitionError(reply, 409, "CONFLICT", { from: fromStatus, to: "SUBMITTED", current: fromStatus });
    }

    const audit_id = randomUUID();
    await pool.query(
      `INSERT INTO work_assignment_audit_v1
       (tenant_id, audit_id, assignment_id, act_task_id, executor_id, status, occurred_at, actor_id, token_id, from_status, to_status, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9,$10,$11,$12)`,
      [auth.tenant_id, audit_id, assignment_id, act_task_id, String(assignment.executor_id ?? ""), "SUBMITTED", nowIso, auth.actor_id, auth.token_id, fromStatus, "SUBMITTED", `RECEIPT_FACT:${String(delegatedJson.fact_id ?? "")}`]
    );

    const fact_id = await insertAuditFact(pool, "work_assignment_submitted_v1", auth, {
      assignment_id,
      act_task_id,
      executor_id: String(assignment.executor_id ?? ""),
      from_status: fromStatus,
      to_status: "SUBMITTED",
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
      `SELECT audit_id, assignment_id, act_task_id, executor_id, status, from_status, to_status, occurred_at, actor_id, token_id, note
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
      `SELECT tenant_id, assignment_id, act_task_id, executor_id, status, version_no
       FROM work_assignment_index_v1
       WHERE (
         status = 'ASSIGNED' AND accept_deadline_ts IS NOT NULL AND accept_deadline_ts < $2
       ) OR (
         status = 'ACCEPTED' AND arrive_deadline_ts IS NOT NULL AND arrive_deadline_ts < $2
       )
       ORDER BY updated_ts_ms ASC
       LIMIT $1`,
      [batch_size, Date.now()]
    );
    for (const row of q.rows ?? []) {
      const fromStatus = String(row.status ?? "") as AssignmentStatus;
      const toStatus: AssignmentStatus = fromStatus === "ASSIGNED" ? "EXPIRED" : "CANCELLED";
      const reason = fromStatus === "ASSIGNED" ? "ACCEPT_TIMEOUT" : "ARRIVE_TIMEOUT";
      const updateQ = await pool.query(
        `UPDATE work_assignment_index_v1
         SET status = $3, expired_reason = $4, expired_ts = COALESCE(expired_ts, $5), updated_ts_ms = $5, version_no = version_no + 1
         WHERE tenant_id = $1 AND assignment_id = $2 AND status = $6 AND version_no = $7`,
        [String(row.tenant_id), String(row.assignment_id), toStatus, reason, Date.now(), fromStatus, Number(row.version_no ?? 0)]
      );
      if ((updateQ.rowCount ?? 0) < 1) continue;
      const audit_id = randomUUID();
      await pool.query(
        `INSERT INTO work_assignment_audit_v1
         (tenant_id, audit_id, assignment_id, act_task_id, executor_id, status, occurred_at, actor_id, token_id, from_status, to_status, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9,$10,$11,$12)`,
        [String(row.tenant_id), audit_id, String(row.assignment_id), String(row.act_task_id), String(row.executor_id), toStatus, nowIso, "system/assignment_expiry_worker", "system", fromStatus, toStatus, reason]
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
            to_status: toStatus,
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
