-- path: apps/server/db/migrations/2026_06_07_field_polygon_and_seed_schema_alignment_v1.sql
-- Align legacy field/device/report indexes used by the controlled pilot full-review seed.
-- This migration is intentionally idempotent and only touches tables that already exist.

DO $$
DECLARE
  polygon_geojson_type text;
BEGIN
  IF to_regclass('public.field_polygon_v1') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'field_polygon_v1'
         AND column_name = 'geojson'
    ) THEN
      ALTER TABLE field_polygon_v1
        ALTER COLUMN geojson DROP NOT NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'field_polygon_v1'
         AND column_name = 'polygon_geojson_json'
    ) THEN
      ALTER TABLE field_polygon_v1
        ADD COLUMN polygon_geojson_json jsonb NULL;
    ELSE
      SELECT data_type
        INTO polygon_geojson_type
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'field_polygon_v1'
         AND column_name = 'polygon_geojson_json';

      IF polygon_geojson_type <> 'jsonb' THEN
        ALTER TABLE field_polygon_v1
          ALTER COLUMN polygon_geojson_json TYPE jsonb
          USING CASE
            WHEN polygon_geojson_json IS NULL THEN NULL
            WHEN btrim(polygon_geojson_json::text) = '' THEN NULL
            ELSE polygon_geojson_json::jsonb
          END;
      END IF;
    END IF;

    IF EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'field_polygon_v1'
         AND column_name = 'geojson'
    ) THEN
      EXECUTE $sql$
        UPDATE field_polygon_v1
           SET polygon_geojson_json = COALESCE(polygon_geojson_json, NULLIF(geojson, '')::jsonb)
         WHERE polygon_geojson_json IS NULL
           AND geojson IS NOT NULL
           AND btrim(geojson) <> ''
      $sql$;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.field_index_v1') IS NOT NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS ux_field_index_v1_tenant_field
      ON field_index_v1 (tenant_id, field_id);
  END IF;

  IF to_regclass('public.field_polygon_v1') IS NOT NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS ux_field_polygon_v1_tenant_field
      ON field_polygon_v1 (tenant_id, field_id);
  END IF;

  IF to_regclass('public.device_index_v1') IS NOT NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS ux_device_index_v1_tenant_device
      ON device_index_v1 (tenant_id, device_id);
  END IF;

  IF to_regclass('public.device_binding_index_v1') IS NOT NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS ux_device_binding_index_v1_tenant_device_field
      ON device_binding_index_v1 (tenant_id, device_id, field_id);
  END IF;

  IF to_regclass('public.device_status_index_v1') IS NOT NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS ux_device_status_index_v1_tenant_device
      ON device_status_index_v1 (tenant_id, device_id);
  END IF;

  IF to_regclass('public.device_capability') IS NOT NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS ux_device_capability_tenant_device
      ON device_capability (tenant_id, device_id);
  END IF;

  IF to_regclass('public.telemetry_index_v1') IS NOT NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS ux_telemetry_index_v1_tenant_device_metric_ts
      ON telemetry_index_v1 (tenant_id, device_id, metric, ts);
  END IF;

  IF to_regclass('public.field_memory_v1') IS NOT NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS ux_field_memory_v1_memory_id
      ON field_memory_v1 (memory_id);
  END IF;

  IF to_regclass('public.prescription_contract_v1') IS NOT NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS ux_prescription_contract_v1_tenant_project_group_rec
      ON prescription_contract_v1 (tenant_id, project_id, group_id, recommendation_id);
  END IF;

  IF to_regclass('public.operation_state_v1') IS NOT NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS ux_operation_state_v1_tenant_operation
      ON operation_state_v1 (tenant_id, operation_id);
  END IF;

  IF to_regclass('public.approval_requests_v1') IS NOT NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS ux_approval_requests_v1_tenant_request
      ON approval_requests_v1 (tenant_id, approval_request_id);
  END IF;
END $$;
