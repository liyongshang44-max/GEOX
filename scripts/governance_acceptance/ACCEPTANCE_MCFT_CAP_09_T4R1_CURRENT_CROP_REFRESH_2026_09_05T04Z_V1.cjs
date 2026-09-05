#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const REQUEST = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-CURRENT-CROP-REFRESH-REQUEST-2026-09-05T04Z-V1.json";
const PREVIOUS = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-EFFECTIVE-CURRENT-CROP-AUTHORITY-2026-09-04T04Z-V1.json";
const CURRENT = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-EFFECTIVE-CURRENT-CROP-AUTHORITY-2026-09-05T04Z-V1.json";
const REGISTRY = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json";
const CERT = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-BIOLOGICAL-STAGE-ARCHITECTURE-EFFECTIVENESS-V1.json";

const QUALIFIED_SUBJECT = "93d08e4003370221218471e53a58ad356c34e3b9";
const PROTECTED_MAIN_BASE = "e1f8b078bb8459ecb9a77d1fad0d95f4bf143221";
const EXPECTED_CURRENT_SHA256 = "sha256:49c278fd5693fe9a61cbf2a10553b67e8e817506854b86e7951797c60561a771";
const EXPECTED_PREVIOUS_SHA256 = "sha256:ae14573065fc9b630b9bedfb49147729d73e47f2de469eccf39256d02c195934";
const EXPECTED_CERT_SHA256 = "sha256:acffd98b6e014db4d11a3374a50a2e576be3396aef33ed456f7ee104ee72a1c6";
const EXPECTED_REQUEST_SHA256 = "sha256:e983ad6c3b0b71271cb535dd1b99b160a61911da6bd0a9678c151ac2fb651ce4";

const abs = (p) => path.join(ROOT, p);
const json = (p) => JSON.parse(fs.readFileSync(abs(p), "utf8"));
const digest = (p) => "sha256:" + crypto.createHash("sha256").update(fs.readFileSync(abs(p))).digest("hex");
const git = (...args) => cp.execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();

const request = json(REQUEST);
const previous = json(PREVIOUS);
const current = json(CURRENT);
const registry = json(REGISTRY);
const cert = json(CERT);

assert.equal(digest(REQUEST), EXPECTED_REQUEST_SHA256);
assert.equal(digest(PREVIOUS), EXPECTED_PREVIOUS_SHA256);
assert.equal(digest(CERT), EXPECTED_CERT_SHA256);
assert.equal(digest(CURRENT), EXPECTED_CURRENT_SHA256);

assert.equal(request.schema_version, "geox_mcft_cap09_t4r1_current_crop_refresh_request_v1");
assert.equal(request.status, "QUALIFICATION_ONLY_REQUESTED");
assert.equal(request.protected_main_base_sha, PROTECTED_MAIN_BASE);
assert.equal(request.previous_effective_current_crop_authority.ref, PREVIOUS);
assert.equal(request.previous_effective_current_crop_authority.sha256, EXPECTED_PREVIOUS_SHA256);
assert.equal(request.previous_effective_current_crop_authority.overwrite_forbidden, true);
assert.equal(request.architecture_effectiveness.sha256, EXPECTED_CERT_SHA256);
assert.equal(request.target_artifact.ref, CURRENT);
assert.equal(request.target_artifact.must_be_immutable, true);
assert.equal(request.target_artifact.must_not_replace_running_preformal_mount, true);
assert.equal(request.qualification_snapshot.as_of_logical_time, "2026-09-05T04:00:00.000Z");
assert.equal(request.qualification_snapshot.local_day_complete_boundary_utc, "2026-09-05T04:00:00.000Z");
assert.equal(request.qualification_snapshot.last_complete_temperature_local_date, "2026-09-04");
assert.equal(request.qualification_snapshot.future_observations_authorized, false);
assert.equal(request.forward_stability_hours, 30);

assert.equal(current.schema_version, "geox_mcft_cap09_t4r1_current_crop_authority_composition_result_v1");
assert.equal(current.status, "PASS");
assert.equal(current.qualification_outcome, "CURRENT_CROP_CONTEXT_AUTHORITY_CANDIDATE_RESOLVED");
assert.equal(current.subject_head_sha, QUALIFIED_SUBJECT);
assert.deepEqual(current.scope, request.scope);

assert.equal(current.lifecycle.domain_state, "ACTIVE");
assert.equal(current.lifecycle.authority_status, "RESOLVED");
assert.equal(current.lifecycle.authority_validity, "VALID");
assert.equal(current.lifecycle.authority_mode, "GOVERNED_PERSISTENT_STATE");
assert.equal(current.lifecycle.active_consumable_candidate, true);
assert.equal(current.lifecycle.known_termination_result, "NONE_FOUND");
assert.equal(current.lifecycle.known_contradiction_result, "NONE_FOUND");
assert.equal(current.lifecycle.horizon_end_utc, "2026-11-24T03:59:59.999Z");

assert.equal(current.biological_stage.epistemic_class, "THERMAL_MODEL_DERIVED");
assert.equal(current.biological_stage.observed_biological_stage_claimed, false);
assert.equal(current.biological_stage.resolved_biological_stage, "R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE");
assert.equal(current.biological_stage.authority_as_of, "2026-09-05T04:00:00.000Z");
assert.equal(current.biological_stage.forward_stability_hours, 30);
assert.equal(current.biological_stage.authority_valid_until, "2026-09-06T10:00:00.000Z");
assert.equal(current.biological_stage.gdu_bounds.lower_gdu, 2039.391);
assert.equal(current.biological_stage.gdu_bounds.upper_gdu, 2095.011);
assert.equal(current.biological_stage.gdu_bounds.remaining_gdu_lower, 284.989);
assert.equal(current.biological_stage.gdu_bounds.remaining_gdu_upper, 340.609);

assert.equal(current.crop_water_use_stage, "LATE");
assert.equal(current.crop_model_parameter.parameter, "Kc");
assert.equal(current.crop_model_parameter.stage_code, "LATE");
assert.equal(current.crop_model_parameter.value, 0.6);
assert.equal(current.crop_model_parameter.configuration_source_id, "mcft_crop_water_use_corn_v1");
assert.equal(current.crop_model_parameter.configuration_semantic_hash, "sha256:56ac92e34148bd81fe20f2925e1079cb1a3ed647ffefd1471caf1302df70ee4c");
assert.equal(current.crop_model_parameter.production_effective, false);
assert.equal(current.evidence_digest, "sha256:858924611efc07473cbf7e2e60465fadbf404a8d7847c8e75115415bf78eac7c");
assert.equal(current.architecture_effective, true);
assert.equal(current.runtime_consumption_authorized, true);

assert.equal(current.graduation.status, "EFFECTIVE_FOR_RUNTIME_CONSUMPTION_ROLLING_REFRESH");
assert.equal(current.graduation.amendment_id, "DT02-AMENDMENT-03");
assert.equal(current.graduation.architecture_effectiveness_sha256, EXPECTED_CERT_SHA256);
assert.equal(current.graduation.architecture_effective_since, cert.issued_at);
assert.equal(current.graduation.refresh_request_sha256, EXPECTED_REQUEST_SHA256);
assert.equal(current.graduation.refresh_protected_main_base_sha, PROTECTED_MAIN_BASE);
assert.equal(current.graduation.previous_effective_current_crop_authority_sha256, EXPECTED_PREVIOUS_SHA256);
assert.equal(current.refresh.request_id, request.request_id);
assert.equal(current.refresh.target_artifact_ref, CURRENT);
assert.equal(current.refresh.running_preformal_mount_replaced, false);
assert.equal(current.refresh.production_runtime_restarted, false);

for (const key of [
  "runtime_config_write_authorized",
  "database_write_authorized",
  "scheduler_write_authorized",
  "formal_evidence_write_authorized",
  "production_runtime_start_authorized",
  "production_owner_activation_authorized",
  "formal_v5_authorized",
  "a0_authorized",
  "o00_o23_authorized",
  "mcft_cap09_completed",
]) assert.equal(current[key], false, `CURRENT_CROP_REFRESH_AUTHORITY_CEILING_DRIFT:${key}`);

assert.equal(previous.biological_stage.authority_as_of, "2026-09-04T04:00:00.000Z");
assert.equal(previous.biological_stage.authority_valid_until, "2026-09-05T10:00:00.000Z");
assert.equal(previous.graduation.status, "EFFECTIVE_FOR_RUNTIME_CONSUMPTION_ROLLING_REFRESH");
assert.equal(cert.status, "EFFECTIVE");
assert.equal(cert.effective, true);
assert.equal(cert.amendment_id, "DT02-AMENDMENT-03");

assert.equal(registry.schema_version, "geox_mcft_cap09_effective_current_crop_authority_registry_v1");
assert.equal(registry.registry_id, "MCFT_CAP09_EFFECTIVE_CURRENT_CROP_AUTHORITY_REGISTRY_V1");
assert.equal(registry.status, "ACTIVE");
assert.equal(registry.selection_policy, "LATEST_EFFECTIVE_AUTHORITY_AS_OF_NOT_AFTER_LOGICAL_TIME_WITHIN_VALIDITY_WINDOW");
assert.equal(registry.candidate_artifacts_admissible, false);
assert.equal(registry.entries.length, 3);
assert.deepEqual(registry.entries[0], {
  authority_ref: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-EFFECTIVE-CURRENT-CROP-AUTHORITY-V1.json",
  authority_sha256: "sha256:372163dc04c306b37d2874f77be3b4ba0a167ae8d6198ce6ecc1411f2d35f9fb",
  authority_as_of: "2026-09-03T00:00:00.000Z",
  authority_valid_until: "2026-09-04T06:00:00.000Z",
  graduation_status: "EFFECTIVE_FOR_RUNTIME_CONSUMPTION",
});
assert.deepEqual(registry.entries[1], {
  authority_ref: PREVIOUS,
  authority_sha256: EXPECTED_PREVIOUS_SHA256,
  authority_as_of: "2026-09-04T04:00:00.000Z",
  authority_valid_until: "2026-09-05T10:00:00.000Z",
  graduation_status: "EFFECTIVE_FOR_RUNTIME_CONSUMPTION_ROLLING_REFRESH",
});
assert.deepEqual(registry.entries[2], {
  authority_ref: CURRENT,
  authority_sha256: EXPECTED_CURRENT_SHA256,
  authority_as_of: "2026-09-05T04:00:00.000Z",
  authority_valid_until: "2026-09-06T10:00:00.000Z",
  graduation_status: "EFFECTIVE_FOR_RUNTIME_CONSUMPTION_ROLLING_REFRESH",
});
for (const [key, value] of Object.entries(registry.non_effects || {})) {
  assert.equal(value, false, `CURRENT_CROP_REGISTRY_NON_EFFECT_DRIFT:${key}`);
}

cp.execFileSync("git", ["merge-base", "--is-ancestor", QUALIFIED_SUBJECT, "HEAD"], { cwd: ROOT, stdio: "ignore" });

process.stdout.write(JSON.stringify({
  status: "PASS",
  qualified_subject_sha: QUALIFIED_SUBJECT,
  protected_main_base_sha: PROTECTED_MAIN_BASE,
  persisted_authority_sha256: EXPECTED_CURRENT_SHA256,
  previous_effective_authority_sha256: EXPECTED_PREVIOUS_SHA256,
  architecture_effectiveness_sha256: EXPECTED_CERT_SHA256,
  authority_as_of: current.biological_stage.authority_as_of,
  authority_valid_until: current.biological_stage.authority_valid_until,
  lifecycle_horizon_end_utc: current.lifecycle.horizon_end_utc,
  stage: current.biological_stage.resolved_biological_stage,
  water_use_stage: current.crop_water_use_stage,
  kc: current.crop_model_parameter.value,
  registry_entry_count: registry.entries.length,
  candidate_artifacts_admissible: registry.candidate_artifacts_admissible,
  runtime_consumption_authorized: current.runtime_consumption_authorized,
  production_runtime_restarted: false,
  formal_v5_authorized: false,
  a0_authorized: false,
  o00_o23_authorized: false,
  mcft_cap09_completed: false,
}, null, 2) + "\n");
