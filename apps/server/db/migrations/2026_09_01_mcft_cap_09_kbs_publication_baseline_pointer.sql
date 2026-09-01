-- MCFT-CAP-09 KBS Raw Hourly durable publication-baseline current pointer.
-- Boundary: extends the existing Evidence producer lease row with a metadata-only pointer
-- to the private content-addressed baseline manifest. No new table, no canonical Evidence,
-- no Twin Runtime state, no RuntimeTickCursor, and no provider authority.

ALTER TABLE public.external_evidence_producer_lease_v1
  ADD COLUMN IF NOT EXISTS kbs_raw_hourly_baseline_ref text,
  ADD COLUMN IF NOT EXISTS kbs_raw_hourly_baseline_digest text,
  ADD COLUMN IF NOT EXISTS kbs_raw_hourly_baseline_manifest_bytes bigint,
  ADD COLUMN IF NOT EXISTS kbs_raw_hourly_baseline_latest_event_time timestamptz,
  ADD COLUMN IF NOT EXISTS kbs_raw_hourly_baseline_stored_at timestamptz,
  ADD COLUMN IF NOT EXISTS kbs_raw_hourly_baseline_writer_owner text,
  ADD COLUMN IF NOT EXISTS kbs_raw_hourly_baseline_writer_fencing_token bigint,
  ADD COLUMN IF NOT EXISTS kbs_raw_hourly_baseline_advanced_at timestamptz;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid='public.external_evidence_producer_lease_v1'::regclass
      AND conname='external_evidence_producer_lease_v1_kbs_baseline_all_or_none'
  ) THEN
    ALTER TABLE public.external_evidence_producer_lease_v1
      ADD CONSTRAINT external_evidence_producer_lease_v1_kbs_baseline_all_or_none CHECK (
        (
          kbs_raw_hourly_baseline_ref IS NULL
          AND kbs_raw_hourly_baseline_digest IS NULL
          AND kbs_raw_hourly_baseline_manifest_bytes IS NULL
          AND kbs_raw_hourly_baseline_latest_event_time IS NULL
          AND kbs_raw_hourly_baseline_stored_at IS NULL
          AND kbs_raw_hourly_baseline_writer_owner IS NULL
          AND kbs_raw_hourly_baseline_writer_fencing_token IS NULL
          AND kbs_raw_hourly_baseline_advanced_at IS NULL
        )
        OR
        (
          kbs_raw_hourly_baseline_ref IS NOT NULL
          AND kbs_raw_hourly_baseline_digest IS NOT NULL
          AND kbs_raw_hourly_baseline_manifest_bytes IS NOT NULL
          AND kbs_raw_hourly_baseline_latest_event_time IS NOT NULL
          AND kbs_raw_hourly_baseline_stored_at IS NOT NULL
          AND kbs_raw_hourly_baseline_writer_owner IS NOT NULL
          AND kbs_raw_hourly_baseline_writer_fencing_token IS NOT NULL
          AND kbs_raw_hourly_baseline_advanced_at IS NOT NULL
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid='public.external_evidence_producer_lease_v1'::regclass
      AND conname='external_evidence_producer_lease_v1_kbs_baseline_digest'
  ) THEN
    ALTER TABLE public.external_evidence_producer_lease_v1
      ADD CONSTRAINT external_evidence_producer_lease_v1_kbs_baseline_digest CHECK (
        kbs_raw_hourly_baseline_digest IS NULL
        OR kbs_raw_hourly_baseline_digest ~ '^sha256:[0-9a-f]{64}$'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid='public.external_evidence_producer_lease_v1'::regclass
      AND conname='external_evidence_producer_lease_v1_kbs_baseline_ref'
  ) THEN
    ALTER TABLE public.external_evidence_producer_lease_v1
      ADD CONSTRAINT external_evidence_producer_lease_v1_kbs_baseline_ref CHECK (
        kbs_raw_hourly_baseline_ref IS NULL
        OR kbs_raw_hourly_baseline_ref ~
          '^s3-private://[^/]+/mcft-cap09-kbs-raw-hourly-publication-baseline-v1/sha256/[0-9a-f]{64}$'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid='public.external_evidence_producer_lease_v1'::regclass
      AND conname='external_evidence_producer_lease_v1_kbs_baseline_bytes'
  ) THEN
    ALTER TABLE public.external_evidence_producer_lease_v1
      ADD CONSTRAINT external_evidence_producer_lease_v1_kbs_baseline_bytes CHECK (
        kbs_raw_hourly_baseline_manifest_bytes IS NULL
        OR kbs_raw_hourly_baseline_manifest_bytes > 0
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid='public.external_evidence_producer_lease_v1'::regclass
      AND conname='external_evidence_producer_lease_v1_kbs_baseline_latest_hour'
  ) THEN
    ALTER TABLE public.external_evidence_producer_lease_v1
      ADD CONSTRAINT external_evidence_producer_lease_v1_kbs_baseline_latest_hour CHECK (
        kbs_raw_hourly_baseline_latest_event_time IS NULL
        OR kbs_raw_hourly_baseline_latest_event_time =
          date_trunc('hour', kbs_raw_hourly_baseline_latest_event_time)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid='public.external_evidence_producer_lease_v1'::regclass
      AND conname='external_evidence_producer_lease_v1_kbs_baseline_writer_fence'
  ) THEN
    ALTER TABLE public.external_evidence_producer_lease_v1
      ADD CONSTRAINT external_evidence_producer_lease_v1_kbs_baseline_writer_fence CHECK (
        kbs_raw_hourly_baseline_writer_fencing_token IS NULL
        OR kbs_raw_hourly_baseline_writer_fencing_token > 0
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid='public.external_evidence_producer_lease_v1'::regclass
      AND conname='external_evidence_producer_lease_v1_kbs_baseline_chronology'
  ) THEN
    ALTER TABLE public.external_evidence_producer_lease_v1
      ADD CONSTRAINT external_evidence_producer_lease_v1_kbs_baseline_chronology CHECK (
        kbs_raw_hourly_baseline_stored_at IS NULL
        OR kbs_raw_hourly_baseline_advanced_at IS NULL
        OR kbs_raw_hourly_baseline_stored_at <= kbs_raw_hourly_baseline_advanced_at
      );
  END IF;
END
$constraints$;

COMMENT ON COLUMN public.external_evidence_producer_lease_v1.kbs_raw_hourly_baseline_ref IS
  'Private content-addressed KBS Raw Hourly complete-table publication baseline manifest ref; not canonical Evidence.';
COMMENT ON COLUMN public.external_evidence_producer_lease_v1.kbs_raw_hourly_baseline_digest IS
  'sha256 digest of the immutable KBS publication baseline manifest.';
COMMENT ON COLUMN public.external_evidence_producer_lease_v1.kbs_raw_hourly_baseline_latest_event_time IS
  'Latest provider event time represented by the current complete-table publication baseline.';
COMMENT ON COLUMN public.external_evidence_producer_lease_v1.kbs_raw_hourly_baseline_writer_fencing_token IS
  'Evidence producer fencing token that last advanced the KBS publication baseline pointer.';
