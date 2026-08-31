DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='geox_mcft_cap09_twin_writer_owner_v1') THEN
    CREATE ROLE geox_mcft_cap09_twin_writer_owner_v1 NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END
$role$;
ALTER ROLE geox_mcft_cap09_twin_writer_owner_v1 NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON TABLE public.facts FROM geox_mcft_cap09_twin_runtime_v1;
GRANT SELECT ON TABLE public.facts TO geox_mcft_cap09_twin_runtime_v1;

REVOKE ALL ON SCHEMA public FROM geox_mcft_cap09_twin_writer_owner_v1;
GRANT USAGE ON SCHEMA public TO geox_mcft_cap09_twin_writer_owner_v1;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM geox_mcft_cap09_twin_writer_owner_v1;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM geox_mcft_cap09_twin_writer_owner_v1;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM geox_mcft_cap09_twin_writer_owner_v1;
GRANT SELECT,INSERT ON TABLE public.facts TO geox_mcft_cap09_twin_writer_owner_v1;
GRANT SELECT,UPDATE ON TABLE public.twin_runtime_lease_v1 TO geox_mcft_cap09_twin_writer_owner_v1;

CREATE OR REPLACE FUNCTION public.mcft_cap09_twin_runtime_append_fact_v1(
 p_tenant_id text,p_project_id text,p_group_id text,p_field_id text,p_season_id text,p_zone_id text,
 p_lease_owner text,p_fencing_token bigint,p_fact_id text,p_occurred_at timestamptz,p_record_json jsonb)
RETURNS TABLE(status text,canonical_fact_write_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public
AS $function$
DECLARE
 v_type text; v_payload jsonb; v_object_id text; v_logical_time timestamptz;
 v_existing_record jsonb; v_existing_occurred_at timestamptz; v_existing_source text;
 v_owner text; v_fence bigint; v_expires timestamptz;
BEGIN
 IF p_tenant_id IS NULL OR btrim(p_tenant_id)='' OR p_project_id IS NULL OR btrim(p_project_id)=''
 OR p_group_id IS NULL OR btrim(p_group_id)='' OR p_field_id IS NULL OR btrim(p_field_id)=''
 OR p_season_id IS NULL OR btrim(p_season_id)='' OR p_zone_id IS NULL OR btrim(p_zone_id)=''
 OR p_lease_owner IS NULL OR btrim(p_lease_owner)='' OR p_fencing_token IS NULL OR p_fencing_token<=0
 OR p_fact_id IS NULL OR btrim(p_fact_id)='' OR p_occurred_at IS NULL OR p_record_json IS NULL THEN
   RAISE EXCEPTION 'PHASE5_TWIN_DB_WRITER_ARGUMENT_INVALID';
 END IF;

 SELECT lease_owner,fencing_token,expires_at INTO v_owner,v_fence,v_expires
 FROM public.twin_runtime_lease_v1
 WHERE tenant_id=p_tenant_id AND project_id=p_project_id AND group_id=p_group_id
   AND field_id=p_field_id AND season_id=p_season_id AND zone_id=p_zone_id FOR UPDATE;
 IF NOT FOUND OR v_owner<>p_lease_owner OR v_fence<>p_fencing_token OR v_expires<=transaction_timestamp() THEN
   RAISE EXCEPTION 'PHASE5_TWIN_DB_WRITER_STALE_FENCE';
 END IF;

 IF jsonb_typeof(p_record_json)<>'object' THEN RAISE EXCEPTION 'PHASE5_TWIN_DB_WRITER_ENVELOPE_OBJECT_REQUIRED'; END IF;
 v_type:=p_record_json->>'type'; v_payload:=p_record_json->'payload';
 IF jsonb_typeof(v_payload)<>'object' THEN RAISE EXCEPTION 'PHASE5_TWIN_DB_WRITER_PAYLOAD_OBJECT_REQUIRED'; END IF;
 IF COALESCE(v_payload->>'object_type','')<>COALESCE(v_type,'') THEN RAISE EXCEPTION 'PHASE5_TWIN_DB_WRITER_OBJECT_TYPE_MISMATCH'; END IF;
 IF v_type NOT IN ('twin_evidence_window_v1','twin_state_transition_v1','twin_assimilation_update_v1',
 'twin_state_estimate_v1','twin_forecast_run_v1','twin_runtime_tick_v1','twin_runtime_checkpoint_v1',
 'twin_runtime_health_v1','twin_scenario_set_v1') THEN
   RAISE EXCEPTION 'PHASE5_TWIN_DB_WRITER_OBJECT_TYPE_NOT_AUTHORIZED:%',COALESCE(v_type,'<null>');
 END IF;
 IF COALESCE(v_payload->>'tenant_id','')<>p_tenant_id OR COALESCE(v_payload->>'project_id','')<>p_project_id
 OR COALESCE(v_payload->>'group_id','')<>p_group_id OR COALESCE(v_payload->>'field_id','')<>p_field_id
 OR COALESCE(v_payload->>'season_id','')<>p_season_id OR COALESCE(v_payload->>'zone_id','')<>p_zone_id THEN
   RAISE EXCEPTION 'PHASE5_TWIN_DB_WRITER_SCOPE_MISMATCH';
 END IF;
 v_object_id:=COALESCE(v_payload->>'object_id','');
 IF v_object_id='' OR p_fact_id<>('fact_'||v_object_id) THEN RAISE EXCEPTION 'PHASE5_TWIN_DB_WRITER_FACT_ID_MISMATCH'; END IF;
 BEGIN v_logical_time:=(v_payload->>'logical_time')::timestamptz;
 EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'PHASE5_TWIN_DB_WRITER_LOGICAL_TIME_INVALID'; END;
 IF v_logical_time IS NULL OR v_logical_time<>p_occurred_at THEN RAISE EXCEPTION 'PHASE5_TWIN_DB_WRITER_LOGICAL_TIME_MISMATCH'; END IF;

 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_fact_id,0));
 SELECT record_json,occurred_at,source INTO v_existing_record,v_existing_occurred_at,v_existing_source
 FROM public.facts WHERE fact_id=p_fact_id;
 IF FOUND THEN
   IF v_existing_record<>p_record_json OR v_existing_occurred_at<>p_occurred_at OR v_existing_source<>'system' THEN
     RAISE EXCEPTION 'PHASE5_TWIN_DB_WRITER_FACT_IDENTITY_CONFLICT';
   END IF;
   RETURN QUERY SELECT 'EXISTING_IDEMPOTENT_SUCCESS'::text,0::integer; RETURN;
 END IF;
 INSERT INTO public.facts(fact_id,occurred_at,source,record_json) VALUES(p_fact_id,p_occurred_at,'system',p_record_json);
 RETURN QUERY SELECT 'INSERTED'::text,1::integer;
END
$function$;
-- Keep schema CREATE as a temporary provisioning-only capability required
-- for PostgreSQL OWNER transfer; the NOLOGIN writer owner must not retain it.
GRANT CREATE ON SCHEMA public TO geox_mcft_cap09_twin_writer_owner_v1;
ALTER FUNCTION public.mcft_cap09_twin_runtime_append_fact_v1(text,text,text,text,text,text,text,bigint,text,timestamptz,jsonb)
 OWNER TO geox_mcft_cap09_twin_writer_owner_v1;
REVOKE CREATE ON SCHEMA public FROM geox_mcft_cap09_twin_writer_owner_v1;
REVOKE ALL ON FUNCTION public.mcft_cap09_twin_runtime_append_fact_v1(text,text,text,text,text,text,text,bigint,text,timestamptz,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcft_cap09_twin_runtime_append_fact_v1(text,text,text,text,text,text,text,bigint,text,timestamptz,jsonb) FROM geox_mcft_cap09_twin_writer_owner_v1;
GRANT EXECUTE ON FUNCTION public.mcft_cap09_twin_runtime_append_fact_v1(text,text,text,text,text,text,text,bigint,text,timestamptz,jsonb) TO geox_mcft_cap09_twin_runtime_v1;
COMMENT ON ROLE geox_mcft_cap09_twin_writer_owner_v1 IS 'MCFT-CAP-09 Phase5 NOLOGIN fenced Twin canonical fact writer owner.';
