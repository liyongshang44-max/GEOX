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
