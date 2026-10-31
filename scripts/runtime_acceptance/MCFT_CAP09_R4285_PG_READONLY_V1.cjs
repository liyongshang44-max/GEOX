"use strict";
/* R4285 read-only PG identity/29-table/fenced-writer ACL probe,
 * mechanically inherited from the historic Attempt-3 probe without changing
 * its Git blob. No direct DB mutations; each query runs READ ONLY.
 */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const scopedEvidence=require("./MCFT_CAP09_QUALIFICATION_EVIDENCE_IDENTITY_V1.cjs");
const FENCED_WRITER="public.mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1(text,text,text,text,text,text,text,text,timestamptz,text,bigint,text,bigint,text,jsonb)";
const REQUIRED_PUBLIC_TABLES=Object.freeze([
 "facts",
 "twin_action_feedback_cycle_projection_v1",
 "twin_action_feedback_evidence_index_v1",
 "twin_action_feedback_projection_v1",
 "twin_active_lineage_index_v1",
 "twin_approved_plan_binding_projection_v1",
 "twin_decision_record_projection_v1",
 "twin_external_formal_forcing_base_cursor_v1",
 "twin_external_formal_forcing_base_target_v1",
 "twin_external_formal_forcing_controller_lease_v1",
 "twin_forecast_point_projection_v1",
 "twin_forecast_residual_projection_v1",
 "twin_forecast_result_latest_index_v1",
 "twin_forecast_run_projection_v1",
 "twin_forecast_success_latest_index_v1",
 "twin_object_idempotency_index_v1",
 "twin_runtime_authority_snapshot_v1",
 "twin_runtime_checkpoint_latest_index_v1",
 "twin_runtime_health_latest_index_v1",
 "twin_runtime_lease_v1",
 "twin_scenario_latest_index_v1",
 "twin_scenario_point_projection_v1",
 "twin_scenario_set_projection_v1",
 "twin_scenario_set_uniqueness_v1",
 "twin_shadow_online_scheduler_cursor_v1",
 "twin_shadow_online_scheduler_slot_v1",
 "twin_state_history_projection_v1",
 "twin_state_latest_index_v1",
 "twin_terminal_tick_uniqueness_v1"
]);
assert.equal(REQUIRED_PUBLIC_TABLES.length,29,"V2_PG_EXACT_29_TABLE_CONTRACT");

function scopedDbConnectionBindings(admission,environment){
 const owner=admission?.resourceEnvelope?.payload;
 const run=admission?.permitEnvelope?.payload?.run_id;
 assert(/^[0-9a-f]{12}$/.test(run||""),"V2_PG_RUN_ID_REQUIRED");
 assert(owner&&owner.run_id===run,"V2_PG_SIGNED_RESOURCE_RUN_MISMATCH");
 assert.equal(owner.database_host,"127.0.0.1","V2_PG_SIGNED_HOST_REQUIRED");
 assert(Number.isInteger(owner.database_port),"V2_PG_SIGNED_PORT_REQUIRED");
 const positive="mcft_cap09_requal_"+run+"_positive";
 const negative="mcft_cap09_requal_"+run+"_negative";
 assert.equal(owner.positive_database,positive,"V2_PG_SIGNED_POSITIVE_DATABASE");
 assert.equal(owner.negative_database,negative,"V2_PG_SIGNED_NEGATIVE_DATABASE");
 return [
  {side:"positive",database:positive,raw:environment?.DATABASE_URL},
  {side:"negative",database:negative,raw:environment?.BLOCKED_DATABASE_URL}
 ].map(row=>{
  assert(typeof row.raw==="string"&&row.raw.length>0,"V2_PG_URL_REQUIRED:"+row.side);
  let u;
  try{u=new URL(row.raw);}catch{throw new Error("V2_PG_URL_INVALID");}
  assert(["postgres:","postgresql:"].includes(u.protocol),"V2_PG_SCHEME_INVALID");
  assert.equal(u.hostname,owner.database_host,"V2_PG_ENDPOINT_HOST_MISMATCH");
  assert.equal(u.port,String(owner.database_port),"V2_PG_ENDPOINT_PORT_MISMATCH");
  assert(!u.search&&!u.hash,"V2_PG_URL_OVERRIDE_FORBIDDEN");
  assert(u.password.length>0,"V2_PG_EXPLICIT_PASSWORD_REQUIRED");
  const role=scopedEvidence.expectedEvidenceLogin({
   stage:"PRODUCER",positive,negative,database:row.database,connectionString:row.raw
  }); // Preserve SCOPED_EVIDENCE_URL_ROLE_MISMATCH (never weaken).
  return Object.freeze({side:row.side,database:row.database,role,url:row.raw});
 });
}

function assertPgCatalogContract(binding,facts){
 assert.equal(facts.session_user,binding.role,"V2_PG_SESSION_LOGIN_MISMATCH:"+binding.side);
 assert.equal(facts.current_user,binding.role,"V2_PG_EFFECTIVE_LOGIN_MISMATCH:"+binding.side);
 assert.equal(facts.database,binding.database,"V2_PG_AUTHENTICATED_DATABASE_MISMATCH:"+binding.side);
 assert.deepEqual(facts.tables,REQUIRED_PUBLIC_TABLES,"V2_PG_EXACT_29_TABLE_SCHEMA_MISMATCH:"+binding.side);
 assert.equal(facts.fenced_exists,true,"V2_PG_FENCED_WRITER_MISSING:"+binding.side);
 assert.equal(facts.direct_insert,false,"V2_PG_DIRECT_FACT_INSERT_FORBIDDEN:"+binding.side);
 assert.equal(facts.fenced_execute,true,"V2_PG_FENCED_WRITER_EXECUTE_REQUIRED:"+binding.side);
 assert.equal(facts.controller_acl,true,"V2_PG_CONTROLLER_TABLE_ACL_REQUIRED:"+binding.side);
}

// Do not accept a caller-supplied client, pretend a CI mock authenticated,
// or persist the connection string. The real pg client resolves from the
// signed installed release and connects with the unchanged child URLs.
async function probePreconsumePostgres({admission,releaseRoot,environment}){
 const bindings=scopedDbConnectionBindings(admission,environment);
 assert(path.isAbsolute(releaseRoot),"V2_PG_RELEASE_ROOT_REQUIRED");
 const pg=require(require.resolve("pg",{paths:[releaseRoot]}));
 assert(typeof pg.Pool==="function","V2_PG_CLIENT_MISSING");
 for(const binding of bindings){
  const pool=new pg.Pool({connectionString:binding.url,max:1,connectionTimeoutMillis:5000,
   query_timeout:5000,statement_timeout:5000});
  let client,transaction=false;
  try{
   client=await pool.connect();
   await client.query("BEGIN TRANSACTION READ ONLY");
   transaction=true;
   const id=(await client.query("SELECT session_user::text AS session_user,current_user::text AS current_user,current_database()::text AS database")).rows[0];
   const tables=(await client.query(
    "SELECT c.relname::text AS name FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.relname"
   )).rows.map(x=>x.name);
   const privileges=(await client.query(
    "SELECT to_regprocedure($1::text) IS NOT NULL AS fenced_exists, "+
    "has_table_privilege(current_user,'public.facts','INSERT') AS direct_insert",
    [FENCED_WRITER]
   )).rows[0];
   const fencedExecute=privileges.fenced_exists
    ?(await client.query("SELECT has_function_privilege(current_user,$1::text,'EXECUTE') AS allowed",[FENCED_WRITER])).rows[0]?.allowed
    :false;
   const controllerAcl=(await client.query(
    "SELECT bool_and("+
    "has_table_privilege(current_user,'public.'||name,'SELECT') AND "+
    "has_table_privilege(current_user,'public.'||name,'INSERT') AND "+
    "has_table_privilege(current_user,'public.'||name,'UPDATE')) AS allowed FROM (VALUES "+
    "('twin_external_formal_forcing_base_cursor_v1'),"+
    "('twin_external_formal_forcing_base_target_v1'),"+
    "('twin_external_formal_forcing_controller_lease_v1')) AS t(name)"
   )).rows[0]?.allowed;
   assertPgCatalogContract(binding,{...id,tables,...privileges,fenced_execute:fencedExecute,controller_acl:controllerAcl});
   // Unlike historical static attestation, this is CURRENT read-only data.
   // A previously used qualification database must never be reused.
   const count=(await client.query("SELECT count(*)::text AS n FROM public.facts")).rows[0]?.n;
   assert.equal(count,"0","R4285_PG_RUNTIME_FACT_ROWS_NOT_EMPTY:"+binding.side);
   await client.query("ROLLBACK");
   transaction=false;
  }catch(error){
   // Existing assertion codes are safe; never copy pg errors, URLs or passwords.
   if(error?.code==="ERR_ASSERTION"&&
      (/^(V2_PG_|SCOPED_EVIDENCE_)/).test(error.message||""))throw error;
   throw new Error("V2_PG_"+binding.side.toUpperCase()+"_READONLY_PROBE_FAILED");
  }finally{
   if(client){if(transaction){try{await client.query("ROLLBACK");}catch{}}
    client.release();}
   await pool.end();
  }
 }
 return Object.freeze({status:"EXACT_RUN_SCOPED_PG_ROLES_SCHEMA_FENCED_ACL_READONLY_VERIFIED",
  databases_verified:2,table_count_per_database:29,production_authorized:false});
}


module.exports={FENCED_WRITER,REQUIRED_PUBLIC_TABLES,scopedDbConnectionBindings,assertPgCatalogContract,probePreconsumePostgres};
