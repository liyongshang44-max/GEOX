// scripts/twin_kernel/P7_04_BACKTEST_ERROR_REPORT_V0.cjs
// Purpose: produce a deterministic read-only backtest error report from the P7-03 prediction run and a fixed actuals fixture.
// Boundary: this script reads existing JSON inputs and prints JSON output only; it does not write DB, facts, Field Memory, models, execution objects, calibration reports, replay bundles, or frontend state.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { buildPredictionRun } = require('./P7_03_PREDICTION_RUN_V0.cjs');

const DEFAULT_EVIDENCE_INPUT = 'scripts/twin_kernel/fixtures/P7_02_EVIDENCE_WINDOW_CAF009_SAMPLE.json';
const DEFAULT_ACTUALS_INPUT = 'scripts/twin_kernel/fixtures/P7_04_BACKTEST_ACTUALS_CAF009_SAMPLE.json';
const EVIDENCE_INPUT_PATH = process.argv[2] || DEFAULT_EVIDENCE_INPUT;
const ACTUALS_INPUT_PATH = process.argv[3] || DEFAULT_ACTUALS_INPUT;
const OUTPUT_KIND = 'soil_moisture_backtest_error_report_v0';
const BACKTEST_REPORT_VERSION = 'p7_04_backtest_error_report_v0';

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

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rmse(values) {
  return Math.sqrt(mean(values.map((value) => value ** 2)));
}

function requireArray(name, value) {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`MISSING_ARRAY:${name}`);
}

function actualByTargetTs(actualsFixture) {
  requireArray('actual_points', actualsFixture.actual_points);
  return new Map(actualsFixture.actual_points.map((point) => [point.target_ts, point]));
}

function comparePoint(predictionPoint, actualPoint) {
  const metricErrors = predictionPoint.prediction_by_metric.map((metricPrediction) => {
    const actualValue = actualPoint.metrics[metricPrediction.metric_ref];
    if (!Number.isFinite(actualValue)) throw new Error(`MISSING_ACTUAL_METRIC:${metricPrediction.metric_ref}`);
    const error = metricPrediction.predicted_value - actualValue;
    return { metric_ref: metricPrediction.metric_ref, predicted_value: metricPrediction.predicted_value, actual_value: round(actualValue), error: round(error), absolute_error: round(Math.abs(error)), squared_error: round(error ** 2) };
  });
  const predictedValue = predictionPoint.predicted_value;
  const actualValue = round(mean(metricErrors.map((item) => item.actual_value)));
  const aggregateError = predictedValue - actualValue;
  return { step_index: predictionPoint.step_index, target_ts: predictionPoint.target_ts, predicted_value: predictedValue, actual_value: actualValue, error: round(aggregateError), absolute_error: round(Math.abs(aggregateError)), squared_error: round(aggregateError ** 2), error_by_metric: metricErrors, actual_ref: actualPoint.actual_ref };
}

function errorSummary(errorByPoint) {
  const pointErrors = errorByPoint.map((point) => point.error);
  const pointAbs = errorByPoint.map((point) => point.absolute_error);
  const metricErrors = errorByPoint.flatMap((point) => point.error_by_metric.map((metric) => metric.error));
  const metricAbs = errorByPoint.flatMap((point) => point.error_by_metric.map((metric) => metric.absolute_error));
  return { compared_point_count: errorByPoint.length, compared_metric_count: metricErrors.length, mae: round(mean(pointAbs)), rmse: round(rmse(pointErrors)), bias: round(mean(pointErrors)), max_absolute_error: round(Math.max(...pointAbs)), metric_mae: round(mean(metricAbs)), metric_rmse: round(rmse(metricErrors)), metric_bias: round(mean(metricErrors)), metric_max_absolute_error: round(Math.max(...metricAbs)) };
}

function validateInputs(predictionRun, actualsFixture) {
  if (predictionRun.metric_kind !== 'soil_moisture') throw new Error('UNSUPPORTED_PREDICTION_METRIC_KIND');
  if (actualsFixture.metric_kind !== 'soil_moisture') throw new Error('UNSUPPORTED_ACTUALS_METRIC_KIND');
  if (predictionRun.project_id !== actualsFixture.project_id) throw new Error('PROJECT_ID_MISMATCH');
  if (JSON.stringify(predictionRun.input_evidence_window_ref) !== JSON.stringify(actualsFixture.input_evidence_window_ref)) throw new Error('EVIDENCE_WINDOW_REF_MISMATCH');
  requireArray('prediction_points', predictionRun.prediction_points);
}

function buildBacktestErrorReport(evidenceWindow, actualsFixture) {
  const predictionRun = buildPredictionRun(evidenceWindow);
  validateInputs(predictionRun, actualsFixture);
  const actualIndex = actualByTargetTs(actualsFixture);
  const errorByPoint = predictionRun.prediction_points.map((point) => {
    const actualPoint = actualIndex.get(point.target_ts);
    if (!actualPoint) throw new Error(`MISSING_ACTUAL_POINT:${point.target_ts}`);
    return comparePoint(point, actualPoint);
  });
  const summary = errorSummary(errorByPoint);
  const baseOutput = { backtest_report_version: BACKTEST_REPORT_VERSION, backtest_report_id: 'pending_hash', output_kind: OUTPUT_KIND, project_id: predictionRun.project_id, subject_ref: predictionRun.subject_ref, sensor_ref: predictionRun.sensor_ref, sensor_group_ref: predictionRun.sensor_group_ref, input_prediction_run_ref: { kind: 'soil_moisture_prediction_run_ref', ref_id: predictionRun.prediction_run_id }, input_state_estimate_ref: predictionRun.input_state_estimate_ref, input_evidence_window_ref: predictionRun.input_evidence_window_ref, metric_kind: predictionRun.metric_kind, unit: predictionRun.unit, backtest_method: 'prediction_vs_actuals_fixture_v0', generated_for_as_of_ts: predictionRun.generated_for_as_of_ts, compared_horizon_steps: predictionRun.horizon_steps, compared_point_count: summary.compared_point_count, error_summary: summary, error_by_point: errorByPoint, actuals_ref: { kind: 'actuals_fixture_ref', ref_id: actualsFixture.actuals_fixture_id }, evidence_refs: [...predictionRun.evidence_refs, ...actualsFixture.evidence_refs], trace_refs: [...predictionRun.trace_refs, ...actualsFixture.trace_refs, { kind: 'p7_04_backtest_error_report_runtime', ref_id: 'scripts/twin_kernel/P7_04_BACKTEST_ERROR_REPORT_V0.cjs' }], provenance_ref: actualsFixture.provenance_ref, read_only: true };
  const determinismHash = sha256(baseOutput);
  return { ...baseOutput, backtest_report_id: `bt_${determinismHash.slice(0, 16)}`, determinism_hash: determinismHash };
}

function main() {
  const evidenceWindow = readJson(EVIDENCE_INPUT_PATH);
  const actualsFixture = readJson(ACTUALS_INPUT_PATH);
  const output = buildBacktestErrorReport(evidenceWindow, actualsFixture);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

if (require.main === module) main();

module.exports = { buildBacktestErrorReport, stable, sha256 };
