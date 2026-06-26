-- scripts/h53/PATCH_H53_3_SCENARIO_SEASON_DEFAULT.sql
-- Purpose: make the H53.3 demo scenario index compatible with the existing NOT NULL season_id column.
-- Boundary: schema default only; no facts, recommendations, approvals, tasks, receipts, evidence, acceptance, ROI, or Field Memory are written.

ALTER TABLE public.irrigation_scenario_set_index_v1
  ALTER COLUMN season_id SET DEFAULT 'season_h53_2_c8_demo';
