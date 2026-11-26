// Customer-safe, read-only projection of historical observation facts. No Runtime dependency.
import {createHmac,timingSafeEqual} from 'node:crypto';
import type {Pool} from 'pg';
import {semanticHashV1} from '../../domain/twin_runtime/canonical_json_v1.js';
import type {CustomerProductReadScopeV1} from './customer_product_projection_builder_v1.js';
import {CustomerProductProjectionReadErrorV1} from './customer_product_projection_builder_v1.js';
import {MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1} from '../../domain/twin_runtime/external_formal_evidence_binding_profile_v1.js';
import {assertProductProjectionEnvelopeV1} from '../contracts/product_projection_contracts_v1.js';

export const OBSERVATION_HISTORY_SCHEMA_V1='geox.field-observation-history-projection.v1' as const;
const SOURCE='mcft_cap09_external_formal_evidence_v1';
const TYPE='soil_moisture_observation_v1';
const scopeKeys=['tenant_id','project_id','group_id','field_id'] as const;
export type ObservationDisplayGrantV1={tenant_id:string;project_id:string;group_id:string;field_id:string;dataset_id:string;source_use_policy_ref:string;approval_ref:string;customer_visible:true;permission:'CANONICAL_OBSERVATION_DISPLAY';expires_at:string};
export type ObservationHistoryOptionsV1={grants?:readonly ObservationDisplayGrantV1[];cursorSecret?:string;now?:()=>string};
export type ObservationHistoryQueryV1={limit?:unknown;cursor?:unknown};
const fail=(code:string,status:400|403|404|503=400):never=>{throw new CustomerProductProjectionReadErrorV1(code,status);};
const record=(v:unknown):Record<string,any>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,any>:{};
const text=(v:unknown)=>typeof v==='string'&&v.trim()?v:null;
const instant=(v:unknown)=>typeof v==='string'&&/(Z|[+-]\d\d:\d\d)$/.test(v)&&Number.isFinite(Date.parse(v));
type Cursor={scope_hash:string;as_of:string;time:string;id:string};
export class PostgresFieldObservationHistoryBuilderV1{
 constructor(private pool:Pick<Pool,'query'>,private options:ObservationHistoryOptionsV1={}){}
 private sign(value:string){return createHmac('sha256',this.options.cursorSecret!).update(value).digest('base64url');}
 private decode(raw:string,scopeHash:string):Cursor{try{const [value,mac,extra]=raw.split('.');const expected=this.sign(value);if(extra||!mac||Buffer.byteLength(mac)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(mac),Buffer.from(expected)))return fail('OBSERVATION_CURSOR_INVALID');const c=JSON.parse(Buffer.from(value,'base64url').toString()) as Cursor;if(c.scope_hash!==scopeHash||!instant(c.time)||!instant(c.as_of)||!text(c.id))return fail('OBSERVATION_CURSOR_SCOPE_OR_VALUE_INVALID');return c;}catch{return fail('OBSERVATION_CURSOR_INVALID');}}
 async build(scope:CustomerProductReadScopeV1,fieldRef:string,query:ObservationHistoryQueryV1={}){
  if(!/^[A-Za-z0-9_\-:.]{1,128}$/.test(fieldRef)||!scope.can_preview_all_fields&&!scope.allowed_field_ids.includes(fieldRef))fail('PRODUCT_FIELD_NOT_FOUND',404);
  const limit=query.limit===undefined?50:Number(query.limit);if(!Number.isSafeInteger(limit)||limit<1||limit>100)fail('OBSERVATION_PAGE_LIMIT_INVALID');
  if(query.cursor!==undefined&&(typeof query.cursor!=='string'||query.cursor.length>4096))fail('OBSERVATION_CURSOR_INVALID');
  const now=this.options.now?.()??new Date().toISOString();if(!instant(now))fail('PRODUCT_CLOCK_INVALID',503);
  const identity=await this.pool.query('SELECT field_id FROM public.field_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 LIMIT 2',[scope.tenant_id,scope.project_id,scope.group_id,fieldRef]);
  if(identity.rows.length!==1)fail('PRODUCT_FIELD_NOT_FOUND',404);
  const grants=(this.options.grants??[]).filter(g=>scopeKeys.every(k=>g[k]===(k==='field_id'?fieldRef:scope[k]))&&g.customer_visible===true&&g.permission==='CANONICAL_OBSERVATION_DISPLAY'&&text(g.dataset_id)&&text(g.source_use_policy_ref)&&text(g.approval_ref)&&instant(g.expires_at)&&Date.parse(g.expires_at)>Date.parse(now));
  const scopeHash=semanticHashV1({scope,fieldRef,grants});
  let status:'AVAILABLE'|'UNAVAILABLE'='AVAILABLE',limitations=['HISTORICAL_OBSERVATIONS_NOT_CURRENT_STATE','POINT_SUPPORT_NOT_ROOT_ZONE_MEAN','FUTURE_ASSUMPTIONS_EXCLUDED','NO_RISK_OR_IRRIGATION_INFERENCE'];
  let rows:any[]=[];let cursor:Cursor|null=null;
  if(!grants.length){status='UNAVAILABLE';limitations.push('OBSERVATION_CUSTOMER_DISPLAY_PERMISSION_NOT_ESTABLISHED');}
  else if(!this.options.cursorSecret||this.options.cursorSecret.length<32){status='UNAVAILABLE';limitations.push('OBSERVATION_CURSOR_SIGNING_NOT_CONFIGURED');}
  else{
   cursor=query.cursor?this.decode(String(query.cursor),scopeHash):null;
   const result=await this.pool.query(`SELECT fact_id,occurred_at,record_json FROM public.facts
    WHERE source=$1 AND record_json->>'type'=$2
      AND record_json#>>'{payload,tenant_id}'=$3 AND record_json#>>'{payload,project_id}'=$4
      AND record_json#>>'{payload,group_id}'=$5 AND record_json#>>'{payload,field_id}'=$6
      AND record_json#>>'{payload,dataset_id}'=ANY($7::text[]) AND occurred_at <= $8::timestamptz
      AND (record_json#>>'{payload,role_time,ingested_at}')::timestamptz <= $8::timestamptz
      AND ($9::timestamptz IS NULL OR (occurred_at,fact_id)>($9::timestamptz,$10::text))
    ORDER BY occurred_at ASC,fact_id ASC LIMIT $11`,[SOURCE,TYPE,scope.tenant_id,scope.project_id,scope.group_id,fieldRef,grants.map(g=>g.dataset_id),cursor?.as_of??now,cursor?.time??null,cursor?.id??'',limit+1]);
   rows=result.rows;
  }
  const selected=rows.slice(0,limit);
  const items=selected.map(row=>{
   const envelope=typeof row.record_json==='string'?JSON.parse(row.record_json):row.record_json,p=record(envelope?.payload),c=record(p.canonical_payload),source=record(p.source_payload),quality=record(p.quality),role=record(p.role_time);
   const grant=grants.find(g=>g.dataset_id===p.dataset_id&&g.source_use_policy_ref===source.use_policy_ref);
   if(!grant)throw new CustomerProductProjectionReadErrorV1('OBSERVATION_SOURCE_OR_VISIBILITY_NOT_VERIFIED',503);
   if(!scopeKeys.every(k=>p[k]===(k==='field_id'?fieldRef:scope[k]))||!text(p.season_id)||!text(p.zone_id)||envelope.type!==TYPE||p.record_type!==TYPE||p.epistemic_class!=='OBSERVED'||p.binding_id!==MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1||p.origin_source_kind!=='EXTERNAL_PUBLIC_RESEARCH_DATASET'||!instant(role.observed_at)||!instant(role.ingested_at)||Object.values(role).some(t=>!instant(t))||!['PASS','LIMITED'].includes(quality.status)||!text(p.source_record_id)||!/^sha256:[0-9a-f]{64}$/.test(p.source_record_hash??'')||quality.canonical_payload_sha256!==semanticHashV1(c))fail('OBSERVATION_SOURCE_OR_VISIBILITY_NOT_VERIFIED',503);
   const occurred=new Date(row.occurred_at).toISOString();if(Date.parse(occurred)!==Date.parse(role.observed_at))fail('OBSERVATION_EVENT_TIME_MISMATCH',503);
   if(c.quantity_kind!=='VOLUMETRIC_WATER_CONTENT'||typeof c.value!=='number'||!Number.isFinite(c.value)||c.unit!=='fraction'||(!Number.isFinite(c.measurement_depth_mm)||c.measurement_depth_mm<=0)||c.spatial_support!=='NEAR_SITE_POINT_SUPPORT'||c.direct_field_equivalence!==false||c.direct_root_zone_equivalence!==false)fail('OBSERVATION_VALUE_CONTRACT_UNAVAILABLE',503);
   if(!Array.isArray(p.limitations)||p.limitations.some((x:unknown)=>typeof x!=='string'||/s3-private:|Bearer\s|https?:/i.test(x)))fail('OBSERVATION_LIMITATIONS_NOT_CUSTOMER_SAFE',503);
   return {fact_id:String(row.fact_id),fact_type:TYPE,fact_source:SOURCE,fact_content_hash:semanticHashV1(envelope),source_record_id:p.source_record_id,source_record_hash:p.source_record_hash,dataset_id:p.dataset_id,source_reference:{origin_source_id:p.origin_source_id,origin_source_kind:p.origin_source_kind,use_policy_ref:source.use_policy_ref,source_version:source.source_version??null},scope:Object.fromEntries([...scopeKeys,'season_id','zone_id'].map(k=>[k,p[k]])),time:{observed_at:role.observed_at,role:'OBSERVED_AT',precision:'INSTANT',timezone_status:'EXPLICIT_OFFSET',role_time:role,available_to_runtime_at:p.available_to_runtime_at??null},measurement:{quantity_kind:c.quantity_kind,value:c.value,unit:c.unit,measurement_depth_mm:c.measurement_depth_mm,spatial_support:c.spatial_support,direct_field_equivalence:false,direct_root_zone_equivalence:false,root_zone_representativeness:c.root_zone_representativeness??'UNKNOWN'},quality:{status:quality.status,source_quality_hash:semanticHashV1(quality),raw_value_publication_authorized:quality.raw_value_publication_authorized??null},limitations:[...p.limitations],data_use:{customer_visible:true,approval_ref:grant.approval_ref,permission:grant.permission,raw_evidence_exposed:false},historical:true};
  });
  let next_cursor:string|null=null;if(rows.length>limit&&selected.length){const last=selected.at(-1)!;const value=Buffer.from(JSON.stringify({scope_hash:scopeHash,as_of:cursor?.as_of??now,time:new Date(last.occurred_at).toISOString(),id:String(last.fact_id)})).toString('base64url');next_cursor=value+'.'+this.sign(value);}
  const refs=items.map((i,index)=>({ref_key:`history:${index}`,ref_class:'MEASUREMENT' as const,object_kind:TYPE,exact_ref:i.fact_id,source_fact_ref:i.fact_id}));
  const envelope={projection_id:'observation-history:'+semanticHashV1({scope,fieldRef,items,next_cursor,status}),projection_type:'EVIDENCE_CASE' as const,projection_schema_version:'geox.product-projection.v1' as const,generated_at:now,derivation_version:'geox.field-observation-history.derivation.v1',subject_scope:{tenant_id:scope.tenant_id,project_id:scope.project_id,group_id:scope.group_id,field_id:fieldRef,season_id:null,zone_id:null},source_authority_refs:[],source_non_authority_refs:refs,source_content_digests:items.map((i,index)=>({source_ref_key:`history:${index}`,digest:i.fact_content_hash,digest_kind:'PRODUCT_SOURCE_FACT_DIGEST'})),source_effective_interval:{mode:'NOT_APPLICABLE' as const,effective_from:null,effective_until:null,basis_ref_keys:[]},source_evidence_cutoff:null,authority_ceiling:'NON_AUTHORITATIVE_PRODUCT_PROJECTION_ONLY' as const,limitations:limitations.map(reason_code=>({reason_code,source_ref_key:null,detail:null})),freshness:{status:'UNKNOWN' as const,evaluated_at:now,basis:'UNESTABLISHED' as const,reason_codes:['HISTORICAL_NOT_CURRENT']},projection_semantics:'HISTORICAL_REPLAY' as const,non_authoritative:true as const};
  assertProductProjectionEnvelopeV1(envelope);
  return {schema_version:OBSERVATION_HISTORY_SCHEMA_V1,envelope,field_ref:fieldRef,status,items,next_cursor,count:items.length,limitation_reason_codes:limitations,page:{order:'OBSERVED_AT_ASC_FACT_ID_ASC',as_of:cursor?.as_of??now},current_condition_effect:'NO_PROMOTION' as const};
 }
}
