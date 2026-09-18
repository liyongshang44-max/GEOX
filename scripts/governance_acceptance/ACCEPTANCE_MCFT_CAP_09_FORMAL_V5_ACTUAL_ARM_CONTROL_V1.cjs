"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const cp=require("node:child_process");
const path=require("node:path");

const ROOT=path.resolve(__dirname,"../..");
const CONTROL="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-V5-ACTUAL-ARM-CONTROL-V1.json";
const READINESS="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-V5-POST-GRADUATION-CONTROL-SURFACE-V1.json";
const PREFLIGHT="scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_FORMAL_V5_ACTUAL_ARM_V1.cjs";

const c=JSON.parse(fs.readFileSync(path.join(ROOT,CONTROL),"utf8"));
assert.equal(c.schema_version,"geox_mcft_cap09_formal_v5_actual_arm_control_v1");
assert.equal(c.stage,"POST_GRADUATION_FORMAL_V5_ACTIVATION");
assert.equal(c.execution_boundary.production_execution_host_class,"LOCAL_NON_GITHUB_OPERATOR_HOST_ONLY");
assert.equal(c.execution_boundary.github_actions_actual_arm_forbidden,true);
assert.equal(c.execution_boundary.explicit_operator_authorization_required_at_execution,true);
assert.equal(c.execution_boundary.readiness_is_not_arm,true);
assert.equal(c.execution_boundary.actual_arm_executor_implemented,false);
assert.equal(c.execution_boundary.actual_arm_preflight_ref,PREFLIGHT);
assert.equal(c.temporal_contract.minimum_epoch_selection_lead_hours,36);
assert.equal(c.temporal_contract.slot_count,24);
assert.equal(c.temporal_contract.o23_offset_from_o00_hours,23);
assert.equal(c.temporal_contract.minimum_forward_coverage_from_selection_instant_hours,59);
assert.equal(c.current_stage_authority_adjudication.current_forward_stability_hours,30);
assert.equal(c.current_stage_authority_adjudication.minimum_required_hours_even_if_authority_as_of_equals_selection_time,59);
assert.equal(c.current_stage_authority_adjudication.current_result,"NO_CURRENT_LEGAL_FORMAL_V5_EPOCH_AUTHORITY");
assert.equal(c.current_stage_authority_adjudication.silent_promotion_to_formal_authority_forbidden,true);
for(const [k,v] of Object.entries(c.authorization_ceiling))assert.equal(v,false,"ACTUAL_ARM_CONTROL_CEILING_MUST_REMAIN_FALSE:"+k);
for(const [k,v] of Object.entries(c.non_effects)){
  if(k==="provider_request")assert.equal(v,false);
  else assert.equal(v,false,"ACTUAL_ARM_CONTROL_NON_EFFECT_REQUIRED:"+k);
}

const readiness=JSON.parse(fs.readFileSync(path.join(ROOT,READINESS),"utf8"));
assert.equal(readiness.authorization_ceiling.formal_v5_arm_authorized,false);
assert.equal(readiness.authorization_ceiling.formal_v5_epoch_selection_authorized,false);
assert.equal(readiness.authorization_ceiling.formal_v5_database_mutation_authorized,false);
assert.equal(readiness.authorization_ceiling.a0_authorized,false);
assert.equal(readiness.authorization_ceiling.o00_authorized,false);

const source=fs.readFileSync(path.join(ROOT,PREFLIGHT),"utf8");
for(const marker of [
  "FORMAL_V5_ACTUAL_ARM_LOCAL_HOST_ONLY",
  "FORMAL_V5_SEPARATE_EXPLICIT_OPERATOR_AUTHORIZATION_REQUIRED",
  "FORMAL_V5_ACTUAL_ARM_HEAD_MUST_EQUAL_PROTECTED_MAIN",
  "FORMAL_V5_ACTUAL_ARM_WORKTREE_MUST_BE_CLEAN",
  "FORMAL_V5_STAGE_AUTHORITY_STRUCTURAL_FORWARD_COVERAGE_LT_59H",
  "FORMAL_V5_STAGE_AUTHORITY_WHOLE_WINDOW_COVERAGE_INSUFFICIENT",
  "NO_CURRENT_LEGAL_FORMAL_V5_EPOCH_AUTHORITY",
  "GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json",
])assert.ok(source.includes(marker),"ACTUAL_ARM_PREFLIGHT_MARKER_REQUIRED:"+marker);
for(const forbidden of [
  "docker compose up",
  "docker-compose up",
  "INSERT INTO",
  "UPDATE public.",
  "DELETE FROM",
  "DROP DATABASE",
  "CREATE DATABASE",
])assert.equal(source.includes(forbidden),false,"ACTUAL_ARM_PREFLIGHT_EFFECT_FORBIDDEN:"+forbidden);

const selftest=cp.execFileSync(process.execPath,[path.join(ROOT,PREFLIGHT),"--selftest"],{cwd:ROOT,encoding:"utf8"});
const p=JSON.parse(selftest);
assert.equal(p.status,"PASS");
assert.equal(p.thirty_hour_authority_fail_closed,true);
assert.equal(p.fifty_nine_hour_structural_floor_proven,true);
assert.equal(p.seventy_two_hour_fixture_admitted,true);
assert.equal(p.formal_v5_arm,false);
assert.equal(p.formal_v5_epoch_selected,false);
assert.equal(p.formal_database_mutation,false);
assert.equal(p.a0_bootstrap,false);
assert.equal(p.o00_started,false);

console.log(JSON.stringify({
  schema_version:"geox_mcft_cap09_formal_v5_actual_arm_control_acceptance_v1",
  status:"PASS",
  readiness_arm_separation_preserved:true,
  local_operator_only:true,
  amendment06_36h_and_24_slot_whole_window_enforced:true,
  current_30h_stage_authority_fail_closed:true,
  actual_arm_executed:false,
  formal_database_mutation:false,
  a0:false,
  o00:false,
}));
