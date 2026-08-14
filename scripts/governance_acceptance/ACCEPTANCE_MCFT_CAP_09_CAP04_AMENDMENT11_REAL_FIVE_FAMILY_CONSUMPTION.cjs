#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

const RUNNER = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_CAP04_AMENDMENT11_REAL_FIVE_FAMILY_CONSUMPTION_V1.ts";
const WORKFLOW = ".github/workflows/mcft-cap-09-cap04-amendment11-real-five-family-consumption.yml";
const SUCCESSOR = "apps/server/src/runtime/twin_runtime/external_formal_cap04_amendment11_candidate_execution_service_v1.ts";
const DB_SOURCE = "apps/server/src/runtime/twin_runtime/postgres_external_formal_evidence_source_v1.ts";
const KBS_FIVE = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_KBS_EXTERNAL_FIVE_FAMILY_DATA_PATH_V1.ts";

function requireTrue(value, code) {
  if (!value) throw new Error(code);
}
function requireIncludes(text, marker, code) {
  requireTrue(text.includes(marker), code);
}

for (const file of [RUNNER, WORKFLOW, SUCCESSOR, DB_SOURCE, KBS_FIVE]) {
  requireTrue(fs.existsSync(file), `MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_FILE_REQUIRED:${file}`);
}

const runner = fs.readFileSync(RUNNER, "utf8");
const workflow = fs.readFileSync(WORKFLOW, "utf8");
const successor = fs.readFileSync(SUCCESSOR, "utf8");
const dbSource = fs.readFileSync(DB_SOURCE, "utf8");
const kbsFive = fs.readFileSync(KBS_FIVE, "utf8");

requireIncludes(runner, "executeExternalFormalCap04Amendment11CandidateV1", "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_SUCCESSOR_REQUIRED");
requireIncludes(runner, "PostgresExternalFormalEvidenceSourceV1", "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_DB_SOURCE_REQUIRED");
requireIncludes(runner, "MCFT_CAP09_FIVE_FAMILY_PROOF_PATH", "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_UPSTREAM_PROOF_REQUIRED");
requireIncludes(runner, "kbs_external_five_family_data_path_qualified", "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_UPSTREAM_QUALIFICATION_REQUIRED");
requireIncludes(runner, "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_EXACT_MAIN_REQUIRED", "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_EXACT_MAIN_GUARD_REQUIRED");
requireIncludes(runner, "evidence_snapshot_time: evidenceSnapshot", "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_CALLER_SNAPSHOT_REQUIRED");
requireIncludes(runner, "CALLER_SUPPLIED", "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_SNAPSHOT_SOURCE_REQUIRED");

for (const recordType of [
  "future_et0_assumption_v1",
  "future_weather_assumption_v1",
  "historical_et0_estimate_v1",
  "observed_rainfall_v1",
  "soil_moisture_observation_v1",
]) {
  requireIncludes(runner, recordType, `MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_TYPE_REQUIRED:${recordType}`);
}

requireIncludes(runner, "loaded.selected_record_count !== 5", "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_EXACT_DB_FIVE_REQUIRED");
requireIncludes(runner, "candidate.operation_variant !== \"A1\"", "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_A1_REQUIRED");
requireIncludes(runner, "candidate.forcing_outcome.status !== \"SELECTED\"", "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_SELECTED_REQUIRED");
requireIncludes(runner, "candidate.forecast_authority.forecast_candidate.status !== \"COMPLETED\"", "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_COMPLETED_REQUIRED");
requireIncludes(runner, "candidate.forecast_authority.forecast_candidate.points.length !== 72", "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_72H_REQUIRED");
requireIncludes(runner, "candidate.provider_request_count !== 0", "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_CAP04_PROVIDER_ZERO_REQUIRED");
requireIncludes(runner, "candidate.database_write_count !== 0", "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_CAP04_DB_ZERO_REQUIRED");
requireIncludes(runner, "candidate.canonical_persistence_authorized !== false", "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_PERSISTENCE_FALSE_REQUIRED");

requireIncludes(runner, "buildQualificationCropContext", "MCFT_CAP09_CAP04_A11_QUALIFICATION_CROP_BINDING_REQUIRED");
requireIncludes(runner, "QUALIFICATION_ONLY_NOT_OPERATIONAL_CROP_AUTHORITY", "MCFT_CAP09_CAP04_A11_QUALIFICATION_CROP_NONOPERATIONAL_REQUIRED");
requireIncludes(runner, "NO_CROP_AUTHORITY_EFFECT", "MCFT_CAP09_CAP04_A11_QUALIFICATION_CROP_NONE_REQUIRED");
requireIncludes(runner, "qualification://cap04-a11-real-five-family/crop/", "MCFT_CAP09_CAP04_A11_TARGET_SCOPED_CROP_REF_REQUIRED");
requireIncludes(runner, "qualification_harness_premerge_required: true", "MCFT_CAP09_CAP04_A11_PREMERGE_HARNESS_DECLARATION_REQUIRED");
requireIncludes(runner, "ISOLATED_DETERMINISTIC_FIVE_FAMILY_PREMERGE", "MCFT_CAP09_CAP04_A11_PREMERGE_HARNESS_MODE_REQUIRED");
requireIncludes(runner, "delayed_exact_family_availability_offset_hours: 20", "MCFT_CAP09_CAP04_A11_DELAYED_SNAPSHOT_HARNESS_REQUIRED");
requireIncludes(runner, "qualification_crop_context_covers_target: true", "MCFT_CAP09_CAP04_A11_TARGET_COVERAGE_PROOF_REQUIRED");
requireIncludes(runner, "qualification_crop_context_only: true", "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_CROP_QUALIFICATION_ONLY_REQUIRED");
requireIncludes(runner, "crop_authority_effect: \"NONE\"", "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_CROP_NONE_REQUIRED");
requireIncludes(runner, "cap04_runtime_successor_qualified: true", "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_CAP04_QUALIFIED_REQUIRED");
requireIncludes(runner, "REAL_EXTERNAL_FIVE_FAMILY_CONSUMPTION_IN_ISOLATED_DB_WITH_QUALIFICATION_ONLY_CROP_CONTEXT", "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_SCOPE_REQUIRED");
requireTrue(!runner.includes("GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json"), "MCFT_CAP09_CAP04_A11_OPERATIONAL_CROP_AUTHORITY_MUST_NOT_BE_CLAIMED_BY_COMPONENT_HARNESS");

requireIncludes(workflow, "qualification-harness:", "MCFT_CAP09_CAP04_A11_PREMERGE_JOB_REQUIRED");
requireIncludes(workflow, "qualification-harness", "MCFT_CAP09_CAP04_A11_PREMERGE_WORKFLOW_BINDING_REQUIRED");
requireIncludes(workflow, "qualification-harness\n", "MCFT_CAP09_CAP04_A11_PREMERGE_COMMAND_MARKER_REQUIRED");
requireIncludes(workflow, "ISOLATED_DETERMINISTIC_FIVE_FAMILY_PREMERGE", "MCFT_CAP09_CAP04_A11_PREMERGE_RESULT_GATE_REQUIRED");
requireIncludes(workflow, "external_cap04_operation_variant!=='A1'", "MCFT_CAP09_CAP04_A11_PREMERGE_A1_GATE_REQUIRED");
requireIncludes(workflow, "external_cap04_forcing_status!=='SELECTED'", "MCFT_CAP09_CAP04_A11_PREMERGE_SELECTED_GATE_REQUIRED");
requireIncludes(workflow, "external_cap04_forecast_status!=='COMPLETED'", "MCFT_CAP09_CAP04_A11_PREMERGE_COMPLETED_GATE_REQUIRED");
requireIncludes(workflow, "external_cap04_forecast_point_count!==72", "MCFT_CAP09_CAP04_A11_PREMERGE_72H_GATE_REQUIRED");
requireIncludes(workflow, "needs: qualification-harness", "MCFT_CAP09_CAP04_A11_LIVE_MUST_FOLLOW_PREMERGE_HARNESS");

requireIncludes(runner, "formal_database_write_count: 0", "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_FORMAL_DB_ZERO_REQUIRED");
requireIncludes(runner, "formal_r2_prefix_write_count: 0", "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_FORMAL_R2_ZERO_REQUIRED");
requireIncludes(runner, "scheduler_write_count: 0", "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_SCHEDULER_ZERO_REQUIRED");
requireIncludes(runner, "runtime_write_count: 0", "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_RUNTIME_ZERO_REQUIRED");
requireIncludes(runner, "formal_effect: false", "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_FORMAL_FALSE_REQUIRED");
requireIncludes(runner, "ea5e2_operational_activation_qualified: false", "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_EA5E2_FALSE_REQUIRED");
requireIncludes(runner, "full_operational_go: false", "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_FULL_GO_FALSE_REQUIRED");
requireIncludes(runner, "raw_values_emitted: false", "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_RAW_VALUES_FALSE_REQUIRED");

requireTrue(!runner.includes("fetch("), "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_RUNNER_PROVIDER_FETCH_FORBIDDEN");
requireTrue(!runner.includes("https://lter.kbs.msu.edu"), "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_RUNNER_PROVIDER_ENDPOINT_FORBIDDEN");
requireIncludes(successor, "evidence_snapshot_time: string", "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_SUCCESSOR_SNAPSHOT_MANDATORY");
requireIncludes(successor, "EXTERNAL_CAP04_AMENDMENT11_EVIDENCE_SNAPSHOT_BEFORE_LOGICAL_TIME", "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_SUCCESSOR_BEFORE_T_FAIL_CLOSED");
requireIncludes(successor, "EXTERNAL_CAP04_AMENDMENT11_EVIDENCE_SNAPSHOT_AFTER_CREATED_AT", "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_SUCCESSOR_AFTER_CREATED_FAIL_CLOSED");
requireIncludes(dbSource, "evidence_snapshot_time?: string", "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_DB_SNAPSHOT_SEAM_REQUIRED");
requireIncludes(kbsFive, "kbs_external_five_family_data_path_qualified: true", "MCFT_CAP09_CAP04_A11_REAL_FIVE_FAMILY_UPSTREAM_RUNNER_REQUIRED");

console.log(JSON.stringify({
  schema_version: "geox_mcft_cap09_cap04_amendment11_real_five_family_consumption_acceptance_v2",
  status: "PASS",
  temporal_authority: "PROVIDER_AVAILABILITY_WATERMARK_V1",
  exact_main_required_for_final_live: true,
  upstream_kbs_five_family_required: true,
  isolated_database_exact_five_required: true,
  caller_supplied_evidence_snapshot_required: true,
  premerge_complete_qualification_harness_required: true,
  premerge_db_source_to_a1_selected_completed_72h_required: true,
  cap04_provider_fetch_forbidden: true,
  cap04_database_write_forbidden: true,
  qualification_crop_context_only: true,
  operational_crop_authority_effect: "NONE",
  cap04_runtime_successor_qualified_on_live_pass: true,
  ea5e2_operational_activation_qualified: false,
  full_operational_go: false
}));
