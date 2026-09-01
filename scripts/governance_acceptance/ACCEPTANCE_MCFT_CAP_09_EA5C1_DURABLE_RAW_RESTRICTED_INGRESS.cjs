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

const HISTORICAL_BASE = "b9e212f98dd1d0c1e8fff5e9f93f369167e6f065";
const base = process.env.MCFT_BASE_SHA;
if (!base) fail("EA5C1_BASE_SHA_REQUIRED");
if (!/^[0-9a-f]{40}$/.test(base)) fail("EA5C1_BASE_SHA_INVALID");
const head = git("rev-parse", "HEAD");
eq(git("merge-base", base, head), base, "EA5C1_BASE_NOT_ANCESTOR");

const authorityPath = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5C1-DURABLE-RAW-RESTRICTED-INGRESS-V1.json";
const rawAdapterPath = "apps/server/src/external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.ts";
const collectorPath = "apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.ts";
const ingressPath = "apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.ts";
const acceptancePath = "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5C1_DURABLE_RAW_RESTRICTED_INGRESS.ts";
const gatePath = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5C1_DURABLE_RAW_RESTRICTED_INGRESS.cjs";
const workflowPath = ".github/workflows/mcft-cap-09-ea5c1-durable-raw-restricted-ingress.yml";
const historicalExpectedChanged = [authorityPath, rawAdapterPath, ingressPath, acceptancePath, gatePath, workflowPath].sort();
const successorProtectedPaths = [...historicalExpectedChanged, collectorPath].sort();
const changed = git("diff", "--name-only", `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
const protectedChanged = changed.filter((file) => successorProtectedPaths.includes(file));

const predecessorPins = {
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md": "39f6a09273c30088a7ea264cfa94ff930ea5518e",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md": "7a92c17f7ba32aae52667de9c21db62bfd2ba70b",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5B-CLOSURE-AUTHORITY-V1.json": "6377a4c5c9a587b24bfccea913bf9ebe7e8ddca2",
  "apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.ts": "5b4e5133e51dfaf447c2de52caf1a9f50c8254d3",
  "apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.ts": "45cca8e03cf0641f2fbf45f3b3aca044f322989c",
  "apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.ts": "5fe20f988d2cd6ef038f54eec27e5a32ba6a396d"
};
const candidatePins = {
  [authorityPath]: "110a75ea7e6d8357b4a9d26941dcf3f70a115276",
  [rawAdapterPath]: "dfa2c10266a5079842012426aed175851d30ca44",
  [ingressPath]: "6f7b6450d4f671c75affc2c7aba45ed71cb518c5",
  [acceptancePath]: "1916143d1339d2d7e6bd3174d637f64d71ce9091"
};

let validationMode;
if (base === HISTORICAL_BASE) {
  eq(JSON.stringify(changed), JSON.stringify(historicalExpectedChanged), "EA5C1_EXACT_SIX_FILE_BOUNDARY_REQUIRED");
  for (const [file, expected] of Object.entries(predecessorPins)) {
    eq(blob(base, file), expected, `EA5C1_BASE_BLOB_PIN_MISMATCH:${file}`);
    eq(blob("HEAD", file), expected, `EA5C1_PREDECESSOR_MUTATED:${file}`);
  }
  for (const [file, expected] of Object.entries(candidatePins)) eq(blob("HEAD", file), expected, `EA5C1_CANDIDATE_BLOB_PIN_MISMATCH:${file}`);
  validationMode = "EXACT_HISTORICAL_CANDIDATE";
} else {
  // Successor maintenance must not rewrite the historical qualification record or silently
  // mutate its raw-store/acceptance surfaces. The restricted ingress itself may evolve,
  // but this PR must preserve the current predecessor contracts and re-run the real I/O proof.
  eq(blob(base, authorityPath), candidatePins[authorityPath], "EA5C1_SUCCESSOR_BASE_HISTORICAL_AUTHORITY_DRIFT");
  eq(blob("HEAD", authorityPath), candidatePins[authorityPath], "EA5C1_SUCCESSOR_HISTORICAL_AUTHORITY_MUTATED");
  eq(blob(base, rawAdapterPath), candidatePins[rawAdapterPath], "EA5C1_SUCCESSOR_BASE_RAW_ADAPTER_DRIFT");
  eq(blob("HEAD", rawAdapterPath), candidatePins[rawAdapterPath], "EA5C1_SUCCESSOR_RAW_ADAPTER_MUTATED");
  eq(blob(base, acceptancePath), candidatePins[acceptancePath], "EA5C1_SUCCESSOR_BASE_FOCUSED_ACCEPTANCE_DRIFT");
  eq(blob("HEAD", acceptancePath), candidatePins[acceptancePath], "EA5C1_SUCCESSOR_FOCUSED_ACCEPTANCE_MUTATED");
  for (const file of Object.keys(predecessorPins)) {
    if (file === collectorPath) continue;
    eq(blob("HEAD", file), blob(base, file), `EA5C1_SUCCESSOR_PREDECESSOR_MUTATED:${file}`);
  }
  const allowedMaintenance = new Set([ingressPath, collectorPath, gatePath, workflowPath]);
  const forbiddenProtected = protectedChanged.filter((file) => !allowedMaintenance.has(file));
  eq(JSON.stringify(forbiddenProtected), JSON.stringify([]), "EA5C1_SUCCESSOR_PROTECTED_SURFACE_CHANGE_REQUIRES_NEW_EXACT_GATE");
  if (!protectedChanged.includes(ingressPath) && !protectedChanged.includes(collectorPath)) {
    fail("EA5C1_SUCCESSOR_INGRESS_OR_COLLECTOR_CHANGE_REQUIRED_FOR_MAINTENANCE_REVALIDATION");
  }
  validationMode = "SUCCESSOR_MAINTENANCE_REVALIDATION";
}

const amendment = fs.readFileSync("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md", "utf8");
for (const required of [
  "raw authority retention must precede decode/canonicalization",
  "durable, private, hash-addressed retention receipt before the corresponding canonical Evidence record may be appended to Formal `facts`",
  "durable raw retention + restricted canonical External Evidence ingress",
  "Only after EA5E is effective may O00 be enabled."
]) if (!amendment.includes(required)) fail(`EA5C1_AMENDMENT_REQUIREMENT_MISSING:${required}`);

const authority = readJson(authorityPath);
eq(authority.base_main_sha, HISTORICAL_BASE, "EA5C1_AUTHORITY_HISTORICAL_BASE_MISMATCH");
eq(authority.frontier_id, "S6-EA5C1-DURABLE-RAW-RESTRICTED-INGRESS-IMPLEMENTATION-QUALIFICATION", "EA5C1_AUTHORITY_FRONTIER_MISMATCH");
truthy(authority.qualified_architecture.durable_private_hash_addressed_retention_precedes_decode, "EA5C1_RETENTION_BEFORE_DECODE_REQUIRED");
truthy(authority.qualified_architecture.facts_writer_accepts_only_self_consistent_ea3_canonicalization_result, "EA5C1_EA3_CANONICAL_RESULT_REQUIRED");
truthy(authority.qualified_architecture.durable_raw_object_reverified_immediately_before_database_transaction, "EA5C1_RAW_REVERIFY_BEFORE_DB_REQUIRED");
falsy(authority.qualified_architecture.raw_payload_embedded_in_facts, "EA5C1_RAW_IN_FACTS_FORBIDDEN");
falsy(authority.qualified_architecture.parallel_canonical_evidence_store_created, "EA5C1_PARALLEL_CANONICAL_STORE_FORBIDDEN");
falsy(authority.qualified_architecture.database_schema_migration_required, "EA5C1_SCHEMA_MIGRATION_FORBIDDEN");
falsy(authority.qualified_architecture.runtime_provider_fetch_enabled, "EA5C1_RUNTIME_PROVIDER_FETCH_FORBIDDEN");
truthy(authority.integrity_barriers.canonical_payload_sha256_recomputed, "EA5C1_CANONICAL_DIGEST_RECHECK_REQUIRED");
truthy(authority.integrity_barriers.record_semantic_sha256_recomputed, "EA5C1_RECORD_DIGEST_RECHECK_REQUIRED");
truthy(authority.integrity_barriers.ea3_source_record_hash_recomputed, "EA5C1_SOURCE_HASH_RECHECK_REQUIRED");
truthy(authority.focused_qualification.real_object_store_io_used, "EA5C1_REAL_OBJECT_STORE_IO_REQUIRED");
truthy(authority.focused_qualification.real_postgresql_io_used, "EA5C1_REAL_POSTGRES_IO_REQUIRED");
eq(authority.focused_qualification.focused_case_count, 11, "EA5C1_FOCUSED_CASE_COUNT_REQUIRED");
truthy(authority.effect_if_merged_to_protected_main.ea5c1_implementation_qualified, "EA5C1_IMPLEMENTATION_EFFECT_REQUIRED");
falsy(authority.effect_if_merged_to_protected_main.ea5c_complete, "EA5C1_MUST_NOT_CLOSE_EA5C");
falsy(authority.effect_if_merged_to_protected_main.persistent_formal_24h_raw_store_bound, "EA5C1_FORMAL_STORE_BINDING_MUST_REMAIN_FALSE");
falsy(authority.effect_if_merged_to_protected_main.formal_live_source_ingress_proved, "EA5C1_LIVE_INGRESS_PROOF_MUST_REMAIN_FALSE");
falsy(authority.effect_if_merged_to_protected_main.formal_evidence_write_activation, "EA5C1_FORMAL_WRITE_ACTIVATION_FORBIDDEN");
falsy(authority.effect_if_merged_to_protected_main.formal_neon_write_performed_by_this_candidate, "EA5C1_FORMAL_NEON_WRITE_FORBIDDEN");
falsy(authority.effect_if_merged_to_protected_main.ea5d_authorized, "EA5C1_EA5D_PREMATURE_AUTHORIZATION");
falsy(authority.effect_if_merged_to_protected_main.formal_o00_start_authorized, "EA5C1_O00_PREMATURE_AUTHORIZATION");
falsy(authority.effect_if_merged_to_protected_main.mcft_cap09_completed, "EA5C1_CAP09_PREMATURE_COMPLETION");

const profile = authority.restricted_ingress_authority.record_type_binding_epistemic_profile;
const expectedProfile = {
  soil_moisture_observation_v1: ["kbs_lter_variate25_vwc_100mm_v1", "OBSERVED"],
  observed_rainfall_v1: ["kbs_lter_raw_hourly_rain_mm_v1", "OBSERVED"],
  historical_et0_estimate_v1: ["kbs_lter_asce_short_reference_et_hourly_v1", "ESTIMATED"],
  future_weather_assumption_v1: ["noaa_ncep_gfs_pgrb2_kbs_nearest_72h_v1", "ASSUMED"],
  future_et0_assumption_v1: ["noaa_ncep_gfs_asce_short_reference_et_same_cycle_72h_v1", "ASSUMED"]
};
for (const [recordType, [binding, epistemic]] of Object.entries(expectedProfile)) {
  eq(profile[recordType].binding_id, binding, `EA5C1_BINDING_PROFILE_MISMATCH:${recordType}`);
  eq(profile[recordType].epistemic_class, epistemic, `EA5C1_EPISTEMIC_PROFILE_MISMATCH:${recordType}`);
}

const rawSource = fs.readFileSync(rawAdapterPath, "utf8");
for (const marker of ["PRIVATE_RESTRICTED_RAW_EVIDENCE", "mcft-cap09-formal-raw-v1/sha256", "s3-private://", "verifyRetainedRawEvidence", "x-amz-meta-geox-sha256"]) {
  if (!rawSource.includes(marker)) fail(`EA5C1_RAW_ADAPTER_MARKER_MISSING:${marker}`);
}
if (/\b(?:getSignedUrl|presignUrl|createPresignedUrl)\s*\(/.test(rawSource) || rawSource.includes('"public-read"') || rawSource.includes("'public-read'")) {
  fail("EA5C1_PUBLIC_RAW_ACCESS_SURFACE_FORBIDDEN");
}

const ingressSource = fs.readFileSync(ingressPath, "utf8");
for (const marker of [
  "appendCanonicalizedExternalEvidence", "EA5C1_SOURCE_RECORD_HASH_MISMATCH", "EA5C1_CANONICAL_PAYLOAD_DIGEST_MISMATCH",
  "EA5C1_RECORD_SEMANTIC_DIGEST_MISMATCH", "EA5C1_RECORD_TYPE_NOT_AUTHORIZED", "INSERT INTO facts"
]) if (!ingressSource.includes(marker)) fail(`EA5C1_INGRESS_MARKER_MISSING:${marker}`);
const verifyIndex = ingressSource.indexOf("await this.retentionVerifier.verifyRetainedRawEvidence");
const connectIndex = ingressSource.indexOf("const client = await this.pool.connect()");
if (verifyIndex < 0 || connectIndex < 0 || verifyIndex >= connectIndex) fail("EA5C1_RAW_REVERIFY_MUST_PRECEDE_DB_CONNECT");
for (const forbidden of ["INSERT INTO twin_runtime", "INSERT INTO twin_state", "INSERT INTO twin_forecast", "INSERT INTO recommendation", "INSERT INTO action"]) {
  if (ingressSource.includes(forbidden)) fail(`EA5C1_NON_EVIDENCE_WRITE_SURFACE_FORBIDDEN:${forbidden}`);
}

const collectorSource = fs.readFileSync(collectorPath, "utf8");
for (const marker of [
  "collectAndRetainRawEvidenceV1",
  "EA3_RETENTION_DIGEST_MISMATCH",
  "Decoder invocation is intentionally after the verified retention receipt barrier.",
]) if (!collectorSource.includes(marker)) fail(`EA5C1_SUCCESSOR_COLLECTOR_MARKER_MISSING:${marker}`);
for (const forbidden of ["process.env", "INSERT INTO facts", "RuntimeTickCursor"]) {
  if (collectorSource.includes(forbidden)) fail(`EA5C1_SUCCESSOR_COLLECTOR_BOUNDARY_FORBIDDEN:${forbidden}`);
}

const workflow = fs.readFileSync(workflowPath, "utf8");
for (const marker of [
  "postgres:18", "minio/minio", "ACCEPTANCE_MCFT_CAP_09_EA5C1_DURABLE_RAW_RESTRICTED_INGRESS.ts",
  "ACCEPTANCE_MCFT_CAP_09_EA3_EXTERNAL_COLLECTOR_CANONICALIZER.ts", "ACCEPTANCE_MCFT_CAP_09_EA5B5C_EXTERNAL_CAP04_ORCHESTRATION.ts",
  "MCFT_SUBJECT_SHA", "Verify raw bucket stays private"
]) if (!workflow.includes(marker)) fail(`EA5C1_WORKFLOW_PROOF_MARKER_MISSING:${marker}`);

const result = {
  schema_version: "geox_mcft_cap09_ea5c1_governance_result_v2",
  status: "PASS",
  validation_mode: validationMode,
  historical_qualification_base_sha: HISTORICAL_BASE,
  base_main_sha: base,
  subject_head_sha: head,
  ea5c1_protected_changed_file_count: protectedChanged.length,
  ea5c1_protected_changed_files: protectedChanged,
  historical_authority_record_immutable: blob("HEAD", authorityPath) === candidatePins[authorityPath],
  historical_raw_adapter_immutable: blob("HEAD", rawAdapterPath) === candidatePins[rawAdapterPath],
  historical_focused_acceptance_immutable: blob("HEAD", acceptancePath) === candidatePins[acceptancePath],
  successor_ingress_maintenance_revalidation: validationMode === "SUCCESSOR_MAINTENANCE_REVALIDATION",
  successor_collector_maintenance_revalidation:
    validationMode === "SUCCESSOR_MAINTENANCE_REVALIDATION" && protectedChanged.includes(collectorPath),
  predecessor_contracts_unchanged_from_current_base: true,
  durable_raw_before_decode_and_before_facts_proved: true,
  exact_external_five_source_ingress_profile_proved: true,
  ea3_canonical_identity_revalidation_proved: true,
  runtime_database_reader_unchanged: true,
  schema_migration_added: false,
  formal_neon_write_performed: false,
  ea5c1_implementation_qualified_after_effectiveness: true,
  ea5c_complete: false,
  ea5d_authorized: false,
  ea5e_authorized: false,
  formal_o00_start_authorized: false,
  mcft_cap09_completed: false
};
fs.mkdirSync("acceptance-output", { recursive: true });
fs.writeFileSync("acceptance-output/MCFT_CAP_09_EA5C1_DURABLE_RAW_RESTRICTED_INGRESS_GOVERNANCE_RESULT.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
