-- GEOX Product API production dependency reconciliation V1.
-- Purpose: make public.field_index_v1 express the already-existing customer scope
-- required by the canonical Product Projection builder.
-- Boundary: additive schema only. No field identity row creation, no Twin state,
-- no authority mutation, no MCFT writer/owner change.

ALTER TABLE public.field_index_v1
  ADD COLUMN IF NOT EXISTS project_id text;

ALTER TABLE public.field_index_v1
  ADD COLUMN IF NOT EXISTS group_id text;

CREATE INDEX IF NOT EXISTS field_index_v1_product_scope_idx
  ON public.field_index_v1 (tenant_id, project_id, group_id, field_id);
