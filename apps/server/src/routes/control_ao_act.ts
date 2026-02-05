// GEOX/apps/server/src/routes/control_ao_act.ts

import type { FastifyInstance } from "fastify"; // Fastify instance typing
import type { Pool } from "pg"; // Postgres pool typing
import { randomUUID } from "node:crypto"; // Generate UUIDs for fact/task ids
import { z } from "zod"; // Runtime validation

import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0"; // Sprint 19: AO-ACT token/scope authorization.

// Sprint 10 v0: 7-item minimal allowlist for action_type (frozen by acceptance).
export const AO_ACT_ACTION_TYPE_ALLOWLIST_V0 = [
  "PLOW",
  "HARROW",
  "SEED",
  "SPRAY",
  "IRRIGATE",
  "TRANSPORT",
  "HARVEST"
] as const; // Frozen minimal set

const FACT_SOURCE_AO_ACT_V0 = "api/control/ao_act"; // Source label for facts written by AO-ACT routes (DB NOT NULL constraint).

const FORBID_KEYS_V0 = new Set<string>([
  "problem_state_id",
  "lifecycle_state",
  "recommendation",
  "suggestion",
  "proposal",
  "agronomy",
  "prescription",
  "severity",
  "priority",
  "expected_outcome",
  "effectiveness",
  "quality",
  "desirability",
  "next_action",
  "follow_up",
  "autotrigger",
  "auto",
  "profile",
  "preset",
  "mode",
  "success_criteria",
  "success_score",
  "yield",
  "profit"
]); // Exact-match, case-sensitive

function scanForForbiddenKeys(value: unknown): string | null {
  if (value === null || value === undefined) return null; // Nothing to scan
  if (Array.isArray(value)) {
    for (const it of value) {
      const hit = scanForForbiddenKeys(it); // Recurse into array elements
      if (hit) return hit; // Fail fast
    }
    return null; // No hit
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>; // Narrow
    for (const k of Object.keys(obj)) {
      if (FORBID_KEYS_V0.has(k)) return k; // Exact match
      const hit = scanForForbiddenKeys(obj[k]); // Recurse
      if (hit) return hit; // Fail fast
    }
    return null; // No hit
  }
  return null; // Primitives have no keys
}

function assertNoObjectsOrArrays(obj: Record<string, unknown>, label: string): void {
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue; // Skip null/undefined (caller decides whether null is allowed)
    if (Array.isArray(v)) throw new Error(`${label}.${k} must not be an array`); // Forbidden
    if (typeof v === "object") throw new Error(`${label}.${k} must not be an object`); // Forbidden
  }
}

type ParamDef = {
  name: string; // Parameter key name
  type: "number" | "boolean" | "enum"; // Allowed primitive types
  min?: number; // Optional numeric lower bound
  max?: number; // Optional numeric upper bound
  enum?: string[]; // Required for enum type
};

function validateKeyedPrimitives(
  schemaKeys: ParamDef[],
  obj: Record<string, unknown>,
  label: string
): void {
  // Enforce 1:1 coverage (no missing keys, no extra keys)
  const allowed = new Map(schemaKeys.map((d) => [d.name, d] as const)); // Fast lookup
  const objKeys = Object.keys(obj); // Provided keys
  for (const k of objKeys) {
    if (!allowed.has(k)) throw new Error(`${label} has unknown key: ${k}`); // Extra key
  }
  for (const d of schemaKeys) {
    if (!(d.name in obj)) throw new Error(`${label} missing key: ${d.name}`); // Missing key
  }

  // Primitive typing + bounds + enum in-list
  for (const [k, v] of Object.entries(obj)) {
    const def = allowed.get(k)!; // Exists by checks above
    if (def.type === "number") {
      if (typeof v !== "number" || Number.isNaN(v)) throw new Error(`${label}.${k} must be a number`);
      if (def.min !== undefined && v < def.min) throw new Error(`${label}.${k} below min`);
      if (def.max !== undefined && v > def.max) throw new Error(`${label}.${k} above max`);
      continue;
    }
    if (def.type === "boolean") {
      if (typeof v !== "boolean") throw new Error(`${label}.${k} must be boolean`);
      continue;
    }
    // enum
    if (typeof v !== "string") throw new Error(`${label}.${k} must be an enum string`);
    const list = def.enum ?? [];
    if (list.length === 0) throw new Error(`${label}.${k} enum list is empty`);
    if (!list.includes(v)) throw new Error(`${label}.${k} not in enum`);
  }
}

function validateEnumStringValuesAgainstSchema(
  schemaKeys: ParamDef[],
  obj: Record<string, unknown>,
  label: string
): void {
  const defs = new Map(schemaKeys.map((d) => [d.name, d] as const)); // Map schema ...

  for (const [k, v] of Object.entries(obj)) {
    if (typeof v !== "string") continue; // 仅当值为 string 时，才启用 enum 约束（冻结规则 0.2）
    const def = defs.get(k); // Look up the schema definition for this key
    if (!def) throw new Error(`${label}.${k} string value requires enum schema`); // Forbid free strings
    if (def.type !== "enum") throw new Error(`${label}.${k} string value requires enum type`); // String must be enum
    const list = def.enum ?? []; // Allowed enum values
    if (list.length === 0) throw new Error(`${label}.${k} enum list is empty`); // Enum must be declared
    if (!list.includes(v)) throw new Error(`${label}.${k} not in enum`); // Value must be in-list
  }
}

function validateObservedParametersSubset(
  schemaKeys: ParamDef[],
  obj: Record<string, unknown>,
  label: string
): void {
  const defs = new Map(schemaKeys.map((d) => [d.name, d] as const)); // Map schema definitions by key

  for (const [k, v] of Object.entries(obj)) {
    const def = defs.get(k); // Find definition for this key
    if (!def) throw new Error(`${label} has unknown key: ${k}`); // Observed parameters cannot introduce new keys

    if (def.type === "number") {
      if (typeof v !== "number" || Number.isNaN(v)) throw new Error(`${label}.${k} must be a number`); // Require number
      if (def.min !== undefined && v < def.min) throw new Error(`${label}.${k} below min`); // Enforce min bound if present
      if (def.max !== undefined && v > def.max) throw new Error(`${label}.${k} above max`); // Enforce max bound if present
      continue;
    }
    if (def.type === "boolean") {
      if (typeof v !== "boolean") throw new Error(`${label}.${k} must be boolean`); // Require boolean
      continue;
    }
    if (typeof v !== "string") throw new Error(`${label}.${k} must be an enum string`); // Enum requires string
    const list = def.enum ?? []; // Allowed enum values
    if (list.length === 0) throw new Error(`${label}.${k} enum list is empty`); // Enum must be declared
    if (!list.includes(v)) throw new Error(`${label}.${k} not in enum`); // Value must be in-list
  }
}

function normalizeRecordJson(v: unknown): any { // Normalize record_json returned by pg when column type may be jsonb or text.
  if (v === null || v === undefined) return null; // Null-safe.
  if (typeof v === "string") { // When record_json column is TEXT, pg returns string.
    try { return JSON.parse(v); } catch { return null; } // Best-effort parse; invalid JSON treated as null.
  }
  return v; // For json/jsonb, pg already returns object.
} // End normalizeRecordJson.

async function findAoActTaskByActTaskId(pool: Pool, actTaskId: string): Promise<any | null> {
  const sql = `
    SELECT fact_id, (record_json::jsonb) AS record_json
    FROM facts
    WHERE (record_json::jsonb)->> 'type' = 'ao_act_task_v0'
      AND (record_json::jsonb)#>> '{payload,act_task_id}' = $1
    ORDER BY occurred_at DESC
    LIMIT 1
  `;
  const r = await pool.query(sql, [actTaskId]);
  if (r.rowCount === 0) return null;
  return r.rows[0].record_json;
}

async function writeAoActAuthzAuditFactV0(
  pool: Pool,
  input: {
    event: "task_write" | "receipt_write" | "index_read"; // Event type for audit trail.
    actor_id: string; // Actor id from auth context.
    token_id: string; // Token id from auth context.
    target_fact_id?: string; // Optional created fact id.
    act_task_id?: string; // Optional act_task_id related to the event.
  }
): Promise<void> {
  const record_json = {
    type: "ao_act_authz_audit_v0",
    payload: {
      event: input.event,
      actor_id: input.actor_id,
      token_id: input.token_id,
      target_fact_id: input.target_fact_id ?? null,
      act_task_id: input.act_task_id ?? null,
      created_at_ts: Date.now()
    }
  };
  const fact_id = randomUUID();
  await pool.query("INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)", [fact_id, FACT_SOURCE_AO_ACT_V0, record_json]);
}

export function registerControlAoActRoutes(app: FastifyInstance, pool: Pool): void {
  // No shared helper here; audit facts are written via writeAoActAuthzAuditFactV0(...) to keep schema stable.

  // POST /api/control/ao_act/task
  app.post("/api/control/ao_act/task", async (req, reply) => {
    try {
      const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
      if (!auth) return;

      const hit = scanForForbiddenKeys(req.body);
      if (hit) return reply.status(400).send({ ok: false, error: `FORBIDDEN_KEY:${hit}` });

      const body = z
        .object({
          issuer: z.object({ kind: z.literal("human"), id: z.string().min(1), namespace: z.string().min(1) }),
          action_type: z.string().min(1),
          target: z.object({ kind: z.enum(["field", "area", "path"]), ref: z.string().min(1) }),
          time_window: z.object({ start_ts: z.number(), end_ts: z.number() }),
          parameter_schema: z.object({
            keys: z
              .array(
                z.object({
                  name: z.string().min(1),
                  type: z.enum(["number", "boolean", "enum"]),
                  min: z.number().optional(),
                  max: z.number().optional(),
                  enum: z.array(z.string().min(1)).optional()
                })
              )
              .min(1)
          }),
          parameters: z.record(z.union([z.number(), z.boolean(), z.string()])),
          constraints: z.record(z.union([z.number(), z.boolean(), z.string()])),
          meta: z.record(z.any()).optional()
        })
        .parse(req.body);

      if (!AO_ACT_ACTION_TYPE_ALLOWLIST_V0.includes(body.action_type as any)) {
        return reply.status(400).send({ ok: false, error: "ACTION_TYPE_NOT_ALLOWED" });
      }

      if (body.time_window.start_ts > body.time_window.end_ts) {
        return reply.status(400).send({ ok: false, error: "TIME_WINDOW_INVALID" });
      }

      const schemaKeys = body.parameter_schema.keys.map((k) => ({
        name: k.name,
        type: k.type,
        min: k.min,
        max: k.max,
        enum: k.type === "enum" ? (k.enum ?? []) : undefined
      })) as ParamDef[];

      // v0 冻结：parameters / constraints 只能是原子值（禁止 object / array）
      assertNoObjectsOrArrays(body.parameters, "parameters");
      assertNoObjectsOrArrays(body.constraints, "constraints");

      // v0: parameters keys must 1:1 match schema.keys (and enum strings must be in-list)
      validateKeyedPrimitives(schemaKeys, body.parameters, "parameters");

      // v0 冻结 0.2：constraints 中如果出现 string 值，则必须被 parameter_schema 作为 enum 定义，否则 reject。
      validateEnumStringValuesAgainstSchema(schemaKeys, body.constraints, "constraints");

      const act_task_id = `act_${randomUUID().replace(/-/g, "")}`; // Deterministic format is not required; uniqueness is.
      const created_at_ts = Date.now(); // Audit timestamp (fact occurred_at is authoritative)

      const record_json = {
        type: "ao_act_task_v0",
        payload: {
          act_task_id,
          issuer: body.issuer,
          action_type: body.action_type,
          target: body.target,
          time_window: body.time_window,
          parameter_schema: body.parameter_schema,
          parameters: body.parameters,
          constraints: body.constraints,
          created_at_ts,
          meta: body.meta
        }
      };

      const fact_id = randomUUID();
      await pool.query(
        "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
        [fact_id, FACT_SOURCE_AO_ACT_V0, record_json]
      );

      await writeAoActAuthzAuditFactV0(pool, {
        event: "task_write",
        actor_id: auth.actor_id,
        token_id: auth.token_id,
        target_fact_id: fact_id,
        act_task_id
      });

      return reply.send({ ok: true, fact_id, act_task_id });
    } catch (e: any) {
      return reply.status(400).send({ ok: false, error: e?.message ?? "BAD_REQUEST" });
    }
  });

  // POST /api/control/ao_act/receipt
  app.post("/api/control/ao_act/receipt", async (req, reply) => {
    try {
      const auth = requireAoActScopeV0(req, reply, "ao_act.receipt.write");
      if (!auth) return;

      const hit = scanForForbiddenKeys(req.body);
      if (hit) return reply.status(400).send({ ok: false, error: `FORBIDDEN_KEY:${hit}` });

      const body = z
        .object({
          act_task_id: z.string().min(1),
          executor_id: z.object({ kind: z.enum(["human", "script", "device"]), id: z.string().min(1), namespace: z.string().min(1) }),
          execution_time: z.object({ start_ts: z.number(), end_ts: z.number() }),
          execution_coverage: z.object({ kind: z.enum(["area", "path", "field"]), ref: z.string().min(1) }),
          resource_usage: z.object({
            fuel_l: z.number().nullable(),
            electric_kwh: z.number().nullable(),
            water_l: z.number().nullable(),
            chemical_ml: z.number().nullable()
          }),
          logs_refs: z
            .array(z.object({ kind: z.string().min(1), ref: z.string().min(1) }))
            .min(1),
          status: z.enum(["executed", "not_executed"]).optional(),
          constraint_check: z.object({ violated: z.boolean(), violations: z.array(z.string()) }),
          observed_parameters: z.record(z.union([z.number(), z.boolean(), z.string()])),
          meta: z.record(z.any()).optional()
        })
        .parse(req.body);

      if (body.execution_time.start_ts > body.execution_time.end_ts) {
        return reply.status(400).send({ ok: false, error: "EXECUTION_TIME_INVALID" });
      }

      // Enforce constraint_check consistency (v0 freeze)
      if (body.constraint_check.violated === false && body.constraint_check.violations.length > 0) {
        return reply.status(400).send({ ok: false, error: "CONSTRAINT_CHECK_INCONSISTENT" });
      }

      // v0：observed_parameters 的 string(enum) 必须由 task.parameter_schema 定义（冻结规则 0.2）
      const task = await findAoActTaskByActTaskId(pool, body.act_task_id);
      if (!task) return reply.status(400).send({ ok: false, error: "UNKNOWN_TASK" });
      const schemaKeys = (task?.payload?.parameter_schema?.keys ?? []) as ParamDef[];
      if (!Array.isArray(schemaKeys) || schemaKeys.length === 0) {
        return reply.status(400).send({ ok: false, error: "TASK_PARAMETER_SCHEMA_MISSING" });
      }

      assertNoObjectsOrArrays(body.observed_parameters, "observed_parameters");

      // v0：observed_parameters 只能使用 task.parameter_schema.keys[] 中已声明的 key；并按类型/界限/枚举校验。
      validateObservedParametersSubset(schemaKeys, body.observed_parameters, "observed_parameters");

      const created_at_ts = Date.now();
      const record_json = {
        type: "ao_act_receipt_v0",
        payload: {
          act_task_id: body.act_task_id,
          executor_id: body.executor_id,
          execution_time: body.execution_time,
          execution_coverage: body.execution_coverage,
          resource_usage: body.resource_usage,
          logs_refs: body.logs_refs,
          status: body.status,
          constraint_check: body.constraint_check,
          observed_parameters: body.observed_parameters,
          created_at_ts,
          meta: body.meta
        }
      };

      const fact_id = randomUUID();
      await pool.query(
        "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
        [fact_id, FACT_SOURCE_AO_ACT_V0, record_json]
      );

      await writeAoActAuthzAuditFactV0(pool, {
        event: "receipt_write",
        actor_id: auth.actor_id,
        token_id: auth.token_id,
        target_fact_id: fact_id,
        act_task_id: body.act_task_id
      });

      return reply.send({ ok: true, fact_id });
    } catch (e: any) {
      return reply.status(400).send({ ok: false, error: e?.message ?? "BAD_REQUEST" });
    }
  });

  app.get("/api/control/ao_act/index", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read"); // Enforce token scope for index reads.
    if (!auth) return; // Halt if missing/invalid/insufficient.

    const q = z
      .object({ act_task_id: z.string().optional() })
      .strict()
      .parse((req as any).query ?? {});

    const viewSql = q.act_task_id
      ? "SELECT * FROM ao_act_index_v0 WHERE act_task_id = $1 ORDER BY act_task_id ASC"
      : "SELECT * FROM ao_act_index_v0 ORDER BY act_task_id ASC";

    const viewArgs = q.act_task_id ? [q.act_task_id] : [];

    try {
      const out = await pool.query(viewSql, viewArgs);
      await writeAoActAuthzAuditFactV0(pool, {
        event: "index_read",
        actor_id: auth.actor_id,
        token_id: auth.token_id,
        act_task_id: q.act_task_id
      });
      return reply.send({ ok: true, rows: out.rows });
    } catch (e: any) {
      // Fallback: compute index inline from facts if the view is not present (keeps acceptance runnable on existing DBs).
      const inlineSql = q.act_task_id
        ? `WITH act_tasks AS (
             SELECT
               f.fact_id AS task_fact_id,
               f.occurred_at AS task_occurred_at,
               f.source AS task_source,
               (f.record_json::jsonb) AS task_record_json,
               ((f.record_json::jsonb)->'payload'->>'act_task_id') AS act_task_id,
               ((f.record_json::jsonb)->'payload'->>'action_type') AS action_type
             FROM facts f
             WHERE (f.record_json::jsonb)->>'type' = 'ao_act_task_v0'
           ),
           act_receipts AS (
             SELECT
               f.fact_id AS receipt_fact_id,
               f.occurred_at AS receipt_occurred_at,
               f.source AS receipt_source,
               (f.record_json::jsonb) AS receipt_record_json,
               ((f.record_json::jsonb)->'payload'->>'act_task_id') AS act_task_id,
               ((f.record_json::jsonb)->'payload'->>'status') AS status
             FROM facts f
             WHERE (f.record_json::jsonb)->>'type' = 'ao_act_receipt_v0'
           ),
           latest_receipt AS (
             SELECT DISTINCT ON (r.act_task_id)
               r.act_task_id,
               r.receipt_fact_id,
               r.receipt_occurred_at,
               r.receipt_source,
               r.status,
               r.receipt_record_json
             FROM act_receipts r
             ORDER BY r.act_task_id, r.receipt_occurred_at DESC, r.receipt_fact_id DESC
           )
           SELECT
             t.act_task_id,
             t.action_type,
             t.task_fact_id,
             t.task_occurred_at,
             t.task_source,
             lr.receipt_fact_id,
             lr.receipt_occurred_at,
             lr.receipt_source,
             lr.status,
             t.task_record_json AS task_record_json,
             lr.receipt_record_json AS receipt_record_json
           FROM act_tasks t
           LEFT JOIN latest_receipt lr ON lr.act_task_id = t.act_task_id
           WHERE t.act_task_id = $1
           ORDER BY t.act_task_id ASC`
        : `WITH act_tasks AS (
             SELECT
               f.fact_id AS task_fact_id,
               f.occurred_at AS task_occurred_at,
               f.source AS task_source,
               (f.record_json::jsonb) AS task_record_json,
               ((f.record_json::jsonb)->'payload'->>'act_task_id') AS act_task_id,
               ((f.record_json::jsonb)->'payload'->>'action_type') AS action_type
             FROM facts f
             WHERE (f.record_json::jsonb)->>'type' = 'ao_act_task_v0'
           ),
           act_receipts AS (
             SELECT
               f.fact_id AS receipt_fact_id,
               f.occurred_at AS receipt_occurred_at,
               f.source AS receipt_source,
               (f.record_json::jsonb) AS receipt_record_json,
               ((f.record_json::jsonb)->'payload'->>'act_task_id') AS act_task_id,
               ((f.record_json::jsonb)->'payload'->>'status') AS status
             FROM facts f
             WHERE (f.record_json::jsonb)->>'type' = 'ao_act_receipt_v0'
           ),
           latest_receipt AS (
             SELECT DISTINCT ON (r.act_task_id)
               r.act_task_id,
               r.receipt_fact_id,
               r.receipt_occurred_at,
               r.receipt_source,
               r.status,
               r.receipt_record_json
             FROM act_receipts r
             ORDER BY r.act_task_id, r.receipt_occurred_at DESC, r.receipt_fact_id DESC
           )
           SELECT
             t.act_task_id,
             t.action_type,
             t.task_fact_id,
             t.task_occurred_at,
             t.task_source,
             lr.receipt_fact_id,
             lr.receipt_occurred_at,
             lr.receipt_source,
             lr.status,
             t.task_record_json AS task_record_json,
             lr.receipt_record_json AS receipt_record_json
           FROM act_tasks t
           LEFT JOIN latest_receipt lr ON lr.act_task_id = t.act_task_id
           ORDER BY t.act_task_id ASC`;

      const inlineArgs = q.act_task_id ? [q.act_task_id] : [];
      const out = await pool.query(inlineSql, inlineArgs);
      await writeAoActAuthzAuditFactV0(pool, {
        event: "index_read",
        actor_id: auth.actor_id,
        token_id: auth.token_id,
        act_task_id: q.act_task_id
      });
      return reply.send({ ok: true, rows: out.rows, note: "inline_fallback" });
    }
  });
}
