-- MCFT-CAP-09 forward-only ACL remediation.
-- Restores the Phase3 Evidence Runtime privilege surface unintentionally revoked
-- by the later V13 fenced-promotion deny-by-default ACL reset.
--
-- No new semantic authority is granted. This carries forward the exact Phase3
-- Evidence-plane privilege surface while preserving V13 forcing coordination
-- and the prohibition on arbitrary facts mutation.

DO $preflight$
DECLARE
  v_role record;
BEGIN
  SELECT rolcanlogin,rolinherit,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls
    INTO v_role
    FROM pg_catalog.pg_roles
   WHERE rolname='geox_mcft_cap09_evidence_runtime_v1';

  IF NOT FOUND
     OR v_role.rolcanlogin
     OR NOT v_role.rolinherit
     OR v_role.rolsuper
     OR v_role.rolcreatedb
     OR v_role.rolcreaterole
     OR v_role.rolreplication
     OR v_role.rolbypassrls THEN
    RAISE EXCEPTION 'MCFT_CAP09_EVIDENCE_RUNTIME_CARRYFORWARD_ROLE_UNSAFE';
  END IF;

  IF pg_catalog.to_regclass('public.facts') IS NULL
     OR pg_catalog.to_regclass('public.external_evidence_producer_lease_v1') IS NULL
     OR pg_catalog.to_regclass('public.external_evidence_supply_event_v1') IS NULL
     OR pg_catalog.to_regclass('public.external_evidence_supply_cursor_v1') IS NULL
     OR pg_catalog.to_regclass('public.twin_external_formal_forcing_base_cursor_v1') IS NULL
     OR pg_catalog.to_regclass('public.twin_external_formal_forcing_base_target_v1') IS NULL
     OR pg_catalog.to_regclass('public.twin_external_formal_forcing_controller_lease_v1') IS NULL THEN
    RAISE EXCEPTION 'MCFT_CAP09_EVIDENCE_RUNTIME_CARRYFORWARD_REQUIRED_TABLE_MISSING';
  END IF;

  IF pg_catalog.to_regprocedure(
    'public.mcft_cap09_evidence_runtime_append_fact_v1(text,text,text,text,text,text,text,bigint,text,timestamptz,jsonb)'
  ) IS NULL THEN
    RAISE EXCEPTION 'MCFT_CAP09_EVIDENCE_RUNTIME_CARRYFORWARD_PHASE3_FUNCTION_MISSING';
  END IF;
END
$preflight$;

GRANT SELECT
  ON TABLE public.facts
  TO geox_mcft_cap09_evidence_runtime_v1;

GRANT SELECT, INSERT, UPDATE
  ON TABLE
    public.external_evidence_producer_lease_v1,
    public.external_evidence_supply_event_v1,
    public.external_evidence_supply_cursor_v1,
    public.twin_external_formal_forcing_base_cursor_v1,
    public.twin_external_formal_forcing_base_target_v1,
    public.twin_external_formal_forcing_controller_lease_v1
  TO geox_mcft_cap09_evidence_runtime_v1;

GRANT EXECUTE ON FUNCTION public.mcft_cap09_evidence_runtime_append_fact_v1(
  text,text,text,text,text,text,text,bigint,text,timestamptz,jsonb
) TO geox_mcft_cap09_evidence_runtime_v1;

REVOKE INSERT, UPDATE, DELETE
  ON TABLE public.facts
  FROM geox_mcft_cap09_evidence_runtime_v1;

COMMENT ON ROLE geox_mcft_cap09_evidence_runtime_v1 IS
  'MCFT-CAP-09 Evidence Runtime role: Phase3 governed Evidence lease/supply/function authority plus V13 forcing coordination; no arbitrary facts INSERT or Twin Runtime state authority.';
