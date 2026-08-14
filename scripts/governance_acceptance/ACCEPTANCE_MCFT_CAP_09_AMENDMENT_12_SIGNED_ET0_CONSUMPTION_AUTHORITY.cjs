#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const fail = (message) => { throw new Error(message); };
const eq = (actual, expected, code) => {
  if (actual !== expected) fail(`${code}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
};
const has = (text, marker, code) => {
  if (!text.includes(marker)) fail(`${code}:${marker}`);
};
const lacks = (text, marker, code) => {
  if (text.includes(marker)) fail(`${code}:${marker}`);
};
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const blob = (ref, filePath) => git("rev-parse", `${ref}:${filePath}`);
const read = (filePath) => fs.readFileSync(filePath, "utf8");

const base = process.env.MCFT_BASE_SHA;
eq(base, "353f642019c5f581d0b578847ee586dffba1f22c", "AMENDMENT12_EXACT_BASE_REQUIRED");

const amendmentPath = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-12-SIGNED-ET0-CONSUMPTION-AUTHORITY.md";
const gatePath = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_AMENDMENT_12_SIGNED_ET0_CONSUMPTION_AUTHORITY.cjs";
const workflowPath = ".github/workflows/mcft-cap-09-amendment-12-signed-et0-consumption-authority.yml";

const changed = git("diff", "--name-only", `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
eq(JSON.stringify(changed), JSON.stringify([amendmentPath, gatePath, workflowPath].sort()), "AMENDMENT12_EXACT_THREE_FILE_BOUNDARY_REQUIRED");

const predecessorPins = {
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md": "39f6a09273c30088a7ea264cfa94ff930ea5518e",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1.json": "30b7910a1bd27882b80eb56041924d0f6252ae02",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA4-RECOVERY-AUTHORITY-V1.json": "1174940a6908e545e70d87cb65be5b3a41db33cf",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-11-PROVIDER-AVAILABILITY-WATERMARK-AUTHORITY.md": "a037b24757992987fc24ce8b6afac6c8eabca3ed",
  "docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-TASK.md": "2115a4d74bf0bfcab96b3ad82b3eb287ac6ee9ef"
};
for (const [filePath, expectedSha] of Object.entries(predecessorPins)) {
  eq(blob(base, filePath), expectedSha, `AMENDMENT12_BASE_PIN:${filePath}`);
  eq(blob("HEAD", filePath), expectedSha, `AMENDMENT12_PREDECESSOR_MUTATED:${filePath}`);
}

const recovery = JSON.parse(read("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA4-RECOVERY-AUTHORITY-V1.json"));
eq(recovery.recovered_kbs_facts.historical_et0_negative_count, 12, "AMENDMENT12_HISTORICAL_NEGATIVE_EVIDENCE_PIN");
eq(recovery.recovered_future_facts.future_et0_point_count, 72, "AMENDMENT12_FUTURE_POINT_COUNT_PIN");
eq(recovery.recovered_future_facts.future_et0_negative_count, 25, "AMENDMENT12_FUTURE_NEGATIVE_EVIDENCE_PIN");
eq(recovery.recovered_future_facts.future_et0_negative_clipping_performed, false, "AMENDMENT12_FUTURE_NO_CLIPPING_PIN");
eq(recovery.epistemic_and_quality_boundary.negative_future_et0_values_retained, true, "AMENDMENT12_SIGNED_EVIDENCE_RETAINED_PIN");
eq(recovery.epistemic_and_quality_boundary.negative_clipping_authorized, false, "AMENDMENT12_SOURCE_NO_CLIPPING_AUTHORITY_PIN");

const amendment = read(amendmentPath);
for (const marker of [
  "Status: **CANDIDATE — NOT EFFECTIVE UNTIL EXACT-HEAD PROOF AND PROTECTED-MAIN MERGE**",
  "MCFT_CAP09_SIGNED_ET0_TO_NONNEGATIVE_WATER_LOSS_DEMAND_V1",
  "canonical_signed_et0_mm = exact canonical Evidence value",
  "max(canonical_signed_et0_mm, 0)",
  "historical_et0_negative_count = 12",
  "future_et0_negative_count = 25",
  "future_et0_negative_clipping_performed = false",
  "negative_future_et0_values_retained = true",
  "negative_clipping_authorized = false",
  "EXTERNAL_CAP04_SERVICE_FUTURE_FORCING_FAILED",
  "FORCING_POINTS_NOT_EXACT_72_HOURLY",
  "no canonical negative clipping",
  "canonical_signed_reference_et0_mm",
  "model_water_loss_demand_mm",
  "NEGATIVE_REFERENCE_ET0_CONDENSATION_NOT_MODELED",
  "historical_et0_estimate_v1",
  "future_et0_assumption_v1",
  "CAP04 `et0_assumption_mm` model-consumption value may be zero",
  "The Future Forcing selector MUST NOT classify an otherwise structurally valid signed ET0 series",
  "CAP-02 hourly water-balance kernel",
  "CAP-04 72-hour Forecast propagation math",
  "S6-EA5E2-ET0-CONSUMPTION-SIGN-ADAPTER",
  "canonical_negative_clipping_authorized = false",
  "model_consumption_projection_authorized = true",
  "negative_et0_condensation_credit_authorized = false",
  "crop_authority_effect = NONE",
  "formal_execution_count = 0/24",
  "EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = false"
]) has(amendment, marker, "AMENDMENT12_REQUIRED_RULING_MISSING");

for (const forbidden of [
  "canonical_negative_clipping_authorized = true",
  "negative_clipping_authorized = true",
  "source_binding_changed = true",
  "negative_et0_condensation_credit_authorized = true",
  "crop_authority_effect = ESTABLISHED",
  "formal_window_started = true",
  "formal_execution_count = 1/24",
  "EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = true",
  "MCFT-CAP-09 completed = true"
]) lacks(amendment, forbidden, "AMENDMENT12_FORBIDDEN_CLAIM");

const workflow = read(workflowPath);
for (const marker of [
  "Resolve exact Amendment-12 base",
  "ACCEPTANCE_MCFT_CAP_09_AMENDMENT_12_SIGNED_ET0_CONSUMPTION_AUTHORITY.cjs",
  "Upload immutable Amendment-12 proof artifact"
]) has(workflow, marker, "AMENDMENT12_WORKFLOW_PROOF_STEP_MISSING");
for (const forbidden of [
  "pull_request_target",
  "workflow_dispatch:",
  "schedule:",
  "DATABASE_URL",
  "FORMAL_DATABASE_URL",
  "GEOX_MCFT_CAP09_S6_DATABASE_URL",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_ACCESS_KEY_ID",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY"
]) lacks(workflow, forbidden, "AMENDMENT12_WORKFLOW_SIDE_EFFECT_CAPABILITY_FORBIDDEN");

fs.mkdirSync("acceptance-output", { recursive: true });
const result = {
  schema_version: "geox_mcft_cap09_amendment_12_signed_et0_consumption_governance_result_v1",
  status: "PASS",
  base_main_sha: base,
  subject_head_sha: git("rev-parse", "HEAD"),
  exact_changed_file_count: changed.length,
  historical_et0_negative_evidence_count: recovery.recovered_kbs_facts.historical_et0_negative_count,
  future_et0_point_count: recovery.recovered_future_facts.future_et0_point_count,
  future_et0_negative_evidence_count: recovery.recovered_future_facts.future_et0_negative_count,
  signed_canonical_et0_preserved: true,
  canonical_negative_clipping_authorized: false,
  model_consumption_projection_authorized_if_merged: true,
  model_consumption_policy_id: "MCFT_CAP09_SIGNED_ET0_TO_NONNEGATIVE_WATER_LOSS_DEMAND_V1",
  historical_et0_model_demand_projection_authorized_if_merged: true,
  future_et0_model_demand_projection_authorized_if_merged: true,
  negative_et0_condensation_credit_authorized: false,
  cap02_equations_changed: false,
  cap03_assimilation_math_changed: false,
  cap04_forecast_equations_changed: false,
  source_binding_changed: false,
  crop_authority_effect: "NONE",
  formal_window_started: false,
  formal_execution_count: "0/24",
  ea5e2_operational_activation_qualified: false,
  mcft_cap09_completed: false,
  next_implementation_frontier: "S6-EA5E2-ET0-CONSUMPTION-SIGN-ADAPTER"
};
fs.writeFileSync("acceptance-output/MCFT_CAP_09_AMENDMENT_12_SIGNED_ET0_CONSUMPTION_GOVERNANCE_RESULT.json", `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));