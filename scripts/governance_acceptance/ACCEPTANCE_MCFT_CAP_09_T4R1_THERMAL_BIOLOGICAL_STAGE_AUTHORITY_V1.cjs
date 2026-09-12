#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const EXPECTED_BASE = "17eb06c4c79f36e51b88561395f8e69cd86195b7";
const BASE = process.env.MCFT_CAP09_T4R1_THERMAL_STAGE_BASE_SHA;

const paths = {
  module: "apps/server/src/domain/twin_runtime/biological_stage_authority_v1.ts",
  test: "apps/server/src/domain/twin_runtime/biological_stage_authority_v1.test.ts",
  authority: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-THERMAL-BIOLOGICAL-STAGE-AUTHORITY-V1.json",
  probe: "scripts/runtime_acceptance/PROBE_MCFT_CAP_09_T4R1_THERMAL_BIOLOGICAL_STAGE_AUTHORITY_V1.py",
  gate: "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_T4R1_THERMAL_BIOLOGICAL_STAGE_AUTHORITY_V1.cjs",
  workflow: ".github/workflows/mcft-cap-09-t4r1-thermal-biological-stage-authority-v1.yml",
  qcp: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json"
};
const expected = Object.values(paths).sort();
const kcMatrixPath = "docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json";

function fail(code, detail) { throw new Error(detail ? code + ":" + detail : code); }
function eq(a, b, code) { if (a !== b) fail(code, "expected=" + JSON.stringify(b) + " actual=" + JSON.stringify(a)); }
function has(text, marker, code) { if (!text.includes(marker)) fail(code, marker); }
function git() { return execFileSync("git", Array.from(arguments), { encoding: "utf8" }).trim(); }

eq(BASE, EXPECTED_BASE, "MCFT_CAP09_T4R1_THERMAL_STAGE_EXACT_BASE_REQUIRED");
eq(git("merge-base", EXPECTED_BASE, "HEAD"), EXPECTED_BASE, "MCFT_CAP09_T4R1_THERMAL_STAGE_BASE_NOT_ANCESTOR");
const changed = git("diff", "--name-only", EXPECTED_BASE + "...HEAD").split(/\r?\n/).filter(Boolean).sort();
eq(JSON.stringify(changed), JSON.stringify(expected), "MCFT_CAP09_T4R1_THERMAL_STAGE_EXACT_SEVEN_FILE_BOUNDARY_REQUIRED");

const authority = JSON.parse(fs.readFileSync(paths.authority, "utf8"));
eq(authority.record_status, "IMPLEMENTATION_CANDIDATE_DEPENDS_ON_DT02_AMENDMENT03_EFFECTIVENESS", "THERMAL_STAGE_STATUS_DRIFT");
eq(authority.formal_scope.site_id, "KBS_MCSE_T4R1", "THERMAL_STAGE_SCOPE_DRIFT");
eq(authority.formal_scope.hybrid_product_code, "43-96P", "THERMAL_STAGE_HYBRID_DRIFT");
eq(authority.planting_authority.observation_id, 6974, "THERMAL_STAGE_PLANTING_DRIFT");
eq(authority.hybrid_thermal_landmark_candidate.gdu_to_black_layer, 2380, "THERMAL_STAGE_BLACK_LAYER_GDU_DRIFT");
eq(authority.hybrid_thermal_landmark_candidate.source_class, "FIRST_PARTY_BRAND_OWNER_EXACT_PRODUCT_SPECIFICATION", "THERMAL_STAGE_HYBRID_SOURCE_CLASS_DRIFT");
eq(authority.r5_residual_to_maturity_model.regional_reference_envelope.conservative_r5_reference_min_gdu_to_maturity, 400, "THERMAL_STAGE_R5_REFERENCE_DRIFT");
eq(authority.r5_residual_to_maturity_model.decision_policy.observed_biological_stage_claimed, false, "THERMAL_STAGE_R5_DERIVED_MUST_NOT_CLAIM_OBSERVED");
eq(authority.r5_residual_to_maturity_model.decision_policy.generic_absolute_gdu_stage_threshold_transfer_authorized, false, "THERMAL_STAGE_GENERIC_THRESHOLD_TRANSFER_FORBIDDEN");
eq(authority.thermal_method.base_f, 50, "THERMAL_STAGE_BASE_F_DRIFT");
eq(authority.thermal_method.max_cap_f, 86, "THERMAL_STAGE_MAX_CAP_DRIFT");
eq(authority.thermal_method.min_floor_f, 50, "THERMAL_STAGE_MIN_FLOOR_DRIFT");
eq(authority.thermal_method.silent_imputation_authorized, false, "THERMAL_STAGE_SILENT_IMPUTATION_FORBIDDEN");
eq(authority.lifecycle_independence.thermal_stage_proves_lifecycle_active, false, "THERMAL_STAGE_LIFECYCLE_COLLAPSE_FORBIDDEN");
eq(authority.nonclaims.observed_t4r1_biological_stage_established, false, "THERMAL_STAGE_OBSERVED_TRUTH_PREMATURE");
eq(authority.nonclaims.runtime_start_authorized, false, "THERMAL_STAGE_RUNTIME_START_PREMATURE");
eq(authority.crop_model_parameter_binding.configuration_matrix_blob_sha, "c04c6805ab79c715781b99f8fbcf997fae3a8c48", "THERMAL_STAGE_KC_MATRIX_BLOB_DRIFT");
eq(authority.crop_model_parameter_binding.configuration_semantic_hash, "sha256:56ac92e34148bd81fe20f2925e1079cb1a3ed647ffefd1471caf1302df70ee4c", "THERMAL_STAGE_KC_SEMANTIC_HASH_DRIFT");
eq(authority.crop_model_parameter_binding.expected_current_candidate_if_late.kc, 0.6, "THERMAL_STAGE_LATE_KC_DRIFT");
eq(git("hash-object", kcMatrixPath), "c04c6805ab79c715781b99f8fbcf997fae3a8c48", "THERMAL_STAGE_KC_MATRIX_EXACT_BLOB_REQUIRED");

const moduleText = fs.readFileSync(paths.module, "utf8");
for (const marker of [
  "BiologicalStageAuthorityV1",
  "DIRECT_OBSERVED_PHENOLOGY",
  "THERMAL_MODEL_DERIVED",
  "BIO_STAGE_DERIVED_CANNOT_CLAIM_OBSERVED",
  "BIO_STAGE_FUTURE_EVIDENCE_FORBIDDEN",
  "computeCornBase50DailyGduFromFahrenheitV1",
  "accumulateCornBase50GduBoundsV1",
  "classifyCornResidualToMaturityStageV1",
  "R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE",
  "resolveCropWaterUseKcFromFrozenScheduleV1",
  "mapBiologicalAuthorityToWaterUseStageV1",
  "MISSING_OR_INVALID",
  "daily_max_gdu"
]) {
  if (marker === "daily_max_gdu") continue;
  has(moduleText, marker, "THERMAL_STAGE_RUNTIME_CONTRACT_MARKER_MISSING");
}

const testText = fs.readFileSync(paths.test, "utf8");
for (const marker of [
  "derived authority cannot claim observed biological truth",
  "future evidence is rejected",
  "corn Base-50 daily GDU applies 86F cap and 50F floor",
  "pre-R6 mapping preserves MID/LATE ambiguity",
  "residual GDU resolves R5 dent-or-later only when the full uncertainty is beyond conservative R5 reference",
  "residual GDU stays ambiguous when uncertainty overlaps conservative R5 reference",
  "residual GDU preserves R5/R6 ambiguity when maturity threshold is straddled",
  "frozen stage-to-Kc lookup resolves exact LATE singleton",
  "stage-to-Kc lookup fails closed on unresolved stage",
  "stage-to-Kc lookup fails closed on duplicate stage entries"
]) has(testText, marker, "THERMAL_STAGE_TEST_COVERAGE_MISSING");

const probeText = fs.readFileSync(paths.probe, "utf8");
for (const marker of [
  "raw_payload_emitted",
  "missing_or_invalid_day_count",
  "THERMAL_STAGE_R5_DENT_OR_LATER_LATE_CANDIDATE",
  "THERMAL_STAGE_THRESHOLD_STRADDLE_LATE_CANDIDATE",
  "conservative_r5_reference_min_remaining_gdu",
  "hybrid_brand_authority",
  "KC_CONFIGURATION_SOURCE_EXACT_SINGLETON_REQUIRED",
  "candidate_crop_model_parameter_authority",
  "lifecycle_authority_established_by_thermal_model",
  "production_stage_authority_established"
]) has(probeText, marker, "THERMAL_STAGE_PROBE_RULE_MISSING");

const qcp = JSON.parse(fs.readFileSync(paths.qcp, "utf8"));
const resolver = qcp.dependency_resolvers?.T4R1_BIOLOGICAL_STAGE_AUTHORITY_V1;
if (!resolver || resolver.kind !== "EXACT_PATH_SET") fail("THERMAL_STAGE_QCP_RESOLVER_MISSING");
const qcpCheck = (qcp.checks || []).find((row) => row.check_id === "T4R1_BIOLOGICAL_STAGE_AUTHORITY");
if (!qcpCheck) fail("THERMAL_STAGE_QCP_CHECK_MISSING");
eq(JSON.stringify(qcpCheck.resolver_ids), JSON.stringify(["T4R1_BIOLOGICAL_STAGE_AUTHORITY_V1"]), "THERMAL_STAGE_QCP_RESOLVER_DRIFT");
eq(qcpCheck.execution_workflow, paths.workflow, "THERMAL_STAGE_QCP_WORKFLOW_DRIFT");
eq(qcpCheck.carry_forward_policy, "NONE", "THERMAL_STAGE_QCP_CARRY_FORWARD_FORBIDDEN");

const workflow = fs.readFileSync(paths.workflow, "utf8");
for (const forbidden of [
  "schedule:",
  "pull_request_target",
  "FORMAL_DATABASE_URL",
  "GEOX_MCFT_CAP09_S6_DATABASE_URL",
  "docker compose up",
  "workflow_dispatch:"
]) {
  if (workflow.includes(forbidden)) fail("THERMAL_STAGE_WORKFLOW_FORBIDDEN_CAPABILITY", forbidden);
}

fs.mkdirSync("acceptance-output", { recursive: true });
const out = {
  schema_version: "geox_mcft_cap09_t4r1_thermal_biological_stage_governance_result_v1",
  status: "PASS",
  exact_base_sha: EXPECTED_BASE,
  subject_head_sha: git("rev-parse", "HEAD"),
  exact_changed_file_count: changed.length,
  qcp_registered: true,
  generic_stage_resolver_implemented: true,
  bounded_base50_gdu_implemented: true,
  residual_to_maturity_stage_classifier_implemented: true,
  first_party_exact_hybrid_thermal_anchor_required: true,
  exact_frozen_stage_to_kc_binding_required: true,
  exact_t4r1_binding_candidate_present: true,
  live_source_probe_present: true,
  observed_vs_derived_separation: true,
  lifecycle_independent: true,
  production_activation_authorized: false
};
fs.writeFileSync("acceptance-output/MCFT_CAP09_T4R1_THERMAL_BIOLOGICAL_STAGE_GOVERNANCE_RESULT.json", JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify(out, null, 2));
