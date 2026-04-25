ALTER TABLE as_applied_map_v1
  ADD COLUMN IF NOT EXISTS zone_id TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_as_applied_map_v1_zone_id
  ON as_applied_map_v1(zone_id);

CREATE INDEX IF NOT EXISTS idx_as_applied_map_v1_tenant_field_zone
  ON as_applied_map_v1(tenant_id, field_id, zone_id);
