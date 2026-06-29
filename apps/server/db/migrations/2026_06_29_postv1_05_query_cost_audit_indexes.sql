-- path: apps/server/db/migrations/2026_06_29_postv1_05_query_cost_audit_indexes.sql
-- Purpose: add the single observed Twin Kernel productionization index gap found by POSTV1-05 query-path audit.
-- Boundary: index-only migration; no table redesign, no route change, no semantic change, and no data mutation.

CREATE INDEX IF NOT EXISTS decision_cycle_v1_operator_queue_idx
  ON decision_cycle_v1 (created_at DESC)
  WHERE cycle_status = 'DECISION_CYCLE_READY'
    AND (external_refs_json->>'acceptance_id') IS NOT NULL
    AND (
      (external_refs_json->>'roi_entry_id') IS NULL
      OR (external_refs_json->>'field_memory_id') IS NULL
    );
