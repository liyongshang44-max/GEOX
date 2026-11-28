// SELECT-only reader for the isolated customer-native fact pair.
// It reuses CAP-07's transaction snapshot and visibility index; no canonical CAP-09 promotion is implied.
import type { PostgresFieldTwinSnapshotContextV1 } from "./postgres_field_twin_snapshot_repository_v1.js";
import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
type Row={fact_id:string;occurred_at:Date|string;source:string;record_json:unknown};
type Scope=PostgresFieldTwinSnapshotContextV1["scope"];
function fail(code:string):never{throw new Error(code);}
function record(value:unknown):Record<string,unknown>|null{
  if(value&&typeof value==="object"&&!Array.isArray(value))return value as Record<string,unknown>;
  if(typeof value==="string"){try{const v=JSON.parse(value);return v&&typeof v==="object"&&!Array.isArray(v)?v:null;}catch{return null;}}
  return null;
}
function iso(value:unknown):string{
  const d=value instanceof Date?value:new Date(String(value??""));if(!Number.isFinite(d.getTime()))fail("CUSTOMER_NATIVE_READ_TIME_INVALID");return d.toISOString();
}
function exactScope(a:Record<string,unknown>,b:Scope):boolean{
  return a.tenant_id===b.tenant_id&&a.project_id===b.project_id&&a.group_id===b.group_id&&a.field_id===b.field_id&&a.season_id===b.season_id&&a.zone_id===b.zone_id;
}
function validateFact(row:Row,expectedType:string,scope:Scope,chain:string):Record<string,unknown>{
  const envelope=record(row.record_json);const payload=record(envelope?.payload);
  if(envelope?.type!==expectedType||!payload||payload.object_type!==expectedType||
    payload.test_only!==true||payload.formal_eligible!==false||payload.production_eligible!==false||payload.is_simulated!==true||
    payload.runtime_chain_id!==chain||!exactScope((payload.scope??{}) as Record<string,unknown>,scope))fail("CUSTOMER_NATIVE_READ_FACT_CONTRACT_INVALID");
  const objectId=String(payload.object_id??"");const hash=String(payload.determinism_hash??"");
  const semantic={...payload};delete semantic.object_id;delete semantic.determinism_hash;
  if(!objectId||row.fact_id!=="fact_"+objectId||semanticHashV1(semantic)!==hash||
    iso(row.occurred_at)!==String(payload.logical_time)||row.source!=="system")fail("CUSTOMER_NATIVE_READ_FACT_IDENTITY_INVALID");
  return payload;
}
export async function readCustomerNativeRuntimeSnapshotV1(context:PostgresFieldTwinSnapshotContextV1,runtimeChainId:string){
  if(!/^test:[A-Za-z0-9_.:-]{8,160}$/.test(runtimeChainId))fail("CUSTOMER_NATIVE_RUNTIME_CHAIN_ID_INVALID");
  const common=[context.canonical_visibility_snapshot.database_visibility_epoch_id,
    context.canonical_visibility_snapshot.pg_snapshot_token,runtimeChainId,
    context.scope.tenant_id,context.scope.project_id,context.scope.group_id,context.scope.field_id,context.scope.season_id,context.scope.zone_id];
  const readType=async(type:string)=>{
    const result=await context.client.query<Row>(
      `SELECT f.fact_id,f.occurred_at,f.source,f.record_json FROM public.facts f
        JOIN public.twin_fact_visibility_index_v1 v ON v.fact_id=f.fact_id
        WHERE v.visibility_epoch_id=$1 AND pg_catalog.pg_visible_in_snapshot(v.visibility_anchor_xid8,$2::pg_snapshot)
          AND f.record_json->>'type'=$3 AND f.record_json#>>'{payload,runtime_chain_id}'=$4
          AND f.record_json#>>'{payload,scope,tenant_id}'=$5 AND f.record_json#>>'{payload,scope,project_id}'=$6
          AND f.record_json#>>'{payload,scope,group_id}'=$7 AND f.record_json#>>'{payload,scope,field_id}'=$8
          AND f.record_json#>>'{payload,scope,season_id}'=$9 AND f.record_json#>>'{payload,scope,zone_id}'=$10
        ORDER BY (f.record_json#>>'{payload,logical_time}')::timestamptz DESC,f.fact_id ASC LIMIT 2`,
      [common[0],common[1],type,...common.slice(2)]);
    if(!result.rows.length)return null;
    if(result.rows.length>1&&iso((record(record(result.rows[0].record_json)?.payload))?.logical_time)===
      iso((record(record(result.rows[1].record_json)?.payload))?.logical_time))fail("CUSTOMER_NATIVE_READ_LATEST_AMBIGUOUS");
    return {row:result.rows[0],payload:validateFact(result.rows[0],type,context.scope,runtimeChainId)};
  };
  const [stateResult,forecastResult]=await Promise.all([
    readType("mcft_customer_native_state_fact_v1"),readType("mcft_customer_native_forecast_fact_v1")]);
  if(!stateResult||!forecastResult)fail("CUSTOMER_NATIVE_RUNTIME_NOT_FOUND");
  const statePayload=stateResult.payload;const forecastPayload=forecastResult.payload;
  const state=record(statePayload.state);const forecast=record(forecastPayload.forecast);
  if(!state||!forecast||statePayload.logical_time!==forecastPayload.logical_time||
    forecastPayload.source_state_record_ref!==statePayload.object_id||
    forecastPayload.source_state_record_hash!==statePayload.determinism_hash||
    forecast.source_state_ref!==state.state_ref||forecast.issued_at!==statePayload.logical_time||
    !Array.isArray(forecast.points)||forecast.points.length!==72||
    forecast.points.some((point:any,index:number)=>point.horizon_hour!==index+1||point.mass_balance_error_mm!=="0.000000"))
    fail("CUSTOMER_NATIVE_READ_STATE_FORECAST_BINDING_INVALID");
  const content={
    schema_version:"mcft_customer_native_runtime_read_v1",request_scope:context.scope,runtime_chain_id:runtimeChainId,
    status:"TEST_ONLY_NOT_FOR_OPERATIONAL_USE",test_only:true,formal_eligible:false,production_eligible:false,
    state_record:{object_ref:statePayload.object_id,object_hash:statePayload.determinism_hash,source_fact_ref:stateResult.row.fact_id,logical_time:statePayload.logical_time},
    forecast_record:{object_ref:forecastPayload.object_id,object_hash:forecastPayload.determinism_hash,source_fact_ref:forecastResult.row.fact_id,logical_time:forecastPayload.logical_time},
    previous_state_record_ref:statePayload.previous_state_record_ref??null,state,
    forecast,parameter_source_resolution:statePayload.parameter_source_resolution,
    selected_evidence_refs:statePayload.selected_evidence_refs,
    canonical_visibility_snapshot:context.canonical_visibility_snapshot,response_started_at:context.response_started_at,
  };
  const contentHash=semanticHashV1(content);
  return {...content,customer_native_content_hash:contentHash,
    response_instance_hash:semanticHashV1({content_hash:contentHash,response_started_at:context.response_started_at,
      visibility_snapshot_hash:context.canonical_visibility_snapshot.visibility_snapshot_hash})};
}
