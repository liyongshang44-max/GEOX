#!/usr/bin/env node
"use strict";

const assert=require("node:assert/strict");
const cp=require("node:child_process");
const fs=require("node:fs");
const path=require("node:path");

const ROOT=path.resolve(__dirname,"../..");
// Revocation-only successors requalify unchanged consumers without carrying an old ARM.
const authorityContinuity=require("./VERIFY_MCFT_CAP_09_AM22_PREQUALIFICATION_ONLY_SUCCESSOR_V1.cjs").verifyPrequalificationOnlySuccessor()
  ?? require("./VERIFY_MCFT_CAP_09_ARM_RETIREMENT_ONLY_SUCCESSOR_V1.cjs").verifyRetirementOnlySuccessor()
  ?? require("./ACCEPTANCE_MCFT_CAP_09_PROOF_BOUND_FIRST_PARENT_SUCCESSOR_CHAIN_V1.cjs").verifyFormalV5AuthorityContinuity();
const BASE="dd7529ffd08bead343e312c73b72d7039a7c12e7";

const EXPECTED_CHANGED=[
  ".github/workflows/mcft-cap-09-formal-v5-final-readback-v1.yml",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_FINAL_READBACK_V1.cjs",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_R6_ADMISSION_V1.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_FINAL_READBACK_SCHEMA_V1.ts",
  "scripts/runtime_acceptance/READBACK_MCFT_CAP_09_FORMAL_V5_ACTIVE_WATCHDOG_V1.ts",
  "scripts/runtime_acceptance/READBACK_MCFT_CAP_09_FORMAL_V5_FINAL_V1.ts",
  "scripts/runtime_acceptance/VERIFY_MCFT_CAP_09_FORMAL_V5_DOWNSTREAM_ZERO_V1.ts",
].sort();

const FROZEN={
  "apps/server/src/runtime/twin_runtime/mcft_cap09_formal_v5_twin_runtime_composition_v1.ts":"e5955a63d6b15c0e70bac08ef975bc90997869bb",
  "apps/server/src/runtime/twin_runtime/mcft_cap09_formal_v5_twin_runtime_process_v1.ts":"e2947f14e722e702bceb946d3f5f629c090a0345",
  "apps/server/src/external_evidence/mcft_cap09_formal_v5_forcing_runtime_process_v1.ts":"aaee1d7d8677e5ab5fda5db57e9c8e0c807b3c59",
  "apps/server/src/runtime/twin_runtime/external_formal_v5_amendment19_runner_v2.ts":"ed92e28bc575714e0f0cc6457f842a6ce8da457f",
  "apps/server/src/runtime/twin_runtime/external_formal_v5_viability_gated_scheduler_v1.ts":"21d96c4a3a0001e113af71eaeca86e75ee6e2287",
  "apps/server/src/runtime/twin_runtime/external_formal_v3_amendment19_persistent_tick_service_v1.ts":"a66fb6b59e00870f27e1856975006a840a6f62f7",
  "apps/server/src/runtime/twin_runtime/external_formal_a18_crop_context_v5.ts":"df8a9af329db7905ea14f4f51aa677be4e8bff9f",
  "scripts/runtime_acceptance/mcft_cap09_formal_v5_manifest_from_stage_authority_v1.ts":"f9203efee8f8fb238cbf8f01cc39c53ed628f0f8",
  "docker-compose.mcft-cap09-formal-v5-active.yml":"2dbd7ab1d0117ffc0df25508888c59be1f772971",
};

function git(...args){return cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8"}).trim();}
function read(rel){return fs.readFileSync(path.join(ROOT,rel),"utf8");}
function has(text,marker,code){assert.ok(text.includes(marker),code+":"+marker);}
function forbid(text,pattern,code){assert.equal(pattern.test(text),false,code+":"+pattern);}

assert.equal(git("merge-base",BASE,"HEAD"),BASE,"G12_BASE_NOT_ANCESTOR");
const changed=git("diff","--name-only",BASE+"...HEAD").split(/\r?\n/).filter(Boolean).sort();
const QUALIFIED_G12="8d78cb4808c39166b085d723d36bcc724cb050b0";
const completionSuccessor=git("rev-parse","HEAD")!==QUALIFIED_G12
  &&git("merge-base",QUALIFIED_G12,"HEAD")===QUALIFIED_G12;
if(!completionSuccessor){
  assert.deepEqual(changed,EXPECTED_CHANGED,"G12_EXACT_CHANGED_PATH_BOUNDARY");
}else{
  const allowed=new Set([
    ".github/workflows/mcft-cap-09-formal-v5-completion-adjudication-v1.yml",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json",
    "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_COMPLETION_ADJUDICATION_V1.cjs",
    "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_FINAL_READBACK_V1.cjs",
    "scripts/governance_acceptance/ASSEMBLE_MCFT_CAP_09_FORMAL_V5_COMPLETION_CANDIDATE_V1.cjs",
    "scripts/governance_acceptance/ADJUDICATE_MCFT_CAP_09_FORMAL_V5_COMPLETION_V1.cjs",
  ]);
  const delta=git("diff","--name-only",QUALIFIED_G12+"...HEAD").split(/\r?\n/).filter(Boolean);
  for(const rel of delta)assert.ok(allowed.has(rel)||authorityContinuity?.changedPaths.includes(rel),"G12_COMPLETION_SUCCESSOR_PATH_FORBIDDEN:"+rel);
  for(const rel of EXPECTED_CHANGED.filter(rel=>rel!=="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json"&&rel!=="scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_FINAL_READBACK_V1.cjs")){
    if(authorityContinuity&&rel==="scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_R6_ADMISSION_V1.cjs")continue;
    assert.equal(git("rev-parse","HEAD:"+rel),git("rev-parse",QUALIFIED_G12+":"+rel),"G12_QUALIFIED_READBACK_CHANGED:"+rel);
  }
}

for(const [rel,blob] of Object.entries(FROZEN)){
  assert.equal(git("rev-parse","HEAD:"+rel),blob,"G12_FROZEN_RUNTIME_SURFACE_CHANGED:"+rel);
}

const readback=read("scripts/runtime_acceptance/READBACK_MCFT_CAP_09_FORMAL_V5_FINAL_V1.ts");
for(const marker of [
  "geox_mcft_cap09_formal_v5_final_readback_v1",
  "MCFT_CAP09_FORMAL_V5_DATABASE_V1",
  "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
  "FORMAL_V5_FINAL_CURRENT_MAIN_MUST_EQUAL_A0_CONTINUITY_HEAD",
  "FORMAL_V5_FINAL_EXACT_24_SLOTS_REQUIRED",
  "FORMAL_V5_FINAL_EXACT_24_TERMINAL_TICKS_REQUIRED",
  "FORMAL_V5_FINAL_EXACT_23_FORCING_RECEIPTS_REQUIRED",
  "FORMAL_VISIBLE_ATTESTED",
  "FORMAL_V5_FINAL_ACTIVE_TWIN_LEASE_FORBIDDEN",
  "FORMAL_V5_FINAL_LIVE_FORCING_CONTROLLER_LEASE_FORBIDDEN",
  "completion_adjudication_required:true",
  "mcft_cap09_completed:false",
])has(readback,marker,"G12_READBACK_MARKER_REQUIRED");

const watchdog=read("scripts/runtime_acceptance/READBACK_MCFT_CAP_09_FORMAL_V5_ACTIVE_WATCHDOG_V1.ts");
for(const marker of [
  "geox_mcft_cap09_formal_v5_active_watchdog_v1",
  "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
  "FAILED_SCHEDULER_SLOT",
  "FORCING_DEADLINE_MISSED_TERMINAL",
  "forcing_target_states",
  "irreversible_alert_count",
  "database_write_count:0",
  "provider_request_count:0",
])has(watchdog,marker,"G12_WATCHDOG_MARKER_REQUIRED");

const downstream=read("scripts/runtime_acceptance/VERIFY_MCFT_CAP_09_FORMAL_V5_DOWNSTREAM_ZERO_V1.ts");
for(const marker of [
  "geox_mcft_cap09_formal_v5_downstream_zero_v1",
  "MCFT_CAP09_FORMAL_V5_DATABASE_V1",
  "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
  "twin_decision_record_projection_v1",
  "twin_approved_plan_binding_projection_v1",
  "downstream_zero_pass:true",
  "mcft_cap09_completed:false",
])has(downstream,marker,"G12_DOWNSTREAM_MARKER_REQUIRED");

for(const [name,text] of [["readback",readback],["watchdog",watchdog],["downstream",downstream]]){
  for(const pattern of [
    /\bINSERT\s+INTO\b/i,
    /\bUPDATE\s+[a-zA-Z_]/i,
    /\bDELETE\s+FROM\b/i,
    /\bTRUNCATE\b/i,
    /\bALTER\s+TABLE\b/i,
    /\bDROP\s+(?:TABLE|SCHEMA|DATABASE)\b/i,
    /\bCREATE\s+(?:TABLE|SCHEMA|DATABASE)\b/i,
    /\bfetch\s*\(/i,
  ])forbid(text,pattern,"G12_EFFECTFUL_OPERATION_FORBIDDEN:"+name);
}

const workflow=read(".github/workflows/mcft-cap-09-formal-v5-final-readback-v1.yml");
for(const forbidden of [
  "schedule:",
  "pull_request_target",
  "GEOX_MCFT_CAP09_FORMAL_V5_DATABASE_URL",
  "GEOX_MCFT_CAP09_FORMAL_V5_ADMIN_DATABASE_URL",
  "gh workflow run",
  "docker compose up",
]){
  assert.equal(workflow.includes(forbidden),false,"G12_WORKFLOW_PRODUCTION_EFFECT_FORBIDDEN:"+forbidden);
}

const proof={
  schema_version:"geox_mcft_cap09_formal_v5_final_readback_governance_v1",
  status:"PASS",
  exact_predecessor:BASE,
  read_only_completion_successor_mode:completionSuccessor,
  changed_path_count:changed.length,
  frozen_runtime_surface_unchanged:true,
  g11_active_route_unchanged:true,
  r6_admission_unchanged:true,
  database_schema_unchanged:true,
  readback_is_read_only:true,
  watchdog_is_read_only:true,
  downstream_zero_is_read_only:true,
  github_production_wake_added:false,
  provider_request_path_added:false,
  v13_database_receipts_replace_legacy_hourly_github_artifacts:true,
  runtime_semantic_subject_separate_from_authority_continuity_head:true,
  final_completion_claimed:false,
  production_effect:false,
  database_write_count:0,
  provider_request_count:0,
  mcft_cap09_completed:false,
};

const out=path.join(ROOT,"acceptance-output/MCFT_CAP_09_FORMAL_V5_FINAL_READBACK_GOVERNANCE_V1_RESULT.json");
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(proof,null,2)+"\n");
process.stdout.write(JSON.stringify(proof,null,2)+"\n");
