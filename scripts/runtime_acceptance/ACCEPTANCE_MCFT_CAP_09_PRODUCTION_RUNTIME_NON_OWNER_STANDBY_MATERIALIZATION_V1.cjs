#!/usr/bin/env node
"use strict";

const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");

const ROOT=path.resolve(__dirname,"../..");
const WRAPPER=path.join(ROOT,"scripts/runtime_acceptance/BUILD_MCFT_CAP_09_PRODUCTION_RUNTIME_NON_OWNER_STANDBY_AUTHORITY_V1.cjs");
const MATERIALIZER=path.join(ROOT,"scripts/runtime_acceptance/MATERIALIZE_MCFT_CAP_09_PRODUCTION_RUNTIME_NON_OWNER_STANDBY_V1.cjs");
const LIVE_REL="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-RUNTIME-NON-OWNER-STANDBY-ACTIVATION-AUTHORITY-V1.json";
const A0_REL="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRE-FORMAL-A0-PLANNING-AUTHORITY-V1.json";
const BUDGET_REL="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-FORCING-ACQUISITION-BUDGET-AUTHORITY-V1.json";
const REGISTRY_REL="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json";
const STAGE_REL="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-BIOLOGICAL-STAGE-ARCHITECTURE-EFFECTIVENESS-V1.json";
const REAL_ARM="scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_RUNTIME_START_ARM_V1.json";
const OUT=path.join(ROOT,"acceptance-output");
function abs(r){return path.join(ROOT,r);}
function read(r){return JSON.parse(fs.readFileSync(abs(r),"utf8"));}
function digest(r){return "sha256:"+crypto.createHash("sha256").update(fs.readFileSync(abs(r))).digest("hex");}
function ceilHour(ms){return Math.ceil(ms/3_600_000)*3_600_000;}

try{
  fs.mkdirSync(OUT,{recursive:true});
  const head=cp.execFileSync("git",["rev-parse","HEAD"],{cwd:ROOT,encoding:"utf8"}).trim();
  const live=read(LIVE_REL);
  assert.equal(live.status,"AUTHORIZED_FOR_LOCAL_NON_OWNER_STANDBY_RUNTIME_START_ONLY");
  assert.equal(live.activation_contract.runtime_mode,"NON_OWNER_STANDBY");
  assert.equal(live.activation_contract.production_owner_activation_authorized,false);
  assert.equal(live.activation_contract.formal_v5_arm_authorized,false);
  assert.equal(live.materialization_contract.runtime_process_start_in_materializer_authorized,false);

  const real=read(REAL_ARM);
  assert.equal(real.armed,false);
  assert.equal(real.execution_requested,false);
  assert.equal(real.runtime_process_start_authorized,false);
  assert.equal(real.production_owner_activation_authorized,false);
  assert.equal(real.formal_v5_arm_authorized,false);
  assert.equal(real.a0_authorized,false);
  assert.equal(real.o00_authorized,false);

  const reg=read(REGISTRY_REL), now=Date.now();
  const selected=[...(reg.entries||[])].filter(e=>Date.parse(e.authority_as_of)<=now && now<=Date.parse(e.authority_valid_until)).sort((a,b)=>Date.parse(b.authority_as_of)-Date.parse(a.authority_as_of))[0];
  assert.ok(selected,"CURRENT_CROP_REQUIRED_FOR_NON_OWNER_STANDBY_ACCEPTANCE");
  assert.equal(digest(selected.authority_ref),selected.authority_sha256);
  const crop=read(selected.authority_ref), planning=read(A0_REL), budget=read(BUDGET_REL);
  assert.equal(planning.selection_policy.selected_budget_ms,budget.qualified_budget.selected_budget_ms);
  const fence=new Date().toISOString();
  const formalA0=new Date(ceilHour(Date.parse(fence)+planning.selection_policy.selected_budget_ms)).toISOString();
  assert.ok(Date.parse(formalA0)<=Date.parse(selected.authority_valid_until));

  const armPath=path.join(OUT,"MCFT_CAP_09_TEST_NON_OWNER_STANDBY_ARM_V1.json");
  const outPath=path.join(OUT,"MCFT_CAP_09_TEST_NON_OWNER_STANDBY_AUTHORITY_V1.json");
  const arm={schema_version:"geox_mcft_cap09_production_runtime_start_arm_v1",armed:true,activation_step:"PRE_RUNTIME_START_READY_NON_OWNER_STANDBY",runtime_mode:"NON_OWNER_STANDBY",exact_deployment_subject_sha:head,authority_ref:"test://non-owner-standby/"+head,live_activation_authority_ref:LIVE_REL,live_activation_authority_sha256:digest(LIVE_REL),formal_a0_authority_ref:A0_REL,formal_a0_authority_sha256:digest(A0_REL),current_crop_authority_ref:selected.authority_ref,current_crop_authority_sha256:selected.authority_sha256,biological_stage_architecture_effectiveness_ref:STAGE_REL,biological_stage_architecture_effectiveness_sha256:digest(STAGE_REL),scope:{tenant_id:crop.scope.tenant_id,project_id:crop.scope.project_id,group_id:crop.scope.group_id,field_id:crop.scope.field_id,season_id:crop.scope.season_id,zone_id:crop.scope.zone_id},activation_fence_time:fence,formal_a0_logical_time:formalA0,runtime_process_start_authorized:true,evidence_runtime_start_authorized:true,twin_runtime_start_authorized:true,production_owner_activation_authorized:false,formal_v5_arm_authorized:false,a0_authorized:false,o00_authorized:false,execution_requested:true};
  fs.writeFileSync(armPath,JSON.stringify(arm,null,2)+"\n");
  fs.rmSync(outPath,{force:true});
  const good=cp.spawnSync(process.execPath,[WRAPPER,"--arm",armPath,"--out",outPath],{cwd:ROOT,encoding:"utf8"});
  assert.equal(good.status,0,good.stderr||good.stdout);
  const built=JSON.parse(fs.readFileSync(outPath,"utf8"));
  assert.equal(built.deployment_subject_sha,head);
  assert.equal(built.runtime_mode,"NON_OWNER_STANDBY");
  assert.equal(built.production_owner_activation_authorized,false);
  assert.equal(built.formal_v5_arm_authorized,false);
  assert.equal(built.a0_authorized,false);
  assert.equal(built.o00_authorized,false);

  const bad={...arm,live_activation_authority_ref:A0_REL,live_activation_authority_sha256:digest(A0_REL)};
  const badPath=path.join(OUT,"MCFT_CAP_09_TEST_NON_OWNER_STANDBY_BAD_LIVE_REF_ARM_V1.json");
  fs.writeFileSync(badPath,JSON.stringify(bad,null,2)+"\n");
  const badRun=cp.spawnSync(process.execPath,[WRAPPER,"--arm",badPath,"--out",path.join(OUT,"bad.json")],{cwd:ROOT,encoding:"utf8"});
  assert.notEqual(badRun.status,0);
  assert.match(badRun.stderr,/NON_OWNER_STANDBY_ARM_LIVE_BINDING_INVALID/);

  const materializerSource=fs.readFileSync(MATERIALIZER,"utf8");
  assert.match(materializerSource,/GITHUB_ACTIONS/);
  assert.match(materializerSource,/HEAD_NOT_CURRENT_PROTECTED_MAIN/);
  assert.match(materializerSource,/materialization_only:true/);
  assert.match(materializerSource,/runtime_started:false/);
  assert.doesNotMatch(materializerSource,/docker\s+compose\s+up/);
  assert.doesNotMatch(materializerSource,/production_owner_activation_authorized:true/);

  const result={schema_version:"geox_mcft_cap09_production_runtime_non_owner_standby_materialization_acceptance_v1",status:"PASS",subject_sha:head,current_crop_authority_ref:selected.authority_ref,planned_a0:formalA0,real_repository_arm_remains_unarmed:true,local_materializer_starts_runtime:false,production_owner_activation_authorized:false,formal_v5_arm_authorized:false,a0_authorized:false,o00_authorized:false};
  fs.writeFileSync(path.join(OUT,"MCFT_CAP_09_PRODUCTION_RUNTIME_NON_OWNER_STANDBY_MATERIALIZATION_V1_RESULT.json"),JSON.stringify(result,null,2)+"\n");
  console.log(JSON.stringify(result,null,2));
}catch(error){
  process.stderr.write((error instanceof Error?error.message:String(error))+"\n");
  process.exitCode=1;
}
