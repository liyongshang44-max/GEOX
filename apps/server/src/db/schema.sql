-- Skill bindings runtime persistence (Stage 7)
CREATE TABLE IF NOT EXISTS skill_rule_bindings (
  id text PRIMARY KEY,
  skill_id text NOT NULL,
  version text NOT NULL,
  crop_code text NULL,
  tenant_id text NULL,
  enabled boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  tenant_scope text GENERATED ALWAYS AS (COALESCE(tenant_id, '')) STORED,
  crop_scope text GENERATED ALWAYS AS (COALESCE(crop_code, '')) STORED
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_skill_rule_bindings_identity
ON skill_rule_bindings (skill_id, version, tenant_scope, crop_scope);

CREATE UNIQUE INDEX IF NOT EXISTS ux_skill_rule_bindings_enabled_scope_skill
ON skill_rule_bindings (tenant_scope, crop_scope, skill_id)
WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_skill_rule_bindings_lookup
ON skill_rule_bindings (skill_id, tenant_id, crop_code, enabled, priority DESC);

-- Skill registry read model projection (facts -> read model)
CREATE TABLE IF NOT EXISTS skill_registry_read_v1 (
  tenant_id text NOT NULL,
  project_id text NOT NULL,
  group_id text NOT NULL,
  fact_type text NOT NULL,
  fact_id text PRIMARY KEY,
  skill_id text NOT NULL,
  version text NOT NULL,
  category text NULL,
  status text NULL,
  scope_type text NULL,
  rollout_mode text NULL,
  result_status text NULL,
  crop_code text NULL,
  device_type text NULL,
  trigger_stage text NULL,
  bind_target text NULL,
  operation_id text NULL,
  operation_plan_id text NULL,
  field_id text NULL,
  device_id text NULL,
  input_digest text NULL,
  output_digest text NULL,
  payload_json jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  updated_at_ts_ms bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_skill_registry_read_v1_lookup
ON skill_registry_read_v1 (tenant_id, project_id, group_id, category, status, crop_code, device_type, trigger_stage, bind_target, updated_at_ts_ms DESC);
