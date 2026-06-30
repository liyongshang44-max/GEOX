// scripts/governance_acceptance/P8_08_REAL_CALIBRATION_REPORT_V1.cjs
// Purpose: verify the P8-08 Real Calibration Report v1 gate.
// Boundary: validates calibration candidates only; no model update, Field Memory write, execution object, or later P8 artifact is required.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P8_08_REAL_CALIBRATION_REPORT_V1';
const NEXT_STEP = 'P8_09_PRODUCT_REPLAY_DEMO_REPORT_V0';
const PREVIOUS_DOC = 'docs/tasks/P8-07-Real-Backtest-Error-Report-v1.md';
const PREVIOUS_SCRIPT = 'scripts/governance_acceptance/P8_07_REAL_BACKTEST_ERROR_REPORT_V1.cjs';
const CURRENT_DOC = 'docs/tasks/P8-08-Real-Calibration-Report-v1.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P8_08_REAL_CALIBRATION_REPORT_V1.cjs';
const RUNTIME_SCRIPT = 'scripts/twin_kernel/P8_08_REAL_CALIBRATION_REPORT_V1.cjs';
const P8_08_FILES = [CURRENT_DOC, CURRENT_SCRIPT, RUNTIME_SCRIPT];
const REQUIRED_FIELDS = ['calibration_report_id', 'output_kind', 'project_id', 'subject_ref', 'sensor_ref', 'sensor_group_ref', 'metric_kind', 'unit', 'calibration_method', 'generated_for_as_of_ts', 'input_backtest_error_report_ref', 'input_prediction_run_ref', 'input_actual_observation_window_ref', 'input_state_estimate_ref', 'input_evidence_window_ref', 'calibration_basis', 'error_summary', 'calibration_parameters', 'calibration_by_metric', 'evidence_refs', 'actual_refs', 'source_query_refs', 'trace_refs', 'read_only', 'determinism_hash'];
const PARAM_FIELDS = ['method', 'applied_to_model', 'aggregate_additive_bias_correction_candidate', 'aggregate_multiplicative_scale_candidate', 'metric_adjustment_count', 'model_update_ref', 'field_memory_write_ref'];
const METRIC_FIELDS = ['metric_ref', 'compared_point_count', 'bias', 'mae', 'mean_predicted_value', 'mean_actual_value', 'additive_bias_correction_candidate', 'multiplicative_scale_candidate'];
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
  assert('p8_07_handoff_verified', read(PREVIOUS_DOC).includes(ACCEPTANCE), { PREVIOUS_DOC });
  const doc = read(CURRENT_DOC);
  assert('doc_has_gate', doc.includes(ACCEPTANCE), { CURRENT_DOC });
  assert('doc_has_next_step', doc.includes(NEXT_STEP), { CURRENT_DOC });
  assert('runtime_file_count', section(doc, 'Runtime files created in P8-08').length === 3, { files: section(doc, 'Runtime files created in P8-08') });
  assert('required_output_field_count', section(doc, 'Required output fields').length === REQUIRED_FIELDS.length, { fields: section(doc, 'Required output fields') });
  assert('calibration_parameter_field_count', section(doc, 'Calibration parameter fields').length === PARAM_FIELDS.length, { fields: section(doc, 'Calibration parameter fields') });
  assert('calibration_by_metric_field_count', section(doc, 'Calibration by metric fields').length === METRIC_FIELDS.length, { fields: section(doc, 'Calibration by metric fields') });
  assert('calibration_boundary_rule_count', section(doc, 'Calibration boundary rules').length === 8, { rules: section(doc, 'Calibration boundary rules') });
  assert('strict_prohibition_count', section(doc, 'Runtime strict prohibitions').length === 16, { rules: section(doc, 'Runtime strict prohibitions') });
}

function verifyRuntimeSource() {
  const runtime = read(RUNTIME_SCRIPT);
  assert('runtime_imports_p8_07_backtest_report', runtime.includes('P8_07_REAL_BACKTEST_ERROR_REPORT_V1.cjs'), { RUNTIME_SCRIPT });
  assert('runtime_has_no_p8_09_dependency', !runtime.includes('P8_09'), { RUNTIME_SCRIPT });
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
  assert('output_kind_verified', output.output_kind === 'real_calibration_report_v1', { output_kind: output.output_kind });
  assert('scope_verified', output.project_id === 'P_DEFAULT' && output.sensor_group_ref?.ref_id === 'G_CAF' && output.sensor_ref?.ref_id === 'CAF009' && output.metric_kind === 'soil_moisture', { project_id: output.project_id, sensor_group_ref: output.sensor_group_ref, sensor_ref: output.sensor_ref, metric_kind: output.metric_kind });
  assert('reads_backtest_error_report', output.input_backtest_error_report_ref?.kind === 'real_backtest_error_report_v1', { input_backtest_error_report_ref: output.input_backtest_error_report_ref });
  assert('calibration_parameters_present', PARAM_FIELDS.every((field) => Object.prototype.hasOwnProperty.call(output.calibration_parameters || {}, field)), { calibration_parameters: output.calibration_parameters });
  assert('calibration_by_metric_non_empty', Array.isArray(output.calibration_by_metric) && output.calibration_by_metric.length > 0, { calibration_by_metric: output.calibration_by_metric });
  assert('calibration_by_metric_fields_present', output.calibration_by_metric.every((row) => METRIC_FIELDS.every((field) => Object.prototype.hasOwnProperty.call(row, field))), { calibration_by_metric: output.calibration_by_metric });
  assert('applied_to_model_false', output.calibration_parameters.applied_to_model === false, { calibration_parameters: output.calibration_parameters });
  assert('model_update_absent', output.calibration_parameters.model_update_ref === null, { calibration_parameters: output.calibration_parameters });
  assert('field_memory_write_absent', output.calibration_parameters.field_memory_write_ref === null, { calibration_parameters: output.calibration_parameters });
  assert('calibration_candidates_numeric', Number.isFinite(output.calibration_parameters.aggregate_additive_bias_correction_candidate) && Number.isFinite(output.calibration_parameters.aggregate_multiplicative_scale_candidate), { calibration_parameters: output.calibration_parameters });
  assert('source_query_refs_preserved', Array.isArray(output.source_query_refs) && output.source_query_refs.length >= 2, { source_query_refs: output.source_query_refs });
  assert('evidence_refs_preserved', Array.isArray(output.evidence_refs) && output.evidence_refs.length > 0, { evidence_refs_length: output.evidence_refs?.length });
  assert('actual_refs_preserved', Array.isArray(output.actual_refs) && output.actual_refs.length > 0, { actual_refs_length: output.actual_refs?.length });
  assert('read_only_true', output.read_only === true, { read_only: output.read_only });
  assert('determinism_hash_sha256', /^[a-f0-9]{64}$/.test(output.determinism_hash), { determinism_hash: output.determinism_hash });
}

function verifyChangedFiles() {
  const changedFiles = changedFilesFromMain();
  const scoped = changedFiles.filter((file) => P8_08_FILES.includes(file));
  if (changedFiles.length > 0) assert('p8_08_changed_file_count', scoped.length === 3, { scoped, changedFiles });
  return { changedFiles, scoped };
}

try {
  verifyDocs();
  verifyRuntimeSource();
  const output = runRuntimeJson();
  verifyRuntimeOutput(output);
  const changed = verifyChangedFiles();
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, p8_07_verified: true, reads_backtest_error_report: true, calibration_parameters_present: true, calibration_by_metric_non_empty: true, applied_to_model_false: true, model_update_absent: true, field_memory_write_absent: true, read_only: true, determinism_stable: true, changed_file_count: changed.scoped.length, branch_changed_file_count: changed.changedFiles.length, changed_files: changed.scoped, calibration_report_id: output.calibration_report_id, aggregate_additive_bias_correction_candidate: output.calibration_parameters.aggregate_additive_bias_correction_candidate, aggregate_multiplicative_scale_candidate: output.calibration_parameters.aggregate_multiplicative_scale_candidate, metric_adjustment_count: output.calibration_parameters.metric_adjustment_count, determinism_hash: output.determinism_hash, ...summary(), next_step: NEXT_STEP }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
