-- MCFT-CAP-09 Production Hosting Phase 3: Evidence Runtime database ACL.
-- Boundary: dedicated Evidence-plane role only. This migration grants no Twin Runtime,
-- scheduler, RuntimeTickCursor, action, approval, dispatch, or schema-mutation authority.

DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'geox_mcft_cap09_evidence_runtime_v1') THEN
    CREATE ROLE geox_mcft_cap09_evidence_runtime_v1 NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END
$role$;

REVOKE ALL ON SCHEMA public FROM geox_mcft_cap09_evidence_runtime_v1;
GRANT USAGE ON SCHEMA public TO geox_mcft_cap09_evidence_runtime_v1;

-- Deny-by-default over all currently materialized application objects.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM geox_mcft_cap09_evidence_runtime_v1;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM geox_mcft_cap09_evidence_runtime_v1;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM geox_mcft_cap09_evidence_runtime_v1;

-- Canonical Evidence ingress + fresh post-COMMIT visibility only.
GRANT SELECT, INSERT
  ON TABLE public.facts
  TO geox_mcft_cap09_evidence_runtime_v1;

-- Evidence-plane mutable ownership and durable supply watermark only.
GRANT SELECT, INSERT, UPDATE
  ON TABLE public.external_evidence_producer_lease_v1
  TO geox_mcft_cap09_evidence_runtime_v1;

GRANT SELECT, INSERT, UPDATE
  ON TABLE public.external_evidence_supply_cursor_v1
  TO geox_mcft_cap09_evidence_runtime_v1;

COMMENT ON ROLE geox_mcft_cap09_evidence_runtime_v1 IS
  'MCFT-CAP-09 Phase3 Evidence Runtime role: facts append/read + Evidence producer lease/supply cursor only; no Twin Runtime authority.';
