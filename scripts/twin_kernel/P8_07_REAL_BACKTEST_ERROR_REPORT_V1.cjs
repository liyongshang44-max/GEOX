// scripts/twin_kernel/P8_07_REAL_BACKTEST_ERROR_REPORT_V1.cjs
// Purpose: compare P8 real prediction output with real holdout actual observations and emit a deterministic error report.
// Boundary: reads P8 prediction and actual-window artifacts only; writes no DB, facts, Field Memory, model state, execution object, route, or frontend state.

'use strict';

const { DEFAULT_CONFIG, sha256, stable } = require('./P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0.cjs');
const { buildRealPredictionRun } = require('./P8_05_REAL_PREDICTION_RUN_V1.cjs');
const { buildRealActualObservationWindow } = require('./P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0.cjs');

const OUTPUT_KIND = 'real_backtest_error_report_v1';
const RUNTIME_REF = 'scripts/twin_kernel/P8_07_REAL_BACKTEST_ERROR_REPORT_V1.cjs';
const CONTRACT_REF = 'docs/tasks/P8-07-Real-Backtest-Error-Report-v1.md';
const METHOD_NAME = 'real_prediction_vs_holdout_actuals_v1';
const COMPARED_WINDOW_START_TS = '2009-06-09T05:00:00.000Z';
const COMPARED_WINDOW_END_TS = '2009-06-09T07:00:00.000Z';

function round(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function mean(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rmse(values) {
  if (!values.length) return null;
  return Math.sqrt(mean(values.map((value) => value ** 2)));
}

function actualIndexByTs(actualWindow) {
  if (!Array.isArray(actualWindow.actual_points) || actualWindow.actual_points.length === 0) throw new Error('MISSING_ACTUAL_POINTS');
  return new Map(actualWindow.actual_points.map((point) => [point.ts, point]));
}

function compareMetricPrediction(metricPrediction, actualPoint) {
  const metricRef = metricPrediction.metric_ref;
  const actualValue = Number(actualPoint.metric_values?.[metricRef]);
  if (!Number.isFinite(actualValue)) throw new Error(`MISSING_ACTUAL_METRIC:${metricRef}`);
  const predictedValue = Number(metricPrediction.predicted_value);
  const error = predictedValue - actualValue;
  return { metric_ref: metricRef, predicted_value: round(predictedValue), actual_value: round(actualValue), error: round(error), absolute_error: round(Math.abs(error)), squared_error: round(error ** 2) };
}

function comparePoint(predictionPoint, actualPoint) {
  if (!actualPoint) throw new Error(`MISSING_ACTUAL_POINT:${predictionPoint.target_ts}`);
  const metricErrors = predictionPoint.prediction_by_metric.map((metricPrediction) => compareMetricPrediction(metricPrediction, actualPoint));
  const predictedValue = Number(predictionPoint.predicted_value);
  const actualValue = round(mean(metricErrors.map((item) => item.actual_value)));
  const aggregateError = predictedValue - actualValue;
  return { step_index: predictionPoint.step_index, target_ts: predictionPoint.target_ts, target_ts_ms: predictionPoint.target_ts_ms, predicted_value: round(predictedValue), actual_value: actualValue, error: round(aggregateError), absolute_error: round(Math.abs(aggregateError)), squared_error: round(aggregateError ** 2), error_by_metric: metricErrors, actual_point_ref: actualPoint.actual_point_ref, actual_raw_sample_refs: actualPoint.raw_sample_refs };
}

function errorSummary(errorByPoint) {
  const pointErrors = errorByPoint.map((point) => point.error);
  const pointAbs = errorByPoint.map((point) => point.absolute_error);
  const metricErrors = errorByPoint.flatMap((point) => point.error_by_metric.map((metric) => metric.error));
  const metricAbs = errorByPoint.flatMap((point) => point.error_by_metric.map((metric) => metric.absolute_error));
  return { point_mae: round(mean(pointAbs)), point_rmse: round(rmse(pointErrors)), point_bias: round(mean(pointErrors)), point_max_absolute_error: round(Math.max(...pointAbs)), metric_mae: round(mean(metricAbs)), metric_rmse: round(rmse(metricErrors)), metric_bias: round(mean(metricErrors)), metric_max_absolute_error: round(Math.max(...metricAbs)), coverage_compared_point_count: errorByPoint.length, coverage_compared_metric_count: metricErrors.length };
}

function validateInputs(predictionRun, actualWindow) {
  if (!predictionRun || predictionRun.output_kind !== 'real_soil_moisture_prediction_run_v1') throw new Error('INVALID_PREDICTION_RUN');
  if (!actualWindow || actualWindow.output_kind !== 'real_actual_observation_window_v0') throw new Error('INVALID_ACTUAL_OBSERVATION_WINDOW');
  if (predictionRun.project_id !== actualWindow.project_id) throw new Error('PROJECT_ID_MISMATCH');
  if (predictionRun.sensor_group_ref?.ref_id !== actualWindow.sensor_group_ref?.ref_id) throw new Error('SENSOR_GROUP_ID_MISMATCH');
  if (predictionRun.sensor_ref?.ref_id !== actualWindow.sensor_ref?.ref_id) throw new Error('SENSOR_ID_MISMATCH');
  if (predictionRun.metric_kind !== actualWindow.metric_kind) throw new Error('METRIC_KIND_MISMATCH');
  if (predictionRun.prediction_window_start_ts !== COMPARED_WINDOW_START_TS || predictionRun.prediction_window_end_ts !== COMPARED_WINDOW_END_TS) throw new Error('PREDICTION_WINDOW_MISMATCH');
  if (actualWindow.actual_window_start_ts !== COMPARED_WINDOW_START_TS || actualWindow.actual_window_end_ts !== COMPARED_WINDOW_END_TS) throw new Error('ACTUAL_WINDOW_MISMATCH');
  if (!Array.isArray(predictionRun.prediction_points) || predictionRun.prediction_points.length === 0) throw new Error('MISSING_PREDICTION_POINTS');
}

function buildBacktestErrorReport(predictionRun, actualWindow) {
  validateInputs(predictionRun, actualWindow);
  const actualIndex = actualIndexByTs(actualWindow);
  const errorByPoint = predictionRun.prediction_points.map((predictionPoint) => comparePoint(predictionPoint, actualIndex.get(predictionPoint.target_ts)));
  const summary = errorSummary(errorByPoint);
  const sourceQueryRefs = [predictionRun.source_query_ref, actualWindow.source_query_ref].filter(Boolean);

  const baseOutput = {
    backtest_error_report_id: 'pending_hash',
    output_kind: OUTPUT_KIND,
    project_id: predictionRun.project_id,
    subject_ref: predictionRun.subject_ref,
    sensor_ref: predictionRun.sensor_ref,
    sensor_group_ref: predictionRun.sensor_group_ref,
    metric_kind: predictionRun.metric_kind,
    unit: predictionRun.unit,
    backtest_method: METHOD_NAME,
    generated_for_as_of_ts: predictionRun.generated_for_as_of_ts,
    compared_window_start_ts: COMPARED_WINDOW_START_TS,
    compared_window_end_ts: COMPARED_WINDOW_END_TS,
    compared_horizon_steps: predictionRun.horizon_steps,
    compared_point_count: summary.coverage_compared_point_count,
    compared_metric_count: summary.coverage_compared_metric_count,
    input_prediction_run_ref: { kind: 'real_soil_moisture_prediction_run_v1', ref_id: predictionRun.prediction_run_id, determinism_hash: predictionRun.determinism_hash },
    input_actual_observation_window_ref: { kind: 'real_actual_observation_window_v0', ref_id: actualWindow.actual_observation_window_id, determinism_hash: actualWindow.determinism_hash },
    input_state_estimate_ref: predictionRun.input_state_estimate_ref,
    input_evidence_window_ref: predictionRun.input_evidence_window_ref,
    error_summary: summary,
    error_by_point: errorByPoint,
    evidence_refs: predictionRun.evidence_refs,
    actual_refs: actualWindow.actual_refs,
    source_query_refs: sourceQueryRefs,
    trace_refs: [...predictionRun.trace_refs, ...actualWindow.trace_refs, { kind: 'p8_07_contract', ref_id: CONTRACT_REF }, { kind: 'p8_07_runtime', ref_id: RUNTIME_REF }],
    read_only: true,
  };

  const determinismHash = sha256(baseOutput);
  return { ...baseOutput, backtest_error_report_id: `ber_${determinismHash.slice(0, 16)}`, determinism_hash: determinismHash };
}

async function buildRealBacktestErrorReport(config = DEFAULT_CONFIG) {
  const predictionRun = await buildRealPredictionRun(config);
  const actualWindow = await buildRealActualObservationWindow(config);
  return buildBacktestErrorReport(predictionRun, actualWindow);
}

async function main() {
  const output = await buildRealBacktestErrorReport(DEFAULT_CONFIG);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({ ok: false, acceptance: 'P8_07_REAL_BACKTEST_ERROR_REPORT_V1', error: error.message }, null, 2));
    process.exit(1);
  });
}

module.exports = { buildBacktestErrorReport, buildRealBacktestErrorReport, comparePoint, errorSummary, stable, sha256 };
