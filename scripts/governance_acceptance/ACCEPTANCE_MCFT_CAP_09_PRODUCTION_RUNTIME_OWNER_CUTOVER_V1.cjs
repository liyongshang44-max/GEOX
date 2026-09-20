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
function section(source,start,end){
  const a=source.indexOf(start); const b=source.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,"CUTOVER_SOURCE_SECTION_REQUIRED:"+start);
  return source.slice(a,b);
}

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
for(const marker of [
  "mcft_cap09_evidence_preformal_owner_runtime.js",
  "mcft_cap09_twin_preformal_owner_runtime.js",
  "GEOX_MCFT_CAP09_PRODUCTION_OWNER_CUTOVER_AUTHORITY_PATH",
  "GEOX_MCFT_CAP09_FORMAL_V5_EVIDENCE_RUNTIME_HANDOFF_AUTHORITY_PATH",
  "formal-v5-evidence-runtime-handoff-authority.json",
  "GEOX_MCFT_CAP09_PREFORMAL_MODE",
  "OWNER_CUTOVER",
  "MCFT_CAP_09_PRODUCTION_OWNER_CUTOVER_ARM_V1.json"
]) assert.ok(compose.includes(marker),marker);
for(const forbidden of ["FORMAL_WINDOW_MANIFEST","TWIN_RUNTIME_CROP_AUTHORITY_PATH","TWIN_RUNTIME_CONFIGURATION_MATRIX_PATH"]) assert.equal(compose.includes(forbidden),false,"PREFORMAL_COMPOSE_FORBIDDEN:"+forbidden);
const standby=read(standbyPath);
assert.ok(standby.includes("twin_runtime_lease_v1"));
for(const forbidden of ["twin_shadow_online_scheduler_cursor_v1","twin_shadow_online_scheduler_slot_v1","claimDueSlot","recordTerminalResult"]) assert.equal(standby.includes(forbidden),false,"PREFORMAL_STANDBY_SCHEDULER_EFFECT_FORBIDDEN:"+forbidden);

const evidenceSource=read(evidencePath);
const twinSource=read(twinPath);
assert.ok(evidenceSource.includes("readMcftCap09OwnerCutoverAuthorityV1"));
assert.ok(evidenceSource.includes("loadMcftCap09FormalV5EvidenceRuntimeHandoffAuthorityV1"));
assert.ok(evidenceSource.includes("runtime_start_authority:handoffRuntimeStart"));
assert.ok(twinSource.includes("readMcftCap09OwnerCutoverAuthorityV1"));
assert.ok(evidenceSource.includes('const EVIDENCE_LEASE_TABLE = "external_evidence_producer_lease_v1"'));
assert.ok(twinSource.includes('const TWIN_LEASE_TABLE = "twin_runtime_lease_v1"'));
assert.ok(evidenceSource.includes("if(mode()===NON_OWNER_STANDBY_MODE)"));
assert.ok(twinSource.includes("if(mode()===NON_OWNER_STANDBY_MODE)"));
const evidenceNonOwner=section(
  evidenceSource,
  "export async function runMcftCap09EvidenceNonOwnerStandbyV1",
  "export async function runMcftCap09EvidencePreFormalOwnerRuntimeV1"
);
for(const required of [
  "assertMcftCap09ServicePrincipalV1",
  "EVIDENCE_LEASE_TABLE",
  "SELECT count(*)::int AS n",
  "headObject",
  "evidence_producer_lease_claimed:false",
  "production_evidence_write:false",
  "r2_write:false"
]) assert.ok(evidenceNonOwner.includes(required),"EVIDENCE_NON_OWNER_REQUIRED:"+required);
for(const forbidden of [
  "runMcftCap09ProductionEvidenceRuntimeV1",
  "lease_owner",
  "INSERT INTO",
  "UPDATE ",
  "DELETE FROM"
]) assert.equal(evidenceNonOwner.includes(forbidden),false,"EVIDENCE_NON_OWNER_EFFECT_FORBIDDEN:"+forbidden);

const twinNonOwner=section(
  twinSource,
  "export async function runMcftCap09TwinNonOwnerStandbyV1",
  "export async function runMcftCap09TwinPreFormalOwnerRuntimeV1"
);
for(const required of [
  "assertMcftCap09ServicePrincipalV1",
  "loadMcftCap09ProductionStageAuthorityMountsV1",
  "TWIN_LEASE_TABLE",
  "SELECT count(*)::int AS n",
  "twin_scheduler_lease_claimed:false",
  "scheduler_cursor_mutation:false",
  "scheduler_slot_mutation:false",
  "formal_runner_started:false"
]) assert.ok(twinNonOwner.includes(required),"TWIN_NON_OWNER_REQUIRED:"+required);
for(const forbidden of [
  "runMcftCap09TwinPreFormalOwnerStandbyV1",
  "buildMcftCap09ProductionLeaseOwnerV1",
  "INSERT INTO",
  "UPDATE ",
  "DELETE FROM"
]) assert.equal(twinNonOwner.includes(forbidden),false,"TWIN_NON_OWNER_EFFECT_FORBIDDEN:"+forbidden);

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
  "selectFormalV5EpochClockV1",
  'status:"AUTHORIZED",armed:true',
  "formal_v5_arm_match_required:true",
  "stage_authority_required_for_evidence_acquisition:false",
  "formal-v5-evidence-runtime-handoff-authority.json",
  "down",
  "--remove-orphans"
]) assert.ok(runner.includes(marker),marker);
const serializedSharedImageBuild='exec("docker",["compose","-f",COMPOSE_REL,"build","geox-mcft-cap09-evidence-runtime-v1"],{env});';
const dualServiceNoBuildStart='exec("docker",["compose","-f",COMPOSE_REL,"up","-d","--no-build","geox-mcft-cap09-evidence-runtime-v1","geox-mcft-cap09-twin-runtime-v1"],{env});';
const exactSubjectAttestation='exec(process.execPath,[VERIFY_REL,"--attest-image"],{env});';
assert.ok(runner.includes(serializedSharedImageBuild),"CUTOVER_SHARED_RUNTIME_IMAGE_SINGLE_BUILD_REQUIRED");
assert.ok(runner.includes(dualServiceNoBuildStart),"CUTOVER_DUAL_SERVICE_NO_BUILD_START_REQUIRED");
assert.ok(runner.includes(exactSubjectAttestation),"CUTOVER_EXACT_SUBJECT_IMAGE_ATTESTATION_REQUIRED");
assert.ok(runner.indexOf(serializedSharedImageBuild)<runner.indexOf(exactSubjectAttestation),"CUTOVER_ATTESTATION_MUST_FOLLOW_BUILD");
assert.ok(runner.indexOf(exactSubjectAttestation)<runner.indexOf(dualServiceNoBuildStart),"CUTOVER_ATTESTATION_MUST_PRECEDE_RUNTIME_START");
assert.ok(runner.includes("GEOX_MCFT_CAP09_PRODUCTION_RUNTIME_ARTIFACT_ATTESTATION_PATH:artifactAttestationPath"),"CUTOVER_ARTIFACT_ATTESTATION_PATH_BINDING_REQUIRED");
assert.ok(runner.includes("GEOX_MCFT_CAP09_LOCAL_HOST_ID_PATH:HOST_ID_FILE"),"CUTOVER_LOCAL_HOST_ID_PATH_BINDING_REQUIRED");
assert.ok(runner.includes("GEOX_MCFT_CAP09_RUNTIME_IMAGE_TAG:`geox-mcft-cap09-runtime:${head}`"),"CUTOVER_RUNTIME_IMAGE_TAG_BINDING_REQUIRED");
const cutoverEnvSection=section(
  runner,
  "const env={...process.env,",
  "fs.mkdirSync(path.join(env.GEOX_MCFT_CAP09_DURABLE_LOG_ROOT"
);
assert.ok(cutoverEnvSection.includes('GEOX_MCFT_CAP09_PREFORMAL_MODE:"OWNER_CUTOVER"'),"CUTOVER_PREFORMAL_MODE_EXPLICIT_PIN_REQUIRED");
assert.ok(cutoverEnvSection.includes("GEOX_MCFT_CAP09_FORMAL_V5_EVIDENCE_RUNTIME_HANDOFF_AUTHORITY_PATH:formalV5EvidenceHandoffPath"),"CUTOVER_FORMAL_V5_EVIDENCE_HANDOFF_PATH_BINDING_REQUIRED");
assert.equal((cutoverEnvSection.match(/GEOX_MCFT_CAP09_PREFORMAL_MODE/g)||[]).length,1,"CUTOVER_PREFORMAL_MODE_SINGLE_PIN_REQUIRED");
assert.ok(runner.includes("timeout:options.timeoutMs"),"CUTOVER_EXEC_TIMEOUT_FORWARDING_REQUIRED");
assert.ok(runner.includes("timeoutMs:remainingMs"),"CUTOVER_OWNER_VERIFIER_OUTER_DEADLINE_REQUIRED");
assert.equal(runner.includes('"--build"'),false,"CUTOVER_PARALLEL_SHARED_IMAGE_BUILD_FORBIDDEN");
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
  runtime_start_non_owner_standby_seam:true,
  evidence_non_owner_standby_lease_claim:false,
  twin_non_owner_standby_lease_claim:false,
  twin_preformal_scheduler_effect:false,
  shared_runtime_image_build_serialized:true,
  dual_service_start_uses_no_build:true,
  owner_cutover_mode_explicitly_pinned:true,
  exact_subject_image_attestation_before_runtime_start:true,
  formal_v5_evidence_epoch_candidate_preprovisioned_pre_arm:true,
  formal_v5_evidence_epoch_candidate_requires_arm_match:true,
  evidence_epoch_candidate_does_not_authorize_a0:true,
  dual_key_cutover:true,
  registry_backed_current_crop_selection:true,
  github_actions_production_execution:false,
  formal_v5_arm:false,
  a0_execution:false,
  o00_started:false
},null,2));