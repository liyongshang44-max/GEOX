#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const cp = require("node:child_process");
const crypto = require("node:crypto");

const SUCCESSOR_BASE = "3848376647bd0f7d6f93450644c9e3baed7b15cd";
const ORIGINAL_BINDING_BASE = "9360c2cd06961688fd192803c7006a29fc9bca4e";

const AUTH = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-EVIDENCE-RUNTIME-PRIVATE-STORE-BINDING-V1.json";
const ACCEPT = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_PRODUCTION_EVIDENCE_RUNTIME_PRIVATE_STORE_BINDING_V1.cjs";
const WORKFLOW = ".github/workflows/mcft-cap-09-production-evidence-runtime-private-store-binding-v1.yml";
const RUNTIME = "apps/server/src/external_evidence/mcft_cap09_evidence_runtime_process_v1.ts";
const FORMAL = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5C2A-FORMAL-RAW-STORE-BINDING-CONTRACT-V1.json";
const QCP = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const QCP_WORKFLOW = ".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml";
const OUT = "acceptance-output/MCFT_CAP_09_PRODUCTION_EVIDENCE_RUNTIME_PRIVATE_STORE_BINDING_V1_RESULT.json";
const QCP_RESOLVER_ID = "PRODUCTION_EVIDENCE_RUNTIME_PRIVATE_STORE_BINDING_V1";
const QCP_CHECK_ID = "PRODUCTION_EVIDENCE_RUNTIME_PRIVATE_STORE_BINDING";
const SUCCESSOR_CHANGED_FILES = [AUTH, ACCEPT, WORKFLOW].sort();

const EVIDENCE_SECRETS = [
  "GEOX_MCFT_CAP09_EVIDENCE_S3_ENDPOINT",
  "GEOX_MCFT_CAP09_EVIDENCE_S3_BUCKET",
  "GEOX_MCFT_CAP09_EVIDENCE_S3_REGION",
  "GEOX_MCFT_CAP09_EVIDENCE_S3_ACCESS_KEY_ID",
  "GEOX_MCFT_CAP09_EVIDENCE_S3_SECRET_ACCESS_KEY"
];
const FORMAL_SECRETS = [
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_ENDPOINT",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_BUCKET",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_REGION",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_ACCESS_KEY_ID",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY"
];

function fail(code) { throw new Error(code); }
function eq(actual, expected, code) {
  if (actual !== expected) fail(`${code}:expected=${JSON.stringify(expected)}:actual=${JSON.stringify(actual)}`);
}
function truthy(v, code) { eq(v, true, code); }
function falsy(v, code) { eq(v, false, code); }
function sameArray(actual, expected, code) { eq(JSON.stringify(actual), JSON.stringify(expected), code); }
function git(...args) { return cp.execFileSync("git", args, { encoding: "utf8" }).trim(); }
function blob(ref, file) { return git("rev-parse", `${ref}:${file}`); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function sha256(file) { return "sha256:" + crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }

function validateAuthority(authority) {
  eq(authority.schema_version, "geox_mcft_cap09_production_evidence_runtime_private_store_binding_v1", "STORE_BINDING_SCHEMA");
  eq(authority.authority_id, "GEOX-MCFT-CAP-09-PRODUCTION-EVIDENCE-RUNTIME-PRIVATE-STORE-BINDING-V1", "STORE_BINDING_AUTHORITY_ID");
  eq(authority.base_main_sha, ORIGINAL_BINDING_BASE, "STORE_BINDING_ORIGINAL_BASE");
  eq(authority.record_status, "NON_SECRET_BINDING_IDENTITY_DEFINED_MATERIALIZATION_SUCCESSOR_EVIDENCE_ATTACHED", "STORE_BINDING_RECORD_STATUS");

  eq(authority.runtime_contract?.process_ref, RUNTIME, "STORE_BINDING_RUNTIME_REF");
  eq(authority.runtime_contract?.raw_storage_authority, "EVIDENCE_RUNTIME_S3_CREDENTIALS_ONLY", "STORE_BINDING_RUNTIME_AUTHORITY");
  eq(authority.runtime_contract?.database_principal, "geox_mcft_cap09_evidence_runtime_login_v1", "STORE_BINDING_DATABASE_PRINCIPAL");

  const binding = authority.binding_identity || {};
  eq(binding.provider_contract, "S3_COMPATIBLE_PRIVATE_OBJECT_STORE", "STORE_BINDING_PROVIDER_CONTRACT");
  eq(binding.physical_provider, "CLOUDFLARE_R2", "STORE_BINDING_PROVIDER");
  eq(binding.physical_provider_selection_status, "EXPLICIT_INFRASTRUCTURE_ADJUDICATION_MATERIALIZED", "STORE_BINDING_PROVIDER_STATUS");
  truthy(binding.same_r2_account_as_formal_raw_allowed, "STORE_BINDING_SAME_ACCOUNT_ALLOWED");
  eq(binding.bucket, "geox-mcft-cap09-evidence-runtime-v1", "STORE_BINDING_BUCKET");
  eq(binding.formal_raw_bucket, "geox-mcft-cap09-formal-raw-v1", "STORE_BINDING_FORMAL_BUCKET");
  truthy(binding.bucket_must_be_separate_from_formal_raw, "STORE_BINDING_SEPARATE_BUCKET_REQUIRED");
  falsy(binding.formal_raw_bucket_reuse_allowed, "STORE_BINDING_FORMAL_BUCKET_REUSE_FORBIDDEN");
  eq(binding.credential_scope, "BUCKET_SCOPED", "STORE_BINDING_CREDENTIAL_SCOPE");
  truthy(binding.credential_must_be_separate_from_formal_raw, "STORE_BINDING_SEPARATE_CREDENTIAL_REQUIRED");
  falsy(binding.silent_formal_raw_credential_alias_allowed, "STORE_BINDING_SILENT_ALIAS_FORBIDDEN");
  eq(binding.credential_source, "PROCESS_ENVIRONMENT_SECRET_BINDING", "STORE_BINDING_CREDENTIAL_SOURCE");
  falsy(binding.credential_material_repository_allowed, "STORE_BINDING_REPOSITORY_SECRET_FORBIDDEN");
  eq(binding.endpoint_transport, "HTTPS_ONLY", "STORE_BINDING_HTTPS_ONLY");
  falsy(binding.local_or_ci_fallback_allowed, "STORE_BINDING_FALLBACK_FORBIDDEN");

  sameArray(authority.required_secret_bindings, EVIDENCE_SECRETS, "STORE_BINDING_EVIDENCE_SECRET_NAMESPACE");
  sameArray(authority.forbidden_formal_raw_secret_aliases, FORMAL_SECRETS, "STORE_BINDING_FORMAL_SECRET_NAMESPACE");
  eq(authority.required_secret_bindings.filter((x) => FORMAL_SECRETS.includes(x)).length, 0, "STORE_BINDING_SECRET_NAMESPACE_OVERLAP");
  eq(authority.formal_raw_separation?.bucket, "geox-mcft-cap09-formal-raw-v1", "STORE_BINDING_FORMAL_SEPARATION_BUCKET");
  truthy(authority.formal_raw_separation?.separate_bucket_identity_required, "STORE_BINDING_FORMAL_SEPARATE_BUCKET");
  truthy(authority.formal_raw_separation?.separate_credential_identity_required, "STORE_BINDING_FORMAL_SEPARATE_CREDENTIAL");

  const readiness = authority.credential_rematerialization_readiness_contract || {};
  truthy(readiness.new_current_state_verifier_required, "STORE_BINDING_NEW_VERIFIER_REQUIRED");
  truthy(readiness.historical_zero_row_provisioning_verifier_reuse_forbidden, "STORE_BINDING_OLD_ZERO_VERIFIER_FORBIDDEN");
  eq(readiness.operational_database_name, "geox_mcft_cap09_production_runtime_v1", "STORE_BINDING_OPERATIONAL_DB");
  eq(readiness.exact_table_count, 41, "STORE_BINDING_TABLE_COUNT");
  truthy(readiness.non_lease_production_state_rows_must_be_zero, "STORE_BINDING_NON_LEASE_ZERO");
  truthy(readiness.historical_expired_evidence_lease_residue_allowed, "STORE_BINDING_EVIDENCE_RESIDUE_ALLOWED");
  truthy(readiness.historical_expired_twin_lease_residue_allowed, "STORE_BINDING_TWIN_RESIDUE_ALLOWED");
  eq(readiness.current_live_evidence_owner_count_required, 0, "STORE_BINDING_EVIDENCE_LIVE_ZERO");
  eq(readiness.current_live_twin_owner_count_required, 0, "STORE_BINDING_TWIN_LIVE_ZERO");
  truthy(readiness.existing_evidence_login_principal_must_be_preserved, "STORE_BINDING_EVIDENCE_LOGIN_PRESERVE");
  truthy(readiness.existing_twin_login_principal_must_be_preserved, "STORE_BINDING_TWIN_LOGIN_PRESERVE");
  falsy(readiness.login_role_recreation_allowed, "STORE_BINDING_LOGIN_RECREATE_FORBIDDEN");
  truthy(readiness.password_rotation_only, "STORE_BINDING_PASSWORD_ROTATION_ONLY");
  truthy(readiness.exact_one_privilege_membership_each_required, "STORE_BINDING_EXACT_ONE_MEMBERSHIP");
  falsy(readiness.cross_plane_membership_allowed, "STORE_BINDING_CROSS_PLANE_FORBIDDEN");
  truthy(readiness.both_role_specific_urls_must_target_same_operational_database, "STORE_BINDING_SAME_DB_REQUIRED");
  sameArray(readiness.storage_capability_proof_required, ["AUTHENTICATED_PUT", "AUTHENTICATED_HEAD", "AUTHENTICATED_DELETE"], "STORE_BINDING_STORAGE_PROOF_SET");
  truthy(readiness.formal_raw_bucket_alias_forbidden, "STORE_BINDING_FORMAL_BUCKET_ALIAS_FORBIDDEN");
  truthy(readiness.formal_raw_credential_alias_forbidden, "STORE_BINDING_FORMAL_CREDENTIAL_ALIAS_FORBIDDEN");

  const e = authority.credential_rematerialization_evidence || {};
  eq(e.schema_version, "geox_mcft_cap09_production_credential_rematerialization_evidence_v1", "REMAT_SCHEMA");
  eq(e.status, "PASS", "REMAT_STATUS");
  eq(e.observed_subject_sha, SUCCESSOR_BASE, "REMAT_EXACT_SUBJECT");
  eq(e.successor_admission?.status, "ESTABLISHED", "REMAT_SUCCESSOR_ADMISSION");
  eq(e.successor_admission?.t4r1_run_id, 35049752299, "REMAT_T4R1_RUN");
  eq(e.successor_admission?.head_sha, SUCCESSOR_BASE, "REMAT_T4R1_HEAD");
  falsy(e.successor_admission?.formal_v5_authorized, "REMAT_T4R1_FORMAL_FALSE");

  const db = e.operational_database || {};
  eq(db.database_name, "geox_mcft_cap09_production_runtime_v1", "REMAT_DB_NAME");
  eq(db.public_table_count, 41, "REMAT_TABLE_COUNT");
  eq(db.runtime_routine_count, 3, "REMAT_ROUTINE_COUNT");
  eq(db.non_lease_table_count, 39, "REMAT_NON_LEASE_TABLE_COUNT");
  eq(db.non_lease_production_state_row_count, 0, "REMAT_NON_LEASE_ROW_ZERO");
  sameArray([db.evidence_lease?.total, db.evidence_lease?.live, db.evidence_lease?.expired], [1,0,1], "REMAT_EVIDENCE_RESIDUE");
  sameArray([db.twin_lease?.total, db.twin_lease?.live, db.twin_lease?.expired], [1,0,1], "REMAT_TWIN_RESIDUE");

  const dbc = e.database_credentials || {};
  truthy(dbc.login_principals_preserved, "REMAT_LOGIN_PRESERVED");
  falsy(dbc.login_role_recreation, "REMAT_LOGIN_RECREATION_FALSE");
  truthy(dbc.password_rotation_only, "REMAT_ROTATION_ONLY");
  truthy(dbc.exact_one_privilege_membership_each, "REMAT_EXACT_ONE_MEMBERSHIP");
  falsy(dbc.cross_plane_membership, "REMAT_CROSS_PLANE_FALSE");
  truthy(dbc.both_role_specific_urls_target_same_operational_database, "REMAT_SAME_DB_URLS");
  truthy(dbc.evidence_password_authenticated_login, "REMAT_EVIDENCE_LOGIN_PROOF");
  truthy(dbc.twin_password_authenticated_login, "REMAT_TWIN_LOGIN_PROOF");
  eq(dbc.role_specific_connectivity_proof, "PASS", "REMAT_ROLE_CONNECTIVITY");
  falsy(dbc.secret_material_embedded, "REMAT_DB_SECRET_EMBEDDED");

  const store = e.private_store || {};
  eq(store.physical_provider, "CLOUDFLARE_R2", "REMAT_R2_PROVIDER");
  eq(store.bucket, "geox-mcft-cap09-evidence-runtime-v1", "REMAT_R2_BUCKET");
  eq(store.formal_raw_bucket, "geox-mcft-cap09-formal-raw-v1", "REMAT_FORMAL_BUCKET");
  truthy(store.bucket_distinct_from_formal_raw, "REMAT_BUCKET_DISTINCT");
  eq(store.credential_permission, "OBJECT_READ_WRITE", "REMAT_R2_PERMISSION");
  eq(store.credential_scope, "SPECIFIC_BUCKET_ONLY", "REMAT_R2_SCOPE");
  truthy(store.credential_separate_from_formal_raw, "REMAT_R2_CREDENTIAL_DISTINCT");
  eq(store.region, "auto", "REMAT_R2_REGION");
  eq(store.endpoint_transport, "HTTPS", "REMAT_R2_HTTPS");
  eq(store.authenticated_put?.status, "PASS", "REMAT_R2_PUT");
  eq(store.authenticated_put?.http_status, 200, "REMAT_R2_PUT_STATUS");
  eq(store.authenticated_head?.status, "PASS", "REMAT_R2_HEAD");
  eq(store.authenticated_head?.http_status, 200, "REMAT_R2_HEAD_STATUS");
  eq(store.authenticated_delete?.status, "PASS", "REMAT_R2_DELETE");
  eq(store.authenticated_delete?.http_status, 204, "REMAT_R2_DELETE_STATUS");
  eq(store.post_delete_head?.status, "PASS", "REMAT_R2_POST_DELETE");
  eq(store.post_delete_head?.http_status, 404, "REMAT_R2_POST_DELETE_STATUS");
  falsy(store.formal_raw_bucket_reused, "REMAT_FORMAL_BUCKET_REUSED");
  falsy(store.secret_material_embedded, "REMAT_R2_SECRET_EMBEDDED");

  eq(e.proof_sources?.local_password_authenticated_pg_client, "MACHINE_PASS", "REMAT_PG_MACHINE_PROOF");
  eq(e.proof_sources?.local_aws_sigv4_r2_put_head_delete, "MACHINE_PASS", "REMAT_R2_MACHINE_PROOF");
  falsy(e.canonicalization?.repository_secret_material_allowed, "REMAT_REPO_SECRET_FORBIDDEN");
  falsy(e.canonicalization?.github_secret_materialized, "REMAT_GITHUB_SECRET_FALSE");
  falsy(e.canonicalization?.full_database_url_embedded, "REMAT_DB_URL_EMBEDDED");
  falsy(e.canonicalization?.r2_endpoint_value_embedded, "REMAT_R2_ENDPOINT_EMBEDDED");
  falsy(e.canonicalization?.access_key_id_embedded, "REMAT_ACCESS_KEY_EMBEDDED");
  falsy(e.canonicalization?.secret_access_key_embedded, "REMAT_SECRET_KEY_EMBEDDED");
  truthy(e.canonicalization?.canonical_acceptance_artifact_required, "REMAT_CANONICAL_ARTIFACT_REQUIRED");
  for (const key of ["runtime_process_start", "production_owner_activation", "formal_v5_arm", "a0_bootstrap", "o00_o23_started"]) {
    falsy(e.non_effects?.[key], `REMAT_NON_EFFECT:${key}`);
  }

  const next = authority.next_stage || {};
  eq(next.stage, "PRODUCTION_HOST_SECRET_BINDING_AND_PRE_OWNER_CUTOVER_READINESS", "REMAT_NEXT_STAGE");
  falsy(next.runtime_start_authorized_by_this_record, "REMAT_RUNTIME_START_FORBIDDEN");
  falsy(next.production_owner_activation_authorized_by_this_record, "REMAT_OWNER_ACTIVATION_FORBIDDEN");
  falsy(next.formal_v5_arm_authorized_by_this_record, "REMAT_FORMAL_FORBIDDEN");

  const historical = authority.effect_if_merged_to_protected_main || {};
  truthy(historical.production_evidence_private_store_identity_defined, "STORE_BINDING_HISTORICAL_IDENTITY_DEFINED");
  for (const key of ["cloudflare_r2_bucket_created", "evidence_s3_credential_created", "local_operator_secret_materialized", "github_secret_materialized", "database_password_rotated", "runtime_process_start", "production_owner_activation", "formal_v5_arm", "a0_authorized", "o00_o23_started", "mcft_cap09_completed"]) {
    falsy(historical[key], `STORE_BINDING_ORIGINAL_MERGE_NON_EFFECT:${key}`);
  }

  const serialized = JSON.stringify(authority);
  if (/postgres(?:ql)?:\/\//i.test(serialized) || /\.r2\.cloudflarestorage\.com/i.test(serialized) || /https?:\/\//i.test(serialized)) {
    fail("REMAT_SECRET_OR_ENDPOINT_VALUE_MUST_NOT_BE_EMBEDDED");
  }
}

function expectRejected(name, authority, mutate) {
  const x = clone(authority);
  mutate(x);
  let rejected = false;
  try { validateAuthority(x); } catch { rejected = true; }
  if (!rejected) fail(`REMAT_NEGATIVE_NOT_REJECTED:${name}`);
}

function selftest() {
  const authority = readJson(AUTH);
  validateAuthority(authority);
  const cases = [
    ["formal bucket reuse", (x) => { x.credential_rematerialization_evidence.private_store.bucket = "geox-mcft-cap09-formal-raw-v1"; }],
    ["cross-plane membership", (x) => { x.credential_rematerialization_evidence.database_credentials.cross_plane_membership = true; }],
    ["live evidence owner", (x) => { x.credential_rematerialization_evidence.operational_database.evidence_lease.live = 1; }],
    ["r2 put not proven", (x) => { x.credential_rematerialization_evidence.private_store.authenticated_put.status = "FAIL"; }],
    ["runtime start promoted", (x) => { x.credential_rematerialization_evidence.non_effects.runtime_process_start = true; }],
    ["formal v5 promoted", (x) => { x.next_stage.formal_v5_arm_authorized_by_this_record = true; }],
    ["login recreation", (x) => { x.credential_rematerialization_evidence.database_credentials.login_role_recreation = true; }]
  ];
  for (const [name, mutate] of cases) expectRejected(name, authority, mutate);
  console.log(JSON.stringify({ schema_version: "geox_mcft_cap09_production_evidence_runtime_private_store_binding_selftest_v2", status: "PASS", positive_cases: 1, negative_cases: cases.length, negative_case_names: cases.map(([n]) => n) }, null, 2));
}

if (process.argv.includes("--selftest")) {
  selftest();
  process.exit(0);
}

const base = String(process.env.MCFT_BASE_SHA || SUCCESSOR_BASE).trim();
eq(base, SUCCESSOR_BASE, "REMAT_EXACT_SUCCESSOR_BASE_REQUIRED");

const changed = git("diff", "--name-only", `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
sameArray(changed, SUCCESSOR_CHANGED_FILES, "REMAT_EXACT_THREE_FILE_BOUNDARY");

eq(blob(base, RUNTIME), blob("HEAD", RUNTIME), "REMAT_RUNTIME_SOURCE_MUTATED");
eq(blob(base, FORMAL), blob("HEAD", FORMAL), "REMAT_FORMAL_AUTHORITY_MUTATED");
eq(blob(base, QCP), blob("HEAD", QCP), "REMAT_QCP_AUTHORITY_MUTATED");
eq(blob(base, QCP_WORKFLOW), blob("HEAD", QCP_WORKFLOW), "REMAT_QCP_WORKFLOW_MUTATED");

const authority = readJson(AUTH);
validateAuthority(authority);

const formal = readJson(FORMAL);
eq(formal.binding_contract?.bucket, "geox-mcft-cap09-formal-raw-v1", "REMAT_FORMAL_BUCKET_CONTRACT");
sameArray(formal.required_secret_bindings, FORMAL_SECRETS, "REMAT_FORMAL_SECRET_CONTRACT");

const runtimeSource = fs.readFileSync(RUNTIME, "utf8");
for (const marker of [
  'raw_storage_authority: "EVIDENCE_RUNTIME_S3_CREDENTIALS_ONLY"',
  '"GEOX_MCFT_CAP09_EVIDENCE_S3_ENDPOINT"',
  '"GEOX_MCFT_CAP09_EVIDENCE_S3_BUCKET"',
  '"GEOX_MCFT_CAP09_EVIDENCE_S3_REGION"',
  '"GEOX_MCFT_CAP09_EVIDENCE_S3_ACCESS_KEY_ID"',
  '"GEOX_MCFT_CAP09_EVIDENCE_S3_SECRET_ACCESS_KEY"'
]) if (!runtimeSource.includes(marker)) fail(`REMAT_RUNTIME_MARKER_MISSING:${marker}`);

const qcp = readJson(QCP);
const resolver = qcp.dependency_resolvers?.[QCP_RESOLVER_ID];
if (!resolver) fail("REMAT_QCP_RESOLVER_MISSING");
eq(resolver.kind, "EXACT_PATH_SET", "REMAT_QCP_RESOLVER_KIND");
sameArray([...resolver.paths].sort(), [WORKFLOW, RUNTIME, FORMAL, AUTH, ACCEPT].sort(), "REMAT_QCP_RESOLVER_PATHS");
const qcpCheck = (qcp.checks || []).find((row) => row.check_id === QCP_CHECK_ID);
if (!qcpCheck) fail("REMAT_QCP_CHECK_MISSING");
eq(qcpCheck.execution_workflow, WORKFLOW, "REMAT_QCP_EXECUTION_WORKFLOW");
eq(qcpCheck.execution_workflow_status, "IMPLEMENTED_AT_SUCCESSOR_HEAD", "REMAT_QCP_WORKFLOW_STATUS");
eq(qcpCheck.fail_policy, "FAIL_CLOSED", "REMAT_QCP_FAIL_POLICY");
eq(qcpCheck.carry_forward_policy, "NONE", "REMAT_QCP_NO_CARRY_FORWARD");
sameArray(qcpCheck.resolver_ids, [QCP_RESOLVER_ID], "REMAT_QCP_RESOLVER_BINDING");

const qcpWorkflow = fs.readFileSync(QCP_WORKFLOW, "utf8");
for (const requiredPath of [WORKFLOW, AUTH, ACCEPT]) {
  if (!qcpWorkflow.includes(`- '${requiredPath}'`)) fail(`REMAT_QCP_TRIGGER_MISSING:${requiredPath}`);
}

const e = authority.credential_rematerialization_evidence;
const result = {
  schema_version: "geox_mcft_cap09_production_credential_rematerialization_canonical_acceptance_v1",
  status: "PASS",
  stage: "CREDENTIAL_REMATERIALIZATION_CANONICAL_EVIDENCE",
  base_main_sha: base,
  carrier_head_sha: git("rev-parse", "HEAD"),
  observed_subject_sha: e.observed_subject_sha,
  exact_changed_file_count: changed.length,
  authority_sha256: sha256(AUTH),
  operational_database_name: e.operational_database.database_name,
  production_host_table_count: e.operational_database.public_table_count,
  runtime_routine_count: e.operational_database.runtime_routine_count,
  non_lease_table_count: e.operational_database.non_lease_table_count,
  non_lease_production_state_row_count: e.operational_database.non_lease_production_state_row_count,
  evidence_lease: e.operational_database.evidence_lease,
  twin_lease: e.operational_database.twin_lease,
  evidence_password_authenticated_login: e.database_credentials.evidence_password_authenticated_login,
  twin_password_authenticated_login: e.database_credentials.twin_password_authenticated_login,
  exact_one_privilege_membership_each: e.database_credentials.exact_one_privilege_membership_each,
  cross_plane_membership: e.database_credentials.cross_plane_membership,
  physical_provider: e.private_store.physical_provider,
  evidence_runtime_bucket: e.private_store.bucket,
  formal_raw_bucket: e.private_store.formal_raw_bucket,
  formal_raw_bucket_reused: e.private_store.formal_raw_bucket_reused,
  authenticated_put_status: e.private_store.authenticated_put.http_status,
  authenticated_head_status: e.private_store.authenticated_head.http_status,
  authenticated_delete_status: e.private_store.authenticated_delete.http_status,
  post_delete_head_status: e.private_store.post_delete_head.http_status,
  repository_secret_material_bound: false,
  runtime_process_started: false,
  production_owner_activated: false,
  formal_v5_armed: false,
  a0_authorized: false,
  o00_o23_started: false,
  next_stage: authority.next_stage.stage,
  qcp_resolver_id: QCP_RESOLVER_ID,
  mcft_cap09_completed: false
};

fs.mkdirSync("acceptance-output", { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
