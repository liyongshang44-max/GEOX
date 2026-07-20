-- apps/server/db/migrations/2026_07_20_mcft_cap_07_fact_visibility_support.sql
-- Purpose: establish the additive MCFT-CAP-07 canonical-fact visibility epoch, xid8 metadata, migration ledger, and same-transaction facts trigger.
-- Boundary: public.facts semantic columns and record_json remain unchanged; this migration creates no canonical writer, route, projection, Runtime object, or application-supplied visibility authority.

LOCK TABLE public.facts IN SHARE MODE;

CREATE TABLE public.geox_schema_migration_ledger_v1 (
  migration_id text PRIMARY KEY,
  migration_checksum_sha256 text NOT NULL CHECK (migration_checksum_sha256 ~ '^sha256:[0-9a-f]{64}$'),
  taskbook_version text NOT NULL,
  subject_commit text NOT NULL,
  applied_at timestamptz NOT NULL,
  applied_by_session_user text NOT NULL,
  applied_by_current_user text NOT NULL,
  status text NOT NULL CHECK (status = 'APPLIED')
);

CREATE TABLE public.twin_fact_visibility_epoch_v1 (
  visibility_epoch_id text PRIMARY KEY,
  schema_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('STAGING', 'ACTIVE', 'RETIRED')),
  activated_at timestamptz NOT NULL,
  retired_at timestamptz NULL,
  activation_xid8 xid8 NOT NULL,
  baseline_fact_count bigint NOT NULL CHECK (baseline_fact_count >= 0),
  baseline_fact_id_set_hash text NOT NULL CHECK (baseline_fact_id_set_hash ~ '^sha256:[0-9a-f]{64}$'),
  rotation_semantic_artifact_digest text NULL CHECK (
    rotation_semantic_artifact_digest IS NULL OR rotation_semantic_artifact_digest ~ '^sha256:[0-9a-f]{64}$'
  ),
  rotation_transport_archive_sha256 text NULL CHECK (
    rotation_transport_archive_sha256 IS NULL OR rotation_transport_archive_sha256 ~ '^sha256:[0-9a-f]{64}$'
  ),
  retention_not_before timestamptz NULL,
  index_rows_purged_at timestamptz NULL,
  purge_semantic_artifact_digest text NULL CHECK (
    purge_semantic_artifact_digest IS NULL OR purge_semantic_artifact_digest ~ '^sha256:[0-9a-f]{64}$'
  ),
  purge_transport_archive_sha256 text NULL CHECK (
    purge_transport_archive_sha256 IS NULL OR purge_transport_archive_sha256 ~ '^sha256:[0-9a-f]{64}$'
  ),
  CONSTRAINT twin_fact_visibility_epoch_v1_status_shape_check CHECK (
    (status = 'ACTIVE' AND retired_at IS NULL AND retention_not_before IS NULL AND index_rows_purged_at IS NULL)
    OR (status = 'STAGING' AND retired_at IS NULL AND index_rows_purged_at IS NULL)
    OR (status = 'RETIRED' AND retired_at IS NOT NULL AND retention_not_before IS NOT NULL)
  ),
  CONSTRAINT twin_fact_visibility_epoch_v1_purge_artifact_shape_check CHECK (
    (index_rows_purged_at IS NULL AND purge_semantic_artifact_digest IS NULL AND purge_transport_archive_sha256 IS NULL)
    OR (index_rows_purged_at IS NOT NULL AND purge_semantic_artifact_digest IS NOT NULL AND purge_transport_archive_sha256 IS NOT NULL)
  )
);

CREATE UNIQUE INDEX twin_fact_visibility_epoch_v1_one_active_idx
  ON public.twin_fact_visibility_epoch_v1 ((status))
  WHERE status = 'ACTIVE';

CREATE TABLE public.twin_fact_visibility_index_v1 (
  visibility_epoch_id text NOT NULL REFERENCES public.twin_fact_visibility_epoch_v1(visibility_epoch_id),
  fact_id text NOT NULL REFERENCES public.facts(fact_id),
  visibility_anchor_xid8 xid8 NOT NULL,
  visibility_anchor_kind text NOT NULL CHECK (
    visibility_anchor_kind IN (
      'FACT_INSERT_TRANSACTION',
      'INITIAL_BASELINE_TRANSACTION',
      'EPOCH_ROTATION_TRANSACTION'
    )
  ),
  PRIMARY KEY (visibility_epoch_id, fact_id)
);

CREATE INDEX twin_fact_visibility_index_v1_fact_lookup_idx
  ON public.twin_fact_visibility_index_v1 (fact_id, visibility_epoch_id);

WITH baseline AS (
  SELECT
    count(*)::bigint AS fact_count,
    'sha256:' || pg_catalog.encode(
      public.digest(
        pg_catalog.convert_to(
          COALESCE(pg_catalog.string_agg(f.fact_id, E'\n' ORDER BY f.fact_id), ''),
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    ) AS fact_id_set_hash
  FROM public.facts AS f
)
INSERT INTO public.twin_fact_visibility_epoch_v1 (
  visibility_epoch_id,
  schema_version,
  status,
  activated_at,
  retired_at,
  activation_xid8,
  baseline_fact_count,
  baseline_fact_id_set_hash,
  rotation_semantic_artifact_digest,
  rotation_transport_archive_sha256,
  retention_not_before,
  index_rows_purged_at,
  purge_semantic_artifact_digest,
  purge_transport_archive_sha256
)
SELECT
  'mcft-cap07-initial-visibility-epoch-v1',
  'mcft_cap_07_fact_visibility_epoch_v1',
  'ACTIVE',
  pg_catalog.transaction_timestamp(),
  NULL,
  pg_catalog.pg_current_xact_id(),
  baseline.fact_count,
  baseline.fact_id_set_hash,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL
FROM baseline;

INSERT INTO public.twin_fact_visibility_index_v1 (
  visibility_epoch_id,
  fact_id,
  visibility_anchor_xid8,
  visibility_anchor_kind
)
SELECT
  'mcft-cap07-initial-visibility-epoch-v1',
  f.fact_id,
  pg_catalog.pg_current_xact_id(),
  'INITIAL_BASELINE_TRANSACTION'
FROM public.facts AS f;

CREATE FUNCTION public.enforce_mcft_cap07_fact_visibility_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  active_epoch_count integer;
  active_epoch_id text;
BEGIN
  SELECT pg_catalog.count(*)::integer, pg_catalog.min(e.visibility_epoch_id)
    INTO active_epoch_count, active_epoch_id
    FROM public.twin_fact_visibility_epoch_v1 AS e
   WHERE e.status = 'ACTIVE';

  IF active_epoch_count <> 1 OR active_epoch_id IS NULL THEN
    RAISE EXCEPTION 'MCFT_VISIBILITY_ACTIVE_EPOCH_CARDINALITY_INVALID:%', active_epoch_count;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.twin_fact_visibility_index_v1 AS existing
     WHERE existing.visibility_epoch_id = active_epoch_id
       AND existing.fact_id = NEW.fact_id
  ) THEN
    RAISE EXCEPTION 'MCFT_FACT_VISIBILITY_METADATA_INCONSISTENT:%', NEW.fact_id;
  END IF;

  INSERT INTO public.twin_fact_visibility_index_v1 (
    visibility_epoch_id,
    fact_id,
    visibility_anchor_xid8,
    visibility_anchor_kind
  ) VALUES (
    active_epoch_id,
    NEW.fact_id,
    pg_catalog.pg_current_xact_id(),
    'FACT_INSERT_TRANSACTION'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER mcft_cap07_fact_visibility_after_insert_v1
AFTER INSERT ON public.facts
FOR EACH ROW
EXECUTE FUNCTION public.enforce_mcft_cap07_fact_visibility_v1();

CREATE FUNCTION public.enforce_mcft_cap07_visibility_epoch_authority_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'MCFT_VISIBILITY_METADATA_IMMUTABILITY_VIOLATION:EPOCH_DELETE_FORBIDDEN';
  END IF;

  IF SESSION_USER::text <> 'geox_mcft_migrator_v1' THEN
    RAISE EXCEPTION 'MCFT_VISIBILITY_METADATA_PRIVILEGE_CONTRACT_INVALID:EPOCH_UPDATE_SESSION';
  END IF;

  IF NEW.visibility_epoch_id IS DISTINCT FROM OLD.visibility_epoch_id
    OR NEW.schema_version IS DISTINCT FROM OLD.schema_version
    OR NEW.activated_at IS DISTINCT FROM OLD.activated_at
    OR NEW.activation_xid8 IS DISTINCT FROM OLD.activation_xid8
    OR NEW.baseline_fact_count IS DISTINCT FROM OLD.baseline_fact_count
    OR NEW.baseline_fact_id_set_hash IS DISTINCT FROM OLD.baseline_fact_id_set_hash THEN
    RAISE EXCEPTION 'MCFT_VISIBILITY_METADATA_IMMUTABILITY_VIOLATION:EPOCH_IDENTITY';
  END IF;

  IF OLD.status = 'STAGING' AND NEW.status = 'ACTIVE' THEN
    IF NEW.retired_at IS NOT NULL OR NEW.retention_not_before IS NOT NULL THEN
      RAISE EXCEPTION 'MCFT_VISIBILITY_METADATA_IMMUTABILITY_VIOLATION:STAGING_TO_ACTIVE_SHAPE';
    END IF;
  ELSIF OLD.status = 'ACTIVE' AND NEW.status = 'RETIRED' THEN
    IF NEW.retired_at IS NULL
      OR NEW.retention_not_before IS NULL
      OR NEW.rotation_semantic_artifact_digest IS NULL
      OR NEW.rotation_transport_archive_sha256 IS NULL
      OR NEW.retention_not_before <= NEW.retired_at THEN
      RAISE EXCEPTION 'MCFT_VISIBILITY_METADATA_IMMUTABILITY_VIOLATION:ACTIVE_TO_RETIRED_SHAPE';
    END IF;
  ELSIF OLD.status = 'RETIRED' AND NEW.status = 'RETIRED' THEN
    IF NEW.retired_at IS DISTINCT FROM OLD.retired_at
      OR NEW.retention_not_before IS DISTINCT FROM OLD.retention_not_before
      OR NEW.rotation_semantic_artifact_digest IS DISTINCT FROM OLD.rotation_semantic_artifact_digest
      OR NEW.rotation_transport_archive_sha256 IS DISTINCT FROM OLD.rotation_transport_archive_sha256
      OR OLD.index_rows_purged_at IS NOT NULL
      OR NEW.index_rows_purged_at IS NULL
      OR NEW.purge_semantic_artifact_digest IS NULL
      OR NEW.purge_transport_archive_sha256 IS NULL
      OR NEW.index_rows_purged_at < NEW.retention_not_before
      OR NEW.index_rows_purged_at > pg_catalog.transaction_timestamp() THEN
      RAISE EXCEPTION 'MCFT_VISIBILITY_METADATA_IMMUTABILITY_VIOLATION:RETIRED_PURGE_SHAPE';
    END IF;
  ELSE
    RAISE EXCEPTION 'MCFT_VISIBILITY_METADATA_IMMUTABILITY_VIOLATION:EPOCH_TRANSITION:%->%', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER mcft_cap07_visibility_epoch_authority_v1
BEFORE UPDATE OR DELETE ON public.twin_fact_visibility_epoch_v1
FOR EACH ROW
EXECUTE FUNCTION public.enforce_mcft_cap07_visibility_epoch_authority_v1();

CREATE FUNCTION public.enforce_mcft_cap07_visibility_index_immutability_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  epoch_status text;
  epoch_retention_not_before timestamptz;
  epoch_index_rows_purged_at timestamptz;
  epoch_purge_semantic_artifact_digest text;
  epoch_purge_transport_archive_sha256 text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'MCFT_VISIBILITY_METADATA_IMMUTABILITY_VIOLATION:INDEX_UPDATE_FORBIDDEN';
  END IF;

  IF SESSION_USER::text <> 'geox_mcft_migrator_v1' THEN
    RAISE EXCEPTION 'MCFT_VISIBILITY_METADATA_PRIVILEGE_CONTRACT_INVALID:INDEX_DELETE_SESSION';
  END IF;

  SELECT
    e.status,
    e.retention_not_before,
    e.index_rows_purged_at,
    e.purge_semantic_artifact_digest,
    e.purge_transport_archive_sha256
  INTO
    epoch_status,
    epoch_retention_not_before,
    epoch_index_rows_purged_at,
    epoch_purge_semantic_artifact_digest,
    epoch_purge_transport_archive_sha256
  FROM public.twin_fact_visibility_epoch_v1 AS e
  WHERE e.visibility_epoch_id = OLD.visibility_epoch_id;

  IF epoch_status IS DISTINCT FROM 'RETIRED'
    OR epoch_retention_not_before IS NULL
    OR epoch_retention_not_before > pg_catalog.transaction_timestamp()
    OR epoch_index_rows_purged_at IS NULL
    OR epoch_purge_semantic_artifact_digest IS NULL
    OR epoch_purge_transport_archive_sha256 IS NULL THEN
    RAISE EXCEPTION 'MCFT_VISIBILITY_METADATA_IMMUTABILITY_VIOLATION:RETIRED_RETENTION_OR_ARTIFACT_REQUIRED';
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER mcft_cap07_visibility_index_immutability_v1
BEFORE UPDATE OR DELETE ON public.twin_fact_visibility_index_v1
FOR EACH ROW
EXECUTE FUNCTION public.enforce_mcft_cap07_visibility_index_immutability_v1();

ALTER TABLE public.geox_schema_migration_ledger_v1 OWNER TO geox_mcft_migration_owner_v1;
ALTER TABLE public.twin_fact_visibility_epoch_v1 OWNER TO geox_mcft_migration_owner_v1;
ALTER TABLE public.twin_fact_visibility_index_v1 OWNER TO geox_mcft_migration_owner_v1;
ALTER FUNCTION public.enforce_mcft_cap07_fact_visibility_v1() OWNER TO geox_mcft_migration_owner_v1;
ALTER FUNCTION public.enforce_mcft_cap07_visibility_epoch_authority_v1() OWNER TO geox_mcft_migration_owner_v1;
ALTER FUNCTION public.enforce_mcft_cap07_visibility_index_immutability_v1() OWNER TO geox_mcft_migration_owner_v1;

REVOKE ALL ON TABLE public.geox_schema_migration_ledger_v1 FROM PUBLIC;
REVOKE ALL ON TABLE public.twin_fact_visibility_epoch_v1 FROM PUBLIC;
REVOKE ALL ON TABLE public.twin_fact_visibility_index_v1 FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_mcft_cap07_fact_visibility_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_mcft_cap07_visibility_epoch_authority_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_mcft_cap07_visibility_index_immutability_v1() FROM PUBLIC;

REVOKE ALL ON TABLE public.geox_schema_migration_ledger_v1 FROM geox_runtime_v1;
REVOKE ALL ON TABLE public.twin_fact_visibility_epoch_v1 FROM geox_runtime_v1;
REVOKE ALL ON TABLE public.twin_fact_visibility_index_v1 FROM geox_runtime_v1;
REVOKE ALL ON FUNCTION public.enforce_mcft_cap07_fact_visibility_v1() FROM geox_runtime_v1;
REVOKE ALL ON FUNCTION public.enforce_mcft_cap07_visibility_epoch_authority_v1() FROM geox_runtime_v1;
REVOKE ALL ON FUNCTION public.enforce_mcft_cap07_visibility_index_immutability_v1() FROM geox_runtime_v1;

GRANT SELECT ON TABLE public.twin_fact_visibility_epoch_v1 TO geox_runtime_v1;
GRANT SELECT ON TABLE public.twin_fact_visibility_index_v1 TO geox_runtime_v1;
GRANT SELECT ON TABLE public.geox_schema_migration_ledger_v1 TO geox_runtime_v1;

DO $$
DECLARE
  active_epoch_count bigint;
  canonical_fact_count bigint;
  active_epoch_index_count bigint;
  missing_fact_count bigint;
  wrong_epoch_count bigint;
  trigger_enabled_count bigint;
BEGIN
  SELECT pg_catalog.count(*) INTO active_epoch_count
    FROM public.twin_fact_visibility_epoch_v1
   WHERE status = 'ACTIVE';

  SELECT pg_catalog.count(*) INTO canonical_fact_count
    FROM public.facts;

  SELECT pg_catalog.count(*) INTO active_epoch_index_count
    FROM public.twin_fact_visibility_index_v1
   WHERE visibility_epoch_id = 'mcft-cap07-initial-visibility-epoch-v1';

  SELECT pg_catalog.count(*) INTO missing_fact_count
    FROM public.facts AS f
    LEFT JOIN public.twin_fact_visibility_index_v1 AS v
      ON v.visibility_epoch_id = 'mcft-cap07-initial-visibility-epoch-v1'
     AND v.fact_id = f.fact_id
   WHERE v.fact_id IS NULL;

  SELECT pg_catalog.count(*) INTO wrong_epoch_count
    FROM public.twin_fact_visibility_index_v1
   WHERE visibility_epoch_id <> 'mcft-cap07-initial-visibility-epoch-v1';

  SELECT pg_catalog.count(*) INTO trigger_enabled_count
    FROM pg_catalog.pg_trigger AS t
    JOIN pg_catalog.pg_class AS c ON c.oid = t.tgrelid
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname = 'facts'
     AND t.tgname = 'mcft_cap07_fact_visibility_after_insert_v1'
     AND t.tgenabled = 'O'
     AND NOT t.tgisinternal;

  IF active_epoch_count <> 1 THEN
    RAISE EXCEPTION 'MCFT_VISIBILITY_ACTIVE_EPOCH_CARDINALITY_INVALID:%', active_epoch_count;
  END IF;

  IF canonical_fact_count <> active_epoch_index_count OR missing_fact_count <> 0 OR wrong_epoch_count <> 0 THEN
    RAISE EXCEPTION 'MCFT_FACT_VISIBILITY_METADATA_INCONSISTENT:facts=%,index=%,missing=%,wrong_epoch=%',
      canonical_fact_count,
      active_epoch_index_count,
      missing_fact_count,
      wrong_epoch_count;
  END IF;

  IF trigger_enabled_count <> 1 THEN
    RAISE EXCEPTION 'MCFT_VISIBILITY_TRIGGER_CONTRACT_INVALID:%', trigger_enabled_count;
  END IF;
END;
$$;
