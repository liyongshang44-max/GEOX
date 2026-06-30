// scripts/twin_kernel/P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0.cjs
// Purpose: build the P8 holdout actual observation window from real raw_samples after prediction.
// Boundary: reads actual-window raw_samples and prediction output only; writes no DB, facts, Field Memory, model state, execution object, route, or frontend state.

'use strict';

const { buildRealEvidenceWindow, DEFAULT_CONFIG, sha256, stable } = require('./P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0.cjs');
const { buildRealPredictionRun } = require('./P8_05_REAL_PREDICTION_RUN_V1.cjs');

const OUTPUT_KIND = 'real_actual_observation_window_v0';
const RUNTIME_REF = 'scripts/twin_kernel/P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0.cjs';
const CONTRACT_REF = 'docs/tasks/P8-06-Real-Actual-Observation-Window-v0.md';
const ACTUAL_WINDOW_START_TS = '2009-06-09T05:00:00.000Z';
const ACTUAL_WINDOW_END_TS = '2009-06-09T07:00:00.000Z';
const EXPECTED_TARGETS = ['2009-06-09T05:00:00.000Z', '2009-06-09T06:00:00.000Z', '2009-06-09T07:00:00.000Z'];

function actualConfig(config = DEFAULT_CONFIG) {
  return { ...config, window_start_ts: ACTUAL_WINDOW_START_TS, window_end_ts: ACTUAL_WINDOW_END_TS };
}

function normalizeActualPoint(point) {
  return { actual_point_ref: point.point_ref.replace(/^ep_/, 'ap_'), ts: point.ts, ts_ms: point.ts_ms, observed_at: point.observed_at, metric_values: point.metric_values, metric_refs: point.metric_refs, raw_sample_refs: point.raw_sample_refs, source_refs: point.source_refs };
}

function buildActualWindowFromEvidence(actualEvidenceWindow, predictionRun) {
  if (!actualEvidenceWindow || actualEvidenceWindow.output_kind !== 'real_evidence_window_v0') throw new Error('INVALID_ACTUAL_EVIDENCE_WINDOW');
  if (!predictionRun || predictionRun.output_kind !== 'real_soil_moisture_prediction_run_v1') throw new Error('INVALID_INPUT_PREDICTION_RUN');
  const targetTimestamps = predictionRun.prediction_points.map((point) => point.target_ts);
  if (targetTimestamps.join('|') !== EXPECTED_TARGETS.join('|')) throw new Error('PREDICTION_TARGET_MISMATCH');
  if (actualEvidenceWindow.window_start_ts !== ACTUAL_WINDOW_START_TS || actualEvidenceWindow.window_end_ts !== ACTUAL_WINDOW_END_TS) throw new Error('ACTUAL_WINDOW_RANGE_MISMATCH');

  const actualPoints = (actualEvidenceWindow.evidence_points || []).map(normalizeActualPoint);
  if (actualPoints.length === 0) throw new Error('NO_REAL_ACTUAL_OBSERVATIONS');
  const actualTimestamps = actualPoints.map((point) => point.ts);
  if (actualTimestamps.join('|') !== EXPECTED_TARGETS.join('|')) throw new Error('ACTUAL_TARGET_TIMESTAMPS_MISMATCH');

  const baseOutput = {
    actual_observation_window_id: 'pending_hash',
    output_kind: OUTPUT_KIND,
    project_id: actualEvidenceWindow.project_id,
    subject_ref: actualEvidenceWindow.subject_ref,
    sensor_ref: actualEvidenceWindow.sensor_ref,
    sensor_group_ref: actualEvidenceWindow.sensor_group_ref,
    metric_kind: actualEvidenceWindow.metric_kind,
    unit: actualEvidenceWindow.unit,
    actual_window_start_ts: ACTUAL_WINDOW_START_TS,
    actual_window_end_ts: ACTUAL_WINDOW_END_TS,
    expected_interval_ms: actualEvidenceWindow.expected_interval_ms,
    sample_count: actualPoints.length,
    metric_count: actualEvidenceWindow.metric_count,
    metric_refs: actualEvidenceWindow.metric_refs,
    coverage_summary: actualEvidenceWindow.coverage_summary,
    actual_points: actualPoints,
    actual_refs: actualEvidenceWindow.evidence_refs,
    source_query_ref: actualEvidenceWindow.source_query_ref,
    trace_refs: [{ kind: 'p8_05_prediction_run', ref_id: predictionRun.prediction_run_id }, { kind: 'p8_06_contract', ref_id: CONTRACT_REF }, { kind: 'p8_06_runtime', ref_id: RUNTIME_REF }],
    input_prediction_run_ref: { kind: 'real_soil_moisture_prediction_run_v1', ref_id: predictionRun.prediction_run_id, determinism_hash: predictionRun.determinism_hash },
    read_only: true,
  };

  const determinismHash = sha256(baseOutput);
  return { ...baseOutput, actual_observation_window_id: `aow_${determinismHash.slice(0, 16)}`, determinism_hash: determinismHash };
}

async function buildRealActualObservationWindow(config = DEFAULT_CONFIG) {
  const predictionRun = await buildRealPredictionRun(config);
  const actualEvidenceWindow = await buildRealEvidenceWindow(actualConfig(config));
  return buildActualWindowFromEvidence(actualEvidenceWindow, predictionRun);
}

async function main() {
  const output = await buildRealActualObservationWindow(DEFAULT_CONFIG);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({ ok: false, acceptance: 'P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0', error: error.message }, null, 2));
    process.exit(1);
  });
}

module.exports = { buildRealActualObservationWindow, buildActualWindowFromEvidence, actualConfig, stable, sha256 };
