#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const REQUEST = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-CURRENT-CROP-REFRESH-REQUEST-2026-09-04T04Z-V1.json";
const PREVIOUS = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-EFFECTIVE-CURRENT-CROP-AUTHORITY-V1.json";
const CURRENT = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-EFFECTIVE-CURRENT-CROP-AUTHORITY-2026-09-04T04Z-V1.json";
const CERT = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-BIOLOGICAL-STAGE-ARCHITECTURE-EFFECTIVENESS-V1.json";
const QUALIFIED_SUBJECT = "811101cc958ce6b83efce610bde11b3266ae8326";
const EXPECTED_CURRENT_SHA256 = "sha256:ae14573065fc9b630b9bedfb49147729d73e47f2de469eccf39256d02c195934";
const EXPECTED_PREVIOUS_SHA256 = "sha256:372163dc04c306b37d2874f77be3b4ba0a167ae8d6198ce6ecc1411f2d35f9fb";
const EXPECTED_CERT_SHA256 = "sha256:acffd98b6e014db4d11a3374a50a2e576be3396aef33ed456f7ee104ee72a1c6";
const EXPECTED_REQUEST_SHA256 = "sha256:56c7d29a4116c0daa3cb970fd149d05cff29f51516666dfbbe6769876fd6943a";

const abs = (p) => path.join(ROOT, p);
const json = (p) => JSON.parse(fs.readFileSync(abs(p), "utf8"));
const digest = (p) => "sha256:" + crypto.createHash("sha256").update(fs.readFileSync(abs(p))).digest("hex");
const git = (...args) => cp.execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();

const request = json(REQUEST);
const previous = json(PREVIOUS);
const current = json(CURRENT);
const cert = json(CERT);

assert.equal(digest(REQUEST), EXPECTED_REQUEST_SHA256);
assert.equal(digest(PREVIOUS), EXPECTED_PREVIOUS_SHA256);
assert.equal(digest(CERT), EXPECTED_CERT_SHA256);
assert.equal(digest(CURRENT), EXPECTED_CURRENT_SHA256);
assert.equal(request.previous_effective_current_crop_authority.sha256, EXPECTED_PREVIOUS_SHA256);
assert.equal(request.architecture_effectiveness.sha256, EXPECTED_CERT_SHA256);
assert.equal(request.target_artifact.ref, CURRENT);
assert.equal(request.target_artifact.must_be_immutable, true);
assert.equal(request.target_artifact.must_not_replace_running_preformal_mount, true);
assert.equal(request.previous_effective_current_crop_authority.overwrite_forbidden, true);

assert.equal(current.schema_version, "geox_mcft_cap09_t4r1_current_crop_authority_composition_result_v1");
assert.equal(current.status, "PASS");
assert.equal(current.qualification_outcome, "CURRENT_CROP_CONTEXT_AUTHORITY_CANDIDATE_RESOLVED");
assert.equal(current.subject_head_sha, QUALIFIED_SUBJECT);
assert.equal(current.scope.tenant_id, "tenant_mcft_external");
assert.equal(current.scope.project_id, "project_mcft_cap09");
assert.equal(current.scope.group_id, "group_public_research");
assert.equal(current.scope.field_id, "field_kbs_mcse_t4r1");
assert.equal(current.scope.season_id, "season_2026_corn");
assert.equal(current.scope.zone_id, "zone_kbs_mcse_t4r1_crop_formal_v1");

assert.equal(current.lifecycle.domain_state, "ACTIVE");
assert.equal(current.lifecycle.authority_status, "RESOLVED");
assert.equal(current.lifecycle.authority_validity, "VALID");
assert.equal(current.lifecycle.authority_mode, "GOVERNED_PERSISTENT_STATE");
assert.equal(current.lifecycle.active_consumable_candidate, true);
assert.equal(current.lifecycle.known_termination_result, "NONE_FOUND");
assert.equal(current.lifecycle.known_contradiction_result, "NONE_FOUND");

assert.equal(current.biological_stage.epistemic_class, "THERMAL_MODEL_DERIVED");
assert.equal(current.biological_stage.observed_biological_stage_claimed, false);
assert.equal(current.biological_stage.resolved_biological_stage, "R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE");
assert.equal(current.biological_stage.authority_as_of, "2026-09-04T04:00:00.000Z");
assert.equal(current.biological_stage.forward_stability_hours, 30);
assert.equal(current.biological_stage.authority_valid_until, "2026-09-05T10:00:00.000Z");
assert.equal(current.biological_stage.gdu_bounds.lower_gdu, 2014.452);
assert.equal(current.biological_stage.gdu_bounds.upper_gdu, 2070.072);
assert.equal(current.biological_stage.gdu_bounds.remaining_gdu_lower, 309.928);
assert.equal(current.biological_stage.gdu_bounds.remaining_gdu_upper, 365.548);

assert.equal(current.crop_water_use_stage, "LATE");
assert.equal(current.crop_model_parameter.parameter, "Kc");
assert.equal(current.crop_model_parameter.stage_code, "LATE");
assert.equal(current.crop_model_parameter.value, 0.6);
assert.equal(current.crop_model_parameter.production_effective, false);
assert.equal(current.evidence_digest, "sha256:1d89e3a0f38b4619d44cb6504498641a004144877bb8b38fc8a810bae0d0238e");
assert.equal(current.architecture_effective, true);
assert.equal(current.runtime_consumption_authorized, true);

assert.equal(current.graduation.status, "EFFECTIVE_FOR_RUNTIME_CONSUMPTION_ROLLING_REFRESH");
assert.equal(current.graduation.architecture_effectiveness_sha256, EXPECTED_CERT_SHA256);
assert.equal(current.graduation.architecture_effective_since, cert.issued_at);
assert.equal(current.graduation.refresh_request_sha256, EXPECTED_REQUEST_SHA256);
assert.equal(current.graduation.previous_effective_current_crop_authority_sha256, EXPECTED_PREVIOUS_SHA256);
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

assert.equal(previous.biological_stage.authority_as_of, "2026-09-03T00:00:00.000Z");
assert.equal(previous.graduation.status, "EFFECTIVE_FOR_RUNTIME_CONSUMPTION");
assert.equal(cert.status, "EFFECTIVE");
assert.equal(cert.effective, true);
assert.equal(cert.amendment_id, "DT02-AMENDMENT-03");

cp.execFileSync("git", ["merge-base", "--is-ancestor", QUALIFIED_SUBJECT, "HEAD"], { cwd: ROOT, stdio: "ignore" });

process.stdout.write(JSON.stringify({
  status: "PASS",
  qualified_subject_sha: QUALIFIED_SUBJECT,
  persisted_authority_sha256: EXPECTED_CURRENT_SHA256,
  previous_runtime_mount_sha256: EXPECTED_PREVIOUS_SHA256,
  previous_runtime_mount_preserved: true,
  architecture_effectiveness_sha256: EXPECTED_CERT_SHA256,
  stage: current.biological_stage.resolved_biological_stage,
  authority_as_of: current.biological_stage.authority_as_of,
  authority_valid_until: current.biological_stage.authority_valid_until,
  runtime_consumption_authorized: true,
  running_preformal_mount_replaced: false,
  production_runtime_restarted: false,
  formal_v5_authorized: false,
  a0_authorized: false,
  o00_o23_authorized: false,
  mcft_cap09_completed: false,
}, null, 2) + "\n");
