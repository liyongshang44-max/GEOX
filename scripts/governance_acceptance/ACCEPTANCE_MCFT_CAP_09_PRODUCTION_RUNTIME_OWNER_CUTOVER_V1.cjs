#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const fs=require("node:fs");
const path=require("node:path");
const ROOT=path.resolve(__dirname,"../..");
const read=(p)=>fs.readFileSync(path.join(ROOT,p),"utf8");
const json=(p)=>JSON.parse(read(p));
const digest=(p)=>"sha256:"+crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT,p))).digest("hex");

const registryPath="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json";
const certPath="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-BIOLOGICAL-STAGE-ARCHITECTURE-EFFECTIVENESS-V1.json";
const policyPath="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-RUNTIME-OWNER-CUTOVER-AUTHORITY-V1.json";
const a0Path="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRE-FORMAL-A0-PLANNING-AUTHORITY-V1.json";
const timingPath="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-FORCING-ACQUISITION-BUDGET-AUTHORITY-V1.json";
const composePath="docker-compose.mcft-cap09-production-preformal.yml";
const distPath="apps/server/scripts/write_dist_entries.cjs";
const standbyPath="apps/server/src/runtime/twin_runtime/mcft_cap09_twin_preformal_owner_standby_v1.ts";
const evidencePath="apps/server/src/runtime/mcft_cap09_evidence_preformal_owner_runtime_v1.ts";
const twinPath="apps/server/src/runtime/mcft_cap09_twin_preformal_owner_runtime_v1.ts";
const runPath="scripts/runtime_acceptance/RUN_MCFT_CAP_09_PRODUCTION_RUNTIME_OWNER_CUTOVER_V1.cjs";
const allowedGraduation=new Set(["EFFECTIVE_FOR_RUNTIME_CONSUMPTION","EFFECTIVE_FOR_RUNTIME_CONSUMPTION_ROLLING_REFRESH"]);

const registry=json(registryPath),cert=json(certPath),policy=json(policyPath),a0=json(a0Path),timing=json(timingPath);
assert.equal(policy.status,"AUTHORIZED_FOR_LOCAL_OPERATOR_MANAGED_DOCKER_CUTOVER");
assert.equal(policy.authority_predecessor_protected_main_sha,"d17f894e86b0fabab648530968c562e2fbe94c5d");
assert.equal(policy.authority_inputs.effective_current_crop_authority_registry_ref,registryPath);
const registryContract=policy.authority_inputs.effective_current_crop_authority_registry_contract;
assert.equal(registry.schema_version,registryContract.schema_version);
assert.equal(registry.registry_id,registryContract.registry_id);
assert.equal(registry.status,registryContract.status);
assert.equal(registry.selection_policy,"LATEST_EFFECTIVE_AUTHORITY_AS_OF_NOT_AFTER_LOGICAL_TIME_WITHIN_VALIDITY_WINDOW");
assert.equal(registry.selection_policy,registryContract.selection_policy);
assert.equal(registry.candidate_artifacts_admissible,false);
assert.equal(registryContract.candidate_artifacts_admissible,false);
assert.deepEqual(new Set(registryContract.allowed_graduation_statuses),allowedGraduation);
assert.ok(Array.isArray(registry.entries)&&registry.entries.length>=2,"CUTOVER_EFFECTIVE_REGISTRY_ENTRIES_REQUIRED");
for(const [index,entry] of registry.entries.entries()){
  assert.equal(typeof entry.authority_ref,"string",`CUTOVER_REGISTRY_REF_REQUIRED:${index}`);
  assert.match(String(entry.authority_sha256||""),/^sha256:[0-9a-f]{64}$/,`CUTOVER_REGISTRY_DIGEST_REQUIRED:${index}`);
  assert.ok(allowedGraduation.has(entry.graduation_status),`CUTOVER_REGISTRY_GRADUATION_REQUIRED:${index}`);
  const authorityPath=path.resolve(ROOT,entry.authority_ref);
  assert.ok(authorityPath.startsWith(ROOT+path.sep),`CUTOVER_REGISTRY_REF_ESCAPE:${index}`);
  assert.equal(digest(entry.authority_ref),entry.authority_sha256,`CUTOVER_REGISTRY_DIGEST_MISMATCH:${index}`);
  const authority=json(entry.authority_ref);
  assert.equal(authority.architecture_effective,true,`CUTOVER_REGISTRY_AUTHORITY_EFFECTIVE_REQUIRED:${index}`);
  assert.equal(authority.runtime_consumption_authorized,true,`CUTOVER_REGISTRY_RUNTIME_CONSUMPTION_REQUIRED:${index}`);
  assert.equal(authority.graduation.status,entry.graduation_status,`CUTOVER_REGISTRY_GRADUATION_MATCH_REQUIRED:${index}`);
  assert.equal(authority.biological_stage.authority_as_of,entry.authority_as_of,`CUTOVER_REGISTRY_AS_OF_MATCH_REQUIRED:${index}`);
  const derived=new Date(Date.parse(entry.authority_as_of)+Number(authority.biological_stage.forward_stability_hours)*3_600_000).toISOString();
  assert.equal(derived,entry.authority_valid_until,`CUTOVER_REGISTRY_VALIDITY_MATCH_REQUIRED:${index}`);
  for(const key of ["production_runtime_start_authorized","production_owner_activation_authorized","formal_v5_authorized","a0_authorized","o00_o23_authorized","mcft_cap09_completed"]) assert.equal(authority[key],false,`CUTOVER_REGISTRY_AUTHORITY_CEILING_REQUIRED:${index}:${key}`);
}
assert.ok(registry.entries.some(entry=>entry.graduation_status==="EFFECTIVE_FOR_RUNTIME_CONSUMPTION_ROLLING_REFRESH"),"CUTOVER_ROLLING_REFRESH_EFFECTIVE_ENTRY_REQUIRED");
assert.equal(digest(certPath),"sha256:acffd98b6e014db4d11a3374a50a2e576be3396aef33ed456f7ee104ee72a1c6");
assert.equal(cert.status,"EFFECTIVE");assert.equal(cert.effective,true);
assert.equal(policy.cutover_contract.dual_key_required,true);
assert.equal(policy.cutover_contract.registry_backed_current_crop_selection_required,true);
assert.equal(policy.cutover_contract.selected_current_crop_must_cover_planned_a0,true);
assert.equal(policy.cutover_contract.selected_current_crop_digest_must_match_registry_entry,true);
assert.equal(policy.cutover_contract.candidate_current_crop_artifact_forbidden,true);
assert.equal(policy.cutover_contract.twin_mode,"PRE_FORMAL_OWNER_STANDBY");
assert.equal(policy.cutover_contract.evidence_owner_activation_authorized,true);
assert.equal(policy.cutover_contract.twin_owner_activation_authorized,true);
assert.equal(policy.execution_host.github_actions_execution_forbidden,true);
assert.equal(policy.later_authority_ceiling.formal_v5_arm_authorized,false);
assert.equal(policy.later_authority_ceiling.a0_execution_authorized,false);
assert.equal(policy.later_authority_ceiling.o00_authorized,false);
assert.equal(a0.selection_policy.selected_budget_ms,timing.qualified_budget.selected_budget_ms);
assert.equal(a0.authority_ceiling.a0_execution_authorized,false);

const compose=read(composePath);
for(const marker of ["mcft_cap09_evidence_preformal_owner_runtime.js","mcft_cap09_twin_preformal_owner_runtime.js","GEOX_MCFT_CAP09_PRODUCTION_OWNER_CUTOVER_AUTHORITY_PATH"]) assert.ok(compose.includes(marker),marker);
for(const forbidden of ["FORMAL_WINDOW_MANIFEST","TWIN_RUNTIME_CROP_AUTHORITY_PATH","TWIN_RUNTIME_CONFIGURATION_MATRIX_PATH"]) assert.equal(compose.includes(forbidden),false,"PREFORMAL_COMPOSE_FORBIDDEN:"+forbidden);
const standby=read(standbyPath);
assert.ok(standby.includes("twin_runtime_lease_v1"));
for(const forbidden of ["twin_shadow_online_scheduler_cursor_v1","twin_shadow_online_scheduler_slot_v1","claimDueSlot","recordTerminalResult"]) assert.equal(standby.includes(forbidden),false,"PREFORMAL_STANDBY_SCHEDULER_EFFECT_FORBIDDEN:"+forbidden);
assert.ok(read(evidencePath).includes("readMcftCap09OwnerCutoverAuthorityV1"));
assert.ok(read(twinPath).includes("readMcftCap09OwnerCutoverAuthorityV1"));
const dist=read(distPath);
assert.ok(dist.includes("mcft_cap09_evidence_preformal_owner_runtime.js"));
assert.ok(dist.includes("mcft_cap09_twin_preformal_owner_runtime.js"));
const runner=read(runPath);
for(const marker of [
  "CUTOVER_GITHUB_ACTIONS_FORBIDDEN",
  "CUTOVER_HEAD_MUST_EQUAL_CURRENT_PROTECTED_MAIN",
  "CUTOVER_WORKTREE_MUST_BE_CLEAN",
  "selectCurrentCropForFormalA0",
  "CUTOVER_NO_EFFECTIVE_CURRENT_CROP_FOR_PLANNED_A0",
  "CUTOVER_SELECTED_CURRENT_CROP_DIGEST_MISMATCH",
  "LATEST_EFFECTIVE_AUTHORITY_AS_OF_NOT_AFTER_LOGICAL_TIME_WITHIN_VALIDITY_WINDOW",
  "VERIFY_MCFT_CAP_09_PRODUCTION_OWNER_LIVE_FENCED_LEASES_V1.cjs",
  "down",
  "--remove-orphans"
]) assert.ok(runner.includes(marker),marker);
assert.ok(runner.includes("current_crop_authority_ref:selectedCurrentCrop.ref"));
assert.ok(runner.includes("GEOX_MCFT_CAP09_PRODUCTION_CURRENT_CROP_AUTHORITY_PATH:selectedCurrentCrop.resolved"));
assert.equal(runner.includes("const CURRENT_CROP_REL="),false,"CUTOVER_FIXED_CURRENT_CROP_BINDING_FORBIDDEN");
assert.equal(runner.includes("formal_v5_arm_authorized:true"),false);
assert.equal(runner.includes("a0_authorized:true"),false);
assert.equal(runner.includes("o00_authorized:true"),false);

console.log(JSON.stringify({
  status:"PASS",
  registry_ref:registryPath,
  registry_entry_count:registry.entries.length,
  registry_selection_policy:registry.selection_policy,
  candidate_artifacts_admissible:false,
  rolling_refresh_effective_entry_present:true,
  stage_certificate_digest:digest(certPath),
  twin_preformal_scheduler_effect:false,
  dual_key_cutover:true,
  registry_backed_current_crop_selection:true,
  github_actions_production_execution:false,
  formal_v5_arm:false,
  a0_execution:false,
  o00_started:false
},null,2));
