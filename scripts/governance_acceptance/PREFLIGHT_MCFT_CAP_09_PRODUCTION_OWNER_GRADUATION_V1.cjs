#!/usr/bin/env node
"use strict";
const fs=require("node:fs");
const path=require("node:path");

const ROOT=path.resolve(__dirname,"../..");
const OWNER_AUTH=path.join(ROOT,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-OWNER-GRADUATION-GATE-V1.json");
const TIMING_AUTH=path.join(ROOT,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-FORCING-ACQUISITION-BUDGET-AUTHORITY-V1.json");
const ARM=path.join(ROOT,"scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_OWNER_CUTOVER_ARM_V1.json");
const EVIDENCE_PROCESS=path.join(ROOT,"apps/server/src/external_evidence/mcft_cap09_evidence_runtime_process_v1.ts");
const TWIN_PROCESS=path.join(ROOT,"apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v1.ts");
const PRINCIPALS=path.join(ROOT,"apps/server/src/infra/mcft_cap09_phase5_service_principal_v1.ts");
const OUT=path.join(ROOT,"acceptance-output/MCFT_CAP_09_PRODUCTION_OWNER_GRADUATION_PREFLIGHT_V1_RESULT.json");

function req(ok,code){if(!ok)throw new Error(code);}
function readJson(p){return JSON.parse(fs.readFileSync(p,"utf8"));}
function text(p){return fs.readFileSync(p,"utf8");}
function write(v){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(v,null,2)+"\n");console.log(JSON.stringify(v,null,2));}

try{
  const owner=readJson(OWNER_AUTH);
  const timing=readJson(TIMING_AUTH);
  const arm=readJson(ARM);
  const evidence=text(EVIDENCE_PROCESS);
  const twin=text(TWIN_PROCESS);
  const principals=text(PRINCIPALS);

  req(owner.schema_version==="geox_mcft_cap09_production_owner_graduation_gate_v1","OWNER_GATE_SCHEMA_REQUIRED");
  req(owner.status==="PREFLIGHT_ONLY_CUTOVER_NOT_PERFORMED","OWNER_GATE_MUST_REMAIN_PREFLIGHT_ONLY");
  req(owner.non_github_hosting_binding?.status==="NOT_ESTABLISHED","OWNER_NON_GITHUB_HOSTING_MUST_REMAIN_UNBOUND");
  req(owner.identity_semantics?.login_role_presence_is_effective_owner_proof===false,"OWNER_LOGIN_MUST_NOT_EQUAL_EFFECTIVE_OWNER");
  req(owner.identity_semantics?.effective_owner_requires_non_github_host_binding_and_live_fenced_lease===true,"OWNER_LIVE_FENCED_LEASE_REQUIRED");

  req(timing.status==="QUALIFIED_AND_FROZEN_FROM_EXACT_HEAD_REAL_TIMING_AND_CONTROLLED_DELAY","OWNER_GATE_REQUIRES_FROZEN_TIMING");
  req(timing.timing_budget_qualified===true&&timing.timing_budget_frozen===true,"OWNER_GATE_REQUIRES_QUALIFIED_FROZEN_BUDGET");
  req(Number.isSafeInteger(timing.qualified_budget?.selected_budget_ms)&&timing.qualified_budget.selected_budget_ms>0,"OWNER_GATE_TIMING_BUDGET_REQUIRED");

  req(arm.schema_version==="geox_mcft_cap09_production_owner_cutover_arm_v1","OWNER_ARM_SCHEMA_REQUIRED");
  req(arm.armed===false,"OWNER_CUTOVER_MUST_NOT_BE_ARMED_DURING_PREFLIGHT");
  for(const key of ["evidence_owner_activation_authorized","twin_owner_activation_authorized","production_login_provisioning_authorized","non_github_hosting_binding_authorized","formal_v5_arm_authorized","a0_authorized","o00_authorized"]) {
    req(arm[key]===false,"OWNER_LATER_AUTHORITY_MUST_BE_FALSE:"+key);
  }

  req(evidence.includes("production_owner_cutover: false"),"EVIDENCE_PROCESS_CUTOVER_FALSE_REQUIRED");
  req(twin.includes("production_owner_cutover: false"),"TWIN_PROCESS_CUTOVER_FALSE_REQUIRED");
  req(evidence.includes("GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_LEASE_OWNER"),"EVIDENCE_LEASE_OWNER_BOUNDARY_REQUIRED");
  req(twin.includes("GEOX_MCFT_CAP09_TWIN_RUNTIME_LEASE_OWNER"),"TWIN_LEASE_OWNER_BOUNDARY_REQUIRED");
  for(const marker of [
    "geox_mcft_cap09_evidence_runtime_login_v1",
    "geox_mcft_cap09_twin_runtime_login_v1",
    "geox_mcft_cap09_evidence_runtime_v1",
    "geox_mcft_cap09_twin_runtime_v1"
  ]) req(principals.includes(marker),"OWNER_SERVICE_PRINCIPAL_MARKER_REQUIRED:"+marker);

  write({
    schema_version:"geox_mcft_cap09_production_owner_graduation_preflight_v1",
    status:"PASS",
    gate_status:"PREFLIGHT_PASS_CUTOVER_NOT_PERFORMED",
    timing_budget_frozen:true,
    selected_budget_ms:timing.qualified_budget.selected_budget_ms,
    cutover_arm:false,
    non_github_hosting_binding_established:false,
    evidence_process_cutover:false,
    twin_process_cutover:false,
    evidence_and_twin_lease_boundaries_independent:true,
    login_presence_is_not_effective_owner_proof:true,
    exact_one_production_owner_proven:false,
    production_runtime_mutation:false,
    production_login_creation:false,
    production_owner_activation:false,
    provider_request_count:0,
    formal_v5_arm:false,
    formal_v5_mutation:false,
    a0_bootstrap:false,
    o00_started:false,
    mcft_cap09_completed:false
  });
}catch(error){
  write({
    status:"FAIL",
    error:error instanceof Error?error.message:String(error),
    production_runtime_mutation:false,
    production_login_creation:false,
    production_owner_activation:false,
    provider_request_count:0,
    formal_v5_arm:false,
    formal_v5_mutation:false,
    a0_bootstrap:false,
    o00_started:false,
    mcft_cap09_completed:false
  });
  process.exitCode=1;
}
