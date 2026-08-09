#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

function fail(message) { throw new Error(message); }
function eq(actual, expected, code) { if (actual !== expected) fail(`${code}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`); }
function truthy(value, code) { if (value !== true) fail(`${code}: expected true`); }
function falsy(value, code) { if (value !== false) fail(`${code}: expected false`); }
function git(...args) { return execFileSync("git", args, { encoding: "utf8" }).trim(); }
function blob(ref, file) { return git("rev-parse", `${ref}:${file}`); }
function json(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }

const base = process.env.MCFT_BASE_SHA;
if (!base) fail("EA5C2B2_BASE_SHA_REQUIRED");
eq(base, "0838046519258b93ee0c7161524f72a9bd54f68b", "EA5C2B2_EXACT_BASE_REQUIRED");

const runnerPath = "scripts/runtime_acceptance/EXECUTE_MCFT_CAP_09_EA5C2B2_FORMAL_LIVE_INGRESS.ts";
const authorityPath = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5C2B2-FORMAL-LIVE-INGRESS-PROOF-V1.json";
const workflowPath = ".github/workflows/mcft-cap-09-ea5c2b2-formal-live-ingress-proof.yml";
const gatePath = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5C2B2_FORMAL_LIVE_INGRESS_PROOF.cjs";
const expectedChanged = [runnerPath, authorityPath, workflowPath, gatePath].sort();
const changed = git("diff", "--name-only", `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
eq(JSON.stringify(changed), JSON.stringify(expectedChanged), "EA5C2B2_EXACT_FOUR_FILE_BOUNDARY_REQUIRED");

const predecessorPins = {
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md": "39f6a09273c30088a7ea264cfa94ff930ea5518e",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md": "7a92c17f7ba32aae52667de9c21db62bfd2ba70b",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA2A-KBS-SOIL-CONTINUITY-USE-POLICY-V1.json": "6c6e623ff96917d5ca6410d5fd5acc0f3372689c",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5C1-DURABLE-RAW-RESTRICTED-INGRESS-V1.json": "110a75ea7e6d8357b4a9d26941dcf3f70a115276",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5C2A-FORMAL-RAW-STORE-BINDING-CONTRACT-V1.json": "ca6ee5ae9de135e21cb4e3b77a8fa170b5364812",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5C2B1-LIVE-KBS-SOIL-INGRESS-EXECUTOR-V1.json": "1c4eea0e8d3d8efeb2d6f6f3b606a17ae4abe701",
  "apps/server/src/external_evidence/formal_durable_raw_store_binding_v1.ts": "c2babdf8cee6b2e9702c6923eab8a739a40001a5",
  "apps/server/src/external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.ts": "dfa2c10266a5079842012426aed175851d30ca44",
  "apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.ts": "6f7b6450d4f671c75affc2c7aba45ed71cb518c5",
  "apps/server/src/external_evidence/formal_live_kbs_soil_ingress_executor_v1.ts": "1cc2726aace39524e84fda9762f86a3fc2e96408"
};
for (const [file, expected] of Object.entries(predecessorPins)) {
  eq(blob(base, file), expected, `EA5C2B2_BASE_BLOB_PIN_MISMATCH:${file}`);
  eq(blob("HEAD", file), expected, `EA5C2B2_PREDECESSOR_MUTATED:${file}`);
}

const candidatePins = {
  [runnerPath]: "707d5e74b54d1e553302a2349c2c252b13811a19",
  [authorityPath]: "9d60303dfe46389aedadd4a63f7223da996c173d",
  [workflowPath]: "2f35ee488eef1fbde21b25ed597c160fcfebe4c8"
};
for (const [file, expected] of Object.entries(candidatePins)) eq(blob("HEAD", file), expected, `EA5C2B2_CANDIDATE_BLOB_PIN_MISMATCH:${file}`);

const authority = json(authorityPath);
eq(authority.base_main_sha, base, "EA5C2B2_AUTHORITY_BASE_MISMATCH");
eq(authority.frontier_id, "S6-EA5C2B2-PERSISTENT-FORMAL-RAW-STORE-AND-FORMAL-NEON-LIVE-INGRESS-PROOF", "EA5C2B2_FRONTIER_MISMATCH");
eq(authority.formal_database_authority.project_id, "delicate-glade-62464340", "EA5C2B2_FORMAL_NEON_PROJECT_REQUIRED");
eq(authority.formal_database_authority.branch_id, "br-cold-dust-a6j6aymz", "EA5C2B2_FORMAL_NEON_BRANCH_REQUIRED");
eq(authority.formal_database_authority.database_name, "geox_mcft_cap09_s6_formal_24h", "EA5C2B2_FORMAL_DATABASE_REQUIRED");
eq(authority.formal_database_authority.pre_candidate_read_only_preflight_observed_facts_count, 0, "EA5C2B2_PRISTINE_FACTS_PREFLIGHT_REQUIRED");
eq(authority.formal_database_authority.pre_candidate_read_only_preflight_exact_external_scope_count, 0, "EA5C2B2_PRISTINE_SCOPE_PREFLIGHT_REQUIRED");
eq(authority.formal_raw_store_authority.bucket, "geox-mcft-cap09-formal-raw-v1", "EA5C2B2_FORMAL_BUCKET_REQUIRED");
eq(authority.formal_raw_store_authority.transport, "HTTPS_ONLY", "EA5C2B2_HTTPS_REQUIRED");
truthy(authority.formal_raw_store_authority.authenticated_put_head_required, "EA5C2B2_AUTHENTICATED_RAW_PROOF_REQUIRED");
truthy(authority.formal_raw_store_authority.anonymous_head_must_be_denied, "EA5C2B2_ANONYMOUS_DENIAL_REQUIRED");
falsy(authority.formal_raw_store_authority.local_or_ci_fallback_allowed, "EA5C2B2_LOCAL_CI_FALLBACK_FORBIDDEN");
falsy(authority.formal_raw_store_authority.ci_minio_is_formal_store, "EA5C2B2_CI_MINIO_FORMAL_FORBIDDEN");
eq(authority.authorized_exact_head_live_effect.maximum_new_facts, 1, "EA5C2B2_MAX_ONE_NEW_FACT_REQUIRED");
eq(authority.authorized_exact_head_live_effect.allowed_record_type, "soil_moisture_observation_v1", "EA5C2B2_ONLY_SOIL_RECORD_REQUIRED");
eq(authority.authorized_exact_head_live_effect.allowed_binding_id, "kbs_lter_variate25_vwc_100mm_v1", "EA5C2B2_ONLY_SOIL_BINDING_REQUIRED");
falsy(authority.authorized_exact_head_live_effect.raw_value_publication_authorized, "EA5C2B2_PUBLIC_RAW_VALUE_FORBIDDEN");
falsy(authority.authorized_exact_head_live_effect.runtime_config_write_authorized, "EA5C2B2_RUNTIME_CONFIG_WRITE_FORBIDDEN");
falsy(authority.authorized_exact_head_live_effect.a0_write_authorized, "EA5C2B2_A0_WRITE_FORBIDDEN");
falsy(authority.authorized_exact_head_live_effect.forecast_write_authorized, "EA5C2B2_FORECAST_WRITE_FORBIDDEN");
falsy(authority.authorized_exact_head_live_effect.scenario_write_authorized, "EA5C2B2_SCENARIO_WRITE_FORBIDDEN");
falsy(authority.authorized_exact_head_live_effect.recommendation_action_write_authorized, "EA5C2B2_RECOMMENDATION_ACTION_WRITE_FORBIDDEN");
truthy(authority.proof_requirements.real_live_kbs_fetch_required_when_pre_state_is_zero, "EA5C2B2_LIVE_KBS_REQUIRED");
truthy(authority.proof_requirements.frozen_ea3_retention_before_decode_required, "EA5C2B2_EA3_BARRIER_REQUIRED");
truthy(authority.proof_requirements.frozen_ea5c1_restricted_ingress_required, "EA5C2B2_EA5C1_INGRESS_REQUIRED");
eq(authority.proof_requirements.final_total_facts_count, 1, "EA5C2B2_FINAL_ONE_FACT_REQUIRED");
eq(authority.proof_requirements.final_exact_external_scope_fact_count, 1, "EA5C2B2_FINAL_ONE_SCOPE_FACT_REQUIRED");
falsy(authority.proof_requirements.public_artifact_may_contain_soil_value, "EA5C2B2_PUBLIC_VALUE_ARTIFACT_FORBIDDEN");
falsy(authority.proof_requirements.public_artifact_may_contain_credentials_or_database_url, "EA5C2B2_SECRET_ARTIFACT_FORBIDDEN");
truthy(authority.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.ea5c2b2_formal_live_ingress_proof_effective, "EA5C2B2_EFFECT_REQUIRED");
truthy(authority.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.persistent_formal_24h_raw_store_bound, "EA5C2B2_FORMAL_STORE_EFFECT_REQUIRED");
truthy(authority.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.formal_neon_live_ingress_proved, "EA5C2B2_FORMAL_NEON_EFFECT_REQUIRED");
truthy(authority.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.ea5c2b_live_formal_proof_complete, "EA5C2B2_LIVE_PROOF_EFFECT_REQUIRED");
falsy(authority.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.ea5c_complete, "EA5C2B2_EA5C_PREMATURE");
falsy(authority.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.ea5d_authorized, "EA5C2B2_EA5D_PREMATURE");
falsy(authority.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.ea5e_authorized, "EA5C2B2_EA5E_PREMATURE");
falsy(authority.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.formal_o00_start_authorized, "EA5C2B2_O00_PREMATURE");

const requiredSecrets = [
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_ENDPOINT",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_BUCKET",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_REGION",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_ACCESS_KEY_ID",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY",
  "GEOX_MCFT_CAP09_S6_DATABASE_URL"
];
eq(JSON.stringify(authority.required_github_actions_secrets), JSON.stringify(requiredSecrets), "EA5C2B2_EXACT_SECRET_SET_REQUIRED");

const runner = fs.readFileSync(runnerPath, "utf8");
for (const marker of [
  "createFormalDurableRawEvidenceRetentionAdapterV1",
  "executeFormalLiveKbsSoilIngressV1",
  "geox_mcft_cap09_s6_formal_24h",
  "EA5C2B2_FORMAL_DATABASE_NOT_PRISTINE_OR_SINGLE_PROOF",
  "FIRST_LIVE_INSERT",
  "EXISTING_PROOF_REVERIFIED",
  "verifyRetainedRawEvidence",
  "anonymous_raw_head_denied: true",
  "persistent_formal_24h_raw_store_bound: true",
  "formal_neon_live_ingress_proved: true",
  "ea5c_complete: false",
  "public_raw_value_emission_count: 0"
]) if (!runner.includes(marker)) fail(`EA5C2B2_RUNNER_MARKER_MISSING:${marker}`);
if (/\bINSERT\s+INTO\b/i.test(runner)) fail("EA5C2B2_DIRECT_SQL_INSERT_FORBIDDEN");
if (runner.includes("allow_insecure_http_for_test")) fail("EA5C2B2_INSECURE_HTTP_FORBIDDEN");
if (runner.includes("minioadmin")) fail("EA5C2B2_CI_MINIO_CREDENTIAL_FORBIDDEN");
if (
  runner.includes('field_id: "field_c8_demo"') ||
  runner.includes("field_id: 'field_c8_demo'") ||
  runner.includes('"field_id":"field_c8_demo"')
) fail("EA5C2B2_C8_SCOPE_FORBIDDEN");

const workflow = fs.readFileSync(workflowPath, "utf8");
if (workflow.includes("pull_request_target")) fail("EA5C2B2_PULL_REQUEST_TARGET_FORBIDDEN");
if (workflow.includes("minio/minio")) fail("EA5C2B2_CI_MINIO_WORKFLOW_FORBIDDEN");
if (workflow.includes("127.0.0.1:9000") || workflow.includes("localhost:9000")) fail("EA5C2B2_LOCAL_OBJECT_STORE_FORBIDDEN");
for (const secret of requiredSecrets) {
  if (!workflow.includes(`${secret}: \${{ secrets.${secret} }}`)) fail(`EA5C2B2_WORKFLOW_SECRET_BINDING_MISSING:${secret}`);
  if (!workflow.includes(secret)) fail(`EA5C2B2_WORKFLOW_SECRET_PREFLIGHT_MISSING:${secret}`);
}
for (const marker of [
  "MISSING_REQUIRED_SECRET:$name",
  "EXECUTE_MCFT_CAP_09_EA5C2B2_FORMAL_LIVE_INGRESS.ts",
  "persistent_formal_24h_raw_store_bound !== true",
  "formal_neon_live_ingress_proved !== true",
  "ea5c_complete !== false"
]) if (!workflow.includes(marker)) fail(`EA5C2B2_WORKFLOW_MARKER_MISSING:${marker}`);

const result = {
  schema_version: "geox_mcft_cap09_ea5c2b2_formal_live_ingress_proof_governance_result_v1",
  status: "PASS",
  base_main_sha: base,
  subject_head_sha: git("rev-parse", "HEAD"),
  exact_changed_file_count: changed.length,
  predecessor_blobs_verified_unchanged: true,
  candidate_blobs_verified: true,
  exact_six_secret_bindings_required: true,
  persistent_remote_raw_store_only: true,
  exact_formal_neon_only: true,
  maximum_new_facts: 1,
  only_external_soil_evidence_authorized: true,
  public_raw_values_forbidden: true,
  runtime_public_provider_fetch_forbidden: true,
  ea5c2b2_formal_live_ingress_proof_effective_after_exact_head_proof_and_merge: true,
  ea5c_complete: false,
  ea5d_authorized: false,
  ea5e_authorized: false,
  formal_o00_start_authorized: false,
  mcft_cap09_completed: false
};
fs.mkdirSync("acceptance-output", { recursive: true });
fs.writeFileSync("acceptance-output/MCFT_CAP_09_EA5C2B2_FORMAL_LIVE_INGRESS_PROOF_GOVERNANCE_RESULT.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
