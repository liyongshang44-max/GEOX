ALTER TABLE raw_samples
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NULL;

ALTER TABLE markers
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'system';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'raw_samples_source_v1_check') THEN
    ALTER TABLE raw_samples ADD CONSTRAINT raw_samples_source_v1_check CHECK (source IN ('device','gateway','system','human','import','sim')) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'raw_samples_qc_quality_v1_check') THEN
    ALTER TABLE raw_samples ADD CONSTRAINT raw_samples_qc_quality_v1_check CHECK (qc_quality IN ('unknown','ok','suspect','bad')) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'raw_samples_no_interpolated_or_synthetic_v1_check') THEN
    ALTER TABLE raw_samples ADD CONSTRAINT raw_samples_no_interpolated_or_synthetic_v1_check CHECK (
      COALESCE(payload_json ->> 'sample_kind', 'raw') = 'raw'
      AND COALESCE(payload_json ->> 'interpolated', 'false') = 'false'
      AND COALESCE(payload_json ->> 'synthetic', 'false') = 'false'
      AND COALESCE(payload_json ->> 'fake_sample', 'false') = 'false'
    ) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'raw_samples_ec_unit_ds_m_v1_check') THEN
    ALTER TABLE raw_samples ADD CONSTRAINT raw_samples_ec_unit_ds_m_v1_check CHECK (
      lower(metric) NOT IN ('ec','soil_ec','soil_ec_ds_m','ec_ds_m','salinity_ec_ds_m','soil_salinity_ec')
      OR payload_json ->> 'unit' = 'dS/m'
    ) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'markers_source_v1_check') THEN
    ALTER TABLE markers ADD CONSTRAINT markers_source_v1_check CHECK (source IN ('device','gateway','system','human')) NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION prevent_raw_samples_mutation_v1()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'RAW_SAMPLE_APPEND_ONLY';
END;
$$;

DROP TRIGGER IF EXISTS trg_raw_samples_no_update_v1 ON raw_samples;
CREATE TRIGGER trg_raw_samples_no_update_v1
BEFORE UPDATE ON raw_samples
FOR EACH ROW
EXECUTE FUNCTION prevent_raw_samples_mutation_v1();

DROP TRIGGER IF EXISTS trg_raw_samples_no_delete_v1 ON raw_samples;
CREATE TRIGGER trg_raw_samples_no_delete_v1
BEFORE DELETE ON raw_samples
FOR EACH ROW
EXECUTE FUNCTION prevent_raw_samples_mutation_v1();

CREATE INDEX IF NOT EXISTS idx_raw_samples_tenant_sensor_metric_ts_v1
  ON raw_samples ((payload_json ->> 'tenant_id'), sensor_id, metric, ts_ms ASC);

CREATE INDEX IF NOT EXISTS idx_raw_samples_tenant_group_ts_v1
  ON raw_samples ((payload_json ->> 'tenant_id'), (payload_json ->> 'group_id'), ts_ms ASC);

CREATE INDEX IF NOT EXISTS idx_markers_group_occurred_source_v1
  ON markers (group_id, occurred_at DESC, source);
