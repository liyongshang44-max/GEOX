// scripts/twin_kernel/P8_05_REAL_PREDICTION_RUN_V1.cjs
// Purpose: produce a deterministic read-only P8 prediction run from real history evidence and the P8-04 state estimate.
// Boundary: reads history-window artifacts only and prints JSON; it writes no DB, facts, Field Memory, model state, execution object, route, or frontend state.

'use strict';

const { buildRealEvidenceWindow, DEFAULT_CONFIG, sha256, stable } = require('./P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0.cjs');
const { buildStateEstimate } = require('./P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1.cjs');

const OUTPUT_KIND = 'real_soil_moisture_prediction_run_v1';
const RUNTIME_REF = 'scripts/twin_kernel/P8_05_REAL_PREDICTION_RUN_V1.cjs';
const CONTRACT_REF = 'docs/tasks/P8-05-Real-Prediction-Run-v1.md';
const METHOD_NAME = 'linear_recent_window_trend_v1';
const HORIZON_STEPS = 3;
const STEP_MS = 3600000;
const PREDICTION_WINDOW_START_TS = '2009-06-09T05:00:00.000Z';
const PREDICTION_WINDOW_END_TS = '2009-06-09T07:00:00.000Z';

function round(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function mean(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clampSoilMoisture(value) {
  return Math.max(0, Math.min(1, value));
}

function addMs(isoTs, ms) {
  return new Date(new Date(isoTs).getTime() + ms).toISOString();
}

function metricSeries(evidenceWindow, metricRef) {
  const series = [];
  for (const point of evidenceWindow.evidence_points || []) {
    const value = Number(point.metric_values?.[metricRef]);
    if (!Number.isFinite(value)) continue;
    series.push({ point_ref: point.point_ref, ts_ms: Number(point.ts_ms), ts: point.ts, value });
  }
  const ordered = series.sort((a, b) => a.ts_ms - b.ts_ms || String(a.point_ref).localeCompare(String(b.point_ref)));
  if (ordered.length < 2) throw new Error(`INSUFFICIENT_METRIC_SERIES:${metricRef}`);
  return ordered;
}

function stepSlope(series, expectedIntervalMs) {
  const first = series[0];
  const last = series[series.length - 1];
  const spanMs = Math.max(expectedIntervalMs, last.ts_ms - first.ts_ms);
  const spanSteps = Math.max(1, spanMs / expectedIntervalMs);
  return (last.value - first.value) / spanSteps;
}

function predictMetricAtStep(evidenceWindow, metricEstimate, stepIndex) {
  const series = metricSeries(evidenceWindow, metricEstimate.metric_ref);
  const slope = stepSlope(series, evidenceWindow.expected_interval_ms || STEP_MS);
  const sourceLatestValue = Number(metricEstimate.latest_value);
  const predictedValue = clampSoilMoisture(sourceLatestValue + slope * stepIndex);
  return { metric_ref: metricEstimate.metric_ref, source_latest_ts_ms: metricEstimate.latest_observation_ts_ms, source_latest_observation_at: metricEstimate.latest_observation_at, source_latest_value: round(sourceLatestValue), slope_per_step: round(slope), predicted_value: round(predictedValue) };
}

function buildPredictionPoint(evidenceWindow, stateEstimate, stepIndex) {
  const byMetric = stateEstimate.estimate_by_metric.map((metricEstimate) => predictMetricAtStep(evidenceWindow, metricEstimate, stepIndex));
  const predictedValue = round(mean(byMetric.map((item) => item.predicted_value)));
  const sourceWidth = Number(stateEstimate.uncertainty_width || 0);
  const uncertaintyWidth = round(sourceWidth * (1 + stepIndex * 0.25));
  const targetTs = addMs(evidenceWindow.window_end_ts, (stepIndex * (evidenceWindow.expected_interval_ms || STEP_MS)));
  return { step_index: stepIndex, target_ts: targetTs, target_ts_ms: new Date(targetTs).getTime(), predicted_value: predictedValue, prediction_by_metric: byMetric, uncertainty: { method: 'state_uncertainty_growth_v1', uncertainty_width: uncertaintyWidth, lower_bound: round(Math.max(0, predictedValue - uncertaintyWidth)), upper_bound: round(Math.min(1, predictedValue + uncertaintyWidth)), unit: stateEstimate.unit || 'vwc_fraction' } };
}

function buildPredictionRun(evidenceWindow) {
  if (!evidenceWindow || evidenceWindow.output_kind !== 'real_evidence_window_v0') throw new Error('INVALID_INPUT_EVIDENCE_WINDOW');
  const stateEstimate = buildStateEstimate(evidenceWindow);
  if (!stateEstimate || stateEstimate.output_kind !== 'real_soil_moisture_state_estimate_v1') throw new Error('INVALID_STATE_ESTIMATE');

  const predictionPoints = Array.from({ length: HORIZON_STEPS }, (_, index) => buildPredictionPoint(evidenceWindow, stateEstimate, index + 1));
  const targetTimestamps = predictionPoints.map((point) => point.target_ts);
  if (targetTimestamps[0] !== PREDICTION_WINDOW_START_TS || targetTimestamps[targetTimestamps.length - 1] !== PREDICTION_WINDOW_END_TS) throw new Error('PREDICTION_WINDOW_MISMATCH');

  const baseOutput = {
    prediction_run_id: 'pending_hash',
    output_kind: OUTPUT_KIND,
    project_id: stateEstimate.project_id,
    subject_ref: stateEstimate.subject_ref,
    sensor_ref: stateEstimate.sensor_ref,
    sensor_group_ref: stateEstimate.sensor_group_ref,
    metric_kind: stateEstimate.metric_kind,
    unit: stateEstimate.unit,
    prediction_method: METHOD_NAME,
    generated_for_as_of_ts: evidenceWindow.window_end_ts,
    prediction_window_start_ts: PREDICTION_WINDOW_START_TS,
    prediction_window_end_ts: PREDICTION_WINDOW_END_TS,
    horizon_steps: HORIZON_STEPS,
    step_ms: evidenceWindow.expected_interval_ms || STEP_MS,
    input_state_estimate_ref: { kind: 'real_soil_moisture_state_estimate_v1', ref_id: stateEstimate.state_estimate_id, determinism_hash: stateEstimate.determinism_hash },
    input_evidence_window_ref: stateEstimate.input_evidence_window_ref,
    starting_estimate_value: stateEstimate.estimate_value,
    prediction_points: predictionPoints,
    uncertainty_model: { method: 'state_uncertainty_growth_v1', source_state_uncertainty_width: stateEstimate.uncertainty_width, growth_per_step_factor: 0.25, unit: stateEstimate.unit },
    evidence_refs: stateEstimate.evidence_refs,
    source_query_ref: stateEstimate.source_query_ref,
    trace_refs: [...stateEstimate.trace_refs, { kind: 'p8_05_contract', ref_id: CONTRACT_REF }, { kind: 'p8_05_runtime', ref_id: RUNTIME_REF }],
    read_only: true,
  };

  const determinismHash = sha256(baseOutput);
  return { ...baseOutput, prediction_run_id: `rpr_${determinismHash.slice(0, 16)}`, determinism_hash: determinismHash };
}

async function buildRealPredictionRun(config = DEFAULT_CONFIG) {
  const evidenceWindow = await buildRealEvidenceWindow(config);
  return buildPredictionRun(evidenceWindow);
}

async function main() {
  const output = await buildRealPredictionRun(DEFAULT_CONFIG);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({ ok: false, acceptance: 'P8_05_REAL_PREDICTION_RUN_V1', error: error.message }, null, 2));
    process.exit(1);
  });
}

module.exports = { buildPredictionRun, buildRealPredictionRun, metricSeries, stepSlope, stable, sha256 };
