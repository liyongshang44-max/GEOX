// scripts/twin_kernel/P7_05_CALIBRATION_REPORT_V0.cjs
// Purpose: produce a deterministic read-only calibration report from the P7-04 backtest error report.
// Boundary: this script reads existing JSON inputs and prints JSON output only; it does not write DB, facts, Field Memory, model updates, execution objects, replay bundles, or frontend state.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { buildBacktestErrorReport } = require('./P7_04_BACKTEST_ERROR_REPORT_V0.cjs');

const DEFAULT_EVIDENCE_INPUT = 'scripts/twin_kernel/fixtures/P7_02_EVIDENCE_WINDOW_CAF009_SAMPLE.json';
const DEFAULT_ACTUALS_INPUT = 'scripts/twin_kernel/fixtures/P7_04_BACKTEST_ACTUALS_CAF009_SAMPLE.json';
const EVIDENCE_INPUT_PATH = process.argv[2] || DEFAULT_EVIDENCE_INPUT;
const ACTUALS_INPUT_PATH = process.argv[3] || DEFAULT_ACTUALS_INPUT;
const OUTPUT_KIND = 'soil_moisture_calibration_report_v0';
const CALIBRATION_REPORT_VERSION = 'p7_05_calibration_report_v0';

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

function safeRatio(numerator, denominator) {
  if (!Number.isFinite(denominator) || Math.abs(denominator) < 0.000001) return 1;
  return numerator / denominator;
}

function calibrationByMetric(backtestReport) {
  const metricRefs = [...new Set(backtestReport.error_by_point.flatMap((point) => point.error_by_metric.map((metric) => metric.metric_ref)))].sort();
  return metricRefs.map((metricRef) => {
    const rows = backtestReport.error_by_point.flatMap((point) => point.error_by_metric.filter((metric) => metric.metric_ref === metricRef));
    const errors = rows.map((row) => row.error);
    const absErrors = rows.map((row) => row.absolute_error);
    const predictedMean = mean(rows.map((row) => row.predicted_value));
    const actualMean = mean(rows.map((row) => row.actual_value));
    const bias = mean(errors);
    return { metric_ref: metricRef, compared_point_count: rows.length, bias: round(bias), mae: round(mean(absErrors)), mean_predicted_value: round(predictedMean), mean_actual_value: round(actualMean), additive_bias_correction_candidate: round(-bias), multiplicative_scale_candidate: round(safeRatio(actualMean, predictedMean)) };
  });
}

function buildCalibrationParameters(backtestReport, byMetric) {
  const aggregateBias = backtestReport.error_summary.bias;
  const aggregatePredictedMean = mean(backtestReport.error_by_point.map((point) => point.predicted_value));
  const aggregateActualMean = mean(backtestReport.error_by_point.map((point) => point.actual_value));
  return { method: 'backtest_bias_summary_v0', applied_to_model: false, aggregate_additive_bias_correction_candidate: round(-aggregateBias), aggregate_multiplicative_scale_candidate: round(safeRatio(aggregateActualMean, aggregatePredictedMean)), metric_adjustment_count: byMetric.length, model_update_ref: null };
}

function buildCalibrationReport(evidenceWindow, actualsFixture) {
  const backtestReport = buildBacktestErrorReport(evidenceWindow, actualsFixture);
  const byMetric = calibrationByMetric(backtestReport);
  const parameters = buildCalibrationParameters(backtestReport, byMetric);
  const baseOutput = { calibration_report_version: CALIBRATION_REPORT_VERSION, calibration_report_id: 'pending_hash', output_kind: OUTPUT_KIND, project_id: backtestReport.project_id, subject_ref: backtestReport.subject_ref, sensor_ref: backtestReport.sensor_ref, sensor_group_ref: backtestReport.sensor_group_ref, input_backtest_error_report_ref: { kind: 'soil_moisture_backtest_error_report_ref', ref_id: backtestReport.backtest_report_id }, input_prediction_run_ref: backtestReport.input_prediction_run_ref, input_state_estimate_ref: backtestReport.input_state_estimate_ref, input_evidence_window_ref: backtestReport.input_evidence_window_ref, metric_kind: backtestReport.metric_kind, unit: backtestReport.unit, calibration_method: 'backtest_bias_summary_v0', generated_for_as_of_ts: backtestReport.generated_for_as_of_ts, calibration_basis: { compared_horizon_steps: backtestReport.compared_horizon_steps, compared_point_count: backtestReport.compared_point_count, compared_metric_count: backtestReport.error_summary.compared_metric_count }, error_summary: backtestReport.error_summary, calibration_parameters: parameters, calibration_by_metric: byMetric, evidence_refs: backtestReport.evidence_refs, trace_refs: [...backtestReport.trace_refs, { kind: 'p7_05_calibration_report_runtime', ref_id: 'scripts/twin_kernel/P7_05_CALIBRATION_REPORT_V0.cjs' }], provenance_ref: backtestReport.provenance_ref, read_only: true };
  const determinismHash = sha256(baseOutput);
  return { ...baseOutput, calibration_report_id: `cal_${determinismHash.slice(0, 16)}`, determinism_hash: determinismHash };
}

function main() {
  const evidenceWindow = readJson(EVIDENCE_INPUT_PATH);
  const actualsFixture = readJson(ACTUALS_INPUT_PATH);
  const output = buildCalibrationReport(evidenceWindow, actualsFixture);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

if (require.main === module) main();

module.exports = { buildCalibrationReport, stable, sha256 };
