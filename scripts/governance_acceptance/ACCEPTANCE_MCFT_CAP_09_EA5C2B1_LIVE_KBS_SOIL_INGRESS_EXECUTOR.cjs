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
if (!base) fail("EA5C2B1_BASE_SHA_REQUIRED");
eq(base, "d3e15cfd20ec565f419494287151dbaf385dfdb3", "EA5C2B1_EXACT_BASE_REQUIRED");

const executorPath = "apps/server/src/external_evidence/formal_live_kbs_soil_ingress_executor_v1.ts";
const acceptancePath = "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5C2B1_LIVE_KBS_SOIL_INGRESS.ts";
const authorityPath = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5C2B1-LIVE-KBS-SOIL-INGRESS-EXECUTOR-V1.json";
const workflowPath = ".github/workflows/mcft-cap-09-ea5c2b1-live-kbs-soil-ingress-executor.yml";
const gatePath = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5C2B1_LIVE_KBS_SOIL_INGRESS_EXECUTOR.cjs";
const expectedChanged = [executorPath, acceptancePath, authorityPath, workflowPath, gatePath].sort();
const changed = git("diff", "--name-only", `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
eq(JSON.stringify(changed), JSON.stringify(expectedChanged), "EA5C2B1_EXACT_FIVE_FILE_BOUNDARY_REQUIRED");

const predecessorPins = {
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md": "39f6a09273c30088a7ea264cfa94ff930ea5518e",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md": "7a92c17f7ba32aae52667de9c21db62bfd2ba70b",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA2A-KBS-SOIL-CONTINUITY-USE-POLICY-V1.json": "6c6e623ff96917d5ca6410d5fd5acc0f3372689c",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA4-RECOVERY-AUTHORITY-V1.json": "1174940a6908e545e70d87cb65be5b3a41db33cf",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5C1-DURABLE-RAW-RESTRICTED-INGRESS-V1.json": "110a75ea7e6d8357b4a9d26941dcf3f70a115276",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5C2A-FORMAL-RAW-STORE-BINDING-CONTRACT-V1.json": "ca6ee5ae9de135e21cb4e3b77a8fa170b5364812",
  "apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.ts": "5b4e5133e51dfaf447c2de52caf1a9f50c8254d3",
  "apps/server/src/external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.ts": "dfa2c10266a5079842012426aed175851d30ca44",
  "apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.ts": "6f7b6450d4f671c75affc2c7aba45ed71cb518c5",
  "apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.ts": "5fe20f988d2cd6ef038f54eec27e5a32ba6a396d",
  "apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.ts": "f7ea03a7f8387ce4de135dac61f0b063e91f0f25"
};
for (const [file, expected] of Object.entries(predecessorPins)) {
  eq(blob(base, file), expected, `EA5C2B1_BASE_BLOB_PIN_MISMATCH:${file}`);
  eq(blob("HEAD", file), expected, `EA5C2B1_PREDECESSOR_MUTATED:${file}`);
}

const candidatePins = {
  [executorPath]: "1cc2726aace39524e84fda9762f86a3fc2e96408",
  [acceptancePath]: "211dc6dd7c891374b7fc50027611870b279f8156",
  [authorityPath]: "1c4eea0e8d3d8efeb2d6f6f3b606a17ae4abe701",
  [workflowPath]: "70e0a6e62893a83fde8a612c5630d0ae412d5455"
};
for (const [file, expected] of Object.entries(candidatePins)) eq(blob("HEAD", file), expected, `EA5C2B1_CANDIDATE_BLOB_PIN_MISMATCH:${file}`);

const authority = json(authorityPath);
eq(authority.base_main_sha, base, "EA5C2B1_AUTHORITY_BASE_MISMATCH");
eq(authority.frontier_id, "S6-EA5C2B1-LIVE-KBS-SOIL-INGRESS-EXECUTOR-QUALIFICATION", "EA5C2B1_FRONTIER_MISMATCH");
eq(authority.live_source_contract.endpoint, "https://lter.kbs.msu.edu/weather/variates/25", "EA5C2B1_KBS_ENDPOINT_REQUIRED");
eq(authority.live_source_contract.binding_id, "kbs_lter_variate25_vwc_100mm_v1", "EA5C2B1_SOIL_BINDING_REQUIRED");
eq(authority.live_source_contract.measurement_depth_mm, 100, "EA5C2B1_100MM_DEPTH_REQUIRED");
eq(authority.live_source_contract.spatial_support, "NEAR_SITE_POINT_SUPPORT", "EA5C2B1_SPATIAL_SUPPORT_REQUIRED");
falsy(authority.live_source_contract.direct_field_equivalence, "EA5C2B1_DIRECT_FIELD_EQUIVALENCE_FORBIDDEN");
falsy(authority.live_source_contract.direct_root_zone_equivalence, "EA5C2B1_DIRECT_ROOT_ZONE_EQUIVALENCE_FORBIDDEN");
eq(authority.live_source_contract.root_zone_representativeness, "PARTIAL", "EA5C2B1_PARTIAL_ROOT_ZONE_REQUIRED");
falsy(authority.continuity_and_use_policy.raw_value_publication_authorized, "EA5C2B1_PUBLIC_RAW_VALUE_FORBIDDEN");
falsy(authority.continuity_and_use_policy.public_reconstructable_sensor_sequence_authorized, "EA5C2B1_PUBLIC_RECONSTRUCTABLE_SEQUENCE_FORBIDDEN");
truthy(authority.qualified_architecture.frozen_ea3_retention_before_decode_pipeline_reused, "EA5C2B1_EA3_REUSE_REQUIRED");
truthy(authority.qualified_architecture.frozen_ea5c1_restricted_fact_ingress_reused, "EA5C2B1_EA5C1_INGRESS_REUSE_REQUIRED");
falsy(authority.qualified_architecture.runtime_public_provider_fetch_allowed, "EA5C2B1_RUNTIME_PROVIDER_FETCH_FORBIDDEN");
falsy(authority.ci_live_qualification.ci_minio_is_formal_24h_durable_store, "EA5C2B1_CI_MINIO_FORMAL_FORBIDDEN");
falsy(authority.ci_live_qualification.ci_postgres_is_formal_neon_database, "EA5C2B1_CI_POSTGRES_FORMAL_FORBIDDEN");
truthy(authority.effect_if_merged_to_protected_main.ea5c2b1_live_kbs_soil_executor_qualified, "EA5C2B1_EFFECT_REQUIRED");
falsy(authority.effect_if_merged_to_protected_main.persistent_formal_24h_raw_store_bound, "EA5C2B1_FORMAL_STORE_PREMATURE");
falsy(authority.effect_if_merged_to_protected_main.formal_neon_live_ingress_proved, "EA5C2B1_FORMAL_NEON_PREMATURE");
falsy(authority.effect_if_merged_to_protected_main.ea5c2b_live_formal_proof_complete, "EA5C2B1_LIVE_FORMAL_PREMATURE");
falsy(authority.effect_if_merged_to_protected_main.ea5c_complete, "EA5C2B1_EA5C_PREMATURE");
falsy(authority.effect_if_merged_to_protected_main.ea5d_authorized, "EA5C2B1_EA5D_PREMATURE");
falsy(authority.effect_if_merged_to_protected_main.ea5e_authorized, "EA5C2B1_EA5E_PREMATURE");
falsy(authority.effect_if_merged_to_protected_main.formal_o00_start_authorized, "EA5C2B1_O00_PREMATURE");

const executor = fs.readFileSync(executorPath, "utf8");
for (const marker of [
  "https://lter.kbs.msu.edu/weather/variates/25",
  "collectRetainDecodeCanonicalizeExternalEvidenceV1",
  "PostgresExternalFormalEvidenceIngressV1",
  "KbsVariate25SoilEvidenceDecoderV1",
  "VOLUMETRIC_WATER_CONTENT",
  "POINT_100MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1",
  "NO_PUBLIC_RAW_VALUE_EMISSION",
  "runtime_public_provider_fetch_count: 0"
]) if (!executor.includes(marker)) fail(`EA5C2B1_EXECUTOR_MARKER_MISSING:${marker}`);
if (executor.includes("field_c8_demo")) fail("EA5C2B1_C8_SCOPE_FORBIDDEN");
if (executor.includes("POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1")) fail("EA5C2B1_200MM_OPERATOR_FORBIDDEN");
if (/\bINSERT\s+INTO\b/i.test(executor)) fail("EA5C2B1_DIRECT_SQL_WRITE_FORBIDDEN");

const acceptance = fs.readFileSync(acceptancePath, "utf8");
for (const marker of [
  "executeFormalLiveKbsSoilIngressV1",
  "public_raw_value_emission_count: 0",
  "ci_minio_is_formal_24h_durable_store: false",
  "formal_neon_write_performed: false",
  "ea5c_complete: false"
]) if (!acceptance.includes(marker)) fail(`EA5C2B1_ACCEPTANCE_MARKER_MISSING:${marker}`);

const workflow = fs.readFileSync(workflowPath, "utf8");
for (const marker of [
  "CI-only private S3-compatible regression store",
  "Execute live KBS source through frozen EA3 and EA5C1 pipeline against CI-only stores",
  "postgres:18",
  "minio/minio:latest",
  "ACCEPTANCE_MCFT_CAP_09_EA5C2B1_LIVE_KBS_SOIL_INGRESS.ts"
]) if (!workflow.includes(marker)) fail(`EA5C2B1_WORKFLOW_MARKER_MISSING:${marker}`);
for (const forbidden of [
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_ENDPOINT:",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY:",
  "GEOX_MCFT_CAP09_S6_DATABASE_URL:"
]) if (workflow.includes(forbidden)) fail(`EA5C2B1_FORMAL_SECRET_BINDING_FORBIDDEN:${forbidden}`);

const result = {
  schema_version: "geox_mcft_cap09_ea5c2b1_live_kbs_soil_ingress_executor_governance_result_v1",
  status: "PASS",
  base_main_sha: base,
  subject_head_sha: git("rev-parse", "HEAD"),
  exact_changed_file_count: changed.length,
  predecessor_blobs_verified_unchanged: true,
  candidate_blobs_verified: true,
  live_kbs_collector_side_fetch_authorized: true,
  frozen_ea3_retention_before_decode_reused: true,
  frozen_ea5c1_restricted_ingress_reused: true,
  public_raw_values_forbidden: true,
  runtime_public_provider_fetch_forbidden: true,
  ci_minio_is_formal_store: false,
  formal_neon_write_performed: false,
  persistent_formal_24h_raw_store_bound: false,
  ea5c2b_live_formal_proof_complete: false,
  ea5c_complete: false,
  ea5d_authorized: false,
  ea5e_authorized: false,
  formal_o00_start_authorized: false,
  mcft_cap09_completed: false
};
fs.mkdirSync("acceptance-output", { recursive: true });
fs.writeFileSync("acceptance-output/MCFT_CAP_09_EA5C2B1_LIVE_KBS_SOIL_INGRESS_EXECUTOR_GOVERNANCE_RESULT.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
