import test from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import {
  PRODUCT_FORMAL_V5_SCOPE_V1,
  PRODUCT_FORMAL_V5_READ_MODE_V1,
  PRODUCT_FORMAL_V5_REQUIRED_READ_RELATIONS_V1,
  assertProductFormalV5CrossDatabaseUrisV1,
  isAllowedFormalV5ResearchFieldV1,
  verifyProductFormalV5ReadinessV1,
} from "./customer_formal_v5_readiness_v1.js";
import {
  PostgresCustomerProductProjectionBuilderV1,
  type CustomerProductReadScopeV1,
} from "./customer_product_projection_builder_v1.js";

const baseScope = { ...PRODUCT_FORMAL_V5_SCOPE_V1 };
const dburi = (db:string, host="ep-odd-poetry-a6peeo8g.us-west-2.aws.neon.tech", role="geox_product_readonly_login_v1")=>
  `postgresql://${role}:testpassword123@${host}/${db}?sslmode=require`;

function pools(options?: {
  identityCount?:number; activeCount?:number; stateCount?:number;
  missing?:string[]; unreadable?:string[]; writable?:string[];
  secondProject?:string; secondBranch?:string; formalReadonly?:string;
}): {identity:Pool, formal:Pool, calls:{identity:string[],formal:string[]}} {
 const calls={identity:[] as string[],formal:[] as string[]};
 const identity={query:async (sql:string, args?:unknown[])=>{
   calls.identity.push(sql);
   if(sql.includes("current_database()"))return {rows:[{db:"geox_mcft_cap09_production_runtime_v1",project_id:"delicate-glade-62464340",branch_id:"br-cold-dust-a6j6aymz",db_readonly:"on",role:"geox_product_readonly_login_v1"}]};
   if(sql.includes("FROM public.field_index_v1"))return {rows:Array.from({length:options?.identityCount??1},()=>({field_id:baseScope.field_id,field_name:"KBS Research Field",area_ha:1,updated_ts_ms:1}))};
   throw new Error("IDENTITY_DB_QUERY_FORBIDDEN:"+sql);
 }} as unknown as Pool;
 const formal={query:async (sql:string,args?:unknown[])=>{
   calls.formal.push(sql);
   if(sql.includes("current_database()"))return {rows:[{db:"geox_mcft_cap09_s6_formal_t4r1_24h_v5",project_id:options?.secondProject??"delicate-glade-62464340",branch_id:options?.secondBranch??"br-cold-dust-a6j6aymz",db_readonly:options?.formalReadonly??"on",role:"geox_product_readonly_login_v1"}]};
   if(sql.includes("unnest($1::text[])"))return {rows:PRODUCT_FORMAL_V5_REQUIRED_READ_RELATIONS_V1.map(relation=>({
      relation,exists:!options?.missing?.includes(relation),can_select:!options?.unreadable?.includes(relation),
      can_insert:Boolean(options?.writable?.includes(relation)),can_update:false,can_delete:false,
   }))};
   if(sql.includes("FROM public.twin_active_lineage_index_v1"))return {rows:Array.from({length:options?.activeCount??1},(_,i)=>({season_id:"season-a",zone_id:i?"zone-b":"zone-a",active_lineage_ref:"lineage-a",updated_at:"2026-10-08T00:00:00Z"}))};
   if(sql.includes("FROM public.twin_state_history_projection_v1")) {
     if(sql.includes("count(*)"))return {rows:[{n:(options?.stateCount??1)>0?"1":"0"}]};
     return {rows:[{canonical_payload:{
       derived_state:{available_water_fraction:0.61,depletion_from_field_capacity_mm:14.8,root_zone_water_storage_mm:{mean:76.2,stddev:4.5,interval_low:67.4,interval_high:85}},
       unavailable_state:{water_stress_state:"NOT_ESTABLISHED_NO_STRESS_MODEL"},
       confidence:{status:"NOT_ESTABLISHED",reason_code:"NO_CALIBRATED_CONFIDENCE_MODEL"},
     },logical_time:"2026-10-08T05:00:00Z",determinism_hash:"sha256:state-a",source_fact_id:"fact-state-a"}]};
   }
   throw new Error("FORMAL_DB_QUERY_FORBIDDEN:"+sql);
 }} as unknown as Pool;
 return {identity,formal,calls};
}

test("URI bridge admits only same-host, TLS, actual read-only principal and exact Neon DB names",()=>{
 assert.equal(PRODUCT_FORMAL_V5_READ_MODE_V1,"FORMAL_V5_RESEARCH_EXACT_SCOPE_V1");
 assert.doesNotThrow(()=>assertProductFormalV5CrossDatabaseUrisV1(
    dburi("geox_mcft_cap09_production_runtime_v1"),dburi("geox_mcft_cap09_s6_formal_t4r1_24h_v5")));
 assert.throws(()=>assertProductFormalV5CrossDatabaseUrisV1(
    dburi("geox_mcft_cap09_production_runtime_v1"),dburi("geox_mcft_cap09_s6_formal_t4r1_24h_v5","other.neon.tech")),/CROSS_HOST/);
 assert.throws(()=>assertProductFormalV5CrossDatabaseUrisV1(
    dburi("geox_mcft_cap09_production_runtime_v1"),dburi("geox_mcft_cap09_s6_formal_t4r1_24h_v5","ep-odd-poetry-a6peeo8g.us-west-2.aws.neon.tech","geox_mcft_cap09_twin_runtime_login_v1")),/READONLY_ROLE_REQUIRED/);
 assert.throws(()=>assertProductFormalV5CrossDatabaseUrisV1(
    dburi("geox_mcft_cap09_production_runtime_v1"),dburi("geox_mcft_cap09_production_runtime_v1")),/DB_IDENTITY_FORBIDDEN/);
 assert.throws(()=>assertProductFormalV5CrossDatabaseUrisV1(
    dburi("geox_mcft_cap09_production_runtime_v1"),dburi("geox_mcft_cap09_s6_formal_t4r1_24h_v5").replace("sslmode=require","sslmode=disable")),/SSL_REQUIRED/);
});
test("Frozen KBS exact scope refuses unrelated customer or field",()=>{
 assert.equal(isAllowedFormalV5ResearchFieldV1(baseScope,baseScope.field_id),true);
 assert.equal(isAllowedFormalV5ResearchFieldV1({...baseScope,tenant_id:"another-tenant"},baseScope.field_id),false);
 assert.equal(isAllowedFormalV5ResearchFieldV1(baseScope,"customer-field-x"),false);
});
test("Fully proven fixture is at most preconditions-only, never Site or 24T completion",async()=>{
 const {identity,formal,calls}=pools();
 const out=await verifyProductFormalV5ReadinessV1(identity,formal);
 assert.equal(out.status,"PASS_PRECONDITIONS_ONLY");
 assert.equal(out.first_state_visible,true);
 assert.equal(out.mcft_stage1b_qualified,false);
 assert.equal(out.site_data_smoke_passed,false);
 assert.equal(calls.identity.every(x=>!x.includes("twin_active_lineage_index_v1")),true);
 assert.equal(calls.formal.every(x=>!x.includes("field_index_v1")),true);
});
test("Current Neon physical limitations fail closed, including missing CAP07 visibility metadata and ACL",async()=>{
 const {identity,formal}=pools({activeCount:0,stateCount:0,missing:["twin_fact_visibility_index_v1","twin_fact_visibility_epoch_v1"],unreadable:["twin_object_idempotency_index_v1","twin_runtime_checkpoint_latest_index_v1"]});
 const out=await verifyProductFormalV5ReadinessV1(identity,formal);
 assert.equal(out.status,"BLOCKED");
 assert.equal(out.complete_cap07_read_model_prerequisites,false);
 assert.ok(out.reason_codes.includes("PRODUCT_FORMAL_REQUIRED_RELATION_MISSING:twin_fact_visibility_index_v1"));
 assert.ok(out.reason_codes.includes("PRODUCT_FORMAL_SELECT_PRIVILEGE_MISSING:twin_object_idempotency_index_v1"));
 assert.ok(out.reason_codes.includes("MCFT_FORMAL_ACTIVE_LINEAGE_NOT_ESTABLISHED"));
});
test("Multi-zone cannot choose latest by accident",async()=>{
 const {identity,formal}=pools({activeCount:2});
 const out=await verifyProductFormalV5ReadinessV1(identity,formal);
 assert.equal(out.status,"BLOCKED");
 assert.ok(out.reason_codes.includes("MCFT_FORMAL_ACTIVE_LINEAGE_AMBIGUOUS"));
});
test("Identity and Neon-branch mismatch and write privileges are blockers",async()=>{
 const {identity,formal}=pools({identityCount:0,secondBranch:"foreign-branch",writable:["facts"],formalReadonly:"off"});
 const out=await verifyProductFormalV5ReadinessV1(identity,formal);
 assert.equal(out.status,"BLOCKED");
 for(const s of ["PRODUCT_FORMAL_NEON_PROJECT_BRANCH_OR_DATABASE_MISMATCH","PRODUCT_FORMAL_READONLY_SESSION_ROLE_NOT_VERIFIED","PRODUCT_FORMAL_RESEARCH_FIELD_IDENTITY_CARDINALITY_INVALID","PRODUCT_FORMAL_WRITE_PRIVILEGE_FORBIDDEN:facts"]){
    assert.ok(out.reason_codes.includes(s),s);
 }
});
test("Separate real Product builder reads identity only from operational pool and MCFT only from formal pool",async()=>{
 const {identity,formal,calls}=pools();
 const readApi={readRuntime:async()=>({
   schema_version:"minimal_field_twin_runtime_read_model_v1",root_graph_status:"COMPLETE_EXACT_GRAPH",
   posterior_state:{object_ref:"state-a",object_type:"twin_state_estimate_v1",object_hash:"sha256:state-a",source_fact_ref:"fact-state-a"},
   active_lineage:{object_ref:"lineage-a",object_type:"twin_runtime_lineage_v1",object_hash:"sha256:lineage-a",source_fact_ref:"fact-lineage-a"},
 })} as any;
 const builder=new PostgresCustomerProductProjectionBuilderV1(identity,{canonicalPool:formal,readApi,now:()=>"2026-10-08T06:10:00.000Z"});
 const scope:CustomerProductReadScopeV1={tenant_id:baseScope.tenant_id,project_id:baseScope.project_id,group_id:baseScope.group_id,allowed_field_ids:[baseScope.field_id],can_preview_all_fields:false};
 const field=await builder.buildFieldSummaryV1(scope,baseScope.field_id);
 assert.equal(field.current_condition.status,"AVAILABLE");
 assert.equal(field.current_condition.root_zone_water?.available_water_fraction,0.61);
 const fields=await builder.buildFieldSummariesV1(scope);
 assert.equal(fields.length,1);
 const overview=await builder.buildCustomerOverviewV1(scope);
 assert.equal(overview.reporting_summary.current_fields,1);
 const workspace=await builder.buildFieldWorkspaceV1(scope,baseScope.field_id);
 assert.equal(workspace.current_condition.status,"AVAILABLE");
 assert.notEqual(workspace.evidence_summary.field_condition.status,"AVAILABLE"); // Current Wave-02 evidence summary is not an evidence artifact read model.
 assert.equal(calls.identity.some(s=>s.includes("FROM public.field_index_v1")),true);
 assert.equal(calls.identity.some(s=>s.includes("FROM public.twin_state_history_projection_v1")),false);
 assert.equal(calls.formal.some(s=>s.includes("FROM public.field_index_v1")),false);
 assert.equal(calls.formal.some(s=>s.includes("FROM public.twin_state_history_projection_v1")),true);
 const rejected=await builder.buildFieldSummaryV1({...scope,tenant_id:"another-tenant",allowed_field_ids:[baseScope.field_id]},baseScope.field_id);
 assert.equal(rejected.current_condition.status,"UNAVAILABLE");
});
