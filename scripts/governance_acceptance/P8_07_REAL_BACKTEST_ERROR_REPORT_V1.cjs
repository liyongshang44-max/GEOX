// scripts/governance_acceptance/P8_07_REAL_BACKTEST_ERROR_REPORT_V1.cjs
// Purpose: verify the P8-07 Real Backtest Error Report v1 gate.
// Boundary: validates read-only comparison between P8 prediction and holdout actuals; later P8 files may exist on the same branch.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P8_07_REAL_BACKTEST_ERROR_REPORT_V1';
const NEXT_STEP = 'P8_08_REAL_CALIBRATION_REPORT_V1';
const PREVIOUS_DOC = 'docs/tasks/P8-06-Real-Actual-Observation-Window-v0.md';
const PREVIOUS_SCRIPT = 'scripts/governance_acceptance/P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0.cjs';
const CURRENT_DOC = 'docs/tasks/P8-07-Real-Backtest-Error-Report-v1.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P8_07_REAL_BACKTEST_ERROR_REPORT_V1.cjs';
const RUNTIME_SCRIPT = 'scripts/twin_kernel/P8_07_REAL_BACKTEST_ERROR_REPORT_V1.cjs';
const P8_07_FILES = [CURRENT_DOC, CURRENT_SCRIPT, RUNTIME_SCRIPT];
const REQUIRED_FIELDS = ['backtest_error_report_id', 'output_kind', 'project_id', 'subject_ref', 'sensor_ref', 'sensor_group_ref', 'metric_kind', 'unit', 'backtest_method', 'generated_for_as_of_ts', 'compared_window_start_ts', 'compared_window_end_ts', 'compared_horizon_steps', 'compared_point_count', 'compared_metric_count', 'input_prediction_run_ref', 'input_actual_observation_window_ref', 'input_state_estimate_ref', 'input_evidence_window_ref', 'error_summary', 'error_by_point', 'evidence_refs', 'actual_refs', 'source_query_refs', 'trace_refs', 'read_only', 'determinism_hash'];
const ERROR_FIELDS = ['point_mae', 'point_rmse', 'point_bias', 'point_max_absolute_error', 'metric_mae', 'metric_rmse', 'metric_bias', 'metric_max_absolute_error', 'coverage_compared_point_count', 'coverage_compared_metric_count'];
const EXPECTED_TARGETS = ['2009-06-09T05:00:00.000Z', '2009-06-09T06:00:00.000Z', '2009-06-09T07:00:00.000Z'];
const assertions = [];

function abs(file) { return path.resolve(ROOT, file); }
function exists(file) { return fs.existsSync(abs(file)); }
function read(file) { return fs.readFileSync(abs(file), 'utf8'); }
function tryGit(args) { try { return childProcess.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return ''; } }
function changedFilesFromMain() { return [...new Set(tryGit(['diff', '--name-only', 'main...HEAD']).split(/\r?\n/).map((line) => line.trim()).filter(Boolean))].sort(); }
function section(text, heading) { const marker = `## ${heading}`; const start = text.indexOf(marker); if (start < 0) return []; const open = text.indexOf('```text', start); if (open < 0) return []; const bodyStart = text.indexOf('\n', open) + 1; const close = text.indexOf('```', bodyStart); if (close < 0) return []; return text.slice(bodyStart, close).split(/\r?\n/).map((line) => line.trim()).filter(Boolean); }
function assert(name, condition, details = {}) { assertions.push({ name, passed: condition === true, details }); if (condition !== true) { const error = new Error(`ASSERTION_FAILED:${name}`); error.details = details; throw error; } }
function summary() { const failed = assertions.filter((item) => !item.passed); return { assertion_count: assertions.length, failed_assertion_count: failed.length, failed_assertions: failed.map((item) => item.name) }; }

function verifyDocs() {
  for (const file of [PREVIOUS_DOC, PREVIOUS_SCRIPT, CURRENT_DOC, CURRENT_SCRIPT, RUNTIME_SCRIPT]) assert(`file_exists:${file}`, exists(file), { file });
  assert('p8_06_handoff_verified', read(PREVIOUS_DOC).includes(ACCEPTANCE), { PREVIOUS_DOC });
  const doc = read(CURRENT_DOC);
  assert('doc_has_gate', doc.includes(ACCEPTANCE), { CURRENT_DOC });
  assert('doc_has_next_step', doc.includes(NEXT_STEP), { CURRENT_DOC });
  assert('runtime_file_count', section(doc, 'Runtime files created in P8-07').length === 3, { files: section(doc, 'Runtime files created in P8-07') });
  assert('required_output_field_count', section(doc, 'Required output fields').length === REQUIRED_FIELDS.length, { fields: section(doc, 'Required output fields') });
  assert('error_metric_count', section(doc, 'Error metrics').length === ERROR_FIELDS.length, { fields: section(doc, 'Error metrics') });
  assert('comparison_rule_count', section(doc, 'Comparison rules').length === 8, { rules: section(doc, 'Comparison rules') });
  assert('strict_prohibition_count', section(doc, 'Runtime strict prohibitions').length === 16, { rules: section(doc, 'Runtime strict prohibitions') });
}

function verifyRuntimeSource() {
  const runtime = read(RUNTIME_SCRIPT);
  assert('runtime_imports_p8_05_prediction_run', runtime.includes('P8_05_REAL_PREDICTION_RUN_V1.cjs'), { RUNTIME_SCRIPT });
  assert('runtime_imports_p8_06_actual_window', runtime.includes('P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0.cjs'), { RUNTIME_SCRIPT });
  assert('runtime_has_no_p8_08_dependency', !runtime.includes('P8_08'), { RUNTIME_SCRIPT });
  assert('runtime_has_no_db_mutation_text', !/insert\s+into|update\s+[^\n]+set|delete\s+from|create\s+table|alter\s+table/i.test(runtime), { RUNTIME_SCRIPT });
}

function runRuntimeJson() {
  const firstText = childProcess.execFileSync('node', [RUNTIME_SCRIPT], { cwd: ROOT, encoding: 'utf8', env: process.env });
  const secondText = childProcess.execFileSync('node', [RUNTIME_SCRIPT], { cwd: ROOT, encoding: 'utf8', env: process.env });
  const first = JSON.parse(firstText);
  const second = JSON.parse(secondText);
  assert('runtime_output_is_deterministic', JSON.stringify(first) === JSON.stringify(second), { first_hash: first.determinism_hash, second_hash: second.determinism_hash });
  return first;
}

function verifyRuntimeOutput(output) {
  for (const field of REQUIRED_FIELDS) assert(`runtime_output_field_present:${field}`, Object.prototype.hasOwnProperty.call(output, field), { output_keys: Object.keys(output) });
  assert('output_kind_verified', output.output_kind === 'real_backtest_error_report_v1', { output_kind: output.output_kind });
  assert('scope_verified', output.project_id === 'P_DEFAULT' && output.sensor_group_ref?.ref_id === 'G_CAF' && output.sensor_ref?.ref_id === 'CAF009' && output.metric_kind === 'soil_moisture', { project_id: output.project_id, sensor_group_ref: output.sensor_group_ref, sensor_ref: output.sensor_ref, metric_kind: output.metric_kind });
  assert('prediction_vs_actual_verified', output.input_prediction_run_ref?.kind === 'real_soil_moisture_prediction_run_v1' && output.input_actual_observation_window_ref?.kind === 'real_actual_observation_window_v0', { prediction_ref: output.input_prediction_run_ref, actual_ref: output.input_actual_observation_window_ref });
  assert('compared_window_verified', output.compared_window_start_ts === EXPECTED_TARGETS[0] && output.compared_window_end_ts === EXPECTED_TARGETS[2], { start: output.compared_window_start_ts, end: output.compared_window_end_ts });
  assert('error_summary_present', ERROR_FIELDS.every((field) => Object.prototype.hasOwnProperty.call(output.error_summary || {}, field)), { error_summary: output.error_summary });
  assert('error_by_point_count', Array.isArray(output.error_by_point) && output.error_by_point.length === 3, { error_by_point: output.error_by_point });
  assert('error_target_timestamps_verified', output.error_by_point.map((point) => point.target_ts).join('|') === EXPECTED_TARGETS.join('|'), { targets: output.error_by_point.map((point) => point.target_ts) });
  assert('errors_are_numeric', output.error_by_point.every((point) => Number.isFinite(point.predicted_value) && Number.isFinite(point.actual_value) && Number.isFinite(point.error) && Number.isFinite(point.absolute_error)), { error_by_point: output.error_by_point });
  assert('metric_errors_present', output.error_by_point.every((point) => Array.isArray(point.error_by_metric) && point.error_by_metric.length > 0), { error_by_point: output.error_by_point });
  assert('compared_metric_count_positive', Number.isInteger(output.compared_metric_count) && output.compared_metric_count > 0, { compared_metric_count: output.compared_metric_count });
  assert('evidence_refs_preserved', Array.isArray(output.evidence_refs) && output.evidence_refs.length > 0, { evidence_refs_length: output.evidence_refs?.length });
  assert('actual_refs_preserved', Array.isArray(output.actual_refs) && output.actual_refs.length > 0, { actual_refs_length: output.actual_refs?.length });
  assert('source_query_refs_preserved', Array.isArray(output.source_query_refs) && output.source_query_refs.length >= 2, { source_query_refs: output.source_query_refs });
  assert('read_only_true', output.read_only === true, { read_only: output.read_only });
  assert('determinism_hash_sha256', /^[a-f0-9]{64}$/.test(output.determinism_hash), { determinism_hash: output.determinism_hash });
}

function verifyChangedFiles() {
  const changedFiles = changedFilesFromMain();
  const scoped = changedFiles.filter((file) => P8_07_FILES.includes(file));
  if (changedFiles.length > 0) assert('p8_07_changed_file_count', scoped.length === 3, { scoped, changedFiles });
  return { changedFiles, scoped };
}

try {
  verifyDocs();
  verifyRuntimeSource();
  const output = runRuntimeJson();
  verifyRuntimeOutput(output);
  const changed = verifyChangedFiles();
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, p8_06_verified: true, prediction_vs_actual_verified: true, error_summary_present: true, error_by_point_count: output.error_by_point.length, compared_metric_count_positive: true, evidence_refs_preserved: true, actual_refs_preserved: true, source_query_refs_preserved: true, read_only: true, determinism_stable: true, changed_file_count: changed.scoped.length, branch_changed_file_count: changed.changedFiles.length, changed_files: changed.scoped, backtest_error_report_id: output.backtest_error_report_id, point_mae: output.error_summary.point_mae, point_rmse: output.error_summary.point_rmse, metric_mae: output.error_summary.metric_mae, determinism_hash: output.determinism_hash, ...summary(), next_step: NEXT_STEP }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
