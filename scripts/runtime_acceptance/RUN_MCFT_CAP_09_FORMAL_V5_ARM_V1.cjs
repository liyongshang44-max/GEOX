#!/usr/bin/env node
"use strict";

const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {execFileSync,spawnSync}=require("node:child_process");
const {Pool}=require("pg");

const ROOT=path.resolve(__dirname,"../..");
const H5=path.join(ROOT,"scripts/runtime_acceptance/VERIFY_MCFT_CAP_09_FORMAL_V5_POST_GRADUATION_ARM_READINESS_V1.cjs");
const H5_RESULT=path.join(ROOT,"acceptance-output/MCFT_CAP_09_FORMAL_V5_POST_GRADUATION_ARM_READINESS_V1_RESULT.json");
const PHASE6_AUDIT=path.join(ROOT,"scripts/governance_acceptance/AUDIT_MCFT_CAP_09_PHASE6_GITHUB_PRODUCTION_OWNERS_V1.cjs");
const PHASE6_AUDIT_RESULT=path.join(ROOT,"acceptance-output/MCFT_CAP_09_PHASE6_GITHUB_PRODUCTION_OWNERS_AUDIT_V1.json");
const BUDGET_REL="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-FORCING-ACQUISITION-BUDGET-AUTHORITY-V1.json";
const REGISTRY_REL="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json";
const STORE_REL="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-ACTUAL-FORMAL-STORE-AUTHORITY-V3.json";
const FORMAL_DB="geox_mcft_cap09_s6_formal_t4r1_24h_v5";
const DEFAULT_OUT=path.join(os.homedir(),".geox","mcft-cap09","formal-v5","formal-arm-v1.json");

function fail(code,detail){throw new Error(detail===undefined?code:code+":"+detail);}
function req(ok,code,detail){if(!ok)fail(code,detail);}
function readJson(rel){return JSON.parse(fs.readFileSync(path.isAbsolute(rel)?rel:path.join(ROOT,rel),"utf8"));}
function sha256Bytes(bytes){return "sha256:"+crypto.createHash("sha256").update(bytes).digest("hex");}
function sha256File(p){return sha256Bytes(fs.readFileSync(p));}
function semanticDigest(v){return sha256Bytes(Buffer.from(JSON.stringify(v)));}
function git(...args){return execFileSync("git",args,{cwd:ROOT,encoding:"utf8"}).trim();}
function arg(prefix){const row=process.argv.slice(2).find(v=>v.startsWith(prefix+"="));return row?row.slice(prefix.length+1):null;}
function canonicalIso(v,code){const s=String(v||"").trim(),ms=Date.parse(s);req(Number.isFinite(ms)&&new Date(ms).toISOString()===s,code,s);return s;}
function ceilHour(ms){const h=3600000;return Math.ceil(ms/h)*h;}
function addHours(v,n){return new Date(Date.parse(v)+n*3600000).toISOString();}
function exactSha(v,code){const s=String(v||"").trim();req(/^[0-9a-f]{40}$/.test(s),code,s);return s;}
function isEffectiveCrop(v){
  return v?.schema_version==="geox_mcft_cap09_t4r1_current_crop_authority_composition_result_v1"
    && v.status==="PASS"
    && v.qualification_outcome==="CURRENT_CROP_CONTEXT_AUTHORITY_CANDIDATE_RESOLVED"
    && v.architecture_effective===true
    && v.runtime_consumption_authorized===true;
}

function selectWindow(input){
  const evaluationMs=Date.parse(canonicalIso(input.evaluated_at,"FORMAL_V5_ARM_EVALUATED_AT_INVALID"));
  const budgetMs=Number(input.selected_budget_ms);
  req(Number.isSafeInteger(budgetMs)&&budgetMs>0,"FORMAL_V5_ARM_BUDGET_INVALID");
  const a0=new Date(ceilHour(evaluationMs+budgetMs)).toISOString();
  const o00=addHours(a0,1);
  const o23=addHours(a0,24);
  const asOf=canonicalIso(input.authority_as_of,"FORMAL_V5_ARM_STAGE_AS_OF_INVALID");
  const validUntil=canonicalIso(input.authority_valid_until,"FORMAL_V5_ARM_STAGE_VALID_UNTIL_INVALID");
  const lifecycleEnd=canonicalIso(input.lifecycle_horizon_end_utc,"FORMAL_V5_ARM_LIFECYCLE_HORIZON_INVALID");
  const blockers=[];
  if(Date.parse(asOf)>evaluationMs)blockers.push("FORMAL_V5_ARM_FUTURE_STAGE_AUTHORITY_FORBIDDEN");
  if(Date.parse(o23)>Date.parse(validUntil))blockers.push("FORMAL_V5_ARM_STAGE_AUTHORITY_DOES_NOT_COVER_O23");
  if(Date.parse(o23)>Date.parse(lifecycleEnd))blockers.push("FORMAL_V5_ARM_LIFECYCLE_DOES_NOT_COVER_O23");
  return {status:blockers.length?"BLOCKED":"PASS",evaluated_at:new Date(evaluationMs).toISOString(),a0,o00,o23,selected_budget_ms:budgetMs,authority_as_of:asOf,authority_valid_until:validUntil,lifecycle_horizon_end_utc:lifecycleEnd,blockers};
}

async function liveZeroState(databaseUrl){
  const u=new URL(databaseUrl);
  req(["postgres:","postgresql:"].includes(u.protocol),"FORMAL_V5_ARM_DB_URL_INVALID");
  req(!["localhost","127.0.0.1","::1"].includes(u.hostname),"FORMAL_V5_ARM_REMOTE_DB_REQUIRED");
  const db=decodeURIComponent(u.pathname.replace(/^\//,""));
  req(db===FORMAL_DB,"FORMAL_V5_ARM_EXACT_DATABASE_REQUIRED",db);
  const pool=new Pool({connectionString:databaseUrl,application_name:"mcft-cap09-formal-v5-arm-zero-state",max:1});
  try{
    const client=await pool.connect();
    try{
      await client.query("BEGIN READ ONLY");
      const identity=String((await client.query("SELECT current_database() AS n")).rows[0]?.n||"");
      req(identity===FORMAL_DB,"FORMAL_V5_ARM_DB_SESSION_IDENTITY_REQUIRED",identity);
      const tables=Number((await client.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")).rows[0]?.n??-1);
      const routines=Number((await client.query("SELECT count(*)::int AS n FROM information_schema.routines WHERE routine_schema='public'")).rows[0]?.n??-1);
      await client.query("ROLLBACK");
      req(tables===0,"FORMAL_V5_ARM_LIVE_ZERO_STATE_BASE_TABLE_COUNT_NONZERO",String(tables));
      req(routines===0,"FORMAL_V5_ARM_LIVE_ZERO_STATE_ROUTINE_COUNT_NONZERO",String(routines));
      return {database_name:identity,public_base_table_count:tables,public_routine_count:routines,transaction_read_only:true};
    }finally{client.release();}
  }finally{await pool.end();}
}

function selftest(){
  const common={evaluated_at:"2026-09-18T18:13:00.000Z",selected_budget_ms:2081804,authority_as_of:"2026-09-18T04:00:00.000Z",lifecycle_horizon_end_utc:"2026-11-24T03:59:59.999Z"};
  const blocked=selectWindow({...common,authority_valid_until:"2026-09-19T10:00:00.000Z"});
  assert.equal(blocked.status,"BLOCKED");
  assert.equal(blocked.a0,"2026-09-18T19:00:00.000Z");
  assert.equal(blocked.o00,"2026-09-18T20:00:00.000Z");
  assert.equal(blocked.o23,"2026-09-19T19:00:00.000Z");
  assert.ok(blocked.blockers.includes("FORMAL_V5_ARM_STAGE_AUTHORITY_DOES_NOT_COVER_O23"));
  const pass=selectWindow({...common,authority_as_of:"2026-09-19T04:00:00.000Z",authority_valid_until:"2026-09-20T10:00:00.000Z",evaluated_at:"2026-09-19T05:13:00.000Z"});
  assert.equal(pass.status,"PASS");
  assert.equal(pass.a0,"2026-09-19T06:00:00.000Z");
  assert.equal(pass.o23,"2026-09-20T06:00:00.000Z");
  console.log(JSON.stringify({schema_version:"geox_mcft_cap09_formal_v5_arm_selftest_v1",status:"PASS",current_2026_09_18_04z_authority_blocks_new_window:true,fresh_2026_09_19_04z_fixture_admits_window:true,formal_database_mutation:false,a0_bootstrap:false,o00_started:false}));
}

async function main(){
  if(process.argv.includes("--selftest"))return selftest();
  req(process.env.GITHUB_ACTIONS!=="true"&&process.env.CI!=="true","FORMAL_V5_ARM_LOCAL_OPERATOR_HOST_ONLY");
  req(process.argv.includes("--operator-authorized"),"FORMAL_V5_ARM_EXPLICIT_OPERATOR_AUTHORIZATION_REQUIRED");
  const zeroProof=arg("--zero-state-proof");
  req(zeroProof,"FORMAL_V5_ARM_ZERO_STATE_PROOF_REQUIRED");

  execFileSync("git",["fetch","--no-tags","origin","main"],{cwd:ROOT,stdio:"inherit"});
  const head=exactSha(git("rev-parse","HEAD"),"FORMAL_V5_ARM_HEAD_INVALID");
  const originMain=exactSha(git("rev-parse","origin/main"),"FORMAL_V5_ARM_ORIGIN_MAIN_INVALID");
  req(head===originMain,"FORMAL_V5_ARM_HEAD_NOT_CURRENT_PROTECTED_MAIN",head+":"+originMain);
  req(git("status","--porcelain")==="","FORMAL_V5_ARM_WORKTREE_NOT_CLEAN");

  const h5=spawnSync(process.execPath,[H5,"--zero-state-proof="+path.resolve(zeroProof),"--expected-subject="+head],{cwd:ROOT,stdio:"inherit",env:process.env});
  req(h5.status===0,"FORMAL_V5_ARM_H5_REVERIFICATION_FAILED",String(h5.status));
  const h5Proof=readJson(H5_RESULT);
  req(h5Proof.status==="PASS"&&h5Proof.formal_v5_arm_ready===true,"FORMAL_V5_ARM_H5_PASS_REQUIRED");
  req(h5Proof.deployment_subject_sha===head&&h5Proof.zero_state_proof_subject_sha===head,"FORMAL_V5_ARM_H5_EXACT_SUBJECT_REQUIRED");

  const phase6=spawnSync(process.execPath,[PHASE6_AUDIT,"enforce"],{cwd:ROOT,stdio:"inherit",env:process.env});
  req(phase6.status===0,"FORMAL_V5_ARM_PHASE6_RETIREMENT_AUDIT_FAILED",String(phase6.status));
  const retirement=readJson(PHASE6_AUDIT_RESULT);
  req(retirement.status==="PASS"&&retirement.active_retired_owner_or_trigger_count===0&&retirement.retired_actions_write_count===0,"FORMAL_V5_ARM_RETIRED_TRIGGER_ZERO_REQUIRED");

  const dbUrl=String(process.env.GEOX_MCFT_CAP09_FORMAL_V5_DATABASE_URL||"").trim();
  req(dbUrl,"FORMAL_V5_ARM_DATABASE_URL_REQUIRED:GEOX_MCFT_CAP09_FORMAL_V5_DATABASE_URL");
  const zeroLive=await liveZeroState(dbUrl);

  const budget=readJson(BUDGET_REL);
  req(budget.status==="QUALIFIED_AND_FROZEN_FROM_EXACT_HEAD_REAL_TIMING_AND_CONTROLLED_DELAY"&&budget.timing_budget_qualified===true&&budget.timing_budget_frozen===true,"FORMAL_V5_ARM_FROZEN_TIMING_AUTHORITY_REQUIRED");
  req(budget.fixed_35_minute_lead_authorized_for_v5===false&&budget.hardcoded_replacement_budget_minutes===null,"FORMAL_V5_ARM_FIXED_35M_FORBIDDEN");
  const selectedBudget=Number(budget.qualified_budget?.selected_budget_ms);
  req(Number.isSafeInteger(selectedBudget)&&selectedBudget>0,"FORMAL_V5_ARM_SELECTED_BUDGET_REQUIRED");

  const store=readJson(STORE_REL);
  req(store.database_identity?.database_name===FORMAL_DB&&store.database_identity?.failed_predecessor_database==="geox_mcft_cap09_s6_formal_t4r1_24h_v4","FORMAL_V5_ARM_STORE_AUTHORITY_REQUIRED");
  req(store.database_identity?.failed_predecessor_reuse_forbidden===true&&store.database_identity?.data_clone_from_failed_v4_forbidden===true&&store.database_identity?.fresh_zero_state_required===true,"FORMAL_V5_ARM_FAILED_V4_REUSE_FORBIDDEN");

  const registry=readJson(REGISTRY_REL);
  req(registry.status==="ACTIVE"&&registry.candidate_artifacts_admissible===false,"FORMAL_V5_ARM_CURRENT_CROP_REGISTRY_REQUIRED");
  const evaluatedAt=new Date().toISOString();
  const evalMs=Date.parse(evaluatedAt);
  const eligible=(registry.entries||[]).filter(row=>Date.parse(row.authority_as_of)<=evalMs&&evalMs<=Date.parse(row.authority_valid_until)).sort((a,b)=>Date.parse(b.authority_as_of)-Date.parse(a.authority_as_of));
  req(eligible.length>0,"FORMAL_V5_ARM_NO_EFFECTIVE_CURRENT_CROP_AUTHORITY");
  const row=eligible[0];
  const authorityPath=path.join(ROOT,row.authority_ref);
  req(fs.existsSync(authorityPath),"FORMAL_V5_ARM_CURRENT_CROP_FILE_MISSING",row.authority_ref);
  req(sha256File(authorityPath)===row.authority_sha256,"FORMAL_V5_ARM_CURRENT_CROP_DIGEST_MISMATCH");
  const crop=JSON.parse(fs.readFileSync(authorityPath,"utf8"));
  req(isEffectiveCrop(crop),"FORMAL_V5_ARM_CURRENT_CROP_EFFECTIVE_REQUIRED");
  req(crop.crop_water_use_stage==="LATE","FORMAL_V5_ARM_CURRENT_CROP_LATE_REQUIRED");
  const bio=crop.biological_stage||{};
  req(bio.epistemic_class==="THERMAL_MODEL_DERIVED"&&bio.observed_biological_stage_claimed===false,"FORMAL_V5_ARM_THERMAL_STAGE_SEMANTICS_REQUIRED");

  const window=selectWindow({evaluated_at:evaluatedAt,selected_budget_ms:selectedBudget,authority_as_of:bio.authority_as_of,authority_valid_until:bio.authority_valid_until,lifecycle_horizon_end_utc:crop.lifecycle?.horizon_end_utc});
  const preflight={schema_version:"geox_mcft_cap09_formal_v5_arm_preflight_v1",status:window.status,subject_sha:head,formal_database_name:FORMAL_DB,current_crop_authority_ref:row.authority_ref,current_crop_authority_sha256:row.authority_sha256,crop_water_use_stage:crop.crop_water_use_stage,biological_stage:bio.resolved_biological_stage,window,live_zero_state:zeroLive,h5_reverified:true,phase6_retired_triggers_zero:true,formal_v5_arm:false,formal_database_mutation:false,a0_bootstrap:false,o00_started:false,mcft_cap09_completed:false};
  if(window.status!=="PASS"){
    console.log(JSON.stringify(preflight,null,2));
    process.exitCode=2;
    return;
  }

  const out=path.resolve(arg("--arm-output")||DEFAULT_OUT);
  req(!fs.existsSync(out),"FORMAL_V5_ARM_OUTPUT_ALREADY_EXISTS",out);
  const identity={subject_sha:head,formal_database_name:FORMAL_DB,a0:window.a0,o00:window.o00,o23:window.o23,current_crop_authority_sha256:row.authority_sha256,timing_authority_sha256:sha256File(path.join(ROOT,BUDGET_REL)),zero_state_proof_sha256:sha256File(path.resolve(zeroProof))};
  const epochId="mcft_cap09_am19_formal_v5_"+window.a0.replace(/[^0-9]/g,"")+"_"+head.slice(0,12);
  const arm={schema_version:"geox_mcft_cap09_formal_v5_arm_v1",status:"PASS",subject_sha:head,arm_identity_hash:semanticDigest({...identity,epoch_id:epochId}),epoch_id:epochId,formal_database_name:FORMAL_DB,formal_store_authority_ref:STORE_REL,formal_store_authority_blob_sha:"34fd3e92e0e628cf0db16e10df3633337fe81a1a",a0:window.a0,o00:window.o00,o23:window.o23,manifest_ref:"formal-arm://mcft-cap09/amendment19/v5/"+epochId+"/"+FORMAL_DB,arm_evaluated_at:evaluatedAt,timing_authority_ref:BUDGET_REL,timing_authority_sha256:identity.timing_authority_sha256,selected_budget_ms:selectedBudget,current_crop_authority_ref:row.authority_ref,current_crop_authority_sha256:row.authority_sha256,current_crop_authority_evidence_digest:crop.evidence_digest,crop_water_use_stage:crop.crop_water_use_stage,biological_stage:bio.resolved_biological_stage,stage_authority_as_of:bio.authority_as_of,stage_authority_valid_until:bio.authority_valid_until,zero_state_proof_sha256:identity.zero_state_proof_sha256,live_zero_state:zeroLive,h5_reverified:true,phase6_retired_triggers_zero:true,formal_v5_arm:true,formal_v5_epoch_selected:true,formal_database_mutation:false,a0_bootstrap:false,o00_started:false,provider_request_count:0,mcft_cap09_completed:false};
  fs.mkdirSync(path.dirname(out),{recursive:true});
  fs.writeFileSync(out,JSON.stringify(arm,null,2)+"\n",{flag:"wx"});
  console.log(JSON.stringify({...arm,arm_output_path:out},null,2));
}

main().catch(e=>{console.error(e instanceof Error?e.stack||e.message:String(e));process.exitCode=1;});
