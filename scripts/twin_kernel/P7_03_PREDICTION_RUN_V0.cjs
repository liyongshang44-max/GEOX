// scripts/twin_kernel/P7_03_PREDICTION_RUN_V0.cjs
// Purpose: produce a deterministic read-only prediction run from the P7-02 soil moisture state estimate and its evidence window.
// Boundary: this script reads existing JSON input and prints JSON output only; it does not write DB, facts, Field Memory, models, execution objects, backtest reports, calibration reports, or frontend state.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { buildStateEstimate } = require('./P7_02_SOIL_MOISTURE_STATE_ESTIMATE_V0.cjs');

const DEFAULT_INPUT = 'scripts/twin_kernel/fixtures/P7_02_EVIDENCE_WINDOW_CAF009_SAMPLE.json';
const INPUT_PATH = process.argv[2] || DEFAULT_INPUT;
const OUTPUT_KIND = 'soil_moisture_prediction_run_v0';
const PREDICTION_RUN_VERSION = 'p7_03_prediction_run_v0';
const HORIZON_STEPS = 3;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf8'));
}

function round(value, digits = 6) {
  return Number(value.toFixed(digits));
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

function addMs(isoTs, ms) {
  return new Date(new Date(isoTs).getTime() + ms).toISOString();
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clampSoilMoisture(value) {
  return Math.max(0, Math.min(1, value));
}

function metricSeries(evidenceWindow, metricRef) {
  const series = evidenceWindow.samples.map((sample) => ({ sample_ref: sample.sample_ref, ts: sample.ts, value: sample.metrics[metricRef] })).filter((sample) => Number.isFinite(sample.value)).sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime() || String(a.sample_ref).localeCompare(String(b.sample_ref)));
  if (series.length < 2) throw new Error(`INSUFFICIENT_METRIC_SERIES:${metricRef}`);
  return series;
}

function stepSlope(series, expectedIntervalMs) {
  const first = series[0];
  const last = series[series.length - 1];
  const spanMs = new Date(last.ts).getTime() - new Date(first.ts).getTime();
  const spanSteps = Math.max(1, spanMs / expectedIntervalMs);
  return (last.value - first.value) / spanSteps;
}

function predictByMetric(evidenceWindow, stateEstimate, stepIndex) {
  return stateEstimate.estimate_by_metric.map((metricEstimate) => {
    const series = metricSeries(evidenceWindow, metricEstimate.metric_ref);
    const slope = stepSlope(series, evidenceWindow.expected_interval_ms);
    const predictedValue = clampSoilMoisture(metricEstimate.latest_value + slope * stepIndex);
    return { metric_ref: metricEstimate.metric_ref, source_latest_ts: metricEstimate.latest_ts, source_latest_value: metricEstimate.latest_value, slope_per_step: round(slope), predicted_value: round(predictedValue) };
  });
}

function buildPredictionRun(evidenceWindow) {
  const stateEstimate = buildStateEstimate(evidenceWindow);
  const stepMs = evidenceWindow.expected_interval_ms;
  const predictionPoints = Array.from({ length: HORIZON_STEPS }, (_, index) => {
    const stepIndex = index + 1;
    const byMetric = predictByMetric(evidenceWindow, stateEstimate, stepIndex);
    const predictedValue = round(mean(byMetric.map((metric) => metric.predicted_value)));
    const uncertaintyWidth = round(stateEstimate.uncertainty.uncertainty_width * (1 + stepIndex * 0.25));
    return { step_index: stepIndex, target_ts: addMs(stateEstimate.as_of_ts, stepMs * stepIndex), predicted_value: predictedValue, prediction_by_metric: byMetric, uncertainty: { method: 'state_uncertainty_growth_v0', uncertainty_width: uncertaintyWidth, lower_bound: round(Math.max(0, predictedValue - uncertaintyWidth)), upper_bound: round(Math.min(1, predictedValue + uncertaintyWidth)) } };
  });
  const baseOutput = { prediction_run_version: PREDICTION_RUN_VERSION, prediction_run_id: 'pending_hash', output_kind: OUTPUT_KIND, project_id: stateEstimate.project_id, subject_ref: stateEstimate.subject_ref, sensor_ref: stateEstimate.sensor_ref, sensor_group_ref: stateEstimate.sensor_group_ref, input_state_estimate_ref: { kind: 'soil_moisture_state_estimate_ref', ref_id: stateEstimate.state_estimate_id }, input_evidence_window_ref: stateEstimate.input_evidence_window_ref, metric_kind: stateEstimate.metric_kind, unit: stateEstimate.unit, prediction_method: 'linear_recent_window_trend_v0', generated_for_as_of_ts: stateEstimate.as_of_ts, horizon_steps: HORIZON_STEPS, step_ms: stepMs, starting_estimate_value: stateEstimate.estimate_value, prediction_points: predictionPoints, uncertainty_model: { method: 'state_uncertainty_growth_v0', source_state_uncertainty_width: stateEstimate.uncertainty.uncertainty_width }, evidence_refs: stateEstimate.evidence_refs, trace_refs: [...stateEstimate.trace_refs, { kind: 'p7_03_prediction_run_runtime', ref_id: 'scripts/twin_kernel/P7_03_PREDICTION_RUN_V0.cjs' }], provenance_ref: stateEstimate.provenance_ref, read_only: true };
  const determinismHash = sha256(baseOutput);
  return { ...baseOutput, prediction_run_id: `pr_${determinismHash.slice(0, 16)}`, determinism_hash: determinismHash };
}

function main() {
  const input = readJson(INPUT_PATH);
  const output = buildPredictionRun(input);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

if (require.main === module) main();

module.exports = { buildPredictionRun, stable, sha256 };
