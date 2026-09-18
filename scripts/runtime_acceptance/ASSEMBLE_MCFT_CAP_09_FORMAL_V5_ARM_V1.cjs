#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const crypto=require("node:crypto");
const cp=require("node:child_process");

const ROOT=path.resolve(__dirname,"../..");
const HOUR=3_600_000;
const DAY=24*HOUR;
const FORMAL_DB="geox_mcft_cap09_s6_formal_t4r1_24h_v5";
const STORE_AUTH="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-ACTUAL-FORMAL-STORE-AUTHORITY-V3.json";
const STORE_AUTH_BLOB="34fd3e92e0e628cf0db16e10df3633337fe81a1a";
const BUDGET_AUTH="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-FORCING-ACQUISITION-BUDGET-AUTHORITY-V1.json";
const BUDGET_AUTH_BLOB="82b9cfadc94aa0a3f83b69a8a111ac6c5d993cf1";
const CROP_AUTH="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V3.json";
const CROP_AUTH_BLOB="4bc1f8dda6559c8951db915132172b65469affcb";
const CURRENT_REGISTRY="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json";
const H5="scripts/runtime_acceptance/VERIFY_MCFT_CAP_09_FORMAL_V5_POST_GRADUATION_ARM_READINESS_V1.cjs";
const H5_OUT="acceptance-output/MCFT_CAP_09_FORMAL_V5_POST_GRADUATION_ARM_READINESS_V1_RESULT.json";
const PHASE6="scripts/governance_acceptance/AUDIT_MCFT_CAP_09_PHASE6_GITHUB_PRODUCTION_OWNERS_V1.cjs";
const DEFAULT_OUT=path.join(os.homedir(),".geox","mcft-cap09","formal-v5","arm-v1.json");

function fail(code,detail){throw new Error(detail===undefined?code:code+":"+String(detail));}
function req(ok,code,detail){if(!ok)fail(code,detail);}
function readJson(rel){return JSON.parse(fs.readFileSync(path.join(ROOT,rel),"utf8"));}
function git(...args){return cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8"}).trim();}
function arg(name){const x=process.argv.slice(2).find(v=>v.startsWith(name+"="));return x?x.slice(name.length+1):null;}
function has(name){return process.argv.includes(name);}
function sha256Bytes(bytes){return "sha256:"+crypto.createHash("sha256").update(bytes).digest("hex");}
function canonicalJson(v){
  if(v===undefined)fail("FORMAL_V5_ARM_CANONICAL_UNDEFINED_FORBIDDEN");
  if(v===null||typeof v==="string"||typeof v==="boolean")return JSON.stringify(v);
  if(typeof v==="number"){req(Number.isFinite(v),"FORMAL_V5_ARM_CANONICAL_NUMBER_INVALID");return Object.is(v,-0)?"0":JSON.stringify(v);}
  if(Array.isArray(v))return "["+v.map(canonicalJson).join(",")+"]";
  if(typeof v==="object")return "{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canonicalJson(v[k])).join(",")+"}";
  fail("FORMAL_V5_ARM_CANONICAL_TYPE_UNSUPPORTED");
}
function semhash(v){return "sha256:"+crypto.createHash("sha256").update(canonicalJson(v),"utf8").digest("hex");}
function iso(ms){return new Date(ms).toISOString();}
function canonicalIso(v,code){const t=String(v||"");const ms=Date.parse(t);req(Number.isFinite(ms)&&new Date(ms).toISOString()===t,code);return t;}
function ceilHour(ms){return Math.ceil(ms/HOUR)*HOUR;}
function stageAt(ageDays,lengths){
  if(!Array.isArray(lengths)||lengths.length!==4)return null;
  const [a,b,c,d]=lengths;
  const b1=a,b2=a+b,b3=a+b+c,b4=a+b+c+d;
  if(!Number.isFinite(ageDays)||ageDays<0||ageDays>=b4)return null;
  if(ageDays<b1)return "INITIAL";
  if(ageDays<b2)return "DEVELOPMENT";
  if(ageDays<b3)return "MID";
  return "LATE";
}
function evaluateSlot(targetMs,crop){
  const variants=crop.model_stage_prior?.variant_stage_lengths_days;
  const w=crop.planting_authority?.possible_event_window_utc;
  const p=crop.as_of_derivation_policy;
  req(Array.isArray(variants)&&variants.length===6,"FORMAL_V5_ARM_EXACT_SIX_STAGE_VARIANTS_REQUIRED");
  req(p?.backward_stability_hours===6&&p?.forward_transition_guard_hours===30,"FORMAL_V5_ARM_STAGE_GUARD_DRIFT");
  req(p?.planting_time_uncertainty_must_be_carried===true&&p?.future_observations_authorized===false,"FORMAL_V5_ARM_STAGE_POLICY_DRIFT");
  const start=Date.parse(w?.start_inclusive),end=Date.parse(w?.end_exclusive);
  req(Number.isFinite(start)&&Number.isFinite(end)&&start<end,"FORMAL_V5_ARM_PLANTING_WINDOW_INVALID");
  const stages=new Set();
  for(const variant of variants){
    for(const planting of [start,end-1]){
      for(const t of [targetMs-6*HOUR,targetMs,targetMs+30*HOUR]){
        const stage=stageAt((t-planting)/DAY,variant);
        if(!stage)return {stage:null,stages:["OUTSIDE_MODEL_WINDOW"]};
        stages.add(stage);
      }
    }
  }
  const allowed=new Set(p.allowed_stage_codes||[]);
  const stage=stages.size===1?[...stages][0]:null;
  return {stage:stage&&allowed.has(stage)?stage:null,stages:[...stages].sort()};
}
function cropContextHash(stage,logicalTime){
  return semhash({
    authority_ref:CROP_AUTH,
    authority_blob_sha:CROP_AUTH_BLOB,
    derived_context_authority:"FORMAL_DERIVED_CROP_WATER_USE_STAGE_CONTEXT_V3",
    crop_stage_code:stage,
    derivation_authority_time:logicalTime,
    observed_biological_stage_claimed:false,
    field_calibration_status:"NOT_FIELD_CALIBRATED",
  });
}
function selectEpoch({armMs,crop,currentCrop}){
  const horizon=Date.parse(currentCrop.lifecycle?.horizon_end_utc);
  req(Number.isFinite(horizon),"FORMAL_V5_ARM_LIFECYCLE_HORIZON_REQUIRED");
  const currentStage=String(currentCrop.crop_water_use_stage||"");
  req(["INITIAL","DEVELOPMENT","MID","LATE"].includes(currentStage),"FORMAL_V5_ARM_CURRENT_WATER_USE_STAGE_REQUIRED");
  const first=ceilHour(armMs+36*HOUR);
  let firstDiagnostic=null;
  for(let candidate=first;candidate+23*HOUR<=horizon;candidate+=HOUR){
    const slots=[];
    let ok=true;
    for(let i=0;i<24;i++){
      const t=candidate+i*HOUR;
      const e=evaluateSlot(t,crop);
      if(!e.stage||e.stage!==currentStage){
        if(!firstDiagnostic)firstDiagnostic={candidate_o00:iso(candidate),slot_id:"O"+String(i).padStart(2,"0"),logical_time:iso(t),current_stage:currentStage,derived_stage:e.stage,derived_stages:e.stages};
        ok=false;break;
      }
      const logical=iso(t);
      slots.push({slot_id:"O"+String(i).padStart(2,"0"),logical_time:logical,crop_stage_code:e.stage,crop_stage_context_hash:cropContextHash(e.stage,logical)});
    }
    if(ok){
      return {
        o00:iso(candidate),
        o23:iso(candidate+23*HOUR),
        a0:iso(candidate-HOUR),
        readiness_deadline:iso(candidate-12*HOUR),
        slot_contexts:slots,
        current_water_use_stage:currentStage,
        first_ineligible_candidate:firstDiagnostic,
      };
    }
  }
  fail("FORMAL_V5_ARM_NO_ELIGIBLE_WHOLE_WINDOW_BEFORE_LIFECYCLE_HORIZON",JSON.stringify(firstDiagnostic));
}
function epochId(o00){return "mcft_cap09_external_formal_window_epoch_"+o00.replace(/[-:.]/g,"").replace("Z","z").toLowerCase()+"_v5";}
function psqlZeroState(url){
  const env={...process.env,PGOPTIONS:"-c default_transaction_read_only=on"};
  const sql="SELECT current_setting('transaction_read_only'),current_database(),(SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'),(SELECT count(*)::int FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'),transaction_timestamp();";
  const out=cp.execFileSync("psql",[url,"-AtF","|","-v","ON_ERROR_STOP=1","-c",sql],{cwd:ROOT,encoding:"utf8",env}).trim();
  const parts=out.split("|");
  req(parts.length===5,"FORMAL_V5_ARM_ZERO_STATE_ROW_INVALID");
  req(parts[0]==="on","FORMAL_V5_ARM_TRANSACTION_READ_ONLY_REQUIRED",parts[0]);
  req(parts[1]===FORMAL_DB,"FORMAL_V5_ARM_DATABASE_IDENTITY_MISMATCH",parts[1]);
  req(parts[2]==="0","FORMAL_V5_ARM_PUBLIC_TABLES_MUST_BE_ZERO",parts[2]);
  req(parts[3]==="0","FORMAL_V5_ARM_PUBLIC_ROUTINES_MUST_BE_ZERO",parts[3]);
  const dbNow=canonicalIso(new Date(parts[4]).toISOString(),"FORMAL_V5_ARM_DATABASE_NOW_INVALID");
  return {database_now:dbNow,public_base_table_count:0,public_routine_count:0,transaction_read_only:true};
}
function selectCurrentCrop(nowMs){
  const registry=readJson(CURRENT_REGISTRY);
  req(registry.schema_version==="geox_mcft_cap09_effective_current_crop_authority_registry_v1"&&registry.status==="ACTIVE","FORMAL_V5_ARM_CURRENT_CROP_REGISTRY_INVALID");
  req(registry.selection_policy==="LATEST_EFFECTIVE_AUTHORITY_AS_OF_NOT_AFTER_LOGICAL_TIME_WITHIN_VALIDITY_WINDOW"&&registry.candidate_artifacts_admissible===false,"FORMAL_V5_ARM_CURRENT_CROP_REGISTRY_POLICY_INVALID");
  const rows=(registry.entries||[]).filter(row=>{
    const a=Date.parse(row.authority_as_of),v=Date.parse(row.authority_valid_until);
    return Number.isFinite(a)&&Number.isFinite(v)&&a<=nowMs&&nowMs<=v;
  }).sort((a,b)=>Date.parse(b.authority_as_of)-Date.parse(a.authority_as_of));
  req(rows.length>0,"FORMAL_V5_ARM_NO_CURRENT_EFFECTIVE_CROP_AUTHORITY");
  const row=rows[0],abs=path.join(ROOT,row.authority_ref),bytes=fs.readFileSync(abs);
  req(sha256Bytes(bytes)===row.authority_sha256,"FORMAL_V5_ARM_CURRENT_CROP_DIGEST_MISMATCH");
  const a=JSON.parse(bytes.toString("utf8"));
  req(a.status==="PASS"&&a.architecture_effective===true&&a.runtime_consumption_authorized===true,"FORMAL_V5_ARM_CURRENT_CROP_NOT_EFFECTIVE");
  req(a.lifecycle?.domain_state==="ACTIVE"&&a.lifecycle?.authority_status==="RESOLVED"&&a.lifecycle?.authority_validity==="VALID","FORMAL_V5_ARM_CURRENT_CROP_LIFECYCLE_INVALID");
  req(a.scope?.field_id==="field_kbs_mcse_t4r1"&&a.scope?.zone_id==="zone_kbs_mcse_t4r1_crop_formal_v1","FORMAL_V5_ARM_CURRENT_CROP_SCOPE_INVALID");
  req(a.formal_v5_authorized===false&&a.a0_authorized===false&&a.o00_o23_authorized===false,"FORMAL_V5_ARM_CURRENT_CROP_SILENT_PROMOTION_FORBIDDEN");
  return {row,authority:a};
}
function selftest(){
  const crop=readJson(CROP_AUTH);
  const current={lifecycle:{horizon_end_utc:"2026-11-24T03:59:59.999Z"},crop_water_use_stage:"LATE"};
  const selected=selectEpoch({armMs:Date.parse("2026-09-19T00:00:00.000Z"),crop,currentCrop:current});
  req(selected.slot_contexts.length===24,"FORMAL_V5_ARM_SELFTEST_24_SLOTS_REQUIRED");
  req(selected.slot_contexts.every(x=>x.crop_stage_code==="LATE"),"FORMAL_V5_ARM_SELFTEST_LATE_WINDOW_REQUIRED");
  const budget=readJson(BUDGET_AUTH);
  req(budget.qualified_budget?.selected_budget_ms===2081804&&budget.fixed_35_minute_lead_authorized_for_v5===false,"FORMAL_V5_ARM_SELFTEST_TIMING_BUDGET_REQUIRED");
  process.stdout.write(JSON.stringify({schema_version:"geox_mcft_cap09_formal_v5_arm_selftest_v1",status:"PASS",selected_o00:selected.o00,selected_o23:selected.o23,slot_count:24,fixed_35_minute_lead_used:false,provider_request_count:0,formal_database_mutation:false,a0_bootstrap:false,o00_started:false},null,2)+"\n");
}
function main(){
  if(has("--selftest"))return selftest();
  req(!process.env.GITHUB_ACTIONS&&!process.env.CI,"FORMAL_V5_ARM_LOCAL_NON_GITHUB_HOST_ONLY");
  req(has("--operator-authorized"),"FORMAL_V5_ARM_EXPLICIT_OPERATOR_AUTHORIZATION_REQUIRED");
  const zeroPath=arg("--zero-state-proof");
  req(zeroPath&&fs.existsSync(path.resolve(zeroPath)),"FORMAL_V5_ARM_ZERO_STATE_PROOF_REQUIRED");

  git("fetch","--no-tags","origin","main");
  const head=git("rev-parse","HEAD"),originMain=git("rev-parse","origin/main");
  req(head===originMain,"FORMAL_V5_ARM_HEAD_NOT_CURRENT_PROTECTED_MAIN",head+":"+originMain);
  req(git("status","--porcelain")==="","FORMAL_V5_ARM_WORKTREE_MUST_BE_CLEAN");
  req(git("rev-parse","HEAD:"+STORE_AUTH)===STORE_AUTH_BLOB,"FORMAL_V5_ARM_STORE_AUTHORITY_BLOB_DRIFT");
  req(git("rev-parse","HEAD:"+BUDGET_AUTH)===BUDGET_AUTH_BLOB,"FORMAL_V5_ARM_TIMING_AUTHORITY_BLOB_DRIFT");
  req(git("rev-parse","HEAD:"+CROP_AUTH)===CROP_AUTH_BLOB,"FORMAL_V5_ARM_CROP_AUTHORITY_BLOB_DRIFT");

  cp.execFileSync(process.execPath,[path.join(ROOT,H5),"--zero-state-proof="+path.resolve(zeroPath),"--expected-subject="+head],{cwd:ROOT,stdio:"inherit",env:process.env});
  const h5=readJson(H5_OUT);
  req(h5.status==="PASS"&&h5.deployment_subject_sha===head&&h5.formal_v5_arm_ready===true,"FORMAL_V5_ARM_H5_REVERIFICATION_REQUIRED");
  req(h5.exact_one_live_fenced_owner_per_runtime_role_reverified===true,"FORMAL_V5_ARM_LIVE_OWNER_REVERIFICATION_REQUIRED");

  const phase6=cp.spawnSync(process.execPath,[path.join(ROOT,PHASE6),"enforce"],{cwd:ROOT,encoding:"utf8",env:process.env});
  if(phase6.status!==0){process.stderr.write(phase6.stdout||"");process.stderr.write(phase6.stderr||"");fail("FORMAL_V5_ARM_PHASE6_RETIRED_TRIGGER_ZERO_REQUIRED");}

  const url=String(process.env.GEOX_MCFT_CAP09_FORMAL_V5_DATABASE_URL||"").trim();
  req(/^postgres(?:ql)?:\/\//.test(url),"FORMAL_V5_ARM_DATABASE_URL_REQUIRED");
  const zero=psqlZeroState(url);
  const armMs=Date.parse(zero.database_now);
  const current=selectCurrentCrop(armMs);
  const crop=readJson(CROP_AUTH);
  const timing=readJson(BUDGET_AUTH);
  req(timing.status==="QUALIFIED_AND_FROZEN_FROM_EXACT_HEAD_REAL_TIMING_AND_CONTROLLED_DELAY"&&timing.timing_budget_qualified===true&&timing.timing_budget_frozen===true,"FORMAL_V5_ARM_TIMING_AUTHORITY_NOT_FROZEN");
  req(timing.fixed_35_minute_lead_authorized_for_v5===false&&timing.hardcoded_replacement_budget_minutes===null,"FORMAL_V5_ARM_FIXED_35_MINUTE_LEAD_FORBIDDEN");
  req(timing.qualified_budget?.selected_budget_ms===2081804&&timing.qualified_budget?.status==="PASS","FORMAL_V5_ARM_EXACT_QUALIFIED_BUDGET_REQUIRED");

  const epoch=selectEpoch({armMs,crop,currentCrop:current.authority});
  req(Date.parse(epoch.readiness_deadline)>armMs,"FORMAL_V5_ARM_READINESS_DEADLINE_MUST_BE_FUTURE");
  const core={
    schema_version:"geox_mcft_cap09_formal_v5_arm_v1",
    status:"PASS",
    subject_sha:head,
    formal_database_name:FORMAL_DB,
    formal_store_authority_ref:STORE_AUTH,
    formal_store_authority_blob_sha:STORE_AUTH_BLOB,
    arm_time_database_utc:zero.database_now,
    epoch_id:epochId(epoch.o00),
    a0:epoch.a0,
    o00:epoch.o00,
    o23:epoch.o23,
    readiness_deadline:epoch.readiness_deadline,
    slot_contexts:epoch.slot_contexts,
    current_crop_authority_ref:current.row.authority_ref,
    current_crop_authority_sha256:current.row.authority_sha256,
    current_crop_stage_at_arm:current.authority.crop_water_use_stage,
    current_biological_stage_at_arm:current.authority.biological_stage?.resolved_biological_stage,
    forcing_timing_authority_ref:BUDGET_AUTH,
    forcing_timing_authority_blob_sha:BUDGET_AUTH_BLOB,
    forcing_acquisition_budget_ms:2081804,
    forcing_acquisition_start_deadline_rule:"BASE_MINUS_QUALIFIED_END_TO_END_BUDGET",
    physical_formal_visibility_deadline_rule:"BASE",
    fixed_35_minute_lead_used:false,
    minimum_epoch_selection_governance_lead_hours:36,
    formal_clock_mode_required:"SYSTEM_DATABASE_UTC",
    github_production_wake_allowed:false,
    exact_one_live_owner_per_runtime_role_reverified:true,
    retired_github_production_trigger_zero_reverified:true,
    zero_state_revalidated_at_actual_arm:true,
    public_base_table_count_before_arm:zero.public_base_table_count,
    public_routine_count_before_arm:zero.public_routine_count,
    explicit_operator_authorization:true,
    formal_database_mutation:false,
    schema_materialization:false,
    a0_bootstrap:false,
    o00_started:false,
    provider_request_count:0,
    final_actual_24h_still_required:true,
    mcft_cap09_completed:false,
  };
  const arm={...core,arm_identity_hash:semhash(core),formal_v5_arm:true,formal_v5_epoch_selected:true};
  const out=path.resolve(arg("--out")||DEFAULT_OUT);
  fs.mkdirSync(path.dirname(out),{recursive:true});
  if(fs.existsSync(out)){
    const prior=JSON.parse(fs.readFileSync(out,"utf8"));
    req(prior.arm_identity_hash===arm.arm_identity_hash,"FORMAL_V5_ARM_EXISTING_ARTIFACT_IDENTITY_CONFLICT");
  }else{
    fs.writeFileSync(out,JSON.stringify(arm,null,2)+"\n",{flag:"wx"});
  }
  process.stdout.write(JSON.stringify({...arm,arm_artifact_path:out},null,2)+"\n");
}
try{main();}catch(error){
  console.error(error instanceof Error?error.stack||error.message:String(error));
  process.exitCode=1;
}
