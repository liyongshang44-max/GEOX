// Isolated L2 persistence for customer-native TEST_ONLY outputs.
// Uses the existing public.facts table and CAP-07 visibility trigger. This writer issues INSERT only,
// but geox_runtime_v1 has broader UPDATE/DELETE privileges; it is not a production writer authority.
// These are not CAP-09 canonical Twin objects and this writer cannot run outside the I1 test lane.
import type { Pool, PoolClient } from "pg";
import { canonicalJsonV1 } from "../../domain/twin_runtime/canonical_json_v1.js";
import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import type { CustomerScalarStateV1 } from "../../domain/soil_water/customer_scalar_assimilation_v1.js";
import type { CustomerScalarRuntimeConfigV1 } from "../../domain/twin_runtime/customer_scalar_runtime_config_v1.js";
import type { CustomerNativeParameterSourceResolutionV1 } from "../../runtime/twin_runtime/customer_native_parameter_source_resolver_v1.js";
import { executeCustomerPure72hForecastV1 } from "../../domain/twin_runtime/pure_72h_forecast_math_v1.js";
type Scope = CustomerScalarRuntimeConfigV1["scope"];
type Forecast = ReturnType<typeof executeCustomerPure72hForecastV1>;
type FactPayload = Record<string, unknown>;
type FactEnvelope = { type: string; payload: FactPayload };
type FactRow = { fact_id: string; occurred_at: Date | string; source: string; record_json: unknown };
export type CustomerNativeRuntimeRecordRefV1 = { object_ref: string; object_hash: string; source_fact_ref: string; logical_time: string };
export type PersistCustomerNativeRuntimeInputV1 = {
  pool: Pool; scope: Scope; runtime_chain_id: string; state: CustomerScalarStateV1; forecast: Forecast;
  parameter_sources: CustomerNativeParameterSourceResolutionV1; selected_evidence_refs: readonly string[];
  previous_state_record_ref: string | null; previous_state_record_hash: string | null;
};
export type PersistCustomerNativeRuntimeResultV1 = {
  status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS"; test_only: true; production_eligible: false; runtime_chain_id: string;
  state_record: CustomerNativeRuntimeRecordRefV1; forecast_record: CustomerNativeRuntimeRecordRefV1;
  previous_state_record_ref: string | null; visibility_metadata: "CAP07_FACT_INSERT_TRIGGER_VERIFIED";
  writer_authority: "TEST_ONLY_GENERAL_RUNTIME_ROLE_NOT_PRODUCTION_RESTRICTED";
  database_identity: { session_user: string; current_user: string; facts_insert: true; facts_update: boolean; facts_delete: boolean; schema_create: false; superuser: false };
};
function fail(code: string): never { throw new Error(code); }
function parseRecord(value: unknown): Record<string, unknown> | null {
  if(value&&typeof value==="object"&&!Array.isArray(value))return value as Record<string,unknown>;
  if(typeof value==="string"){try{const v=JSON.parse(value);return v&&typeof v==="object"&&!Array.isArray(v)?v:null;}catch{return null;}}
  return null;
}
function exactScope(a: Record<string, unknown>, b: Scope): boolean {
  return a.tenant_id===b.tenant_id&&a.project_id===b.project_id&&a.group_id===b.group_id&&
    a.field_id===b.field_id&&a.season_id===b.season_id&&a.zone_id===b.zone_id;
}
function iso(value: unknown): string {
  const date=value instanceof Date?value:new Date(String(value??""));
  if(!Number.isFinite(date.getTime()))fail("CUSTOMER_NATIVE_RECORD_TIME_INVALID");
  return date.toISOString();
}
function buildFact(type: string,prefix: string,semantic: FactPayload,logicalTime: string){
  const hash=semanticHashV1(semantic);const objectRef=prefix+"_"+hash.slice(7,31);
  const payload={...semantic,object_id:objectRef,determinism_hash:hash};
  return {fact_id:"fact_"+objectRef,occurred_at:logicalTime,source:"system",record_json:{type,payload} as FactEnvelope,
    ref:{object_ref:objectRef,object_hash:hash,source_fact_ref:"fact_"+objectRef,logical_time:logicalTime}};
}
function sameFact(row: FactRow,expected:{fact_id:string;occurred_at:string;source:string;record_json:FactEnvelope}):boolean{
  return row.fact_id===expected.fact_id&&iso(row.occurred_at)===expected.occurred_at&&row.source===expected.source&&
    canonicalJsonV1(parseRecord(row.record_json)??{})===canonicalJsonV1(expected.record_json);
}
async function insertExact(client:PoolClient,fact:{fact_id:string;occurred_at:string;source:string;record_json:FactEnvelope}):Promise<void>{
  const inserted=await client.query(
    `INSERT INTO public.facts(fact_id,occurred_at,source,record_json)
     VALUES($1,$2::timestamptz,$3,$4::jsonb) ON CONFLICT(fact_id) DO NOTHING`,
    [fact.fact_id,fact.occurred_at,fact.source,JSON.stringify(fact.record_json)]);
  if(inserted.rowCount===1)return;
  const existing=await client.query<FactRow>(`SELECT fact_id,occurred_at,source,record_json FROM public.facts WHERE fact_id=$1`,[fact.fact_id]);
  if(existing.rowCount!==1||!sameFact(existing.rows[0],fact))fail("CUSTOMER_NATIVE_FACT_IDENTITY_CONFLICT");
}
export async function persistCustomerNativeRuntimeTestOnlyV1(input:PersistCustomerNativeRuntimeInputV1):Promise<PersistCustomerNativeRuntimeResultV1>{
  if(process.env.MCFT_I1_TEST_ONLY!=="1")fail("CUSTOMER_NATIVE_TEST_ONLY_PERSISTENCE_ENV_REQUIRED");
  if(!/^test:[A-Za-z0-9_.:-]{8,160}$/.test(input.runtime_chain_id))fail("CUSTOMER_NATIVE_RUNTIME_CHAIN_ID_INVALID");
  const state=input.state as unknown as Record<string,unknown>;const forecast=input.forecast as unknown as Record<string,unknown>;
  if(state.test_only!==true||state.formal_eligible!==false||state.is_simulated!==true||!exactScope((state.scope??{}) as Record<string,unknown>,input.scope))
    fail("CUSTOMER_NATIVE_STATE_NOT_TEST_ONLY_OR_SCOPE_MISMATCH");
  if(forecast.test_only!==true||forecast.formal_eligible!==false||forecast.is_simulated!==true||forecast.scenario_eligible!==false||
    !exactScope((forecast.scope??{}) as Record<string,unknown>,input.scope))fail("CUSTOMER_NATIVE_FORECAST_NOT_TEST_ONLY_OR_SCOPE_MISMATCH");
  const logicalTime=iso(state.logical_time);
  if(iso(forecast.issued_at)!==logicalTime||state.config_hash!==forecast.config_hash||
    !exactScope(input.parameter_sources.scope as unknown as Record<string,unknown>,input.scope)||
    input.parameter_sources.logical_time!==logicalTime||input.parameter_sources.runtime_config_buildable!==false)
    fail("CUSTOMER_NATIVE_STATE_FORECAST_BINDING_MISMATCH");
  const points=forecast.points;
  if(!Array.isArray(points)||points.length!==72||points.some((point:any,index:number)=>point.horizon_hour!==index+1||point.mass_balance_error_mm!=="0.000000"))
    fail("CUSTOMER_NATIVE_FORECAST_72H_CONTRACT_INVALID");
  const stateSemantic:FactPayload={
    schema_version:"mcft_customer_native_state_fact_v1",object_type:"mcft_customer_native_state_fact_v1",
    scope:input.scope,runtime_chain_id:input.runtime_chain_id,logical_time:logicalTime,config_hash:state.config_hash,
    previous_state_record_ref:input.previous_state_record_ref,previous_state_record_hash:input.previous_state_record_hash,
    state:input.state,parameter_source_resolution:input.parameter_sources,selected_evidence_refs:[...input.selected_evidence_refs],
    test_only:true,formal_eligible:false,production_eligible:false,is_simulated:true,
  };
  const stateFact=buildFact("mcft_customer_native_state_fact_v1","mcft_customer_state",stateSemantic,logicalTime);
  const forecastSemantic:FactPayload={
    schema_version:"mcft_customer_native_forecast_fact_v1",object_type:"mcft_customer_native_forecast_fact_v1",
    scope:input.scope,runtime_chain_id:input.runtime_chain_id,logical_time:logicalTime,config_hash:forecast.config_hash,
    source_state_record_ref:stateFact.ref.object_ref,source_state_record_hash:stateFact.ref.object_hash,forecast:input.forecast,
    parameter_source_resolution:input.parameter_sources,selected_evidence_refs:[...input.selected_evidence_refs],
    test_only:true,formal_eligible:false,production_eligible:false,is_simulated:true,
  };
  const forecastFact=buildFact("mcft_customer_native_forecast_fact_v1","mcft_customer_forecast",forecastSemantic,logicalTime);
  const client=await input.pool.connect();let status:"INSERTED"|"EXISTING_IDEMPOTENT_SUCCESS"="INSERTED";
  try{
    await client.query("BEGIN");
    const identity=await client.query<{session_user:string;current_user:string;superuser:boolean;schema_create:boolean;facts_insert:boolean;facts_update:boolean;facts_delete:boolean}>(
      `SELECT session_user::text AS session_user,current_user::text AS current_user,role.rolsuper AS superuser,
        pg_catalog.has_schema_privilege(current_user,'public','CREATE') AS schema_create,
        pg_catalog.has_table_privilege(current_user,'public.facts','INSERT') AS facts_insert,
        pg_catalog.has_table_privilege(current_user,'public.facts','UPDATE') AS facts_update,
        pg_catalog.has_table_privilege(current_user,'public.facts','DELETE') AS facts_delete
       FROM pg_catalog.pg_roles role WHERE role.rolname=current_user`);
    const db=identity.rows[0];
    if(!db||db.session_user!=="geox_runtime_v1"||db.current_user!=="geox_runtime_v1"||db.superuser||db.schema_create||!db.facts_insert)
      fail("CUSTOMER_NATIVE_TEST_WRITER_ROLE_INVALID");
    const lockKey=[input.scope.tenant_id,input.scope.project_id,input.scope.group_id,input.scope.field_id,input.scope.season_id,input.scope.zone_id,input.runtime_chain_id].join("|");
    await client.query("SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended($1,0))",[lockKey]);
    const existing=await client.query<FactRow>(
      `SELECT fact_id,occurred_at,source,record_json FROM public.facts WHERE fact_id=ANY($1::text[])`,
      [[stateFact.fact_id,forecastFact.fact_id]]);
    if(existing.rowCount===2){
      const byId=new Map(existing.rows.map(row=>[row.fact_id,row]));
      if(!sameFact(byId.get(stateFact.fact_id)!,stateFact)||!sameFact(byId.get(forecastFact.fact_id)!,forecastFact))
        fail("CUSTOMER_NATIVE_FACT_IDENTITY_CONFLICT");
      status="EXISTING_IDEMPOTENT_SUCCESS";
    }else if(existing.rowCount!==0)fail("CUSTOMER_NATIVE_PARTIAL_FACT_PAIR_INVALID");
    else{
      const latest=await client.query<FactRow>(
        `SELECT fact_id,occurred_at,source,record_json FROM public.facts
          WHERE record_json->>'type'='mcft_customer_native_state_fact_v1'
            AND record_json#>>'{payload,runtime_chain_id}'=$1
            AND record_json#>>'{payload,scope,tenant_id}'=$2
            AND record_json#>>'{payload,scope,project_id}'=$3
            AND record_json#>>'{payload,scope,group_id}'=$4
            AND record_json#>>'{payload,scope,field_id}'=$5
            AND record_json#>>'{payload,scope,season_id}'=$6
            AND record_json#>>'{payload,scope,zone_id}'=$7
          ORDER BY (record_json#>>'{payload,logical_time}')::timestamptz DESC,fact_id ASC LIMIT 1 FOR UPDATE`,
        [input.runtime_chain_id,input.scope.tenant_id,input.scope.project_id,input.scope.group_id,input.scope.field_id,input.scope.season_id,input.scope.zone_id]);
      if(input.previous_state_record_ref===null){
        if(input.previous_state_record_hash!==null||latest.rowCount!==0)fail("CUSTOMER_NATIVE_CHAIN_INITIAL_PREDECESSOR_INVALID");
      }else{
        if(!input.previous_state_record_hash||latest.rowCount!==1)fail("CUSTOMER_NATIVE_CHAIN_PREDECESSOR_MISSING");
        const previous=parseRecord(latest.rows[0].record_json);const payload=parseRecord(previous?.payload);
        if(payload?.object_id!==input.previous_state_record_ref||payload?.determinism_hash!==input.previous_state_record_hash||
          iso(payload?.logical_time)>=logicalTime)fail("CUSTOMER_NATIVE_CHAIN_PREDECESSOR_MISMATCH");
      }
      await insertExact(client,stateFact);await insertExact(client,forecastFact);
    }
    const visibility=await client.query<{count:string}>(
      `SELECT pg_catalog.count(*)::text AS count FROM public.twin_fact_visibility_index_v1
        WHERE visibility_epoch_id=(SELECT visibility_epoch_id FROM public.twin_fact_visibility_epoch_v1 WHERE status='ACTIVE')
          AND fact_id=ANY($1::text[])`,
      [[stateFact.fact_id,forecastFact.fact_id]]);
    if(visibility.rows[0]?.count!=="2")fail("CUSTOMER_NATIVE_FACT_VISIBILITY_NOT_EXACT");
    await client.query("COMMIT");
    return {status,test_only:true,production_eligible:false,runtime_chain_id:input.runtime_chain_id,
      state_record:stateFact.ref,forecast_record:forecastFact.ref,previous_state_record_ref:input.previous_state_record_ref,
      visibility_metadata:"CAP07_FACT_INSERT_TRIGGER_VERIFIED",
      writer_authority:"TEST_ONLY_GENERAL_RUNTIME_ROLE_NOT_PRODUCTION_RESTRICTED",
      database_identity:{session_user:db.session_user,current_user:db.current_user,facts_insert:true,facts_update:db.facts_update,
        facts_delete:db.facts_delete,schema_create:false,superuser:false}};
  }catch(error){await client.query("ROLLBACK").catch(()=>undefined);throw error;}
  finally{client.release();}
}
