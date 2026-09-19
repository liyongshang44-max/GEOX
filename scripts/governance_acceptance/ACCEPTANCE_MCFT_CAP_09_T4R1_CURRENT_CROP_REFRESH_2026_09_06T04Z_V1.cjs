#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const REQUEST = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-CURRENT-CROP-REFRESH-REQUEST-2026-09-06T04Z-V1.json";
const PREVIOUS = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-EFFECTIVE-CURRENT-CROP-AUTHORITY-2026-09-05T04Z-V1.json";
const CURRENT = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-EFFECTIVE-CURRENT-CROP-AUTHORITY-2026-09-06T04Z-V1.json";
const REGISTRY = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json";
const CERT = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-BIOLOGICAL-STAGE-ARCHITECTURE-EFFECTIVENESS-V1.json";

const QUALIFIED_SUBJECT = "76c5b20173cfb130c6f91c4240b154514fd4ee58";
const PROTECTED_MAIN_BASE = "ca2a96d131bc1d3b2935e7b7460752bdbf79f9bd";
const EXPECTED_CURRENT_SHA256 = "sha256:44d7569a142b0ff9355df78f837c18e7e0e93cbf013c154aadfd5d65d1c01bcd";
const EXPECTED_PREVIOUS_SHA256 = "sha256:cac5c82e15b1e3c9b683718f12acb8fb23b084009569b9da133256f1cb4e4119";
const EXPECTED_CERT_SHA256 = "sha256:acffd98b6e014db4d11a3374a50a2e576be3396aef33ed456f7ee104ee72a1c6";
const EXPECTED_REQUEST_SHA256 = "sha256:f55165dbdc6131960a8f63ce93d8a7b63a2849158e71c9a75d8aa5a7f1d845f5";

const abs = (p) => path.join(ROOT, p);
const json = (p) => JSON.parse(fs.readFileSync(abs(p), "utf8"));
const digest = (p) => "sha256:" + crypto.createHash("sha256").update(fs.readFileSync(abs(p))).digest("hex");

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
assert.equal(request.qualification_snapshot.as_of_logical_time, "2026-09-06T04:00:00.000Z");
assert.equal(request.qualification_snapshot.local_day_complete_boundary_utc, "2026-09-06T04:00:00.000Z");
assert.equal(request.qualification_snapshot.last_complete_temperature_local_date, "2026-09-05");
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
assert.equal(current.biological_stage.authority_as_of, "2026-09-06T04:00:00.000Z");
assert.equal(current.biological_stage.forward_stability_hours, 30);
assert.equal(current.biological_stage.authority_valid_until, "2026-09-07T10:00:00.000Z");
assert.equal(current.biological_stage.gdu_bounds.lower_gdu, 2059.686);
assert.equal(current.biological_stage.gdu_bounds.upper_gdu, 2115.306);
assert.equal(current.biological_stage.gdu_bounds.remaining_gdu_lower, 264.694);
assert.equal(current.biological_stage.gdu_bounds.remaining_gdu_upper, 320.314);

assert.equal(current.crop_water_use_stage, "LATE");
assert.equal(current.crop_model_parameter.parameter, "Kc");
assert.equal(current.crop_model_parameter.stage_code, "LATE");
assert.equal(current.crop_model_parameter.value, 0.6);
assert.equal(current.crop_model_parameter.configuration_source_id, "mcft_crop_water_use_corn_v1");
assert.equal(current.crop_model_parameter.configuration_semantic_hash, "sha256:56ac92e34148bd81fe20f2925e1079cb1a3ed647ffefd1471caf1302df70ee4c");
assert.equal(current.crop_model_parameter.production_effective, false);
assert.equal(current.evidence_digest, "sha256:c3641acb7c0600021dba3088c22986a12dedd76fb36cfe2862830f35f9208ac3");
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

assert.equal(previous.biological_stage.authority_as_of, "2026-09-05T04:00:00.000Z");
assert.equal(previous.biological_stage.authority_valid_until, "2026-09-06T10:00:00.000Z");
assert.equal(previous.graduation.status, "EFFECTIVE_FOR_RUNTIME_CONSUMPTION_ROLLING_REFRESH");
assert.equal(cert.status, "EFFECTIVE");
assert.equal(cert.effective, true);
assert.equal(cert.amendment_id, "DT02-AMENDMENT-03");

assert.equal(registry.schema_version, "geox_mcft_cap09_effective_current_crop_authority_registry_v1");
assert.equal(registry.registry_id, "MCFT_CAP09_EFFECTIVE_CURRENT_CROP_AUTHORITY_REGISTRY_V1");
assert.equal(registry.status, "ACTIVE");
assert.equal(registry.selection_policy, "LATEST_EFFECTIVE_AUTHORITY_AS_OF_NOT_AFTER_LOGICAL_TIME_WITHIN_VALIDITY_WINDOW");
assert.equal(registry.candidate_artifacts_admissible, false);
assert.equal(registry.entries.length, 4);
assert.deepEqual(registry.entries[2], {
  authority_ref: PREVIOUS,
  authority_sha256: EXPECTED_PREVIOUS_SHA256,
  authority_as_of: "2026-09-05T04:00:00.000Z",
  authority_valid_until: "2026-09-06T10:00:00.000Z",
  graduation_status: "EFFECTIVE_FOR_RUNTIME_CONSUMPTION_ROLLING_REFRESH",
});
assert.deepEqual(registry.entries[3], {
  authority_ref: CURRENT,
  authority_sha256: EXPECTED_CURRENT_SHA256,
  authority_as_of: "2026-09-06T04:00:00.000Z",
  authority_valid_until: "2026-09-07T10:00:00.000Z",
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
