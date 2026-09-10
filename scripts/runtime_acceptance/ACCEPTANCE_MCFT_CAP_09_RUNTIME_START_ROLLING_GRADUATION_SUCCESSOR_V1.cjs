#!/usr/bin/env node
"use strict";

const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");

const ROOT=path.resolve(__dirname,"../..");
const OUT=path.join(ROOT,"acceptance-output","runtime-start-rolling-graduation-successor-v1");
const BUILDER=path.join(ROOT,"scripts/runtime_acceptance/BUILD_MCFT_CAP_09_PRODUCTION_RUNTIME_START_AUTHORITY_V1.cjs");
function write(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+"\n");}
function digest(file){return "sha256:"+crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");}
function rel(file){return path.relative(ROOT,file).replaceAll("\\","/");}
function run(arm,out){return cp.spawnSync(process.execPath,[BUILDER,"--arm",rel(arm),"--out",rel(out)],{cwd:ROOT,encoding:"utf8"});}

try{
  fs.rmSync(OUT,{recursive:true,force:true});
  fs.mkdirSync(OUT,{recursive:true});
  const head=cp.execFileSync("git",["rev-parse","HEAD"],{cwd:ROOT,encoding:"utf8"}).trim();
  assert.match(head,/^[0-9a-f]{40}$/);

  const live=path.join(OUT,"live.json");
  const a0=path.join(OUT,"a0.json");
  const stage=path.join(OUT,"stage.json");
  const crop=path.join(OUT,"crop.json");
  const arm=path.join(OUT,"arm.json");
  const auth=path.join(OUT,"authority.json");
  const protectedMain="9".repeat(40);
  const issued="2098-12-31T23:00:00.000Z";
  write(live,{schema_version:"test_live_v1",status:"QUALIFIED_TEST_FIXTURE_ONLY"});
  write(a0,{schema_version:"test_a0_v1",status:"QUALIFIED_TEST_FIXTURE_ONLY"});
  write(stage,{
    schema_version:"geox_dt02_biological_stage_authority_effectiveness_v1",
    amendment_id:"DT02-AMENDMENT-03",status:"EFFECTIVE",effective:true,
    protected_main_sha:protectedMain,issued_at:issued,
    runtime_start_authorized:false,production_owner_activation_authorized:false,
    formal_v5_authorized:false,a0_authorized:false,o00_o23_authorized:false
  });
  const scope={tenant_id:"tenant_mcft_external",project_id:"project_mcft_cap09",group_id:"group_public_research",field_id:"field_kbs_mcse_t4r1",season_id:"season_2026_corn",zone_id:"zone_kbs_mcse_t4r1_crop_formal_v1"};
  const cropValue={
    schema_version:"geox_mcft_cap09_t4r1_current_crop_authority_composition_result_v1",
    status:"PASS",qualification_outcome:"CURRENT_CROP_CONTEXT_AUTHORITY_CANDIDATE_RESOLVED",
    architecture_effective:true,runtime_consumption_authorized:true,scope,
    lifecycle:{domain_state:"ACTIVE",authority_status:"RESOLVED",authority_validity:"VALID",authority_mode:"GOVERNED_PERSISTENT_STATE",active_consumable_candidate:true,horizon_end_utc:"2099-01-02T00:00:00.000Z"},
    biological_stage:{epistemic_class:"THERMAL_MODEL_DERIVED",resolved_biological_stage:"R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE",observed_biological_stage_claimed:false,authority_as_of:issued,forward_stability_hours:30},
    crop_water_use_stage:"LATE",
    crop_model_parameter:{parameter:"Kc",stage_code:"LATE",value:0.6,production_effective:false},
    graduation:{status:"EFFECTIVE_FOR_RUNTIME_CONSUMPTION_ROLLING_REFRESH",amendment_id:"DT02-AMENDMENT-03",architecture_effectiveness_sha256:digest(stage),protected_main_sha:protectedMain,graduated_at:issued}
  };
  write(crop,cropValue);
  const armValue={
    schema_version:"geox_mcft_cap09_production_runtime_start_arm_v1",armed:true,execution_requested:true,
    exact_deployment_subject_sha:head,authority_ref:rel(arm),
    live_activation_authority_ref:rel(live),live_activation_authority_sha256:digest(live),
    formal_a0_authority_ref:rel(a0),formal_a0_authority_sha256:digest(a0),
    current_crop_authority_ref:rel(crop),current_crop_authority_sha256:digest(crop),
    biological_stage_architecture_effectiveness_ref:rel(stage),biological_stage_architecture_effectiveness_sha256:digest(stage),
    scope,activation_fence_time:"2098-12-31T23:30:00.000Z",formal_a0_logical_time:"2099-01-01T00:00:00.000Z",
    runtime_process_start_authorized:true,evidence_runtime_start_authorized:true,twin_runtime_start_authorized:true,
    production_owner_activation_authorized:false,formal_v5_arm_authorized:false,a0_authorized:false,o00_authorized:false
  };
  write(arm,armValue);
  const good=run(arm,auth);
  assert.equal(good.status,0,good.stderr||good.stdout);
  const built=JSON.parse(fs.readFileSync(auth,"utf8"));
  assert.equal(built.status,"AUTHORIZED");
  assert.equal(built.deployment_subject_sha,head);
  assert.equal(built.production_owner_activation_authorized,false);
  assert.equal(built.formal_v5_arm_authorized,false);
  assert.equal(built.a0_authorized,false);
  assert.equal(built.o00_authorized,false);

  const badCrop=path.join(OUT,"crop-unknown.json");
  const badArm=path.join(OUT,"arm-unknown.json");
  const badOut=path.join(OUT,"authority-unknown.json");
  write(badCrop,{...cropValue,graduation:{...cropValue.graduation,status:"EFFECTIVE_FOR_RUNTIME_CONSUMPTION_UNKNOWN"}});
  write(badArm,{...armValue,current_crop_authority_ref:rel(badCrop),current_crop_authority_sha256:digest(badCrop)});
  const bad=run(badArm,badOut);
  assert.notEqual(bad.status,0);
  assert.match(bad.stderr,/RUNTIME_START_CURRENT_CROP_GRADUATION_REQUIRED/);
  assert.equal(fs.existsSync(badOut),false);

  console.log(JSON.stringify({status:"PASS",subject_head_sha:head,rolling_refresh_graduation_accepted:true,unknown_graduation_rejected:true,runtime_started:false,production_owner_activation:false,formal_v5_arm:false,a0_started:false,o00_started:false},null,2));
}catch(error){console.error(error instanceof Error?error.stack??error.message:String(error));process.exitCode=1;}
