#!/usr/bin/env node
"use strict";

const assert=require("node:assert/strict");
const cp=require("node:child_process");
const fs=require("node:fs");
const path=require("node:path");

const ROOT=path.resolve(__dirname,"../..");
const authorityContinuity=require("./ACCEPTANCE_MCFT_CAP_09_PROOF_BOUND_FIRST_PARENT_SUCCESSOR_CHAIN_V1.cjs").verifyFormalV5AuthorityContinuity();
const BASE="db1747f4111dcd61f09b81ec3b7c1b237ecc7484";

const EXPECTED_CHANGED=[
  ".github/workflows/mcft-cap-09-formal-v5-completion-adjudication-v1.yml",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_COMPLETION_ADJUDICATION_V1.cjs",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_V5_FINAL_READBACK_V1.cjs",
  "scripts/governance_acceptance/ADJUDICATE_MCFT_CAP_09_FORMAL_V5_COMPLETION_V1.cjs",
  "scripts/governance_acceptance/ASSEMBLE_MCFT_CAP_09_FORMAL_V5_COMPLETION_CANDIDATE_V1.cjs",
].sort();

const FROZEN={
  "scripts/runtime_acceptance/READBACK_MCFT_CAP_09_FORMAL_V5_FINAL_V1.ts":"447ac8d840b9ac8260d0c2df1564e3a28bd9baa3",
  "scripts/runtime_acceptance/READBACK_MCFT_CAP_09_FORMAL_V5_ACTIVE_WATCHDOG_V1.ts":"456436c661cd055d6bc8a034f46edfa983700081",
  "scripts/runtime_acceptance/VERIFY_MCFT_CAP_09_FORMAL_V5_DOWNSTREAM_ZERO_V1.ts":"b80e85a3e1bf18f6818046caa4dd42b85642937c",
  "apps/server/src/runtime/twin_runtime/mcft_cap09_formal_v5_twin_runtime_process_v1.ts":"e2947f14e722e702bceb946d3f5f629c090a0345",
  "apps/server/src/external_evidence/mcft_cap09_formal_v5_forcing_runtime_process_v1.ts":"aaee1d7d8677e5ab5fda5db57e9c8e0c807b3c59",
  "apps/server/src/runtime/twin_runtime/external_formal_v5_amendment19_runner_v2.ts":"ed92e28bc575714e0f0cc6457f842a6ce8da457f",
  "docker-compose.mcft-cap09-formal-v5-active.yml":"2dbd7ab1d0117ffc0df25508888c59be1f772971",
};

function git(...args){return cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8"}).trim();}
function read(rel){return fs.readFileSync(path.join(ROOT,rel),"utf8");}
function has(text,marker,code){assert.ok(text.includes(marker),code+":"+marker);}
function absent(text,marker,code){assert.equal(text.includes(marker),false,code+":"+marker);}

assert.equal(git("merge-base",BASE,"HEAD"),BASE,"G13_BASE_NOT_ANCESTOR");
const changed=git("diff","--name-only",BASE+"...HEAD").split(/\r?\n/).filter(Boolean).sort();
assert.deepEqual(changed.filter(rel=>EXPECTED_CHANGED.includes(rel)||!authorityContinuity?.changedPaths.includes(rel)),EXPECTED_CHANGED,"G13_EXACT_CHANGED_PATH_BOUNDARY");

for(const [rel,blob] of Object.entries(FROZEN)){
  assert.equal(git("rev-parse","HEAD:"+rel),blob,"G13_FROZEN_G12_OR_RUNTIME_SURFACE_CHANGED:"+rel);
}

const assembler=read("scripts/governance_acceptance/ASSEMBLE_MCFT_CAP_09_FORMAL_V5_COMPLETION_CANDIDATE_V1.cjs");
for(const marker of [
  "geox_mcft_cap09_formal_v5_completion_candidate_v1",
  "geox_mcft_cap09_formal_v5_a0_production_replay_promotion_v1",
  "geox_mcft_cap09_formal_v5_a0_bootstrap_result_v1",
  "geox_mcft_cap09_formal_v5_active_activation_authority_v1",
  "geox_mcft_cap09_formal_v5_active_cutover_result_v1",
  "geox_mcft_cap09_formal_v5_final_readback_v1",
  "geox_mcft_cap09_formal_v5_downstream_zero_v1",
  "v13_post_a0_forcing_receipt_count:23",
  "scheduler_terminal_slot_count:24",
  "terminal_tick_count:24",
  "formal_completion_candidate:true",
  "final_adjudication_required:true",
  "mcft_cap09_completed:false",
])has(assembler,marker,"G13_ASSEMBLER_MARKER_REQUIRED");
absent(assembler,"mcft_cap09_completed:true","G13_ASSEMBLER_PREMATURE_COMPLETION_FORBIDDEN");
absent(assembler,"mcft-cap09-am19-formal-hourly","G13_LEGACY_HOURLY_ARTIFACT_FORBIDDEN");

const adjudicator=read("scripts/governance_acceptance/ADJUDICATE_MCFT_CAP_09_FORMAL_V5_COMPLETION_V1.cjs");
for(const marker of [
  "G13_ADJUDICATION_OPERATOR_AUTHORIZATION_REQUIRED",
  "G13_ADJUDICATION_HEAD_MUST_EQUAL_CURRENT_MAIN",
  "G13_ADJUDICATION_MAIN_DRIFT_AFTER_FINAL_READBACK",
  "git\",[\"merge-base\",\"--is-ancestor\"",
  'adjudication:"CAP09_FORMAL_V5_CLOSURE_ACCEPTED"',
  "completion_candidate_sha256",
  "database_write_count:0",
  "provider_request_count:0",
  "runtime_write_count:0",
  "mcft_cap09_completed:true",
])has(adjudicator,marker,"G13_ADJUDICATOR_MARKER_REQUIRED");
for(const forbidden of [
  "pg",
  "DATABASE_URL",
  "fetch(",
  "gh workflow run",
  "docker compose",
])absent(adjudicator,forbidden,"G13_ADJUDICATOR_EFFECTFUL_DEPENDENCY_FORBIDDEN");

const workflow=read(".github/workflows/mcft-cap-09-formal-v5-completion-adjudication-v1.yml");
for(const forbidden of [
  "schedule:",
  "pull_request_target",
  "--operator-authorized",
  "DATABASE_URL",
  "GEOX_MCFT_CAP09_FORMAL_V5_DATABASE_URL",
  "gh workflow run",
])absent(workflow,forbidden,"G13_WORKFLOW_REAL_ADJUDICATION_FORBIDDEN");
has(workflow,"--selftest","G13_WORKFLOW_SELFTEST_ONLY_REQUIRED");

const proof={
  schema_version:"geox_mcft_cap09_formal_v5_completion_adjudication_governance_v1",
  status:"PASS",
  exact_predecessor:BASE,
  changed_path_count:changed.length,
  g12_readback_surface_unchanged:true,
  runtime_surface_unchanged:true,
  database_schema_unchanged:true,
  completion_candidate_assembly_only:true,
  final_adjudication_is_separate_operator_authorized_step:true,
  exact_main_continuity_required_for_final_claim:true,
  legacy_github_hourly_artifact_dependency:false,
  github_production_clock_dependency:false,
  ci_real_adjudication_forbidden:true,
  production_effect:false,
  database_write_count:0,
  provider_request_count:0,
  runtime_write_count:0,
  mcft_cap09_completed:false,
};

const out=path.join(ROOT,"acceptance-output/MCFT_CAP_09_FORMAL_V5_COMPLETION_ADJUDICATION_GOVERNANCE_V1_RESULT.json");
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(proof,null,2)+"\n");
process.stdout.write(JSON.stringify(proof,null,2)+"\n");
