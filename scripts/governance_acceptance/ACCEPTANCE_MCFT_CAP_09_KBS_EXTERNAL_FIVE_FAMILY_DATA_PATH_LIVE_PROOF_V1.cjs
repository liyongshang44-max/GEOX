#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const crypto = require("node:crypto");

const PROOF = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-KBS-EXTERNAL-FIVE-FAMILY-DATA-PATH-LIVE-PROOF-V1.json";
const AMENDMENT = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-11-PROVIDER-AVAILABILITY-WATERMARK-AUTHORITY.md";
const EXPECTED = Object.freeze({
  subject_sha: "21f3bb783cb80a826743f77ff2b707233e9d0068",
  workflow_run_id: 31772432163,
  workflow_job_id: 94680993352,
  artifact_id: 9208639624,
  artifact_digest: "sha256:02c65d68839437dee9d7e61540bbe6cde1e55c7c2d9bcdc5a6f7aa588a4435db",
  target_t: "2026-08-13T15:00:00.000Z",
  producer_subject_sha: "37a36ba52d7ef7891d72cc1385314ec453511296",
  producer_workflow_run_id: 31705733712,
  producer_artifact_id: 9185700449,
  producer_artifact_digest: "sha256:8312c4ff063627964344b5c3f34ecc46e4e0901a1e4bc4478b291af13f297a51",
});
const REQUIRED_TYPES = [
  "future_et0_assumption_v1",
  "future_weather_assumption_v1",
  "historical_et0_estimate_v1",
  "observed_rainfall_v1",
  "soil_moisture_observation_v1",
];

function fail(code) { throw new Error(code); }
function requireTrue(value, code) { if (!value) fail(code); }

requireTrue(fs.existsSync(PROOF), "MCFT_CAP09_KBS_FIVE_FAMILY_LIVE_PROOF_REQUIRED");
requireTrue(fs.existsSync(AMENDMENT), "MCFT_CAP09_KBS_FIVE_FAMILY_AMENDMENT11_REQUIRED");
const proofBytes = fs.readFileSync(PROOF);
const proof = JSON.parse(proofBytes.toString("utf8"));
const amendment = fs.readFileSync(AMENDMENT, "utf8");

requireTrue(proof.schema_version === "geox_mcft_cap09_kbs_external_five_family_data_path_live_proof_v1", "MCFT_CAP09_KBS_FIVE_FAMILY_SCHEMA");
requireTrue(proof.status === "PASS", "MCFT_CAP09_KBS_FIVE_FAMILY_STATUS");
requireTrue(proof.proof_class === "EXACT_PROTECTED_MAIN_REAL_FIVE_FAMILY_DATA_PATH_QUALIFICATION", "MCFT_CAP09_KBS_FIVE_FAMILY_PROOF_CLASS");
requireTrue(proof.temporal_authority === "PROVIDER_AVAILABILITY_WATERMARK_V1", "MCFT_CAP09_KBS_FIVE_FAMILY_AUTHORITY");
requireTrue(proof.subject_sha === EXPECTED.subject_sha, "MCFT_CAP09_KBS_FIVE_FAMILY_SUBJECT");
requireTrue(proof.workflow_run_id === EXPECTED.workflow_run_id, "MCFT_CAP09_KBS_FIVE_FAMILY_RUN");
requireTrue(proof.workflow_job_id === EXPECTED.workflow_job_id, "MCFT_CAP09_KBS_FIVE_FAMILY_JOB");
requireTrue(proof.artifact_id === EXPECTED.artifact_id, "MCFT_CAP09_KBS_FIVE_FAMILY_ARTIFACT");
requireTrue(proof.artifact_digest === EXPECTED.artifact_digest, "MCFT_CAP09_KBS_FIVE_FAMILY_ARTIFACT_DIGEST");
requireTrue(proof.target_t === EXPECTED.target_t, "MCFT_CAP09_KBS_FIVE_FAMILY_TARGET");

requireTrue(proof.producer.subject_sha === EXPECTED.producer_subject_sha, "MCFT_CAP09_KBS_FIVE_FAMILY_PRODUCER_SHA");
requireTrue(proof.producer.workflow_run_id === EXPECTED.producer_workflow_run_id, "MCFT_CAP09_KBS_FIVE_FAMILY_PRODUCER_RUN");
requireTrue(proof.producer.artifact_id === EXPECTED.producer_artifact_id, "MCFT_CAP09_KBS_FIVE_FAMILY_PRODUCER_ARTIFACT");
requireTrue(proof.producer.artifact_digest === EXPECTED.producer_artifact_digest, "MCFT_CAP09_KBS_FIVE_FAMILY_PRODUCER_DIGEST");

requireTrue(proof.qualification_state.kbs_authoritative_late_path === "PASS", "MCFT_CAP09_KBS_FIVE_FAMILY_LATE_PATH_PASS");
requireTrue(proof.qualification_state.kbs_causal_intersection === "PASS", "MCFT_CAP09_KBS_FIVE_FAMILY_INTERSECTION_PASS");
requireTrue(proof.qualification_state.cross_head_rehydration === "PASS", "MCFT_CAP09_KBS_FIVE_FAMILY_REHYDRATION_PASS");
requireTrue(proof.qualification_state.kbs_external_five_family_data_path_qualified === true, "MCFT_CAP09_KBS_FIVE_FAMILY_QUALIFIED");
requireTrue(proof.qualification_state.cap04_runtime_successor_qualified === false, "MCFT_CAP09_KBS_FIVE_FAMILY_CAP04_NONCLAIM");
requireTrue(proof.qualification_state.crop_authority_effect === "NONE", "MCFT_CAP09_KBS_FIVE_FAMILY_CROP_NONE");
requireTrue(proof.qualification_state.ea5e2_operational_activation_qualified === false, "MCFT_CAP09_KBS_FIVE_FAMILY_EA5E2_NONCLAIM");
requireTrue(proof.qualification_state.full_operational_go === false, "MCFT_CAP09_KBS_FIVE_FAMILY_FULL_GO_NONCLAIM");

requireTrue(proof.provider_contract.provider_identity === "KBS_LTER", "MCFT_CAP09_KBS_FIVE_FAMILY_PROVIDER");
requireTrue(proof.provider_contract.provider_publication_cadence === "DAILY_BATCH", "MCFT_CAP09_KBS_FIVE_FAMILY_DAILY_BATCH");
requireTrue(proof.provider_contract.observation_resolution === "HOURLY", "MCFT_CAP09_KBS_FIVE_FAMILY_HOURLY_RESOLUTION");
requireTrue(proof.provider_contract.exact_kbs_target === true, "MCFT_CAP09_KBS_FIVE_FAMILY_EXACT_TARGET");
requireTrue(proof.provider_contract.freshness_is_late_authoritative_admission_gate === false, "MCFT_CAP09_KBS_FIVE_FAMILY_FRESHNESS_NOT_GATE");
requireTrue(proof.provider_contract.kbs_provider_request_count === 1, "MCFT_CAP09_KBS_FIVE_FAMILY_ONE_KBS_GET");
requireTrue(proof.provider_contract.kbs_provider_retry_count === 0, "MCFT_CAP09_KBS_FIVE_FAMILY_NO_RETRY");
requireTrue(proof.provider_contract.kbs_source_substitution_allowed === false, "MCFT_CAP09_KBS_FIVE_FAMILY_NO_SUBSTITUTION");
requireTrue(proof.provider_contract.kbs_raw_retained_before_decode === true, "MCFT_CAP09_KBS_FIVE_FAMILY_RAW_FIRST");

const rehydrate = proof.cross_head_rehydration_proof;
requireTrue(rehydrate.consumer_subject_sha === EXPECTED.subject_sha, "MCFT_CAP09_KBS_FIVE_FAMILY_REHYDRATE_CONSUMER");
requireTrue(rehydrate.producer_subject_sha === EXPECTED.producer_subject_sha, "MCFT_CAP09_KBS_FIVE_FAMILY_REHYDRATE_PRODUCER");
requireTrue(rehydrate.cross_head_rehydration === true, "MCFT_CAP09_KBS_FIVE_FAMILY_CROSS_HEAD_REQUIRED");
requireTrue(rehydrate.semantic_manifest_match === true, "MCFT_CAP09_KBS_FIVE_FAMILY_SEMANTIC_MATCH");
requireTrue(rehydrate.producer_bound_raw_reverification === true, "MCFT_CAP09_KBS_FIVE_FAMILY_RAW_REVERIFY");
requireTrue(rehydrate.producer_dataset_identity_preserved === true, "MCFT_CAP09_KBS_FIVE_FAMILY_DATASET_IDENTITY");
requireTrue(rehydrate.producer_decoder_identity_preserved === true, "MCFT_CAP09_KBS_FIVE_FAMILY_DECODER_IDENTITY");
requireTrue(rehydrate.provider_refetch_count === 0, "MCFT_CAP09_KBS_FIVE_FAMILY_NO_PRE_PROVIDER_REFETCH");
requireTrue(rehydrate.private_r2_put_count === 0 && rehydrate.private_r2_delete_count === 0, "MCFT_CAP09_KBS_FIVE_FAMILY_REHYDRATE_READ_ONLY_R2");
requireTrue(rehydrate.isolated_database_fact_count === 3 && rehydrate.isolated_database_write_count === 3, "MCFT_CAP09_KBS_FIVE_FAMILY_PRE_DB_THREE");

const pkg = proof.five_family_package;
requireTrue(pkg.preboundary_family_count === 3 && pkg.kbs_family_count === 2, "MCFT_CAP09_KBS_FIVE_FAMILY_3_PLUS_2");
requireTrue(pkg.isolated_database_fact_count === 5 && pkg.isolated_database_new_kbs_fact_count === 2, "MCFT_CAP09_KBS_FIVE_FAMILY_DB_FIVE");
requireTrue(JSON.stringify([...pkg.record_types].sort()) === JSON.stringify([...REQUIRED_TYPES].sort()), "MCFT_CAP09_KBS_FIVE_FAMILY_EXACT_SET");
requireTrue(pkg.exact_kbs_interval_end_equals_target_t === true, "MCFT_CAP09_KBS_FIVE_FAMILY_INTERVAL_END_TARGET");

const retention = proof.private_transient_retention;
requireTrue(retention.kbs_raw_put_count === 1, "MCFT_CAP09_KBS_FIVE_FAMILY_R2_PUT_ONE");
requireTrue(retention.kbs_raw_head_count === 3, "MCFT_CAP09_KBS_FIVE_FAMILY_R2_HEAD_THREE");
requireTrue(retention.kbs_raw_cleanup_count === 1 && retention.kbs_raw_cleanup_confirmed === true, "MCFT_CAP09_KBS_FIVE_FAMILY_R2_CLEANUP");

const effects = proof.qualification_side_effects;
requireTrue(effects.formal_database_write_count === 0, "MCFT_CAP09_KBS_FIVE_FAMILY_FORMAL_DB_ZERO");
requireTrue(effects.formal_r2_prefix_write_count === 0, "MCFT_CAP09_KBS_FIVE_FAMILY_FORMAL_R2_ZERO");
requireTrue(effects.scheduler_write_count === 0, "MCFT_CAP09_KBS_FIVE_FAMILY_SCHEDULER_ZERO");
requireTrue(effects.runtime_write_count === 0, "MCFT_CAP09_KBS_FIVE_FAMILY_RUNTIME_ZERO");
requireTrue(effects.formal_effect === false && effects.raw_values_emitted === false, "MCFT_CAP09_KBS_FIVE_FAMILY_SAFE_EFFECTS");

requireTrue(proof.nonclaims.cap04_runtime_successor_qualified === false, "MCFT_CAP09_KBS_FIVE_FAMILY_NONCLAIM_CAP04");
requireTrue(proof.nonclaims.crop_authority_effect === "NONE", "MCFT_CAP09_KBS_FIVE_FAMILY_NONCLAIM_CROP");
requireTrue(proof.nonclaims.ea5e2_operational_activation_qualified === false, "MCFT_CAP09_KBS_FIVE_FAMILY_NONCLAIM_EA5E2");
requireTrue(proof.nonclaims.full_operational_go === false, "MCFT_CAP09_KBS_FIVE_FAMILY_NONCLAIM_FULL_GO");
requireTrue(proof.nonclaims.formal_window_started === false, "MCFT_CAP09_KBS_FIVE_FAMILY_NONCLAIM_FORMAL_WINDOW");
requireTrue(proof.nonclaims.batch_to_hourly_injector_qualified === false, "MCFT_CAP09_KBS_FIVE_FAMILY_NONCLAIM_INJECTOR");

requireTrue(amendment.includes("provider_publication_cadence = daily_batch"), "MCFT_CAP09_KBS_FIVE_FAMILY_AMENDMENT11_DAILY_BATCH");
requireTrue(amendment.includes("observation_resolution = hourly"), "MCFT_CAP09_KBS_FIVE_FAMILY_AMENDMENT11_HOURLY");
requireTrue(amendment.includes("PROVIDER_AVAILABILITY_WATERMARK_V1"), "MCFT_CAP09_KBS_FIVE_FAMILY_AMENDMENT11_WATERMARK");

console.log(JSON.stringify({
  schema_version: "geox_mcft_cap09_kbs_external_five_family_data_path_live_proof_acceptance_v1",
  status: "PASS",
  subject_sha: proof.subject_sha,
  workflow_run_id: proof.workflow_run_id,
  workflow_job_id: proof.workflow_job_id,
  artifact_id: proof.artifact_id,
  artifact_digest: proof.artifact_digest,
  target_t: proof.target_t,
  record_types: proof.five_family_package.record_types,
  kbs_external_five_family_data_path_qualified: true,
  cap04_runtime_successor_qualified: false,
  crop_authority_effect: "NONE",
  ea5e2_operational_activation_qualified: false,
  full_operational_go: false,
  proof_file_sha256: `sha256:${crypto.createHash("sha256").update(proofBytes).digest("hex")}`
}));
