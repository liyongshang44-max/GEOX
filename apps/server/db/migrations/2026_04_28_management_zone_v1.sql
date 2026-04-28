CREATE TABLE IF NOT EXISTS management_zone_v1 (
  zone_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  field_id TEXT NOT NULL,

  zone_name TEXT NULL,
  zone_type TEXT NOT NULL,
  geometry JSONB NOT NULL DEFAULT '{}'::jsonb,
  area_ha DOUBLE PRECISION NULL,

  risk_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  agronomy_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_refs JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_management_zone_scope
  ON management_zone_v1(tenant_id, project_id, group_id, field_id);

CREATE INDEX IF NOT EXISTS idx_management_zone_field
  ON management_zone_v1(field_id);

CREATE INDEX IF NOT EXISTS idx_management_zone_type
  ON management_zone_v1(zone_type);
