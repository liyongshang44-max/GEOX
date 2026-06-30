// scripts/twin_kernel/P7_06_REPLAY_EXPERIMENT_BUNDLE_V0.cjs
// Purpose: produce a deterministic read-only replay experiment bundle from the P7-05 calibration report.
// Boundary: this script reads existing JSON inputs and prints JSON output only; it does not write DB, facts, Field Memory, model writes, execution objects, or frontend state.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { buildCalibrationReport } = require('./P7_05_CALIBRATION_REPORT_V0.cjs');

const DEFAULT_EVIDENCE_INPUT = 'scripts/twin_kernel/fixtures/P7_02_EVIDENCE_WINDOW_CAF009_SAMPLE.json';
const DEFAULT_ACTUALS_INPUT = 'scripts/twin_kernel/fixtures/P7_04_BACKTEST_ACTUALS_CAF009_SAMPLE.json';
const EVIDENCE_INPUT_PATH = process.argv[2] || DEFAULT_EVIDENCE_INPUT;
const ACTUALS_INPUT_PATH = process.argv[3] || DEFAULT_ACTUALS_INPUT;
const OUTPUT_KIND = 'soil_moisture_replay_experiment_bundle_v0';
const REPLAY_BUNDLE_VERSION = 'p7_06_replay_experiment_bundle_v0';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf8'));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = stable(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function artifactChain(calibrationReport) {
  return [
    { stage: 'P7_01_EVIDENCE_WINDOW_CONTRACT', artifact_ref: calibrationReport.input_evidence_window_ref, runtime_ref: { kind: 'contract_doc', ref_id: 'docs/legacy/tasks/P7-01-Twin-Evidence-Window-Contract.md' } },
    { stage: 'P7_02_SOIL_MOISTURE_STATE_ESTIMATE_V0', artifact_ref: calibrationReport.input_state_estimate_ref, runtime_ref: { kind: 'runtime_script', ref_id: 'scripts/twin_kernel/P7_02_SOIL_MOISTURE_STATE_ESTIMATE_V0.cjs' } },
    { stage: 'P7_03_PREDICTION_RUN_V0', artifact_ref: calibrationReport.input_prediction_run_ref, runtime_ref: { kind: 'runtime_script', ref_id: 'scripts/twin_kernel/P7_03_PREDICTION_RUN_V0.cjs' } },
    { stage: 'P7_04_BACKTEST_ERROR_REPORT_V0', artifact_ref: calibrationReport.input_backtest_error_report_ref, runtime_ref: { kind: 'runtime_script', ref_id: 'scripts/twin_kernel/P7_04_BACKTEST_ERROR_REPORT_V0.cjs' } },
    { stage: 'P7_05_CALIBRATION_REPORT_V0', artifact_ref: { kind: 'soil_moisture_calibration_report_ref', ref_id: calibrationReport.calibration_report_id }, runtime_ref: { kind: 'runtime_script', ref_id: 'scripts/twin_kernel/P7_05_CALIBRATION_REPORT_V0.cjs' } }
  ];
}

function runtimeManifest() {
  return {
    runtime_kind: 'local_node_cli_replay_manifest_v0',
    runtime_entrypoint: 'scripts/twin_kernel/P7_06_REPLAY_EXPERIMENT_BUNDLE_V0.cjs',
    node_commands: [
      'node scripts/twin_kernel/P7_02_SOIL_MOISTURE_STATE_ESTIMATE_V0.cjs',
      'node scripts/twin_kernel/P7_03_PREDICTION_RUN_V0.cjs',
      'node scripts/twin_kernel/P7_04_BACKTEST_ERROR_REPORT_V0.cjs',
      'node scripts/twin_kernel/P7_05_CALIBRATION_REPORT_V0.cjs',
      'node scripts/twin_kernel/P7_06_REPLAY_EXPERIMENT_BUNDLE_V0.cjs'
    ],
    acceptance_commands: [
      'node scripts/governance_acceptance/P7_02_SOIL_MOISTURE_STATE_ESTIMATE_V0.cjs',
      'node scripts/governance_acceptance/P7_03_PREDICTION_RUN_V0.cjs',
      'node scripts/governance_acceptance/P7_04_BACKTEST_ERROR_REPORT_V0.cjs',
      'node scripts/governance_acceptance/P7_05_CALIBRATION_REPORT_V0.cjs',
      'node scripts/governance_acceptance/P7_06_REPLAY_EXPERIMENT_BUNDLE_V0.cjs'
    ],
    write_policy: { db_write: false, fact_write: false, field_memory_write: false, model_write: false, execution_object_write: false, frontend_state_write: false }
  };
}

function inputFixtureRefs() {
  return [
    { kind: 'evidence_window_fixture', ref_id: DEFAULT_EVIDENCE_INPUT },
    { kind: 'actuals_fixture', ref_id: DEFAULT_ACTUALS_INPUT }
  ];
}

function buildReplayExperimentBundle(evidenceWindow, actualsFixture) {
  const calibrationReport = buildCalibrationReport(evidenceWindow, actualsFixture);
  const baseOutput = { replay_bundle_version: REPLAY_BUNDLE_VERSION, replay_bundle_id: 'pending_hash', output_kind: OUTPUT_KIND, project_id: calibrationReport.project_id, subject_ref: calibrationReport.subject_ref, sensor_ref: calibrationReport.sensor_ref, sensor_group_ref: calibrationReport.sensor_group_ref, input_calibration_report_ref: { kind: 'soil_moisture_calibration_report_ref', ref_id: calibrationReport.calibration_report_id }, input_backtest_error_report_ref: calibrationReport.input_backtest_error_report_ref, input_prediction_run_ref: calibrationReport.input_prediction_run_ref, input_state_estimate_ref: calibrationReport.input_state_estimate_ref, input_evidence_window_ref: calibrationReport.input_evidence_window_ref, metric_kind: calibrationReport.metric_kind, unit: calibrationReport.unit, replay_method: 'read_only_cli_chain_manifest_v0', generated_for_as_of_ts: calibrationReport.generated_for_as_of_ts, artifact_chain: artifactChain(calibrationReport), runtime_manifest: runtimeManifest(), input_fixture_refs: inputFixtureRefs(), calibration_applied: false, evidence_refs: calibrationReport.evidence_refs, trace_refs: [...calibrationReport.trace_refs, { kind: 'p7_06_replay_experiment_bundle_runtime', ref_id: 'scripts/twin_kernel/P7_06_REPLAY_EXPERIMENT_BUNDLE_V0.cjs' }], provenance_ref: calibrationReport.provenance_ref, read_only: true };
  const determinismHash = sha256(baseOutput);
  return { ...baseOutput, replay_bundle_id: `rb_${determinismHash.slice(0, 16)}`, determinism_hash: determinismHash };
}

function main() {
  const evidenceWindow = readJson(EVIDENCE_INPUT_PATH);
  const actualsFixture = readJson(ACTUALS_INPUT_PATH);
  const output = buildReplayExperimentBundle(evidenceWindow, actualsFixture);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

if (require.main === module) main();

module.exports = { buildReplayExperimentBundle, stable, sha256 };
