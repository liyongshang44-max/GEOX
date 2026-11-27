// Historical forecast/scenario read only, consuming canonical facts, never
// executing the model, selecting current lineage, or relabeling research scope.
import type {Pool} from 'pg';
import type {ManagerAuthorityV1} from '../../auth/manager_authority_v1.js';
import {digest} from '../../domain/field/soil_csv_p2_v1.js';
import {computeMemberDeterminismHashV1} from '../../domain/twin_runtime/canonical_identity_v1.js';
import {validateCap04ForecastRunPayloadV1,validateCap04ScenarioSetPayloadV1,type Cap04ForecastRunPayloadV1,type Cap04ForecastPointV1,type Cap04ScenarioSetEnvelopeV1} from '../../domain/twin_runtime/forecast_scenario_contracts_v1.js';
const scopeKeys=['tenant_id','project_id','group_id','field_id','season_id','zone_id'] as const;
type Scope=Record<typeof scopeKeys[number],string>;
type Ref={fact_id:string;object_id:string;determinism_hash:string};
export type HistoricalForecastBindingV1={forecast:Ref;scenario:Ref|null};
export type HistoricalForecastDisplayGrantV1={permission:'HISTORICAL_MCFT_FORECAST_SCENARIO_DISPLAY';request_sha256:string;approval_ref:string;checked_at:string;valid_until:string;scope:Scope;runs:HistoricalForecastBindingV1[]};
export type HistoricalForecastConfigV1={sourceId:string;expectedDatabase:string;expectedRole:string;sourcePool:Pool;resolveGrant:(request:{source_id:string;scope:{tenant_id:string;project_id:string;group_id:string;field_id:string|null;actor_id:string;mapping_version:string};request_sha256:string},authority:ManagerAuthorityV1)=>Promise<HistoricalForecastDisplayGrantV1|null>};
const id=(x:unknown):x is string=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$/.test(x);
const hash=(x:unknown)=>typeof x==='string'&&/^sha256:[a-f0-9]{64}$/.test(x);
type Obj=Record<string,any>;
function need(v:unknown):asserts v{if(!v)throw Error('HISTORICAL_FORECAST_SOURCE_INTEGRITY');}
function validRef(x:Ref){return x&&id(x.fact_id)&&id(x.object_id)&&hash(x.determinism_hash);}
function validateBindings(scope:Scope,runs:HistoricalForecastBindingV1[]){
 need(scopeKeys.every(k=>id(scope[k]))&&Array.isArray(runs)&&runs.length>0&&runs.length<=24);
 const refs:Ref[]=[];
 for(const r of runs){need(r&&validRef(r.forecast)&&(r.scenario===null||validRef(r.scenario)));refs.push(r.forecast);if(r.scenario)refs.push(r.scenario);}
 need(new Set(refs.map(r=>r.fact_id)).size===refs.length&&new Set(refs.map(r=>r.object_id)).size===refs.length);
 return refs;
}
const projectPoint=(p:Cap04ForecastPointV1)=>({horizon_hour:p.horizon_hour,target_time:p.target_time,storage_mean_mm:p.storage_mean_mm,storage_variance_mm2:p.storage_variance_mm2,available_water_fraction:p.available_water_fraction,determinism_hash:p.determinism_hash});
export function projectHistoricalForecastFactsV1(scope:Scope,runs:HistoricalForecastBindingV1[],rows:Obj[]){
 const refs=validateBindings(scope,runs);need(rows.length===refs.length);
 const byId=new Map(rows.map(r=>[r.fact_id,r]));need(byId.size===refs.length);
 const take=(r:Ref,kind:string)=>{
  const row=byId.get(r.fact_id),env=row?.record_json?.payload;
  need(row?.source==='system'&&row.record_json.type===kind&&env&&env.object_type===kind&&env.object_id===r.object_id&&env.determinism_hash===r.determinism_hash&&scopeKeys.every(k=>env[k]===scope[k])&&id(env.lineage_id)&&id(env.revision_id));
  need(computeMemberDeterminismHashV1(env)===r.determinism_hash);
  return env;
 };
 const result=runs.map(b=>{
  const f=take(b.forecast,'twin_forecast_run_v1'),payload=f.payload as Cap04ForecastRunPayloadV1;
  validateCap04ForecastRunPayloadV1(payload);need(f.logical_time===payload.issued_at&&Date.parse(payload.issued_at)<=Date.now());
  let scenarios:{scenario_ref:Ref;options:{option_id:string;requested_irrigation_mm:string;execution_status:'NOT_EXECUTED';points:ReturnType<typeof projectPoint>[]}[]}|null=null;
  if(b.scenario){
   const s=take(b.scenario,'twin_scenario_set_v1'),sp=s.payload as Cap04ScenarioSetEnvelopeV1['payload'];
   need(s.logical_time===f.logical_time&&s.lineage_id===f.lineage_id&&s.revision_id===f.revision_id&&sp.source_forecast_ref===f.object_id&&sp.source_forecast_hash===f.determinism_hash);
   validateCap04ScenarioSetPayloadV1(sp,payload);
   need(sp.options.every(o=>o.source_forecast_ref===f.object_id&&o.source_forecast_hash===f.determinism_hash&&o.assumption_basis.source_forecast_ref===f.object_id&&o.assumption_basis.source_forecast_hash===f.determinism_hash));
   scenarios={scenario_ref:b.scenario,options:sp.options.map(o=>({option_id:o.option_id,requested_irrigation_mm:o.requested_irrigation_mm,execution_status:'NOT_EXECUTED' as const,points:o.trajectory_points.map(projectPoint)}))};
  }
  // A completed forecast without a scenario grant remains an explicitly
  // incomplete display, not a reconstructed model scenario.
  return {forecast_ref:b.forecast,issued_at:payload.issued_at,status:payload.status,source_posterior_ref:payload.source_posterior_ref,source_posterior_hash:payload.source_posterior_hash,reason_codes:payload.reason_codes.filter(id),points:payload.points.map(projectPoint),scenarios};
 });
 return result.sort((a,b)=>a.issued_at.localeCompare(b.issued_at)||a.forecast_ref.object_id.localeCompare(b.forecast_ref.object_id));
}
export async function readHistoricalForecastV1(a:ManagerAuthorityV1,config?:HistoricalForecastConfigV1){
 const base={semantics:'HISTORICAL_MODEL_ESTIMATES_AND_NOT_EXECUTED_SCENARIOS' as const,action_authority:false as const,current_condition_effect:'NO_PROMOTION' as const};
 const unavailable=()=>({...base,status:'UNAVAILABLE' as const,runs:[]});
 if(!config)return unavailable();
 need(id(config.sourceId)&&id(config.expectedDatabase)&&id(config.expectedRole));
 const scope={tenant_id:a.tenant_id,project_id:a.project_id,group_id:a.group_id,field_id:a.field_id,actor_id:a.actor_id,mapping_version:a.mapping_version};
 const request={source_id:config.sourceId,scope},request_sha256=digest(request);
 const g=structuredClone(await config.resolveGrant({...request,request_sha256},a));
 const current=()=>{
  const now=Date.now(),checked=Date.parse(g?.checked_at??''),until=Date.parse(g?.valid_until??'');
  return !!g&&g.permission==='HISTORICAL_MCFT_FORECAST_SCENARIO_DISPLAY'&&g.request_sha256===request_sha256&&id(g.approval_ref)&&Number.isFinite(checked)&&Number.isFinite(until)&&checked<=now&&now-checked<=60000&&until>now&&until<=checked+60000&&a.valid_until_ms>now;
 };
 if(!g||!current())return unavailable();
 need(scopeKeys.slice(0,4).every(k=>g.scope[k]===scope[k as keyof typeof scope]));
 const refs=validateBindings(g.scope,g.runs);
 const c=await config.sourcePool.connect();
 try{
  await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await c.query("SET LOCAL statement_timeout='15s'");
  const identity=(await c.query("SELECT current_database() AS db,current_user::text AS role,current_setting('transaction_read_only') AS ro,rolsuper,rolcreaterole,rolcreatedb,rolbypassrls,rolreplication,has_table_privilege(current_user,'public.facts','INSERT,UPDATE,DELETE,TRUNCATE') AS write_access FROM pg_roles WHERE rolname=current_user")).rows[0];
  need(identity?.db===config.expectedDatabase&&identity.role===config.expectedRole&&identity.ro==='on'&&['rolsuper','rolcreaterole','rolcreatedb','rolbypassrls','rolreplication','write_access'].every(k=>identity[k]===false));
  // Exact fact IDs from owner-approved source manifest; never enumerate a
  // whole customer database or use latest runtime projections.
  const rows=(await c.query('SELECT fact_id,source,record_json FROM public.facts WHERE fact_id=ANY($1::text[]) AND record_json->>\'type\' IN (\'twin_forecast_run_v1\',\'twin_scenario_set_v1\')',[refs.map(r=>r.fact_id)])).rows;
  const runs=projectHistoricalForecastFactsV1(g.scope,g.runs,rows);
  if(!current())throw Error('HISTORICAL_FORECAST_DISPLAY_EXPIRED');
  await c.query('COMMIT');if(!current())throw Error('HISTORICAL_FORECAST_DISPLAY_EXPIRED');
  return {...base,status:'AVAILABLE' as const,scope:g.scope,approval_ref:g.approval_ref,runs};
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
}
