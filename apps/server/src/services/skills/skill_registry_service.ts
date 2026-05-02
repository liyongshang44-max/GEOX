import type { Pool } from "pg";

import { appendSkillDefinitionFact, type SkillDefinitionFactPayload } from "../../domain/skill_registry/facts.js";
import { projectSkillRegistryReadV1, querySkillRegistryReadV1 } from "../../projections/skill_registry_read_v1.js";
import type { TenantTriple } from "./skill_trace_service.js";

type SkillRow = {
  fact_type: string;
  fact_id: string;
  skill_id: string;
  version: string;
  category: string | null;
  legacy_category: string | null;
  status: string | null;
  scope_type: string | null;
  rollout_mode: string | null;
  result_status: string | null;
  crop_code: string | null;
  device_type: string | null;
  trigger_stage: string | null;
  bind_target: string | null;
  operation_id: string | null;
  field_id: string | null;
  device_id: string | null;
  lifecycle_version: number | null;
  payload_json: any;
  occurred_at: string;
  updated_at_ts_ms: number;
};

export async function listSkills(pool: Pool, tenant: TenantTriple, filters: Record<string, unknown>) {
  await projectSkillRegistryReadV1(pool, tenant);
  const rows = await querySkillRegistryReadV1(pool, {
    ...tenant,
    category: typeof filters.category === "string" ? filters.category : undefined,
    status: typeof filters.status === "string" ? filters.status : undefined,
    crop_code: typeof filters.crop_code === "string" ? filters.crop_code : undefined,
    device_type: typeof filters.device_type === "string" ? filters.device_type : undefined,
    trigger_stage: typeof filters.trigger_stage === "string" ? filters.trigger_stage : undefined,
    bind_target: typeof filters.bind_target === "string" ? filters.bind_target : undefined,
    fact_type: "skill_definition_v1",
  });
  const bindingRows = await querySkillRegistryReadV1(pool, {
    ...tenant,
    crop_code: typeof filters.crop_code === "string" ? filters.crop_code : undefined,
    bind_target: typeof filters.bind_target === "string" ? filters.bind_target : undefined,
    fact_type: "skill_binding_v1",
  });

  const bindingMap = new Map<string, string>();
  for (const row of bindingRows) {
    const key = `${row.skill_id}::${row.version}`;
    if (!bindingMap.has(key)) bindingMap.set(key, String(row.status ?? "DISABLED").toUpperCase());
  }

  return (rows ?? []).map((row) => ({
    skill_id: row.skill_id,
    version: row.version,
    display_name: String(row.payload_json?.display_name ?? row.skill_id),
    category: row.category ?? "unknown",
    legacy_category: row.legacy_category,
    skill_type: row.category ?? "unknown",
    status: row.status,
    trigger_stage: row.trigger_stage,
    scope_type: row.scope_type,
    rollout_mode: row.rollout_mode,
    crop_code: row.crop_code,
    device_type: row.device_type,
    binding_status: bindingMap.get(`${row.skill_id}::${row.version}`) ?? "UNBOUND",
    updated_at: row.occurred_at,
  }));
}

export async function getSkillDetail(pool: Pool, tenant: TenantTriple, skill_id: string) {
  await projectSkillRegistryReadV1(pool, tenant);
  const readRows = await pool.query<SkillRow>(
    `SELECT *
       FROM skill_registry_read_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND skill_id = $4
      ORDER BY updated_at_ts_ms DESC
      LIMIT 500`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, skill_id],
  );

  const rows = readRows.rows ?? [];
  if (!rows.length) return null;

  const defs = rows.filter((r) => r.fact_type === "skill_definition_v1");
  const bindings = rows.filter((r) => r.fact_type === "skill_binding_v1");
  const runs = rows.filter((r) => r.fact_type === "skill_run_v1");
  const latestDef = defs[0] ?? rows[0];
  const activeVersion = defs.find((d) => String(d.status ?? "").toUpperCase() === "ACTIVE")?.version ?? latestDef.version;
  const latestRuns = runs.slice(0, 20);

  const definition = latestDef.payload_json ?? {};
  return {
    skill_id,
    skill_version: String(definition.skill_version ?? definition.version ?? latestDef.version ?? "v1"),
    skill_category: String(definition.skill_category ?? definition.category ?? latestDef.category ?? "unknown").toLowerCase(),
    risk_level: definition.risk_level ?? null,
    capabilities: Array.isArray(definition.capabilities) ? definition.capabilities : [],
    required_evidence: Array.isArray(definition.required_evidence) ? definition.required_evidence : [],
    binding_conditions: definition.binding_conditions ?? {},
    fallback_policy: definition.fallback_policy ?? {},
    audit_policy: definition.audit_policy ?? {},
    enabled: typeof definition.enabled === "boolean" ? definition.enabled : String(latestDef.status ?? "").toUpperCase() === "ACTIVE",
    definition,
    current_enabled_version: activeVersion,
    compatibility: {
      crop_code: latestDef.crop_code,
      device_type: latestDef.device_type,
      trigger_stage: latestDef.trigger_stage,
      scope_type: latestDef.scope_type,
      bind_targets: Array.from(new Set(bindings.map((x) => x.bind_target).filter(Boolean))),
    },
    default_config: latestDef.payload_json?.default_config ?? {},
    recent_run_summary: {
      total: latestRuns.length,
      success: latestRuns.filter((r) => String(r.result_status ?? "").toUpperCase() === "SUCCESS").length,
      failed: latestRuns.filter((r) => String(r.result_status ?? "").toUpperCase() === "FAILED").length,
      timeout: latestRuns.filter((r) => String(r.result_status ?? "").toUpperCase() === "TIMEOUT").length,
      latest_at: latestRuns[0]?.occurred_at ?? null,
    },
  };
}

export async function updateSkillStatus(pool: Pool, tenant: TenantTriple, skill_id: string, status: "ACTIVE" | "DISABLED") {
  await projectSkillRegistryReadV1(pool, tenant);
  const latestQ = await pool.query<SkillRow>(
    `SELECT * FROM skill_registry_read_v1
     WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3
       AND fact_type = 'skill_definition_v1'
       AND skill_id = $4
     ORDER BY updated_at_ts_ms DESC LIMIT 1`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, skill_id],
  );
  const latest = latestQ.rows?.[0];
  if (!latest) return null;

  const payload = latest.payload_json as SkillDefinitionFactPayload;
  return appendSkillDefinitionFact(pool, { ...payload, status });
}
