#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const crypto=require("node:crypto");
const cp=require("node:child_process");
const {
  EPOCH_SELECTION_MODE,
  selectFormalV5EpochClockV1,
}=require("./MCFT_CAP_09_FORMAL_V5_EPOCH_CLOCK_SELECTOR_V1.cjs");

const ROOT=path.resolve(__dirname,"../..");
const HOUR=3_600_000;
const FORMAL_DB="geox_mcft_cap09_s6_formal_t4r1_24h_v5";
const STORE_AUTH="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-ACTUAL-FORMAL-STORE-AUTHORITY-V3.json";
const STORE_AUTH_BLOB="34fd3e92e0e628cf0db16e10df3633337fe81a1a";
const BUDGET_AUTH="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-FORCING-ACQUISITION-BUDGET-AUTHORITY-V1.json";
const BUDGET_AUTH_BLOB="82b9cfadc94aa0a3f83b69a8a111ac6c5d993cf1";
const CROP_AUTH="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V3.json";
const CROP_AUTH_BLOB="4bc1f8dda6559c8951db915132172b65469affcb";
const STAGE_HANDOFF_AUTH="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-21-FORMAL-V5-EPOCH-STAGE-AUTHORITY-HANDOFF.md";
const STAGE_HANDOFF_AUTH_BLOB="b79e52620865a36d83cdbb0d95e6cccf1fed1ad3";
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
function selectEpoch({armMs,currentCrop}){
  return selectFormalV5EpochClockV1({
    planning_time_utc:iso(armMs),
    lifecycle_horizon_end_utc:currentCrop.lifecycle?.horizon_end_utc,
  });
}
function epochId(o00){return "mcft_cap09_external_formal_window_epoch_"+o00.replace(/[-:.]/g,"").replace("Z","z").toLowerCase()+"_v5";}
function manifestRef(epoch){return "formal-arm://mcft-cap09/formal-v5/"+epoch+"/"+FORMAL_DB;}
function sameScope(left,right){
  for(const key of ["tenant_id","project_id","group_id","field_id","season_id","zone_id"]){
    if(String(left?.[key]??"")!==String(right?.[key]??""))return false;
  }
  return true;
}
function loadEvidenceEpochCandidate({head,epoch,armTime,currentCrop}){
  const candidatePath=path.resolve(
    arg("--evidence-epoch-candidate")
      ||path.join(os.homedir(),".geox","mcft-cap09","runtime",head,"formal-v5-evidence-runtime-handoff-authority.json")
  );
  req(fs.existsSync(candidatePath),"FORMAL_V5_ARM_EVIDENCE_EPOCH_CANDIDATE_REQUIRED",candidatePath);
  const bytes=fs.readFileSync(candidatePath);
  const candidate=JSON.parse(bytes.toString("utf8"));
  req(
    candidate.schema_version==="geox_mcft_cap09_formal_v5_evidence_runtime_handoff_authority_v1"
      &&candidate.authority_id==="GEOX-MCFT-CAP-09-FORMAL-V5-EVIDENCE-RUNTIME-HANDOFF-AUTHORITY-V1"
      &&candidate.status==="AUTHORIZED"
      &&candidate.armed===true
      &&candidate.evidence_runtime_planning_handoff_authorized===true,
    "FORMAL_V5_ARM_EVIDENCE_EPOCH_CANDIDATE_NOT_AUTHORIZED"
  );
  req(candidate.deployment_subject_sha===head,"FORMAL_V5_ARM_EVIDENCE_EPOCH_CANDIDATE_SUBJECT_MISMATCH");
  req(sameScope(candidate.scope,currentCrop.scope),"FORMAL_V5_ARM_EVIDENCE_EPOCH_CANDIDATE_SCOPE_MISMATCH");
  req(candidate.formal_v5_arm_match_required===true,"FORMAL_V5_ARM_EVIDENCE_EPOCH_MATCH_REQUIREMENT_MISSING");
  req(
    candidate.stage_authority_required_for_evidence_acquisition===false
      &&candidate.future_stage_pins_frozen===false
      &&candidate.current_crop_authority_promoted===false,
    "FORMAL_V5_ARM_EVIDENCE_EPOCH_STAGE_PROMOTION_FORBIDDEN"
  );
  req(
    candidate.runtime_process_start_authorized===false
      &&candidate.twin_runtime_start_authorized===false
      &&candidate.production_owner_activation_authorized===false
      &&candidate.formal_v5_arm_authorized===false
      &&candidate.a0_authorized===false
      &&candidate.o00_authorized===false,
    "FORMAL_V5_ARM_EVIDENCE_EPOCH_AUTHORITY_CEILING_DRIFT"
  );
  const activation=canonicalIso(candidate.activation_fence_time,"FORMAL_V5_ARM_EVIDENCE_EPOCH_ACTIVATION_FENCE_INVALID");
  req(Date.parse(activation)<=Date.parse(armTime),"FORMAL_V5_ARM_EVIDENCE_EPOCH_CANDIDATE_CREATED_AFTER_ARM");
  req(candidate.minimum_governance_lead_hours===36,"FORMAL_V5_ARM_EVIDENCE_EPOCH_36H_LEAD_REQUIRED");
  req(candidate.epoch_selection_mode===EPOCH_SELECTION_MODE,"FORMAL_V5_ARM_EVIDENCE_EPOCH_MODE_MISMATCH");
  req(
    candidate.formal_a0_logical_time===epoch.a0
      &&candidate.formal_o00_logical_time===epoch.o00
      &&candidate.formal_o23_logical_time===epoch.o23
      &&candidate.readiness_deadline===epoch.readiness_deadline,
    "FORMAL_V5_ARM_EVIDENCE_EPOCH_CANDIDATE_MISMATCH",
    JSON.stringify({candidate:{a0:candidate.formal_a0_logical_time,o00:candidate.formal_o00_logical_time,o23:candidate.formal_o23_logical_time},actual:epoch})
  );
  req(
    candidate.lifecycle_horizon_end_utc===currentCrop.lifecycle?.horizon_end_utc,
    "FORMAL_V5_ARM_EVIDENCE_EPOCH_LIFECYCLE_HORIZON_MISMATCH"
  );
  const baseRuntimePath=path.join(path.dirname(candidatePath),"runtime-start-authority.json");
  req(fs.existsSync(baseRuntimePath),"FORMAL_V5_ARM_EVIDENCE_EPOCH_BASE_RUNTIME_AUTHORITY_REQUIRED");
  req(
    candidate.base_runtime_start_authority_sha256===sha256Bytes(fs.readFileSync(baseRuntimePath)),
    "FORMAL_V5_ARM_EVIDENCE_EPOCH_BASE_RUNTIME_DIGEST_MISMATCH"
  );
  return {
    path:candidatePath,
    authority:candidate,
    sha256:sha256Bytes(bytes),
  };
}
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
  const current={lifecycle:{horizon_end_utc:"2026-11-24T03:59:59.999Z"}};
  const armMs=Date.parse("2026-09-19T04:43:45.612Z");
  const selected=selectEpoch({armMs,currentCrop:current});
  req(selected.o00==="2026-09-21T06:00:00.000Z","FORMAL_V5_ARM_SELFTEST_CLOCK_O00_REQUIRED",selected.o00);
  req(selected.o23==="2026-09-22T05:00:00.000Z","FORMAL_V5_ARM_SELFTEST_CLOCK_O23_REQUIRED",selected.o23);
  req(selected.a0==="2026-09-21T05:00:00.000Z","FORMAL_V5_ARM_SELFTEST_CLOCK_A0_REQUIRED",selected.a0);
  req(Date.parse(selected.o00)>=ceilHour(armMs+36*HOUR),"FORMAL_V5_ARM_SELFTEST_36H_GOVERNANCE_LEAD_REQUIRED");
  req(selected.epoch_selection_mode==="CLOCK_ONLY_LIFECYCLE_AND_STAGE_AUTHORITY_CADENCE_BOUNDED_PENDING_POST_ARM_DT02_A18_STAGE_AUTHORITY","FORMAL_V5_ARM_SELFTEST_STAGE_HANDOFF_MODE_REQUIRED");
  req(selected.stage_authority_refresh_clock_eligibility?.snapshot_boundary_utc==="2026-09-21T04:00:00.000Z","FORMAL_V5_ARM_SELFTEST_STAGE_BOUNDARY_REQUIRED");
  req(selected.stage_authority_refresh_clock_eligibility?.snapshot_valid_until_utc==="2026-09-22T10:00:00.000Z","FORMAL_V5_ARM_SELFTEST_STAGE_VALID_UNTIL_REQUIRED");
  req(selected.stage_authority_refresh_clock_eligibility?.snapshot_boundary_strictly_before_a0===true,"FORMAL_V5_ARM_SELFTEST_STAGE_BOUNDARY_BEFORE_A0_REQUIRED");
  req(selected.stage_authority_refresh_clock_eligibility?.snapshot_validity_covers_o23===true,"FORMAL_V5_ARM_SELFTEST_STAGE_VALIDITY_O23_REQUIRED");
  req(selected.stage_authority_refresh_clock_eligibility?.stage_value_consulted===false,"FORMAL_V5_ARM_SELFTEST_STAGE_VALUE_MUST_NOT_BE_CONSULTED");
  req(selected.stage_authority_refresh_clock_eligibility?.authority_identity_frozen===false,"FORMAL_V5_ARM_SELFTEST_STAGE_AUTHORITY_IDENTITY_MUST_NOT_BE_FROZEN");
  const budget=readJson(BUDGET_AUTH);
  req(budget.qualified_budget?.selected_budget_ms===2081804&&budget.fixed_35_minute_lead_authorized_for_v5===false,"FORMAL_V5_ARM_SELFTEST_TIMING_BUDGET_REQUIRED");
  process.stdout.write(JSON.stringify({
    schema_version:"geox_mcft_cap09_formal_v5_arm_selftest_v3",
    status:"PASS",
    authority_mode:"CONTROLLED_CLOCK_ONLY_WITH_STAGE_AUTHORITY_CADENCE_ELIGIBILITY_SELFTEST",
    amendment_21_stage_handoff_required:true,
    future_stage_pins_frozen_at_arm:false,
    future_stage_value_consulted_at_arm:false,
    future_stage_authority_identity_frozen_at_arm:false,
    post_arm_dt02_a18_stage_authority_required:true,
    selected_a0:selected.a0,
    selected_o00:selected.o00,
    selected_o23:selected.o23,
    stage_authority_refresh_clock_eligibility:selected.stage_authority_refresh_clock_eligibility,
    minimum_governance_lead_hours:36,
    fixed_35_minute_lead_used:false,
    provider_request_count:0,
    formal_database_mutation:false,
    a0_bootstrap:false,
    o00_started:false,
  },null,2)+"\n");
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
  req(git("rev-parse","HEAD:"+STAGE_HANDOFF_AUTH)===STAGE_HANDOFF_AUTH_BLOB,"FORMAL_V5_ARM_AMENDMENT_21_STAGE_HANDOFF_BLOB_DRIFT");

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

  const epoch=selectEpoch({armMs,currentCrop:current.authority});
  req(Date.parse(epoch.readiness_deadline)>armMs,"FORMAL_V5_ARM_READINESS_DEADLINE_MUST_BE_FUTURE");
  const evidenceEpoch=loadEvidenceEpochCandidate({
    head,epoch,armTime:zero.database_now,currentCrop:current.authority,
  });
  const core={
    schema_version:"geox_mcft_cap09_formal_v5_arm_v1",
    status:"PASS",
    subject_sha:head,
    formal_database_name:FORMAL_DB,
    formal_store_authority_ref:STORE_AUTH,
    formal_store_authority_blob_sha:STORE_AUTH_BLOB,
    arm_time_database_utc:zero.database_now,
    epoch_id:epochId(epoch.o00),
    manifest_ref:manifestRef(epochId(epoch.o00)),
    a0:epoch.a0,
    o00:epoch.o00,
    o23:epoch.o23,
    readiness_deadline:epoch.readiness_deadline,
    formal_runtime_config_pins_frozen:false,
    formal_stage_authority_pins_frozen:false,
    arm_time_stage_snapshot_is_runtime_pin:false,
    future_stage_pins_deferred_to_post_arm_dt02_a18:true,
    required_future_stage_authority_coverage:"A0_THROUGH_O23_INCLUSIVE",
    epoch_selection_mode:epoch.epoch_selection_mode,
    stage_authority_refresh_clock_eligibility:epoch.stage_authority_refresh_clock_eligibility,
    stage_authority_refresh_snapshot_boundary_is_runtime_pin:false,
    stage_authority_refresh_stage_value_frozen:false,
    stage_authority_refresh_authority_identity_frozen:false,
    amendment_21_stage_handoff_authority_ref:STAGE_HANDOFF_AUTH,
    amendment_21_stage_handoff_authority_blob_sha:STAGE_HANDOFF_AUTH_BLOB,
    h6_stage_successor_materialization_still_required:true,
    current_crop_authority_ref:current.row.authority_ref,
    current_crop_authority_sha256:current.row.authority_sha256,
    current_crop_stage_at_arm:current.authority.crop_water_use_stage,
    current_biological_stage_at_arm:current.authority.biological_stage?.resolved_biological_stage,
    forcing_timing_authority_ref:BUDGET_AUTH,
    forcing_timing_authority_blob_sha:BUDGET_AUTH_BLOB,
    forcing_acquisition_budget_ms:2081804,
    evidence_epoch_planning_authority_ref:evidenceEpoch.authority.authority_ref,
    evidence_epoch_planning_authority_sha256:evidenceEpoch.sha256,
    evidence_epoch_planning_activation_fence_time:evidenceEpoch.authority.activation_fence_time,
    evidence_epoch_planning_a0:evidenceEpoch.authority.formal_a0_logical_time,
    evidence_epoch_planning_o00:evidenceEpoch.authority.formal_o00_logical_time,
    evidence_epoch_planning_o23:evidenceEpoch.authority.formal_o23_logical_time,
    evidence_epoch_candidate_matched_at_arm:true,
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
