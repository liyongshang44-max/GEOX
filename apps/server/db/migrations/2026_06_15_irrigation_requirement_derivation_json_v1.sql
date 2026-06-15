-- apps/server/db/migrations/2026_06_15_irrigation_requirement_derivation_json_v1.sql
-- Purpose: add formal derivation readback storage for irrigation_requirement_index_v1.
-- Boundary: idempotent schema hardening only; does not create seed data and does not change requirement calculation semantics.

DO $$
BEGIN
  IF to_regclass('public.irrigation_requirement_index_v1') IS NOT NULL THEN
    ALTER TABLE public.irrigation_requirement_index_v1
      ADD COLUMN IF NOT EXISTS derivation_json jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;
