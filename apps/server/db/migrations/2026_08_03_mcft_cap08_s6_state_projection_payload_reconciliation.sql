-- MCFT-CAP-08 S6 state projection payload reconciliation.
-- Canonical facts retain the complete object envelope at record_json.payload.
-- The rebuildable aggregate projection contract stores the inner semantic payload
-- at canonical_payload so CAP-07 can compare it with record_json.payload.payload.
--
-- This migration only rewrites rows that exactly match the historical envelope
-- shape and whose embedded object identity/hash agree with the typed projection
-- columns. Corrupt or ambiguous rows remain fail-closed for explicit recovery.

DO $$
BEGIN
  IF to_regclass('public.twin_state_history_projection_v1') IS NOT NULL THEN
    UPDATE public.twin_state_history_projection_v1
    SET canonical_payload = canonical_payload -> 'payload'
    WHERE jsonb_typeof(canonical_payload) = 'object'
      AND canonical_payload ->> 'object_type' = 'twin_state_estimate_v1'
      AND canonical_payload ->> 'object_id' = state_object_id
      AND canonical_payload ->> 'determinism_hash' = determinism_hash
      AND jsonb_typeof(canonical_payload -> 'payload') = 'object';
  END IF;
END
$$;
