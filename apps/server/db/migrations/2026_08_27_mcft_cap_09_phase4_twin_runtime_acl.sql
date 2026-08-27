-- MCFT-CAP-09 Production Hosting Phase 4: Twin Runtime database ACL.
-- Boundary: the online Twin Runtime may read governed Evidence from public.facts,
-- persist only canonical Twin Runtime/Forecast/Scenario state, and own only its
-- independent scheduler cursor/slot/lease state.
--
-- It MUST NOT mutate Evidence-plane acquisition/supply coordination tables.
-- It also receives no arbitrary UPDATE/DELETE authority over canonical facts.

DO $role$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_roles
     WHERE rolname = 'geox_mcft_cap09_twin_runtime_v1'
  ) THEN
    CREATE ROLE geox_mcft_cap09_twin_runtime_v1
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END
$role$;

ALTER ROLE geox_mcft_cap09_twin_runtime_v1
  NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

REVOKE ALL ON SCHEMA public FROM geox_mcft_cap09_twin_runtime_v1;
GRANT USAGE ON SCHEMA public TO geox_mcft_cap09_twin_runtime_v1;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public
  FROM geox_mcft_cap09_twin_runtime_v1;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public
  FROM geox_mcft_cap09_twin_runtime_v1;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public
  FROM geox_mcft_cap09_twin_runtime_v1;

-- Canonical fact authority: append and read only.
GRANT SELECT, INSERT
  ON TABLE public.facts
  TO geox_mcft_cap09_twin_runtime_v1;

-- Runtime scheduler/cursor/lease authority.
GRANT SELECT, INSERT, UPDATE
  ON TABLE
    public.twin_runtime_lease_v1,
    public.twin_shadow_online_scheduler_cursor_v1,
    public.twin_shadow_online_scheduler_slot_v1
  TO geox_mcft_cap09_twin_runtime_v1;

-- Canonical Runtime identity/checkpoint/projection authority.
GRANT SELECT, INSERT, UPDATE
  ON TABLE
    public.twin_object_idempotency_index_v1,
    public.twin_active_lineage_index_v1,
    public.twin_state_history_projection_v1,
    public.twin_state_latest_index_v1,
    public.twin_forecast_result_latest_index_v1,
    public.twin_forecast_success_latest_index_v1,
    public.twin_runtime_checkpoint_latest_index_v1,
    public.twin_runtime_health_latest_index_v1,
    public.twin_runtime_authority_snapshot_v1,
    public.twin_terminal_tick_uniqueness_v1,
    public.twin_scenario_set_uniqueness_v1
  TO geox_mcft_cap09_twin_runtime_v1;

-- Forecast/Scenario projections used by the canonical CAP-04 persistence/rebuild path.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE
    public.twin_forecast_run_projection_v1,
    public.twin_forecast_point_projection_v1,
    public.twin_scenario_set_projection_v1,
    public.twin_scenario_point_projection_v1,
    public.twin_scenario_latest_index_v1
  TO geox_mcft_cap09_twin_runtime_v1;

-- Explicit cross-plane denial. Twin Runtime consumes governed Evidence from facts;
-- it never owns Evidence producer lease, event ledger, or EvidenceSupplyCursor state.
REVOKE ALL PRIVILEGES
  ON TABLE
    public.external_evidence_producer_lease_v1,
    public.external_evidence_supply_event_v1,
    public.external_evidence_supply_cursor_v1
  FROM geox_mcft_cap09_twin_runtime_v1;

COMMENT ON ROLE geox_mcft_cap09_twin_runtime_v1 IS
  'MCFT-CAP-09 Phase4 Twin Runtime privilege role: canonical Twin/Forecast/Scenario + independent Runtime scheduler state only; governed Evidence read through facts; zero EvidenceSupplyCursor/provider-acquisition authority.';
