// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S1_RESIDUAL_WINDOWS.cjs
// Purpose: fail closed on the exact MCFT-CAP-06 S1 controlled Residual-window candidate and preserved S2 boundary.
// Boundary: governance validation only; no database write, calibration search, Candidate, Evaluation, Model Activation, route, Web, scheduler, or CAP-07 authority.

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const S1 = 'MCFT-CAP-06.MCFT-01-03-11.CANONICAL-RESIDUAL-WINDOWS-V1';
const S2 = 'MCFT-CAP-06.MCFT-02-06-07-09-11-12.CALIBRATION-SHADOW-CONTRACTS-MATH-V1';
const EXPECTED_REFS = ["twin_forecast_residual_82a3a33ec85e745b3da94926", "twin_forecast_residual_3f304b582b7ccd88ff595e58", "twin_forecast_residual_b1927fa85ec7907003536743", "twin_forecast_residual_70cb140deddbd82431b930a8", "twin_forecast_residual_5f1002f427dfc7a3898004c6", "twin_forecast_residual_2e70b5e205e97d59ac5463ea", "twin_forecast_residual_3dff46adeb68ddd13eb6cc23", "twin_forecast_residual_5460ebde9cb3b3874330fbb0", "twin_forecast_residual_b88ec039ea40554565fe48c6", "twin_forecast_residual_eb356def2ef9987d04928088", "twin_forecast_residual_a2cb5086fadd37dc50e223d0", "twin_forecast_residual_911de330aea53e3fee88e0d3", "twin_forecast_residual_9e4081b160e65b9bebd10c33", "twin_forecast_residual_c6cb6464fb3a19634e5593d6", "twin_forecast_residual_1561f21073c4a305e939e156", "twin_forecast_residual_cb4c4702aaa1bff2027dc7eb", "twin_forecast_residual_5e56e928f343f3311534101f", "twin_forecast_residual_cc73ee4d8445074800a80e5f", "twin_forecast_residual_8460f596160f7a25c002d137", "twin_forecast_residual_c08214c843f869a28aa89751", "twin_forecast_residual_0a5d78b827e5a53addbf030b", "twin_forecast_residual_40dcac4516a48226c9fa2651", "twin_forecast_residual_2a34b15f913f3ad58ee3fb37", "twin_forecast_residual_09e61f26baff44fd6679824b"];
const EXPECTED_HASHES = ["sha256:bf52e954d113d5f0cb8ddb8fd9d5f980fc78024c9484afd24f1b228411d74698", "sha256:51ed607ae2ee80f610eb915d2b2f164585a841afe0db4ab1a4e658dd6b2ee6c7", "sha256:c9acfce97e1e77bc8648fcc5a68aa9b51514b7b15d415b805cef21239c92d00f", "sha256:e4004da4ffde893cc0f041403c53146352032a4dc9cef2b8b5cc73d439b81afb", "sha256:b3cdf2e81beac508f4b509677907d4ce5df3a9d970c6425624400d57358e4b78", "sha256:af4015fc36872e83b2e5808c81cd884151d5dcf3b914d67fbf0763317ec1e61a", "sha256:6c0c848a55dd79fc4b43f29f165cbf771d33ef5e2a856e2498566eda38116166", "sha256:31c47dcb9c787587fec0dd1dadacee85671343fc710f62e630a256fb7fc816eb", "sha256:0e169a584acfd69bb2ff13ec1404d3962c0a388ce2cbfc70387bf87661f288d2", "sha256:3b80a497cbe40be1d7f0d520dbd3f687c1264dd26d588fc84a9198d3574c8e1e", "sha256:5a9599a5790495bdb831b78392f91d9c1246f31e1beb9e8d9b877cb6b2863f68", "sha256:a29f58a418cdab658e22985bf2776213f2e7893888aa78d4e2a53c648280d171", "sha256:8ed287354d52f9da04ad2accc0df9403145937715007cba6e920d38f3096a3a9", "sha256:0cff7fbbe847cece24bbc571db47bc5a0731772d1a3ee2594a84d18e5b20f138", "sha256:c6da6632179dae8fad37bef4d13b2d2517d54e4b0128d3edd70b50d57030a672", "sha256:c25ec6614f1e0aa3074c20b450c5ba5e45b8af874ceece0075f0241f9daf5ad0", "sha256:47ce9094dc8bc29b87beacc42ac8339cec29495fccd5c2a3926a66b477f6289e", "sha256:4a24ef4a16589f3cf6a7ace8276584951ebcd0ab687518ec3bb736f5a3b57762", "sha256:113aa825e7a611cbb646a090a1493aa85f53ab2af6fef0f43d8593ca437a8504", "sha256:9cfc521bea9dc1448e2cfb87732caeb44c15a93bf5b0a3140ae0a26184d0acd1", "sha256:0f4ff85fabd6fdcd95a3a77d65e08ef96339167c0f9d08c1a0f171045f7498c6", "sha256:a7d7d654e8b03b2eda9d380f373f5d88a118edc75405a13e2f5807e2b4e126aa", "sha256:61cc2a09cfbf4f261714687c0042b7b181c6e9e0dd99e75f6f7e3d75ca2ef5a7", "sha256:8b1feaae71a654168ae50022c03501c60010425b5b59411b4eff9d25988505db"];
const EXPECTED_FILES = ["docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md", "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json", "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json", "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json", "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S1-RESIDUAL-WINDOWS.json", "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S1-RESIDUAL-WINDOWS-STATUS.json", "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S1-RESIDUAL-WINDOWS.md", "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md", "scripts/acceptance/run_acceptance.cjs", "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S1_RESIDUAL_WINDOWS.cjs", "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S1_RESIDUAL_WINDOWS_DB.ts", "scripts/runtime_acceptance/RUN_MCFT_CAP_06_S1_RESIDUAL_WINDOWS.cjs", "scripts/runtime_acceptance/mcft_cap_06_s1_residual_windows_fixture_v1.ts"];

function readJson(relativePath) { return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8')); }
function readText(relativePath) { return fs.readFileSync(path.join(ROOT, relativePath), 'utf8'); }

function main() {
  const contract = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S1-RESIDUAL-WINDOWS.json');
  const status = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S1-RESIDUAL-WINDOWS-STATUS.json');
  const delivery = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json');
  const current = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json');
  const matrix = readJson('docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json');

  assert.equal(contract.delivery_slice_id, S1);
  assert.equal(contract.status, 'IMPLEMENTATION_CANDIDATE');
  assert.equal(contract.profile_id, 'PRESEEDED_24_H1_FORECAST_OBSERVATION_PAIRS_NO_RESIDUALS_V1');
  assert.equal(contract.qualification_track, 'CONTROLLED_POSITIVE_MECHANISM_TRACK');
  assert.equal(contract.canonical_residual_count, 24);
  assert.deepEqual(contract.ordered_residual_refs, EXPECTED_REFS);
  assert.deepEqual(contract.ordered_residual_hashes, EXPECTED_HASHES);
  assert.equal(contract.residual_set_hash, 'sha256:14a5f07e6f3cc94f6c61c697d39d2093cae35bd491fd3f4dc68e01e79c7c24d7');
  assert.deepEqual(contract.calibration_window.ordered_residual_refs, EXPECTED_REFS.slice(0, 16));
  assert.deepEqual(contract.holdout_window.ordered_residual_refs, EXPECTED_REFS.slice(16));
  assert.equal(contract.calibration_window.window_hash, 'sha256:e5403ae258326909d054e92b53d089494d709785d8c48775a8cd142b0f0d191d');
  assert.equal(contract.holdout_window.window_hash, 'sha256:20bc567b9e75027425c981a24d8889f80327b55226dd29d04a97880bc07a428a');
  assert.equal(contract.case_input_set_hash, 'sha256:fac894cf5a4de2c473523190408933ae25185c6a63b9568cde2d8121add4dc62');
  assert.equal(contract.validation.future_leakage_count, 0);
  assert.equal(contract.validation.calibration_holdout_ref_intersection_count, 0);
  assert.equal(contract.validation.controlled_repository_history_ref_intersection_count, 0);
  assert.equal(contract.canonical_deltas.twin_forecast_residual_v1, 24);
  assert.equal(contract.canonical_deltas.twin_calibration_candidate_v1, 0);
  assert.equal(contract.canonical_deltas.twin_shadow_evaluation_v1, 0);
  assert.equal(contract.canonical_deltas.twin_model_activation_v1, 0);
  assert.equal(contract.migration_delta, 0);

  assert.equal(status.status, 'IMPLEMENTATION_CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS');
  assert.equal(status.runtime_source_authorized, true);
  assert.equal(status.canonical_write_authorized_for_slice, true);
  assert.deepEqual(status.canonical_write_scope, ['twin_forecast_residual_v1']);
  assert.equal(status.s1_effective, false);
  assert.equal(status.s2_authorized, false);
  assert.deepEqual([...status.exact_changed_file_boundary].sort(), [...EXPECTED_FILES].sort());

  assert.equal(delivery.active_delivery_slice_id, S1);
  assert.equal(delivery.s1_candidate_materialized, true);
  assert.equal(delivery.s1_effective, false);
  assert.equal(delivery.candidate_slices.length, 1);
  assert.equal(delivery.candidate_slices[0].delivery_slice_id, S1);
  assert.equal(delivery.blocked_slices.includes(S2), true);

  assert.equal(current.current_state.s1, 'IMPLEMENTATION_CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS');
  assert.equal(current.current_state.controlled_residual_window_candidate_implemented, true);
  assert.equal(current.current_state.controlled_residual_window_effective, false);
  assert.equal(current.current_state.candidate_runtime_implemented, false);
  assert.equal(current.current_state.shadow_evaluation_runtime_implemented, false);

  const lines = Array.isArray(matrix.capability_lines) ? matrix.capability_lines : matrix.capabilities;
  const line = lines.find((item) => item.capability_line_id === 'MCFT-CAP-06');
  assert.ok(line);
  assert.equal(line.active_delivery_slice_id, S1);
  assert.equal(line.controlled_residual_window_candidate_implemented, true);
  assert.equal(line.controlled_residual_window_effective, false);
  assert.equal(line.candidate_runtime_implemented, false);
  assert.equal(line.shadow_evaluation_runtime_implemented, false);
  assert.equal(line.capability_complete, false);

  const runner = readText('scripts/acceptance/run_acceptance.cjs');
  assert.ok(runner.includes('MCFT_CAP_06_S1_RESIDUAL_WINDOWS_POSTGRESQL'));
  assert.ok(runner.includes('MCFT_CAP_06_S1_RESIDUAL_WINDOWS_GOVERNANCE'));
  const fixture = readText('scripts/runtime_acceptance/mcft_cap_06_s1_residual_windows_fixture_v1.ts');
  assert.ok(fixture.includes('executeHourlyWaterBalanceV1'));
  assert.ok(fixture.includes('buildCap05ForecastResidualV1'));
  assert.ok(fixture.includes('buildCap04S7RangeFixtureV1'));
  assert.equal(fixture.includes('twin_calibration_candidate_v1'), false);
  assert.equal(fixture.includes('twin_shadow_evaluation_v1'), false);
  assert.equal(fixture.includes('twin_model_activation_v1'), false);

  console.log('PASS MCFT-CAP-06 S1 exact 24 Residual refs and hashes');
  console.log('PASS disjoint 16/8 dual-time windows and zero future leakage');
  console.log('PASS existing C transaction reuse, zero migration and isolated PostgreSQL harness');
  console.log('PASS S2/Candidate/Evaluation/Activation/CAP-07 remain blocked');
}

main();
