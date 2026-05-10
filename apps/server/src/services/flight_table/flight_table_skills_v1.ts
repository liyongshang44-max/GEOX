import crypto from "node:crypto";
import type { Pool } from "pg";

import type { AoActAuthContextV0 } from "../../auth/ao_act_authz_v0.js";
import { appendSkillBinding, getSkillBindingProjection } from "../skills/skill_binding_service.js";
import type { FlightTableRunV1 } from "./flight_table_manifest_v1.js";

export type FlightTableSkillClassificationV1 = "sensing" | "agronomy" | "device" | "acceptance";
export type FlightTableSkillFailureTypeV1 = "missing_sensing_skill" | "device_skill_disabled" | "acceptance_skill_failed";

export type FlightTableSkillRequirementV1 = {
  skill_id: string;
  version: string;
  classification: FlightTableSkillClassificationV1;
  bind_target: string;
  scope_type: "TENANT" | "FIELD" | "DEVICE" | "OPERATION";
  trigger_stage: string;
  required_for: string;
};

export type FlightTableSkillAssemblyItemV1 = FlightTableSkillRequirementV1 & {
  binding_id: string;
  status: "ACTIVE" | "DISABLED" | "MISSING" | "FAILED";
  binding_scope: string;
  missing_reason: string | null;
  source: "FORMAL_SKILL_BINDING" | "DEV_FAILURE_INJECTION";
};

export type FlightTableSkillAssemblyResponseV1 = {
  ok: true;
  operation_id: string;
  items: FlightTableSkillAssemblyItemV1[];
  binding_ids: string[];
  skill_run_ids: string[];
  missing_required_observation_skills: string[];
  failure?: {
    failure_type: FlightTableSkillFailureTypeV1;
    failure_reason: "binding_invalid" | "skill_run_failed" | "missing_required_observation_skill";
    failed_skill_id: string;
    trace_visible: boolean;
    performance_visible: boolean;
  };
  verify: {
    bindings_visible: boolean;
    trace_visible: boolean;
    performance_visible: boolean;
    operator_trace_url: string;
    operator_performance_url: string;
  };
};

function sha256Hex(seed: string): string {
  return crypto.createHash("sha256").update(seed, "utf8").digest("hex");
}

function nowIso(ms = Date.now()): string {
  return new Date(ms).toISOString();
}

function safeId(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const s = input.trim();
  if (!/^[A-Za-z0-9_.:-]{1,160}$/.test(s)) return null;
  return s;
}

function tenant(run: FlightTableRunV1, auth: AoActAuthContextV0) {
  if (run.tenant_id !== auth.tenant_id || run.project_id !== auth.project_id || run.group_id !== auth.group_id) {
    throw new Error("FLIGHT_TABLE_SCOPE_MISMATCH");
  }
  return { tenant_id: auth.tenant_id, project_id: auth.project_id, group_id: auth.group_id };
}

function operationIdForRun(run: FlightTableRunV1): string {
  return run.manifest.operation_plan_ids[0] ?? `ft_op_${run.run_id}_skills`;
}

function deviceTypeFromSkill(skill: FlightTableSkillRequirementV1): string | null {
  if (skill.classification === "device") return "IRRIGATION_CONTROLLER";
  if (skill.classification === "sensing") return "SOIL_PROBE";
  return null;
}

export function buildFlightTableSkillRequirementsV1(run: FlightTableRunV1): FlightTableSkillRequirementV1[] {
  const fieldTarget = run.manifest.field_id ?? "default";
  const deviceTarget = run.manifest.device_ids[0] ?? "default_device";
  return [
    {
      skill_id: "sensor_quality_inference_v1",
      version: "v1",
      classification: "sensing",
      bind_target: deviceTarget,
      scope_type: "DEVICE",
      trigger_stage: "before_recommendation",
      required_for: "observation_quality_gate",
    },
    {
      skill_id: "irrigation_recommendation_skill_v1",
      version: "v1",
      classification: "agronomy",
      bind_target: fieldTarget,
      scope_type: "FIELD",
      trigger_stage: "recommendation",
      required_for: "irrigation_decision",
    },
    {
      skill_id: "mock_valve_control_skill_v1",
      version: "v1",
      classification: "device",
      bind_target: deviceTarget,
      scope_type: "DEVICE",
      trigger_stage: "dispatch",
      required_for: "device_execution",
    },
    {
      skill_id: "acceptance_verdict_skill_v1",
      version: "v1",
      classification: "acceptance",
      bind_target: fieldTarget,
      scope_type: "FIELD",
      trigger_stage: "acceptance",
      required_for: "result_acceptance",
    },
  ];
}

async function ensureFieldMemoryRuntime(pool: Pool): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS field_memory_v1 (
    tenant_id TEXT NOT NULL,
    field_id TEXT NOT NULL,
    operation_id TEXT NOT NULL,
    memory_id TEXT NOT NULL,
    memory_type TEXT NOT NULL,
    summary TEXT NULL,
    evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, memory_id)
  )`);
  await pool.query(`ALTER TABLE field_memory_v1
    ADD COLUMN IF NOT EXISTS project_id TEXT NOT NULL DEFAULT 'projectA',
    ADD COLUMN IF NOT EXISTS group_id TEXT NOT NULL DEFAULT 'groupA',
    ADD COLUMN IF NOT EXISTS season_id TEXT,
    ADD COLUMN IF NOT EXISTS crop_id TEXT,
    ADD COLUMN IF NOT EXISTS metric_key TEXT,
    ADD COLUMN IF NOT EXISTS metric_value NUMERIC,
    ADD COLUMN IF NOT EXISTS metric_unit TEXT,
    ADD COLUMN IF NOT EXISTS before_value NUMERIC,
    ADD COLUMN IF NOT EXISTS after_value NUMERIC,
    ADD COLUMN IF NOT EXISTS baseline_value NUMERIC,
    ADD COLUMN IF NOT EXISTS delta_value NUMERIC,
    ADD COLUMN IF NOT EXISTS target_range JSONB,
    ADD COLUMN IF NOT EXISTS confidence NUMERIC NOT NULL DEFAULT 0.8,
    ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'flight_table',
    ADD COLUMN IF NOT EXISTS source_id TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS task_id TEXT,
    ADD COLUMN IF NOT EXISTS acceptance_id TEXT,
    ADD COLUMN IF NOT EXISTS roi_id TEXT,
    ADD COLUMN IF NOT EXISTS skill_id TEXT,
    ADD COLUMN IF NOT EXISTS skill_trace_ref TEXT,
    ADD COLUMN IF NOT EXISTS summary_text TEXT,
    ADD COLUMN IF NOT EXISTS weather_interference_detected BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS learning_excluded_reason TEXT,
    ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()`);
}

async function verifyOperatorSkillViews(pool: Pool, run: FlightTableRunV1, operation_id: string): Promise<{ trace_visible: boolean; performance_visible: boolean }> {
  const traceQ = await pool.query(
    `SELECT COUNT(*)::int AS count
       FROM facts
      WHERE (record_json::jsonb->>'type') IN ('skill_run_v1','skill_trace_v1')
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND (record_json::jsonb#>>'{payload,project_id}') = $2
        AND (record_json::jsonb#>>'{payload,group_id}') = $3
        AND (record_json::jsonb#>>'{payload,operation_id}') = $4`,
    [run.tenant_id, run.project_id, run.group_id, operation_id],
  ).catch(() => ({ rows: [{ count: 0 }] } as any));
  const perfQ = await pool.query(
    `SELECT COUNT(*)::int AS count
       FROM field_memory_v1
      WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3
        AND operation_id = $4 AND memory_type = 'SKILL_PERFORMANCE_MEMORY'`,
    [run.tenant_id, run.project_id, run.group_id, operation_id],
  ).catch(() => ({ rows: [{ count: 0 }] } as any));
  return { trace_visible: Number(traceQ.rows?.[0]?.count ?? 0) > 0, performance_visible: Number(perfQ.rows?.[0]?.count ?? 0) > 0 };
}

function classificationToCategory(c: FlightTableSkillClassificationV1): string {
  if (c === "sensing") return "SENSING";
  if (c === "device") return "DEVICE";
  if (c === "acceptance") return "ACCEPTANCE";
  return "AGRONOMY";
}

async function writeSkillTraceAndPerformance(pool: Pool, run: FlightTableRunV1, input: {
  operation_id: string;
  skill: FlightTableSkillRequirementV1;
  status: "SUCCESS" | "FAILED";
  failure_reason?: string | null;
  run_id?: string;
}): Promise<{ skill_run_id: string }> {
  await ensureFieldMemoryRuntime(pool);
  const ts = Date.now();
  const skill_run_id = input.run_id ?? `ft_skill_run_${sha256Hex(`${run.run_id}|${input.operation_id}|${input.skill.skill_id}|${input.status}|${ts}`).slice(0, 18)}`;
  const fact_id = `ft_skill_trace_${sha256Hex(`${skill_run_id}|${ts}`)}`;
  const payload = {
    tenant_id: run.tenant_id,
    project_id: run.project_id,
    group_id: run.group_id,
    field_id: run.manifest.field_id,
    operation_id: input.operation_id,
    skill_id: input.skill.skill_id,
    version: input.skill.version,
    skill_version: input.skill.version,
    skill_category: classificationToCategory(input.skill.classification),
    category: classificationToCategory(input.skill.classification),
    binding_scope: `${input.skill.scope_type}:${input.skill.bind_target}`,
    bind_target: input.skill.bind_target,
    trigger_stage: input.skill.trigger_stage,
    status: input.status,
    result_status: input.status,
    failure_reason: input.failure_reason ?? null,
    error_code: input.failure_reason ?? null,
    trace_id: skill_run_id,
    run_id: skill_run_id,
    input_digest: `flight-table ${input.skill.required_for}`,
    output_digest: input.status === "FAILED" ? "skill failure injected by FT-D" : "skill binding verified by FT-D",
    evidence_refs: [],
    skill_trace: {
      trace_id: skill_run_id,
      skill_id: input.skill.skill_id,
      skill_category: classificationToCategory(input.skill.classification),
      result_status: input.status,
      error_code: input.failure_reason ?? null,
    },
  };
  await pool.query(
    `INSERT INTO facts (fact_id, occurred_at, source, record_json)
     VALUES ($1, $2::timestamptz, 'flight_table', $3::jsonb)
     ON CONFLICT (fact_id) DO NOTHING`,
    [fact_id, nowIso(ts), JSON.stringify({ type: "skill_run_v1", schema_version: 1, occurred_at: nowIso(ts), payload })],
  );
  const memory_id = `ft_skill_perf_${sha256Hex(`${skill_run_id}|${input.status}`).slice(0, 20)}`;
  await pool.query(
    `INSERT INTO field_memory_v1 (
       tenant_id, project_id, group_id, field_id, operation_id, memory_id, memory_type,
       metric_key, metric_value, confidence, source_type, source_id,
       skill_id, skill_trace_ref, summary, summary_text, delta_value,
       learning_excluded_reason, occurred_at, created_at, evidence_refs
     ) VALUES ($1,$2,$3,$4,$5,$6,'SKILL_PERFORMANCE_MEMORY',$7,$8,$9,'flight_table_skill_assembly',$10,$11,$12,$13,$13,$14,$15,$16::timestamptz,$16::timestamptz,'[]'::jsonb)
     ON CONFLICT (tenant_id, memory_id) DO UPDATE SET
       metric_value = EXCLUDED.metric_value,
       confidence = EXCLUDED.confidence,
       summary_text = EXCLUDED.summary_text,
       delta_value = EXCLUDED.delta_value,
       learning_excluded_reason = EXCLUDED.learning_excluded_reason,
       occurred_at = EXCLUDED.occurred_at,
       created_at = EXCLUDED.created_at`,
    [
      run.tenant_id,
      run.project_id,
      run.group_id,
      run.manifest.field_id ?? "",
      input.operation_id,
      memory_id,
      input.status === "FAILED" ? "skill_failure" : "skill_success",
      input.status === "FAILED" ? 0 : 1,
      input.status === "FAILED" ? 0.45 : 0.95,
      skill_run_id,
      input.skill.skill_id,
      skill_run_id,
      input.status === "FAILED" ? `技能失败：${input.failure_reason ?? 'unknown'}` : "技能绑定验证通过",
      input.status === "FAILED" ? -1 : 1,
      input.status === "FAILED" ? input.failure_reason ?? "skill_run_failed" : null,
      nowIso(ts),
    ],
  );
  return { skill_run_id };
}

export async function bindFlightTableSkillsV1(pool: Pool, run: FlightTableRunV1, auth: AoActAuthContextV0): Promise<FlightTableSkillAssemblyResponseV1> {
  const t = tenant(run, auth);
  const operation_id = operationIdForRun(run);
  const requirements = buildFlightTableSkillRequirementsV1(run);
  const items: FlightTableSkillAssemblyItemV1[] = [];
  const binding_ids: string[] = [];
  const skill_run_ids: string[] = [];
  for (const skill of requirements) {
    const binding_id = `ft_bind_${sha256Hex(`${run.run_id}|${skill.skill_id}|${skill.bind_target}`).slice(0, 18)}`;
    const inserted = await appendSkillBinding(pool, {
      ...t,
      binding_id,
      skill_id: skill.skill_id,
      version: skill.version,
      category: classificationToCategory(skill.classification),
      bind_target: skill.bind_target,
      scope_type: skill.scope_type,
      trigger_stage: skill.trigger_stage,
      rollout_mode: "DIRECT",
      enabled: true,
      priority: 50,
      device_type: deviceTypeFromSkill(skill),
      config_patch: { run_id: run.run_id, required_for: skill.required_for, classification: skill.classification },
    });
    binding_ids.push(String((inserted.payload as any)?.binding_id ?? binding_id));
    const trace = await writeSkillTraceAndPerformance(pool, run, { operation_id, skill, status: "SUCCESS" });
    skill_run_ids.push(trace.skill_run_id);
    items.push({
      ...skill,
      binding_id: String((inserted.payload as any)?.binding_id ?? binding_id),
      status: "ACTIVE",
      binding_scope: `${skill.scope_type}:${skill.bind_target}`,
      missing_reason: null,
      source: "FORMAL_SKILL_BINDING",
    });
  }
  const projection = await getSkillBindingProjection(pool, t, { status: "ACTIVE" });
  const projectedIds = new Set([...(projection.items_effective ?? []), ...(projection.items_history ?? [])].map((item: any) => String(item.binding_id ?? "")).filter(Boolean));
  const views = await verifyOperatorSkillViews(pool, run, operation_id);
  return {
    ok: true,
    operation_id,
    items: items.map((item) => projectedIds.has(item.binding_id) ? item : { ...item, status: "MISSING", missing_reason: "binding_projection_not_visible" }),
    binding_ids,
    skill_run_ids,
    missing_required_observation_skills: [],
    verify: {
      bindings_visible: binding_ids.some((id) => projectedIds.has(id)),
      trace_visible: views.trace_visible,
      performance_visible: views.performance_visible,
      operator_trace_url: `/operator/skill-traces?operation_id=${encodeURIComponent(operation_id)}`,
      operator_performance_url: `/operator/skill-performance?operation_id=${encodeURIComponent(operation_id)}`,
    },
  };
}

function failureSelection(type: FlightTableSkillFailureTypeV1, requirements: FlightTableSkillRequirementV1[]): { skill: FlightTableSkillRequirementV1; reason: "binding_invalid" | "skill_run_failed" | "missing_required_observation_skill" } {
  if (type === "missing_sensing_skill") {
    return { skill: requirements.find((s) => s.classification === "sensing") ?? requirements[0], reason: "missing_required_observation_skill" };
  }
  if (type === "device_skill_disabled") {
    return { skill: requirements.find((s) => s.classification === "device") ?? requirements[0], reason: "binding_invalid" };
  }
  return { skill: requirements.find((s) => s.classification === "acceptance") ?? requirements[0], reason: "skill_run_failed" };
}

export async function failOneFlightTableSkillV1(pool: Pool, run: FlightTableRunV1, auth: AoActAuthContextV0, rawType?: unknown): Promise<FlightTableSkillAssemblyResponseV1> {
  const t = tenant(run, auth);
  const failure_type: FlightTableSkillFailureTypeV1 = rawType === "device_skill_disabled" || rawType === "acceptance_skill_failed" ? rawType : "missing_sensing_skill";
  const operation_id = operationIdForRun(run);
  const base = await bindFlightTableSkillsV1(pool, run, auth);
  const requirements = buildFlightTableSkillRequirementsV1(run);
  const selected = failureSelection(failure_type, requirements);
  if (selected.reason === "binding_invalid") {
    await appendSkillBinding(pool, {
      ...t,
      binding_id: `ft_override_disable_${sha256Hex(`${run.run_id}|${selected.skill.skill_id}`).slice(0, 16)}`,
      skill_id: selected.skill.skill_id,
      version: selected.skill.version,
      category: classificationToCategory(selected.skill.classification),
      bind_target: selected.skill.bind_target,
      scope_type: selected.skill.scope_type,
      trigger_stage: selected.skill.trigger_stage,
      rollout_mode: "DIRECT",
      enabled: false,
      priority: 99,
      device_type: deviceTypeFromSkill(selected.skill),
      config_patch: { run_id: run.run_id, injected_failure: failure_type, reason: selected.reason },
    });
  }
  const failedRun = await writeSkillTraceAndPerformance(pool, run, {
    operation_id,
    skill: selected.skill,
    status: "FAILED",
    failure_reason: selected.reason,
  });
  const views = await verifyOperatorSkillViews(pool, run, operation_id);
  const failedItem: FlightTableSkillAssemblyItemV1 = {
    ...selected.skill,
    binding_id: `ft_failure_${selected.skill.skill_id}`,
    status: "FAILED",
    binding_scope: `${selected.skill.scope_type}:${selected.skill.bind_target}`,
    missing_reason: selected.reason,
    source: "DEV_FAILURE_INJECTION",
  };
  const missing = selected.reason === "missing_required_observation_skill" ? [selected.skill.skill_id] : [];
  return {
    ...base,
    items: [failedItem, ...base.items.filter((item) => item.skill_id !== selected.skill.skill_id)],
    skill_run_ids: [...base.skill_run_ids, failedRun.skill_run_id],
    missing_required_observation_skills: missing,
    failure: {
      failure_type,
      failure_reason: selected.reason,
      failed_skill_id: selected.skill.skill_id,
      trace_visible: views.trace_visible,
      performance_visible: views.performance_visible,
    },
    verify: {
      ...base.verify,
      trace_visible: views.trace_visible,
      performance_visible: views.performance_visible,
    },
  };
}

export async function restoreFlightTableSkillsV1(pool: Pool, run: FlightTableRunV1, auth: AoActAuthContextV0): Promise<FlightTableSkillAssemblyResponseV1> {
  const response = await bindFlightTableSkillsV1(pool, run, auth);
  return {
    ...response,
    items: response.items.map((item) => ({ ...item, status: "ACTIVE", missing_reason: null })),
    missing_required_observation_skills: [],
  };
}

export async function verifyFlightTableSkillAssemblyV1(pool: Pool, run: FlightTableRunV1): Promise<{ trace_visible: boolean; performance_visible: boolean; operation_id: string }> {
  const operation_id = operationIdForRun(run);
  const views = await verifyOperatorSkillViews(pool, run, operation_id);
  return { operation_id, ...views };
}
