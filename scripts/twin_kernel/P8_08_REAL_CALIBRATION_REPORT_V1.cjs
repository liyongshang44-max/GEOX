// scripts/twin_kernel/P8_08_REAL_CALIBRATION_REPORT_V1.cjs
// Purpose: summarize P8 real backtest errors into deterministic calibration candidates.
// Boundary: reads P8 backtest report only; writes no DB, facts, Field Memory, model state, execution object, route, or frontend state.

'use strict';

const { DEFAULT_CONFIG, sha256, stable } = require('./P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0.cjs');
const { buildRealBacktestErrorReport } = require('./P8_07_REAL_BACKTEST_ERROR_REPORT_V1.cjs');

const OUTPUT_KIND = 'real_calibration_report_v1';
const RUNTIME_REF = 'scripts/twin_kernel/P8_08_REAL_CALIBRATION_REPORT_V1.cjs';
const CONTRACT_REF = 'docs/tasks/P8-08-Real-Calibration-Report-v1.md';
const METHOD_NAME = 'real_backtest_bias_summary_v1';

function round(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function mean(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function safeRatio(numerator, denominator) {
  if (!Number.isFinite(denominator) || Math.abs(denominator) < 0.000001) return 1;
  return numerator / denominator;
}

function calibrationByMetric(backtestReport) {
  const metricRefs = [...new Set(backtestReport.error_by_point.flatMap((point) => point.error_by_metric.map((metric) => metric.metric_ref)))].sort();
  return metricRefs.map((metricRef) => {
    const rows = backtestReport.error_by_point.flatMap((point) => point.error_by_metric.filter((metric) => metric.metric_ref === metricRef));
    const errors = rows.map((row) => Number(row.error));
    const absErrors = rows.map((row) => Number(row.absolute_error));
    const predictedMean = mean(rows.map((row) => Number(row.predicted_value)));
    const actualMean = mean(rows.map((row) => Number(row.actual_value)));
    const bias = mean(errors);
    return { metric_ref: metricRef, compared_point_count: rows.length, bias: round(bias), mae: round(mean(absErrors)), mean_predicted_value: round(predictedMean), mean_actual_value: round(actualMean), additive_bias_correction_candidate: round(-bias), multiplicative_scale_candidate: round(safeRatio(actualMean, predictedMean)) };
  });
}

function buildCalibrationParameters(backtestReport, byMetric) {
  const aggregateBias = Number(backtestReport.error_summary.point_bias);
  const aggregatePredictedMean = mean(backtestReport.error_by_point.map((point) => Number(point.predicted_value)));
  const aggregateActualMean = mean(backtestReport.error_by_point.map((point) => Number(point.actual_value)));
  return { method: METHOD_NAME, applied_to_model: false, aggregate_additive_bias_correction_candidate: round(-aggregateBias), aggregate_multiplicative_scale_candidate: round(safeRatio(aggregateActualMean, aggregatePredictedMean)), metric_adjustment_count: byMetric.length, model_update_ref: null, field_memory_write_ref: null };
}

function validateBacktestReport(backtestReport) {
  if (!backtestReport || backtestReport.output_kind !== 'real_backtest_error_report_v1') throw new Error('INVALID_BACKTEST_ERROR_REPORT');
  if (!Array.isArray(backtestReport.error_by_point) || backtestReport.error_by_point.length === 0) throw new Error('MISSING_ERROR_BY_POINT');
  if (!backtestReport.error_summary) throw new Error('MISSING_ERROR_SUMMARY');
}

function buildCalibrationReport(backtestReport) {
  validateBacktestReport(backtestReport);
  const byMetric = calibrationByMetric(backtestReport);
  if (byMetric.length === 0) throw new Error('NO_METRIC_CALIBRATION_ROWS');
  const parameters = buildCalibrationParameters(backtestReport, byMetric);
  const baseOutput = {
    calibration_report_id: 'pending_hash',
    output_kind: OUTPUT_KIND,
    project_id: backtestReport.project_id,
    subject_ref: backtestReport.subject_ref,
    sensor_ref: backtestReport.sensor_ref,
    sensor_group_ref: backtestReport.sensor_group_ref,
    metric_kind: backtestReport.metric_kind,
    unit: backtestReport.unit,
    calibration_method: METHOD_NAME,
    generated_for_as_of_ts: backtestReport.generated_for_as_of_ts,
    input_backtest_error_report_ref: { kind: 'real_backtest_error_report_v1', ref_id: backtestReport.backtest_error_report_id, determinism_hash: backtestReport.determinism_hash },
    input_prediction_run_ref: backtestReport.input_prediction_run_ref,
    input_actual_observation_window_ref: backtestReport.input_actual_observation_window_ref,
    input_state_estimate_ref: backtestReport.input_state_estimate_ref,
    input_evidence_window_ref: backtestReport.input_evidence_window_ref,
    calibration_basis: { compared_window_start_ts: backtestReport.compared_window_start_ts, compared_window_end_ts: backtestReport.compared_window_end_ts, compared_horizon_steps: backtestReport.compared_horizon_steps, compared_point_count: backtestReport.compared_point_count, compared_metric_count: backtestReport.compared_metric_count },
    error_summary: backtestReport.error_summary,
    calibration_parameters: parameters,
    calibration_by_metric: byMetric,
    evidence_refs: backtestReport.evidence_refs,
    actual_refs: backtestReport.actual_refs,
    source_query_refs: backtestReport.source_query_refs,
    trace_refs: [...backtestReport.trace_refs, { kind: 'p8_08_contract', ref_id: CONTRACT_REF }, { kind: 'p8_08_runtime', ref_id: RUNTIME_REF }],
    read_only: true,
  };

  const determinismHash = sha256(baseOutput);
  return { ...baseOutput, calibration_report_id: `cal_${determinismHash.slice(0, 16)}`, determinism_hash: determinismHash };
}

async function buildRealCalibrationReport(config = DEFAULT_CONFIG) {
  const backtestReport = await buildRealBacktestErrorReport(config);
  return buildCalibrationReport(backtestReport);
}

async function main() {
  const output = await buildRealCalibrationReport(DEFAULT_CONFIG);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({ ok: false, acceptance: 'P8_08_REAL_CALIBRATION_REPORT_V1', error: error.message }, null, 2));
    process.exit(1);
  });
}

module.exports = { buildCalibrationReport, buildRealCalibrationReport, calibrationByMetric, buildCalibrationParameters, stable, sha256 };
