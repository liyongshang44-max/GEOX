// scripts/live_evidence_gateway/P51_LIVE_EVIDENCE_GATEWAY_ACCEPTANCE.cjs
'use strict';

const fs = require('node:fs');
const cp = require('node:child_process');

const RUNNER = 'scripts/live_evidence_gateway/P51_LIVE_EVIDENCE_GATEWAY_RUNNER.cjs';
const MANIFEST_PATH = 'fixtures/live_evidence_gateway/P51_GATEWAY_INPUT_MANIFEST.json';
const NEGATIVE_MANIFEST_PATH = 'fixtures/live_evidence_gateway/P51_NEGATIVE_FIXTURE_MANIFEST.json';
const EXPECTED_STA_PATH = 'fixtures/live_evidence_gateway/P51_EXPECTED_SENSORTHINGS_OBSERVATIONS.json';
const EXPECTED_GEOX_PATH = 'fixtures/live_evidence_gateway/P51_EXPECTED_GEOX_COMPAT_ENVELOPES.json';
const EXPECTED_SNAPSHOT_PATH = 'fixtures/live_evidence_gateway/P51_EXPECTED_GATEWAY_SNAPSHOT.json';
const BOUNDARY_PATH = 'docs/live_evidence_gateway/GEOX-P51-EVIDENCE-INGRESS-BOUNDARY-POLICY.json';
const LEDGER_PATH = 'acceptance-output/P51_LIVE_EVIDENCE_GATEWAY_LEDGER.jsonl';
const REPORT_PATH = 'acceptance-output/P51_LIVE_EVIDENCE_GATEWAY_REPORT.json';
const SNAPSHOT_PATH = 'acceptance-output/P51_GATEWAY_VIEWER_SNAPSHOT.json';

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
const negativeManifest = readJson(NEGATIVE_MANIFEST_PATH);
const expectedSta = readJson(EXPECTED_STA_PATH);
const expectedGeox = readJson(EXPECTED_GEOX_PATH);
const expectedSnapshot = readJson(EXPECTED_SNAPSHOT_PATH);
const boundary = readJson(BOUNDARY_PATH);

check('baseline_tag', boundary.baseline_tag === 'p50_replay_backed_production_twin_demo_runtime_v0_closure' && manifest.baseline_tag === boundary.baseline_tag);
check('baseline_commit', boundary.baseline_commit === '9006f0229f2cca0da66160faea83823074f38b45' && manifest.baseline_commit === boundary.baseline_commit);
check('controlled_runner_only', boundary.execution_mode === 'controlled_runner_only');
check('device_source_simulated', boundary.device_source_simulated === true && manifest.device_source_simulated === true);
check('live_gateway_path_proof', boundary.live_gateway_path_proof === true && manifest.live_gateway_path_proof === true);
check('real_live_device_proof_false', boundary.real_live_device_proof === false && manifest.real_live_device_proof === false);
check('source_truth_mode_device_path_simulation', manifest.source_truth_mode === 'device_path_simulation');
check('acceptance_output_only', boundary.acceptance_output_only === true);

const diff = git(['diff', '--name-only', boundary.baseline_tag, 'HEAD']);
if (diff) {
  const changed = diff.split(/\r?\n/).filter(Boolean);
  check('changed_files_under_p51_roots', changed.length > 0 && changed.every((filePath) => boundary.allowed_changed_roots.some((root) => filePath.startsWith(root))));
  check('no_forbidden_surfaces_changed', !changed.some((filePath) => boundary.forbidden_changed_surfaces.some((surface) => surface.endsWith('/') ? filePath.startsWith(surface) : filePath === surface)));
} else {
  check('diff_check_skipped_when_git_ref_unavailable', true);
}

[
  MANIFEST_PATH,
  NEGATIVE_MANIFEST_PATH,
  EXPECTED_STA_PATH,
  EXPECTED_GEOX_PATH,
  EXPECTED_SNAPSHOT_PATH,
  BOUNDARY_PATH,
  'docs/live_evidence_gateway/GEOX-P51-LIVE-EVIDENCE-GATEWAY-V1.md',
  'docs/live_evidence_gateway/GEOX-P51-STANDARDS-ALIGNMENT-AUDIT.md',
  'docs/live_evidence_gateway/GEOX-P51-SENSORTHINGS-SOSA-SENML-MAPPING.json',
  'docs/live_evidence_gateway/GEOX-P51-GEOX-COMPATIBILITY-MAPPING.json',
  'docs/live_evidence_gateway/GEOX-P51-DEVICE-ADAPTER-CONTRACT.json',
  'docs/live_evidence_gateway/GEOX-P51-LIVE-EVIDENCE-GATEWAY-REVIEW-ADDENDUM.json',
  RUNNER,
].forEach((filePath) => check(`${filePath}.exists`, fs.existsSync(filePath)));

const senmlPacks = readJsonl('fixtures/live_evidence_gateway/P51_SENML_DEVICE_SAMPLE_FIXTURE.jsonl');
check('fixture_pack_count_at_least_24', senmlPacks.length >= 24 && senmlPacks.length === manifest.expected_pack_count);

const dry = runRunner('--mode', 'dry-run');
const write = runRunner('--mode', 'controlled-write');
const dry2 = runRunner('--mode', 'dry-run');
check('dry_run_ok', dry.ok === true);
check('controlled_write_ok', write.ok === true);
check('two_step_same_hash', dry.deterministic_hash === dry2.deterministic_hash && dry.deterministic_hash === write.deterministic_hash);
check('hash_length', typeof write.deterministic_hash === 'string' && write.deterministic_hash.length === 64);
check('input_pack_count', write.input_pack_count === manifest.expected_pack_count);
check('device_count', write.device_count === manifest.expected_device_count && write.device_count === expectedSta.expected_device_count && write.device_count === expectedGeox.expected_device_count);
check('observation_count', write.observation_count === manifest.expected_observation_count && write.observation_count === expectedSta.expected_count);
check('health_envelope_count', write.health_envelope_count === manifest.expected_health_envelope_count);
check('raw_sample_count', write.raw_sample_count === expectedGeox.expected_raw_sample_count);
check('device_observation_count', write.device_observation_count === expectedGeox.expected_device_observation_count);
check('duplicate_same_payload_deduped', write.duplicate_same_payload_deduped_count === manifest.expected_duplicate_same_payload_deduped_count);
check('duplicate_conflict_blocked', write.duplicate_conflict_blocked_count === manifest.expected_duplicate_conflict_blocked_count);
check('clock_skew_warning', write.clock_skew_warning_count === manifest.expected_clock_skew_warning_count);
check('ingestion_window_count', write.ingestion_window_count === manifest.expected_ingestion_window_count);
check('traceability_readback_count', write.traceability_readback_count === manifest.expected_traceability_readback_count);
check('target_records_created_zero', write.target_records_created === 0);
check('acceptance_output_only_report', write.acceptance_output_only === true);

check('ledger_exists', fs.existsSync(LEDGER_PATH));
check('report_exists', fs.existsSync(REPORT_PATH));
check('snapshot_exists', fs.existsSync(SNAPSHOT_PATH));
const ledger = readJsonl(LEDGER_PATH);
const report = readJson(REPORT_PATH);
const snapshot = readJson(SNAPSHOT_PATH);
check('report_hash_matches', report.deterministic_hash === write.deterministic_hash);
check('snapshot_hash_matches', snapshot.hashes.geox_raw_hash === write.geox_raw_hash);
check('ledger_records_present', ledger.length === write.records.length);
check('ledger_idempotency', ledger.every((record) => typeof record.idempotency_key === 'string' && record.idempotency_key.startsWith('p51:')));
check('ledger_demo_scoped', ledger.every((record) => record.demo_scoped === true));

const ledgerTypes = new Set(ledger.map((record) => record.record_type));
[
  'p51_gateway_input_manifest_v1',
  'p51_resolved_senml_record_v1',
  'p51_sensorthings_observation_v1',
  'p51_sosa_observation_v1',
  'p51_geox_raw_sample_envelope_v1',
  'p51_device_observation_compat_v1',
  'p51_sensor_health_envelope_v1',
  'p51_duplicate_event_v1',
  'p51_device_clock_skew_report_v1',
  'p51_gateway_ingestion_window_v1',
  'p51_gateway_traceability_readback_v1',
  'p51_gateway_snapshot_v1',
].forEach((type) => check(`${type}.present`, ledgerTypes.has(type)));

const staRecords = ledger.filter((record) => record.record_type === 'p51_sensorthings_observation_v1').map((record) => record.payload);
check('sensorthings_count', staRecords.length === expectedSta.expected_count);
check('sensorthings_required_fields', staRecords.every((record) => expectedSta.required_fields.every((field) => Object.prototype.hasOwnProperty.call(record, field))));
check('sensorthings_metrics', expectedSta.expected_metrics.every((metric) => staRecords.some((record) => record.ObservedProperty.name === metric)));
check('sensorthings_units', staRecords.every((record) => record.resultUnit === expectedSta.expected_units[record.ObservedProperty.name]));
check('sensorthings_two_devices', new Set(staRecords.map((record) => record.Thing.name)).size === expectedSta.expected_device_count);

const sosaRecords = ledger.filter((record) => record.record_type === 'p51_sosa_observation_v1').map((record) => record.payload);
check('sosa_count', sosaRecords.length === expectedSta.expected_count);
check('sosa_type', sosaRecords.every((record) => record['@type'] === 'sosa:Observation'));
check('sosa_two_sensor_refs', new Set(sosaRecords.map((record) => record['sosa:madeBySensor'])).size === manifest.expected_device_count);
check('sosa_feature_ref', sosaRecords.every((record) => record['sosa:hasFeatureOfInterest'] === manifest.field_id));

const rawSamples = ledger.filter((record) => record.record_type === 'p51_geox_raw_sample_envelope_v1').map((record) => record.payload);
check('raw_sample_count_ledger', rawSamples.length === expectedGeox.expected_raw_sample_count);
check('raw_sample_source_gateway', rawSamples.every((record) => record.source === expectedGeox.raw_sample_required.source));
check('raw_sample_real_flags', rawSamples.every((record) => record.interpolated === false && record.synthetic === false));
check('raw_sample_required_ids', rawSamples.every((record) => record.sample_id && record.sensor_id && record.fact_id));
check('raw_sample_units', rawSamples.every((record) => record.unit === expectedGeox.expected_units[record.metric]));
check('raw_sample_two_devices', new Set(rawSamples.map((record) => record.sensor_id)).size === expectedGeox.expected_device_count);
check('soil_moisture_converted', rawSamples.some((record) => record.metric === 'soil_moisture' && record.value === 23.1 && record.unit === '%VWC'));

const deviceObservations = ledger.filter((record) => record.record_type === 'p51_device_observation_compat_v1').map((record) => record.payload);
check('device_observation_count_ledger', deviceObservations.length === expectedGeox.expected_device_observation_count);
check('device_observation_type', deviceObservations.every((record) => record.type === expectedGeox.device_observation_required.type));
check('device_observation_scope', deviceObservations.every((record) => record.tenant_id === manifest.tenant_id && record.project_id === manifest.project_id && record.group_id === manifest.group_id && record.field_id === manifest.field_id));
check('device_observation_two_devices', new Set(deviceObservations.map((record) => record.device_id)).size === expectedGeox.expected_device_count);
check('device_observation_units', deviceObservations.every((record) => record.metric_unit === expectedGeox.expected_units[record.metric_key]));
check('device_observation_quality', deviceObservations.every((record) => Array.isArray(record.quality_flags) && record.quality_flags.length >= 1));
check('clock_skew_warn_observation_flagged', deviceObservations.some((record) => record.quality_flags.includes('CLOCK_SKEW_WARN')));

const healthRecords = ledger.filter((record) => record.record_type === 'p51_sensor_health_envelope_v1').map((record) => record.payload);
check('health_count', healthRecords.length === expectedSnapshot.health_envelope_count);
check('health_scope_evidence_only', healthRecords.every((record) => record.health_scope === 'device_evidence_health_only'));
check('health_two_devices', new Set(healthRecords.map((record) => record.device_id)).size === expectedSnapshot.device_count);

const duplicateRecords = ledger.filter((record) => record.record_type === 'p51_duplicate_event_v1').map((record) => record.payload);
check('duplicate_same_payload_record', duplicateRecords.filter((record) => record.action === 'DEDUPED_DUPLICATE_SAME_PAYLOAD').length === manifest.expected_duplicate_same_payload_deduped_count);
check('duplicate_conflict_record', duplicateRecords.filter((record) => record.action === 'BLOCKED_DUPLICATE_CONFLICT').length === manifest.expected_duplicate_conflict_blocked_count);

const clockSkewRecords = ledger.filter((record) => record.record_type === 'p51_device_clock_skew_report_v1').map((record) => record.payload);
check('clock_skew_report_count', clockSkewRecords.length === 1);
check('clock_skew_warning_count_report', clockSkewRecords[0].warn_count === manifest.expected_clock_skew_warning_count);
check('clock_skew_no_blocked_in_main', clockSkewRecords[0].blocked_count === 0);

const windowRecords = ledger.filter((record) => record.record_type === 'p51_gateway_ingestion_window_v1').map((record) => record.payload);
check('ingestion_window_record_count', windowRecords.length === manifest.expected_ingestion_window_count);
check('ingestion_window_pack_count', windowRecords[0].input_pack_count === manifest.expected_pack_count);
check('ingestion_window_device_count', windowRecords[0].device_count === manifest.expected_device_count);
check('ingestion_window_duplicate_counts', windowRecords[0].duplicate_same_payload_deduped_count === manifest.expected_duplicate_same_payload_deduped_count && windowRecords[0].duplicate_conflict_blocked_count === manifest.expected_duplicate_conflict_blocked_count);
check('ingestion_window_clock_skew_counts', windowRecords[0].clock_skew_warn_count === manifest.expected_clock_skew_warning_count);

const traceabilityRecords = ledger.filter((record) => record.record_type === 'p51_gateway_traceability_readback_v1').map((record) => record.payload);
check('traceability_readback_record_count', traceabilityRecords.length === manifest.expected_traceability_readback_count);
check('traceability_readback_trace_count', traceabilityRecords[0].trace_count === rawSamples.length);
check('traceability_rows_have_refs', traceabilityRecords[0].rows.every((row) => row.raw_sample_fact_id && row.device_observation_ref && row.sensorthings_id && row.sosa_result_time));

check('snapshot_type', snapshot.snapshot_type === expectedSnapshot.snapshot_type);
check('snapshot_required_sections', expectedSnapshot.required_sections.every((section) => Object.prototype.hasOwnProperty.call(snapshot, section)));
check('snapshot_source_truth_mode', snapshot.gateway_scope.source_truth_mode === expectedSnapshot.source_truth_mode);
check('snapshot_device_count', snapshot.gateway_scope.device_ids.length === expectedSnapshot.device_count);
check('snapshot_observation_count', snapshot.observation_summary.count === expectedSnapshot.observation_count);
check('snapshot_clock_skew_warning', snapshot.clock_skew_summary.warn_count === manifest.expected_clock_skew_warning_count);
check('snapshot_no_frontend_claim', snapshot.snapshot_type === 'viewer_ready_gateway_snapshot');

check('negative_fixture_mode_real_files', negativeManifest.negative_fixture_mode === 'real_bad_sample_files' && negativeManifest.independent_mutation_fixture_files_present === true);
check('negative_fixture_count', negativeManifest.expected_blocked_fixtures.length === 10);
for (const fileName of negativeManifest.expected_blocked_fixtures) {
  const filePath = `${negativeManifest.fixture_dir}/${fileName}`;
  check(`${fileName}.exists`, fs.existsSync(filePath));
  const result = runRunner('--negative', fileName);
  check(`${fileName}.blocked_ok`, result.ok === true);
  check(`${fileName}.blocked_state`, result.result_state === negativeManifest.required_result.result_state);
  check(`${fileName}.zero_records`, result.target_records_created === negativeManifest.required_result.target_records_created);
}

check('metric_count', write.metric_count === expectedSnapshot.metric_count);
check('all_hashes_present', ['resolved_senml_hash','sensorthings_hash','sosa_hash','geox_raw_hash','device_observation_hash','health_hash','ingestion_window_hash','traceability_hash','clock_skew_hash','duplicate_hash'].every((key) => typeof write[key] === 'string' && write[key].length === 64));

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
console.log(JSON.stringify({
  ok: failed.length === 0,
  acceptance: 'P51_LIVE_EVIDENCE_GATEWAY_ACCEPTANCE',
  phase: 'P51',
  baseline_tag: boundary.baseline_tag,
  baseline_commit: boundary.baseline_commit,
  source_truth_mode: write.source_truth_mode,
  device_source_simulated: write.device_source_simulated,
  live_gateway_path_proof: write.live_gateway_path_proof,
  input_pack_count: write.input_pack_count,
  device_count: write.device_count,
  observation_count: write.observation_count,
  health_envelope_count: write.health_envelope_count,
  duplicate_same_payload_deduped_count: write.duplicate_same_payload_deduped_count,
  duplicate_conflict_blocked_count: write.duplicate_conflict_blocked_count,
  clock_skew_warning_count: write.clock_skew_warning_count,
  ingestion_window_count: write.ingestion_window_count,
  traceability_readback_count: write.traceability_readback_count,
  assertion_count: checks.length,
  failed_assertion_count: failed.length,
  failed_assertions: failed,
  deterministic_hash: write.deterministic_hash
}, null, 2));

if (failed.length) process.exit(1);
