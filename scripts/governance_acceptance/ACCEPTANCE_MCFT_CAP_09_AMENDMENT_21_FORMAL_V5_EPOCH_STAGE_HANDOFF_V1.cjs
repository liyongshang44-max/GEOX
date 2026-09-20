#!/usr/bin/env node
"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");

const ROOT=path.resolve(__dirname,"../..");
const INITIAL_BASE="67bfdc5216ccc210c6479548297dd284bcb6a3f6";
const CADENCE_CORRECTION_BASE="ef9ed91edd260eefa264c85b6826c4ac1bc933f4";
const SCHEMA_COMPOSITION_CORRECTION_BASE="574777ffddd280b27a7e0ba040c215fb64c12a62";
const WRITER_OWNER_CLEANUP_CORRECTION_BASE="3ceff8c46a3ccdc4326438c9c4a35ea7e2d16ef0";
const SUCCESSOR_COMPATIBILITY_BASE="d054b334b3e74f3356b5d02498da9ba845eccdfb";
const MATERIALIZED_ZERO_REARM_BASE="cf2f3370fa82dbac35ffeba7c351edfd840e3565";
const AMENDMENT="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-21-FORMAL-V5-EPOCH-STAGE-AUTHORITY-HANDOFF.md";
const AMENDMENT_BLOB="b79e52620865a36d83cdbb0d95e6cccf1fed1ad3";
const H6="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-V5-PRODUCTION-ACTIVATION-SEAM-V1.json";
const QCP="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const ARM="scripts/runtime_acceptance/ASSEMBLE_MCFT_CAP_09_FORMAL_V5_ARM_V1.cjs";
const EPOCH_SELECTOR="scripts/runtime_acceptance/MCFT_CAP_09_FORMAL_V5_EPOCH_CLOCK_SELECTOR_V1.cjs";
const REGRESSION="scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_LATE_SEASON_EPOCH_STAGE_HANDOFF_V1.cjs";
const WORKFLOW=".github/workflows/mcft-cap-09-formal-v5-post-graduation-readiness.yml";
const SELF=path.relative(ROOT,__filename).replace(/\\/g,"/");
const INITIAL_EXACT_FILES=[
  AMENDMENT,H6,QCP,ARM,REGRESSION,WORKFLOW,SELF,
].sort();
const CADENCE_CORRECTION_EXACT_FILES=[
  H6,ARM,REGRESSION,SELF,
].sort();
const SCHEMA_COMPOSITION_CORRECTION_EXACT_FILES=[
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_H6_PRODUCTION_ACTIVATION_SEAM_V1.cjs",
  "scripts/runtime_acceptance/RUN_MCFT_CAP_09_FORMAL_V5_SCHEMA_ACL_MATERIALIZATION_V1.ts",
  SELF,
].sort();
const WRITER_OWNER_CLEANUP_CORRECTION_EXACT_FILES=[
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_H6_PRODUCTION_ACTIVATION_SEAM_V1.cjs",
  "scripts/runtime_acceptance/RUN_MCFT_CAP_09_FORMAL_V5_SCHEMA_ACL_MATERIALIZATION_V1.ts",
  SELF,
].sort();
const MATERIALIZED_ZERO_REARM_EXACT_FILES=[
  ".github/workflows/mcft-cap-09-formal-v5-post-graduation-readiness.yml",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-V5-POST-GRADUATION-CONTROL-SURFACE-V1.json",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-V5-PRODUCTION-ACTIVATION-SEAM-V1.json",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_AMENDMENT_21_FORMAL_V5_EPOCH_STAGE_HANDOFF_V1.cjs",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_H6_PRODUCTION_ACTIVATION_SEAM_V1.cjs",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_POST_GRADUATION_CONTROL_SURFACE_V1.cjs",
  "scripts/runtime_acceptance/ASSEMBLE_MCFT_CAP_09_FORMAL_V5_ARM_V1.cjs",
  "scripts/runtime_acceptance/VERIFY_MCFT_CAP_09_FORMAL_V5_MATERIALIZED_ZERO_REARM_ELIGIBILITY_V1.cjs",
  "scripts/runtime_acceptance/VERIFY_MCFT_CAP_09_FORMAL_V5_POST_GRADUATION_ARM_READINESS_V1.cjs",
].sort();
const FROZEN=[
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-06-FORMAL-WINDOW-EPOCH-REBASE-AUTHORITY.md",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-20-T4R1-FORMAL-SUCCESSOR-SCOPE-AUTHORITY.md",
  "docs/digital_twin/GEOX-DT-02-ARCHITECTURE-AMENDMENT-03-BIOLOGICAL-STAGE-AUTHORITY.md",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-BIOLOGICAL-STAGE-ARCHITECTURE-EFFECTIVENESS-V1.json",
  "apps/server/src/runtime/twin_runtime/external_formal_a18_crop_context_v4.ts",
  "apps/server/src/domain/twin_runtime/external_formal_prewindow_authority_bundle_v4.ts",
  "apps/server/src/runtime/twin_runtime/external_formal_v4_amendment19_runner_v2.ts",
  "scripts/runtime_acceptance/mcft_cap09_formal_v5_manifest_from_stage_authority_v1.ts",
  "scripts/runtime_acceptance/RUN_MCFT_CAP_09_FORMAL_V5_A0_BOOTSTRAP_V1.ts",
  "docker-compose.mcft-cap09-production.yml",
];

function git(...args){return cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8"}).trim();}
function read(rel){return fs.readFileSync(path.join(ROOT,rel),"utf8");}
function marker(text,value,code){assert.ok(text.includes(value),code+":"+value);}
function notMarker(text,value,code){assert.equal(text.includes(value),false,code+":"+value);}

const head=git("rev-parse","HEAD");
const baseEnv=String(process.env.MCFT_BASE_SHA||"").trim();
const subjectEnv=String(process.env.MCFT_SUBJECT_SHA||process.env.SUBJECT_SHA||"").trim();
if(subjectEnv)assert.equal(head,subjectEnv,"AM21_EXACT_SUBJECT_REQUIRED");

assert.equal(git("merge-base",INITIAL_BASE,head),INITIAL_BASE,"AM21_INITIAL_BASE_MUST_BE_ANCESTOR");
let exactPredecessor=INITIAL_BASE;
let exactBoundaryFileCount=0;
if(baseEnv){
  let expectedFiles;
  if(baseEnv===INITIAL_BASE){
    expectedFiles=INITIAL_EXACT_FILES;
  }else if(baseEnv===CADENCE_CORRECTION_BASE){
    expectedFiles=CADENCE_CORRECTION_EXACT_FILES;
  }else if(baseEnv===SCHEMA_COMPOSITION_CORRECTION_BASE){
    expectedFiles=SCHEMA_COMPOSITION_CORRECTION_EXACT_FILES;
  }else if(baseEnv===WRITER_OWNER_CLEANUP_CORRECTION_BASE){
    expectedFiles=WRITER_OWNER_CLEANUP_CORRECTION_EXACT_FILES;
  }else if(baseEnv===SUCCESSOR_COMPATIBILITY_BASE){
    expectedFiles=null;
    assert.equal(
      git("merge-base",SUCCESSOR_COMPATIBILITY_BASE,head),
      SUCCESSOR_COMPATIBILITY_BASE,
      "AM21_SUCCESSOR_COMPATIBILITY_BASE_MUST_BE_ANCESTOR",
    );
  }else if(baseEnv===MATERIALIZED_ZERO_REARM_BASE){
    expectedFiles=MATERIALIZED_ZERO_REARM_EXACT_FILES;
  }else{
    assert.fail("AM21_EXACT_PR_BASE_REQUIRED:"+baseEnv);
  }
  exactPredecessor=baseEnv;
  const changed=git("diff","--name-only",baseEnv+"..."+head).split(/\r?\n/).filter(Boolean).sort();
  if(expectedFiles)assert.deepEqual(changed,expectedFiles,"AM21_EXACT_BOUNDARY_REQUIRED");
  exactBoundaryFileCount=changed.length;
}

const frozenBase=baseEnv||INITIAL_BASE;
for(const rel of FROZEN){
  assert.equal(
    git("rev-parse","HEAD:"+rel),
    git("rev-parse",frozenBase+":"+rel),
    "AM21_FROZEN_PREDECESSOR_REWRITE_FORBIDDEN:"+rel,
  );
}
assert.equal(git("rev-parse","HEAD:"+AMENDMENT),AMENDMENT_BLOB,"AM21_AUTHORITY_BLOB_REQUIRED");

const amendment=read(AMENDMENT);
for(const value of [
  "T4R1 / Formal-v5 only",
  "Amendment-06 remains authoritative for the 36-hour minimum governance lead",
  "historical calendar envelope is not future Formal-v5 stage truth",
  "arm_time_stage_snapshot_is_runtime_pin = false",
  "A0 through O23 inclusive",
  "most-likely stage selection",
  "human-specified LATE",
  "A synthetic arm selftest alone is insufficient",
  "restart current production owners",
]){
  marker(amendment,value,"AM21_AUTHORITY_MARKER_REQUIRED");
}

const h6=JSON.parse(read(H6));
assert.ok(h6.subordinate_to.includes(AMENDMENT),"AM21_H6_SUBORDINATE_REF_REQUIRED");
assert.equal(h6.arm.epoch_selection.minimum_governance_lead_hours,36);
assert.equal(h6.arm.epoch_selection.amendment_21_ref,AMENDMENT);
assert.equal(h6.arm.epoch_selection.amendment_21_blob_sha,AMENDMENT_BLOB);
assert.equal(h6.arm.epoch_selection.actual_utc_only,true);
assert.equal(h6.arm.epoch_selection.scan_first_eligible_future_clock_window,true);
assert.equal(h6.arm.epoch_selection.exact_slot_count,24);
assert.equal(h6.arm.epoch_selection.whole_window_crop_context_viability_required_at_arm,false);
assert.equal(h6.arm.epoch_selection.arm_time_future_stage_pin_freeze_forbidden,true);
assert.equal(h6.arm.epoch_selection.lifecycle_horizon_must_cover_o23,true);
assert.equal(h6.arm.epoch_selection.future_stage_truth_authority,"DT02_A18_EFFECTIVE_CURRENT_BIOLOGICAL_STAGE_AUTHORITY");
assert.equal(h6.arm.epoch_selection.whole_window_stage_authority_coverage_required_before_a0,true);
assert.equal(h6.arm.epoch_selection.required_stage_authority_coverage,"A0_THROUGH_O23_INCLUSIVE");
assert.equal(h6.arm.epoch_selection.future_stage_authority_refresh_clock_eligibility_required,true);
assert.equal(h6.arm.epoch_selection.future_stage_authority_refresh_time_zone,"America/Detroit");
assert.equal(h6.arm.epoch_selection.future_stage_authority_refresh_snapshot_boundary,"LOCAL_CIVIL_DAY_MIDNIGHT");
assert.equal(h6.arm.epoch_selection.future_stage_authority_forward_stability_hours,30);
assert.equal(h6.arm.epoch_selection.future_stage_authority_snapshot_boundary_must_be_strictly_before_a0,true);
assert.equal(h6.arm.epoch_selection.future_stage_authority_snapshot_validity_must_cover_o23,true);
assert.equal(h6.arm.epoch_selection.future_stage_value_consulted_during_arm,false);
assert.equal(h6.arm.epoch_selection.future_stage_authority_identity_frozen_during_arm,false);
assert.equal(h6.post_arm_authority_continuity.selected_authority_must_cover_a0,true);
assert.equal(h6.post_arm_authority_continuity.selected_authority_must_cover_o23,true);
assert.equal(h6.post_arm_authority_continuity.selected_authority_must_cover_a0_through_o23_inclusive,true);

const arm=read(ARM);
for(const value of [
  'STAGE_HANDOFF_AUTH="'+AMENDMENT+'"',
  'STAGE_HANDOFF_AUTH_BLOB="'+AMENDMENT_BLOB+'"',
  "FORMAL_V5_ARM_AMENDMENT_21_STAGE_HANDOFF_BLOB_DRIFT",
  "selectFormalV5EpochClockV1",
  "stage_authority_refresh_clock_eligibility:epoch.stage_authority_refresh_clock_eligibility",
  "future_stage_pins_deferred_to_post_arm_dt02_a18:true",
  'required_future_stage_authority_coverage:"A0_THROUGH_O23_INCLUSIVE"',
  "formal_runtime_config_pins_frozen:false",
  "formal_stage_authority_pins_frozen:false",
  "arm_time_stage_snapshot_is_runtime_pin:false",
  "minimum_epoch_selection_governance_lead_hours:36",
  "loadEvidenceEpochCandidate",
  "FORMAL_V5_ARM_EVIDENCE_EPOCH_CANDIDATE_MISMATCH",
]){
  marker(arm,value,"AM21_ARM_MARKER_REQUIRED");
}
const selector=read(EPOCH_SELECTOR);
for(const value of [
  'STAGE_AUTHORITY_TIME_ZONE="America/Detroit"',
  "STAGE_AUTHORITY_FORWARD_STABILITY_HOURS=30",
  "CLOCK_ONLY_LIFECYCLE_AND_STAGE_AUTHORITY_CADENCE_BOUNDED_PENDING_POST_ARM_DT02_A18_STAGE_AUTHORITY",
  "FORMAL_V5_EPOCH_CLOCK_NO_AUTHORITY_CADENCE_COMPATIBLE_WINDOW_BEFORE_LIFECYCLE_HORIZON",
  "minimum_governance_lead_hours:36",
  "stage_value_consulted:false",
  "authority_identity_frozen:false",
]){
  marker(selector,value,"AM21_SHARED_EPOCH_SELECTOR_MARKER_REQUIRED");
}
for(const value of [
  "function evaluateSlot(",
  "variant_stage_lengths_days",
  "slot_stage_viability:",
  "FORMAL_V5_ARM_NO_ELIGIBLE_WHOLE_WINDOW_BEFORE_LIFECYCLE_HORIZON",
]){
  notMarker(arm,value,"AM21_ARM_HISTORICAL_STAGE_VETO_FORBIDDEN");
}

const regression=read(REGRESSION);
for(const value of [
  "historical_eligible_window_count:eligibleCount",
  "AM21_REGRESSION_HISTORICAL_SELECTOR_MUST_HAVE_ZERO_ELIGIBLE_WINDOWS",
  "AM21_REGRESSION_FIRST_REAL_FAILURE_DIAGNOSTIC_DRIFT",
  "AM21_REGRESSION_NAIVE_CLOCK_MUST_NOT_BE_STAGE_AUTHORITY_CADENCE_ELIGIBLE",
  "AM21_REGRESSION_CADENCE_O00_REQUIRED",
  "AM21_REGRESSION_CADENCE_VALID_UNTIL_REQUIRED",
  "FORMAL_V5_MANIFEST_STAGE_AUTHORITY_DOES_NOT_COVER_O23",
  "human_late_override_authorized:false",
  "production_effect:false",
]){
  marker(regression,value,"AM21_REGRESSION_MARKER_REQUIRED");
}

const qcp=JSON.parse(read(QCP));
const resolver=qcp.dependency_resolvers?.FORMAL_V5_AMENDMENT21_STAGE_HANDOFF_V1;
assert.ok(resolver,"AM21_QCP_RESOLVER_REQUIRED");
assert.equal(resolver.kind,"EXACT_PATH_SET");
for(const rel of [AMENDMENT,H6,ARM,EPOCH_SELECTOR,REGRESSION,SELF,WORKFLOW]){
  assert.ok(resolver.paths.includes(rel),"AM21_QCP_PATH_REQUIRED:"+rel);
}
const check=(qcp.checks||[]).find((row)=>row.check_id==="FORMAL_V5_AMENDMENT21_STAGE_HANDOFF");
assert.ok(check,"AM21_QCP_CHECK_REQUIRED");
assert.deepEqual(check.resolver_ids,["FORMAL_V5_AMENDMENT21_STAGE_HANDOFF_V1"]);
assert.deepEqual(check.applicable_stages,["SUCCESSOR_SUBJECT_PRE_MERGE","POST_MERGE_V13_QUALIFICATION","POST_GRADUATION_FORMAL_V5_ACTIVATION"]);
assert.equal(check.carry_forward_policy,"NONE");
assert.equal(check.fail_policy,"FAIL_CLOSED_NO_FORMAL_ARM_OR_STAGE_PIN_PROMOTION");

const workflow=read(WORKFLOW);
for(const value of [
  AMENDMENT,
  SELF,
  REGRESSION,
  "Prove Amendment-21 epoch/stage authority handoff",
  "Prove real T4R1 late-season stage-handoff regression",
]){
  marker(workflow,value,"AM21_WORKFLOW_MARKER_REQUIRED");
}

const proof={
  schema_version:"geox_mcft_cap09_amendment21_formal_v5_epoch_stage_handoff_acceptance_v1",
  status:"PASS",
  exact_predecessor_sha:exactPredecessor,
  exact_boundary_file_count:exactBoundaryFileCount,
  subject_head_sha:head,
  exact_boundary_enforced:baseEnv!==""&&baseEnv!==SUCCESSOR_COMPATIBILITY_BASE,
  successor_compatibility_mode:baseEnv===SUCCESSOR_COMPATIBILITY_BASE,
  shared_epoch_clock_selector:EPOCH_SELECTOR,
  historical_v4_rewritten:false,
  amendment06_clock_semantics_rewritten:false,
  dt02_architecture_rewritten:false,
  amendment20_scope_rewritten:false,
  runtime_kernel_rewritten:false,
  scheduler_semantics_rewritten:false,
  current_production_owner_restart:false,
  database_write_count:0,
  formal_v5_arm:false,
  a0_started:false,
  o00_started:false,
  arm_clock_only:true,
  stage_authority_refresh_clock_eligibility_required:true,
  stage_authority_refresh_time_zone:"America/Detroit",
  stage_authority_forward_stability_hours:30,
  future_stage_value_consulted_at_arm:false,
  future_stage_authority_identity_frozen_at_arm:false,
  minimum_governance_lead_hours:36,
  lifecycle_horizon_o23_gate_preserved:true,
  historical_fao_calendar_envelope_retained_as_model_prior:true,
  historical_fao_calendar_envelope_used_as_future_v5_stage_truth:false,
  future_stage_pins_frozen_at_arm:false,
  post_arm_pre_a0_dt02_a18_authority_required:true,
  required_stage_authority_coverage:"A0_THROUGH_O23_INCLUSIVE",
  real_late_season_regression_present:true,
  qcp_registration_present:true,
  mcft_cap09_completed:false,
};
fs.mkdirSync(path.join(ROOT,"acceptance-output"),{recursive:true});
fs.writeFileSync(path.join(ROOT,"acceptance-output/MCFT_CAP_09_AMENDMENT21_FORMAL_V5_EPOCH_STAGE_HANDOFF_V1_RESULT.json"),JSON.stringify(proof,null,2)+"\n");
console.log(JSON.stringify(proof,null,2));
