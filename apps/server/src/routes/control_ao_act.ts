/**
 * Mainline Contract:
 * - action 执行新流主口径：`/api/v1/actions/*`。
 * - 新增 action 执行、回执、索引、重试能力必须优先进入该主路由族。
 *
 * Stable Product Fields:
 * - tenant_id / project_id / group_id 为稳定隔离字段。
 * - operation_id / operation_plan_id / act_task_id / idempotency_key 为稳定执行链路字段。
 *
 * Forbidden New Dependencies:
 * - 禁止新代码依赖 legacy/deprecated route。
 * - 禁止将新流程挂接到 `/api/control/ao_act/*` 等兼容入口。
 *
 * Successor:
 * - 若后续升级 action API 版本，必须在 successor 中显式声明迁移策略；
 *   迁移窗口内 `/api/v1/actions/*` 仍作为唯一主口径。
 */
// GEOX/apps/server/src/routes/control_ao_act.ts

import type { FastifyInstance } from "fastify"; // Fastify instance typing
import type { Pool } from "pg"; // Postgres pool typing
import { randomUUID } from "node:crypto"; // Generate UUIDs for fact/task ids
import { z } from "zod"; // Runtime validation
import { resolveTaskCapabilityViaDeviceSkillsResult } from "@geox/device-skills";

import { requireAoActAnyScopeV0, requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js"; // Sprint 19: AO-ACT token/scope authorization.
import { computeEffect } from "../domain/agronomy/effect_engine.js";
import { evaluateAoActHardRulePrecheckV1 } from "../domain/agronomy/ao_act_hard_rule_strategy_v1.js";
import { deriveFertilityPrecheckConstraintsV1 } from "../domain/agronomy/fertility_precheck_constraints_v1.js";
import { refreshFieldFertilityStateV1 } from "../projections/field_fertility_state_v1.js";
import { appendSkillRunFact, digestJson } from "../domain/skill_registry/facts.js";
import { loadManualOperationByCommandId } from "../domain/controlplane/task_service.js";
import { actionReceiptRequestSchemaV1, validateActionReceiptMetaV1 } from "../contracts/action_receipt_v1.js";
import { getPrescriptionById } from "../domain/prescription/prescription_contract_v1.js";
import { buildVariableActionTaskPayloadV1 } from "../domain/prescription/variable_action_task_v1.js";
import { createFailSafeEventV1, createManualTakeoverV1, evaluateDeviceDispatchSafetyV1, findOpenFailSafeForDeviceV1 } from "../services/fail_safe_service_v1.js";
import { auditContextFromRequestV1, recordSecurityAuditEventV1 } from "../services/security_audit_service_v1.js";
import { resolveDeviceSkillBindingForTask } from "../services/skills/skill_binding_service.js";
import { executeSkillRuntimeV1 } from "../services/skills/runtime_v1.js";
// Semantic guardrail: decision payloads use APPROVE/REJECT inputs, while internal runtime status persists APPROVED/terminal state machine values.

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
const ACTION_EXECUTION_ALLOWLIST_V1 = [
  ...AO_ACT_ACTION_TYPE_ALLOWLIST_V0,
  "FERTILIZE",
  "CHECK_FIELD_STATUS",
  "REVIEW_APPROVAL",
  "COLLECT_RECEIPT",
  "PROMOTE_ACCEPTANCE",
  "RETRY_EXECUTION"
] as const;
const ACTION_SKILL_PROFILE_V1: Record<string, {
  required_parameter_keys: string[];
  expected_evidence_requirements: string[];
}> = {
  IRRIGATE: {
    required_parameter_keys: ["duration_sec"],
    expected_evidence_requirements: ["dispatch_ack", "valve_open_confirmation", "water_delivery_receipt"]
  },
  FERTILIZE: {
    required_parameter_keys: ["chemical_ml"],
    expected_evidence_requirements: ["dispatch_ack", "fertilizer_dispense_confirmation", "execution_receipt"]
  }
};

type DeviceActionValidationResultV1 =
  | { ok: true }
  | {
      ok: false;
      error: "DEVICE_ACTION_MISSING_PARAMETERS" | "DEVICE_ACTION_TYPE_MISMATCH";
      required_any_of?: string[];
      expected_action_type?: string;
      resolved_action_type?: string;
    };

export const AO_ACT_TASK_SCHEMA_RULES_V0 = Object.freeze({
  forbidden_keys: [
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
  ] as const,
  parameter_schema_parameters_relationship: "parameter_schema.keys must 1:1 match parameters keys (no missing, no extras)",
  irrigate_minimal_example: {
    action_type: "IRRIGATE",
    parameter_schema: {
      keys: [{ name: "duration_sec", type: "number", min: 1 }]
    },
    parameters: { duration_sec: 30 }
  }
} as const);

const FORBID_KEYS_V0 = new Set<string>(AO_ACT_TASK_SCHEMA_RULES_V0.forbidden_keys); // Exact-match, case-sensitive

type TenantTripleV0 = { // Sprint 22: hard isolation scope triple used across AO-ACT routes.
  tenant_id: string; // Tenant isolation SSOT field; MUST be present on token + request.
  project_id: string; // Project isolation field; MUST be present on token + request.
  group_id: string; // Group isolation field; MUST be present on token + request.
}; // End TenantTripleV0.
function requireActionTaskCreateRoleV1(reply: any, auth: any): boolean {
  const role = String(auth?.role ?? "").trim();
  if (role === "admin" || role === "operator") return true;
  reply.status(403).send({ ok: false, error: "ACTION_TASK_CREATE_ROLE_DENIED" });
  return false;
}
function requireActionReceiptSubmitRoleV1(reply: any, auth: any): boolean {
  const role = String(auth?.role ?? "").trim();
  if (role === "admin" || role === "operator" || role === "executor") return true;
  reply.status(403).send({ ok: false, error: "ACTION_RECEIPT_SUBMIT_ROLE_DENIED" });
  return false;
}

function isFeatureEnabledV0(envName: string, defaultEnabled: boolean): boolean {
  const raw = String(process.env[envName] ?? "").trim().toLowerCase();
  if (!raw) return defaultEnabled;
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  return defaultEnabled;
}

function assertTenantFieldsPresentV0(input: any, label: string): TenantTripleV0 { // Parse + require tenant triple on inputs.
  const out = z // Use Zod for deterministic runtime validation.
    .object({
      tenant_id: z.string().min(1), // Require non-empty tenant_id string.
      project_id: z.string().min(1), // Require non-empty project_id string.
      group_id: z.string().min(1) // Require non-empty group_id string.
    })
    .parse(input ?? {}); // Parse or throw.
  return out as TenantTripleV0; // Return parsed triple.
} // End assertTenantFieldsPresentV0.

function requireTenantMatchOr404V0(
  auth: { tenant_id: string; project_id: string; group_id: string }, // Auth triple from token record.
  target: TenantTripleV0, // Target triple from request payload/query.
  reply: any // Fastify reply object used to emit deterministic errors.
): boolean {
  // Sprint 22: cross-tenant access MUST be non-enumerable; mismatch returns 404 (contract).
  if (auth.tenant_id !== target.tenant_id || auth.project_id !== target.project_id || auth.group_id !== target.group_id) {
    reply.status(404).send({ ok: false, error: "NOT_FOUND" }); // Hide existence across tenants.
    return false; // Halt handler.
  }
  return true; // Allow request to proceed.
} // End requireTenantMatchOr404V0.

function isAllowedStructuredActionMetaPath(path: string[]): boolean {
  // Step9 variable prescription:
  // variable_plan belongs to Action Task metadata.
  // variable_execution belongs to Receipt metadata.
  // Both must stay outside parameters / observed_parameters / constraints.
  if (path.length < 2) return false;
  if (path[0] !== "meta") return false;
  return path[1] === "variable_plan" || path[1] === "variable_execution";
}

function scanForForbiddenKeys(value: unknown, path: string[] = []): string | null {
  if (value === null || value === undefined) return null; // Nothing to scan

  if (isAllowedStructuredActionMetaPath(path)) {
    return null;
  }

  if (Array.isArray(value)) {
    for (const it of value) {
      const hit = scanForForbiddenKeys(it, path); // Recurse into array elements
      if (hit) return hit; // Fail fast
    }
    return null; // No hit
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>; // Narrow
    for (const k of Object.keys(obj)) {
      const nextPath = [...path, k];

      if (!isAllowedStructuredActionMetaPath(nextPath) && FORBID_KEYS_V0.has(k)) return k; // Exact match
      const hit = scanForForbiddenKeys(obj[k], nextPath); // Recurse
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

type EffectMetricSnapshot = {
  soil_moisture?: number;
  temperature?: number;
  humidity?: number;
};

function resolveDeviceExecutionSkillMeta(actionType: string): { skill_id: "irrigation_valve_v1" | "fertilizer_unit_v1"; version: "v1" } | null {
  const normalized = String(actionType ?? "").trim().toUpperCase();
  if (normalized === "IRRIGATE") return { skill_id: "irrigation_valve_v1", version: "v1" };
  if (normalized === "FERTILIZE") return { skill_id: "fertilizer_unit_v1", version: "v1" };
  return null;
}

function buildEffectMetricSnapshot(rows: any[]): EffectMetricSnapshot {
  const out: EffectMetricSnapshot = {};
  for (const row of rows ?? []) {
    const metric = String(row?.metric ?? "").trim().toLowerCase();
    const value = Number(row?.value_num ?? NaN);
    if (!Number.isFinite(value)) continue;
    if (metric === "soil_moisture" && out.soil_moisture == null) out.soil_moisture = value;
    if (["temperature", "air_temperature", "soil_temperature", "soil_temp", "soil_temp_c"].includes(metric) && out.temperature == null) out.temperature = value;
    if (["humidity", "air_humidity"].includes(metric) && out.humidity == null) out.humidity = value;
  }
  return out;
}

async function postJsonInternal(
  req: any,
  authz: string,
  path: string,
  body: any
): Promise<{ ok: boolean; status: number; json: any }> {
  const proto = String((req.headers as any)?.["x-forwarded-proto"] ?? "http");
  const localPortRaw = Number((req.socket as any)?.localPort ?? 3000);
  const localPort = Number.isFinite(localPortRaw) && localPortRaw > 0 ? localPortRaw : 3000;
  const url = `${proto}://127.0.0.1:${localPort}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: authz,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, json };
}

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

function resolveExpectedEvidenceRequirementsV1(actionType: string, capabilityResolution: any): string[] {
  const fromCapability = Array.isArray(capabilityResolution?.resolution?.evidence_requirements)
    ? capabilityResolution.resolution.evidence_requirements.map((x: unknown) => String(x)).filter((x: string) => x.length > 0)
    : [];
  if (fromCapability.length > 0) return fromCapability;
  return ACTION_SKILL_PROFILE_V1[actionType]?.expected_evidence_requirements ?? [];
}

export function validateDeviceActionRequirementsV1(input: {
  action_type: string;
  execution_parameters: Record<string, unknown>;
  capability_resolution: any | null;
}): DeviceActionValidationResultV1 {
  const actionType = String(input.action_type ?? "").trim().toUpperCase();
  const profile = ACTION_SKILL_PROFILE_V1[actionType];
  if (!profile) return { ok: true };

  const resolvedParameters = input.capability_resolution?.ok
    && input.capability_resolution?.resolution?.parameters
    && typeof input.capability_resolution.resolution.parameters === "object"
    ? (input.capability_resolution.resolution.parameters as Record<string, unknown>)
    : {};
  const resolvedActionType = String(
    resolvedParameters.action_type
    ?? resolvedParameters.task_type
    ?? ""
  ).trim().toUpperCase();

  if (resolvedActionType && resolvedActionType !== actionType) {
    return {
      ok: false,
      error: "DEVICE_ACTION_TYPE_MISMATCH",
      expected_action_type: actionType,
      resolved_action_type: resolvedActionType
    };
  }

  const hasRequiredParameter = profile.required_parameter_keys.some((k) =>
    resolvedParameters[k] !== undefined && resolvedParameters[k] !== null
  ) || profile.required_parameter_keys.some((k) =>
    input.execution_parameters[k] !== undefined && input.execution_parameters[k] !== null
  );
  if (!hasRequiredParameter) {
    return {
      ok: false,
      error: "DEVICE_ACTION_MISSING_PARAMETERS",
      required_any_of: profile.required_parameter_keys
    };
  }
  return { ok: true };
}

async function findAoActTaskByActTaskId(
  pool: Pool, // Postgres pool used to query the append-only facts ledger.
  actTaskId: string, // Target act_task_id to locate in the ledger.
  tenant: TenantTripleV0 // Sprint 22: tenant triple used to hard-isolate task lookup.
): Promise<any | null> {
  const sql = `
    SELECT fact_id, (record_json::jsonb) AS record_json
    FROM facts
    WHERE (record_json::jsonb)->> 'type' = 'ao_act_task_v0'
      AND (record_json::jsonb)#>> '{payload,act_task_id}' = $1
      AND (record_json::jsonb)#>> '{payload,tenant_id}' = $2
      AND (record_json::jsonb)#>> '{payload,project_id}' = $3
      AND (record_json::jsonb)#>> '{payload,group_id}' = $4
    ORDER BY occurred_at DESC
    LIMIT 1
  `; // Filter by tenant triple to prevent cross-tenant act_task_id probing.
  const r = await pool.query(sql, [actTaskId, tenant.tenant_id, tenant.project_id, tenant.group_id]); // Execute query.
  if (r.rowCount === 0) return null; // No matching task in this tenant scope.
  return r.rows[0].record_json; // Return task record_json for downstream schema checks.
}

async function loadLatestApprovalRequestStatusV0(
  pool: Pool,
  requestId: string,
  tenant: TenantTripleV0
): Promise<string | null> {
  const sql = `
    SELECT (record_json::jsonb#>>'{payload,status}') AS status
    FROM facts
    WHERE (record_json::jsonb->>'type') = 'approval_request_v1'
      AND (record_json::jsonb#>>'{payload,request_id}') = $1
      AND (record_json::jsonb#>>'{payload,tenant_id}') = $2
      AND (record_json::jsonb#>>'{payload,project_id}') = $3
      AND (record_json::jsonb#>>'{payload,group_id}') = $4
    ORDER BY occurred_at DESC, fact_id DESC
    LIMIT 1
  `;
  const res = await pool.query(sql, [requestId, tenant.tenant_id, tenant.project_id, tenant.group_id]);
  if (!res.rows?.length) return null;
  const status = String(res.rows[0].status ?? "").trim().toUpperCase();
  return status || null;
}

async function ensureVariableOperationPlanV1(
  pool: Pool,
  input: {
    tenant: TenantTripleV0;
    operation_plan_id: string;
    act_command_id: string;
    prescription: any;
    approval_request_id: string;
    actor_id: string;
    token_id: string;
  }
): Promise<{ operation_plan_id: string; operation_plan_fact_id: string; created: boolean }> {
  const existing = await pool.query(
    `SELECT fact_id
       FROM facts
      WHERE (record_json::jsonb->>'type') = 'operation_plan_v1'
        AND (record_json::jsonb#>>'{payload,operation_plan_id}') = $1
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $2
        AND (record_json::jsonb#>>'{payload,project_id}') = $3
        AND (record_json::jsonb#>>'{payload,group_id}') = $4
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 1`,
    [input.operation_plan_id, input.tenant.tenant_id, input.tenant.project_id, input.tenant.group_id],
  );
  if ((existing.rowCount ?? 0) > 0) {
    return { operation_plan_id: input.operation_plan_id, operation_plan_fact_id: String(existing.rows[0].fact_id), created: false };
  }
  const nowTs = Date.now();
  const operationPlanFactId = randomUUID();
  const prescription = input.prescription ?? {};
  const operationAmount = prescription.operation_amount ?? {};
  const variablePlan = { mode: "VARIABLE_BY_ZONE", zone_rates: Array.isArray(operationAmount.zone_rates) ? operationAmount.zone_rates : [] };
  const record = {
    type: "operation_plan_v1",
    payload: {
      tenant_id: input.tenant.tenant_id,
      project_id: input.tenant.project_id,
      group_id: input.tenant.group_id,
      operation_plan_id: input.operation_plan_id,
      operation_id: input.operation_plan_id,
      command_id: input.act_command_id,
      approval_request_id: input.approval_request_id,
      prescription_id: String(prescription.prescription_id ?? ""),
      recommendation_id: String(prescription.recommendation_id ?? ""),
      field_id: String(prescription.field_id ?? ""),
      season_id: prescription.season_id ?? null,
      operation_type: String(prescription.operation_type ?? "IRRIGATION"),
      action_type: "IRRIGATE",
      status: "ACKED",
      operation_amount: operationAmount,
      variable_plan: variablePlan,
      device_requirements: prescription.device_requirements ?? {},
      acceptance_conditions: prescription.acceptance_conditions ?? {},
      source: "variable_prescription_contract_v1",
      actor_id: input.actor_id,
      token_id: input.token_id,
      created_at_ts: nowTs,
      updated_at_ts: nowTs,
      meta: {
        command_id: input.act_command_id,
        variable_prescription: true,
        prescription_id: String(prescription.prescription_id ?? ""),
        recommendation_id: String(prescription.recommendation_id ?? ""),
      },
    },
  };
  await pool.query(
    "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
    [operationPlanFactId, FACT_SOURCE_AO_ACT_V0, record],
  );
  const transitionFactId = randomUUID();
  await pool.query(
    "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
    [transitionFactId, FACT_SOURCE_AO_ACT_V0, {
      type: "operation_plan_transition_v1",
      payload: {
        tenant_id: input.tenant.tenant_id,
        project_id: input.tenant.project_id,
        group_id: input.tenant.group_id,
        operation_plan_id: input.operation_plan_id,
        from_status: null,
        to_status: "ACKED",
        reason: "VARIABLE_ACTION_TASK_CREATED",
        actor_id: input.actor_id,
        token_id: input.token_id,
        created_at_ts: nowTs,
      },
    }],
  );
  return { operation_plan_id: input.operation_plan_id, operation_plan_fact_id: operationPlanFactId, created: true };
}


async function findDuplicateAoActReceiptByIdempotencyKey(
  pool: Pool, // Postgres pool used to query the append-only facts ledger.
  input: { // Structured inputs used to scope the idempotency check.
    tenant_id: string; // Sprint 22: tenant id bound into the dedupe domain.
    project_id: string; // Sprint 22: project id bound into the dedupe domain.
    group_id: string; // Sprint 22: group id bound into the dedupe domain.
    act_task_id: string; // Target act_task_id to dedupe within.
    executor_kind: string; // Executor kind for dedupe scope.
    executor_id: string; // Executor id for dedupe scope.
    executor_namespace: string; // Executor namespace for dedupe scope.
    idempotency_key: string; // Executor-generated idempotency key (must be stable across retries).
  } // Close input type.
): Promise<{ fact_id: string } | null> { // Returns an existing fact_id if a duplicate is found.
  const sql = `
    SELECT fact_id
    FROM facts
    WHERE (record_json::jsonb)->> 'type' = 'ao_act_receipt_v0'
      AND (record_json::jsonb)#>> '{payload,tenant_id}' = $1
      AND (record_json::jsonb)#>> '{payload,project_id}' = $2
      AND (record_json::jsonb)#>> '{payload,group_id}' = $3
      AND (record_json::jsonb)#>> '{payload,act_task_id}' = $4
      AND (record_json::jsonb)#>> '{payload,executor_id,kind}' = $5
      AND (record_json::jsonb)#>> '{payload,executor_id,id}' = $6
      AND (record_json::jsonb)#>> '{payload,executor_id,namespace}' = $7
      AND (record_json::jsonb)#>> '{payload,meta,idempotency_key}' = $8
    ORDER BY occurred_at DESC
    LIMIT 1
  `; // Stable SQL that finds the most recent receipt matching the tenant-scoped idempotency domain.

  const r = await pool.query( // Execute query against ledger.
    sql, // Provide SQL text.
    [ // Provide positional args.
      input.tenant_id, // Bind tenant id.
      input.project_id, // Bind project id.
      input.group_id, // Bind group id.
      input.act_task_id, // Bind act_task_id.
      input.executor_kind, // Bind executor kind.
      input.executor_id, // Bind executor id.
      input.executor_namespace, // Bind executor namespace.
      input.idempotency_key // Bind idempotency key.
    ] // End args.
  ); // End query.
  if (r.rowCount === 0) return null; // No duplicate found.
  return { fact_id: String(r.rows[0].fact_id) }; // Return existing fact id for diagnostics.
} // End findDuplicateAoActReceiptByIdempotencyKey.


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

async function assertAllDeviceRefsExistAndMatchTenantV0(
  pool: Pool, // Postgres pool used to query the append-only facts ledger.
  deviceRefs: Array<{ kind: string; ref: string }>, // Device reference pointers carried by receipt payload.
  tenant: TenantTripleV0 // Sprint 22: tenant triple used to prevent cross-tenant evidence references.
): Promise<void> {
  if (!Array.isArray(deviceRefs) || deviceRefs.length === 0) return; // Nothing to validate.

  const ids = deviceRefs.map((r) => r.ref).filter((s) => typeof s === "string" && s.length > 0); // Extract referenced fact ids.
  if (ids.length !== deviceRefs.length) throw new Error("DEVICE_REF_INVALID"); // Reject invalid ref entries.

  const sql = `
    SELECT fact_id, (record_json::jsonb) AS record_json
    FROM facts
    WHERE fact_id = ANY($1::text[])
      AND (record_json::jsonb)->> 'type' = 'ao_act_device_ref_v0'
  `; // Query only device_ref facts by id (append-only ledger).
  const r = await pool.query(sql, [ids]); // Fetch matching records.
  const rows = r.rows ?? []; // Normalize rows array.
  const byId = new Map<string, any>(rows.map((row: any) => [String(row.fact_id), normalizeRecordJson(row.record_json)])); // Map by fact id.

  for (const id of ids) { // Validate each referenced device_ref id.
    const rec = byId.get(id); // Lookup record_json by id.
    if (!rec) throw new Error(`DEVICE_REF_NOT_FOUND:${id}`); // Missing record => reject.
    const meta = (rec?.payload?.meta ?? {}) as any; // Read meta object without parsing content.
    // Sprint 22: device evidence must carry tenant triple in payload.meta and must match receipt tenant.
    if (String(meta.tenant_id || "") !== tenant.tenant_id) throw new Error("NOT_FOUND"); // Mismatch => reject as non-enumerable 404.
    if (String(meta.project_id || "") !== tenant.project_id) throw new Error("NOT_FOUND"); // Mismatch => reject as non-enumerable 404.
    if (String(meta.group_id || "") !== tenant.group_id) throw new Error("NOT_FOUND"); // Mismatch => reject as non-enumerable 404.
  } // End loop.
} // End assertAllDeviceRefsExistAndMatchTenantV0.


function logLegacyAoActWarning(app: FastifyInstance, req: any, path: string): void {
  app.log.warn({ path, method: req.method, actor: String((req.headers as any)?.authorization ?? '').slice(0, 24), warning: 'deprecated legacy AO-ACT route' }, 'deprecated legacy AO-ACT route used');
}

const LEGACY_AO_ACT_SUNSET_RFC1123 = "Thu, 31 Dec 2026 23:59:59 GMT";
const LEGACY_COMPATIBILITY_NOTICE = "compatibility only / do not use in new flows";

function withLegacyCompatibilityPayload(payload: any, successorEndpoint: string): Record<string, unknown> {
  const base =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : { ok: false, legacy_payload_wrapped: true, payload };
  return {
    ...base,
    deprecated: true,
    successor_endpoint: successorEndpoint,
    compatibility_notice: LEGACY_COMPATIBILITY_NOTICE
  };
}

function markLegacyCompatibilityResponse(reply: any, successorEndpoint: string): void {
  reply.header("X-Deprecated", "true");
  reply.header("Deprecation", "true");
  reply.header("Sunset", LEGACY_AO_ACT_SUNSET_RFC1123);
  reply.header("Link", `<${successorEndpoint}>; rel="successor-version"`);
  const originalSend = reply.send.bind(reply);
  reply.send = (payload: any) => originalSend(withLegacyCompatibilityPayload(payload, successorEndpoint));
}

async function handleAoActTaskV1(app: FastifyInstance, pool: Pool, req: any, reply: any, deprecated = false) {
  if (deprecated) {
    markLegacyCompatibilityResponse(reply, "/api/v1/actions/task");
    logLegacyAoActWarning(app, req, "/api/control/ao_act/task");
  }
    try {
      const auth = requireAoActAnyScopeV0(req, reply, ["action.task.create", "ao_act.task.write"]);
      if (!auth) return;
      if (!requireActionTaskCreateRoleV1(reply, auth)) {
        const raw = (req as any).body ?? {};
        const tenant_id = String(raw.tenant_id ?? auth.tenant_id ?? "").trim();
        const project_id = String(raw.project_id ?? auth.project_id ?? "").trim();
        const group_id = String(raw.group_id ?? auth.group_id ?? "").trim();
        if (tenant_id && project_id && group_id) {
          await recordSecurityAuditEventV1(pool, {
            tenant_id, project_id, group_id,
            ...auditContextFromRequestV1(req, auth),
            action: "security.denied",
            target_type: "act_task",
            result: "DENY",
            error_code: "ACTION_TASK_CREATE_ROLE_DENIED",
            source: "api/v1/actions/task"
          }).catch(() => undefined);
        }
        return;
      }

      const hit = scanForForbiddenKeys(req.body);
      if (hit) return reply.status(400).send({ ok: false, error: `FORBIDDEN_KEY:${hit}` });

      const body = z
        .object({
          tenant_id: z.string().min(1),
          project_id: z.string().min(1),
          group_id: z.string().min(1),
          operation_plan_id: z.string().min(1),
          approval_request_id: z.string().min(1),
          program_id: z.string().min(1).optional(),
          field_id: z.string().min(1).optional(),
          season_id: z.string().min(1).optional(),
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
          device_refs: z
            .array(
              z.object({
                kind: z.literal("device_ref_fact"),
                ref: z.string().min(8),
                note: z.string().max(280).nullable().optional()
              })
            )
            .optional(),
          meta: z.record(z.any()).optional()
        })
        .parse(req.body);

const tenant = assertTenantFieldsPresentV0(body, "body"); // Extract tenant triple from parsed body.
if (!requireTenantMatchOr404V0(auth, tenant, reply)) return; // Enforce hard isolation (404 on mismatch).


      if (!AO_ACT_ACTION_TYPE_ALLOWLIST_V0.includes(body.action_type as any)) {
        return reply.status(400).send({ ok: false, error: "ACTION_TYPE_NOT_ALLOWED" });
      }

      if (body.time_window.start_ts > body.time_window.end_ts) {
        return reply.status(400).send({ ok: false, error: "TIME_WINDOW_INVALID" });
      }

      const approvalStatus = await loadLatestApprovalRequestStatusV0(pool, body.approval_request_id, tenant);
      if (approvalStatus !== "APPROVED") {
        return reply.status(403).send({ ok: false, error: "APPROVAL_REQUEST_NOT_APPROVED" });
      }
      const deviceId = String((body.meta as any)?.device_id ?? "").trim();
      if (deviceId) {
        const existingFs = await findOpenFailSafeForDeviceV1(pool, { ...tenant, device_id: deviceId });
        if (existingFs) return reply.status(409).send({ ok: false, error: "FAIL_SAFE_OPEN", fail_safe_event_id: existingFs.fail_safe_event_id });
        const safety = await evaluateDeviceDispatchSafetyV1(pool, { ...tenant, device_id: deviceId });
        if (!safety.safe) {
          const fs = await createFailSafeEventV1(pool, { ...tenant, device_id: deviceId, trigger_type: safety.reason_code, severity: "HIGH", reason_code: safety.reason_code, blocked_action: "action.task.create", source: "api/v1/actions/task" });
          const takeover = await createManualTakeoverV1(pool, { ...tenant, fail_safe_event_id: fs.fail_safe_event_id, device_id: deviceId, requested_by_actor_id: auth.actor_id, requested_by_token_id: auth.token_id, reason_code: String(safety.reason_code ?? "DEVICE_STATUS_UNKNOWN") });
          await recordSecurityAuditEventV1(pool, {
            ...tenant,
            ...auditContextFromRequestV1(req, auth),
            action: "manual_override.requested",
            target_type: "manual_takeover",
            target_id: takeover.takeover_id,
            result: "ALLOW",
            source: "api/v1/actions/task",
            metadata: {
              fail_safe_event_id: fs.fail_safe_event_id,
              device_id: deviceId,
              reason_code: safety.reason_code,
              blocked_action: "action.task.create"
            }
          });
          await recordSecurityAuditEventV1(pool, { ...tenant, actor_id: auth.actor_id, token_id: auth.token_id, role: auth.role, action: "fail_safe.triggered", target_type: "device", target_id: deviceId, result: "ALLOW", reason: String(safety.reason_code ?? "DEVICE_STATUS_UNKNOWN"), source: "api/v1/actions/task" });
          return reply.status(409).send({ ok: false, error: "FAIL_SAFE_TRIGGERED", fail_safe_event_id: fs.fail_safe_event_id, manual_takeover_required: true, reason_code: safety.reason_code });
        }
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
      const resolvedFieldId = String(body.field_id ?? body.meta?.field_id ?? "").trim();
      let hardRuleConstraints: Record<string, unknown> = body.constraints;
      let hardRuleSource: "request_constraints" | "field_fertility_state_v1" = "request_constraints";
      if (resolvedFieldId) {
        const fertilityState = await refreshFieldFertilityStateV1(pool, {
          tenant_id: tenant.tenant_id,
          project_id: tenant.project_id,
          group_id: tenant.group_id,
          field_id: resolvedFieldId,
        });
        hardRuleConstraints = {
          ...body.constraints,
          ...deriveFertilityPrecheckConstraintsV1({
            fertilityState,
            baseConstraints: body.constraints,
          })
        };
        hardRuleSource = "field_fertility_state_v1";
      }
      const enableAoActPrecheck = isFeatureEnabledV0("GEOX_ENABLE_AO_ACT_PRECHECK_V1", true);
      const hardRulePrecheck = enableAoActPrecheck
        ? evaluateAoActHardRulePrecheckV1({
            scope: { tenant_id: tenant.tenant_id, project_id: tenant.project_id },
            constraints: hardRuleConstraints,
            source: hardRuleSource,
          })
        : {
            action_hints: [] as string[],
            reason_codes: [] as string[],
            reason_details: [] as Array<{ code: string; action_hint: "irrigate_first" | "inspect"; source: "request_constraints" | "field_fertility_state_v1" }>,
            source: hardRuleSource,
          };

      const act_task_id = `act_${randomUUID().replace(/-/g, "")}`; // Deterministic format is not required; uniqueness is.
      const created_at_ts = Date.now(); // Audit timestamp (fact occurred_at is authoritative)

      const record_json = {
        type: "ao_act_task_v0",
        payload: {
          tenant_id: tenant.tenant_id,
          project_id: tenant.project_id,
          group_id: tenant.group_id,
          operation_plan_id: body.operation_plan_id,
          approval_request_id: body.approval_request_id,
          program_id: body.program_id ?? body.meta?.program_id ?? null,
          field_id: body.field_id ?? body.meta?.field_id ?? null,
          season_id: body.season_id ?? body.meta?.season_id ?? null,
          act_task_id,
          issuer: body.issuer,
          action_type: body.action_type,
          task_type: String(body.meta?.task_type ?? body.action_type).trim() || body.action_type,
          target: body.target,
          time_window: body.time_window,
          parameter_schema: body.parameter_schema,
          parameters: body.parameters,
          constraints: hardRuleConstraints,
          precheck: hardRulePrecheck,
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
      await recordSecurityAuditEventV1(pool, {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        ...auditContextFromRequestV1(req, auth),
        action: "action.task_created",
        target_type: "act_task",
        target_id: act_task_id,
        field_id: String(body.field_id ?? body.meta?.field_id ?? "").trim() || undefined,
        result: "ALLOW",
        source: "api/v1/actions/task",
        metadata: {
          operation_plan_id: body.operation_plan_id,
          approval_request_id: body.approval_request_id,
          device_id: String(body.meta?.device_id ?? "").trim() || undefined,
          action_type: body.action_type
        }
      });

      return reply.send({ ok: true, fact_id, act_task_id, precheck: hardRulePrecheck });
    } catch (e: any) {
      return reply.status(400).send({ ok: false, error: e?.message ?? "BAD_REQUEST" });
    }
}

async function handleAoActReceiptV1(app: FastifyInstance, pool: Pool, req: any, reply: any, deprecated = false) {
  if (deprecated) {
    markLegacyCompatibilityResponse(reply, "/api/v1/actions/receipt");
    logLegacyAoActWarning(app, req, "/api/control/ao_act/receipt");
  }
    try {
      const auth = requireAoActAnyScopeV0(req, reply, ["action.receipt.submit", "ao_act.receipt.write"]);
      if (!auth) return;
      if (!requireActionReceiptSubmitRoleV1(reply, auth)) return;

      const hit = scanForForbiddenKeys(req.body);
      if (hit) return reply.status(400).send({ ok: false, error: `FORBIDDEN_KEY:${hit}` });

      const body = actionReceiptRequestSchemaV1.parse(req.body);

      const tenant = assertTenantFieldsPresentV0(body, "body"); // Extract tenant triple from parsed body.
      if (!requireTenantMatchOr404V0(auth, tenant, reply)) return; // Enforce hard isolation (404 on mismatch).

      const metaValidation = validateActionReceiptMetaV1(body.meta, body.act_task_id);
      if (metaValidation.error) {
        return reply.status(400).send({ ok: false, error: metaValidation.error });
      }
      const { idempotencyKey, commandId } = metaValidation;

if (body.execution_time.start_ts > body.execution_time.end_ts) {

        return reply.status(400).send({ ok: false, error: "EXECUTION_TIME_INVALID" });
      }

      // Enforce constraint_check consistency (v0 freeze)
      if (body.constraint_check.violated === false && body.constraint_check.violations.length > 0) {
        return reply.status(400).send({ ok: false, error: "CONSTRAINT_CHECK_INCONSISTENT" });
      }

      // v0：observed_parameters 的 string(enum) 必须由 task.parameter_schema 定义（冻结规则 0.2）
      
const task = await findAoActTaskByActTaskId(pool, body.act_task_id, tenant);
if (!task) return reply.status(400).send({ ok: false, error: "UNKNOWN_TASK" });
if (["FAILED","ERROR"].includes(String(body.status ?? "").toUpperCase())) {
  const fs = await createFailSafeEventV1(pool, { ...tenant, act_task_id: body.act_task_id, trigger_type: "EXECUTION_FAILED", severity: "HIGH", reason_code: "EXECUTION_FAILED", blocked_action: "acceptance.evaluate", source: "api/v1/actions/receipt" });
  await createManualTakeoverV1(pool, { ...tenant, fail_safe_event_id: fs.fail_safe_event_id, act_task_id: body.act_task_id, requested_by_actor_id: auth.actor_id, requested_by_token_id: auth.token_id, reason_code: "EXECUTION_FAILED" });
  await recordSecurityAuditEventV1(pool, { ...tenant, actor_id: auth.actor_id, token_id: auth.token_id, role: auth.role, action: "fail_safe.triggered", target_type: "act_task", target_id: body.act_task_id, result: "ALLOW", reason: "EXECUTION_FAILED", source: "api/v1/actions/receipt" });
}
const taskActionType = String(task?.payload?.action_type ?? "").trim().toUpperCase();
const expectedEvidenceRequirements = Array.isArray(task?.payload?.meta?.expected_evidence_requirements)
  ? (task.payload.meta.expected_evidence_requirements as unknown[]).map((x) => String(x)).filter((x) => x.length > 0)
  : resolveExpectedEvidenceRequirementsV1(taskActionType, null);
const providedEvidenceKinds = (Array.isArray(body.logs_refs) ? body.logs_refs : [])
  .concat(Array.isArray((body as any).evidence_refs) ? (body as any).evidence_refs : [])
  .map((x) => String(x?.kind ?? "").trim())
  .filter((x) => x.length > 0);
const missingEvidenceRequirements = expectedEvidenceRequirements.filter((reqItem) => !providedEvidenceKinds.includes(reqItem));

// Sprint 21: device_refs are pointer-only. Validate existence only; never parse referenced content.
if (Array.isArray((body as any).device_refs) && (body as any).device_refs.length > 0) {
  await assertAllDeviceRefsExistAndMatchTenantV0(pool, (body as any).device_refs, tenant);
}

const dup = await findDuplicateAoActReceiptByIdempotencyKey(pool, {
  tenant_id: tenant.tenant_id,
  project_id: tenant.project_id,
  group_id: tenant.group_id,
  act_task_id: body.act_task_id, // Dedupe within this act_task_id.
  executor_kind: body.executor_id.kind, // Dedupe scope: executor kind.
  executor_id: body.executor_id.id, // Dedupe scope: executor id.
  executor_namespace: body.executor_id.namespace, // Dedupe scope: executor namespace.
  idempotency_key: idempotencyKey // Dedupe key: executor-generated idempotency key.
});
if (dup) { // If a duplicate exists, reject to avoid semantic pollution from retries.
  return reply.status(409).send({ ok: false, error: "DUPLICATE_RECEIPT", existing_fact_id: dup.fact_id });
}

      const schemaKeys = (task?.payload?.parameter_schema?.keys ?? []) as ParamDef[];
      if (!Array.isArray(schemaKeys) || schemaKeys.length === 0) {
        return reply.status(400).send({ ok: false, error: "TASK_PARAMETER_SCHEMA_MISSING" });
      }

      assertNoObjectsOrArrays(body.observed_parameters, "observed_parameters");

      // v0：observed_parameters 只能使用 task.parameter_schema.keys[] 中已声明的 key；并按类型/界限/枚举校验。
      validateObservedParametersSubset(schemaKeys, body.observed_parameters, "observed_parameters");

      const receiptDeviceId = String(
        body?.meta?.device_id
        ?? task?.payload?.meta?.device_id
        ?? task?.payload?.device_id
        ?? ""
      ).trim();
      const beforeTsMs = Number(body.execution_time.start_ts);
      const receiptTsMs = Number(body.execution_time.end_ts);
      const afterWindowEndTsMs = receiptTsMs + 20 * 60 * 1000;
      let beforeMetrics: EffectMetricSnapshot = {};
      let afterMetrics: EffectMetricSnapshot = {};
      let computedEffect: { type: string; value: number } | null = null;
      if (receiptDeviceId && Number.isFinite(beforeTsMs) && Number.isFinite(receiptTsMs)) {
        const beforeQ = await pool.query(
          `SELECT metric, value_num, ts
             FROM telemetry_index_v1
            WHERE tenant_id = $1
              AND device_id = $2
              AND metric = ANY($3::text[])
              AND ts <= to_timestamp($4::double precision / 1000.0)
            ORDER BY ts DESC
            LIMIT 20`,
          [tenant.tenant_id, receiptDeviceId, ["soil_moisture", "temperature", "air_temperature", "humidity", "air_humidity", "soil_temperature", "soil_temp", "soil_temp_c"], beforeTsMs]
        ).catch(() => ({ rows: [] as any[] }));
        const afterQ = await pool.query(
          `SELECT metric, value_num, ts
             FROM telemetry_index_v1
            WHERE tenant_id = $1
              AND device_id = $2
              AND metric = ANY($3::text[])
              AND ts >= to_timestamp($4::double precision / 1000.0)
              AND ts <= to_timestamp($5::double precision / 1000.0)
            ORDER BY ts ASC
            LIMIT 100`,
          [tenant.tenant_id, receiptDeviceId, ["soil_moisture", "temperature", "air_temperature", "humidity", "air_humidity", "soil_temperature", "soil_temp", "soil_temp_c"], receiptTsMs, afterWindowEndTsMs]
        ).catch(() => ({ rows: [] as any[] }));
        beforeMetrics = buildEffectMetricSnapshot(beforeQ.rows ?? []);
        afterMetrics = buildEffectMetricSnapshot(afterQ.rows ?? []);
        computedEffect = computeEffect(beforeMetrics, afterMetrics);
      }

      const created_at_ts = Date.now();
      const record_json = {
        type: "ao_act_receipt_v0",
        payload: {
          tenant_id: tenant.tenant_id,
          project_id: tenant.project_id,
          group_id: tenant.group_id,
          operation_plan_id: body.operation_plan_id,
          act_task_id: body.act_task_id,
          executor_id: body.executor_id,
          execution_time: body.execution_time,
          execution_coverage: body.execution_coverage,
          resource_usage: body.resource_usage,
          evidence_refs: Array.isArray((body as any).evidence_refs) ? (body as any).evidence_refs : body.logs_refs,
          logs_refs: body.logs_refs,
          status: body.status,
          constraint_check: body.constraint_check,
          observed_parameters: body.observed_parameters,
          device_refs: (body as any).device_refs,
          effect_snapshot: {
            before_metrics: beforeMetrics,
            after_metrics: afterMetrics,
            effect: computedEffect
          },
          created_at_ts,
          meta: {
            ...(body.meta && typeof body.meta === "object" ? body.meta : {}),
            command_id: commandId,
            evidence_trace: {
              expected_requirements: expectedEvidenceRequirements,
              provided_kinds: providedEvidenceKinds,
              missing_requirements: missingEvidenceRequirements
            }
          }
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
      await recordSecurityAuditEventV1(pool, {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        ...auditContextFromRequestV1(req, auth),
        action: "action.receipt_submitted",
        target_type: "receipt",
        target_id: fact_id,
        field_id: String((task?.payload?.field_id ?? task?.payload?.meta?.field_id ?? "")).trim() || undefined,
        result: "ALLOW",
        source: "api/v1/actions/receipt",
        metadata: { act_task_id: body.act_task_id, status: body.status }
      });

      const latestPlanSql = `
        SELECT fact_id, (record_json::jsonb) AS record_json
        FROM facts
        WHERE (record_json::jsonb->>'type') = 'operation_plan_v1'
          AND (record_json::jsonb#>>'{payload,operation_plan_id}') = $1
          AND (record_json::jsonb#>>'{payload,tenant_id}') = $2
          AND (record_json::jsonb#>>'{payload,project_id}') = $3
          AND (record_json::jsonb#>>'{payload,group_id}') = $4
        ORDER BY occurred_at DESC, fact_id DESC
        LIMIT 1
      `;
      const latestPlanRes = await pool.query(latestPlanSql, [body.operation_plan_id, tenant.tenant_id, tenant.project_id, tenant.group_id]);
      if ((latestPlanRes.rowCount ?? 0) === 0) throw new Error("PLAN_NOT_FOUND");
      const latestPlan = latestPlanRes.rows[0]?.record_json ?? {};
      const planPayload = latestPlan?.payload ?? {};
      const currentStatus = String(planPayload.status ?? "").trim().toUpperCase();
      if (currentStatus === "SUCCEEDED" || currentStatus === "FAILED") {
        return reply.send({
          ok: true,
          fact_id,
          terminal_deduped: true,
          evidence_trace: {
            expected_requirements: expectedEvidenceRequirements,
            provided_kinds: providedEvidenceKinds,
            missing_requirements: missingEvidenceRequirements
          }
        });
      }

      const receiptStatus = String(body.status ?? "").toLowerCase();
      const terminalState = receiptStatus === "executed" ? "SUCCEEDED" : "FAILED";

      const transitionFactId = randomUUID();
      await pool.query(
        "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
        [transitionFactId, FACT_SOURCE_AO_ACT_V0, {
          type: "operation_plan_transition_v1",
          payload: {
            tenant_id: tenant.tenant_id,
            project_id: tenant.project_id,
            group_id: tenant.group_id,
            operation_plan_id: body.operation_plan_id,
            from_status: currentStatus || "ACKED",
            status: terminalState,
            trigger: "receipt",
            act_task_id: body.act_task_id,
            receipt_fact_id: fact_id,
            created_ts: Date.now()
          }
        }]
      );

      const planFactId = randomUUID();
      await pool.query(
        "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
        [planFactId, FACT_SOURCE_AO_ACT_V0, {
          type: "operation_plan_v1",
          payload: {
            ...planPayload,
            tenant_id: tenant.tenant_id,
            project_id: tenant.project_id,
            group_id: tenant.group_id,
            operation_plan_id: body.operation_plan_id,
            act_task_id: body.act_task_id,
            status: terminalState,
            receipt_fact_id: fact_id,
            before_metrics: beforeMetrics,
            after_metrics: afterMetrics,
            actual_effect: computedEffect,
            updated_ts: Date.now()
          }
        }]
      );

      return reply.send({
        ok: true,
        fact_id,
        operation_plan_transition_fact_id: transitionFactId,
        operation_plan_fact_id: planFactId,
        evidence_trace: {
          expected_requirements: expectedEvidenceRequirements,
          provided_kinds: providedEvidenceKinds,
          missing_requirements: missingEvidenceRequirements
        }
      });
    } catch (e: any) {
      const msg = String(e?.message ?? "BAD_REQUEST"); // Normalize error message.
      if (msg === "NOT_FOUND") return reply.status(404).send({ ok: false, error: "NOT_FOUND" }); // Enforce non-enumerable cross-tenant failure.
      return reply.status(400).send({ ok: false, error: msg });
    }
}

async function handleAoActIndexV1(app: FastifyInstance, pool: Pool, req: any, reply: any, deprecated = false) {
  if (deprecated) {
    markLegacyCompatibilityResponse(reply, "/api/v1/actions/index");
    logLegacyAoActWarning(app, req, "/api/control/ao_act/index");
  }
    const auth = requireAoActAnyScopeV0(req, reply, ["action.read", "ao_act.index.read"]); // Enforce token scope for index reads.
    if (!auth) return; // Halt if missing/invalid/insufficient.

    const q = z
      .object({ tenant_id: z.string().min(1), project_id: z.string().min(1), group_id: z.string().min(1), act_task_id: z.string().optional() })
      .strict()
      .parse((req as any).query ?? {});



const tenant = assertTenantFieldsPresentV0(q, "query"); // Extract tenant triple from parsed query.
if (!requireTenantMatchOr404V0(auth, tenant, reply)) return; // Enforce hard isolation (404 on mismatch).


// Sprint 22: always compute index inline and filter by tenant triple to avoid cross-tenant leakage via shared views.
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
         AND (f.record_json::jsonb)#>> '{payload,tenant_id}' = $1
         AND (f.record_json::jsonb)#>> '{payload,project_id}' = $2
         AND (f.record_json::jsonb)#>> '{payload,group_id}' = $3
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
         AND (f.record_json::jsonb)#>> '{payload,tenant_id}' = $1
         AND (f.record_json::jsonb)#>> '{payload,project_id}' = $2
         AND (f.record_json::jsonb)#>> '{payload,group_id}' = $3
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
     WHERE t.act_task_id = $4
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
         AND (f.record_json::jsonb)#>> '{payload,tenant_id}' = $1
         AND (f.record_json::jsonb)#>> '{payload,project_id}' = $2
         AND (f.record_json::jsonb)#>> '{payload,group_id}' = $3
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
         AND (f.record_json::jsonb)#>> '{payload,tenant_id}' = $1
         AND (f.record_json::jsonb)#>> '{payload,project_id}' = $2
         AND (f.record_json::jsonb)#>> '{payload,group_id}' = $3
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

const inlineArgs = q.act_task_id
  ? [tenant.tenant_id, tenant.project_id, tenant.group_id, q.act_task_id]
  : [tenant.tenant_id, tenant.project_id, tenant.group_id];

const out = await pool.query(inlineSql, inlineArgs); // Execute tenant-filtered inline index query.

await writeAoActAuthzAuditFactV0(pool, {
  event: "index_read",
  actor_id: auth.actor_id,
  token_id: auth.token_id,
  act_task_id: q.act_task_id
});

return reply.send({ ok: true, rows: out.rows, note: "tenant_filtered_inline" });

}

// 新流必须走本路由：action 执行主口径是 `/api/v1/actions/*`，并且禁止新代码依赖 legacy/deprecated route。
export function registerAoActV1Routes(app: FastifyInstance, pool: Pool): void {
  app.post("/api/v1/actions/task", async (req, reply) => handleAoActTaskV1(app, pool, req, reply, false));
  app.post("/api/v1/actions/task/from-variable-prescription", async (req, reply) => {
    try {
      const auth = requireAoActAnyScopeV0(req, reply, ["action.task.create", "ao_act.task.write"]);
      if (!auth) return;
      if (!requireActionTaskCreateRoleV1(reply, auth)) return;

      const body = z.object({
        tenant_id: z.string().min(1),
        project_id: z.string().min(1),
        group_id: z.string().min(1),
        prescription_id: z.string().min(1),
        approval_request_id: z.string().min(1),
        operation_plan_id: z.string().min(1),
        device_id: z.string().min(1),
      }).parse(req.body ?? {});

      const tenant = assertTenantFieldsPresentV0(body, "body");
      if (!requireTenantMatchOr404V0(auth, tenant, reply)) return;

      const prescription = await getPrescriptionById(pool, body.prescription_id, tenant);
      if (!prescription) return reply.status(404).send({ ok: false, error: "PRESCRIPTION_NOT_FOUND" });
      if (String((prescription as any)?.operation_amount?.mode ?? "").trim().toUpperCase() !== "VARIABLE_BY_ZONE") {
        return reply.status(400).send({ ok: false, error: "VARIABLE_PRESCRIPTION_MODE_REQUIRED" });
      }

      const approvalStatus = await loadLatestApprovalRequestStatusV0(pool, body.approval_request_id, tenant);
      if (approvalStatus !== "APPROVED") {
        return reply.status(403).send({ ok: false, error: "APPROVAL_REQUEST_NOT_APPROVED" });
      }

      const taskPayload = buildVariableActionTaskPayloadV1({
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        prescription,
        approval_request_id: body.approval_request_id,
        operation_plan_id: body.operation_plan_id,
        actor_id: auth.actor_id,
        device_id: body.device_id,
        now_ts_ms: Date.now(),
      });

      const authorization = String((req.headers as any).authorization ?? "");
      const delegated = await postJsonInternal(req, authorization, "/api/v1/actions/task", taskPayload);
      if (!delegated.ok || delegated.json?.ok !== true) {
        return reply.status(delegated.status || 400).send(delegated.json ?? { ok: false, error: "VARIABLE_ACTION_TASK_CREATE_FAILED" });
      }
      const actTaskId = String(delegated.json?.act_task_id ?? "").trim();
      if (!actTaskId) return reply.status(500).send({ ok: false, error: "VARIABLE_ACTION_TASK_ID_MISSING" });
      await recordSecurityAuditEventV1(pool, {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        ...auditContextFromRequestV1(req, auth),
        action: "action.variable_task_created",
        target_type: "act_task",
        target_id: actTaskId,
        field_id: String((prescription as any)?.field_id ?? "").trim() || undefined,
        result: "ALLOW",
        source: "api/v1/actions/task/from-variable-prescription",
        metadata: {
          prescription_id: body.prescription_id,
          approval_request_id: body.approval_request_id,
          operation_plan_id: body.operation_plan_id,
          device_id: body.device_id
        }
      });

      const operationPlanAnchor = await ensureVariableOperationPlanV1(pool, {
        tenant,
        operation_plan_id: body.operation_plan_id,
        act_command_id: actTaskId,
        prescription,
        approval_request_id: body.approval_request_id,
        actor_id: auth.actor_id,
        token_id: auth.token_id,
      });

      return reply.send({
        ok: true,
        act_task_id: actTaskId,
        task_fact_id: delegated.json?.fact_id ?? delegated.json?.task_fact_id ?? null,
        operation_plan_id: body.operation_plan_id,
        operation_plan_fact_id: operationPlanAnchor.operation_plan_fact_id,
        operation_plan_anchor_created: operationPlanAnchor.created,
        task_meta: delegated.json?.task_meta ?? delegated.json?.task?.meta ?? null,
      });
    } catch (e: any) {
      const code = String(e?.message ?? "BAD_REQUEST");
      if (
        code === "VARIABLE_PRESCRIPTION_ONLY_SUPPORTS_IRRIGATION" ||
        code === "VARIABLE_PRESCRIPTION_MODE_REQUIRED" ||
        code === "VARIABLE_PRESCRIPTION_ZONE_RATES_REQUIRED" ||
        code === "VARIABLE_RATE_DEVICE_REQUIREMENT_REQUIRED" ||
        code === "VARIABLE_PRESCRIPTION_AMOUNT_INVALID"
      ) {
        return reply.status(400).send({ ok: false, error: code });
      }
      return reply.status(400).send({ ok: false, error: code });
    }
  });
  app.post("/api/v1/actions/receipt", async (req, reply) => handleAoActReceiptV1(app, pool, req, reply, false));
  app.get("/api/v1/actions/index", async (req, reply) => handleAoActIndexV1(app, pool, req, reply, false));
  app.post("/api/v1/actions/execute", async (req, reply) => {
    try {
      const auth = requireAoActAnyScopeV0(req, reply, ["action.task.dispatch", "ao_act.task.write"]);
      if (!auth) return;
      const body = z.object({
        tenant_id: z.string().min(1),
        project_id: z.string().min(1),
        group_id: z.string().min(1),
        operation_id: z.string().min(1),
        execution_plan: z.object({
          action_type: z.string().min(1),
          target: z.object({ kind: z.enum(["field", "device"]), ref: z.string().min(1) }),
          parameters: z.record(z.any()),
          execution_mode: z.enum(["AUTO", "MANUAL"]),
          safe_guard: z.object({ requires_approval: z.boolean() }),
          failure_strategy: z.object({
            retryable: z.boolean(),
            max_retries: z.number().int().min(0).max(5),
            fallback_action: z.string().min(1).optional(),
          }),
          device_capability_check: z.object({
            supported: z.boolean(),
            reason: z.string().min(1).optional(),
          }).optional(),
          time_window: z.object({ start_ts: z.number().optional(), end_ts: z.number().optional() }).optional(),
          idempotency_key: z.string().min(1),
        }),
      }).parse(req.body ?? {});
      const tenant = assertTenantFieldsPresentV0(body, "body");
      if (!requireTenantMatchOr404V0(auth, tenant, reply)) return;
      const actionType = String(body.execution_plan.action_type ?? "").trim().toUpperCase();
      const executionKey = `${String(body.operation_id ?? "").trim()}_${actionType}`.replace(/[^a-zA-Z0-9_:-]/g, "_");
      const dedupeKey = String(body.execution_plan.idempotency_key ?? "").trim();
      if (!ACTION_EXECUTION_ALLOWLIST_V1.includes(actionType as any)) {
        return reply.status(400).send({ ok: false, error: "ACTION_TYPE_NOT_ALLOWED" });
      }
      if (!body.execution_plan.parameters || Object.keys(body.execution_plan.parameters).length < 1) {
        return reply.status(400).send({ ok: false, error: "MISSING_PARAMETERS" });
      }
      if (!body.execution_plan.target?.ref) {
        return reply.status(400).send({ ok: false, error: "INVALID_TARGET" });
      }
      if (body.execution_plan.safe_guard.requires_approval) {
        return reply.status(403).send({ ok: false, error: "REQUIRES_APPROVAL" });
      }
      const actionSkillProfile = ACTION_SKILL_PROFILE_V1[actionType];
      const requiresDeviceSkillResolution = body.execution_plan.target.kind === "device" || Boolean(actionSkillProfile);
      if (actionSkillProfile && body.execution_plan.target.kind !== "device") {
        return reply.status(400).send({ ok: false, error: "ACTION_REQUIRES_DEVICE_TARGET" });
      }
      const skillCapabilityResolution = requiresDeviceSkillResolution
        ? resolveTaskCapabilityViaDeviceSkillsResult({
          action_type: actionType,
          task_type: actionType,
          target: body.execution_plan.target,
          parameters: body.execution_plan.parameters,
          meta: {
            task_type: actionType,
            device_target: body.execution_plan.target.ref,
          }
        })
        : null;
      if (requiresDeviceSkillResolution && skillCapabilityResolution && !skillCapabilityResolution.ok) {
        const reasonSet = new Set((skillCapabilityResolution.error?.reasons ?? []).map((x) => String(x)));
        const unsupportedAction = reasonSet.has("no_skill_capability_match");
        return reply.status(400).send({
          ok: false,
          error: unsupportedAction ? "DEVICE_ACTION_TYPE_UNSUPPORTED" : "DEVICE_CAPABILITY_UNSUPPORTED",
          detail: skillCapabilityResolution.error
        });
      }
      const deviceActionValidation = validateDeviceActionRequirementsV1({
        action_type: actionType,
        execution_parameters: body.execution_plan.parameters,
        capability_resolution: skillCapabilityResolution
      });
      if (!deviceActionValidation.ok) {
        return reply.status(400).send(deviceActionValidation);
      }
      const expectedEvidenceRequirements = resolveExpectedEvidenceRequirementsV1(actionType, skillCapabilityResolution);
      const requiredCapabilities = actionType === "IRRIGATE" ? ["device.irrigation.valve.open"] : [];
      const bindingEvidence = await resolveDeviceSkillBindingForTask(pool, tenant, {
        action_type: actionType,
        device_type: "IRRIGATION_CONTROLLER",
        adapter_type: "irrigation_simulator",
        required_capabilities: requiredCapabilities,
      });
      const normalizedDeviceCapabilityCheck = body.execution_plan.device_capability_check ?? { supported: true as const };
      if (body.execution_plan.device_capability_check && !body.execution_plan.device_capability_check.supported) {
        return reply.status(400).send({ ok: false, error: body.execution_plan.device_capability_check.reason ?? "DEVICE_CAPABILITY_UNSUPPORTED" });
      }
      const dup = await pool.query(
        `SELECT record_json::jsonb AS record_json
           FROM facts
          WHERE (record_json::jsonb->>'type') IN ('action_execution_request_v1', 'action_execution_attempt_v1')
            AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
            AND (record_json::jsonb#>>'{payload,project_id}') = $2
            AND (record_json::jsonb#>>'{payload,group_id}') = $3
            AND (
              (record_json::jsonb#>>'{payload,dedupe_key}') = $4
              OR (record_json::jsonb#>>'{payload,idempotency_key}') = $4
            )
          ORDER BY occurred_at DESC
          LIMIT 1`,
        [tenant.tenant_id, tenant.project_id, tenant.group_id, dedupeKey]
      ).catch(() => ({ rows: [] as any[] }));
      const existingTaskId = String(dup.rows?.[0]?.record_json?.payload?.act_task_id ?? "").trim();
      if (existingTaskId) return reply.send({ ok: true, act_task_id: existingTaskId, idempotent: true });
      const attemptCountQ = await pool.query(
        `SELECT COUNT(*)::int AS cnt
         FROM facts
         WHERE (record_json::jsonb->>'type') IN ('action_execution_request_v1', 'action_execution_attempt_v1')
           AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
           AND (record_json::jsonb#>>'{payload,project_id}') = $2
           AND (record_json::jsonb#>>'{payload,group_id}') = $3
           AND (record_json::jsonb#>>'{payload,execution_key}') = $4`,
        [tenant.tenant_id, tenant.project_id, tenant.group_id, executionKey]
      ).catch(() => ({ rows: [{ cnt: 0 }] }));
      const attemptNo = Number(attemptCountQ.rows?.[0]?.cnt ?? 0) + 1;
      const isRetry = attemptNo > 1;
      const retryable = Boolean(body.execution_plan.failure_strategy?.retryable);
      const maxRetries = Number(body.execution_plan.failure_strategy?.max_retries ?? 0);
      const fallbackAction = String(body.execution_plan.failure_strategy.fallback_action ?? "CHECK_FIELD_STATUS").trim().toUpperCase();
      const fallbackPlan = {
        ...body.execution_plan,
        action_type: fallbackAction,
      };
      const fallbackState = {
        generated: false,
        executable: false,
        fallback_plan: undefined as any,
      };

      if (isRetry && !retryable) {
        fallbackState.generated = true;
        fallbackState.fallback_plan = fallbackPlan;
        await pool.query(
          "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
          [randomUUID(), "api/v1/actions/execute", {
            type: "action_execution_attempt_v1",
            payload: {
              tenant_id: tenant.tenant_id,
              project_id: tenant.project_id,
              group_id: tenant.group_id,
              operation_id: body.operation_id,
              act_task_id: null,
              execution_context: { execution_key: executionKey, dedupe_key: dedupeKey },
              attempt: {
                attempt_no: attemptNo,
                execution_key: executionKey,
                retry_of: executionKey,
                timestamp: Date.now(),
                result: "FAILED",
              },
              fallback_state: fallbackState,
            }
          }]
        );
        return reply.status(409).send({ ok: false, error: "RETRY_DISABLED", fallback_state: fallbackState });
      }
      if (isRetry && attemptNo >= maxRetries) {
        fallbackState.generated = true;
        fallbackState.fallback_plan = fallbackPlan;
        await pool.query(
          "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
          [randomUUID(), "api/v1/actions/execute", {
            type: "action_execution_attempt_v1",
            payload: {
              tenant_id: tenant.tenant_id,
              project_id: tenant.project_id,
              group_id: tenant.group_id,
              operation_id: body.operation_id,
              act_task_id: null,
              execution_context: { execution_key: executionKey, dedupe_key: dedupeKey },
              attempt: {
                attempt_no: attemptNo,
                execution_key: executionKey,
                retry_of: executionKey,
                timestamp: Date.now(),
                result: "FAILED",
              },
              fallback_state: fallbackState,
            }
          }]
        );
        return reply.status(409).send({ ok: false, error: "RETRY_LIMIT_REACHED", fallback_state: fallbackState, fallback_action: fallbackAction });
      }

      const act_task_id = `act_${randomUUID().replace(/-/g, "")}`;
      const now = Date.now();
      const aoTask = {
        type: "ao_act_task_v0",
        payload: {
          tenant_id: tenant.tenant_id,
          project_id: tenant.project_id,
          group_id: tenant.group_id,
          operation_plan_id: body.operation_id,
          approval_request_id: `direct_${body.execution_plan.idempotency_key}`,
          act_task_id,
          issuer: { kind: "human", id: auth.actor_id, namespace: "ao_act" },
          action_type: actionType,
          target: body.execution_plan.target,
          time_window: body.execution_plan.time_window ?? { start_ts: now, end_ts: now + 60 * 60 * 1000 },
          parameter_schema: { keys: Object.keys(body.execution_plan.parameters).map((k) => ({ name: k, type: "enum", enum: [String(body.execution_plan.parameters[k])] })) },
          parameters: body.execution_plan.parameters,
          constraints: {},
          created_at_ts: now,
          meta: {
            execution_mode: body.execution_plan.execution_mode,
            idempotency_key: dedupeKey,
            failure_strategy: body.execution_plan.failure_strategy,
            device_capability_check: normalizedDeviceCapabilityCheck,
            capability_resolution: skillCapabilityResolution?.ok
              ? skillCapabilityResolution.resolution
              : null,
            skill_binding_evidence: bindingEvidence,
            expected_evidence_requirements: expectedEvidenceRequirements,
            execution_context: {
              execution_key: executionKey,
              dedupe_key: dedupeKey,
            },
          },
        }
      };
      await pool.query(
        "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
        [randomUUID(), FACT_SOURCE_AO_ACT_V0, aoTask]
      );
      await pool.query(
        "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
        [randomUUID(), "api/v1/actions/execute", {
          type: "action_execution_request_v1",
          payload: {
            tenant_id: tenant.tenant_id,
            project_id: tenant.project_id,
            group_id: tenant.group_id,
            operation_id: body.operation_id,
            act_task_id,
            idempotency_key: dedupeKey,
            dedupe_key: dedupeKey,
            execution_key: executionKey,
            action_type: actionType,
            target: body.execution_plan.target,
            execution_context: {
              execution_key: executionKey,
              dedupe_key: dedupeKey,
            },
            attempt: {
              attempt_no: attemptNo,
              execution_key: executionKey,
              retry_of: isRetry ? executionKey : undefined,
              timestamp: Date.now(),
              result: "PENDING",
            },
            fallback_state: {
              generated: false,
              executable: false,
            },
            execution_trace: {
              execution_id: dedupeKey,
              task_id: act_task_id,
              status: "PENDING",
            },
          }
        }]
      );
      await pool.query(
        "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
        [randomUUID(), "api/v1/actions/execute", {
          type: "action_execution_attempt_v1",
          payload: {
            tenant_id: tenant.tenant_id,
            project_id: tenant.project_id,
            group_id: tenant.group_id,
            operation_id: body.operation_id,
            act_task_id,
            execution_key: executionKey,
            dedupe_key: dedupeKey,
            execution_context: {
              execution_key: executionKey,
              dedupe_key: dedupeKey,
            },
            attempt: {
              attempt_no: attemptNo,
              execution_key: executionKey,
              retry_of: isRetry ? executionKey : undefined,
              timestamp: Date.now(),
              result: "PENDING",
            },
            fallback_state: {
              generated: false,
              executable: false,
            }
          }
        }]
      );
      const executionSkillMeta = resolveDeviceExecutionSkillMeta(actionType);
      let runtimeSkillRun: { run_id: string; fact_id: string; occurred_at: string } | null = null;
      if (bindingEvidence?.device_skill_id === "mock_valve_control_skill_v1") {
        const relatedFieldId = body.execution_plan.target.kind === "field" ? String(body.execution_plan.target.ref) : null;
        const relatedDeviceId = body.execution_plan.target.kind === "device" ? String(body.execution_plan.target.ref) : null;
        runtimeSkillRun = await executeSkillRuntimeV1(pool, {
          tenant_id: tenant.tenant_id,
          project_id: tenant.project_id,
          group_id: tenant.group_id,
          skill_id: "mock_valve_control_skill_v1",
          version: "v1",
          category: "DEVICE",
          bind_target: "mock_valve",
          field_id: relatedFieldId,
          device_id: relatedDeviceId,
          operation_id: body.operation_id,
          operation_plan_id: body.operation_id,
          input: {
            task_id: act_task_id,
            approval_id: `direct_${body.execution_plan.idempotency_key}`,
            planned_amount: body.execution_plan.parameters?.planned_amount ?? 20,
            unit: body.execution_plan.parameters?.unit ?? "mm",
            duration_min: body.execution_plan.parameters?.duration_min ?? 20,
            required_capabilities: requiredCapabilities,
            skill_binding_fact_id: bindingEvidence.skill_binding_fact_id,
            device_skill_id: bindingEvidence.device_skill_id,
          },
        });
      } else if (executionSkillMeta) {
        const relatedFieldId = body.execution_plan.target.kind === "field" ? String(body.execution_plan.target.ref) : null;
        const relatedDeviceId = body.execution_plan.target.kind === "device" ? String(body.execution_plan.target.ref) : null;
        await appendSkillRunFact(pool, {
          tenant_id: tenant.tenant_id,
          project_id: tenant.project_id,
          group_id: tenant.group_id,
          skill_id: executionSkillMeta.skill_id,
          version: executionSkillMeta.version,
          category: "DEVICE",
          status: "ACTIVE",
          result_status: "SUCCESS",
          trigger_stage: "before_dispatch",
          scope_type: "DEVICE",
          rollout_mode: "DIRECT",
          bind_target: relatedDeviceId ?? relatedFieldId ?? body.operation_id,
          operation_id: body.operation_id,
          operation_plan_id: body.operation_id,
          field_id: relatedFieldId,
          device_id: relatedDeviceId,
          input_digest: digestJson({
            action_type: actionType,
            operation_id: body.operation_id,
            target: body.execution_plan.target,
            parameters: body.execution_plan.parameters,
            skill_binding_fact_id: bindingEvidence?.skill_binding_fact_id ?? null,
            device_skill_id: bindingEvidence?.device_skill_id ?? null,
          }),
          output_digest: digestJson({
            act_task_id,
            execution_key: executionKey,
            dedupe_key: dedupeKey,
            status: "PENDING",
          }),
          error_code: null,
          duration_ms: 0,
        });
      }
      return reply.send({
        ok: true,
        act_task_id,
        idempotent: false,
        expected_evidence_requirements: expectedEvidenceRequirements,
        capability_resolution: skillCapabilityResolution?.ok ? skillCapabilityResolution.resolution : null,
        skill_binding_fact_id: bindingEvidence?.skill_binding_fact_id ?? null,
        device_skill_id: bindingEvidence?.device_skill_id ?? null,
        skill_run_id: runtimeSkillRun?.run_id ?? null,
        skill_run_fact_id: runtimeSkillRun?.fact_id ?? null,
        skill_run_occurred_at: runtimeSkillRun?.occurred_at ?? null
      });
    } catch (e: any) {
      return reply.status(400).send({ ok: false, error: e?.message ?? "BAD_REQUEST" });
    }
  });

  // POST /api/v1/operations/manual
  // Manual operation bootstrap: operation_plan -> approval -> AO-ACT.
  app.post("/api/v1/operations/manual", async (req, reply) => {
    try {
      const auth = requireAoActAnyScopeV0(req, reply, ["action.task.dispatch", "ao_act.task.write"]);
      if (!auth) return;
      const body = z.object({
        tenant_id: z.string().min(1),
        project_id: z.string().min(1),
        group_id: z.string().min(1),
        field_id: z.string().min(1),
        device_id: z.string().min(1).optional(),
        action_type: z.string().min(1),
        adapter_type: z.string().min(1).optional(),
        parameters: z.record(z.union([z.number(), z.boolean(), z.string()])),
        issuer: z.object({
          kind: z.literal("human"),
          id: z.string().min(1),
          namespace: z.string().min(1)
        }),
        command_id: z.string().optional(),
        meta: z.record(z.any()).optional()
      }).parse(req.body ?? {});
      const command_id = String(body.command_id ?? "").trim();
      if (!command_id) return reply.status(400).send({ ok: false, error: "MISSING_COMMAND_ID" });
      const manualMeta = (body.meta && typeof body.meta === "object") ? { ...body.meta } : {};
      const metaAdapterType = typeof manualMeta.adapter_type === "string" ? manualMeta.adapter_type.trim() : "";
      const metaAdapterHint = typeof manualMeta.adapter_hint === "string" ? manualMeta.adapter_hint.trim() : "";
      const adapterTypeHint = metaAdapterType || metaAdapterHint;
      if (adapterTypeHint) {
        manualMeta.adapter_type = adapterTypeHint;
        manualMeta.adapter_hint = adapterTypeHint;
      }
      const tenant = assertTenantFieldsPresentV0(body, "body");
      if (!requireTenantMatchOr404V0(auth, tenant, reply)) return;
      const existing = await loadManualOperationByCommandId(pool, tenant, command_id);
      if (existing) return reply.send({ ok: true, ...existing, reused: true });

      const operation_id = `op_${randomUUID().replace(/-/g, "")}`;
      const now = Date.now();
      const parameterSchemaKeys = Object.entries(body.parameters ?? {}).map(([name, value]) => {
        if (typeof value === "number") return { name, type: "number" as const };
        if (typeof value === "boolean") return { name, type: "boolean" as const };
        return { name, type: "enum" as const, enum: [String(value)] };
      });
      if (parameterSchemaKeys.length < 1) return reply.status(400).send({ ok: false, error: "MISSING_PARAMETERS" });
      const manual_input = {
        parameters: body.parameters,
        meta: body.meta ?? {}
      };
      const approval_request_payload = {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        field_id: body.field_id,
        issuer: body.issuer,
        action_type: String(body.action_type).trim().toUpperCase(),
        target: { kind: "field", ref: body.field_id },
        time_window: { start_ts: now, end_ts: now + 60 * 60 * 1000 },
        parameter_schema: { keys: parameterSchemaKeys },
        parameters: body.parameters,
        constraints: {},
        adapter_type: adapterTypeHint || undefined,
        meta: {
          ...(body.meta ?? {}),
          device_id: body.device_id ?? (body.meta as any)?.device_id ?? null,
          adapter_type: body.adapter_type ?? (body.meta as any)?.adapter_type ?? null,
          operation_id,
          command_id
        }
      };
      console.debug("[AO_ACT_MANUAL_APPROVAL_DEBUG]", JSON.stringify({
        manual_input_parameters: manual_input.parameters,
        manual_input_meta: manual_input.meta,
        approval_request_payload_parameters: approval_request_payload.parameters,
        approval_request_payload_parameter_schema: approval_request_payload.parameter_schema
      }, null, 2));
      const approvalRequest = await postJsonInternal(
        req,
        String((req.headers as any).authorization ?? ""),
        "/api/v1/approvals",
        approval_request_payload
      );
      if (!approvalRequest.ok || !approvalRequest.json?.ok || !approvalRequest.json?.request_id) {
        return reply.status(approvalRequest.status || 400).send(approvalRequest.json ?? { ok: false, error: "APPROVAL_REQUEST_CREATE_FAILED" });
      }
      const request_id = String(approvalRequest.json.request_id);
      const approvalDecision = await postJsonInternal(
        req,
        String((req.headers as any).authorization ?? ""),
        `/api/v1/approvals/${encodeURIComponent(request_id)}/decide`,
        {
          tenant_id: tenant.tenant_id,
          project_id: tenant.project_id,
          group_id: tenant.group_id,
          decision: "APPROVE",
          reason: "manual_operation_auto_approve"
        }
      );
      if (!approvalDecision.ok || !approvalDecision.json?.ok) {
        return reply.status(approvalDecision.status || 400).send(approvalDecision.json ?? { ok: false, error: "APPROVAL_DECISION_FAILED" });
      }
      const operation_plan_id = String(approvalDecision.json.operation_plan_id ?? "").trim();
      if (!operation_plan_id) return reply.status(500).send({ ok: false, error: "MISSING_OPERATION_PLAN_ID" });
      return reply.send({
        ok: true,
        operation_id,
        operation_plan_id,
        command_id
      });
    } catch (e: any) {
      return reply.status(400).send({ ok: false, error: e?.message ?? "BAD_REQUEST" });
    }
  });

}

// 兼容层仅用于存量迁移，禁止新代码依赖 legacy/deprecated route。
export function registerAoActLegacyRoutes(app: FastifyInstance, pool: Pool): void {
  // @deprecated - use /api/v1/*
  app.post("/api/control/ao_act/task", async (req, reply) => handleAoActTaskV1(app, pool, req, reply, true));
  // @deprecated - use /api/v1/*
  app.post("/api/control/ao_act/receipt", async (req, reply) => handleAoActReceiptV1(app, pool, req, reply, true));
  // @deprecated - use /api/v1/*
  app.get("/api/control/ao_act/index", async (req, reply) => handleAoActIndexV1(app, pool, req, reply, true));
}

// @deprecated - compatibility-only combined registrar; prefer explicit v1/legacy registration from server.ts.
// 新流必须走 `registerAoActV1Routes`，本组合注册器仅为兼容用途，禁止新代码依赖 legacy/deprecated route。
export function registerControlAoActRoutes(app: FastifyInstance, pool: Pool): void {
  registerAoActV1Routes(app, pool);
  registerAoActLegacyRoutes(app, pool);
}
