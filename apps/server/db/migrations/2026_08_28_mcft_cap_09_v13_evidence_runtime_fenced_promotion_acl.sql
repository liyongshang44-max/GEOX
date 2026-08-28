-- MCFT-CAP-09 post-merge v13: production-safe exact-base fact promotion for Evidence Runtime.
-- Evidence Runtime remains denied arbitrary public.facts INSERT. A NOLOGIN SECURITY DEFINER
-- owner holds only the narrow privileges needed to validate the current v13 controller/producer
-- fences and atomically append exactly weather + ET0 + soil for one causal base.

DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='geox_mcft_cap09_forcing_writer_owner_v1') THEN
    CREATE ROLE geox_mcft_cap09_forcing_writer_owner_v1
      NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END
$role$;

ALTER ROLE geox_mcft_cap09_forcing_writer_owner_v1
  NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

REVOKE ALL ON SCHEMA public FROM geox_mcft_cap09_forcing_writer_owner_v1;
GRANT USAGE ON SCHEMA public TO geox_mcft_cap09_forcing_writer_owner_v1;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM geox_mcft_cap09_forcing_writer_owner_v1;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM geox_mcft_cap09_forcing_writer_owner_v1;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM geox_mcft_cap09_forcing_writer_owner_v1;

GRANT SELECT,INSERT ON TABLE public.facts TO geox_mcft_cap09_forcing_writer_owner_v1;
GRANT SELECT,UPDATE ON TABLE
  public.twin_external_formal_forcing_controller_lease_v1,
  public.twin_external_formal_forcing_base_target_v1
TO geox_mcft_cap09_forcing_writer_owner_v1;

CREATE OR REPLACE FUNCTION public.mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1(
  p_tenant_id text,
  p_project_id text,
  p_group_id text,
  p_field_id text,
  p_season_id text,
  p_zone_id text,
  p_epoch_id text,
  p_subject_sha text,
  p_base_target_t timestamptz,
  p_controller_owner text,
  p_controller_fencing_token bigint,
  p_producer_owner text,
  p_producer_fencing_token bigint,
  p_idempotency_key text,
  p_facts jsonb
)
RETURNS TABLE(inserted_count integer, existing_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $function$
DECLARE
  v_controller_subject text;
  v_controller_state text;
  v_controller_owner text;
  v_controller_fence bigint;
  v_controller_expires timestamptz;
  v_target_subject text;
  v_target_base timestamptz;
  v_target_deadline timestamptz;
  v_target_state text;
  v_target_owner text;
  v_target_fence bigint;
  v_target_expires timestamptz;
  v_target_idempotency text;
  v_now timestamptz;
  v_item jsonb;
  v_record jsonb;
  v_payload jsonb;
  v_type text;
  v_fact_id text;
  v_event_time timestamptz;
  v_binding text;
  v_expected_epistemic text;
  v_existing_record jsonb;
  v_existing_occurred timestamptz;
  v_existing_source text;
  v_types text[];
  v_inserted integer := 0;
  v_existing integer := 0;
BEGIN
  IF p_tenant_id IS NULL OR btrim(p_tenant_id)=''
     OR p_project_id IS NULL OR btrim(p_project_id)=''
     OR p_group_id IS NULL OR btrim(p_group_id)=''
     OR p_field_id IS NULL OR btrim(p_field_id)=''
     OR p_season_id IS NULL OR btrim(p_season_id)=''
     OR p_zone_id IS NULL OR btrim(p_zone_id)=''
     OR p_epoch_id IS NULL OR btrim(p_epoch_id)=''
     OR p_subject_sha IS NULL OR p_subject_sha !~ '^[0-9a-f]{40}$'
     OR p_base_target_t IS NULL OR date_trunc('hour',p_base_target_t)<>p_base_target_t
     OR p_controller_owner IS NULL OR btrim(p_controller_owner)=''
     OR p_controller_fencing_token IS NULL OR p_controller_fencing_token<=0
     OR p_producer_owner IS NULL OR btrim(p_producer_owner)=''
     OR p_producer_fencing_token IS NULL OR p_producer_fencing_token<=0
     OR p_idempotency_key IS NULL OR btrim(p_idempotency_key)=''
     OR jsonb_typeof(p_facts)<>'array'
     OR jsonb_array_length(p_facts)<>3 THEN
    RAISE EXCEPTION 'V13_EVIDENCE_FENCED_WRITER_ARGUMENT_INVALID';
  END IF;

  SELECT subject_sha,lifecycle_state,lease_owner,fencing_token,lease_expires_at
    INTO v_controller_subject,v_controller_state,v_controller_owner,v_controller_fence,v_controller_expires
    FROM public.twin_external_formal_forcing_controller_lease_v1
   WHERE tenant_id=p_tenant_id AND project_id=p_project_id AND group_id=p_group_id
     AND field_id=p_field_id AND season_id=p_season_id AND zone_id=p_zone_id AND epoch_id=p_epoch_id
   FOR UPDATE;
  IF NOT FOUND OR v_controller_subject<>p_subject_sha OR v_controller_state<>'ACTIVE'
     OR v_controller_owner<>p_controller_owner OR v_controller_fence<>p_controller_fencing_token
     OR v_controller_expires IS NULL THEN
    RAISE EXCEPTION 'V13_EVIDENCE_FENCED_WRITER_CONTROLLER_STALE_FENCE';
  END IF;

  SELECT subject_sha,base_target_t,causal_deadline,state,claim_owner,fencing_token,lease_expires_at,idempotency_key
    INTO v_target_subject,v_target_base,v_target_deadline,v_target_state,v_target_owner,v_target_fence,v_target_expires,v_target_idempotency
    FROM public.twin_external_formal_forcing_base_target_v1
   WHERE tenant_id=p_tenant_id AND project_id=p_project_id AND group_id=p_group_id
     AND field_id=p_field_id AND season_id=p_season_id AND zone_id=p_zone_id AND epoch_id=p_epoch_id
     AND base_target_t=p_base_target_t
   FOR UPDATE;
  IF NOT FOUND OR v_target_subject<>p_subject_sha OR v_target_base<>p_base_target_t
     OR v_target_deadline<>p_base_target_t OR v_target_state<>'PROMOTING'
     OR v_target_owner<>p_producer_owner OR v_target_fence<>p_producer_fencing_token
     OR v_target_idempotency<>p_idempotency_key OR v_target_expires IS NULL THEN
    RAISE EXCEPTION 'V13_EVIDENCE_FENCED_WRITER_PRODUCER_STALE_FENCE_OR_STATE';
  END IF;

  v_now:=clock_timestamp();
  IF v_now>=p_base_target_t OR v_controller_expires<=v_now OR v_target_expires<=v_now THEN
    RAISE EXCEPTION 'V13_EVIDENCE_FENCED_WRITER_CAUSAL_OR_LEASE_DEADLINE_REACHED';
  END IF;

  SELECT array_agg(elem->'record_json'->>'type' ORDER BY elem->'record_json'->>'type')
    INTO v_types
    FROM jsonb_array_elements(p_facts) elem;
  IF v_types IS DISTINCT FROM ARRAY[
    'future_et0_assumption_v1',
    'future_weather_assumption_v1',
    'soil_moisture_observation_v1'
  ]::text[] THEN
    RAISE EXCEPTION 'V13_EVIDENCE_FENCED_WRITER_EXACT_THREE_TYPES_REQUIRED';
  END IF;

  -- Validate all three records before the first fact mutation.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_facts)
  LOOP
    v_fact_id:=btrim(COALESCE(v_item->>'fact_id',''));
    v_record:=v_item->'record_json';
    IF v_fact_id !~ '^fact_external_evidence_[0-9a-f]{64}$' OR jsonb_typeof(v_record)<>'object' THEN
      RAISE EXCEPTION 'V13_EVIDENCE_FENCED_WRITER_FACT_ENVELOPE_INVALID';
    END IF;
    BEGIN
      v_event_time:=(v_item->>'occurred_at')::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'V13_EVIDENCE_FENCED_WRITER_OCCURRED_AT_INVALID';
    END;
    IF v_event_time IS NULL THEN
      RAISE EXCEPTION 'V13_EVIDENCE_FENCED_WRITER_OCCURRED_AT_REQUIRED';
    END IF;

    v_type:=COALESCE(v_record->>'type','');
    v_payload:=v_record->'payload';
    IF jsonb_typeof(v_payload)<>'object' OR COALESCE(v_payload->>'record_type','')<>v_type THEN
      RAISE EXCEPTION 'V13_EVIDENCE_FENCED_WRITER_RECORD_TYPE_MISMATCH';
    END IF;

    v_binding:=CASE v_type
      WHEN 'future_weather_assumption_v1' THEN 'noaa_ncep_gfs_pgrb2_kbs_nearest_72h_v1'
      WHEN 'future_et0_assumption_v1' THEN 'noaa_ncep_gfs_asce_short_reference_et_same_cycle_72h_v1'
      WHEN 'soil_moisture_observation_v1' THEN 'kbs_lter_variate25_vwc_100mm_v1'
      ELSE NULL
    END;
    v_expected_epistemic:=CASE v_type
      WHEN 'soil_moisture_observation_v1' THEN 'OBSERVED'
      ELSE 'ASSUMED'
    END;

    IF v_binding IS NULL OR COALESCE(v_payload->>'binding_id','')<>v_binding
       OR COALESCE(v_payload->>'epistemic_class','')<>v_expected_epistemic
       OR COALESCE(v_payload->'quality'->>'status','') NOT IN ('PASS','LIMITED') THEN
      RAISE EXCEPTION 'V13_EVIDENCE_FENCED_WRITER_AUTHORITY_NOT_AUTHORIZED:%',v_type;
    END IF;

    IF COALESCE(v_payload->>'tenant_id','')<>p_tenant_id
       OR COALESCE(v_payload->>'project_id','')<>p_project_id
       OR COALESCE(v_payload->>'group_id','')<>p_group_id
       OR COALESCE(v_payload->>'field_id','')<>p_field_id
       OR COALESCE(v_payload->>'season_id','')<>p_season_id
       OR COALESCE(v_payload->>'zone_id','')<>p_zone_id THEN
      RAISE EXCEPTION 'V13_EVIDENCE_FENCED_WRITER_SCOPE_MISMATCH';
    END IF;

    IF btrim(COALESCE(v_payload->>'dataset_id',''))=''
       OR btrim(COALESCE(v_payload->>'source_record_id',''))=''
       OR COALESCE(v_payload->>'source_record_hash','') !~ '^sha256:[0-9a-f]{64}$'
       OR COALESCE(v_payload->'quality'->>'raw_source_sha256','') !~ '^sha256:[0-9a-f]{64}$'
       OR COALESCE(v_payload->'quality'->>'raw_retention_ref','') !~ '^s3-private://'
       OR COALESCE(v_payload->'quality'->>'raw_payload_embedded','true')<>'false'
       OR COALESCE(v_payload->'source_payload'->'raw_provenance'->>'raw_sha256','')
            <> COALESCE(v_payload->'quality'->>'raw_source_sha256','')
       OR COALESCE(v_payload->'source_payload'->'raw_provenance'->>'retention_ref','')
            <> COALESCE(v_payload->'quality'->>'raw_retention_ref','')
       OR COALESCE(v_payload->'source_payload'->'raw_provenance'->>'raw_payload_embedded','true')<>'false' THEN
      RAISE EXCEPTION 'V13_EVIDENCE_FENCED_WRITER_PROVENANCE_REQUIRED';
    END IF;

    IF v_type IN ('future_weather_assumption_v1','future_et0_assumption_v1') THEN
      IF COALESCE(v_payload->'role_time'->>'valid_from','')=''
         OR (v_payload->'role_time'->>'valid_from')::timestamptz<>p_base_target_t THEN
        RAISE EXCEPTION 'V13_EVIDENCE_FENCED_WRITER_FUTURE_VALID_FROM_MISMATCH:%',v_type;
      END IF;
    ELSE
      IF COALESCE(v_payload->'role_time'->>'observed_at','')=''
         OR (v_payload->'role_time'->>'observed_at')::timestamptz>p_base_target_t THEN
        RAISE EXCEPTION 'V13_EVIDENCE_FENCED_WRITER_SOIL_AFTER_BASE_FORBIDDEN';
      END IF;
    END IF;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_facts)
  LOOP
    v_now:=clock_timestamp();
    IF v_now>=p_base_target_t OR v_controller_expires<=v_now OR v_target_expires<=v_now THEN
      RAISE EXCEPTION 'V13_EVIDENCE_FENCED_WRITER_LEASE_EXPIRED_DURING_ATOMIC_APPEND';
    END IF;
    v_fact_id:=btrim(v_item->>'fact_id');
    v_event_time:=(v_item->>'occurred_at')::timestamptz;
    v_record:=v_item->'record_json';

    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_fact_id,0));
    SELECT record_json,occurred_at,source
      INTO v_existing_record,v_existing_occurred,v_existing_source
      FROM public.facts
     WHERE fact_id=v_fact_id;
    IF FOUND THEN
      IF v_existing_record<>v_record OR v_existing_occurred<>v_event_time
         OR v_existing_source<>'mcft_cap09_external_formal_evidence_v1' THEN
        RAISE EXCEPTION 'V13_EVIDENCE_FENCED_WRITER_FACT_IDENTITY_CONFLICT';
      END IF;
      v_existing:=v_existing+1;
    ELSE
      INSERT INTO public.facts(fact_id,occurred_at,source,record_json)
      VALUES(v_fact_id,v_event_time,'mcft_cap09_external_formal_evidence_v1',v_record);
      v_inserted:=v_inserted+1;
    END IF;
  END LOOP;

  v_now:=clock_timestamp();
  IF v_now>=p_base_target_t OR v_controller_expires<=v_now OR v_target_expires<=v_now THEN
    RAISE EXCEPTION 'V13_EVIDENCE_FENCED_WRITER_PRECOMMIT_DEADLINE_REACHED';
  END IF;
  IF v_inserted+v_existing<>3 THEN
    RAISE EXCEPTION 'V13_EVIDENCE_FENCED_WRITER_EXACT_THREE_PRESENT_REQUIRED';
  END IF;

  RETURN QUERY SELECT v_inserted,v_existing;
END
$function$;

ALTER FUNCTION public.mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1(
  text,text,text,text,text,text,text,text,timestamptz,text,bigint,text,bigint,text,jsonb
) OWNER TO geox_mcft_cap09_forcing_writer_owner_v1;

REVOKE ALL ON FUNCTION public.mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1(
  text,text,text,text,text,text,text,text,timestamptz,text,bigint,text,bigint,text,jsonb
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1(
  text,text,text,text,text,text,text,text,timestamptz,text,bigint,text,bigint,text,jsonb
) TO geox_mcft_cap09_evidence_runtime_v1;

DO $revoke_twin$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='geox_mcft_cap09_twin_runtime_v1') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1(text,text,text,text,text,text,text,text,timestamptz,text,bigint,text,bigint,text,jsonb) FROM geox_mcft_cap09_twin_runtime_v1';
  END IF;
END
$revoke_twin$;

COMMENT ON ROLE geox_mcft_cap09_forcing_writer_owner_v1 IS
  'MCFT-CAP-09 post-merge v13 NOLOGIN exact-base forcing writer owner: narrow facts append plus forcing row-lock authority only.';
COMMENT ON FUNCTION public.mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1(
  text,text,text,text,text,text,text,text,timestamptz,text,bigint,text,bigint,text,jsonb
) IS
  'Evidence Runtime-only exact-base append: current controller+producer fences, exact three governed forcing facts, one transaction, zero cursor advancement.';
