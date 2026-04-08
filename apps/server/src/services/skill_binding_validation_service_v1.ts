import type { Pool, PoolClient } from "pg";

import { resolveDeviceTemplateV1, type DeviceTemplateSkillBindingV1 } from "../domain/device_templates/device_templates_v1";
import { appendSkillBindingFact } from "../domain/skill_registry/facts";

type TenantTriple = {
  tenant_id: string;
  project_id: string;
  group_id: string;
};

type DeviceSkillBindingFactRow = {
  skill_id: string;
  version: string;
  status: string;
};

function skillKey(skill: Pick<DeviceTemplateSkillBindingV1, "skill_id" | "version">): string {
  return `${String(skill.skill_id).trim()}::${String(skill.version).trim()}`;
}

async function listLatestDeviceSkillBindingRows(
  db: Pool | PoolClient,
  tenant: TenantTriple,
  device_id: string
): Promise<DeviceSkillBindingFactRow[]> {
  const q = await db.query(
    `SELECT
       (record_json::jsonb #>> '{payload,skill_id}') AS skill_id,
       (record_json::jsonb #>> '{payload,version}') AS version,
       UPPER(COALESCE((record_json::jsonb #>> '{payload,status}'), 'ACTIVE')) AS status,
       occurred_at
     FROM facts
     WHERE (record_json::jsonb ->> 'type') = 'skill_binding_v1'
       AND (record_json::jsonb #>> '{payload,tenant_id}') = $1
       AND (record_json::jsonb #>> '{payload,project_id}') = $2
       AND (record_json::jsonb #>> '{payload,group_id}') = $3
       AND UPPER(COALESCE((record_json::jsonb #>> '{payload,scope_type}'), '')) = 'DEVICE'
       AND (record_json::jsonb #>> '{payload,bind_target}') = $4
     ORDER BY occurred_at DESC`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, device_id]
  );

  const latest = new Map<string, DeviceSkillBindingFactRow>();
  for (const row of q.rows ?? []) {
    const skill_id = String(row.skill_id ?? "").trim();
    const version = String(row.version ?? "").trim();
    if (!skill_id || !version) continue;
    const key = `${skill_id}::${version}`;
    if (latest.has(key)) continue;
    latest.set(key, {
      skill_id,
      version,
      status: String(row.status ?? "ACTIVE").toUpperCase(),
    });
  }
  return [...latest.values()];
}

export async function ensureDeviceSkillBindingStatusRuntimeV1(db: Pool | PoolClient): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS device_skill_binding_status_v1 (
      tenant_id text NOT NULL,
      project_id text NOT NULL,
      group_id text NOT NULL,
      device_id text NOT NULL,
      binding_status text NOT NULL,
      missing_required_observation_skills_json jsonb NOT NULL DEFAULT '[]'::jsonb,
      updated_ts_ms bigint NOT NULL,
      PRIMARY KEY (tenant_id, project_id, group_id, device_id)
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_device_skill_binding_status_v1_scope_status
      ON device_skill_binding_status_v1 (tenant_id, project_id, group_id, binding_status, updated_ts_ms DESC)
  `);
}

export async function validateDeviceRequiredObservationSkillBindingsV1(
  db: Pool | PoolClient,
  input: TenantTriple & { device_id: string; template_id?: string | null }
): Promise<{ binding_status: "binding_valid" | "binding_invalid"; missing_required_observation_skills: string[] }> {
  await ensureDeviceSkillBindingStatusRuntimeV1(db);

  const template = resolveDeviceTemplateV1(input.template_id);
  const existingRows = await listLatestDeviceSkillBindingRows(db, input, input.device_id);
  const activeSkillKeys = new Set(existingRows.filter((x) => x.status === "ACTIVE").map((x) => `${x.skill_id}::${x.version}`));

  const missingRequired = template.required_observation_skills
    .filter((skill) => !activeSkillKeys.has(skillKey(skill)))
    .map((skill) => `${skill.skill_id}@${skill.version}`);

  const binding_status = missingRequired.length > 0 ? "binding_invalid" : "binding_valid";
  const updated_ts_ms = Date.now();

  await db.query(
    `INSERT INTO device_skill_binding_status_v1 (
        tenant_id, project_id, group_id, device_id, binding_status,
        missing_required_observation_skills_json, updated_ts_ms
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
      ON CONFLICT (tenant_id, project_id, group_id, device_id)
      DO UPDATE SET
        binding_status = EXCLUDED.binding_status,
        missing_required_observation_skills_json = EXCLUDED.missing_required_observation_skills_json,
        updated_ts_ms = EXCLUDED.updated_ts_ms`,
    [
      input.tenant_id,
      input.project_id,
      input.group_id,
      input.device_id,
      binding_status,
      JSON.stringify(missingRequired),
      updated_ts_ms,
    ]
  );

  return { binding_status, missing_required_observation_skills: missingRequired };
}

export async function reconcileDeviceTemplateSkillBindingsV1(
  db: Pool | PoolClient,
  input: TenantTriple & {
    device_id: string;
    template_id?: string | null;
    missing_required_mode?: "fail" | "autofill";
  }
): Promise<{ auto_bound_required_observation_skills: string[]; auto_bound_default_inference_skills: string[]; binding_status: "binding_valid" | "binding_invalid" }> {
  const template = resolveDeviceTemplateV1(input.template_id);
  const mode = input.missing_required_mode ?? "autofill";

  const existingRows = await listLatestDeviceSkillBindingRows(db, input, input.device_id);
  const activeSkillKeys = new Set(existingRows.filter((x) => x.status === "ACTIVE").map((x) => `${x.skill_id}::${x.version}`));

  const missingRequiredSkills = template.required_observation_skills.filter((skill) => !activeSkillKeys.has(skillKey(skill)));
  if (mode === "fail" && missingRequiredSkills.length > 0) {
    throw new Error(`MISSING_REQUIRED_OBSERVATION_SKILLS:${missingRequiredSkills.map((x) => `${x.skill_id}@${x.version}`).join(",")}`);
  }

  const auto_bound_required_observation_skills: string[] = [];
  for (const skill of missingRequiredSkills) {
    await appendSkillBindingFact(db, {
      tenant_id: input.tenant_id,
      project_id: input.project_id,
      group_id: input.group_id,
      skill_id: skill.skill_id,
      version: skill.version,
      category: skill.category,
      status: "ACTIVE",
      scope_type: "DEVICE",
      rollout_mode: "DIRECT",
      trigger_stage: skill.trigger_stage,
      bind_target: input.device_id,
      priority: 10,
      config_patch: { source: "device_template_autofill", template_id: template.template_id, lane: "observation_baseline" },
    });
    auto_bound_required_observation_skills.push(`${skill.skill_id}@${skill.version}`);
    activeSkillKeys.add(skillKey(skill));
  }

  const auto_bound_default_inference_skills: string[] = [];
  for (const skill of template.default_inference_skills) {
    if (activeSkillKeys.has(skillKey(skill))) continue;
    await appendSkillBindingFact(db, {
      tenant_id: input.tenant_id,
      project_id: input.project_id,
      group_id: input.group_id,
      skill_id: skill.skill_id,
      version: skill.version,
      category: skill.category,
      status: "ACTIVE",
      scope_type: "DEVICE",
      rollout_mode: "DIRECT",
      trigger_stage: skill.trigger_stage,
      bind_target: input.device_id,
      priority: 1,
      config_patch: { source: "device_template_default", template_id: template.template_id, lane: "inference_strategy_default" },
    });
    auto_bound_default_inference_skills.push(`${skill.skill_id}@${skill.version}`);
    activeSkillKeys.add(skillKey(skill));
  }

  const validation = await validateDeviceRequiredObservationSkillBindingsV1(db, {
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    device_id: input.device_id,
    template_id: template.template_id,
  });

  return {
    auto_bound_required_observation_skills,
    auto_bound_default_inference_skills,
    binding_status: validation.binding_status,
  };
}
