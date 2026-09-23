#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");

const ROOT = path.resolve(__dirname, "../..");
const GENERIC = path.join(ROOT, "scripts/runtime_acceptance/BUILD_MCFT_CAP_09_PRODUCTION_RUNTIME_START_AUTHORITY_V1.cjs");
const LIVE_REL = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-RUNTIME-NON-OWNER-STANDBY-ACTIVATION-AUTHORITY-V1.json";
const A0_REL = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRE-FORMAL-A0-PLANNING-AUTHORITY-V1.json";
const BUDGET_REL = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-FORCING-ACQUISITION-BUDGET-AUTHORITY-V1.json";
const REGISTRY_REL = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json";
const STAGE_REL = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-BIOLOGICAL-STAGE-ARCHITECTURE-EFFECTIVENESS-V1.json";
const HOST_PROOF_REL = "scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_NON_GITHUB_HOST_BINDING_ARM_V1.json";
const HOST_ID = "fae5f756-ef25-40d5-9777-5b2c3d4837a1";

function fail(code) { throw new Error(code); }
function req(ok, code) { if (!ok) fail(code); }
function read(rel) { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8")); }
function digest(rel) { return "sha256:" + crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, rel))).digest("hex"); }
function head() { return cp.execFileSync("git", ["rev-parse", "HEAD"], {cwd: ROOT, encoding: "utf8"}).trim(); }
function ancestor(a,b) {
  const r=cp.spawnSync("git",["merge-base","--is-ancestor",a,b],{cwd:ROOT,stdio:"ignore"});
  return r.status===0;
}
function parseArgs(argv) {
  let arm=null,out=null;
  for(let i=2;i<argv.length;i++){
    if(argv[i]==="--arm") arm=path.resolve(ROOT,argv[++i]);
    else if(argv[i]==="--out") out=path.resolve(ROOT,argv[++i]);
    else fail("NON_OWNER_STANDBY_BUILDER_ARGUMENT_UNSUPPORTED:"+argv[i]);
  }
  req(arm && out,"NON_OWNER_STANDBY_BUILDER_ARM_AND_OUTPUT_REQUIRED");
  return {arm,out};
}
function validateStaticAuthorities(observedHead) {
  const live=read(LIVE_REL);
  req(live.schema_version==="geox_mcft_cap09_production_runtime_non_owner_standby_activation_authority_v1","NON_OWNER_STANDBY_LIVE_SCHEMA_INVALID");
  req(live.authority_id==="GEOX-MCFT-CAP-09-PRODUCTION-RUNTIME-NON-OWNER-STANDBY-ACTIVATION-AUTHORITY-V1","NON_OWNER_STANDBY_LIVE_ID_INVALID");
  req(live.status==="AUTHORIZED_FOR_LOCAL_NON_OWNER_STANDBY_RUNTIME_START_ONLY","NON_OWNER_STANDBY_LIVE_STATUS_INVALID");
  req(/^[0-9a-f]{40}$/.test(live.authority_predecessor_protected_main_sha||""),"NON_OWNER_STANDBY_LIVE_PREDECESSOR_INVALID");
  req(ancestor(live.authority_predecessor_protected_main_sha,observedHead),"NON_OWNER_STANDBY_LIVE_PREDECESSOR_NOT_ANCESTOR");
  req(live.deployment_subject_rule==="EXACT_CURRENT_PROTECTED_MAIN_AT_LOCAL_MATERIALIZATION","NON_OWNER_STANDBY_LIVE_SUBJECT_RULE_INVALID");
  req(live.execution_host?.required_platform==="LOCAL_OPERATOR_MANAGED_DOCKER","NON_OWNER_STANDBY_LIVE_PLATFORM_INVALID");
  req(live.execution_host?.exact_host_id===HOST_ID,"NON_OWNER_STANDBY_LIVE_HOST_INVALID");
  req(live.execution_host?.github_actions_execution_forbidden===true,"NON_OWNER_STANDBY_LIVE_GITHUB_FORBIDDEN_REQUIRED");
  req(live.authority_inputs?.host_binding_proof_ref===HOST_PROOF_REL,"NON_OWNER_STANDBY_LIVE_HOST_PROOF_REF_INVALID");
  req(live.authority_inputs?.effective_current_crop_authority_registry_ref===REGISTRY_REL,"NON_OWNER_STANDBY_LIVE_REGISTRY_REF_INVALID");
  req(live.authority_inputs?.formal_a0_planning_authority_ref===A0_REL,"NON_OWNER_STANDBY_LIVE_A0_REF_INVALID");
  req(live.authority_inputs?.forcing_acquisition_budget_ref===BUDGET_REL,"NON_OWNER_STANDBY_LIVE_BUDGET_REF_INVALID");
  req(live.authority_inputs?.biological_stage_architecture_effectiveness_ref===STAGE_REL,"NON_OWNER_STANDBY_LIVE_STAGE_REF_INVALID");
  const c=live.activation_contract||{};
  req(c.activation_step==="PRE_RUNTIME_START_READY_NON_OWNER_STANDBY","NON_OWNER_STANDBY_LIVE_STEP_INVALID");
  req(c.runtime_mode==="NON_OWNER_STANDBY","NON_OWNER_STANDBY_LIVE_MODE_INVALID");
  req(c.runtime_process_start_authorized===true && c.evidence_runtime_start_authorized===true && c.twin_runtime_start_authorized===true,"NON_OWNER_STANDBY_LIVE_START_AUTHORITY_REQUIRED");
  for(const key of ["production_owner_activation_authorized","production_owner_lease_acquisition_authorized","runtime_database_mutation_authorized","formal_v5_arm_authorized","a0_execution_authorized","o00_authorized","o00_o23_execution_authorized"]) req(c[key]===false,"NON_OWNER_STANDBY_LIVE_CEILING_DRIFT:"+key);
  const m=live.materialization_contract||{};
  req(m.local_one_shot_authority_instance_only===true,"NON_OWNER_STANDBY_ONE_SHOT_REQUIRED");
  req(m.repository_runtime_start_arm_must_remain_unarmed===true,"NON_OWNER_STANDBY_REPO_ARM_UNARMED_REQUIRED");
  req(m.activation_fence_selected_at_materialization_time===true,"NON_OWNER_STANDBY_DYNAMIC_FENCE_REQUIRED");
  req(m.planned_a0_derived_from_frozen_planning_authority===true,"NON_OWNER_STANDBY_A0_DERIVATION_REQUIRED");
  req(m.authority_instance_repository_persistence_authorized===false,"NON_OWNER_STANDBY_AUTHORITY_REPO_PERSISTENCE_FORBIDDEN");
  req(m.runtime_process_start_in_materializer_authorized===false && m.production_owner_cutover_in_materializer_authorized===false,"NON_OWNER_STANDBY_MATERIALIZER_SIDE_EFFECT_FORBIDDEN");

  const a0=read(A0_REL), budget=read(BUDGET_REL);
  req(a0.schema_version==="geox_mcft_cap09_pre_formal_a0_planning_authority_v1","NON_OWNER_STANDBY_A0_SCHEMA_INVALID");
  req(a0.status==="AUTHORIZED_FOR_RUNTIME_EVIDENCE_TARGET_PLANNING_ONLY","NON_OWNER_STANDBY_A0_STATUS_INVALID");
  req(a0.selection_policy?.clock_authority==="LOCAL_OPERATOR_HOST_UTC_AT_CUTOVER","NON_OWNER_STANDBY_A0_CLOCK_INVALID");
  req(a0.selection_policy?.rule==="EARLIEST_WHOLE_UTC_HOUR_AT_OR_AFTER_ACTIVATION_FENCE_PLUS_SELECTED_BUDGET","NON_OWNER_STANDBY_A0_RULE_INVALID");
  req(Number.isInteger(a0.selection_policy?.selected_budget_ms) && a0.selection_policy.selected_budget_ms>0,"NON_OWNER_STANDBY_A0_BUDGET_INVALID");
  req(a0.selection_policy.selected_budget_ms===budget.qualified_budget?.selected_budget_ms,"NON_OWNER_STANDBY_A0_BUDGET_MISMATCH");
  req(budget.timing_budget_qualified===true && budget.timing_budget_frozen===true,"NON_OWNER_STANDBY_BUDGET_NOT_FROZEN");
  const ceiling=a0.authority_ceiling||{};
  req(ceiling.runtime_evidence_target_planning_authorized===true,"NON_OWNER_STANDBY_A0_PLANNING_REQUIRED");
  for(const key of ["formal_v5_arm_authorized","a0_execution_authorized","o00_epoch_selection_authorized","o00_execution_authorized","mcft_cap09_completed"]) req(ceiling[key]===false,"NON_OWNER_STANDBY_A0_CEILING_DRIFT:"+key);
  return {live_digest:digest(LIVE_REL),a0_digest:digest(A0_REL),budget_ms:a0.selection_policy.selected_budget_ms};
}

try {
  const args=parseArgs(process.argv);
  const observedHead=head();
  const staticAuth=validateStaticAuthorities(observedHead);
  const arm=JSON.parse(fs.readFileSync(args.arm,"utf8"));
  req(arm.runtime_mode==="NON_OWNER_STANDBY","NON_OWNER_STANDBY_ARM_MODE_REQUIRED");
  req(arm.activation_step==="PRE_RUNTIME_START_READY_NON_OWNER_STANDBY","NON_OWNER_STANDBY_ARM_STEP_REQUIRED");
  req(arm.exact_deployment_subject_sha===observedHead,"NON_OWNER_STANDBY_ARM_EXACT_HEAD_REQUIRED");
  req(arm.live_activation_authority_ref===LIVE_REL && arm.live_activation_authority_sha256===staticAuth.live_digest,"NON_OWNER_STANDBY_ARM_LIVE_BINDING_INVALID");
  req(arm.formal_a0_authority_ref===A0_REL && arm.formal_a0_authority_sha256===staticAuth.a0_digest,"NON_OWNER_STANDBY_ARM_A0_BINDING_INVALID");
  for(const key of ["production_owner_activation_authorized","formal_v5_arm_authorized","a0_authorized","o00_authorized"]) req(arm[key]===false,"NON_OWNER_STANDBY_ARM_CEILING_DRIFT:"+key);
  const r=cp.spawnSync(process.execPath,[GENERIC,"--arm",path.relative(ROOT,args.arm),"--out",path.relative(ROOT,args.out)],{cwd:ROOT,encoding:"utf8"});
  if(r.status!==0){process.stderr.write(r.stderr||r.stdout||"GENERIC_RUNTIME_START_BUILDER_FAILED\n");process.exit(r.status||1);}
  const built=JSON.parse(fs.readFileSync(args.out,"utf8"));
  req(built.runtime_mode==="NON_OWNER_STANDBY","NON_OWNER_STANDBY_OUTPUT_MODE_INVALID");
  req(built.production_owner_activation_authorized===false && built.formal_v5_arm_authorized===false && built.a0_authorized===false && built.o00_authorized===false,"NON_OWNER_STANDBY_OUTPUT_CEILING_DRIFT");
  process.stdout.write(JSON.stringify({status:"PASS",deployment_subject_sha:built.deployment_subject_sha,runtime_mode:built.runtime_mode,output_path:path.relative(ROOT,args.out).replaceAll("\\","/")},null,2)+"\n");
} catch (error) {
  process.stderr.write((error instanceof Error?error.message:String(error))+"\n");
  process.exitCode=1;
}
