// scripts/live_evidence_gateway/P51_LIVE_EVIDENCE_GATEWAY_ACCEPTANCE.cjs
'use strict';

// Use Node core only so local acceptance is stable on Windows/PowerShell.
const fs = require('node:fs');
const cp = require('node:child_process');

// Keep P51 acceptance scoped to P51 files.
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

// Collect named assertions for transparent failure output.
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

// Load contracts and expected snapshots.
const manifest = readJson(MANIFEST_PATH);
const negativeManifest = readJson(NEGATIVE_MANIFEST_PATH);
const expectedSta = readJson(EXPECTED_STA_PATH);
const expectedGeox = readJson(EXPECTED_GEOX_PATH);
const expectedSnapshot = readJson(EXPECTED_SNAPSHOT_PATH);
const boundary = readJson(BOUNDARY_PATH);

// Baseline and boundary checks.
check('baseline_tag', boundary.baseline_tag === 'p50_replay_backed_production_twin_demo_runtime_v0_closure' && manifest.baseline_tag === boundary.baseline_tag);
check('baseline_commit', boundary.baseline_commit === '9006f0229f2cca0da66160faea83823074f38b45' && manifest.baseline_commit === boundary.baseline_commit);
check('controlled_runner_only', boundary.execution_mode === 'controlled_runner_only');
check('device_source_simulated', boundary.device_source_simulated === true && manifest.device_source_simulated === true);
check('live_gateway_path_proof', boundary.live_gateway_path_proof === true && manifest.live_gateway_path_proof === true);
check('real_live_device_proof_false', boundary.real_live_device_proof === false && manifest.real_live_device_proof === false);
check('acceptance_output_only', boundary.acceptance_output_only === true);

// If git is available, ensure P51 did not modify production surfaces.
const diff = git(['diff', '--name-only', boundary.baseline_tag, 'HEAD']);
if (diff) {
  const changed = diff.split(/\r?\n/).filter(Boolean);
  check('changed_files_under_p51_roots', changed.length > 0 && changed.every((filePath) => boundary.allowed_changed_roots.some((root) => filePath.startsWith(root))));
  check('no_forbidden_surfaces_changed', !changed.some((filePath) => boundary.forbidden_changed_surfaces.some((surface) => surface.endsWith('/') ? filePath.startsWith(surface) : filePath === surface)));
} else {
  check('diff_check_skipped_when_git_ref_unavailable', true);
}

// Required files must exist.
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
  RUNNER,
].forEach((filePath) => check(`${filePath}.exists`, fs.existsSync(filePath)));

// Run all normal modes.
const dry = runRunner('--mode', 'dry-run');
const write = runRunner('--mode', 'controlled-write');
const dry2 = runRunner('--mode', 'dry-run');
check('dry_run_ok', dry.ok === true);
check('controlled_write_ok', write.ok === true);
check('two_step_same_hash', dry.deterministic_hash === dry2.deterministic_hash && dry.deterministic_hash === write.deterministic_hash);
check('hash_length', typeof write.deterministic_hash === 'string' && write.deterministic_hash.length === 64);
check('observation_count', write.observation_count === manifest.expected_observation_count && write.observation_count === expectedSta.expected_count);
check('health_envelope_count', write.health_envelope_count === manifest.expected_health_envelope_count);
check('raw_sample_count', write.raw_sample_count === expectedGeox.expected_raw_sample_count);
check('device_observation_count', write.device_observation_count === expectedGeox.expected_device_observation_count);
check('target_records_created_zero', write.target_records_created === 0);
check('acceptance_output_only_report', write.acceptance_output_only === true);

// Output files must be controlled and readable.
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

// Record type coverage.
const ledgerTypes = new Set(ledger.map((record) => record.record_type));
[
  'p51_gateway_input_manifest_v1',
  'p51_resolved_senml_record_v1',
  'p51_sensorthings_observation_v1',
  'p51_sosa_observation_v1',
  'p51_geox_raw_sample_envelope_v1',
  'p51_device_observation_compat_v1',
  'p51_sensor_health_envelope_v1',
  'p51_gateway_snapshot_v1',
].forEach((type) => check(`${type}.present`, ledgerTypes.has(type)));

// Validate SensorThings-style observations.
const staRecords = ledger.filter((record) => record.record_type === 'p51_sensorthings_observation_v1').map((record) => record.payload);
check('sensorthings_count', staRecords.length === expectedSta.expected_count);
check('sensorthings_required_fields', staRecords.every((record) => expectedSta.required_fields.every((field) => Object.prototype.hasOwnProperty.call(record, field))));
check('sensorthings_metrics', expectedSta.expected_metrics.every((metric) => staRecords.some((record) => record.ObservedProperty.name === metric)));
check('sensorthings_units', staRecords.every((record) => record.resultUnit === expectedSta.expected_units[record.ObservedProperty.name]));

// Validate SOSA-style observations.
const sosaRecords = ledger.filter((record) => record.record_type === 'p51_sosa_observation_v1').map((record) => record.payload);
check('sosa_count', sosaRecords.length === expectedSta.expected_count);
check('sosa_type', sosaRecords.every((record) => record['@type'] === 'sosa:Observation'));
check('sosa_sensor_ref', sosaRecords.every((record) => record['sosa:madeBySensor'] === manifest.device_id));
check('sosa_feature_ref', sosaRecords.every((record) => record['sosa:hasFeatureOfInterest'] === manifest.field_id));

// Validate GEOX RawSampleFactEnvelopeV1 compatibility.
const rawSamples = ledger.filter((record) => record.record_type === 'p51_geox_raw_sample_envelope_v1').map((record) => record.payload);
check('raw_sample_count_ledger', rawSamples.length === expectedGeox.expected_raw_sample_count);
check('raw_sample_source_gateway', rawSamples.every((record) => record.source === expectedGeox.raw_sample_required.source));
check('raw_sample_real_flags', rawSamples.every((record) => record.interpolated === false && record.synthetic === false));
check('raw_sample_required_ids', rawSamples.every((record) => record.sample_id && record.sensor_id && record.fact_id));
check('raw_sample_units', rawSamples.every((record) => record.unit === expectedGeox.expected_units[record.metric]));
check('soil_moisture_converted', rawSamples.some((record) => record.metric === 'soil_moisture' && record.value === 23.1 && record.unit === '%VWC'));

// Validate DeviceObservationV1 compatibility.
const deviceObservations = ledger.filter((record) => record.record_type === 'p51_device_observation_compat_v1').map((record) => record.payload);
check('device_observation_count_ledger', deviceObservations.length === expectedGeox.expected_device_observation_count);
check('device_observation_type', deviceObservations.every((record) => record.type === expectedGeox.device_observation_required.type));
check('device_observation_scope', deviceObservations.every((record) => record.tenant_id === manifest.tenant_id && record.project_id === manifest.project_id && record.group_id === manifest.group_id && record.field_id === manifest.field_id && record.device_id === manifest.device_id));
check('device_observation_units', deviceObservations.every((record) => record.metric_unit === expectedGeox.expected_units[record.metric_key]));
check('device_observation_quality', deviceObservations.every((record) => Array.isArray(record.quality_flags) && record.quality_flags.length >= 1));

// Validate device evidence health and snapshot boundary.
const healthRecords = ledger.filter((record) => record.record_type === 'p51_sensor_health_envelope_v1').map((record) => record.payload);
check('health_count', healthRecords.length === 1);
check('health_scope_evidence_only', healthRecords.every((record) => record.health_scope === 'device_evidence_health_only'));
check('health_values', healthRecords[0].battery_percent === 87 && healthRecords[0].rssi_dbm === -59 && healthRecords[0].fw_ver === 'p51-fw-0.1');
check('snapshot_type', snapshot.snapshot_type === expectedSnapshot.snapshot_type);
check('snapshot_required_sections', expectedSnapshot.required_sections.every((section) => Object.prototype.hasOwnProperty.call(snapshot, section)));
check('snapshot_no_frontend_claim', snapshot.snapshot_type === 'viewer_ready_gateway_snapshot');

// Validate real negative fixtures.
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

// Capability posture checks.
check('source_truth_mode', write.source_truth_mode === 'controlled_senml_fixture');
check('live_gateway_not_real_device', write.live_gateway_path_proof === true && write.real_live_device_proof === false);
check('metric_count', write.metric_count === expectedSnapshot.metric_count);
check('all_hashes_present', ['resolved_senml_hash','sensorthings_hash','sosa_hash','geox_raw_hash','device_observation_hash','health_hash'].every((key) => typeof write[key] === 'string' && write[key].length === 64));

// Emit stable acceptance output.
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
  observation_count: write.observation_count,
  health_envelope_count: write.health_envelope_count,
  assertion_count: checks.length,
  failed_assertion_count: failed.length,
  failed_assertions: failed,
  deterministic_hash: write.deterministic_hash
}, null, 2));

if (failed.length) process.exit(1);
