#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const S2 = 'MCFT-CAP-06.MCFT-02-06-07-09-11-12.CALIBRATION-SHADOW-CONTRACTS-MATH-V1';
const S3 = 'MCFT-CAP-06.MCFT-03-12.D-GOVERNANCE-PERSISTENCE-RECOVERY-V1';
const EXPECTED_FILES = [
  "apps/server/src/domain/calibration/case_builder_v1.ts",
  "apps/server/src/domain/calibration/contracts_v1.ts",
  "apps/server/src/domain/calibration/envelope_profiles_v1.ts",
  "apps/server/src/domain/calibration/exact_ref_port_v1.ts",
  "apps/server/src/domain/calibration/fixed_point_metric_v1.ts",
  "apps/server/src/domain/calibration/grid_search_v1.ts",
  "apps/server/src/domain/calibration/shadow_evaluation_v1.ts",
  "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md",
  "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json",
  "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json",
  "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json",
  "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S2-CONTRACTS-MATH.json",
  "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S2-STATUS.json",
  "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md",
  "scripts/acceptance/run_acceptance.cjs",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S2_CONTRACTS_MATH.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S2_CONTRACTS_MATH.ts"
];
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
const readText = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function main() {
  const result = readJson('acceptance-output/MCFT_CAP_06_S2_CONTRACTS_MATH_RESULT.json');
  const contract = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S2-CONTRACTS-MATH.json');
  const status = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S2-STATUS.json');
  const current = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json');
  const delivery = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json');
  const matrix = readJson('docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json');
  const task = readText('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md');
  const runner = readText('scripts/acceptance/run_acceptance.cjs');
  const acceptance = readText('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S2_CONTRACTS_MATH.ts');
  const grid = readText('apps/server/src/domain/calibration/grid_search_v1.ts');

  assert.equal(result.status, 'PASS');
  assert.equal(result.source_residual_count, 24);
  assert.equal(result.calibration_case_count, 16);
  assert.equal(result.holdout_case_count, 8);
  assert.equal(result.grid_count, 21);
  assert.equal(result.selected_parameter_value, '0.034000');
  assert.equal(result.source_s1_residual_set_hash, 'sha256:7995da1a8c5221c207087b30bb66a60ac2054e0616338f275ffaf72a01857e60');
  assert.equal(result.source_s1_case_input_set_hash, 'sha256:cb3bd4c273134071e931e8f85765b028ce58986752e94da3902f8563ddba4bb3');
  assert.equal(result.calibration_window_ref_membership_hash, 'sha256:e5403ae258326909d054e92b53d089494d709785d8c48775a8cd142b0f0d191d');
  assert.equal(result.holdout_window_ref_membership_hash, 'sha256:20bc567b9e75027425c981a24d8889f80327b55226dd29d04a97880bc07a428a');
  assert.equal(result.window_hash_semantics, 'ORDERED_RESIDUAL_REF_MEMBERSHIP_ONLY_V1');
  assert.equal(result.holdout_purpose, 'HIGH_EXCESS_STRESS_HOLDOUT_ONLY');
  assert.equal(result.holdout_generalization_claim, 'NOT_ESTABLISHED');
  assert.equal(result.objective_mse_range_epsilon_sse_scale_18, '1000000');
  assert.equal(result.best_second_mse_margin_epsilon_sse_scale_18, '1000000');
  assert.equal(result.sensitive_case_count >= 4, true);
  assert.equal(result.represented_sensitive_wetness_regimes.length >= 2, true);
  assert.equal(result.canonical_write_count, 0);
  assert.equal(result.projection_write_count, 0);
  assert.equal(result.migration_count, 0);
  assert.equal(result.model_activation_count, 0);

  assert.equal(contract.status, 'S2_CONTRACTS_MATH_CANDIDATE');
  assert.equal(contract.canonical_write_count, 0);
  assert.equal(contract.migration_count, 0);
  assert.equal(contract.model_activation_count, 0);
  assert.equal(contract.source_dataset_identity.residual_set_hash, result.source_s1_residual_set_hash);
  assert.equal(contract.source_dataset_identity.case_input_set_hash, result.source_s1_case_input_set_hash);
  assert.equal(contract.window_hash_semantics, 'ORDERED_RESIDUAL_REF_MEMBERSHIP_ONLY_V1');
  assert.equal(contract.holdout_purpose, 'HIGH_EXCESS_STRESS_HOLDOUT_ONLY');
  assert.equal(contract.holdout_generalization_claim, 'NOT_ESTABLISHED');

  assert.equal(status.delivery_slice_id, S2);
  assert.equal(status.status, 'CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');
  assert.equal(status.s2_effective, false);
  assert.equal(status.s3_authorized, false);
  assert.deepEqual(status.exact_changed_file_boundary, EXPECTED_FILES);
  assert.equal(status.candidate_tree_validation.exact_changed_file_count, 17);

  assert.equal(current.current_state.active_delivery_slice_id, S2);
  assert.equal(current.current_state.s2, 'CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');
  assert.equal(current.current_state.calibration_contract_math_candidate_implemented, true);
  assert.equal(current.current_state.calibration_contract_math_implemented, false);
  assert.equal(current.current_state.candidate_runtime_implemented, false);
  assert.equal(current.current_state.shadow_evaluation_runtime_implemented, false);

  assert.equal(delivery.active_delivery_slice_id, S2);
  assert.deepEqual(delivery.candidate_slices, [S2]);
  assert.deepEqual(delivery.authorized_not_started_slices, []);
  assert.equal(delivery.blocked_slices.includes(S3), true);
  assert.equal(delivery.s2_effective, false);
  assert.equal(delivery.s3_authorized, false);

  const lines = Array.isArray(matrix.capability_lines) ? matrix.capability_lines : matrix.capabilities;
  const line = lines.find((item) => item.capability_line_id === 'MCFT-CAP-06');
  assert.ok(line);
  assert.equal(line.active_delivery_slice_id, S2);
  assert.equal(line.calibration_contract_math_candidate_implemented, true);
  assert.equal(line.calibration_contract_math_implemented, false);
  const matrixS2 = line.delivery_slices.find((item) => item.delivery_slice_id === S2);
  assert.equal(matrixS2.status, 'CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');

  assert.match(task, /S2_CONTRACTS_MATH_CANDIDATE/);
  assert.match(task, /NO_CALIBRATION_CANDIDATE_APPEND/);
  assert.match(task, /NO_SHADOW_EVALUATION_APPEND/);
  assert.match(runner, /MCFT_CAP_06_S2_CONTRACTS_MATH/);
  assert.match(runner, /MCFT_CAP_06_S2_CONTRACTS_MATH_GOVERNANCE/);
  assert.doesNotMatch(acceptance, /Number\(value\)/);
  assert.doesNotMatch(acceptance, /number\.toFixed/);
  assert.match(grid, /1_000_000n as const/);

  for (const forbidden of ['twin_calibration_candidate_v1', 'twin_shadow_evaluation_v1', 'twin_model_activation_v1']) {
    assert.equal(result[forbidden], undefined);
  }
  console.log('MCFT-CAP-06 S2 contracts/math governance: PASS');
}

main();
