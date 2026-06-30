// scripts/governance_acceptance/P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0.cjs
// Purpose: verify the P8-06 Real Actual Observation Window v0 gate.
// Boundary: validates read-only holdout actuals after prediction; later P8 files may exist on the same branch.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0';
const NEXT_STEP = 'P8_07_REAL_BACKTEST_ERROR_REPORT_V1';
const PREVIOUS_DOC = 'docs/tasks/P8-05-Real-Prediction-Run-v1.md';
const PREVIOUS_SCRIPT = 'scripts/governance_acceptance/P8_05_REAL_PREDICTION_RUN_V1.cjs';
const CURRENT_DOC = 'docs/tasks/P8-06-Real-Actual-Observation-Window-v0.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0.cjs';
const RUNTIME_SCRIPT = 'scripts/twin_kernel/P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0.cjs';
const P8_06_FILES = [CURRENT_DOC, CURRENT_SCRIPT, RUNTIME_SCRIPT];
const REQUIRED_FIELDS = ['actual_observation_window_id', 'output_kind', 'project_id', 'subject_ref', 'sensor_ref', 'sensor_group_ref', 'metric_kind', 'unit', 'actual_window_start_ts', 'actual_window_end_ts', 'expected_interval_ms', 'sample_count', 'metric_count', 'metric_refs', 'coverage_summary', 'actual_points', 'actual_refs', 'source_query_ref', 'trace_refs', 'input_prediction_run_ref', 'read_only', 'determinism_hash'];
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
  assert('p8_05_handoff_verified', read(PREVIOUS_DOC).includes(ACCEPTANCE), { PREVIOUS_DOC });
  const doc = read(CURRENT_DOC);
  assert('doc_has_gate', doc.includes(ACCEPTANCE), { CURRENT_DOC });
  assert('doc_has_next_step', doc.includes(NEXT_STEP), { CURRENT_DOC });
  assert('runtime_file_count', section(doc, 'Runtime files created in P8-06').length === 3, { files: section(doc, 'Runtime files created in P8-06') });
  assert('actual_window_contract_verified', section(doc, 'Actual observation window contract').includes('expected_timestamp_count = 3'), { contract: section(doc, 'Actual observation window contract') });
  assert('required_output_field_count', section(doc, 'Required output fields').length === REQUIRED_FIELDS.length, { fields: section(doc, 'Required output fields') });
  assert('source_query_requirement_count', section(doc, 'Source query requirements').length === 11, { rules: section(doc, 'Source query requirements') });
  assert('holdout_rule_count', section(doc, 'Holdout rules').length === 6, { rules: section(doc, 'Holdout rules') });
  assert('strict_prohibition_count', section(doc, 'Runtime strict prohibitions').length === 16, { rules: section(doc, 'Runtime strict prohibitions') });
}

function verifyRuntimeSource() {
  const runtime = read(RUNTIME_SCRIPT);
  assert('runtime_imports_p8_05_prediction_run', runtime.includes('P8_05_REAL_PREDICTION_RUN_V1.cjs'), { RUNTIME_SCRIPT });
  assert('runtime_imports_p8_02_window_builder', runtime.includes('P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0.cjs'), { RUNTIME_SCRIPT });
  assert('runtime_has_actual_window_start', runtime.includes('2009-06-09T05:00:00.000Z'), { RUNTIME_SCRIPT });
  assert('runtime_has_actual_window_end', runtime.includes('2009-06-09T07:00:00.000Z'), { RUNTIME_SCRIPT });
  assert('runtime_has_no_backtest_dependency', !runtime.includes('P8_07'), { RUNTIME_SCRIPT });
  assert('runtime_has_no_calibration_dependency', !runtime.includes('P8_08'), { RUNTIME_SCRIPT });
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
  assert('output_kind_verified', output.output_kind === 'real_actual_observation_window_v0', { output_kind: output.output_kind });
  assert('scope_verified', output.project_id === 'P_DEFAULT' && output.sensor_group_ref?.ref_id === 'G_CAF' && output.sensor_ref?.ref_id === 'CAF009' && output.metric_kind === 'soil_moisture', { project_id: output.project_id, sensor_group_ref: output.sensor_group_ref, sensor_ref: output.sensor_ref, metric_kind: output.metric_kind });
  assert('actual_window_verified', output.actual_window_start_ts === EXPECTED_TARGETS[0] && output.actual_window_end_ts === EXPECTED_TARGETS[2], { start: output.actual_window_start_ts, end: output.actual_window_end_ts });
  assert('actual_points_count', Array.isArray(output.actual_points) && output.actual_points.length === 3, { actual_points: output.actual_points });
  assert('actual_target_timestamps_verified', output.actual_points.map((point) => point.ts).join('|') === EXPECTED_TARGETS.join('|'), { targets: output.actual_points.map((point) => point.ts) });
  assert('actual_values_present', output.actual_points.every((point) => point.metric_values && Object.keys(point.metric_values).length > 0), { actual_points: output.actual_points });
  assert('actual_refs_non_empty', Array.isArray(output.actual_refs) && output.actual_refs.length > 0, { actual_refs_length: output.actual_refs?.length });
  assert('source_query_ref_present', output.source_query_ref?.kind === 'readonly_postgres_query_ref', { source_query_ref: output.source_query_ref });
  assert('input_prediction_run_ref_present', output.input_prediction_run_ref?.kind === 'real_soil_moisture_prediction_run_v1', { input_prediction_run_ref: output.input_prediction_run_ref });
  assert('read_only_true', output.read_only === true, { read_only: output.read_only });
  assert('determinism_hash_sha256', /^[a-f0-9]{64}$/.test(output.determinism_hash), { determinism_hash: output.determinism_hash });
}

function verifyChangedFiles() {
  const changedFiles = changedFilesFromMain();
  const scoped = changedFiles.filter((file) => P8_06_FILES.includes(file));
  if (changedFiles.length > 0) assert('p8_06_changed_file_count', scoped.length === 3, { scoped, changedFiles });
  return { changedFiles, scoped };
}

try {
  verifyDocs();
  verifyRuntimeSource();
  const output = runRuntimeJson();
  verifyRuntimeOutput(output);
  const changed = verifyChangedFiles();
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, p8_05_verified: true, actual_window_verified: true, actual_points_count: output.actual_points.length, does_not_mutate_prediction: true, source_query_ref_present: true, actual_refs_non_empty: true, read_only: true, determinism_stable: true, changed_file_count: changed.scoped.length, branch_changed_file_count: changed.changedFiles.length, changed_files: changed.scoped, actual_observation_window_id: output.actual_observation_window_id, first_actual_ts: output.actual_points[0].ts, last_actual_ts: output.actual_points[output.actual_points.length - 1].ts, determinism_hash: output.determinism_hash, ...summary(), next_step: NEXT_STEP }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
