import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  MCFT_CAP09_FORMAL_FORCING_ACQUISITION_BUDGET_AUTHORITY_ID_V1,
  adjudicateFormalForcingAcquisitionBudgetV1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_forcing_acquisition_budget_v1.js";

const AUTHORITY_PATH = path.resolve("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-FORCING-ACQUISITION-BUDGET-AUTHORITY-V1.json");
const MEASUREMENT_PATH = path.resolve(process.env.MCFT_TIMING_MEASUREMENT_PROOF || "timing-measurement/MCFT_CAP_09_V13_EXACT_HEAD_TIMING_MEASUREMENT_V1_RESULT.json");
const OUT = path.resolve("acceptance-output/MCFT_CAP_09_V13_FROZEN_TIMING_AUTHORITY_V1_RESULT.json");

function main(): void {
  const authority = JSON.parse(fs.readFileSync(AUTHORITY_PATH, "utf8"));
  const measurement = JSON.parse(fs.readFileSync(MEASUREMENT_PATH, "utf8"));

  assert.equal(authority.schema_version, "geox_mcft_cap09_formal_forcing_acquisition_budget_authority_v1");
  assert.equal(authority.authority_id, MCFT_CAP09_FORMAL_FORCING_ACQUISITION_BUDGET_AUTHORITY_ID_V1);
  assert.equal(authority.status, "QUALIFIED_AND_FROZEN_FROM_EXACT_HEAD_TIMING_MEASUREMENT");
  assert.equal(authority.timing_budget_qualified, true);
  assert.equal(authority.timing_budget_frozen, true);
  assert.equal(authority.fixed_35_minute_lead_authorized_for_v5, false);
  assert.equal(authority.hardcoded_replacement_budget_minutes, null);
  assert.equal(authority.minimum_real_timing_sample_count, 3);
  assert.equal(authority.controlled_delay_matrix_required, true);

  const binding = authority.measurement_authority || {};
  assert.match(String(binding.measurement_subject_sha || ""), /^[0-9a-f]{40}$/);
  assert.ok(Number.isSafeInteger(binding.run_id) && binding.run_id > 0);
  assert.equal(binding.run_conclusion, "success");
  assert.ok(Number.isSafeInteger(binding.artifact_id) && binding.artifact_id > 0);
  assert.match(String(binding.artifact_digest || ""), /^sha256:[0-9a-f]{64}$/);

  assert.equal(measurement.status, "PASS");
  assert.equal(measurement.subject_sha, binding.measurement_subject_sha);
  assert.equal(measurement.real_sample_count, 3);
  assert.equal(measurement.controlled_delay_matrix_executed, true);
  assert.equal(measurement.controlled_delay_cases?.length, 6);
  assert.equal(measurement.controlled_delay_policy_id, authority.controlled_delay_policy_id);
  assert.equal(measurement.cross_wake_capture_overlap_model, authority.cross_wake_capture_overlap_model);
  assert.equal(measurement.safety_margin_policy_id, authority.safety_margin_policy_id);
  assert.equal(measurement.hardcoded_35_minute_budget_authorized, false);
  assert.equal(measurement.hardcoded_replacement_budget_minutes, null);

  const candidate = measurement.selected_budget_candidate;
  assert.ok(candidate && candidate.status === "PASS");
  const adjudication = adjudicateFormalForcingAcquisitionBudgetV1({
    schema_version: "geox_mcft_cap09_formal_forcing_acquisition_budget_qualification_v1",
    authority_id: MCFT_CAP09_FORMAL_FORCING_ACQUISITION_BUDGET_AUTHORITY_ID_V1,
    real_samples: measurement.real_samples,
    controlled_delay_cases: measurement.controlled_delay_cases,
    selected_budget_ms: candidate.selected_budget_ms,
    declared_safety_margin_ms: candidate.safety_margin_ms,
  });
  assert.deepEqual(adjudication, candidate, "FROZEN_TIMING_MEASUREMENT_REPLAY_MISMATCH");
  assert.deepEqual(authority.qualified_budget, candidate, "FROZEN_TIMING_AUTHORITY_BUDGET_MISMATCH");
  assert.equal(candidate.selection_basis, "MEASURED_ENVELOPE_PLUS_EXPLICIT_MARGIN");
  assert.equal(candidate.hardcoded_default_budget_minutes, null);
  assert.ok(candidate.selected_budget_ms > candidate.measured_envelope_ms);
  assert.ok(candidate.safety_margin_ms > 0);

  for (const key of ["production_owner_activation","formal_v5_arm","formal_v5_mutation","a0_bootstrap","o00_started","mcft_cap09_completed"]) {
    assert.equal(authority.non_effects?.[key], false, "FROZEN_TIMING_LATER_STAGE_EFFECT_FORBIDDEN:" + key);
  }

  const proof = {
    schema_version: "geox_mcft_cap09_v13_frozen_timing_authority_validation_v1",
    status: "PASS",
    authority_id: authority.authority_id,
    authority_status: authority.status,
    measurement_subject_sha: binding.measurement_subject_sha,
    measurement_run_id: binding.run_id,
    measurement_artifact_id: binding.artifact_id,
    measurement_artifact_digest: binding.artifact_digest,
    real_sample_count: measurement.real_sample_count,
    controlled_delay_case_count: measurement.controlled_delay_cases.length,
    qualified_budget: authority.qualified_budget,
    hardcoded_35_minute_budget_authorized: false,
    production_owner_activation: false,
    formal_v5_arm: false,
    formal_v5_mutation: false,
    a0_bootstrap: false,
    o00_started: false,
    mcft_cap09_completed: false,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(proof, null, 2) + "\n");
  console.log(JSON.stringify(proof, null, 2));
}

try {
  main();
} catch (error) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({
    status: "FAIL",
    error: error instanceof Error ? error.message : String(error),
    production_owner_activation: false,
    formal_v5_arm: false,
    formal_v5_mutation: false,
    a0_bootstrap: false,
    o00_started: false,
    mcft_cap09_completed: false,
  }, null, 2) + "\n");
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
}
