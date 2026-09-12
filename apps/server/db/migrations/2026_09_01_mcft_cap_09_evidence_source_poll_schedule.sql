-- MCFT-CAP-09 Evidence source poll schedule operational metadata.
-- Existing Evidence producer lease row only; no new table or runtime activation.
ALTER TABLE public.external_evidence_producer_lease_v1
  ADD COLUMN IF NOT EXISTS kbs_raw_hourly_poll_last_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS kbs_raw_hourly_poll_next_eligible_at timestamptz,
  ADD COLUMN IF NOT EXISTS kbs_raw_hourly_poll_writer_owner text,
  ADD COLUMN IF NOT EXISTS kbs_raw_hourly_poll_writer_fencing_token bigint,
  ADD COLUMN IF NOT EXISTS kbs_soil_poll_last_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS kbs_soil_poll_next_eligible_at timestamptz,
  ADD COLUMN IF NOT EXISTS kbs_soil_poll_writer_owner text,
  ADD COLUMN IF NOT EXISTS kbs_soil_poll_writer_fencing_token bigint,
  ADD COLUMN IF NOT EXISTS gfs_poll_target_logical_time timestamptz,
  ADD COLUMN IF NOT EXISTS gfs_poll_attempt_count integer,
  ADD COLUMN IF NOT EXISTS gfs_poll_last_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS gfs_poll_next_eligible_at timestamptz,
  ADD COLUMN IF NOT EXISTS gfs_poll_writer_owner text,
  ADD COLUMN IF NOT EXISTS gfs_poll_writer_fencing_token bigint;
DO $constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.external_evidence_producer_lease_v1'::regclass AND conname='external_evidence_producer_lease_v1_kbs_raw_poll_all_or_none') THEN
    ALTER TABLE public.external_evidence_producer_lease_v1 ADD CONSTRAINT external_evidence_producer_lease_v1_kbs_raw_poll_all_or_none CHECK (
      (kbs_raw_hourly_poll_last_started_at IS NULL AND kbs_raw_hourly_poll_next_eligible_at IS NULL AND kbs_raw_hourly_poll_writer_owner IS NULL AND kbs_raw_hourly_poll_writer_fencing_token IS NULL)
      OR (kbs_raw_hourly_poll_last_started_at IS NOT NULL AND kbs_raw_hourly_poll_next_eligible_at IS NOT NULL AND kbs_raw_hourly_poll_writer_owner IS NOT NULL AND kbs_raw_hourly_poll_writer_fencing_token IS NOT NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.external_evidence_producer_lease_v1'::regclass AND conname='external_evidence_producer_lease_v1_kbs_raw_poll_chronology') THEN
    ALTER TABLE public.external_evidence_producer_lease_v1 ADD CONSTRAINT external_evidence_producer_lease_v1_kbs_raw_poll_chronology CHECK (kbs_raw_hourly_poll_last_started_at IS NULL OR kbs_raw_hourly_poll_next_eligible_at>kbs_raw_hourly_poll_last_started_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.external_evidence_producer_lease_v1'::regclass AND conname='external_evidence_producer_lease_v1_kbs_raw_poll_fence') THEN
    ALTER TABLE public.external_evidence_producer_lease_v1 ADD CONSTRAINT external_evidence_producer_lease_v1_kbs_raw_poll_fence CHECK (kbs_raw_hourly_poll_writer_fencing_token IS NULL OR kbs_raw_hourly_poll_writer_fencing_token>0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.external_evidence_producer_lease_v1'::regclass AND conname='external_evidence_producer_lease_v1_kbs_soil_poll_all_or_none') THEN
    ALTER TABLE public.external_evidence_producer_lease_v1 ADD CONSTRAINT external_evidence_producer_lease_v1_kbs_soil_poll_all_or_none CHECK (
      (kbs_soil_poll_last_started_at IS NULL AND kbs_soil_poll_next_eligible_at IS NULL AND kbs_soil_poll_writer_owner IS NULL AND kbs_soil_poll_writer_fencing_token IS NULL)
      OR (kbs_soil_poll_last_started_at IS NOT NULL AND kbs_soil_poll_next_eligible_at IS NOT NULL AND kbs_soil_poll_writer_owner IS NOT NULL AND kbs_soil_poll_writer_fencing_token IS NOT NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.external_evidence_producer_lease_v1'::regclass AND conname='external_evidence_producer_lease_v1_kbs_soil_poll_chronology') THEN
    ALTER TABLE public.external_evidence_producer_lease_v1 ADD CONSTRAINT external_evidence_producer_lease_v1_kbs_soil_poll_chronology CHECK (kbs_soil_poll_last_started_at IS NULL OR kbs_soil_poll_next_eligible_at>kbs_soil_poll_last_started_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.external_evidence_producer_lease_v1'::regclass AND conname='external_evidence_producer_lease_v1_kbs_soil_poll_fence') THEN
    ALTER TABLE public.external_evidence_producer_lease_v1 ADD CONSTRAINT external_evidence_producer_lease_v1_kbs_soil_poll_fence CHECK (kbs_soil_poll_writer_fencing_token IS NULL OR kbs_soil_poll_writer_fencing_token>0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.external_evidence_producer_lease_v1'::regclass AND conname='external_evidence_producer_lease_v1_gfs_poll_all_or_none') THEN
    ALTER TABLE public.external_evidence_producer_lease_v1 ADD CONSTRAINT external_evidence_producer_lease_v1_gfs_poll_all_or_none CHECK (
      (gfs_poll_target_logical_time IS NULL AND gfs_poll_attempt_count IS NULL AND gfs_poll_last_started_at IS NULL AND gfs_poll_next_eligible_at IS NULL AND gfs_poll_writer_owner IS NULL AND gfs_poll_writer_fencing_token IS NULL)
      OR (gfs_poll_target_logical_time IS NOT NULL AND gfs_poll_attempt_count IS NOT NULL AND gfs_poll_last_started_at IS NOT NULL AND gfs_poll_next_eligible_at IS NOT NULL AND gfs_poll_writer_owner IS NOT NULL AND gfs_poll_writer_fencing_token IS NOT NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.external_evidence_producer_lease_v1'::regclass AND conname='external_evidence_producer_lease_v1_gfs_poll_attempt_budget') THEN
    ALTER TABLE public.external_evidence_producer_lease_v1 ADD CONSTRAINT external_evidence_producer_lease_v1_gfs_poll_attempt_budget CHECK (gfs_poll_attempt_count IS NULL OR gfs_poll_attempt_count BETWEEN 1 AND 3);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.external_evidence_producer_lease_v1'::regclass AND conname='external_evidence_producer_lease_v1_gfs_poll_target_hour') THEN
    ALTER TABLE public.external_evidence_producer_lease_v1 ADD CONSTRAINT external_evidence_producer_lease_v1_gfs_poll_target_hour CHECK (gfs_poll_target_logical_time IS NULL OR (EXTRACT(MINUTE FROM gfs_poll_target_logical_time)=0 AND EXTRACT(SECOND FROM gfs_poll_target_logical_time)=0));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.external_evidence_producer_lease_v1'::regclass AND conname='external_evidence_producer_lease_v1_gfs_poll_chronology') THEN
    ALTER TABLE public.external_evidence_producer_lease_v1 ADD CONSTRAINT external_evidence_producer_lease_v1_gfs_poll_chronology CHECK (gfs_poll_last_started_at IS NULL OR gfs_poll_next_eligible_at>gfs_poll_last_started_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.external_evidence_producer_lease_v1'::regclass AND conname='external_evidence_producer_lease_v1_gfs_poll_fence') THEN
    ALTER TABLE public.external_evidence_producer_lease_v1 ADD CONSTRAINT external_evidence_producer_lease_v1_gfs_poll_fence CHECK (gfs_poll_writer_fencing_token IS NULL OR gfs_poll_writer_fencing_token>0);
  END IF;
END
$constraints$;
COMMENT ON COLUMN public.external_evidence_producer_lease_v1.kbs_raw_hourly_poll_next_eligible_at IS 'GEOX operational request throttle for KBS Raw Hourly; not provider cadence or canonical Evidence.';
COMMENT ON COLUMN public.external_evidence_producer_lease_v1.kbs_soil_poll_next_eligible_at IS 'GEOX operational request throttle for KBS soil; not provider cadence or canonical Evidence.';
COMMENT ON COLUMN public.external_evidence_producer_lease_v1.gfs_poll_target_logical_time IS 'GEOX operational GFS retry target; target authority is separate and not derived from this row.';
COMMENT ON COLUMN public.external_evidence_producer_lease_v1.gfs_poll_attempt_count IS 'Durable per-target GFS provider-attempt budget; max three attempts, not provider cadence authority.';
COMMENT ON COLUMN public.external_evidence_producer_lease_v1.gfs_poll_next_eligible_at IS 'Durable minimum retry throttle for GFS provider attempts; operational only.';
