#!/usr/bin/env node
"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");

const ROOT=path.resolve(__dirname,"../..");
const BUNDLE="apps/server/src/domain/twin_runtime/external_formal_prewindow_authority_bundle_v5.ts";
const CONTRACT="scripts/runtime_acceptance/mcft_cap09_formal_v5_arm_contract_v1.ts";
const MANIFEST="scripts/runtime_acceptance/mcft_cap09_amendment19_formal_v5_manifest_v1.ts";
const RUNNER="scripts/runtime_acceptance/RUN_MCFT_CAP_09_FORMAL_V5_ARM_V1.cjs";
const STORE="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-ACTUAL-FORMAL-STORE-AUTHORITY-V3.json";
const BUDGET="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-FORCING-ACQUISITION-BUDGET-AUTHORITY-V1.json";
const REGISTRY="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json";

function read(rel){return fs.readFileSync(path.join(ROOT,rel),"utf8");}
function includes(source,needle,code){assert.ok(source.includes(needle),code);}
function excludes(source,needle,code){assert.equal(source.includes(needle),false,code);}

const bundle=read(BUNDLE);
const contract=read(CONTRACT);
const manifest=read(MANIFEST);
const runner=read(RUNNER);
const store=JSON.parse(read(STORE));
const budget=JSON.parse(read(BUDGET));
const registry=JSON.parse(read(REGISTRY));

includes(bundle,"GEOX-MCFT-CAP-09-T4R1-ACTUAL-FORMAL-STORE-AUTHORITY-V3.json","FORMAL_V5_BUNDLE_STORE_V3_REF_REQUIRED");
includes(bundle,"34fd3e92e0e628cf0db16e10df3633337fe81a1a","FORMAL_V5_BUNDLE_STORE_V3_BLOB_REQUIRED");
includes(bundle,"buildExternalFormalPrewindowAuthorityBundleV5","FORMAL_V5_BUNDLE_BUILDER_REQUIRED");
includes(bundle,"EXTERNAL_FORMAL_V5_STAGE_AUTHORITY_FORWARD_WINDOW_EXCEEDED","FORMAL_V5_BUNDLE_STAGE_WINDOW_GUARD_REQUIRED");
excludes(bundle,"GEOX-MCFT-CAP-09-T4R1-ACTUAL-FORMAL-STORE-AUTHORITY-V2.json","FORMAL_V5_BUNDLE_V2_STORE_REF_FORBIDDEN");

includes(contract,'"geox_mcft_cap09_s6_formal_t4r1_24h_v5"',"FORMAL_V5_CONTRACT_DB_REQUIRED");
includes(contract,"formal_v5_arm: true","FORMAL_V5_CONTRACT_ARM_EFFECT_REQUIRED");
includes(contract,"formal_v5_epoch_selected: true","FORMAL_V5_CONTRACT_EPOCH_EFFECT_REQUIRED");
includes(contract,"formal_database_mutation: false","FORMAL_V5_CONTRACT_DB_NON_EFFECT_REQUIRED");
includes(contract,"a0_bootstrap: false","FORMAL_V5_CONTRACT_A0_NON_EFFECT_REQUIRED");
includes(contract,"o00_started: false","FORMAL_V5_CONTRACT_O00_NON_EFFECT_REQUIRED");
includes(contract,"FORMAL_V5_ARM_STAGE_AUTHORITY_DOES_NOT_COVER_O23","FORMAL_V5_CONTRACT_STAGE_WINDOW_GUARD_REQUIRED");

includes(manifest,"buildExternalFormalPrewindowAuthorityBundleV5","FORMAL_V5_MANIFEST_V5_BUNDLE_REQUIRED");
includes(manifest,"validateMcftCap09FormalV5ArmV1","FORMAL_V5_MANIFEST_ARM_VALIDATOR_REQUIRED");
includes(manifest,"AM19_V5_CURRENT_CROP_FILE_DIGEST_MISMATCH","FORMAL_V5_MANIFEST_CROP_FILE_DIGEST_BINDING_REQUIRED");
includes(manifest,"AM19_V5_CURRENT_CROP_ARM_BINDING_MISMATCH","FORMAL_V5_MANIFEST_CROP_ARM_BINDING_REQUIRED");
includes(manifest,'activation_mode: "PRODUCTION_EFFECTIVE"',"FORMAL_V5_MANIFEST_PRODUCTION_STAGE_EFFECT_REQUIRED");

for(const marker of [
  "FORMAL_V5_ARM_LOCAL_OPERATOR_HOST_ONLY",
  "FORMAL_V5_ARM_EXPLICIT_OPERATOR_AUTHORIZATION_REQUIRED",
  "VERIFY_MCFT_CAP_09_FORMAL_V5_POST_GRADUATION_ARM_READINESS_V1.cjs",
  "AUDIT_MCFT_CAP_09_PHASE6_GITHUB_PRODUCTION_OWNERS_V1.cjs",
  "GEOX_MCFT_CAP09_FORMAL_V5_DATABASE_URL",
  "BEGIN READ ONLY",
  "FORMAL_V5_ARM_LIVE_ZERO_STATE_BASE_TABLE_COUNT_NONZERO",
  "FORMAL_V5_ARM_LIVE_ZERO_STATE_ROUTINE_COUNT_NONZERO",
  "FORMAL_V5_ARM_STAGE_AUTHORITY_DOES_NOT_COVER_O23",
  "candidate_artifacts_admissible===false",
  "formal_v5_arm:true",
  "formal_v5_epoch_selected:true",
  "formal_database_mutation:false",
  "a0_bootstrap:false",
  "o00_started:false",
]) includes(runner,marker,"FORMAL_V5_ARM_RUNNER_MARKER_REQUIRED:"+marker);

for(const forbidden of [
  "INSERT INTO",
  "UPDATE public.",
  "DELETE FROM",
  "DROP DATABASE",
  "CREATE DATABASE",
  "docker compose up",
  "docker-compose up",
]) excludes(runner,forbidden,"FORMAL_V5_ARM_RUNNER_MUTATION_FORBIDDEN:"+forbidden);

assert.equal(store.database_identity.database_name,"geox_mcft_cap09_s6_formal_t4r1_24h_v5");
assert.equal(store.database_identity.failed_predecessor_database,"geox_mcft_cap09_s6_formal_t4r1_24h_v4");
assert.equal(store.database_identity.failed_predecessor_reuse_forbidden,true);
assert.equal(store.database_identity.data_clone_from_failed_v4_forbidden,true);
assert.equal(store.database_identity.fresh_zero_state_required,true);
assert.equal(budget.status,"QUALIFIED_AND_FROZEN_FROM_EXACT_HEAD_REAL_TIMING_AND_CONTROLLED_DELAY");
assert.equal(budget.timing_budget_qualified,true);
assert.equal(budget.timing_budget_frozen,true);
assert.equal(budget.fixed_35_minute_lead_authorized_for_v5,false);
assert.equal(budget.hardcoded_replacement_budget_minutes,null);
assert.equal(budget.qualified_budget.selected_budget_ms,2081804);
assert.equal(registry.status,"ACTIVE");
assert.equal(registry.candidate_artifacts_admissible,false);

const selftest=cp.execFileSync(process.execPath,[path.join(ROOT,RUNNER),"--selftest"],{cwd:ROOT,encoding:"utf8"});
const proof=JSON.parse(selftest);
assert.equal(proof.status,"PASS");
assert.equal(proof.current_2026_09_18_04z_authority_blocks_new_window,true);
assert.equal(proof.fresh_2026_09_19_04z_fixture_admits_window,true);
assert.equal(proof.formal_database_mutation,false);
assert.equal(proof.a0_bootstrap,false);
assert.equal(proof.o00_started,false);

console.log(JSON.stringify({
  schema_version:"geox_mcft_cap09_formal_v5_actual_arm_successor_acceptance_v1",
  status:"PASS",
  fresh_v5_store_authority_pinned:true,
  frozen_v13_timing_budget_reused:true,
  fixed_35_minute_rule_not_reintroduced:true,
  current_crop_authority_exact_digest_bound:true,
  full_a0_o00_o23_stage_window_required:true,
  local_operator_only:true,
  h5_live_reverification_required:true,
  phase6_retired_trigger_zero_required:true,
  live_formal_db_zero_state_read_only_required:true,
  formal_database_mutation:false,
  a0_bootstrap:false,
  o00_started:false,
}));
