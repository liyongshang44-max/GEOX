-- MCFT-CAP-09 v13 forcing controller admission metadata.
-- This migration does not create a second forcing target relation. It extends the single
-- per-base target row with the qualified acquisition-budget authority and the DB-clock
-- admission timestamp used by the production admission transaction.

ALTER TABLE public.twin_external_formal_forcing_base_target_v1
  ADD COLUMN IF NOT EXISTS acquisition_budget_authority_id text,
  ADD COLUMN IF NOT EXISTS selected_acquisition_budget_ms bigint,
  ADD COLUMN IF NOT EXISTS acquisition_start_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS controller_admitted_at timestamptz;

ALTER TABLE public.twin_external_formal_forcing_base_target_v1
  DROP CONSTRAINT IF EXISTS twin_external_formal_forcing_base_target_v1_budget_metadata_check;

ALTER TABLE public.twin_external_formal_forcing_base_target_v1
  ADD CONSTRAINT twin_external_formal_forcing_base_target_v1_budget_metadata_check
  CHECK (
    (
      acquisition_budget_authority_id IS NULL
      AND selected_acquisition_budget_ms IS NULL
      AND acquisition_start_deadline IS NULL
      AND controller_admitted_at IS NULL
    )
    OR
    (
      acquisition_budget_authority_id = 'FORMAL_FORCING_ACQUISITION_BUDGET_V1'
      AND selected_acquisition_budget_ms IS NOT NULL
      AND selected_acquisition_budget_ms > 0
      AND acquisition_start_deadline IS NOT NULL
      AND acquisition_start_deadline < causal_deadline
      AND controller_admitted_at IS NOT NULL
      AND controller_admitted_at <= causal_deadline
    )
  );

CREATE INDEX IF NOT EXISTS idx_twin_external_formal_forcing_base_target_admission_v1
  ON public.twin_external_formal_forcing_base_target_v1
  (tenant_id, project_id, group_id, field_id, season_id, zone_id, epoch_id, acquisition_start_deadline, base_target_t);
