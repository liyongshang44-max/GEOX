const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const AUTH_PATH = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-A18B-PREWINDOW-A0-AND-REPLACEMENT-RUNTIME-CONFIG-CHAIN-V1.json';
const AMENDMENT_PATH = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-18-PREWINDOW-STATE-CONTINUITY-AND-FORMAL-STORE-REBASE-AUTHORITY.md';
const BUILDER_PATH = 'apps/server/src/domain/twin_runtime/external_formal_prewindow_authority_bundle_v2.ts';
const ACCEPTANCE_PATH = 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_A18B_PREWINDOW_CONFIG_CHAIN_CALIBRATION.ts';
const OUT = 'acceptance-output/MCFT_CAP_09_A18B_PREWINDOW_CONFIG_CHAIN_GOVERNANCE_RESULT.json';
const auth = JSON.parse(fs.readFileSync(AUTH_PATH, 'utf8'));
const amendment = fs.readFileSync(AMENDMENT_PATH, 'utf8');
const builder = fs.readFileSync(BUILDER_PATH, 'utf8');
const acceptance = fs.readFileSync(ACCEPTANCE_PATH, 'utf8');

assert.equal(auth.exact_base_main_sha, '6e7b1ac08ca8f79d65d5c6ec0a57e0cbabb8e5c9');
assert.equal(auth.a18a_effectiveness.pr_number, 3197);
assert.equal(auth.a18a_effectiveness.merge_commit_sha, '6e7b1ac08ca8f79d65d5c6ec0a57e0cbabb8e5c9');
assert.equal(auth.selected_epoch_id, 'mcft_cap09_external_formal_window_epoch_20260817t200000z_v2');
assert.equal(auth.prewindow_a0.logical_time, '2026-08-17T19:00:00.000Z');
assert.equal(auth.prewindow_a0.crop_stage_code, 'MID');
assert.equal(auth.prewindow_a0.crop_stage_context_hash, 'sha256:cda79e91f0cafef911fb5daeb16ca6723ac5c46279eb231fa894ba1cb97752fc');
assert.equal(auth.prewindow_a0.parent_runtime_config_ref, null);
assert.equal(auth.prewindow_a0.parent_runtime_config_hash, null);
assert.equal(auth.hourly_runtime_config_pins.length, 24);
for (let i = 0; i < 24; i += 1) {
  const pin = auth.hourly_runtime_config_pins[i];
  const slot = `O${String(i).padStart(2, '0')}`;
  assert.equal(pin[0], slot, `A18B_SLOT_DRIFT:${slot}`);
  assert.match(pin[2], /^external_formal_runtime_config_[0-9a-f]{24}$/);
  assert.match(pin[3], /^sha256:[0-9a-f]{64}$/);
  if (i === 0) assert.equal(Date.parse(pin[1]) - Date.parse(auth.prewindow_a0.logical_time), 3600000);
  if (i > 0) assert.equal(Date.parse(pin[1]) - Date.parse(auth.hourly_runtime_config_pins[i-1][1]), 3600000);
}
assert.equal(auth.hourly_runtime_config_pins[23][1], '2026-08-18T19:00:00.000Z');
assert.equal(new Set([auth.prewindow_a0.runtime_config_ref, ...auth.hourly_runtime_config_pins.map((p) => p[2])]).size, 25);
assert.equal(new Set([auth.prewindow_a0.runtime_config_hash, ...auth.hourly_runtime_config_pins.map((p) => p[3])]).size, 25);
assert.equal(auth.nonclaims.runtime_configs_persisted, false);
assert.equal(auth.nonclaims.prewindow_a0_persisted, false);
assert.equal(auth.nonclaims.replacement_manifest_frozen, false);
assert.equal(auth.nonclaims.runner_exact_binding_qualified, false);
assert.equal(auth.nonclaims.ea5e3_authorized, false);
assert.equal(auth.nonclaims.formal_o00_started, false);
assert.equal(auth.nonclaims.formal_execution_count, '0/24');
assert.equal(auth.next_legal_frontier_after_effectiveness, 'A18C_REPLACEMENT_IMMUTABLE_FORMAL_WINDOW_INPUT_MANIFEST_AND_RUNNER_EXACT_BINDING');

assert(amendment.includes('A18B  O00-1h A0 + O00-O23 deterministic config builder qualification'), 'AMENDMENT18_A18B_FRONTIER_REQUIRED');
assert(amendment.includes('1 pre-window A0 Runtime Config at O00 - PT1H') && amendment.includes('24 HOURLY_CAP04 Runtime Configs at O00 ... O23'), 'AMENDMENT18_EXACT_25_CONFIGS_REQUIRED');
assert(amendment.includes('O00 parent ref/hash equals the new pre-window A0 Runtime Config ref/hash'), 'AMENDMENT18_O00_NEW_A0_PARENT_REQUIRED');
assert(builder.includes('Boundary: pure construction only'), 'A18B_PURE_BUILDER_BOUNDARY_REQUIRED');
assert(builder.includes('EXTERNAL_FORMAL_A18_EXACT_24_CROP_PINS_REQUIRED'), 'A18B_EXACT_24_CROP_PINS_REQUIRED');
assert(builder.includes('EXTERNAL_FORMAL_A18_CROP_HASH_DRIFT'), 'A18B_CROP_HASH_FAIL_CLOSED_REQUIRED');
assert(acceptance.includes('A18B_FROZEN_PIN_DRIFT'), 'A18B_FROZEN_PIN_EQUALITY_REQUIRED');
for (const forbidden of ['fetch(', 'axios', 'claimDueSlot(', 'INSERT INTO', 'UPDATE ', 'DELETE FROM']) {
  assert(!builder.includes(forbidden), `A18B_BUILDER_SIDE_EFFECT_SURFACE_FORBIDDEN:${forbidden}`);
}
for (const forbidden of ['freshness_is_late_authoritative_admission_gate = true', 'scheduler_eligibility_lag_hours = 7', 'T+07:12', 'T+07:17']) {
  assert(!JSON.stringify(auth).includes(forbidden), `A18B_TEMPORAL_REGRESSION_FORBIDDEN:${forbidden}`);
}

const result = {
  schema_version: 'geox_mcft_cap09_a18b_prewindow_config_chain_governance_result_v1',
  status: 'PASS',
  exact_base_main_sha: auth.exact_base_main_sha,
  exact_runtime_config_pin_count: 25,
  prewindow_a0_logical_time: auth.prewindow_a0.logical_time,
  o00_logical_time: auth.hourly_runtime_config_pins[0][1],
  o23_logical_time: auth.hourly_runtime_config_pins[23][1],
  canonical_pt1h_chain_required: true,
  frozen_pin_equality_required: true,
  builder_side_effect_free_required: true,
  runtime_configs_persisted: false,
  prewindow_a0_persisted: false,
  ea5e3_authorized: false,
  formal_o00_started: false,
  formal_execution_count: '0/24'
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
