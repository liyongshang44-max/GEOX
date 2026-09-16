#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const OWNER = path.join(ROOT, "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-OWNER-PROVISIONING-AUTHORITY-V1.json");
const HOST = path.join(ROOT, "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-NON-GITHUB-HOST-BINDING-AUTHORITY-V1.json");
const PRIVATE_STORE = path.join(ROOT, "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-EVIDENCE-RUNTIME-PRIVATE-STORE-BINDING-V1.json");
const HOST_ARM = path.join(ROOT, "scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_NON_GITHUB_HOST_BINDING_ARM_V1.json");
const OWNER_ARM = path.join(ROOT, "scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_OWNER_PROVISIONING_ARM_V1.json");
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_09_PRODUCTION_OWNER_PROVISIONING_PREFLIGHT_V1_RESULT.json");

const TARGET_DB = "geox_mcft_cap09_production_runtime_v1";
const HOST_ID = "fae5f756-ef25-40d5-9777-5b2c3d4837a1";
const HOST_PROOF_SUBJECT = "5be8293a03d7947a09fe8c8dc863c9965d26a74b";
const REMAT_SUBJECT = "3848376647bd0f7d6f93450644c9e3baed7b15cd";
const REMAT_RUN_ID = 35054759709;
const REMAT_ARTIFACT_ID = 10430112693;
const REMAT_ARTIFACT_DIGEST = "sha256:a0e55a96947d43437b3fb51443d9ccc0cf0838fc56cdcbcfe851e669fc30a0a9";
const REMAT_AUTHORITY_SHA256 = "sha256:a81ad681535cd2e30516449bd94486a7dfbc81f882898572400399dbc824fed3";

function j(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function digest(file) { return "sha256:" + crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(value, null, 2) + "\n");
  console.log(JSON.stringify(value, null, 2));
}

try {
  const subject = String(process.env.SUBJECT_SHA || "").trim();
  assert.match(subject, /^[0-9a-f]{40}$/, "PRE_OWNER_SUBJECT_SHA_REQUIRED");

  const owner = j(OWNER);
  const host = j(HOST);
  const store = j(PRIVATE_STORE);
  const hostArm = j(HOST_ARM);
  const ownerArm = j(OWNER_ARM);
  const remat = store.credential_rematerialization_evidence || {};
  const localProof = hostArm.local_machine_proof_evidence || {};

  assert.equal(owner.target_database?.status, "BOUND", "PRE_OWNER_TARGET_DATABASE_MUST_REMAIN_BOUND");
  assert.equal(owner.target_database?.database_name, TARGET_DB, "PRE_OWNER_TARGET_DATABASE_MISMATCH");
  assert.equal(owner.non_effects?.production_owner_activation, false, "PRE_OWNER_HISTORICAL_OWNER_ACTIVATION_FORBIDDEN");
  assert.equal(owner.non_effects?.runtime_process_start, false, "PRE_OWNER_HISTORICAL_RUNTIME_START_FORBIDDEN");
  assert.equal(owner.non_effects?.formal_v5_arm, false, "PRE_OWNER_HISTORICAL_FORMAL_ARM_FORBIDDEN");

  assert.equal(store.next_stage?.stage, "PRODUCTION_HOST_SECRET_BINDING_AND_PRE_OWNER_CUTOVER_READINESS", "PRE_OWNER_REMAT_NEXT_STAGE_REQUIRED");
  assert.equal(store.next_stage?.separate_explicit_operator_authorization_required, true, "PRE_OWNER_EXPLICIT_OPERATOR_AUTH_REQUIRED");
  assert.equal(digest(PRIVATE_STORE), REMAT_AUTHORITY_SHA256, "PRE_OWNER_REMAT_AUTHORITY_DIGEST_MISMATCH");
  assert.equal(remat.status, "PASS", "PRE_OWNER_REMAT_PASS_REQUIRED");
  assert.equal(remat.observed_subject_sha, REMAT_SUBJECT, "PRE_OWNER_REMAT_SUBJECT_REQUIRED");

  const db = remat.operational_database || {};
  assert.equal(db.database_name, TARGET_DB, "PRE_OWNER_REMAT_DATABASE_REQUIRED");
  assert.equal(db.public_table_count, 41, "PRE_OWNER_EXACT_41_TABLES_REQUIRED");
  assert.equal(db.runtime_routine_count, 3, "PRE_OWNER_EXACT_3_ROUTINES_REQUIRED");
  assert.equal(db.non_lease_table_count, 39, "PRE_OWNER_EXACT_39_NON_LEASE_TABLES_REQUIRED");
  assert.equal(db.non_lease_production_state_row_count, 0, "PRE_OWNER_NON_LEASE_STATE_MUST_BE_ZERO");
  assert.deepEqual(db.evidence_lease, { total: 1, live: 0, expired: 1 }, "PRE_OWNER_EVIDENCE_LEASE_RESIDUE_REQUIRED");
  assert.deepEqual(db.twin_lease, { total: 1, live: 0, expired: 1 }, "PRE_OWNER_TWIN_LEASE_RESIDUE_REQUIRED");

  const credentials = remat.database_credentials || {};
  assert.equal(credentials.login_principals_preserved, true, "PRE_OWNER_LOGIN_PRINCIPALS_PRESERVED_REQUIRED");
  assert.equal(credentials.login_role_recreation, false, "PRE_OWNER_LOGIN_RECREATION_FORBIDDEN");
  assert.equal(credentials.password_rotation_only, true, "PRE_OWNER_PASSWORD_ROTATION_ONLY_REQUIRED");
  assert.equal(credentials.exact_one_privilege_membership_each, true, "PRE_OWNER_EXACT_ONE_MEMBERSHIP_REQUIRED");
  assert.equal(credentials.cross_plane_membership, false, "PRE_OWNER_CROSS_PLANE_MEMBERSHIP_FORBIDDEN");
  assert.equal(credentials.evidence_password_authenticated_login, true, "PRE_OWNER_EVIDENCE_LOGIN_PROOF_REQUIRED");
  assert.equal(credentials.twin_password_authenticated_login, true, "PRE_OWNER_TWIN_LOGIN_PROOF_REQUIRED");
  assert.equal(credentials.role_specific_connectivity_proof, "PASS", "PRE_OWNER_ROLE_CONNECTIVITY_REQUIRED");

  const privateStore = remat.private_store || {};
  assert.equal(privateStore.physical_provider, "CLOUDFLARE_R2", "PRE_OWNER_R2_PROVIDER_REQUIRED");
  assert.equal(privateStore.bucket, "geox-mcft-cap09-evidence-runtime-v1", "PRE_OWNER_EVIDENCE_BUCKET_REQUIRED");
  assert.equal(privateStore.formal_raw_bucket, "geox-mcft-cap09-formal-raw-v1", "PRE_OWNER_FORMAL_BUCKET_REQUIRED");
  assert.equal(privateStore.bucket_distinct_from_formal_raw, true, "PRE_OWNER_BUCKET_SEPARATION_REQUIRED");
  assert.equal(privateStore.credential_separate_from_formal_raw, true, "PRE_OWNER_CREDENTIAL_SEPARATION_REQUIRED");
  assert.equal(privateStore.authenticated_put?.http_status, 200, "PRE_OWNER_R2_PUT_REQUIRED");
  assert.equal(privateStore.authenticated_head?.http_status, 200, "PRE_OWNER_R2_HEAD_REQUIRED");
  assert.equal(privateStore.authenticated_delete?.http_status, 204, "PRE_OWNER_R2_DELETE_REQUIRED");
  assert.equal(privateStore.post_delete_head?.http_status, 404, "PRE_OWNER_R2_POST_DELETE_REQUIRED");
  assert.equal(remat.canonicalization?.repository_secret_material_allowed, false, "PRE_OWNER_REPO_SECRET_FORBIDDEN");
  assert.equal(remat.canonicalization?.github_secret_materialized, false, "PRE_OWNER_GITHUB_SECRET_FALSE_REQUIRED");

  assert.equal(host.status, "LOCAL_OPERATOR_MANAGED_DOCKER_HOST_IDENTITIES_BOUND", "PRE_OWNER_LOCAL_HOST_BOUND_REQUIRED");
  assert.equal(host.github_actions?.production_execution_host_allowed, false, "PRE_OWNER_GITHUB_PRODUCTION_HOST_FORBIDDEN");
  assert.equal(host.local_operator_managed_host_contract?.host_id, HOST_ID, "PRE_OWNER_EXACT_LOCAL_HOST_REQUIRED");
  assert.equal(host.binding_state?.exact_two_runtime_service_identities_bound, true, "PRE_OWNER_EXACT_TWO_SERVICE_IDENTITIES_REQUIRED");
  assert.equal(host.local_operator_managed_host_contract?.runtime_start_authorized, false, "PRE_OWNER_RUNTIME_START_STILL_FORBIDDEN");
  assert.equal(host.local_operator_managed_host_contract?.production_owner_activation_authorized, false, "PRE_OWNER_OWNER_ACTIVATION_STILL_FORBIDDEN");

  assert.equal(hostArm.armed, false, "PRE_OWNER_HOST_ARM_MUST_REMAIN_FALSE");
  assert.equal(hostArm.runtime_secret_injection_authorized, true, "PRE_OWNER_HOST_SECRET_BINDING_AUTHORIZED_REQUIRED");
  assert.equal(hostArm.production_runtime_secret_injection_authorized, true, "PRE_OWNER_PRODUCTION_SECRET_BINDING_AUTHORIZED_REQUIRED");
  assert.equal(hostArm.runtime_secret_binding_scope, "LOCAL_PROCESS_ENV_BINDING_AND_READBACK_ONLY_NO_DEPLOY_NO_START", "PRE_OWNER_SECRET_BINDING_SCOPE_REQUIRED");
  assert.equal(hostArm.pre_owner_cutover_readiness_evaluation_authorized, true, "PRE_OWNER_READINESS_EVALUATION_AUTHORIZED_REQUIRED");
  for (const key of [
    "repository_secret_materialization_authorized", "github_secret_materialization_authorized", "database_write_authorized",
    "compose_build_authorized", "compose_create_authorized", "compose_up_authorized", "container_start_authorized",
    "owner_cutover_execution_authorized", "deployment_authorized", "runtime_process_start_authorized",
    "production_owner_activation_authorized", "formal_v5_arm_authorized", "a0_authorized", "o00_authorized",
  ]) assert.equal(hostArm[key], false, "PRE_OWNER_LATER_EFFECT_OR_SECRET_PERSISTENCE_FORBIDDEN:" + key);
  assert.equal(hostArm.database_readback_authorized, true, "PRE_OWNER_DB_READBACK_AUTHORIZED_REQUIRED");
  assert.equal(hostArm.r2_transient_capability_probe_authorized, true, "PRE_OWNER_R2_PROBE_AUTHORIZED_REQUIRED");
  assert.equal(hostArm.compose_render_only_authorized, true, "PRE_OWNER_COMPOSE_RENDER_AUTHORIZED_REQUIRED");

  assert.equal(localProof.schema_version, "geox_mcft_cap09_production_host_secret_binding_pre_owner_readiness_v1", "PRE_OWNER_LOCAL_PROOF_SCHEMA_REQUIRED");
  assert.equal(localProof.status, "PASS", "PRE_OWNER_LOCAL_PROOF_PASS_REQUIRED");
  assert.equal(localProof.stage, "PRODUCTION_HOST_SECRET_BINDING_PROVEN_PRE_OWNER_CUTOVER_READY", "PRE_OWNER_LOCAL_PROOF_STAGE_REQUIRED");
  assert.equal(localProof.observed_subject_sha, HOST_PROOF_SUBJECT, "PRE_OWNER_LOCAL_PROOF_SUBJECT_REQUIRED");
  assert.equal(localProof.local_host_id, HOST_ID, "PRE_OWNER_LOCAL_PROOF_HOST_REQUIRED");
  assert.equal(localProof.exact_two_runtime_service_identities_bound, true, "PRE_OWNER_LOCAL_PROOF_SERVICE_IDENTITIES_REQUIRED");
  assert.equal(localProof.runtime_secret_binding_count, 7, "PRE_OWNER_LOCAL_PROOF_EXACT_SECRET_COUNT_REQUIRED");
  assert.equal(localProof.repository_secret_materialized, false, "PRE_OWNER_LOCAL_PROOF_REPO_SECRET_FORBIDDEN");
  assert.equal(localProof.github_secret_materialized, false, "PRE_OWNER_LOCAL_PROOF_GITHUB_SECRET_FORBIDDEN");
  assert.equal(localProof.evidence_database_connectivity_proven, true, "PRE_OWNER_LOCAL_PROOF_EVIDENCE_DB_REQUIRED");
  assert.equal(localProof.twin_database_connectivity_proven, true, "PRE_OWNER_LOCAL_PROOF_TWIN_DB_REQUIRED");
  assert.equal(localProof.exact_one_privilege_membership_each_proven_by_current_credentials, true, "PRE_OWNER_LOCAL_PROOF_MEMBERSHIP_REQUIRED");
  assert.equal(localProof.cross_plane_privilege_forbidden_proven, true, "PRE_OWNER_LOCAL_PROOF_CROSS_PLANE_REQUIRED");
  assert.equal(localProof.r2_bucket, "geox-mcft-cap09-evidence-runtime-v1", "PRE_OWNER_LOCAL_PROOF_R2_BUCKET_REQUIRED");
  assert.equal(localProof.r2_formal_bucket_reused, false, "PRE_OWNER_LOCAL_PROOF_FORMAL_BUCKET_REUSE_FORBIDDEN");
  assert.equal(localProof.r2_put_status, 200, "PRE_OWNER_LOCAL_PROOF_R2_PUT_REQUIRED");
  assert.equal(localProof.r2_head_status, 200, "PRE_OWNER_LOCAL_PROOF_R2_HEAD_REQUIRED");
  assert.equal(localProof.r2_delete_status, 204, "PRE_OWNER_LOCAL_PROOF_R2_DELETE_REQUIRED");
  assert.equal(localProof.r2_post_delete_head_status, 404, "PRE_OWNER_LOCAL_PROOF_R2_POST_DELETE_REQUIRED");
  assert.equal(localProof.compose_render_only_pass, true, "PRE_OWNER_LOCAL_PROOF_COMPOSE_RENDER_REQUIRED");
  assert.equal(localProof.production_container_count_before, 0, "PRE_OWNER_LOCAL_PROOF_PRE_CONTAINER_ZERO_REQUIRED");
  assert.equal(localProof.production_container_count_after, 0, "PRE_OWNER_LOCAL_PROOF_POST_CONTAINER_ZERO_REQUIRED");
  assert.equal(localProof.pre_owner_cutover_ready, true, "PRE_OWNER_LOCAL_PROOF_READY_REQUIRED");
  assert.deepEqual(localProof.remaining_blockers, ["PRODUCTION_RUNTIME_START_AUTHORITY_NOT_ARMED"], "PRE_OWNER_LOCAL_PROOF_EXACT_BLOCKER_REQUIRED");
  assert.equal(localProof.canonical_rematerialization?.run_id, REMAT_RUN_ID, "PRE_OWNER_LOCAL_PROOF_REMAT_RUN_REQUIRED");
  assert.equal(localProof.canonical_rematerialization?.artifact_id, REMAT_ARTIFACT_ID, "PRE_OWNER_LOCAL_PROOF_REMAT_ARTIFACT_REQUIRED");
  assert.equal(localProof.canonical_rematerialization?.artifact_digest, REMAT_ARTIFACT_DIGEST, "PRE_OWNER_LOCAL_PROOF_REMAT_DIGEST_REQUIRED");
  assert.equal(localProof.canonical_rematerialization?.authority_sha256, REMAT_AUTHORITY_SHA256, "PRE_OWNER_LOCAL_PROOF_REMAT_AUTHORITY_REQUIRED");
  for (const key of ["database_write", "compose_build", "compose_create", "compose_up", "runtime_process_start", "production_owner_activation", "formal_v5_arm", "a0_bootstrap", "o00_started", "secret_values_recorded"]) {
    assert.equal(localProof[key], false, "PRE_OWNER_LOCAL_PROOF_HARD_NON_EFFECT:" + key);
  }

  assert.equal(ownerArm.armed, false, "PRE_OWNER_OWNER_ARM_MUST_REMAIN_FALSE");
  assert.equal(ownerArm.runtime_process_start_authorized, false, "PRE_OWNER_OWNER_ARM_RUNTIME_FALSE");
  assert.equal(ownerArm.production_owner_activation_authorized, false, "PRE_OWNER_OWNER_ARM_ACTIVATION_FALSE");
  assert.equal(ownerArm.formal_v5_arm_authorized, false, "PRE_OWNER_OWNER_ARM_FORMAL_FALSE");

  write({
    schema_version: "geox_mcft_cap09_production_owner_provisioning_preflight_v3",
    status: "PASS",
    stage: "PRODUCTION_HOST_SECRET_BINDING_PROVEN_PRE_OWNER_CUTOVER_READY",
    subject_sha: subject,
    target_database_name: TARGET_DB,
    residue_aware_current_state: true,
    historical_all_table_zero_readiness_reused: false,
    production_host_table_count: 41,
    runtime_routine_count: 3,
    non_lease_table_count: 39,
    non_lease_production_state_row_count: 0,
    evidence_lease: db.evidence_lease,
    twin_lease: db.twin_lease,
    exact_one_privilege_membership_each: true,
    cross_plane_membership: false,
    local_host_id: HOST_ID,
    exact_two_runtime_service_identities_bound: true,
    production_host_secret_binding_authorized: true,
    production_host_secret_binding_machine_proof_observed: true,
    production_host_secret_binding_proof_subject_sha: HOST_PROOF_SUBJECT,
    pre_owner_cutover_ready: true,
    remaining_blockers: ["PRODUCTION_RUNTIME_START_AUTHORITY_NOT_ARMED"],
    canonical_rematerialization: {
      subject_sha: REMAT_SUBJECT,
      run_id: REMAT_RUN_ID,
      artifact_id: REMAT_ARTIFACT_ID,
      artifact_digest: REMAT_ARTIFACT_DIGEST,
      authority_sha256: REMAT_AUTHORITY_SHA256
    },
    repository_secret_materialized: false,
    github_secret_materialized: false,
    database_write: false,
    compose_build: false,
    compose_create: false,
    compose_up: false,
    runtime_process_start: false,
    production_owner_activation: false,
    formal_v5_arm: false,
    a0_bootstrap: false,
    o00_started: false
  });
} catch (error) {
  write({
    schema_version: "geox_mcft_cap09_production_owner_provisioning_preflight_v3",
    status: "FAIL",
    error: error instanceof Error ? error.message : String(error),
    runtime_process_start: false,
    production_owner_activation: false,
    formal_v5_arm: false,
    a0_bootstrap: false,
    o00_started: false
  });
  process.exitCode = 1;
}
