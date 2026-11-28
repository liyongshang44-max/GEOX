// Read-only resolution of existing customer field/crop/soil/device source indexes.
// This resolver never derives FC/PWP/root depth or treats a point sensor as a root-zone mean.
import type { Pool } from "pg";
import type { FieldTwinScopeV1 } from "../../domain/field_twin_read_model/contracts_v1.js";
import { PostgresFieldTwinSnapshotRepositoryV1 } from "../../repositories/field_twin_read_model/postgres_field_twin_snapshot_repository_v1.js";
import { mapSoilHydraulicProfileRowV1, validateSoilHydraulicProfileV1 } from "../../projections/soil_hydraulic_profile_v1.js";
import type { CustomerSoilMeasurementBindingV1 } from "./customer_soil_evidence_ingress_v1.js";
type Scope = FieldTwinScopeV1;
type Profile = ReturnType<typeof mapSoilHydraulicProfileRowV1>;
type CropPayload = Record<string, unknown>;
type SourceFact = { fact_id: string; occurred_at: Date | string; record_json: unknown };
export type CustomerNativeParameterSourceResolutionV1 = {
  schema_version: "mcft_customer_native_parameter_source_resolution_v1";
  status: "SOURCE_CONTEXT_RESOLVED_PARAMETERS_INCOMPLETE" | "SOURCE_CONTEXT_INCOMPLETE" | "SOURCE_CONTEXT_AMBIGUOUS";
  scope: Scope; logical_time: string;
  field: { status: "EXACT" | "MISSING" | "AMBIGUOUS"; field_id: string; project_id: string; group_id: string; source: "field_index_v1" };
  crop_context: { status: "EXACT" | "MISSING" | "AMBIGUOUS" | "INVALID"; source_fact_ref: string | null; occurred_at: string | null; time_basis: "FACT_OCCURRED_AT_ONLY" | "NOT_AVAILABLE"; crop_code: string | null; variety_code: string | null; crop_stage: string | null; crop_status: string | null; source: string | null };
  soil_hydraulic_profiles: { status: "EXACT_SOURCE_FACTS" | "INDEX_ONLY" | "MISSING"; records: readonly {
    profile_id: string; layer_depth_cm: number; texture_class: string; theta_r: number; theta_s: number; alpha_per_kpa: number; n: number; m: number;
    parameter_source: string; calibration_status: string; confidence_level: string; confidence_score: number;
    source_fact_ref: string | null; source_fact_status: "EXACT" | "MISSING" | "NOT_VISIBLE" | "MISMATCH";
    evidence_refs: readonly string[]; updated_at: string | null; effective_interval: "NOT_DECLARED"; validation_errors: readonly string[];
  }[] };
  device_binding: { status: "EXACT_FIELD_BINDING" | "MISSING" | "MISMATCH" | "AMBIGUOUS"; device_id: string | null; binding_id: string | null;
    field_bound_ts_ms: number | null; installation_ref: string | null; installation_authority: "NOT_ESTABLISHED_IN_CURRENT_SCHEMA";
    measurement_depth_mm: number | null; measurement_depth_authority: "CALLER_SUPPLIED_NOT_VERIFIED"; effective_from: string | null; effective_until: string | null };
  parameter_availability: { root_zone_depth_mm: "MISSING"; field_capacity_fraction: "MISSING"; wilting_point_fraction: "MISSING";
    saturation_fraction: "LAYER_VALUES_ONLY_NOT_ROOT_ZONE_AGGREGATED"; crop_kc: "MISSING";
    dynamics_parameters: "TEST_ONLY_NOT_CUSTOMER_SOURCED"; zone_spatial_support: "NOT_ESTABLISHED"; installation_support: "NOT_ESTABLISHED" };
  blocking_reasons: readonly string[]; runtime_config_buildable: false; prediction_authorized_from_these_sources: false;
};
function text(value: unknown): string | null { const s=String(value??"").trim(); return s||null; }
function parseRecord(value: unknown): Record<string, unknown> | null {
  if(value&&typeof value==="object"&&!Array.isArray(value))return value as Record<string,unknown>;
  if(typeof value==="string"){try{const v=JSON.parse(value);return v&&typeof v==="object"&&!Array.isArray(v)?v:null;}catch{return null;}}
  return null;
}
function parsePayload(value: unknown): CropPayload | null { return parseRecord(parseRecord(value)?.payload); }
function iso(value: unknown): string | null { const d=value instanceof Date?value:new Date(String(value??""));return Number.isFinite(d.getTime())?d.toISOString():null; }
function sameProfilePayload(p: CropPayload, x: Profile): boolean {
  return p.profile_id===x.profile_id&&p.tenant_id===x.tenant_id&&p.project_id===x.project_id&&p.group_id===x.group_id&&
    p.field_id===x.field_id&&p.zone_id===x.zone_id&&Number(p.layer_depth_cm)===x.layer_depth_cm&&
    Number(p.theta_r)===x.theta_r&&Number(p.theta_s)===x.theta_s&&Number(p.alpha_per_kpa)===x.alpha_per_kpa&&
    Number(p.n)===x.n&&Number(p.m)===x.m;
}
export async function resolveCustomerNativeParameterSourcesV1(input:{
  pool:Pool;scope:Scope;logical_time:string;bindings:readonly CustomerSoilMeasurementBindingV1[];
}):Promise<CustomerNativeParameterSourceResolutionV1>{
  const targetMs=Date.parse(input.logical_time);
  if(!Number.isFinite(targetMs)||new Date(targetMs).toISOString()!==input.logical_time)throw Error("CUSTOMER_PARAMETER_SOURCE_LOGICAL_TIME_INVALID");
  const blockers=new Set<string>();
  return new PostgresFieldTwinSnapshotRepositoryV1(input.pool).withReadOnlyRequestSnapshot(input.scope,async context=>{
    const scope=context.scope;
    const fieldRows=await context.client.query<Record<string,unknown>>(
      `SELECT tenant_id,project_id,group_id,field_id,status FROM public.field_index_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 ORDER BY field_id`,
      [scope.tenant_id,scope.project_id,scope.group_id,scope.field_id],
    ).catch(()=>({rows:[] as Record<string,unknown>[]}));
    const fieldStatus=fieldRows.rows.length===1&&fieldRows.rows[0].tenant_id===scope.tenant_id&&
      fieldRows.rows[0].project_id===scope.project_id&&fieldRows.rows[0].group_id===scope.group_id&&
      fieldRows.rows[0].field_id===scope.field_id&&String(fieldRows.rows[0].status??"").toUpperCase()==="ACTIVE"?"EXACT":
      fieldRows.rows.length>1?"AMBIGUOUS":"MISSING";
    if(fieldStatus!=="EXACT")blockers.add("FIELD_IDENTITY_NOT_EXACT");
    const bindings=input.bindings.filter(b=>b.scope.tenant_id===scope.tenant_id&&b.scope.project_id===scope.project_id&&
      b.scope.group_id===scope.group_id&&b.scope.field_id===scope.field_id&&b.scope.season_id===scope.season_id&&b.scope.zone_id===scope.zone_id);
    const binding=bindings.length===1?bindings[0]:null;
    if(bindings.length!==1)blockers.add(bindings.length===0?"CUSTOMER_DEVICE_BINDING_NOT_SUPPLIED":"CUSTOMER_DEVICE_BINDING_AMBIGUOUS");
    let deviceStatus:"EXACT_FIELD_BINDING"|"MISSING"|"MISMATCH"|"AMBIGUOUS"="MISSING";
    let boundTs:number|null=null;
    if(binding){
      const rows=await context.client.query<{tenant_id:string;device_id:string;field_id:string;bound_ts_ms:string|number}>(
        `SELECT tenant_id,device_id,field_id,bound_ts_ms FROM public.device_binding_index_v1
          WHERE tenant_id=$1 AND device_id=$2 ORDER BY field_id,bound_ts_ms DESC`,
        [scope.tenant_id,binding.device_id],
      ).catch(()=>({rows:[] as {tenant_id:string;device_id:string;field_id:string;bound_ts_ms:string|number}[]}));
      if(rows.rows.length>1)deviceStatus="AMBIGUOUS";
      else if(rows.rows.length===1){boundTs=Number(rows.rows[0].bound_ts_ms);
        deviceStatus=rows.rows[0].field_id===scope.field_id&&boundTs===Number(binding.field_bound_ts_ms)?"EXACT_FIELD_BINDING":"MISMATCH";}
    }
    if(deviceStatus!=="EXACT_FIELD_BINDING")blockers.add("DEVICE_TO_FIELD_BINDING_NOT_EXACT");
    if(!binding||!Number.isFinite(Number(binding.measurement_depth_mm))||Number(binding.measurement_depth_mm)<=0)blockers.add("MEASUREMENT_DEPTH_NOT_VERIFIED");
    else blockers.add("MEASUREMENT_DEPTH_CALLER_SUPPLIED_NOT_INSTALLATION_VERIFIED");
    blockers.add("SENSOR_INSTALLATION_AUTHORITY_NOT_ESTABLISHED");
    const cropResult=await context.client.query<SourceFact>(
      `SELECT f.fact_id,f.occurred_at,f.record_json FROM public.facts f
        JOIN public.twin_fact_visibility_index_v1 v ON v.fact_id=f.fact_id
        WHERE v.visibility_epoch_id=$1 AND pg_catalog.pg_visible_in_snapshot(v.visibility_anchor_xid8,$2::pg_snapshot)
          AND f.record_json->>'type'='crop_context_v1'
          AND f.record_json#>>'{payload,tenant_id}'=$3 AND f.record_json#>>'{payload,project_id}'=$4
          AND f.record_json#>>'{payload,group_id}'=$5 AND f.record_json#>>'{payload,field_id}'=$6
          AND f.record_json#>>'{payload,season_id}'=$7 AND f.occurred_at<=$8::timestamptz
        ORDER BY f.occurred_at DESC,f.fact_id ASC LIMIT 20`,
      [context.canonical_visibility_snapshot.database_visibility_epoch_id,context.canonical_visibility_snapshot.pg_snapshot_token,
       scope.tenant_id,scope.project_id,scope.group_id,scope.field_id,scope.season_id,input.logical_time],
    );
    const candidates=cropResult.rows.map(row=>({row,payload:parsePayload(row.record_json)})).filter(x=>x.payload!==null);
    let cropStatus:"EXACT"|"MISSING"|"AMBIGUOUS"|"INVALID"="MISSING";
    let cropRow:SourceFact|null=null;let cropPayload:CropPayload|null=null;
    if(candidates.length){
      const latestTime=iso(candidates[0].row.occurred_at);
      const latest=candidates.filter(x=>iso(x.row.occurred_at)===latestTime);
      const signatures=new Set(latest.map(x=>JSON.stringify([x.payload?.crop_code??null,x.payload?.variety_code??null,x.payload?.crop_stage??null,x.payload?.status??null])));
      if(signatures.size>1)cropStatus="AMBIGUOUS";
      else{cropStatus=text(latest[0].payload?.crop_code)&&text(latest[0].payload?.crop_stage)?"EXACT":"INVALID";cropRow=latest[0].row;cropPayload=latest[0].payload;}
    }
    if(cropStatus!=="EXACT")blockers.add(cropStatus==="AMBIGUOUS"?"CROP_CONTEXT_AMBIGUOUS":"EXACT_SEASON_CROP_STAGE_NOT_AVAILABLE");
    const cropContext={
      status:cropStatus,source_fact_ref:cropRow?.fact_id??null,occurred_at:cropRow?iso(cropRow.occurred_at):null,
      time_basis:cropRow?"FACT_OCCURRED_AT_ONLY" as const:"NOT_AVAILABLE" as const,
      crop_code:text(cropPayload?.crop_code),variety_code:text(cropPayload?.variety_code),crop_stage:text(cropPayload?.crop_stage),
      crop_status:text(cropPayload?.status),source:text(cropPayload?.source),
    };
    const profileResult=await context.client.query<Record<string,unknown>>(
      `SELECT profile_id,tenant_id,project_id,group_id,field_id,zone_id,layer_depth_cm,texture_class,theta_r,theta_s,
        alpha_per_kpa,n,m,parameter_source,calibration_status,confidence_level,confidence_score,evidence_refs_json,
        source_fact_id,created_at,updated_at FROM public.soil_hydraulic_profile_index_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND zone_id=$5
        ORDER BY layer_depth_cm ASC,profile_id ASC`,
      [scope.tenant_id,scope.project_id,scope.group_id,scope.field_id,scope.zone_id],
    ).catch(()=>({rows:[] as Record<string,unknown>[]}));
    const profiles=profileResult.rows.map(mapSoilHydraulicProfileRowV1);
    if(!profiles.length)blockers.add("SOIL_HYDRAULIC_PROFILE_NOT_FOUND_FOR_EXACT_ZONE");
    const factIds=profiles.map(p=>p.source_fact_id).filter((v):v is string=>Boolean(v));
    const sourceRows=factIds.length?await context.client.query<SourceFact>(
      `SELECT f.fact_id,f.occurred_at,f.record_json FROM public.facts f
        JOIN public.twin_fact_visibility_index_v1 v ON v.fact_id=f.fact_id
        WHERE v.visibility_epoch_id=$1 AND pg_catalog.pg_visible_in_snapshot(v.visibility_anchor_xid8,$2::pg_snapshot)
          AND f.fact_id=ANY($3::text[])`,
      [context.canonical_visibility_snapshot.database_visibility_epoch_id,context.canonical_visibility_snapshot.pg_snapshot_token,factIds],
    ):{rows:[] as SourceFact[]};
    const sourceFacts=new Map(sourceRows.rows.map(row=>[row.fact_id,row]));
    const profileRecords=profiles.map(profile=>{
      const errors=validateSoilHydraulicProfileV1(profile);
      const source=profile.source_fact_id?sourceFacts.get(profile.source_fact_id):undefined;
      const sourceRecord=source?parseRecord(source.record_json):null;
      const sourcePayload=parsePayload(source?.record_json);
      let sourceStatus:"EXACT"|"MISSING"|"NOT_VISIBLE"|"MISMATCH"="MISSING";
      if(!profile.source_fact_id)sourceStatus="MISSING";
      else if(!source)sourceStatus="NOT_VISIBLE";
      else if(sourceRecord?.type!=="soil_hydraulic_profile_v1"||!sourcePayload||!sameProfilePayload(sourcePayload,profile))sourceStatus="MISMATCH";
      else if(!iso(source.occurred_at)||Date.parse(String(source.occurred_at))>targetMs)sourceStatus="MISMATCH";
      else sourceStatus="EXACT";
      if(sourceStatus!=="EXACT")blockers.add("SOIL_HYDRAULIC_PROFILE_SOURCE_FACT_NOT_EXACT");
      if(errors.length)blockers.add("SOIL_HYDRAULIC_PROFILE_INVALID");
      if(profile.calibration_status!=="CALIBRATED")blockers.add("SOIL_HYDRAULIC_PROFILE_NOT_FIELD_CALIBRATED");
      if(profile.updated_at&&Date.parse(profile.updated_at)>targetMs)blockers.add("SOIL_HYDRAULIC_PROFILE_NOT_AVAILABLE_AT_LOGICAL_TIME");
      return {profile_id:profile.profile_id,layer_depth_cm:profile.layer_depth_cm,texture_class:profile.texture_class,
        theta_r:profile.theta_r,theta_s:profile.theta_s,alpha_per_kpa:profile.alpha_per_kpa,n:profile.n,m:profile.m,
        parameter_source:profile.parameter_source,calibration_status:profile.calibration_status,confidence_level:profile.confidence_level,
        confidence_score:profile.confidence_score,source_fact_ref:profile.source_fact_id,source_fact_status:sourceStatus,
        evidence_refs:profile.evidence_refs,updated_at:profile.updated_at??null,effective_interval:"NOT_DECLARED" as const,validation_errors:errors};
    });
    const profileStatus=!profiles.length?"MISSING" as const:
      profileRecords.every(r=>r.source_fact_status==="EXACT"&&r.validation_errors.length===0)?"EXACT_SOURCE_FACTS" as const:"INDEX_ONLY" as const;
    blockers.add("SOIL_PROFILE_EFFECTIVE_INTERVAL_NOT_DECLARED");
    blockers.add("ROOT_ZONE_DEPTH_SOURCE_MISSING");
    blockers.add("FIELD_CAPACITY_SOURCE_MISSING");
    blockers.add("WILTING_POINT_SOURCE_MISSING");
    blockers.add("ROOT_ZONE_SATURATION_AGGREGATION_NOT_ESTABLISHED");
    blockers.add("CROP_KC_SOURCE_MISSING");
    blockers.add("DYNAMICS_PARAMETERS_NOT_CUSTOMER_SOURCED");
    blockers.add("ZONE_SPATIAL_SUPPORT_NOT_ESTABLISHED");
    const completeContext=fieldStatus==="EXACT"&&deviceStatus==="EXACT_FIELD_BINDING"&&cropStatus==="EXACT"&&profileStatus==="EXACT_SOURCE_FACTS";
    return {
      schema_version:"mcft_customer_native_parameter_source_resolution_v1",
      status:completeContext?"SOURCE_CONTEXT_RESOLVED_PARAMETERS_INCOMPLETE":
        cropStatus==="AMBIGUOUS"||deviceStatus==="AMBIGUOUS"?"SOURCE_CONTEXT_AMBIGUOUS":"SOURCE_CONTEXT_INCOMPLETE",
      scope,logical_time:input.logical_time,
      field:{status:fieldStatus,field_id:scope.field_id,project_id:scope.project_id,group_id:scope.group_id,source:"field_index_v1"},
      crop_context:cropContext,soil_hydraulic_profiles:{status:profileStatus,records:profileRecords},
      device_binding:{status:deviceStatus,device_id:binding?.device_id??null,binding_id:binding?.binding_id??null,
        field_bound_ts_ms:Number.isFinite(boundTs)?boundTs:null,installation_ref:binding?.installation_ref??null,
        installation_authority:"NOT_ESTABLISHED_IN_CURRENT_SCHEMA",
        measurement_depth_mm:binding&&Number.isFinite(Number(binding.measurement_depth_mm))?Number(binding.measurement_depth_mm):null,
        measurement_depth_authority:"CALLER_SUPPLIED_NOT_VERIFIED",effective_from:binding?.effective_from??null,effective_until:binding?.effective_until??null},
      parameter_availability:{root_zone_depth_mm:"MISSING",field_capacity_fraction:"MISSING",wilting_point_fraction:"MISSING",
        saturation_fraction:"LAYER_VALUES_ONLY_NOT_ROOT_ZONE_AGGREGATED",crop_kc:"MISSING",
        dynamics_parameters:"TEST_ONLY_NOT_CUSTOMER_SOURCED",zone_spatial_support:"NOT_ESTABLISHED",installation_support:"NOT_ESTABLISHED"},
      blocking_reasons:[...blockers].sort(),runtime_config_buildable:false,prediction_authorized_from_these_sources:false,
    };
  });
}
