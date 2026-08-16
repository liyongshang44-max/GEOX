const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const MANIFEST_PATH = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-A18C-REPLACEMENT-FORMAL-WINDOW-INPUT-MANIFEST-V3.json';
const AMENDMENT18_PATH = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-18-PREWINDOW-STATE-CONTINUITY-AND-FORMAL-STORE-REBASE-AUTHORITY.md';
const A18B_PATH = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-A18B-PREWINDOW-A0-AND-REPLACEMENT-RUNTIME-CONFIG-CHAIN-V1.json';
const MATERIALIZER_PATH = 'apps/server/src/runtime/twin_runtime/external_formal_a18_crop_context_v2.ts';
const RUNNER_PATH = 'apps/server/src/runtime/twin_runtime/external_formal_v3_amendment11_runner_v1.ts';
const TICK_SERVICE_PATH = 'apps/server/src/runtime/twin_runtime/external_formal_v3_amendment11_persistent_tick_service_v1.ts';
const EVIDENCE_SOURCE_PATH = 'apps/server/src/runtime/twin_runtime/postgres_external_formal_evidence_source_v1.ts';
const SCHEDULER_PATH = 'apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.ts';
const OUT = 'acceptance-output/MCFT_CAP_09_A18C_MANIFEST_RUNNER_GOVERNANCE_RESULT.json';

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const amendment18 = fs.readFileSync(AMENDMENT18_PATH, 'utf8');
const a18b = JSON.parse(fs.readFileSync(A18B_PATH, 'utf8'));
const materializer = fs.readFileSync(MATERIALIZER_PATH, 'utf8');
const runner = fs.readFileSync(RUNNER_PATH, 'utf8');
const tickService = fs.readFileSync(TICK_SERVICE_PATH, 'utf8');
const evidenceSource = fs.readFileSync(EVIDENCE_SOURCE_PATH, 'utf8');
const scheduler = fs.readFileSync(SCHEDULER_PATH, 'utf8');

assert(amendment18.includes('A18C  replacement immutable Formal Window Input Manifest + runner exact binding qualification'), 'AMENDMENT18_A18C_SEQUENCE_REQUIRED');
assert(amendment18.includes('EA5E3 readiness / pre-authorization before O00-12h'), 'AMENDMENT18_EA5E3_SUCCESSOR_REQUIRED');
assert(amendment18.includes('A18D  actual O00-1h fresh bootstrap + post-bootstrap cutover proof'), 'AMENDMENT18_A18D_AFTER_EA5E3_REQUIRED');

assert.equal(manifest.schema_version, 'geox_mcft_cap09_a18c_replacement_formal_window_input_manifest_v3');
assert.equal(manifest.status, 'CANDIDATE');
assert.equal(manifest.authority, 'A18C_REPLACEMENT_IMMUTABLE_FORMAL_WINDOW_INPUT_MANIFEST_AND_RUNNER_EXACT_BINDING');
assert.equal(manifest.exact_base_main_sha, '185479edf0c8dfab58632cddfff81c6e9aec6b06');
assert.equal(manifest.manifest_ref, MANIFEST_PATH);
assert.equal(manifest.manifest_hash_profile, 'SEMANTIC_HASH_V1_WITH_MANIFEST_HASH_BLANK');
assert.match(manifest.manifest_hash, /^sha256:[0-9a-f]{64}$/);

const bindings = manifest.immutable_bindings;
assert.deepEqual(bindings.amendment_18, [AMENDMENT18_PATH, 'bc9627dc4159dcb753e4f0cb1f05d4507962d510']);
assert.deepEqual(bindings.amendment_11, ['docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-11-PROVIDER-AVAILABILITY-WATERMARK-AUTHORITY.md', 'a037b24757992987fc24ce8b6afac6c8eabca3ed']);
assert.deepEqual(bindings.a18a, ['docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-A18A-ZERO-STATE-FORMAL-STORE-IDENTITY-AND-SCHEMA-PREFLIGHT-V1.json', 'c63cb9b74fc14c08bccc2fedb8bed3b97a7c5ef4']);
assert.deepEqual(bindings.a18b, [A18B_PATH, '09fa8cbc3e8114ff6c9f464e89a39f2feb1706ae']);
assert.deepEqual(bindings.crop_context, ['docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V2.json', '757e4b9f4fdcd631eea97fca85614a1b61ef0c4a']);
assert.deepEqual(bindings.configuration_matrix, ['docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json', 'c04c6805ab79c715781b99f8fbcf997fae3a8c48', 'sha256:381ef166454c7b698c6641fadc5d08019fecff127e9529a4c58a1f09d9e1fef5']);

assert.equal(manifest.formal_store.neon_project_id, 'delicate-glade-62464340');
assert.equal(manifest.formal_store.neon_branch_id, 'br-cold-dust-a6j6aymz');
assert.equal(manifest.formal_store.database_name, 'geox_mcft_cap09_s6_formal_t3r1_24h_v2');
assert.equal(manifest.formal_store.required_state_before_a18d, 'ZERO_STATE');
assert.equal(manifest.formal_store.qualification_mode, 'READ_ONLY');
assert.deepEqual(manifest.scope, {
  tenant_id: 'tenant_mcft_external',
  project_id: 'project_mcft_cap09',
  group_id: 'group_public_research',
  field_id: 'field_kbs_mcse_t3r1',
  season_id: 'season_2026_corn',
  zone_id: 'zone_kbs_mcse_t3r1_crop_formal_v1',
});
assert.deepEqual(manifest.epoch, {
  epoch_id: 'mcft_cap09_external_formal_window_epoch_20260817t200000z_v2',
  prewindow_a0: '2026-08-17T19:00:00.000Z',
  o00: '2026-08-17T20:00:00.000Z',
  o23: '2026-08-18T19:00:00.000Z',
});

assert.equal(a18b.authority, 'A18B_PREWINDOW_A0_AND_REPLACEMENT_RUNTIME_CONFIG_CHAIN');
assert.equal(manifest.runtime_config_pin_source.authority, a18b.authority);
assert.equal(manifest.runtime_config_pin_source.pr, 3198);
assert.equal(manifest.runtime_config_pin_source.merged_head_sha, 'fbcc48f04f693b0b1406c29b0ee8cef288600454');
assert.equal(manifest.runtime_config_pin_source.merge_commit_sha, '185479edf0c8dfab58632cddfff81c6e9aec6b06');
assert.equal(manifest.runtime_config_pin_source.rule, 'EXACT_A18B_CONFIG_REF_HASH_AND_EMBEDDED_PARENT_CONTEXT_PINS_ONLY');
assert.equal(a18b.hourly_runtime_config_pins.length, 24);

assert.equal(manifest.prewindow_a0_materialization.crop_stage_context_identity_hash, 'sha256:cda79e91f0cafef911fb5daeb16ca6723ac5c46279eb231fa894ba1cb97752fc');
assert.match(manifest.prewindow_a0_materialization.crop_stage_context_materialization_hash, /^sha256:[0-9a-f]{64}$/);
assert.equal(manifest.slot_context_materialization_hashes.length, 24);
const slotIds = manifest.slot_context_materialization_hashes.map((entry) => entry[0]);
const slotHashes = manifest.slot_context_materialization_hashes.map((entry) => entry[1]);
assert.equal(new Set(slotIds).size, 24);
assert.equal(new Set(slotHashes).size, 24);
for (let i = 0; i < 24; i += 1) {
  assert.equal(slotIds[i], `O${String(i).padStart(2, '0')}`, `A18C_SLOT_ID_DRIFT:O${String(i).padStart(2, '0')}`);
  assert.match(slotHashes[i], /^sha256:[0-9a-f]{64}$/);
}

const cropContract = manifest.crop_materialization_contract;
assert.equal(cropContract.identity_hash_attests_full_payload, false);
assert.equal(cropContract.full_materialization_hash_required, true);
assert.equal(cropContract.profile, 'T3R1_A18_FULL_CROP_CONTEXT_MATERIALIZATION_V2');
assert.equal(cropContract.stage_code, 'MID');
assert.equal(cropContract.kc, 1.15);
assert.equal(cropContract.crop_root_depth_mm, 600);
assert.equal(cropContract.effective_model_root_depth_mm, 300);
assert.equal(cropContract.coverage_policy, '[T-PT6H,T+PT30H)');
assert.equal(cropContract.future_observations_used, false);
assert.equal(cropContract.observed_biological_stage_claimed, false);
assert.equal(cropContract.field_calibration_status, 'NOT_FIELD_CALIBRATED');

const binding = manifest.runner_binding;
assert.deepEqual(binding.runner, ['MCFT_CAP09_EXTERNAL_FORMAL_V3_A18_RUNNER_V1', RUNNER_PATH, '0c14ea4f12d0e3abaff2f1ee078a292c257801b0']);
assert.deepEqual(binding.crop_materializer, [MATERIALIZER_PATH, 'd14e91370814ef7e6b3a6d0a321082513ee2304a']);
assert.deepEqual(binding.tick_service, [TICK_SERVICE_PATH, 'd0d91e0b1f0392efe544824429461494fc9c45a7']);
assert.deepEqual(binding.db_evidence_source, [EVIDENCE_SOURCE_PATH, '1327e4c818db482ac3fc3e3ebc1061319d8d229f']);
assert.deepEqual(binding.scheduler, [SCHEDULER_PATH, '6133206095ca3a98ab5e8ae514ee4610404d2edd']);
assert.deepEqual(binding.required_order, [
  'list_missed_slots',
  'read_exact_runtime_config',
  'materialize_and_verify_full_crop_context',
  'db_only_evidence_precheck_at_actual_snapshot',
  'claim_due_slot',
  'execute_amendment11_tick_with_same_claim_fence',
  'record_terminal_result',
]);
assert.deepEqual(binding.preclaim_fail_closed, ['RUNTIME_CONFIG_MISSING', 'RUNTIME_CONFIG_PIN_MISMATCH', 'CROP_CONTEXT_BINDING_FAILED', 'EVIDENCE_PRECHECK_FAILED']);
assert.equal(binding.postclaim_failure_terminal_state, 'FAILED');
assert.equal(binding.provider_requests, 0);
assert.equal(binding.r2_requests, 0);

const temporal = manifest.temporal_semantics;
assert.equal(temporal.provider_availability_watermark, 'PROVIDER_AVAILABILITY_WATERMARK_V1');
assert.equal(temporal.evidence_snapshot_time_source, 'CALLER_SUPPLIED_ACTUAL_RUNTIME_SNAPSHOT');
assert.equal(temporal.freshness_is_late_authoritative_admission_gate, false);
assert.equal(temporal.historical_online_freshness_diagnostic_hours, 6);
assert.equal(temporal.fixed_lag_authority_used, false);

assert.equal(manifest.nonclaims.runtime_configs_persisted, false);
assert.equal(manifest.nonclaims.prewindow_a0_persisted, false);
assert.equal(manifest.nonclaims.scheduler_live_claim_executed, false);
assert.equal(manifest.nonclaims.canonical_runtime_write_executed, false);
assert.equal(manifest.nonclaims.ea5e3_authorized, false);
assert.equal(manifest.nonclaims.formal_o00_started, false);
assert.equal(manifest.nonclaims.formal_execution_count, '0/24');
assert.equal(manifest.nonclaims.mcft_cap09_completed, false);
assert.equal(manifest.next_legal_frontier_after_effectiveness, 'EA5E3_READINESS_PREAUTHORIZATION_BEFORE_O00_MINUS_12H');

assert(materializer.includes('CONTEXT_IDENTITY_HASH_DOES_NOT_ALONE_ATTEST_FULL_MATERIALIZED_PAYLOAD'), 'A18C_IDENTITY_NOT_FULL_PAYLOAD_MARKER_REQUIRED');
assert(materializer.includes('A18_FULL_CONTEXT_MATERIALIZATION_HASH_REQUIRED'), 'A18C_FULL_MATERIALIZATION_HASH_MARKER_REQUIRED');
assert(materializer.includes('T3R1_A18_FULL_CROP_CONTEXT_MATERIALIZATION_V2'), 'A18C_MATERIALIZATION_PROFILE_REQUIRED');
assert(materializer.includes('EXTERNAL_FORMAL_A18_FROZEN_IDENTITY_HASH_MISMATCH'), 'A18C_IDENTITY_EQUALITY_FAIL_CLOSED_REQUIRED');

const listIndex = runner.indexOf('listMissedSlots(');
const readIndex = runner.indexOf('readRuntimeConfig(');
const materializeIndex = runner.indexOf('cropContextMaterializer.materialize(');
const evidenceIndex = runner.indexOf('evidenceSource.loadCandidateRecords(');
const claimIndex = runner.indexOf('claimDueSlot(');
const executeIndex = runner.indexOf('tickService.executeClaimedTick(');
const terminalIndex = runner.indexOf('scheduler.recordTerminalResult(');
for (const [name, index] of Object.entries({listIndex, readIndex, materializeIndex, evidenceIndex, claimIndex, executeIndex, terminalIndex})) {
  assert(index >= 0, `A18C_RUNNER_MARKER_MISSING:${name}`);
}
assert(listIndex < readIndex && readIndex < materializeIndex && materializeIndex < evidenceIndex && evidenceIndex < claimIndex && claimIndex < executeIndex && executeIndex < terminalIndex, 'A18C_RUNNER_PRECLAIM_ORDER_REGRESSION');
assert(runner.includes('EXTERNAL_FORMAL_A18_RUNNER_CROP_CONTEXT_MATERIALIZATION_HASH_MISMATCH'), 'A18C_RUNNER_FULL_CONTEXT_HASH_FAIL_CLOSED_REQUIRED');
assert(runner.includes('status: "NOT_READY_PRECLAIM"'), 'A18C_PRECLAIM_NOT_READY_REQUIRED');
assert(runner.includes('state: "FAILED"'), 'A18C_POSTCLAIM_FAILED_TERMINAL_REQUIRED');
assert(tickService.includes('actual-snapshot temporal semantics'), 'A18C_AMENDMENT11_TICK_SERVICE_REQUIRED');
assert(evidenceSource.includes('read-only database Evidence source'), 'A18C_DB_ONLY_EVIDENCE_SOURCE_REQUIRED');
assert(evidenceSource.includes('actual execution evidence snapshot time'), 'A18C_ACTUAL_SNAPSHOT_EVIDENCE_REQUIRED');
assert(scheduler.includes('one bounded O00-O23 schedule'), 'A18C_PERSISTENT_SCHEDULER_REQUIRED');

const candidateText = JSON.stringify(manifest) + runner + materializer;
for (const forbidden of [
  'scheduler_eligibility_lag_hours = 7',
  'T+06:30',
  'T+07:12',
  'T+07:17',
  'evidence_snapshot_delay_minutes = 432',
  'observer_delay_minutes = 437',
  'freshness_is_late_authoritative_admission_gate = true',
]) {
  assert(!candidateText.includes(forbidden), `A18C_FIXED_LAG_REGRESSION_FORBIDDEN:${forbidden}`);
}

const result = {
  schema_version: 'geox_mcft_cap09_a18c_manifest_runner_governance_result_v1',
  status: 'PASS',
  exact_base_main_sha: manifest.exact_base_main_sha,
  manifest_ref: manifest.manifest_ref,
  manifest_hash: manifest.manifest_hash,
  exact_slot_count: 24,
  a18b_config_pin_ssot_required: true,
  narrow_identity_hash_preserved: true,
  full_materialization_hash_required: true,
  runner_preclaim_readiness_before_claim_required: true,
  postclaim_failure_terminalization_required: true,
  provider_availability_watermark: temporal.provider_availability_watermark,
  fixed_lag_authority_used: false,
  live_database_write_authorized: false,
  ea5e3_authorized: false,
  prewindow_a0_persisted: false,
  formal_o00_started: false,
  formal_execution_count: '0/24',
  next_legal_frontier_after_effectiveness: manifest.next_legal_frontier_after_effectiveness,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
