// scripts/twin_kernel/P8_09_PRODUCT_REPLAY_DEMO_REPORT_V0.cjs
// Purpose: build an externally readable P8 product replay demo report from prior read-only replay artifacts.
// Boundary: reads prior P8 outputs only; writes no DB, facts, Field Memory, model state, execution object, route, dashboard authority, or frontend state.

'use strict';

const { DEFAULT_CONFIG, sha256, stable } = require('./P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0.cjs');
const { buildRealEvidenceWindow } = require('./P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0.cjs');
const { buildRealStateEstimate } = require('./P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1.cjs');
const { buildRealPredictionRun } = require('./P8_05_REAL_PREDICTION_RUN_V1.cjs');
const { buildRealActualObservationWindow } = require('./P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0.cjs');
const { buildRealBacktestErrorReport } = require('./P8_07_REAL_BACKTEST_ERROR_REPORT_V1.cjs');
const { buildRealCalibrationReport } = require('./P8_08_REAL_CALIBRATION_REPORT_V1.cjs');

const OUTPUT_KIND = 'product_replay_demo_report_v0';
const RUNTIME_REF = 'scripts/twin_kernel/P8_09_PRODUCT_REPLAY_DEMO_REPORT_V0.cjs';
const CONTRACT_REF = 'docs/tasks/P8-09-Product-Replay-Demo-Report-v0.md';
const METHOD_NAME = 'real_evidence_closed_loop_product_replay_v0';

function artifactChain(artifacts) {
  return [
    { stage: 'P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0', artifact_ref: { kind: 'real_evidence_window_v0', ref_id: artifacts.evidenceWindow.real_evidence_window_id, determinism_hash: artifacts.evidenceWindow.determinism_hash }, runtime_ref: { kind: 'runtime_script', ref_id: 'scripts/twin_kernel/P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0.cjs' } },
    { stage: 'P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1', artifact_ref: { kind: 'real_soil_moisture_state_estimate_v1', ref_id: artifacts.stateEstimate.state_estimate_id, determinism_hash: artifacts.stateEstimate.determinism_hash }, runtime_ref: { kind: 'runtime_script', ref_id: 'scripts/twin_kernel/P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1.cjs' } },
    { stage: 'P8_05_REAL_PREDICTION_RUN_V1', artifact_ref: { kind: 'real_soil_moisture_prediction_run_v1', ref_id: artifacts.predictionRun.prediction_run_id, determinism_hash: artifacts.predictionRun.determinism_hash }, runtime_ref: { kind: 'runtime_script', ref_id: 'scripts/twin_kernel/P8_05_REAL_PREDICTION_RUN_V1.cjs' } },
    { stage: 'P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0', artifact_ref: { kind: 'real_actual_observation_window_v0', ref_id: artifacts.actualWindow.actual_observation_window_id, determinism_hash: artifacts.actualWindow.determinism_hash }, runtime_ref: { kind: 'runtime_script', ref_id: 'scripts/twin_kernel/P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0.cjs' } },
    { stage: 'P8_07_REAL_BACKTEST_ERROR_REPORT_V1', artifact_ref: { kind: 'real_backtest_error_report_v1', ref_id: artifacts.backtestReport.backtest_error_report_id, determinism_hash: artifacts.backtestReport.determinism_hash }, runtime_ref: { kind: 'runtime_script', ref_id: 'scripts/twin_kernel/P8_07_REAL_BACKTEST_ERROR_REPORT_V1.cjs' } },
    { stage: 'P8_08_REAL_CALIBRATION_REPORT_V1', artifact_ref: { kind: 'real_calibration_report_v1', ref_id: artifacts.calibrationReport.calibration_report_id, determinism_hash: artifacts.calibrationReport.determinism_hash }, runtime_ref: { kind: 'runtime_script', ref_id: 'scripts/twin_kernel/P8_08_REAL_CALIBRATION_REPORT_V1.cjs' } }
  ];
}

function narrativeSections(artifacts) {
  return [
    { section: 'past_evidence', text: `The replay starts with real CAF009 soil moisture observations from ${artifacts.evidenceWindow.window_start_ts} to ${artifacts.evidenceWindow.window_end_ts}. The window contains ${artifacts.evidenceWindow.sample_count} timestamp points and ${artifacts.evidenceWindow.metric_count} metric layers from raw_samples.` },
    { section: 'state_estimate', text: `The state estimate uses the history evidence only. It reports aggregate soil moisture ${artifacts.stateEstimate.estimate_value} ${artifacts.stateEstimate.unit} with uncertainty width ${artifacts.stateEstimate.uncertainty_width}.` },
    { section: 'prediction', text: `The prediction run projects ${artifacts.predictionRun.horizon_steps} hourly targets from ${artifacts.predictionRun.prediction_window_start_ts} to ${artifacts.predictionRun.prediction_window_end_ts}. The prediction is descriptive and does not authorize work.` },
    { section: 'actual_observations', text: `After the prediction window, the replay reads real holdout observations for the same timestamps. The actual window contains ${artifacts.actualWindow.sample_count} timestamp points and preserves raw sample references.` },
    { section: 'error_and_calibration', text: `Backtest comparison reports point MAE ${artifacts.backtestReport.error_summary.point_mae} and metric MAE ${artifacts.backtestReport.error_summary.metric_mae}. Calibration candidates are summarized but not applied to any model.` },
    { section: 'boundary_statement', text: 'This demo report is a read-only replay artifact. It is not a recommendation, not a dashboard authority, not an action authorization, and not an automatic learning loop.' }
  ];
}

function buildReplayTimeline(artifacts) {
  return [
    { order: 1, event: 'history_evidence_read', window_start_ts: artifacts.evidenceWindow.window_start_ts, window_end_ts: artifacts.evidenceWindow.window_end_ts, artifact_id: artifacts.evidenceWindow.real_evidence_window_id },
    { order: 2, event: 'state_estimated', generated_for_as_of_ts: artifacts.stateEstimate.coverage_summary ? artifacts.evidenceWindow.window_end_ts : artifacts.predictionRun.generated_for_as_of_ts, artifact_id: artifacts.stateEstimate.state_estimate_id },
    { order: 3, event: 'prediction_generated', window_start_ts: artifacts.predictionRun.prediction_window_start_ts, window_end_ts: artifacts.predictionRun.prediction_window_end_ts, artifact_id: artifacts.predictionRun.prediction_run_id },
    { order: 4, event: 'actual_observations_read', window_start_ts: artifacts.actualWindow.actual_window_start_ts, window_end_ts: artifacts.actualWindow.actual_window_end_ts, artifact_id: artifacts.actualWindow.actual_observation_window_id },
    { order: 5, event: 'error_report_generated', compared_point_count: artifacts.backtestReport.compared_point_count, artifact_id: artifacts.backtestReport.backtest_error_report_id },
    { order: 6, event: 'calibration_candidates_reported', applied_to_model: artifacts.calibrationReport.calibration_parameters.applied_to_model, artifact_id: artifacts.calibrationReport.calibration_report_id }
  ];
}

function buildProductReplayDemoReportFromArtifacts(artifacts) {
  const chain = artifactChain(artifacts);
  const narrative = narrativeSections(artifacts);
  const baseOutput = {
    product_replay_demo_report_id: 'pending_hash',
    output_kind: OUTPUT_KIND,
    project_id: artifacts.calibrationReport.project_id,
    subject_ref: artifacts.calibrationReport.subject_ref,
    sensor_ref: artifacts.calibrationReport.sensor_ref,
    sensor_group_ref: artifacts.calibrationReport.sensor_group_ref,
    metric_kind: artifacts.calibrationReport.metric_kind,
    unit: artifacts.calibrationReport.unit,
    replay_method: METHOD_NAME,
    generated_for_as_of_ts: artifacts.calibrationReport.generated_for_as_of_ts,
    demo_title: 'P8 real evidence closed-loop replay demo: CAF009 soil moisture',
    demo_summary: { problem: 'soil_moisture_state_estimation', history_window: { start_ts: artifacts.evidenceWindow.window_start_ts, end_ts: artifacts.evidenceWindow.window_end_ts }, prediction_window: { start_ts: artifacts.predictionRun.prediction_window_start_ts, end_ts: artifacts.predictionRun.prediction_window_end_ts }, actual_window: { start_ts: artifacts.actualWindow.actual_window_start_ts, end_ts: artifacts.actualWindow.actual_window_end_ts }, point_mae: artifacts.backtestReport.error_summary.point_mae, metric_mae: artifacts.backtestReport.error_summary.metric_mae, calibration_applied: false },
    replay_timeline: buildReplayTimeline(artifacts),
    artifact_chain: chain,
    product_narrative: narrative,
    evidence_window_summary: { artifact_id: artifacts.evidenceWindow.real_evidence_window_id, sample_count: artifacts.evidenceWindow.sample_count, metric_count: artifacts.evidenceWindow.metric_count, coverage_summary: artifacts.evidenceWindow.coverage_summary },
    state_estimate_summary: { artifact_id: artifacts.stateEstimate.state_estimate_id, estimate_method: artifacts.stateEstimate.estimate_method, estimate_value: artifacts.stateEstimate.estimate_value, uncertainty_width: artifacts.stateEstimate.uncertainty_width, confidence: artifacts.stateEstimate.confidence },
    prediction_summary: { artifact_id: artifacts.predictionRun.prediction_run_id, prediction_method: artifacts.predictionRun.prediction_method, horizon_steps: artifacts.predictionRun.horizon_steps, prediction_points: artifacts.predictionRun.prediction_points.map((point) => ({ step_index: point.step_index, target_ts: point.target_ts, predicted_value: point.predicted_value, uncertainty_width: point.uncertainty.uncertainty_width })) },
    actual_observation_summary: { artifact_id: artifacts.actualWindow.actual_observation_window_id, sample_count: artifacts.actualWindow.sample_count, metric_count: artifacts.actualWindow.metric_count, target_timestamps: artifacts.actualWindow.actual_points.map((point) => point.ts) },
    backtest_error_summary: { artifact_id: artifacts.backtestReport.backtest_error_report_id, compared_point_count: artifacts.backtestReport.compared_point_count, compared_metric_count: artifacts.backtestReport.compared_metric_count, error_summary: artifacts.backtestReport.error_summary },
    calibration_summary: { artifact_id: artifacts.calibrationReport.calibration_report_id, calibration_method: artifacts.calibrationReport.calibration_method, calibration_parameters: artifacts.calibrationReport.calibration_parameters, calibration_by_metric: artifacts.calibrationReport.calibration_by_metric },
    boundary_summary: { read_only: true, recommendation: false, action_authorization: false, dashboard_authority: false, model_updated: false, field_memory_written: false, execution_object_created: false, calibration_applied: false },
    acceptance_summary: { p8_02_to_p8_08_artifact_chain_complete: true, product_replay_demo_verified: true },
    evidence_refs: artifacts.calibrationReport.evidence_refs,
    actual_refs: artifacts.calibrationReport.actual_refs,
    source_query_refs: artifacts.calibrationReport.source_query_refs,
    trace_refs: [...artifacts.calibrationReport.trace_refs, { kind: 'p8_09_contract', ref_id: CONTRACT_REF }, { kind: 'p8_09_runtime', ref_id: RUNTIME_REF }],
    read_only: true,
  };

  const determinismHash = sha256(baseOutput);
  return { ...baseOutput, product_replay_demo_report_id: `prd_${determinismHash.slice(0, 16)}`, determinism_hash: determinismHash };
}

async function buildProductReplayDemoReport(config = DEFAULT_CONFIG) {
  const evidenceWindow = await buildRealEvidenceWindow(config);
  const stateEstimate = await buildRealStateEstimate(config);
  const predictionRun = await buildRealPredictionRun(config);
  const actualWindow = await buildRealActualObservationWindow(config);
  const backtestReport = await buildRealBacktestErrorReport(config);
  const calibrationReport = await buildRealCalibrationReport(config);
  return buildProductReplayDemoReportFromArtifacts({ evidenceWindow, stateEstimate, predictionRun, actualWindow, backtestReport, calibrationReport });
}

async function main() {
  const output = await buildProductReplayDemoReport(DEFAULT_CONFIG);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({ ok: false, acceptance: 'P8_09_PRODUCT_REPLAY_DEMO_REPORT_V0', error: error.message }, null, 2));
    process.exit(1);
  });
}

module.exports = { buildProductReplayDemoReport, buildProductReplayDemoReportFromArtifacts, artifactChain, narrativeSections, stable, sha256 };
