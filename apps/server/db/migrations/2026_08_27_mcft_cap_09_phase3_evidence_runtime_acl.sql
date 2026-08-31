-- MCFT-CAP-09 Production Hosting Phase 3: Evidence Runtime database ACL.
-- Boundary: Evidence Runtime gets no arbitrary public.facts writer authority.
-- Canonical External Evidence append is available only through a fenced, SECURITY DEFINER
-- function whose owner has a deliberately narrow fact/lease privilege set.

DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'geox_mcft_cap09_evidence_runtime_v1') THEN
    CREATE ROLE geox_mcft_cap09_evidence_runtime_v1
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'geox_mcft_cap09_evidence_writer_owner_v1') THEN
    CREATE ROLE geox_mcft_cap09_evidence_writer_owner_v1
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END
$role$;

REVOKE ALL ON SCHEMA public FROM geox_mcft_cap09_evidence_runtime_v1;
REVOKE ALL ON SCHEMA public FROM geox_mcft_cap09_evidence_writer_owner_v1;
GRANT USAGE ON SCHEMA public TO geox_mcft_cap09_evidence_runtime_v1;
GRANT USAGE ON SCHEMA public TO geox_mcft_cap09_evidence_writer_owner_v1;

-- Deny-by-default over all currently materialized application objects.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM geox_mcft_cap09_evidence_runtime_v1;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM geox_mcft_cap09_evidence_runtime_v1;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM geox_mcft_cap09_evidence_runtime_v1;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM geox_mcft_cap09_evidence_writer_owner_v1;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM geox_mcft_cap09_evidence_writer_owner_v1;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM geox_mcft_cap09_evidence_writer_owner_v1;

-- Evidence Runtime may read governed facts for fresh post-COMMIT visibility.
-- It MUST NOT have arbitrary INSERT/UPDATE/DELETE authority on public.facts.
GRANT SELECT
  ON TABLE public.facts
  TO geox_mcft_cap09_evidence_runtime_v1;

-- Evidence-plane mutable ownership and durable supply state.
GRANT SELECT, INSERT, UPDATE
  ON TABLE public.external_evidence_producer_lease_v1
  TO geox_mcft_cap09_evidence_runtime_v1;

GRANT SELECT, INSERT, UPDATE
  ON TABLE public.external_evidence_supply_event_v1
  TO geox_mcft_cap09_evidence_runtime_v1;

GRANT SELECT, INSERT, UPDATE
  ON TABLE public.external_evidence_supply_cursor_v1
  TO geox_mcft_cap09_evidence_runtime_v1;

-- Phase7 production forcing ownership remains inside the Evidence plane.
-- These relations coordinate exact-base provider acquisition and physical ingress.
-- They are explicitly denied to Twin Runtime by the Phase4 ACL migration.
GRANT SELECT, INSERT, UPDATE
  ON TABLE
    public.twin_external_formal_forcing_base_cursor_v1,
    public.twin_external_formal_forcing_base_target_v1,
    public.twin_external_formal_forcing_controller_lease_v1
  TO geox_mcft_cap09_evidence_runtime_v1;

-- The SECURITY DEFINER owner is NOLOGIN and has only the privileges needed to
-- verify the Evidence producer fence and append/read an External Evidence fact.
GRANT SELECT, INSERT
  ON TABLE public.facts
  TO geox_mcft_cap09_evidence_writer_owner_v1;

GRANT SELECT, UPDATE
  ON TABLE public.external_evidence_producer_lease_v1
  TO geox_mcft_cap09_evidence_writer_owner_v1;

CREATE OR REPLACE FUNCTION public.mcft_cap09_evidence_runtime_append_fact_v1(
  p_tenant_id text,
  p_project_id text,
  p_group_id text,
  p_field_id text,
  p_season_id text,
  p_zone_id text,
  p_lease_owner text,
  p_fencing_token bigint,
  p_fact_id text,
  p_occurred_at timestamptz,
  p_record_json jsonb
)
RETURNS TABLE(status text, canonical_fact_write_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_type text;
  v_payload jsonb;
  v_expected_binding text;
  v_existing_record jsonb;
  v_existing_occurred_at timestamptz;
  v_existing_source text;
  v_lease_owner text;
  v_fencing_token bigint;
  v_expires_at timestamptz;
BEGIN
  IF p_tenant_id IS NULL OR btrim(p_tenant_id) = ''
     OR p_project_id IS NULL OR btrim(p_project_id) = ''
     OR p_group_id IS NULL OR btrim(p_group_id) = ''
     OR p_field_id IS NULL OR btrim(p_field_id) = ''
     OR p_season_id IS NULL OR btrim(p_season_id) = ''
     OR p_zone_id IS NULL OR btrim(p_zone_id) = ''
     OR p_lease_owner IS NULL OR btrim(p_lease_owner) = ''
     OR p_fencing_token IS NULL OR p_fencing_token <= 0
     OR p_fact_id IS NULL OR btrim(p_fact_id) = ''
     OR p_occurred_at IS NULL
     OR p_record_json IS NULL THEN
    RAISE EXCEPTION 'PHASE3_EVIDENCE_DB_INGRESS_ARGUMENT_INVALID';
  END IF;

  -- Fence is checked under row lock in the SAME transaction that may append the fact.
  SELECT lease_owner, fencing_token, expires_at
    INTO v_lease_owner, v_fencing_token, v_expires_at
    FROM public.external_evidence_producer_lease_v1
   WHERE tenant_id = p_tenant_id
     AND project_id = p_project_id
     AND group_id = p_group_id
     AND field_id = p_field_id
     AND season_id = p_season_id
     AND zone_id = p_zone_id
   FOR UPDATE;

  IF NOT FOUND
     OR v_lease_owner <> p_lease_owner
     OR v_fencing_token <> p_fencing_token
     OR v_expires_at <= transaction_timestamp() THEN
    RAISE EXCEPTION 'PHASE3_EVIDENCE_DB_INGRESS_STALE_FENCE';
  END IF;

  IF jsonb_typeof(p_record_json) <> 'object' THEN
    RAISE EXCEPTION 'PHASE3_EVIDENCE_DB_INGRESS_ENVELOPE_OBJECT_REQUIRED';
  END IF;
  v_type := p_record_json ->> 'type';
  v_payload := p_record_json -> 'payload';
  IF jsonb_typeof(v_payload) <> 'object' THEN
    RAISE EXCEPTION 'PHASE3_EVIDENCE_DB_INGRESS_PAYLOAD_OBJECT_REQUIRED';
  END IF;
  IF COALESCE(v_payload ->> 'record_type', '') <> COALESCE(v_type, '') THEN
    RAISE EXCEPTION 'PHASE3_EVIDENCE_DB_INGRESS_RECORD_TYPE_MISMATCH';
  END IF;

  v_expected_binding := CASE v_type
    WHEN 'soil_moisture_observation_v1' THEN 'kbs_lter_variate25_vwc_100mm_v1'
    WHEN 'observed_rainfall_v1' THEN 'kbs_lter_raw_hourly_rain_mm_v1'
    WHEN 'historical_et0_estimate_v1' THEN 'kbs_lter_asce_short_reference_et_hourly_v1'
    WHEN 'future_weather_assumption_v1' THEN 'noaa_ncep_gfs_pgrb2_kbs_nearest_72h_v1'
    WHEN 'future_et0_assumption_v1' THEN 'noaa_ncep_gfs_asce_short_reference_et_same_cycle_72h_v1'
    ELSE NULL
  END;
  IF v_expected_binding IS NULL THEN
    RAISE EXCEPTION 'PHASE3_EVIDENCE_DB_INGRESS_RECORD_TYPE_NOT_AUTHORIZED:%', COALESCE(v_type, '<null>');
  END IF;
  IF COALESCE(v_payload ->> 'binding_id', '') <> v_expected_binding THEN
    RAISE EXCEPTION 'PHASE3_EVIDENCE_DB_INGRESS_BINDING_NOT_AUTHORIZED:%', COALESCE(v_type, '<null>');
  END IF;

  IF COALESCE(v_payload ->> 'tenant_id', '') <> p_tenant_id
     OR COALESCE(v_payload ->> 'project_id', '') <> p_project_id
     OR COALESCE(v_payload ->> 'group_id', '') <> p_group_id
     OR COALESCE(v_payload ->> 'field_id', '') <> p_field_id
     OR COALESCE(v_payload ->> 'season_id', '') <> p_season_id
     OR COALESCE(v_payload ->> 'zone_id', '') <> p_zone_id THEN
    RAISE EXCEPTION 'PHASE3_EVIDENCE_DB_INGRESS_SCOPE_MISMATCH';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_fact_id, 0));

  SELECT record_json, occurred_at, source
    INTO v_existing_record, v_existing_occurred_at, v_existing_source
    FROM public.facts
   WHERE fact_id = p_fact_id;

  IF FOUND THEN
    IF v_existing_record <> p_record_json
       OR v_existing_occurred_at <> p_occurred_at
       OR v_existing_source <> 'mcft_cap09_external_formal_evidence_v1' THEN
      RAISE EXCEPTION 'PHASE3_EVIDENCE_DB_INGRESS_FACT_IDENTITY_CONFLICT';
    END IF;
    RETURN QUERY SELECT 'EXISTING_IDEMPOTENT_SUCCESS'::text, 0::integer;
    RETURN;
  END IF;

  INSERT INTO public.facts (fact_id, occurred_at, source, record_json)
  VALUES (
    p_fact_id,
    p_occurred_at,
    'mcft_cap09_external_formal_evidence_v1',
    p_record_json
  );

  RETURN QUERY SELECT 'INSERTED'::text, 1::integer;
END
$function$;

-- PostgreSQL requires the new function owner to have CREATE on the containing
-- schema during OWNER transfer. Grant it only for that ownership window.
GRANT CREATE ON SCHEMA public TO geox_mcft_cap09_evidence_writer_owner_v1;
ALTER FUNCTION public.mcft_cap09_evidence_runtime_append_fact_v1(
  text,text,text,text,text,text,text,bigint,text,timestamptz,jsonb
) OWNER TO geox_mcft_cap09_evidence_writer_owner_v1;
REVOKE CREATE ON SCHEMA public FROM geox_mcft_cap09_evidence_writer_owner_v1;

REVOKE ALL ON FUNCTION public.mcft_cap09_evidence_runtime_append_fact_v1(
  text,text,text,text,text,text,text,bigint,text,timestamptz,jsonb
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcft_cap09_evidence_runtime_append_fact_v1(
  text,text,text,text,text,text,text,bigint,text,timestamptz,jsonb
) FROM geox_mcft_cap09_evidence_writer_owner_v1;
GRANT EXECUTE ON FUNCTION public.mcft_cap09_evidence_runtime_append_fact_v1(
  text,text,text,text,text,text,text,bigint,text,timestamptz,jsonb
) TO geox_mcft_cap09_evidence_runtime_v1;

COMMENT ON ROLE geox_mcft_cap09_evidence_runtime_v1 IS
  'MCFT-CAP-09 Evidence Runtime role: governed Evidence function + facts readback + Evidence lease/supply cursor + v13 forcing acquisition cursor/target/controller state; no arbitrary facts INSERT or Twin Runtime state authority.';

COMMENT ON ROLE geox_mcft_cap09_evidence_writer_owner_v1 IS
  'MCFT-CAP-09 Phase3 NOLOGIN SECURITY DEFINER owner: narrow External Evidence fact append authority only.';

COMMENT ON FUNCTION public.mcft_cap09_evidence_runtime_append_fact_v1(
  text,text,text,text,text,text,text,bigint,text,timestamptz,jsonb
) IS
  'Phase3 fenced External Evidence-only fact append. Rejects stale owner before INSERT and rejects all non-authorized/Twin canonical fact families.';
