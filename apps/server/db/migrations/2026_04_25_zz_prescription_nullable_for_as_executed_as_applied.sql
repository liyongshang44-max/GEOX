ALTER TABLE as_executed_record_v1
  ALTER COLUMN prescription_id DROP NOT NULL;

ALTER TABLE as_applied_map_v1
  ALTER COLUMN prescription_id DROP NOT NULL;
