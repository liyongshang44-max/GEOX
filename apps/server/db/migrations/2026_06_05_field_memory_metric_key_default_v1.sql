-- apps/server/db/migrations/2026_06_05_field_memory_metric_key_default_v1.sql
-- Purpose: keep field_memory_v1 contract hardened while allowing internal technical memory rows to use a deterministic default metric key.

ALTER TABLE field_memory_v1
  ALTER COLUMN metric_key SET DEFAULT 'field_memory_metric';

ALTER TABLE field_memory_v1
  ALTER COLUMN source_type SET DEFAULT 'unknown';

ALTER TABLE field_memory_v1
  ALTER COLUMN source_id SET DEFAULT '';

ALTER TABLE field_memory_v1
  ALTER COLUMN confidence SET DEFAULT 0.8;

UPDATE field_memory_v1
SET metric_key = CASE
  WHEN memory_type = 'FIELD_RESPONSE_MEMORY' THEN 'soil_moisture_response'
  WHEN memory_type = 'DEVICE_RELIABILITY_MEMORY' THEN 'valve_response_status'
  WHEN memory_type = 'SKILL_PERFORMANCE_MEMORY' THEN 'irrigation_skill_outcome'
  ELSE 'field_memory_metric'
END
WHERE metric_key IS NULL OR btrim(metric_key) = '';

UPDATE field_memory_v1
SET source_type = COALESCE(NULLIF(source_type, ''), 'unknown')
WHERE source_type IS NULL OR btrim(source_type) = '';

UPDATE field_memory_v1
SET source_id = COALESCE(NULLIF(source_id, ''), operation_id, memory_id)
WHERE source_id IS NULL OR btrim(source_id) = '';

UPDATE field_memory_v1
SET confidence = COALESCE(confidence, 0.8)
WHERE confidence IS NULL;
