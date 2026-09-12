#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const OWNER_AUTH = path.join(ROOT,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-OWNER-GRADUATION-GATE-V1.json");
const HOST_AUTH = path.join(ROOT,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-NON-GITHUB-HOST-BINDING-AUTHORITY-V1.json");
const TIMING_AUTH = path.join(ROOT,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-FORCING-ACQUISITION-BUDGET-AUTHORITY-V1.json");
const ARM = path.join(ROOT,"scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_OWNER_CUTOVER_ARM_V1.json");
const RUNTIME_START_ARM = path.join(ROOT,"scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_RUNTIME_START_ARM_V1.json");
const RUNTIME_START_BUILDER = path.join(ROOT,"scripts/runtime_acceptance/BUILD_MCFT_CAP_09_PRODUCTION_RUNTIME_START_AUTHORITY_V1.cjs");
const EVIDENCE_PROCESS = path.join(ROOT,"apps/server/src/external_evidence/mcft_cap09_evidence_runtime_process_v1.ts");
const TWIN_PROCESS = path.join(ROOT,"apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v1.ts");
const SERVICE_IDENTITY = path.join(ROOT,"apps/server/src/runtime/mcft_cap09_production_service_identity_v1.ts");
const LAUNCHER = path.join(ROOT,"docker-compose.mcft-cap09-production.yml");
const LIVE_VERIFIER = path.join(ROOT,"scripts/runtime_acceptance/VERIFY_MCFT_CAP_09_PRODUCTION_OWNER_LIVE_FENCED_LEASES_V1.cjs");
const PRINCIPALS = path.join(ROOT,"apps/server/src/infra/mcft_cap09_phase5_service_principal_v1.ts");
const OUT = path.join(ROOT,"acceptance-output/MCFT_CAP_09_PRODUCTION_OWNER_GRADUATION_PREFLIGHT_V1_RESULT.json");

function req(ok,code){if(!ok)throw new Error(code);}
function j(p){return JSON.parse(fs.readFileSync(p,"utf8"));}
function t(p){return fs.readFileSync(p,"utf8");}
function write(v){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(v,null,2)+"\n");console.log(JSON.stringify(v,null,2));}

try{
  const owner=j(OWNER_AUTH),host=j(HOST_AUTH),timing=j(TIMING_AUTH),arm=j(ARM),runtimeStartArm=j(RUNTIME_START_ARM);
  const runtimeStartBuilder=t(RUNTIME_START_BUILDER),evidence=t(EVIDENCE_PROCESS),twin=t(TWIN_PROCESS),serviceIdentity=t(SERVICE_IDENTITY),launcher=t(LAUNCHER),liveVerifier=t(LIVE_VERIFIER),principals=t(PRINCIPALS);

  req(owner.schema_version==="geox_mcft_cap09_production_owner_graduation_gate_v1","OWNER_GATE_SCHEMA_REQUIRED");
  req(owner.status==="READ_ONLY_LIVE_OWNER_ADJUDICATION_IMPLEMENTED_RUNTIME_START_SEPARATE","OWNER_GATE_READ_ONLY_ADJUDICATION_STATUS_REQUIRED");
  req(owner.non_github_hosting_binding?.status==="ESTABLISHED_LOCAL_OPERATOR_MANAGED_DOCKER","OWNER_NON_GITHUB_HOSTING_BINDING_MUST_BE_ESTABLISHED");
  req(owner.non_github_hosting_binding?.exact_two_runtime_service_identities_bound===true,"OWNER_EXACT_TWO_HOST_IDENTITIES_REQUIRED");
  req(owner.identity_semantics?.login_role_presence_is_effective_owner_proof===false,"OWNER_LOGIN_MUST_NOT_EQUAL_EFFECTIVE_OWNER");
  req(owner.identity_semantics?.effective_owner_requires_non_github_host_binding_and_live_fenced_lease===true,"OWNER_LIVE_FENCED_LEASE_REQUIRED");
  req(owner.implementation?.read_only_live_adjudication_only===true&&owner.implementation?.github_actions_runtime_start_allowed===false&&owner.implementation?.github_actions_owner_activation_allowed===false,"OWNER_GITHUB_READ_ONLY_BOUNDARY_REQUIRED");

  req(host.schema_version==="geox_mcft_cap09_production_non_github_host_binding_authority_v1","OWNER_HOST_BINDING_SCHEMA_REQUIRED");
  req(host.status==="LOCAL_OPERATOR_MANAGED_DOCKER_HOST_IDENTITIES_BOUND","OWNER_HOST_BINDING_STATUS_REQUIRED");
  req(host.binding_state?.exact_two_runtime_service_identities_bound===true&&host.binding_state?.binding_authorized===true,"OWNER_HOST_BINDING_EXACT_TWO_REQUIRED");
  req(host.github_actions?.production_execution_host_allowed===false,"OWNER_GITHUB_PRODUCTION_HOST_FORBIDDEN");
  req(host.non_effects?.runtime_process_start===false&&host.non_effects?.production_owner_activation===false,"OWNER_HOST_BINDING_MUST_REMAIN_NON_ACTIVATING");

  req(timing.status==="QUALIFIED_AND_FROZEN_FROM_EXACT_HEAD_REAL_TIMING_AND_CONTROLLED_DELAY","OWNER_GATE_REQUIRES_FROZEN_TIMING");
  req(timing.timing_budget_qualified===true&&timing.timing_budget_frozen===true,"OWNER_GATE_REQUIRES_QUALIFIED_FROZEN_BUDGET");
  req(Number.isSafeInteger(timing.qualified_budget?.selected_budget_ms)&&timing.qualified_budget.selected_budget_ms>0,"OWNER_GATE_TIMING_BUDGET_REQUIRED");

  req(arm.schema_version==="geox_mcft_cap09_production_owner_cutover_arm_v1"&&arm.armed===false,"OWNER_LEGACY_CUTOVER_ARM_MUST_REMAIN_UNARMED");
  for(const key of ["evidence_owner_activation_authorized","twin_owner_activation_authorized","production_login_provisioning_authorized","non_github_hosting_binding_authorized","formal_v5_arm_authorized","a0_authorized","o00_authorized"])req(arm[key]===false,"OWNER_LATER_AUTHORITY_MUST_BE_FALSE:"+key);
  req(runtimeStartArm.schema_version==="geox_mcft_cap09_production_runtime_start_arm_v1"&&runtimeStartArm.armed===false&&runtimeStartArm.execution_requested===false&&runtimeStartArm.runtime_process_start_authorized===false&&runtimeStartArm.production_owner_activation_authorized===false&&runtimeStartArm.formal_v5_arm_authorized===false&&runtimeStartArm.a0_authorized===false&&runtimeStartArm.o00_authorized===false,"OWNER_RUNTIME_START_ARM_MUST_REMAIN_UNARMED");
  for(const marker of ["RUNTIME_START_EXACT_DEPLOYMENT_SUBJECT_MISMATCH","live_activation_authority_sha256","formal_a0_authority_sha256",'code + "_SHA256_MISMATCH"',"production_owner_activation_authorized","formal_v5_arm_authorized"])req(runtimeStartBuilder.includes(marker),"OWNER_RUNTIME_START_BUILDER_BOUNDARY_REQUIRED:"+marker);

  req(evidence.includes("GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_SERVICE_ID"),"EVIDENCE_PRODUCTION_SERVICE_ID_BINDING_REQUIRED");
  req(twin.includes("GEOX_MCFT_CAP09_TWIN_RUNTIME_SERVICE_ID"),"TWIN_PRODUCTION_SERVICE_ID_BINDING_REQUIRED");
  req(evidence.includes("GEOX_MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_PATH")&&twin.includes("GEOX_MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_PATH"),"OWNER_SEPARATE_RUNTIME_START_FILE_BINDING_REQUIRED");
  req(serviceIdentity.includes("#instance:"),"OWNER_PER_INSTANCE_FENCING_IDENTITY_REQUIRED");
  req(launcher.includes("name: geox-mcft-cap09-production-v1")&&launcher.includes("restart: unless-stopped")&&launcher.includes("mcft_cap09_evidence_runtime.js")&&launcher.includes("mcft_cap09_twin_runtime_v2.js"),"OWNER_PRODUCTION_TWO_SERVICE_LAUNCHER_REQUIRED");
  req(!launcher.includes("exec node apps/server/dist/runtime/mcft_cap09_twin_runtime.js"),"OWNER_STALE_TWIN_V1_ENTRYPOINT_FORBIDDEN");

  for(const marker of [
    'mode==="--attest-image"',
    'mode==="--selftest"',
    'mode==="--live"',
    'exec("git",["rev-parse","HEAD"]',
    'exec("git",["rev-parse","HEAD^{tree}"]',
    'exec("git",["status","--porcelain"',
    'exec("docker",["image","inspect"',
    'exec("docker",["inspect"',
    "OWNER_CONTAINER_HOSTNAME_LEASE_INSTANCE_MISMATCH",
    "OWNER_CONTAINER_IMAGE_ID_MISMATCH",
    "OWNER_MUTABLE_TAG_IMAGE_ID_MISMATCH",
    "OWNER_HOST_IDENTITY_MISMATCH",
    "OWNER_RENEWAL_HEARTBEAT_MUST_ADVANCE",
    "OWNER_RENEWAL_EXPIRY_MUST_ADVANCE",
    "OWNER_CURRENT_STRUCTURED_HEALTH_EVENT_REQUIRED",
    "manual_db_row_alone_rejected:true",
    "PRODUCTION_OWNER_PROVENANCE_PROOF_BOUNDARY_REPAIR_QUALIFIED",
    "wrong_docker_image_id",
    "missing_container",
    "stopped_container",
    "wrong_container_hostname",
    "wrong_service_container_correlation",
    "wrong_host_identity",
    "db_row_only",
    "expired_lease",
    "two_db_owners",
    "wrong_image_otherwise_valid_lease",
    "container_exists_no_live_lease",
    "static_row_no_renewal"
  ])req(liveVerifier.includes(marker),"OWNER_PROVENANCE_VERIFIER_MARKER_REQUIRED:"+marker);
  req(liveVerifier.includes("external_evidence_producer_lease_v1")&&liveVerifier.includes("twin_runtime_lease_v1")&&liveVerifier.includes("SELECT")&&!/\b(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+)?(?:public\.)?(?:external_evidence_producer_lease_v1|twin_runtime_lease_v1)/i.test(liveVerifier),"OWNER_LIVE_VERIFIER_PRODUCTION_LEASE_WRITE_FORBIDDEN");

  for(const marker of ["geox_mcft_cap09_evidence_runtime_login_v1","geox_mcft_cap09_twin_runtime_login_v1","geox_mcft_cap09_evidence_runtime_v1","geox_mcft_cap09_twin_runtime_v1"])req(principals.includes(marker),"OWNER_SERVICE_PRINCIPAL_MARKER_REQUIRED:"+marker);

  write({
    schema_version:"geox_mcft_cap09_production_owner_graduation_preflight_v2",
    status:"PASS",
    gate_status:"PROVENANCE_BOUNDARY_STATICALLY_READY_LIVE_OWNER_STILL_SEPARATE",
    timing_budget_frozen:true,
    selected_budget_ms:timing.qualified_budget.selected_budget_ms,
    legacy_cutover_arm:false,
    non_github_hosting_binding_established:true,
    exact_two_runtime_service_identities_bound:true,
    production_two_service_launcher_present:true,
    owner_graduation_v2_entrypoint_alignment:true,
    runtime_start_arm_unarmed:true,
    runtime_start_exact_subject_and_provenance_builder_present:true,
    separate_runtime_start_authority_bound_at_entrypoints:true,
    immutable_image_attestation_boundary_present:true,
    container_process_host_correlation_present:true,
    database_lease_alone_is_not_owner_proof:true,
    renewal_t1_t2_contract_present:true,
    structured_health_readiness_predicate_present:true,
    isolated_negative_matrix_present:true,
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
  write({status:"FAIL",error:error instanceof Error?error.message:String(error),production_runtime_mutation:false,production_login_creation:false,production_owner_activation:false,provider_request_count:0,formal_v5_arm:false,formal_v5_mutation:false,a0_bootstrap:false,o00_started:false,mcft_cap09_completed:false});
  process.exitCode=1;
}
