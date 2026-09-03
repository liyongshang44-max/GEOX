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

const currentPath="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-EFFECTIVE-CURRENT-CROP-AUTHORITY-V1.json";
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

const crop=json(currentPath),cert=json(certPath),policy=json(policyPath),a0=json(a0Path),timing=json(timingPath);
assert.equal(digest(currentPath),"sha256:372163dc04c306b37d2874f77be3b4ba0a167ae8d6198ce6ecc1411f2d35f9fb");
assert.equal(digest(certPath),"sha256:acffd98b6e014db4d11a3374a50a2e576be3396aef33ed456f7ee104ee72a1c6");
assert.equal(crop.architecture_effective,true);assert.equal(crop.runtime_consumption_authorized,true);
assert.equal(cert.status,"EFFECTIVE");assert.equal(cert.effective,true);
assert.equal(policy.status,"AUTHORIZED_FOR_LOCAL_OPERATOR_MANAGED_DOCKER_CUTOVER");
assert.equal(policy.cutover_contract.dual_key_required,true);
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
for(const marker of ["CUTOVER_GITHUB_ACTIONS_FORBIDDEN","CUTOVER_HEAD_MUST_EQUAL_CURRENT_PROTECTED_MAIN","CUTOVER_WORKTREE_MUST_BE_CLEAN","VERIFY_MCFT_CAP_09_PRODUCTION_OWNER_LIVE_FENCED_LEASES_V1.cjs","down","--remove-orphans"]) assert.ok(runner.includes(marker),marker);
assert.equal(runner.includes("formal_v5_arm_authorized:true"),false);
assert.equal(runner.includes("a0_authorized:true"),false);
assert.equal(runner.includes("o00_authorized:true"),false);

console.log(JSON.stringify({
 status:"PASS",effective_current_crop_digest:digest(currentPath),stage_certificate_digest:digest(certPath),
 twin_preformal_scheduler_effect:false,dual_key_cutover:true,github_actions_production_execution:false,
 formal_v5_arm:false,a0_execution:false,o00_started:false
},null,2));
