-- apps/server/db/migrations/2026_07_10_mcft_cap_02_continuation_persistence.sql
-- Purpose: extend the existing Runtime idempotency guard so MCFT-CAP-02 A2 continuation record sets can use the same persistence family.
-- Boundary: alters one existing CHECK constraint only; no new facts table, projection family, lineage index, checkpoint table, or canonical object store.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.twin_object_idempotency_index_v1'::regclass
      AND conname = 'twin_object_idempotency_index_v1_identity_kind_check'
  ) THEN
    ALTER TABLE public.twin_object_idempotency_index_v1
      DROP CONSTRAINT twin_object_idempotency_index_v1_identity_kind_check;
  END IF;
END
$$;

ALTER TABLE public.twin_object_idempotency_index_v1
  ADD CONSTRAINT twin_object_idempotency_index_v1_identity_kind_check
  CHECK (identity_kind IN ('OBJECT', 'A0_RECORD_SET', 'A2_RECORD_SET', 'RUNTIME_CONFIG'));
