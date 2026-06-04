ALTER TABLE as_applied_map_v1
  ALTER COLUMN coverage SET DEFAULT '{"coverage_percent":100}'::jsonb;
