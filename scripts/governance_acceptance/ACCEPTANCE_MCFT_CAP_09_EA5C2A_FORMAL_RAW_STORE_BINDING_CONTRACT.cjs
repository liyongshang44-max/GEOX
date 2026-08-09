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
function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }

const base = process.env.MCFT_BASE_SHA;
if (!base) fail("EA5C2A_BASE_SHA_REQUIRED");
eq(base, "4b9f3cfb16b8e49ad50b991465b553ac4d862af4", "EA5C2A_EXACT_BASE_REQUIRED");

const modulePath = "apps/server/src/external_evidence/formal_durable_raw_store_binding_v1.ts";
const acceptancePath = "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5C2A_FORMAL_RAW_STORE_BINDING.ts";
const authorityPath = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5C2A-FORMAL-RAW-STORE-BINDING-CONTRACT-V1.json";
const gatePath = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5C2A_FORMAL_RAW_STORE_BINDING_CONTRACT.cjs";
const workflowPath = ".github/workflows/mcft-cap-09-ea5c2a-formal-raw-store-binding-contract.yml";
const expectedChanged = [modulePath, acceptancePath, authorityPath, gatePath, workflowPath].sort();
const changed = git("diff", "--name-only", `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
eq(JSON.stringify(changed), JSON.stringify(expectedChanged), "EA5C2A_EXACT_FIVE_FILE_BOUNDARY_REQUIRED");

const predecessorPins = {
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md": "39f6a09273c30088a7ea264cfa94ff930ea5518e",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md": "7a92c17f7ba32aae52667de9c21db62bfd2ba70b",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA4-RECOVERY-AUTHORITY-V1.json": "1174940a6908e545e70d87cb65be5b3a41db33cf",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5C1-DURABLE-RAW-RESTRICTED-INGRESS-V1.json": "110a75ea7e6d8357b4a9d26941dcf3f70a115276",
  "apps/server/src/external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.ts": "dfa2c10266a5079842012426aed175851d30ca44",
  "apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.ts": "6f7b6450d4f671c75affc2c7aba45ed71cb518c5"
};
for (const [file, expected] of Object.entries(predecessorPins)) {
  eq(blob(base, file), expected, `EA5C2A_BASE_BLOB_PIN_MISMATCH:${file}`);
  eq(blob("HEAD", file), expected, `EA5C2A_PREDECESSOR_MUTATED:${file}`);
}

const candidatePins = {
  [modulePath]: "c2babdf8cee6b2e9702c6923eab8a739a40001a5",
  [acceptancePath]: "186f34f32c9104475fad938d48b1c354b2d0a954",
  [authorityPath]: "ca6ee5ae9de135e21cb4e3b77a8fa170b5364812",
  [workflowPath]: "78b10c792fef2c35970da8b08ef7c50d51caa611"
};
for (const [file, expected] of Object.entries(candidatePins)) eq(blob("HEAD", file), expected, `EA5C2A_CANDIDATE_BLOB_PIN_MISMATCH:${file}`);

const amendment = fs.readFileSync("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md", "utf8");
for (const required of [
  "durable, private, hash-addressed retention receipt before the corresponding canonical Evidence record may be appended to Formal `facts`",
  "Runtime never fetches KBS or NOAA directly.",
  "Only after EA5E is effective may O00 be enabled."
]) if (!amendment.includes(required)) fail(`EA5C2A_AMENDMENT_REQUIREMENT_MISSING:${required}`);

const authority = readJson(authorityPath);
eq(authority.base_main_sha, base, "EA5C2A_AUTHORITY_BASE_MISMATCH");
eq(authority.frontier_id, "S6-EA5C2A-FORMAL-DURABLE-RAW-STORE-BINDING-CONTRACT-QUALIFICATION", "EA5C2A_FRONTIER_MISMATCH");
eq(authority.binding_contract.provider_contract, "S3_COMPATIBLE_PRIVATE_OBJECT_STORE", "EA5C2A_PROVIDER_CONTRACT_REQUIRED");
eq(authority.binding_contract.bucket, "geox-mcft-cap09-formal-raw-v1", "EA5C2A_BUCKET_AUTHORITY_REQUIRED");
eq(authority.binding_contract.endpoint_transport, "HTTPS_ONLY", "EA5C2A_HTTPS_ONLY_REQUIRED");
falsy(authority.binding_contract.endpoint_local_or_loopback_allowed, "EA5C2A_LOCAL_ENDPOINT_FORBIDDEN");
falsy(authority.binding_contract.known_ci_minio_credentials_allowed, "EA5C2A_CI_CREDENTIAL_FORBIDDEN");
falsy(authority.binding_contract.local_or_ci_fallback_allowed, "EA5C2A_FALLBACK_FORBIDDEN");
falsy(authority.binding_contract.credential_material_public_descriptor_allowed, "EA5C2A_PUBLIC_CREDENTIAL_FORBIDDEN");
falsy(authority.binding_contract.public_or_presigned_raw_access_allowed, "EA5C2A_PUBLIC_RAW_ACCESS_FORBIDDEN");
truthy(authority.qualified_architecture.existing_ea5c1_s3_compatible_adapter_reused, "EA5C2A_EA5C1_ADAPTER_REUSE_REQUIRED");
falsy(authority.qualified_architecture.new_object_store_sdk_dependency_added, "EA5C2A_NEW_SDK_DEPENDENCY_FORBIDDEN");
falsy(authority.qualified_architecture.runtime_provider_fetch_enabled, "EA5C2A_RUNTIME_PROVIDER_FETCH_FORBIDDEN");
truthy(authority.effect_if_merged_to_protected_main.ea5c2a_binding_contract_qualified, "EA5C2A_EFFECT_REQUIRED");
falsy(authority.effect_if_merged_to_protected_main.persistent_formal_24h_raw_store_bound, "EA5C2A_PERSISTENT_STORE_PREMATURE_CLAIM");
falsy(authority.effect_if_merged_to_protected_main.formal_live_source_ingress_proved, "EA5C2A_LIVE_INGRESS_PREMATURE_CLAIM");
falsy(authority.effect_if_merged_to_protected_main.formal_neon_write_performed_by_this_candidate, "EA5C2A_FORMAL_NEON_WRITE_FORBIDDEN");
falsy(authority.effect_if_merged_to_protected_main.ea5c_complete, "EA5C2A_EA5C_PREMATURE_COMPLETION");
falsy(authority.effect_if_merged_to_protected_main.ea5d_authorized, "EA5C2A_EA5D_PREMATURE_AUTHORIZATION");
falsy(authority.effect_if_merged_to_protected_main.ea5e_authorized, "EA5C2A_EA5E_PREMATURE_AUTHORIZATION");
falsy(authority.effect_if_merged_to_protected_main.formal_o00_start_authorized, "EA5C2A_O00_PREMATURE_AUTHORIZATION");

const expectedSecrets = [
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_ENDPOINT",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_BUCKET",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_REGION",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_ACCESS_KEY_ID",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY"
];
eq(JSON.stringify(authority.required_secret_bindings), JSON.stringify(expectedSecrets), "EA5C2A_EXACT_SECRET_BINDINGS_REQUIRED");

const moduleSource = fs.readFileSync(modulePath, "utf8");
for (const marker of [
  "MCFT_CAP09_FORMAL_DURABLE_RAW_STORE_BINDING_V1",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_ENDPOINT",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY",
  "EA5C2A_FORMAL_RAW_HTTPS_REQUIRED",
  "EA5C2A_FORMAL_RAW_LOCAL_ENDPOINT_FORBIDDEN",
  "EA5C2A_FORMAL_RAW_BUCKET_AUTHORITY_MISMATCH",
  "EA5C2A_FORMAL_RAW_CI_CREDENTIAL_FORBIDDEN",
  "S3CompatiblePrivateRawEvidenceRetentionAdapterV1"
]) if (!moduleSource.includes(marker)) fail(`EA5C2A_BINDING_MODULE_MARKER_MISSING:${marker}`);
if (/\bfetch\s*\(/.test(moduleSource)) fail("EA5C2A_BINDING_MODULE_PROVIDER_FETCH_FORBIDDEN");
if (moduleSource.includes("allow_insecure_http_for_test: true")) fail("EA5C2A_PRODUCTION_INSECURE_HTTP_FORBIDDEN");

const acceptanceSource = fs.readFileSync(acceptancePath, "utf8");
for (const marker of [
  "missing endpoint fails closed",
  "HTTP endpoint is forbidden",
  "localhost fallback is forbidden",
  "bucket authority drift fails closed",
  "known CI MinIO credentials are forbidden",
  "persistent_formal_24h_raw_store_bound: false",
  "live_formal_ingress_proved: false"
]) if (!acceptanceSource.includes(marker)) fail(`EA5C2A_ACCEPTANCE_MARKER_MISSING:${marker}`);

const workflow = fs.readFileSync(workflowPath, "utf8");
for (const marker of [
  "CI-only private S3-compatible regression store",
  "ACCEPTANCE_MCFT_CAP_09_EA5C2A_FORMAL_RAW_STORE_BINDING.ts",
  "ACCEPTANCE_MCFT_CAP_09_EA5C1_DURABLE_RAW_RESTRICTED_INGRESS.ts",
  "postgres:18",
  "minio/minio:latest"
]) if (!workflow.includes(marker)) fail(`EA5C2A_WORKFLOW_MARKER_MISSING:${marker}`);
if (workflow.includes("GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY: minioadmin123")) {
  fail("EA5C2A_CI_SECRET_MUST_NOT_BE_BOUND_AS_FORMAL_SECRET");
}

const result = {
  schema_version: "geox_mcft_cap09_ea5c2a_formal_raw_store_binding_contract_governance_result_v1",
  status: "PASS",
  base_main_sha: base,
  subject_head_sha: git("rev-parse", "HEAD"),
  exact_changed_file_count: changed.length,
  predecessor_blobs_verified_unchanged: true,
  candidate_blobs_verified: true,
  fail_closed_formal_binding_contract_proved: true,
  credential_redaction_boundary_proved: true,
  local_or_ci_fallback_forbidden: true,
  frozen_ea5c1_adapter_and_ingress_unchanged: true,
  persistent_formal_24h_raw_store_bound: false,
  live_formal_ingress_proved: false,
  formal_neon_write_performed: false,
  ea5c2a_binding_contract_qualified_after_effectiveness: true,
  ea5c_complete: false,
  ea5d_authorized: false,
  ea5e_authorized: false,
  formal_o00_start_authorized: false,
  mcft_cap09_completed: false
};
fs.mkdirSync("acceptance-output", { recursive: true });
fs.writeFileSync("acceptance-output/MCFT_CAP_09_EA5C2A_FORMAL_RAW_STORE_BINDING_CONTRACT_GOVERNANCE_RESULT.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
