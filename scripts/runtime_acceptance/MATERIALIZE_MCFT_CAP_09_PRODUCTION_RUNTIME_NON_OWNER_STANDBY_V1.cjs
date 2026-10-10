#!/usr/bin/env node
"use strict";

const crypto=require("node:crypto");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const cp=require("node:child_process");

const ROOT=path.resolve(__dirname,"../..");
const WRAPPER=path.join(ROOT,"scripts/runtime_acceptance/BUILD_MCFT_CAP_09_PRODUCTION_RUNTIME_NON_OWNER_STANDBY_AUTHORITY_V1.cjs");
const LIVE_REL="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-RUNTIME-NON-OWNER-STANDBY-ACTIVATION-AUTHORITY-V1.json";
const A0_REL="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRE-FORMAL-A0-PLANNING-AUTHORITY-V1.json";
const BUDGET_REL="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-FORCING-ACQUISITION-BUDGET-AUTHORITY-V1.json";
const REGISTRY_REL="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json";
const STAGE_REL="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-BIOLOGICAL-STAGE-ARCHITECTURE-EFFECTIVENESS-V1.json";
const HOST_ID="fae5f756-ef25-40d5-9777-5b2c3d4837a1";

function fail(code){throw new Error(code);}
function req(ok,code){if(!ok)fail(code);}
function readRel(rel){return JSON.parse(fs.readFileSync(path.join(ROOT,rel),"utf8"));}
function digestRel(rel){return "sha256:"+crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT,rel))).digest("hex");}
function git(args,opts={}){return cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8",...opts}).trim();}
function ceilHour(ms){return Math.ceil(ms/3_600_000)*3_600_000;}
function selectCurrentCrop(nowIso){
  const now=Date.parse(nowIso), reg=readRel(REGISTRY_REL);
  req(reg.schema_version==="geox_mcft_cap09_effective_current_crop_authority_registry_v1" && reg.status==="ACTIVE","NON_OWNER_STANDBY_REGISTRY_INVALID");
  const eligible=(reg.entries||[]).filter(e=>Date.parse(e.authority_as_of)<=now && now<=Date.parse(e.authority_valid_until)).sort((a,b)=>Date.parse(b.authority_as_of)-Date.parse(a.authority_as_of));
  req(eligible.length>0,"NON_OWNER_STANDBY_NO_CURRENT_CROP_AUTHORITY");
  const selected=eligible[0];
  req(digestRel(selected.authority_ref)===selected.authority_sha256,"NON_OWNER_STANDBY_CURRENT_CROP_DIGEST_MISMATCH");
  return selected;
}

try{
  if(process.env.GITHUB_ACTIONS==="true")fail("NON_OWNER_STANDBY_LOCAL_MATERIALIZATION_GITHUB_ACTIONS_FORBIDDEN");
  req(git(["status","--porcelain"])==="","NON_OWNER_STANDBY_WORKTREE_NOT_CLEAN");
  cp.execFileSync("git",["fetch","origin","main","--quiet"],{cwd:ROOT,stdio:"inherit"});
  const head=git(["rev-parse","HEAD"]);
  const remote=git(["rev-parse","origin/main"]);
  req(head===remote,"NON_OWNER_STANDBY_HEAD_NOT_CURRENT_PROTECTED_MAIN");

  const hostFile=path.join(os.homedir(),".geox","mcft-cap09","local-host-id-v1");
  req(fs.existsSync(hostFile),"NON_OWNER_STANDBY_HOST_ID_FILE_REQUIRED");
  req(fs.readFileSync(hostFile,"utf8").trim().toLowerCase()===HOST_ID,"NON_OWNER_STANDBY_HOST_ID_MISMATCH");

  const nowIso=new Date().toISOString();
  const selected=selectCurrentCrop(nowIso);
  const planning=readRel(A0_REL), budget=readRel(BUDGET_REL);
  req(planning.selection_policy?.selected_budget_ms===budget.qualified_budget?.selected_budget_ms,"NON_OWNER_STANDBY_A0_BUDGET_MISMATCH");
  const formalA0=new Date(ceilHour(Date.parse(nowIso)+planning.selection_policy.selected_budget_ms)).toISOString();
  req(Date.parse(formalA0)<=Date.parse(selected.authority_valid_until),"NON_OWNER_STANDBY_CURRENT_CROP_TOO_SHORT_FOR_PLANNED_A0");

  const outDir=path.join(os.homedir(),".geox","mcft-cap09","runtime-start",head);
  fs.mkdirSync(outDir,{recursive:true});
  const armPath=path.join(outDir,"MCFT_CAP_09_PRODUCTION_RUNTIME_START_ARM_NON_OWNER_STANDBY_V1.json");
  const authorityPath=path.join(outDir,"MCFT_CAP_09_PRODUCTION_RUNTIME_START_AUTHORITY_NON_OWNER_STANDBY_V1.json");
  const crop=readRel(selected.authority_ref);
  const arm={
    schema_version:"geox_mcft_cap09_production_runtime_start_arm_v1",
    armed:true,
    activation_step:"PRE_RUNTIME_START_READY_NON_OWNER_STANDBY",
    runtime_mode:"NON_OWNER_STANDBY",
    exact_deployment_subject_sha:head,
    authority_ref:"local-operator://"+HOST_ID+"/mcft-cap09/runtime-start-arm/"+head,
    live_activation_authority_ref:LIVE_REL,
    live_activation_authority_sha256:digestRel(LIVE_REL),
    formal_a0_authority_ref:A0_REL,
    formal_a0_authority_sha256:digestRel(A0_REL),
    current_crop_authority_ref:selected.authority_ref,
    current_crop_authority_sha256:selected.authority_sha256,
    biological_stage_architecture_effectiveness_ref:STAGE_REL,
    biological_stage_architecture_effectiveness_sha256:digestRel(STAGE_REL),
    scope:{tenant_id:crop.scope.tenant_id,project_id:crop.scope.project_id,group_id:crop.scope.group_id,field_id:crop.scope.field_id,season_id:crop.scope.season_id,zone_id:crop.scope.zone_id},
    activation_fence_time:nowIso,
    formal_a0_logical_time:formalA0,
    runtime_process_start_authorized:true,
    evidence_runtime_start_authorized:true,
    twin_runtime_start_authorized:true,
    production_owner_activation_authorized:false,
    formal_v5_arm_authorized:false,
    a0_authorized:false,
    o00_authorized:false,
    execution_requested:true,
    current_status:"LOCAL_NON_OWNER_STANDBY_AUTHORITY_MATERIALIZATION_REQUESTED"
  };
  fs.writeFileSync(armPath,JSON.stringify(arm,null,2)+"\n",{mode:0o600});
  const r=cp.spawnSync(process.execPath,[WRAPPER,"--arm",armPath,"--out",authorityPath],{cwd:ROOT,encoding:"utf8"});
  if(r.status!==0){try{fs.rmSync(authorityPath,{force:true});}catch{};process.stderr.write(r.stderr||r.stdout||"NON_OWNER_STANDBY_AUTHORITY_BUILD_FAILED\n");process.exit(r.status||1);}
  const authority=JSON.parse(fs.readFileSync(authorityPath,"utf8"));
  req(authority.deployment_subject_sha===head && authority.runtime_mode==="NON_OWNER_STANDBY","NON_OWNER_STANDBY_MATERIALIZED_AUTHORITY_INVALID");
  req(authority.production_owner_activation_authorized===false && authority.formal_v5_arm_authorized===false && authority.a0_authorized===false && authority.o00_authorized===false,"NON_OWNER_STANDBY_MATERIALIZED_CEILING_DRIFT");
  process.stdout.write(JSON.stringify({status:"PASS",materialization_only:true,runtime_started:false,deployment_subject_sha:head,activation_fence_time:authority.activation_fence_time,formal_a0_logical_time:authority.formal_a0_logical_time,current_crop_authority_ref:authority.current_crop_authority_ref,authority_path:authorityPath,arm_path:armPath,production_owner_activation_authorized:false,formal_v5_arm_authorized:false,a0_authorized:false,o00_authorized:false},null,2)+"\n");
}catch(error){
  process.stderr.write((error instanceof Error?error.message:String(error))+"\n");
  process.exitCode=1;
}
