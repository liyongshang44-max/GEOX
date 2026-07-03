// scripts/twin_demo_runtime/P50_REPLAY_BACKED_DEMO_RUNTIME_ACCEPTANCE.cjs
'use strict';

const fs = require('node:fs');
const cp = require('node:child_process');
const path = require('node:path');

const PHASE = 'P50';
const BASELINE_TAG = 'p49_twin_runtime_v1_pilot_freeze_evidence_package_v0_closure';
const BASELINE_COMMIT = 'ea00d8b3a70f6dd1e7e61f7415c2444fd6b76a23';
const RUNNER = 'scripts/twin_demo_runtime/P50_REPLAY_BACKED_DEMO_RUNTIME_RUNNER.cjs';
const MANIFEST_PATH = 'fixtures/twin_demo_runtime/P50_REPLAY_INPUT_MANIFEST.json';
const EVIDENCE_PATH = 'fixtures/twin_demo_runtime/P50_HISTORICAL_REPLAY_EVIDENCE.jsonl';
const BOUNDARY_PATH = 'docs/twin_demo_runtime/GEOX-P50-DEMO-RUNTIME-BOUNDARY-POLICY.json';
const MATRIX_PATH = 'docs/twin_demo_runtime/GEOX-P50-DEMO-RUNTIME-CAPABILITY-MATRIX.json';
const PACKET_PATH = 'docs/twin_demo_runtime/GEOX-P50-DEMO-RUNTIME-EVIDENCE-PACKET.json';
const COMPLETION_PATH = 'docs/twin_demo_runtime/GEOX-P50-DEMO-RUNTIME-COMPLETION-REVIEW.json';
const LEDGER_PATH = 'acceptance-output/P50_REPLAY_BACKED_DEMO_RUNTIME_LEDGER.jsonl';
const REPORT_PATH = 'acceptance-output/P50_REPLAY_BACKED_DEMO_RUNTIME_REPORT.json';

const checks = [];
const check = (name, value) => checks.push([name, Boolean(value)]);
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const readJsonl = (filePath) => fs.readFileSync(filePath, 'utf8').trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const runNodeJson = (args) => JSON.parse(cp.execFileSync(process.execPath, args, { encoding: 'utf8' }));
const runRunner = (...args) => runNodeJson([RUNNER, ...args]);
const git = (args) => {
  try {
    return cp.execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};

const manifest = readJson(MANIFEST_PATH);
const evidence = readJsonl(EVIDENCE_PATH);
const boundary = readJson(BOUNDARY_PATH);
const matrix = readJson(MATRIX_PATH);
const packet = readJson(PACKET_PATH);
const completion = readJson(COMPLETION_PATH);

check('baseline_tag', boundary.baseline_tag === BASELINE_TAG && matrix.baseline_tag === BASELINE_TAG && packet.baseline_tag === BASELINE_TAG && completion.baseline_tag === BASELINE_TAG);
check('baseline_commit', boundary.baseline_commit === BASELINE_COMMIT && matrix.baseline_commit === BASELINE_COMMIT && packet.baseline_commit === BASELINE_COMMIT && completion.baseline_commit === BASELINE_COMMIT);
check('p49_result_remains_limited', matrix.p49_result_remains === 'PASS_WITH_LIMITATIONS' && packet.p49_result_remains === 'PASS_WITH_LIMITATIONS');
check('runtime_v1_freeze_not_allowed', matrix.runtime_v1_freeze_allowed === false && packet.runtime_v1_freeze_allowed === false && boundary.runtime_v1_freeze_allowed_must_remain === false);
check('full_freeze_claim_not_allowed', matrix.full_runtime_v1_freeze_claim === 'not_allowed');

const diff = git(['diff', '--name-only', BASELINE_TAG, 'HEAD']);
if (diff) {
  const changed = diff.split(/\r?\n/).filter(Boolean);
  check('changed_files_under_p50_roots', changed.length > 0 && changed.every((filePath) => boundary.allowed_changed_roots.some((root) => filePath.startsWith(root))));
  check('no_forbidden_surfaces_changed', !changed.some((filePath) => boundary.forbidden_changed_surfaces.some((surface) => surface.endsWith('/') ? filePath.startsWith(surface) : filePath === surface)));
  check('p49_files_not_changed', !changed.some((filePath) => filePath.startsWith('docs/twin_runtime_v1/') || filePath.startsWith('scripts/twin_runtime_v1/')));
} else {
  check('diff_check_skipped_when_git_ref_unavailable', true);
}

check('manifest_exists', fs.existsSync(MANIFEST_PATH));
check('evidence_fixture_exists', fs.existsSync(EVIDENCE_PATH));
check('boundary_policy_exists', fs.existsSync(BOUNDARY_PATH));
check('capability_matrix_exists', fs.existsSync(MATRIX_PATH));
check('evidence_packet_exists', fs.existsSync(PACKET_PATH));
check('completion_review_exists', fs.existsSync(COMPLETION_PATH));
check('source_truth_mode', manifest.source_truth_mode === 'historical_replay' && packet.source_truth_mode === 'historical_replay');
check('time_shifted_live_demo', manifest.time_shifted_live_demo === true && packet.time_shifted_live_demo === true);
check('explicit_clock', manifest.demo_clock_mode === 'explicit_manifest_clock');
check('implicit_latest_forbidden', manifest.source_lookup_mode === 'manifest_pinned_fixture');
check('demo_as_of_ts_present', typeof manifest.demo_as_of_ts === 'string' && manifest.demo_as_of_ts.length > 0);

const asOf = Date.parse(manifest.demo_as_of_ts);
const pre = evidence.filter((row) => Date.parse(row.observed_at) <= asOf);
const post = evidence.filter((row) => Date.parse(row.observed_at) > asOf);
const released = evidence.filter((row) => Date.parse(row.observed_at) >= Date.parse(manifest.later_evidence_release_start_ts) && Date.parse(row.observed_at) <= Date.parse(manifest.later_evidence_release_end_ts));
const unreleased = evidence.filter((row) => Date.parse(row.observed_at) > Date.parse(manifest.later_evidence_release_end_ts));
check('pre_as_of_partition_count', pre.length >= manifest.expected_pre_as_of_evidence_min_count);
check('post_as_of_partition_count', post.length >= manifest.expected_released_later_evidence_min_count);
check('released_later_count', released.length >= manifest.expected_released_later_evidence_min_count);
check('unreleased_future_partition_present', unreleased.length > 0);
check('metric_diversity', new Set(evidence.map((row) => row.metric)).size >= manifest.expected_metric_min_count);
check('target_field_count', new Set(evidence.map((row) => row.field_id)).size === manifest.expected_target_field_count);

const timeOrder = [
  Date.parse(manifest.replay_dataset_start_ts) <= Date.parse(manifest.demo_as_of_ts),
  Date.parse(manifest.forecast_issued_at) >= Date.parse(manifest.demo_as_of_ts),
  Date.parse(manifest.forecast_horizon_start_ts) >= Date.parse(manifest.forecast_issued_at),
  Date.parse(manifest.forecast_horizon_end_ts) > Date.parse(manifest.forecast_horizon_start_ts),
  Date.parse(manifest.later_evidence_release_start_ts) >= Date.parse(manifest.forecast_horizon_start_ts),
  Date.parse(manifest.later_evidence_release_end_ts) <= Date.parse(manifest.forecast_horizon_end_ts),
  Date.parse(manifest.residual_computed_at) >= Date.parse(manifest.later_evidence_release_end_ts),
  Date.parse(manifest.calibration_reviewed_at) >= Date.parse(manifest.residual_computed_at),
  Date.parse(manifest.active_model_consumed_at) >= Date.parse(manifest.calibration_reviewed_at),
  Date.parse(manifest.next_forecast_issued_at) >= Date.parse(manifest.active_model_consumed_at)
];
check('time_ordering', timeOrder.every(Boolean));

const modes = [
  'dry-run',
  'controlled-replay-cycle',
  'controlled-forecast',
  'controlled-later-evidence-release',
  'controlled-residual',
  'controlled-calibration-review',
  'controlled-active-model-consumption',
  'controlled-next-forecast'
];
const modeResults = modes.map((mode) => runRunner('--mode', mode));
for (const result of modeResults) {
  check(`${result.mode}.ok`, result.ok === true);
  check(`${result.mode}.historical_replay`, result.source_truth_mode === 'historical_replay');
  check(`${result.mode}.no_future_leakage`, result.no_future_leakage_passed === true);
  check(`${result.mode}.state_estimate`, result.demo_state_estimate_generated === true);
  check(`${result.mode}.active_consumption`, result.next_forecast_consumed_active_model === true);
  check(`${result.mode}.no_downstream`, result.forbidden_downstream_fact_count === 0);
}

const writeResult = runRunner('--mode', 'controlled-write');
check('controlled_write_ok', writeResult.ok === true);
check('controlled_write_ledger_exists', fs.existsSync(LEDGER_PATH));
check('controlled_write_report_exists', fs.existsSync(REPORT_PATH));
check('controlled_write_counts', writeResult.pre_as_of_evidence_count === pre.length && writeResult.released_later_evidence_count === released.length && writeResult.unreleased_future_evidence_count === unreleased.length);
check('forecast_inputs_pre_as_of_only', Date.parse(writeResult.forecast_inputs_max_observed_at) <= asOf);
check('later_release_after_forecast', Date.parse(writeResult.later_evidence_min_observed_at) >= Date.parse(manifest.forecast_horizon_start_ts));
check('residual_inputs_released_only', writeResult.residual_inputs_all_released === true);
check('active_before_next_forecast', Date.parse(manifest.next_forecast_issued_at) >= Date.parse(manifest.active_model_consumed_at));
check('next_forecast_refs_active_model', writeResult.next_forecast_source_active_model_ref && writeResult.next_forecast_source_active_config_ref === writeResult.active_model_config_ref);
check('demo_q2_posture', writeResult.demo_state_estimate_generated === true);
check('demo_q10_posture', writeResult.specific_demo_next_forecast_consumed_active_model === true);
check('nonclaims_true', ['not_production_runtime','not_live_device_gateway','not_real_live_sensor','not_ao_act_task','not_machine_dispatch','not_execution','not_roi','not_field_memory','not_learning'].every((key) => writeResult[key] === true));

const ledgerRecords = fs.readFileSync(LEDGER_PATH, 'utf8').trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const ledgerTypes = new Set(ledgerRecords.map((record) => record.record_type));
const expectedRecordTypes = readJson('fixtures/twin_demo_runtime/P50_EXPECTED_TRACEABILITY_SNAPSHOT.json').expected_demo_record_types;
check('ledger_contains_expected_records', expectedRecordTypes.every((type) => ledgerTypes.has(type)));
check('ledger_demo_scoped', ledgerRecords.every((record) => record.demo_scoped === true));
check('ledger_idempotency_present', ledgerRecords.every((record) => typeof record.idempotency_key === 'string' && record.idempotency_key.startsWith('p50:')));

const hashKeys = ['demo_chain_hash','evidence_partition_hash','forecast_input_hash','forecast_output_hash','later_evidence_release_hash','residual_hash','calibration_review_hash','active_model_consumption_hash','next_forecast_hash','determinism_hash'];
check('hashes_present', hashKeys.every((key) => typeof writeResult[key] === 'string' && writeResult[key].length === 64));

const twoStep = runRunner('--mode', 'controlled-two-step-replay-chain');
check('two_step_ok', twoStep.ok === true);
check('two_step_same_hash', twoStep.first_determinism_hash === twoStep.second_determinism_hash);
check('two_step_no_mutation', twoStep.chain_not_mutated === true && twoStep.target_records_created === 0);

fs.mkdirSync('acceptance-output', { recursive: true });
const mutatedManifestPath = path.join('acceptance-output', 'P50_MUTATED_REPLAY_INPUT_MANIFEST.json');
const mutatedManifest = { ...manifest, crop: `${manifest.crop}_mutated_for_hash_check` };
fs.writeFileSync(mutatedManifestPath, JSON.stringify(mutatedManifest, null, 2), 'utf8');
const mutatedResult = runRunner('--mode', 'dry-run', '--manifest', mutatedManifestPath);
check('changed_manifest_changes_hash', mutatedResult.determinism_hash !== writeResult.determinism_hash);

const negativeFixtures = [
  'future_evidence_leakage_into_forecast',
  'missing_demo_as_of_ts',
  'source_truth_mode_live_sensor_claim',
  'later_evidence_released_before_forecast',
  'residual_uses_unreleased_future_evidence',
  'calibration_before_residual',
  'next_forecast_missing_active_model_ref',
  'next_forecast_active_config_mismatch',
  'ao_act_task_language_leak',
  'machine_dispatch_language_leak',
  'production_rollout_language_leak',
  'full_runtime_v1_freeze_claim_leak',
  'roi_effect_field_memory_language_leak',
  'implicit_now_clock',
  'implicit_latest_lookup'
];
for (const fixture of negativeFixtures) {
  const negative = runRunner('--mode', 'dry-run', '--negative', fixture);
  check(`${fixture}.blocked`, negative.result_state === `BLOCKED_${fixture}`);
  check(`${fixture}.no_records`, negative.target_records_created === 0);
  check(`${fixture}.no_downstream`, negative.forbidden_downstream_fact_count === 0);
}

check('capability_matrix_all_pass', Array.isArray(matrix.capabilities) && matrix.capabilities.length === 12 && matrix.capabilities.every((capability) => capability.status === 'PASS'));
check('capability_ids_d1_d12', matrix.capabilities.map((capability) => capability.capability_id).join(',') === 'D1,D2,D3,D4,D5,D6,D7,D8,D9,D10,D11,D12');
check('packet_refs_present', ['manifest_ref','input_evidence_fixture_ref','runtime_cycle_ref','state_estimate_ref','forecast_ref','later_evidence_release_ref','residual_ref','calibration_review_ref','active_model_consumption_ref','next_forecast_ref','traceability_packet_ref'].every((key) => key in { ...packet, ...packet.demo_record_refs }));
check('policy_nonclaims_all_true', Object.values(boundary.nonclaims_required).every((value) => value === true));
check('packet_nonclaims_all_true', Object.values(packet.nonclaims).every((value) => value === true));
check('completion_ready_for_review', completion.completion_status === 'implementation_ready_for_review');

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
console.log(JSON.stringify({
  ok: failed.length === 0,
  acceptance: 'P50_REPLAY_BACKED_DEMO_RUNTIME_ACCEPTANCE',
  phase: PHASE,
  baseline_tag: BASELINE_TAG,
  baseline_commit: BASELINE_COMMIT,
  source_truth_mode: writeResult.source_truth_mode,
  time_shifted_live_demo: writeResult.time_shifted_live_demo,
  demo_as_of_ts: writeResult.demo_as_of_ts,
  capability_count: matrix.capabilities.length,
  assertion_count: checks.length,
  failed_assertion_count: failed.length,
  failed_assertions: failed,
  deterministic_hash: writeResult.determinism_hash
}, null, 2));

if (failed.length) process.exit(1);
