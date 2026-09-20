#!/usr/bin/env node
"use strict";

const cp=require("node:child_process");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");

const ROOT=path.resolve(__dirname,"../..");
const FORMAL_DB="geox_mcft_cap09_s6_formal_t4r1_24h_v5";
const REGISTRY="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json";
const AUTHORITY_PREFIX="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-EFFECTIVE-CURRENT-CROP-AUTHORITY-";
const BASE_DIR=path.join(os.homedir(),".geox","mcft-cap09","formal-v5");
const DEFAULT_PRIOR_ARM=path.join(BASE_DIR,"arm-v1.json");
const DEFAULT_PRIOR_SCHEMA=path.join(BASE_DIR,"schema-acl-v1.json");
const DEFAULT_OUT=path.join(BASE_DIR,"materialized-zero-rearm-eligibility-v1.json");
const A0_ARTIFACTS=[
  path.join(BASE_DIR,"a0-production-replay-promotion-v1.json"),
  path.join(BASE_DIR,"a0-bootstrap-v1.json"),
];

const EXPECTED_TABLES=[
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
  "twin_terminal_tick_uniqueness_v1",
].sort();
const EXPECTED_ROUTINES=[
  "mcft_cap09_twin_runtime_append_fact_v1",
  "mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1",
].sort();

function fail(code,detail){throw new Error(detail===undefined?code:code+":"+String(detail));}
function req(ok,code,detail){if(!ok)fail(code,detail);}
function arg(name){const row=process.argv.slice(2).find(v=>v.startsWith(name+"="));return row?row.slice(name.length+1):null;}
function has(name){return process.argv.includes(name);}
function git(...args){return cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8"}).trim();}
function readJson(abs){return JSON.parse(fs.readFileSync(abs,"utf8"));}
function canonicalIso(value,code){const text=String(value||"").trim();const ms=Date.parse(text);req(Number.isFinite(ms)&&new Date(ms).toISOString()===text,code,text);return text;}
function splitLines(value){return String(value||"").split(/\r?\n/).map(v=>v.trim()).filter(Boolean);}
function psql(url,sql){
  const env={...process.env,PGOPTIONS:"-c default_transaction_read_only=on"};
  return cp.execFileSync("psql",[url,"-At","-v","ON_ERROR_STOP=1","-c",sql],{cwd:ROOT,encoding:"utf8",env}).trim();
}
function statusPath(change){
  const parts=change.split("\t");
  return {status:parts[0]||"",path:parts.at(-1)||""};
}
function allowedPostArmChange(change){
  return (
    (change.status==="A"&&change.path.startsWith(AUTHORITY_PREFIX)&&change.path.endsWith(".json")&&!change.path.includes("CANDIDATE"))
    ||(change.status==="M"&&change.path===REGISTRY)
  );
}
function auditInvalidation(prior,head){
  const firstParent=splitLines(git("rev-list","--first-parent",head));
  req(firstParent.includes(prior),"FORMAL_V5_REARM_PRIOR_ARM_NOT_FIRST_PARENT_ANCESTOR",prior+"->"+head);
  const commits=prior===head?[]:splitLines(git("rev-list","--reverse","--first-parent",prior+".."+head));
  const invalidating=[];
  const audited=[];
  for(const commit of commits){
    const parent=git("rev-parse",commit+"^1");
    const changes=splitLines(git("diff","--name-status",parent,commit)).map(statusPath);
    const disallowed=changes.filter(change=>!allowedPostArmChange(change));
    if(disallowed.length)invalidating.push(...disallowed.map(change=>({commit,parent,...change})));
    audited.push({commit,parent,changes,invalidating_change_count:disallowed.length});
  }
  req(invalidating.length>0,"FORMAL_V5_REARM_PRIOR_ARM_NOT_INVALIDATED_BY_SEMANTIC_CHANGE");
  return {audited,invalidating};
}
function queryMaterializedZeroStore(url){
  req(/^postgres(?:ql)?:\/\//.test(url),"FORMAL_V5_REARM_DATABASE_URL_REQUIRED");
  const header=psql(url,"SELECT current_setting('transaction_read_only')||'|'||current_database()||'|'||transaction_timestamp();");
  const [readOnly,databaseName,dbNowRaw]=header.split("|");
  req(readOnly==="on","FORMAL_V5_REARM_TRANSACTION_READ_ONLY_REQUIRED",readOnly);
  req(databaseName===FORMAL_DB,"FORMAL_V5_REARM_DATABASE_IDENTITY_MISMATCH",databaseName);
  const tables=splitLines(psql(url,"SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name;")).sort();
  const routines=splitLines(psql(url,"SELECT p.proname FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY p.proname;")).sort();
  req(JSON.stringify(tables)===JSON.stringify(EXPECTED_TABLES),"FORMAL_V5_REARM_MATERIALIZED_TABLE_SET_MISMATCH",JSON.stringify(tables));
  req(JSON.stringify(routines)===JSON.stringify(EXPECTED_ROUTINES),"FORMAL_V5_REARM_MATERIALIZED_ROUTINE_SET_MISMATCH",JSON.stringify(routines));
  const union=EXPECTED_TABLES.map(name=>"SELECT '"+name.replaceAll("'","''")+"' AS rel,count(*)::bigint AS n FROM public.\""+name.replaceAll('"','""')+"\"").join(" UNION ALL ");
  const counts=splitLines(psql(url,union)).map(line=>{const [rel,n]=line.split("|");return {relation:rel,row_count:Number(n)};});
  const nonzero=counts.filter(row=>row.row_count!==0);
  req(nonzero.length===0,"FORMAL_V5_REARM_PRE_A0_ROWS_NONZERO",JSON.stringify(nonzero));
  return {
    database_name:databaseName,
    database_now:canonicalIso(new Date(dbNowRaw).toISOString(),"FORMAL_V5_REARM_DATABASE_NOW_INVALID"),
    transaction_read_only:true,
    public_base_table_count:tables.length,
    public_routine_count:routines.length,
    public_tables:tables,
    public_routines:routines,
    all_table_rows_zero:true,
    exact_row_counts:counts,
  };
}
function selftest(){
  const allowedAuthority={status:"A",path:AUTHORITY_PREFIX+"2099-01-01T00Z-V1.json"};
  const allowedRegistry={status:"M",path:REGISTRY};
  const badRuntime={status:"M",path:"apps/server/src/runtime/twin_runtime/semantic-drift.ts"};
  req(allowedPostArmChange(allowedAuthority),"FORMAL_V5_REARM_SELFTEST_AUTHORITY_APPEND");
  req(allowedPostArmChange(allowedRegistry),"FORMAL_V5_REARM_SELFTEST_REGISTRY_APPEND");
  req(!allowedPostArmChange(badRuntime),"FORMAL_V5_REARM_SELFTEST_RUNTIME_DRIFT");
  process.stdout.write(JSON.stringify({
    schema_version:"geox_mcft_cap09_formal_v5_materialized_zero_rearm_eligibility_selftest_v1",
    status:"PASS",
    fresh_zero_arm_path_preserved:true,
    materialized_zero_rearm_requires_explicit_mode:true,
    invalidated_prior_arm_required:true,
    exact_29_table_2_routine_zero_row_state_required:true,
    prior_a0_artifact_absence_required:true,
    database_write_count:0,
    production_owner_mutation:false,
    formal_v5_arm:false,
    a0_authorized:false,
  },null,2)+"\n");
}
function main(){
  if(has("--selftest"))return selftest();
  req(!process.env.GITHUB_ACTIONS&&!process.env.CI,"FORMAL_V5_REARM_LOCAL_PRODUCTION_HOST_ONLY");
  git("fetch","--no-tags","origin","main");
  const head=git("rev-parse","HEAD");
  const origin=git("rev-parse","origin/main");
  req(head===origin,"FORMAL_V5_REARM_HEAD_NOT_CURRENT_PROTECTED_MAIN",head+":"+origin);
  req(git("status","--porcelain")==="","FORMAL_V5_REARM_WORKTREE_MUST_BE_CLEAN");

  const priorArmPath=path.resolve(arg("--prior-arm")||DEFAULT_PRIOR_ARM);
  const priorSchemaPath=path.resolve(arg("--prior-schema-proof")||DEFAULT_PRIOR_SCHEMA);
  req(fs.existsSync(priorArmPath),"FORMAL_V5_REARM_PRIOR_ARM_REQUIRED",priorArmPath);
  req(fs.existsSync(priorSchemaPath),"FORMAL_V5_REARM_PRIOR_SCHEMA_PROOF_REQUIRED",priorSchemaPath);
  for(const artifact of A0_ARTIFACTS)req(!fs.existsSync(artifact),"FORMAL_V5_REARM_PRIOR_A0_ARTIFACT_PRESENT",artifact);

  const priorArm=readJson(priorArmPath);
  req(priorArm.schema_version==="geox_mcft_cap09_formal_v5_arm_v1"&&priorArm.status==="PASS","FORMAL_V5_REARM_PRIOR_ARM_INVALID");
  req(/^[0-9a-f]{40}$/.test(String(priorArm.subject_sha||"")),"FORMAL_V5_REARM_PRIOR_ARM_SUBJECT_INVALID");
  req(/^sha256:[0-9a-f]{64}$/.test(String(priorArm.arm_identity_hash||"")),"FORMAL_V5_REARM_PRIOR_ARM_IDENTITY_INVALID");
  req(priorArm.subject_sha!==head,"FORMAL_V5_REARM_PRIOR_ARM_ALREADY_CURRENT_HEAD");
  req(priorArm.formal_database_name===FORMAL_DB,"FORMAL_V5_REARM_PRIOR_ARM_DATABASE_MISMATCH");
  req(priorArm.formal_v5_arm===true&&priorArm.formal_v5_epoch_selected===true,"FORMAL_V5_REARM_PRIOR_ARM_NOT_ARMED");
  req(priorArm.a0_bootstrap===false&&priorArm.o00_started===false&&priorArm.provider_request_count===0,"FORMAL_V5_REARM_PRIOR_ARM_ADVANCED_PAST_PRE_A0");
  try{cp.execFileSync("git",["merge-base","--is-ancestor",priorArm.subject_sha,head],{cwd:ROOT,stdio:"ignore"});}catch{fail("FORMAL_V5_REARM_PRIOR_ARM_NOT_ANCESTOR",priorArm.subject_sha+"->"+head);}

  const priorSchema=readJson(priorSchemaPath);
  req(priorSchema.schema_version==="geox_mcft_cap09_formal_v5_schema_acl_materialization_v1","FORMAL_V5_REARM_PRIOR_SCHEMA_PROOF_SCHEMA_INVALID");
  req(["PASS","PASS_ALREADY_MATERIALIZED_IDEMPOTENT"].includes(priorSchema.status),"FORMAL_V5_REARM_PRIOR_SCHEMA_PROOF_NOT_PASS");
  req(priorSchema.subject_sha===priorArm.subject_sha,"FORMAL_V5_REARM_PRIOR_SCHEMA_SUBJECT_MISMATCH");
  req((priorSchema.database_name||priorSchema.formal_database_name)===FORMAL_DB,"FORMAL_V5_REARM_PRIOR_SCHEMA_DATABASE_MISMATCH");
  req(priorSchema.public_table_count===29&&priorSchema.public_routine_count===2&&priorSchema.all_table_rows_zero===true,"FORMAL_V5_REARM_PRIOR_SCHEMA_NOT_MATERIALIZED_ZERO");
  req(priorSchema.formal_v5_arm===true&&priorSchema.a0_bootstrap===false&&priorSchema.o00_started===false&&priorSchema.provider_request_count===0,"FORMAL_V5_REARM_PRIOR_SCHEMA_ADVANCED_PAST_PRE_A0");

  const invalidation=auditInvalidation(priorArm.subject_sha,head);
  const url=String(process.env.GEOX_MCFT_CAP09_FORMAL_V5_DATABASE_URL||"").trim();
  const store=queryMaterializedZeroStore(url);

  const result={
    schema_version:"geox_mcft_cap09_formal_v5_materialized_zero_rearm_eligibility_v1",
    status:"PASS",
    current_subject_sha:head,
    prior_arm_subject_sha:priorArm.subject_sha,
    prior_arm_identity_hash:priorArm.arm_identity_hash,
    prior_arm_epoch_id:priorArm.epoch_id,
    prior_arm_artifact_path:priorArmPath,
    prior_schema_proof_path:priorSchemaPath,
    prior_arm_invalidated_by_non_authority_change:true,
    first_parent_commit_count_since_prior_arm:invalidation.audited.length,
    invalidating_change_count:invalidation.invalidating.length,
    invalidating_changes:invalidation.invalidating,
    formal_database_name:FORMAL_DB,
    observed_store_phase:"SCHEMA_ACL_MATERIALIZED_ZERO_ROWS_PRE_A0",
    public_base_table_count:store.public_base_table_count,
    public_routine_count:store.public_routine_count,
    all_table_rows_zero:true,
    transaction_read_only:true,
    database_now:store.database_now,
    prior_a0_artifact_absence_proven:true,
    rearm_eligible:true,
    fresh_zero_arm_path_preserved:true,
    existing_arm_artifact_must_not_be_overwritten:true,
    new_arm_output_must_be_distinct:true,
    schema_acl_revalidation_required_after_rearm:true,
    formal_database_mutation:false,
    production_owner_mutation:false,
    provider_request_count:0,
    formal_v5_arm:false,
    a0_authorized:false,
    o00_authorized:false,
    mcft_cap09_completed:false,
  };
  const out=path.resolve(arg("--out")||DEFAULT_OUT);
  fs.mkdirSync(path.dirname(out),{recursive:true});
  fs.writeFileSync(out,JSON.stringify(result,null,2)+"\n");
  process.stdout.write(JSON.stringify({...result,rearm_eligibility_artifact_path:out},null,2)+"\n");
}
try{main();}catch(error){console.error(error instanceof Error?error.stack||error.message:String(error));process.exitCode=1;}
